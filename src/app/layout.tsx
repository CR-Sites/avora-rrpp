import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "AVORA — Electronic Music Community & Access",
  description:
    "Comunidad privada, accesos prioritarios y preventas oficiales para eventos de música electrónica.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  themeColor: "#07070A",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es" className="dark">
      <body className="min-h-screen bg-avora-bg text-zinc-100 selection:bg-violet-500/30 selection:text-violet-200">
        {children}
      </body>
    </html>
  );
}
