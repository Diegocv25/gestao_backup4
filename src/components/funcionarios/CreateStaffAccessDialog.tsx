import { useEffect, useMemo, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";

import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "@/components/ui/use-toast";
import { PasswordInput } from "@/components/ui/password-input";
import { generateTempPassword } from "@/lib/temp-password";
import { isStrongPassword } from "@/lib/password-policy";

type StaffRole = "admin" | "gerente" | "recepcionista" | "profissional";
type FuncionarioCargo = "administrador" | "gerente" | "auxiliar" | "recepcionista" | "profissional";

function cargoToRole(cargo: FuncionarioCargo | null | undefined): StaffRole | null {
  if (!cargo) return null;
  if (cargo === "administrador") return "admin";
  if (cargo === "gerente") return "gerente";
  if (cargo === "recepcionista") return "recepcionista";
  if (cargo === "profissional") return "profissional";
  // auxiliar não tem acesso
  return null;
}

function roleLabel(role: StaffRole | null) {
  if (role === "admin") return "Administrador";
  if (role === "gerente") return "Gerente";
  if (role === "recepcionista") return "Recepcionista";
  if (role === "profissional") return "Profissional";
  return "—";
}

export function CreateStaffAccessDialog({
  funcionarioId,
  defaultEmail,
  funcionarioCargo,
  mode = "create",
  disabled,
}: {
  funcionarioId: string;
  defaultEmail?: string | null;
  funcionarioCargo?: FuncionarioCargo | null;
  mode?: "create" | "update";
  disabled?: boolean;
}) {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState("");
  const [temporaryPassword, setTemporaryPassword] = useState("");
  const role = useMemo(() => cargoToRole(funcionarioCargo), [funcionarioCargo]);
  const roleMissing = !role;

  useEffect(() => {
    if (!open) return;
    setEmail((defaultEmail ?? "").trim());
    setTemporaryPassword(generateTempPassword());
  }, [open, defaultEmail]);

  const canCopy = useMemo(() => !!email && !!temporaryPassword, [email, temporaryPassword]);
  const isValidPassword = useMemo(() => isStrongPassword(temporaryPassword), [temporaryPassword]);

  const createMutation = useMutation({
    mutationFn: async () => {
      if (!role) throw new Error("Este cargo não possui acesso ao sistema.");

      const payload = {
        email: email.trim().toLowerCase(),
        temporary_password: temporaryPassword,
        funcionario_id: funcionarioId,
      };

      const { data, error } = await supabase.functions.invoke("admin-create-staff-user", { body: payload });
      if (error) throw error;
      if (!data?.ok) throw new Error(data?.error ?? "Falha ao criar acesso");
      return data as { ok: true; user_id: string };
    },
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ["funcionarios"] });
      toast({
        title: mode === "update" ? "Acesso atualizado" : "Acesso criado",
        description: mode === "update" ? "Cargo e senha foram atualizados." : "Usuário criado e vinculado ao funcionário.",
      });
      setOpen(false);
    },
    onError: (e: any) => toast({ title: "Erro", description: e.message, variant: "destructive" }),
  });

  async function copyCreds() {
    try {
      await navigator.clipboard.writeText(`Login: ${email}\nSenha temporária: ${temporaryPassword}`);
      toast({ title: "Credenciais copiadas" });
    } catch (e: any) {
      toast({ title: "Não foi possível copiar", description: e?.message ?? "", variant: "destructive" });
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="secondary" size="sm" disabled={disabled}>
          {mode === "update" ? "Ajustar acesso" : "Criar acesso"}
        </Button>
      </DialogTrigger>

      <DialogContent>
        <DialogHeader>
          <DialogTitle>{mode === "update" ? "Ajustar acesso do funcionário" : "Criar acesso do funcionário"}</DialogTitle>
        </DialogHeader>

        <div className="grid gap-4">
          <div className="grid gap-2">
            <Label>Email</Label>
            <Input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="email@exemplo.com" autoComplete="off" />
          </div>

          <div className="grid gap-2">
            <Label>Cargo (acesso)</Label>
            <div className="rounded-md border px-3 py-2 text-sm">
              {roleLabel(role)}
              {roleMissing ? <span className="ml-2 text-xs text-muted-foreground">(sem acesso)</span> : null}
            </div>
            <div className="text-xs text-muted-foreground">
              O cargo do acesso é puxado automaticamente do cadastro do funcionário.
            </div>
          </div>

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
          <Button
            type="button"
            onClick={() => createMutation.mutate()}
            disabled={createMutation.isPending || !email.trim() || !isValidPassword || roleMissing}
          >
            {createMutation.isPending ? (mode === "update" ? "Atualizando…" : "Criando…") : mode === "update" ? "Atualizar acesso" : "Criar acesso"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
