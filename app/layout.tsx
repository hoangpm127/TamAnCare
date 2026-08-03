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
  title: "Tâm An Center",
  description: "Đặt lịch massage và chăm sóc cơ thể tại Tâm An Center, mở cửa hằng ngày từ 08:00 đến 22:00.",
  manifest: "/manifest.webmanifest",
  applicationName: "Tâm An Center",
  alternates: { canonical: "/" },
  appleWebApp: {
    capable: true,
    title: "Tâm An Center",
    statusBarStyle: "default",
  },
  openGraph: {
    type: "website",
    locale: "vi_VN",
    siteName: "Tâm An Center",
    title: "Tâm An Center",
    description: "Đặt lịch massage, chăm sóc cơ thể và theo dõi quyền lợi trực tuyến.",
    images: [{ url: "/tam-an-center-brand-red.jpg", alt: "Logo Tâm An Center" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "Tâm An Center",
    description: "Đặt lịch và theo dõi quyền lợi trực tuyến tại Tâm An Center.",
    images: ["/tam-an-center-brand-red.jpg"],
  },
  icons: {
    icon: "/favicon.png",
    shortcut: "/favicon.png",
    apple: "/icon-192.png",
  },
};

export const viewport: Viewport = {
  themeColor: "#a92f18",
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
