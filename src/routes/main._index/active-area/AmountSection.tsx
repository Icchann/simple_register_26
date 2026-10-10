import type { ReactElement } from "react";
import { useStore } from "@nanostores/react";
import { HStack, styled as p, VStack } from "panda/jsx";
import { useEffect, useMemo, useRef, useState } from "react";
import { Button } from "@/components/atomic/Button";
import { NumberInput } from "@/components/atomic/NumberInput";
import { Table } from "@/components/atomic/Table";
import { wrapValidation } from "@/lib/arktype";
import { focusOrderLastRowProduct, focusReceiptInput } from "@/lib/focus-manager";
import { orderRequiresCooking } from "@/lib/order";
import {
  $currentOrder,
  $depositAmount,
  $discountCode,
  $filledOrderRows,
  findDiscountByNumber,
  findItemByNumber,
  getNormalizedCurrentOrderItems,
  resetCurrentOrder,
  setDepositAmount,
  setDiscountCode,
} from "@/lib/stores/current-order";
import { $discounts } from "@/lib/stores/discounts";
import { $lastConfirmedOrderId, $orders } from "@/lib/stores/orders";
import { $orderPhase } from "@/lib/stores/phase";
import { setStatusWithTimeout } from "@/lib/stores/status";
import { Discount, DiscountNumber, ItemNumber } from "@/types/item";
import { Order } from "@/types/order";

const TableBodyRow = p("tr", {
  base: {
    "& > :first-child": {
      textAlign: "right",
      verticalAlign: "middle",
    },
    "& > td": {
      fontFamily: "sans",
      fontWeight: "bold",
    },
    "& > td > :last-child": {
      pr: "2",
    },
  },
});

