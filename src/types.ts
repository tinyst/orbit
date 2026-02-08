import type { ORBIT_COMPONENT_SYMBOL, ORBIT_ID_SYMBOL } from "./constants.js";

export type Orbit = {
  register(name: string, loader: OrbitComponentLoader): void;
  start(): void;
  stop(): void;
};

export type OrbitDispose = () => void;

export type OrbitScopeController = {
  dispose: OrbitDispose;
};

// scope
export type OrbitScopeId = string & {
  readonly [ORBIT_ID_SYMBOL]: true;
};

export type OrbitScopeCacheKey = string | number | symbol;
export type OrbitScopeCache = {
  readonly id: OrbitScopeId;
  readonly instance: OrbitScope;

  readonly computedMap: Map<string, () => string>;

  readonly refElementMap: Map<OrbitScopeCacheKey, Element>;
  readonly refHookMap: Map<OrbitScopeCacheKey, OrbitRefHook<Element>>;

  readonly stateHookMap: Map<OrbitScopeCacheKey, Set<OrbitStateHook>>;
  readonly stateDependencyMap: Map<OrbitScopeCacheKey, Set<string>>;

  stateValueMap: Record<OrbitScopeCacheKey, any> | undefined;
};

export type OrbitScope = {
  readonly root: Element;

  ref<T extends OrbitRefMap>(hooks?: Partial<OrbitRefHooks<T>>): Partial<T>;
  state<T extends object>(initialState: T, hooks?: Partial<OrbitStateHookMap<T>>): T;
  compute(expression: string): string;
};

// scope -> ref
export type OrbitRefMap = {
  [key: string]: Element;
};

export type OrbitRefHooks<T extends OrbitRefMap> = {
  [key in keyof T]: OrbitRefHook<T[key]>;
};

export type OrbitRefHook<E extends Element> = (element: E) => void | (() => void);

// scope -> state
export type OrbitStateHook<T = any> = (value: T) => void;
export type OrbitStateHookMap<T extends object> = {
  [key in keyof T]: (this: T, ...args: Parameters<OrbitStateHook<T[key]>>) => void;
};

// scope -> component
export type OrbitComponentLoader = OrbitComponent<any> | (() => Promise<OrbitComponent<any>>);
export type OrbitComponent<T extends OrbitComponentProps<any> = undefined> = {
  readonly [ORBIT_COMPONENT_SYMBOL]: true;
  readonly mount: OrbitComponentFn<T>;
};

export type OrbitComponentProps<T> = T extends object ? T : undefined;
export type OrbitComponentFn<T extends OrbitComponentProps<any> = undefined> = (scope: OrbitScope, props: OrbitComponentProps<T>) => void;
