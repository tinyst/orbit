import type { Orbit, OrbitComponent, OrbitComponentFn, OrbitComponentProps } from "./types.js";
export declare function getOrbit(): Orbit;
export declare function defineComponent<T extends OrbitComponentProps<any> = undefined>(mount: OrbitComponentFn<T>): OrbitComponent<T>;
