import type { ReactElement } from "react";
import { isTauri } from "@tauri-apps/api/core";
import { WebviewWindow } from "@tauri-apps/api/webviewWindow";
import { styled as p, VStack } from "panda/jsx";
import { useState } from "react";

export default function (): ReactElement {
  const [isTauriApp] = useState(() => {
    if (typeof window === "undefined")
      return false;
    return isTauri();
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
  const handleResetData = (): void => {
    // eslint-disable-next-line no-alert
    const confirmed = window.confirm(
      "すべての注文データや設定（localStorage）をリセットしますか？\nこの操作は取り消せません。",
    );
    if (confirmed) {
      localStorage.clear();
      location.reload();
    }
  };

  return (
    <VStack fontSize="2xl" gap="4" p="8">
      {isTauriApp
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
      {/* 誤操作防止のため右下に小さく配置されたデータリセットボタン */}
      <p.button
        _hover={{
          bg: "red.50",
          color: "red.700",
          borderColor: "red.500",
        }}
        bg="transparent"
        borderColor="red.300"
        borderRadius="md"
        borderWidth="1px"
        bottom="4"
        color="red.600"
        cursor="pointer"
        fontSize="xs"
        fontWeight="bold"
        onClick={handleResetData}
        p="2"
        position="fixed"
        right="4"
      >
        !DANGER!: RESET ORDER
      </p.button>
    </VStack>
  );
}
