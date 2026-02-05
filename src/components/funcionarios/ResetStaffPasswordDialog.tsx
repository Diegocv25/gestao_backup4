import { useEffect, useMemo, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { z } from "zod";

import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { toast } from "@/components/ui/use-toast";
import { PasswordInput } from "@/components/ui/password-input";
import { generateTempPassword } from "@/lib/temp-password";
import { strongPasswordSchema } from "@/lib/password-policy";

const schema = z.object({
  temporary_password: strongPasswordSchema,
});

export function ResetStaffPasswordDialog({
  funcionarioId,
  loginEmail,
  disabled,
}: {
  funcionarioId: string;
  loginEmail?: string | null;
  disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [temporaryPassword, setTemporaryPassword] = useState("");

  useEffect(() => {
    if (!open) return;
    setTemporaryPassword(generateTempPassword());
  }, [open]);

  const canCopy = useMemo(() => !!temporaryPassword, [temporaryPassword]);
  const isValid = useMemo(() => schema.safeParse({ temporary_password: temporaryPassword }).success, [temporaryPassword]);

  const resetMutation = useMutation({
    mutationFn: async () => {
      const parsed = schema.safeParse({ temporary_password: temporaryPassword });
      if (!parsed.success) throw new Error(parsed.error.issues[0]?.message ?? "Senha inválida");

      const payload = { funcionario_id: funcionarioId, temporary_password: parsed.data.temporary_password };
      const { data, error } = await supabase.functions.invoke("admin-reset-staff-password", { body: payload });
      if (error) throw error;
      if (!data?.ok) throw new Error(data?.error ?? "Falha ao resetar senha");
      return data as { ok: true };
    },
    onSuccess: () => {
      toast({ title: "Senha resetada", description: "Uma senha temporária foi definida para este usuário." });
      setOpen(false);
    },
    onError: (e: any) => toast({ title: "Erro", description: e.message, variant: "destructive" }),
  });

  async function copyCreds() {
    try {
      const header = loginEmail ? `Login: ${loginEmail}\n` : "";
      await navigator.clipboard.writeText(`${header}Senha temporária: ${temporaryPassword}`);
      toast({ title: "Copiado" });
    } catch (e: any) {
      toast({ title: "Não foi possível copiar", description: e?.message ?? "", variant: "destructive" });
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="secondary" size="sm" disabled={disabled}>
          Resetar senha
        </Button>
      </DialogTrigger>

      <DialogContent>
        <DialogHeader>
          <DialogTitle>Resetar senha do funcionário</DialogTitle>
        </DialogHeader>

        <div className="grid gap-4">
          <div className="grid gap-2">
            <Label>Senha temporária</Label>
            <div className="flex gap-2">
              <PasswordInput value={temporaryPassword} onChange={(e) => setTemporaryPassword(e.target.value)} autoComplete="off" />
              <Button type="button" variant="outline" onClick={() => setTemporaryPassword(generateTempPassword())}>
                Gerar
              </Button>
            </div>
            <div className="text-xs text-muted-foreground">Regra: mínimo 8 caracteres, 1 maiúscula e 1 número.</div>
          </div>
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={copyCreds} disabled={!canCopy}>
            Copiar
          </Button>
          <Button type="button" onClick={() => resetMutation.mutate()} disabled={resetMutation.isPending || !isValid}>
            {resetMutation.isPending ? "Aplicando…" : "Aplicar reset"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
