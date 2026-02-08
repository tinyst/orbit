/** @jsxImportSource react */

import { CounterView } from "./page4_ssr_counter";

export function react(context: {
  count: number;
  computed: string;
}) {
  const itemCount = 1;
  const itemPerChunk = Math.min(100, itemCount);

  const chunkCount = Math.ceil(itemCount / itemPerChunk);

  return (
    <html>
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <title>My Page</title>
        <script type="module" src="/tests/page4_ssr_script.tsx" />
      </head>
      <body>
        {
          Array.from({ length: chunkCount }, (_, i) => (
            <>
              {
                Array.from({ length: itemPerChunk }, (_, j) => (
                  <CounterView
                    key={`${i}-${j}`}
                    count={context.count}
                    computed={context.computed}
                  />
                ))
              }
            </>
          ))
        }
      </body>
    </html>
  );
}
