import tailwindcss from "@tailwindcss/vite";

export default defineNuxtConfig({
  compatibilityDate: "2025-03-01",
  ssr: false,
  devtools: false,
  modules: ["@vite-pwa/nuxt"],
  css: ["~/assets/css/main.css"],
  app: {
    head: {
      meta: [
        { name: "viewport", content: "width=device-width, initial-scale=1" },
        { name: "theme-color", content: "#e8734a" },
        { name: "apple-mobile-web-app-capable", content: "yes" },
      ],
      link: [{ rel: "apple-touch-icon", href: "/icons/icon-192x192.png" }],
    },
  },
  devServer: {
    host: "0.0.0.0",
  },
  vite: {
    plugins: [tailwindcss()],
    server: {
      allowedHosts: true,
    },
  },
  pwa: {
    registerType: "autoUpdate",
    client: {
      installPrompt: true,
    },
    manifest: {
      name: "My App",
      short_name: "MyApp",
      theme_color: "#e8734a",
      background_color: "#1c1917",
      display: "standalone",
      icons: [
        {
          src: "/icons/icon-192x192.png",
          sizes: "192x192",
          type: "image/png",
        },
        {
          src: "/icons/icon-512x512.png",
          sizes: "512x512",
          type: "image/png",
        },
      ],
    },
    workbox: {
      navigateFallback: "/",
      globPatterns: ["**/*.{js,css,html,png,svg,ico,woff2}"],
      runtimeCaching: [
        {
          urlPattern: /^.*\/api\/.*/,
          handler: "NetworkFirst",
          options: {
            cacheName: "api-cache",
            expiration: {
              maxEntries: 100,
              maxAgeSeconds: 60 * 60,
            },
          },
        },
      ],
    },
  },
});
