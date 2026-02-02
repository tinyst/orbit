/** @file this part still experimental !!! */
import type { OrbitScopeInstantiateFunction } from "./types.js";
export declare function defineComponent<T extends object>(instantiate: OrbitScopeInstantiateFunction<T>): import("./types.js").OrbitModule<T>;
