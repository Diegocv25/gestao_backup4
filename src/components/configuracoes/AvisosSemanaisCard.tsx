import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { z } from "zod";

import { supabase } from "@/integrations/supabase/client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { toast } from "@/components/ui/use-toast";

type AvisosForm = {
  id?: string;
  salao_id: string;
  geral: string;
  seg: string;
  ter: string;
  qua: string;
  qui: string;
  sex: string;
  sab: string;
  dom: string;
};

const dias = [
  { key: "seg", label: "Seg" },
  { key: "ter", label: "Ter" },
  { key: "qua", label: "Qua" },
  { key: "qui", label: "Qui" },
  { key: "sex", label: "Sex" },
  { key: "sab", label: "Sáb" },
  { key: "dom", label: "Dom" },
] as const;

const avisoSchema = z
  .string()
  .trim()
  .max(500, "Use no máximo 500 caracteres")
  .optional()
  .transform((v) => (v ?? "").trim());

const formSchema = z.object({
  geral: avisoSchema,
  seg: avisoSchema,
  ter: avisoSchema,
  qua: avisoSchema,
  qui: avisoSchema,
  sex: avisoSchema,
  sab: avisoSchema,
  dom: avisoSchema,
});

export function AvisosSemanaisCard({ salaoId }: { salaoId: string | null | undefined }) {
  const qc = useQueryClient();

  const avisosQuery = useQuery({
    queryKey: ["avisos-semanais", salaoId],
    enabled: !!salaoId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("avisos_semanais")
        .select("id,geral,seg,ter,qua,qui,sex,sab,dom")
        .eq("salao_id", salaoId as string)
        .order("created_at", { ascending: true })
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return data ?? null;
    },
  });

  const empty = useMemo<AvisosForm | null>(() => {
    if (!salaoId) return null;
    return {
      salao_id: salaoId,
      geral: "",
      seg: "",
      ter: "",
      qua: "",
      qui: "",
      sex: "",
      sab: "",
      dom: "",
    };
  }, [salaoId]);

  const [form, setForm] = useState<AvisosForm | null>(null);

  useEffect(() => {
    if (!salaoId) return;
    if (avisosQuery.isLoading) return;
    const row: any = avisosQuery.data;
    if (!row) {
      setForm(empty);
      return;
    }
    setForm({
      id: row.id,
      salao_id: salaoId,
      geral: row.geral ?? "",
      seg: row.seg ?? "",
      ter: row.ter ?? "",
      qua: row.qua ?? "",
      qui: row.qui ?? "",
      sex: row.sex ?? "",
      sab: row.sab ?? "",
      dom: row.dom ?? "",
    });
  }, [salaoId, avisosQuery.data, avisosQuery.isLoading, empty]);

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!form) return;
      const parsed = formSchema.safeParse(form);
      if (!parsed.success) throw new Error(parsed.error.issues[0]?.message ?? "Verifique os campos");

      const payload = {
        id: form.id,
        salao_id: form.salao_id,
        geral: parsed.data.geral || null,
        seg: parsed.data.seg || null,
        ter: parsed.data.ter || null,
        qua: parsed.data.qua || null,
        qui: parsed.data.qui || null,
        sex: parsed.data.sex || null,
        sab: parsed.data.sab || null,
        dom: parsed.data.dom || null,
      };

      const { data, error } = await supabase.from("avisos_semanais").upsert(payload).select("id");
      if (error) throw error;
      const firstId = Array.isArray(data) ? (data[0] as any)?.id : (data as any)?.id;
      if (firstId) {
        setForm((p) => (p ? { ...p, id: firstId } : p));
      }
    },
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ["avisos-semanais"] });
      toast({ title: "Avisos salvos" });
    },
    onError: (e: any) => toast({ title: "Erro", description: e.message, variant: "destructive" }),
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Avisos semanais</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {!salaoId ? <div className="text-sm text-muted-foreground">Salve o salão primeiro para liberar os avisos.</div> : null}
        {avisosQuery.isLoading ? <div className="text-sm text-muted-foreground">Carregando…</div> : null}
        {avisosQuery.error ? <div className="text-sm text-destructive">Erro ao carregar avisos.</div> : null}

        {salaoId && form ? (
          <form
            className="grid gap-3"
            onSubmit={(e) => {
              e.preventDefault();
              saveMutation.mutate();
            }}
          >
            <div className="grid gap-2">
              <Label>Aviso geral</Label>
              <Input
                value={form.geral}
                onChange={(e) => setForm((p) => (p ? { ...p, geral: e.target.value } : p))}
                placeholder="Ex: Promoção da semana / Informativo"
              />
              <div className="text-xs text-muted-foreground">Dica: mantenha curto (até 500 caracteres).</div>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              {dias.map((d) => (
                <div key={d.key} className="grid gap-2">
                  <Label>{d.label}</Label>
                  <Input
                    value={(form as any)[d.key]}
                    onChange={(e) => setForm((p) => (p ? ({ ...p, [d.key]: e.target.value } as any) : p))}
                    placeholder={`Aviso de ${d.label}`}
                  />
                </div>
              ))}
            </div>

            <div className="flex justify-end">
              <Button type="submit" disabled={saveMutation.isPending}>
                {saveMutation.isPending ? "Salvando…" : "Salvar avisos"}
              </Button>
            </div>
          </form>
        ) : null}
      </CardContent>
    </Card>
  );
}
