import { MUTABLE_ARRAY_METHODS, ORBIT_COMPONENT_SYMBOL } from "./constants.js";
import { concatPath, getObjectValue, parseServerSideProps, setObjectValue, stringifyValue } from "./helper.js";
export function createScope(loader, root) {
    const scopeController = new AbortController();
    const scopeSignal = scopeController.signal;
    const scopeDisposables = new Set();
    const elementControllerMap = new Map();
    const getElementSignal = (element) => {
        let elementController = elementControllerMap.get(element);
        if (!elementController) {
            elementController = new AbortController();
            elementControllerMap.set(element, elementController);
        }
        return elementController.signal;
    };
    getComponentBehavior(loader).then((component) => {
        if (scopeSignal.aborted) {
            return;
        }
        const refElementMap = new Map();
        const refHookMap = new Map();
        const stateHookMap = new Map();
        const stateDependencyMap = new Map();
        const computedMap = new Map();
        let stateValueMap;
        const getStateHooks = (path) => {
            let hooks = stateHookMap.get(path);
            if (!hooks) {
                hooks = new Set();
                stateHookMap.set(path, hooks);
            }
            return hooks;
        };
        const registerStateChange = (element, path, hook) => {
            // console.debug("register state change", path);
            // call hook immediately if stateValueMap already initialized
            if (stateValueMap) {
                hook(getObjectValue(stateValueMap, path));
            }
            getStateHooks(path).add(hook);
            getElementSignal(element).addEventListener("abort", () => {
                const hooks = stateHookMap.get(path);
                // "Set" may not exist if element is already aborted
                hooks?.delete(hook);
                // check if hooks is empty (then delete from map)
                if (hooks?.size === 0) {
                    stateHookMap.delete(path);
                    // console.debug(`no hooks registered for path "${path}"`);
                }
            });
        };
        const notifyStateChange = (path) => {
            // console.debug("notify state change to", path);
            const next = getObjectValue(stateValueMap, path);
            const hooks = stateHookMap.get(path);
            // check if hooks is empty (then delete from map)
            if (hooks?.size === 0) {
                stateHookMap.delete(path);
                // console.debug(`no hooks registered for path "${path}"`);
            }
            else {
                hooks?.forEach((hook) => hook(next));
            }
            // notify nested dependencies
            stateDependencyMap.get(path)?.forEach((dependency) => notifyStateChange(dependency));
        };
        let isCalledRef = false;
        let isCalledState = false;
        const scope = {
            disposables(...disposes) {
                disposes.forEach((dispose) => scopeDisposables.add(dispose));
            },
            ref: (hooks) => {
                if (isCalledRef) {
                    throw new Error("ref() can only be called once");
                }
                isCalledRef = true;
                if (hooks) {
                    for (const name in hooks) {
                        const refHook = hooks[name];
                        const refElement = refElementMap.get(name);
                        refHookMap.set(name, refHook);
                        // element already exists
                        if (refElement) {
                            const signal = getElementSignal(refElement);
                            const unmount = refHook(refElement, signal);
                            if (typeof unmount === "function") {
                                signal.addEventListener("abort", unmount);
                            }
                        }
                    }
                }
                return new Proxy({}, {
                    get(_, prop) {
                        return refElementMap.get(prop);
                    },
                });
            },
            state: (initialState, hooks) => {
                if (isCalledState) {
                    throw new Error("state() can only be called once");
                }
                isCalledState = true;
                const proxify = (src, state) => {
                    return new Proxy(src, {
                        get(target, prop, receiver) {
                            if (typeof prop === "string") {
                                const path = concatPath(state.path, prop);
                                if (state.caller?.length) {
                                    let stateDependencies = stateDependencyMap.get(path);
                                    if (!stateDependencies) {
                                        stateDependencies = new Set();
                                        stateDependencyMap.set(path, stateDependencies);
                                    }
                                    stateDependencies.add(state.caller);
                                    // console.debug("add trigger to notify", state.caller, "when", path, "changed");
                                }
                                if (Array.isArray(target) && MUTABLE_ARRAY_METHODS.has(prop)) {
                                    return (...args) => {
                                        const result = target[prop](...args);
                                        notifyStateChange(state.path);
                                        return result;
                                    };
                                }
                                const desc = Object.getOwnPropertyDescriptor(target, prop);
                                if (typeof desc?.value === "object") {
                                    return proxify(desc.value, {
                                        caller: state.caller,
                                        path,
                                    });
                                }
                                if (desc?.get) {
                                    const previousCaller = state.caller;
                                    state.caller = path;
                                    const result = desc.get.call(receiver);
                                    state.caller = previousCaller;
                                    return result;
                                }
                            }
                            return Reflect.get(target, prop, receiver);
                        },
                        set(target, prop, value, receiver) {
                            const prev = Reflect.get(target, prop, receiver);
                            if (prev === value) {
                                return true;
                            }
                            const result = Reflect.set(target, prop, value);
                            if (!result) {
                                return false;
                            }
                            if (typeof prop === "string") {
                                notifyStateChange(concatPath(state.path, prop));
                            }
                            return true;
                        },
                    });
                };
                const proxied = proxify(initialState, {
                    path: "",
                });
                stateValueMap = proxied;
                // register state hooks
                if (hooks) {
                    for (const path in hooks) {
                        const hook = hooks[path];
                        if (typeof hook === "function") {
                            getStateHooks(path).add(hook.bind(proxied));
                        }
                        else {
                            console.error(`invalid hook for path ${path}`, hook);
                        }
                    }
                }
                return stateValueMap;
            },
            compute: (expression) => {
                let fn = computedMap.get(expression);
                if (!fn) {
                    // expression must be a valid JavaScript expression from trusted sources
                    fn = new Function(`return \`${expression}\`;`);
                    fn = fn.bind(stateValueMap);
                    computedMap.set(expression, fn);
                }
                return fn();
            },
        };
        // traverse and observe DOM tree
        scopeDisposables.add(observeTree(root, {
            onMount: (element) => {
                for (const attribute of element.attributes) {
                    if (attribute.name === "o-ref") {
                        const refName = attribute.value;
                        const refSignal = getElementSignal(element);
                        refElementMap.set(refName, element);
                        refSignal.addEventListener("abort", () => {
                            refElementMap.delete(refName);
                        });
                        const unmount = refHookMap.get(refName)?.(element, refSignal);
                        if (typeof unmount === "function") {
                            refSignal.addEventListener("abort", unmount);
                        }
                    }
                    else if (attribute.name === "o-text") {
                        registerStateChange(element, attribute.value, (next) => {
                            element.textContent = stringifyValue(next);
                        });
                    }
                    else if (attribute.name === "o-html") {
                        registerStateChange(element, attribute.value, (next) => {
                            element.innerHTML = stringifyValue(next);
                        });
                    }
                    else if (attribute.name === "o-model") {
                        if (element instanceof HTMLInputElement) {
                            const path = attribute.value;
                            const registerEvent = (type, name) => {
                                element.addEventListener(type, () => {
                                    setObjectValue(stateValueMap, path, element[name]);
                                }, {
                                    signal: getElementSignal(element),
                                });
                            };
                            if (element.type === "checkbox") {
                                registerEvent("change", "checked");
                                registerStateChange(element, path, (next) => {
                                    element.checked = next;
                                });
                            }
                            else {
                                registerEvent("input", "value");
                                registerStateChange(element, path, (next) => {
                                    element.value = next;
                                });
                            }
                            continue;
                        }
                        // TODO: radio input and other elements (can workaround by custom logic inside component)
                        console.warn("not implemented o-model for", element);
                    }
                    else if (attribute.name === "o-if") {
                        if (element instanceof HTMLTemplateElement) {
                            const path = attribute.value;
                            const template = element;
                            const templateParent = element.parentElement ?? root;
                            const templateElements = new Set();
                            registerStateChange(element, path, (next) => {
                                if (next) {
                                    if (!templateElements.size) {
                                        for (const child of template.content.children) {
                                            const cloned = child.cloneNode(true);
                                            templateParent.appendChild(cloned);
                                            templateElements.add(cloned);
                                        }
                                    }
                                }
                                else if (templateElements.size) {
                                    // remove self from DOM tree and then MutationObserver will cleanup automatically
                                    templateElements.forEach((el) => el.remove());
                                    templateElements.clear();
                                }
                            });
                            getElementSignal(element).addEventListener("abort", () => {
                                // remove self from DOM tree and then MutationObserver will cleanup automatically
                                templateElements.forEach((el) => el.remove());
                                templateElements.clear();
                            });
                        }
                        else {
                            console.error("o-if can only be used on template element");
                        }
                    }
                    else if (attribute.name === "o-for") {
                        // for small array only
                        if (element instanceof HTMLTemplateElement) {
                            const path = attribute.value;
                            const as = element.getAttribute("as") ?? "$";
                            const template = element;
                            const templateParent = element.parentElement ?? root;
                            let templateElements = new Set();
                            const mapPath = (itemElement, each, as, index) => {
                                for (const attribute of itemElement.attributes) {
                                    if (!attribute.name.startsWith("o-")) {
                                        continue;
                                    }
                                    if (attribute.value.startsWith(`${as}.`)) {
                                        attribute.value = attribute.value.replace(`${as}.`, `${each}[${index}].`);
                                    }
                                    else if (attribute.value === as) {
                                        attribute.value = `${each}[${index}]`;
                                    }
                                }
                                if (itemElement.children.length) {
                                    for (const child of itemElement.children) {
                                        mapPath(child, each, as, index);
                                    }
                                }
                            };
                            registerStateChange(element, path, (next) => {
                                if (Array.isArray(next)) {
                                    if (templateElements.size > next.length) {
                                        const nextElements = new Set();
                                        for (const templateElement of templateElements) {
                                            if (nextElements.size < next.length) {
                                                nextElements.add(templateElement);
                                            }
                                            else {
                                                // remove self from DOM tree and then MutationObserver will cleanup automatically
                                                templateElement.remove();
                                            }
                                        }
                                        templateElements = nextElements;
                                    }
                                    else if (templateElements.size < next.length) {
                                        const clonable = template.content.children.item(0);
                                        if (clonable) {
                                            for (let i = templateElements.size; i < next.length; i++) {
                                                const cloned = clonable.cloneNode(true);
                                                mapPath(cloned, path, as, i);
                                                templateParent.appendChild(cloned);
                                                templateElements.add(cloned);
                                            }
                                        }
                                        else {
                                            console.error(`invalid template for directive o-for:`, template);
                                        }
                                    }
                                }
                                else if (templateElements.size) {
                                    // remove self from DOM tree and then MutationObserver will cleanup automatically
                                    templateElements.forEach((el) => el.remove());
                                    templateElements.clear();
                                    console.error(`invalid value for directive o-for:`, template);
                                }
                            });
                            getElementSignal(element).addEventListener("abort", () => {
                                // remove self from DOM tree and then MutationObserver will cleanup automatically
                                templateElements.forEach((el) => el.remove());
                                templateElements.clear();
                            });
                        }
                        else {
                            console.error("o-for can only be used on template element");
                        }
                    }
                    else if (attribute.name === "o-teleport") {
                        // quite important (will implement soon) but can workaround by using dialog element instead in some cases
                        console.warn(`not implemented ${attribute.name} for`, element);
                    }
                    else if (attribute.name.startsWith("o-scope")) {
                        // skip
                        continue;
                    }
                    else if (attribute.name.startsWith("o-on")) {
                        const [type, ...modifiers] = attribute.name.slice(4).split("-");
                        if (!type) {
                            console.error("invalid event type", element);
                            continue;
                        }
                        const path = attribute.value;
                        const prevent = modifiers.includes("prevent");
                        const stop = modifiers.includes("stop");
                        element.addEventListener(type, (event) => {
                            if (prevent) {
                                event.preventDefault();
                            }
                            if (stop) {
                                event.stopPropagation();
                            }
                            const fn = getObjectValue(stateValueMap, path);
                            if (typeof fn === "function") {
                                fn.bind(stateValueMap)(event);
                            }
                        }, {
                            capture: modifiers.includes("capture"),
                            once: modifiers.includes("once"),
                            passive: modifiers.includes("passive"),
                            signal: getElementSignal(element),
                        });
                        // console.error(`not implemented ${attribute.name} for`, element);
                    }
                    else if (attribute.name.startsWith("o-")) {
                        const name = attribute.name.slice(2);
                        const path = attribute.value;
                        registerStateChange(element, path, (next) => {
                            try {
                                element[name] = next;
                            }
                            catch (error) {
                                console.error(`error setting property ${name} on element`, element, error);
                            }
                        });
                    }
                }
            },
            onUnmount: (element) => {
                elementControllerMap.get(element)?.abort();
                elementControllerMap.delete(element);
            },
        }));
        // hydration
        const propsId = root.getAttribute("o-scope-props");
        const props = propsId ? parseServerSideProps(document.getElementById(propsId)?.textContent) : {};
        component.mount(scope, props);
        // notify first time
        stateHookMap.forEach((hooks, prop) => {
            const value = getObjectValue(stateValueMap, prop);
            hooks.forEach((hook) => hook(value));
        });
    });
    // dispose
    return () => {
        elementControllerMap.forEach((controller) => controller.abort());
        elementControllerMap.clear();
        scopeDisposables.forEach((disposable) => disposable());
        scopeController.abort();
    };
}
async function getComponentBehavior(loader) {
    if (isStaticComponentLoader(loader)) {
        return loader;
    }
    return await loader();
}
function isStaticComponentLoader(loader) {
    return (loader && typeof loader === "object" && loader[ORBIT_COMPONENT_SYMBOL]);
}
function observeTree(root, hooks) {
    const isNestedScope = (element) => {
        return element.hasAttribute("o-scope") && element !== root;
    };
    const onAdd = (element) => {
        if (isNestedScope(element)) {
            return;
        }
        hooks.onMount(element);
        for (const child of element.children) {
            onAdd(child);
        }
    };
    const onRemove = (element) => {
        if (isNestedScope(element)) {
            return;
        }
        for (const child of element.children) {
            onRemove(child);
        }
        hooks.onUnmount(element);
    };
    const mutationObserver = new MutationObserver((mutations) => {
        for (const mutation of mutations) {
            if (mutation.type === "childList") {
                for (const node of mutation.removedNodes) {
                    if (node instanceof Element) {
                        onRemove(node);
                    }
                }
                for (const node of mutation.addedNodes) {
                    if (node instanceof Element) {
                        onAdd(node);
                    }
                }
            }
        }
    });
    onAdd(root);
    mutationObserver.observe(root, {
        childList: true,
        subtree: true,
    });
    return () => {
        mutationObserver.disconnect();
    };
}
