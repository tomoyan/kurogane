import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "JPY Price Tool",
  description: "AI-powered product info extractor and JPY pricing calculator",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
