import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";

import { supabase } from "@/integrations/supabase/client";
import { useSalaoId } from "@/hooks/useSalaoId";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { toast } from "@/components/ui/use-toast";
import { FormPageShell } from "@/components/layout/FormPageShell";

export default function ClientesPage() {
  const qc = useQueryClient();
  const nav = useNavigate();
  const { data: salaoId } = useSalaoId();

  const [q, setQ] = useState("");

  const { data, isLoading, error } = useQuery({
    queryKey: ["clientes", { salaoId }],
    enabled: !!salaoId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("clientes")
        .select("id,nome,telefone,email,data_nascimento,created_at,ultima_visita")
        .eq("salao_id", salaoId as string)
        .order("nome");
      if (error) throw error;

      const clientes = (data ?? []) as any[];
      if (clientes.length === 0) return [];

      // Agregações: quantidade de atendimentos (concluídos) + quais serviços teve.
      const { data: ags, error: agErr } = await supabase
        .from("agendamentos")
        .select("id,cliente_id")
        .eq("salao_id", salaoId as string)
        .eq("status", "concluido");
      if (agErr) throw agErr;

      const agendamentos = (ags ?? []) as any[];
      const agendamentoToCliente = new Map<string, string>();
      const countByCliente = new Map<string, number>();
      const agendamentoIds: string[] = [];

      agendamentos.forEach((a) => {
        const agId = String(a.id);
        const cId = String(a.cliente_id);
        agendamentoIds.push(agId);
        agendamentoToCliente.set(agId, cId);
        countByCliente.set(cId, (countByCliente.get(cId) ?? 0) + 1);
      });

      const servicosByCliente = new Map<string, Set<string>>();

      if (agendamentoIds.length > 0) {
        const { data: itens, error: itensErr } = await supabase
          .from("agendamento_itens")
          .select("agendamento_id, servicos(nome), valor")
          .in("agendamento_id", agendamentoIds);
        if (itensErr) throw itensErr;

        (itens ?? []).forEach((it: any) => {
          const agId = String(it.agendamento_id);
          const cId = agendamentoToCliente.get(agId);
          if (!cId) return;
          const nomeServico = String(it?.servicos?.nome ?? "(Serviço)");
          if (!servicosByCliente.has(cId)) servicosByCliente.set(cId, new Set());
          servicosByCliente.get(cId)!.add(nomeServico);
        });
      }

      // Agregação: quantos cancelamentos o cliente já teve (para controle de "furo").
      const { data: cancels, error: cancelErr } = await supabase
        .from("agendamentos")
        .select("cliente_id")
        .eq("salao_id", salaoId as string)
        .eq("status", "cancelado");
      if (cancelErr) throw cancelErr;

      const cancelCountByCliente = new Map<string, number>();
      (cancels ?? []).forEach((r: any) => {
        const cId = String(r.cliente_id);
        cancelCountByCliente.set(cId, (cancelCountByCliente.get(cId) ?? 0) + 1);
      });

      return clientes.map((c) => {
        const cId = String(c.id);
        const servicos = Array.from(servicosByCliente.get(cId) ?? []).sort();
        return {
          ...c,
          atendimentos_count: countByCliente.get(cId) ?? 0,
          atendimentos_servicos: servicos,
          cancelamentos_count: cancelCountByCliente.get(cId) ?? 0,
        };
      });
    },
  });

  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase();
    if (!term) return data ?? [];
    return (data ?? []).filter((c: any) => {
      return (
        c.nome.toLowerCase().includes(term) ||
        (c.telefone ?? "").toLowerCase().includes(term) ||
        (c.email ?? "").toLowerCase().includes(term)
      );
    });
  }, [data, q]);

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("clientes").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ["clientes"] });
      toast({ title: "Cliente removido" });
    },
    onError: (e: any) => toast({ title: "Erro", description: e.message, variant: "destructive" }),
  });

  return (
    <FormPageShell
      title="Clientes"
      description="Cadastro completo (Supabase)."
      actions={
        <>
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar por nome, telefone ou email…" />
          <Button onClick={() => nav("/clientes/novo")}>Novo cliente</Button>
        </>
      }
    >
      {!salaoId ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Antes de começar</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            Cadastre o seu salão em <Button variant="link" className="px-0" onClick={() => nav("/configuracoes")}>Configurações</Button> para liberar os cadastros.
          </CardContent>
        </Card>
      ) : null}

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Lista</CardTitle>
        </CardHeader>
        <CardContent>
          {!salaoId ? <div className="text-sm text-muted-foreground">Configure o salão para ver os clientes.</div> : null}
          {isLoading ? <div className="text-sm text-muted-foreground">Carregando…</div> : null}
          {error ? <div className="text-sm text-destructive">Erro ao carregar.</div> : null}

          {!isLoading && !error && !!salaoId ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nome</TableHead>
                  <TableHead>Telefone</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Data de nascimento</TableHead>
                  <TableHead>Cadastrado em</TableHead>
                  <TableHead>Última visita</TableHead>
                  <TableHead className="text-right">Atendimentos</TableHead>
                  <TableHead className="text-right">Cancelamentos</TableHead>
                  <TableHead>Serviços realizados</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((c: any) => (
                  <TableRow key={c.id}>
                    <TableCell className="font-medium">{c.nome}</TableCell>
                    <TableCell>{c.telefone ?? "—"}</TableCell>
                    <TableCell>{c.email ?? "—"}</TableCell>
                    <TableCell>
                      {c.data_nascimento 
                        ? new Date(c.data_nascimento + 'T00:00:00').toLocaleDateString('pt-BR', {
                            day: '2-digit',
                            month: '2-digit',
                            year: 'numeric'
                          })
                        : "—"}
                    </TableCell>
                    <TableCell>{c.created_at ? String(c.created_at).slice(0, 10) : "—"}</TableCell>
                    <TableCell>{c.ultima_visita ?? "—"}</TableCell>
                    <TableCell className="text-right tabular-nums">{c.atendimentos_count ?? 0}</TableCell>
                    <TableCell className="text-right tabular-nums">{c.cancelamentos_count ?? 0}</TableCell>
                    <TableCell className="max-w-[320px] truncate">
                      {(c.atendimentos_servicos ?? []).length > 0 ? (c.atendimentos_servicos ?? []).join(", ") : "—"}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        <Button variant="secondary" size="sm" onClick={() => nav(`/clientes/${c.id}`)}>
                          Editar
                        </Button>
                        <Button
                          variant="destructive"
                          size="sm"
                          onClick={() => deleteMutation.mutate(c.id)}
                          disabled={deleteMutation.isPending}
                        >
                          Excluir
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}

                {filtered.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={10} className="text-sm text-muted-foreground">
                      Nenhum cliente encontrado.
                    </TableCell>
                  </TableRow>
                ) : null}
              </TableBody>
            </Table>
          ) : null}
        </CardContent>
      </Card>
    </FormPageShell>
  );
}
