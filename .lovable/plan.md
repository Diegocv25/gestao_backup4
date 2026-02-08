
## Evidências coletadas (somente leitura)

### 1) Onde exatamente `portal-login` e `portal-register` retornam **401** (no código)

#### `supabase/functions/portal-login/index.ts`
Há **dois** guards explícitos que retornam `401`:

1) Conta não encontrada para (salao_id + email_normalized)
```ts
if (!acc) return json(req, { ok: false, error: "cadastro necessário" }, { status: 401 });
```
Razão: não existe `portal_accounts` para aquele salão + email.

2) Senha inválida
```ts
if (!okPass) return json(req, { ok: false, error: "senha inválida" }, { status: 401 });
```
Razão: `verifyPassword()` falhou.

Observação: os demais erros desse arquivo retornam 400 (inputs/link inválido) ou 500 (exceptions).

#### `supabase/functions/portal-register/index.ts`
**Não existe nenhum `return ... { status: 401 }`** nesse arquivo.

Os retornos são:
- 400 (token/email/senha inválidos; senhas não conferem; link inválido)
- 409 (`conta já existe`)
- 500 (exception)

Trechos exemplo:
```ts
if (existing) return json(req, { ok: false, error: "conta já existe" }, { status: 409 });
...
return json(req, { ok: true });
```

✅ Conclusão baseada em evidência: se você está vendo **HTTP 401** em `portal-register`, esse 401 **não nasce do código do arquivo** que está versionado aqui — ele vem de fora da lógica (gateway/config do Supabase) **ou** o deploy que está rodando no Supabase **não corresponde** a este código.

---

### 2) O que o frontend envia nessas chamadas (body + headers), por evidência do código

#### Cliente HTTP central: `src/portal/portal-api.ts`
O `fetch` central é `portalPost()`:

Headers **sempre enviados**:
```ts
headers: {
  apikey: SUPABASE_PUBLISHABLE_KEY,
  "Content-Type": "application/json",
  ...(sessionToken ? { Authorization: `Bearer ${sessionToken}` } : {}),
},
```

Body:
```ts
body: JSON.stringify(body ?? {}),
```

Token do portal:
- Lido do `sessionStorage`:
```ts
const STORAGE_KEY = "portal:session_token";
sessionStorage.getItem(STORAGE_KEY);
```
- Salvo/removido no `sessionStorage`:
```ts
sessionStorage.setItem(STORAGE_KEY, token);
sessionStorage.removeItem(STORAGE_KEY);
```

✅ Importante: quando **não existe** `session_token` ainda (primeiro acesso / login inicial), **NÃO** é enviado header `Authorization`. Apenas `apikey` + `Content-Type`.

#### Tela de login: `src/pages/ClientePortalEntrar.tsx`
Chama:
```ts
portalLogin({ token: tokenValue, email, password });
```

E salva token se vier:
```ts
if (resp.session_token) setPortalSessionToken(resp.session_token);
```

Body enviado para a function (via `portalPost`):
```json
{ "token": "<tokenValue>", "email": "<email>", "password": "<password>" }
```

Headers (sem token ainda):
- `apikey: <SUPABASE_PUBLISHABLE_KEY>`
- `Content-Type: application/json`
- sem `Authorization`

#### Tela primeiro acesso: `src/pages/ClientePortalPrimeiroAcesso.tsx`
Chama:
```ts
portalRegister({ token: tokenValue, email, password, confirmPassword });
```

Body enviado:
```json
{ "token": "<tokenValue>", "email": "<email>", "password": "<password>", "confirmPassword": "<confirmPassword>" }
```

Headers (sem token ainda):
- `apikey: <SUPABASE_PUBLISHABLE_KEY>`
- `Content-Type: application/json`
- sem `Authorization`

---

### 3) Variáveis/secrets exigidos pelas functions e o que acontece se faltarem

#### `portal-login` / `portal-register` / `portal-me` / `portal-cliente-upsert`
Todas usam `getServiceClient()`:

