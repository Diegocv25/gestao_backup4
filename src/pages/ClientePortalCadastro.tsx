import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate, useParams } from "react-router-dom";

import { PortalShell } from "@/components/cliente-portal/PortalShell";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "@/components/ui/use-toast";

import { portalClienteUpsert, portalLogout, portalMe, setPortalSessionToken } from "@/portal/portal-api";
import { usePortalSalaoByToken } from "@/hooks/usePortalSalaoByToken";

type ClienteForm = {
  nome: string;
  telefone: string;
  email: string;
  data_nascimento: string; // dd/mm/yyyy
};

function formatDataNascimento(dateIso: string | null | undefined): string {
  if (!dateIso) return "";
  const d = new Date(dateIso);
  if (Number.isNaN(d.getTime())) return "";
  const day = String(d.getDate()).padStart(2, "0");
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const year = d.getFullYear();
  return `${day}/${month}/${year}`;
}

function maskDataNascimento(value: string): string {
  const numbers = value.replace(/\D/g, "");
  if (numbers.length <= 2) return numbers;
  if (numbers.length <= 4) return `${numbers.slice(0, 2)}/${numbers.slice(2)}`;
  return `${numbers.slice(0, 2)}/${numbers.slice(2, 4)}/${numbers.slice(4, 8)}`;
}

export default function ClientePortalCadastroPage() {
  const qc = useQueryClient();
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

  const accountEmail = (meQuery.data as any)?.portal_account?.email ?? "";
  const cliente = (meQuery.data as any)?.cliente ?? null;

  const [form, setForm] = useState<ClienteForm>({ nome: "", telefone: "", email: "", data_nascimento: "" });

  useEffect(() => {
    if (!meQuery.data) return;
    setForm({
      nome: String(cliente?.nome ?? ""),
      telefone: String(cliente?.telefone ?? ""),
      email: String(accountEmail ?? cliente?.email ?? ""),
      data_nascimento: formatDataNascimento(cliente?.data_nascimento),
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tokenValue, meQuery.data]);

  const saveMut = useMutation({
    mutationFn: async () => {
      if (!tokenValue) throw new Error("Link inválido");
      if (!form.nome.trim()) throw new Error("Informe o nome");
      if (!form.telefone.trim()) throw new Error("Informe o telefone");
      if (!form.data_nascimento.trim()) throw new Error("Informe a data de nascimento");
      return portalClienteUpsert({
        token: tokenValue,
        nome: form.nome,
        telefone: form.telefone,
        data_nascimento: form.data_nascimento,
      });
    },
    onSuccess: async (data) => {
      if (!data?.ok) throw new Error(data?.error || "Falha ao salvar");
      await qc.invalidateQueries({ queryKey: ["portal-me", tokenValue] });
      toast({ title: "Cadastro salvo" });
      nav(`/cliente/${tokenValue}/app`, { replace: true });
    },
    onError: (e: any) => toast({ title: "Erro", description: String(e?.message ?? e), variant: "destructive" }),
  });

  return (
    <PortalShell
      title="Complete seu cadastro"
      subtitle={salaoQuery.data ? `Salão: ${salaoQuery.data.nome}` : undefined}
      logoUrl={salaoQuery.data?.logo_url}
    >
      {!tokenValue ? (
        <Card>
          <CardContent className="py-6 text-sm text-muted-foreground">Link inválido.</CardContent>
        </Card>
      ) : salaoQuery.isLoading || meQuery.isLoading ? (
        <div className="text-sm text-muted-foreground">Carregando…</div>
      ) : (meQuery.data as any)?.authenticated === false ? (
        <Card>
          <CardContent className="py-6 text-sm text-muted-foreground">Faça login para continuar.</CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Dados do cliente</CardTitle>
          </CardHeader>
          <CardContent>
            <form
              className="grid gap-4"
              onSubmit={(e) => {
                e.preventDefault();
                saveMut.mutate();
              }}
            >
              <div className="grid gap-2">
                <Label htmlFor="nome">Nome</Label>
                <Input id="nome" value={form.nome} onChange={(e) => setForm((p) => ({ ...p, nome: e.target.value }))} required />
              </div>

              <div className="grid gap-2">
                <Label htmlFor="tel">Telefone</Label>
                <Input
                  id="tel"
                  value={form.telefone}
                  onChange={(e) => setForm((p) => ({ ...p, telefone: e.target.value }))}
                  required
                />
              </div>

              <div className="grid gap-2">
                <Label htmlFor="email">Email</Label>
                <Input id="email" type="email" value={form.email} disabled />
                <p className="text-xs text-muted-foreground">O email do cadastro é o mesmo usado no login deste salão.</p>
              </div>

              <div className="grid gap-2">
                <Label htmlFor="data_nascimento">Data de nascimento (dd/mm/yyyy)</Label>
                <Input
                  id="data_nascimento"
                  placeholder="dd/mm/yyyy"
                  maxLength={10}
                  value={form.data_nascimento}
                  onChange={(e) => setForm((p) => ({ ...p, data_nascimento: maskDataNascimento(e.target.value) }))}
                  required
                />
              </div>

              <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
                <Button
                  type="button"
                  variant="secondary"
                  onClick={async () => {
                    try {
                      await portalLogout();
                    } finally {
                      setPortalSessionToken(null);
                      nav(`/cliente/${tokenValue}/entrar`, { replace: true });
                    }
                  }}
                >
                  Sair
                </Button>
                <Button type="submit" disabled={saveMut.isPending}>
                  {saveMut.isPending ? "Salvando…" : "Salvar"}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}
    </PortalShell>
  );
}
