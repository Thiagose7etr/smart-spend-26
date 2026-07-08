import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { clearInvalidAuthSession } from "@/lib/auth-session";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, LogIn, UserPlus } from "lucide-react";
import { toast } from "sonner";
import thcLogo from "@/assets/thc-logo.jpg.asset.json";

export const Route = createFileRoute("/auth")({
  ssr: false,
  component: AuthPage,
});

function AuthPage() {
  const navigate = useNavigate();
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    supabase.auth.getUser().then(async ({ data, error }) => {
      if (error) {
        await clearInvalidAuthSession();
        return;
      }
      if (data?.user) navigate({ to: "/" });
    });
  }, [navigate]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      const cleanEmail = email.trim().toLowerCase();
      const domainOk =
        cleanEmail.endsWith("@translix.com.br") || cleanEmail === "thiagovirtualy.tr@gmail.com";
      if (!domainOk) {
        toast.error("Apenas e-mails @translix.com.br são permitidos.");
        setLoading(false);
        return;
      }
      if (mode === "signup") {
        const { error } = await supabase.auth.signUp({
          email: cleanEmail,
          password,
          options: {
            data: { full_name: name || cleanEmail },
            emailRedirectTo: window.location.origin,
          },
        });
        if (error) throw error;
        toast.success("Conta criada! Aguarde aprovação do administrador para acessar.");
        setMode("login");
      } else {
        const { error } = await supabase.auth.signInWithPassword({
          email: cleanEmail,
          password,
        });
        if (error) throw error;
        toast.success("Login efetuado.");
        navigate({ to: "/" });
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Erro inesperado";
      const friendly = msg.includes("translix")
        ? "Apenas e-mails @translix.com.br podem se cadastrar."
        : msg.includes("Limite")
          ? "Limite de contas atingido. Contate o administrador."
          : msg.includes("Invalid login")
            ? "E-mail ou senha inválidos."
            : msg;
      toast.error(friendly);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4 py-12">
      <div className="w-full max-w-md">
        <div className="flex flex-col items-center mb-6">
          <img
            src={thcLogo.url}
            alt="THcontrol"
            className="h-16 w-16 rounded-2xl object-cover mb-3"
            style={{ boxShadow: "var(--shadow-glow)" }}
          />
          <h1 className="text-2xl font-semibold">THcontrol</h1>
          <p className="text-xs text-muted-foreground uppercase tracking-widest">
            Controle de Compras e Frota
          </p>
        </div>

        <Card className="border-border/60">
          <CardHeader>
            <CardTitle className="text-lg">
              {mode === "login" ? "Entrar" : "Criar conta"}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              {mode === "signup" && (
                <div className="space-y-1.5">
                  <Label htmlFor="name">Nome completo</Label>
                  <Input
                    id="name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Seu nome"
                  />
                </div>
              )}
              <div className="space-y-1.5">
                <Label htmlFor="email">E-mail corporativo</Label>
                <Input
                  id="email"
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="voce@translix.com.br"
                />
                <p className="text-[11px] text-muted-foreground">
                  Apenas e-mails <span className="font-semibold text-primary">@translix.com.br</span>
                </p>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="password">Senha</Label>
                <Input
                  id="password"
                  type="password"
                  required
                  minLength={6}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                />
              </div>

              <Button type="submit" className="w-full" disabled={loading}>
                {loading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : mode === "login" ? (
                  <>
                    <LogIn className="h-4 w-4 mr-2" /> Entrar
                  </>
                ) : (
                  <>
                    <UserPlus className="h-4 w-4 mr-2" /> Criar conta
                  </>
                )}
              </Button>

              <div className="text-center text-sm text-muted-foreground">
                {mode === "login" ? (
                  <>
                    Não tem conta?{" "}
                    <button
                      type="button"
                      onClick={() => setMode("signup")}
                      className="text-primary hover:underline"
                    >
                      Cadastre-se
                    </button>
                  </>
                ) : (
                  <>
                    Já tem conta?{" "}
                    <button
                      type="button"
                      onClick={() => setMode("login")}
                      className="text-primary hover:underline"
                    >
                      Fazer login
                    </button>
                  </>
                )}
              </div>
            </form>
          </CardContent>
        </Card>

        <p className="mt-6 text-center text-xs text-muted-foreground">
          Ao se cadastrar, seu acesso ficará pendente até o administrador aprovar.
        </p>
        <div className="mt-3 text-center">
          <Link to="/" className="text-[11px] text-muted-foreground hover:text-foreground">
            ← Voltar ao início
          </Link>
        </div>
      </div>
    </div>
  );
}