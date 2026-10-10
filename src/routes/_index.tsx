import type { ReactElement } from "react";
import { useStore } from "@nanostores/react";
import { isTauri } from "@tauri-apps/api/core";
import { WebviewWindow } from "@tauri-apps/api/webviewWindow";
import { HStack, styled as p, VStack } from "panda/jsx";
import { useMemo, useState } from "react";
import {
  buildAccountingRows,
  buildItemDetailRows,
  createCsvBlob,
  matrixToCsv,
  matrixToTsv,
} from "@/lib/export/spreadsheet";
import { $soldOutItemIds, resetAllSoldOutItems } from "@/lib/stores/items";
import { $orders } from "@/lib/stores/orders";

export default function (): ReactElement {
  const [isTauriApp] = useState(() => {
    if (typeof window === "undefined")
      return false;
    return isTauri();
  });
  const orders = useStore($orders);
  const soldOutItemIds = useStore($soldOutItemIds);
  const [exportFeedback, setExportFeedback] = useState<string | null>(null);
  const [resetFeedback, setResetFeedback] = useState<string | null>(null);

  const accountingSummary = useMemo(() => {
    let effectiveCount = 0;
    let totalSales = 0;
    for (const o of orders) {
      if (["PICKED_UP", "WAITING_PICKUP", "WAITING_COOKING"].includes(o.status)) {
        effectiveCount++;
        let subtotal = 0;
        let discount = 0;
        for (const item of o.items) {
          subtotal += item.price * item.amount;
          if (o.appliedDiscount?.amount != null) {
            discount += (o.appliedDiscount.amount[item.id] ?? 0) * item.amount;
          }
        }
        totalSales += Math.max(0, subtotal - discount);
      }
    }
    return {
      totalOrders: orders.length,
      effectiveCount,
      totalSales,
    };
  }, [orders]);

  const handleCopyTsv = async (mode: "accounting" | "full"): Promise<void> => {
    try {
      const rows = mode === "accounting"
        ? buildAccountingRows(orders)
        : buildItemDetailRows(orders);
      const tsv = matrixToTsv(rows);
      await navigator.clipboard.writeText(tsv);
      setExportFeedback(
        mode === "accounting"
          ? "📋 会計用データをコピーしました！スプレッドシートで Ctrl+V (Cmd+V) で貼り付けできます"
          : "📋 全売上データをコピーしました！スプレッドシートで Ctrl+V (Cmd+V) で貼り付けできます",
      );
      setTimeout(() => {
        setExportFeedback(null);
      }, 4000);
    } catch (e) {
      // eslint-disable-next-line no-alert
      window.alert(`クリップボードへのコピーに失敗しました: ${String(e)}`);
    }
  };

  const handleDownloadCsv = (mode: "accounting" | "full"): void => {
    const rows = mode === "accounting"
      ? buildAccountingRows(orders)
      : buildItemDetailRows(orders);
    const csv = matrixToCsv(rows);
    const blob = createCsvBlob(csv);
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, "");
    a.href = url;
    a.download = mode === "accounting"
      ? `register_accounting_${dateStr}.csv`
      : `register_full_sales_${dateStr}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleResetSoldOut = (): void => {
    resetAllSoldOutItems();
    setResetFeedback("すべての売り切れを解除しました（全商品が販売中）");
    setTimeout(() => {
      setResetFeedback(null);
    }, 3000);
  };
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

      {/* スプレッドシート / データ出力エリア */}
      <VStack
        alignItems="stretch"
        bg="white"
        borderColor="gray.300"
        borderRadius="xl"
        borderWidth="2px"
        boxShadow="sm"
        gap="4"
        maxW="850px"
        p="6"
        w="full"
      >
        <HStack justifyContent="space-between" w="full">
          <p.h2 fontSize="xl" fontWeight="bold">
            📊 スプレッドシート出力
          </p.h2>
          <p.span color="gray.600" fontSize="sm" fontWeight="bold">
            {`注文: ${accountingSummary.totalOrders}件 (有効: ${accountingSummary.effectiveCount}件 / 売上: ¥${accountingSummary.totalSales.toLocaleString()})`}
          </p.span>
        </HStack>

        {exportFeedback != null && (
          <p.div
            bg="green.100"
            borderColor="green.400"
            borderRadius="md"
            borderWidth="1px"
            color="green.900"
            fontSize="sm"
            fontWeight="bold"
            p="3"
            textAlign="center"
          >
            {exportFeedback}
          </p.div>
        )}

        {/* 【会計用】セクション */}
        <VStack
          alignItems="stretch"
          bg="emerald.50"
          borderColor="emerald.500"
          borderRadius="lg"
          borderWidth="2px"
          gap="2"
          p="4"
        >
          <HStack alignItems="baseline" gap="2">
            <p.span color="emerald.900" fontSize="lg" fontWeight="bold">
              💰 会計・レジ締め用
            </p.span>
            <p.span color="emerald.700" fontSize="xs">
              （調理時間や味など余計な情報を除去し、金額・預かり・お釣りのみを出力）
            </p.span>
          </HStack>
          <HStack gap="3">
            <p.button
              _hover={{ bg: "emerald.700" }}
              bg="emerald.600"
              borderRadius="md"
              color="white"
              cursor="pointer"
              flex="1"
              fontSize="md"
              fontWeight="bold"
              onClick={() => {
                void handleCopyTsv("accounting");
              }}
              py="3"
            >
              📋 会計用データをコピー (TSV)（会計用）
            </p.button>
            <p.button
              _hover={{ bg: "emerald.100" }}
              bg="white"
              borderColor="emerald.600"
              borderRadius="md"
              borderWidth="1px"
              color="emerald.800"
              cursor="pointer"
              fontSize="sm"
              fontWeight="bold"
              onClick={() => {
                handleDownloadCsv("accounting");
              }}
              px="4"
              py="3"
            >
              💾 会計用 CSV を保存（会計用）
            </p.button>
          </HStack>
        </VStack>

        {/* 【全売上データ】セクション */}
        <VStack
          alignItems="stretch"
          bg="gray.50"
          borderColor="gray.300"
          borderRadius="lg"
          borderWidth="1px"
          gap="2"
          p="3"
        >
          <HStack alignItems="baseline" gap="2">
            <p.span color="gray.800" fontSize="sm" fontWeight="bold">
              📦 全売上データ（詳細・分析用）
            </p.span>
            <p.span color="gray.600" fontSize="xs">
              （商品名・味・トッピング・グループ・調理所要時間を含むフルデータ）
            </p.span>
          </HStack>
          <HStack gap="3">
            <p.button
              _hover={{ bg: "gray.700" }}
              bg="gray.600"
              borderRadius="md"
              color="white"
              cursor="pointer"
              flex="1"
              fontSize="sm"
              fontWeight="bold"
              onClick={() => {
                void handleCopyTsv("full");
              }}
              py="2"
            >
              📋 全売上データをコピー (TSV)
            </p.button>
            <p.button
              _hover={{ bg: "gray.200" }}
              bg="white"
              borderColor="gray.400"
              borderRadius="md"
              borderWidth="1px"
              color="gray.700"
              cursor="pointer"
              fontSize="xs"
              fontWeight="bold"
              onClick={() => {
                handleDownloadCsv("full");
              }}
              px="3"
              py="2"
            >
              💾 全売上 CSV を保存
            </p.button>
          </HStack>
        </VStack>
      </VStack>

      {/* 次の日用 売り切れ状態リセット */}
      <VStack
        alignItems="center"
        bg={soldOutItemIds.length > 0 ? "amber.50" : "gray.50"}
        borderColor={soldOutItemIds.length > 0 ? "amber.300" : "gray.200"}
        borderRadius="lg"
        borderWidth="1px"
        gap="2"
        mt="4"
        p="4"
      >
        <HStack fontSize="sm" gap="3">
          <p.span color="gray.700" fontWeight="bold">
            売り切れ状態:
          </p.span>
          <p.span
            color={soldOutItemIds.length > 0 ? "red.600" : "green.700"}
            fontWeight="bold"
          >
            {soldOutItemIds.length > 0
              ? `${soldOutItemIds.length}品目が売り切れ中`
              : "全商品が販売中（売り切れなし）"}
          </p.span>
        </HStack>
        {soldOutItemIds.length > 0 && (
          <p.button
            _hover={{ bg: "amber.600" }}
            bg="amber.500"
            borderRadius="md"
            color="white"
            cursor="pointer"
            fontSize="sm"
            fontWeight="bold"
            onClick={handleResetSoldOut}
            px="4"
            py="2"
          >
            次の日用に売り切れを一括リセット（全商品を販売中に戻す）
          </p.button>
        )}
        {resetFeedback != null && (
          <p.span color="green.700" fontSize="xs" fontWeight="bold">
            {resetFeedback}
          </p.span>
        )}
      </VStack>
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
