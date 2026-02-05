import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";

import { supabase } from "@/integrations/supabase/client";
import { useAccess } from "@/auth/access-context";
import { FormPageShell } from "@/components/layout/FormPageShell";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";

export default function ProfissionalComissoesPage() {
  const { funcionarioId } = useAccess();
  const [q, setQ] = useState("");

  const comissoesQuery = useQuery({
    queryKey: ["comissoes-prof", funcionarioId],
    enabled: !!funcionarioId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("comissoes")
        .select("id,agendamento_id,created_at,pago_em,base_valor,valor_calculado")
        .eq("funcionario_id", funcionarioId as string)
        .order("created_at", { ascending: false })
        .limit(200);
      if (error) throw error;
      return data ?? [];
    },
  });

  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase();
    if (!term) return comissoesQuery.data ?? [];
    return (comissoesQuery.data ?? []).filter((c: any) => String(c.agendamento_id ?? "").toLowerCase().includes(term));
  }, [comissoesQuery.data, q]);

  return (
    <FormPageShell
      title="Minhas comissões"
      description="Histórico de comissões geradas nos seus atendimentos."
      actions={<Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar por ID do agendamento…" />}
    >
      {!funcionarioId ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Acesso não configurado</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">Seu usuário não está vinculado a um funcionário.</CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Lista</CardTitle>
          </CardHeader>
          <CardContent>
            {comissoesQuery.isLoading ? <div className="text-sm text-muted-foreground">Carregando…</div> : null}
            {comissoesQuery.error ? <div className="text-sm text-destructive">Erro ao carregar.</div> : null}

            {!comissoesQuery.isLoading && !comissoesQuery.error ? (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Data</TableHead>
                    <TableHead>Agendamento</TableHead>
                    <TableHead className="text-right">Base</TableHead>
                    <TableHead className="text-right">Comissão</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map((c: any) => {
                    const createdAt = c.created_at ? new Date(c.created_at) : null;
                    const pagoEm = c.pago_em ? new Date(c.pago_em) : null;
                    return (
                      <TableRow key={c.id}>
                        <TableCell>{createdAt ? format(createdAt, "dd/MM/yyyy") : "—"}</TableCell>
                        <TableCell className="font-mono text-xs">{String(c.agendamento_id ?? "—")}</TableCell>
                        <TableCell className="text-right">R$ {Number(c.base_valor ?? 0).toFixed(2)}</TableCell>
                        <TableCell className="text-right">R$ {Number(c.valor_calculado ?? 0).toFixed(2)}</TableCell>
                        <TableCell>{pagoEm ? `Pago em ${format(pagoEm, "dd/MM/yyyy")}` : "Pendente"}</TableCell>
                      </TableRow>
                    );
                  })}

                  {filtered.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={5} className="text-sm text-muted-foreground">
                        Nenhuma comissão encontrada.
                      </TableCell>
                    </TableRow>
                  ) : null}
                </TableBody>
              </Table>
            ) : null}
          </CardContent>
        </Card>
      )}
    </FormPageShell>
  );
}
