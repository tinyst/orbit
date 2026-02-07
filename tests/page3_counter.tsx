/** @jsxImportSource react */

import { Signal, signal } from "@preact/signals-react";
import { useSignals } from "@preact/signals-react/runtime";
import { fieldPath } from "@tinyst/fieldpath";
import { createPortal } from "react-dom";
import { createRoot } from "react-dom/client";
import { defineComponent } from "../src/core";

export type CounterRef = {
  list: HTMLDivElement;
};

export type CounterState = {
  count: number;
  disabled: Signal<boolean>;
  input: string;
  items: Signal<string[]>;

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

export type CounterContext = {
  readonly count: number;
  readonly computed: string;
  readonly computedValue: string;
};

export const CounterScope = "Counter";
export const Counter = defineComponent<CounterProps>((scope, props) => {
  const count = props.count ?? 0;
  const state = scope.state<CounterState>({
    count,
    disabled: signal(false),
    input: "",
    items: signal(Array.from({ length: 10000 }, (_, i) => `item${i + 1}`)),

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
      this.items.value = this.items.value.map((item, index) => {
        if (index === 0) return value;
        if (index === 1) return `item2 ${Math.random()}`;
        return item;
      });
    },
  });

  const List = () => {
    useSignals();
    return (
      <>
        {
          state.disabled.value && createPortal((
            <div>
              {state.items.value.map((item) => (
                <p>{item}</p>
              ))}
            </div>
          ), document.body)
        }
      </>
    );
  };

  scope.ref<CounterRef>({
    list: (element) => {
      const root = createRoot(element);

      root.render(<List />);

      return () => {
        root.unmount();
      };
    },
  });
});

export function CounterView() {
  const context = fieldPath<CounterContext>();
  const state = fieldPath<CounterState>();
  const ref = fieldPath<CounterRef>();

  const propsId = "p_" + crypto.randomUUID().replace(/-/g, "");
  const props = `{"${state.count}": {{ ${context.count} }}, "${state.computed}": "{{ ${context.computed} }}"}`;

  return (
    <>
      <script id={propsId} type="application/json" dangerouslySetInnerHTML={{ __html: props }} />
      <div
        o-scope={CounterScope}
        o-scope-props-id={propsId}
      >
        <p o-text={state.count}>{`{{ ${state.count} }}`}</p>
        <p o-text={state.computed}>{`{{ ${context.computedValue} }}`}</p>
        <input o-model={state.disabled.value} type="checkbox" />
        <input
          o-disabled={state.disabled.value}
          o-model={state.input}
          type="text"
        />
        <button o-onclick={state.increase}>INCREASE</button>
        <button o-onclick={state.reset}>RESET</button>
        <div o-ref={ref.list} />
      </div>
    </>
  );
}
