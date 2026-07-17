import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/app-shell";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { FileText, Hammer } from "lucide-react";

export const Route = createFileRoute("/_authenticated/pedidos")({
  component: PedidosPage,
  head: () => ({
    meta: [
      { title: "Pedidos de Compra — THcontrol" },
      { name: "description", content: "Gerenciamento de pedidos de compra do sistema." },
    ],
  }),
});

function PedidosPage() {
  return (
    <AppShell>
      <div className="flex flex-col gap-4 mb-6">
        <div>
          <div className="text-xs uppercase tracking-[0.2em] text-primary/80 mb-2">Suprimentos</div>
          <h1 className="text-3xl font-bold tracking-tight">Pedidos de compra</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Módulo em desenvolvimento
          </p>
        </div>
      </div>

      <div className="flex h-[60vh] items-center justify-center">
        <Card className="max-w-md w-full border-border/60 shadow-lg bg-card/60 backdrop-blur-md">
          <CardHeader className="text-center pb-2">
            <div className="mx-auto h-12 w-12 rounded-full bg-primary/15 text-primary flex items-center justify-center mb-4">
              <FileText className="h-6 w-6" />
            </div>
            <CardTitle className="text-xl font-bold">Pedidos de Compra</CardTitle>
          </CardHeader>
          <CardContent className="text-center space-y-4 pt-2">
            <p className="text-sm text-muted-foreground">
              Esta área está reservada para o futuro módulo de pedidos de compra do sistema **THcontrol**. 
            </p>
            <div className="inline-flex items-center gap-1.5 text-xs text-primary bg-primary/10 px-3 py-1 rounded-full font-medium">
              <Hammer className="h-3.5 w-3.5" /> Em breve
            </div>
          </CardContent>
        </Card>
      </div>
    </AppShell>
  );
}
