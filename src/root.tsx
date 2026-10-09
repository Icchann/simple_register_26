import type { ReactElement, ReactNode } from "react";
import type { Route } from "./+types/root";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { styled as p } from "panda/jsx";
import { useEffect } from "react";
import { Links, Meta, Outlet, Scripts, ScrollRestoration } from "react-router";
import { Expanded } from "./components/atomic/Expanded";
import { Loading } from "./components/Loading";
import { INFO } from "./lib/consts";
import index from "./styles/index.css?url";
import "unfonts.css";

export const links: Route.LinksFunction = () => [
  { rel: "stylesheet", href: index },
];

export function HydrateFallback(): ReactElement {
  return (
    <Expanded basedOn="screen" items="center">
      <Loading>
        <p.p>
          {INFO.name.ja}
          を起動中...
        </p.p>
      </Loading>
    </Expanded>
  );
}

export function Layout({ children }: { children: ReactNode }): ReactElement {
  return (
    <html lang="ja">
      <head>
        <meta charSet="utf-8" />
        <meta content="width=device-width, initial-scale=1" name="viewport" />
        <Meta />
        <Links />
      </head>
      <body>
        {children}
        <ScrollRestoration />
        <Scripts />
      </body>
    </html>
  );
}

export default function (): ReactElement {
  useEffect(() => {
    if (typeof window !== "undefined" && "__TAURI_INTERNALS__" in window) {
      void getCurrentWindow().setFullscreen(true);
    }
  }, []);

  return (
    <Expanded>
      <p.main>
        <Outlet />
      </p.main>
    </Expanded>
  );
}
