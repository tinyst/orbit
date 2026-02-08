import { fieldPath } from "@tinyst/fieldpath";
import { defineComponent } from "../src/core";

export type CounterState = {
  count: number;
  disabled: boolean;
  input: string;
  items: string[];

  // computed
  readonly computed: string;

  // actions
  increase: () => void;
  reset: () => void;
};

export type CounterProps = {
  readonly count: number;
  readonly computed: string;
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

export function CounterView(props: CounterProps) {
  const state = fieldPath<CounterState>();
  const propsId = "p_" + crypto.randomUUID().replace(/-/g, "");

  // just for test computed (it should be simple regex for production usage)
  const computedValue = new Function(`return \`${props.computed}\``).bind({ count: props.count })();

  return (
    <>
      <script id={propsId} type="application/json" dangerouslySetInnerHTML={{ __html: JSON.stringify(props) }} />
      <div
        o-scope={CounterScope}
        o-scope-props-id={propsId}
      >
        <p o-text={state.count}>{props.count}</p>
        <p o-text={state.computed}>{computedValue}</p>
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
