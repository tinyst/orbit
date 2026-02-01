import type { ORBIT_SCOPE_BEHAVIOR_SYMBOL } from "./constants.js";

declare global {
  const __ORBIT_LOG_WARN__: boolean | undefined;
  const __ORBIT_LOG_INFO__: boolean | undefined;
  const __ORBIT_LOG_DEBUG__: boolean | undefined;
}

export type MaybePromise<T> = T | Promise<T>;

export type Orbit = {
  register(name: string, loader: OrbitScopeBehaviorLoader): void;
  start(): void;
  stop(): void;
};

export type OrbitScope = {
  name: string;
  root: Element,

  create(): void;
  destroy(): void;

  attach(element: Element): void;
  detach(element: Element): void;
};

export type OrbitScopeBehaviorLoader = (() => Promise<OrbitScopeBeheviorSetup<any>>) | (OrbitScopeBeheviorSetup<any>);

export type OrbitScopeBeheviorSetup<T extends object> = {
  readonly [ORBIT_SCOPE_BEHAVIOR_SYMBOL]: true;
  setup: (root: Element) => OrbitScopeBehavior<T>;
};

export type OrbitScopeBehavior<T extends {
  mount?(this: OrbitScopeBehavior<T>): (() => void) | void;
  [key: string]: any;
}> = T;
