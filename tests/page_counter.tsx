import { fieldPath } from "@tinyst/fieldpath";
import { defineComponent } from "../src/core";

export type CounterRef = {
  checkbox: HTMLInputElement;
  input: HTMLInputElement;
  increase: HTMLButtonElement;
  reset: HTMLButtonElement;
};

export type CounterState = {
  count: number;
  input: string;
  disabled: boolean;

  // computed
  readonly computed: string;
  readonly computedInput: string;

  // actions
  increase: () => void;
  reset: () => void;
};

export type CounterProps = {
  count: number;
};

export const CounterScope = "Counter";
export const Counter = defineComponent<CounterProps>((scope, props) => {
  const count = props.count ?? 0;
  const _ = scope.state<CounterState>({
    count,
    input: "",
    disabled: false,

    get computed() {
      return `count: ${this.count * 2}`;
    },

    get computedInput() {
      return `input: ${this.input}, computed: ${this.computed}`;
    },

    increase() {
      this.count += 1;
    },

    reset() {
      this.count = 0;
    },
  });

  // scope.ref<CounterRef>({
  //   increase: (element, signal) => {
  //     element.addEventListener("click", () => {
  //       state.count += 1;
  //     }, {
  //       signal,
  //     });
  //   },

  //   reset: (element, signal) => {
  //     element.addEventListener("click", () => {
  //       state.count = 0;
  //     }, {
  //       signal,
  //     });
  //   },
  // });
});

export function CounterView(props: CounterProps) {
  const propsId = "p_" + crypto.randomUUID().replace(/-/g, "");

  const state = fieldPath<CounterState>();
  const ref = fieldPath<CounterRef>();

  return (
    <>
      {/*<script id={propsId} type="application/json">{JSON.stringify(props)}</script>*/}
      <div
        o-scope={CounterScope}
      // o-scope-props={propsId}
      >
        <p o-text={state.count}>{props.count}</p>
        <p o-text={state.computed}>count: {props.count * 2}</p>
        <p o-text={state.computedInput} o-hidden={state.disabled} style="word-wrap: break-word;">input: </p>
        <input o-model={state.disabled} type="checkbox" />
        <input
          o-disabled={state.disabled}
          o-model={state.input}
          type="text"
        />
        <button o-onclick={state.increase}>INCREASE</button>
        <button o-onclick={state.reset}>RESET</button>
      </div>
    </>
  );
}