```ts
const url = Deno.env.get("SUPABASE_URL");
const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
if (!url || !serviceKey) throw new Error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
```

Se faltarem:
- cai no `catch` e responde **500** (não 401), por exemplo em `portal-register`:
```ts
return json(req, { ok: false, error: String(e?.message ?? e) }, { status: 500 });
```

✅ Logo: o 401 atual **não é** por ausência de `SUPABASE_SERVICE_ROLE_KEY` / `SUPABASE_URL` (isso daria 500, por evidência).

Outros secrets citados (RESEND_API_KEY etc.) não aparecem nesses arquivos e não são necessários para login/register/me/upsert conforme o código lido.

---

### 4) Arquivos relevantes do Portal do Cliente + fluxo (por evidência do repo)

#### Frontend (Portal)
- `src/portal/portal-api.ts` (HTTP client central; sessionStorage; chamadas às functions)
- `src/pages/ClientePortalEntrar.tsx` (login)
- `src/pages/ClientePortalPrimeiroAcesso.tsx` (criar senha; register)
- `src/auth/PortalGate.tsx` (gate pós-login; chama `portal-me`) **(a revisar no próximo passo se necessário, mas o endpoint está em `portal-api.ts`)**
- `src/pages/ClientePortalCadastro.tsx` (provável vínculo/registro do cliente no salão) **(não lido ainda nesta rodada, mas faz parte do fluxo)**
- `src/pages/ClientePortalApp.tsx` (shell do portal autenticado)
- Páginas de agendamento:
  - `src/pages/ClientePortalNovoAgendamento.tsx`
  - `src/pages/ClientePortalMeusAgendamentos.tsx`
  - `src/pages/ClientePortalAgendamentoForm.tsx`
  - `src/pages/ClientePortalResetarSenha.tsx`, `ClientePortalEsqueciSenha.tsx` (recuperação)

#### Edge Functions (Portal)
- `supabase/functions/portal-register/index.ts`
- `supabase/functions/portal-login/index.ts`
- `supabase/functions/portal-me/index.ts`
- `supabase/functions/portal-cliente-upsert/index.ts`
- Agendamentos:
  - `portal-servicos-list`
  - `portal-profissionais-by-servico`
  - `portal-profissional-dias`
  - `portal-available-slots`
  - `portal-agendamento-create`
  - `portal-agendamento-get`
  - `portal-agendamento-update`
  - `portal-agendamento-cancel`
  - `portal-agendamentos-list`
- Config:
  - `supabase/config.toml` (todas as functions do portal com `verify_jwt = false`)

#### Fluxo (alto nível, conforme o código)
1) Primeiro acesso (criar senha)
- Página `ClientePortalPrimeiroAcesso.tsx` → `portalRegister(...)` → function `portal-register`
- A function cria `portal_accounts` e **não** autentica automaticamente: `return { ok: true }`

2) Login
- Página `ClientePortalEntrar.tsx` → `portalLogin(...)` → function `portal-login`
- A function valida password, cria sessão em `portal_sessions` e retorna:
  ```ts
  return json(req, { ok: true, session_token: sessionToken }, { headers: { "Set-Cookie": ... } });
  ```
- Frontend salva `session_token` no `sessionStorage`

3) Gate / sessão
- `PortalGate` → chama `portalMe(token)` → function `portal-me`
- `portal-me` lê token via header `Authorization: Bearer <portal_session_token>` (ou cookie `portal_session`) e valida em `portal_sessions`
- Se ok, retorna `authenticated: true` + `cliente` (ou null)

4) Vínculo / cadastro no salão
- Frontend chama `portal-cliente-upsert` (exige sessão válida):
  - `portal-cliente-upsert` tem guard de sessão:
    ```ts
    if (!sessionToken) return { ok: false, status: 401, error: "unauthorized" };
    ```

5) Agendamentos
- Chamadas seguintes usam o mesmo esquema: body com `{ token: <token do salão> ... }` e autenticação via sessão (Bearer/cookie).

---

## Diagnóstico final (baseado em evidências do código + sintomas)

