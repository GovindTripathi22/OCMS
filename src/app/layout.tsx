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
  metadataBase: new URL(process.env.NEXT_PUBLIC_APP_URL || process.env.NEXTAUTH_URL || "http://localhost:3000"),
  title: "OCMS — Local-First Headless CMS by SPACHT",
  description:
    "Next-generation headless CMS. 100% free, offline, and privacy-first. Built with precision by team SPACHT.",
  icons: {
    icon: "/ocms_logo.png",
  },
  openGraph: {
    title: "OCMS — Local-First Headless CMS by SPACHT",
    description: "Next-generation headless CMS. 100% free, offline, and privacy-first. Built with precision by team SPACHT.",
    images: ["/ocms_logo.png"],
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "OCMS — Local-First Headless CMS by SPACHT",
    description: "Next-generation headless CMS. 100% free, offline, and privacy-first. Built with precision by team SPACHT.",
    images: ["/ocms_logo.png"],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="scroll-smooth" suppressHydrationWarning>
      <body
        suppressHydrationWarning
        className={`${spaceGrotesk.variable} ${jetbrainsMono.variable} antialiased bg-[var(--ocms-bg)] text-slate-900 min-h-screen pt-[56px] font-[family-name:var(--font-space-grotesk)]`}
      >
        <Providers>
          <Navbar />
          {/* Neobrutalist Ambient Background */}
          <div className="fixed inset-0 -z-10 bg-[#f6f4ee] overflow-hidden">
            {/* Subtle Grid */}
            <div className="absolute inset-0 opacity-[0.04]"
              style={{
                backgroundImage: `linear-gradient(rgba(0,0,0,1) 1px, transparent 1px), linear-gradient(90deg, rgba(0,0,0,1) 1px, transparent 1px)`,
                backgroundSize: '60px 60px',
              }}
            />
          </div>
          {children}
        </Providers>
      </body>
    </html>
  );
}
