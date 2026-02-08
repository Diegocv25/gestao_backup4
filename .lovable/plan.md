
## Concordo/Discordo (com base no código)

- Concordo com o diagnóstico central: **o 401 observado no Network do `portal-me` não nasce do código da function**, porque `portal-me/index.ts` só retorna `400/500` e `200` com `authenticated: true/false`. Então é **rejeição do gateway** antes de executar a Edge Function.
- Concordo com a hipótese do gateway: **o Supabase gateway espera um Bearer “Supabase-style”** (anon JWT / user JWT). Quando você manda `Authorization: Bearer <portal_session_token>` (token custom), ele rejeita com **401**.
- **Discordo parcialmente** do plano “frontend-only” como foi escrito: hoje, **todas as Edge Functions do portal têm um helper `getBearer()` que prioriza `Authorization: Bearer ...` e só usa `x-portal-session` como fallback**.  
  Ou seja: se o frontend mandar `Authorization: Bearer <anon>` sempre, **o backend vai ler `<anon>` como sessionToken** e **vai ignorar o `x-portal-session`** (porque retorna no primeiro `if`). Isso faria o portal “parecer deslogado” (ou sem sessão) mesmo sem 401.

➡️ Portanto, para a estratégia “Authorization fixo com anon + sessão em x-portal-session” funcionar, precisa de **um patch mínimo também nas Edge Functions** (não é “robustez inútil”; é essencial para que `x-portal-session` passe a ter prioridade).

---

## 1) Somente leitura/diagnóstico (evidências já confirmadas no código)

### 1.1 Frontend: onde decide o Authorization e como chama `portal-me`
**Arquivo:** `src/portal/portal-api.ts`  
Hoje (após seu último diff), `portalPost()` monta:
- `apikey: SUPABASE_PUBLISHABLE_KEY` (sempre)
- `Authorization: Bearer ${sessionToken ?? SUPABASE_PUBLISHABLE_KEY}` (sempre)

Isso explica o runtime:
- Após login, existe sessionToken ⇒ **Authorization vira Bearer <session_token custom>** ⇒ gateway rejeita ⇒ **401** antes da function rodar.

**Arquivo:** `src/auth/PortalGate.tsx`  
`portal-me` é chamado assim:
```ts
queryFn: async () => portalMe(tokenValue)
```
e `portalMe()` faz `portalPost("portal-me", { token })`.

### 1.2 Backend: por que `x-portal-session` hoje não resolve sozinho
**Arquivo:** `supabase/functions/portal-me/index.ts`  
Helper atual:
```ts
function getBearer(req: Request) {
  const auth = req.headers.get("authorization") ?? "";
  if (auth.toLowerCase().startsWith("bearer ")) return auth.slice(7).trim();
  const x = req.headers.get("x-portal-session") ?? "";
  return x.trim() || null;
}
```

➡️ Se o frontend mandar `Authorization: Bearer <anon>`, `getBearer()` vai retornar `<anon>` e **não vai ler `x-portal-session`**.

O mesmo padrão aparece em `portal-login`, `portal-register`, `portal-cliente-upsert`, `portal-agendamentos-list`, etc. (duplicado em vários arquivos).

---

## 2) Solução mínima e eficaz (separar Auth do Gateway vs Sessão do Portal)

### Objetivo
- **Gateway:** sempre satisfeito com `apikey` + `Authorization: Bearer <anon>`.
- **Sessão do portal:** enviada em header separado `x-portal-session: <portal_session_token>` quando existir.
- **Backend:** deve **priorizar** `x-portal-session` sobre `Authorization` para autenticação do portal.

Isso mantém 100% das regras de produto (Opções 1/2/3) no backend; só evita bloqueio do gateway.

---

## 3) Patch mínimo proposto (com diffs exatos) — NÃO aplicar ainda

### 3.1 Frontend (1 ponto): `src/portal/portal-api.ts`
**Motivo:** impedir gateway 401 ao nunca mais mandar Bearer custom no `Authorization`.

**Diff (exato, conceitual):**
```diff
 async function portalPost<T>(path: string, body: unknown): Promise<T> {
   const sessionToken = getPortalSessionToken();

   const resp = await fetch(`${BASE}/${path}`, {
     method: "POST",
     headers: {
       apikey: SUPABASE_PUBLISHABLE_KEY,
       "Content-Type": "application/json",
-      // Sempre envie Authorization para satisfazer o gateway do Supabase.
-      // - Com sessão: Bearer <portal_session_token>
-      // - Sem sessão (primeiro acesso/login): Bearer <anon_key>
-      Authorization: `Bearer ${sessionToken ?? SUPABASE_PUBLISHABLE_KEY}`,
+      // Gateway do Supabase: sempre use Bearer anon (JWT do Supabase).
+      Authorization: `Bearer ${SUPABASE_PUBLISHABLE_KEY}`,
+      // Sessão custom do Portal: vai em header separado (quando existir).
+      ...(sessionToken ? { "x-portal-session": sessionToken } : {}),
     },
     body: JSON.stringify(body ?? {}),
   });
```

