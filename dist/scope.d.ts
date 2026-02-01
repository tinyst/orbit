import type { OrbitScope, OrbitScopeBehavior, OrbitScopeBehaviorLoader, OrbitScopeBeheviorSetup } from "./types.js";
export declare function createScope(name: string, root: Element, loader: OrbitScopeBehaviorLoader): OrbitScope;
export declare function defineScope<T extends {
    mount?(this: OrbitScopeBehavior<T>): (() => void) | void;
    [key: string]: any;
}>(setup: (root: Element) => OrbitScopeBehavior<T>): OrbitScopeBeheviorSetup<T>;
