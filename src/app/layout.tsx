import type { Metadata } from "next";
import type { ReactNode } from "react";
import "./globals.css";

export const metadata: Metadata = {
  title: "SIGC Contábil Pro — Sistema Contábil Completo",
  description: "Contabilização de NF-e, apuração de impostos, relatórios e auditoria fiscal.",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="pt-BR">
      <body className="bg-slate-50 text-slate-900 antialiased">{children}</body>
    </html>
  );
}