**Por que isso resolve o 401 observado (evidência runtime):**
- Hoje, seu runtime prova: “`apikey` presente e `Authorization` ausente → 401 no gateway”; vocês corrigiram para enviar `Authorization`.
- Agora o problema mudou: “`Authorization: Bearer <session_token custom>` → 401 no gateway”.  
  Este diff elimina isso porque **o `Authorization` volta a ser sempre o anon JWT**, que o gateway aceita.

### 3.2 Backend (mínimo necessário): priorizar `x-portal-session` no `getBearer()`
**Motivo:** com o frontend acima, o backend precisa pegar a sessão pelo header `x-portal-session` (porque `Authorization` será sempre anon).

**Patch mínimo (em cada Edge Function do portal que usa sessão):**

#### Exemplo diff exato em `supabase/functions/portal-me/index.ts`
```diff
 function getBearer(req: Request) {
-  const auth = req.headers.get("authorization") ?? "";
-  if (auth.toLowerCase().startsWith("bearer ")) return auth.slice(7).trim();
   const x = req.headers.get("x-portal-session") ?? "";
-  return x.trim() || null;
+  const xToken = x.trim();
+  if (xToken) return xToken;
+
+  const auth = req.headers.get("authorization") ?? "";
+  if (auth.toLowerCase().startsWith("bearer ")) return auth.slice(7).trim();
+  return null;
 }
```

**Por que isso não mexe em produto/multi-tenant:**
- Só muda **a forma de leitura do token** (prioridade do header).
- Toda a lógica de vínculo, isolamento por `salao_id` (“REGRA DE OURO”), expiração, revogação e cadastro continua igual.

#### Onde aplicar esse patch (lista objetiva)
Para não corrigir só o `portal-me` e quebrar o resto após login, aplicar o mesmo diff em todas as functions do portal que usam `getBearer()` para sessão:

- `supabase/functions/portal-me/index.ts`
- `supabase/functions/portal-logout/index.ts` (se tiver sessão)
- `supabase/functions/portal-cliente-upsert/index.ts`
- `supabase/functions/portal-servicos-list/index.ts`
- `supabase/functions/portal-agendamentos-list/index.ts`
- `supabase/functions/portal-profissionais-by-servico/index.ts`
- `supabase/functions/portal-profissional-dias/index.ts`
- `supabase/functions/portal-available-slots/index.ts`
- `supabase/functions/portal-agendamento-create/index.ts`
- `supabase/functions/portal-agendamento-get/index.ts`
- `supabase/functions/portal-agendamento-update/index.ts`
- `supabase/functions/portal-agendamento-cancel/index.ts`

Observação: `portal-login` e `portal-register` também têm `getBearer()` (para revogar cookie anterior / etc.). É seguro aplicar também para consistência, mas **não é estritamente necessário** para resolver o 401 do `portal-me`. Eu incluiria por padronização e para evitar surpresas.

---

## 4) Sequência de validação (E2E) após implementar

### 4.1 Validar gateway (Network)
Para `portal-register`, `portal-login`, `portal-me`:
- Request deve ter:
  - `apikey: <anon>`
  - `Authorization: Bearer <anon>` (constante)
  - `x-portal-session: <session_token>` **somente depois do login**
- Resposta esperada:
  - `portal-register`: 200/400/409 (não 401)
  - `portal-login`: 200 ou 401 **do código** (“cadastro necessário/senha inválida”), não do gateway
  - `portal-me`: 200 com `{ ok:true, authenticated:true|false }` (não 401)

### 4.2 Se ainda houver 401 (plano de contingência com evidência)
Se `portal-me` continuar 401 mesmo com `Authorization: Bearer <anon>`:
- evidência passa a apontar para:
  1) **anon key errada/rotacionada** (publishable key desatualizada), ou
  2) **projeto Supabase diferente** do que o preview está chamando, ou
  3) alguma policy/gateway config fora do repo.
- Ação: comparar o **response body** do 401:
  - 401 do gateway tende a ser payload “genérico Unauthorized”
  - 401 do seu código (em `portal-login`) tende a vir com `{ ok:false, error:"..." }` e CORS headers custom.
- Aí o próximo passo seria alinhar a key/URL com o projeto correto (sem mexer em lógica).

---

## 5) Observações operacionais (Lovable ↔ Supabase)
- Frontend: alteração no Lovable resolve imediatamente no preview.
- Edge Functions: eu altero os arquivos no Lovable para versionar; **o Diego copia/cola manualmente a mesma mudança no Supabase** (porque runtime real está lá).

---

## Confirmação sobre “patch inútil”
Você está certo em evitar patch “aceitar Authorization cru” (não resolve gateway).  
Mas aqui o patch no backend **não é robustez aleatória**: ele é o ajuste mínimo indispensável para que a estratégia `x-portal-session` funcione, já que hoje o código dá prioridade ao `Authorization`.

Se aprovar, eu implemento:
1) `src/portal/portal-api.ts` (Authorization sempre anon + x-portal-session)
2) Atualização consistente de `getBearer()` em todas as portal functions listadas