Você está vendo **401 no portal-register e portal-login** depois de remover `credentials: include`.

Pelo código do repo:
- `portal-login` pode retornar 401 por “cadastro necessário” ou “senha inválida”.
- `portal-register` **não retorna 401** em hipótese nenhuma.

Então, para ambos darem 401 “no gateway” (antes da lógica), o cenário mais compatível com os fatos é:

### Causa raiz mais provável (e mínima) para 401 em ambos
**O gateway do Supabase está rejeitando as chamadas por “autorização mínima insuficiente”** (apikey/Authorization anon), antes da função rodar.

Mesmo enviando `apikey`, na prática o gateway costuma aceitar também (ou exigir, dependendo do ambiente/proxy/config) `Authorization: Bearer <anon_key>` em requests sem sessão.

No seu frontend hoje:
- quando não existe `portal:session_token`, ele manda `apikey`, mas **não manda `Authorization`**.

Isso combina com sua suspeita e explica:
- 401 em login/register (primeiras chamadas “sem sessão”)
- e o fato de `portal-register` não ter 401 no código (logo 401 vem de fora)

Também é compatível com o histórico de “respostas com CORS `*`”: isso sugere divergência de deploy/config no Supabase em relação ao código do repo, reforçando que o gateway pode estar aplicando regras diferentes.

---

## Ajuste mínimo necessário para parar o 401 (ainda sem executar)

### Mudança mínima (1 ponto, no frontend)
Em `src/portal/portal-api.ts`, no `portalPost()`:

- Quando **não houver** `sessionToken` no sessionStorage, enviar também:
  - `Authorization: Bearer <SUPABASE_PUBLISHABLE_KEY>` (anon key)

- Quando houver `sessionToken`, manter:
  - `Authorization: Bearer <sessionToken>` (como já é hoje)

Em pseudo-diff (descrição):
- Hoje:
  - `Authorization` só existe se `sessionToken` existe
- Proposto:
  - `Authorization` sempre existe:
    - se `sessionToken` existe → `Bearer <sessionToken>`
    - senão → `Bearer <anonKey>`

Isso é o menor ajuste que:
- não mexe em CORS das functions
- não mexe em multi-tenant
- mantém o fluxo de produto (Opções 1/2/3) intacto
- atende o requisito do gateway, se ele estiver exigindo `Authorization` além de `apikey`.

### Observação importante (por causa do backend atual)
As functions do portal reutilizam `Authorization: Bearer ...` como “portal session token” quando existe. Para login/register sem sessão, mandar Bearer anon key pode fazer a function “achar” que existe um “prevToken” e tentar revogar (em `portal-login`), mas isso é best-effort e não deve quebrar; ainda assim, é bom registrar isso como efeito colateral esperado (revoga hash que não existe).

---

## Plano de implementação (quando você autorizar voltar a editar)
1) Ajustar `src/portal/portal-api.ts` para sempre enviar `Authorization`:
   - `Bearer sessionToken` quando existir
   - `Bearer SUPABASE_PUBLISHABLE_KEY` quando não existir

2) Re-testar E2E:
   - `/cliente/<token>/primeiro-acesso` → `portal-register` deve responder 200/400/409 (não 401)
   - `/cliente/<token>/entrar` → `portal-login` deve responder 200 ou 401 “cadastro necessário/senha inválida” (agora sim vindo da função, não do gateway)
   - após login: `portal-me` deve autenticar com Bearer sessionToken
   - `portal-cliente-upsert` deve funcionar com 200/409/400, e 401 apenas se sessão ausente/expirada

3) Se (e só se) ainda houver 401 em `portal-register` mesmo com `Authorization: Bearer <anon>`:
   - Aí a evidência passa a apontar fortemente para divergência de deploy no Supabase (function diferente) ou apikey inválida/rotacionada.
   - Próximo passo objetivo seria comparar a Response body/headers do 401 (gateway geralmente retorna JSON padrão de “Unauthorized” sem o payload `{ ok: false, error: ... }` da sua função). Isso diferencia “gateway 401” vs “401 do código”.

