import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";

import { AppShell } from "@/components/app-shell";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
  PieChart,
  Pie,
  Cell,
  Legend,
  LineChart,
  Line,
} from "recharts";
import { fmtBRL, MESES, sbFrom, type Compra, type Meta } from "@/lib/db-types";
import {
  TrendingUp,
  TrendingDown,
  Wallet,
  ShoppingCart,
  Target,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import { useState, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { useCurrentUserAccess } from "@/hooks/use-auth";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export const Route = createFileRoute("/_authenticated/")({
  component: DashboardPage,
});

function CollapsibleCard({
  id,
  title,
  icon,
  headerExtra,
  children,
  className,
  collapsed,
  onToggle,
}: {
  id: string;
  title: ReactNode;
  icon?: ReactNode;
  headerExtra?: ReactNode;
  children: ReactNode;
  className?: string;
  collapsed: boolean;
  onToggle: (id: string) => void;
}) {
  return (
    <Card className={className}>
      <CardHeader className="flex flex-row items-center justify-between gap-2">
        <CardTitle className="text-base flex items-center gap-2">
          {icon}
          {title}
        </CardTitle>
        <div className="flex items-center gap-3">
          {!collapsed && headerExtra}
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            onClick={() => onToggle(id)}
            aria-label={collapsed ? "Expandir" : "Recolher"}
          >
            {collapsed ? <ChevronDown className="h-4 w-4" /> : <ChevronUp className="h-4 w-4" />}
          </Button>
        </div>
      </CardHeader>
      {!collapsed && <CardContent>{children}</CardContent>}
    </Card>
  );
}

const CHART_COLORS = [
  "var(--chart-1)",
  "var(--chart-2)",
  "var(--chart-3)",
  "var(--chart-4)",
  "var(--chart-5)",
  "oklch(0.65 0.16 130)",
  "oklch(0.7 0.14 260)",
  "oklch(0.72 0.15 20)",
];

function DashboardPage() {
  const now = new Date();
  const [ano, setAno] = useState<number>(now.getFullYear());
  const [mes, setMes] = useState<string>("TODOS");
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});
  const toggle = (id: string) =>
    setCollapsed((prev) => ({ ...prev, [id]: !prev[id] }));
  const { access } = useCurrentUserAccess();
  const canSee = (w: string) =>
    access?.canSeeWidget ? access.canSeeWidget(w as never) : true;

  const { data: compras = [] } = useQuery({
    queryKey: ["compras", "all"],
    queryFn: async () => {
      const { data, error } = await sbFrom("compras")
        .select("*")
        .order("data_emissao", { ascending: false });
      if (error) throw error;
      return (data ?? []) as unknown as Compra[];
    },
  });

  const { data: metas = [] } = useQuery({
    queryKey: ["metas", ano],
    queryFn: async () => {
      const { data, error } = await sbFrom("metas")
        .select("*")
        .eq("ano", ano);
      if (error) throw error;
      return (data ?? []) as unknown as Meta[];
    },
  });

  const anosDisponiveis = Array.from(new Set(compras.map((c) => c.ano).filter(Boolean))) as number[];
  if (!anosDisponiveis.includes(ano)) anosDisponiveis.unshift(ano);
  anosDisponiveis.sort((a, b) => b - a);

  const comprasAno = compras.filter((c) => c.ano === ano);
  const totalAno = comprasAno.reduce((s, c) => s + Number(c.valor_total || 0), 0);
  const mesAtual = mes === "TODOS" ? MESES[now.getMonth()] : mes;
  const totalMes = comprasAno
    .filter((c) => c.mes === mesAtual)
    .reduce((s, c) => s + Number(c.valor_total || 0), 0);
  const totalMetaMes = metas.filter((m) => m.mes === mesAtual).reduce((s, m) => s + Number(m.valor_meta), 0);
  const diferencaMes = totalMetaMes - totalMes;

  // base de compras respeitando o filtro de mês (para categorias/fornecedores)
  const comprasFiltradas = mes === "TODOS" ? comprasAno : comprasAno.filter((c) => c.mes === mes);

  // gasto por mês (sempre exibe os 12 meses do ano selecionado)
  const porMes = MESES.map((m) => {
    const gasto = comprasAno.filter((c) => c.mes === m).reduce((s, c) => s + Number(c.valor_total || 0), 0);
    const meta = metas.filter((x) => x.mes === m).reduce((s, x) => s + Number(x.valor_meta), 0);
    return { mes: m.slice(0, 3), Gasto: Math.round(gasto), Meta: Math.round(meta) };
  });

  // por categoria
  const catMap = new Map<string, number>();
  comprasFiltradas.forEach((c) => {
    const k = c.tipo || "OUTROS";
    catMap.set(k, (catMap.get(k) || 0) + Number(c.valor_total || 0));
  });
  const porCategoria = Array.from(catMap.entries())
    .map(([name, value]) => ({ name, value: Math.round(value) }))
    .sort((a, b) => b.value - a.value)
    .slice(0, 8);

  // top fornecedores
  const fornMap = new Map<string, number>();
  comprasFiltradas.forEach((c) => {
    if (!c.fornecedor) return;
    fornMap.set(c.fornecedor, (fornMap.get(c.fornecedor) || 0) + Number(c.valor_total || 0));
  });
  const topFornecedores = Array.from(fornMap.entries())
    .map(([name, value]) => ({ name, value: Math.round(value) }))
    .sort((a, b) => b.value - a.value)
    .slice(0, 6);

  const kpis = [
    {
      label: "Gasto no ano",
      value: fmtBRL(totalAno),
      icon: Wallet,
      tone: "primary" as const,
      sub: `${comprasAno.length} lançamentos`,
    },
    {
      label: `Gasto em ${mesAtual}`,
      value: fmtBRL(totalMes),
      icon: ShoppingCart,
      tone: "accent" as const,
      sub: totalMetaMes > 0 ? `Meta: ${fmtBRL(totalMetaMes)}` : "Sem meta definida",
    },
    {
      label: "Diferença vs meta",
      value: fmtBRL(Math.abs(diferencaMes)),
      icon: diferencaMes >= 0 ? TrendingUp : TrendingDown,
      tone: (diferencaMes >= 0 ? "primary" : "danger") as "primary" | "danger",
      sub: diferencaMes >= 0 ? "Abaixo da meta" : "Acima da meta",
    },
  ];

  return (
    <AppShell>
      <div className="flex flex-wrap items-end justify-between gap-4 mb-8">
        <div>
          <div className="text-xs uppercase tracking-[0.2em] text-primary/80 mb-2">
            Painel Executivo
          </div>
          <h1 className="text-3xl md:text-4xl font-bold tracking-tight">
            Controle Mensal de Custos
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Visão consolidada de compras, metas e desempenho por categoria.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground">Mês</span>
          <Select value={mes} onValueChange={setMes}>
            <SelectTrigger className="w-[150px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="TODOS">Todos</SelectItem>
              {MESES.map((m) => (
                <SelectItem key={m} value={m}>{m}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <span className="text-xs text-muted-foreground ml-2">Ano</span>
          <Select value={String(ano)} onValueChange={(v) => setAno(Number(v))}>
            <SelectTrigger className="w-[120px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              {anosDisponiveis.map((y) => (
                <SelectItem key={y} value={String(y)}>{y}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* KPIs */}
      {canSee("kpis") && (
      <div className="grid gap-4 md:grid-cols-3 mb-8">
        {kpis.map((k) => {
          const Icon = k.icon;
          return (
            <Card
              key={k.label}
              className="relative overflow-hidden border-border/60"
              style={{ boxShadow: "var(--shadow-card)" }}
            >
              <div
                className="absolute inset-x-0 top-0 h-[2px]"
                style={{
                  background:
                    k.tone === "primary"
                      ? "var(--gradient-primary)"
                      : k.tone === "accent"
                        ? "var(--gradient-accent)"
                        : k.tone === "danger"
                          ? "linear-gradient(90deg, oklch(0.62 0.22 25), oklch(0.7 0.18 30))"
                          : "transparent",
                }}
              />
              <CardContent className="pt-6">
                <div className="flex items-start justify-between">
                  <div className="text-xs uppercase tracking-wider text-muted-foreground">
                    {k.label}
                  </div>
                  <div
                    className={`grid h-9 w-9 place-items-center rounded-lg ${
                      k.tone === "danger"
                        ? "bg-destructive/15 text-destructive"
                        : k.tone === "accent"
                          ? "bg-accent/15 text-accent"
                          : "bg-primary/15 text-primary"
                    }`}
                  >
                    <Icon className="h-4 w-4" />
                  </div>
                </div>
                <div className="mt-4 text-2xl font-bold tabular-nums tracking-tight">
                  {k.value}
                </div>
                <div className="mt-1 text-xs text-muted-foreground">{k.sub}</div>
              </CardContent>
            </Card>
          );
        })}
      </div>
      )}

      {/* Chart row 1 */}
      <div className="grid gap-4 lg:grid-cols-3 mb-4">
        {canSee("gasto-meta") && (
        <CollapsibleCard
          id="gasto-meta"
          className="lg:col-span-2"
          title={`Gasto x Meta por mês — ${ano}`}
          collapsed={!!collapsed["gasto-meta"]}
          onToggle={toggle}
          headerExtra={
            <div className="flex items-center gap-4 text-xs text-muted-foreground">
              <span className="flex items-center gap-1.5">
                <span className="h-2.5 w-2.5 rounded-sm bg-primary" /> Gasto
              </span>
              <span className="flex items-center gap-1.5">
                <span className="h-2.5 w-2.5 rounded-sm bg-accent" /> Meta
              </span>
            </div>
          }
        >
          <ResponsiveContainer width="100%" height={320}>
              <BarChart data={porMes} margin={{ top: 8, right: 8, left: 8, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                <XAxis dataKey="mes" tick={{ fill: "var(--muted-foreground)", fontSize: 11 }} axisLine={false} tickLine={false} />
                <YAxis
                  tick={{ fill: "var(--muted-foreground)", fontSize: 11 }}
                  axisLine={false}
                  tickLine={false}
                  tickFormatter={(v) => `${Math.round(v / 1000)}k`}
                />
                <Tooltip
                  contentStyle={{
                    background: "var(--popover)",
                    border: "1px solid var(--border)",
                    borderRadius: 8,
                    color: "var(--foreground)",
                  }}
                  formatter={(v: number) => fmtBRL(v)}
                />
                <Bar dataKey="Meta" fill="var(--accent)" radius={[4, 4, 0, 0]} />
                <Bar dataKey="Gasto" fill="var(--primary)" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
        </CollapsibleCard>
        )}

        {canSee("top-categorias") && (
        <CollapsibleCard
          id="top-categorias"
          title="Top categorias"
          icon={<Target className="h-4 w-4 text-primary" />}
          collapsed={!!collapsed["top-categorias"]}
          onToggle={toggle}
        >
          <ResponsiveContainer width="100%" height={320}>
              <PieChart>
                <Pie
                  data={porCategoria}
                  dataKey="value"
                  nameKey="name"
                  innerRadius={55}
                  outerRadius={95}
                  paddingAngle={2}
                >
                  {porCategoria.map((_, i) => (
                    <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{
                    background: "var(--popover)",
                    border: "1px solid var(--border)",
                    borderRadius: 8,
                  }}
                  formatter={(v: number) => fmtBRL(v)}
                />
                <Legend
                  verticalAlign="bottom"
                  height={36}
                  wrapperStyle={{ fontSize: 11, color: "var(--muted-foreground)" }}
                />
              </PieChart>
            </ResponsiveContainer>
        </CollapsibleCard>
        )}
      </div>

      {/* Chart row 2 */}
      <div className="grid gap-4 lg:grid-cols-3">
        {canSee("evolucao") && (
        <CollapsibleCard
          id="evolucao"
          className="lg:col-span-2"
          title={`Evolução mensal — ${ano}`}
          collapsed={!!collapsed["evolucao"]}
          onToggle={toggle}
        >
          <ResponsiveContainer width="100%" height={260}>
              <LineChart data={porMes.map((p) => ({ mes: p.mes, Gasto: p.Gasto }))}>
                <defs>
                  <linearGradient id="glow" x1="0" y1="0" x2="1" y2="0">
                    <stop offset="0%" stopColor="var(--primary)" />
                    <stop offset="100%" stopColor="var(--accent)" />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                <XAxis dataKey="mes" tick={{ fill: "var(--muted-foreground)", fontSize: 11 }} axisLine={false} tickLine={false} />
                <YAxis
                  tick={{ fill: "var(--muted-foreground)", fontSize: 11 }}
                  axisLine={false}
                  tickLine={false}
                  tickFormatter={(v) => `${Math.round(v / 1000)}k`}
                />
                <Tooltip
                  contentStyle={{
                    background: "var(--popover)",
                    border: "1px solid var(--border)",
                    borderRadius: 8,
                  }}
                  formatter={(v: number) => fmtBRL(v)}
                />
                <Line type="monotone" dataKey="Gasto" stroke="url(#glow)" strokeWidth={3} dot={{ r: 4, fill: "var(--primary)" }} />
              </LineChart>
            </ResponsiveContainer>
        </CollapsibleCard>
        )}

        {canSee("top-fornecedores") && (
        <CollapsibleCard
          id="top-fornecedores"
          title="Top fornecedores"
          collapsed={!!collapsed["top-fornecedores"]}
          onToggle={toggle}
        >
          <div className="space-y-3">
            {topFornecedores.length === 0 && (
              <p className="text-sm text-muted-foreground">Sem dados.</p>
            )}
            {topFornecedores.map((f, i) => {
              const max = topFornecedores[0]?.value || 1;
              const pct = (f.value / max) * 100;
              return (
                <div key={f.name}>
                  <div className="flex justify-between text-xs mb-1">
                    <span className="font-medium truncate max-w-[60%]">{f.name}</span>
                    <span className="tabular-nums text-muted-foreground">{fmtBRL(f.value)}</span>
                  </div>
                  <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                    <div
                      className="h-full rounded-full"
                      style={{
                        width: `${pct}%`,
                        background: CHART_COLORS[i % CHART_COLORS.length],
                      }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </CollapsibleCard>
        )}
      </div>
    </AppShell>
  );
}