import { renderToString } from "@tinyst/jsx";
import { virtualHTML } from "@tinyst/vite-plugin-virtual-html";
import nunjucks from "nunjucks";
import { defineConfig } from "vite";

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
        };

        return entries;
      },

      onGetHTML({ module }) {
        const count = 9;
        const computed = "SSR: ${this.count * 2}"; // it should be a simple regex for production usage
        const computedValue = new Function(`return \`${computed}\``).bind({ count })();

        const context = {
          count,
          computed,
          computedValue,
        };

        const template = renderToString(module.default(context));
        const html = nunjucks.renderString(template, context);

        return html;
      },
    }),
  ],
}));
