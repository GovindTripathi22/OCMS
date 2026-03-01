import type { Metadata } from "next";
import localFont from "next/font/local";
import "./globals.css";
import { Providers } from "@/components/providers";
import Navbar from "@/components/Navbar";

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
  title: "OCMS — AI-Powered Headless CMS by SPACHT",
  description:
    "Next-generation headless CMS powered by Gemini AI. Built with precision by team SPACHT.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark scroll-smooth">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased bg-[var(--ocms-bg)] text-slate-100 min-h-screen pt-[56px]`}
      >
        <Providers>
          <Navbar />
          {/* Subtle architectural grid background */}
          <div className="fixed inset-0 -z-10 bg-[var(--ocms-bg)]">
            <div
              className="absolute inset-0 opacity-[0.03]"
              style={{
                backgroundImage: `linear-gradient(rgba(255,255,255,0.1) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.1) 1px, transparent 1px)`,
                backgroundSize: '64px 64px',
              }}
            />
          </div>
          {children}
        </Providers>
      </body>
    </html>
  );
}
