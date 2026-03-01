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
          {/* Premium animated CSS background */}
          <div className="fixed inset-0 -z-10 bg-[var(--ocms-bg)] overflow-hidden">
            {/* Ambient glowing flares */}
            <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] bg-[var(--ocms-accent)] rounded-[100%] blur-[140px] mix-blend-screen animate-pulse-glow" style={{ animationDelay: '0s' }} />
            <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-emerald-500 rounded-[100%] blur-[140px] mix-blend-screen opacity-50 animate-pulse-glow" style={{ animationDelay: '3s' }} />

            {/* Animated Grid overlay */}
            <div className="absolute inset-0 top-[-64px] h-[calc(100%+64px)] opacity-[0.06] animate-grid-move"
              style={{
                backgroundImage: `linear-gradient(rgba(255,255,255,0.8) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.8) 1px, transparent 1px)`,
                backgroundSize: '64px 64px',
              }}
            />

            {/* Fade gradients */}
            <div className="absolute inset-x-0 top-0 h-40 bg-gradient-to-b from-[var(--ocms-bg)] to-transparent" />
            <div className="absolute inset-x-0 bottom-0 h-80 bg-gradient-to-t from-[var(--ocms-bg)] via-[var(--ocms-bg)]/80 to-transparent" />
          </div>
          {children}
        </Providers>
      </body>
    </html>
  );
}
