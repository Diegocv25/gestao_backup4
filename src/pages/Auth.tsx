import { useMemo, useState } from "react";
import { Navigate, useLocation, useNavigate } from "react-router-dom";
import { z } from "zod";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { toast } from "@/components/ui/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/auth/auth-context";
import { strongPasswordSchema } from "@/lib/password-policy";
import { AuthForm } from "@/pages/auth/AuthForm";
import { ForgotPasswordDialog } from "@/pages/auth/ForgotPasswordDialog";
import { ResetPasswordForm } from "@/pages/auth/ResetPasswordForm";

const emailSchema = z.string().trim().email("Informe um email válido").max(255);

const signInSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, "Informe sua senha"),
});

const signUpSchema = z
  .object({
    email: emailSchema,
    password: strongPasswordSchema,
    confirmPassword: z.string().min(1, "Repita sua senha"),
  })
  .superRefine((val, ctx) => {
    if (val.password !== val.confirmPassword) {
      ctx.addIssue({ code: "custom", message: "As senhas não conferem", path: ["confirmPassword"] });
    }
  });

function getFriendlyAuthError(message?: string) {
  const m = (message ?? "").toLowerCase();

  if (m.includes("rate limit") || m.includes("too many") || m.includes("over email send rate limit")) {
    return "Limite de tentativas/emails do Supabase atingido. Aguarde alguns minutos e tente novamente (ou use outro email). Se ainda ocorrer, verifique Auth → Rate Limits no Supabase.";
  }

  if (m.includes("invalid login") || m.includes("invalid") || m.includes("credentials")) {
    return "Email ou senha inválidos.";
  }
  if (m.includes("user already registered")) {
    return "Este email já está cadastrado. Tente entrar.";
  }
  if (m.includes("password") && m.includes("weak")) {
    return "Senha fraca. Use no mínimo 8 caracteres, com 1 letra maiúscula e 1 número.";
  }
  if (m.includes("email") && (m.includes("not confirmed") || m.includes("not verified") || m.includes("confirm"))) {
    return "Email ainda não confirmado no Supabase. Para um fluxo sem confirmação, desative 'Confirm email' no Supabase (Auth → Providers → Email) e recrie/confirmar os usuários de teste.";
  }

  return message ?? "Não foi possível concluir a operação.";
}

