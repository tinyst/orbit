import { renderToString as renderToStringPreact } from "preact-render-to-string";
import { renderToString as renderToStringReact } from "react-dom/server";
import { virtualHTML } from "@tinyst/vite-plugin-virtual-html";
import { defineConfig } from "vite";
import nunjucks from "nunjucks";
import { reveal } from "@tinyst/taggl";

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
          "page1_nochunk.html": "tests/page1_nochunk.tsx",
          "page1_ssr.html": "tests/page1_ssr.tsx",
          "page2.html": "tests/page2.tsx",
          "page3.html": "tests/page3.tsx",
          "page4.html": "tests/page4.tsx",
          "page4_ssr.html": "tests/page4_ssr.tsx",
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

        const template = (
          module.preact ? reveal(renderToStringPreact(module.preact(context))) :
            module.react ? reveal(renderToStringReact(module.react(context))) :
              ""
        );

        return nunjucks.renderString(template, context);
      },
    }),
  ],
}));
