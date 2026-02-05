import { useMemo, useState } from "react";
import { z } from "zod";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "@/components/ui/use-toast";
import { supabase } from "@/integrations/supabase/client";

const emailSchema = z.string().trim().email("Informe um email válido").max(255);

export function ForgotPasswordDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);

  const canSubmit = useMemo(() => email.trim().length > 0 && !loading, [email, loading]);

  async function handleSend() {
    const parsed = emailSchema.safeParse(email);
    if (!parsed.success) {
      toast({ title: "Verifique o email", description: parsed.error.issues[0]?.message, variant: "destructive" });
      return;
    }

    setLoading(true);
    const { error } = await supabase.auth.resetPasswordForEmail(parsed.data, {
      redirectTo: `${window.location.origin}/auth`,
    });
    setLoading(false);

    if (error) {
      toast({ title: "Não foi possível enviar", description: error.message, variant: "destructive" });
      return;
    }

    toast({
      title: "Email enviado",
      description: "Se o email existir, você receberá um link para redefinir sua senha.",
    });
    onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Esqueci minha senha</DialogTitle>
          <DialogDescription>Informe seu email para receber o link de redefinição.</DialogDescription>
        </DialogHeader>

        <div className="space-y-2">
          <Label htmlFor="fp-email">Email</Label>
          <Input id="fp-email" type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} />
        </div>

        <div className="flex gap-2 justify-end">
          <Button variant="secondary" type="button" onClick={() => onOpenChange(false)} disabled={loading}>
            Cancelar
          </Button>
          <Button type="button" onClick={handleSend} disabled={!canSubmit}>
            {loading ? "Enviando…" : "Enviar link"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
