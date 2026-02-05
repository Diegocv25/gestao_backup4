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
import { CreateStaffAccessDialog } from "@/components/funcionarios/CreateStaffAccessDialog";
import { useAccess } from "@/auth/access-context";

export default function FuncionariosPage() {
  const qc = useQueryClient();
  const nav = useNavigate();
  const { data: salaoId } = useSalaoId();
  const { role } = useAccess();

  const [q, setQ] = useState("");

  const funcionariosQuery = useQuery({
    queryKey: ["funcionarios"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("funcionarios")
        .select(
          "id,nome,carga,telefone,email,ativo,auth_user_id,recebe_salario_fixo,salario_fixo_mensal,comissao_tipo,comissao_percentual,comissao_valor_fixo",
        )
        .order("nome");
      if (error) throw error;
      return data ?? [];
    },
  });

  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase();
    if (!term) return funcionariosQuery.data ?? [];
    return (funcionariosQuery.data ?? []).filter((f: any) =>
      [f.nome, f.telefone ?? "", f.email ?? ""].join(" ").toLowerCase().includes(term),
    );
  }, [funcionariosQuery.data, q]);

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      await supabase.from("horarios_funcionario").delete().eq("funcionario_id", id);
      const { error } = await supabase.from("funcionarios").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: async () => {
      await Promise.all([
        qc.invalidateQueries({ queryKey: ["funcionarios"] }),
        qc.invalidateQueries({ queryKey: ["horarios_funcionario"] }),
      ]);
      toast({ title: "Funcionário removido" });
    },
    onError: (e: any) => toast({ title: "Erro", description: e.message, variant: "destructive" }),
  });

  return (
    <FormPageShell
      title="Funcionários"
      description="Cadastro + comissão + horários por dia."
      actions={
        <>
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar funcionário…" />
          <Button onClick={() => nav("/funcionarios/novo")}>Novo funcionário</Button>
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
          {funcionariosQuery.isLoading ? <div className="text-sm text-muted-foreground">Carregando…</div> : null}
          {funcionariosQuery.error ? <div className="text-sm text-destructive">Erro ao carregar.</div> : null}

          {!funcionariosQuery.isLoading && !funcionariosQuery.error ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nome</TableHead>
                  <TableHead>Cargo</TableHead>
                  <TableHead>Telefone</TableHead>
                  <TableHead>Salário</TableHead>
                  <TableHead>Comissão</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((f: any) => {
                  const salario = Number(f.salario_fixo_mensal ?? 0);
                  const comissaoPercentual = Number(f.comissao_percentual ?? 0);
                  return (
                    <TableRow key={f.id}>
                      <TableCell className="font-medium">{f.nome}</TableCell>
                      <TableCell>{f.carga ?? "—"}</TableCell>
                      <TableCell>{f.telefone ?? "—"}</TableCell>
                      <TableCell>{salario > 0 ? `R$ ${salario.toFixed(2)}` : "—"}</TableCell>
                      <TableCell>{comissaoPercentual > 0 ? `${comissaoPercentual.toFixed(0)}%` : "—"}</TableCell>
                      <TableCell>{f.ativo ? "Ativo" : "Inativo"}</TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          {f.auth_user_id ? (
                            role === "admin" ? (
                              <CreateStaffAccessDialog
                                funcionarioId={f.id}
                                defaultEmail={f.email}
                                funcionarioCargo={f.carga}
                                mode="update"
                                disabled={!salaoId}
                              />
                            ) : (
                              <Button variant="outline" size="sm" disabled>
                                Acesso OK
                              </Button>
                            )
                          ) : (
                            <CreateStaffAccessDialog
                              funcionarioId={f.id}
                              defaultEmail={f.email}
                              funcionarioCargo={f.carga}
                              disabled={!salaoId}
                            />
                          )}
                          <Button variant="secondary" size="sm" onClick={() => nav(`/funcionarios/${f.id}`)}>
                            Editar
                          </Button>
                          <Button
                            variant="destructive"
                            size="sm"
                            onClick={() => deleteMutation.mutate(f.id)}
                            disabled={deleteMutation.isPending}
                          >
                            Excluir
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}

                {filtered.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-sm text-muted-foreground">
                      Nenhum funcionário encontrado.
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
