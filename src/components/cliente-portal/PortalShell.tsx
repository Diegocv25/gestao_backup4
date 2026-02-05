import * as React from "react";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

export function PortalShell({
  title,
  subtitle,
  children,
  onBack,
  onLogout,
  maxWidth = "2xl",
  logoUrl,
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  onBack?: () => void;
  onLogout?: () => void;
  maxWidth?: "2xl" | "3xl";
  logoUrl?: string | null;
}) {
  const widthClass = maxWidth === "3xl" ? "max-w-3xl" : "max-w-2xl";

  return (
    <div className="relative min-h-[calc(100vh-3rem)]">
      {logoUrl ? (
        <div
          className="pointer-events-none fixed inset-0 z-0"
          aria-hidden="true"
          style={{
            // Marca d'água extremamente sutil por cima do bg-background
            opacity: 0.035,
            backgroundImage: `url(${logoUrl})`,
            backgroundRepeat: "no-repeat",
            backgroundPosition: "center",
            backgroundSize: "min(70vw, 720px)",
            backgroundAttachment: "fixed",
            filter: "grayscale(1)",
          }}
        />
      ) : null}

      <main className={`relative z-10 mx-auto ${widthClass} px-4 py-10`}>
        <header className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex min-w-0 items-start gap-3">
            {logoUrl ? (
              <Card className="h-12 w-12 shrink-0 overflow-hidden">
                <img
                  src={logoUrl}
                  alt="Logo do salão"
                  className="h-full w-full object-contain p-2"
                  loading="lazy"
                />
              </Card>
            ) : null}

            <div className="min-w-0">
              <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
              {subtitle ? <p className="text-sm text-muted-foreground">{subtitle}</p> : null}
            </div>
          </div>

          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            {onBack ? (
              <Button variant="secondary" onClick={onBack}>
                Voltar
              </Button>
            ) : null}
            {onLogout ? (
              <Button variant="secondary" onClick={onLogout}>
                Sair
              </Button>
            ) : null}
          </div>
        </header>
        {children}
      </main>
    </div>
  );
}
