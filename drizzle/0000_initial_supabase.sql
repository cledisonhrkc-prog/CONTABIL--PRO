CREATE TABLE "apuracao_impostos" (
	"id" serial PRIMARY KEY NOT NULL,
	"empresa_id" integer NOT NULL,
	"periodo" varchar(10) NOT NULL,
	"imposto" varchar(20) NOT NULL,
	"debito" numeric(18, 2) DEFAULT '0',
	"credito" numeric(18, 2) DEFAULT '0',
	"apurado" numeric(18, 2) DEFAULT '0',
	"a_pagar" numeric(18, 2) DEFAULT '0'
);
--> statement-breakpoint
CREATE TABLE "auditoria" (
	"id" serial PRIMARY KEY NOT NULL,
	"empresa_id" integer NOT NULL,
	"id_nf" integer,
	"numero_nf" varchar(20),
	"regra" varchar(20),
	"tipo" varchar(20),
	"ncm" varchar(15),
	"cst_pis" varchar(4),
	"cst_cof" varchar(4),
	"descricao" text,
	"valor_nota" numeric(18, 2) DEFAULT '0',
	"valor_credito" numeric(18, 2) DEFAULT '0',
	"regime" varchar(20),
	"acao" text
);
--> statement-breakpoint
CREATE TABLE "bancos" (
	"id" serial PRIMARY KEY NOT NULL,
	"empresa_id" integer NOT NULL,
	"nome" text NOT NULL,
	"agencia" varchar(20),
	"conta" varchar(30),
	"saldo" numeric(18, 2) DEFAULT '0'
);
--> statement-breakpoint
CREATE TABLE "contas_pagar" (
	"id" serial PRIMARY KEY NOT NULL,
	"empresa_id" integer NOT NULL,
	"id_nf" integer,
	"participante" text,
	"emissao" date,
	"vencimento" date,
	"valor" numeric(18, 2) DEFAULT '0',
	"status" varchar(20) DEFAULT 'ABERTO'
);
--> statement-breakpoint
CREATE TABLE "contas_receber" (
	"id" serial PRIMARY KEY NOT NULL,
	"empresa_id" integer NOT NULL,
	"id_nf" integer,
	"participante" text,
	"emissao" date,
	"vencimento" date,
	"valor" numeric(18, 2) DEFAULT '0',
	"status" varchar(20) DEFAULT 'ABERTO'
);
--> statement-breakpoint
CREATE TABLE "empresas" (
	"id" serial PRIMARY KEY NOT NULL,
	"cnpj" varchar(20) NOT NULL,
	"nome" text NOT NULL,
	"regime" varchar(20) DEFAULT 'SIMPLES' NOT NULL,
	"anexo_simples" varchar(4) DEFAULT 'I',
	"segmento" varchar(40) DEFAULT 'COMERCIO',
	"rbt12" numeric(18, 2) DEFAULT '0',
	"cmv_percent" numeric(6, 4) DEFAULT '0.6000',
	"created_at" timestamp DEFAULT now(),
	CONSTRAINT "empresas_cnpj_unique" UNIQUE("cnpj")
);
--> statement-breakpoint
CREATE TABLE "exercicios" (
	"id" serial PRIMARY KEY NOT NULL,
	"empresa_id" integer NOT NULL,
	"ano" integer NOT NULL,
	"status" varchar(20) DEFAULT 'ABERTO',
	"resultado" numeric(18, 2) DEFAULT '0'
);
--> statement-breakpoint
CREATE TABLE "itens_nf" (
	"id" serial PRIMARY KEY NOT NULL,
	"id_nf" integer NOT NULL,
	"cprod" varchar(40),
	"xprod" text,
	"ncm" varchar(15),
	"cfop" varchar(8),
	"quantidade" numeric(18, 4) DEFAULT '0',
	"valor_unitario" numeric(18, 6) DEFAULT '0',
	"valor_total" numeric(18, 2) DEFAULT '0',
	"cst_pis" varchar(4),
	"cst_cof" varchar(4)
);
--> statement-breakpoint
CREATE TABLE "lancamento_itens" (
	"id" serial PRIMARY KEY NOT NULL,
	"id_lanc" integer NOT NULL,
	"codigo_conta" varchar(20) NOT NULL,
	"debito" numeric(18, 2) DEFAULT '0',
	"credito" numeric(18, 2) DEFAULT '0'
);
--> statement-breakpoint
CREATE TABLE "lancamentos" (
	"id" serial PRIMARY KEY NOT NULL,
	"empresa_id" integer NOT NULL,
	"numero" varchar(20) NOT NULL,
	"data" date NOT NULL,
	"competencia" date NOT NULL,
	"exercicio" integer NOT NULL,
	"historico" text,
	"id_nf" integer,
	"origem" varchar(20) DEFAULT 'FISCAL',
	"tipo_lanc" varchar(20) DEFAULT 'NORMAL',
	"valor_total" numeric(18, 2) DEFAULT '0',
	CONSTRAINT "lancamentos_numero_unique" UNIQUE("numero")
);
--> statement-breakpoint
CREATE TABLE "notas_fiscais" (
	"id" serial PRIMARY KEY NOT NULL,
	"empresa_id" integer NOT NULL,
	"chave" varchar(60),
	"numero" varchar(20),
	"serie" varchar(10),
	"modelo" varchar(5),
	"tipo_operacao" varchar(10),
	"finalidade" varchar(15),
	"data_emissao" date,
	"participante" text,
	"cnpj_part" varchar(20),
	"valor_produtos" numeric(18, 2) DEFAULT '0',
	"valor_frete" numeric(18, 2) DEFAULT '0',
	"valor_seguro" numeric(18, 2) DEFAULT '0',
	"valor_desconto" numeric(18, 2) DEFAULT '0',
	"valor_outras" numeric(18, 2) DEFAULT '0',
	"valor_total" numeric(18, 2) DEFAULT '0',
	"valor_icms" numeric(18, 2) DEFAULT '0',
	"valor_icms_st" numeric(18, 2) DEFAULT '0',
	"valor_ipi" numeric(18, 2) DEFAULT '0',
	"valor_pis" numeric(18, 2) DEFAULT '0',
	"valor_cofins" numeric(18, 2) DEFAULT '0',
	"valor_iss" numeric(18, 2) DEFAULT '0',
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "plano_contas" (
	"codigo" varchar(20) PRIMARY KEY NOT NULL,
	"descricao" text NOT NULL,
	"tipo" varchar(32) NOT NULL,
	"natureza" varchar(12) NOT NULL,
	"nivel" integer NOT NULL,
	"conta_pai" varchar(20)
);
