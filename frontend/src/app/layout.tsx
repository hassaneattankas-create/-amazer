import type { Metadata, Viewport } from "next";
import localFont from "next/font/local";
import { AppFooter } from "@/components/layout/AppFooter";
import { AndroidBackButtonHandler } from "@/components/providers/AndroidBackButtonHandler";
import { FloatingNavbar } from "@/components/layout/FloatingNavbar";
import { AuthPreferenceBootstrap } from "@/components/providers/AuthPreferenceBootstrap";
import { PwaRegistrar } from "@/components/providers/PwaRegistrar";
import { QueryProvider } from "@/components/providers/QueryProvider";
import "./globals.css";

const siteUrl = new URL("https://amazer.store");

const geistSans = localFont({
  src: "./fonts/GeistVF.woff",
  variable: "--font-geist-sans",
  weight: "100 900",
});
const geistMono = localFont({
  src: "./fonts/GeistMonoVF.woff",
  variable: "--font-geist-mono",
  weight: "100 900",
});

export const metadata: Metadata = {
  title: "AMAZER",
  description: "AMAZER marketplace: boutique, restaurant, premium et livraison.",
  metadataBase: siteUrl,
  alternates: {
    canonical: "/",
  },
  manifest: "/manifest.json",
  openGraph: {
    title: "AMAZER",
    description: "AMAZER marketplace: boutique, restaurant, premium et livraison.",
    url: siteUrl,
    siteName: "AMAZER",
    locale: "fr_NE",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "AMAZER",
    description: "AMAZER marketplace: boutique, restaurant, premium et livraison.",
  },
  icons: {
    icon: [
      { url: "/icon-amazer-titan.svg", sizes: "1024x1024", type: "image/svg+xml" },
      { url: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: "/apple-touch-icon.png",
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "AMAZER",
  },
  other: {
    "apple-mobile-web-app-capable": "yes",
    "mobile-web-app-capable": "yes",
  },
};

export const viewport: Viewport = {
  themeColor: "#FF4D00",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="fr">
      <body
        className={`${geistSans.variable} ${geistMono.variable} min-h-screen bg-white text-slate-900 antialiased`}
      >
        <QueryProvider>
          <PwaRegistrar />
          <AndroidBackButtonHandler />
          <AuthPreferenceBootstrap />
          <FloatingNavbar />
          <main className="min-h-screen pt-24">{children}</main>
          <AppFooter />
        </QueryProvider>
      </body>
    </html>
  );
}
