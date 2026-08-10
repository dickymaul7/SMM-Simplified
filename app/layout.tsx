import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "SMM StoryBrief Lite",
  description: "Case-led AI storytelling brief generator for B2B social media.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="id">
      <body>{children}</body>
    </html>
  );
}
