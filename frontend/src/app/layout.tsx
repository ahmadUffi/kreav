import type { Metadata } from "next";
import { Anton, JetBrains_Mono, Press_Start_2P } from "next/font/google";
import { ThemeProvider } from "@/context/theme";
import "./globals.css";

const anton = Anton({
  variable: "--font-anton-var",
  subsets: ["latin"],
  weight: "400",
});

const jetbrainsMono = JetBrains_Mono({
  variable: "--font-mono-var",
  subsets: ["latin"],
  weight: ["400", "500", "700", "800"],
});

const pressStart2P = Press_Start_2P({
  variable: "--font-pixel-var",
  subsets: ["latin"],
  weight: "400",
});

export const metadata: Metadata = {
  // Absolute base for OG/Twitter URLs (share previews). Set NEXT_PUBLIC_SITE_URL
  // to the deployed origin in prod; localhost fallback for dev.
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000"),
  title: "Kreav — Sell Your Digital Work Everywhere",
  description:
    "Sell your ebooks, presets, and templates to buyers across Asia. Get paid instantly, in your own currency.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${anton.variable} ${jetbrainsMono.variable} ${pressStart2P.variable}`}
    >
      <body>
        <ThemeProvider>{children}</ThemeProvider>
      </body>
    </html>
  );
}
