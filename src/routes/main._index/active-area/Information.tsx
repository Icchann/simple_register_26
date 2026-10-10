import type { ReactElement } from "react";
import { useStore } from "@nanostores/react";
import { createId } from "@paralleldrive/cuid2";
import { type } from "arktype";
import { Grid, HStack, styled as p, VStack } from "panda/jsx";
import { memo, useEffect, useMemo, useRef, useState } from "react";
import { Expanded } from "@/components/atomic/Expanded";
import { NumberInput } from "@/components/atomic/NumberInput";
import { registerReceiptInput } from "@/lib/focus-manager";
import { ReceiptNumberImpl } from "@/lib/order";
import { setCreatedAt, setOrderId, setReceiptNumber } from "@/lib/stores/current-order";
import { $items, toggleItemSoldOut } from "@/lib/stores/items";
import { $orders } from "@/lib/stores/orders";
import { $orderPhase } from "@/lib/stores/phase";
import { setStatusWithTimeout } from "@/lib/stores/status";
import { MAX_RECEIPT_NUMBER, ReceiptNumber } from "@/types/order";
import { PhaseIndicator } from "./PhaseIndicator";

const ItemInfo = memo((): ReactElement => {
  const item = useStore($items);

  return (
    <VStack alignItems="flex-start" p="1.5" w="full">
      <Grid
        gridTemplateColumns="1fr 1fr 1fr"
        w="full"
      >
        {item.map((it) => (
          <VStack alignItems="flex-start" key={it.id} minW="0" w="full">
            <p.p fontSize="clamp(12px, 1.1vw, 16px)" fontWeight="bold" whiteSpace="nowrap">{it.name}</p.p>
            <VStack alignItems="flex-start" gap="1" minW="0" w="full">
              {
                it.children.map((child) => {
                  const isSoldOut = child.isSoldOut === true;
                  return (
                    <HStack
                      cursor="pointer"
                      gap="1"
                      key={child.id}
                      minW="0"
                      onClick={() => {
                        toggleItemSoldOut(child.id);
                      }}
                      opacity={isSoldOut ? 0.6 : 1}
                      title={isSoldOut ? "売り切れ（クリックで解除）" : "クリックで売り切れ設定"}
                      w="full"
                    >
                      <p.code
                        alignItems="center"
                        aspectRatio="1 / 1"
                        border="1px solid"
                        borderColor={isSoldOut ? "red.400" : undefined}
                        color={isSoldOut ? "red.600" : undefined}
                        display="grid"
                        flexShrink="0"
                        fontSize="clamp(11px, 0.9vw, 13px)"
                        h="7"
                        lineHeight="none"
                        placeItems="center"
                        position="relative"
                        w="7"
                      >
                        <p.span
                          fontSize="[9px]"
                          left="0"
                          p="[1px]"
                          position="absolute"
                          top="0"
                        >
                          T
                        </p.span>
                        {child.itemNumber.toString().padStart(2, "0")}
                      </p.code>
                      <p.div
                        aspectRatio="1 / 1"
                        flexShrink="0"
                        h="7"
                        position="relative"
                        w="7"
                      >
                        <p.img
                          aspectRatio="1 / 1"
                          h="full"
                          objectFit="cover"
                          onError={(e) => {
                            const target = e.currentTarget;
                            if (target.src.endsWith(".jpg")) {
                              target.src = `/images/items/${child.id}.png`;
                            }
                          }}
                          src={`/images/items/${child.id}.jpg`}
                          w="full"
                        />
                        {isSoldOut
                          ? (
                              <p.div
                                alignItems="center"
                                aria-label="売り切れ"
                                display="flex"
                                h="full"
                                inset="0"
                                justifyContent="center"
                                pointerEvents="none"
                                position="absolute"
                                w="full"
                              >
                                <svg
                                  fill="none"
                                  height="100%"
                                  stroke="var(--colors-red-600, #dc2626)"
                                  strokeLinecap="round"
                                  strokeWidth="3.5"
                                  viewBox="0 0 24 24"
                                  width="100%"
                                >
                                  <line x1="4" x2="20" y1="4" y2="20" />
                                  <line x1="20" x2="4" y1="4" y2="20" />
                                </svg>
                              </p.div>
                            )
                          : null}
                      </p.div>
                      <p.p
                        color={isSoldOut ? "red.600" : undefined}
                        fontSize="clamp(10px, 0.85vw, 13px)"
                        overflow="hidden"
                        textDecoration={isSoldOut ? "line-through" : undefined}
                        textOverflow="ellipsis"
                        whiteSpace="nowrap"
                      >
                        {child.name}
                        {isSoldOut ? " (売切)" : ""}
                      </p.p>
                    </HStack>
                  );
                })
              }
            </VStack>
          </VStack>
        ))}
      </Grid>
    </VStack>
  );
});

