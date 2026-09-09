import type { Metadata } from "next";
import type { ReactNode } from "react";

import "./globals.css";

export const metadata: Metadata = {
  title: "LaundroStat — Clean-O-Meter & Dorm Wars",
  description:
    "Check your Clean-O-Meter, find a Wash Mate, and explore Dorm Wars. A sign-in-free synthetic student project, not affiliated with Purdue.",
};

export default function RootLayout({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