export function AmountSection(): ReactElement {
  const currentOrder = useStore($currentOrder);
  const orderId = currentOrder.orderId;
  const receiptNumber = currentOrder.receiptNumber;
  const createdAt = currentOrder.createdAt;
  const discountCode = useStore($discountCode);
  const depositAmount = useStore($depositAmount);
  const filledRows = useStore($filledOrderRows);
  const orderPhase = useStore($orderPhase);
  const discounts = useStore($discounts);
  type RightStep = "DISCOUNT" | "DEPOSIT" | "CONFIRM";
  const [rightStep, setRightStep] = useState<RightStep>("DISCOUNT");

  // 割引情報の取得
  const discountInfo = useMemo(() => {
    const discountNumber = wrapValidation(
      DiscountNumber(Number.parseInt(discountCode, 10)),
    ).unwrapOr(null);
    return discountNumber != null
      ? findDiscountByNumber(discountNumber)
      : null;
  }, [discountCode]);

  // 合計金額と割引額の計算
  const { totalDiscount, total } = useMemo(() => {
    let subtotalAmount = 0;
    let totalDiscountAmount = 0;

    for (const row of filledRows) {
      const itemNumber = wrapValidation(
        ItemNumber(Number.parseInt(row.productCode, 10)),
      ).unwrapOr(null);
      if (itemNumber == null)
        continue;

      const item = findItemByNumber(itemNumber);
      if (!item)
        continue;

      const quantity = Number.parseInt(row.quantity || "1", 10);
      subtotalAmount += item.price * quantity;

      if (discountInfo) {
        const discountAmount = discountInfo.amount[item.id] ?? 0;
        totalDiscountAmount += discountAmount * quantity;
      }
    }

    return {
      subtotal: subtotalAmount,
      totalDiscount: totalDiscountAmount,
      total: subtotalAmount - totalDiscountAmount,
    };
  }, [filledRows, discountInfo]);

  const change = useMemo(() => {
    // カンマを除去してから数値に変換
    const cleanedDeposit = (depositAmount || "0").replace(/,/g, "");
    const depositNumber = Number.parseInt(cleanedDeposit, 10);
    return Math.max(0, depositNumber - total);
  }, [depositAmount, total]);

  // 預かり金額の表示用フォーマット（カンマ区切り）
  const depositAmountDisplay = useMemo(() => {
    if (depositAmount === "") {
      return "";
    }
    const num = Number.parseInt(depositAmount, 10);
    if (Number.isNaN(num)) {
      return depositAmount;
    }
    return num.toLocaleString("ja-JP");
  }, [depositAmount]);

  const discountInputRef = useRef<HTMLInputElement>(null);
  const depositInputRef = useRef<HTMLInputElement>(null);
  const confirmButtonRef = useRef<HTMLButtonElement>(null);
  const dotPressedRef = useRef(false);

  useEffect(() => {
    dotPressedRef.current = false;
    let nextStep: RightStep = "DISCOUNT";
    if (orderPhase === "PROCESS_PAYMENT") {
      nextStep = rightStep === "CONFIRM" ? "CONFIRM" : "DEPOSIT";
    } else if (orderPhase === "CHECK_DISCOUNT") {
      nextStep = "DISCOUNT";
    }
    if (nextStep !== rightStep) {
      // eslint-disable-next-line react-hooks-extra/no-direct-set-state-in-use-effect
      setRightStep(nextStep);
    }
  }, [orderPhase, rightStep]);

  useEffect(() => {
    if (orderPhase === "CHECK_DISCOUNT" && rightStep === "DISCOUNT") {
      const input = discountInputRef.current;
      if (input) {
        input.focus();
        input.select();
      }
    }
  }, [orderPhase, rightStep]);

  useEffect(() => {
    if (orderPhase === "PROCESS_PAYMENT" && rightStep === "DEPOSIT") {
      const input = depositInputRef.current;
      if (input) {
        input.focus();
        input.select();
      }
    }
  }, [orderPhase, rightStep]);

  useEffect(() => {
    if (rightStep === "CONFIRM") {
      confirmButtonRef.current?.focus();
    }
  }, [rightStep]);

  const handleConfirm = (): void => {
    const now = new Date().toISOString();

    // 注文アイテムを構築（正規化済み: 同じ商品をまとめる）
    const normalizedItems = getNormalizedCurrentOrderItems(filledRows);
    const activeItems = normalizedItems.filter((item) => item.amount > 0);
    if (activeItems.length === 0) {
      return;
    }

    const soldOutItem = activeItems.find((it) => it.isSoldOut === true);
    if (soldOutItem) {
      setStatusWithTimeout({
        type: "INVALID_VALUE",
        detail: { type: "ITEM_SOLD_OUT", itemName: soldOutItem.name },
        receiptNumber,
      });
      return;
    }

    const orderItems: Array<Order["items"][number]> = activeItems.map((item) => ({
      id: item.id,
      name: item.name,
      price: item.price,
      amount: item.amount,
      ...(item.flavors && item.flavors.length > 0 ? { flavors: item.flavors } : {}),
    }));

    // 新しい注文を作成して $orders に追加
    if (orderId != null && receiptNumber != null && createdAt != null) {
      const currentOrders = $orders.get();

      // 預かり金額を数値に変換
      const cleanedDeposit = (depositAmount || "0").replace(/,/g, "");
      const depositAmountNumber = Number.parseInt(cleanedDeposit, 10);

      const initialStatus = orderRequiresCooking(orderItems)
        ? ("WAITING_COOKING" as const)
        : ("WAITING_PICKUP" as const);

      const newOrder: Order = {
        id: Order.get("id").from(orderId),
        receiptNumber,
        createdAt, // 受付番号発行時刻（Information.tsx で記録済み）
        status: initialStatus,
        statusChange: [
          {
            to: "UNCONFIRMED",
            at: createdAt, // 受付番号発行時刻
          },
          {
            to: initialStatus,
            at: now, // 注文確定時刻
          },
        ],
        items: orderItems as Array<typeof orderItems[number]>,
        depositAmount: Order.get("depositAmount").from(depositAmountNumber),
        appliedDiscount: discountInfo ? Discount.assert(discountInfo) : null,
      };

      $orders.set([...currentOrders, newOrder]);

      // 最後に確定された注文のIDを設定（ハイライト用）
      $lastConfirmedOrderId.set(newOrder.id);
    } // eslint-disable-next-line no-console
    console.log("[ORDER_CONFIRMATION]", {
      receiptNumber,
      discountCode,
      depositAmount,
      items: orderItems,
      confirmedAt: now,
      total,
      totalDiscount,
      change,
    });

    resetCurrentOrder();
    $orderPhase.set("CHECK_RECEIPT_NUMBER");
    setRightStep("DISCOUNT");
    dotPressedRef.current = false;

    setStatusWithTimeout({ type: "ORDER_CONFIRMED", receiptNumber });
    requestAnimationFrame(() => {
      focusReceiptInput();
    });
  };
  return (
    <VStack alignItems="flex-start" gap="4" w="full">
      <p.table tableLayout="fixed" w="full">
        <Table.head>
          <p.tr>
            <p.th p="0!" w="28"></p.th>
            <p.th p="0!" w="auto"></p.th>
          </p.tr>
        </Table.head>
        <Table.body>
          <TableBodyRow bg="green.600" color="white">
            <Table.cell align="right" verticalAlign="middle!" whiteSpace="nowrap">
              合計
            </Table.cell>
            <Table.cell textAlign="right">
              <HStack gap="2" justifyContent="flex-end">
                <p.code fontSize="clamp(1.2rem, 1.6vw, 1.5rem)">{total.toLocaleString("ja-JP")}</p.code>
                <p.p whiteSpace="nowrap">円</p.p>
              </HStack>
            </Table.cell>
          </TableBodyRow>
          <TableBodyRow bg="red.200">
            <Table.cell align="right" verticalAlign="middle!" whiteSpace="nowrap">
              うち&ensp;割引
            </Table.cell>
            <Table.cell textAlign="right">
              <HStack gap="2" justifyContent="flex-end">
                <HStack gap="2">
                  <VStack alignItems="flex-end" gap="0.5" lineHeight="tight">
                    {(!discountCode || discountCode === "") && (
                      <p.span
                        color="gray.600"
                        fontSize="clamp(9px, 0.8vw, 12px)"
                        whiteSpace="nowrap"
                      >
                        未入力: 割引なし
                      </p.span>
                    )}
                    {discounts.map((d) => {
                      const isSelected = discountCode === d.discountNumber.toString();
                      return (
                        <p.span
                          _current={{ color: "red.700", fontWeight: "bold" }}
                          color="gray.700"
                          data-current={isSelected ? "true" : undefined}
                          fontSize="clamp(9px, 0.8vw, 12px)"
                          key={d.id}
                          whiteSpace="nowrap"
                        >
                          {`${d.discountNumber}: ${d.name}`}
                        </p.span>
                      );
                    })}
                  </VStack>
                  <HStack gap="2">
                    <p.code color="gray.500">D</p.code>
                    <NumberInput
                      disabled={orderPhase !== "CHECK_DISCOUNT"}
                      h="10"
                      inputMode="numeric"
                      onChange={(event) => {
                        setDiscountCode(event.target.value);
                        dotPressedRef.current = false;
                      }}
                      onKeyDown={(event) => {
                        if (event.key === "Backspace") {
                          event.preventDefault();
                          const currentValue = event.currentTarget.value;
                          dotPressedRef.current = false;
                          if (currentValue === "") {
                            focusOrderLastRowProduct();
                            setDiscountCode("");
                            setRightStep("DISCOUNT");
                            $orderPhase.set("SELECT_ITEMS");
                          } else {
                            setDiscountCode("");
                            requestAnimationFrame(() => {
                              const input = discountInputRef.current;
                              input?.focus();
                              input?.select();
                            });
                          }
                        } else if (event.key === "Enter") {
                          event.preventDefault();
                          const currentValue = event.currentTarget.value;

                          // 割引番号が入力されている場合のバリデーション
                          if (currentValue !== "") {
                            const discountNumber = wrapValidation(
                              DiscountNumber(Number.parseInt(currentValue, 10)),
                            ).unwrapOr(null);

                            if (discountNumber == null) {
                              // バリデーションエラー
                              event.currentTarget.select();
                              setStatusWithTimeout(
                                {
                                  type: "INVALID_VALUE",
                                  detail: { type: "DISCOUNT_NUMBER", discountNumber: currentValue },
                                  receiptNumber: currentOrder.receiptNumber,
                                },
                              );
                              return;
                            }

                            const discount = findDiscountByNumber(discountNumber);
                            if (!discount) {
                              // 割引が見つからない
                              event.currentTarget.select();
                              setStatusWithTimeout(
                                {
                                  type: "INVALID_VALUE",
                                  receiptNumber: currentOrder.receiptNumber,
                                  detail: { type: "DISCOUNT_NUMBER", discountNumber: currentValue },
                                },
                              );
                              return;
                            }
                          }

                          $orderPhase.set("PROCESS_PAYMENT");
                          setRightStep("DEPOSIT");
                          dotPressedRef.current = false;
                        }
                      }}
                      outline={{
                        base: "2px solid",
                        _focus: "4px solid",
                      }}
                      outlineColor="black"
                      ref={discountInputRef}
                      textAlign="center"
                      value={discountCode}
                      w="10"
                    />
                  </HStack>

                </HStack>
                <p.code
                  color="red.600"
                  fontSize="clamp(1.2rem, 1.6vw, 1.5rem)"
                  minW="24"
                  textAlign="right"
                >
                  {totalDiscount > 0 ? `-${totalDiscount.toLocaleString("ja-JP")}` : "0"}
                </p.code>
                <p.p whiteSpace="nowrap">円</p.p>
              </HStack>
            </Table.cell>
          </TableBodyRow>
          <TableBodyRow>
            <Table.cell align="right" verticalAlign="middle!" whiteSpace="nowrap">
              預かり
            </Table.cell>
            <Table.cell textAlign="right">
              <HStack gap="2" justifyContent="flex-end">
                <NumberInput
                  disabled={orderPhase !== "PROCESS_PAYMENT"}
                  fontSize="clamp(1.2rem, 1.6vw, 1.5rem)"
                  inputMode="numeric"
                  onChange={(event) => {
                    // カンマを除去して数値のみを保存
                    const rawValue = event.target.value.replace(/,/g, "");
                    setDepositAmount(rawValue);
                    if (rightStep === "CONFIRM") {
                      setRightStep("DEPOSIT");
                    }
                    dotPressedRef.current = false;
                  }}
                  onKeyDown={(event) => {
                    if (event.key === "Backspace") {
                      event.preventDefault();
                      const currentValue = event.currentTarget.value;
                      dotPressedRef.current = false;
                      if (currentValue === "") {
                        setDepositAmount("");
                        setRightStep("DISCOUNT");
                        $orderPhase.set("CHECK_DISCOUNT");
                        requestAnimationFrame(() => {
                          const input = discountInputRef.current;
                          input?.focus();
                          input?.select();
                        });
                      } else {
                        setDepositAmount("");
                        requestAnimationFrame(() => {
                          const input = depositInputRef.current;
                          input?.focus();
                          input?.select();
                        });
                      }
                    } else if (event.key === "Enter") {
                      event.preventDefault();
                      const currentValue = event.currentTarget.value;
                      // カンマを除去してから数値に変換
                      const cleanedValue = (currentValue || "0").replace(/,/g, "");
                      const depositNumber = Number.parseInt(cleanedValue, 10);

                      // 預かり金額が合計金額に足りない場合のバリデーション
                      if (depositNumber < total) {
                        event.currentTarget.select();
                        setStatusWithTimeout(
                          {
                            type: "INVALID_VALUE",
                            detail: { type: "DEPOSIT_INSUFFICIENT", deposit: depositNumber, total },
                            receiptNumber: currentOrder.receiptNumber,
                          },
                        );
                        return;
                      }

                      setRightStep("CONFIRM");
                      dotPressedRef.current = false;
                    }
                  }}
                  ref={depositInputRef}
                  textAlign="right"
                  value={depositAmountDisplay}
                  w="clamp(9rem, 13vw, 11rem)"
                />
                <p.p whiteSpace="nowrap">円</p.p>
              </HStack>
            </Table.cell>
          </TableBodyRow>
          <TableBodyRow>
            <Table.cell align="right" verticalAlign="middle!" whiteSpace="nowrap">
              お釣り
            </Table.cell>
            <Table.cell textAlign="right">
              <HStack gap="2" justifyContent="flex-end">
                <p.code fontSize="clamp(1.2rem, 1.6vw, 1.5rem)">{change.toLocaleString("ja-JP")}</p.code>
                <p.p whiteSpace="nowrap">円</p.p>
              </HStack>
            </Table.cell>
          </TableBodyRow>
        </Table.body>
      </p.table>
      <Button
        _focus={{
          bg: "purple.500",
          color: "white",
        }}
        disabled={rightStep !== "CONFIRM"}
        mx="auto"
        onBlur={() => {
          dotPressedRef.current = false;
        }}
        onClick={(event) => {
          if (rightStep === "CONFIRM" && event.detail !== 0) {
            handleConfirm();
          }
        }}
        onKeyDown={(event) => {
          if (event.key === "Backspace") {
            event.preventDefault();
            dotPressedRef.current = false;
            setRightStep("DEPOSIT");
            requestAnimationFrame(() => {
              const input = depositInputRef.current;
              input?.focus();
              input?.select();
            });
          } else if (event.key === ".") {
            event.preventDefault();
            dotPressedRef.current = true;
          } else if (event.key === "Enter") {
            event.preventDefault();
            if (dotPressedRef.current && rightStep === "CONFIRM") {
              handleConfirm();
            }
            dotPressedRef.current = false;
          } else {
            dotPressedRef.current = false;
          }
        }}
        ref={confirmButtonRef}
        variant="filled"
      >
        注文確定 (. + Enter)
      </Button>
    </VStack>
  );
}
