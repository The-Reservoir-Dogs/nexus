import type { ReactNode } from "react";
import { Inter, JetBrains_Mono } from "next/font/google";
import { AuthProvider } from "@/components/AuthProvider";
import { ForkProvider } from "@/components/ForkProvider";
import "./globals.css";

const sans = Inter({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-sans",
});
const mono = JetBrains_Mono({ subsets: ["latin"], variable: "--font-mono" });

export const metadata = {
  title: "NEXUS — A Living Story Multiverse",
  description: "Where storytellers rewrite fate, and an AI keeps every timeline true.",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" className={`${sans.variable} ${mono.variable}`}>
      <body className="min-h-screen">
        <AuthProvider>
          <ForkProvider>{children}</ForkProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
