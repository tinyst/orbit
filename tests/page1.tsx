import { CounterView } from "./page1_counter";

export function preact() {
  const itemCount = 1;
  const itemPerChunk = Math.min(100, itemCount);

  const chunkCount = Math.ceil(itemCount / itemPerChunk);

  return (
    <html>
      <head>
        <meta charset="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <title>My Page</title>
        <link rel="stylesheet" href="/tests/page1.css" />
        <script type="module" src="/tests/page1_script.ts" />
      </head>
      <body>
        {
          Array.from({ length: chunkCount }, (_, i) => (
            <div o-load={i > 0 ? "visible" : undefined}>
              {
                Array.from({ length: itemPerChunk }, (_, j) => (
                  <CounterView />
                ))
              }
            </div>
          ))
        }
      </body>
    </html>
  );
}
