import type { Metadata } from "next";
import { headers } from "next/headers";
import "./globals.css";

export async function generateMetadata(): Promise<Metadata> {
  const requestHeaders = await headers();
  const host = requestHeaders.get("x-forwarded-host") ?? requestHeaders.get("host") ?? "localhost:3000";
  const protocol = requestHeaders.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
  const siteUrl = new URL(`${protocol}://${host}`);
  const title = "Paddle Up — Your AI pickleball practice coach";
  const description = "Automatic rep detection, mechanics ratings, focused coaching, and progress tracking for pickleball practice.";

  return {
    metadataBase: siteUrl,
    title,
    description,
    openGraph: {
      title,
      description,
      type: "website",
      url: siteUrl,
      images: [{ url: "/og-paddle-up.jpg", width: 1200, height: 628, alt: "Paddle Up — Practice with purpose." }],
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: ["/og-paddle-up.jpg"],
    },
  };
}

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
