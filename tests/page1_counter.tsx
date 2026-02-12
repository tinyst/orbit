import { fieldPath } from "@tinyst/fieldpath";
import { j } from "@tinyst/kizune";
import clsx from "clsx";
import { defineComponent } from "../src/core";

export type CounterState = {
  count: number;
  disabled: boolean;
  input: string;
  items: string[];

  // computed
  readonly computed: string;
  readonly computedClass: string;

  // actions
  increase: () => void;
  reset: () => void;
};

export type CounterProps = {
  readonly count: number;
  readonly computed: string;
};

export type CounterContext = {
  readonly count: number;
  readonly computed: string;
  readonly computedValue: string;
};

const classes = {
  a: "text-blue-500",
  b: "text-red-500",
};

export const CounterScope = "Counter";
export const Counter = defineComponent<CounterProps>((scope, props) => {
  const count = props.count ?? 0;
  const _ = scope.state<CounterState>({
    count,
    disabled: false,
    input: "",
    items: Array.from({ length: 10000 }, (_, i) => `item${i + 1}`),

    get computed() {
      return scope.compute(props.computed);
    },

    get computedClass() {
      return clsx({
        [classes.a]: this.count <= 10,
        [classes.b]: this.count > 10,
      });
    },

    increase() {
      this.count += 1;
      this.input = `item1 ${Date.now()}`;
    },

    reset() {
      this.count = 0;
    },
  }, {
    input(value) {
      this.items[0] = value;
      this.items[1] = `item2 ${Math.random()}`;
    },
  });
});

export function CounterView() {
  const context = fieldPath<CounterContext>();
  const state = fieldPath<CounterState>();

  const propsId = "p_" + crypto.randomUUID().replace(/-/g, "");
  const props = `{"${state.count}": {{ ${context.count} }}, "${state.computed}": "{{ ${context.computed} }}"}`;

  return (
    <>
      <script id={propsId} type="application/json" dangerouslySetInnerHTML={{ __html: props }} />
      <div
        o-scope={CounterScope}
        o-scope-props-id={propsId}
      >
        <p o-text={state.count}>{j.expr(context.count)}</p>
        <p
          o-text={state.computed}
          o-class={state.computedClass}
          class={j.match({
            [classes.a]: `${context.count} <= 10`,
            [classes.b]: `${context.count} > 10`,
          })}
        >
          {j.expr(context.computedValue)}
        </p>
        <input o-model={state.disabled} type="checkbox" />
        <input
          o-disabled={state.disabled}
          o-model={state.input}
          type="text"
        />
        <button o-onclick={state.increase}>INCREASE</button>
        <button o-onclick={state.reset}>RESET</button>
        <template o-if={state.disabled}>
          <template o-teleport="body">
            <div>
              <template o-for={state.items}>
                <p o-text="$"></p>
              </template>
            </div>
          </template>
        </template>
      </div>
    </>
  );
}
