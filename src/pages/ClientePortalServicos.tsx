import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useNavigate, useParams } from "react-router-dom";

import { usePortalSalaoByToken } from "@/hooks/usePortalSalaoByToken";
import { portalMe, portalServicosList } from "@/portal/portal-api";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { PortalShell } from "@/components/cliente-portal/PortalShell";

export default function ClientePortalServicosPage() {
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

  const servicosQuery = useQuery({
    queryKey: ["portal-servicos", tokenValue],
    enabled: tokenValue.length > 0 && !!(meQuery.data as any)?.authenticated,
    queryFn: async () => portalServicosList(tokenValue),
    retry: false,
    staleTime: 1000 * 30,
  });

  return (
    <PortalShell
      title="Serviços"
      subtitle={salaoQuery.data ? `Salão: ${salaoQuery.data.nome}` : undefined}
      logoUrl={salaoQuery.data?.logo_url}
      onBack={() => nav(`/cliente/${tokenValue}/app`)}
      maxWidth="3xl"
    >
      {!tokenValue ? (
        <Card>
          <CardContent className="py-6 text-sm text-muted-foreground">Link inválido.</CardContent>
        </Card>
      ) : salaoQuery.isLoading ? (
        <div className="text-sm text-muted-foreground">Carregando…</div>
      ) : salaoQuery.isError ? (
        <Card>
          <CardContent className="py-6 text-sm text-muted-foreground">Erro ao validar link. Tente novamente.</CardContent>
        </Card>
      ) : !salaoQuery.data ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Link não encontrado</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">Solicite um novo link ao salão.</CardContent>
        </Card>
      ) : meQuery.isLoading ? (
        <div className="text-sm text-muted-foreground">Carregando…</div>
      ) : (meQuery.data as any)?.authenticated === false ? (
        <Card>
          <CardContent className="py-6 text-sm text-muted-foreground">Faça login para continuar.</CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Lista de serviços</CardTitle>
            </CardHeader>
            <CardContent>
              {servicosQuery.isLoading ? <div className="text-sm text-muted-foreground">Carregando…</div> : null}
              {servicosQuery.isError ? <div className="text-sm text-destructive">Erro ao carregar serviços.</div> : null}

              {!servicosQuery.isLoading && !servicosQuery.isError ? (
                <div className="grid gap-3">
                  {(servicosQuery.data?.servicos ?? []).map((s) => (
                    <div key={s.id} className="rounded-md border p-3">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="font-medium leading-tight">{s.nome}</div>
                          <div className="mt-1 text-sm text-muted-foreground">
                            {Number(s.duracao_minutos)} min • R$ {Number(s.valor).toFixed(2)}
                          </div>
                        </div>
                        <Button size="sm" onClick={() => nav(`/cliente/${tokenValue}/novo`)}>
                          Agendar
                        </Button>
                      </div>
                    </div>
                  ))}

                  {(servicosQuery.data?.servicos ?? []).length === 0 ? (
                    <div className="text-sm text-muted-foreground">Nenhum serviço disponível no momento.</div>
                  ) : null}
                </div>
              ) : null}
            </CardContent>
          </Card>
        </div>
      )}
    </PortalShell>
  );
}
