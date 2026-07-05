import type { Metadata } from "next";
import "./globals.css";
import { BootMigration } from "@/components/BootMigration";

export const metadata: Metadata = {
  title: "Guitar Song Practice Metronome",
  description: "Structured guitar speed-practice for songs and exercises with a tempo ladder, block timer, and metronome.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="dark">
      <body className="bg-bg text-neutral-100 antialiased min-h-screen">
        <BootMigration />
        {children}
      </body>
    </html>
  );
}
