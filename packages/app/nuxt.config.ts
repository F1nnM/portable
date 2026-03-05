export default defineNuxtConfig({
  compatibilityDate: "2025-03-01",
  ssr: true,
  devtools: { enabled: true },
  runtimeConfig: {
    githubClientId: "",
    githubClientSecret: "",
    encryptionKey: "",
    baseUrl: "http://localhost:3000",
    podNamespace: "default",
    podServerImage: "portable/pod-server:latest",
    podResourceCpuRequest: "500m",
    podResourceCpuLimit: "2000m",
    podResourceMemoryRequest: "512Mi",
    podResourceMemoryLimit: "4Gi",
    podStorageSize: "5Gi",
  },
  app: {
    head: {
      title: "Portable",
      meta: [
        { name: "viewport", content: "width=device-width, initial-scale=1, viewport-fit=cover" },
        { name: "theme-color", content: "#0a0a0b" },
        {
          name: "description",
          content: "Mobile-first remote Claude Code environment",
        },
      ],
      link: [
        { rel: "preconnect", href: "https://fonts.googleapis.com" },
        {
          rel: "preconnect",
          href: "https://fonts.gstatic.com",
          crossorigin: "",
        },
        {
          rel: "stylesheet",
          href: "https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500;600&display=swap",
        },
      ],
    },
  },
  css: ["~/assets/css/global.css"],
});
