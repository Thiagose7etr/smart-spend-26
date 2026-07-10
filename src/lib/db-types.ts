// Local domain types for tables not yet in generated Supabase types.
export type Compra = {
  id: string;
  nf: string | null;
  fornecedor: string | null;
  data_emissao: string | null;
  item: string | null;
  quant: number | null;
  valor_unit: number | null;
  valor_total: number | null;
  frota: string | null;
  prazo_pag: string | null;
  tipo: string | null;
  mes: string | null;
  ano: number | null;
  created_at?: string;
  updated_at?: string;
};

export type Meta = {
  id: string;
  categoria: string;
  mes: string;
  ano: number;
  valor_meta: number;
};

export type Frota = {
  id: string;
  codigo: string;
  placa: string | null;
  tipo: string | null;
  modelo: string | null;
  marca: string | null;
  chassi: string | null;
  status?: "liberado" | "manutencao";
};

export type RequisicaoItem = {
  id: string;
  requisicao_id: string;
  descricao: string;
  quantidade: number;
  created_at?: string;
  updated_at?: string;
};

export type Requisicao = {
  id: string;
  numero: number;
  centro_custo: string;
  data: string;
  solicitante: string;
  status: "pendente" | "comprado" | "entregue";
  created_at?: string;
  updated_at?: string;
  itens?: RequisicaoItem[];
};


export type Combustivel = {
  id: string;
  data: string;
  tipo: string; // S10 | S500
  movimento: string; // ENTRADA | SAIDA | ESTOQUE
  quantidade: number;
  frota: string | null;
  observacao: string | null;
};

export type Guincho = {
  id: string;
  data: string | null;
  frota: string | null;
  tipo: string | null;
  modelo: string | null;
  peso_kg: number | null;
  problema: string | null;
  endereco_retirada: string | null;
  endereco_entrega: string | null;
  status: string | null;
  motorista_nome: string | null;
  motorista_telefone: string | null;
};

export const MESES = [
  "Janeiro","Fevereiro","Março","Abril","Maio","Junho",
  "Julho","Agosto","Setembro","Outubro","Novembro","Dezembro",
] as const;

export const CATEGORIAS = [
  "COMBUSTIVEL","PEÇAS","SERVIÇO TERCEIRO","MAN E REPARO BENS","LUBRIFICANTES",
  "UNIFORMES/EPI","EQUIPAMENTOS","BORRACHARIA","INSUMOS","PINTURA","LAVADOR",
  "GUINCHO","LOCAÇÃO","PREDIAL SERV","PREDIAL MERC","LIMPEZA","ESCRITORIO",
  "HOSPEDAGEM","INFORMATICA","PRESIDENCIA","DIRETORIA","GRAFICA","FUNILARIA EXT",
  "GAS EMPILHADEIRA","DEDETIZAÇÃO",
] as const;

export function fmtBRL(v: number | null | undefined) {
  const n = Number(v || 0);
  return n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

export function fmtNum(v: number | null | undefined, digits = 0) {
  return Number(v || 0).toLocaleString("pt-BR", { minimumFractionDigits: digits, maximumFractionDigits: digits });
}

export function mesFromDate(d: string | Date | null | undefined): { mes: string; ano: number } | null {
  if (!d) return null;
  const date = typeof d === "string" ? new Date(d) : d;
  if (Number.isNaN(date.getTime())) return null;
  return { mes: MESES[date.getMonth()], ano: date.getFullYear() };
}

// Untyped table accessor for tables missing from generated types.
// Usage: sbFrom("compras").select("*") — returns the Supabase query builder as any.
import { supabase } from "@/integrations/supabase/client";
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function sbFrom(name: string): any {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (supabase as any).from(name);
}