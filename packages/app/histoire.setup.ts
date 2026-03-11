import { defineSetupVue3 } from "@histoire/plugin-vue";
import "@portable/design-tokens/tokens.css";
import "./assets/css/global.css";

export const setupVue3 = defineSetupVue3(({ app: _app }) => {
  // Global setup for all stories
  // Design tokens and global CSS are imported above
});
