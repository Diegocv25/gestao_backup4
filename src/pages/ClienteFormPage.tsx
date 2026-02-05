import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate, useParams } from "react-router-dom";

import { supabase } from "@/integrations/supabase/client";
import { useSalaoId } from "@/hooks/useSalaoId";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { format } from "date-fns";
import { toast } from "@/components/ui/use-toast";
import { FormPageShell } from "@/components/layout/FormPageShell";

type ClienteForm = {
  id?: string;
  nome: string;
  telefone?: string;
  email?: string;
  data_nascimento?: string;
};

// Converte dd/mm/yyyy para Date ou null
function parseDataNascimento(value: string): Date | null {
  if (!value || value.trim() === "") return null;
  const parts = value.split("/");
  if (parts.length !== 3) return null;
  const day = parseInt(parts[0], 10);
  const month = parseInt(parts[1], 10) - 1; // JS months are 0-indexed
  const year = parseInt(parts[2], 10);
  if (isNaN(day) || isNaN(month) || isNaN(year)) return null;
  const date = new Date(year, month, day);
  if (date.getDate() !== day || date.getMonth() !== month || date.getFullYear() !== year) return null;
  return date;
}

// Converte Date para dd/mm/yyyy
function formatDataNascimento(date: Date | string | null): string {
  if (!date) return "";
  const d = typeof date === "string" ? new Date(date) : date;
  if (isNaN(d.getTime())) return "";
  const day = String(d.getDate()).padStart(2, "0");
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const year = d.getFullYear();
  return `${day}/${month}/${year}`;
}

// Aplica máscara dd/mm/yyyy enquanto digita
function maskDataNascimento(value: string): string {
  // Remove tudo que não é número
  const numbers = value.replace(/\D/g, "");
  
  // Aplica a máscara progressivamente
  if (numbers.length <= 2) {
    return numbers;
  } else if (numbers.length <= 4) {
    return `${numbers.slice(0, 2)}/${numbers.slice(2)}`;
  } else {
    return `${numbers.slice(0, 2)}/${numbers.slice(2, 4)}/${numbers.slice(4, 8)}`;
  }
}

export default function ClienteFormPage() {
  const qc = useQueryClient();
  const nav = useNavigate();
  const { id } = useParams();
  const editingId = id && id !== "novo" ? id : null;

  const { data: salaoId } = useSalaoId();

  const [form, setForm] = useState<ClienteForm>({ nome: "", telefone: "", email: "", data_nascimento: "" });

  const clienteQuery = useQuery({
    queryKey: ["cliente", editingId],
    enabled: !!editingId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("clientes")
        .select("id,nome,telefone,email,data_nascimento")
        .eq("id", editingId as string)
        .maybeSingle();
      if (error) throw error;
      if (!data) throw new Error("Cliente não encontrado");
      return data;
    },
  });

  useEffect(() => {
    if (!editingId) return;
    if (!clienteQuery.data) return;
    setForm({
      id: clienteQuery.data.id,
      nome: clienteQuery.data.nome,
      telefone: clienteQuery.data.telefone ?? "",
      email: clienteQuery.data.email ?? "",
      data_nascimento: formatDataNascimento(clienteQuery.data.data_nascimento),
    });
  }, [clienteQuery.data, editingId]);

  const upsertMutation = useMutation({
    mutationFn: async (payload: ClienteForm) => {
      if (!salaoId) throw new Error("Cadastre o salão em Configurações antes.");

      const normalizedEmail = (payload.email ?? "").trim();
      if (normalizedEmail.length > 0) {
        let q = supabase
          .from("clientes")
          .select("id")
          .eq("salao_id", salaoId)
          // ilike sem wildcards funciona como equals case-insensitive
          .ilike("email", normalizedEmail)
          .limit(1);

        if (payload.id) q = q.neq("id", payload.id);

        const { data: existing, error: existingError } = await q.maybeSingle();
        if (existingError) throw existingError;
        if (existing) {
          throw new Error("Já existe um cliente com este email neste salão.");
        }
      }

      const dataNascimento = parseDataNascimento(payload.data_nascimento || "");
      const { error } = await supabase.from("clientes").upsert({
        id: payload.id,
        salao_id: salaoId,
        nome: payload.nome.trim(),
        telefone: payload.telefone?.trim() || null,
        email: normalizedEmail || null,
        data_nascimento: dataNascimento ? format(dataNascimento, "yyyy-MM-dd") : null,
      });
      if (error) throw error;
    },
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ["clientes"] });
      toast({ title: "Cliente salvo" });
      nav("/clientes");
    },
    onError: (e: any) => toast({ title: "Erro", description: e.message, variant: "destructive" }),
  });

  const loading = clienteQuery.isLoading;
  const loadError = clienteQuery.error as any;

  return (
    <FormPageShell
      title={editingId ? "Editar cliente" : "Novo cliente"}
      actions={
        <>
          <Button variant="secondary" onClick={() => nav("/clientes")}>Voltar</Button>
          <Button
            onClick={() => {
              if (!form.nome.trim()) return toast({ title: "Informe o nome" });
              upsertMutation.mutate(form);
            }}
            disabled={upsertMutation.isPending || loading}
          >
            {upsertMutation.isPending ? "Salvando…" : "Salvar"}
          </Button>
        </>
      }
    >
      {!salaoId ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Salão não cadastrado</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            Vá em <Button variant="link" className="px-0" onClick={() => nav("/configuracoes")}>Configurações</Button> e cadastre o salão para liberar este formulário.
          </CardContent>
        </Card>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Dados do cliente</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? <div className="text-sm text-muted-foreground">Carregando…</div> : null}
          {loadError ? <div className="text-sm text-destructive">{loadError.message}</div> : null}

          <form
            className="grid gap-4"
            onSubmit={(e) => {
              e.preventDefault();
              if (!form.nome.trim()) return toast({ title: "Informe o nome" });
              upsertMutation.mutate(form);
            }}
          >
            <div className="grid gap-2">
              <Label htmlFor="nome">Nome</Label>
              <Input id="nome" value={form.nome} onChange={(e) => setForm((p) => ({ ...p, nome: e.target.value }))} />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="tel">Telefone</Label>
              <Input id="tel" value={form.telefone ?? ""} onChange={(e) => setForm((p) => ({ ...p, telefone: e.target.value }))} />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                value={form.email ?? ""}
                onChange={(e) => setForm((p) => ({ ...p, email: e.target.value }))}
              />
            </div>
          <div className="grid gap-2">
            <Label htmlFor="data_nascimento">Data de nascimento (dd/mm/yyyy)</Label>
            <Input
              id="data_nascimento"
              placeholder="dd/mm/yyyy"
              maxLength={10}
              value={form.data_nascimento ?? ""}
              onChange={(e) => setForm((p) => ({ ...p, data_nascimento: maskDataNascimento(e.target.value) }))}
            />
          </div>

            <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <Button type="button" variant="secondary" onClick={() => nav("/clientes")}>Cancelar</Button>
              <Button type="submit" disabled={upsertMutation.isPending || loading}>
                {upsertMutation.isPending ? "Salvando…" : "Salvar"}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </FormPageShell>
  );
}
