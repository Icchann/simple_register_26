import type { ReactElement, ReactNode } from "react";
import type { Route } from "./+types/root";
import { getCurrentWebview } from "@tauri-apps/api/webview";
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

  useEffect(() => {
    let currentZoom = 1.0;

    const handleKeyDown = (e: KeyboardEvent): void => {
      if (!e.ctrlKey && !e.metaKey)
        return;

      if (e.key === "+" || e.key === "=" || e.key === ";") {
        e.preventDefault();
        currentZoom = Math.min(1.8, Math.round((currentZoom + 0.1) * 10) / 10);
      } else if (e.key === "-" || e.key === "_") {
        e.preventDefault();
        currentZoom = Math.max(0.6, Math.round((currentZoom - 0.1) * 10) / 10);
      } else if (e.key === "0") {
        e.preventDefault();
        currentZoom = 1.0;
      } else {
        return;
      }

      if (typeof window !== "undefined" && "__TAURI_INTERNALS__" in window) {
        getCurrentWebview().setZoom(currentZoom).catch(() => {
          document.documentElement.style.zoom = String(currentZoom);
        });
      } else {
        document.documentElement.style.zoom = String(currentZoom);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return (): void => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, []);
  return (
    <Expanded>
      <p.main>
        <Outlet />
      </p.main>
    </Expanded>
  );
}
