import { useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";

import { PortalShell } from "@/components/cliente-portal/PortalShell";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { toast } from "@/components/ui/use-toast";
import { usePortalSalaoByToken } from "@/hooks/usePortalSalaoByToken";
import { portalLogin, setPortalSessionToken } from "@/portal/portal-api";
import { PasswordInput } from "@/components/ui/password-input";

export default function ClientePortalEntrarPage() {
  const nav = useNavigate();
  const { token } = useParams();
  const tokenValue = useMemo(() => (typeof token === "string" ? token.trim() : ""), [token]);

  const salaoQuery = usePortalSalaoByToken(tokenValue);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  return (
    <PortalShell
      title="Entrar"
      subtitle={salaoQuery.data ? `Salão: ${salaoQuery.data.nome}` : undefined}
      logoUrl={salaoQuery.data?.logo_url}
      onBack={() => nav(`/cliente/${tokenValue}`)}
    >
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Acesse sua conta</CardTitle>
        </CardHeader>
        <CardContent>
          <form
            className="grid gap-4"
            onSubmit={async (e) => {
              e.preventDefault();
              try {
                setLoading(true);
                const resp = await portalLogin({ token: tokenValue, email, password });
                if (!resp.ok) throw new Error(resp.error || "Falha ao entrar");
                if (resp.session_token) setPortalSessionToken(resp.session_token);
                // Após login: cai na Home do portal; caso falte cadastro de cliente, o PortalGate redireciona para /cadastro.
                nav(`/cliente/${tokenValue}/app`, { replace: true });
              } catch (err: any) {
                const msg = String(err?.message ?? err);
                toast({ title: "Não foi possível entrar", description: msg, variant: "destructive" });
              } finally {
                setLoading(false);
              }
            }}
          >
            <div className="grid gap-2">
              <Label htmlFor="email">Email</Label>
              <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="password">Senha</Label>
              <PasswordInput id="password" value={password} onChange={(e) => setPassword(e.target.value)} required />
            </div>

            <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <Button type="button" variant="secondary" onClick={() => nav(`/cliente/${tokenValue}/esqueci`)}>
                Esqueci minha senha
              </Button>
              <Button type="submit" disabled={loading || !tokenValue}>
                {loading ? "Entrando…" : "Entrar"}
              </Button>
            </div>

            <div className="text-sm text-muted-foreground">
              Primeiro acesso?{" "}
              <button
                type="button"
                className="underline underline-offset-4"
                onClick={() => nav(`/cliente/${tokenValue}/primeiro-acesso`)}
              >
                Crie sua senha
              </button>
              .
            </div>
          </form>
        </CardContent>
      </Card>
    </PortalShell>
  );
}
