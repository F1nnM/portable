import { HstNuxt } from "@histoire/plugin-nuxt";
import { HstVue } from "@histoire/plugin-vue";
import { defineConfig } from "histoire";

export default defineConfig({
  plugins: [HstVue(), HstNuxt()],
  setupFile: "./histoire.setup.ts",
  tree: {
    groups: [
      { id: "layouts", title: "Layouts" },
      { id: "pages", title: "Pages" },
      { id: "chat", title: "Chat" },
      { id: "files", title: "Files" },
      { id: "git", title: "Git" },
      { id: "project", title: "Project" },
    ],
  },
});
