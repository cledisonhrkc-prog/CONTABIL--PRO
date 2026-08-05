import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // pdfkit e exceljs precisam ser tratados como externos no servidor
  // (dependências nativas / fontes .afm embutidas)
  serverExternalPackages: ["pdfkit", "exceljs"],
};

export default nextConfig;
