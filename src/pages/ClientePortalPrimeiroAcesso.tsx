import { useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";

import { PortalShell } from "@/components/cliente-portal/PortalShell";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { toast } from "@/components/ui/use-toast";
import { usePortalSalaoByToken } from "@/hooks/usePortalSalaoByToken";
import { portalRegister, setPortalSessionToken } from "@/portal/portal-api";
import { strongPasswordSchema } from "@/lib/password-policy";
import { PasswordInput } from "@/components/ui/password-input";

export default function ClientePortalPrimeiroAcessoPage() {
  const nav = useNavigate();
  const { token } = useParams();
  const tokenValue = useMemo(() => (typeof token === "string" ? token.trim() : ""), [token]);
  const salaoQuery = usePortalSalaoByToken(tokenValue);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);

  return (
    <PortalShell
      title="Primeiro acesso"
      subtitle={salaoQuery.data ? `Salão: ${salaoQuery.data.nome}` : undefined}
      logoUrl={salaoQuery.data?.logo_url}
      onBack={() => nav(`/cliente/${tokenValue}`)}
    >
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Crie sua senha</CardTitle>
        </CardHeader>
        <CardContent>
          <form
            className="grid gap-4"
            onSubmit={async (e) => {
              e.preventDefault();
              try {
                const pw = strongPasswordSchema.safeParse(password);
                if (!pw.success) throw new Error(pw.error.issues[0]?.message ?? "Senha inválida");
                if (password !== confirmPassword) throw new Error("As senhas não conferem");

                setLoading(true);
                const resp = await portalRegister({ token: tokenValue, email, password, confirmPassword });
                if (!resp.ok) throw new Error(resp.error || "Falha ao cadastrar");
                  // Fase 1: após criar conta, volta para a tela de login (sem auto-login)
                  setPortalSessionToken(null);
                  nav(`/cliente/${tokenValue}/entrar`, { replace: true });
              } catch (err: any) {
                toast({
                  title: "Não foi possível concluir",
                  description: String(err?.message ?? err),
                  variant: "destructive",
                });
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
              <p className="text-xs text-muted-foreground">Mín. 8 chars, 1 letra maiúscula e 1 número.</p>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="confirmPassword">Confirmar senha</Label>
              <PasswordInput
                id="confirmPassword"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
              />
            </div>

            <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <Button type="button" variant="secondary" onClick={() => nav(`/cliente/${tokenValue}/entrar`)}>
                Já tenho conta
              </Button>
              <Button type="submit" disabled={loading || !tokenValue}>
                {loading ? "Criando…" : "Criar acesso"}
              </Button>
            </div>

            <div className="text-sm text-muted-foreground">
              Depois de criar, você fará login para continuar.
            </div>
          </form>
        </CardContent>
      </Card>
    </PortalShell>
  );
}
