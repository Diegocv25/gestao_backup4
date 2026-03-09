import { Link } from "react-router-dom";

export default function PortalHome() {
  return (
    <div className="mx-auto flex min-h-[calc(100vh-3rem)] max-w-md items-center px-4 py-10">
      <div className="w-full rounded-lg border bg-card p-6 text-card-foreground shadow-sm">
        <h1 className="text-xl font-semibold">Portal do Cliente</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Para acessar, use o link do seu estabelecimento (ele contém um token). Exemplo:
        </p>
        <div className="mt-3 rounded-md bg-muted p-3 text-xs">
          /cliente/&lt;token&gt;/entrar
        </div>

        <p className="mt-4 text-xs text-muted-foreground">
          Se você é administrador/funcionário e quer acessar o sistema interno, use o domínio do app.
        </p>

        <div className="mt-4 flex justify-end">
          <Link
            to="/auth"
            className="text-sm font-medium text-primary underline underline-offset-4"
          >
            Ir para login do sistema
          </Link>
        </div>
      </div>
    </div>
  );
}
