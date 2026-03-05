export default defineNuxtConfig({
  compatibilityDate: "2025-03-01",
  ssr: true,
  devtools: { enabled: true },
  runtimeConfig: {
    githubClientId: "",
    githubClientSecret: "",
    encryptionKey: "",
    baseUrl: "http://localhost:3000",
  },
});
