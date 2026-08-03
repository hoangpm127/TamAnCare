import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Tâm An Center",
    short_name: "Tâm An Center",
    description: "Đặt lịch và quản lý quyền lợi chăm sóc tại Tâm An Center",
    id: "/",
    start_url: "/",
    scope: "/",
    display: "standalone",
    orientation: "portrait-primary",
    background_color: "#fdf8f3",
    theme_color: "#c64b32",
    lang: "vi",
    categories: ["health", "lifestyle"],
    prefer_related_applications: false,
    shortcuts: [
      { name: "Đặt lịch", short_name: "Đặt lịch", url: "/booking", icons: [{ src: "/icon-192.png", sizes: "192x192" }] },
      { name: "Lịch của tôi", short_name: "Lịch của tôi", url: "/don-cua-toi", icons: [{ src: "/icon-192.png", sizes: "192x192" }] },
      { name: "Affiliate", short_name: "Affiliate", url: "/ru-ban", icons: [{ src: "/icon-192.png", sizes: "192x192" }] },
    ],
    icons: [
      {
        src: "/icon-192.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icon-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/favicon.png",
        sizes: "48x48",
        type: "image/png",
      },
    ],
  };
}
