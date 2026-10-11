/* eslint-disable react/no-create-ref */
import type { ReactElement, RefObject } from "react";
import type { OrderRowInput } from "@/lib/stores/current-order";
import { useStore } from "@nanostores/react";
import { HStack, styled as p, VStack } from "panda/jsx";
import { createRef, useEffect, useMemo, useRef, useState } from "react";

import { Button } from "@/components/atomic/Button";
import { Table } from "@/components/atomic/Table";
import { DangoFlavorDialog } from "@/components/overlays/DangoFlavorDialog";
import { wrapValidation } from "@/lib/arktype";
import { EXTRA_PORTION_CONFIG } from "@/lib/consts";
import {
  focusReceiptInput,
  registerOrderFocusHelpers,
} from "@/lib/focus-manager";
import { ItemImpl } from "@/lib/item";
import { DANGO_FLAVORS } from "@/lib/order";
import {
  $currentOrder,
  $discountCode,
  $isRefundMode,
  $orderRows,
  appendOrderRow,
  createOrderRow,
  findDiscountByNumber,
  findItemByNumber,
  getNormalizedCurrentOrderItems,
  updateOrderRows,
  validateOrderItems,
} from "@/lib/stores/current-order";
import { $orderPhase } from "@/lib/stores/phase";
import { setStatusWithTimeout } from "@/lib/stores/status";
import { DiscountNumber, ItemNumber } from "@/types/item";
import { MAX_ORDER_ITEM_AMOUNT } from "@/types/order";
import { OrderTableRow } from "./OrderTableRow";

export type KeyField = "productCode" | "quantity";

type RowRefs = Record<KeyField, RefObject<HTMLInputElement | null>>;

function createRowRefs(): RowRefs {
  return {
    productCode: createRef<HTMLInputElement>(),
    quantity: createRef<HTMLInputElement>(),
  };
}

function isRowEmpty(row: OrderRowInput): boolean {
  return row.productCode === "" && row.quantity === "";
}

