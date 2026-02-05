import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { supabase } from "@/integrations/supabase/client";
import { useSalaoId } from "@/hooks/useSalaoId";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

import { formatBRL, safeNumber } from "@/pages/relatorios/relatorios-utils";
import { useToast } from "@/hooks/use-toast";

type FormaPagamento = "pix" | "dinheiro" | "cartao";

type FuncRow = { id: string; nome: string; salario_fixo_mensal: number };

export function SalariosPagosCard({ competencia }: { competencia: string }) {
  const { data: salaoId } = useSalaoId();
  const qc = useQueryClient();
  const { toast } = useToast();

  const competenciaDate = useMemo(() => {
    // competencia yyyy-MM -> yyyy-MM-01
    return `${competencia}-01`;
  }, [competencia]);

  const funcionariosQuery = useQuery({
    queryKey: ["relatorios", "salarios", "funcionarios_fixos", { salaoId }],
    enabled: !!salaoId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("funcionarios")
        .select("id,nome,salario_fixo_mensal")
        .eq("salao_id", salaoId as string)
        .eq("ativo", true)
        .gt("salario_fixo_mensal", 0)
        .order("nome", { ascending: true });
      if (error) throw error;
      return (data ?? []).map((r: any) => ({
        id: String(r.id),
        nome: String(r.nome ?? ""),
        salario_fixo_mensal: safeNumber(r.salario_fixo_mensal),
      })) as FuncRow[];
    },
  });

  const pagamentosQuery = useQuery({
    queryKey: ["relatorios", "salarios", "pagamentos", { salaoId, competenciaDate }],
    enabled: !!salaoId && !!competencia,
    queryFn: async () => {
      // tabela nova não está tipada no Database; usamos any.
      const { data, error } = await (supabase as any)
        .from("pagamentos_salarios")
        .select("id,funcionario_id,competencia,valor,pago_em,forma_pagamento")
        .eq("salao_id", salaoId as string)
        .eq("competencia", competenciaDate);

      if (error) throw error;
      const rows = (data ?? []) as any[];
      const byFuncionario = new Map<string, any>();
      for (const r of rows) byFuncionario.set(String(r.funcionario_id), r);
      return { byFuncionario };
    },
  });

  const marcarPago = useMutation({
    mutationFn: async (b: { funcionario_id: string; valor: number; pago_em: string; forma_pagamento: FormaPagamento }) => {
      const payload = {
        salao_id: salaoId as string,
        funcionario_id: b.funcionario_id,
        competencia: competenciaDate,
        valor: b.valor,
        pago_em: b.pago_em,
        forma_pagamento: b.forma_pagamento,
      };
      const { error } = await (supabase as any).from("pagamentos_salarios").upsert(payload, {
        onConflict: "salao_id,funcionario_id,competencia",
      });
      if (error) throw error;
    },
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ["relatorios", "salarios"] });
      toast({ title: "Salário marcado como pago" });
    },
    onError: (e: any) => toast({ title: "Erro ao marcar salário", description: String(e?.message ?? ""), variant: "destructive" }),
  });

  const desmarcarPago = useMutation({
    mutationFn: async (b: { funcionario_id: string }) => {
      const { error } = await (supabase as any)
        .from("pagamentos_salarios")
        .delete()
        .eq("salao_id", salaoId as string)
        .eq("funcionario_id", b.funcionario_id)
        .eq("competencia", competenciaDate);
      if (error) throw error;
    },
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ["relatorios", "salarios"] });
      toast({ title: "Pagamento removido" });
    },
    onError: (e: any) => toast({ title: "Erro ao remover pagamento", description: String(e?.message ?? ""), variant: "destructive" }),
  });

  const totalPago = useMemo(() => {
    const funcs = funcionariosQuery.data ?? [];
    const by = pagamentosQuery.data?.byFuncionario;
    if (!by) return 0;
    return funcs.reduce((acc, f) => {
      const p = by.get(f.id);
      return acc + (p ? safeNumber(p.valor) : 0);
    }, 0);
  }, [funcionariosQuery.data, pagamentosQuery.data]);

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base">Pagamentos de salários (mês)</CardTitle>
        <div className="text-xs text-muted-foreground">Total pago: {formatBRL(totalPago)}</div>
      </CardHeader>
      <CardContent>
        {funcionariosQuery.isLoading ? <div className="text-xs text-muted-foreground">Carregando…</div> : null}
        {funcionariosQuery.error ? <div className="text-xs text-destructive">Erro ao carregar funcionários.</div> : null}

        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Funcionário</TableHead>
              <TableHead className="text-right">Salário fixo</TableHead>
              <TableHead className="text-right">Status</TableHead>
              <TableHead className="text-right">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {(funcionariosQuery.data ?? []).map((f) => (
              <SalarioRow
                key={f.id}
                funcionario={f}
                pagamento={pagamentosQuery.data?.byFuncionario?.get(f.id)}
                onMarkPaid={(b) => marcarPago.mutate({ funcionario_id: f.id, valor: f.salario_fixo_mensal, ...b })}
                onUnmarkPaid={() => desmarcarPago.mutate({ funcionario_id: f.id })}
                busy={marcarPago.isPending || desmarcarPago.isPending}
              />
            ))}
            {(funcionariosQuery.data ?? []).length === 0 && !funcionariosQuery.isLoading ? (
              <TableRow>
                <TableCell colSpan={4} className="text-sm text-muted-foreground">
                  Nenhum funcionário com salário fixo.
                </TableCell>
              </TableRow>
            ) : null}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}

