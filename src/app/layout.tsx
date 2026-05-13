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
          {/* Premium Ambient Background */}
          <div className="fixed inset-0 -z-10 bg-[#080b14] overflow-hidden">
            {/* Subtle Grid */}
            <div className="absolute inset-0 opacity-[0.025]"
              style={{
                backgroundImage: `linear-gradient(rgba(139,92,246,1) 1px, transparent 1px), linear-gradient(90deg, rgba(139,92,246,1) 1px, transparent 1px)`,
                backgroundSize: '60px 60px',
              }}
            />
            {/* Ambient Orbs */}
            <div className="animate-orb-pulse absolute -top-40 -left-40 w-[600px] h-[600px] rounded-full pointer-events-none"
              style={{ background: 'radial-gradient(circle, rgba(139,92,246,0.12) 0%, transparent 70%)' }} />
            <div className="animate-orb-pulse absolute top-1/2 -right-60 w-[500px] h-[500px] rounded-full pointer-events-none"
              style={{ background: 'radial-gradient(circle, rgba(34,211,238,0.08) 0%, transparent 70%)', animationDelay: '4s' }} />
            <div className="animate-orb-pulse absolute -bottom-60 left-1/3 w-[500px] h-[500px] rounded-full pointer-events-none"
              style={{ background: 'radial-gradient(circle, rgba(139,92,246,0.08) 0%, transparent 70%)', animationDelay: '8s' }} />
          </div>
          {children}
        </Providers>
      </body>
    </html>
  );
}
