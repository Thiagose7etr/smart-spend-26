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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Plus, Search, GitCompare, FileDown, Printer, Loader2, Trash2, Trophy, CheckCircle2, ShieldAlert, Save, FolderOpen, AlertCircle, ShoppingCart, PackageOpen } from "lucide-react";
import { useMemo, useState, useEffect } from "react";
import { toast } from "sonner";
import { CATEGORIAS, fmtBRL, sbFrom, formatSupplierName, type Requisicao } from "@/lib/db-types";
import { useCurrentUserAccess } from "@/hooks/use-auth";
import * as XLSX from "xlsx";

export const Route = createFileRoute("/_authenticated/mapa-cotacao")({
  component: MapaCotacaoPage,
  head: () => ({
    meta: [
      { title: "Mapa de Cotação — THcontrol" },
      { name: "description", content: "Comparativo de cotações de preços de fornecedores por requisição." },
    ],
  }),
});

interface CotacaoPreco {
  [itemId: string]: {
    [fornecedor: string]: number; // preco unitario
  };
}

interface FornecedorFaturamento {
  nf: string;
  categoria: string;
  frota: string;
  prazo: string;
}

function MapaCotacaoPage() {
  const qc = useQueryClient();
  const { access, loading: accessLoading } = useCurrentUserAccess();
  const canEdit = access?.canEdit("mapa-cotacao") ?? false;

  const [buscaReq, setBuscaReq] = useState("");
  const [numeroPesquisado, setNumeroPesquisado] = useState<number | null>(null);

  // Carrega fornecedores únicos do histórico para autocomplete
  const { data: compras = [] } = useQuery({
    queryKey: ["compras", "all-fornecedores"],
    queryFn: async () => {
      const { data, error } = await sbFrom("compras").select("fornecedor");
      if (error) throw error;
      return data ?? [];
    },
  });

  const fornecedoresHistorico = useMemo<string[]>(() => {
    const list = compras.map((c: any) => String(c.fornecedor || "").trim().toUpperCase()).filter(Boolean);
    return Array.from(new Set(list)).sort() as string[];
  }, [compras]);

  // Carrega a requisição buscada
  const { data: requisicao, isLoading: loadingReq } = useQuery({
    queryKey: ["requisicao-cotacao", numeroPesquisado],
    enabled: numeroPesquisado !== null,
    queryFn: async () => {
      const { data, error } = await sbFrom("requisicoes")
        .select("*, itens:requisicao_itens(*)")
        .eq("numero", numeroPesquisado!)
        .maybeSingle();

      if (error) throw error;
      return data as Requisicao | null;
    },
  });

  // Carrega todas as requisições com cotação salva (independente do status)
  const { data: todasRequisicoes = [], isLoading: loadingRascunhos } = useQuery({
    queryKey: ["requisicoes-rascunhos"],
    queryFn: async () => {
      const { data, error } = await sbFrom("requisicoes")
        .select("*")
        .order("numero", { ascending: false });
      if (error) throw error;
      return (data ?? []) as Requisicao[];
    },
  });

  const rascunhos = useMemo(() => {
    return todasRequisicoes.filter((r) => r.cotacao !== null && r.cotacao !== undefined);
  }, [todasRequisicoes]);

  // Estados da Matriz de Cotação
  const [fornecedores, setFornecedores] = useState<string[]>(["FORNECEDOR A", "FORNECEDOR B"]);
  const [precos, setPrecos] = useState<CotacaoPreco>({});
  const [vencedoresManuais, setVencedoresManuais] = useState<{ [itemId: string]: string }>({});
  const [showSug, setShowSug] = useState<{ [colIndex: number]: boolean }>({});
  const [sugQuery, setSugQuery] = useState<{ [colIndex: number]: string }>({});

  // Configuração para geração de compras/lançamentos
  const [modalGerarOpen, setModalGerarOpen] = useState(false);
  const [faturamentos, setFaturamentos] = useState<{ [fornecedor: string]: FornecedorFaturamento }>({});

  // Carrega rascunho de cotação se houver no banco
  useEffect(() => {
    if (requisicao) {
      if (requisicao.cotacao) {
        const cot = requisicao.cotacao;
        setFornecedores(cot.fornecedores || ["FORNECEDOR A", "FORNECEDOR B"]);
        setPrecos(cot.precos || {});
        setVencedoresManuais(cot.vencedoresManuais || {});
      } else {
        setFornecedores(["FORNECEDOR A", "FORNECEDOR B"]);
        setPrecos({});
        setVencedoresManuais({});
      }
    }
  }, [requisicao]);

  // Cálculos da Matriz (movidos para evitar violação de regras de hooks com o early return abaixo)
  const itens = requisicao?.itens ?? [];

  // Vencedores por item (com suporte a manual override)
  const resolvedVencedores = useMemo(() => {
    const map: { [itemId: string]: { fornecedor: string; preco: number } | null } = {};
    itens.forEach((it) => {
      // 1. Verifica escolha manual
      const manualForn = vencedoresManuais[it.id];
      if (manualForn && fornecedores.includes(manualForn)) {
        const p = precos[it.id]?.[manualForn] ?? 0;
        if (p > 0) {
          map[it.id] = { fornecedor: manualForn, preco: p };
          return;
        }
      }

      // 2. Fallback para menor preço
      let minPreco = Infinity;
      let minForn = "";
      fornecedores.forEach((forn) => {
        const p = precos[it.id]?.[forn] ?? 0;
        if (p > 0 && p < minPreco) {
          minPreco = p;
          minForn = forn;
        }
      });
      map[it.id] = minForn ? { fornecedor: minForn, preco: minPreco } : null;
    });
    return map;
  }, [itens, fornecedores, precos, vencedoresManuais]);

  // Totais por fornecedor (coluna)
  const totaisPorFornecedor = useMemo(() => {
    const map: { [fornecedor: string]: number } = {};
    fornecedores.forEach((forn) => {
      let total = 0;
      itens.forEach((it) => {
        const p = precos[it.id]?.[forn] ?? 0;
        total += p * it.quantidade;
      });
      map[forn] = total;
    });
    return map;
  }, [itens, fornecedores, precos]);

  // Fornecedor mais barato no geral
  const fornecedorMaisBarato = useMemo(() => {
    let minTotal = Infinity;
    let minForn = "";
    fornecedores.forEach((forn) => {
      const tot = totaisPorFornecedor[forn];
      if (tot > 0 && tot < minTotal) {
        minTotal = tot;
        minForn = forn;
      }
    });
    return minForn ? { fornecedor: minForn, total: minTotal } : null;
  }, [fornecedores, totaisPorFornecedor]);

  if (accessLoading) {
    return (
      <AppShell>
        <div className="flex h-[50vh] items-center justify-center">
          <div className="text-sm text-muted-foreground animate-pulse">Carregando permissões...</div>
        </div>
      </AppShell>
    );
  }

  if (!access?.canView("mapa-cotacao")) {
    return (
      <AppShell>
        <div className="flex h-[60vh] items-center justify-center">
          <Card className="max-w-md w-full border-border/60 shadow-lg bg-card/60 backdrop-blur-md">
            <CardHeader className="text-center pb-2">
              <div className="mx-auto h-12 w-12 rounded-full bg-destructive/15 text-destructive flex items-center justify-center mb-4">
                <ShieldAlert className="h-6 w-6" />
              </div>
              <CardTitle className="text-xl font-bold">Acesso Restrito</CardTitle>
            </CardHeader>
            <CardContent className="text-center space-y-4 pt-2">
              <p className="text-sm text-muted-foreground">
                Você não tem permissão para acessar a aba de <strong>Mapa de Cotação</strong>. Entre em contato com o administrador do sistema para solicitar acesso.
              </p>
            </CardContent>
          </Card>
        </div>
      </AppShell>
    );
  }

  const handleBuscar = (e: React.FormEvent) => {
    e.preventDefault();
    const num = parseInt(buscaReq.trim(), 10);
    if (isNaN(num)) {
      toast.error("Insira um número de requisição válido.");
      return;
    }
    setNumeroPesquisado(num);
    // Limpa preços locais ao buscar para evitar flashing de dados antigos
    setPrecos({});
    setVencedoresManuais({});
  };

  const handleLimpar = () => {
    setBuscaReq("");
    setNumeroPesquisado(null);
    setPrecos({});
    setVencedoresManuais({});
  };

  const handleAddFornecedor = () => {
    const nextLetter = String.fromCharCode(65 + fornecedores.length); // A, B, C...
    const name = `FORNECEDOR ${nextLetter}`;
    setFornecedores([...fornecedores, name]);
  };

  const handleRemoveFornecedor = (indexToRemove: number) => {
    if (fornecedores.length <= 1) {
      toast.error("O mapa deve conter pelo menos um fornecedor.");
      return;
    }
    const nameToRemove = fornecedores[indexToRemove];
    const newForns = fornecedores.filter((_, idx) => idx !== indexToRemove);
    setFornecedores(newForns);

    // Limpa preços daquele fornecedor
    const newPrecos = { ...precos };
    Object.keys(newPrecos).forEach((itemId) => {
      if (newPrecos[itemId]) {
        const itemPrecos = { ...newPrecos[itemId] };
        delete itemPrecos[nameToRemove];
        newPrecos[itemId] = itemPrecos;
      }
    });
    setPrecos(newPrecos);

    // Remove referências de vencedores manuais para o fornecedor excluído
    const newVencedores = { ...vencedoresManuais };
    Object.keys(newVencedores).forEach((itemId) => {
      if (newVencedores[itemId] === nameToRemove) {
        delete newVencedores[itemId];
      }
    });
    setVencedoresManuais(newVencedores);
  };

  const handleUpdateFornecedorName = (index: number, name: string) => {
    const oldName = fornecedores[index];
    const newName = formatSupplierName(name);
    
    // Atualiza nome na lista
    const newForns = [...fornecedores];
    newForns[index] = newName;
    setFornecedores(newForns);

    // Mapeia preços antigos para o novo nome
    const newPrecos = { ...precos };
    Object.keys(newPrecos).forEach((itemId) => {
      if (newPrecos[itemId] && newPrecos[itemId][oldName] !== undefined) {
        const val = newPrecos[itemId][oldName];
        const itemPrecos = { ...newPrecos[itemId] };
        delete itemPrecos[oldName];
        itemPrecos[newName] = val;
        newPrecos[itemId] = itemPrecos;
      }
    });
    setPrecos(newPrecos);

    // Atualiza vencedor manual se necessário
    const newVencedores = { ...vencedoresManuais };
    Object.keys(newVencedores).forEach((itemId) => {
      if (newVencedores[itemId] === oldName) {
        newVencedores[itemId] = newName;
      }
    });
    setVencedoresManuais(newVencedores);
  };

  const handleUpdatePreco = (itemId: string, fornecedor: string, value: string) => {
    const val = value === "" ? 0 : Number(value);
    setPrecos({
      ...precos,
      [itemId]: {
        ...(precos[itemId] || {}),
        [fornecedor]: val,
      },
    });
  };

  // (Cálculos da Matriz movidos para antes do early return)

  // Mutation para salvar rascunho
  const salvarRascunhoMutation = useMutation({
    mutationFn: async () => {
      if (!requisicao) return;
      const cotacaoPayload = {
        fornecedores,
        precos,
        vencedoresManuais,
      };
      const { error } = await sbFrom("requisicoes")
        .update({ cotacao: cotacaoPayload })
        .eq("id", requisicao.id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["requisicao-cotacao"] });
      qc.invalidateQueries({ queryKey: ["requisicoes-rascunhos"] });
      toast.success("Rascunho de cotação salvo no banco!");
    },
    onError: (e: any) => {
      toast.error("Erro ao salvar rascunho: " + e.message);
    },
  });

  // Mutation para excluir cotação
  const excluirRascunhoMutation = useMutation({
    mutationFn: async (reqId?: string) => {
      const idToUse = reqId || requisicao?.id;
      if (!idToUse) return;
      const { error } = await sbFrom("requisicoes")
        .update({ cotacao: null })
        .eq("id", idToUse);
      if (error) throw error;
    },
    onSuccess: (_, variables) => {
      qc.invalidateQueries({ queryKey: ["requisicao-cotacao"] });
      qc.invalidateQueries({ queryKey: ["requisicoes-rascunhos"] });
      
      const idToUse = variables || requisicao?.id;
      if (idToUse === requisicao?.id) {
        setFornecedores(["FORNECEDOR A", "FORNECEDOR B"]);
        setPrecos({});
        setVencedoresManuais({});
      }
      toast.success("Cotação excluída com sucesso!");
    },
    onError: (e: any) => {
      toast.error("Erro ao excluir cotação: " + e.message);
    },
  });

    // Abre o modal de Gerar Compras e inicializa as variáveis de faturamento
  const openGerarCompras = () => {
    if (!requisicao) return;
    const initialFaturamentos: { [fornecedor: string]: FornecedorFaturamento } = {};
    
    // Identifica fornecedores ganhadores selecionados
    const ganhadores = new Set<string>();
    itens.forEach((it) => {
      const win = resolvedVencedores[it.id];
      if (win) {
        ganhadores.add(win.fornecedor);
      }
    });

    if (ganhadores.size === 0) {
      toast.error("Preencha as cotações e selecione os vencedores antes de gerar as compras.");
      return;
    }

    // Tenta sugerir placa de frota com base no Centro de Custo da requisição
    const cc = requisicao.centro_custo || "";
    const isCcNumber = /^\d+$/.test(cc.trim());
    const frotaSugestionada = isCcNumber ? cc.trim() : "";

    ganhadores.forEach((forn) => {
      initialFaturamentos[forn] = {
        nf: "",
        categoria: "PEÇAS",
        frota: frotaSugestionada,
        prazo: "30",
      };
    });

    setFaturamentos(initialFaturamentos);
    setModalGerarOpen(true);
  };

  // Mutation para salvar compras no banco
  const gerarComprasMutation = useMutation({
    mutationFn: async () => {
      const rows: any[] = [];
      const infoData = new Date().toISOString().slice(0, 10);
      const parts = infoData.split("-");
      const mesName = [
        "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
        "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"
      ][parseInt(parts[1], 10) - 1];
      const anoNum = parseInt(parts[0], 10);

      itens.forEach((it) => {
        const win = resolvedVencedores[it.id];
        if (win) {
          const forn = win.fornecedor;
          const fat = faturamentos[forn];
          if (fat) {
            rows.push({
              nf: fat.nf || `COT-${requisicao?.numero}`,
              fornecedor: forn,
              data_emissao: infoData,
              item: it.descricao,
              quant: it.quantidade,
              valor_unit: win.preco,
              valor_total: it.quantidade * win.preco,
              frota: fat.frota || null,
              prazo_pag: fat.prazo || null,
              tipo: fat.categoria || "PEÇAS",
              mes: mesName,
              ano: anoNum,
            });
          }
        }
      });

      // 1. Inserir compras
      const { error: insErr } = await sbFrom("compras").insert(rows);
      if (insErr) throw insErr;

      // 2. Atualizar status da requisição para 'comprado' e salvar a cotação correspondente
      const cotacaoPayload = {
        fornecedores,
        precos,
        vencedoresManuais,
      };
      const { error: updErr } = await sbFrom("requisicoes")
        .update({ 
          status: "comprado",
          cotacao: cotacaoPayload
        })
        .eq("id", requisicao!.id);
      if (updErr) throw updErr;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["requisicoes"] });
      qc.invalidateQueries({ queryKey: ["requisicao-cotacao"] });
      qc.invalidateQueries({ queryKey: ["requisicoes-rascunhos"] });
      qc.invalidateQueries({ queryKey: ["compras"] });
      setModalGerarOpen(false);
      toast.success("Compras geradas e Requisição marcada como COMPRADA!");
    },
    onError: (e: any) => {
      toast.error("Erro ao gerar compras: " + e.message);
    },
  });

  // Imprimir Mapa de Cotação
  const handleImprimir = () => {
    if (!requisicao) return;
    const doc = window.open("", "_blank");
    if (!doc) return;

    let rowsHtml = "";
    itens.forEach((it) => {
      const win = resolvedVencedores[it.id];
      let cellsHtml = "";
      fornecedores.forEach((forn) => {
        const p = precos[it.id]?.[forn] ?? 0;
        const isWin = win?.fornecedor === forn;
        cellsHtml += `
          <td style="text-align: right; ${isWin ? "color: #10b981; font-weight: bold; background-color: #f0fdf4;" : ""}">
            ${p > 0 ? fmtBRL(p) : "-"}
          </td>
          <td style="text-align: right; ${isWin ? "color: #10b981; font-weight: bold; background-color: #f0fdf4;" : ""}">
            ${p > 0 ? fmtBRL(p * it.quantidade) : "-"}
          </td>
        `;
      });

      rowsHtml += `
        <tr>
          <td>${it.descricao}</td>
          <td style="text-align: center;">${it.quantidade}</td>
          ${cellsHtml}
        </tr>
      `;
    });

    let headerFornsHtml = "";
    fornecedores.forEach((forn) => {
      const isBest = fornecedorMaisBarato?.fornecedor === forn;
      headerFornsHtml += `
        <th colspan="2" style="text-align: center; ${isBest ? "background-color: #d1fae5;" : ""}">
          ${forn} ${isBest ? "🏆" : ""}
        </th>
      `;
    });

    let subHeaderFornsHtml = "";
    fornecedores.forEach(() => {
      subHeaderFornsHtml += `
        <th style="width: 90px; text-align: right;">V. Unit</th>
        <th style="width: 100px; text-align: right;">V. Total</th>
      `;
    });

    let totalRowHtml = "";
    fornecedores.forEach((forn) => {
      const tot = totaisPorFornecedor[forn];
      const isBest = fornecedorMaisBarato?.fornecedor === forn;
      totalRowHtml += `
        <td colspan="2" style="text-align: right; font-weight: bold; font-size: 14px; ${isBest ? "background-color: #d1fae5; color: #10b981;" : ""}">
          ${tot > 0 ? fmtBRL(tot) : "-"}
        </td>
      `;
    });

    doc.document.write(`
      <html>
        <head>
          <title>Mapa de Cotação - Requisicao ${requisicao.numero}</title>
          <style>
            body { font-family: sans-serif; color: #1f2937; margin: 20px; font-size: 12px; }
            .header { display: flex; justify-content: space-between; border-bottom: 2px solid #374151; padding-bottom: 10px; margin-bottom: 20px; }
            .title { font-size: 20px; font-weight: bold; color: #111827; }
            .meta-table { width: 100%; border-collapse: collapse; margin-bottom: 20px; }
            .meta-table td { padding: 4px 8px; border: 1px solid #e5e7eb; }
            .meta-table td.label { font-weight: bold; background-color: #f9fafb; width: 15%; }
            table.compare { width: 100%; border-collapse: collapse; margin-top: 15px; }
            table.compare th, table.compare td { border: 1px solid #d1d5db; padding: 6px 8px; }
            table.compare th { background-color: #f3f4f6; font-size: 11px; font-weight: bold; }
            .footer-sigs { display: flex; justify-content: space-between; margin-top: 50px; }
            .sig-box { width: 45%; border-top: 1px solid #374151; text-align: center; padding-top: 5px; font-size: 11px; }
            @media print {
              body { margin: 10px; }
            }
          </style>
        </head>
        <body>
          <div class="header">
            <div>
              <div class="title">THcontrol - Mapa de Cotação</div>
              <div style="margin-top: 5px; color: #6b7280;">Comparativo Geral de Preços de Fornecedores</div>
            </div>
            <div style="text-align: right;">
              <strong>Data:</strong> ${new Date().toLocaleDateString("pt-BR")}<br/>
              <strong>Status:</strong> ${requisicao.status.toUpperCase()}
            </div>
          </div>

          <table class="meta-table">
            <tr>
              <td class="label">Requisição Nº</td>
              <td>${requisicao.numero}</td>
              <td class="label">Solicitante</td>
              <td>${requisicao.solicitante}</td>
            </tr>
            <tr>
              <td class="label">Centro de Custo</td>
              <td>${requisicao.centro_custo}</td>
              <td class="label">Data Req.</td>
              <td>${new Date(requisicao.data).toLocaleDateString("pt-BR")}</td>
            </tr>
            ${requisicao.observacao ? `
            <tr>
              <td class="label">Observações</td>
              <td colspan="3">${requisicao.observacao}</td>
            </tr>
            ` : ""}
          </table>

          <table class="compare">
            <thead>
              <tr>
                <th rowspan="2" style="text-align: left;">Descrição do Item</th>
                <th rowspan="2" style="width: 50px; text-align: center;">Qtd</th>
                ${headerFornsHtml}
              </tr>
              <tr>
                ${subHeaderFornsHtml}
              </tr>
            </thead>
            <tbody>
              ${rowsHtml}
              <tr style="background-color: #f9fafb;">
                <td colspan="2" style="font-weight: bold; text-align: right; font-size: 13px;">VALOR TOTAL GERAL:</td>
                ${totalRowHtml}
              </tr>
            </tbody>
          </table>

          <div class="footer-sigs">
            <div class="sig-box">Responsável pelas Cotações</div>
            <div class="sig-box">Aprovação da Diretoria / Gerência</div>
          </div>

          <script>
            window.onload = function() {
              window.print();
            }
          </script>
        </body>
      </html>
    `);
    doc.document.close();
  };

  // Exportar para Excel
  const handleExportExcel = () => {
    if (!requisicao) return;

    // Cabeçalhos
    const headers = ["Item / Descrição", "Quantidade"];
    fornecedores.forEach((forn) => {
      headers.push(`${forn} (Unit)`, `${forn} (Total)`);
    });

    const rows = [headers];

    // Linhas dos itens
    itens.forEach((it) => {
      const row: any[] = [it.descricao, it.quantidade];
      fornecedores.forEach((forn) => {
        const p = precos[it.id]?.[forn] ?? 0;
        row.push(p || 0, p * it.quantidade || 0);
      });
      rows.push(row);
    });

    // Linha de totalizador
    const totalRow: any[] = ["TOTAL GERAL", ""];
    fornecedores.forEach((forn) => {
      const tot = totaisPorFornecedor[forn];
      totalRow.push("", tot);
    });
    rows.push(totalRow);

    const sheet = XLSX.utils.aoa_to_sheet(rows);
    const book = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(book, sheet, "Mapa de Cotação");

    XLSX.writeFile(book, `mapa_cotacao_req_${requisicao.numero}.xlsx`);
    toast.success("Excel gerado com sucesso!");
  };

  return (
    <AppShell>
      <div className="flex flex-col gap-6">
        {/* Cabeçalho */}
        <div>
          <div className="text-xs uppercase tracking-[0.2em] text-primary/80 mb-2">Painel de Compras</div>
          <h1 className="text-3xl font-bold tracking-tight">Mapa de Cotação de Preços</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Compare orçamentos de fornecedores com base em requisições de estoque e frota.
          </p>
        </div>

        {/* Busca */}
        <Card>
          <CardContent className="pt-6">
            <form onSubmit={handleBuscar} className="flex gap-4 items-end">
              <div className="flex-1 max-w-sm">
                <Label className="text-xs">Número da Requisição</Label>
                <div className="relative mt-1.5">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    value={buscaReq}
                    onChange={(e) => setBuscaReq(e.target.value)}
                    placeholder="Ex: 15"
                    className="pl-9"
                  />
                </div>
              </div>
              <div className="flex gap-2">
                <Button
                  type="submit"
                  disabled={loadingReq}
                  className="text-primary-foreground border-0"
                  style={{ background: "var(--gradient-primary)" }}
                >
                  {loadingReq ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" /> Buscando…
                    </>
                  ) : (
                    "Buscar Requisição"
                  )}
                </Button>
                {numeroPesquisado !== null && (
                  <Button
                    type="button"
                    variant="ghost"
                    onClick={handleLimpar}
                    className="text-muted-foreground hover:text-foreground"
                  >
                    Limpar
                  </Button>
                )}
              </div>
            </form>
          </CardContent>
        </Card>

        {/* Lista de Rascunhos (quando nenhuma requisição está aberta) */}
        {!requisicao && (
          <Card>
            <CardHeader className="pb-3 border-b border-border/40">
              <CardTitle className="text-base flex items-center gap-2">
                <FolderOpen className="h-4 w-4 text-primary" />
                Mapas de Cotação Salvos
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-4">
              {loadingRascunhos ? (
                <div className="flex justify-center py-6 text-sm text-muted-foreground animate-pulse">
                  Carregando cotações...
                </div>
              ) : rascunhos.length === 0 ? (
                <div className="text-center py-8 text-sm text-muted-foreground italic">
                  Nenhuma cotação salva no momento.
                </div>
              ) : (
                <div className="overflow-x-auto border border-border/40 rounded-lg">
                  <Table>
                    <TableHeader>
                      <TableRow className="hover:bg-transparent">
                        <TableHead className="w-[100px] text-center">Nº Req</TableHead>
                        <TableHead className="w-[120px]">Data</TableHead>
                        <TableHead>Solicitante</TableHead>
                        <TableHead>Centro de Custo</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Fornecedores Cotados</TableHead>
                        <TableHead className="w-[160px] text-right">Ações</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {rascunhos.map((r) => {
                        const forns = r.cotacao?.fornecedores || [];
                        return (
                          <TableRow key={r.id} className="hover:bg-[#0c0d10]/20">
                            <TableCell className="text-center font-bold font-mono text-zinc-100 text-xs">
                              {r.numero}
                            </TableCell>
                            <TableCell className="text-xs text-muted-foreground">
                              {new Date(r.data).toLocaleDateString("pt-BR")}
                            </TableCell>
                            <TableCell className="text-xs font-medium text-zinc-200">
                              {r.solicitante}
                            </TableCell>
                            <TableCell className="text-xs text-zinc-300">
                              {r.centro_custo}
                            </TableCell>
                            <TableCell className="text-xs">
                              {r.status === "pendente" && (
                                <Badge className="bg-rose-500/10 text-rose-500 hover:bg-rose-500/10 border-rose-500/20 gap-1 py-0.5 text-[10.5px]">
                                  Pendente
                                </Badge>
                              )}
                              {r.status === "comprado" && (
                                <Badge className="bg-amber-500/10 text-amber-500 hover:bg-amber-500/10 border-amber-500/20 gap-1 py-0.5 text-[10.5px]">
                                  Aguardando entrega
                                </Badge>
                              )}
                              {r.status === "parcial" && (
                                <Badge className="bg-blue-500/10 text-blue-500 hover:bg-blue-500/10 border-blue-500/20 gap-1 py-0.5 text-[10.5px]">
                                  Recebido parcial
                                </Badge>
                              )}
                              {r.status === "entregue" && (
                                <Badge className="bg-emerald-500/10 text-emerald-500 hover:bg-emerald-500/10 border-emerald-500/20 gap-1 py-0.5 text-[10.5px]">
                                  Entregue
                                </Badge>
                              )}
                            </TableCell>
                            <TableCell className="text-xs text-muted-foreground">
                              {forns.length > 0 ? (
                                <div className="flex flex-wrap gap-1">
                                  {forns.map((f: string) => (
                                    <Badge key={f} variant="outline" className="text-[10px] py-0 border-border/60">
                                      {f}
                                    </Badge>
                                  ))}
                                </div>
                              ) : (
                                "Nenhum"
                              )}
                            </TableCell>
                            <TableCell className="text-right p-2">
                              <div className="flex gap-1.5 justify-end">
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => {
                                    setBuscaReq(String(r.numero));
                                    setNumeroPesquisado(r.numero);
                                  }}
                                  className="h-8 text-xs"
                                >
                                  Abrir Cotação
                                </Button>
                                <Button
                                  size="icon"
                                  variant="ghost"
                                  className="h-8 w-8 text-destructive hover:bg-destructive/10"
                                  onClick={() => {
                                    excluirRascunhoMutation.mutate(r.id);
                                  }}
                                  title="Excluir Rascunho"
                                >
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </div>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {requisicao === null && numeroPesquisado !== null && (
          <div className="text-center py-10 bg-[#0c0d10]/40 rounded-lg border border-border/20 text-muted-foreground text-sm">
            Nenhuma requisição encontrada com o número {numeroPesquisado}.
          </div>
        )}

        {requisicao && (
          <div className="grid gap-6">
            {/* Metadados da Requisição */}
            <Card>
              <CardHeader className="pb-3 border-b border-border/40">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base flex items-center gap-2">
                    Requisição Nº {requisicao.numero}
                    {requisicao.status === "pendente" && (
                      <Badge className="bg-rose-500/10 text-rose-500 hover:bg-rose-500/10 border-rose-500/20 gap-1 py-0.5">
                        <AlertCircle className="h-3.5 w-3.5" /> Pendente
                      </Badge>
                    )}
                    {requisicao.status === "comprado" && (
                      <Badge className="bg-amber-500/10 text-amber-500 hover:bg-amber-500/10 border-amber-500/20 gap-1 py-0.5">
                        <ShoppingCart className="h-3.5 w-3.5" /> Aguardando entrega
                      </Badge>
                    )}
                    {requisicao.status === "parcial" && (
                      <Badge className="bg-blue-500/10 text-blue-500 hover:bg-blue-500/10 border-blue-500/20 gap-1 py-0.5">
                        <PackageOpen className="h-3.5 w-3.5" /> Recebido parcial
                      </Badge>
                    )}
                    {requisicao.status === "entregue" && (
                      <Badge className="bg-emerald-500/10 text-emerald-500 hover:bg-emerald-500/10 border-emerald-500/20 gap-1 py-0.5">
                        <CheckCircle2 className="h-3.5 w-3.5" /> Entregue
                      </Badge>
                    )}
                  </CardTitle>
                  <div className="text-xs text-muted-foreground">
                    Data: {new Date(requisicao.data).toLocaleDateString("pt-BR")}
                  </div>
                </div>
              </CardHeader>
              <CardContent className="pt-4 grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                <div>
                  <div className="text-muted-foreground text-xs">Solicitante</div>
                  <div className="font-semibold text-zinc-100">{requisicao.solicitante}</div>
                </div>
                <div>
                  <div className="text-muted-foreground text-xs">Centro de Custo</div>
                  <div className="font-semibold text-zinc-100">{requisicao.centro_custo}</div>
                </div>
                {requisicao.observacao && (
                  <div className="col-span-2">
                    <div className="text-muted-foreground text-xs">Observações</div>
                    <div className="text-zinc-300 italic">{requisicao.observacao}</div>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Quadro de Cotação */}
            <Card>
              <CardHeader className="pb-3 border-b border-border/40 flex flex-row flex-wrap items-center justify-between gap-4">
                <CardTitle className="text-base">Comparativo de Preços</CardTitle>
                <div className="flex flex-wrap gap-2">
                  <Button type="button" variant="outline" size="sm" onClick={handleAddFornecedor}>
                    <Plus className="h-3.5 w-3.5 mr-1" /> Fornecedor
                  </Button>
                  {canEdit && (
                    <>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="border-primary/50 text-primary hover:bg-primary/10"
                        onClick={() => salvarRascunhoMutation.mutate()}
                        disabled={salvarRascunhoMutation.isPending}
                      >
                        {salvarRascunhoMutation.isPending ? (
                          <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" />
                        ) : (
                          <Save className="h-3.5 w-3.5 mr-1" />
                        )}
                        Salvar Rascunho
                      </Button>
                      {requisicao.cotacao && (
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="border-destructive/50 text-destructive hover:bg-destructive/10"
                          onClick={() => excluirRascunhoMutation.mutate(undefined)}
                          disabled={excluirRascunhoMutation.isPending}
                        >
                          {excluirRascunhoMutation.isPending ? (
                            <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" />
                          ) : (
                            <Trash2 className="h-3.5 w-3.5 mr-1" />
                          )}
                          Excluir Rascunho
                        </Button>
                      )}
                    </>
                  )}
                  <Button type="button" variant="outline" size="sm" onClick={handleExportExcel}>
                    <FileDown className="h-3.5 w-3.5 mr-1" /> Excel
                  </Button>
                  <Button type="button" variant="outline" size="sm" onClick={handleImprimir}>
                    <Printer className="h-3.5 w-3.5 mr-1" /> Imprimir
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="pt-4">
                <div className="overflow-x-auto border border-border/40 rounded-lg">
                  <Table>
                    <TableHeader>
                      <TableRow className="hover:bg-transparent">
                        <TableHead className="min-w-[200px]">Item / Descrição</TableHead>
                        <TableHead className="text-center w-[80px]">Qtd</TableHead>
                        {fornecedores.map((forn, colIdx) => {
                          const isBest = fornecedorMaisBarato?.fornecedor === forn;
                          const query = sugQuery[colIdx] || "";
                          const filteredSugs = query.trim()
                            ? fornecedoresHistorico.filter((f) =>
                                f.toLowerCase().includes(query.trim().toLowerCase()) &&
                                f !== forn
                              ).slice(0, 5)
                            : [];

                          return (
                            <TableHead key={colIdx} className="min-w-[190px] p-2 text-center border-l border-border/20">
                              <div className="flex flex-col gap-1 items-center relative">
                                <div className="flex items-center gap-1 w-full justify-center">
                                  <Input
                                    value={forn}
                                    onChange={(e) => {
                                      const val = e.target.value;
                                      setFornecedores((prev) => {
                                        const next = [...prev];
                                        next[colIdx] = val;
                                        return next;
                                      });
                                      setSugQuery((prev) => ({ ...prev, [colIdx]: val }));
                                      setShowSug((prev) => ({ ...prev, [colIdx]: true }));
                                    }}
                                    onFocus={() => setShowSug((prev) => ({ ...prev, [colIdx]: true }))}
                                    onBlur={() => setTimeout(() => setShowSug((prev) => ({ ...prev, [colIdx]: false })), 200)}
                                    placeholder={`Fornecedor ${colIdx + 1}`}
                                    className={`h-8 text-center text-xs font-semibold ${
                                      isBest ? "border-emerald-500/80 bg-emerald-500/5 text-emerald-400" : ""
                                    }`}
                                  />
                                  <Button
                                    type="button"
                                    size="icon"
                                    variant="ghost"
                                    className="h-7 w-7 text-destructive hover:bg-destructive/10"
                                    onClick={() => handleRemoveFornecedor(colIdx)}
                                    disabled={fornecedores.length <= 1}
                                  >
                                    <Trash2 className="h-3.5 w-3.5" />
                                  </Button>
                                </div>
                                {showSug[colIdx] && filteredSugs.length > 0 && (
                                  <div className="absolute left-0 right-0 top-9 z-50 bg-[#0e0f12] border border-border/40 rounded-md shadow-lg max-h-36 overflow-y-auto text-left py-1">
                                    {filteredSugs.map((sug) => (
                                      <button
                                        key={sug}
                                        type="button"
                                        onMouseDown={(e) => {
                                          e.preventDefault();
                                          handleUpdateFornecedorName(colIdx, sug);
                                          setShowSug((prev) => ({ ...prev, [colIdx]: false }));
                                        }}
                                        className="w-full text-[11px] text-left hover:bg-muted text-zinc-100 hover:text-white py-1.5 px-2 cursor-pointer transition-colors"
                                      >
                                        {sug}
                                      </button>
                                    ))}
                                  </div>
                                )}
                                {isBest && (
                                  <Badge className="bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 text-[9px] gap-1 px-1.5 py-0">
                                    <Trophy className="h-2.5 w-2.5" /> Economia Geral
                                  </Badge>
                                )}
                              </div>
                            </TableHead>
                          );
                        })}
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {itens.map((it) => {
                        const win = resolvedVencedores[it.id];

                        return (
                          <TableRow key={it.id} className="hover:bg-[#0c0d10]/20">
                            <TableCell className="font-medium text-xs py-3">{it.descricao}</TableCell>
                            <TableCell className="text-center font-semibold text-xs py-3">{it.quantidade}</TableCell>
                            {fornecedores.map((forn, colIdx) => {
                              const precoVal = precos[it.id]?.[forn] ?? "";
                              const isWin = win?.fornecedor === forn;

                              return (
                                <TableCell key={colIdx} className="p-2 border-l border-border/20">
                                  <div className="flex flex-col gap-1.5">
                                    <div className="relative">
                                      <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[10px] text-muted-foreground font-mono">
                                        R$
                                      </span>
                                      <Input
                                        type="number"
                                        step="0.01"
                                        value={precoVal || ""}
                                        onChange={(e) => handleUpdatePreco(it.id, forn, e.target.value)}
                                        placeholder="0,00"
                                        className={`h-8 pl-7 pr-2 text-right text-xs font-mono ${
                                          isWin ? "border-emerald-500/60 bg-emerald-500/5 text-emerald-400 font-semibold" : ""
                                        }`}
                                      />
                                    </div>
                                    <div className="flex items-center justify-between px-1 min-h-[22px]">
                                      {Number(precoVal) > 0 ? (
                                        <button
                                          type="button"
                                          onClick={() => setVencedoresManuais(prev => ({ ...prev, [it.id]: forn }))}
                                          className={`flex items-center gap-1 transition-all ${
                                            isWin
                                              ? "text-emerald-400 font-semibold"
                                              : "text-muted-foreground/60 hover:text-emerald-400"
                                          }`}
                                          title={isWin ? "Vendedor vencedor selecionado" : "Selecionar como vencedor deste item"}
                                        >
                                          {isWin ? (
                                            <CheckCircle2 className="h-3.5 w-3.5 fill-emerald-500/20 text-emerald-400 animate-in fade-in zoom-in-75 duration-200" />
                                          ) : (
                                            <span className="h-3 w-3 rounded-full border border-muted-foreground/40 hover:border-emerald-400" />
                                          )}
                                          <span className="text-[9px] uppercase tracking-wider">vencer</span>
                                        </button>
                                      ) : (
                                        <div />
                                      )}
                                      {Number(precoVal) > 0 && (
                                        <div className={`text-[10px] font-mono ${
                                          isWin ? "text-emerald-400/80 font-medium" : "text-muted-foreground"
                                        }`}>
                                          Sub: {fmtBRL(Number(precoVal) * it.quantidade)}
                                        </div>
                                      )}
                                    </div>
                                  </div>
                                </TableCell>
                              );
                            })}
                          </TableRow>
                        );
                      })}
                      {/* Linha dos Totais */}
                      <TableRow className="bg-[#0c0d10]/40 font-semibold border-t-2 border-border/60 hover:bg-[#0c0d10]/40">
                        <TableCell colSpan={2} className="text-right text-xs uppercase tracking-wider py-4">
                          Valor Total:
                        </TableCell>
                        {fornecedores.map((forn, colIdx) => {
                          const tot = totaisPorFornecedor[forn];
                          const isBest = fornecedorMaisBarato?.fornecedor === forn;

                          return (
                            <TableCell key={colIdx} className="text-right border-l border-border/20 py-4">
                              <div className={`font-mono text-sm font-bold ${
                                isBest ? "text-emerald-400 bg-emerald-500/5 border border-emerald-500/30 rounded px-2 py-1" : "text-zinc-200"
                              }`}>
                                {tot > 0 ? fmtBRL(tot) : "—"}
                              </div>
                            </TableCell>
                          );
                        })}
                      </TableRow>
                    </TableBody>
                  </Table>
                </div>

                {/* Ação de Gerar Compra */}
                {canEdit && (
                  <div className="mt-6 flex justify-end">
                    <Button
                      type="button"
                      onClick={openGerarCompras}
                      disabled={gerarComprasMutation.isPending}
                      className="text-primary-foreground border-0 gap-2"
                      style={{ background: "var(--gradient-primary)" }}
                    >
                      {gerarComprasMutation.isPending ? (
                        <>
                          <Loader2 className="h-4 w-4 animate-spin" /> Salvando cotação…
                        </>
                      ) : (
                        <>
                          <CheckCircle2 className="h-4 w-4" /> Aprovar e Gerar Lançamentos
                        </>
                      )}
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        )}
      </div>

      {/* Modal / Dialog de Gerar Compras */}
      <Dialog open={modalGerarOpen} onOpenChange={setModalGerarOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Confirmar Faturamento de Itens</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            {requisicao && requisicao.status !== 'pendente' && (
              <div className="bg-amber-500/10 border border-amber-500/20 text-amber-500 p-3 rounded-lg text-xs flex gap-2 items-start mb-2">
                <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
                <div>
                  <strong>Atenção:</strong> Esta requisição já está com o status <strong>{requisicao.status === 'comprado' ? 'Aguardando entrega' : requisicao.status === 'parcial' ? 'Recebido parcial' : 'Entregue'}</strong>. Se você confirmar, novos lançamentos de compras serão gerados, o que pode causar duplicidade de itens se já tiverem sido gerados antes.
                </div>
              </div>
            )}
            <p className="text-xs text-muted-foreground">
              Para cada fornecedor ganhador de cotação, informe os dados complementares antes de registrar na tabela de compras.
            </p>
            <div className="space-y-4 max-h-[350px] overflow-y-auto pr-1">
              {Object.keys(faturamentos).map((forn) => {
                const fat = faturamentos[forn];
                return (
                  <div key={forn} className="border border-border/40 p-4 rounded-lg bg-[#0c0d10]/20 space-y-3">
                    <div className="font-semibold text-sm text-primary flex items-center justify-between border-b border-border/30 pb-1.5">
                      <span>{forn}</span>
                      <span className="text-xs font-mono text-muted-foreground">
                        Total: {fmtBRL(totaisPorFornecedor[forn])}
                      </span>
                    </div>
                    <div className="grid grid-cols-2 gap-3 text-xs">
                      <div>
                        <Label className="text-[10px]">Nota Fiscal (Opcional)</Label>
                        <Input
                          value={fat.nf}
                          onChange={(e) => setFaturamentos({
                            ...faturamentos,
                            [forn]: { ...fat, nf: e.target.value }
                          })}
                          placeholder={`Ex: COT-${requisicao?.numero}`}
                          className="h-8 text-xs mt-1"
                        />
                      </div>
                      <div>
                        <Label className="text-[10px]">Prazo de Pagamento</Label>
                        <Input
                          value={fat.prazo}
                          onChange={(e) => setFaturamentos({
                            ...faturamentos,
                            [forn]: { ...fat, prazo: e.target.value }
                          })}
                          placeholder="Ex: 30 ou 15/30/45"
                          className="h-8 text-xs mt-1"
                        />
                      </div>
                      <div>
                        <Label className="text-[10px]">Placa / Frota</Label>
                        <Input
                          value={fat.frota}
                          onChange={(e) => setFaturamentos({
                            ...faturamentos,
                            [forn]: { ...fat, frota: e.target.value }
                          })}
                          placeholder="Ex: 201 ou ESTOQUE"
                          className="h-8 text-xs mt-1"
                        />
                      </div>
                      <div>
                        <Label className="text-[10px]">Categoria Padrão</Label>
                        <Select
                          value={fat.categoria}
                          onValueChange={(v) => setFaturamentos({
                            ...faturamentos,
                            [forn]: { ...fat, categoria: v }
                          })}
                        >
                          <SelectTrigger className="h-8 mt-1"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            {CATEGORIAS.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setModalGerarOpen(false)} disabled={gerarComprasMutation.isPending}>
              Cancelar
            </Button>
            <Button
              onClick={() => gerarComprasMutation.mutate()}
              disabled={gerarComprasMutation.isPending}
              className="text-primary-foreground border-0"
              style={{ background: "var(--gradient-primary)" }}
            >
              {gerarComprasMutation.isPending ? "Confirmando…" : "Confirmar e Lançar Compras"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppShell>
  );
}
