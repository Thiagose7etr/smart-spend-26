import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { AppShell } from "@/components/app-shell";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Plus, Pencil, Trash2, Truck, Search } from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { sbFrom, type Frota } from "@/lib/db-types";

export const Route = createFileRoute("/_authenticated/frotas")({
  component: FrotasPage,
  head: () => ({
    meta: [
      { title: "Frotas — THcontrol" },
      { name: "description", content: "Cadastro e gestão da frota de veículos." },
    ],
  }),
});

const emptyForm = (): Partial<Frota> => ({
  codigo: "",
  placa: "",
  tipo: "",
  modelo: "",
  marca: "",
  chassi: "",
});

function FrotasPage() {
  const qc = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState<Partial<Frota>>(emptyForm());
  const [busca, setBusca] = useState("");

  const { data: frotas = [] } = useQuery({
    queryKey: ["frotas"],
    queryFn: async () => {
      const { data, error } = await sbFrom("frotas").select("*").order("codigo");
      if (error) throw error;
      return (data ?? []) as Frota[];
    },
  });

  const filtradas = useMemo(() => {
    const b = busca.toLowerCase();
    return frotas.filter((f) =>
      !b ||
      (f.codigo || "").toLowerCase().includes(b) ||
      (f.placa || "").toLowerCase().includes(b) ||
      (f.marca || "").toLowerCase().includes(b) ||
      (f.tipo || "").toLowerCase().includes(b),
    );
  }, [frotas, busca]);

  const salvar = useMutation({
    mutationFn: async (f: Partial<Frota>) => {
      const payload = {
        codigo: (f.codigo || "").toString(),
        placa: f.placa || null,
        tipo: f.tipo || null,
        modelo: f.modelo || null,
        marca: f.marca || null,
        chassi: f.chassi || null,
      };
      if (f.id) {
        const { error } = await sbFrom("frotas").update(payload).eq("id", f.id);
        if (error) throw error;
      } else {
        const { error } = await sbFrom("frotas").insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["frotas"] });
      setDialogOpen(false);
      setForm(emptyForm());
      toast.success("Frota salva");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const excluir = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await sbFrom("frotas").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["frotas"] });
      toast.success("Removida");
    },
  });

  return (
    <AppShell>
      <div className="flex flex-wrap items-end justify-between gap-4 mb-6">
        <div>
          <div className="text-xs uppercase tracking-[0.2em] text-primary/80 mb-2">Ativos</div>
          <h1 className="text-3xl font-bold tracking-tight">Frota</h1>
          <p className="text-sm text-muted-foreground mt-1">{frotas.length} veículos cadastrados</p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button onClick={() => setForm(emptyForm())} className="text-primary-foreground border-0" style={{ background: "var(--gradient-primary)" }}>
              <Plus className="h-4 w-4 mr-2" /> Nova frota
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>{form.id ? "Editar frota" : "Nova frota"}</DialogTitle>
            </DialogHeader>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">Código</Label>
                <Input value={form.codigo ?? ""} onChange={(e) => setForm({ ...form, codigo: e.target.value })} placeholder="201" />
              </div>
              <div>
                <Label className="text-xs">Placa</Label>
                <Input value={form.placa ?? ""} onChange={(e) => setForm({ ...form, placa: e.target.value })} placeholder="ABC1D23" />
              </div>
              <div>
                <Label className="text-xs">Tipo</Label>
                <Input value={form.tipo ?? ""} onChange={(e) => setForm({ ...form, tipo: e.target.value })} placeholder="ROMEU E JULIETA" />
              </div>
              <div>
                <Label className="text-xs">Modelo</Label>
                <Input value={form.modelo ?? ""} onChange={(e) => setForm({ ...form, modelo: e.target.value })} />
              </div>
              <div>
                <Label className="text-xs">Marca</Label>
                <Input value={form.marca ?? ""} onChange={(e) => setForm({ ...form, marca: e.target.value })} />
              </div>
              <div>
                <Label className="text-xs">Chassi</Label>
                <Input value={form.chassi ?? ""} onChange={(e) => setForm({ ...form, chassi: e.target.value })} />
              </div>
            </div>
            <DialogFooter>
              <Button onClick={() => salvar.mutate(form)} disabled={salvar.isPending || !form.codigo} className="text-primary-foreground border-0" style={{ background: "var(--gradient-primary)" }}>
                {salvar.isPending ? "Salvando…" : "Salvar"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <Card className="mb-4">
        <CardContent className="pt-6">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Buscar por código, placa, marca ou tipo…" className="pl-9" />
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
        {filtradas.map((f) => (
          <Card key={f.id} className="group hover:border-primary/40 transition-colors">
            <CardContent className="pt-5">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <div className="grid h-11 w-11 place-items-center rounded-lg bg-primary/15 text-primary">
                    <Truck className="h-5 w-5" />
                  </div>
                  <div>
                    <div className="text-xs uppercase tracking-wider text-muted-foreground">Frota</div>
                    <div className="text-lg font-bold tabular-nums">{f.codigo}</div>
                  </div>
                </div>
                <div className="opacity-0 group-hover:opacity-100 transition flex gap-1">
                  <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => { setForm(f); setDialogOpen(true); }}>
                    <Pencil className="h-3.5 w-3.5" />
                  </Button>
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button size="icon" variant="ghost" className="h-8 w-8 text-destructive"><Trash2 className="h-3.5 w-3.5" /></Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Excluir frota {f.codigo}?</AlertDialogTitle>
                        <AlertDialogDescription>Esta ação não pode ser desfeita.</AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancelar</AlertDialogCancel>
                        <AlertDialogAction onClick={() => excluir.mutate(f.id)} className="bg-destructive">Excluir</AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </div>
              </div>
              <div className="mt-4 space-y-1.5 text-sm">
                <Row label="Placa" value={f.placa} mono />
                <Row label="Tipo" value={f.tipo} />
                <Row label="Modelo" value={f.modelo} />
                <Row label="Marca" value={f.marca} />
                <Row label="Chassi" value={f.chassi} mono small />
              </div>
            </CardContent>
          </Card>
        ))}
        {filtradas.length === 0 && (
          <div className="col-span-full text-center py-16 text-muted-foreground text-sm">Nenhuma frota encontrada.</div>
        )}
      </div>
    </AppShell>
  );
}

function Row({ label, value, mono, small }: { label: string; value: string | null; mono?: boolean; small?: boolean }) {
  return (
    <div className="flex justify-between gap-2">
      <span className="text-muted-foreground text-xs">{label}</span>
      <span className={`${mono ? "font-mono" : ""} ${small ? "text-[11px]" : ""} truncate max-w-[60%]`}>{value || "-"}</span>
    </div>
  );
}