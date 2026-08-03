import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Tâm An Care",
    short_name: "Tâm An Care",
    description: "Booking, CRM và dashboard vận hành cho Tâm An Spa - Foot & Body",
    id: "/",
    start_url: "/",
    scope: "/",
    display: "standalone",
    orientation: "portrait-primary",
    background_color: "#fffaf6",
    theme_color: "#9f1d20",
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
        src: "/favicon.ico",
        sizes: "48x48",
        type: "image/x-icon",
      },
    ],
  };
}
