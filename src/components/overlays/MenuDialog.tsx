import type { ReactElement } from "react";
import { useStore } from "@nanostores/react";
import { css } from "panda/css";
import { HStack, styled as p, VStack } from "panda/jsx";
import { match } from "ts-pattern";
import { Button } from "@/components/atomic/Button";
import { ReceiptNumberInput } from "@/components/overlays/ReceiptNumberInput";
import { changeOrderStatus } from "@/lib/stores/orders";
import { $overlayType } from "@/lib/stores/overlay";
import { setStatusWithTimeout } from "@/lib/stores/status";

export type MenuDialogProps = {
  onClose: () => void;
};

export function MenuDialog({ onClose }: MenuDialogProps): ReactElement {
  const overlayType = useStore($overlayType);

  const { title, bgClassName, icon } = match(overlayType)
    .with("COOKING_COMPLETE", () => ({
      title: "調理完了",
      bgClassName: css({ bg: "amber.400" }),
      icon: <IconMaterialSymbolsPublishedWithChanges />,
    }))
    .with("PICKUP_COMPLETE", () => ({
      title: "受取完了",
      bgClassName: css({ bg: "green.400" }),
      icon: <IconMaterialSymbolsPublishedWithChanges />,
    }))
    .with("ORDER_EDIT", () => ({
      title: "注文修正",
      bgClassName: css({ bg: "blue.400" }),
      icon: null,
    }))
    .with("ITEM_EDIT", () => ({
      title: "商品修正",
      bgClassName: css({ bg: "purple.400" }),
      icon: null,
    }))
    .otherwise(() => ({
      title: "メニュー",
      bgClassName: css({ bg: "gray.400" }),
      icon: null,
    }));

  const handleConfirm = (receiptNumber: number): void => {
    const targetStatus = match(overlayType)
      .with("COOKING_COMPLETE", () => "WAITING_PICKUP" as const)
      .with("PICKUP_COMPLETE", () => "PICKED_UP" as const)
      .otherwise(() => null);

    if (targetStatus === null)
      return;

    const success = changeOrderStatus(receiptNumber, targetStatus);

    if (success) {
      const statusType = match(overlayType)
        .with("COOKING_COMPLETE", () => "COOKING_COMPLETED" as const)
        .with("PICKUP_COMPLETE", () => "PICKUP_COMPLETED" as const)
        .otherwise(() => null);

      if (statusType !== null) {
        setStatusWithTimeout(
          {
            type: statusType,
            receiptNumber,
          },
          3000,
        );
      }

      onClose();
    } else {
      const sourceStatus = match(targetStatus)
        .with("WAITING_PICKUP", () => "WAITING_COOKING" as const)
        .with("PICKED_UP", () => "WAITING_PICKUP" as const)
        .otherwise(() => undefined);

      setStatusWithTimeout(
        {
          type: "INVALID_VALUE",
          detail: {
            type: "RECEIPT_NOT_FOUND",
            receiptNumber,
            ...(sourceStatus ? { status: sourceStatus } : {}),
          },
          receiptNumber: null,
        },
        3000,
      );
    }
  };

  const handleInvalidReceiptNumber = (receiptNumber: number): void => {
    setStatusWithTimeout(
      {
        type: "INVALID_VALUE",
        detail: { type: "RECEIPT_NUMBER", receiptNumber },
        receiptNumber: null,
      },
      3000,
    );
  };

  const showReceiptNumberInput = overlayType === "COOKING_COMPLETE" || overlayType === "PICKUP_COMPLETE";

  return (
    <VStack className={bgClassName} gap="4" h="full" justifyContent="center" p="6" w="full">
      <HStack gap="2">
        {icon}
        <p.h2 fontSize="2xl" fontWeight="bold">
          {title}
        </p.h2>
      </HStack>
      {showReceiptNumberInput
        ? (
            <VStack gap="4" w="full">
              <p.p fontSize="lg" fontWeight="medium">
                受付番号を入力してください
              </p.p>
              <ReceiptNumberInput
                onConfirm={handleConfirm}
                onInvalidReceiptNumber={handleInvalidReceiptNumber}
              />
            </VStack>
          )
        : (
            <>
              <p.p color="gray.700">
                オーバーレイタイプ:
                {" "}
                {overlayType ?? "なし"}
              </p.p>
              <VStack gap="2" w="full">
                <Button onClick={onClose} w="full">
                  閉じる
                </Button>
              </VStack>
            </>
          )}
    </VStack>
  );
}
