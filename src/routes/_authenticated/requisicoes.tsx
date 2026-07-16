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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import {
  Plus,
  Pencil,
  Trash2,
  Search,
  ShieldAlert,
  AlertCircle,
  ShoppingCart,
  CheckCircle2,
  Calendar,
  User,
  FolderOpen,
  Hash,
  PlusCircle,
  Trash,
} from "lucide-react";
import { useMemo, useState, useEffect } from "react";
import { toast } from "sonner";
import { sbFrom, type Requisicao, type RequisicaoItem } from "@/lib/db-types";
import { useCurrentUserAccess } from "@/hooks/use-auth";

export const Route = createFileRoute("/_authenticated/requisicoes")({
  component: RequisicoesPage,
  head: () => ({
    meta: [
      { title: "Requisições — THcontrol" },
      { name: "description", content: "Controle de requisições de compras por centro de custo." },
    ],
  }),
});

interface FormState {
  id?: string;
  centro_custo: string;
  data: string;
  solicitante: string;
  status: "pendente" | "comprado" | "entregue";
  itens: { id?: string; descricao: string; quantidade: number }[];
}

const emptyForm = (defaultSolicitante: string): FormState => ({
  centro_custo: "",
  data: new Date().toISOString().split("T")[0],
  solicitante: defaultSolicitante,
  status: "pendente",
  itens: [{ descricao: "", quantidade: 1 }],
});

