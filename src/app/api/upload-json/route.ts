// PLANO B — endpoint que recebe NF-e JÁ PARSEADA em JSON (feito no navegador).
// Payload ~20x menor que XML, cabe MUITAS notas por request (200-500),
// respeitando os 4.5MB da Vercel sem esforço.
import { NextResponse } from "next/server";
import { contabilizarLote } from "@/lib/contabilizador";
import {
  garantirEmpresa,
  getEmpresaAtiva,
  usuarioAtual,
  empresasPermitidasIds,
  buscarEmpresaPorCnpjSemFiltro,
  vincularUsuarioEmpresa,
} from "@/lib/empresa";
import { crtParaRegime } from "@/lib/nfe-parser";
import type { NF } from "@/lib/nfe-parser";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 60;
export const preferredRegion = ["gru1"];

type Body = {
  cnpj?: string;
  nome?: string;
  regime?: string;
  anexo?: string;
  crt?: string | null;
  rbt12?: number | null;
  nfs: NF[];
};

export async function POST(req: Request) {
  try {
    const usuario = await usuarioAtual();
    if (!usuario) {
      return NextResponse.json({ ok: false, error: "Não autenticado." }, { status: 401 });
    }

    const body = (await req.json()) as Body;
    const nfs = Array.isArray(body?.nfs) ? body.nfs : [];
    if (nfs.length === 0) {
      return NextResponse.json({ ok: false, error: "Nenhuma nota enviada" }, { status: 400 });
    }
    const anexo = body.anexo ?? "I";
    const rbt12 = body.rbt12 ?? null;
    const cnpj = (body.cnpj ?? "").replace(/\D/g, "");

    let emp = await getEmpresaAtiva();

    if (cnpj) {
      // Sempre confere pelo CNPJ do lote, mesmo que já exista uma "empresa
      // ativa" na sessão — evita que um usuário importe notas de um CNPJ
      // diferente e elas caiam, por engano, na empresa que estava selecionada.
      const existentePorCnpj = await buscarEmpresaPorCnpjSemFiltro(cnpj);

      if (existentePorCnpj) {
        // O CNPJ já está cadastrado no sistema (pode ser de outro cliente,
        // de outro contador). O usuário PRECISA ter permissão nele.
        const permitidos = await empresasPermitidasIds(usuario);
        const temPermissao = permitidos === null || permitidos.includes(existentePorCnpj.id);

        if (!temPermissao) {
          return NextResponse.json(
            {
              ok: false,
              error:
                "Este CNPJ já está cadastrado no sistema, mas você não tem permissão para acessá-lo. Peça a um administrador para vincular seu usuário a este cliente.",
            },
            { status: 403 }
          );
        }
        emp = existentePorCnpj;
      } else {
        // CNPJ realmente novo: qualquer usuário logado pode trazer um
        // cliente novo para o sistema. Quem importa vira automaticamente
        // vinculado a esse cliente, sem precisar de um admin pra liberar.
        const nome = body.nome || "EMPRESA (nome nao identificado no XML)";
        const regime = body.regime || crtParaRegime(body.crt ?? null);
        emp = await garantirEmpresa({ cnpj, nome, regime, anexo_simples: anexo });
        if (!usuario.admin) {
          await vincularUsuarioEmpresa(usuario.id, emp.id);
        }
      }
    }

    if (!emp) {
      return NextResponse.json(
        {
          ok: false,
          error:
            "Nenhuma empresa selecionada e nenhum CNPJ foi detectado automaticamente nos XMLs. Selecione os arquivos novamente.",
        },
        { status: 400 }
      );
    }

    const regimeEmpresa = (emp.regime ?? "SIMPLES") as "SIMPLES" | "LUCRO_PRESUMIDO" | "LUCRO_REAL";
    const anexoEmpresa = emp.anexo_simples ?? anexo;

    const result = await contabilizarLote({
      empresa_id: emp.id,
      regime: regimeEmpresa,
      rbt12,
      anexo: anexoEmpresa,
      nfs,
    });

    const res = NextResponse.json({
      ok: true,
      empresa: { cnpj: emp.cnpj, nome: emp.nome, regime: regimeEmpresa },
      processadas: nfs.length,
      result,
    });

    // Marca a empresa que acabou de ser contabilizada como a "ativa" da
    // sessão. Sem isso, depois de importar um cliente NOVO, o sistema
    // continuava mostrando relatórios/análise de IA da empresa que estava
    // ativa antes (normalmente a mais antiga cadastrada), mesmo com os
    // dados corretos já gravados no banco para o cliente certo.
    res.cookies.set("empresa_ativa_id", String(emp.id), {
      httpOnly: true,
      secure: true,
      sameSite: "lax",
      path: "/",
      maxAge: 60 * 60 * 24 * 30,
    });

    return res;
  } catch (e) {
    console.error("upload-json error:", e);
    return NextResponse.json(
      { ok: false, error: (e as Error).message },
      { status: 500 }
    );
  }
}
