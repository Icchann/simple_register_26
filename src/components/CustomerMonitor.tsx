import type { ReactElement } from "react";
import { useStore } from "@nanostores/react";
import { Box, Grid, HStack, styled as p, VStack } from "panda/jsx";
import { useEffect, useMemo, useRef, useState } from "react";
import { wrapValidation } from "@/lib/arktype";
import { EXTRA_PORTION_CONFIG } from "@/lib/consts";
import { DangoFlavorImpl, ReceiptNumberImpl } from "@/lib/order";
import {
  $currentOrder,
  $depositAmount,
  $discountCode,
  $filledOrderRows,
  $isRefundMode,
  findDiscountByNumber,
  findItemByNumber,
} from "@/lib/stores/current-order";
import { $items } from "@/lib/stores/items";
import { $lastConfirmedOrderId, $orders } from "@/lib/stores/orders";
import { DiscountNumber, ItemNumber } from "@/types/item";

/**
 * 客面リアルタイムモニターコンポーネント「シス研団子」
 * マクドナルドのドライブスルーやセルフレジのように、
 * お客さんがレジの前で注文内容、割引、合計、お預かり、お釣りをリアルタイムで確認できる
 */
export function CustomerMonitor(): ReactElement {
  const currentOrder = useStore($currentOrder);
  const filledRows = useStore($filledOrderRows);
  const discountCode = useStore($discountCode);
  const depositAmount = useStore($depositAmount);
  const isRefundMode = useStore($isRefundMode);
  const lastConfirmedOrderId = useStore($lastConfirmedOrderId);
  const orders = useStore($orders);
  const itemGroups = useStore($items);

  // 会計完了（サンクス画面）の表示状態管理
  const [completedOrder, setCompletedOrder] = useState<typeof orders[number] | null>(null);
  const prevConfirmedOrderIdRef = useRef<string | null>(lastConfirmedOrderId);
  const isMountedRef = useRef(false);

  // 新しく注文が確定された瞬間のみ検知して完了画面を表示（初期ロード時の前回の表示残留を防止）
  useEffect(() => {
    if (!isMountedRef.current) {
      isMountedRef.current = true;
      prevConfirmedOrderIdRef.current = lastConfirmedOrderId;
      return;
    }

    if (lastConfirmedOrderId == null || lastConfirmedOrderId === prevConfirmedOrderIdRef.current) {
      return;
    }

    prevConfirmedOrderIdRef.current = lastConfirmedOrderId;
    const matched = orders.find((o) => o.id === lastConfirmedOrderId);
    if (!matched) {
      return;
    }

    // eslint-disable-next-line react-hooks-extra/no-direct-set-state-in-use-effect
    setCompletedOrder(matched);
    const timer = window.setTimeout(() => {
      setCompletedOrder(null);
    }, 5000);
    return (): void => {
      window.clearTimeout(timer);
    };
  }, [lastConfirmedOrderId, orders]);

  // 新しい商品の入力が始まったら、5秒待たずに即座にサンクス画面を閉じてリアルタイム注文表示に切り替える
  useEffect(() => {
    if (filledRows.length > 0 && completedOrder != null) {
      // eslint-disable-next-line react-hooks-extra/no-direct-set-state-in-use-effect
      setCompletedOrder(null);
    }
  }, [filledRows.length, completedOrder]);

  // 割引情報の解決
  const discountInfo = useMemo(() => {
    const discountNumber = wrapValidation(
      DiscountNumber(Number.parseInt(discountCode, 10)),
    ).unwrapOr(null);
    return discountNumber != null ? findDiscountByNumber(discountNumber) : null;
  }, [discountCode]);

  // 注文中の有効アイテムと金額集計
  const { cartItems, subtotal, totalDiscount, total, change } = useMemo(() => {
    let subtotalAmount = 0;
    let discountAmountTotal = 0;

    const items = filledRows.flatMap((row) => {
      const itemNumber = wrapValidation(
        ItemNumber(Number.parseInt(row.productCode, 10)),
      ).unwrapOr(null);
      if (itemNumber == null) {
        return [];
      }
      const item = findItemByNumber(itemNumber);
      if (!item) {
        return [];
      }

      const quantity = Number.parseInt(row.quantity || "1", 10);
      const hasExtraPortion = row.toppings?.includes(EXTRA_PORTION_CONFIG.name) === true;
      const unitPrice = item.price + (hasExtraPortion ? EXTRA_PORTION_CONFIG.price : 0);
      const rowSubtotal = unitPrice * quantity;
      subtotalAmount += rowSubtotal;

      if (discountInfo) {
        const itemDiscount = discountInfo.amount[item.id] ?? 0;
        discountAmountTotal += itemDiscount * quantity;
      }

      return [
        {
          id: row.id,
          name: item.name,
          flavors: row.flavors,
          hasExtraPortion,
          unitPrice,
          quantity,
          subtotal: rowSubtotal,
        },
      ];
    });

    const netTotal = Math.max(0, subtotalAmount - discountAmountTotal);
    const cleanedDeposit = (depositAmount || "0").replace(/,/g, "");
    const depositNum = Number.parseInt(cleanedDeposit, 10);
    const changeAmount = Number.isNaN(depositNum) ? 0 : Math.max(0, depositNum - netTotal);

    return {
      cartItems: items,
      subtotal: subtotalAmount,
      totalDiscount: discountAmountTotal,
      total: netTotal,
      change: changeAmount,
    };
  }, [filledRows, discountInfo, depositAmount]);

  // お預かり金額の表示用
  const depositDisplay = useMemo(() => {
    if (depositAmount === "") {
      return "--";
    }
    const num = Number.parseInt(depositAmount.replace(/,/g, ""), 10);
    if (Number.isNaN(num)) {
      return depositAmount;
    }
    return `¥${num.toLocaleString("ja-JP")}`;
  }, [depositAmount]);

  // -------------------------------------------------------------
  // 1. お会計完了画面（直近確定後のサンクス画面）
  // -------------------------------------------------------------
  if (completedOrder != null) {
    return (
      <VStack
        alignItems="center"
        bg="amber.50"
        h="screen"
        justifyContent="center"
        p="8"
        w="screen"
      >
        <VStack
          bg="white"
          borderColor="amber.400"
          borderRadius="2xl"
          borderWidth="4px"
          boxShadow="2xl"
          gap="6"
          maxW="800px"
          p="12"
          textAlign="center"
          w="full"
        >
          <p.h1 color="amber.900" fontSize="5xl" fontWeight="extrabold">
            🍡 ありがとうございました！
          </p.h1>
          <p.p color="gray.600" fontSize="2xl" fontWeight="bold">
            ご注文を承りました。番号札をお持ちになってお待ちください。
          </p.p>

          <Box
            bg="amber.100"
            borderColor="amber.500"
            borderRadius="xl"
            borderWidth="3px"
            p="8"
            w="full"
          >
            <p.span color="amber.800" fontSize="2xl" fontWeight="bold">
              お客様の受付番号
            </p.span>
            <p.div color="amber.950" fontFamily="mono" fontSize="8xl" fontWeight="extrabold" lineHeight="none" my="2">
              {ReceiptNumberImpl(completedOrder.receiptNumber).toStr()}
            </p.div>
          </Box>
        </VStack>
      </VStack>
    );
  }

  // -------------------------------------------------------------
  // 2. 待機画面（レジ入力前: ウェルカム＆お品書き）
  // -------------------------------------------------------------
  if (cartItems.length === 0) {
    return (
      <VStack bg="gray.100" h="screen" overflow="hidden" p="6" w="screen">
        {/* ヘッダー */}
        <HStack bg="amber.600" borderRadius="xl" color="white" justifyContent="space-between" px="8" py="4" w="full">
          <p.h1 fontSize="4xl" fontWeight="extrabold">
            🍡 シス研団子
          </p.h1>
          <p.span fontSize="xl" fontWeight="bold">
            いらっしゃいませ！ご注文をどうぞ
          </p.span>
        </HStack>

        {/* メニュー表一覧カード */}
        <Box flex="1" overflow="hidden" p="4" w="full">
          <Grid gap="6" gridTemplateColumns="repeat(3, 1fr)" h="full" w="full">
            {itemGroups.map((group) => (
              <VStack
                alignItems="stretch"
                bg="white"
                borderColor="gray.300"
                borderRadius="xl"
                borderWidth="2px"
                boxShadow="md"
                gap="3"
                key={group.id}
                p="5"
              >
                <p.h2
                  borderBottom="2px solid"
                  borderColor="amber.400"
                  color="amber.900"
                  fontSize="2xl"
                  fontWeight="bold"
                  pb="2"
                >
                  {group.name}
                </p.h2>
                <VStack alignItems="stretch" flex="1" gap="2" overflowY="auto">
                  {group.children.map((child) => (
                    <HStack
                      bg={child.isSoldOut === true ? "gray.100" : "gray.50"}
                      borderRadius="md"
                      justifyContent="space-between"
                      key={child.id}
                      opacity={child.isSoldOut === true ? 0.6 : 1}
                      p="3"
                    >
                      <HStack gap="2">
                        <p.span
                          color={child.isSoldOut === true ? "gray.500" : "gray.900"}
                          fontSize="2xl"
                          fontWeight="extrabold"
                          textDecoration={child.isSoldOut === true ? "line-through" : undefined}
                        >
                          {child.name}
                        </p.span>
                        {child.isSoldOut === true && (
                          <p.span bg="red.600" borderRadius="sm" color="white" fontSize="sm" fontWeight="bold" px="2" py="0.5">
                            売切
                          </p.span>
                        )}
                      </HStack>
                      <p.span color="amber.800" fontFamily="mono" fontSize="2xl" fontWeight="extrabold">
                        ¥
                        {child.price}
                      </p.span>
                    </HStack>
                  ))}
                </VStack>
              </VStack>
            ))}
          </Grid>
        </Box>
      </VStack>
    );
  }

  // -------------------------------------------------------------
  // 3. ご注文・お会計中画面（ドライブスルー風 2カラム構成）
  // -------------------------------------------------------------
  return (
    <VStack bg="gray.100" h="screen" overflow="hidden" p="6" w="screen">
      {/* 上部ヘッダー */}
      <HStack
        bg={isRefundMode ? "red.700" : "amber.600"}
        borderRadius="xl"
        color="white"
        justifyContent="space-between"
        px="8"
        py="4"
        w="full"
      >
        <p.h1 fontSize="3xl" fontWeight="extrabold">
          🍡 シス研団子
        </p.h1>
        <HStack gap="4">
          {currentOrder.receiptNumber != null && (
            <p.span bg="white/20" borderRadius="md" fontSize="xl" fontWeight="bold" px="3" py="1">
              {`受付番号: ${ReceiptNumberImpl(currentOrder.receiptNumber).toStr()} 番`}
            </p.span>
          )}
          <p.span fontSize="xl" fontWeight="bold">
            {isRefundMode ? "【🔄 返品・返金受付中】" : "ご注文内容をご確認ください"}
          </p.span>
        </HStack>
      </HStack>

      {/* メイン2カラム領域 */}
      <Grid flex="1" gap="6" gridTemplateColumns="3fr 2fr" minH="0" w="full">
        {/* 左側: ご注文商品一覧 */}
        <VStack
          alignItems="stretch"
          bg="white"
          borderColor="gray.300"
          borderRadius="xl"
          borderWidth="2px"
          boxShadow="md"
          gap="3"
          minH="0"
          p="5"
        >
          <p.h2 borderBottom="2px solid" borderColor="gray.200" color="gray.800" fontSize="2xl" fontWeight="bold" pb="2">
            🛒 ご注文一覧
          </p.h2>

          <VStack alignItems="stretch" flex="1" gap="2" minH="0" overflowY="auto">
            {cartItems.map((item, idx) => (
              <HStack
                bg={isRefundMode ? "red.50" : "gray.50"}
                borderColor={isRefundMode ? "red.200" : "gray.200"}
                borderRadius="lg"
                borderWidth="1px"
                justifyContent="space-between"
                key={item.id}
                p="5"
              >
                <HStack gap="4">
                  <p.span color="gray.400" fontFamily="mono" fontSize="2xl" fontWeight="bold">
                    {`${idx + 1}.`}
                  </p.span>
                  <VStack alignItems="flex-start" gap="1.5">
                    <HStack gap="2">
                      {isRefundMode && (
                        <p.span bg="red.600" borderRadius="sm" color="white" fontSize="sm" fontWeight="bold" px="2" py="0.5">
                          返品
                        </p.span>
                      )}
                      <p.span fontSize="3xl" fontWeight="extrabold">
                        {item.name}
                      </p.span>
                      {item.hasExtraPortion && (
                        <p.span bg="orange.500" borderRadius="sm" color="white" fontSize="md" fontWeight="bold" px="2.5" py="1">
                          {`[${EXTRA_PORTION_CONFIG.name}]`}
                        </p.span>
                      )}
                    </HStack>
                    {item.flavors && item.flavors.length > 0 && (
                      <HStack gap="1">
                        {item.flavors.map((flavor) => (
                          <p.span
                            className={DangoFlavorImpl(flavor).toClassName()}
                            fontSize="md"
                            key={flavor}
                            px="2.5"
                            py="1"
                          >
                            {flavor}
                          </p.span>
                        ))}
                        {item.flavors.length === 1 && item.flavors[0] !== "味なし" && (
                          <p.span
                            bg="amber.100"
                            borderColor="amber.400"
                            borderRadius="sm"
                            borderWidth="1px"
                            color="amber.900"
                            fontSize="sm"
                            fontWeight="bold"
                            px="2"
                            py="1"
                          >
                            ＋もう一つの味は？
                          </p.span>
                        )}
                      </HStack>
                    )}
                  </VStack>
                </HStack>

                <HStack gap="6">
                  <p.span color="gray.700" fontSize="3xl" fontWeight="extrabold">
                    {`x ${item.quantity}`}
                  </p.span>
                  <p.span color="gray.900" fontFamily="mono" fontSize="3xl" fontWeight="extrabold" minW="32" textAlign="right">
                    {isRefundMode ? `-¥${item.subtotal.toLocaleString("ja-JP")}` : `¥${item.subtotal.toLocaleString("ja-JP")}`}
                  </p.span>
                </HStack>
              </HStack>
            ))}
          </VStack>
        </VStack>

        {/* 右側: お会計サマリー */}
        <VStack
          alignItems="stretch"
          bg="white"
          borderColor={isRefundMode ? "red.400" : "gray.300"}
          borderRadius="xl"
          borderWidth="2px"
          boxShadow="md"
          gap="4"
          p="6"
        >
          <p.h2
            borderBottom="2px solid"
            borderColor={isRefundMode ? "red.300" : "gray.200"}
            color={isRefundMode ? "red.800" : "gray.800"}
            fontSize="2xl"
            fontWeight="bold"
            pb="2"
          >
            {isRefundMode ? "🔄 返金計算" : "💳 お会計"}
          </p.h2>

          <VStack alignItems="stretch" gap="3" py="2">
            <HStack fontSize="2xl" justifyContent="space-between">
              <p.span color="gray.600">小計</p.span>
              <p.span fontFamily="mono" fontWeight="bold">
                {isRefundMode ? `-¥${subtotal.toLocaleString("ja-JP")}` : `¥${subtotal.toLocaleString("ja-JP")}`}
              </p.span>
            </HStack>

            {totalDiscount > 0 && (
              <HStack color="red.600" fontSize="2xl" justifyContent="space-between">
                <p.span>{discountInfo ? `割引 (${discountInfo.name})` : "割引"}</p.span>
                <p.span fontFamily="mono" fontWeight="bold">
                  {`-¥${totalDiscount.toLocaleString("ja-JP")}`}
                </p.span>
              </HStack>
            )}

            {/* 合計金額（特大表示） */}
            <Box
              bg={isRefundMode ? "red.50" : "amber.50"}
              borderColor={isRefundMode ? "red.400" : "amber.400"}
              borderRadius="xl"
              borderWidth="3px"
              my="2"
              p="5"
            >
              <HStack justifyContent="space-between">
                <p.span color={isRefundMode ? "red.800" : "amber.900"} fontSize="3xl" fontWeight="bold">
                  {isRefundMode ? "ご返金金額" : "合計金額"}
                </p.span>
                <p.span
                  color={isRefundMode ? "red.700" : "amber.950"}
                  fontFamily="mono"
                  fontSize="6xl"
                  fontWeight="extrabold"
                  lineHeight="none"
                >
                  {isRefundMode ? `-¥${total.toLocaleString("ja-JP")}` : `¥${total.toLocaleString("ja-JP")}`}
                </p.span>
              </HStack>
            </Box>

            {/* お預かり・お釣り */}
            {!isRefundMode && (
              <>
                <HStack fontSize="2xl" justifyContent="space-between" pt="1">
                  <p.span color="gray.600">お預かり</p.span>
                  <p.span fontFamily="mono" fontSize="3xl" fontWeight="bold">
                    {depositDisplay}
                  </p.span>
                </HStack>

                <HStack
                  borderColor="gray.200"
                  borderTop="2px dashed"
                  fontSize="3xl"
                  justifyContent="space-between"
                  pt="3"
                >
                  <p.span color="gray.800" fontWeight="bold">お釣り</p.span>
                  <p.span color="green.700" fontFamily="mono" fontSize="6xl" fontWeight="extrabold">
                    {change > 0 ? `¥${change.toLocaleString("ja-JP")}` : "--"}
                  </p.span>
                </HStack>
              </>
            )}
          </VStack>
        </VStack>
      </Grid>
    </VStack>
  );
}
