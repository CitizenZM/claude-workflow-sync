import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Feishu Bot Management Dashboard",
  description: "Daily monitoring panel for Feishu bot operations",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="h-full">
      <body className="min-h-full bg-gray-950 antialiased">{children}</body>
    </html>
  );
}
