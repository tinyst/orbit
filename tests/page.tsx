import { CounterView } from "./page_counter";

export function page() {
  const itemCount = 30000;
  const itemPerChunk = Math.min(100, itemCount);

  const chunkCount = Math.ceil(itemCount / itemPerChunk);

  const initialCount = 10;

  return (
    <html>
      <head>
        <meta charset="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <title>My Page</title>
        <script type="module" src="/tests/page_script.ts" />
      </head>
      <body>
        {/*<script id={propsId} type="application/json">
          {JSON.stringify({ count: initialCount })}
        </script>
        <div o-scope={Counter.name} o-scope-props={propsId}>
          <p o-ref={refs.value}>{initialCount}</p>
          <p o-ref={refs.computed}>computed: {initialCount * 2}, []</p>
          <p o-ref={refs.computedInput} style="word-wrap: break-word;">input: </p>
          <div o-ref={refs.src} />
          <input o-ref={refs.checkbox} type="checkbox" />
          <input o-ref={refs.input} type="text" />
          <button o-ref={refs.increase}>INCREASE</button>
          <button o-ref={refs.reset}>RESET</button>
        </div>*/}

        {
          Array.from({ length: chunkCount }, (_, i) => (
            <div o-load={i > 0 ? "visible" : undefined}>
              {
                Array.from({ length: itemPerChunk }, (_, j) => (
                  <CounterView count={initialCount} />
                ))
              }
            </div>
          ))
        }
      </body>
    </html>
  );
}
