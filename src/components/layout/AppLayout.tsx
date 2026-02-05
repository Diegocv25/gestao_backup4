import { useEffect, useMemo, useRef } from "react";
import { Outlet } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";

import { ThemeToggle } from "@/components/ThemeToggle";
import { AppSidebar } from "@/components/layout/AppSidebar";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/components/ui/use-toast";
import { useEstabelecimentoId } from "@/hooks/useEstabelecimentoId";

export function AppLayout() {
  const seededRef = useRef(false);
  const estabelecimentoIdQuery = useEstabelecimentoId();
  const estabelecimentoId = estabelecimentoIdQuery.data ?? null;

  const estabelecimentoQuery = useQuery({
    queryKey: ["estabelecimento", estabelecimentoId],
    enabled: !!estabelecimentoId,
    staleTime: 1000 * 60 * 5,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("saloes")
        .select("nome,logo_url")
        .eq("id", estabelecimentoId as string)
        .maybeSingle();

      if (error) throw error;
      return data ?? null;
    },
  });

  const headerTitle = useMemo(() => {
    const nome = estabelecimentoQuery.data?.nome ?? null;
    return nome ? `Gestão — ${nome}` : "Gestão";
  }, [estabelecimentoQuery.data?.nome]);

  const watermarkLogoUrl = useMemo(() => {
    // A logo vem do anexo em Configurações (saloes.logo_url)
    return estabelecimentoQuery.data?.logo_url ?? null;
  }, [estabelecimentoQuery.data?.logo_url]);

  useEffect(() => {
    // Sem botão: tenta criar dados fictícios 1x por navegador (função é idempotente)
    if (seededRef.current) return;
    seededRef.current = true;

    const already = localStorage.getItem("demoSeed:v1");
    if (already) return;

    (async () => {
      const { error } = await supabase.functions.invoke("seed-demo-data", { body: {} });
      if (!error) {
        localStorage.setItem("demoSeed:v1", "1");
        toast({ title: "Demo pronta", description: "Dados fictícios carregados para você testar o sistema." });
      }
      // silencia erro (ex.: sem permissão) para evitar travar o app
    })();
  }, []);

  return (
    <SidebarProvider>
      <div className="relative flex min-h-svh w-full bg-background">
        {watermarkLogoUrl ? (
          <div
            className="pointer-events-none fixed inset-0 z-0"
            aria-hidden="true"
            style={{
              // Marca d'água extremamente sutil por cima do bg-background
              opacity: 0.035,
              backgroundImage: `url(${watermarkLogoUrl})`,
              backgroundRepeat: "no-repeat",
              backgroundPosition: "center",
              backgroundSize: "min(70vw, 720px)",
              backgroundAttachment: "fixed",
              filter: "grayscale(1)",
            }}
          />
        ) : null}

        <AppSidebar />

        <div className="relative z-10 flex min-w-0 flex-1 flex-col">
          <header className="sticky top-0 z-20 flex h-12 items-center justify-between border-b bg-background/80 px-3 backdrop-blur">
            <div className="flex items-center gap-2">
              <SidebarTrigger />
              <div className="text-sm font-medium">{headerTitle}</div>
            </div>
            <div className="flex items-center gap-2">
              <ThemeToggle />
            </div>
          </header>

          <main className="flex-1 min-h-0 overflow-auto p-6">
            <Outlet />
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
}
