import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { AppShell } from "@/components/app-shell";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Plus, Fuel, Droplet, ArrowDownRight, ArrowUpRight, Trash2, TrendingDown, CalendarClock } from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { fmtNum, sbFrom, type Combustivel } from "@/lib/db-types";

export const Route = createFileRoute("/_authenticated/combustivel")({
  component: CombustivelPage,
  head: () => ({
    meta: [
      { title: "Combustível — THcontrol" },
      { name: "description", content: "Controle de entradas e saídas de combustível S10 e S500." },
    ],
  }),
});

type FormState = {
  id?: string;
  data: string;
  tipo: string;
  movimento: string;
  quantidade: number;
  frota?: string;
  observacao?: string;
};
const emptyForm = (): FormState => ({
  data: new Date().toISOString().slice(0, 10),
  tipo: "S10",
  movimento: "SAIDA",
  quantidade: 0,
});

function CombustivelPage() {
  const qc = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState<FormState>(emptyForm());

  const { data: movs = [] } = useQuery({
    queryKey: ["combustivel"],
    queryFn: async () => {
      const { data, error } = await sbFrom("combustivel").select("*").order("data", { ascending: false }).limit(500);
      if (error) throw error;
      return (data ?? []) as Combustivel[];
    },
  });

  const stats = useMemo(() => {
    const s10Ent = movs.filter((m) => m.tipo === "S10" && m.movimento === "ENTRADA").reduce((s, m) => s + Number(m.quantidade), 0);
    const s10Sai = movs.filter((m) => m.tipo === "S10" && m.movimento === "SAIDA").reduce((s, m) => s + Number(m.quantidade), 0);
    const s500Ent = movs.filter((m) => m.tipo === "S500" && m.movimento === "ENTRADA").reduce((s, m) => s + Number(m.quantidade), 0);
    const s500Sai = movs.filter((m) => m.tipo === "S500" && m.movimento === "SAIDA").reduce((s, m) => s + Number(m.quantidade), 0);

    const calcMedia = (tipo: string) => {
      const saidas = movs.filter((m) => m.tipo === tipo && m.movimento === "SAIDA");
      if (saidas.length === 0) return 0;
      const datas = saidas.map((m) => new Date(m.data).getTime()).filter((t) => !Number.isNaN(t));
      if (datas.length === 0) return 0;
      const min = Math.min(...datas);
      const max = Math.max(...datas);
      const dias = Math.max(1, Math.round((max - min) / 86400000) + 1);
      const total = saidas.reduce((s, m) => s + Number(m.quantidade), 0);
      return total / dias;
    };

    const s10Media = calcMedia("S10");
    const s500Media = calcMedia("S500");
    const s10Estoque = s10Ent - s10Sai;
    const s500Estoque = s500Ent - s500Sai;

    return {
      s10Estoque, s500Estoque,
      s10Ent, s10Sai, s500Ent, s500Sai,
      s10Media, s500Media,
      s10Dias: s10Media > 0 ? s10Estoque / s10Media : 0,
      s500Dias: s500Media > 0 ? s500Estoque / s500Media : 0,
    };
  }, [movs]);

  const salvar = useMutation({
    mutationFn: async (f: FormState) => {
      const payload = {
        data: f.data,
        tipo: f.tipo,
        movimento: f.movimento,
        quantidade: Number(f.quantidade),
        frota: f.frota || null,
        observacao: f.observacao || null,
      };
      if (f.id) {
        const { error } = await sbFrom("combustivel").update(payload).eq("id", f.id);
        if (error) throw error;
      } else {
        const { error } = await sbFrom("combustivel").insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["combustivel"] });
      setDialogOpen(false);
      setForm(emptyForm());
      toast.success("Movimentação registrada");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const excluir = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await sbFrom("combustivel").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["combustivel"] }),
  });

  return (
    <AppShell>
      <div className="flex flex-wrap items-end justify-between gap-4 mb-6">
        <div>
          <div className="text-xs uppercase tracking-[0.2em] text-primary/80 mb-2">Estoque</div>
          <h1 className="text-3xl font-bold tracking-tight">Combustível</h1>
          <p className="text-sm text-muted-foreground mt-1">Registro de entradas e consumo por diesel.</p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button onClick={() => setForm(emptyForm())} className="text-primary-foreground border-0" style={{ background: "var(--gradient-primary)" }}>
              <Plus className="h-4 w-4 mr-2" /> Nova movimentação
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Nova movimentação</DialogTitle></DialogHeader>
            <div className="grid gap-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs">Data</Label>
                  <Input type="date" value={form.data} onChange={(e) => setForm({ ...form, data: e.target.value })} />
                </div>
                <div>
                  <Label className="text-xs">Tipo</Label>
                  <Select value={form.tipo} onValueChange={(v) => setForm({ ...form, tipo: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="S10">Diesel S10</SelectItem>
                      <SelectItem value="S500">Diesel S500</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-xs">Movimento</Label>
                  <Select value={form.movimento} onValueChange={(v) => setForm({ ...form, movimento: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="ENTRADA">Entrada (compra)</SelectItem>
                      <SelectItem value="SAIDA">Saída (consumo)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-xs">Quantidade (litros)</Label>
                  <Input type="number" step="0.01" value={form.quantidade} onChange={(e) => setForm({ ...form, quantidade: Number(e.target.value) })} />
                </div>
              </div>
              <div>
                <Label className="text-xs">Frota (se saída)</Label>
                <Input value={form.frota ?? ""} onChange={(e) => setForm({ ...form, frota: e.target.value })} placeholder="Ex: 201" />
              </div>
              <div>
                <Label className="text-xs">Observação</Label>
                <Input value={form.observacao ?? ""} onChange={(e) => setForm({ ...form, observacao: e.target.value })} />
              </div>
            </div>
            <DialogFooter>
              <Button onClick={() => salvar.mutate(form)} disabled={salvar.isPending} className="text-primary-foreground border-0" style={{ background: "var(--gradient-primary)" }}>
                {salvar.isPending ? "Salvando…" : "Registrar"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid gap-4 md:grid-cols-4 mb-6">
        <StatCard label="Estoque S10" value={`${fmtNum(stats.s10Estoque)} L`} icon={Fuel} tone="primary" />
        <StatCard label="Estoque S500" value={`${fmtNum(stats.s500Estoque)} L`} icon={Droplet} tone="accent" />
        <StatCard label="Saídas S10" value={`${fmtNum(stats.s10Sai)} L`} icon={ArrowDownRight} tone="muted" />
        <StatCard label="Saídas S500" value={`${fmtNum(stats.s500Sai)} L`} icon={ArrowDownRight} tone="muted" />
      </div>

      <div className="grid gap-4 md:grid-cols-2 mb-6">
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-base flex items-center gap-2"><Fuel className="h-4 w-4 text-primary" /> Projeção Diesel S10</CardTitle></CardHeader>
          <CardContent className="grid grid-cols-3 gap-4">
            <Metric label="Média diária" value={`${fmtNum(stats.s10Media, 1)} L`} icon={TrendingDown} />
            <Metric label="Estoque atual" value={`${fmtNum(stats.s10Estoque)} L`} icon={Fuel} />
            <Metric label="Dura por" value={stats.s10Media > 0 ? `${fmtNum(stats.s10Dias, 1)} dias` : "—"} icon={CalendarClock} highlight />
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-base flex items-center gap-2"><Droplet className="h-4 w-4 text-accent" /> Projeção Diesel S500</CardTitle></CardHeader>
          <CardContent className="grid grid-cols-3 gap-4">
            <Metric label="Média diária" value={`${fmtNum(stats.s500Media, 1)} L`} icon={TrendingDown} />
            <Metric label="Estoque atual" value={`${fmtNum(stats.s500Estoque)} L`} icon={Droplet} />
            <Metric label="Dura por" value={stats.s500Media > 0 ? `${fmtNum(stats.s500Dias, 1)} dias` : "—"} icon={CalendarClock} highlight />
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader><CardTitle className="text-base">Histórico</CardTitle></CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Data</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead>Movimento</TableHead>
                  <TableHead className="text-right">Litros</TableHead>
                  <TableHead>Frota</TableHead>
                  <TableHead>Observação</TableHead>
                  <TableHead />
                </TableRow>
              </TableHeader>
              <TableBody>
                {movs.length === 0 && (
                  <TableRow><TableCell colSpan={7} className="text-center py-10 text-muted-foreground">Nenhum lançamento.</TableCell></TableRow>
                )}
                {movs.map((m) => (
                  <TableRow key={m.id}>
                    <TableCell className="tabular-nums text-xs">{new Date(m.data).toLocaleDateString("pt-BR")}</TableCell>
                    <TableCell><Badge variant="secondary">{m.tipo}</Badge></TableCell>
                    <TableCell>
                      {m.movimento === "ENTRADA" ? (
                        <span className="inline-flex items-center gap-1 text-primary text-xs font-medium"><ArrowUpRight className="h-3 w-3" /> ENTRADA</span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-accent text-xs font-medium"><ArrowDownRight className="h-3 w-3" /> SAÍDA</span>
                      )}
                    </TableCell>
                    <TableCell className="text-right tabular-nums font-medium">{fmtNum(m.quantidade)}</TableCell>
                    <TableCell className="text-xs">{m.frota || "-"}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">{m.observacao || "-"}</TableCell>
                    <TableCell>
                      <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive" onClick={() => excluir.mutate(m.id)}>
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </AppShell>
  );
}

function StatCard({ label, value, icon: Icon, tone }: { label: string; value: string; icon: React.ElementType; tone: "primary" | "accent" | "muted" }) {
  return (
    <Card>
      <CardContent className="pt-6 flex items-center justify-between">
        <div>
          <div className="text-xs uppercase tracking-wider text-muted-foreground">{label}</div>
          <div className="text-2xl font-bold mt-1 tabular-nums">{value}</div>
        </div>
        <div className={`grid h-11 w-11 place-items-center rounded-lg ${
          tone === "primary" ? "bg-primary/15 text-primary" :
          tone === "accent" ? "bg-accent/15 text-accent" :
          "bg-muted text-muted-foreground"
        }`}>
          <Icon className="h-5 w-5" />
        </div>
      </CardContent>
    </Card>
  );
}

function Metric({ label, value, icon: Icon, highlight }: { label: string; value: string; icon: React.ElementType; highlight?: boolean }) {
  return (
    <div className={`rounded-lg border border-border p-3 ${highlight ? "bg-primary/10 border-primary/40" : "bg-muted/30"}`}>
      <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-wider text-muted-foreground">
        <Icon className="h-3 w-3" /> {label}
      </div>
      <div className={`text-xl font-bold mt-1 tabular-nums ${highlight ? "text-primary" : ""}`}>{value}</div>
    </div>
  );
}