export default function AuthPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();

  const [loading, setLoading] = useState(false);
  const [forgotOpen, setForgotOpen] = useState(false);
  const state = (location.state as any) ?? {};
  const from = state?.from as string | undefined;
  const allowSignup = state?.portal === "cliente" || (typeof from === "string" && from.startsWith("/cliente/"));
  // Mesmo quando o portal permite cadastro, o Supabase Auth é global por email.
  // Então "Entrar" deve ser o padrão para evitar o usuário tentar recriar a conta
  // ao acessar um novo estabelecimento.
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [authEmail, setAuthEmail] = useState<string>("");

  const isRecovery = useMemo(() => {
    const sp = new URLSearchParams(location.search);
    const qType = sp.get("type");
    const h = location.hash ?? "";
    return qType === "recovery" || h.includes("type=recovery") || h.includes("recovery");
  }, [location.hash, location.search]);

  const redirectTo = useMemo(() => {
    return typeof from === "string" && from.length > 0 ? from : "/";
  }, [location.state]);

  // Se o usuário é cliente e tentou acessar o backoffice, mantemos ele aqui sem redirecionar
  // para evitar loop (/auth -> / -> RoleGate -> /auth ...).
  if (user && !isRecovery && (state as any)?.blocked !== "customer_backoffice") {
    return <Navigate to={redirectTo} replace />;
  }

  if (user && !isRecovery && (state as any)?.blocked === "customer_backoffice") {
    return (
      <div className="mx-auto flex min-h-[calc(100vh-3rem)] max-w-md items-center px-4 py-10">
        <Card className="w-full">
          <CardHeader>
            <CardTitle className="text-xl">Acesso do cliente</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">
              O cliente acessa o sistema pelo link do estabelecimento (portal). O painel interno é restrito.
            </p>
            <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
              <Button
                variant="secondary"
                onClick={async () => {
                  try {
                    await supabase.auth.signOut();
                  } finally {
                    navigate("/auth", { replace: true });
                  }
                }}
              >
                Sair
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  async function handleSignIn(form: { email: string; password: string }) {
    const parsed = signInSchema.safeParse(form);
    if (!parsed.success) {
      toast({ title: "Verifique os campos", description: parsed.error.issues[0]?.message });
      return;
    }

    setAuthEmail(parsed.data.email);

    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({
      email: parsed.data.email,
      password: parsed.data.password,
    });
    setLoading(false);

    if (error) {
      toast({ title: "Falha ao entrar", description: getFriendlyAuthError(error.message), variant: "destructive" });
      return;
    }

    navigate(redirectTo, { replace: true });
  }

  async function handleSignUp(form: { email: string; password: string; confirmPassword?: string }) {
    const parsed = signUpSchema.safeParse(form);
    if (!parsed.success) {
      toast({ title: "Verifique os campos", description: parsed.error.issues[0]?.message });
      return;
    }

    setAuthEmail(parsed.data.email);

    setLoading(true);
    const { data, error } = await supabase.auth.signUp({
      email: parsed.data.email,
      password: parsed.data.password,
      options: {
        emailRedirectTo: `${window.location.origin}/auth`,
      },
    });

    if (error) {
      setLoading(false);

      // UX SaaS multi-tenant: a conta (Supabase Auth) é global; ao acessar um novo salão,
      // o usuário deve ENTRAR e completar o cadastro daquele salão (não criar conta novamente).
      const msg = (error.message ?? "").toLowerCase();
      if (msg.includes("user already registered")) {
        toast({
          title: "Esta conta já existe",
          description: "Entre com seu email e senha para vincular seu cadastro a este salão.",
        });
        setMode("signin");
        return;
      }

      toast({ title: "Falha ao cadastrar", description: getFriendlyAuthError(error.message), variant: "destructive" });
      return;
    }

    // Fluxo desejado: cria conta e volta para a tela de login.
    // (Sem auto-login / sem redirect automático, para evitar cair em telas do portal antes do login.)
    setLoading(false);
    toast({
      title: "Conta criada",
      description: "Agora entre com seu email e senha para continuar.",
    });
    setMode("signin");
    setAuthEmail(parsed.data.email);

    // Se o Supabase retornou sessão por configuração (confirm email OFF), garantimos logout
    // para manter o fluxo determinístico (cadastro -> login).
    if (data.session) {
      try {
        await supabase.auth.signOut();
      } catch {
        // ignore
      }
    }
  }

  return (
    <div className="mx-auto flex min-h-[calc(100vh-3rem)] max-w-md items-center px-4 py-10">
      <Card className="w-full">
        <CardHeader>
          <CardTitle className="text-xl">{isRecovery ? "Definir nova senha" : "Acessar"}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="mt-2">
            {isRecovery ? (
              <ResetPasswordForm
                onSuccess={() => {
                  navigate(redirectTo, { replace: true });
                }}
              />
            ) : null}

            {allowSignup ? (
              <div className="mb-4 flex gap-2">
                <Button
                  type="button"
                  variant={mode === "signin" ? "default" : "secondary"}
                  className="flex-1"
                  onClick={() => setMode("signin")}
                >
                  Entrar
                </Button>
                <Button
                  type="button"
                  variant={mode === "signup" ? "default" : "secondary"}
                  className="flex-1"
                  onClick={() => setMode("signup")}
                >
                  Criar conta
                </Button>
              </div>
            ) : null}

            {!isRecovery ? (
              mode === "signup" && allowSignup ? (
                <AuthForm
                  mode="signup"
                  loading={loading}
                  submitLabel="Criar conta"
                  onSubmit={(data) =>
                    handleSignUp({ email: data.email, password: data.password, confirmPassword: data.confirmPassword })
                  }
                    initialEmail={authEmail}
                    onEmailChange={setAuthEmail}
                  passwordAutoComplete="new-password"
                />
              ) : (
                <div className="space-y-3">
                  <AuthForm
                    mode="signin"
                    loading={loading}
                    onSubmit={(data) => handleSignIn({ email: data.email, password: data.password })}
                    initialEmail={authEmail}
                    onEmailChange={setAuthEmail}
                  />

                  <Button
                    type="button"
                    variant="link"
                    className="h-auto w-full p-0 text-sm"
                    onClick={() => setForgotOpen(true)}
                  >
                    Esqueci minha senha
                  </Button>
                </div>
              )
            ) : null}

            {allowSignup ? (
              <p className="mt-4 text-xs text-muted-foreground">
                Dica: se este email já tiver conta, use "Entrar" (o login é o mesmo em qualquer estabelecimento).
              </p>
            ) : (
              <p className="mt-4 text-xs text-muted-foreground">Não tem acesso? Solicite ao administrador/gerente do seu negócio.</p>
            )}
          </div>
        </CardContent>
      </Card>

      <ForgotPasswordDialog open={forgotOpen} onOpenChange={setForgotOpen} />
    </div>
  );
}

