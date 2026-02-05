import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useNavigate, useParams } from "react-router-dom";

import { PortalShell } from "@/components/cliente-portal/PortalShell";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

import { usePortalSalaoByToken } from "@/hooks/usePortalSalaoByToken";
import { portalLogout, portalMe, setPortalSessionToken } from "@/portal/portal-api";

export default function ClientePortalAppPage() {
  const nav = useNavigate();
  const { token } = useParams();
  const tokenValue = useMemo(() => (typeof token === "string" ? token.trim() : ""), [token]);

  const salaoQuery = usePortalSalaoByToken(tokenValue);
  const meQuery = useQuery({
    queryKey: ["portal-me", tokenValue],
    enabled: tokenValue.length > 0,
    queryFn: async () => portalMe(tokenValue),
    retry: false,
    staleTime: 1000 * 15,
  });

  const email = (meQuery.data as any)?.portal_account?.email ?? null;

  return (
    <PortalShell
      title="Portal do cliente"
      subtitle={salaoQuery.data ? `Salão: ${salaoQuery.data.nome}` : undefined}
      logoUrl={salaoQuery.data?.logo_url}
      onLogout={async () => {
        try {
          await portalLogout();
        } finally {
          setPortalSessionToken(null);
          nav(`/cliente/${tokenValue}`);
        }
      }}
    >
      {!tokenValue ? (
        <Card>
          <CardContent className="py-6 text-sm text-muted-foreground">Link inválido.</CardContent>
        </Card>
      ) : salaoQuery.isLoading || meQuery.isLoading ? (
        <div className="text-sm text-muted-foreground">Carregando…</div>
      ) : salaoQuery.isError || meQuery.isError ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Erro</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">Tente novamente em instantes.</CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-3">
          <Card className="h-full">
            <CardHeader>
              <CardTitle className="text-base">Serviços</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <p className="text-sm text-muted-foreground">Veja valores e duração média de cada serviço.</p>
              <Button variant="secondary" className="w-full" onClick={() => nav(`/cliente/${tokenValue}/servicos`)}>
                Ver serviços
              </Button>
            </CardContent>
          </Card>

          <Card className="h-full">
            <CardHeader>
              <CardTitle className="text-base">Novo agendamento</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <p className="text-sm text-muted-foreground">Escolha serviço, profissional e um horário disponível.</p>
              <Button className="w-full" onClick={() => nav(`/cliente/${tokenValue}/novo`)}>
                Agendar agora
              </Button>
            </CardContent>
          </Card>

          <Card className="h-full">
            <CardHeader>
              <CardTitle className="text-base">Meus agendamentos</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <p className="text-sm text-muted-foreground">Acompanhe, edite ou cancele seus agendamentos.</p>
              <Button variant="secondary" className="w-full" onClick={() => nav(`/cliente/${tokenValue}/agendamentos`)}>
                Ver agendamentos
              </Button>
            </CardContent>
          </Card>

          <Card className="sm:col-span-3">
            <CardContent className="py-4 text-sm text-muted-foreground">
              {email ? `Logado como: ${email}` : "Sessão ativa."}
            </CardContent>
          </Card>
        </div>
      )}
    </PortalShell>
  );
}
