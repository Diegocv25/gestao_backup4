import { useMemo } from "react";
import { useNavigate, useParams } from "react-router-dom";

import { PortalShell } from "@/components/cliente-portal/PortalShell";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { usePortalSalaoByToken } from "@/hooks/usePortalSalaoByToken";

export default function ClientePortalNovoAgendamentoPage() {
  const nav = useNavigate();
  const { token } = useParams();
  const tokenValue = useMemo(() => (typeof token === "string" ? token.trim() : ""), [token]);

  const salaoQuery = usePortalSalaoByToken(tokenValue);

  return (
    <PortalShell
      title="Novo agendamento"
      subtitle={salaoQuery.data ? `Salão: ${salaoQuery.data.nome}` : "Selecione cliente, serviço, profissional e um horário realmente livre."}
      logoUrl={salaoQuery.data?.logo_url}
      onBack={() => nav(`/cliente/${tokenValue}/app`)}
    >
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Em construção</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm text-muted-foreground">
            Próximo passo: vamos reutilizar o mesmo formulário de agendamento, mas limitado ao seu cadastro.
          </p>
          <div className="flex flex-col gap-2 sm:flex-row">
            <Button variant="secondary" onClick={() => nav(`/cliente/${tokenValue}/app`)}>
              Voltar
            </Button>
            <Button onClick={() => nav(`/cliente/${tokenValue}/agendamentos`)}>Ver meus agendamentos</Button>
          </div>
        </CardContent>
      </Card>
    </PortalShell>
  );
}
