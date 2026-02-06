import { MUTABLE_ARRAY_METHODS, ORBIT_COMPONENT_SYMBOL } from "./constants.js";
import { getObjectValue, parseServerSideProps, setObjectValue, stringifyValue } from "./helper.js";
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
        let stateValueMap;
        const getStateHooks = (path) => {
            let hooks = stateHookMap.get(path);
            if (!hooks) {
                hooks = new Set();
                stateHookMap.set(path, hooks);
            }
            return hooks;
        };
        const subscribeStateChange = (element, name, path, stringify) => {
            const hook = (next) => {
                element[name] = stringify?.(next) ?? next;
            };
            if (stateValueMap) {
                hook(getObjectValue(stateValueMap, path));
            }
            const hooks = getStateHooks(path);
            hooks.add(hook);
            getElementSignal(element).addEventListener("abort", () => {
                hooks.delete(hook);
            });
        };
        const notifyStateChange = (path) => {
            // console.debug("notify state change to", path);
            const next = getObjectValue(stateValueMap, path);
            stateHookMap.get(path)?.forEach((hook) => hook(next));
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
                            refHook(refElement, getElementSignal(refElement));
                        }
                    }
                }
                return new Proxy({}, {
                    get(_, prop) {
                        return refElementMap.get(prop);
                    },
                });
            },
            state: (initialState) => {
                if (isCalledState) {
                    throw new Error("state() can only be called once");
                }
                isCalledState = true;
                const proxify = (src, state) => {
                    const concat = (path, part) => path.length ? `${path}.${part}` : part;
                    return new Proxy(src, {
                        get(target, prop, receiver) {
                            if (typeof prop === "string") {
                                const path = concat(state.path, prop);
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
                                notifyStateChange(concat(state.path, prop));
                            }
                            return true;
                        },
                    });
                };
                const proxied = proxify(initialState, {
                    path: "",
                });
                stateValueMap = proxied;
                // notify first time
                stateHookMap.forEach((hooks, prop) => {
                    const value = getObjectValue(stateValueMap, prop);
                    hooks.forEach((hook) => hook(value));
                });
                return stateValueMap;
            }
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
                        refHookMap.get(refName)?.(element, refSignal);
                    }
                    else if (attribute.name === "o-text") {
                        subscribeStateChange(element, "textContent", attribute.value, stringifyValue);
                    }
                    else if (attribute.name === "o-html") {
                        subscribeStateChange(element, "innerHTML", attribute.value, stringifyValue);
                    }
                    else if (attribute.name === "o-model") {
                        if (element instanceof HTMLInputElement) {
                            const prop = attribute.value;
                            const bindEvent = (type, name) => {
                                element.addEventListener(type, () => {
                                    setObjectValue(stateValueMap, prop, element[name]);
                                }, {
                                    signal: getElementSignal(element),
                                });
                            };
                            if (element.type === "checkbox") {
                                subscribeStateChange(element, "checked", prop);
                                bindEvent("change", "checked");
                            }
                            else {
                                subscribeStateChange(element, "value", prop);
                                bindEvent("input", "value");
                            }
                            continue;
                        }
                        // TODO: radio input and other elements
                        console.error("not implemented o-model for", element);
                    }
                    else if (attribute.name === "o-if") {
                        console.error(`not implemented ${attribute.name} for`, element);
                    }
                    else if (attribute.name === "o-for") {
                        console.error(`not implemented ${attribute.name} for`, element);
                    }
                    else if (attribute.name === "o-teleport") {
                        console.error(`not implemented ${attribute.name} for`, element);
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
                        subscribeStateChange(element, name, path);
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
