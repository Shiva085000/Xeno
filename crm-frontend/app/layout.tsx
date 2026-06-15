import type { Metadata } from "next";
import "./globals.css";
import Navbar from "@/components/Navbar";

export const metadata: Metadata = {
  title: "CampaignMind — LOOM Fashion CRM",
  description: "AI-native CRM for LOOM Premium Indian Fashion",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning className="dark">
      <head>
        <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Geist:wght@500&display=swap" rel="stylesheet"/>
        <link href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:wght,FILL@100..700,0..1&display=swap" rel="stylesheet"/>
      </head>
      <body className="font-body-md text-body-md bg-background text-on-surface antialiased overflow-x-hidden">
        <Navbar />
        <main className="lg:ml-[280px] pt-24 pb-32 px-4 lg:px-margin-safe min-h-screen relative overflow-hidden">{children}</main>
      </body>
    </html>
  );
}
