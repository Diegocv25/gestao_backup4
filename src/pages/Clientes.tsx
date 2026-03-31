import { Fragment, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { ChevronDown, ChevronUp } from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import { useSalaoId } from "@/hooks/useSalaoId";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { toast } from "@/components/ui/use-toast";
import { FormPageShell } from "@/components/layout/FormPageShell";

function formatDateOnly(value?: string | null) {
  if (!value) return "—";
  const date = new Date(value.includes("T") ? value : `${value}T00:00:00`);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

function formatDateTime(value?: string | null) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatMoney(value?: number | null) {
  if (value == null) return "—";
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(value);
}

function statusLabel(status?: string | null) {
  switch (status) {
    case "concluido":
      return "Concluído";
    case "cancelado":
      return "Cancelado";
    case "marcado":
      return "Marcado";
    case "confirmado":
      return "Confirmado";
    case "faltou":
      return "Faltou";
    default:
      return status || "—";
  }
}

function statusVariant(status?: string | null): "default" | "secondary" | "destructive" | "outline" {
  switch (status) {
    case "concluido":
      return "default";
    case "cancelado":
      return "destructive";
    case "confirmado":
      return "secondary";
    default:
      return "outline";
  }
}

export default function ClientesPage() {
  const qc = useQueryClient();
  const nav = useNavigate();
  const { data: salaoId } = useSalaoId();

  const [q, setQ] = useState("");
  const [expandedClienteId, setExpandedClienteId] = useState<string | null>(null);

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

  const clienteHistoricoQuery = useQuery({
    queryKey: ["cliente-historico", salaoId, expandedClienteId],
    enabled: !!salaoId && !!expandedClienteId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("agendamentos")
        .select(
          "id,data_hora_inicio,status,total_valor,observacoes,funcionario:funcionarios(nome),itens:agendamento_itens(servico:servicos(nome))"
        )
        .eq("salao_id", salaoId as string)
        .eq("cliente_id", expandedClienteId as string)
        .order("data_hora_inicio", { ascending: false });
      if (error) throw error;
      return (data ?? []) as any[];
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

  const toggleHistorico = (clienteId: string) => {
    setExpandedClienteId((current) => (current === clienteId ? null : clienteId));
  };

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
            Cadastre o seu salão em{" "}
            <Button variant="link" className="px-0" onClick={() => nav("/configuracoes")}>
              Configurações
            </Button>{" "}
            para liberar os cadastros.
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
                {filtered.map((c: any) => {
                  const expanded = expandedClienteId === c.id;
                  const historico = expanded ? clienteHistoricoQuery.data ?? [] : [];

                  return (
                    <Fragment key={c.id}>
                      <TableRow className={expanded ? "bg-muted/30" : undefined}>
                        <TableCell className="font-medium">{c.nome}</TableCell>
                        <TableCell>{c.telefone ?? "—"}</TableCell>
                        <TableCell>{c.email ?? "—"}</TableCell>
                        <TableCell>{formatDateOnly(c.data_nascimento)}</TableCell>
                        <TableCell>{formatDateOnly(c.created_at)}</TableCell>
                        <TableCell>{formatDateOnly(c.ultima_visita)}</TableCell>
                        <TableCell className="text-right tabular-nums">{c.atendimentos_count ?? 0}</TableCell>
                        <TableCell className="text-right tabular-nums">{c.cancelamentos_count ?? 0}</TableCell>
                        <TableCell className="max-w-[320px] truncate">
                          {(c.atendimentos_servicos ?? []).length > 0 ? (c.atendimentos_servicos ?? []).join(", ") : "—"}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex flex-wrap justify-end gap-2">
                            <Button variant="outline" size="sm" onClick={() => toggleHistorico(c.id)}>
                              {expanded ? <ChevronUp className="mr-1 h-4 w-4" /> : <ChevronDown className="mr-1 h-4 w-4" />}
                              Histórico
                            </Button>
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

                      {expanded ? (
                        <TableRow>
                          <TableCell colSpan={10} className="bg-muted/10 p-0">
                            <div className="border-t bg-background px-4 py-4 sm:px-6">
                              <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                                <div>
                                  <h4 className="text-sm font-semibold">Histórico do cliente</h4>
                                  <p className="text-sm text-muted-foreground">
                                    Atendimentos, cancelamentos e observações registradas ao longo do tempo.
                                  </p>
                                </div>
                                <div className="text-xs text-muted-foreground">
                                  {clienteHistoricoQuery.isFetching ? "Atualizando histórico…" : `${historico.length} registro(s)`}
                                </div>
                              </div>

                              {clienteHistoricoQuery.isLoading ? (
                                <div className="py-4 text-sm text-muted-foreground">Carregando histórico…</div>
                              ) : null}

                              {clienteHistoricoQuery.error ? (
                                <div className="py-4 text-sm text-destructive">Erro ao carregar o histórico deste cliente.</div>
                              ) : null}

                              {!clienteHistoricoQuery.isLoading && !clienteHistoricoQuery.error && historico.length === 0 ? (
                                <div className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">
                                  Este cliente ainda não possui histórico de agendamentos.
                                </div>
                              ) : null}

                              {!clienteHistoricoQuery.isLoading && !clienteHistoricoQuery.error && historico.length > 0 ? (
                                <div className="space-y-4">
                                  {historico.map((item: any, index: number) => {
                                    const servicos = (item.itens ?? [])
                                      .map((it: any) => String(it?.servico?.nome ?? "(Serviço)"))
                                      .filter(Boolean);

                                    return (
                                      <div key={item.id}>
                                        <div className="grid gap-3 rounded-lg border p-4 md:grid-cols-[1.2fr_1fr]">
                                          <div className="space-y-2">
                                            <div className="flex flex-wrap items-center gap-2">
                                              <Badge variant={statusVariant(item.status)}>{statusLabel(item.status)}</Badge>
                                              <span className="text-sm font-medium">{formatDateTime(item.data_hora_inicio)}</span>
                                            </div>

                                            <div className="grid gap-2 text-sm text-muted-foreground sm:grid-cols-2">
                                              <div>
                                                <span className="font-medium text-foreground">Profissional:</span>{" "}
                                                {item?.funcionario?.nome ?? "—"}
                                              </div>
                                              <div>
                                                <span className="font-medium text-foreground">Valor:</span>{" "}
                                                {formatMoney(item.total_valor)}
                                              </div>
                                            </div>

                                            <div className="text-sm">
                                              <span className="font-medium">Serviços:</span>{" "}
                                              <span className="text-muted-foreground">{servicos.length > 0 ? servicos.join(", ") : "—"}</span>
                                            </div>
                                          </div>

                                          <div className="rounded-md bg-muted/40 p-3 text-sm">
                                            <div className="mb-1 font-medium">Observações</div>
                                            <div className="whitespace-pre-wrap text-muted-foreground">
                                              {item.observacoes?.trim() ? item.observacoes : "Nenhuma observação registrada neste atendimento."}
                                            </div>
                                          </div>
                                        </div>
                                        {index < historico.length - 1 ? <Separator className="my-4" /> : null}
                                      </div>
                                    );
                                  })}
                                </div>
                              ) : null}
                            </div>
                          </TableCell>
                        </TableRow>
                      ) : null}
                    </Fragment>
                  );
                })}

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
