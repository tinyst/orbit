import { renderToString as renderToStringPreact } from "preact-render-to-string";
import { renderToString as renderToStringReact } from "react-dom/server";
import { virtualHTML } from "@tinyst/vite-plugin-virtual-html";
import { defineConfig } from "vite";
import nunjucks from "nunjucks";

export default defineConfig(({ mode }) => ({
  build: {
    // for debug
    // minify: false,
    // modulePreload: false,

    outDir: ".dist",
  },

  server: {
    // host: "127.0.0.1",
    host: "0.0.0.0",
  },

  plugins: [
    virtualHTML({
      onGetEntries() {
        const entries: Record<string, string> = {
          "page1.html": "tests/page1.tsx",
          "page2.html": "tests/page2.tsx",
          "page3.html": "tests/page3.tsx",
          "page4.html": "tests/page4.tsx",
        };

        return entries;
      },

      onGetHTML({ module }) {
        const template = (
          module.preact ? renderToStringPreact(module.preact()) :
            module.react ? renderToStringReact(module.react()) :
              ""
        );

        const count = 9;
        const computed = "SSR: ${this.count * 2}";
        const computedValue = new Function(`return \`${computed}\``).bind({ count })();

        const context = {
          count,
          computed,
          computedValue,
        };

        return nunjucks.renderString(template, context);
      },
    }),
  ],
}));
