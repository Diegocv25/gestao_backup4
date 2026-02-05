import { useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PasswordInput } from "@/components/ui/password-input";

type Mode = "signin" | "signup";

export type AuthFormData = {
  email: string;
  password: string;
  confirmPassword?: string;
};

export function AuthForm({
  loading,
  mode,
  onSubmit,
  submitLabel,
  passwordAutoComplete,
  initialEmail,
  onEmailChange,
}: {
  loading: boolean;
  mode: Mode;
  onSubmit: (data: AuthFormData) => void;
  submitLabel?: string;
  passwordAutoComplete?: string;
  initialEmail?: string;
  onEmailChange?: (email: string) => void;
}) {
  const [data, setData] = useState<AuthFormData>({ email: initialEmail ?? "", password: "", confirmPassword: "" });

  useEffect(() => {
    if (typeof initialEmail !== "string") return;
    setData((prev) => {
      if (prev.email === initialEmail) return prev;
      return { ...prev, email: initialEmail };
    });
  }, [initialEmail]);

  return (
    <form
      className="space-y-4"
      onSubmit={(e) => {
        e.preventDefault();
        onSubmit(data);
      }}
    >
      <div className="space-y-2">
        <Label htmlFor="email">Email</Label>
        <Input
          id="email"
          type="email"
          placeholder="voce@exemplo.com"
          autoComplete="email"
          value={data.email}
          onChange={(e) => {
            const v = e.target.value;
            onEmailChange?.(v);
            setData((prev) => ({ ...prev, email: v }));
          }}
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="password">Senha</Label>
        <PasswordInput
          id="password"
          placeholder={mode === "signup" ? "Crie uma senha" : "Sua senha"}
          autoComplete={passwordAutoComplete ?? (mode === "signup" ? "new-password" : "current-password")}
          value={data.password}
          onChange={(e) => setData((prev) => ({ ...prev, password: e.target.value }))}
        />
      </div>

      {mode === "signup" ? (
        <div className="space-y-2">
          <Label htmlFor="confirmPassword">Repetir senha</Label>
          <PasswordInput
            id="confirmPassword"
            placeholder="Repita a senha"
            autoComplete="new-password"
            value={data.confirmPassword ?? ""}
            onChange={(e) => setData((prev) => ({ ...prev, confirmPassword: e.target.value }))}
          />
        </div>
      ) : null}

      <Button type="submit" className="w-full" disabled={loading}>
        {loading ? "Aguarde…" : submitLabel ?? (mode === "signup" ? "Criar conta" : "Entrar")}
      </Button>
    </form>
  );
}
