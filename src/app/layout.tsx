import type { Metadata, Viewport } from "next";
import "./globals.css";
import { StoreProvider } from "@/lib/store";
import { BottomNav } from "@/components/BottomNav";

export const metadata: Metadata = {
  title: "Menus de la semaine",
  description:
    "Générateur de menus hebdomadaires : 14 repas équilibrés, variés et efficaces à préparer.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#2563eb",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="fr">
      <body>
        <StoreProvider>
          <div className="mx-auto flex min-h-screen max-w-md flex-col bg-slate-50">
            <main className="flex-1 px-4 pb-24 pt-4">{children}</main>
            <BottomNav />
          </div>
        </StoreProvider>
      </body>
    </html>
  );
}
