import { useMemo, useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";

import { PortalShell } from "@/components/cliente-portal/PortalShell";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { toast } from "@/components/ui/use-toast";
import { strongPasswordSchema } from "@/lib/password-policy";
import { portalPasswordResetConfirm } from "@/portal/portal-api";
import { PasswordInput } from "@/components/ui/password-input";
import { usePortalSalaoByToken } from "@/hooks/usePortalSalaoByToken";

export default function ClientePortalResetarSenhaPage() {
  const nav = useNavigate();
  const { token } = useParams();
  const [search] = useSearchParams();

  const tokenValue = useMemo(() => (typeof token === "string" ? token.trim() : ""), [token]);
  const code = search.get("code") ?? "";

  const salaoQuery = usePortalSalaoByToken(tokenValue);

  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);

  return (
    <PortalShell
      title="Nova senha"
      subtitle={salaoQuery.data ? `Salão: ${salaoQuery.data.nome}` : undefined}
      logoUrl={salaoQuery.data?.logo_url}
      onBack={() => nav(`/cliente/${tokenValue}/entrar`)}
    >
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Defina sua nova senha</CardTitle>
        </CardHeader>
        <CardContent>
          {!code ? (
            <p className="text-sm text-muted-foreground">Código inválido. Solicite um novo link.</p>
          ) : (
            <form
              className="grid gap-4"
              onSubmit={async (e) => {
                e.preventDefault();
                try {
                  const pw = strongPasswordSchema.safeParse(password);
                  if (!pw.success) throw new Error(pw.error.issues[0]?.message ?? "Senha inválida");
                  if (password !== confirmPassword) throw new Error("As senhas não conferem");

                  setLoading(true);
                  const resp = await portalPasswordResetConfirm({ token: tokenValue, code, password, confirmPassword });
                  if (!resp.ok) throw new Error(resp.error || "Falha ao redefinir senha");
                  toast({ title: "Senha atualizada" });
                  nav(`/cliente/${tokenValue}/entrar`, { replace: true });
                } catch (err: any) {
                  toast({ title: "Erro", description: String(err?.message ?? err), variant: "destructive" });
                } finally {
                  setLoading(false);
                }
              }}
            >
              <div className="grid gap-2">
                <Label htmlFor="password">Senha</Label>
                <PasswordInput id="password" value={password} onChange={(e) => setPassword(e.target.value)} required />
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
              <div className="flex justify-end">
                <Button type="submit" disabled={loading || !tokenValue}>
                  {loading ? "Salvando…" : "Salvar"}
                </Button>
              </div>
            </form>
          )}
        </CardContent>
      </Card>
    </PortalShell>
  );
}
