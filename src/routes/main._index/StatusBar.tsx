import type { ReactElement } from "react";
import type { Status } from "@/lib/stores/status";
import { useStore } from "@nanostores/react";
import { css } from "panda/css";
import { HStack, styled as p } from "panda/jsx";
import { useEffect, useState } from "react";
import { match } from "ts-pattern";
import { Expanded } from "@/components/atomic/Expanded";
import { ReceiptNumberImpl } from "@/lib/order";
import { $status } from "@/lib/stores/status";
import { $systemStartTimeStr, $systemUptimeMs } from "@/lib/stores/time";

const InlineReceiptNumber = p("code", {
  base: {
    alignItems: "center",
    border: "1px solid",
    display: "grid",
    fontSize: "[10px]",
    h: "4",
    lineHeight: "none",
    placeItems: "center",
    position: "relative",
    w: "5",
  },
});

function Status(): ReactElement {
  const status = useStore($status);

  return match(status)
    .with({ type: "RESET_PROGRESS" }, ({ progress, receiptNumber }) =>
      progress >= 0.2
        ? (
            <HStack
              color="black"
              fontWeight="bold"
              gap="1"
              h="full"
              overflow="hidden"
              position="relative"
              px="2"
            >
              <p.div
                bg="red.200"
                h="full"
                left="0"
                position="absolute"
                top="0"
                w="full"
                zIndex="0"
              />
              <p.div
                bg="red.300"
                h="full"
                left="0"
                position="absolute"
                style={{ width: `${progress * 100}%` }}
                top="0"
                transition="width 50ms linear"
                zIndex="1"
              />
              <HStack gap="1" position="relative" zIndex="2">
                <InlineReceiptNumber>
                  {ReceiptNumberImpl(receiptNumber).toStr()}
                </InlineReceiptNumber>
                <IconMaterialSymbolsRestartAlt />
                <p.p>BS を押し続けて注文をリセット...</p.p>
              </HStack>
            </HStack>
          )
        : <></>)
    .with({ type: "RESET" }, ({ receiptNumber }) => (
      <HStack
        bg="red.600"
        color="white"
        fontWeight="bold"
        gap="1"
        h="full"
        px="2"
      >
        <InlineReceiptNumber>
          {ReceiptNumberImpl(receiptNumber).toStr()}
        </InlineReceiptNumber>
        <IconMaterialSymbolsRestartAlt />
        <p.p>注文をリセットしました</p.p>
      </HStack>
    ))
    .with({ type: "INVALID_VALUE" }, ({ receiptNumber, detail }) => (
      <HStack
        bg="orange.600"
        color="white"
        fontWeight="bold"
        gap="1"
        h="full"
        px="2"
      >
        <InlineReceiptNumber>
          {ReceiptNumberImpl(receiptNumber).toStr()}
        </InlineReceiptNumber>
        {match(detail)
          .with({ type: "RECEIPT_NUMBER" }, ({ receiptNumber: invalidReceiptNumber }) => (
            <>
              <IconMaterialSymbolsError />
              <p.p>
                受付番号
                {" "}
                <p.code>{invalidReceiptNumber}</p.code>
                {" "}
                は範囲外です (範囲: 1–50)
              </p.p>
            </>
          ))
          .with({ type: "RECEIPT_NOT_FOUND" }, ({ receiptNumber: notFoundReceiptNumber, status: orderStatus }) => {
            const statusLabel = match(orderStatus)
              .with("WAITING_COOKING", () => "調理待ち")
              .with("WAITING_PICKUP", () => "受取待ち")
              .otherwise(() => "受取待ち");
            return (
              <>
                <IconMaterialSymbolsIndeterminateQuestionBox />
                <p.p>
                  受付番号
                  {" "}
                  <p.code>{notFoundReceiptNumber}</p.code>
                  {" "}
                  は
                  {statusLabel}
                  に存在しません
                </p.p>
              </>
            );
          })
          .with({ type: "RECEIPT_ALREADY_IN_USE" }, ({ receiptNumber: inUseReceiptNumber, status: inUseStatus }) => {
            const statusLabel = inUseStatus === "WAITING_COOKING" ? "調理待ち" : "受取待ち";
            return (
              <>
                <IconMaterialSymbolsError />
                <p.p>
                  受付番号
                  {" "}
                  <p.code>{inUseReceiptNumber}</p.code>
                  {" "}
                  は現在
                  {statusLabel}
                  で使用中です
                </p.p>
              </>
            );
          })
          .with({ type: "ITEM_EMPTY" }, () => (
            <>
              <IconMaterialSymbolsError />
              <p.p>
                商品が 1 つも入力されていません
              </p.p>
            </>
          ))
          .with({ type: "ITEM_NUMBER" }, ({ itemNumber }) => (
            <>
              <IconMaterialSymbolsIndeterminateQuestionBox />
              <p.p>
                商品番号
                {" "}
                <p.code>{itemNumber}</p.code>
                {" "}
                に該当する商品はありません
              </p.p>
            </>
          ))
          .with({ type: "DISCOUNT_NUMBER" }, ({ discountNumber }) => (
            <>
              <IconMdiTagHidden />
              <p.p>
                割引番号
                {" "}
                <p.code>{discountNumber}</p.code>
                {" "}
                に該当する割引はありません
              </p.p>
            </>
          ))
          .with({ type: "QUANTITY_TOO_LARGE" }, ({ quantity }) => (
            <>
              <IconMaterialSymbolsError />
              <p.p>
                数量
                {" "}
                <p.code>{quantity.toString()}</p.code>
                {" "}
                は範囲外です (0〜100)
              </p.p>
            </>
          ))
          .with({ type: "DEPOSIT_INSUFFICIENT" }, ({ deposit, total }) => (
            <>
              <IconMaterialSymbolsIndeterminateQuestionBox />
              <p.p>
                預かり金額&ensp;
                <p.code>{deposit}</p.code>
                &ensp;円は, 合計金額&ensp;
                <p.code>{total}</p.code>
                &ensp;円に対して不足しています
              </p.p>
            </>
          ))
          .with({ type: "EXTRA_PORTION_WITHOUT_ITEM" }, () => (
            <>
              <IconMaterialSymbolsError />
              <p.p>
                増量を登録するには団子が必要です
              </p.p>
            </>
          ))
          .with({ type: "EXTRA_PORTION_EXCEEDED" }, () => (
            <>
              <IconMaterialSymbolsError />
              <p.p>
                増量の数量は団子の数量以下にしてください
              </p.p>
            </>
          ))
          .with({ type: "FLAVOR_COUNT_EXCEEDED" }, () => (
            <>
              <IconMaterialSymbolsError />
              <p.p>
                だんごの味は2種類までしか選べません
              </p.p>
            </>
          ))
          .with({ type: "ITEM_SOLD_OUT" }, ({ itemName }) => (
            <>
              <IconMaterialSymbolsError />
              <p.p>
                商品「
                {itemName}
                」は売り切れです
              </p.p>
            </>
          ))
          .exhaustive()}
      </HStack>
    ))
    .with({ type: "ORDER_CONFIRMED" }, ({ receiptNumber }) => (
      <HStack bg="purple.500" color="white" gap="1" h="full" px="2">
        <HStack fontWeight="bold" gap="1">
          <InlineReceiptNumber>
            {ReceiptNumberImpl(receiptNumber).toStr()}
          </InlineReceiptNumber>
          <IconMaterialSymbolsBucketCheck />
          <p.p>注文を確定しました</p.p>
        </HStack>
      </HStack>
    ))
    .with({ type: "COOKING_COMPLETED" }, ({ receiptNumber }) => (
      <HStack bg="amber.600" color="white" gap="1" h="full" px="2">
        <HStack fontWeight="bold" gap="1">
          <InlineReceiptNumber>
            {ReceiptNumberImpl(receiptNumber).toStr()}
          </InlineReceiptNumber>
          <IconMaterialSymbolsPublishedWithChanges />
          <p.p>注文ステータスを調理完了にしました</p.p>
        </HStack>
      </HStack>
    ))
    .with({ type: "PICKUP_COMPLETED" }, ({ receiptNumber }) => (
      <HStack bg="green.600" color="white" gap="1" h="full" px="2">
        <HStack fontWeight="bold" gap="1">
          <InlineReceiptNumber>
            {ReceiptNumberImpl(receiptNumber).toStr()}
          </InlineReceiptNumber>
          <IconMaterialSymbolsPublishedWithChanges />
          <p.p>注文ステータスを受取完了にしました</p.p>
        </HStack>
      </HStack>
    ))
    .otherwise(() => <></>);
}

