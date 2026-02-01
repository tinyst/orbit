import { locate } from "./helper.js";
import { logd } from "./logger.js";
import { createScope } from "./scope.js";
export { defineScope } from "./scope.js";
let orbit;
export function getOrbit() {
    if (orbit) {
        return orbit;
    }
    const scopeLoaders = new Map();
    const scopes = new WeakMap();
    let mutationObserver;
    let intersectionObserver;
    // for first time
    const onInit = (element, scope) => {
        if (element.getAttribute("o-load") === "visible") {
            logd?.(locate(element), `observing element`);
            intersectionObserver?.observe(element);
            return;
        }
        const scopeName = element.getAttribute("o-scope");
        if (scopeName) {
            const scopeLoader = scopeLoaders.get(scopeName);
            if (!scopeLoader) {
                return console.error(`no loader found for scope "${scopeName}"`);
            }
            scope = createScope(scopeName, element, scopeLoader);
            scope.create();
            scopes.set(element, scope);
        }
        else if (scope) {
            scope.attach(element);
            scopes.set(element, scope);
        }
        for (const child of element.children) {
            onInit(child, scope);
        }
    };
    // for MutationObserver and IntersectionObserver
    const onMount = (element) => {
        const scopeName = element.getAttribute("o-scope");
        if (scopeName) {
            let scope = scopes.get(element);
            if (scope?.name && scopeName !== scope.name) {
                scope.destroy();
                scope = undefined;
            }
            if (!scope) {
                const scopeLoader = scopeLoaders.get(scopeName);
                if (!scopeLoader) {
                    return console.error(`no loader found for scope "${scopeName}"`);
                }
                scope = createScope(scopeName, element, scopeLoader);
                scope.create();
                scopes.set(element, scope);
            }
            else {
                logd?.(locate(element), `scope already exists`);
            }
            return;
        }
        if (element.hasAttribute("o-load")) {
            // o-load can be used on non-directives except for o-scope
            return;
        }
        // other directives...
        const scopeElement = element.closest("[o-scope]");
        if (!scopeElement) {
            logd?.(locate(element), `element is not inside a scope`);
            const scope = scopes.get(element);
            if (scope) {
                scope.detach(element);
                scopes.delete(element);
            }
            return;
        }
        let scope = scopes.get(element);
        if (scope && scope.root !== scopeElement) {
            scope.detach(element);
            scope = undefined;
            scopes.delete(element);
        }
        if (!scope) {
            scope = scopes.get(scopeElement);
            if (!scope) {
                console.error(`scope not found`, scopeElement);
                return;
            }
            scopes.set(element, scope);
        }
        scope.attach(element);
    };
    // for MutationObserver
    const onAdded = (element) => {
        const load = element.closest("[o-load=visible]");
        if (load && !load.hasAttribute("o-visible")) {
            logd?.(locate(element), `observing element`);
            intersectionObserver?.observe(element);
            return;
        }
        onMount(element);
        for (const child of element.children) {
            onAdded(child);
        }
    };
    const onAttributeChange = (element, attributeName) => {
        if (attributeName === "o-load") {
            return console.error(`attribute 'o-load' is not allowed to be changed`);
        }
        if (attributeName === "o-scope") {
            const load = element.closest("[o-load=visible]");
            if (load && !load.hasAttribute("o-visible")) {
                logd?.(locate(element), `observing element`);
                intersectionObserver?.observe(element);
                return;
            }
            onMount(element);
            return;
        }
    };
    const onRemoved = (element) => {
        // cleanup children first
        for (const child of element.children) {
            onRemoved(child);
        }
        // cleanup self last
        const scope = scopes.get(element);
        if (scope) {
            if (element === scope.root) {
                // destroy scope immediately
                scope.destroy();
                scopes.delete(element);
            }
            else {
                // detach element from scope to make sure scope always has a valid element
                scope.detach(element);
                scopes.delete(element);
            }
        }
    };
    // for IntersectionObserver
    const onVisible = (element) => {
        onMount(element);
        for (const child of element.children) {
            onVisible(child);
        }
    };
    orbit = {
        register(name, loader) {
            scopeLoaders.set(name, loader);
        },
        start() {
            mutationObserver = new MutationObserver((mutations) => {
                for (const mutation of mutations) {
                    if (mutation.type === "childList") {
                        for (const node of mutation.removedNodes) {
                            if (node instanceof Element) {
                                onRemoved(node);
                            }
                        }
                        for (const node of mutation.addedNodes) {
                            if (node instanceof Element) {
                                onAdded(node);
                            }
                        }
                    }
                    else if (mutation.type === "attributes") {
                        if (mutation.target instanceof Element && mutation.attributeName?.startsWith("o-")) {
                            logd?.(locate(mutation.target), `attribute changed`, mutation.attributeName);
                            onAttributeChange(mutation.target, mutation.attributeName);
                        }
                    }
                }
            });
            mutationObserver.observe(document.body, {
                childList: true,
                subtree: true,
                attributes: true,
                attributeFilter: [
                    "o-scope",
                    "o-load",
                ],
            });
            intersectionObserver = new IntersectionObserver((entries) => {
                for (const entry of entries) {
                    if (entry.isIntersecting) {
                        logd?.(locate(entry.target), `visible`);
                        intersectionObserver?.unobserve(entry.target);
                        entry.target.setAttribute("o-visible", "");
                        onVisible(entry.target);
                    }
                }
            });
            for (const child of document.body.children) {
                onInit(child);
            }
        },
        stop() {
            mutationObserver?.disconnect();
            mutationObserver = undefined;
            intersectionObserver?.disconnect();
            intersectionObserver = undefined;
        },
    };
    return orbit;
}
