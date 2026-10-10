import type { ReactElement } from "react";
import { useStore } from "@nanostores/react";
import { css } from "panda/css";
import { Grid, HStack, styled as p, VStack } from "panda/jsx";
import { match } from "ts-pattern";
import { Button } from "@/components/atomic/Button";
import { NumberInput } from "@/components/atomic/NumberInput";
import { ReceiptNumberInput } from "@/components/overlays/ReceiptNumberInput";
import { $items, toggleItemSoldOut, toggleItemSoldOutByNumber } from "@/lib/stores/items";
import { changeOrderStatus } from "@/lib/stores/orders";
import { $overlayType } from "@/lib/stores/overlay";
import { setStatusWithTimeout } from "@/lib/stores/status";

export type MenuDialogProps = {
  onClose: () => void;
};

export function MenuDialog({ onClose }: MenuDialogProps): ReactElement {
  const overlayType = useStore($overlayType);
  const items = useStore($items);

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
              <p.p color="gray.800" fontSize="sm" fontWeight="medium">
                もう一度同じボタンを押すと戻ります
              </p.p>
            </VStack>
          )
        : overlayType === "ITEM_EDIT"
          ? (
              <VStack gap="3" maxH="80vh" w="full">
                <p.p fontSize="sm" fontWeight="medium">
                  クリックまたは商品番号を入力して売り切れ状態（✕）を切り替えます
                </p.p>
                <HStack gap="2">
                  <p.span fontSize="sm" fontWeight="bold">商品番号:</p.span>
                  <NumberInput
                    autoFocus
                    h="9"
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        const val = Number.parseInt(e.currentTarget.value, 10);
                        if (!Number.isNaN(val)) {
                          toggleItemSoldOutByNumber(val);
                          e.currentTarget.value = "";
                        }
                      }
                    }}
                    outline={{
                      base: "2px solid",
                      _focus: "3px solid",
                    }}
                    outlineColor="black"
                    textAlign="center"
                    w="16"
                  />
                  <p.span color="gray.700" fontSize="xs">
                    (番号入力後 Enter)
                  </p.span>
                </HStack>
                <VStack
                  bg="white/70"
                  borderColor="gray.400"
                  borderRadius="md"
                  borderWidth="1px"
                  gap="3"
                  maxH="45vh"
                  overflowY="auto"
                  p="3"
                  w="full"
                >
                  {items.map((group) => (
                    <VStack alignItems="flex-start" gap="1" key={group.id} w="full">
                      <p.p color="gray.800" fontSize="xs" fontWeight="bold">
                        {group.name}
                      </p.p>
                      <Grid gap="1.5" gridTemplateColumns="repeat(2, 1fr)" w="full">
                        {group.children.map((child) => {
                          const isSoldOut = child.isSoldOut === true;
                          return (
                            <HStack
                              bg={isSoldOut ? "red.100" : "white"}
                              borderColor={isSoldOut ? "red.400" : "gray.300"}
                              borderRadius="sm"
                              borderWidth="1px"
                              cursor="pointer"
                              fontSize="xs"
                              justifyContent="space-between"
                              key={child.id}
                              onClick={() => {
                                toggleItemSoldOut(child.id);
                              }}
                              px="2"
                              py="1.5"
                            >
                              <HStack gap="1.5">
                                <p.code
                                  bg="gray.800"
                                  borderRadius="sm"
                                  color="white"
                                  fontSize="[10px]"
                                  px="1"
                                >
                                  {child.itemNumber.toString().padStart(2, "0")}
                                </p.code>
                                <p.span
                                  color={isSoldOut ? "red.800" : "gray.900"}
                                  fontWeight="medium"
                                  textDecoration={isSoldOut ? "line-through" : undefined}
                                >
                                  {child.name}
                                </p.span>
                              </HStack>
                              <p.span
                                bg={isSoldOut ? "red.600" : "green.600"}
                                borderRadius="sm"
                                color="white"
                                fontSize="[10px]"
                                fontWeight="bold"
                                px="1.5"
                                py="0.5"
                              >
                                {isSoldOut ? "✕ 売り切れ" : "販売中"}
                              </p.span>
                            </HStack>
                          );
                        })}
                      </Grid>
                    </VStack>
                  ))}
                </VStack>
                <p.p color="gray.800" fontSize="sm" fontWeight="medium">
                  もう一度同じボタンを押すと戻ります
                </p.p>
                <Button onClick={onClose} size="sm" w="48">
                  閉じる
                </Button>
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
