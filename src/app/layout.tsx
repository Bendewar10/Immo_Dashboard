import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Bambi",
  description: "Personal Network OS – Beziehungspflege ohne Vergessen",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="antialiased">
        {children}
      </body>
    </html>
  );
}
