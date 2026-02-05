import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate, useParams } from "react-router-dom";

import { supabase } from "@/integrations/supabase/client";
import { useSalaoId } from "@/hooks/useSalaoId";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "@/components/ui/use-toast";
import { FormPageShell } from "@/components/layout/FormPageShell";

type ServicoForm = {
  id?: string;
  nome: string;
  duracao_minutos: number;
  valor: number;
  ativo: boolean;
  funcionarioIds: string[];
};

export default function ServicoFormPage() {
  const qc = useQueryClient();
  const nav = useNavigate();
  const { id } = useParams();
  const editingId = id && id !== "novo" ? id : null;

  const { data: salaoId } = useSalaoId();

  const [form, setForm] = useState<ServicoForm>({
    nome: "",
    duracao_minutos: 30,
    valor: 0,
    ativo: true,
    funcionarioIds: [],
  });

  const funcionariosQuery = useQuery({
    queryKey: ["funcionarios-basic"],
    queryFn: async () => {
      const { data, error } = await supabase.from("funcionarios").select("id,nome,ativo").order("nome");
      if (error) throw error;
      return data ?? [];
    },
  });

  const servicoQuery = useQuery({
    queryKey: ["servico", editingId],
    enabled: !!editingId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("servicos")
        .select("id,nome,duracao_minutos,valor,ativo")
        .eq("id", editingId as string)
        .maybeSingle();
      if (error) throw error;
      if (!data) throw new Error("Serviço não encontrado");
      return data;
    },
  });

  const linksQuery = useQuery({
    queryKey: ["servico-links", editingId],
    enabled: !!editingId,
    queryFn: async () => {
      const { data, error } = await supabase.from("servicos_funcionarios").select("funcionario_id").eq("servico_id", editingId as string);
      if (error) throw error;
      return (data ?? []).map((r: any) => r.funcionario_id as string);
    },
  });

  const funcionariosAtivos = useMemo(() => (funcionariosQuery.data ?? []).filter((f: any) => f.ativo), [funcionariosQuery.data]);

  useEffect(() => {
    if (!editingId) return;
    if (!servicoQuery.data) return;
    setForm({
      id: servicoQuery.data.id,
      nome: servicoQuery.data.nome,
      duracao_minutos: Number(servicoQuery.data.duracao_minutos),
      valor: Number(servicoQuery.data.valor),
      ativo: !!servicoQuery.data.ativo,
      funcionarioIds: linksQuery.data ?? [],
    });
  }, [editingId, servicoQuery.data, linksQuery.data]);

  const upsertMutation = useMutation({
    mutationFn: async (payload: ServicoForm) => {
      if (!salaoId) throw new Error("Cadastre o salão em Configurações antes.");
      const { data: saved, error } = await supabase
        .from("servicos")
        .upsert({
          id: payload.id,
          salao_id: salaoId,
          nome: payload.nome.trim(),
          duracao_minutos: payload.duracao_minutos,
          valor: payload.valor,
          ativo: payload.ativo,
        })
        .select("id")
        .maybeSingle();
      if (error) throw error;
      const servicoId = saved?.id ?? payload.id;
      if (!servicoId) throw new Error("Falha ao salvar serviço.");

      await supabase.from("servicos_funcionarios").delete().eq("servico_id", servicoId);
      if (payload.funcionarioIds.length > 0) {
        const { error: linkErr } = await supabase.from("servicos_funcionarios").insert(
          payload.funcionarioIds.map((fid) => ({ servico_id: servicoId, funcionario_id: fid })),
        );
        if (linkErr) throw linkErr;
      }
    },
    onSuccess: async () => {
      await Promise.all([
        qc.invalidateQueries({ queryKey: ["servicos"] }),
        qc.invalidateQueries({ queryKey: ["servicos-funcionarios"] }),
      ]);
      toast({ title: "Serviço salvo" });
      nav("/servicos");
    },
    onError: (e: any) => toast({ title: "Erro", description: e.message, variant: "destructive" }),
  });

  const loading = servicoQuery.isLoading || linksQuery.isLoading;

  return (
    <FormPageShell
      title={editingId ? "Editar serviço" : "Novo serviço"}
      actions={
        <>
          <Button variant="secondary" onClick={() => nav("/servicos")}>Voltar</Button>
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
          <CardTitle className="text-base">Dados do serviço</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? <div className="text-sm text-muted-foreground">Carregando…</div> : null}
          {servicoQuery.error ? <div className="text-sm text-destructive">{(servicoQuery.error as any).message}</div> : null}

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

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <div className="grid gap-2 sm:col-span-1">
                <Label htmlFor="dur">Duração (min)</Label>
                <Input
                  id="dur"
                  type="number"
                  min={5}
                  step={5}
                  value={form.duracao_minutos}
                  onChange={(e) => setForm((p) => ({ ...p, duracao_minutos: Number(e.target.value) }))}
                />
              </div>
              <div className="grid gap-2 sm:col-span-1">
                <Label htmlFor="val">Valor (R$)</Label>
                <Input
                  id="val"
                  type="number"
                  min={0}
                  step={1}
                  value={form.valor}
                  onChange={(e) => setForm((p) => ({ ...p, valor: Number(e.target.value) }))}
                />
              </div>
              <div className="grid gap-2 sm:col-span-1">
                <Label>Status</Label>
                <label className="flex items-center gap-2 text-sm">
                  <Checkbox checked={form.ativo} onCheckedChange={(v) => setForm((p) => ({ ...p, ativo: Boolean(v) }))} />
                  Ativo
                </label>
              </div>
            </div>

            <div className="grid gap-2">
              <Label>Profissionais que executam</Label>
              <div className="grid gap-2 rounded-md border p-3">
                {funcionariosAtivos.map((f: any) => {
                  const checked = form.funcionarioIds.includes(f.id);
                  return (
                    <label key={f.id} className="flex items-center gap-2 text-sm">
                      <Checkbox
                        checked={checked}
                        onCheckedChange={(v) => {
                          const on = Boolean(v);
                          setForm((p) => ({
                            ...p,
                            funcionarioIds: on
                              ? Array.from(new Set([...p.funcionarioIds, f.id]))
                              : p.funcionarioIds.filter((x) => x !== f.id),
                          }));
                        }}
                      />
                      <span className="flex-1">{f.nome}</span>
                    </label>
                  );
                })}
                {funcionariosAtivos.length === 0 ? (
                  <div className="text-sm text-muted-foreground">Cadastre funcionários ativos primeiro.</div>
                ) : null}
              </div>
            </div>

            <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <Button type="button" variant="secondary" onClick={() => nav("/servicos")}>Cancelar</Button>
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
