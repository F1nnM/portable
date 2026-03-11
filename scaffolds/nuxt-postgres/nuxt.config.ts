export default defineNuxtConfig({
  compatibilityDate: "2025-03-01",
  ssr: true,
  devtools: false,
  devServer: {
    host: "0.0.0.0",
  },
  vite: {
    server: {
      allowedHosts: true,
    },
  },
});
