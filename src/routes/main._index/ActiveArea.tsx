import type { ReactElement } from "react";
import type { DialogRef } from "@/components/atomic/Dialog";
import type { Nullable } from "@/types/utils";
import { css } from "panda/css";
import { useEffect, useRef } from "react";
import { match } from "ts-pattern";
import { Dialog } from "@/components/atomic/Dialog";
import { Expanded } from "@/components/atomic/Expanded";
import { MenuDialog } from "@/components/overlays/MenuDialog";
import { focusReceiptInput } from "@/lib/focus-manager";
import { $currentOrder, resetCurrentOrder } from "@/lib/stores/current-order";
import { $overlayType, closeOverlay, showOverlay } from "@/lib/stores/overlay";
import { $orderPhase } from "@/lib/stores/phase";
import { $status, setStatusWithTimeout } from "@/lib/stores/status";
import { AmountSection } from "./active-area/AmountSection";
import { Information } from "./active-area/Information";
import { OrderTable } from "./active-area/OrderTable";

function LeftArea(): ReactElement {
  return (
    <Expanded minH="0" minW="0" overflow="hidden">
      <Information />
    </Expanded>
  );
}

function MiddleArea(): ReactElement {
  return (
    <Expanded minH="0" minW="0" overflowY="auto">
      <OrderTable />
    </Expanded>
  );
}

function RightArea(): ReactElement {
  return (
    <Expanded minH="0" minW="0" overflow="hidden">
      <AmountSection />
    </Expanded>
  );
}

export function ActiveArea(): ReactElement {
  const timerRef = useRef<number | undefined>(undefined);
  const progressIntervalRef = useRef<number | undefined>(undefined);
  const statusClearTimerRef = useRef<number | undefined>(undefined);
  const longPressTriggeredRef = useRef(false);
  const resetCompletedRef = useRef(false);
  const startTimeRef = useRef<number>(0);
  const menuDialogRef = useRef<DialogRef>(null);

  // テンキーでオーバーレイを表示/切り替え/閉じる
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent): void => {
      const overlayType = match(event)
        .with({ key: "/" }, { keyCode: 111 }, () => "COOKING_COMPLETE" as const)
        .with({ key: "*" }, () => "PICKUP_COMPLETE" as const)
        .with({ key: "-" }, () => "ORDER_EDIT" as const)
        .with({ key: "+" }, () => "ITEM_EDIT" as const)
        .otherwise(() => null);

      if (overlayType !== null) {
        event.preventDefault();
        event.stopPropagation();
        event.stopImmediatePropagation();

        const currentOverlayType = $overlayType.get();

        // 同じキーが押された場合は閉じる
        if (currentOverlayType === overlayType) {
          menuDialogRef.current?.close();
          closeOverlay();
        } else {
          // 別のオーバーレイが開いている場合は一旦閉じてから新しいものを開く
          if (currentOverlayType !== null) {
            menuDialogRef.current?.close();
            closeOverlay();
          }
          showOverlay(overlayType);
          menuDialogRef.current?.showModal();
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown, { capture: true });

    return (): void => {
      window.removeEventListener("keydown", handleKeyDown, { capture: true });
    };
  }, []);

  useEffect(() => {
    const LONG_PRESS_DURATION = 2000; // ms

    const clearTimer = (): void => {
      if (timerRef.current != null) {
        window.clearTimeout(timerRef.current);
        timerRef.current = undefined;
      }
    };

    const clearProgressInterval = (): void => {
      if (progressIntervalRef.current != null) {
        window.clearInterval(progressIntervalRef.current);
        progressIntervalRef.current = undefined;
      }
    };

    const clearStatusTimer = (): void => {
      if (statusClearTimerRef.current != null) {
        window.clearTimeout(statusClearTimerRef.current);
        statusClearTimerRef.current = undefined;
      }
    };

    const updateProgress = (): void => {
      const elapsed = Date.now() - startTimeRef.current;
      const progress = Math.min(1, elapsed / LONG_PRESS_DURATION);
      const receiptNumber = $currentOrder.get().receiptNumber;
      setStatusWithTimeout({ type: "RESET_PROGRESS", progress, receiptNumber }, 0);
    };

    const triggerReset = (receiptNumber: Nullable<number>): void => {
      if (longPressTriggeredRef.current) {
        return;
      }
      longPressTriggeredRef.current = true;
      resetCompletedRef.current = true;
      clearProgressInterval();
      resetCurrentOrder();
      $orderPhase.set("CHECK_RECEIPT_NUMBER");
      requestAnimationFrame(() => {
        focusReceiptInput();
      });
      setStatusWithTimeout({ type: "RESET", receiptNumber }, 1000);
      statusClearTimerRef.current = window.setTimeout(() => {
        resetCompletedRef.current = false;
      }, 1000);
    };

    const handleKeyDown = (keyboardEvent: KeyboardEvent): void => {
      if (keyboardEvent.key !== "Backspace")
        return;

      // 長押しリセットがトリガー済みなら全てブロック
      if (longPressTriggeredRef.current) {
        keyboardEvent.preventDefault();
        keyboardEvent.stopPropagation();
        keyboardEvent.stopImmediatePropagation();
        return;
      }

      // repeat（連打・長押し継続）なら通常処理をブロックしタイマーのみ継続
      if (keyboardEvent.repeat) {
        keyboardEvent.preventDefault();
        keyboardEvent.stopPropagation();
        keyboardEvent.stopImmediatePropagation();
        return;
      }

      // 初回押下時のみタイマー開始
      clearTimer();
      clearProgressInterval();
      startTimeRef.current = Date.now();
      const receiptNumber = $currentOrder.get().receiptNumber;
      updateProgress();

      // リセットタイマー
      timerRef.current = window.setTimeout(() => {
        triggerReset(receiptNumber);
        clearTimer();
      }, LONG_PRESS_DURATION);

      // 進捗更新タイマー
      progressIntervalRef.current = window.setInterval(() => {
        updateProgress();
      }, 50);
    };

    const handleKeyUp = (keyboardEvent: KeyboardEvent): void => {
      if (keyboardEvent.key !== "Backspace")
        return;
      longPressTriggeredRef.current = false;
      clearTimer();
      clearProgressInterval();

      // リセットが完了している場合は、statusClearTimerに任せる（keyupでクリアしない）
      if (!resetCompletedRef.current) {
        $status.set(null);
      }
    };

    window.addEventListener("keydown", handleKeyDown, { capture: true });
    window.addEventListener("keyup", handleKeyUp, { capture: true });

    return (): void => {
      window.removeEventListener("keydown", handleKeyDown, { capture: true });
      window.removeEventListener("keyup", handleKeyUp, { capture: true });
      clearTimer();
      clearProgressInterval();
      clearStatusTimer();
      longPressTriggeredRef.current = false;
      resetCompletedRef.current = false;
      $status.set(null);
    };
  }, []);

  return (
    <Expanded
      className={css({
        "& > *": {
          outline: "1px solid",
          outlineColor: "gray.200",
        },
      })}
      display="grid"
      gridTemplateColumns="minmax(280px, 4fr) minmax(380px, 4fr) minmax(300px, 3fr)"
      minH="0"
      overflow="hidden"
      position="relative"
    >
      <LeftArea />
      <MiddleArea />
      <RightArea />
      <Dialog
        onClose={() => {
          closeOverlay();
        }}
        ref={menuDialogRef}
      >
        <MenuDialog
          onClose={() => {
            menuDialogRef.current?.close();
            closeOverlay();
          }}
        />
      </Dialog>
    </Expanded>
  );
}
