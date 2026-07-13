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
import { cn } from "@/lib/utils";
import { fmtBRL, MESES, sbFrom, CATEGORIAS, type Compra, type Meta } from "@/lib/db-types";
import {
  TrendingUp,
  TrendingDown,
  Wallet,
  ShoppingCart,
  Target,
  ChevronDown,
  ChevronUp,
  GripVertical,
  LayoutDashboard,
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
      <CardHeader className="flex flex-row items-center justify-between gap-2 cursor-grab active:cursor-grabbing select-none">
        <CardTitle className="text-base flex items-center gap-2">
          <GripVertical className="h-3.5 w-3.5 text-muted-foreground/35 hover:text-muted-foreground/75 transition" />
          {icon}
          {title}
        </CardTitle>
        <div className="flex items-center gap-3" onDragStart={(e) => e.preventDefault()} draggable={false}>
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
  const { access, loading: accessLoading } = useCurrentUserAccess();
  const canSee = (w: string) =>
    access?.canSeeWidget ? access.canSeeWidget(w as never) : true;

  const [layout, setLayout] = useState<string[]>(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem("dashboard-layout");
      if (saved) {
        try {
          const parsed = JSON.parse(saved);
          if (Array.isArray(parsed) && parsed.length >= 5) {
            if (!parsed.includes("custos-categoria")) {
              parsed.push("custos-categoria");
            }
            return parsed;
          }
        } catch {}
      }
    }
    return ["gasto-meta", "top-categorias", "evolucao", "top-fornecedores", "custos-categoria"];
  });

  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);

  const handleDragStart = (e: React.DragEvent, index: number) => {
    setDraggedIndex(index);
    e.dataTransfer.effectAllowed = "move";
  };

  const handleDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault();
  };

  const handleDrop = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    if (draggedIndex === null) return;
    
    const newLayout = [...layout];
    const [draggedItem] = newLayout.splice(draggedIndex, 1);
    newLayout.splice(index, 0, draggedItem);
    
    setLayout(newLayout);
    localStorage.setItem("dashboard-layout", JSON.stringify(newLayout));
  };

  const handleDragEnd = () => {
    setDraggedIndex(null);
  };

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

  // custos por categoria para a lista de todos os custos
  const catListMap = new Map<string, number>();
  CATEGORIAS.forEach((cat) => catListMap.set(cat, 0));
  comprasFiltradas.forEach((c) => {
    const k = c.tipo || "OUTROS";
    catListMap.set(k, (catListMap.get(k) || 0) + Number(c.valor_total || 0));
  });
  const custosPorCategoria = Array.from(catListMap.entries())
    .map(([name, value]) => ({ name, value: Math.round(value) }))
    .filter((f) => f.value > 0)
    .sort((a, b) => b.value - a.value);

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

  const visibleWidgetsCount = layout.filter((id) => canSee(id)).length + (canSee("kpis") ? 1 : 0);


  const renderWidget = (id: string, index: number) => {
    const dragProps = {
      draggable: true,
      onDragStart: (e: React.DragEvent) => handleDragStart(e, index),
      onDragOver: (e: React.DragEvent) => handleDragOver(e, index),
      onDragEnd: handleDragEnd,
      onDrop: (e: React.DragEvent) => handleDrop(e, index),
      className: cn(
        "transition-all duration-200 border border-transparent rounded-xl",
        draggedIndex === index && "opacity-35 scale-[0.98] border-dashed border-primary",
        id === "gasto-meta" || id === "evolucao" ? "lg:col-span-2" : "lg:col-span-1"
      )
    };

    switch (id) {
      case "gasto-meta":
        return canSee("gasto-meta") ? (
          <div {...dragProps} key={id}>
            <CollapsibleCard
              id="gasto-meta"
              title={`Gasto x Meta por mês — ${ano}`}
              icon={<TrendingUp className="h-4 w-4 text-primary" />}
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
                    }}
                    itemStyle={{ color: "var(--popover-foreground)" }}
                    labelStyle={{ color: "var(--popover-foreground)" }}
                    formatter={(v: number) => fmtBRL(v)}
                  />
                  <Bar dataKey="Meta" fill="var(--accent)" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="Gasto" fill="var(--primary)" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </CollapsibleCard>
          </div>
        ) : null;

      case "top-categorias":
        return canSee("top-categorias") ? (
          <div {...dragProps} key={id}>
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
                    itemStyle={{ color: "var(--popover-foreground)" }}
                    labelStyle={{ color: "var(--popover-foreground)" }}
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
          </div>
        ) : null;

      case "evolucao":
        return canSee("evolucao") ? (
          <div {...dragProps} key={id}>
            <CollapsibleCard
              id="evolucao"
              title={`Evolução mensal — ${ano}`}
              icon={<TrendingUp className="h-4 w-4 text-primary" />}
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
                    itemStyle={{ color: "var(--popover-foreground)" }}
                    labelStyle={{ color: "var(--popover-foreground)" }}
                    formatter={(v: number) => fmtBRL(v)}
                  />
                  <Line type="monotone" dataKey="Gasto" stroke="url(#glow)" strokeWidth={3} dot={{ r: 4, fill: "var(--primary)" }} />
                </LineChart>
              </ResponsiveContainer>
            </CollapsibleCard>
          </div>
        ) : null;

      case "top-fornecedores":
        return canSee("top-fornecedores") ? (
          <div {...dragProps} key={id}>
            <CollapsibleCard
              id="top-fornecedores"
              title="Top fornecedores"
              icon={<ShoppingCart className="h-4 w-4 text-primary" />}
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
          </div>
        ) : null;

      case "custos-categoria":
        return canSee("top-categorias") ? (
          <div {...dragProps} key={id}>
            <CollapsibleCard
              id="custos-categoria"
              title="Custos por categoria"
              icon={<Target className="h-4 w-4 text-primary" />}
              collapsed={!!collapsed["custos-categoria"]}
              onToggle={toggle}
            >
              <div className="max-h-[320px] overflow-y-auto pr-1.5 space-y-3">
                {custosPorCategoria.length === 0 && (
                  <p className="text-sm text-muted-foreground">Sem dados.</p>
                )}
                {custosPorCategoria.map((f, i) => {
                  const max = custosPorCategoria[0]?.value || 1;
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
          </div>
        ) : null;

      default:
        return null;
    }
  };

  return (
    <AppShell>
      {accessLoading ? (
        <div className="flex h-[50vh] items-center justify-center">
          <div className="text-sm text-muted-foreground animate-pulse">Carregando painel…</div>
        </div>
      ) : (
        <>
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

          {visibleWidgetsCount > 0 ? (
            <>
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

              {/* Draggable Dashboard Grid */}
              <div className="grid gap-4 lg:grid-cols-3">
                {layout.map((id, index) => renderWidget(id, index))}
              </div>
            </>
          ) : (
            <div className="flex flex-col items-center justify-center text-center p-8 mt-10 max-w-xl mx-auto rounded-2xl border border-border/60 bg-card/60 backdrop-blur-sm shadow-xl">
              <div className="h-16 w-16 rounded-2xl bg-primary/10 text-primary flex items-center justify-center mb-6">
                <LayoutDashboard className="h-8 w-8 text-primary" />
              </div>
              <h2 className="text-xl font-bold mb-2">Bem-vindo ao THcontrol!</h2>
              <p className="text-sm text-muted-foreground leading-relaxed">
                Seu painel de controle está vazio no momento. 
                O administrador do sistema pode configurar quais blocos visuais você pode visualizar na tela inicial.
              </p>
              <p className="text-xs text-muted-foreground/80 mt-4">
                Utilize o menu lateral para navegar pelas outras abas autorizadas.
              </p>
            </div>
          )}
        </>
      )}
    </AppShell>
  );
}