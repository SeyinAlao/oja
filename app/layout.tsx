import type { Metadata, Viewport } from "next";
import { DM_Sans, Fraunces } from "next/font/google";
import "./globals.css";

const fraunces = Fraunces({ subsets: ["latin"], variable: "--font-fraunces", display: "swap" });
const dmSans = DM_Sans({ subsets: ["latin"], variable: "--font-dm-sans", display: "swap" });

const TITLE = "Oja: listings that sell, in your voice";
const DESCRIPTION =
  "Upload product photos and get ready-to-post Instagram and WhatsApp copy in Clear English, Naija Pidgin or Yoruba-flavoured English. Powered by open-weight AI.";
const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://oja-ng.tech";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: TITLE,
  description: DESCRIPTION,
  applicationName: "Oja",
  openGraph: {
    type: "website",
    siteName: "Oja",
    title: TITLE,
    description: DESCRIPTION,
    url: "/",
    locale: "en_NG",
    images: [{ url: "/og.png", width: 1200, height: 630, alt: "Oja: Snap it. We write it. You sell it." }],
  },
  twitter: {
    card: "summary_large_image",
    title: TITLE,
    description: DESCRIPTION,
    images: ["/og.png"],
  },
};

export const viewport: Viewport = {
  themeColor: "#0f3d2e",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${fraunces.variable} ${dmSans.variable}`}>
      <body>{children}</body>
    </html>
  );
}
