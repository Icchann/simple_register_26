import type { ChangeEvent, KeyboardEvent, ReactElement } from "react";
import type { KeyField } from "./OrderTable";
import type { ItemWithItemNumber } from "@/types/item";
import type { Nullable } from "@/types/utils";
import { useStore } from "@nanostores/react";
import { HStack, styled as p } from "panda/jsx";
import { memo, useMemo } from "react";
import { match, P } from "ts-pattern";
import { NumberInput } from "@/components/atomic/NumberInput";
import { Table } from "@/components/atomic/Table";
import { wrapValidation } from "@/lib/arktype";
import { ItemImpl } from "@/lib/item";
import { DangoFlavorImpl } from "@/lib/order";
import { findItemByNumber } from "@/lib/stores/current-order";
import { $orderPhase } from "@/lib/stores/phase";
import { ItemNumber } from "@/types/item";

function ItemName(
  {
    itemWithItemNumber,
    isBlank,
    flavors,
  }:
  {
    itemWithItemNumber: Nullable<ItemWithItemNumber>;
    isBlank: boolean;
    flavors?: string[] | undefined;
  },
): ReactElement {
  const phase = useStore($orderPhase);
  const isSelectItemsPhase = phase === "SELECT_ITEMS";

  if (isSelectItemsPhase) {
    if (isBlank) {
      return <p.p fontStyle="italic" whiteSpace="nowrap">Enter で割引確認へ</p.p>;
    }

    if (itemWithItemNumber == null) {
      return <p.p color="red.500" fontStyle="italic" whiteSpace="nowrap">該当なし</p.p>;
    }
  }

  if (isBlank) {
    return <p.p whiteSpace="nowrap">---</p.p>;
  }

  if (itemWithItemNumber == null) {
    return <p.p color="red.500" fontStyle="italic" whiteSpace="nowrap">該当なし</p.p>;
  }

  return (
    <p.div
      fontSize="clamp(11px, 0.9vw, 14px)"
      overflow="hidden"
      textOverflow="ellipsis"
      whiteSpace="nowrap"
    >
      {flavors && flavors.length > 0
        ? (
            <HStack alignItems="center" display="inline-flex" flexWrap="nowrap" gap="1">
              <p.span>だんご</p.span>
              {flavors.map((flavor) => {
                const color = DangoFlavorImpl(flavor).toColor();
                return (
                  <p.span
                    bg={color.bg}
                    borderColor={color.borderColor}
                    borderRadius="sm"
                    borderWidth="1px"
                    color={color.color}
                    fontSize="clamp(10px, 0.8vw, 12px)"
                    fontWeight="bold"
                    key={flavor}
                    px="1"
                    py="0.5"
                    whiteSpace="nowrap"
                  >
                    {flavor}
                  </p.span>
                );
              })}
            </HStack>
          )
        : match(ItemImpl(itemWithItemNumber).getGroup()?.name)
          .with(P.nullish, () => "")
          .otherwise((name) => `${name}/`)
          + itemWithItemNumber.name}
    </p.div>
  );
}

export const OrderTableRow = memo((
  props: {
    disabled: boolean;
    discountAmount: number;
    flavors?: string[] | undefined;
    index: number;
    productCode: string;
    quantity: string;
    onChange: (field: KeyField, value: string) => void;
    onKeyDown: (field: KeyField, e: KeyboardEvent<HTMLInputElement>) => void;
    onFocus?: (field: KeyField) => void;
    productCodeRef?: React.RefObject<HTMLInputElement | null> | undefined;
    quantityRef?: React.RefObject<HTMLInputElement | null> | undefined;
  },
): ReactElement => {
  const itemInfo = useMemo(() => {
    if (!props.productCode || props.productCode.trim() === "") {
      return null;
    }
    const itemNumber = Number.parseInt(props.productCode, 10);
    if (Number.isNaN(itemNumber)) {
      return null;
    }
    const validated = wrapValidation(ItemNumber(itemNumber)).unwrapOr(null);
    if (validated == null) {
      return null;
    }
    return findItemByNumber(validated);
  }, [props.productCode]);

  return (
    <p.tr color="gray.500">
      <Table.cell align="right" whiteSpace="nowrap">{props.index}</Table.cell>
      <Table.cell align="right" color="black" whiteSpace="nowrap">
        <HStack gap="2" justifyContent="flex-end" w="full">
          <p.code color="gray.500">T</p.code>
          <NumberInput
            disabled={props.disabled}
            onChange={(e: ChangeEvent<HTMLInputElement>) => {
              props.onChange("productCode", e.target.value);
            }}
            onFocus={props.onFocus
              ? (_e): void => {
                  props.onFocus!("productCode");
                }
              : undefined}
            onKeyDown={(e: KeyboardEvent<HTMLInputElement>) => {
              props.onKeyDown("productCode", e);
            }}
            ref={props.productCodeRef}
            value={props.productCode}
            w="10"
          />
        </HStack>
      </Table.cell>
      <Table.cell fontFamily="sans" whiteSpace="nowrap">
        <ItemName
          flavors={props.flavors}
          isBlank={props.productCode.trim() === "" && props.quantity.trim() === ""}
          itemWithItemNumber={itemInfo}
        />
      </Table.cell>
      <Table.cell align="right" whiteSpace="nowrap">
        {itemInfo?.price != null ? `@${itemInfo.price}` : "---"}
      </Table.cell>
      <Table.cell align="right" whiteSpace="nowrap">
        <HStack>
          <p.p fontFamily="sans">×</p.p>
          <NumberInput
            color="black"
            disabled={props.disabled}
            onChange={(e: ChangeEvent<HTMLInputElement>) => {
              props.onChange("quantity", e.target.value);
            }}
            onFocus={props.onFocus
              ? (_e): void => {
                  props.onFocus?.("quantity");
                }
              : undefined}
            onKeyDown={(e: KeyboardEvent<HTMLInputElement>) => {
              props.onKeyDown("quantity", e);
            }}
            ref={props.quantityRef}
            value={props.quantity}
            w="10"
          />
        </HStack>
      </Table.cell>
      <Table.cell align="right" color={props.discountAmount > 0 ? "red.600" : undefined} whiteSpace="nowrap">
        {props.discountAmount > 0 ? `-${props.discountAmount}` : "0"}
      </Table.cell>
      <Table.cell align="right" whiteSpace="nowrap">
        {itemInfo && props.quantity
          ? (itemInfo.price * Number.parseInt(props.quantity ?? "0", 10) - props.discountAmount)
          : "0"}
      </Table.cell>
    </p.tr>
  );
});
