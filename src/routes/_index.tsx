import type { ReactElement } from "react";
import { isTauri } from "@tauri-apps/api/core";
import { WebviewWindow } from "@tauri-apps/api/webviewWindow";
import { styled as p, VStack } from "panda/jsx";
import { useState } from "react";

export default function (): ReactElement {
  const [isWindowsTauri] = useState(() => {
    if (typeof window === "undefined")
      return false;
    const isWin = typeof navigator !== "undefined" && /Windows/i.test(navigator.userAgent);
    return isTauri() && isWin;
  });

  const handleOpenAllScreens = (): void => {
    const screens = [
      { label: "main-window", title: "メインレジ", url: "/main" },
      { label: "order-queue-window", title: "調理キュー", url: "/order-queue" },
      { label: "pickup-monitor-window", title: "受取モニター", url: "/pickup-monitor" },
    ];

    screens.forEach(({ label, title, url }) => {
      try {
        if (isTauri()) {
          const webview = new WebviewWindow(label, {
            url,
            title,
            width: 1280,
            height: 800,
          });
          void webview.once("tauri://error", () => {
            window.open(url, "_blank");
          });
        } else {
          window.open(url, "_blank");
        }
      } catch {
        window.open(url, "_blank");
      }
    });
  };

  return (
    <VStack fontSize="2xl" gap="4" p="8">
      {isWindowsTauri
        ? (
            <p.button
              cursor="pointer"
              fontSize="2xl"
              fontWeight="bold"
              onClick={handleOpenAllScreens}
            >
              3画面を同時に開く (main / order-queue / pickup-monitor)
            </p.button>
          )
        : (
            <>
              <p.a href="/main">main</p.a>
              <p.a href="/order-queue">order-queue</p.a>
              <p.a href="/pickup-monitor">pickup-monitor</p.a>
            </>
          )}
      <p.p
        cursor="pointer"
        onClick={() => {
          localStorage.clear();
          location.reload();
        }}
      >
        !DANGER!: RESET ORDER
      </p.p>
    </VStack>
  );
}
