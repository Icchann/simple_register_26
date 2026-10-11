import type { ReactElement } from "react";
import { useStore } from "@nanostores/react";
import { cva } from "panda/css";
import { HStack, styled as p, VStack } from "panda/jsx";
import { useCallback, useEffect, useRef, useState } from "react";
import { match } from "ts-pattern";
import { DANGO_FLAVORS, DangoFlavorImpl } from "@/lib/order";
import { $items } from "@/lib/stores/items";
import { $isFlavorDialogOpen } from "@/lib/stores/overlay";

const flavorCardRecipe = cva({
  base: {
    borderRadius: "md",
    borderWidth: "2px",
    gap: "3",
    p: "3",
    position: "relative",
  },
  variants: {
    state: {
      soldOut: {
        bg: "red.50",
        borderColor: "red.300",
        cursor: "not-allowed",
        opacity: 0.6,
      },
      normal: {
        bg: "gray.50",
        borderColor: "gray.200",
        cursor: "pointer",
        opacity: 1,
      },
      amber: {
        bg: "amber.100",
        borderColor: "amber.400",
        cursor: "pointer",
        opacity: 1,
      },
      orange: {
        bg: "orange.100",
        borderColor: "orange.400",
        cursor: "pointer",
        opacity: 1,
      },
      purple: {
        bg: "purple.100",
        borderColor: "purple.400",
        cursor: "pointer",
        opacity: 1,
      },
      emerald: {
        bg: "emerald.100",
        borderColor: "emerald.400",
        cursor: "pointer",
        opacity: 1,
      },
      gray: {
        bg: "gray.200",
        borderColor: "gray.400",
        cursor: "pointer",
        opacity: 1,
      },
    },
  },
  defaultVariants: {
    state: "normal",
  },
});

export type DangoFlavorDialogProps = {
  isOpen: boolean;
  initialFlavor?: string | undefined;
  onConfirm: (flavors: string[]) => void;
  onClose: () => void;
};

