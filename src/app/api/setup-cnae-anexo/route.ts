import { NextResponse } from "next/server";
import { db } from "@/db";
import { sql } from "drizzle-orm";
import { cookies } from "next/headers";
import { verificarTokenSessao, ehAdmin } from "@/lib/auth";

// Rota de uso administrativo: cria (se não existir) e popula as tabelas
// de referência cnae_anexo e simples_faixas. Idempotente — pode rodar
// mais de uma vez sem duplicar dado (usa ON CONFLICT DO NOTHING).
export async function POST() {
  const cookieStore = await cookies();
  const token = cookieStore.get("sessao")?.value;
  const sessao = verificarTokenSessao(token);
  if (!sessao) {
    return NextResponse.json({ ok: false, mensagem: "Não autenticado." }, { status: 401 });
  }
  const admin = await ehAdmin(sessao.email);
  if (!admin) {
    return NextResponse.json(
      { ok: false, mensagem: "Apenas administradores podem rodar este setup." },
      { status: 403 }
    );
  }

  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS cnae_anexo (
      cnae            VARCHAR(10) PRIMARY KEY,
      descricao       TEXT,
      anexo_base      INTEGER NOT NULL CHECK (anexo_base IN (3, 4, 5)),
      permite_fator_r BOOLEAN DEFAULT false,
      created_at      TIMESTAMP DEFAULT NOW()
    )
  `);
  await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_cnae_anexo_anexo ON cnae_anexo(anexo_base)`);

  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS simples_faixas (
      anexo           INTEGER NOT NULL,
      faixa           INTEGER NOT NULL,
      receita_de      NUMERIC(15,2) NOT NULL,
      receita_ate     NUMERIC(15,2) NOT NULL,
      aliquota        NUMERIC(5,2) NOT NULL,
      parcela_deduzir NUMERIC(15,2) NOT NULL,
      PRIMARY KEY (anexo, faixa)
    )
  `);

  // ANEXO III
  const anexoIII: Array<[string, string]> = [
    ["3311200", "Manutenção e reparação de tanques, reservatórios metálicos e caldeiras"],
    ["3314707", "Manutenção e reparação de máquinas e equipamentos para uso geral"],
    ["3314714", "Manutenção e reparação de equipamentos de comunicação"],
    ["3314799", "Manutenção e reparação de outras máquinas e equipamentos"],
    ["3321000", "Instalação de máquinas e equipamentos industriais"],
    ["4329101", "Instalação de portas, janelas, tetos, divisórias e armários embutidos"],
    ["4399101", "Administração de obras"],
    ["6209100", "Suporte técnico, manutenção e outros serviços em tecnologia da informação"],
    ["6311900", "Tratamento de dados, provedores de serviços de aplicação e hospedagem na internet"],
    ["6319400", "Portais, provedores de conteúdo e outros serviços de informação na internet"],
    ["6619302", "Correspondentes de instituições financeiras"],
    ["6622300", "Corretores e agentes de seguros, de planos de previdência complementar e de saúde"],
    ["6821801", "Corretagem na compra e venda e avaliação de imóveis"],
    ["6821802", "Corretagem no aluguel de imóveis"],
    ["6920601", "Atividades de contabilidade"],
    ["6920602", "Atividades de consultoria e auditoria contábil e tributária"],
    ["7319002", "Promoção de vendas"],
    ["7319003", "Marketing direto"],
    ["7320300", "Pesquisas de mercado e de opinião pública"],
    ["7410201", "Design"],
    ["7420001", "Atividades de produção de fotografias, exceto aérea e submarina"],
    ["7490101", "Serviços de tradução, interpretação e similares"],
    ["7711000", "Locação de automóveis sem condutor"],
    ["7729201", "Aluguel de aparelhos de jogos eletrônicos"],
    ["7732201", "Aluguel de máquinas e equipamentos para construção sem operador"],
    ["7739099", "Aluguel de outras máquinas e equipamentos comerciais e industriais"],
    ["7810800", "Seleção e agenciamento de mão-de-obra"],
    ["7820500", "Locação de mão-de-obra temporária"],
    ["8011102", "Serviços de adestramento de cães de guarda"],
    ["8020001", "Atividades de monitoramento de sistemas de segurança eletrônico"],
    ["8111700", "Serviços combinados para apoio a edifícios"],
    ["8121400", "Limpeza em prédios e em domicílios"],
    ["8129000", "Atividades de limpeza não especificadas anteriormente"],
    ["8211300", "Serviços combinados de escritório e apoio administrativo"],
    ["8219901", "Fotocópias"],
    ["8220200", "Atividades de teleatendimento"],
    ["8230001", "Serviços de organização de feiras, congressos, exposições e festas"],
    ["8291100", "Atividades de cobrança e informações cadastrais"],
    ["8299701", "Medição de consumo de energia elétrica, gás e água"],
    ["8299799", "Outras atividades de serviços prestados principalmente às empresas"],
    ["8550301", "Administração de caixas escolares"],
    ["8599601", "Formação de condutores"],
    ["8599602", "Cursos de pilotagem"],
    ["8599603", "Treinamento em desenvolvimento profissional e gerencial"],
    ["8599699", "Outras atividades de ensino não especificadas anteriormente"],
    ["9602501", "Cabeleireiros, manicure e pedicure"],
    ["9602502", "Atividades de estética e outros serviços de cuidados com a beleza"],
    ["9609201", "Clínicas de estética e similares"],
    ["9609208", "Higiene e embelezamento de animais domésticos"],
    ["9609299", "Outras atividades de serviços pessoais não especificadas anteriormente"],
  ];

  // ANEXO IV
  const anexoIV: Array<[string, string]> = [
    ["4120400", "Construção de edifícios"],
    ["4211101", "Construção de rodovias e ferrovias"],
    ["4212000", "Construção de obras de arte especiais"],
    ["4221900", "Obras de urbanização - ruas, praças e calçadas"],
    ["4222701", "Construção de barragens e represas para geração de energia elétrica"],
    ["4291000", "Obras portuárias, de marinha e de construção de vias navegáveis"],
    ["4292801", "Montagem de estruturas metálicas"],
    ["4299501", "Obras de montagem industrial"],
    ["4299599", "Outras obras de engenharia civil não especificadas anteriormente"],
    ["4311801", "Demolição de edifícios e outras estruturas"],
    ["4312600", "Preparação de canteiro e limpeza de terreno"],
    ["4313400", "Obras de terraplenagem"],
    ["4319300", "Serviços de preparação do terreno não especificados anteriormente"],
    ["4321500", "Instalação e manutenção elétrica"],
    ["4322301", "Instalações hidráulicas, sanitárias e de gás"],
    ["4322302", "Instalação e manutenção de sistemas centrais de ar condicionado, ventilação e refrigeração"],
    ["4322303", "Instalações de sistema de prevenção contra incêndio"],
    ["4329102", "Instalação de elevadores, escadas e esteiras rolantes"],
    ["4329103", "Montagem e instalação de sistemas e equipamentos de iluminação e sinalização"],
    ["4329104", "Tratamento e revestimento em metais"],
    ["4329105", "Obras de acabamento em gesso e estuque"],
    ["4330401", "Impermeabilização em obras de engenharia civil"],
    ["4330404", "Serviços de pintura de edifícios em geral"],
    ["4330405", "Aplicação de revestimentos e de resinas em interiores e exteriores"],
    ["4330499", "Outras obras de acabamento da construção"],
    ["4391600", "Obras de fundações"],
    ["4399102", "Montagem e desmontagem de andaimes e outras estruturas temporárias"],
    ["4399103", "Obras de alvenaria"],
    ["4399104", "Serviços de operação e fornecimento de equipamentos para transporte e elevação"],
    ["4399105", "Perfuração e sondagem"],
    ["4399199", "Serviços especializados para construção não especificados anteriormente"],
    ["6911701", "Serviços advocatícios"],
    ["8011101", "Atividades de vigilância e segurança privada"],
    ["8012900", "Atividades de transporte de valores"],
    ["8130300", "Atividades paisagísticas"],
  ];

  // ANEXO V (sujeitos a Fator R)
  const anexoV: Array<[string, string]> = [
    ["6201501", "Desenvolvimento de programas de computador sob encomenda"],
    ["6201502", "Web design"],
    ["6202300", "Desenvolvimento e licenciamento de programas de computador customizáveis"],
    ["6203100", "Desenvolvimento e licenciamento de programas de computador não-customizáveis"],
    ["6204000", "Consultoria em tecnologia da informação"],
    ["7020400", "Atividades de consultoria em gestão empresarial"],
    ["7111100", "Serviços de arquitetura"],
    ["7112000", "Serviços de engenharia"],
    ["7119701", "Serviços de cartografia, topografia e geodésia"],
    ["7119702", "Atividades de estudos geológicos"],
    ["7119703", "Serviços de desenho técnico relacionados à arquitetura e engenharia"],
    ["7119704", "Serviços de perícia técnica relacionados à segurança do trabalho"],
    ["7119799", "Atividades técnicas relacionadas à engenharia e arquitetura não especificadas"],
    ["7120100", "Testes e análises técnicas"],
    ["7210000", "Pesquisa e desenvolvimento experimental em ciências físicas e naturais"],
    ["7220000", "Pesquisa e desenvolvimento experimental em ciências sociais e humanas"],
    ["7311400", "Agências de publicidade"],
    ["7319001", "Consultoria em publicidade"],
    ["7410202", "Design de interiores"],
    ["7410203", "Design de produto"],
    ["7490104", "Atividades de intermediação e agenciamento de serviços e negócios em geral"],
    ["7490199", "Outras atividades profissionais, científicas e técnicas não especificadas"],
    ["7500100", "Atividades veterinárias"],
    ["8541400", "Educação profissional de nível técnico"],
    ["8542200", "Educação profissional de nível tecnológico"],
    ["8550302", "Atividades de apoio à educação, exceto caixas escolares"],
    ["8610101", "Atividades de atendimento hospitalar, exceto pronto-socorro"],
    ["8610102", "Atividades de atendimento em pronto-socorro e unidades hospitalares"],
    ["8630501", "Atividade médica ambulatorial com recursos para procedimentos cirúrgicos"],
    ["8630502", "Atividade médica ambulatorial com recursos para exames complementares"],
    ["8630503", "Atividade médica ambulatorial restrita a consultas"],
    ["8630504", "Atividade odontológica"],
    ["8630506", "Serviços de vacinação e imunização humana"],
    ["8630507", "Atividades de fisioterapia"],
    ["8630508", "Atividades de terapia de nutrição humana"],
    ["8630509", "Atividades de psicologia e psicanálise"],
    ["8630511", "Serviços de diálise"],
    ["8630512", "Serviços de diagnóstico e tratamento por imagem"],
    ["8630513", "Serviços de diagnóstico por métodos ópticos"],
    ["8630514", "Serviços de diagnóstico por métodos radiológicos"],
    ["8630517", "Atividades de profissionais da área de saúde, exceto médicos e odontólogos"],
    ["8630518", "Atividades de fonoaudiologia"],
    ["8630519", "Atividades de terapia ocupacional"],
    ["8630520", "Atividades de clínica de nutrição"],
    ["8640201", "Laboratórios de anatomia patológica e citológica"],
    ["8640202", "Laboratórios clínicos"],
    ["8640203", "Serviços de diálise e nefrologia"],
    ["8640204", "Serviços de tomografia"],
    ["8640205", "Serviços de diagnóstico por imagem com uso de radiação ionizante"],
    ["8640206", "Serviços de ressonância magnética"],
    ["8640207", "Serviços de diagnóstico por imagem sem uso de radiação ionizante"],
    ["8640211", "Serviços de radioterapia"],
    ["8640212", "Serviços de quimioterapia"],
    ["8640213", "Serviços de hemoterapia"],
    ["8640214", "Serviços de litotripsia"],
  ];

  let inseridos = 0;
  for (const [cnae, descricao] of anexoIII) {
    await db.execute(sql`
      INSERT INTO cnae_anexo (cnae, descricao, anexo_base, permite_fator_r)
      VALUES (${cnae}, ${descricao}, 3, false)
      ON CONFLICT (cnae) DO NOTHING
    `);
    inseridos++;
  }
  for (const [cnae, descricao] of anexoIV) {
    await db.execute(sql`
      INSERT INTO cnae_anexo (cnae, descricao, anexo_base, permite_fator_r)
      VALUES (${cnae}, ${descricao}, 4, false)
      ON CONFLICT (cnae) DO NOTHING
    `);
    inseridos++;
  }
  for (const [cnae, descricao] of anexoV) {
    await db.execute(sql`
      INSERT INTO cnae_anexo (cnae, descricao, anexo_base, permite_fator_r)
      VALUES (${cnae}, ${descricao}, 5, true)
      ON CONFLICT (cnae) DO NOTHING
    `);
    inseridos++;
  }

  const faixas: Array<[number, number, number, number, number, number]> = [
    [1, 1, 0, 180000, 4.0, 0],
    [1, 2, 180000.01, 360000, 7.3, 5940],
    [1, 3, 360000.01, 720000, 9.5, 13860],
    [1, 4, 720000.01, 1800000, 10.7, 22500],
    [1, 5, 1800000.01, 3600000, 14.3, 87300],
    [1, 6, 3600000.01, 4800000, 19.0, 378000],
    [2, 1, 0, 180000, 4.5, 0],
    [2, 2, 180000.01, 360000, 7.8, 5940],
    [2, 3, 360000.01, 720000, 10.0, 13860],
    [2, 4, 720000.01, 1800000, 11.2, 22500],
    [2, 5, 1800000.01, 3600000, 14.7, 85500],
    [2, 6, 3600000.01, 4800000, 30.0, 720000],
    [3, 1, 0, 180000, 6.0, 0],
    [3, 2, 180000.01, 360000, 11.2, 9360],
    [3, 3, 360000.01, 720000, 13.5, 17640],
    [3, 4, 720000.01, 1800000, 16.0, 35640],
    [3, 5, 1800000.01, 3600000, 21.0, 125640],
    [3, 6, 3600000.01, 4800000, 33.0, 648000],
    [4, 1, 0, 180000, 4.5, 0],
    [4, 2, 180000.01, 360000, 9.0, 8100],
    [4, 3, 360000.01, 720000, 10.2, 12420],
    [4, 4, 720000.01, 1800000, 14.0, 39780],
    [4, 5, 1800000.01, 3600000, 22.0, 183780],
    [4, 6, 3600000.01, 4800000, 33.0, 828000],
    [5, 1, 0, 180000, 15.5, 0],
    [5, 2, 180000.01, 360000, 18.0, 4500],
    [5, 3, 360000.01, 720000, 19.5, 9900],
    [5, 4, 720000.01, 1800000, 20.5, 17100],
    [5, 5, 1800000.01, 3600000, 23.0, 62100],
    [5, 6, 3600000.01, 4800000, 30.5, 540000],
  ];

  for (const [anexo, faixa, de, ate, aliq, parcela] of faixas) {
    await db.execute(sql`
      INSERT INTO simples_faixas (anexo, faixa, receita_de, receita_ate, aliquota, parcela_deduzir)
      VALUES (${anexo}, ${faixa}, ${de}, ${ate}, ${aliq}, ${parcela})
      ON CONFLICT (anexo, faixa) DO NOTHING
    `);
  }

  const contagem = await db.execute<{ total: string }>(sql`SELECT COUNT(*)::text AS total FROM cnae_anexo`);

  return NextResponse.json({
    ok: true,
    mensagem: "Tabelas cnae_anexo e simples_faixas criadas e populadas.",
    cnaes_no_banco: Number(contagem.rows[0]?.total ?? 0),
    faixas_inseridas: faixas.length,
  });
}
