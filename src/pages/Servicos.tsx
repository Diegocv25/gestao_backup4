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

export default function ServicosPage() {
  const qc = useQueryClient();
  const nav = useNavigate();
  const { data: salaoId } = useSalaoId();

  const [q, setQ] = useState("");

  const servicosQuery = useQuery({
    queryKey: ["servicos"],
    queryFn: async () => {
      const { data, error } = await supabase.from("servicos").select("id,nome,duracao_minutos,valor,ativo").order("nome");
      if (error) throw error;
      return data ?? [];
    },
  });

  const linksQuery = useQuery({
    queryKey: ["servicos-funcionarios"],
    queryFn: async () => {
      const { data, error } = await supabase.from("servicos_funcionarios").select("servico_id,funcionario_id");
      if (error) throw error;
      return data ?? [];
    },
  });

  const enriched = useMemo(() => {
    const byServico = new Map<string, string[]>();
    (linksQuery.data ?? []).forEach((l: any) => {
      byServico.set(l.servico_id, [...(byServico.get(l.servico_id) ?? []), l.funcionario_id]);
    });
    return (servicosQuery.data ?? []).map((s: any) => ({ ...s, funcionarioIds: byServico.get(s.id) ?? [] }));
  }, [linksQuery.data, servicosQuery.data]);

  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase();
    if (!term) return enriched;
    return enriched.filter((s: any) => s.nome.toLowerCase().includes(term));
  }, [enriched, q]);

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      await supabase.from("servicos_funcionarios").delete().eq("servico_id", id);
      const { error } = await supabase.from("servicos").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: async () => {
      await Promise.all([
        qc.invalidateQueries({ queryKey: ["servicos"] }),
        qc.invalidateQueries({ queryKey: ["servicos-funcionarios"] }),
      ]);
      toast({ title: "Serviço removido" });
    },
    onError: (e: any) => toast({ title: "Erro", description: e.message, variant: "destructive" }),
  });

  return (
    <FormPageShell
      title="Serviços"
      description="Cadastro + vínculo com profissionais."
      actions={
        <>
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar serviço…" />
          <Button onClick={() => nav("/servicos/novo")}>Novo serviço</Button>
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
          {servicosQuery.isLoading ? <div className="text-sm text-muted-foreground">Carregando…</div> : null}
          {servicosQuery.error ? <div className="text-sm text-destructive">Erro ao carregar.</div> : null}

          {!servicosQuery.isLoading && !servicosQuery.error ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nome</TableHead>
                  <TableHead>Duração</TableHead>
                  <TableHead>Valor</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Profissionais</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((s: any) => (
                  <TableRow key={s.id}>
                    <TableCell className="font-medium">{s.nome}</TableCell>
                    <TableCell>{s.duracao_minutos} min</TableCell>
                    <TableCell>R$ {Number(s.valor).toFixed(2)}</TableCell>
                    <TableCell>{s.ativo ? "Ativo" : "Inativo"}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">{(s.funcionarioIds ?? []).length}</TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        <Button variant="secondary" size="sm" onClick={() => nav(`/servicos/${s.id}`)}>
                          Editar
                        </Button>
                        <Button
                          variant="destructive"
                          size="sm"
                          onClick={() => deleteMutation.mutate(s.id)}
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
                    <TableCell colSpan={6} className="text-sm text-muted-foreground">
                      Nenhum serviço encontrado.
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
