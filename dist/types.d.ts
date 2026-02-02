import type { ORBIT_MODULE_SYMBOL } from "./constants.js";
export type Orbit = {
    register(name: string, loader: OrbitModuleLoader): void;
    start(): void;
    stop(): void;
};
export type OrbitModuleLoader = OrbitModule<any> | (() => Promise<OrbitModule<any>>);
export type OrbitModule<T extends OrbitScope<any>> = {
    readonly [ORBIT_MODULE_SYMBOL]: true;
    instantiate: OrbitScopeInstantiateFunction<T>;
};
export type OrbitScopeInstantiateFunction<T extends OrbitScope<T>> = (root: Element) => T;
export type OrbitScope<T extends object> = {
    mount?(this: OrbitScope<T>): (() => void) | void;
};
