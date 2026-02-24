import { useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/auth/auth-context";

const PLANS_URL_FALLBACK = "https://gestaobackup4.vercel.app";
const PLANS_URL = (import.meta.env.VITE_PLANS_URL || PLANS_URL_FALLBACK).replace(/\/+$/, "");

export default function AcessoExpirado() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const [accessUntil, setAccessUntil] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const from = (location.state as any)?.from as string | undefined;

  const formattedUntil = useMemo(() => {
    if (!accessUntil) return null;
    try {
      const d = new Date(accessUntil);
      return new Intl.DateTimeFormat("pt-BR", {
        dateStyle: "short",
        timeStyle: "short",
      }).format(d);
    } catch {
      return accessUntil;
    }
  }, [accessUntil]);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      if (!user) {
        setLoading(false);
        return;
      }

      setLoading(true);
      try {
        const { data, error } = await (supabase as any)
          .from("cadastros_estabelecimento")
          .select("acesso_ate")
          .eq("user_id", user.id)
          .maybeSingle();

        if (error) throw error;
        if (!cancelled) setAccessUntil((data?.acesso_ate ?? null) as string | null);
      } catch {
        if (!cancelled) setAccessUntil(null);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [user]);

  return (
    <div className="min-h-screen bg-background">
      <main className="container mx-auto px-4 py-10 md:py-14 max-w-2xl">
        <Card>
          <CardHeader>
            <CardTitle>Acesso expirado</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-muted-foreground">
              Seu período de acesso terminou. Para continuar usando o sistema, renove sua assinatura.
            </p>

            {loading ? (
              <p className="text-sm text-muted-foreground">Carregando informações…</p>
            ) : formattedUntil ? (
              <p className="text-sm text-muted-foreground">Acesso até: {formattedUntil}</p>
            ) : null}

            <div className="flex flex-col gap-3">
              <Button asChild size="lg" className="w-full">
                <a href={PLANS_URL} target="_blank" rel="noreferrer">
                  Renovar / Assinar agora
                </a>
              </Button>

              <Button
                type="button"
                variant="outline"
                className="w-full"
                onClick={() => navigate(from || "/")}
              >
                Voltar
              </Button>
            </div>

            <p className="text-xs text-muted-foreground">
              Se você acabou de pagar e ainda não liberou, aguarde alguns minutos e atualize a página.
            </p>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
