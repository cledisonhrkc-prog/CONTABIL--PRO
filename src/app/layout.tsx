import type { Metadata } from "next";
import type { ReactNode } from "react";
import "./globals.css";
import { Geist } from "next/font/google";
import { cn } from "@/lib/utils";

const geist = Geist({subsets:['latin'],variable:'--font-sans'});

export const metadata: Metadata = {
  title: "SIGC Contábil Pro — Sistema Contábil Completo",
  description: "Contabilização de NF-e, apuração de impostos, relatórios e auditoria fiscal.",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="pt-BR" className={cn("font-sans", geist.variable)}>
      <body className="bg-slate-50 text-slate-900 antialiased">{children}</body>
    </html>
  );
}
