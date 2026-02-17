import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ThemeProvider } from "@/components/theme-provider";
import { AppLayout } from "@/components/layout/AppLayout";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";

import { AuthProvider } from "@/auth/auth-context";
import { AuthGate } from "@/auth/AuthGate";
import { AccessProvider } from "@/auth/access-context";
import { RoleGate } from "@/auth/RoleGate";
import { PortalGate } from "@/auth/PortalGate";
import { BackofficeGate } from "@/auth/BackofficeGate";

import Index from "./pages/Index";
import NotFound from "./pages/NotFound";
import AuthPage from "./pages/Auth";
import AgendamentosPage from "./pages/Agendamentos";
import AgendamentoFormPage from "./pages/AgendamentoFormPage";
import ClientesPage from "./pages/Clientes";
import ServicosPage from "./pages/Servicos";
import FuncionariosPage from "./pages/Funcionarios";
import RelatoriosPage from "./pages/Relatorios";
import ProdutosPage from "./pages/Produtos";
import ConfiguracoesPage from "./pages/Configuracoes";
import ConfiguracoesIAPage from "./pages/ConfiguracoesIA";
import ClientePublicoPage from "./pages/ClientePublico";
import ClientePortalAppPage from "./pages/ClientePortalApp";
import ClientePortalMeusAgendamentosPage from "./pages/ClientePortalMeusAgendamentos";
import ClientePortalAgendamentoFormPage from "./pages/ClientePortalAgendamentoForm";
import ClientePortalServicosPage from "./pages/ClientePortalServicos";
import ClientePortalEntrarPage from "./pages/ClientePortalEntrar";
import ClientePortalPrimeiroAcessoPage from "./pages/ClientePortalPrimeiroAcesso";
import ClientePortalEsqueciSenhaPage from "./pages/ClientePortalEsqueciSenha";
import ClientePortalResetarSenhaPage from "./pages/ClientePortalResetarSenha";
import ClientePortalCadastroPage from "./pages/ClientePortalCadastro";

import ProfissionalAgendamentosPage from "./pages/ProfissionalAgendamentos";
import ProfissionalAgendamentoFormPage from "./pages/ProfissionalAgendamentoFormPage";
import ProfissionalComissoesPage from "./pages/ProfissionalComissoes";

import ClienteFormPage from "./pages/ClienteFormPage";
import ServicoFormPage from "./pages/ServicoFormPage";
import FuncionarioFormPage from "./pages/FuncionarioFormPage";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <ThemeProvider attribute="class" defaultTheme="dark" enableSystem={false} disableTransitionOnChange>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <AuthProvider>
          <AccessProvider>
          <BrowserRouter>
            <Routes>
              <Route path="/auth" element={<AuthPage />} />
              <Route path="/cliente/:token" element={<ClientePublicoPage />} />

              {/* Portal do cliente (auth própria via Edge Functions) */}
              <Route path="/cliente/:token/entrar" element={<ClientePortalEntrarPage />} />
              <Route path="/cliente/:token/primeiro-acesso" element={<ClientePortalPrimeiroAcessoPage />} />
              <Route path="/cliente/:token/esqueci" element={<ClientePortalEsqueciSenhaPage />} />
              <Route path="/cliente/:token/resetar-senha" element={<ClientePortalResetarSenhaPage />} />

              <Route element={<PortalGate />}>
                <Route path="/cliente/:token/app" element={<ClientePortalAppPage />} />
                <Route path="/cliente/:token/cadastro" element={<ClientePortalCadastroPage />} />
                <Route path="/cliente/:token/servicos" element={<ClientePortalServicosPage />} />
                <Route path="/cliente/:token/novo" element={<ClientePortalAgendamentoFormPage />} />
                <Route path="/cliente/:token/agendamentos" element={<ClientePortalMeusAgendamentosPage />} />
                <Route path="/cliente/:token/agendamentos/:id" element={<ClientePortalAgendamentoFormPage />} />
                <Route path="/cliente/:token/agendamentos/:id/editar" element={<ClientePortalAgendamentoFormPage />} />
              </Route>

              <Route element={<AuthGate />}>
                <Route element={<BackofficeGate />}>
                  <Route element={<AppLayout />}>
                  {/* Profissional */}
                  <Route element={<RoleGate allowed={["profissional"]} />}>
                    <Route path="/profissional/agendamentos" element={<ProfissionalAgendamentosPage />} />
                    <Route path="/profissional/agendamentos/novo" element={<ProfissionalAgendamentoFormPage />} />
                    <Route path="/profissional/agendamentos/:id" element={<ProfissionalAgendamentoFormPage />} />
                    <Route path="/profissional/comissoes" element={<ProfissionalComissoesPage />} />
                  </Route>

                  {/* Configurações (onboarding): acessível para usuário logado mesmo sem role */}
                  <Route path="/configuracoes" element={<ConfiguracoesPage />} />
                  <Route path="/configuracoes/ia" element={<ConfiguracoesIAPage />} />

                  {/* Produtos (também disponível para profissional) */}
                  <Route element={<RoleGate allowed={["admin", "staff", "gerente", "recepcionista", "profissional"]} />}>
                    <Route path="/produtos" element={<ProdutosPage />} />
                  </Route>

                  {/* Admin/Gerente/Recepcionista/Staff */}
                  <Route element={<RoleGate allowed={["admin", "staff", "gerente", "recepcionista"]} />}>
                    <Route path="/" element={<Index />} />
                    <Route path="/agendamentos" element={<AgendamentosPage />} />
                    <Route path="/agendamentos/novo" element={<AgendamentoFormPage />} />
                    <Route path="/agendamentos/:id" element={<AgendamentoFormPage />} />

                    <Route path="/clientes" element={<ClientesPage />} />
                    <Route path="/clientes/novo" element={<ClienteFormPage />} />
                    <Route path="/clientes/:id" element={<ClienteFormPage />} />

                    <Route path="/servicos" element={<ServicosPage />} />
                    <Route path="/servicos/novo" element={<ServicoFormPage />} />
                    <Route path="/servicos/:id" element={<ServicoFormPage />} />

                    <Route path="/funcionarios" element={<FuncionariosPage />} />
                    <Route path="/funcionarios/novo" element={<FuncionarioFormPage />} />
                    <Route path="/funcionarios/:id" element={<FuncionarioFormPage />} />

                    <Route path="/relatorios" element={<RelatoriosPage />} />
                  </Route>
                  </Route>
                </Route>
              </Route>

              {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
              <Route path="*" element={<NotFound />} />
            </Routes>
          </BrowserRouter>
          </AccessProvider>
        </AuthProvider>
      </TooltipProvider>
    </ThemeProvider>
  </QueryClientProvider>
);

export default App;