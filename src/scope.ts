import { ORBIT_SCOPE_BEHAVIOR_SYMBOL } from "./constants.js";
import { locate } from "./helper.js";
import { logd } from "./logger.js";
import type { OrbitScope, OrbitScopeBehavior, OrbitScopeBehaviorLoader, OrbitScopeBeheviorSetup } from "./types.js";

const MUTABLE_ARRAY_METHODS = new Set<string>([
  "pop",
  "push",
  "reverse",
  "shift",
  "sort",
  "splice",
  "unshift",
]);

export function createScope(name: string, root: Element, loader: OrbitScopeBehaviorLoader): OrbitScope {
  const scopeController = new AbortController();

  let scopeState: "initializing" | "initialized" | undefined;
  let scopeBehavior: OrbitScopeBehavior<any> | undefined;

  // not have dependency tracking but it's fine. (we can re-design it later)
  const changeSubscriptions = new Set<Function>();
  const changeSubscribe = (signal: AbortSignal, callback: Function) => {
    changeSubscriptions.add(callback);
    signal.addEventListener("abort", () => changeSubscriptions.delete(callback));
  };

  const attachingElements = new Set<Element>();
  const attachedElementControllers = new Map<Element, AbortController>();
  const attachedController = (element: Element) => {
    let controller = attachedElementControllers.get(element);

    if (!controller) {
      controller = new AbortController();
      attachedElementControllers.set(element, controller);
    }

    return controller;
  };

  const attachElement = (element: Element) => {
    logd?.(locate(element), `processing...`);

    for (const attribute of element.attributes) {
      if (attribute.name.startsWith("o-on")) {
        const [name, ...options] = attribute.name.slice(2).split("-");

        const event = name?.slice(2);
        const option = options[0];

        if (event) {
          let handler: Function = scopeBehavior?.[attribute.value];

          if (typeof handler === "function") {
            handler = handler.bind(scopeBehavior);

            const controller = attachedController(element);
            const signal = controller.signal;

            element.addEventListener(event, (e) => {
              if (signal.aborted) {
                return;
              }

              handler(e);
            }, {
              capture: option === "capture",
              passive: option === "passive",
              signal,
            });
          }
        }
      }

      else if (attribute.name === "o-model") {
        const controller = attachedController(element);
        const signal = controller.signal;
        const prop = attribute.value;

        const update = (value: any) => {
          if (element instanceof HTMLInputElement) {
            if (element.type === "checkbox") {
              if (value !== element.checked) {
                element.checked = value;
              }
            }

            else if (element.type === "radio") {
              const checked = (value === element.value);

              if (checked !== element.checked) {
                element.checked = checked;
              }
            }

            // other types
            else {
              if (typeof value === "undefined" || value === null) {
                if (element.value) {
                  element.value = "";
                }
              }

              else if (typeof value === "string") {
                if (value !== element.value) {
                  element.value = value;
                }
              }

              else if (typeof value === "number" || typeof value === "boolean") {
                const next = String(value);

                if (next !== element.value) {
                  element.value = next;
                }
              }
            }
          }
        };

        update(getScopeValue(scopeBehavior, prop));

        changeSubscribe(signal, () => {
          update(getScopeValue(scopeBehavior, prop));
        });

        // event listener
        if (element instanceof HTMLInputElement) {
          if (element.type === "checkbox") {
            element.addEventListener("change", () => {
              if (signal.aborted) {
                return;
              }

              if (scopeBehavior) {
                scopeBehavior[prop] = element.checked;
              }
            }, {
              signal,
            });
          }

          else if (element.type === "radio") {
            // TO BE VERIFY
            element.addEventListener("change", () => {
              if (signal.aborted) {
                return;
              }

              if (scopeBehavior) {
                scopeBehavior[prop] = element.value;
              }
            }, {
              signal,
            });
          }

          // other types
          else {
            element.addEventListener("input", () => {
              if (signal.aborted) {
                return;
              }

              if (scopeBehavior) {
                scopeBehavior[prop] = element.value;
              }
            }, {
              signal,
            });
          }
        }

        else {
          // TBD
          throw new Error(`unsupported element type: ${element.tagName}`);
        }
      }

      else if (attribute.name === "o-text") {
        const controller = attachedController(element);
        const prop = attribute.value;

        element.textContent = stringifyValue(getScopeValue(scopeBehavior, prop));

        changeSubscribe(controller.signal, () => {
          const next = stringifyValue(getScopeValue(scopeBehavior, prop));

          if (next !== element.textContent) {
            element.textContent = next;
          }
        });
      }

      else if (attribute.name === "o-html") {
        const controller = attachedController(element);
        const prop = attribute.value;

        element.innerHTML = stringifyValue(getScopeValue(scopeBehavior, prop));

        changeSubscribe(controller.signal, () => {
          const next = stringifyValue(getScopeValue(scopeBehavior, prop));

          if (next !== element.innerHTML) {
            element.innerHTML = next;
          }
        });
      }

      else if (attribute.name === "o-show") {
        const controller = attachedController(element);
        const prop = attribute.value;

        const update = (value: boolean) => {
          if (value) {
            if (element.hasAttribute("hidden")) {
              element.removeAttribute("hidden");
            }
          }

          else if (!element.hasAttribute("hidden")) {
            element.setAttribute("hidden", "");
          }
        };

        update(!!getScopeValue(scopeBehavior, prop));

        changeSubscribe(controller.signal, () => {
          update(!!getScopeValue(scopeBehavior, prop));
        });
      }

      else if (attribute.name === "o-if") {
        if (!(element instanceof HTMLTemplateElement)) {
          return console.error("o-if can only be used on template element");
        }

        const controller = attachedController(element);
        const prop = attribute.value;

        const template = element as HTMLTemplateElement;
        const templateParent = element.parentElement ?? root;
        const templateElements = new Set<Element>();

        const update = (value: boolean) => {
          if (value) {
            if (!templateElements.size) {
              for (const child of template.content.children) {
                const cloned = child.cloneNode(true) as Element;

                templateParent.appendChild(cloned);
                templateElements.add(cloned);
              }
            }
          }

          else if (templateElements.size) {
            for (const templateElement of templateElements) {
              // remove self from DOM tree and then MutationObserver will cleanup automatically
              templateElement.remove();
            }

            templateElements.clear();
          }
        };

        update(!!getScopeValue(scopeBehavior, prop));

        changeSubscribe(controller.signal, () => {
          update(!!getScopeValue(scopeBehavior, prop));
        });
      }

      else if (attribute.name === "o-for") {
        if (!(element instanceof HTMLTemplateElement)) {
          return console.error("o-for can only be used on template element");
        }

        const controller = attachedController(element);
        const prop = attribute.value;
        const as = element.getAttribute("as") ?? "item";

        const template = element as HTMLTemplateElement;
        const templateParent = element.parentElement ?? root;

        let templateElements = new Set<Element>();

        const mapPath = (itemElement: Element, each: string, as: string, index: number) => {
          for (const attribute of itemElement.attributes) {
            if (!attribute.name.startsWith("o-")) {
              continue;
            }

            if (attribute.value.startsWith(`${as}.`)) {
              attribute.value = attribute.value.replace(`${as}.`, `${each}.${index}.`);
            }

            else if (attribute.value === as) {
              attribute.value = `${each}.${index}`;
            }
          }

          if (itemElement.children.length) {
            for (const child of itemElement.children) {
              mapPath(child, each, as, index);
            }
          }
        };

        const update = (value: any) => {
          if (Array.isArray(value)) {
            if (templateElements.size > value.length) {
              const next = new Set<Element>();

              for (const templateElement of templateElements) {
                if (next.size < value.length) {
                  next.add(templateElement);
                }

                else {
                  // remove self from DOM tree and then MutationObserver will cleanup automatically
                  templateElement.remove();
                }
              }

              templateElements = next;
            }

            else if (templateElements.size < value.length) {
              const clonable = template.content.children.item(0);

              if (clonable) {
                for (let i = templateElements.size; i < value.length; i++) {
                  const cloned = clonable.cloneNode(true) as Element;

                  mapPath(cloned, prop, as, i);

                  templateParent.appendChild(cloned);
                  templateElements.add(cloned);
                }
              }

              else {
                console.error(`invalid template for directive o-for:`, template);
              }
            }
          }

          else if (templateElements.size) {
            for (const templateElement of templateElements) {
              // remove self from DOM tree and then MutationObserver will cleanup automatically
              templateElement.remove();
            }

            templateElements.clear();
            console.error(`invalid value for directive o-for:`, template);
          }
        };

        update(getScopeValue(scopeBehavior, prop));

        changeSubscribe(controller.signal, () => {
          update(getScopeValue(scopeBehavior, prop));
        });
      }

      // fallback as shorthand for o-bind-*
      else {
        const controller = attachedController(element);
        const prop = attribute.value;
        const to = attribute.name.slice(2); // // o-src, o-disabled, or other html attributes with o-*

        const update = (to: string, value: any) => {
          if (to in element) {
            if ((element as any)[to] !== value) {
              (element as any)[to] = value;
            }
          }

          else if (typeof value === "undefined" || value === null) {
            if (element.hasAttribute(to)) {
              element.removeAttribute(to);
            }
          }

          else if (typeof value === "string") {
            if (element.getAttribute(to) !== value) {
              element.setAttribute(to, value);
            }
          }

          else if (typeof value === "number") {
            const next = String(value);

            if (element.getAttribute(to) !== next) {
              element.setAttribute(to, next);
            }
          }

          else if (typeof value === "boolean") {
            if (value) {
              if (!element.hasAttribute(to)) {
                element.setAttribute(to, "");
              }
            }

            else if (element.hasAttribute(to)) {
              element.removeAttribute(to);
            }
          }

          else {
            throw new Error(`unsupported type: ${typeof value}`);
          }
        };

        update(to, getScopeValue(scopeBehavior, prop));

        changeSubscribe(controller.signal, () => {
          update(to, getScopeValue(scopeBehavior, prop));
        });
      }
    }
  };

  return {
    name,
    root,

    create() {
      logd?.(locate(this.root), `create scope "${name}"`);

      scopeState = "initializing";

      const signal = scopeController.signal;

      getScopeSetup(loader).then((module) => {
        if (signal.aborted) {
          return;
        }

        type ProxyState = {
          path: string;
        };

        const proxify = <T extends object>(src: T, state: ProxyState) => {
          const concat = (path: string, part: string) => path.length ? `${path}.${part}` : part;

          return new Proxy(src, {
            get(target, prop, receiver) {
              if (typeof prop === "string") {
                if (Array.isArray(target) && MUTABLE_ARRAY_METHODS.has(prop)) {
                  return (...args: any[]) => {
                    const result = (target as any)[prop](...args);

                    changeSubscriptions.forEach((subscription) => subscription());
                    return result;
                  };
                }

                const path = concat(state.path, prop);
                const desc = Object.getOwnPropertyDescriptor(target, prop);

                if (typeof desc?.value === "object") {
                  return proxify(desc.value, {
                    path,
                  });
                }

                if (desc?.get) {
                  return desc.get.call(receiver);
                }
              }

              return Reflect.get(target, prop, receiver);
            },

            set(target, prop, value, receiver) {
              const prev = Reflect.get(target, prop, receiver);

              if (prev === value) {
                return true;
              }

              const result = Reflect.set(target, prop, value);

              if (!result) {
                return false;
              }

              if (typeof prop === "string") {
                changeSubscriptions.forEach((subscription) => subscription());
              }

              return true;
            },
          });
        };

        scopeBehavior = proxify(module.setup(root), {
          path: "",
        });

        const unmount = scopeBehavior.mount?.();

        if (unmount && typeof unmount === 'function') {
          signal.addEventListener("abort", () => unmount());
        }

        scopeState = "initialized";

        for (const element of attachingElements) {
          attachElement(element);
        }

        attachingElements.clear();
      });
    },

    destroy() {
      logd?.(locate(this.root), `destroying scope "${name}"`);

      for (const controller of attachedElementControllers.values()) {
        controller.abort();
      }

      attachedElementControllers.clear();
      attachingElements.clear();

      scopeController.abort();
    },

    attach(element: Element) {
      logd?.(locate(this.root), `attaching ${locate(element)} to scope "${name}"`);

      if (scopeState === "initialized") {
        return attachElement(element);
      }

      attachingElements.add(element);
    },

    detach(element: Element) {
      logd?.(locate(this.root), `detaching ${locate(element)} from scope "${name}"`);

      attachingElements.delete(element);

      attachedElementControllers.get(element)?.abort();
      attachedElementControllers.delete(element);
    },
  };
};

function stringifyValue(value: any) {
  if (typeof value === "undefined" || value === null) {
    return "";
  }

  else if (typeof value === "string") {
    return value;
  }

  return String(value);
}

function getScopeValue(src: Record<string, any> | undefined, path: string) {
  const parts = path.split(".");

  let value = src;

  for (const part of parts) {
    if (value && typeof value === "object") {
      value = value[part];
    }

    else {
      return value;
    }
  }

  return value;
}

async function getScopeSetup(loader: OrbitScopeBehaviorLoader) {
  if (isStaticLoader(loader)) {
    return loader;
  }

  return await loader();
}

function isStaticLoader(module: OrbitScopeBehaviorLoader): module is OrbitScopeBeheviorSetup<any> {
  return module && typeof module === "object" && module[ORBIT_SCOPE_BEHAVIOR_SYMBOL];
}

export function defineScope<T extends {
  mount?(this: OrbitScopeBehavior<T>): (() => void) | void;
  [key: string]: any;
}>(setup: (root: Element) => OrbitScopeBehavior<T>): OrbitScopeBeheviorSetup<T> {
  return {
    [ORBIT_SCOPE_BEHAVIOR_SYMBOL]: true,
    setup,
  };
}
