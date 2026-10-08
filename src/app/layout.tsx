import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono, Instrument_Serif } from "next/font/google";
import { DEFAULT_THEME, THEME_SCRIPT, THEMES } from "@/lib/appearance";
import "./globals.css";
import "./themes.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

/** Editorial display face: desktop titles only (Tailwind `font-display`). */
const instrumentSerif = Instrument_Serif({
  variable: "--font-instrument-serif",
  subsets: ["latin"],
  weight: "400",
  style: ["normal", "italic"],
});

export const metadata: Metadata = {
  title: "AURELIS",
  description: "Public data intelligence and visualization.",
};

/**
 * Mobile: draw under notches (safe-area insets are applied where needed) and
 * let the on-screen keyboard shrink the layout viewport (dvh), so the SMILEY
 * composer stays visible where browsers support it.
 */
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  interactiveWidget: "resizes-content",
  themeColor: "#04091b",
};

/**
 * Desktop theme: the server renders the default (Ember); the head script
 * applies a saved choice before the first paint. suppressHydrationWarning
 * covers exactly those two attributes, which the server cannot know.
 */
export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} ${instrumentSerif.variable} h-full antialiased`}
      data-theme={DEFAULT_THEME}
      data-tone={THEMES.find((t) => t.id === DEFAULT_THEME)?.tone}
      suppressHydrationWarning
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_SCRIPT }} />
      </head>
      <body className="h-full">{children}</body>
    </html>
  );
}
