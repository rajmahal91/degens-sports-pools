import type { ReactNode } from "react";
import "./globals.css";

export const metadata = {
  title: "Degens Sports Pools",
  description: "Survivor, Pick'em, playoff fantasy, brackets, prizes and live draws.",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
