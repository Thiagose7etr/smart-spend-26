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
import { Plus, Fuel, Droplet, ArrowDownRight, ArrowUpRight, Trash2, TrendingDown, CalendarClock, ShieldAlert } from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { fmtNum, sbFrom, formatLocalDateString, MESES, type Combustivel } from "@/lib/db-types";
import { useCurrentUserAccess } from "@/hooks/use-auth";

const getDuracaoData = (dias: number) => {
  if (dias <= 0) return "";
  const date = new Date();
  date.setDate(date.getDate() + Math.round(dias));
  return date.toLocaleDateString("pt-BR");
};

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
  quantidade: "" as any,
});

function CombustivelPage() {
  const qc = useQueryClient();
  const { access, loading: accessLoading } = useCurrentUserAccess();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState<FormState>(emptyForm());
  const [filtroMes, setFiltroMes] = useState<string>("todos");
  const [filtroAno, setFiltroAno] = useState<string>("todos");
  const [filtroTipo, setFiltroTipo] = useState<string>("todos");
  const [filtroMov, setFiltroMov] = useState<string>("todos");

  const { data: movs = [] } = useQuery({
    queryKey: ["combustivel"],
    queryFn: async () => {
      const { data, error } = await sbFrom("combustivel").select("*").order("data", { ascending: false }).limit(500);
      if (error) throw error;
      return (data ?? []) as Combustivel[];
    },
  });



  const anosUnicos = useMemo(() => {
    const years = movs.map((m) => {
      if (!m.data) return null;
      return m.data.split("-")[0];
    }).filter(Boolean) as string[];
    return Array.from(new Set(years)).sort((a, b) => b.localeCompare(a));
  }, [movs]);

  const filtrados = useMemo(() => {
    return movs.filter((m) => {
      if (!m.data) return false;
      const parts = m.data.split("-");
      if (parts.length !== 3) return false;
      const ano = parts[0];
      const mesIndex = parseInt(parts[1], 10) - 1;
      const mesNome = MESES[mesIndex];

      if (filtroMes !== "todos" && mesNome !== filtroMes) return false;
      if (filtroAno !== "todos" && ano !== filtroAno) return false;
      if (filtroTipo !== "todos" && m.tipo !== filtroTipo) return false;
      if (filtroMov !== "todos" && m.movimento !== filtroMov) return false;
      return true;
    });
  }, [movs, filtroMes, filtroAno, filtroTipo, filtroMov]);

  const stats = useMemo(() => {
    const s10EntTotal = movs.filter((m) => m.tipo === "S10" && m.movimento === "ENTRADA").reduce((s, m) => s + Number(m.quantidade), 0);
    const s10SaiTotal = movs.filter((m) => m.tipo === "S10" && m.movimento === "SAIDA").reduce((s, m) => s + Number(m.quantidade), 0);
    const s500EntTotal = movs.filter((m) => m.tipo === "S500" && m.movimento === "ENTRADA").reduce((s, m) => s + Number(m.quantidade), 0);
    const s500SaiTotal = movs.filter((m) => m.tipo === "S500" && m.movimento === "SAIDA").reduce((s, m) => s + Number(m.quantidade), 0);

    const s10Estoque = s10EntTotal - s10SaiTotal;
    const s500Estoque = s500EntTotal - s500SaiTotal;

    const s10Ent = filtrados.filter((m) => m.tipo === "S10" && m.movimento === "ENTRADA").reduce((s, m) => s + Number(m.quantidade), 0);
    const s10Sai = filtrados.filter((m) => m.tipo === "S10" && m.movimento === "SAIDA").reduce((s, m) => s + Number(m.quantidade), 0);
    const s500Ent = filtrados.filter((m) => m.tipo === "S500" && m.movimento === "ENTRADA").reduce((s, m) => s + Number(m.quantidade), 0);
    const s500Sai = filtrados.filter((m) => m.tipo === "S500" && m.movimento === "SAIDA").reduce((s, m) => s + Number(m.quantidade), 0);

    const calcMedia = (tipo: string) => {
      const saidas = filtrados.filter((m) => m.tipo === tipo && m.movimento === "SAIDA");
      if (saidas.length === 0) return 0;
      const datas = saidas.map((m) => new Date(m.data + "T00:00:00").getTime()).filter((t) => !Number.isNaN(t));
      if (datas.length === 0) return 0;
      const min = Math.min(...datas);
      const max = Math.max(...datas);
      const dias = Math.max(1, Math.round((max - min) / 86400000) + 1);
      const total = saidas.reduce((s, m) => s + Number(m.quantidade), 0);
      return total / dias;
    };

    const s10Media = calcMedia("S10");
    const s500Media = calcMedia("S500");

    return {
      s10Estoque, s500Estoque,
      s10Ent, s10Sai, s500Ent, s500Sai,
      s10Media, s500Media,
      s10Dias: s10Media > 0 ? s10Estoque / s10Media : 0,
      s500Dias: s500Media > 0 ? s500Estoque / s500Media : 0,
    };
  }, [movs, filtrados]);

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

  if (accessLoading) {
    return (
      <AppShell>
        <div className="flex h-[50vh] items-center justify-center">
          <div className="text-sm text-muted-foreground animate-pulse">Carregando permissões…</div>
        </div>
      </AppShell>
    );
  }

  if (!access || !access.canView("combustivel")) {
    return (
      <AppShell>
        <div className="flex h-[60vh] items-center justify-center">
          <Card className="max-w-md w-full border-border/60 shadow-lg">
            <CardHeader className="text-center pb-2">
              <div className="mx-auto h-12 w-12 rounded-full bg-destructive/15 text-destructive flex items-center justify-center mb-4">
                <ShieldAlert className="h-6 w-6" />
              </div>
              <CardTitle className="text-xl font-bold">Acesso Restrito</CardTitle>
            </CardHeader>
            <CardContent className="text-center space-y-4 pt-2">
              <p className="text-sm text-muted-foreground">
                Você não tem permissão para acessar a aba de <strong>Combustível</strong>. 
                Entre em contato com o administrador do sistema para solicitar acesso.
              </p>
            </CardContent>
          </Card>
        </div>
      </AppShell>
    );
  }

  const canEdit = access.canEdit("combustivel");

  return (
    <AppShell>
      <div className="flex flex-wrap items-end justify-between gap-4 mb-6">
        <div>
          <div className="text-xs uppercase tracking-[0.2em] text-primary/80 mb-2">Estoque</div>
          <h1 className="text-3xl font-bold tracking-tight">Combustível</h1>
          <p className="text-sm text-muted-foreground mt-1">
            {filtrados.length} lançamentos · Total {fmtNum(filtrados.reduce((s, m) => s + Number(m.quantidade), 0))} Litros
          </p>
        </div>
        {canEdit && (
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
                    <Input type="number" step="0.01" value={form.quantidade === 0 ? "" : form.quantidade} onChange={(e) => setForm({ ...form, quantidade: e.target.value === "" ? "" : Number(e.target.value) })} />
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
        )}
      </div>

      <div className="grid gap-4 md:grid-cols-2 mb-6">
        <StatCard label="Estoque S10" value={`${fmtNum(stats.s10Estoque)} L`} icon={Fuel} tone="primary" />
        <StatCard label="Estoque S500" value={`${fmtNum(stats.s500Estoque)} L`} icon={Fuel} tone="accent" />
      </div>

      <div className="grid gap-4 md:grid-cols-2 mb-6">
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-base flex items-center gap-2"><Fuel className="h-4 w-4 text-primary" /> Projeção Diesel S10</CardTitle></CardHeader>
          <CardContent className="grid grid-cols-3 gap-4">
            <Metric label="Média diária" value={`${fmtNum(stats.s10Media, 1)} L`} icon={TrendingDown} />
            <Metric label="Estoque atual" value={`${fmtNum(stats.s10Estoque)} L`} icon={Fuel} />
            <Metric 
              label="Dura por" 
              value={stats.s10Media > 0 ? `${Math.round(stats.s10Dias)} dias` : "—"} 
              subtext={stats.s10Media > 0 ? `Até ${getDuracaoData(stats.s10Dias)}` : undefined} 
              icon={CalendarClock} 
              highlight 
            />
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-base flex items-center gap-2"><Fuel className="h-4 w-4 text-accent" /> Projeção Diesel S500</CardTitle></CardHeader>
          <CardContent className="grid grid-cols-3 gap-4">
            <Metric label="Média diária" value={`${fmtNum(stats.s500Media, 1)} L`} icon={TrendingDown} />
            <Metric label="Estoque atual" value={`${fmtNum(stats.s500Estoque)} L`} icon={Fuel} />
            <Metric 
              label="Dura por" 
              value={stats.s500Media > 0 ? `${Math.round(stats.s500Dias)} dias` : "—"} 
              subtext={stats.s500Media > 0 ? `Até ${getDuracaoData(stats.s500Dias)}` : undefined} 
              icon={CalendarClock} 
              highlight 
            />
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
          <CardTitle className="text-base">Histórico</CardTitle>
          <div className="flex flex-wrap gap-2">
            <Select value={filtroMes} onValueChange={setFiltroMes}>
              <SelectTrigger className="w-[130px] h-8">
                <SelectValue placeholder="Mês" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos meses</SelectItem>
                {MESES.map((m) => <SelectItem key={m} value={m}>{m}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={filtroAno} onValueChange={setFiltroAno}>
              <SelectTrigger className="w-[95px] h-8">
                <SelectValue placeholder="Ano" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos anos</SelectItem>
                {anosUnicos.map((y) => <SelectItem key={y} value={y}>{y}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={filtroTipo} onValueChange={setFiltroTipo}>
              <SelectTrigger className="w-[125px] h-8">
                <SelectValue placeholder="Combustível" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos tipos</SelectItem>
                <SelectItem value="S10">Diesel S10</SelectItem>
                <SelectItem value="S500">Diesel S500</SelectItem>
              </SelectContent>
            </Select>
            <Select value={filtroMov} onValueChange={setFiltroMov}>
              <SelectTrigger className="w-[125px] h-8">
                <SelectValue placeholder="Movimento" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos movs</SelectItem>
                <SelectItem value="ENTRADA">Entrada</SelectItem>
                <SelectItem value="SAIDA">Saída</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
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
                  {canEdit && <TableHead />}
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtrados.length === 0 && (
                  <TableRow><TableCell colSpan={7} className="text-center py-10 text-muted-foreground">Nenhum lançamento.</TableCell></TableRow>
                )}
                {filtrados.map((m) => (
                  <TableRow key={m.id}>
                    <TableCell className="tabular-nums text-xs">{formatLocalDateString(m.data)}</TableCell>
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
                    {canEdit && (
                      <TableCell>
                        <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive" onClick={() => excluir.mutate(m.id)}>
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </TableCell>
                    )}
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

function Metric({ label, value, subtext, icon: Icon, highlight }: { label: string; value: string; subtext?: string; icon: React.ElementType; highlight?: boolean }) {
  return (
    <div className={`rounded-lg border border-border p-3 ${highlight ? "bg-primary/10 border-primary/40" : "bg-muted/30"}`}>
      <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-wider text-muted-foreground">
        <Icon className="h-3 w-3" /> {label}
      </div>
      <div className={`text-xl font-bold mt-1 tabular-nums ${highlight ? "text-primary" : ""}`}>{value}</div>
      {subtext && <div className="text-[10px] text-muted-foreground mt-1 font-medium">{subtext}</div>}
    </div>
  );
}