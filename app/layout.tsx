import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "WebLander AI — Website studio",
  description: "Turn your business brief into a landing page concept with WebLander AI.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
