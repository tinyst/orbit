/** @jsxImportSource react */

import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";

export type CounterProps = {
  readonly count: number;
  readonly computed: string;
};

export const CounterScope = "Counter";

export function Counter({
  props,
}: {
  props?: CounterProps;
}) {
  const [count, setCount] = useState(props?.count ?? 0);
  const [input, setInput] = useState("");
  const [disabled, setDisabled] = useState(false);
  const [items, setItems] = useState<string[]>(Array.from({ length: 10000 }, (_, i) => `item${i + 1}`));

  const compute = useMemo(() => {
    if (props?.computed) {
      return new Function(`return \`${props.computed}\`;`) as () => string;
    }

    return undefined;
  }, [
    props?.computed,
  ]);

  const computedValue = useMemo(() => {
    if (compute) {
      return compute.bind({ count })();
    }

    return undefined;
  }, [
    compute,
    count,
  ]);

  const increase = () => {
    setCount((prev) => prev + 1);
    setInput(`item1 ${Date.now()}`);
  };

  const reset = () => {
    setCount(0);
  };

  useEffect(() => {
    setItems((items) => {
      return items.map((item, index) => {
        if (index === 0) return input;
        if (index === 1) return `item2 ${Math.random()}`;
        return item;
      });
    });
  }, [
    input,
  ]);

  return (
    <>
      <p>{count}</p>
      <p>{computedValue}</p>
      <input type="checkbox" checked={disabled} onChange={() => setDisabled(!disabled)} />
      <input
        disabled={disabled}
        type="text"
        value={input}
        onChange={(event) => setInput(event.target.value)}
      />
      <button onClick={increase}>INCREASE</button>
      <button onClick={reset}>RESET</button>
      {
        disabled && createPortal((
          <div>
            {items.map((item, index) => (
              <p key={index}>{item}</p>
            ))}
          </div>
        ), document.body)
      }
    </>
  );
}

export function CounterView(props: CounterProps) {
  const propsId = "p_" + crypto.randomUUID().replace(/-/g, "");

  return (
    <>
      <script id={propsId} type="application/json" dangerouslySetInnerHTML={{ __html: JSON.stringify(props) }} />
      <div data-component={CounterScope} data-props-id={propsId}>
        <Counter props={props} />
      </div>
    </>
  );
}
