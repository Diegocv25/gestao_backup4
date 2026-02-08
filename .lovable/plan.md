
Objetivo
- Aplicar a Opção A: parar de enviar cookies cross-site no portal do cliente, removendo `credentials: "include"` do `fetch` central em `src/portal/portal-api.ts`, mantendo autenticação via `Authorization: Bearer <session_token>` armazenado em `sessionStorage`.
- Patch mínimo, sem mexer em CORS das edge functions e sem alterar regras multi-tenant.

Fatos verificados no código (prova)
1) `src/portal/portal-api.ts`
- O `fetch` central está em `portalPost()` e hoje usa credenciais:
  - Trecho (linhas 29–38):
    ```ts
    const resp = await fetch(`${BASE}/${path}`, {
      method: "POST",
      credentials: "include",
      headers: {
        apikey: SUPABASE_PUBLISHABLE_KEY,
        "Content-Type": "application/json",
        ...(sessionToken ? { Authorization: `Bearer ${sessionToken}` } : {}),
      },
      body: JSON.stringify(body ?? {}),
    });
    ```
- Ele envia `Authorization: Bearer <token>` quando há token:
  - `...(sessionToken ? { Authorization: \`Bearer ${sessionToken}\` } : {})`
- O token vem de `sessionStorage`, chave `portal:session_token`:
  - `getPortalSessionToken()` → `sessionStorage.getItem(STORAGE_KEY)`
  - `setPortalSessionToken()` → `sessionStorage.setItem(STORAGE_KEY, token)`

2) Endpoints usados no primeiro acesso e login
- Primeiro acesso (tela “Crie sua senha”):
  - `src/pages/ClientePortalPrimeiroAcesso.tsx` chama:
    - `portalRegister({ token, email, password, confirmPassword })`
  - Em `src/portal/portal-api.ts`, isso vai para:
    - `POST /functions/v1/portal-register`
- Login (tela “Entrar”):
  - `src/pages/ClientePortalEntrar.tsx` chama:
    - `portalLogin({ token, email, password })`
    - e, se vier `session_token`, salva em sessionStorage:
      ```ts
      if (resp.session_token) setPortalSessionToken(resp.session_token);
      ```
  - Em `src/portal/portal-api.ts`, isso vai para:
    - `POST /functions/v1/portal-login`
- Checagem de sessão (gate do portal):
  - `src/auth/PortalGate.tsx` chama:
    - `portalMe(token)`
  - Em `src/portal/portal-api.ts`, isso vai para:
    - `POST /functions/v1/portal-me`
  - Importante: `portalMe()` sempre usa `portalPost()`, portanto (após o patch) continuará mandando Bearer quando houver token no sessionStorage.

Patch mínimo proposto (somente 1 ponto)
- Arquivo: `src/portal/portal-api.ts`
- Alteração: remover a linha `credentials: "include",` do `fetch` em `portalPost()`.

Diff (patch mínimo)
```diff
diff --git a/src/portal/portal-api.ts b/src/portal/portal-api.ts
index 0000000..0000000 100644
--- a/src/portal/portal-api.ts
+++ b/src/portal/portal-api.ts
@@ -27,12 +27,11 @@ async function portalPost<T>(path: string, body: unknown): Promise<T> {
   const sessionToken = getPortalSessionToken();

   const resp = await fetch(`${BASE}/${path}`, {
     method: "POST",
-    credentials: "include",
     headers: {
       apikey: SUPABASE_PUBLISHABLE_KEY,
       "Content-Type": "application/json",
       ...(sessionToken ? { Authorization: `Bearer ${sessionToken}` } : {}),
     },
     body: JSON.stringify(body ?? {}),
   });
```

O que muda (comportamento)
- Antes: o browser tentava mandar/receber cookies (modo `credentials: include`) nas chamadas às edge functions. Se alguma resposta viesse com `Access-Control-Allow-Origin: *`, o browser bloqueava por CORS (preflight `OPTIONS` falha), resultando em “Failed to fetch”.
- Depois: as chamadas deixam de ser “credentialed requests” (sem cookies). Isso elimina o bloqueio específico “wildcard + include”.
- A autenticação do portal continua funcionando via:
  - `session_token` retornado no JSON por `portal-login` e `portal-register`
  - armazenado em `sessionStorage`
  - reenviado como `Authorization: Bearer <session_token>` pelo `portalPost()`.

Checklist de testes E2E (passo a passo)
Pré-condição recomendada
- Em uma aba anônima (para evitar cookies/storage antigos), abrir DevTools → Network (preservar logs).

1) Primeiro acesso (registro)
- Abrir: `/cliente/<token>/primeiro-acesso`
- Preencher email + senha + confirmar
- Esperado:
  - Network: `POST .../functions/v1/portal-register` retorna HTTP 200 (ou 4xx com JSON de erro, mas não “(blocked)/(canceled)”)
  - Sem erro de CORS no Console
  - App redireciona para `/cliente/<token>/entrar` (como já faz hoje)

2) Login
- Abrir: `/cliente/<token>/entrar`
- Logar com email/senha
- Esperado:
  - Network: `POST .../functions/v1/portal-login` retorna HTTP 200 (ou 4xx com JSON de erro controlado)
  - `session_token` vem no JSON e é salvo em `sessionStorage` (Application → Session Storage → chave `portal:session_token`)
  - Navega para `/cliente/<token>/app`

3) Sessão / Gate
- Ao entrar em `/app`, o `PortalGate` chama `portal-me`
- Esperado:
  - Network: `POST .../functions/v1/portal-me` retorna `ok: true, authenticated: true`
  - Request headers incluem `Authorization: Bearer <token>` (verificar em Network → Headers)

4) Cadastro de cliente (se aplicável)
- Se redirecionar para `/cadastro`, completar
- Esperado:
  - Chamada para `portal-cliente-upsert` (via `portalPost`) com Bearer funcionando
  - Sem “Failed to fetch”

5) Agendamentos (sanity check)
- Listar serviços / horários / criar e cancelar agendamento
- Esperado:
  - Endpoints `portal-servicos-list`, `portal-available-slots`, `portal-agendamento-create`, etc. funcionando com Bearer e sem bloqueio CORS.

Observações / Riscos (mantidos ao mínimo)
- Este patch não altera multi-tenant nem lógica de sessão no backend; apenas remove o envio de cookies do browser.
- Se alguma edge function depender exclusivamente de cookie `portal_session` (e não aceitar Bearer), ela passaria a falhar. Porém, pelo código que já vimos no `portal-me` (e pelo padrão do projeto), as functions suportam Bearer via `Authorization`/`x-portal-session`.

Arquivos impactados (para revisão rápida)
- Alterar: `src/portal/portal-api.ts` (1 linha removida)
- Garantir que permanece como está (sem alterações):
  - `src/pages/ClientePortalEntrar.tsx` (salva `session_token` em sessionStorage)
  - `src/pages/ClientePortalPrimeiroAcesso.tsx` (não faz auto-login; limpa token e volta ao login)
  - `src/auth/PortalGate.tsx` (continua chamando `portal-me`)