export function OrderTable(): ReactElement {
  const rows = useStore($orderRows);
  const discountCode = useStore($discountCode);
  const orderPhase = useStore($orderPhase);
  const isActive = orderPhase === "SELECT_ITEMS";

  const [flavorDialogState, setFlavorDialogState] = useState<{
    isOpen: boolean;
    rowId: number;
    initialFlavor?: string | undefined;
    displayIndex: number;
    isTab: boolean;
  }>({ isOpen: false, rowId: -1, displayIndex: 0, isTab: false });

  const [toppingErrorDialogMessage, setToppingErrorDialogMessage] = useState<string | null>(null);
  const discountInfo = useMemo(() => {
    if (!discountCode || discountCode.trim() === "") {
      return null;
    }
    const discountNumber = wrapValidation(
      DiscountNumber(Number.parseInt(discountCode, 10)),
    ).unwrapOr(null);
    if (discountNumber == null) {
      return null;
    }
    return findDiscountByNumber(discountNumber);
  }, [discountCode]);

  const getDiscountAmountForRow = useMemo(() => (productCode: string): number => {
    if (!discountInfo || !productCode || productCode.trim() === "") {
      return 0;
    }
    const itemNumber = wrapValidation(
      ItemNumber(Number.parseInt(productCode, 10)),
    ).unwrapOr(null);
    if (itemNumber == null) {
      return 0;
    }
    const item = findItemByNumber(itemNumber);
    if (!item) {
      return 0;
    }
    return discountInfo.amount[item.id] ?? 0;
  }, [discountInfo]);

  const displayRows = useMemo<OrderRowInput[]>(() => {
    const nonEmptyRows = rows.filter((row) => !isRowEmpty(row));
    if (nonEmptyRows.length === 0) {
      return rows[0] ? [rows[0]] : [];
    }

    const nextRows = [...nonEmptyRows];
    const last = rows[rows.length - 1];
    if (last && isRowEmpty(last)) {
      nextRows.push(last);
    }
    return nextRows;
  }, [rows]);

  const [rowRefs, setRowRefs] = useState<RowRefs[]>(() => displayRows.map(() => createRowRefs()));

  useEffect(() => {
    // eslint-disable-next-line react-hooks-extra/no-direct-set-state-in-use-effect
    setRowRefs((previous) => {
      if (previous.length === displayRows.length) {
        return previous;
      }
      if (previous.length < displayRows.length) {
        return [
          ...previous,
          ...Array.from({ length: displayRows.length - previous.length }, () => createRowRefs()),
        ];
      }
      return previous.slice(0, displayRows.length);
    });
  }, [displayRows.length]);

  const [pendingFocusIndex, setPendingFocusIndex] = useState<number>();
  const [pendingFocusField, setPendingFocusField] = useState<KeyField>("productCode");
  const tableRef = useRef<HTMLTableElement>(null);
  const hasActivatedRef = useRef(false);

  const rowIndexMap = useMemo(() => {
    const map = new Map<number, number>();
    rows.forEach((row, index) => {
      map.set(row.id, index);
    });
    return map;
  }, [rows]);

  useEffect(() => {
    if (!isActive) {
      hasActivatedRef.current = false;
      return;
    }
    if (hasActivatedRef.current) {
      return;
    }
    if (pendingFocusIndex != null) {
      hasActivatedRef.current = true;
      return;
    }

    const firstInput = rowRefs[0]?.productCode.current;
    if (firstInput) {
      firstInput.focus();
      firstInput.select();
      hasActivatedRef.current = true;
    }
  }, [isActive, pendingFocusIndex, rowRefs]);

  useEffect(() => {
    registerOrderFocusHelpers({
      focusFirstRowProductInput: () => {
        if (displayRows.length === 0) {
          return;
        }
        setPendingFocusField("productCode");
        setPendingFocusIndex(0);
      },
      focusLastRowProductInput: () => {
        if (displayRows.length === 0) {
          return;
        }
        setPendingFocusField("productCode");
        setPendingFocusIndex(displayRows.length - 1);
      },
      focusActiveProductInput: () => {
        if (displayRows.length === 0) {
          return;
        }
        const targetIndex = pendingFocusIndex ?? (displayRows.length - 1);
        const targetField = pendingFocusField ?? "productCode";
        const input = rowRefs[targetIndex]?.[targetField].current;
        if (input) {
          input.focus();
          input.select();
        } else {
          setPendingFocusField(targetField);
          setPendingFocusIndex(targetIndex);
        }
      },
    });
    return (): void => {
      registerOrderFocusHelpers({});
    };
  }, [displayRows.length, pendingFocusIndex, pendingFocusField, rowRefs]);

  useEffect(() => {
    if (!isActive) {
      return;
    }
    if (pendingFocusIndex == null) {
      return;
    }
    const input = rowRefs[pendingFocusIndex]?.[pendingFocusField].current;
    if (input) {
      input.focus();
      input.select();
      hasActivatedRef.current = true;
      // eslint-disable-next-line react-hooks-extra/no-direct-set-state-in-use-effect
      setPendingFocusIndex(undefined);
    }
  }, [isActive, pendingFocusIndex, pendingFocusField, rowRefs]);

  const handleChange = (rowId: number, field: KeyField, value: string): void => {
    updateOrderRows((previousRows) =>
      previousRows.map((row) => row.id === rowId ? { ...row, [field]: value } : row),
    );
  };

  const handleFocus = (rowId: number, field: KeyField): void => {
    if (!isActive || field !== "quantity") {
      return;
    }
    const targetIndex = rowIndexMap.get(rowId);
    if (targetIndex == null) {
      return;
    }
    if (targetIndex === rows.length - 1) {
      appendOrderRow();
    }
  };

  const handleKeyDown = (row: OrderRowInput, displayIndex: number, field: KeyField, event: React.KeyboardEvent<HTMLInputElement>): void => {
    if (!isActive) {
      return;
    }

    if (event.key === "Enter" || event.key === "Tab") {
      const currentValue = event.currentTarget.value.trim();
      const targetIndex = rowIndexMap.get(row.id);
      if (targetIndex == null) {
        return;
      }

      if (field === "productCode") {
        const isLastDisplayRow = displayIndex === displayRows.length - 1;

        // 空の場合の処理
        if (currentValue === "") {
          if (event.key === "Tab") {
            // Tabキーで空のまま移動しようとした場合は阻止
            event.preventDefault();
            return;
          }
          if (event.key === "Enter" && isLastDisplayRow) {
            event.preventDefault();

            // 全ての行が空かチェック
            const allRowsEmpty = rows.every(isRowEmpty);
            if (allRowsEmpty) {
              // 商品が1つも入力されていない
              setStatusWithTimeout(
                {
                  type: "INVALID_VALUE",
                  detail: { type: "ITEM_EMPTY" },
                  receiptNumber: $currentOrder.get().receiptNumber,
                },
              );
              return;
            }

            // 売り切れ商品および有効数量（1個以上）の検証
            const normalizedItems = getNormalizedCurrentOrderItems(rows);
            const activeItems = normalizedItems.filter((it) => it.amount > 0);
            if (activeItems.length === 0) {
              setStatusWithTimeout({
                type: "INVALID_VALUE",
                detail: { type: "ITEM_EMPTY" },
                receiptNumber: $currentOrder.get().receiptNumber,
              });
              return;
            }

            const soldOutItem = activeItems.find((it) => it.isSoldOut === true);
            if (soldOutItem) {
              setStatusWithTimeout({
                type: "INVALID_VALUE",
                detail: { type: "ITEM_SOLD_OUT", itemName: soldOutItem.name },
                receiptNumber: $currentOrder.get().receiptNumber,
              });
              return;
            }

            // 団子と増量、および味の数量整合性を検証
            const validationResult = validateOrderItems();
            if (validationResult.isErr()) {
              setStatusWithTimeout({
                type: "INVALID_VALUE",
                detail: { type: validationResult.error },
                receiptNumber: $currentOrder.get().receiptNumber,
              });
              return;
            }

            $orderPhase.set("CHECK_DISCOUNT");
            return;
          }
          if (event.key === "Enter") {
            event.preventDefault();
            return;
          }
        } else {
          // 商品番号が入力されている場合、該当する商品があるかチェック
          const itemNumber = wrapValidation(
            ItemNumber(Number.parseInt(currentValue, 10)),
          ).unwrapOr(null);

          if (itemNumber == null) {
            // バリデーションエラー：該当しない
            event.preventDefault();
            event.currentTarget.select();
            setStatusWithTimeout(
              {
                type: "INVALID_VALUE",
                detail: { type: "ITEM_NUMBER", itemNumber: currentValue },
                receiptNumber: $currentOrder.get().receiptNumber,
              },
            );
            return;
          }

          const item = findItemByNumber(itemNumber);
          if (!item) {
            // 商品が見つからない：該当しない
            event.preventDefault();
            event.currentTarget.select();
            setStatusWithTimeout(
              {
                type: "INVALID_VALUE",
                receiptNumber: $currentOrder.get().receiptNumber,
                detail: { type: "ITEM_NUMBER", itemNumber: currentValue },
              },
            );
            return;
          }

          if (item.isSoldOut === true) {
            event.preventDefault();
            event.currentTarget.select();
            setStatusWithTimeout(
              {
                type: "INVALID_VALUE",
                receiptNumber: $currentOrder.get().receiptNumber,
                detail: { type: "ITEM_SOLD_OUT", itemName: item.name },
              },
            );
            return;
          }
          const isDango = ItemImpl(item).getGroup()?.name === "だんご";
          const isExtraPortion = item.name === EXTRA_PORTION_CONFIG.name || itemNumber === EXTRA_PORTION_CONFIG.code;

          if (isExtraPortion) {
            event.preventDefault();
            const currentRows = $orderRows.get();
            const currentRowIndex = currentRows.findIndex((r) => r.id === row.id);

            // 現在の行より前（または直近）にある「だんご」行を探す
            let precedingDangoIndex = -1;
            for (let i = currentRowIndex - 1; i >= 0; i--) {
              const r = currentRows[i];
              if (!r) {
                continue;
              }
              const parsedNumber = wrapValidation(
                ItemNumber(Number.parseInt(r.productCode, 10)),
              ).unwrapOr(null);
              if (parsedNumber == null) {
                continue;
              }
              const it = findItemByNumber(parsedNumber);
              if (it && ItemImpl(it).getGroup()?.name === "だんご" && it.name !== "増量") {
                precedingDangoIndex = i;
                break;
              }
            }

            if (precedingDangoIndex === -1) {
              event.currentTarget.select();
              setStatusWithTimeout({
                type: "INVALID_VALUE",
                detail: { type: "EXTRA_PORTION_WITHOUT_ITEM" },
                receiptNumber: $currentOrder.get().receiptNumber,
              });
              return;
            }

            const targetDangoRow = currentRows[precedingDangoIndex];
            const rawQuantity = targetDangoRow?.quantity;
            const dangoQuantity = Number.parseInt(rawQuantity != null && rawQuantity !== "" ? rawQuantity : "1", 10);
            if (dangoQuantity > 1) {
              event.currentTarget.select();
              setToppingErrorDialogMessage(
                "増量を付ける場合は、1本ずつ行を分けて入力してください。\n（例: みたらし 1本 ＋ 増量、みたらし 1本）",
              );
              return;
            }

            updateOrderRows((previousRows) => {
              const nextRows = [...previousRows];
              const targetDango = nextRows[precedingDangoIndex];
              if (targetDango) {
                const currentToppings = targetDango.toppings ?? [];
                nextRows[precedingDangoIndex] = {
                  ...targetDango,
                  toppings: Array.from(new Set([...currentToppings, "増量"])),
                };
              }

              const curIdx = nextRows.findIndex((r) => r.id === row.id);
              if (curIdx !== -1) {
                nextRows[curIdx] = {
                  ...nextRows[curIdx]!,
                  productCode: "",
                  quantity: "",
                };
              }
              return nextRows;
            });

            event.currentTarget.value = "";
            return;
          }

          if (isDango) {
            const initialFlavor = item.name === "だんご" ? "味なし" : item.name;
            event.preventDefault();
            setFlavorDialogState({
              isOpen: true,
              rowId: row.id,
              initialFlavor,
              displayIndex,
              isTab: event.key === "Tab",
            });
            return;
          }
        }
      }

      event.preventDefault();

      updateOrderRows((previousRows) => {
        const index = previousRows.findIndex((candidate) => candidate.id === row.id);
        if (index === -1) {
          return previousRows;
        }

        const nextRows = [...previousRows];
        const targetRow = nextRows[index];
        if (!targetRow) {
          return previousRows;
        }
        if ((field === "quantity" || field === "productCode") && targetRow.quantity.trim() === "") {
          nextRows[index] = { ...targetRow, quantity: "1" };
        }
        return nextRows;
      });

      if (field === "productCode") {
        // 商品コードから Tab を押した場合は同じ行の個数にフォーカス
        if (event.key === "Tab") {
          setPendingFocusField("quantity");
          setPendingFocusIndex(displayIndex);
        } else if (event.key === "Enter") {
          // 商品コードから Enter を押した場合は個数を1で補完して次の行へ
          if (targetIndex === rows.length - 1) {
            appendOrderRow();
          }
          setPendingFocusField("productCode");
          setPendingFocusIndex(displayIndex + 1);
        }
      } else if (field === "quantity") {
        // 個数のバリデーション: 0〜MAX_ORDER_ITEM_AMOUNT(100)の範囲外はエラー（0個は消去目的で許容）
        const quantity = Number.parseInt(currentValue || "1", 10);
        if (quantity < 0 || quantity > MAX_ORDER_ITEM_AMOUNT) {
          event.preventDefault();
          event.currentTarget.select();
          setStatusWithTimeout(
            {
              type: "INVALID_VALUE",
              detail: { type: "QUANTITY_TOO_LARGE", quantity },
              receiptNumber: $currentOrder.get().receiptNumber,
            },
          );
          return;
        }

        // 個数から Tab/Enter を押した場合は次の行の商品コードにフォーカス
        if (targetIndex === rows.length - 1) {
          appendOrderRow();
        }
        setPendingFocusField("productCode");
        setPendingFocusIndex(displayIndex + 1);
      }
    } else if (event.key === "Backspace") {
      const currentFieldValue = event.currentTarget.value.trim();

      // フィールドに値がある場合は、まず空にする
      if (currentFieldValue !== "") {
        event.preventDefault();
        updateOrderRows((previousRows) =>
          previousRows.map((candidate) =>
            candidate.id === row.id ? { ...candidate, [field]: "" } : candidate,
          ),
        );
        return;
      }

      // フィールドが既に空の場合は、前のセルに移動
      event.preventDefault();

      if (field === "productCode" && displayIndex === 0 && isRowEmpty(row)) {
        $orderPhase.set("CHECK_RECEIPT_NUMBER");
        focusReceiptInput();
        return;
      }

      updateOrderRows((previousRows) => {
        const index = previousRows.findIndex((candidate) => candidate.id === row.id);
        if (index === -1) {
          return previousRows;
        }

        const clearedRows = previousRows.map((candidate, idx) =>
          idx === index ? { ...candidate, [field]: "" } : candidate,
        );

        const allEmpty = clearedRows.every(isRowEmpty);
        if (allEmpty) {
          const first = clearedRows[0] ?? createOrderRow();
          return [first];
        }

        return clearedRows.filter((candidate, idx) =>
          idx === 0 || !isRowEmpty(candidate),
        );
      });

      setTimeout(() => {
        if (field === "quantity") {
          const input = rowRefs[displayIndex]?.productCode.current;
          input?.focus();
          input?.select();
        } else if (field === "productCode" && displayIndex > 0) {
          const input = rowRefs[displayIndex - 1]?.quantity.current;
          input?.focus();
          input?.select();
        }
      }, 0);
    }
  };
  const handleFlavorConfirm = (rowId: number, flavors: string[], displayIndex: number, isTab: boolean): void => {
    setFlavorDialogState((prev) => ({ ...prev, isOpen: false }));

    updateOrderRows((previousRows) => {
      const index = previousRows.findIndex((candidate) => candidate.id === rowId);
      if (index === -1)
        return previousRows;

      const nextRows = [...previousRows];
      const targetRow = nextRows[index];
      if (!targetRow)
        return previousRows;

      let syncedProductCode = targetRow.productCode;
      if (flavors.length === 1) {
        const matched = DANGO_FLAVORS.find((f) => f.name === flavors[0]);
        if (matched) {
          syncedProductCode = matched.code;
        }
      } else if (flavors.length > 1) {
        syncedProductCode = "00";
      }

      nextRows[index] = {
        ...targetRow,
        productCode: syncedProductCode,
        flavors,
        quantity: targetRow.quantity.trim() === "" ? "1" : targetRow.quantity,
      };
      return nextRows;
    });

    const targetIndex = rowIndexMap.get(rowId);
    if (isTab) {
      setPendingFocusField("quantity");
      setPendingFocusIndex(displayIndex);
    } else {
      if (targetIndex != null && targetIndex === rows.length - 1) {
        appendOrderRow();
      }
      setPendingFocusField("productCode");
      setPendingFocusIndex(displayIndex + 1);
    }
  };

  const handleFlavorCancel = (): void => {
    const { rowId, displayIndex } = flavorDialogState;
    setFlavorDialogState((prev) => ({ ...prev, isOpen: false }));

    updateOrderRows((previousRows) =>
      previousRows.map((candidate) =>
        candidate.id === rowId
          ? { ...candidate, productCode: "", quantity: "", flavors: undefined }
          : candidate,
      ),
    );

    setPendingFocusField("productCode");
    setPendingFocusIndex(displayIndex);

    requestAnimationFrame(() => {
      const input = rowRefs[displayIndex]?.productCode.current;
      if (input) {
        input.focus();
        input.select();
      }
    });
  };

  const isRefundMode = useStore($isRefundMode);

  return (
    <>
      {isRefundMode && (
        <HStack
          bg="red.600"
          borderRadius="md"
          color="white"
          fontSize="xs"
          fontWeight="bold"
          justifyContent="space-between"
          mb="1"
          px="3"
          py="1"
          w="full"
        >
          <HStack gap="1">
            <p.span fontSize="sm">🔄</p.span>
            <p.span>【返品・返金モード中】入力した商品はマイナス（返金）として登録されます</p.span>
          </HStack>
          <p.span bg="red.700" borderRadius="sm" px="1.5" py="0.5">
            [-] キーで通常モードに戻る
          </p.span>
        </HStack>
      )}
      <p.table fontSize="clamp(11px, 0.85vw, 14px)" ref={tableRef} tableLayout="fixed" w="full">
        <Table.head>
          <p.tr>
            <p.th w="10" whiteSpace="nowrap">#</p.th>
            <p.th w="20" whiteSpace="nowrap">商品番号</p.th>
            <p.th textAlign="left" w="stretch" whiteSpace="nowrap">商品名</p.th>
            <p.th w="12" whiteSpace="nowrap" />
            <p.th w="16" whiteSpace="nowrap">個数</p.th>
            <p.th w="20" whiteSpace="nowrap">
              割引&ensp;
              <p.span color="gray.500">[円]</p.span>
            </p.th>
            <p.th w="16" whiteSpace="nowrap">小計</p.th>
          </p.tr>
        </Table.head>
        <Table.body>
          {displayRows.map((row, index) => (
            <OrderTableRow
              disabled={!isActive || flavorDialogState.isOpen}
              discountAmount={getDiscountAmountForRow(row.productCode) * Number.parseInt(row.quantity ?? "1", 10)}
              flavors={row.flavors}
              index={index + 1}
              isRefund={isRefundMode}
              key={row.id}
              onChange={(field: KeyField, value: string) => {
                handleChange(row.id, field, value);
              }}
              onFocus={(field: KeyField) => {
                handleFocus(row.id, field);
              }}
              onKeyDown={(field: KeyField, event: React.KeyboardEvent<HTMLInputElement>) => {
                handleKeyDown(row, index, field, event);
              }}
              productCode={row.productCode}
              productCodeRef={rowRefs[index]?.productCode}
              quantity={row.quantity}
              quantityRef={rowRefs[index]?.quantity}
              toppings={row.toppings}
            />
          ))}
        </Table.body>
      </p.table>
      <DangoFlavorDialog
        initialFlavor={flavorDialogState.initialFlavor}
        isOpen={flavorDialogState.isOpen}
        key={flavorDialogState.isOpen ? `flavor-${flavorDialogState.rowId}-${flavorDialogState.initialFlavor ?? "none"}` : "closed"}
        onClose={handleFlavorCancel}
        onConfirm={(flavors) => {
          handleFlavorConfirm(flavorDialogState.rowId, flavors, flavorDialogState.displayIndex, flavorDialogState.isTab);
        }}
      />
      {toppingErrorDialogMessage != null && (
        <p.div
          alignItems="center"
          bg="black/60"
          bottom="0"
          display="flex"
          justifyContent="center"
          left="0"
          position="fixed"
          right="0"
          top="0"
          zIndex="modal"
        >
          <VStack
            bg="white"
            borderColor="red.500"
            borderRadius="xl"
            borderWidth="2px"
            boxShadow="2xl"
            gap="4"
            maxW="480px"
            p="6"
            w="90%"
          >
            <HStack color="red.600" fontSize="lg" fontWeight="bold" gap="2">
              <p.span fontSize="xl">⚠️</p.span>
              <p.span>増量の入力エラー</p.span>
            </HStack>
            <p.p color="gray.800" fontSize="sm" fontWeight="bold" lineHeight="relaxed" textAlign="center" whiteSpace="pre-wrap">
              {toppingErrorDialogMessage}
            </p.p>
            <Button
              autoFocus
              onClick={() => {
                setToppingErrorDialogMessage(null);
              }}
              size="md"
              variant="filled"
            >
              閉じる (Enter)
            </Button>
          </VStack>
        </p.div>
      )}
    </>
  );
}
