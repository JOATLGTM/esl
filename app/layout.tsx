import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import { es } from "@/lib/copy/es";
import "./globals.css";

// One family. A learner on mobile data should not spend any of it on a second
// typeface, and `swap` means text is readable before the font arrives.
const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  title: { default: es.app.name, template: `%s · ${es.app.name}` },
  description: es.app.description,
  applicationName: es.app.name,
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  // Not `maximumScale: 1`. Pinch-zoom is an accessibility feature and locking
  // it is a common, careless way to shut people out.
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#fdfbf7" },
    { media: "(prefers-color-scheme: dark)", color: "#15120f" },
  ],
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  // `lang="es"` is not cosmetic: it tells a screen reader to pronounce this
  // page in Spanish. The whole interface is Spanish until the Block 6 taper.
  return (
    <html lang="es" className={`${inter.variable} h-full`}>
      <body className="flex min-h-full flex-col">{children}</body>
    </html>
  );
}
