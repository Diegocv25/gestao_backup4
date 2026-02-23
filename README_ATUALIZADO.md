 # Sistema de Gestão Multi-Tenant
 
 Sistema SaaS completo de gestão para estabelecimentos de serviços (salões de beleza, barbearias, clínicas, spas, etc.) com arquitetura multi-tenant, controle de acesso baseado em roles e portal do cliente.
 
## 📋 Índice

- [Visão Geral](#-visão-geral)
- [Funcionalidades](#-funcionalidades)
- [Páginas e Rotas (guia página-a-página)](#-páginas-e-rotas-guia-página-a-página)
- [Arquitetura Multi-Tenant](#-arquitetura-multi-tenant)
- [Sistema de Roles e Permissões](#-sistema-de-roles-e-permissões)
- [Tecnologias](#-tecnologias)
- [Instalação e Configuração](#-instalação-e-configuração)
- [Estrutura do Banco de Dados](#-estrutura-do-banco-de-dados)
- [Escalabilidade](#-escalabilidade)
- [Segurança](#-segurança)
- [Deploy](#-deploy)
- [Convenções do Código](#-convenções-do-código)

 
 ## 🎯 Visão Geral
 
 Este é um sistema completo de gestão empresarial desenvolvido como SaaS multi-tenant, permitindo que múltiplos estabelecimentos independentes utilizem a mesma infraestrutura de forma completamente isolada e segura.
 
 **Características principais:**
 - ✅ Arquitetura multi-tenant com isolamento completo de dados via RLS (Row-Level Security)
 - ✅ Sistema de roles granular (6 níveis de acesso)
 - ✅ Portal público para clientes realizarem agendamentos
 - ✅ Gestão completa de agendamentos, clientes, funcionários e serviços
 - ✅ Controle de estoque e vendas de produtos
 - ✅ Sistema de comissões automatizado
 - ✅ Relatórios financeiros e operacionais detalhados
 - ✅ Interface responsiva (mobile, tablet e desktop)
 
 ## 🚀 Funcionalidades
 
 ### 1. Gestão de Agendamentos
 - Criação, edição e cancelamento de agendamentos
 - Visualização por profissional e data
 - Cálculo automático de horários disponíveis
 - Prevenção de conflitos de horários (trigger no banco)
 - Sistema de status: `marcado` → `confirmado` → `concluído` → `cancelado`
 - Múltiplos serviços por agendamento
 - Observações personalizadas
 - Cálculo automático de duração e valor total
 
 ### 2. Gestão de Clientes
 - Cadastro completo de clientes (nome, telefone, email, data de nascimento)
 - Histórico de atendimentos
 - Registro de última visita (atualizado automaticamente)
 - Vinculação de clientes a usuários do portal
 - Observações e notas personalizadas
 - Busca e filtros
 
 ### 3. Gestão de Funcionários
 - Cadastro de profissionais e staff
 - Configuração de horários de trabalho por dia da semana
 - Intervalos de almoço personalizados
 - Sistema de comissões (percentual ou valor fixo)
 - Salário fixo mensal configurável
 - Vinculação de serviços que cada profissional realiza
 - Criação de acesso ao sistema para funcionários (via Edge Function)
 - Reset de senha (via Edge Function)
 - Controle de ativo/inativo
 
 ### 4. Gestão de Serviços
 - Cadastro de serviços oferecidos
 - Duração (em minutos) e valor de cada serviço
 - Ativação/desativação de serviços
 - Vinculação de serviços a profissionais específicos
 
 ### 5. Gestão de Produtos e Estoque
 - Catálogo de produtos com preços de venda e custo médio
 - Controle de estoque atual e estoque mínimo
 - Registro de movimentações:
   - **Entrada**: Compra/reposição de estoque
   - **Consumo interno**: Uso em atendimentos
   - **Venda**: Venda direta ao cliente
 - Sistema de vendas integrado com atualização automática de estoque
 - Cálculo automático de lucro bruto por venda
 - Categorização de produtos
 - Unidades de medida personalizáveis
 
 ### 6. Sistema de Comissões
 - Cálculo automático ao concluir agendamento (trigger)
 - Suporte a comissão percentual ou valor fixo
 - Base de cálculo sobre o valor total do agendamento
 - Registro de pagamentos de comissões
 - Visualização por profissional e período
 - Relatório de comissões a pagar e pagas
 
 ### 7. Relatórios e Análises
 
 #### Relatórios Financeiros
 - **Receita Bruta**: Serviços + Vendas de produtos
 - **Comissões**: Total de comissões geradas
 - **Lucro Líquido**: Receita - Comissões - Despesas - Salários
 - **Despesas Variáveis**: Controle mensal de despesas
 - **Folha Salarial**: Registro de salários pagos
 
 #### Relatórios Operacionais
 - **Por Funcionário**: Performance individual, receitas geradas
 - **Por Dia da Semana**: Análise de agendamentos concluídos
 - **Comparativos**: Análise mensal de múltiplas métricas
 - **Produtos**: Movimentações de estoque e vendas com lucro
 
 ### 8. Portal do Cliente
 - Link público único por estabelecimento (via `public_booking_token`)
 - Auto-cadastro de clientes
 - Vinculação automática de conta via email
 - Agendamento online com seleção de:
   - Profissional
   - Serviço(s)
   - Data e horário disponível
 - Visualização de serviços e profissionais disponíveis
 - Consulta de agendamentos próprios
 - Cancelamento de agendamentos futuros
 - Avisos semanais personalizados
 
### 9. Configurações do Estabelecimento
- Upload de logo personalizada (Supabase Storage) *(admin)*
- Horários de funcionamento por dia da semana *(admin)*
- Intervalos e fechamentos *(admin)*
- Avisos semanais para clientes (por dia da semana) *(admin)*
- Regras de antecedência para agendamentos (horas ou dias) *(admin)*
- **Segurança**: troca de senha do usuário logado *(admin e funcionários não-admin)*
 
## 🧭 Páginas e Rotas (guia página-a-página)

> Fonte de verdade das rotas: `src/App.tsx`.

### Visão rápida de módulos

- **Backoffice (interno)**: dashboard + cadastros + operações + relatórios.
- **Profissional**: agenda e comissões do próprio profissional.
- **Portal do cliente (público + auth própria)**: login/cadastro do cliente, completar cadastro e agendar online.

### Rotas públicas e autenticação

#### `/auth`
**Página:** `src/pages/Auth.tsx`
- Login do **backoffice** via Supabase Auth (email/senha).
- Suporta modo **recovery** (`type=recovery` no query/hash) para redefinição de senha.
- Fluxo multi-tenant: se o email já existe, orienta a usar **Entrar** (conta Supabase é global por email).
- Bloqueio de cliente no backoffice: se `state.blocked === "customer_backoffice"`, mostra tela explicando que cliente acessa via portal.

#### `*` (catch-all)
**Página:** `src/pages/NotFound.tsx`
- 404 simples com link para `/`.

### Portal do cliente (público)

> Todas as rotas do portal usam o token público do estabelecimento: `:token` (campo `saloes.public_booking_token`).

#### `/cliente/:token`
**Página:** `src/pages/ClientePublico.tsx`
- Valida o token via RPC (`portal_salao_by_token`).
- Redireciona automaticamente para `/cliente/:token/entrar`.

#### `/cliente/:token/entrar`
**Página:** `src/pages/ClientePortalEntrar.tsx`
- Login do cliente (auth **própria do portal**, via Edge Function `portal-login`).
- Em caso de sucesso: salva `session_token` (Portal) e navega para `/cliente/:token/app`.

#### `/cliente/:token/primeiro-acesso`
**Página:** `src/pages/ClientePortalPrimeiroAcesso.tsx`
- Cria acesso do cliente (via Edge Function `portal-register`).
- Fluxo atual: **cadastro → volta para login** (sem auto-login) para manter o fluxo determinístico.

#### `/cliente/:token/esqueci`
**Página:** `src/pages/ClientePortalEsqueciSenha.tsx`
- Solicita redefinição de senha via Edge Function `portal-password-reset-request`.

#### `/cliente/:token/resetar-senha?code=...`
**Página:** `src/pages/ClientePortalResetarSenha.tsx`
- Confirma redefinição via Edge Function `portal-password-reset-confirm`.

### Portal do cliente (área autenticada)

> Estas rotas ficam atrás do `PortalGate` (`src/auth/PortalGate.tsx`), que consulta `portal-me`.

#### `/cliente/:token/app`
**Página:** `src/pages/ClientePortalApp.tsx`
- Home do portal com atalhos para Serviços / Novo agendamento / Meus agendamentos.
- Botão de logout chama `portal-logout` e limpa o token local.

#### `/cliente/:token/cadastro`
**Página:** `src/pages/ClientePortalCadastro.tsx`
- "Complete seu cadastro": nome, telefone e data de nascimento.
- Salva via `portal-cliente-upsert` e volta para `/app`.

#### `/cliente/:token/servicos`
**Página:** `src/pages/ClientePortalServicos.tsx`
- Lista serviços disponíveis (via `portal-servicos-list`).
- CTA "Agendar" leva para `/cliente/:token/novo`.

#### `/cliente/:token/novo`
**Página:** `src/pages/ClientePortalAgendamentoForm.tsx`
- Fluxo de agendamento online:
  1) Seleciona serviço (`portal-servicos-list`)
  2) Seleciona profissional (`portal-profissionais-by-servico`)
  3) Seleciona dia (calendário)
  4) Seleciona horário (`portal-available-slots`)
  5) Confirma (`portal-agendamento-create`)

#### `/cliente/:token/agendamentos`
**Página:** `src/pages/ClientePortalMeusAgendamentos.tsx`
- Lista agendamentos do cliente (via `portal-agendamentos-list`).
- Ação "Ver" abre o detalhe.

#### `/cliente/:token/agendamentos/:id`
**Página:** `src/pages/ClientePortalAgendamentoForm.tsx` (modo detalhe)
- Exibe resumo do agendamento (via `portal-agendamento-get`).
- Permite cancelar (`portal-agendamento-cancel`) e ir para editar.

#### `/cliente/:token/agendamentos/:id/editar`
**Página:** `src/pages/ClientePortalAgendamentoForm.tsx` (modo edição)
- Permite escolher novo serviço/profissional/dia/hora e salvar (`portal-agendamento-update`).

### Backoffice (interno) — Admin/Gerente/Recepcionista/Staff

> Rotas protegidas por `AuthGate` + `BackofficeGate` + `RoleGate`.

#### `/` (Dashboard)
**Página:** `src/pages/Index.tsx`
- KPIs: total de clientes, agendamentos do dia, serviços concluídos no mês.
- Status dos agendamentos do dia (pendentes/agendados/concluídos/cancelados).
- Tabela de próximos agendamentos.
- Se não houver `salao_id`, orienta completar Configurações.

#### `/agendamentos`
**Página:** `src/pages/Agendamentos.tsx`
- Calendário mensal + lista do dia, com filtro por status.
- Ações por agendamento: editar, excluir, alterar status.
- Ao concluir: solicita forma de pagamento e cria/atualiza `recebimentos`, depois marca `status=concluido`.
- Exibe/gera **link público do portal** do cliente (`public_booking_token`) com copiar e regenerar.

#### `/agendamentos/novo` e `/agendamentos/:id`
**Página:** `src/pages/AgendamentoFormPage.tsx`
- Cria/edita agendamento com validações:
  - política de antecedência do salão (modo `horas` ou `proximo_dia`)
  - bloqueia salvar no passado
  - calcula horários livres via `useAvailableSlots`.
- Modelo atual: 1 serviço por agendamento (reescreve `agendamento_itens` ao salvar).

#### `/clientes`
**Página:** `src/pages/Clientes.tsx`
- Lista com busca (nome/telefone/email).
- Mostra métricas agregadas por cliente:
  - atendimentos concluídos
  - cancelamentos
  - serviços realizados.
- Ações: editar e excluir.

#### `/clientes/novo` e `/clientes/:id`
**Página:** `src/pages/ClienteFormPage.tsx`
- CRUD de cliente (nome/telefone/email/data de nascimento).
- Valida email único por salão.
- Máscara e conversão dd/mm/yyyy ↔ ISO.

#### `/servicos`
**Página:** `src/pages/Servicos.tsx`
- Lista de serviços (duração/valor/ativo) com busca.
- Mostra quantidade de profissionais vinculados.
- Ações: editar e excluir (remove vínculos em `servicos_funcionarios`).

#### `/servicos/novo` e `/servicos/:id`
**Página:** `src/pages/ServicoFormPage.tsx`
- CRUD de serviço + seleção dos profissionais que executam.

#### `/funcionarios`
**Página:** `src/pages/Funcionarios.tsx`
- Lista com busca.
- Exibe configurações principais (cargo, salário fixo, comissão %, status).
- Admin pode criar/atualizar acesso via Edge Function (dialog `CreateStaffAccessDialog`).

#### `/funcionarios/novo` e `/funcionarios/:id`
**Página:** `src/pages/FuncionarioFormPage.tsx`
- CRUD de funcionário + horários de trabalho por dia + almoço.
- Para cargo "profissional": vincula serviços atendidos.
- Admin pode resetar senha via Edge Function (`ResetStaffPasswordDialog`) quando houver `auth_user_id`.

#### `/produtos`
**Página:** `src/pages/Produtos.tsx`
- Módulo com abas:
  - **Catálogo** (`ProdutosCatalogo`)
  - **Estoque (Baixas)** (`ProdutosEstoque`)
  - **Vendas** (`ProdutosVendas`).

##### Aba: Catálogo
**Componente:** `src/pages/produtos/ProdutosCatalogo.tsx`
- CRUD de produtos (nome, categoria, unidade, preço, custo médio, estoque atual/mínimo, ativo).
- Destaque visual quando estoque atual ≤ estoque mínimo.

##### Aba: Estoque (Baixas)
**Componente:** `src/pages/produtos/ProdutosEstoque.tsx`
- Registra **saída por consumo interno** (`movimentacoes_estoque.tipo = saida_consumo`).
- Valida estoque disponível e atualiza `produtos.estoque_atual`.
- Permite duplicar/remover linhas antes de salvar.

##### Aba: Vendas
**Componente:** `src/pages/produtos/ProdutosVendas.tsx`
- Registra venda em `vendas_produtos` e a movimentação `saida_venda`.
- Calcula `lucro_bruto` (total_venda − total_custo) e atualiza estoque.
- Auto-preenche preço unitário ao selecionar produto (se vazio).

#### `/relatorios`
**Página:** `src/pages/Relatorios.tsx`
- Página agregadora com filtros de período e competência (mês).
- Inclui sub-relatórios:
  - `RelatoriosComparativos`: receita bruta, comissões pagas, receita líquida (comparando período anterior).
  - `RelatoriosConcluidosPorDiaSemana`: contagem de concluídos por dia da semana.
  - `RelatoriosPorFuncionario`: performance e gestão de comissões não pagas (marcar como pago).
  - `RelatoriosFluxoCaixa`: entradas/retiradas por forma de pagamento e saldo.
  - `RelatoriosDespesas`: despesas variáveis + salários fixos + lucro final; marcação de despesas pagas.
  - `RelatoriosProdutos`: movimentações de estoque e vendas (total e lucro).

#### `/configuracoes`
**Página:** `src/pages/Configuracoes.tsx`
- Primeiro acesso: cria/edita dados do estabelecimento (salão).
- Admin/Gerente podem anexar/remover logo (Supabase Storage `estabelecimento-logos`) e gravar `saloes.logo_url`.
- Configura dias de funcionamento (`dias_funcionamento`) e política de antecedência do agendamento.
- **Segurança:** troca de senha do usuário logado.
  - Regra: funcionários não-admin veem apenas a área de senha.

### Profissional (interno) — role `profissional`

#### `/profissional/agendamentos`
**Página:** `src/pages/ProfissionalAgendamentos.tsx`
- Calendário mensal + lista do dia, com filtro por status.
- Ações: editar, excluir, mudar status.
- Exibe contador de cancelamentos do cliente (quando disponível via RLS).

#### `/profissional/agendamentos/novo` e `/profissional/agendamentos/:id`
**Página:** `src/pages/ProfissionalAgendamentoFormPage.tsx`
- Cria/edita apenas agendamentos do próprio profissional.
- Lista serviços vinculados ao profissional e calcula horários livres pelo próprio horário de trabalho.

#### `/profissional/comissoes`
**Página:** `src/pages/ProfissionalComissoes.tsx`
- Lista comissões do profissional (pagas e pendentes), com busca por ID do agendamento.

### Nota importante (mudança recente): headers do Portal vs Gateway

Para evitar **401 do gateway** do Supabase ao chamar Edge Functions do portal:
- `Authorization: Bearer <SUPABASE_ANON_KEY>` deve ser **sempre** o JWT do Supabase (anon/user).
- O token de sessão do portal (custom) deve ir no header **`x-portal-session`**.

Isso é implementado em `src/portal/portal-api.ts` e as Edge Functions priorizam `x-portal-session` na leitura da sessão.

## 🏢 Arquitetura Multi-Tenant
 
 ### Conceito
 
 O sistema utiliza arquitetura **multi-tenant compartilhada** (shared database, shared schema) onde:
 - Todos os estabelecimentos compartilham as mesmas tabelas
 - Isolamento total através de `salao_id` (identificador do estabelecimento)
 - Row-Level Security (RLS) do Supabase garante segurança
 - Cada tenant é completamente independente
 - Zero visibilidade entre tenants
 
 ### Convenção de Nomenclatura
 
 - **Backend/Banco**: `salao_id` (por compatibilidade com schema legado)
 - **Frontend**: "Estabelecimento" (termo agnóstico ao nicho de negócio)
 - **Hook recomendado**: `useEstabelecimentoId()` (alias semântico)
 
 ```typescript
 // ✅ Recomendado para novas features
 import { useEstabelecimentoId } from "@/hooks/useEstabelecimentoId";
 const { data: estabelecimentoId } = useEstabelecimentoId();
 
 // ⚠️ Ainda funciona, mas menos semântico
 import { useSalaoId } from "@/hooks/useSalaoId";
 const { data: salaoId } = useSalaoId();
 ```
 
 ### Como Funciona o Isolamento
 
 1. **Identificação do Tenant**: 
    - Função `current_salao_id()` identifica o estabelecimento do usuário logado
    - Consulta a tabela `user_roles` para obter o `salao_id` do usuário
    - Retorna o primeiro salao_id encontrado (ordenado por created_at)
 
 2. **RLS em Todas as Tabelas**: 
    - Políticas de segurança garantem que queries só retornem dados do tenant atual
    - Exemplo: `WHERE salao_id = current_salao_id()`
 
 3. **Validação em Múltiplas Camadas**:
    - **Frontend**: Hooks verificam `salao_id` antes de renderizar
    - **Backend**: Edge Functions validam tenant nas operações
    - **Banco**: RLS garante isolamento absoluto (última linha de defesa)
 
 ### Adicionando Novos Estabelecimentos
 
 Para conectar um novo estabelecimento/empresa ao sistema:
 
 #### 1. Criar registro na tabela `saloes`
 ```sql
 INSERT INTO public.saloes (nome, telefone, endereco)
 VALUES ('Nome do Estabelecimento', '11999999999', 'Endereço completo')
 RETURNING id;
 ```
 
 #### 2. Criar usuário administrador
 - Via Supabase Auth Dashboard ou
 - Via API do Supabase Auth
 
 #### 3. Vincular usuário ao estabelecimento
 ```sql
 INSERT INTO public.user_roles (user_id, salao_id, role)
 VALUES (
   'uuid-do-usuario-auth',
   'uuid-do-salao-criado',
   'admin'::app_role
 );
 ```
 
 #### 4. Configurar dados iniciais
 - Dias de funcionamento
 - Serviços oferecidos
 - Funcionários
 - Etc.
 
 **Nota**: Em produção, é recomendado criar uma landing page com formulário de auto-cadastro que execute esses passos automaticamente via Edge Function.
 
 ### Escalabilidade Horizontal
 
 - ✅ **Sem limite teórico de tenants**: Arquitetura suporta milhares de estabelecimentos
 - ✅ **Isolamento garantido**: RLS do PostgreSQL é altamente otimizado
 - ✅ **Performance**: Índices em todas as colunas `salao_id`
 - ✅ **Custo-benefício**: Infraestrutura compartilhada reduz custos
 
 ## 👥 Sistema de Roles e Permissões
 
 O sistema possui 6 roles distintos com permissões granulares controladas via RLS:
 
 ### 1. Admin (Administrador/Dono)
 **Acesso Total**: Todas as funcionalidades do sistema
 - ✅ Gerenciar configurações do estabelecimento
 - ✅ Criar/editar/excluir funcionários
 - ✅ Criar/resetar acessos de staff (Edge Functions)
 - ✅ Visualizar todos os relatórios financeiros
 - ✅ Gerenciar produtos e estoque
 - ✅ Configurar comissões e salários
 - ✅ Gerenciar agendamentos, clientes e serviços
 - ✅ Acesso completo ao dashboard
 
### 2. Gerente
**Acesso Amplo**: Operações do dia-a-dia
- ✅ Gerenciar agendamentos, clientes, serviços
- ✅ Gerenciar funcionários (sem criar acessos ao sistema)
- ✅ Visualizar relatórios completos
- ✅ Gerenciar produtos e registrar vendas
- ❌ Não pode criar acessos para funcionários
- ❌ **Configurações do estabelecimento (admin-only)** *(exceto Segurança → troca de senha)*

### 3. Recepcionista
**Acesso Operacional**
- ✅ Gerenciar agendamentos e clientes
- ✅ Criar novos agendamentos
- ✅ Visualizar serviços e funcionários
- ✅ Registrar vendas de produtos
- ✅ Gerenciar movimentações de estoque
- ❌ Sem acesso a relatórios financeiros
- ❌ **Configurações do estabelecimento (admin-only)** *(exceto Segurança → troca de senha)*
 
 ### 4. Profissional
 **Acesso Limitado**: Apenas seus próprios dados
 - ✅ Visualizar seus agendamentos
 - ✅ Visualizar clientes que já atendeu
 - ✅ Atualizar status de seus agendamentos
 - ✅ Visualizar suas comissões
 - ❌ Não vê dados de outros profissionais
 - ❌ Sem acesso a produtos ou relatórios gerais
 
 ### 5. Staff (Auxiliar)
 **Permissões Customizadas**
 - Similar ao profissional
 - Pode ter permissões adicionais conforme necessário
 - Diferenciado no cadastro pelo campo `carga`
 
 ### 6. Customer (Cliente)
 **Portal do Cliente**
 - ✅ Criar seus próprios agendamentos
 - ✅ Visualizar seus agendamentos
 - ✅ Cancelar agendamentos futuros (via RPC)
 - ✅ Visualizar serviços e profissionais disponíveis
 - ❌ Não vê dados de outros clientes
 - ❌ Sem acesso ao sistema administrativo
 
 ### Implementação de Segurança
 
 As permissões são controladas através de:
 
 1. **Tabela `user_roles`**: Armazena relação `user_id` ↔ `salao_id` ↔ `role`
 2. **Função `has_role(user_id, role)`**: Verifica se usuário tem determinada role (SECURITY DEFINER)
 3. **Função `has_role_in_current_salao(role)`**: Valida role no contexto do tenant atual
 4. **RLS Policies**: Aplicadas em todas as tabelas usando as funções acima
 5. **Components Guard**: `<RoleGate>` e `<AuthGate>` no frontend
 
 ```typescript
 // Exemplo de proteção de rota no frontend
 <RoleGate allowedRoles={["admin", "gerente"]}>
   <ComponenteRestrito />
 </RoleGate>
 
 // Exemplo de proteção de componente
 <AuthGate>
   <ComponenteQueRequerLogin />
 </AuthGate>
 ```
 
 ## 🛠️ Tecnologias
 
 ### Frontend
 - **React 18** - Library de UI
 - **TypeScript** - Type safety
 - **Vite** - Build tool e dev server ultra-rápido
 - **TanStack Query** - State management e cache inteligente
 - **React Router DOM v6** - Roteamento
 - **React Hook Form** - Formulários performáticos
 - **Zod** - Validação de schemas
 - **Tailwind CSS** - Utility-first CSS
 - **shadcn/ui** - Component library (Radix UI + Tailwind)
 - **Lucide React** - Ícones modernos
 - **Recharts** - Gráficos e visualizações
 - **date-fns** - Manipulação de datas
 - **Sonner** - Toast notifications
 
 ### Backend
 - **Supabase** - BaaS (Backend as a Service)
   - **PostgreSQL 14+** - Banco de dados relacional
   - **Row-Level Security (RLS)** - Isolamento de dados
   - **Authentication** - JWT tokens
   - **Edge Functions (Deno)** - Serverless functions
   - **Storage** - Upload de arquivos (logos)
 
### Edge Functions Implementadas

#### Backoffice / Admin
- `admin-create-staff-user`: Criar usuários para funcionários
- `admin-reset-staff-password`: Resetar senhas de staff
- `seed-demo-data`: Popular dados de demonstração (idempotente)

#### Portal do cliente (auth própria + agendamento público)
- (Depende do RPC `portal_salao_by_token` para validar o token público do salão)
- `portal-me`: Verifica sessão do portal e retorna dados do salão/conta/cliente
- `portal-login`: Login do cliente e emissão de `session_token`
- `portal-logout`: Revoga sessão atual
- `portal-register`: Primeiro acesso (cria credencial do portal)
- `portal-password-reset-request`: Solicita email de redefinição
- `portal-password-reset-confirm`: Confirma redefinição por código
- `portal-cliente-upsert`: Completa/atualiza cadastro do cliente
- `portal-servicos-list`: Lista serviços públicos do salão
- `portal-profissionais-by-servico`: Lista profissionais por serviço
- `portal-profissional-dias`: Retorna dias da semana atendidos pelo profissional
- `portal-available-slots`: Calcula horários disponíveis
- `portal-agendamentos-list`: Lista agendamentos do cliente
- `portal-agendamento-get`: Busca detalhe de um agendamento
- `portal-agendamento-create`: Cria agendamento
- `portal-agendamento-update`: Reagenda/edita
- `portal-agendamento-cancel`: Cancela agendamento

 
 ## ⚙️ Instalação e Configuração
 
 ### Pré-requisitos
 - Node.js 18+ ou Bun
 - Conta no [Supabase](https://supabase.com)
 - Git
 
 ### Passo 1: Clonar o Repositório
 
 ```bash
 git clone <YOUR_GIT_URL>
 cd <YOUR_PROJECT_NAME>
 ```
 
 ### Passo 2: Instalar Dependências
 
 ```bash
 npm install
 # ou
 bun install
 ```
 
 ### Passo 3: Configurar Variáveis de Ambiente
 
 ```bash
 cp .env.example .env.local
 ```
 
 **⚠️ IMPORTANTE**: Este projeto NÃO usa variáveis `VITE_*` no código. As credenciais do Supabase devem ser configuradas diretamente em `src/integrations/supabase/client.ts`:
 
 ```typescript
 const supabaseUrl = "https://seu-projeto.supabase.co";
 const supabaseAnonKey = "sua-anon-key";
 ```
 
 ### Passo 4: Configurar Supabase
 
 1. Crie um projeto no [Supabase Dashboard](https://supabase.com/dashboard)
 2. Execute as migrations em `supabase/migrations/` na ordem
 3. Configure as Edge Functions (deploy via Supabase CLI)
 4. Crie o bucket `estabelecimento-logos` no Storage (público)
 5. Adicione as credenciais em `src/integrations/supabase/client.ts`
 
 ### Passo 5: Iniciar o Servidor de Desenvolvimento
 
 ```bash
 npm run dev
 # ou
 bun dev
 ```
 
 Acesse: `http://localhost:5173`
 
 ### Passo 6: Primeiro Acesso
 
 1. Crie o primeiro usuário admin via [Supabase Auth Dashboard](https://supabase.com/dashboard/project/_/auth/users)
 2. Insira na tabela `saloes` um novo estabelecimento
 3. Insira na tabela `user_roles` vinculando o usuário ao salão com role 'admin'
 4. Faça login no sistema
 5. Configure dias de funcionamento, serviços, etc.
 
 ## 🗄️ Estrutura do Banco de Dados
 
 ### Tabelas Principais (15 tabelas)
 
 | Tabela | Descrição |
 |--------|-----------|
 | `saloes` | Dados dos estabelecimentos (tenants) |
 | `user_roles` | Controle de acesso (user_id ↔ salao_id ↔ role) |
 | `clientes` | Cadastro de clientes |
 | `funcionarios` | Cadastro de profissionais e staff |
 | `servicos` | Serviços oferecidos |
 | `agendamentos` | Agendamentos realizados |
 | `agendamento_itens` | Serviços de cada agendamento |
 | `comissoes` | Comissões calculadas |
 | `produtos` | Catálogo de produtos |
 | `movimentacoes_estoque` | Histórico de movimentações |
 | `vendas_produtos` | Vendas realizadas |
 | `dias_funcionamento` | Horários do estabelecimento |
 | `horarios_funcionario` | Horários de cada profissional |
 | `avisos_semanais` | Avisos para clientes por dia |
 | `despesas_variaveis` | Despesas mensais |
 | `folha_salarial_mensal` | Salários pagos por mês |
 
 ### Enums
 
 - `app_role`: admin, gerente, recepcionista, profissional, staff, customer
 - `agendamento_status`: marcado, confirmado, concluído, cancelado
 - `comissao_tipo`: percentual, fixo
 
 ### Funções Importantes
 
 | Função | Descrição |
 |--------|-----------|
 | `current_salao_id()` | Retorna o salao_id do usuário atual |
 | `has_role(user_id, role)` | Verifica se usuário tem role |
 | `has_role_in_current_salao(role)` | Verifica role no tenant atual |
 | `portal_salao_by_token(token)` | Busca estabelecimento por token público |
 | `portal_agendamentos_ocupados_public()` | Lista horários ocupados (para portal) |
 | `portal_cancel_agendamento()` | Cancelamento pelo cliente |
 | `portal_link_cliente_by_email()` | Vincula cliente a usuário do portal |
 | `clientes_nomes_current_salao()` | Lista clientes para autocomplete |
 | `funcionarios_public_by_ids()` | Dados públicos de profissionais |
 | `can_bootstrap_first_admin()` | Permite criação do primeiro admin |
 
 ### Triggers
 
 | Trigger | Descrição |
 |---------|-----------|
 | `trigger_validate_agendamento_conflict` | Previne agendamentos simultâneos para o mesmo profissional |
 | `handle_agendamento_concluido` | Cria comissão e atualiza última visita do cliente |
 | `update_updated_at_column` | Atualiza timestamp automaticamente |
 
 ### Relacionamentos Principais
 
 ```
 user_roles → saloes (salao_id)
 user_roles → auth.users (user_id)
 
 clientes → saloes (salao_id)
 funcionarios → saloes (salao_id)
 servicos → saloes (salao_id)
 produtos → saloes (salao_id)
 
 agendamentos → saloes (salao_id)
 agendamentos → clientes (cliente_id)
 agendamentos → funcionarios (funcionario_id)
 
 agendamento_itens → agendamentos (agendamento_id)
 agendamento_itens → servicos (servico_id)
 
 comissoes → agendamentos (agendamento_id)
 comissoes → funcionarios (funcionario_id)
 
 servicos_funcionarios → servicos + funcionarios
 ```
 
 ## 📈 Escalabilidade
 
 ### Horizontal (Mais Estabelecimentos)
 
 O sistema é **altamente escalável horizontalmente**:
 
 - ✅ **Sem limite de tenants**: Arquitetura suporta milhares de estabelecimentos
 - ✅ **Isolamento garantido**: RLS do PostgreSQL é altamente otimizado
 - ✅ **Zero impacto entre tenants**: Problemas em um não afetam outros
 - ✅ **Onboarding automatizado**: Landing page pode criar novos tenants via Edge Function
 - ✅ **Custos compartilhados**: Infraestrutura dividida entre todos os tenants
 - ✅ **Backup unificado**: Uma estratégia de backup para todos
 
 ### Vertical (Mais Funcionalidades)
 
 Estrutura modular permite adicionar:
 - Novos módulos sem afetar existentes
 - Novas roles e permissões (apenas adicionar ao enum)
 - Integração com APIs externas (WhatsApp, SMS, pagamentos)
 - Relatórios customizados por nicho
 - Dashboards específicos por role
 
 ### Performance
 
 **Otimizações implementadas**:
 - ✅ Índices em todas as colunas `salao_id`
 - ✅ Queries filtradas por tenant desde o início
 - ✅ TanStack Query para cache inteligente no frontend
 - ✅ Edge Functions para operações pesadas
 - ✅ Storage otimizado com CDN do Supabase
 - ✅ RLS policies otimizadas com SECURITY DEFINER
 - ✅ Conexão pooling do Supabase
 
 **Capacidade estimada (instância padrão do Supabase)**:
 - 100+ estabelecimentos simultâneos
 - 10.000+ agendamentos/dia no total
 - Resposta < 200ms em 95% das queries
 - 1000+ usuários online simultâneos
 
 ## 🔒 Segurança
 
 ### Row-Level Security (RLS)
 
 **Todas as 15 tabelas** possuem RLS habilitado com políticas que:
 - ✅ Bloqueiam acesso anônimo explicitamente
 - ✅ Filtram por `salao_id` automaticamente
 - ✅ Validam roles antes de permitir operações
 - ✅ Usam funções SECURITY DEFINER para evitar recursão
 - ✅ Policies separadas por operação (SELECT, INSERT, UPDATE, DELETE)
 
 Exemplo de policy:
 ```sql
 CREATE POLICY "clientes_admin_staff_gerente_recep_all"
 ON clientes FOR ALL
 TO authenticated
 USING (
   salao_id = current_salao_id() AND
   (has_role(auth.uid(), 'admin') OR 
    has_role(auth.uid(), 'gerente') OR 
    has_role(auth.uid(), 'recepcionista'))
 );
 ```
 
 ### Autenticação
 
 - ✅ JWT tokens do Supabase
 - ✅ Sessões persistentes no localStorage
 - ✅ Refresh automático de tokens
 - ✅ Logout em todos os dispositivos
 - ✅ Proteção contra CSRF
 - ✅ Rate limiting do Supabase
 
### Autorização

- ✅ Sistema de roles granular
- ✅ Validação em múltiplas camadas (frontend + RLS + edge functions)
- ✅ Guards no frontend (`<RoleGate>`, `<AuthGate>`, `<BackofficeGate>`)
- ✅ **Clientes (role `customer`) são bloqueados de acessar rotas do backoffice** (ex: `/configuracoes`, `/agendamentos`, etc.)
- ✅ RLS no banco (última linha de defesa)
- ✅ Edge Functions validam permissões
 
 ### Melhores Práticas Implementadas
 
 - ✅ **Roles em tabela separada** (evita escalação de privilégios)
 - ✅ **Nunca confiar em dados do cliente** (validação server-side)
 - ✅ **Senhas nunca expostas** (reset via edge function segura)
 - ✅ **Tokens públicos para portal** (não expõe dados sensíveis)
 - ✅ **Validação de input** (Zod no frontend, constraints no banco)
 - ✅ **Prepared statements** (Supabase usa automaticamente)
 - ✅ **HTTPS obrigatório** (Supabase força)
 
 ### Portal do Cliente - Segurança Especial
 
 Acesso público requer cuidados extras:
 - ✅ Token único por estabelecimento (`public_booking_token`)
 - ✅ RPC functions com SECURITY DEFINER para bypass controlado de RLS
 - ✅ Cliente só vê seus próprios agendamentos
 - ✅ Validação de email para vincular conta
 - ✅ Rate limiting em operações sensíveis
 - ✅ Não expõe dados de outros clientes
 
 ## 🚀 Deploy
 
 ### Via Vercel (Recomendado)
 
- Deploy via Vercel (GitHub) é o fluxo padrão.
- Ajustes dependentes de domínio (URLs canônicas, e-mail, redirects) devem ser aplicados quando o domínio estiver definido.
- Documentação de comportamento (fonte de verdade): `/root/.openclaw/workspace/docs/behavior/gestao_backup4/`
 
 ```bash
 # Build do projeto
 npm run build
 
 # Deploy
 vercel deploy --prod
 ```
 
 ### Via Netlify
 
 ```bash
 npm run build
 netlify deploy --prod --dir=dist
 ```
 
 ### Configuração Pós-Deploy
 
 1. **Supabase Auth**:
    - Configure URLs de callback (URL do app em produção)
    - Configure redirect URLs permitidas
 
 2. **Storage**:
    - Atualize policies para permitir upload do domínio de produção
 
 3. **Edge Functions**:
    - Deploy via `supabase functions deploy --project-ref <ref>`
    - Configure secrets necessários
 
 4. **Domínio customizado**:
    - Configure DNS (CNAME ou A record)
    - Aguarde propagação (pode levar até 48h)
 
 5. **Teste completo**:
    - Fluxo de autenticação
    - Criação de agendamento
    - Upload de logo
    - Portal do cliente
 
 ## 📝 Convenções do Código
 
 ### Estrutura de Pastas
 
 ```
src/
├── auth/              # Autenticação e controle de acesso
│   ├── AuthGate.tsx
│   ├── BackofficeGate.tsx
│   ├── RoleGate.tsx
│   ├── auth-context.tsx
│   └── access-context.tsx
 ├── components/        # Componentes reutilizáveis
 │   ├── ui/           # shadcn/ui components
 │   ├── layout/       # Layout components (sidebar, etc)
 │   ├── configuracoes/
 │   ├── funcionarios/
 │   ├── kpis/
 │   └── ...
 ├── hooks/            # Custom hooks
 │   ├── useSalaoId.ts
 │   ├── useEstabelecimentoId.ts
 │   ├── useAvailableSlots.ts
 │   └── ...
 ├── integrations/     # Integrações externas
 │   └── supabase/
 │       ├── client.ts
 │       └── types.ts (read-only)
 ├── lib/              # Utilities e helpers
 │   ├── utils.ts
 │   ├── scheduling.ts
 │   └── ...
 ├── pages/            # Páginas da aplicação
 │   ├── Index.tsx
 │   ├── Agendamentos.tsx
 │   ├── Clientes.tsx
 │   └── ...
 └── main.tsx          # Entry point
 ```
 
 ### Nomenclatura
 
 - **Componentes**: PascalCase (`AgendamentoFormPage.tsx`)
 - **Hooks**: camelCase prefixado com `use` (`useEstabelecimentoId.ts`)
 - **Utilities**: camelCase (`formatCurrency`, `calculateSlots`)
 - **Constantes**: UPPER_SNAKE_CASE (`API_BASE_URL`)
 - **Tipos**: PascalCase (`AgendamentoStatus`, `UserRole`)
 - **Arquivos de página**: PascalCase (`ClienteFormPage.tsx`)
 
 ### Estilo e Design System
 
 **⚠️ IMPORTANTE**: Sempre use tokens semânticos do design system!
 
 - ✅ **USE**: `bg-primary`, `text-foreground`, `border-border`
 - ❌ **NÃO USE**: `bg-blue-500`, `text-white`, `border-gray-300`
 
 Tokens definidos em `src/index.css`:
 - `--background`, `--foreground`
 - `--primary`, `--primary-foreground`
 - `--secondary`, `--secondary-foreground`
 - `--muted`, `--muted-foreground`
 - `--accent`, `--accent-foreground`
 - `--destructive`, `--destructive-foreground`
 - `--border`, `--input`, `--ring`
 
 Todos devem ser **HSL** format para suportar dark mode.
 
 ### Breakpoints Responsivos
 
 Definidos em `src/hooks/use-mobile.tsx`:
 - **Mobile**: < 768px (overlay sidebar)
 - **Tablet**: 768px - 1024px (também usa overlay sidebar)
 - **Desktop**: > 1024px (collapsible sidebar)
 
 ```typescript
 const MOBILE_BREAKPOINT = 1024;
 ```
 
 ### Padrões de Código
 
 1. **Sempre use TypeScript**: Nunca use `any`
 2. **Componentes funcionais**: Apenas function components com hooks
 3. **React Query**: Para todas as operações assíncronas
 4. **React Hook Form + Zod**: Para todos os formulários
 5. **Semantic HTML**: Use tags apropriadas (`<button>`, `<nav>`, etc)
 6. **Acessibilidade**: Sempre adicione labels, aria-labels
 7. **Error handling**: Sempre trate erros (try-catch + toast)
 
 ## 🤝 Contribuindo
 
 Para contribuir com o projeto:
 
 1. Fork o repositório
 2. Crie uma branch para sua feature (`git checkout -b feature/MinhaFeature`)
 3. Siga as convenções de código
 4. Adicione testes se aplicável
 5. Commit suas mudanças (`git commit -m 'feat: Adiciona MinhaFeature'`)
 6. Push para a branch (`git push origin feature/MinhaFeature`)
 7. Abra um Pull Request
 
 ### Commit Convention
 
 Seguimos o padrão [Conventional Commits](https://www.conventionalcommits.org/):
 
 - `feat:` Nova funcionalidade
 - `fix:` Correção de bug
 - `docs:` Mudanças na documentação
 - `style:` Formatação, ponto e vírgula, etc
 - `refactor:` Refatoração de código
 - `test:` Adição de testes
 - `chore:` Atualização de build, configs, etc
 
 ## 📞 Suporte e Documentação
 
 - 📖 [Documentação do Supabase](https://supabase.com/docs)
 - 📖 [Documentação da Vercel](https://vercel.com/docs)
 - 📖 [React Documentation](https://react.dev)
 - 📖 [TanStack Query](https://tanstack.com/query/latest)
 - 📖 [shadcn/ui](https://ui.shadcn.com)
 
 ## 📄 Licença
 
 Este projeto é privado e proprietário.
 
 ---
 
 **Desenvolvido com ❤️ usando React, TypeScript e Supabase**