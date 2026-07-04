import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { AppShell } from "@/components/app-shell";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Plus, Wrench, MapPin, Trash2, Pencil } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { sbFrom, type Guincho } from "@/lib/db-types";

export const Route = createFileRoute("/guincho")({
  component: GuinchoPage,
  head: () => ({
    meta: [
      { title: "Guincho — THcontrol" },
      { name: "description", content: "Solicitações e histórico de guincho da frota." },
    ],
  }),
});

const STATUS_TONES: Record<string, string> = {
  PENDENTE: "bg-accent/15 text-accent",
  EM_ANDAMENTO: "bg-chart-3/15 text-chart-3",
  CONCLUIDO: "bg-primary/15 text-primary",
  CANCELADO: "bg-destructive/15 text-destructive",
};

const empty = (): Partial<Guincho> => ({
  data: new Date().toISOString().slice(0, 10),
  frota: "",
  tipo: "",
  modelo: "",
  problema: "",
  endereco_retirada: "",
  endereco_entrega: "",
  status: "PENDENTE",
});

function GuinchoPage() {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<Partial<Guincho>>(empty());

  const { data: itens = [] } = useQuery({
    queryKey: ["guincho"],
    queryFn: async () => {
      const { data, error } = await sbFrom("guincho").select("*").order("data", { ascending: false });
      if (error) throw error;
      return (data ?? []) as Guincho[];
    },
  });

  const salvar = useMutation({
    mutationFn: async (f: Partial<Guincho>) => {
      const payload = {
        data: f.data || null,
        frota: f.frota || null,
        tipo: f.tipo || null,
        modelo: f.modelo || null,
        peso_kg: f.peso_kg ? Number(f.peso_kg) : null,
        problema: f.problema || null,
        endereco_retirada: f.endereco_retirada || null,
        endereco_entrega: f.endereco_entrega || null,
        status: f.status || "PENDENTE",
      };
      if (f.id) {
        const { error } = await sbFrom("guincho").update(payload).eq("id", f.id);
        if (error) throw error;
      } else {
        const { error } = await sbFrom("guincho").insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["guincho"] });
      setOpen(false);
      setForm(empty());
      toast.success("Solicitação salva");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const excluir = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await sbFrom("guincho").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["guincho"] }),
  });

  return (
    <AppShell>
      <div className="flex flex-wrap items-end justify-between gap-4 mb-6">
        <div>
          <div className="text-xs uppercase tracking-[0.2em] text-primary/80 mb-2">Assistência</div>
          <h1 className="text-3xl font-bold tracking-tight">Guincho</h1>
          <p className="text-sm text-muted-foreground mt-1">{itens.length} solicitações registradas</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button onClick={() => setForm(empty())} className="text-primary-foreground border-0" style={{ background: "var(--gradient-primary)" }}>
              <Plus className="h-4 w-4 mr-2" /> Nova solicitação
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-lg">
            <DialogHeader><DialogTitle>{form.id ? "Editar" : "Nova"} solicitação</DialogTitle></DialogHeader>
            <div className="grid gap-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs">Data</Label>
                  <Input type="date" value={form.data ?? ""} onChange={(e) => setForm({ ...form, data: e.target.value })} />
                </div>
                <div>
                  <Label className="text-xs">Status</Label>
                  <Select value={form.status ?? "PENDENTE"} onValueChange={(v) => setForm({ ...form, status: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="PENDENTE">Pendente</SelectItem>
                      <SelectItem value="EM_ANDAMENTO">Em andamento</SelectItem>
                      <SelectItem value="CONCLUIDO">Concluído</SelectItem>
                      <SelectItem value="CANCELADO">Cancelado</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-xs">Frota</Label>
                  <Input value={form.frota ?? ""} onChange={(e) => setForm({ ...form, frota: e.target.value })} />
                </div>
                <div>
                  <Label className="text-xs">Tipo</Label>
                  <Input value={form.tipo ?? ""} onChange={(e) => setForm({ ...form, tipo: e.target.value })} placeholder="ROLLON" />
                </div>
                <div>
                  <Label className="text-xs">Modelo</Label>
                  <Input value={form.modelo ?? ""} onChange={(e) => setForm({ ...form, modelo: e.target.value })} />
                </div>
                <div>
                  <Label className="text-xs">Peso (kg)</Label>
                  <Input type="number" value={form.peso_kg ?? ""} onChange={(e) => setForm({ ...form, peso_kg: Number(e.target.value) })} />
                </div>
              </div>
              <div>
                <Label className="text-xs">Problema</Label>
                <Textarea rows={2} value={form.problema ?? ""} onChange={(e) => setForm({ ...form, problema: e.target.value })} />
              </div>
              <div>
                <Label className="text-xs">Endereço de retirada</Label>
                <Input value={form.endereco_retirada ?? ""} onChange={(e) => setForm({ ...form, endereco_retirada: e.target.value })} />
              </div>
              <div>
                <Label className="text-xs">Endereço de entrega</Label>
                <Input value={form.endereco_entrega ?? ""} onChange={(e) => setForm({ ...form, endereco_entrega: e.target.value })} />
              </div>
            </div>
            <DialogFooter>
              <Button onClick={() => salvar.mutate(form)} disabled={salvar.isPending} className="text-primary-foreground border-0" style={{ background: "var(--gradient-primary)" }}>
                {salvar.isPending ? "Salvando…" : "Salvar"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
        {itens.length === 0 && (
          <div className="col-span-full text-center py-16 text-muted-foreground text-sm">
            Sem solicitações. Clique em "Nova solicitação" para começar.
          </div>
        )}
        {itens.map((g) => {
          const tone = STATUS_TONES[g.status || "PENDENTE"] || STATUS_TONES.PENDENTE;
          return (
            <Card key={g.id} className="group hover:border-primary/40 transition">
              <CardContent className="pt-5">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div className="grid h-10 w-10 place-items-center rounded-lg bg-accent/15 text-accent">
                      <Wrench className="h-5 w-5" />
                    </div>
                    <div>
                      <div className="text-xs text-muted-foreground">
                        {g.data ? new Date(g.data).toLocaleDateString("pt-BR") : "sem data"}
                      </div>
                      <div className="font-semibold">Frota {g.frota || "—"}</div>
                    </div>
                  </div>
                  <Badge className={`${tone} border-0 text-[10px] uppercase tracking-wider`}>{g.status}</Badge>
                </div>
                <div className="mt-3 text-sm">
                  <div className="text-muted-foreground text-xs uppercase tracking-wider">Problema</div>
                  <div className="font-medium">{g.problema || "—"}</div>
                </div>
                {(g.endereco_retirada || g.endereco_entrega) && (
                  <div className="mt-3 space-y-1 text-xs text-muted-foreground">
                    {g.endereco_retirada && (
                      <div className="flex items-start gap-1.5"><MapPin className="h-3 w-3 mt-0.5 text-primary" /> <span>{g.endereco_retirada}</span></div>
                    )}
                    {g.endereco_entrega && (
                      <div className="flex items-start gap-1.5"><MapPin className="h-3 w-3 mt-0.5 text-accent" /> <span>{g.endereco_entrega}</span></div>
                    )}
                  </div>
                )}
                <div className="mt-4 flex justify-end gap-1 opacity-0 group-hover:opacity-100 transition">
                  <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => { setForm(g); setOpen(true); }}>
                    <Pencil className="h-3.5 w-3.5" />
                  </Button>
                  <Button size="icon" variant="ghost" className="h-8 w-8 text-destructive" onClick={() => excluir.mutate(g.id)}>
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </AppShell>
  );
}