export function StatusBar(): ReactElement {
  const systemStartedTimeStr = useStore($systemStartTimeStr).timeOnly;
  const systemUptimeStr = useStore($systemUptimeMs());
  const [isResolutionLow, setIsResolutionLow] = useState(() => {
    if (typeof window === "undefined")
      return false;
    return window.innerWidth < 1024 || window.innerHeight < 680;
  });

  useEffect(() => {
    const handleResize = (): void => {
      setIsResolutionLow(window.innerWidth < 1024 || window.innerHeight < 680);
    };
    window.addEventListener("resize", handleResize);
    return (): void => {
      window.removeEventListener("resize", handleResize);
    };
  }, []);
  return (
    <Expanded
      alignItems="center"
      display="flex"
      fontSize="xs"
      justifyContent="space-between"
      px="1"
    >
      <HStack h="full">
        <HStack
          className={css({
            animation: "pulse",
            animationTimingFunction: "step-start",
          })}
          gap="1"
          p="1"
        >
          <IconMaterialSymbolsSync />
          <p.p>保存を再試行しています...</p.p>
        </HStack>

        <HStack h="full">
          <Status />
        </HStack>
      </HStack>
      {isResolutionLow && (
        <HStack
          bg="amber.400"
          color="black"
          fontSize="xs"
          fontWeight="bold"
          px="2"
          py="0.5"
          rounded="sm"
        >
          <IconMaterialSymbolsWarning />
          <p.span>
            画面解像度が不足しています（推奨: 1280×720以上 / ウィンドウを最大化または全画面表示してください）
          </p.span>
        </HStack>
      )}
      <HStack>
        <p.p color="gray.500">
          システム開始時刻:
          {" "}
          <p.code>{systemStartedTimeStr}</p.code>
          {" "}
          (
          <p.code>{`${systemUptimeStr} m`}</p.code>
          )
        </p.p>
      </HStack>
    </Expanded>
  );
}
