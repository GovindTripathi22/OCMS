import type { Metadata } from "next";
import { Space_Grotesk, JetBrains_Mono } from "next/font/google";
import "./globals.css";
import { Providers } from "@/components/providers";
import Navbar from "@/components/Navbar";

const spaceGrotesk = Space_Grotesk({
  subsets: ["latin"],
  variable: "--font-space-grotesk",
  weight: ["300", "400", "500", "600", "700"],
});
const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-jetbrains-mono",
  weight: ["400", "500", "700"],
});

export const metadata: Metadata = {
  title: "OCMS — AI-Powered Headless CMS by SPACHT",
  description:
    "Next-generation headless CMS powered by Gemini AI. Built with precision by team SPACHT.",
  icons: {
    icon: "/ocms_logo.png",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark scroll-smooth" suppressHydrationWarning>
      <body
        suppressHydrationWarning
        className={`${spaceGrotesk.variable} ${jetbrainsMono.variable} antialiased bg-[var(--ocms-bg)] text-slate-100 min-h-screen pt-[56px] font-[family-name:var(--font-space-grotesk)]`}
      >
        <Providers>
          <Navbar />
          {/* Premium animated CSS background */}
          <div className="fixed inset-0 -z-10 bg-[var(--ocms-bg)] overflow-hidden perspective-[1000px]">
            {/* Base Grain Texture */}
            <div className="absolute inset-[-200%] w-[400%] h-[400%] opacity-[0.03] mix-blend-overlay pointer-events-none animate-grain" />

            {/* Ambient glowing flares */}
            <div className="absolute top-[-20%] left-[-10%] w-[60%] h-[60%] bg-[var(--ocms-accent)] rounded-[100%] blur-[120px] mix-blend-screen animate-pulse-glow" style={{ animationDelay: '0s' }} />
            <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] bg-emerald-500 rounded-[100%] blur-[140px] mix-blend-screen opacity-40 animate-pulse-glow" style={{ animationDelay: '4s' }} />

            {/* 3D Perspective Grid overlay */}
            <div className="absolute inset-x-[-50%] bottom-[-50%] h-[150%] w-[200%]"
              style={{
                transform: 'rotateX(60deg) translateY(100px) translateZ(-200px)',
                transformOrigin: 'bottom center',
              }}
            >
              <div className="absolute inset-0 opacity-[0.08] animate-grid-move"
                style={{
                  backgroundImage: `linear-gradient(rgba(255,255,255,0.8) 2px, transparent 2px), linear-gradient(90deg, rgba(255,255,255,0.8) 2px, transparent 2px)`,
                  backgroundSize: '100px 100px',
                }}
              />
            </div>

            {/* Fade gradients for smooth grid blending */}
            <div className="absolute inset-x-0 top-0 h-1/2 bg-gradient-to-b from-[var(--ocms-bg)] to-transparent" />
            <div className="absolute inset-x-0 bottom-0 h-64 bg-gradient-to-t from-[var(--ocms-bg)] via-[var(--ocms-bg)]/90 to-transparent" />
          </div>
          {children}
        </Providers>
      </body>
    </html>
  );
}
