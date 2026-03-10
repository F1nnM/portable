import { createApp } from "vue";
import App from "./App.vue";
import { router } from "./router";
import "@portable/design-tokens/tokens.css";

const app = createApp(App);
app.use(router);
app.mount("#app");
