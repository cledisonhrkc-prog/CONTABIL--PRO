"use client";

import { useState, useEffect, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { ArrowLeft, Upload } from "lucide-react";
import Link from "next/link";
import { formatCurrency, formatDate } from "@/lib/format";

function ImportarContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const contaId = searchParams.get("conta");

  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<
    { data: string; descricao: string; valor: number; tipo: "CREDITO" | "DEBITO" }[]
  >([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  function parseCSV(text: string) {
    const lines = text.trim().split("\n");
    const result: typeof preview = [];
    // Formato esperado simples: data;descricao;valor  (ou data,descricao,valor)
    // Valor positivo = crÃ©dito, negativo = dÃ©bito
    for (let i = 1; i < lines.length; i++) {
      const parts = lines[i].split(/[;,]/).map((p) => p.trim().replace(/"/g, ""));
      if (parts.length < 3) continue;
      const dataRaw = parts[0];
      const descricao = parts[1];
      let valor = parseFloat(parts[2].replace(/\./g, "").replace(",", "."));
      if (isNaN(valor)) continue;

      // Tenta normalizar data dd/mm/yyyy ou yyyy-mm-dd
      let data = dataRaw;
      if (dataRaw.includes("/")) {
        const [d, m, y] = dataRaw.split("/");
        data = `${y}-${m.padStart(2, "0")}-${d.padStart(2, "0")}`;
      }

      result.push({
        data,
        descricao,
        valor: Math.abs(valor),
        tipo: valor >= 0 ? "CREDITO" : "DEBITO",
      });
    }
    return result;
  }

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;
    setFile(f);
    setError("");
    setSuccess("");

    const text = await f.text();

    if (f.name.toLowerCase().endsWith(".ofx") || text.includes("<OFX>")) {
      // Parser OFX simplificado (para produÃ§Ã£o use biblioteca ofx-js)
      const transactions: typeof preview = [];
      const stmtTrnRegex = /<STMTTRN>([\s\S]*?)<\/STMTTRN>/gi;
      let match;
      while ((match = stmtTrnRegex.exec(text)) !== null) {
        const block = match[1];
        const dt = block.match(/<DTPOSTED>(\d{8})/)?.[1];
        const amount = block.match(/<TRNAMT>([-\d.]+)/)?.[1];
        const memo = block.match(/<MEMO>([^<]+)/)?.[1] || block.match(/<NAME>([^<]+)/)?.[1] || "TransaÃ§Ã£o OFX";
        if (dt && amount) {
          const data = `${dt.slice(0, 4)}-${dt.slice(4, 6)}-${dt.slice(6, 8)}`;
          const valor = parseFloat(amount);
          transactions.push({
            data,
            descricao: memo.trim(),
            valor: Math.abs(valor),
            tipo: valor >= 0 ? "CREDITO" : "DEBITO",
          });
        }
      }
      setPreview(transactions);
    } else {
      setPreview(parseCSV(text));
    }
  }

  async function handleImport() {
    if (!contaId || preview.length === 0) return;
    setSaving(true);
    setError("");
    setSuccess("");

    try {
      const res = await fetch("/api/financeiro/conciliacao/importar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contaBancariaId: Number(contaId),
          linhas: preview,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Erro na importaÃ§Ã£o");

      setSuccess(
        `Importados ${data.inseridos} de ${data.totalLinhas} registros com sucesso.`
      );
      setPreview([]);
      setFile(null);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-6 p-6 max-w-4xl mx-auto">
      <div className="flex items-center gap-4">
        <Button asChild variant="ghost" size="icon">
          <Link href="/financeiro/conciliacao">
            <ArrowLeft className="h-5 w-5" />
          </Link>
        </Button>
        <div>
          <h1 className="text-2xl font-bold">Importar Extrato</h1>
          <p className="text-muted-foreground">
            Conta ID: {contaId} â€¢ Formatos: CSV ou OFX
          </p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Arquivo de Extrato</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>Selecione o arquivo (CSV ou OFX)</Label>
            <Input type="file" accept=".csv,.ofx,.txt" onChange={handleFile} />
            <p className="text-xs text-muted-foreground">
              CSV esperado: data;descriÃ§Ã£o;valor (valor negativo = dÃ©bito). 
              OFX Ã© lido automaticamente.
            </p>
          </div>

          {error && (
            <div className="rounded-md bg-red-50 p-3 text-sm text-red-700">{error}</div>
          )}
          {success && (
            <div className="rounded-md bg-green-50 p-3 text-sm text-green-700">{success}</div>
          )}

          {preview.length > 0 && (
            <>
              <div className="text-sm font-medium">
                PrÃ©-visualizaÃ§Ã£o ({preview.length} linhas)
              </div>
              <div className="max-h-80 overflow-auto border rounded-md">
                <table className="w-full text-sm">
                  <thead className="bg-muted sticky top-0">
                    <tr>
                      <th className="p-2 text-left">Data</th>
                      <th className="p-2 text-left">DescriÃ§Ã£o</th>
                      <th className="p-2 text-right">Valor</th>
                      <th className="p-2 text-left">Tipo</th>
                    </tr>
                  </thead>
                  <tbody>
                    {preview.slice(0, 50).map((l, i) => (
                      <tr key={i} className="border-t">
                        <td className="p-2">{formatDate(l.data)}</td>
                        <td className="p-2 max-w-[300px] truncate">{l.descricao}</td>
                        <td className="p-2 text-right">{formatCurrency(l.valor)}</td>
                        <td className="p-2">
                          <span
                            className={
                              l.tipo === "CREDITO" ? "text-green-600" : "text-red-600"
                            }
                          >
                            {l.tipo}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {preview.length > 50 && (
                  <p className="p-2 text-xs text-muted-foreground">
                    Mostrando 50 de {preview.length} linhas
                  </p>
                )}
              </div>

              <Button onClick={handleImport} disabled={saving} className="w-full">
                <Upload className="mr-2 h-4 w-4" />
                {saving ? "Importando..." : `Importar ${preview.length} registros`}
              </Button>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

export default function ImportarExtratoPage() {
  return (
    <Suspense fallback={<div className="p-6">Carregando...</div>}>
      <ImportarContent />
    </Suspense>
  );
}
