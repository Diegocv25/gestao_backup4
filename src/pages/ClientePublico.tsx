import { useEffect, useMemo } from "react";
import { useNavigate, useParams } from "react-router-dom";

import { usePortalSalaoByToken } from "@/hooks/usePortalSalaoByToken";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export default function ClientePublicoPage() {
  const nav = useNavigate();
  const { token } = useParams();

  const tokenValue = useMemo(() => (typeof token === "string" ? token.trim() : ""), [token]);

  // Fluxo desejado: ao abrir o link público, direcionar imediatamente para login/cadastro.
  useEffect(() => {
    if (!tokenValue) return;
    nav(`/cliente/${tokenValue}/entrar`, { replace: true });
  }, [nav, tokenValue]);

  // Valida o link via RPC (SECURITY DEFINER) para não depender de SELECT direto em `saloes` (RLS).
  const salaoQuery = usePortalSalaoByToken(tokenValue);

  return (
    <main className="mx-auto flex min-h-[calc(100vh-3rem)] max-w-lg items-center px-4 py-10">
      <Card className="w-full">
        <CardHeader>
          <CardTitle className="text-xl">Portal do cliente</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {salaoQuery.isLoading ? <p className="text-sm text-muted-foreground">Carregando…</p> : null}

          {tokenValue.length === 0 ? (
            <p className="text-sm text-muted-foreground">Link inválido. Solicite um novo link ao salão.</p>
          ) : salaoQuery.isError ? (
            <p className="text-sm text-destructive">Erro ao validar link.</p>
          ) : !salaoQuery.isLoading && !salaoQuery.data ? (
            <p className="text-sm text-muted-foreground">Link não encontrado ou expirado. Solicite um novo link ao salão.</p>
          ) : (
            <>
              <p className="text-sm text-muted-foreground">
                {salaoQuery.data ? (
                  <>
                    Você está acessando o portal do salão <span className="font-medium text-foreground">{salaoQuery.data.nome}</span>.
                  </>
                ) : (
                  "Para continuar, entre ou crie sua conta."
                )}
              </p>
              <div className="flex flex-col gap-2 sm:flex-row">
                <Button onClick={() => nav(`/cliente/${tokenValue}/entrar`)}>Entrar</Button>
                <Button variant="secondary" onClick={() => nav(`/cliente/${tokenValue}/primeiro-acesso`)}>
                  Primeiro acesso
                </Button>
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </main>
  );
}
