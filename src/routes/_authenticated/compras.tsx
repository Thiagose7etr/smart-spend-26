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
import { Plus, Search, Pencil, Trash2, FileDown, ScanLine, Loader2, FileSpreadsheet, ShieldAlert } from "lucide-react";
import { useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { fmtBRL, MESES, CATEGORIAS, mesFromDate, sbFrom, formatLocalDateString, type Compra } from "@/lib/db-types";
import { useServerFn } from "@tanstack/react-start";
import { extrairNotaFiscal } from "@/lib/nf-ocr.functions";
import * as XLSX from "xlsx";
import { useCurrentUserAccess } from "@/hooks/use-auth";

export const Route = createFileRoute("/_authenticated/compras")({
  component: ComprasPage,
  head: () => ({
    meta: [
      { title: "Compras — THcontrol" },
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
  quant: "" as any,
  valor_unit: "" as any,
  valor_total: "" as any,
  frota: "",
  prazo_pag: "",
  tipo: "PEÇAS",
});

function ComprasPage() {
  const qc = useQueryClient();
  const { access, loading: accessLoading } = useCurrentUserAccess();
  const [busca, setBusca] = useState("");
  const [filtroTipo, setFiltroTipo] = useState<string>("todos");
  const [filtroMes, setFiltroMes] = useState<string>("todos");
  const [filtroAno, setFiltroAno] = useState<string>("todos");
  const [filtroFrota, setFiltroFrota] = useState<string>("todos");
  const [filtroFornecedor, setFiltroFornecedor] = useState<string>("todos");
  const [filtroItem, setFiltroItem] = useState<string>("todos");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState<FormState>(emptyForm());
  const [scanLoading, setScanLoading] = useState(false);
  const scanInputRef = useRef<HTMLInputElement>(null);
  const runOcr = useServerFn(extrairNotaFiscal);

  // Importação Excel
  const [importDialogOpen, setImportDialogOpen] = useState(false);
  const [importing, setImporting] = useState(false);
  const [importData, setImportData] = useState<{ newRows: any[]; dupRows: any[] } | null>(null);
  const [importMode, setImportMode] = useState<"skip" | "update" | "all">("skip");
  const importInputRef = useRef<HTMLInputElement>(null);

  const onScanFile = async (file: File) => {
    setScanLoading(true);
    try {
      const b64: string = await new Promise((resolve, reject) => {
        const r = new FileReader();
        r.onload = () => resolve(String(r.result));
        r.onerror = () => reject(new Error("Falha ao ler arquivo"));
        r.readAsDataURL(file);
      });
      const res = await runOcr({ data: { imageBase64: b64, mimeType: file.type || "image/jpeg" } });
      setForm({
        ...emptyForm(),
        nf: res.nf ?? "",
        fornecedor: res.fornecedor ?? "",
        data_emissao: res.data_emissao ?? new Date().toISOString().slice(0, 10),
        item: res.item ?? "",
        quant: res.quant ?? 1,
        valor_unit: res.valor_unit ?? 0,
        valor_total: res.valor_total ?? (Number(res.quant || 0) * Number(res.valor_unit || 0)),
        tipo: res.tipo ?? "PEÇAS",
      });
      setDialogOpen(true);
      toast.success("NF lida! Confira os dados antes de salvar.");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro ao ler NF");
    } finally {
      setScanLoading(false);
      if (scanInputRef.current) scanInputRef.current.value = "";
    }
  };

  const findCol = (headers: string[], alternates: string[]): string | null => {
    for (const alt of alternates) {
      const matched = headers.find((h) => {
        const normalizedH = h.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]/g, "");
        const normalizedAlt = alt.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]/g, "");
        return normalizedH === normalizedAlt || normalizedH.includes(normalizedAlt);
      });
      if (matched) return matched;
    }
    return null;
  };

  const onImportFile = (file: File) => {
    setImporting(true);
    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        const data = e.target?.result;
        const workbook = XLSX.read(data, { type: "binary", cellDates: true });
        const sheetName = workbook.SheetNames[0];
        const sheet = workbook.Sheets[sheetName];
        const json = XLSX.utils.sheet_to_json<any>(sheet, { defval: null });

        if (json.length === 0) {
          toast.error("A planilha está vazia.");
          return;
        }

        const headerRow = Object.keys(json[0]);
        
        const colMap: Record<string, string> = {
          nf: findCol(headerRow, ["nf", "nota", "notafiscal", "invoice"]) || "",
          fornecedor: findCol(headerRow, ["fornecedor", "empresa", "provider", "supplier", "vendor"]) || "",
          data_emissao: findCol(headerRow, ["data", "dataemissao", "date", "emissao", "emissão"]) || "",
          item: findCol(headerRow, ["item", "descricao", "descrição", "desc", "description", "produto"]) || "",
          quant: findCol(headerRow, ["quant", "qtd", "quantidade", "qty", "quantity"]) || "",
          valor_unit: findCol(headerRow, ["vunit", "unitario", "unitário", "valorunit", "unitprice", "unit_price"]) || "",
          valor_total: findCol(headerRow, ["vtotal", "total", "valortotal", "totalprice", "total_price"]) || "",
          frota: findCol(headerRow, ["frota", "veiculo", "veículo", "placa", "fleet"]) || "",
          prazo_pag: findCol(headerRow, ["prazo", "prazopag", "prazopagamento", "terms"]) || "",
          tipo: findCol(headerRow, ["tipo", "categoria", "type", "category"]) || "",
        };

        const parsedRows: any[] = [];

        for (const row of json) {
          const nfVal = colMap.nf ? String(row[colMap.nf] ?? "").trim() : null;
          const fornecedorVal = colMap.fornecedor ? String(row[colMap.fornecedor] ?? "").trim() : null;
          
          let dateVal: string | null = null;
          if (colMap.data_emissao) {
            const rawDate = row[colMap.data_emissao];
            if (rawDate instanceof Date) {
              dateVal = rawDate.toISOString().slice(0, 10);
            } else if (typeof rawDate === "number") {
              const date = new Date((rawDate - 25569) * 86400 * 1000);
              dateVal = date.toISOString().slice(0, 10);
            } else if (rawDate) {
              const parsed = new Date(String(rawDate).trim());
              if (!Number.isNaN(parsed.getTime())) {
                dateVal = parsed.toISOString().slice(0, 10);
              }
            }
          }
          if (!dateVal) dateVal = new Date().toISOString().slice(0, 10);

          const itemVal = colMap.item ? String(row[colMap.item] ?? "").trim() : null;
          const quantVal = colMap.quant ? Number(String(row[colMap.quant] ?? "0").replace(/[^0-9.,-]/g, '').replace(',', '.')) : 1;
          const unitVal = colMap.valor_unit ? Number(String(row[colMap.valor_unit] ?? "0").replace(/[^0-9.,-]/g, '').replace(',', '.')) : 0;
          let totalVal = colMap.valor_total ? Number(String(row[colMap.valor_total] ?? "0").replace(/[^0-9.,-]/g, '').replace(',', '.')) : 0;
          
          if (!totalVal && unitVal) {
            totalVal = quantVal * unitVal;
          }

          const frotaVal = colMap.frota ? String(row[colMap.frota] ?? "").trim() : null;
          const prazoVal = colMap.prazo_pag ? String(row[colMap.prazo_pag] ?? "").trim() : null;
          
          let tipoVal = colMap.tipo ? String(row[colMap.tipo] ?? "").trim().toUpperCase() : "PEÇAS";
          const matchedCategory = CATEGORIAS.find((c) => c === tipoVal || c.toLowerCase() === tipoVal.toLowerCase());
          if (matchedCategory) {
            tipoVal = matchedCategory;
          }

          const info = mesFromDate(dateVal);

          parsedRows.push({
            nf: nfVal,
            fornecedor: fornecedorVal,
            data_emissao: dateVal,
            item: itemVal,
            quant: quantVal,
            valor_unit: unitVal,
            valor_total: totalVal,
            frota: frotaVal,
            prazo_pag: prazoVal,
            tipo: tipoVal,
            mes: info?.mes ?? null,
            ano: info?.ano ?? null,
          });
        }

        const newRows: any[] = [];
        const dupRows: any[] = [];

        for (const row of parsedRows) {
          const isDup = compras.some((c) => {
            const matchNf = (c.nf || "").trim().toLowerCase() === (row.nf || "").trim().toLowerCase();
            const matchDate = c.data_emissao === row.data_emissao;
            const matchForn = (c.fornecedor || "").trim().toLowerCase() === (row.fornecedor || "").trim().toLowerCase();
            return matchNf && matchDate && matchForn;
          });

          if (isDup) {
            dupRows.push(row);
          } else {
            newRows.push(row);
          }
        }

        setImportData({ newRows, dupRows });
        setImportDialogOpen(true);
      } catch (e) {
        toast.error("Erro ao processar planilha: " + (e instanceof Error ? e.message : "formato inválido"));
      } finally {
        setImporting(false);
        if (importInputRef.current) importInputRef.current.value = "";
      }
    };
    reader.readAsBinaryString(file);
  };

  const executarImportacao = useMutation({
    mutationFn: async () => {
      if (!importData) return;
      
      let rowsToSave: any[] = [];
      if (importMode === "all") {
        rowsToSave = [...importData.newRows, ...importData.dupRows];
      } else if (importMode === "skip") {
        rowsToSave = importData.newRows;
      } else if (importMode === "update") {
        rowsToSave = importData.newRows;
        for (const row of importData.dupRows) {
          const existing = compras.find((c) => {
            const matchNf = (c.nf || "").trim().toLowerCase() === (row.nf || "").trim().toLowerCase();
            const matchDate = c.data_emissao === row.data_emissao;
            const matchForn = (c.fornecedor || "").trim().toLowerCase() === (row.fornecedor || "").trim().toLowerCase();
            return matchNf && matchDate && matchForn;
          });
          if (existing) {
            const { error } = await sbFrom("compras").update(row).eq("id", existing.id);
            if (error) throw error;
          }
        }
      }

      if (rowsToSave.length > 0) {
        const chunkSize = 200;
        for (let i = 0; i < rowsToSave.length; i += chunkSize) {
          const chunk = rowsToSave.slice(i, i + chunkSize);
          const { error } = await sbFrom("compras").insert(chunk);
          if (error) throw error;
        }
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["compras"] });
      setImportDialogOpen(false);
      setImportData(null);
      toast.success("Importação concluída com sucesso!");
    },
    onError: (e: Error) => {
      toast.error("Erro na importação: " + e.message);
    }
  });

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
      if (filtroFrota !== "todos" && (c.frota || "") !== filtroFrota) return false;
      if (filtroFornecedor !== "todos" && (c.fornecedor || "") !== filtroFornecedor) return false;
      if (filtroItem !== "todos" && (c.item || "") !== filtroItem) return false;
      if (!b) return true;
      return (
        (c.fornecedor || "").toLowerCase().includes(b) ||
        (c.item || "").toLowerCase().includes(b) ||
        (c.nf || "").toLowerCase().includes(b) ||
        (c.frota || "").toLowerCase().includes(b)
      );
    });
  }, [compras, busca, filtroTipo, filtroMes, filtroAno, filtroFrota, filtroFornecedor, filtroItem]);

  const total = filtrados.reduce((s, c) => s + Number(c.valor_total || 0), 0);

  const tiposUnicos = Array.from(new Set([...CATEGORIAS, ...compras.map((c) => c.tipo).filter(Boolean) as string[]])).sort();
  const anosUnicos = Array.from(new Set(compras.map((c) => c.ano).filter(Boolean))) as number[];
  anosUnicos.sort((a, b) => b - a);
  const frotasUnicas = Array.from(new Set(compras.map((c) => c.frota).filter(Boolean) as string[])).sort();
  const fornecedoresUnicos = Array.from(new Set(compras.map((c) => c.fornecedor).filter(Boolean) as string[])).sort();
  const itensUnicos = Array.from(new Set(compras.map((c) => c.item).filter(Boolean) as string[])).sort();

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

  if (accessLoading) {
    return (
      <AppShell>
        <div className="flex h-[50vh] items-center justify-center">
          <div className="text-sm text-muted-foreground animate-pulse">Carregando permissões…</div>
        </div>
      </AppShell>
    );
  }

  if (!access || !access.canView("compras")) {
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
                Você não tem permissão para acessar a aba de <strong>Compras</strong>. 
                Entre em contato com o administrador do sistema para solicitar acesso.
              </p>
            </CardContent>
          </Card>
        </div>
      </AppShell>
    );
  }

  const canEdit = access.canEdit("compras");

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
          {canEdit && (
            <>
              <input
                ref={scanInputRef}
                type="file"
                accept="image/*"
                capture="environment"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) onScanFile(f);
                }}
              />
              <Button
                variant="outline"
                onClick={() => scanInputRef.current?.click()}
                disabled={scanLoading}
              >
                {scanLoading ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <ScanLine className="h-4 w-4 mr-2" />
                )}
                {scanLoading ? "Lendo NF…" : "Escanear NF"}
              </Button>

              <input
                ref={importInputRef}
                type="file"
                accept=".xlsx,.xlsm"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) onImportFile(f);
                }}
              />
              <Button
                variant="outline"
                onClick={() => importInputRef.current?.click()}
                disabled={importing}
              >
                {importing ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <FileSpreadsheet className="h-4 w-4 mr-2 text-emerald-500" />
                )}
                {importing ? "Lendo Planilha…" : "Importar Planilha"}
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
            </>
          )}
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
          <Select value={filtroFrota} onValueChange={setFiltroFrota}>
            <SelectTrigger className="w-[140px]"><SelectValue placeholder="Frota" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todas frotas</SelectItem>
              {frotasUnicas.map((f) => <SelectItem key={f} value={f}>{f}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={filtroFornecedor} onValueChange={setFiltroFornecedor}>
            <SelectTrigger className="w-[200px]"><SelectValue placeholder="Fornecedor" /></SelectTrigger>
            <SelectContent className="max-h-[300px]">
              <SelectItem value="todos">Todos fornecedores</SelectItem>
              {fornecedoresUnicos.map((f) => <SelectItem key={f} value={f}>{f}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={filtroItem} onValueChange={setFiltroItem}>
            <SelectTrigger className="w-[200px]"><SelectValue placeholder="Item" /></SelectTrigger>
            <SelectContent className="max-h-[300px]">
              <SelectItem value="todos">Todos itens</SelectItem>
              {itensUnicos.map((i) => <SelectItem key={i} value={i}>{i}</SelectItem>)}
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
                <TableHead className="w-[120px] text-right">Unitário</TableHead>
                <TableHead className="w-[120px] text-right">Total</TableHead>
                <TableHead className="w-[80px]">Frota</TableHead>
                <TableHead className="w-[140px]">Tipo</TableHead>
                {canEdit && <TableHead className="w-[80px]" />}
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading && (
                <TableRow><TableCell colSpan={10} className="text-center py-10 text-muted-foreground">Carregando…</TableCell></TableRow>
              )}
              {!isLoading && filtrados.length === 0 && (
                <TableRow><TableCell colSpan={10} className="text-center py-10 text-muted-foreground">Nenhum lançamento encontrado.</TableCell></TableRow>
              )}
              {filtrados.slice(0, 500).map((c) => (
                <TableRow key={c.id}>
                  <TableCell className="font-mono text-xs">{c.nf || "-"}</TableCell>
                  <TableCell className="font-medium">{c.fornecedor || "-"}</TableCell>
                  <TableCell className="text-muted-foreground max-w-[240px] truncate">{c.item || "-"}</TableCell>
                  <TableCell className="tabular-nums text-xs">
                    {formatLocalDateString(c.data_emissao)}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">{c.quant ?? "-"}</TableCell>
                  <TableCell className="text-right tabular-nums text-muted-foreground">{fmtBRL(c.valor_unit)}</TableCell>
                  <TableCell className="text-right tabular-nums font-medium">{fmtBRL(c.valor_total)}</TableCell>
                  <TableCell className="text-xs">{c.frota || "-"}</TableCell>
                  <TableCell>
                    {c.tipo && <Badge variant="secondary" className="text-[10px] font-medium">{c.tipo}</Badge>}
                  </TableCell>
                  {canEdit && (
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
                  )}
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

      {/* Import Preview Dialog */}
      <Dialog open={importDialogOpen} onOpenChange={setImportDialogOpen}>
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle>Resumo da Importação</DialogTitle>
          </DialogHeader>
          {importData && (
            <div className="space-y-4 py-2">
              <p className="text-sm text-muted-foreground">
                Lemos a planilha com sucesso. Aqui está o resumo dos lançamentos encontrados:
              </p>
              <div className="grid grid-cols-2 gap-3 text-center">
                <div className="bg-primary/10 border border-primary/20 rounded-lg p-3">
                  <div className="text-2xl font-bold text-primary tabular-nums">
                    {importData.newRows.length}
                  </div>
                  <div className="text-xs text-muted-foreground">Novas compras</div>
                </div>
                <div className="bg-amber-500/10 border border-amber-500/20 rounded-lg p-3">
                  <div className="text-2xl font-bold text-amber-500 tabular-nums">
                    {importData.dupRows.length}
                  </div>
                  <div className="text-xs text-muted-foreground">Duplicatas prováveis</div>
                </div>
              </div>

              {importData.dupRows.length > 0 && (
                <div className="space-y-2">
                  <Label className="text-xs">Como deseja tratar os registros duplicados?</Label>
                  <Select value={importMode} onValueChange={(v) => setImportMode(v as any)}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="skip">Ignorar duplicatas (salva apenas novos registros)</SelectItem>
                      <SelectItem value="update">Atualizar existentes (sobrescreve os dados no banco)</SelectItem>
                      <SelectItem value="all">Importar tudo (pode criar duplicatas no banco)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              )}
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setImportDialogOpen(false)}>
              Cancelar
            </Button>
            <Button
              onClick={() => executarImportacao.mutate()}
              disabled={executarImportacao.isPending}
              className="text-primary-foreground border-0"
              style={{ background: "var(--gradient-primary)" }}
            >
              {executarImportacao.isPending ? "Importando…" : "Confirmar Importação"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
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
          <Input type="number" step="0.01" value={form.quant === 0 ? "" : (form.quant ?? "")} onChange={(e) => update("quant", e.target.value === "" ? "" : Number(e.target.value))} />
        </div>
        <div>
          <Label className="text-xs">Valor Unitário</Label>
          <Input type="number" step="0.01" value={form.valor_unit === 0 ? "" : (form.valor_unit ?? "")} onChange={(e) => update("valor_unit", e.target.value === "" ? "" : Number(e.target.value))} />
        </div>
        <div>
          <Label className="text-xs flex items-center justify-between">
            Valor Total
            <button type="button" onClick={useCalculated} className="text-[10px] text-primary hover:underline">
              Calcular ({fmtBRL(total)})
            </button>
          </Label>
          <Input type="number" step="0.01" value={form.valor_total === 0 ? "" : (form.valor_total ?? "")} onChange={(e) => update("valor_total", e.target.value === "" ? "" : Number(e.target.value))} />
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