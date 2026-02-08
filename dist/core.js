import { MUTABLE_ARRAY_METHODS, ORBIT_COMPONENT_SYMBOL } from "./constants.js";
import { concatPath, getObjectValue, parseServerSideProps, setObjectValue, stringifyValue } from "./helper.js";
const DEBUG_MODE = false;
const dbg = DEBUG_MODE ? console.debug : undefined;
let orbit;
// public functions
export function getOrbit() {
    if (orbit) {
        return orbit;
    }
    const scopeComponentLoaders = new Map();
    const scopeCacheMap = new Map();
    const elementScopeIdMap = new Map();
    const elementDisposablesMap = new Map();
    const elementWalkedMap = new Set();
    let mutationObserver;
    let intersectionObserver;
    const getElementDisposables = (element) => {
        let elementDisposables = elementDisposablesMap.get(element);
        if (!elementDisposables) {
            elementDisposables = new Set();
            elementDisposablesMap.set(element, elementDisposables);
        }
        return elementDisposables;
    };
    const getStateHooks = (scopeCache, path) => {
        let hooks = scopeCache.stateHookMap.get(path);
        if (!hooks) {
            hooks = new Set();
            scopeCache.stateHookMap.set(path, hooks);
        }
        return hooks;
    };
    const registerStateChange = (scopeCache, element, path, hook) => {
        // console.debug("register state change", path, "from", element);
        // call hook immediately if stateValueMap already initialized
        if (scopeCache.stateValueMap) {
            hook(getObjectValue(scopeCache.stateValueMap, path));
        }
        getStateHooks(scopeCache, path).add(hook);
        getElementDisposables(element).add(() => {
            const hooks = scopeCache.stateHookMap.get(path);
            // "Set" may not exist if element is already aborted
            hooks?.delete(hook);
            // check if hooks is empty (then delete from map)
            if (hooks?.size === 0) {
                scopeCache.stateHookMap.delete(path);
                // console.debug(`no hooks registered for path "${path}"`);
            }
        });
    };
    const notifyStateChange = (scopeCache, path) => {
        // console.debug("notify state change to", path);
        const next = getObjectValue(scopeCache.stateValueMap, path);
        const hooks = scopeCache.stateHookMap.get(path);
        // check if hooks is empty (then delete from map)
        if (hooks?.size === 0) {
            scopeCache.stateHookMap.delete(path);
            // console.debug(`no hooks registered for path "${path}"`);
        }
        else {
            hooks?.forEach((hook) => hook(next));
        }
        // notify nested dependencies
        scopeCache.stateDependencyMap.get(path)?.forEach((dependency) => notifyStateChange(scopeCache, dependency));
    };
    const deepRemove = (element) => {
        const children = Array.from(element.children);
        for (const child of children) {
            deepRemove(child);
        }
        element.remove();
    };
    const onBeforeUnload = () => {
        window.removeEventListener("beforeunload", onBeforeUnload);
        scopeComponentLoaders.clear();
        orbit?.stop();
        orbit = undefined;
    };
    const initDirectives = (element, scopeCache) => {
        dbg?.(`init directives`, element);
        for (const attribute of element.attributes) {
            if (attribute.name === "o-ref") {
                const refName = attribute.value;
                const refDisposables = getElementDisposables(element);
                scopeCache.refElementMap.set(refName, element);
                refDisposables.add(() => {
                    scopeCache.refElementMap.delete(refName);
                });
                const unmount = scopeCache.refHookMap.get(refName)?.(element);
                if (typeof unmount === "function") {
                    refDisposables.add(unmount);
                }
            }
            else if (attribute.name === "o-class") {
                registerStateChange(scopeCache, element, attribute.value, (next) => {
                    element.className = stringifyValue(next);
                });
            }
            else if (attribute.name === "o-text") {
                registerStateChange(scopeCache, element, attribute.value, (next) => {
                    element.textContent = stringifyValue(next);
                });
            }
            else if (attribute.name === "o-html") {
                registerStateChange(scopeCache, element, attribute.value, (next) => {
                    element.innerHTML = stringifyValue(next);
                });
            }
            else if (attribute.name === "o-model") {
                if (element instanceof HTMLInputElement) {
                    const path = attribute.value;
                    const registerEvent = (type, name) => {
                        const callback = () => {
                            setObjectValue(scopeCache.stateValueMap, path, element[name]);
                        };
                        element.addEventListener(type, callback);
                        getElementDisposables(element).add(() => {
                            element.removeEventListener(type, callback);
                        });
                    };
                    if (element.type === "checkbox") {
                        registerEvent("change", "checked");
                        registerStateChange(scopeCache, element, path, (next) => {
                            element.checked = next;
                        });
                    }
                    else {
                        registerEvent("input", "value");
                        registerStateChange(scopeCache, element, path, (next) => {
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
                    const templateParent = element.parentElement ?? scopeCache.instance.root;
                    const templateElements = new Set();
                    registerStateChange(scopeCache, element, path, (next) => {
                        if (next) {
                            if (!templateElements.size) {
                                const cloned = element.content.cloneNode(true);
                                for (const child of cloned.children) {
                                    templateElements.add(child);
                                }
                                nextTick(() => {
                                    templateParent.appendChild(cloned);
                                });
                            }
                        }
                        else if (templateElements.size) {
                            templateElements.forEach((el) => deepRemove(el));
                            templateElements.clear();
                        }
                    });
                    getElementDisposables(element).add(() => {
                        templateElements.forEach((el) => deepRemove(el));
                        templateElements.clear();
                    });
                }
                else {
                    console.error("o-if can only be used on template element");
                }
            }
            else if (attribute.name === "o-for") {
                // for small array only !!! (because every cloned element will have owned abort event listener and may have own tree observer)
                if (element instanceof HTMLTemplateElement) {
                    const path = attribute.value;
                    const as = element.getAttribute("o-as") ?? "$";
                    const templateParent = element.parentElement ?? scopeCache.instance.root;
                    const templateElements = new Set();
                    const mapPath = (itemElement, each, as, index) => {
                        for (const attribute of itemElement.attributes) {
                            if (!attribute.name.startsWith("o-") || attribute.name.startsWith("o-scope") || attribute.name.startsWith("o-for")) {
                                continue;
                            }
                            if (attribute.value.startsWith(`${as}.`)) {
                                attribute.value = attribute.value.replace(`${as}.`, `${each}[${index}].`);
                            }
                            else if (attribute.value === as) {
                                attribute.value = `${each}[${index}]`;
                            }
                        }
                        if (itemElement instanceof HTMLTemplateElement) {
                            for (const child of itemElement.content.children) {
                                mapPath(child, each, as, index);
                            }
                        }
                        else if (itemElement.children.length) {
                            for (const child of itemElement.children) {
                                mapPath(child, each, as, index);
                            }
                        }
                    };
                    registerStateChange(scopeCache, element, path, (next) => {
                        if (templateElements.size) {
                            templateElements.forEach((el) => deepRemove(el));
                            templateElements.clear();
                        }
                        if (Array.isArray(next)) {
                            const fragment = document.createDocumentFragment();
                            for (let i = 0; i < next.length; i++) {
                                const cloned = element.content.cloneNode(true);
                                for (const child of cloned.children) {
                                    mapPath(child, path, as, i);
                                    templateElements.add(child);
                                }
                                fragment.appendChild(cloned);
                            }
                            nextTick(() => {
                                templateParent.appendChild(fragment);
                            });
                        }
                    });
                    getElementDisposables(element).add(() => {
                        templateElements.forEach((el) => deepRemove(el));
                        templateElements.clear();
                    });
                }
                else {
                    console.error("o-for can only be used on template element");
                }
            }
            else if (attribute.name === "o-teleport") {
                // for simple elements only (because every cloned element will have owned abort event listener and also have own tree observer)
                const selector = attribute.value;
                const target = document.querySelector(selector);
                if (!target) {
                    console.error(`target element not found for o-teleport: ${selector}`);
                    continue;
                }
                if (element instanceof HTMLTemplateElement) {
                    const templateParent = target;
                    const templateElements = new Set();
                    const isSameTree = scopeCache.instance.root === target || scopeCache.instance.root.contains(target);
                    const cloned = element.content.cloneNode(true);
                    for (const child of cloned.children) {
                        templateElements.add(child);
                        if (!isSameTree) {
                            elementScopeIdMap.set(child, scopeCache.id);
                        }
                    }
                    getElementDisposables(element).add(() => {
                        templateElements.forEach((el) => deepRemove(el));
                        templateElements.clear();
                    });
                    nextTick(() => {
                        templateParent.appendChild(cloned);
                    });
                }
                else {
                    console.error("o-teleport can only be used on template element");
                }
            }
            else if (attribute.name.startsWith("o-scope") || attribute.name === "o-as") {
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
                const capture = modifiers.includes("capture");
                const callback = (event) => {
                    if (prevent) {
                        event.preventDefault();
                    }
                    if (stop) {
                        event.stopPropagation();
                    }
                    const fn = getObjectValue(scopeCache.stateValueMap, path);
                    if (typeof fn === "function") {
                        fn.bind(scopeCache.stateValueMap)(event);
                    }
                };
                element.addEventListener(type, callback, {
                    capture,
                    once: modifiers.includes("once"),
                    passive: modifiers.includes("passive"),
                });
                getElementDisposables(element).add(() => {
                    element.removeEventListener(type, callback, { capture });
                });
                // console.error(`not implemented ${attribute.name} for`, element);
            }
            else if (attribute.name.startsWith("o-")) {
                const name = attribute.name.slice(2);
                const path = attribute.value;
                registerStateChange(scopeCache, element, path, (next) => {
                    try {
                        element[name] = next;
                    }
                    catch (error) {
                        console.error(`error setting property ${name} on element`, element, error);
                    }
                });
            }
        }
    };
    const initScopeComponent = (element, scopeCache) => {
        if (element.hasAttribute("o-scope") && elementScopeIdMap.get(element) !== scopeCache.id) {
            // out of scope
            return;
        }
        initDirectives(element, scopeCache);
        for (const child of element.children) {
            initScopeComponent(child, scopeCache);
        }
    };
    const initScope = (element) => {
        dbg?.(`init scope`, element);
        const scopeName = element.getAttribute("o-scope");
        const scopeComponentLoader = scopeComponentLoaders.get(scopeName);
        if (!scopeComponentLoader) {
            return;
        }
        const scopeId = crypto.randomUUID();
        // register primary root of scope
        elementScopeIdMap.set(element, scopeId);
        dbg?.(`begin loading component`, scopeName);
        getComponent(scopeComponentLoader).then((component) => {
            if (!elementScopeIdMap.has(element)) {
                dbg?.(`scope has been unmounted before component was loaded`, scopeName);
                return;
            }
            dbg?.(`end loading component`, scopeName);
            let isCalledRef = false;
            let isCalledState = false;
            const scopeCache = {
                id: scopeId,
                instance: {
                    root: element,
                    ref: (hooks) => {
                        if (isCalledRef) {
                            throw new Error("ref() can only be called once");
                        }
                        isCalledRef = true;
                        if (hooks) {
                            for (const name in hooks) {
                                const refHook = hooks[name];
                                const refElement = scopeCache.refElementMap.get(name);
                                scopeCache.refHookMap.set(name, refHook);
                                // element already exists
                                if (refElement) {
                                    const unmount = refHook(refElement);
                                    if (typeof unmount === "function") {
                                        getElementDisposables(refElement).add(unmount);
                                    }
                                }
                            }
                        }
                        return new Proxy({}, {
                            get(_, prop) {
                                return scopeCache.refElementMap.get(prop);
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
                                            let stateDependencies = scopeCache.stateDependencyMap.get(path);
                                            if (!stateDependencies) {
                                                stateDependencies = new Set();
                                                scopeCache.stateDependencyMap.set(path, stateDependencies);
                                            }
                                            stateDependencies.add(state.caller);
                                            // console.debug("add trigger to notify", state.caller, "when", path, "changed");
                                        }
                                        if (Array.isArray(target) && MUTABLE_ARRAY_METHODS.has(prop)) {
                                            return (...args) => {
                                                const result = target[prop](...args);
                                                notifyStateChange(scopeCache, state.path);
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
                                        notifyStateChange(scopeCache, concatPath(state.path, prop));
                                    }
                                    return true;
                                },
                            });
                        };
                        const proxied = proxify(initialState, {
                            path: "",
                        });
                        scopeCache.stateValueMap = proxied;
                        // register state hooks
                        if (hooks) {
                            for (const path in hooks) {
                                const hook = hooks[path];
                                if (typeof hook === "function") {
                                    getStateHooks(scopeCache, path).add(hook.bind(proxied));
                                }
                                else {
                                    console.error(`invalid hook for path ${path}`, hook);
                                }
                            }
                        }
                        return scopeCache.stateValueMap;
                    },
                    compute: (expression) => {
                        let fn = scopeCache.computedMap.get(expression);
                        if (!fn) {
                            // expression must be a valid JavaScript expression from trusted sources
                            fn = new Function(`return \`${expression}\`;`);
                            fn = fn.bind(scopeCache.stateValueMap);
                            scopeCache.computedMap.set(expression, fn);
                        }
                        return fn();
                    },
                },
                computedMap: new Map(),
                refElementMap: new Map(),
                refHookMap: new Map(),
                stateHookMap: new Map(),
                stateDependencyMap: new Map(),
                stateValueMap: undefined,
            };
            scopeCacheMap.set(scopeId, scopeCache);
            // init directives and crawl into children
            initScopeComponent(element, scopeCache);
            // render/hydration
            component.mount(scopeCache.instance, consumeScopeProps(element));
            // notify first time
            scopeCache.stateHookMap.forEach((hooks, prop) => {
                const value = getObjectValue(scopeCache.stateValueMap, prop);
                hooks.forEach((hook) => hook(value));
            });
        });
    };
    const initAdditionalScope = (element) => {
        dbg?.(`init additional scope`, element);
        const scopeId = elementScopeIdMap.get(element);
        const scopeCache = scopeId ? scopeCacheMap.get(scopeId) : undefined;
        if (scopeCache) {
            initDirectives(element, scopeCache);
        }
    };
    const initElement = (element) => {
        // normal scope element
        if (element.hasAttribute("o-scope")) {
            initScope(element);
        }
        // additonal scope element
        else if (elementScopeIdMap.has(element)) {
            initAdditionalScope(element);
        }
        // normal element
        else {
            for (const [scopeRoot, scopeId] of elementScopeIdMap) {
                if (scopeRoot.contains(element)) {
                    const scopeCache = scopeCacheMap.get(scopeId);
                    if (scopeCache) {
                        initDirectives(element, scopeCache);
                    }
                    break;
                }
            }
        }
    };
    const destroyElement = (element) => {
        dbg?.(`destroy`, element);
        intersectionObserver?.unobserve(element);
        elementWalkedMap.delete(element);
        // cleanup directives
        elementDisposablesMap.get(element)?.forEach((dispose) => dispose());
        elementDisposablesMap.delete(element);
        // cleanup scope
        const scopeId = elementScopeIdMap.get(element);
        const scopeCache = scopeId ? scopeCacheMap.get(scopeId) : undefined;
        elementScopeIdMap.delete(element);
        if (scopeCache?.instance.root === element) {
            scopeCacheMap.delete(scopeCache.id);
        }
    };
    // for MutationObserver
    const onAdd = (element) => {
        if (elementWalkedMap.has(element)) {
            return;
        }
        elementWalkedMap.add(element);
        const observableElement = element.closest("[o-load=visible]");
        if (observableElement) {
            intersectionObserver?.observe(observableElement);
            return;
        }
        initElement(element);
        for (const child of element.children) {
            onAdd(child);
        }
    };
    const onRemove = (element) => {
        for (const child of element.children) {
            onRemove(child);
        }
        destroyElement(element);
    };
    // for IntersectionObserver
    const onVisible = (element) => {
        initElement(element);
        for (const child of element.children) {
            onVisible(child);
        }
    };
    // for start
    const initTree = (element) => {
        if (element.getAttribute("o-load") === "visible") {
            intersectionObserver?.observe(element);
            return;
        }
        initElement(element);
        for (const child of element.children) {
            initTree(child);
        }
    };
    orbit = {
        register(name, loader) {
            scopeComponentLoaders.set(name, loader);
        },
        start() {
            mutationObserver = new MutationObserver((mutations) => {
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
            intersectionObserver = new IntersectionObserver((entries) => {
                for (const entry of entries) {
                    if (entry.isIntersecting) {
                        intersectionObserver?.unobserve(entry.target);
                        entry.target.removeAttribute("o-load");
                        onVisible(entry.target);
                    }
                }
            });
            const root = document.body;
            initTree(root);
            mutationObserver.observe(root, {
                childList: true,
                subtree: true,
            });
            window.addEventListener("beforeunload", onBeforeUnload);
        },
        stop() {
            mutationObserver?.disconnect();
            mutationObserver = undefined;
            intersectionObserver?.disconnect();
            intersectionObserver = undefined;
            elementDisposablesMap.forEach((disposables) => disposables.forEach((dispose) => dispose()));
            elementDisposablesMap.clear();
            elementScopeIdMap.clear();
            scopeCacheMap.clear();
        },
    };
    return orbit;
}
export function defineComponent(mount) {
    return {
        [ORBIT_COMPONENT_SYMBOL]: true,
        mount,
    };
}
// private functions
async function getComponent(loader) {
    // if (DEBUG_MODE) {
    //   await new Promise((resolve) => setTimeout(resolve, 2000));
    // }
    if (isStaticComponentLoader(loader)) {
        return loader;
    }
    return await loader();
}
function isStaticComponentLoader(loader) {
    return (loader && typeof loader === "object" && loader[ORBIT_COMPONENT_SYMBOL]);
}
function consumeScopeProps(root) {
    if (root.hasAttribute("o-scope-props")) {
        const props = parseServerSideProps(root.getAttribute("o-scope-props"));
        // root.removeAttribute("o-scope-props");
        return props;
    }
    const propsId = root.getAttribute("o-scope-props-id");
    const propsElement = propsId ? document.getElementById(propsId) : undefined;
    const props = parseServerSideProps(propsElement?.textContent);
    // root.removeAttribute("o-scope-props-id");
    // if (propsElement) {
    //   nextIdle(() => propsElement.remove());
    // }
    return props;
}
function nextTick(callback) {
    if ("requestAnimationFrame" in window) {
        requestAnimationFrame(callback);
    }
    else {
        setTimeout(callback, 1);
    }
}
// function nextIdle(callback: () => void) {
//   if ("requestIdleCallback" in window) {
//     requestIdleCallback(callback);
//   } else {
//     setTimeout(callback, 1);
//   }
// }
