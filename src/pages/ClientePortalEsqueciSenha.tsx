import { useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";

import { PortalShell } from "@/components/cliente-portal/PortalShell";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { toast } from "@/components/ui/use-toast";
import { usePortalSalaoByToken } from "@/hooks/usePortalSalaoByToken";
import { portalPasswordResetRequest } from "@/portal/portal-api";

export default function ClientePortalEsqueciSenhaPage() {
  const nav = useNavigate();
  const { token } = useParams();
  const tokenValue = useMemo(() => (typeof token === "string" ? token.trim() : ""), [token]);
  const salaoQuery = usePortalSalaoByToken(tokenValue);

  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);

  return (
    <PortalShell
      title="Redefinir senha"
      subtitle={salaoQuery.data ? `Salão: ${salaoQuery.data.nome}` : undefined}
      logoUrl={salaoQuery.data?.logo_url}
      onBack={() => nav(`/cliente/${tokenValue}/entrar`)}
    >
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Receber link por e-mail</CardTitle>
        </CardHeader>
        <CardContent>
          <form
            className="grid gap-4"
            onSubmit={async (e) => {
              e.preventDefault();
              try {
                setLoading(true);
                await portalPasswordResetRequest({ token: tokenValue, email });
                toast({
                  title: "Se existir uma conta, enviaremos um e-mail",
                  description: "Verifique sua caixa de entrada e spam.",
                });
                nav(`/cliente/${tokenValue}/entrar`, { replace: true });
              } catch (err: any) {
                toast({ title: "Erro", description: String(err?.message ?? err), variant: "destructive" });
              } finally {
                setLoading(false);
              }
            }}
          >
            <div className="grid gap-2">
              <Label htmlFor="email">Email</Label>
              <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
            </div>

            <div className="flex justify-end">
              <Button type="submit" disabled={loading || !tokenValue}>
                {loading ? "Enviando…" : "Enviar link"}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </PortalShell>
  );
}
