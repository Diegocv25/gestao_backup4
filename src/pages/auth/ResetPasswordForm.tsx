import { useState } from "react";
import { z } from "zod";

import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { PasswordInput } from "@/components/ui/password-input";
import { toast } from "@/components/ui/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { strongPasswordSchema } from "@/lib/password-policy";

const schema = z
  .object({
    password: strongPasswordSchema,
    confirmPassword: z.string().min(1, "Repita a senha"),
  })
  .superRefine((val, ctx) => {
    if (val.password !== val.confirmPassword) {
      ctx.addIssue({ code: "custom", message: "As senhas não conferem", path: ["confirmPassword"] });
    }
  });

export function ResetPasswordForm({ onSuccess }: { onSuccess: () => void }) {
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit() {
    const parsed = schema.safeParse({ password, confirmPassword });
    if (!parsed.success) {
      toast({ title: "Verifique a senha", description: parsed.error.issues[0]?.message, variant: "destructive" });
      return;
    }

    setLoading(true);
    const { error } = await supabase.auth.updateUser({ password: parsed.data.password });
    setLoading(false);

    if (error) {
      toast({ title: "Falha ao atualizar senha", description: error.message, variant: "destructive" });
      return;
    }

    toast({ title: "Senha atualizada", description: "Você já pode continuar." });
    onSuccess();
  }

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="new-password">Nova senha</Label>
        <PasswordInput
          id="new-password"
          autoComplete="new-password"
          placeholder="Crie uma senha forte"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="new-password-2">Repetir senha</Label>
        <PasswordInput
          id="new-password-2"
          autoComplete="new-password"
          placeholder="Repita a senha"
          value={confirmPassword}
          onChange={(e) => setConfirmPassword(e.target.value)}
        />
      </div>

      <Button type="button" className="w-full" onClick={handleSubmit} disabled={loading}>
        {loading ? "Salvando…" : "Salvar nova senha"}
      </Button>
    </div>
  );
}
