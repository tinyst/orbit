import { ORBIT_COMPONENT_SYMBOL } from "./constants.js";
import { createScope } from "./scope.js";
let orbit;
// public functions
export function getOrbit() {
    if (orbit) {
        return orbit;
    }
    const loaders = new Map();
    const disposes = new Map();
    const disposables = [];
    const onBeforeUnload = () => {
        window.removeEventListener("beforeunload", onBeforeUnload);
        // clear local variables
        loaders.clear();
        // clear global variables
        orbit?.stop();
        orbit = undefined;
    };
    orbit = {
        register(name, loader) {
            loaders.set(name, loader);
        },
        start() {
            disposables.push(observeTree(document.body, {
                onMount: (element) => {
                    const name = element.getAttribute("o-scope");
                    const loader = loaders.get(name);
                    if (loader) {
                        disposes.set(element, createScope(loader, element));
                    }
                },
                onUnmount: (element) => {
                    disposes.get(element)?.();
                    disposes.delete(element);
                },
            }));
            window.addEventListener("beforeunload", onBeforeUnload);
        },
        stop() {
            disposables.forEach((dispose) => dispose());
            disposes.forEach((dispose) => dispose());
            disposes.clear();
        },
    };
    return orbit;
}
export function defineComponent(behavior) {
    return {
        [ORBIT_COMPONENT_SYMBOL]: true,
        mount: behavior,
    };
}
// private functions
function observeTree(root, hooks) {
    // for start
    const onInit = (element) => {
        const strategy = element.getAttribute("o-load");
        if (strategy === "visible") {
            intersectionObserver?.observe(element);
            return;
        }
        if (element.hasAttribute("o-scope")) {
            hooks.onMount(element);
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
            hooks.onMount(element);
        }
        for (const child of element.children) {
            onAdd(child);
        }
    };
    const onRemove = (element) => {
        for (const child of element.children) {
            onRemove(child);
        }
        hooks.onUnmount(element);
    };
    // for IntersectionObserver
    const onVisible = (element) => {
        if (element.hasAttribute("o-scope")) {
            hooks.onMount(element);
        }
        for (const child of element.children) {
            onVisible(child);
        }
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
    const intersectionObserver = new IntersectionObserver((entries) => {
        for (const entry of entries) {
            if (entry.isIntersecting) {
                entry.target.removeAttribute("o-load");
                intersectionObserver?.unobserve(entry.target);
                onVisible(entry.target);
            }
        }
    });
    onInit(root);
    mutationObserver.observe(root, {
        childList: true,
        subtree: true,
    });
    return () => {
        mutationObserver.disconnect();
        intersectionObserver.disconnect();
    };
}