function RequisicoesPage() {
  const qc = useQueryClient();
  const { access, email, loading: accessLoading } = useCurrentUserAccess();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [busca, setBusca] = useState("");
  const [statusFiltro, setStatusFiltro] = useState<string>("todos");

  const defaultSolicitante = useMemo(() => {
    return access?.profile?.full_name || email?.split("@")[0] || "";
  }, [access, email]);

  const [form, setForm] = useState<FormState>(emptyForm(defaultSolicitante));

  // Reset form default requester when auth loads
  useEffect(() => {
    if (defaultSolicitante && !form.id && !form.centro_custo) {
      setForm(emptyForm(defaultSolicitante));
    }
  }, [defaultSolicitante]);

  const { data: requisicoes = [], isLoading: listLoading } = useQuery({
    queryKey: ["requisicoes"],
    queryFn: async () => {
      // Carregar requisições com os respectivos itens
      const { data, error } = await sbFrom("requisicoes")
        .select("*, itens:requisicao_itens(*)")
        .order("numero", { ascending: false });

      if (error) throw error;
      return (data ?? []) as Requisicao[];
    },
  });

  const filtradas = useMemo(() => {
    const b = busca.toLowerCase();
    return requisicoes.filter((r) => {
      const matchBusca =
        !b ||
        (r.solicitante || "").toLowerCase().includes(b) ||
        (r.centro_custo || "").toLowerCase().includes(b) ||
        (r.itens || []).some((it) => (it.descricao || "").toLowerCase().includes(b)) ||
        r.numero.toString().includes(b);

      const matchStatus = statusFiltro === "todos" || r.status === statusFiltro;

      return matchBusca && matchStatus;
    });
  }, [requisicoes, busca, statusFiltro]);

  const salvar = useMutation({
    mutationFn: async (f: FormState) => {
      const reqPayload = {
        centro_custo: f.centro_custo.trim(),
        data: f.data,
        solicitante: f.solicitante.trim(),
        status: f.status,
      };

      let reqId = f.id;

      if (reqId) {
        // Atualizar requisição
        const { error } = await sbFrom("requisicoes").update(reqPayload).eq("id", reqId);
        if (error) throw error;

        // Deletar itens antigos
        const { error: delErr } = await sbFrom("requisicao_itens").delete().eq("requisicao_id", reqId);
        if (delErr) throw delErr;
      } else {
        // Criar requisição
        const { data, error } = await sbFrom("requisicoes").insert(reqPayload).select("id").single();
        if (error) throw error;
        reqId = data.id;
      }

      // Inserir novos itens
      const validItens = f.itens
        .filter((it) => it.descricao.trim().length > 0)
        .map((it) => ({
          requisicao_id: reqId!,
          descricao: it.descricao.trim(),
          quantidade: Math.max(0.01, Number(it.quantidade) || 1),
        }));

      if (validItens.length > 0) {
        const { error: insErr } = await sbFrom("requisicao_itens").insert(validItens);
        if (insErr) throw insErr;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["requisicoes"] });
      setDialogOpen(false);
      setForm(emptyForm(defaultSolicitante));
      toast.success("Requisição salva com sucesso!");
    },
    onError: (e: Error) => toast.error(`Erro ao salvar requisição: ${e.message}`),
  });

  const atualizarStatus = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: "pendente" | "comprado" | "entregue" }) => {
      const { error } = await sbFrom("requisicoes").update({ status }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["requisicoes"] });
      toast.success("Status atualizado!");
    },
    onError: (e: Error) => toast.error(`Erro ao atualizar status: ${e.message}`),
  });

  const excluir = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await sbFrom("requisicoes").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["requisicoes"] });
      toast.success("Requisição excluída");
    },
    onError: (e: Error) => toast.error(`Erro ao excluir: ${e.message}`),
  });

  const addItemLinha = () => {
    setForm({
      ...form,
      itens: [...form.itens, { descricao: "", quantidade: 1 }],
    });
  };

  const removeItemLinha = (index: number) => {
    if (form.itens.length <= 1) {
      toast.error("A requisição precisa de pelo menos 1 item.");
      return;
    }
    const newItens = [...form.itens];
    newItens.splice(index, 1);
    setForm({ ...form, itens: newItens });
  };

  const updateItemLinha = (index: number, field: "descricao" | "quantidade", val: any) => {
    const newItens = [...form.itens];
    newItens[index] = {
      ...newItens[index],
      [field]: val,
    };
    setForm({ ...form, itens: newItens });
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

  if (!access || !access.canView("requisicoes")) {
    return (
      <AppShell>
        <div className="flex h-[60vh] items-center justify-center">
          <Card className="max-w-md w-full border-border/60 shadow-lg animate-fade-in">
            <CardHeader className="text-center pb-2">
              <div className="mx-auto h-12 w-12 rounded-full bg-destructive/15 text-destructive flex items-center justify-center mb-4">
                <ShieldAlert className="h-6 w-6" />
              </div>
              <CardTitle className="text-xl font-bold">Acesso Restrito</CardTitle>
            </CardHeader>
            <CardContent className="text-center space-y-4 pt-2">
              <p className="text-sm text-muted-foreground">
                Você não tem permissão para acessar a aba de <strong>Requisições</strong>.
                Entre em contato com o administrador para habilitar seu acesso.
              </p>
            </CardContent>
          </Card>
        </div>
      </AppShell>
    );
  }

  const canEdit = access.canEdit("requisicoes");

  // Contadores
  const countPendente = requisicoes.filter((r) => r.status === "pendente").length;
  const countComprado = requisicoes.filter((r) => r.status === "comprado").length;
  const countEntregue = requisicoes.filter((r) => r.status === "entregue").length;

  return (
    <AppShell>
      <div className="flex flex-wrap items-end justify-between gap-4 mb-6">
        <div>
          <div className="text-xs uppercase tracking-[0.2em] text-primary/80 mb-2">Suprimentos</div>
          <h1 className="text-3xl font-bold tracking-tight">Requisições</h1>
          <p className="text-sm text-muted-foreground mt-1">
            {requisicoes.length} requisições cadastradas
          </p>
        </div>
        {canEdit && (
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button
                onClick={() => setForm(emptyForm(defaultSolicitante))}
                className="text-primary-foreground border-0 cursor-pointer"
                style={{ background: "var(--gradient-primary)" }}
              >
                <Plus className="h-4 w-4 mr-2" /> Nova requisição
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-xl max-h-[90vh] flex flex-col p-6">
              <DialogHeader>
                <DialogTitle>{form.id ? "Editar requisição" : "Nova requisição"}</DialogTitle>
              </DialogHeader>

              <div className="flex-1 overflow-y-auto space-y-4 pr-1 py-2">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label className="text-xs">Centro de Custo</Label>
                    <Input
                      value={form.centro_custo}
                      onChange={(e) => setForm({ ...form, centro_custo: e.target.value })}
                      placeholder="Ex: Obra A, Oficina, Frota"
                    />
                  </div>
                  <div>
                    <Label className="text-xs">Data</Label>
                    <Input
                      type="date"
                      value={form.data}
                      onChange={(e) => setForm({ ...form, data: e.target.value })}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label className="text-xs">Solicitante</Label>
                    <Input
                      value={form.solicitante}
                      onChange={(e) => setForm({ ...form, solicitante: e.target.value })}
                    />
                  </div>
                  <div>
                    <Label className="text-xs">Status da Requisição</Label>
                    <Select
                      value={form.status}
                      onValueChange={(v: any) => setForm({ ...form, status: v })}
                    >
                      <SelectTrigger className="w-full">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="pendente">Pendente ⚠️</SelectItem>
                        <SelectItem value="comprado">Aguardando entrega 🛒</SelectItem>
                        <SelectItem value="entregue">Entregue ✅</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="border-t border-border/40 pt-4">
                  <div className="flex items-center justify-between mb-2">
                    <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                      Itens solicitados
                    </Label>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={addItemLinha}
                      className="text-xs text-primary h-8 px-2"
                    >
                      <PlusCircle className="h-4 w-4 mr-1" /> Adicionar item
                    </Button>
                  </div>

                  <div className="space-y-2">
                    {form.itens.map((it, idx) => (
                      <div key={idx} className="flex gap-2 items-center">
                        <div className="flex-1">
                          <Input
                            value={it.descricao}
                            onChange={(e) => updateItemLinha(idx, "descricao", e.target.value)}
                            placeholder="Descrição do item"
                            className="h-9 text-sm"
                          />
                        </div>
                        <div className="w-24">
                          <Input
                            type="number"
                            min="0.01"
                            step="any"
                            value={it.quantidade}
                            onChange={(e) => updateItemLinha(idx, "quantidade", e.target.value)}
                            placeholder="Qtd"
                            className="h-9 text-sm"
                          />
                        </div>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          onClick={() => removeItemLinha(idx)}
                          className="h-9 w-9 text-destructive hover:bg-destructive/10"
                        >
                          <Trash className="h-4 w-4" />
                        </Button>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              <DialogFooter className="border-t border-border/40 pt-4 mt-2">
                <Button
                  onClick={() => salvar.mutate(form)}
                  disabled={salvar.isPending || !form.centro_custo.trim()}
                  className="text-primary-foreground border-0 w-full md:w-auto"
                  style={{ background: "var(--gradient-primary)" }}
                >
                  {salvar.isPending ? "Salvando…" : "Salvar"}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        )}
      </div>

      <Card className="mb-4">
        <CardContent className="pt-6 space-y-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              placeholder="Buscar por número, centro de custo, solicitante ou itens..."
              className="pl-9"
            />
          </div>
          <div className="flex flex-wrap gap-2 text-xs pt-1 border-t border-border/40">
            <button
              onClick={() => setStatusFiltro("todos")}
              className={cn(
                "px-3 py-1.5 rounded-full font-medium transition-colors border cursor-pointer select-none",
                statusFiltro === "todos"
                  ? "bg-primary border-primary text-primary-foreground"
                  : "bg-muted/40 border-border text-muted-foreground hover:bg-muted/80"
              )}
            >
              Todos ({requisicoes.length})
            </button>
            <button
              onClick={() => setStatusFiltro("pendente")}
              className={cn(
                "px-3 py-1.5 rounded-full font-medium transition-colors border cursor-pointer select-none flex items-center gap-1",
                statusFiltro === "pendente"
                  ? "bg-rose-600 border-rose-600 text-white"
                  : "bg-muted/40 border-border text-muted-foreground hover:bg-muted/80"
              )}
            >
              <AlertCircle className="h-3 w-3 text-rose-500 fill-rose-500/10" /> Pendentes ({countPendente})
            </button>
            <button
              onClick={() => setStatusFiltro("comprado")}
              className={cn(
                "px-3 py-1.5 rounded-full font-medium transition-colors border cursor-pointer select-none flex items-center gap-1",
                statusFiltro === "comprado"
                  ? "bg-amber-600 border-amber-600 text-white"
                  : "bg-muted/40 border-border text-muted-foreground hover:bg-muted/80"
              )}
            >
              <ShoppingCart className="h-3 w-3 text-amber-500" /> Aguardando entrega ({countComprado})
            </button>
            <button
              onClick={() => setStatusFiltro("entregue")}
              className={cn(
                "px-3 py-1.5 rounded-full font-medium transition-colors border cursor-pointer select-none flex items-center gap-1",
                statusFiltro === "entregue"
                  ? "bg-emerald-600 border-emerald-600 text-white"
                  : "bg-muted/40 border-border text-muted-foreground hover:bg-muted/80"
              )}
            >
              <CheckCircle2 className="h-3 w-3 text-emerald-500" /> Entregues ({countEntregue})
            </button>
          </div>
        </CardContent>
      </Card>

      {listLoading ? (
        <div className="flex h-[30vh] items-center justify-center">
          <div className="text-sm text-muted-foreground animate-pulse">Carregando requisições…</div>
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {filtradas.map((r) => {
            const formattedDate = r.data
              ? new Date(r.data + "T00:00:00").toLocaleDateString("pt-BR")
              : "-";

            return (
              <Card key={r.id} className="group hover:border-primary/40 transition-all flex flex-col shadow-sm">
                <CardContent className="pt-5 flex-1 flex flex-col justify-between">
                  <div className="space-y-4">
                    {/* Header */}
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-2">
                        <div className="grid h-10 w-10 place-items-center rounded-lg bg-primary/10 text-primary">
                          <Hash className="h-5 w-5" />
                        </div>
                        <div>
                          <div className="text-xs uppercase tracking-wider text-muted-foreground">Requisição</div>
                          <div className="text-base font-bold tabular-nums">#{r.numero}</div>
                        </div>
                      </div>

                      {/* Dynamic Badge */}
                      {r.status === "pendente" && (
                        <Badge className="bg-rose-500/10 text-rose-500 hover:bg-rose-500/10 border-rose-500/20 gap-1 py-0.5">
                          <AlertCircle className="h-3.5 w-3.5" /> Pendente
                        </Badge>
                      )}
                      {r.status === "comprado" && (
                        <Badge className="bg-amber-500/10 text-amber-500 hover:bg-amber-500/10 border-amber-500/20 gap-1 py-0.5">
                          <ShoppingCart className="h-3.5 w-3.5" /> Aguardando entrega
                        </Badge>
                      )}
                      {r.status === "entregue" && (
                        <Badge className="bg-emerald-500/10 text-emerald-500 hover:bg-emerald-500/10 border-emerald-500/20 gap-1 py-0.5">
                          <CheckCircle2 className="h-3.5 w-3.5" /> Entregue
                        </Badge>
                      )}
                    </div>

                    {/* Metadata */}
                    <div className="grid grid-cols-2 gap-2 text-xs border-y border-border/40 py-2.5 my-2">
                      <div className="flex items-center gap-1.5 text-muted-foreground">
                        <FolderOpen className="h-3.5 w-3.5 flex-shrink-0" />
                        <span className="truncate text-foreground font-medium" title={r.centro_custo}>
                          {r.centro_custo}
                        </span>
                      </div>
                      <div className="flex items-center gap-1.5 text-muted-foreground justify-end">
                        <Calendar className="h-3.5 w-3.5 flex-shrink-0" />
                        <span className="text-foreground font-medium">{formattedDate}</span>
                      </div>
                      <div className="col-span-2 flex items-center gap-1.5 text-muted-foreground pt-1">
                        <User className="h-3.5 w-3.5 flex-shrink-0" />
                        <span className="truncate text-foreground font-medium">
                          Solicitado por: <span className="text-muted-foreground">{r.solicitante}</span>
                        </span>
                      </div>
                    </div>

                    {/* Items List */}
                    <div className="space-y-1.5">
                      <div className="text-[10px] uppercase font-bold tracking-wider text-muted-foreground">
                        Itens na Requisição:
                      </div>
                      <div className="bg-muted/30 rounded-lg p-2.5 max-h-48 overflow-y-auto space-y-1 border border-border/20">
                        {(r.itens || []).map((it) => (
                          <div key={it.id} className="flex justify-between items-center text-xs py-0.5 border-b border-border/10 last:border-0">
                            <span className="font-medium text-foreground truncate max-w-[70%]" title={it.descricao}>
                              {it.descricao}
                            </span>
                            <span className="text-muted-foreground font-mono text-[11px] bg-muted px-1.5 py-0.5 rounded flex-shrink-0">
                              {it.quantidade} qtd
                            </span>
                          </div>
                        ))}
                        {(r.itens || []).length === 0 && (
                          <div className="text-center text-muted-foreground text-[11px] py-1">
                            Nenhum item adicionado
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Actions row */}
                  {canEdit && (
                    <div className="mt-4 pt-3 border-t border-border/40 flex items-center justify-between gap-2">
                      <div className="flex gap-1.5">
                        <button
                          onClick={() => {
                            setForm({
                              id: r.id,
                              centro_custo: r.centro_custo,
                              data: r.data,
                              solicitante: r.solicitante,
                              status: r.status,
                              itens: r.itens ? r.itens.map(it => ({ id: it.id, descricao: it.descricao, quantidade: it.quantidade })) : [{ descricao: "", quantidade: 1 }],
                            });
                            setDialogOpen(true);
                          }}
                          className="inline-flex h-7 px-2 items-center gap-1 text-[11px] font-medium border border-border hover:bg-muted rounded text-muted-foreground hover:text-foreground transition cursor-pointer"
                        >
                          <Pencil className="h-3 w-3" /> Editar
                        </button>
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <button className="inline-flex h-7 px-2 items-center gap-1 text-[11px] font-medium border border-destructive/20 hover:bg-destructive/10 rounded text-destructive transition cursor-pointer">
                              <Trash2 className="h-3 w-3" /> Excluir
                            </button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>Excluir requisição #{r.numero}?</AlertDialogTitle>
                              <AlertDialogDescription>Esta ação não pode ser desfeita.</AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Cancelar</AlertDialogCancel>
                              <AlertDialogAction onClick={() => excluir.mutate(r.id)} className="bg-destructive text-destructive-foreground hover:bg-destructive/90 border-0">
                                Excluir
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      </div>

                      {/* Quick Status Changers */}
                      <div className="flex items-center gap-1 bg-muted/60 p-0.5 rounded-md border border-border/30">
                        <button
                          onClick={() => atualizarStatus.mutate({ id: r.id, status: "pendente" })}
                          className={cn(
                            "h-5 w-5 rounded flex items-center justify-center transition cursor-pointer",
                            r.status === "pendente"
                              ? "bg-rose-500 text-white shadow-sm"
                              : "text-muted-foreground hover:bg-muted"
                          )}
                          title="Marcar como Pendente"
                        >
                          <AlertCircle className="h-3 w-3" />
                        </button>
                        <button
                          onClick={() => atualizarStatus.mutate({ id: r.id, status: "comprado" })}
                          className={cn(
                            "h-5 w-5 rounded flex items-center justify-center transition cursor-pointer",
                            r.status === "comprado"
                              ? "bg-amber-500 text-white shadow-sm"
                              : "text-muted-foreground hover:bg-muted"
                          )}
                          title="Marcar como Aguardando entrega"
                        >
                          <ShoppingCart className="h-3 w-3" />
                        </button>
                        <button
                          onClick={() => atualizarStatus.mutate({ id: r.id, status: "entregue" })}
                          className={cn(
                            "h-5 w-5 rounded flex items-center justify-center transition cursor-pointer",
                            r.status === "entregue"
                              ? "bg-emerald-500 text-white shadow-sm"
                              : "text-muted-foreground hover:bg-muted"
                          )}
                          title="Marcar como Entregue"
                        >
                          <CheckCircle2 className="h-3 w-3" />
                        </button>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
          {filtradas.length === 0 && (
            <div className="col-span-full text-center py-16 text-muted-foreground text-sm">
              Nenhuma requisição encontrada.
            </div>
          )}
        </div>
      )}
    </AppShell>
  );
}
