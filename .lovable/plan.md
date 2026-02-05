
Estado atual (com base no código)
- As Edge Functions do Portal (portal-login, portal-register, portal-me, portal-logout, portal-password-reset-*) já existem e o RESEND_API_KEY já está configurado.
- Porém, o frontend ainda está usando Supabase Auth (supabase.auth.*) + AuthGate para proteger /cliente/:token/app e demais rotas do portal.
- Não existe ainda no frontend um “PortalGate” que consulte portal-me (cookie) e nem telas/rotas próprias do Portal para login/cadastro/reset que chamem as Edge Functions.
- Além disso, do jeito que as Edge Functions estão hoje, cookies cross-site podem não funcionar de forma confiável (CORS com Access-Control-Allow-Origin="*", sem Allow-Credentials, e cookie SameSite=Lax). Isso pode impedir o browser de gravar/enviar o cookie portal_session para o domínio *.supabase.co quando o app roda em *.lovable.app.

Conclusão direta para sua pergunta
- Ainda não terminou “100% do plano” no sentido de ficar pronto para teste do portal com login próprio (sem Supabase Auth).
- O backend (Edge Functions + tabelas) está pronto para começar, mas falta a integração do frontend + ajustes técnicos para o cookie funcionar no navegador. Só depois disso dá para testar ponta-a-ponta com segurança.

O que falta implementar (sequência recomendada)

1) Decidir/ajustar a estratégia de sessão (para ficar testável no navegador)
   Opção A (manter cookie httpOnly – recomendada se funcionar no seu público-alvo)
   - Ajustar CORS nas funções do portal para:
     - Access-Control-Allow-Origin: usar o domínio exato do app (preview e/ou publicado), não "*"
     - Access-Control-Allow-Credentials: "true"
     - Adicionar “Access-Control-Allow-Headers” incluindo os headers usados (apikey, content-type, etc.)
   - Ajustar Set-Cookie nas funções:
     - SameSite=None (para permitir cookie em requisições cross-site via fetch)
     - Secure mantido
   - No frontend, todas as chamadas para as functions devem usar fetch com credentials: "include".

   Opção B (fallback robusto se cookie falhar por bloqueio de third-party cookies)
   - Alterar as functions para também aceitarem um token via header (ex: Authorization: Bearer <token> ou x-portal-session).
   - No login/register, retornar o token no body e o frontend guarda em memória/sessionStorage e manda no header.
   - Portal-me valida via header ao invés de cookie.

   Por que isso é crítico:
   - Sem esses ajustes, o “login parece funcionar” mas o portal-me sempre retorna authenticated:false, porque o cookie não grava ou não volta.

2) Criar um “PortalAuth API client” no frontend (camada única para chamar as Edge Functions)
   - Criar helpers do tipo:
     - portalLogin(token, email, password)
     - portalRegister(token, email, password, confirmPassword)
     - portalMe(token)
     - portalLogout()
     - portalPasswordResetRequest(token, email)
     - portalPasswordResetConfirm(token, code, password, confirmPassword)
   - Implementar via fetch para https://nkebpyvunwltttqgbxtu.supabase.co/functions/v1/<function>
   - Incluir headers: apikey (anon/public key), content-type e credentials (se for estratégia por cookie).

3) Implementar PortalGate (proteção das rotas do Portal do Cliente)
   - Substituir o uso de <AuthGate /> nas rotas /cliente/:token/* por um <PortalGate /> específico.
   - PortalGate deve:
     - Ler token da URL
     - Chamar portal-me(token)
     - Se authenticated:true -> renderiza <Outlet />
     - Se authenticated:false -> redireciona para /cliente/:token (ou /cliente/:token/entrar)
     - Se token inválido -> mostrar “link inválido”

4) Criar as páginas/rotas do Portal para login/cadastro/reset
   Rotas sugeridas:
   - /cliente/:token/entrar (login)
   - /cliente/:token/primeiro-acesso (cadastro de senha, se você quiser separar do login)
   - /cliente/:token/esqueci (solicitar reset)
   - /cliente/:token/resetar-senha?code=... (confirmar nova senha)
   Comportamento:
   - Entrar: chama portal-login e, se ok, navega para /cliente/:token/app
   - Primeiro acesso: chama portal-register e navega para /cliente/:token/app
   - Esqueci: chama portal-password-reset-request e sempre mostra mensagem genérica (anti-enumeração)
   - Resetar: chama portal-password-reset-confirm e manda para /cliente/:token/entrar

5) Ajustar o fluxo atual /cliente/:token
   - Hoje ele manda para /auth (Supabase Auth). Isso deve mudar para mandar para /cliente/:token/entrar (Portal login próprio).
   - Remover dependência do supabase.auth dentro do portal (inclusive o “Logout” atual no ClientePortalAppPage que faz supabase.auth.signOut).

6) Roteamento final no App.tsx
   - Rotas públicas do portal:
     - /cliente/:token (landing)
     - /cliente/:token/entrar
     - /cliente/:token/primeiro-acesso
     - /cliente/:token/esqueci
     - /cliente/:token/resetar-senha
   - Rotas protegidas do portal:
     - /cliente/:token/app
     - /cliente/:token/servicos
     - /cliente/:token/novo
     - /cliente/:token/agendamentos...
     protegidas por <PortalGate />

Plano de teste ponta-a-ponta (quando terminar)
1. Abrir /cliente/<TOKEN_SALAO_A> em aba anônima
2. “Primeiro acesso” -> cadastrar email + senha -> deve entrar no /app
3. Abrir /cliente/<TOKEN_SALAO_B> no mesmo navegador
   - Deve invalidar/sair do contexto anterior (regra de ouro) e exigir novo login/cadastro do salão B
4. “Esqueci minha senha” no salão A
   - Checar chegada do email e o link /cliente/<TOKEN>/resetar-senha?code=...
5. Confirmar nova senha -> login -> verificar que sessões anteriores foram revogadas

Riscos/observações (importante)
- Se você quiser máxima compatibilidade (Safari/iOS), o modelo “cookie third-party” pode ser instável; se isso acontecer, implementamos o fallback por header/token (Opção B).
- O backoffice continua usando Supabase Auth normalmente; o Portal do Cliente fica totalmente isolado.

O que eu preciso de você (só para escolher caminho)
- Você prefere tentar manter cookie httpOnly (mais seguro) mesmo com o risco de bloqueio em alguns browsers, ou já quer que eu implemente diretamente o fallback por token em header para ficar garantido em qualquer navegador?
  - Eu posso fazer cookie primeiro e, se falhar, adicionamos fallback depois; mas isso adiciona uma rodada extra de ajustes.