export function Information(): ReactElement {
  const orders = useStore($orders);
  const orderPhase = useStore($orderPhase);
  const receiptInputRef = useRef<HTMLInputElement>(null);

  // 前回の受付番号+1を提案値として計算（MAX_RECEIPT_NUMBERを超えたら1に戻る）
  const suggestedReceiptNumber = useMemo(() => {
    const lastOrder = orders.at(-1);
    const nextNumber = (lastOrder?.receiptNumber ?? 0) + 1;
    return nextNumber > MAX_RECEIPT_NUMBER ? 1 : nextNumber;
  }, [orders]);

  // ローカル状態で受付番号を管理
  const [localReceiptNumber, setLocalReceiptNumber] = useState<number>(() => suggestedReceiptNumber);
  const prevPhaseRef = useRef<typeof orderPhase>(orderPhase);
  const prevSuggestedRef = useRef<number>(suggestedReceiptNumber);

  useEffect(() => {
    registerReceiptInput(receiptInputRef.current);
    return (): void => {
      registerReceiptInput(null);
    };
  }, []);

  // フェーズが CHECK_RECEIPT_NUMBER に変わったとき、または提案値が変わったときの処理
  if (orderPhase === "CHECK_RECEIPT_NUMBER" && prevPhaseRef.current !== "CHECK_RECEIPT_NUMBER") {
    setLocalReceiptNumber(suggestedReceiptNumber);
    prevSuggestedRef.current = suggestedReceiptNumber;
  } else if (orderPhase === "CHECK_RECEIPT_NUMBER" && prevSuggestedRef.current !== suggestedReceiptNumber) {
    setLocalReceiptNumber(suggestedReceiptNumber);
    prevSuggestedRef.current = suggestedReceiptNumber;
  }
  prevPhaseRef.current = orderPhase;

  // フォーカス処理
  useEffect(() => {
    if (orderPhase === "CHECK_RECEIPT_NUMBER") {
      requestAnimationFrame(() => {
        const input = receiptInputRef.current;
        if (input) {
          input.focus();
          input.select();
        }
      });
    }
  }, [orderPhase]);

  return (
    <Expanded display="flex" flexDir="column" justifyContent="space-between">
      <ItemInfo />
      <VStack
        alignItems="flex-start"
        borderTop="1px solid"
        w="full"
      >
        <HStack gap="2" p="2">
          <p.p fontSize="clamp(12px, 1vw, 15px)" whiteSpace="nowrap">
            受付番号
          </p.p>
          <NumberInput
            disabled={orderPhase !== "CHECK_RECEIPT_NUMBER"}
            h="10"
            onChange={(event) => {
              const value = event.target.value;
              if (value === "") {
                setLocalReceiptNumber(suggestedReceiptNumber);
              } else {
                const receiptNumber = Number.parseInt(value, 10);
                if (!Number.isNaN(receiptNumber)) {
                  setLocalReceiptNumber(receiptNumber);
                }
              }
            }}
            onKeyDown={(event) => {
              if (event.key === "Backspace") {
                event.preventDefault();
                if (event.currentTarget.value !== "") {
                  setLocalReceiptNumber(suggestedReceiptNumber);
                }
                return;
              }

              if (event.key === "Enter") {
                event.preventDefault();
                const receiptValue = event.currentTarget.value.trim();
                if (receiptValue === "")
                  return;

                const receiptNumber = Number.parseInt(receiptValue, 10);
                if (Number.isNaN(receiptNumber))
                  return;

                const validatedReceiptNumber = ReceiptNumber(receiptNumber);
                if (validatedReceiptNumber instanceof type.errors) {
                  event.currentTarget.select();
                  setStatusWithTimeout(
                    {
                      type: "INVALID_VALUE",
                      detail: { type: "RECEIPT_NUMBER", receiptNumber },
                      receiptNumber: null,
                    },
                  );
                  return;
                } // orderId を生成して currentOrder に保存 (Enter時のみ)
                // $orders への追加は注文確定時 (AmountSection.handleConfirm) まで待つ
                const now = new Date().toISOString();
                const orderId = createId();
                setOrderId(orderId);
                setReceiptNumber(validatedReceiptNumber);
                setCreatedAt(now); // 受付番号発行時刻を記録

                $orderPhase.set("SELECT_ITEMS");
              }
            }}
            onKeyUp={(event) => {
              if (event.key === "Backspace") {
                event.preventDefault();
                requestAnimationFrame(() => {
                  const input = receiptInputRef.current;
                  input?.focus();
                  input?.select();
                });
              }
            }}
            outline={{
              base: "2px solid",
              _focus: "4px solid",
            }}
            outlineColor="black"
            ref={receiptInputRef}
            textAlign="center"
            value={ReceiptNumberImpl(localReceiptNumber).toStr()}
            w="10"
          />
          {suggestedReceiptNumber !== localReceiptNumber
            ? (
                <HStack color="yellow.600" fontSize="clamp(10px, 0.8vw, 12px)" fontWeight="bold" gap="1" whiteSpace="nowrap">
                  <IconMaterialSymbolsWarning />
                  受付番号の変更アリ (未連続)
                </HStack>
              )
            : null}
        </HStack>
        <PhaseIndicator />
      </VStack>
    </Expanded>
  );
}
