import { renderToString } from "@tinyst/jsx/static";
import { virtualHTML } from "@tinyst/vite-plugin-virtual-html";
import { defineConfig } from "vite";

export default defineConfig(({ mode }) => ({
  build: {
    // for debug
    // minify: false,
    // modulePreload: false,

    outDir: ".dist",
  },

  server: {
    host: "127.0.0.1",
  },

  plugins: [
    virtualHTML({
      onGetEntries() {
        const entries: Record<string, string> = {
          "page.html": "tests/page.tsx",
          // "page2.html": "tests/page2.tsx",
          // "page3.html": "tests/page3.tsx",
        };

        return entries;
      },

      onGetHTML({ module }) {
        return renderToString(module.page());
      },
    }),
  ],
}));