export function DangoFlavorDialog({
  isOpen,
  initialFlavor,
  onConfirm,
  onClose,
}: DangoFlavorDialogProps): ReactElement {
  const items = useStore($items);
  const dangoGroup = items.find((g) => g.name === "だんご");
  const isFlavorSoldOut = useCallback((flavorName: string): boolean => {
    const item = dangoGroup?.children.find((c) => c.name === flavorName);
    return item?.isSoldOut === true;
  }, [dangoGroup]);

  const [firstFlavor, setFirstFlavor] = useState<string | null>(() => {
    const candidate = initialFlavor ?? "味なし";
    if (!isFlavorSoldOut(candidate)) {
      return candidate;
    }
    return null;
  });
  const [secondFlavor, setSecondFlavor] = useState<string | null>(null);
  const dialogCardRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    $isFlavorDialogOpen.set(isOpen);
    if (isOpen) {
      requestAnimationFrame(() => {
        dialogCardRef.current?.focus();
      });
    }
    return (): void => {
      $isFlavorDialogOpen.set(false);
    };
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen)
      return;

    const handleKeyDown = (e: KeyboardEvent): void => {
      // ズームショートカット等を妨害しない
      if (e.ctrlKey || e.metaKey || e.altKey)
        return;

      if (e.key === "Escape") {
        e.preventDefault();
        e.stopPropagation();
        e.stopImmediatePropagation();
        onClose();
        return;
      }

      if (e.key === "Backspace") {
        e.preventDefault();
        e.stopPropagation();
        e.stopImmediatePropagation();
        if (secondFlavor != null) {
          setSecondFlavor(null);
        } else {
          onClose();
        }
        return;
      }

      if (e.key === "Enter") {
        e.preventDefault();
        e.stopPropagation();
        e.stopImmediatePropagation();
        if (firstFlavor != null) {
          if (secondFlavor != null) {
            // 2つの味（同種なら単一味に正規化）
            const result = firstFlavor === secondFlavor ? [firstFlavor] : [firstFlavor, secondFlavor];
            onConfirm(result);
          } else {
            // 味1つのみで確定
            onConfirm([firstFlavor]);
          }
        }
        return;
      }

      // 数字キー 0〜4 による味の選択
      const matched = DANGO_FLAVORS.find((f) => f.key === e.key);
      if (matched == null) {
        e.preventDefault();
        e.stopPropagation();
        e.stopImmediatePropagation();
        return;
      }
      e.preventDefault();
      e.stopPropagation();
      e.stopImmediatePropagation();
      const chosenFlavor = matched.name;
      if (isFlavorSoldOut(chosenFlavor)) {
        return;
      }

      if (firstFlavor == null) {
        // 1つ目の味を選択 (味なし または 各種味)
        setFirstFlavor(chosenFlavor);
      } else {
        // 2つ目の味を選択して即確定（同じ味なら1種、異なるなら2種）
        const result = firstFlavor === chosenFlavor ? [firstFlavor] : [firstFlavor, chosenFlavor];
        onConfirm(result);
      }
    };

    window.addEventListener("keydown", handleKeyDown, { capture: true });
    return (): void => {
      window.removeEventListener("keydown", handleKeyDown, { capture: true });
    };
  }, [isOpen, firstFlavor, secondFlavor, initialFlavor, isFlavorSoldOut, onConfirm, onClose]);

  if (!isOpen)
    return <></>;

  const promptMessage = firstFlavor == null
    ? "1つ目の味を選んでください (0: 味なし / 1〜4: 各種味 / [後退] 戻る)"
    : "✨ もう一つの味は？（2種類まで選べます！ 1味のみで決定する場合は同じ番号または [確定]）";
  return (
    <p.div
      bottom="0"
      left="0"
      position="absolute"
      right="0"
      top="0"
      zIndex="50"
    >
      {/* 背景オーバーレイ */}
      <p.div
        bg="gray.900"
        bottom="0"
        left="0"
        opacity="0.6"
        position="absolute"
        right="0"
        top="0"
      />

      {/* モーダルカード */}
      <VStack
        bg="white"
        borderColor="gray.400"
        borderRadius="md"
        borderWidth="2px"
        boxShadow="2xl"
        gap="4"
        left="50%"
        maxW="[520px]"
        outline="none"
        p="6"
        position="absolute"
        ref={dialogCardRef}
        tabIndex={-1}
        top="50%"
        transform="translate(-50%, -50%)"
        w="90%"
        zIndex="modal"
      >
        <p.h2 fontSize="xl" fontWeight="bold">
          だんご 味選択
        </p.h2>

        {/* 案内メッセージ */}
        <p.p
          bg={firstFlavor != null ? "amber.50" : "blue.50"}
          borderColor={firstFlavor != null ? "amber.300" : "blue.200"}
          borderRadius="sm"
          borderWidth="1px"
          color={firstFlavor != null ? "amber.950" : "blue.900"}
          fontSize="sm"
          fontWeight="bold"
          p="2"
          textAlign="center"
          w="full"
        >
          {promptMessage}
        </p.p>

        {/* 現在の選択状況 */}
        <HStack gap="3" justifyContent="center" py="1" w="full">
          <HStack gap="1">
            <p.span color="gray.600" fontSize="xs">味1:</p.span>
            {firstFlavor != null
              ? (
                  <p.span
                    className={DangoFlavorImpl(firstFlavor).toClassName()}
                    fontSize="sm"
                    px="2"
                    py="0.5"
                  >
                    {firstFlavor}
                  </p.span>
                )
              : (
                  <p.span color="gray.400" fontSize="sm">[ 未選択 ]</p.span>
                )}
          </HStack>

          <p.span color="gray.400" fontSize="sm">+</p.span>

          <HStack gap="1">
            <p.span color="gray.600" fontSize="xs">味2:</p.span>
            {secondFlavor != null
              ? (
                  <p.span
                    className={DangoFlavorImpl(secondFlavor).toClassName()}
                    fontSize="sm"
                    px="2"
                    py="0.5"
                  >
                    {secondFlavor}
                  </p.span>
                )
              : firstFlavor != null
                ? (
                    <p.span
                      bg="amber.100"
                      borderColor="amber.400"
                      borderRadius="sm"
                      borderWidth="1px"
                      color="amber.900"
                      fontSize="sm"
                      fontWeight="bold"
                      px="2"
                      py="0.5"
                    >
                      👉 もう一つの味は？
                    </p.span>
                  )
                : (
                    <p.span color="gray.400" fontSize="sm">[ 未選択 ]</p.span>
                  )}
          </HStack>
        </HStack>

        {/* 味の候補一覧 */}
        <p.div display="grid" gap="2" gridTemplateColumns="repeat(2, 1fr)" w="full">
          {DANGO_FLAVORS.map((flavor) => {
            const isSoldOut = isFlavorSoldOut(flavor.name);
            const isSelected = firstFlavor === flavor.name || secondFlavor === flavor.name;
            const cardState = isSoldOut
              ? ("soldOut" as const)
              : isSelected
                ? match(flavor.name)
                    .with("きなこ", () => "amber" as const)
                    .with("みたらし", () => "orange" as const)
                    .with("あんこ", () => "purple" as const)
                    .with("のり醤油", () => "emerald" as const)
                    .otherwise(() => "gray" as const)
                : ("normal" as const);

            return (
              <HStack
                className={flavorCardRecipe({ state: cardState })}
                key={flavor.key}
                onClick={() => {
                  if (isSoldOut) {
                    return;
                  }
                  if (firstFlavor == null) {
                    setFirstFlavor(flavor.name);
                  } else {
                    const result = firstFlavor === flavor.name ? [firstFlavor] : [firstFlavor, flavor.name];
                    onConfirm(result);
                  }
                }}
                opacity={isSoldOut ? 0.6 : 1}
                p="3"
                position="relative"
              >
                <p.code
                  bg={isSoldOut ? "red.700" : "gray.800"}
                  borderRadius="sm"
                  color="white"
                  fontSize="md"
                  fontWeight="bold"
                  px="2"
                  py="0.5"
                >
                  {flavor.key}
                </p.code>
                <p.span
                  color={isSoldOut ? "red.700" : isSelected ? "gray.900" : "gray.800"}
                  fontSize="md"
                  fontWeight="bold"
                  textDecoration={isSoldOut ? "line-through" : undefined}
                >
                  {flavor.name}
                </p.span>
                {isSoldOut && (
                  <HStack color="red.600" fontSize="xs" fontWeight="bold" gap="0.5" ml="auto">
                    <p.span fontSize="sm">✕</p.span>
                    <p.span>売切</p.span>
                  </HStack>
                )}
              </HStack>
            );
          })}
        </p.div>

        {/* 確定・キャンセル操作ガイド */}
        <HStack color="gray.500" fontSize="xs" justifyContent="space-between" pt="1" w="full">
          <p.span>[1〜4] 味選択 / [0] 味なし</p.span>
          <p.span>[確定] 1味で確定 / 次へ</p.span>
          <p.span>[後退] 戻る / キャンセル</p.span>
        </HStack>
      </VStack>
    </p.div>
  );
}
