import type { Metadata, Viewport } from "next";
import localFont from "next/font/local";
import { FloatingNavbar } from "@/components/layout/FloatingNavbar";
import { AuthPreferenceBootstrap } from "@/components/providers/AuthPreferenceBootstrap";
import { PwaRegistrar } from "@/components/providers/PwaRegistrar";
import { QueryProvider } from "@/components/providers/QueryProvider";
import "./globals.css";

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
  description: "AMAZER light commerce experience",
  manifest: "/manifest.json",
  icons: {
    icon: "/logo-amazer-mark.svg",
    apple: "/logo-amazer-mark.svg",
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
          <AuthPreferenceBootstrap />
          <FloatingNavbar />
          <main className="min-h-screen pt-24">{children}</main>
        </QueryProvider>
      </body>
    </html>
  );
}