function SalarioRow({
  funcionario,
  pagamento,
  onMarkPaid,
  onUnmarkPaid,
  busy,
}: {
  funcionario: FuncRow;
  pagamento: any;
  onMarkPaid: (b: { pago_em: string; forma_pagamento: FormaPagamento }) => void;
  onUnmarkPaid: () => void;
  busy: boolean;
}) {
  const pago = !!pagamento;
  const defaultDate = useMemo(() => new Date().toISOString().slice(0, 10), []);
  const [pagoEmDate, setPagoEmDate] = useState(defaultDate);
  const [forma, setForma] = useState<FormaPagamento>("dinheiro");

  return (
    <TableRow>
      <TableCell className="font-medium">{funcionario.nome}</TableCell>
      <TableCell className="text-right">{formatBRL(funcionario.salario_fixo_mensal)}</TableCell>
      <TableCell className="text-right">
        {pago ? `Pago (${String(pagamento?.forma_pagamento ?? "-")})` : "Pendente"}
      </TableCell>
      <TableCell className="text-right">
        {pago ? (
          <Button type="button" variant="outline" onClick={onUnmarkPaid} disabled={busy}>
            Desfazer
          </Button>
        ) : (
          <Dialog>
            <DialogTrigger asChild>
              <Button type="button" variant="secondary" disabled={busy}>
                Marcar pago
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Pagamento de salário</DialogTitle>
              </DialogHeader>
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-1">
                  <Label>Data de pagamento</Label>
                  <Input type="date" value={pagoEmDate} onChange={(e) => setPagoEmDate(e.target.value)} />
                </div>
                <div className="space-y-1">
                  <Label>Forma</Label>
                  <Select value={forma} onValueChange={(v) => setForma(v as FormaPagamento)}>
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="pix">Pix</SelectItem>
                      <SelectItem value="dinheiro">Dinheiro</SelectItem>
                      <SelectItem value="cartao">Cartão</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <DialogFooter>
                <Button
                  type="button"
                  onClick={() => {
                    const pagoEmIso = `${pagoEmDate}T00:00:00.000Z`;
                    onMarkPaid({ pago_em: pagoEmIso, forma_pagamento: forma });
                  }}
                >
                  Confirmar
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        )}
      </TableCell>
    </TableRow>
  );
}
