import type { Metadata } from "next";
// Nunito auto-hospedada con @fontsource (no depende de Google Fonts en
// tiempo de build, evita fallas de red y es más rápida para el usuario).
import "@fontsource/nunito/400.css";
import "@fontsource/nunito/500.css";
import "@fontsource/nunito/700.css";
import "@fontsource/nunito/800.css";
import "./globals.css";

export const metadata: Metadata = {
  title: "Plantilla de cliente VONN",
  description: "Plantilla base clonable para los clientes de VONN.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="es" className="h-full antialiased">
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
