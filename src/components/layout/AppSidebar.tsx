import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { BarChart3, CalendarDays, LayoutDashboard, LogOut, Package, Scissors, Settings, UserCog, Users, Wallet } from "lucide-react";

import { NavLink } from "@/components/NavLink";
import { useIsMobile } from "@/hooks/use-mobile";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarSeparator,
  useSidebar,
} from "@/components/ui/sidebar";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/components/ui/use-toast";
import { useAuth } from "@/auth/auth-context";
import { useAccess } from "@/auth/access-context";

const allItems = {
  admin: [
    { title: "Dashboard", url: "/", icon: LayoutDashboard, end: true },
    { title: "Agendamentos", url: "/agendamentos", icon: CalendarDays },
    { title: "Clientes", url: "/clientes", icon: Users },
    { title: "Serviços", url: "/servicos", icon: Scissors },
    { title: "Funcionários", url: "/funcionarios", icon: UserCog },
   { title: "Produtos", url: "/produtos", icon: Package },
    { title: "Relatórios", url: "/relatorios", icon: BarChart3 },
    { title: "Configurações", url: "/configuracoes", icon: Settings },
  ],
  gerente: [
    { title: "Dashboard", url: "/", icon: LayoutDashboard, end: true },
    { title: "Agendamentos", url: "/agendamentos", icon: CalendarDays },
    { title: "Clientes", url: "/clientes", icon: Users },
    { title: "Serviços", url: "/servicos", icon: Scissors },
    { title: "Funcionários", url: "/funcionarios", icon: UserCog },
   { title: "Produtos", url: "/produtos", icon: Package },
    // gerente não acessa relatórios
    { title: "Configurações", url: "/configuracoes", icon: Settings },
  ],
  recepcionista: [
    { title: "Agendamentos", url: "/agendamentos", icon: CalendarDays, end: true },
    { title: "Clientes", url: "/clientes", icon: Users },
    { title: "Serviços", url: "/servicos", icon: Scissors },
  ],
  profissional: [
    { title: "Meus agendamentos", url: "/profissional/agendamentos", icon: CalendarDays, end: true },
    { title: "Minhas comissões", url: "/profissional/comissoes", icon: Wallet },
  ],
  staff: [
    { title: "Dashboard", url: "/", icon: LayoutDashboard, end: true },
    { title: "Agendamentos", url: "/agendamentos", icon: CalendarDays },
    { title: "Clientes", url: "/clientes", icon: Users },
    { title: "Serviços", url: "/servicos", icon: Scissors },
    { title: "Funcionários", url: "/funcionarios", icon: UserCog },
   { title: "Produtos", url: "/produtos", icon: Package },
    { title: "Relatórios", url: "/relatorios", icon: BarChart3 },
    { title: "Configurações", url: "/configuracoes", icon: Settings },
  ],
  customer: [{ title: "Portal", url: "/", icon: LayoutDashboard, end: true }],
} as const;

export function AppSidebar() {
  const { state, isMobile: sidebarIsMobile } = useSidebar();
  const hookIsMobile = useIsMobile();
  const isMobile = sidebarIsMobile || hookIsMobile;
  const isCollapsed = state === "collapsed" && !isMobile;
  const navigate = useNavigate();
  const { user } = useAuth();
  const { role, salaoId } = useAccess();

  const items = useMemo(() => {
    if (!role) return [];
    return (allItems as any)[role] ?? [];
  }, [role]);

  const salaoQuery = useQuery({
    queryKey: ["salao", salaoId],
    enabled: !!salaoId,
    queryFn: async () => {
      const { data, error } = await supabase.from("saloes").select("id,nome,logo_url").eq("id", salaoId as string).maybeSingle();
      if (error) throw error;
      return data ?? null;
    },
  });

  const userLabel = useMemo(() => {
    const email = user?.email ?? "";
    if (!email) return "";
    return email.length > 22 ? `${email.slice(0, 19)}…` : email;
  }, [user?.email]);

  const salaoNome = salaoQuery.data?.nome?.trim() || "Gestão de Salão";
  const salaoLogoUrl = salaoQuery.data?.logo_url ?? null;

  async function handleLogout() {
    const { error } = await supabase.auth.signOut();
    if (error) {
      toast({ title: "Falha ao sair", description: error.message, variant: "destructive" });
      return;
    }
    navigate("/auth", { replace: true });
  }

  return (
    <Sidebar collapsible="icon">
      <SidebarContent>
        <div className="px-3 py-4">
          <div className={isCollapsed ? "flex justify-center" : ""}>
            <div
              className={
                isCollapsed
                  ? "flex flex-col items-center gap-2 rounded-md px-2 py-2"
                  : "flex flex-row items-start gap-3 rounded-md px-2 py-2"
              }
            >
              {salaoLogoUrl ? (
                <img
                  src={salaoLogoUrl}
                  alt={`Logo do estabelecimento ${salaoNome}`}
                  className={isCollapsed ? "h-20 w-20 rounded-md object-contain" : "h-24 w-24 rounded-md object-contain flex-shrink-0"}
                  loading="lazy"
                />
              ) : (
                <div className={isCollapsed ? "h-20 w-20 rounded-md bg-sidebar-primary" : "h-24 w-24 rounded-md bg-sidebar-primary flex-shrink-0"} aria-hidden="true" />
              )}

              {!isCollapsed && (
                <div className="leading-tight">
                  <div className="text-base font-semibold text-sidebar-foreground">{salaoNome}</div>
                </div>
              )}
            </div>
          </div>
        </div>

        <SidebarGroup>
          <SidebarGroupLabel>{role === "profissional" ? "Área do Profissional" : "Menu"}</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {items.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton asChild>
                    <NavLink
                      to={item.url}
                      end={item.end}
                      className="rounded-md px-2 py-2 hover:bg-sidebar-accent/60"
                      activeClassName="bg-sidebar-accent text-sidebar-accent-foreground"
                    >
                      <item.icon className="mr-2 h-4 w-4" />
                      <span className={isCollapsed ? "sr-only" : ""}>{item.title}</span>
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter>
        <SidebarSeparator />
        <div className="px-3 py-3">
          {!isCollapsed && userLabel ? (
            <div className="mb-2 text-xs text-sidebar-foreground/70">Logado: {userLabel}</div>
          ) : null}
          <Button variant="ghost" className="w-full justify-start" onClick={handleLogout}>
            <LogOut className="mr-2 h-4 w-4" />
            <span className={isCollapsed ? "sr-only" : ""}>Sair</span>
          </Button>
        </div>
      </SidebarFooter>
    </Sidebar>
  );
}
