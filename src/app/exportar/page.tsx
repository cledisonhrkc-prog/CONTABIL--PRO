import AppLayout from "@/components/AppLayout";

export default function ExportarPage() {
  const opts = [
    { titulo: "📄 Parecer Técnico (PDF Sênior)", href: "/api/exportar/pdf", cor: "bg-red-700" },
    { titulo: "📗 Excel Completo (todas planilhas)", href: "/api/exportar/excel", cor: "bg-emerald-600" },
    { titulo: "📘 Parecer Técnico (Word)", href: "/api/exportar/word", cor: "bg-blue-700" },
  ];
  return (
    <AppLayout>
      <h1 className="text-2xl font-bold text-slate-800 mb-4">Exportar / SPED</h1>
      <p className="text-sm text-slate-500 mb-6">
        Baixe os relatórios completos em Excel ou o parecer técnico contábil-fiscal em Word.
      </p>
      <div className="grid md:grid-cols-2 gap-4">
        {opts.map((o) => (
          <a
            key={o.href}
            href={o.href}
            className={`${o.cor} text-white rounded-lg p-6 flex items-center justify-between hover:opacity-90`}
          >
            <span className="font-semibold text-lg">{o.titulo}</span>
            <span className="text-2xl">⬇️</span>
          </a>
        ))}
      </div>
      <div className="mt-8 bg-amber-50 border border-amber-200 rounded-lg p-5 text-sm text-amber-900">
        <b>Importante:</b> Este sistema é uma camada de conferência/apoio contábil. A transmissão oficial de SPED ECD, EFD ICMS/IPI, EFD Contribuições, DCTF, PGDAS-D, DEFIS, ECF é responsabilidade da contabilidade credenciada da empresa.
      </div>
    </AppLayout>
  );
}
