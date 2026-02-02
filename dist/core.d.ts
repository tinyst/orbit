import type { Orbit, OrbitModule, OrbitScopeInstantiateFunction } from "./types.js";
export declare function getOrbit(): Orbit;
export declare function defineScope<T extends object>(instantiate: OrbitScopeInstantiateFunction<T>): OrbitModule<T>;
