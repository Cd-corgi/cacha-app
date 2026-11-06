import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";

export default defineConfig({
  base: './',
  plugins: [
    react(),
    VitePWA({
      registerType: "autoUpdate",
      manifest: {
        name: "Cacha App",
        short_name: "CachaApp",
        description: "Control de tienda de barrio",
        theme_color: "#2c3e50",
        background_color: "#ecf0f1",
        display: "standalone", // ESTO HACE QUE SE ABRA COMO VENTANA DE WINDOWS
        icons: [
          {
            src: "/icon-192.png", // Debes poner un logo de 192x192 en la carpeta public
            sizes: "192x192",
            type: "image/png",
          },
          {
            src: "/icon-512.png", // Debes poner un logo de 512x512 en la carpeta public
            sizes: "512x512",
            type: "image/png",
          },
        ],
      },
    }),
  ],
});
