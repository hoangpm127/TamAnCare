import type { Metadata, Viewport } from "next";
import { Inter, Geist_Mono } from "next/font/google";
import { PwaRegistration } from "@/components/pwa-registration";
import { siteUrl } from "@/lib/site-url";
import "./globals.css";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin", "latin-ext", "vietnamese"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  metadataBase: siteUrl(),
  title: "Tâm An Care",
  description: "Booking, CRM và hệ thống vận hành cho Tâm An Spa - Foot & Body",
  manifest: "/manifest.webmanifest",
  applicationName: "Tâm An Care",
  alternates: { canonical: "/" },
  appleWebApp: {
    capable: true,
    title: "Tâm An Care",
    statusBarStyle: "default",
  },
  openGraph: {
    type: "website",
    locale: "vi_VN",
    siteName: "Tâm An Care",
    title: "Tâm An Care",
    description: "Đặt lịch Foot, Body, gội đầu dưỡng sinh và theo dõi quyền lợi trên web.",
    images: [{ url: "/tam-an-hero.png", alt: "Không gian Tâm An Care" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "Tâm An Care",
    description: "Đặt lịch và theo dõi quyền lợi trực tuyến tại Tâm An Care.",
    images: ["/tam-an-hero.png"],
  },
  icons: {
    icon: "/icon.svg",
    shortcut: "/icon.svg",
    apple: "/icon-192.png",
  },
};

export const viewport: Viewport = {
  themeColor: "#d13f1f",
  colorScheme: "light",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="vi"
      className={`${inter.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        {children}
        <PwaRegistration />
      </body>
    </html>
  );
}
