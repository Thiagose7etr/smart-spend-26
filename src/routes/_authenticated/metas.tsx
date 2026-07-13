import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { AppShell } from "@/components/app-shell";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Progress } from "@/components/ui/progress";
import { Plus, TrendingDown, TrendingUp, ShieldAlert } from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { CATEGORIAS, MESES, fmtBRL, sbFrom, type Compra, type Meta } from "@/lib/db-types";
import { useCurrentUserAccess } from "@/hooks/use-auth";

export const Route = createFileRoute("/_authenticated/metas")({
  component: MetasPage,
  head: () => ({
    meta: [
      { title: "Metas — THcontrol" },
      { name: "description", content: "Metas mensais por categoria versus realizado." },
    ],
  }),
});

function MetasPage() {
  const qc = useQueryClient();
  const { access, loading: accessLoading } = useCurrentUserAccess();
  const now = new Date();
  const [mes, setMes] = useState<string>(MESES[now.getMonth()]);
  const [ano, setAno] = useState<number>(now.getFullYear());
  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState<{ id?: string; categoria: string; mes: string; ano: number; valor_meta: number }>({
    categoria: "COMBUSTIVEL",
    mes: MESES[now.getMonth()],
    ano: now.getFullYear(),
    valor_meta: 0,
  });

  const { data: metas = [] } = useQuery({
    queryKey: ["metas", ano, mes],
    queryFn: async () => {
      const { data, error } = await sbFrom("metas").select("*").eq("ano", ano).eq("mes", mes);
      if (error) throw error;
      return (data ?? []) as Meta[];
    },
  });

  const { data: compras = [] } = useQuery({
    queryKey: ["compras", "por-mes", ano, mes],
    queryFn: async () => {
      const { data, error } = await sbFrom("compras").select("*").eq("ano", ano).eq("mes", mes);
      if (error) throw error;
      return (data ?? []) as Compra[];
    },
  });

  const realizadoPorCat = useMemo(() => {
    const m = new Map<string, number>();
    compras.forEach((c) => {
      const k = c.tipo || "OUTROS";
      m.set(k, (m.get(k) || 0) + Number(c.valor_total || 0));
    });
    return m;
  }, [compras]);

  const linhas = useMemo(() => {
    const cats = new Set<string>([
      ...metas.map((m) => m.categoria),
      ...Array.from(realizadoPorCat.keys()),
    ]);
    return Array.from(cats).map((cat) => {
      const meta = metas.find((m) => m.categoria === cat);
      const realizado = realizadoPorCat.get(cat) || 0;
      const metaVal = Number(meta?.valor_meta || 0);
      const dif = metaVal - realizado;
      const pct = metaVal > 0 ? Math.min(100, (realizado / metaVal) * 100) : 0;
      return { categoria: cat, meta: metaVal, realizado, diferenca: dif, pct, metaId: meta?.id };
    }).sort((a, b) => b.realizado - a.realizado);
  }, [metas, realizadoPorCat]);

  const totalMeta = linhas.reduce((s, l) => s + l.meta, 0);
  const totalRealizado = linhas.reduce((s, l) => s + l.realizado, 0);
  const totalDif = totalMeta - totalRealizado;

  const anos = Array.from(new Set([2025, 2026, ano])).sort();

  const salvar = useMutation({
    mutationFn: async (f: typeof form) => {
      const payload = {
        categoria: f.categoria,
        mes: f.mes,
        ano: f.ano,
        valor_meta: Number(f.valor_meta),
      };
      const { error } = await sbFrom("metas").upsert(payload, { onConflict: "categoria,mes,ano" });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["metas"] });
      setDialogOpen(false);
      toast.success("Meta salva");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const editar = (l: typeof linhas[0]) => {
    setForm({ id: l.metaId, categoria: l.categoria, mes, ano, valor_meta: l.meta });
    setDialogOpen(true);
  };

  const novo = () => {
    setForm({ categoria: CATEGORIAS[0], mes, ano, valor_meta: 0 });
    setDialogOpen(true);
  };

  if (accessLoading) {
    return (
      <AppShell>
        <div className="flex h-[50vh] items-center justify-center">
          <div className="text-sm text-muted-foreground animate-pulse">Carregando permissões…</div>
        </div>
      </AppShell>
    );
  }

  if (!access || !access.canView("metas")) {
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
                Você não tem permissão para acessar a aba de <strong>Metas</strong>. 
                Entre em contato com o administrador do sistema para solicitar acesso.
              </p>
            </CardContent>
          </Card>
        </div>
      </AppShell>
    );
  }

  const canEdit = access.canEdit("metas");

  return (
    <AppShell>
      <div className="flex flex-wrap items-end justify-between gap-4 mb-6">
        <div>
          <div className="text-xs uppercase tracking-[0.2em] text-primary/80 mb-2">Planejamento</div>
          <h1 className="text-3xl font-bold tracking-tight">Metas mensais</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Meta {fmtBRL(totalMeta)} • Realizado {fmtBRL(totalRealizado)} •{" "}
            <span className={totalDif >= 0 ? "text-primary" : "text-destructive"}>
              {totalDif >= 0 ? "Sobra" : "Excedeu"} {fmtBRL(Math.abs(totalDif))}
            </span>
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Select value={mes} onValueChange={setMes}>
            <SelectTrigger className="w-[150px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              {MESES.map((m) => <SelectItem key={m} value={m}>{m}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={String(ano)} onValueChange={(v) => setAno(Number(v))}>
            <SelectTrigger className="w-[110px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              {anos.map((y) => <SelectItem key={y} value={String(y)}>{y}</SelectItem>)}
            </SelectContent>
          </Select>
          {canEdit && (
            <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
              <DialogTrigger asChild>
                <Button onClick={novo} className="text-primary-foreground border-0" style={{ background: "var(--gradient-primary)" }}>
                  <Plus className="h-4 w-4 mr-2" /> Definir meta
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>{form.id ? "Editar meta" : "Nova meta"}</DialogTitle>
                </DialogHeader>
                <div className="grid gap-4 py-2">
                  <div>
                    <Label className="text-xs">Categoria</Label>
                    <Select value={form.categoria} onValueChange={(v) => setForm({ ...form, categoria: v })}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {CATEGORIAS.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <Label className="text-xs">Mês</Label>
                      <Select value={form.mes} onValueChange={(v) => setForm({ ...form, mes: v })}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {MESES.map((m) => <SelectItem key={m} value={m}>{m}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label className="text-xs">Ano</Label>
                      <Input type="number" value={form.ano} onChange={(e) => setForm({ ...form, ano: Number(e.target.value) })} />
                    </div>
                  </div>
                  <div>
                    <Label className="text-xs">Valor da meta (R$)</Label>
                    <Input type="number" step="0.01" value={form.valor_meta === 0 ? "" : (form.valor_meta ?? "")} onChange={(e) => setForm({ ...form, valor_meta: e.target.value === "" ? "" : Number(e.target.value) })} />
                  </div>
                </div>
                <DialogFooter>
                  <Button onClick={() => salvar.mutate(form)} disabled={salvar.isPending} className="text-primary-foreground border-0" style={{ background: "var(--gradient-primary)" }}>
                    {salvar.isPending ? "Salvando…" : "Salvar meta"}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          )}
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">{mes} / {ano}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Categoria</TableHead>
                  <TableHead className="text-right w-[140px]">Meta</TableHead>
                  <TableHead className="text-right w-[140px]">Realizado</TableHead>
                  <TableHead className="w-[200px]">Uso</TableHead>
                  <TableHead className="text-right w-[140px]">Diferença</TableHead>
                  {canEdit && <TableHead className="w-[80px]" />}
                </TableRow>
              </TableHeader>
              <TableBody>
                {linhas.length === 0 && (
                  <TableRow><TableCell colSpan={6} className="text-center py-10 text-muted-foreground">Sem metas nem gastos neste mês.</TableCell></TableRow>
                )}
                {linhas.map((l) => {
                  const excedeu = l.diferenca < 0;
                  return (
                    <TableRow key={l.categoria}>
                      <TableCell className="font-medium">{l.categoria}</TableCell>
                      <TableCell className="text-right tabular-nums">{fmtBRL(l.meta)}</TableCell>
                      <TableCell className="text-right tabular-nums font-medium">{fmtBRL(l.realizado)}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Progress value={l.pct} className="h-2" />
                          <span className="text-[11px] text-muted-foreground w-10 text-right tabular-nums">{Math.round(l.pct)}%</span>
                        </div>
                      </TableCell>
                      <TableCell className={`text-right tabular-nums font-medium ${excedeu ? "text-destructive" : "text-primary"}`}>
                        <span className="inline-flex items-center gap-1">
                          {excedeu ? <TrendingDown className="h-3 w-3" /> : <TrendingUp className="h-3 w-3" />}
                          {fmtBRL(Math.abs(l.diferenca))}
                        </span>
                      </TableCell>
                      {canEdit && (
                        <TableCell>
                          <Button size="sm" variant="ghost" onClick={() => editar(l)}>Editar</Button>
                        </TableCell>
                      )}
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </AppShell>
  );
}