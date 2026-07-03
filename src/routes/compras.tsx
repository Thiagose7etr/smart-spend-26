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
import { Plus, Search, Pencil, Trash2, FileDown } from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { fmtBRL, MESES, CATEGORIAS, mesFromDate, sbFrom, type Compra } from "@/lib/db-types";

export const Route = createFileRoute("/compras")({
  component: ComprasPage,
  head: () => ({
    meta: [
      { title: "Compras — CustoControl" },
      { name: "description", content: "Cadastro e listagem de notas fiscais e compras." },
    ],
  }),
});

type FormState = Partial<Compra> & { id?: string };
const emptyForm = (): FormState => ({
  nf: "",
  fornecedor: "",
  data_emissao: new Date().toISOString().slice(0, 10),
  item: "",
  quant: 1,
  valor_unit: 0,
  valor_total: 0,
  frota: "",
  prazo_pag: "",
  tipo: "PEÇAS",
});

function ComprasPage() {
  const qc = useQueryClient();
  const [busca, setBusca] = useState("");
  const [filtroTipo, setFiltroTipo] = useState<string>("todos");
  const [filtroMes, setFiltroMes] = useState<string>("todos");
  const [filtroAno, setFiltroAno] = useState<string>("todos");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState<FormState>(emptyForm());

  const { data: compras = [], isLoading } = useQuery({
    queryKey: ["compras", "all"],
    queryFn: async () => {
      const { data, error } = await sbFrom("compras")
        .select("*")
        .order("data_emissao", { ascending: false })
        .limit(5000);
      if (error) throw error;
      return (data ?? []) as unknown as Compra[];
    },
  });

  const filtrados = useMemo(() => {
    const b = busca.toLowerCase().trim();
    return compras.filter((c) => {
      if (filtroTipo !== "todos" && c.tipo !== filtroTipo) return false;
      if (filtroMes !== "todos" && c.mes !== filtroMes) return false;
      if (filtroAno !== "todos" && String(c.ano) !== filtroAno) return false;
      if (!b) return true;
      return (
        (c.fornecedor || "").toLowerCase().includes(b) ||
        (c.item || "").toLowerCase().includes(b) ||
        (c.nf || "").toLowerCase().includes(b) ||
        (c.frota || "").toLowerCase().includes(b)
      );
    });
  }, [compras, busca, filtroTipo, filtroMes, filtroAno]);

  const total = filtrados.reduce((s, c) => s + Number(c.valor_total || 0), 0);

  const tiposUnicos = Array.from(new Set([...CATEGORIAS, ...compras.map((c) => c.tipo).filter(Boolean) as string[]])).sort();
  const anosUnicos = Array.from(new Set(compras.map((c) => c.ano).filter(Boolean))) as number[];
  anosUnicos.sort((a, b) => b - a);

  const salvar = useMutation({
    mutationFn: async (f: FormState) => {
      const info = mesFromDate(f.data_emissao || null);
      const payload = {
        nf: f.nf || null,
        fornecedor: f.fornecedor || null,
        data_emissao: f.data_emissao || null,
        item: f.item || null,
        quant: Number(f.quant || 0),
        valor_unit: Number(f.valor_unit || 0),
        valor_total: Number(f.valor_total || 0),
        frota: f.frota || null,
        prazo_pag: f.prazo_pag || null,
        tipo: f.tipo || null,
        mes: info?.mes ?? null,
        ano: info?.ano ?? null,
      };
      if (f.id) {
        const { error } = await sbFrom("compras").update(payload).eq("id", f.id);
        if (error) throw error;
      } else {
        const { error } = await sbFrom("compras").insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["compras"] });
      setDialogOpen(false);
      setForm(emptyForm());
      toast.success("Compra salva com sucesso");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const excluir = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await sbFrom("compras").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["compras"] });
      toast.success("Compra excluída");
    },
  });

  const openNovo = () => {
    setForm(emptyForm());
    setDialogOpen(true);
  };
  const openEditar = (c: Compra) => {
    setForm({ ...c });
    setDialogOpen(true);
  };

  const exportCsv = () => {
    const rows = [
      ["NF", "Fornecedor", "Data", "Item", "Quant", "V. Unit", "V. Total", "Frota", "Prazo", "Tipo"],
      ...filtrados.map((c) => [
        c.nf || "",
        c.fornecedor || "",
        c.data_emissao || "",
        c.item || "",
        c.quant ?? "",
        c.valor_unit ?? "",
        c.valor_total ?? "",
        c.frota || "",
        c.prazo_pag || "",
        c.tipo || "",
      ]),
    ];
    const csv = rows.map((r) => r.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(";")).join("\n");
    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `compras_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <AppShell>
      <div className="flex flex-wrap items-end justify-between gap-4 mb-6">
        <div>
          <div className="text-xs uppercase tracking-[0.2em] text-primary/80 mb-2">
            Registro Fiscal
          </div>
          <h1 className="text-3xl font-bold tracking-tight">Compras</h1>
          <p className="text-sm text-muted-foreground mt-1">
            {filtrados.length} lançamentos • Total {fmtBRL(total)}
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={exportCsv}>
            <FileDown className="h-4 w-4 mr-2" /> Exportar
          </Button>
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button
                onClick={openNovo}
                className="text-primary-foreground border-0"
                style={{ background: "var(--gradient-primary)", boxShadow: "var(--shadow-glow)" }}
              >
                <Plus className="h-4 w-4 mr-2" /> Nova Compra
              </Button>
            </DialogTrigger>
            <CompraDialog form={form} setForm={setForm} onSave={() => salvar.mutate(form)} saving={salvar.isPending} tipos={tiposUnicos} />
          </Dialog>
        </div>
      </div>

      {/* Filtros */}
      <Card className="mb-6">
        <CardContent className="pt-6 flex flex-wrap gap-3">
          <div className="relative flex-1 min-w-[220px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              placeholder="Buscar por fornecedor, item, NF ou frota…"
              className="pl-9"
            />
          </div>
          <Select value={filtroTipo} onValueChange={setFiltroTipo}>
            <SelectTrigger className="w-[180px]"><SelectValue placeholder="Tipo" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos os tipos</SelectItem>
              {tiposUnicos.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={filtroMes} onValueChange={setFiltroMes}>
            <SelectTrigger className="w-[150px]"><SelectValue placeholder="Mês" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos meses</SelectItem>
              {MESES.map((m) => <SelectItem key={m} value={m}>{m}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={filtroAno} onValueChange={setFiltroAno}>
            <SelectTrigger className="w-[120px]"><SelectValue placeholder="Ano" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos anos</SelectItem>
              {anosUnicos.map((y) => <SelectItem key={y} value={String(y)}>{y}</SelectItem>)}
            </SelectContent>
          </Select>
        </CardContent>
      </Card>

      <Card>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[100px]">NF</TableHead>
                <TableHead>Fornecedor</TableHead>
                <TableHead>Item</TableHead>
                <TableHead className="w-[110px]">Data</TableHead>
                <TableHead className="w-[80px] text-right">Qtd</TableHead>
                <TableHead className="w-[130px] text-right">Total</TableHead>
                <TableHead className="w-[80px]">Frota</TableHead>
                <TableHead className="w-[140px]">Tipo</TableHead>
                <TableHead className="w-[80px]" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading && (
                <TableRow><TableCell colSpan={9} className="text-center py-10 text-muted-foreground">Carregando…</TableCell></TableRow>
              )}
              {!isLoading && filtrados.length === 0 && (
                <TableRow><TableCell colSpan={9} className="text-center py-10 text-muted-foreground">Nenhum lançamento encontrado.</TableCell></TableRow>
              )}
              {filtrados.slice(0, 500).map((c) => (
                <TableRow key={c.id}>
                  <TableCell className="font-mono text-xs">{c.nf || "-"}</TableCell>
                  <TableCell className="font-medium">{c.fornecedor || "-"}</TableCell>
                  <TableCell className="text-muted-foreground max-w-[240px] truncate">{c.item || "-"}</TableCell>
                  <TableCell className="tabular-nums text-xs">
                    {c.data_emissao ? new Date(c.data_emissao).toLocaleDateString("pt-BR") : "-"}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">{c.quant ?? "-"}</TableCell>
                  <TableCell className="text-right tabular-nums font-medium">{fmtBRL(c.valor_total)}</TableCell>
                  <TableCell className="text-xs">{c.frota || "-"}</TableCell>
                  <TableCell>
                    {c.tipo && <Badge variant="secondary" className="text-[10px] font-medium">{c.tipo}</Badge>}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-1">
                      <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => openEditar(c)}>
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button size="icon" variant="ghost" className="h-8 w-8 text-destructive hover:text-destructive">
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Excluir compra?</AlertDialogTitle>
                            <AlertDialogDescription>
                              Esta ação não pode ser desfeita. {c.fornecedor} - {c.item}
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancelar</AlertDialogCancel>
                            <AlertDialogAction onClick={() => excluir.mutate(c.id)} className="bg-destructive text-destructive-foreground">
                              Excluir
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
        {filtrados.length > 500 && (
          <div className="p-3 text-center text-xs text-muted-foreground border-t border-border">
            Mostrando 500 de {filtrados.length} resultados — refine os filtros para ver mais.
          </div>
        )}
      </Card>
    </AppShell>
  );
}

function CompraDialog({
  form,
  setForm,
  onSave,
  saving,
  tipos,
}: {
  form: FormState;
  setForm: (f: FormState) => void;
  onSave: () => void;
  saving: boolean;
  tipos: string[];
}) {
  const update = <K extends keyof FormState>(k: K, v: FormState[K]) => setForm({ ...form, [k]: v });
  const total = Number(form.quant || 0) * Number(form.valor_unit || 0);
  const useCalculated = () => update("valor_total", total);

  return (
    <DialogContent className="max-w-2xl">
      <DialogHeader>
        <DialogTitle>{form.id ? "Editar compra" : "Nova compra"}</DialogTitle>
      </DialogHeader>
      <div className="grid grid-cols-2 gap-4 py-2">
        <div>
          <Label className="text-xs">Nota Fiscal</Label>
          <Input value={form.nf ?? ""} onChange={(e) => update("nf", e.target.value)} placeholder="12345" />
        </div>
        <div>
          <Label className="text-xs">Data emissão</Label>
          <Input type="date" value={form.data_emissao ?? ""} onChange={(e) => update("data_emissao", e.target.value)} />
        </div>
        <div className="col-span-2">
          <Label className="text-xs">Fornecedor</Label>
          <Input value={form.fornecedor ?? ""} onChange={(e) => update("fornecedor", e.target.value)} placeholder="Nome do fornecedor" />
        </div>
        <div className="col-span-2">
          <Label className="text-xs">Item / Descrição</Label>
          <Input value={form.item ?? ""} onChange={(e) => update("item", e.target.value)} placeholder="Bomba d'água, filtro, etc." />
        </div>
        <div>
          <Label className="text-xs">Quantidade</Label>
          <Input type="number" step="0.01" value={form.quant ?? 0} onChange={(e) => update("quant", Number(e.target.value))} />
        </div>
        <div>
          <Label className="text-xs">Valor Unitário</Label>
          <Input type="number" step="0.01" value={form.valor_unit ?? 0} onChange={(e) => update("valor_unit", Number(e.target.value))} />
        </div>
        <div>
          <Label className="text-xs flex items-center justify-between">
            Valor Total
            <button type="button" onClick={useCalculated} className="text-[10px] text-primary hover:underline">
              Calcular ({fmtBRL(total)})
            </button>
          </Label>
          <Input type="number" step="0.01" value={form.valor_total ?? 0} onChange={(e) => update("valor_total", Number(e.target.value))} />
        </div>
        <div>
          <Label className="text-xs">Frota</Label>
          <Input value={form.frota ?? ""} onChange={(e) => update("frota", e.target.value)} placeholder="201 ou ESTOQUE" />
        </div>
        <div>
          <Label className="text-xs">Prazo de pagamento</Label>
          <Input value={form.prazo_pag ?? ""} onChange={(e) => update("prazo_pag", e.target.value)} placeholder="28 ou 15/30/45" />
        </div>
        <div>
          <Label className="text-xs">Tipo / Categoria</Label>
          <Select value={form.tipo ?? ""} onValueChange={(v) => update("tipo", v)}>
            <SelectTrigger><SelectValue placeholder="Selecionar" /></SelectTrigger>
            <SelectContent>
              {tipos.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      </div>
      <DialogFooter>
        <Button
          onClick={onSave}
          disabled={saving}
          className="text-primary-foreground border-0"
          style={{ background: "var(--gradient-primary)" }}
        >
          {saving ? "Salvando…" : form.id ? "Salvar alterações" : "Cadastrar"}
        </Button>
      </DialogFooter>
    </DialogContent>
  );
}