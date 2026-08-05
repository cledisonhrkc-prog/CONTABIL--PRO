# 🚀 Deploy do SIGC Contábil Pro — Supabase + Vercel

Guia passo-a-passo. Tempo estimado: **10 minutos**.

---

## 1️⃣ SUPABASE — Criar o banco (2 min)

1. Entre em https://supabase.com/dashboard e clique **"New project"**
2. Escolha:
   - **Name**: `sigc-contabil-pro`
   - **Database Password**: gere uma senha forte (**guarde**, você vai usar)
   - **Region**: `São Paulo (sa-east-1)` (menor latência para Brasil)
3. Aguarde ~2 min o projeto subir
4. Vá em **Project Settings → Database → Connection string → URI → Transaction pooler (6543)**
5. Copie a URL. Ela tem esse formato:
   ```
   postgresql://postgres.abcxyz123:SUASENHA@aws-0-sa-east-1.pooler.supabase.com:6543/postgres
   ```

## 2️⃣ SUPABASE — Aplicar o schema (1 min)

**Opção A (mais fácil) — SQL Editor do Supabase:**
1. Abra o **SQL Editor** no menu lateral do Supabase
2. Clique em **"New query"**
3. Copie **todo o conteúdo** do arquivo `drizzle/0000_initial_supabase.sql` deste projeto
4. Cole e clique em **"Run"**
5. Vai criar as 12 tabelas + índices numa vez só

**Opção B (via CLI local):**
```bash
# No seu computador, dentro da pasta do projeto:
echo 'DATABASE_URL=postgresql://postgres.abcxyz:SUASENHA@aws-0-sa-east-1.pooler.supabase.com:6543/postgres' > .env
npx drizzle-kit push
```

## 3️⃣ GITHUB — Publicar o código (2 min)

```bash
# Se ainda não é um repo git:
git init
git add .
git commit -m "SIGC Contábil Pro — sistema inicial com Reforma 2027"

# Crie um repo em https://github.com/new (privado ou público)
git remote add origin https://github.com/SEU_USUARIO/sigc-contabil-pro.git
git branch -M main
git push -u origin main
```

## 4️⃣ VERCEL — Deploy (3 min)

1. Entre em https://vercel.com/new
2. **Import Git Repository** → selecione seu repo do GitHub
3. **Framework Preset**: Next.js (detectado automaticamente)
4. **Environment Variables** — adicione **UMA** variável:
   - Nome: `DATABASE_URL`
   - Valor: a URL do Supabase que você copiou no passo 1 (pooler 6543)
5. Clique em **"Deploy"**
6. Aguarde ~2 min o build terminar

## 5️⃣ TESTAR (1 min)

1. Abra a URL que o Vercel te dará (ex.: `https://sigc-contabil-pro.vercel.app`)
2. Vá em **"Importar XML"** no menu
3. Clique em **"Gerar 1000 NF-e Fictícias"** para popular o sistema
4. Aguarde ~2 segundos
5. Explore: Dashboard, Balancete, DRE, Reforma 2027, Auditoria R08, Excel/Word/PDF

---

## 🔧 Ajustes recomendados no Supabase

### Habilitar Row Level Security (opcional, para multi-tenant real)
Se você for atender múltiplos contadores, ative RLS em todas as tabelas e amarre por `empresa_id`. Por padrão o sistema já filtra por `empresa_id` em todas as queries.

### Backup automático
Supabase faz backup diário no plano Free. No plano Pro, backup contínuo (Point-in-Time Recovery).

### Índices recomendados (rodar no SQL Editor após primeira carga)
```sql
CREATE INDEX IF NOT EXISTS idx_nf_empresa_data ON notas_fiscais(empresa_id, data_emissao);
CREATE INDEX IF NOT EXISTS idx_lanc_empresa_comp ON lancamentos(empresa_id, competencia);
CREATE INDEX IF NOT EXISTS idx_lanc_itens_lanc ON lancamento_itens(id_lanc);
CREATE INDEX IF NOT EXISTS idx_lanc_itens_conta ON lancamento_itens(codigo_conta);
CREATE INDEX IF NOT EXISTS idx_audit_empresa ON auditoria(empresa_id);
```

---

## ❗ Erros comuns

**"Error: DATABASE_URL is required"**
→ Você esqueceu de configurar a variável no Vercel. Vá em **Project Settings → Environment Variables** e adicione.

**"connection refused" ou "ECONNREFUSED"**
→ Você usou a URL da porta 5432 no Vercel. Troque para **6543 (Transaction Pooler)**, obrigatório em serverless.

**"password authentication failed"**
→ Senha errada. Vá em **Supabase → Settings → Database → Reset database password** e gere de novo.

**"SSL/TLS required"**
→ Já está tratado no código (`src/db/index.ts` detecta Supabase e ativa SSL automaticamente).

---

## 📞 Suporte

- Repositório: seu GitHub
- Supabase dashboard: https://supabase.com/dashboard/projects
- Vercel dashboard: https://vercel.com/dashboard
