import type { Metadata } from "next";
import "../styles/globals.css";

export const metadata: Metadata = {
  title: "Gargantua Blackhole - Interstellar",
  description: "A simulation of the Gargantua Blackhole in Interstellar",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
