import { Inter } from "next/font/google";
import type { Metadata, Viewport } from "next";
import { Providers } from "@/components/providers";
import "./globals.css";
import "@/app/proposal-print.css";
import { cn } from "@/lib/utils";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
});

export const metadata: Metadata = {
  title: "AgencyFlow",
  description: "End-to-end agency operations platform by SreeDrisya Media",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={cn("h-full", inter.variable)}>
      <body className="min-h-full">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
