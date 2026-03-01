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
          {/* Premium atmospheric background */}
          <div className="fixed inset-0 -z-10 bg-[var(--ocms-bg)]">
            {/* Background Image */}
            <div
              className="absolute inset-0 bg-cover bg-center bg-no-repeat opacity-40"
              style={{ backgroundImage: `url('/bg-hero.png')` }}
            />
            {/* Top fade gradient to blend into the navbar */}
            <div className="absolute inset-x-0 top-0 h-32 bg-gradient-to-b from-[var(--ocms-bg)] to-transparent" />
            {/* Bottom fade gradient */}
            <div className="absolute inset-x-0 bottom-0 h-64 bg-gradient-to-t from-[var(--ocms-bg)] to-transparent" />
            {/* Subtle grid overlay */}
            <div
              className="absolute inset-0 opacity-[0.02]"
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
