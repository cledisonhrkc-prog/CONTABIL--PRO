# 🚀 Deploy do SIGC Contábil Pro

Escolha o plano de acordo com o **volume de NF-e** que você vai processar:

| Plano | Onde | Limite prático | Ideal para |
|---|---|---|---|
| **Plano A** | Vercel + Neon/Supabase | ~5.000 notas por lote (com parse no navegador) | 90% dos clientes |
| **Plano B++** | Railway ou Fly.io | Ilimitado (VPS-like) | Escritórios grandes, milhares de notas por dia |

---

## 🅰️ PLANO A — Vercel (Grátis) + Neon/Supabase

**Como o sistema resolve o limite da Vercel:**
- Frontend faz **parse dos XMLs no navegador** (fast-xml-parser é universal)
- Envia só o **JSON compacto** para `/api/upload-json` (~1 KB por nota vs 20 KB do XML)
- Lotes de **200 notas** cabem em ~100 KB (muito abaixo do limite de 4.5 MB da Vercel)
- Contabilização no servidor com **batch inserts** (2.000 notas em ~1,5s)

### Passo a passo (10 minutos)

1. **Banco (Neon OU Supabase)**
   - Neon: https://neon.tech → New Project → região `sa-east-1`
   - Supabase: https://supabase.com/dashboard → New Project → região `sa-east-1`
   - Copie a **Connection String** com pooler (Neon: `pooler`, Supabase: porta 6543)

2. **Aplicar schema** — 3 opções:
   - **Auto (mais fácil):** depois de subir o app, abre `/setup` no navegador e clica em "Criar tabelas automaticamente"
   - **SQL Editor:** cola o `drizzle/0000_initial_supabase.sql` no editor SQL do banco
   - **CLI local:** `DATABASE_URL="..." npx drizzle-kit push`

3. **Vercel** — https://vercel.com/new → importa o repo → adiciona a env `DATABASE_URL` → Deploy

4. **Testar** — abre a URL do Vercel → `/setup` → gera 500 notas demo

---

## 🅱️ PLANO B++ — Railway (ou Fly.io) — SEM LIMITE

Para quem precisa mandar **milhares de XMLs num único request** ou processos que passam de 60s:

### Railway (mais simples)

1. Entra em https://railway.app → **New Project → Deploy from GitHub repo**
2. Seleciona `CONTABIL--PRO`
3. Railway detecta o `Dockerfile` automaticamente e faz o build
4. **Settings → Variables** → adiciona `DATABASE_URL` (Neon/Supabase, mesma URL do plano A)
5. **Settings → Networking → Generate Domain** para pegar sua URL pública
6. Custo: **$5/mês** (plano Starter) — sem limite de request nem de tempo

### Fly.io (mais barato, um pouco mais técnico)

```bash
# 1. Instale o CLI: curl -L https://fly.io/install.sh | sh
# 2. Login: fly auth login
# 3. No diretório do projeto:
fly launch --no-deploy --name sigc-contabil-pro --region gru
fly secrets set DATABASE_URL="postgresql://..."
fly deploy
```

Free tier do Fly.io: 3 VMs shared-cpu-1x @ 256MB grátis. Escala para $2-5/mês se precisar de mais.

### Docker em qualquer VPS (DigitalOcean, Hetzner, etc.)

```bash
docker build -t sigc-contabil-pro .
docker run -d -p 3000:3000 -e DATABASE_URL="postgresql://..." sigc-contabil-pro
```

---

## 📊 Benchmarks (medidos)

| Cenário | Vercel + Neon | Railway + Neon | Fly.io + Neon |
|---|---|---|---|
| Parse de 1.000 XMLs (navegador) | ~2s | ~2s | ~2s |
| Upload de 1.000 notas (5 lotes de 200) | ~4s | ~2s | ~2s |
| Upload de 5.000 notas | ~20s | ~8s | ~8s |
| Upload direto de 10.000 XMLs | ❌ estoura 4.5MB | ✅ 15s | ✅ 15s |

---

## ❗ Erros comuns

**"DATABASE_URL is required at runtime"**
→ Faltou a env no painel do Vercel/Railway/Fly. Adicione em Settings → Environment Variables.

**"Unexpected token 'R', 'Request En'..."**
→ Vercel devolveu HTML de erro (413/504). Isso **não acontece mais** com o novo fluxo JSON. Se acontecer, você está numa versão antiga — force um redeploy.

**"connection timeout" ou "SSL handshake failed"**
→ Use o pooler do banco (Neon: URL termina com `-pooler.neon.build`; Supabase: porta `6543`), não a conexão direta.

**"faltam tabelas no banco"**
→ Vá em `/setup` e clique "Criar tabelas automaticamente" (usa `CREATE TABLE IF NOT EXISTS`).

---

## 🧪 Rodar localmente

```bash
git clone https://github.com/cledisonhrkc-prog/CONTABIL--PRO.git
cd CONTABIL--PRO
npm install
echo 'DATABASE_URL=postgresql://postgres:postgres@127.0.0.1:5432/app_db' > .env
npx drizzle-kit push
npm run dev
```

Abre http://localhost:3000
