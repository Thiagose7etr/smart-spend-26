import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  Outlet,
  Link,
  createRootRouteWithContext,
  useRouter,
  HeadContent,
  Scripts,
} from "@tanstack/react-router";
import { useEffect, type ReactNode } from "react";

import appCss from "../styles.css?url";
import { reportLovableError } from "../lib/lovable-error-reporting";
import { Toaster } from "sonner";
import thcLogo from "../assets/thc-logo.jpg.asset.json";

function NotFoundComponent() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-7xl font-bold text-foreground">404</h1>
        <h2 className="mt-4 text-xl font-semibold text-foreground">Página não encontrada</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          A página que você está procurando não existe ou foi movida.
        </p>
        <div className="mt-6">
          <Link
            to="/"
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Voltar ao início
          </Link>
        </div>
      </div>
    </div>
  );
}

function ErrorComponent({ error, reset }: { error: Error; reset: () => void }) {
  console.error(error);
  const router = useRouter();
  useEffect(() => {
    reportLovableError(error, { boundary: "tanstack_root_error_component" });
  }, [error]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-xl w-full text-center space-y-4">
        <h1 className="text-2xl font-bold tracking-tight text-foreground">
          Esta página não carregou
        </h1>
        <p className="text-sm text-muted-foreground">
          Ocorreu um erro inesperado no aplicativo. Veja os detalhes técnicos abaixo:
        </p>

        <div className="text-left bg-destructive/10 border border-destructive/20 text-destructive-foreground rounded-lg p-4 font-mono text-xs overflow-auto max-h-60">
          <p className="font-semibold text-red-400">{error?.name}: {error?.message}</p>
          <p className="mt-2 whitespace-pre-wrap text-muted-foreground/80">{error?.stack}</p>
        </div>

        <div className="mt-6 flex flex-wrap justify-center gap-2 pt-2">
          <button
            onClick={() => {
              router.invalidate();
              reset();
            }}
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Tente novamente
          </button>
          <a
            href="/"
            className="inline-flex items-center justify-center rounded-md border border-input bg-background px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-accent"
          >
            Ir para casa
          </a>
        </div>
      </div>
    </div>
  );
}

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: "THcontrol — Controle de Compras e Frota" },
      {
        name: "description",
        content:
          "App profissional de controle mensal de compras, metas por categoria, frota, combustível e guincho.",
      },
      { name: "author", content: "THcontrol" },
      { property: "og:title", content: "THcontrol — Controle de Compras e Frota" },
      {
        property: "og:description",
        content:
          "Dashboard financeiro, metas x realizado, gestão de frota e combustível em um só lugar.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:title", content: "THcontrol — Controle de Compras e Frota" },
      { name: "description", content: "App profissional de controle mensal de compras, metas por categoria, frota, combustível e guincho." },
      { property: "og:description", content: "App profissional de controle mensal de compras, metas por categoria, frota, combustível e guincho." },
      { name: "twitter:description", content: "App profissional de controle mensal de compras, metas por categoria, frota, combustível e guincho." },
      { property: "og:image", content: "https://pub-bb2e103a32db4e198524a2e9ed8f35b4.r2.dev/2c9f1d67-e872-43fb-b8f0-fcecfe9ccf4f/id-preview-f8458b08--ff92b845-1c04-49d4-97b3-0fcb17c34875.lovable.app-1783107550899.png" },
      { name: "twitter:image", content: "https://pub-bb2e103a32db4e198524a2e9ed8f35b4.r2.dev/2c9f1d67-e872-43fb-b8f0-fcecfe9ccf4f/id-preview-f8458b08--ff92b845-1c04-49d4-97b3-0fcb17c34875.lovable.app-1783107550899.png" },
    ],
    links: [
      {
        rel: "stylesheet",
        href: appCss,
      },
      { rel: "icon", href: thcLogo.url, type: "image/jpeg" },
      { rel: "apple-touch-icon", href: thcLogo.url },
    ],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
  errorComponent: ErrorComponent,
});

import { useTheme } from "../hooks/use-theme";

function RootShell({ children }: { children: ReactNode }) {
  return (
    <html lang="pt-BR">
      <head>
        <HeadContent />
        <script
          dangerouslySetInnerHTML={{
            __html: `
              try {
                const t = localStorage.getItem('theme') || 'dark';
                if (t === 'dark') document.documentElement.classList.add('dark');
                else document.documentElement.classList.remove('dark');
              } catch (e) {}
            `,
          }}
        />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  );
}

function RootComponent() {
  const { queryClient } = Route.useRouteContext();
  const { theme } = useTheme();

  return (
    <QueryClientProvider client={queryClient}>
      {/* Required: nested routes render here. Removing <Outlet /> breaks all child routes. */}
      <Outlet />
      <Toaster theme={theme} position="top-right" richColors closeButton />
    </QueryClientProvider>
  );
}
