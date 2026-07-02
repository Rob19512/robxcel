import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Robxcel",
    short_name: "Robxcel",
    description: "Gestion compta achat-revente",
    start_url: "/",
    display: "standalone",
    background_color: "#f4f4f8",
    theme_color: "#4f46e5",
    icons: [
      { src: "/api/pwa-icon/192", sizes: "192x192", type: "image/png" },
      { src: "/api/pwa-icon/512", sizes: "512x512", type: "image/png" },
      { src: "/api/pwa-icon/512", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
