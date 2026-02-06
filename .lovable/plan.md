# Plano de implementação — Portal do Cliente + Isolamento do Backoffice

## Estado atual (com base no código)
- As Edge Functions do Portal (portal-login, portal-register, portal-me, portal-logout, portal-password-reset-*) já existem e o **RESEND_API_KEY** já está configurado.
- Porém, o frontend ainda está usando Supabase Auth (supabase.auth.*) + AuthGate para proteger rotas do portal.
- Não existe ainda no frontend um “PortalGate” que consulte `portal-me` (cookie) e nem telas/rotas próprias do Portal para login/cadastro/reset que chamem as Edge Functions.
- Além disso, do jeito que as Edge Functions estão hoje, cookies cross-site podem não funcionar de forma confiável (CORS com `Access-Control-Allow-Origin="*"`, sem `Allow-Credentials`, e cookie `SameSite=Lax`). Isso pode impedir o browser de gravar/enviar o cookie `portal_session` para o domínio `*.supabase.co` quando o app roda em `*.lovable.app`.

## ✅ Implementado (Backoffice / Segurança)
1) **Clientes não acessam o backoffice**
- Criado `src/auth/BackofficeGate.tsx` e aplicado nas rotas internas do backoffice.
- Se `role === "customer"`, o usuário é redirecionado para `/auth`.

2) **Configurações restritas para funcionários não-admin**
- Em `src/pages/Configuracoes.tsx`, qualquer role diferente de `admin` (exceto `null` em onboarding) visualiza **apenas o card “Segurança”** (troca de senha).
- Demais cards (Dados do estabelecimento / Horários / Avisos semanais) ficam ocultos.

3) **Remoção do card “Acesso (RBAC)”**
- O card de gestão de acesso (criar admins pela interface) foi removido para evitar replicação de administradores.

## Conclusão direta
- O isolamento do backoffice está ajustado (clientes bloqueados; funcionários não-admin com acesso apenas à troca de senha em Configurações).
- **Ainda não está 100% pronto para teste do portal com login próprio** (sem Supabase Auth), pois falta integração do frontend + ajustes de CORS/cookies (ou fallback por token via header).

## O que falta implementar (sequência recomendada)

### 1) Decidir/ajustar a estratégia de sessão (para ficar testável no navegador)

**Opção A — manter cookie httpOnly (preferida se funcionar no seu público-alvo)**
- Ajustar CORS nas funções do portal para:
  - `Access-Control-Allow-Origin`: usar o domínio exato do app (preview e publicado), não `"*"`
  - `Access-Control-Allow-Credentials: "true"`
  - `Access-Control-Allow-Headers` incluindo os headers usados (`apikey`, `content-type`, etc.)
- Ajustar `Set-Cookie` nas funções:
  - `SameSite=None` (para permitir cookie em requisições cross-site via fetch)
  - `Secure` mantido
- No frontend, todas as chamadas para as functions devem usar `credentials: "include"`.

**Opção B — fallback robusto (recomendado se Safari/iOS bloquear cookie third-party)**
- Alterar as functions para também aceitarem um token via header (ex: `Authorization: Bearer <token>` ou `x-portal-session`).
- No login/register, retornar o token no body e o frontend guarda em memória/sessionStorage e manda no header.
- `portal-me` valida via header ao invés de cookie.

**Por que isso é crítico**
- Sem esses ajustes, o “login parece funcionar” mas o `portal-me` retorna `authenticated:false`, porque o cookie não grava ou não volta.

### 2) Criar um “PortalAuth API client” no frontend
- Criar helpers do tipo:
  - `portalLogin(token, email, password)`
  - `portalRegister(token, email, password, confirmPassword)`
  - `portalMe(token)`
  - `portalLogout()`
  - `portalPasswordResetRequest(token, email)`
  - `portalPasswordResetConfirm(token, code, password, confirmPassword)`
- Implementar via `fetch` para `https://<project>.supabase.co/functions/v1/<function>`
- Incluir headers: `apikey` (anon/public key), `content-type` e `credentials` (se usar cookie).

### 3) Implementar `PortalGate` (proteção das rotas do Portal do Cliente)
- Substituir o uso de `<AuthGate />` nas rotas `/cliente/:token/*` por um `<PortalGate />` específico.
- `PortalGate` deve:
  - Ler token da URL
  - Chamar `portal-me(token)`
  - Se `authenticated:true` → renderiza `<Outlet />`
  - Se `authenticated:false` → redireciona para `/cliente/:token/entrar`
  - Se token inválido → mostrar “link inválido”

### 4) Criar as páginas/rotas do Portal para login/cadastro/reset
Rotas sugeridas:
- `/cliente/:token` (landing)
- `/cliente/:token/entrar` (login)
- `/cliente/:token/primeiro-acesso` (cadastro)
- `/cliente/:token/esqueci` (solicitar reset)
- `/cliente/:token/resetar-senha?code=...` (confirmar nova senha)

Comportamento:
- Entrar: chama `portal-login` e, se ok, navega para `/cliente/:token/app`
- Primeiro acesso: chama `portal-register` e navega para `/cliente/:token/app`
- Esqueci: chama `portal-password-reset-request` e sempre mostra mensagem genérica (anti-enumeração)
- Resetar: chama `portal-password-reset-confirm` e manda para `/cliente/:token/entrar`

### 5) Ajustar o fluxo atual `/cliente/:token`
- Hoje ele manda para `/auth` (Supabase Auth). Isso deve mudar para mandar para `/cliente/:token/entrar`.
- Remover dependência do `supabase.auth` dentro do portal (inclusive o “Logout” atual no portal).

### 6) Roteamento final no `App.tsx`
- Rotas públicas do portal:
  - `/cliente/:token`
  - `/cliente/:token/entrar`
  - `/cliente/:token/primeiro-acesso`
  - `/cliente/:token/esqueci`
  - `/cliente/:token/resetar-senha`
- Rotas protegidas do portal:
  - `/cliente/:token/app`
  - `/cliente/:token/servicos`
  - `/cliente/:token/novo`
  - `/cliente/:token/agendamentos...`
  - protegidas por `<PortalGate />`

## Plano de teste ponta-a-ponta (quando terminar)
1. Abrir `/cliente/<TOKEN_SALAO_A>` em aba anônima
2. “Primeiro acesso” → cadastrar email + senha → deve entrar no `/app`
3. Abrir `/cliente/<TOKEN_SALAO_B>` no mesmo navegador
   - Deve invalidar/sair do contexto anterior (regra de ouro) e exigir novo login/cadastro do salão B
4. “Esqueci minha senha” no salão A
   - Checar chegada do email e o link `/cliente/<TOKEN>/resetar-senha?code=...`
5. Confirmar nova senha → login → verificar que sessões anteriores foram revogadas

## Riscos/observações
- Se você quiser máxima compatibilidade (Safari/iOS), o modelo “cookie third-party” pode ser instável; se isso acontecer, implementamos o fallback por header/token (Opção B).
- O backoffice continua usando Supabase Auth normalmente; o Portal do Cliente fica totalmente isolado.

## Próxima decisão necessária
- Você prefere tentar manter cookie httpOnly (Opção A) primeiro, ou já implementar direto o fallback por token em header (Opção B) para garantir compatibilidade em qualquer navegador?
