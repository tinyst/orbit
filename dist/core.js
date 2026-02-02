import { ORBIT_MODULE_SYMBOL } from "./constants.js";
let orbit;
// public functions
export function getOrbit() {
    if (orbit) {
        return orbit;
    }
    const destroys = new Map();
    const loaders = new Map();
    let mutationObserver;
    let intersectionObserver;
    const onMount = (element) => {
        const name = element.getAttribute("o-scope");
        const loader = loaders.get(name);
        if (loader) {
            destroys.set(element, createScope(loader, element));
        }
    };
    const onUnmount = (element) => {
        destroys.get(element)?.();
        destroys.delete(element);
    };
    // for start
    const onInit = (element) => {
        const strategy = element.getAttribute("o-load");
        if (strategy === "visible") {
            intersectionObserver?.observe(element);
            return;
        }
        if (element.hasAttribute("o-scope")) {
            onMount(element);
        }
        for (const child of element.children) {
            onInit(child);
        }
    };
    // for MutationObserver
    const onAdd = (element) => {
        if (element.hasAttribute("o-scope")) {
            if (element.closest("[o-load=visible]")) {
                intersectionObserver?.observe(element);
                return;
            }
            onMount(element);
        }
        for (const child of element.children) {
            onAdd(child);
        }
    };
    const onRemove = (element) => {
        for (const child of element.children) {
            onRemove(child);
        }
        onUnmount(element);
    };
    // for IntersectionObserver
    const onVisible = (element) => {
        if (element.hasAttribute("o-scope")) {
            onMount(element);
        }
        for (const child of element.children) {
            onVisible(child);
        }
    };
    orbit = {
        register(name, loader) {
            loaders.set(name, loader);
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
            mutationObserver.observe(document.body, {
                childList: true,
                subtree: true,
            });
            intersectionObserver = new IntersectionObserver((entries) => {
                for (const entry of entries) {
                    if (entry.isIntersecting) {
                        entry.target.removeAttribute("o-load");
                        intersectionObserver?.unobserve(entry.target);
                        onVisible(entry.target);
                    }
                }
            });
            onInit(document.body);
        },
        stop() {
            mutationObserver?.disconnect();
            mutationObserver = undefined;
            intersectionObserver?.disconnect();
            intersectionObserver = undefined;
            destroys.forEach((fn) => fn());
            destroys.clear();
        },
    };
    return orbit;
}
export function defineScope(instantiate) {
    return {
        [ORBIT_MODULE_SYMBOL]: true,
        instantiate,
    };
}
// private functions
function createScope(loader, element) {
    const controller = new AbortController();
    const signal = controller.signal;
    resolveModuleLoader(loader).then(({ instantiate }) => {
        if (signal.aborted) {
            return;
        }
        const instance = instantiate(element);
        const unmount = instance.mount?.();
        if (typeof unmount === "function") {
            signal.addEventListener("abort", () => {
                unmount();
            });
        }
    });
    return () => {
        controller.abort();
    };
}
async function resolveModuleLoader(loader) {
    if (isStaticModuleLoader(loader)) {
        return loader;
    }
    return await loader();
}
function isStaticModuleLoader(loader) {
    return (loader && typeof loader === "object" && loader[ORBIT_MODULE_SYMBOL]);
}
