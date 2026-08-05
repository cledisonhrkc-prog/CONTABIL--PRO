"use client";

export default function Topbar({ cnpj, nome }: { cnpj?: string; nome?: string }) {
  return (
    <header className="bg-white border-b border-slate-200 h-14 flex items-center justify-between px-6 sticky top-0 z-10">
      <div className="flex-1 max-w-xl">
        <input
          type="text"
          placeholder="Pesquisar no sistema..."
          className="w-full px-3 py-1.5 border border-slate-200 rounded-md text-sm bg-slate-50 focus:outline-none focus:ring-2 focus:ring-indigo-500"
        />
      </div>
      <div className="flex items-center gap-4 text-sm">
        <button className="text-slate-600 hover:text-indigo-600">🔔</button>
        <button className="text-slate-600 hover:text-indigo-600">📊</button>
        <div className="border-l border-slate-200 pl-4 flex items-center gap-2">
          <div className="text-right">
            <div className="text-xs text-slate-500">CNPJ</div>
            <div className="text-sm font-medium text-slate-700">{cnpj ?? "—"}</div>
          </div>
          <div className="w-8 h-8 rounded-full bg-gradient-to-br from-indigo-500 to-purple-500 flex items-center justify-center text-white text-xs font-bold">
            {(nome ?? "PM").substring(0, 2).toUpperCase()}
          </div>
        </div>
      </div>
    </header>
  );
}
