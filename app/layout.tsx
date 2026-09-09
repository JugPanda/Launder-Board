import type { Metadata } from "next";
import type { ReactNode } from "react";

import "./globals.css";

export const metadata: Metadata = {
  title: "LaundroStat — weekly laundry challenge",
  description:
    "A Purdue West Lafayette-focused student hackathon project: voluntary weekly laundry participation without rewarding extra loads. Not affiliated with Purdue.",
};

export default function RootLayout({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
