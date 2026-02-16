import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useNavigate, useParams } from "react-router-dom";

import { usePortalSalaoByToken } from "@/hooks/usePortalSalaoByToken";
import { portalAgendamentosList, portalMe } from "@/portal/portal-api";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { PortalShell } from "@/components/cliente-portal/PortalShell";

export default function ClientePortalMeusAgendamentosPage() {
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

  const agQuery = useQuery({
    queryKey: ["portal-agendamentos", tokenValue],
    enabled: tokenValue.length > 0 && !!(meQuery.data as any)?.authenticated,
    queryFn: async () => portalAgendamentosList(tokenValue),
    retry: false,
    staleTime: 1000 * 15,
  });

  return (
    <PortalShell title="Portal do Cliente" subtitle={salaoQuery.data?.nome} maxWidth="3xl" logoUrl={salaoQuery.data?.logo_url}>
      <div className="mb-4 flex flex-col gap-2 sm:flex-row">
        <Button variant="secondary" onClick={() => nav(`/cliente/${tokenValue}/app`)}>
          Voltar
        </Button>
        <Button onClick={() => nav(`/cliente/${tokenValue}/novo`)}>Novo agendamento</Button>
      </div>

      {!tokenValue ? (
        <Card>
          <CardContent className="py-6 text-sm text-muted-foreground">Link inválido.</CardContent>
        </Card>
       ) : salaoQuery.isLoading || meQuery.isLoading ? (
         <div className="text-sm text-muted-foreground">Carregando…</div>
       ) : salaoQuery.isError ? (
         <Card>
           <CardContent className="py-6 text-sm text-muted-foreground">Erro ao validar link. Tente novamente.</CardContent>
         </Card>
       ) : (meQuery.data as any)?.authenticated === false ? (
          <Card>
            <CardContent className="py-6 text-sm text-muted-foreground">Faça login para continuar.</CardContent>
          </Card>
      ) : (
         <Card>
           <CardHeader>
             <CardTitle className="text-base">Seus agendamentos</CardTitle>
           </CardHeader>
           <CardContent>
             {agQuery.isLoading ? <div className="text-sm text-muted-foreground">Carregando…</div> : null}
             {agQuery.isError ? <div className="text-sm text-destructive">Erro ao carregar agendamentos.</div> : null}

             {!agQuery.isLoading && !agQuery.isError ? (
               (agQuery.data?.agendamentos ?? []).length === 0 ? (
                 <div className="text-sm text-muted-foreground">
                   {agQuery.data?.cliente ? "Você ainda não tem agendamentos." : "Conclua seu cadastro no salão para ver seus agendamentos."}
                 </div>
               ) : (
                 <div className="space-y-3">
                    {(agQuery.data?.agendamentos ?? []).map((a) => {
                     const servicoNome = a.itens?.[0]?.servico?.nome;
                     return (
                        <div key={a.id} className="rounded-md border px-3 py-2">
                          <div className="flex items-start justify-between gap-3">
                           <div className="min-w-0">
                              <div className="text-sm font-medium leading-5">{new Date(a.data_hora_inicio).toLocaleString()}</div>
                              <div className="mt-0.5 text-xs text-muted-foreground">
                               {servicoNome ? `${servicoNome} • ` : ""}{Number(a.total_duracao_minutos)} min • R$ {Number(a.total_valor).toFixed(2)}
                             </div>
                              <div className="mt-0.5 text-[11px] text-muted-foreground">Status: {String(a.status)}</div>
                           </div>

                           <Button variant="secondary" size="sm" onClick={() => nav(`/cliente/${tokenValue}/agendamentos/${a.id}`)}>
                             Ver
                           </Button>
                         </div>
                       </div>
                     );
                   })}
                 </div>
               )
             ) : null}
           </CardContent>
         </Card>
      )}
    </PortalShell>
  );
}
