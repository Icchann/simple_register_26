/* eslint-disable ts/explicit-function-return-type */

import type { Item } from "@/types/item";
import type { OrderStatus } from "@/types/order";
import type { Nullable } from "@/types/utils";
import { cva } from "panda/css";
import { token } from "panda/tokens";
import { match } from "ts-pattern";
import { ItemImpl } from "@/lib/item";

// ref: https://github.com/type-challenges/type-challenges/issues/360#issue-747316677
type CamelCase<S extends string> = S extends Lowercase<S>
  ? S extends `${infer F}_${infer RF}${infer R}`
    ? `${F}${Uppercase<RF>}${CamelCase<R>}`
    : S
  : CamelCase<Lowercase<S>>;

function toCamelCase<S extends string>(s: S): CamelCase<S> {
  return s.toLowerCase().replace(/_([a-z])/g, (_, letter) => letter.toUpperCase()) as CamelCase<S>;
}

export function OrderStatusImpl(status: OrderStatus) {
  return {
    toLabelStr: () => match(status)
      .with("UNCONFIRMED", () => "注文前")
      .with("WAITING_COOKING", () => "調理待ち")
      .with("WAITING_PICKUP", () => "受取待ち")
      .with("PICKED_UP", () => "受取済")
      .with("REFUNDED", () => "返金済")
      .with("CANCELED", () => "取消済")
      .exhaustive(),
    toColor: () => {
      const key = `colors.orderStatus.${toCamelCase(status)}` as const;

      return {
        bg: token(`${key}.bg`),
        onBg: token(`${key}.onBg`),
        text: token(`${key}.text`),
      };
    },
  };
}

export function ReceiptNumberImpl(receiptNumber: Nullable<number>) {
  return {
    toStr: () => {
      if (receiptNumber == null) {
        return "?";
      }
      return receiptNumber.toString().padStart(2, "0");
    },
  };
}

export const DANGO_FLAVORS = [
  { key: "0", name: "味なし", code: "00" },
  { key: "1", name: "きなこ", code: "01" },
  { key: "2", name: "みたらし", code: "02" },
  { key: "3", name: "あんこ", code: "03" },
  { key: "4", name: "のり醤油", code: "04" },
] as const;

export type DangoFlavorName = typeof DANGO_FLAVORS[number]["name"];
export const flavorBadgeRecipe = cva({
  base: {
    borderRadius: "sm",
    borderWidth: "1px",
    fontWeight: "bold",
    whiteSpace: "nowrap",
  },
  variants: {
    flavor: {
      味なし: {
        bg: "gray.100",
        borderColor: "gray.300",
        color: "gray.700",
      },
      きなこ: {
        bg: "amber.100",
        borderColor: "amber.300",
        color: "amber.900",
      },
      みたらし: {
        bg: "orange.100",
        borderColor: "orange.300",
        color: "orange.900",
      },
      あんこ: {
        bg: "purple.100",
        borderColor: "purple.300",
        color: "purple.900",
      },
      のり醤油: {
        bg: "emerald.100",
        borderColor: "emerald.300",
        color: "emerald.900",
      },
      その他: {
        bg: "gray.100",
        borderColor: "gray.300",
        color: "gray.800",
      },
    },
  },
  defaultVariants: {
    flavor: "その他",
  },
});

export function DangoFlavorImpl(flavor: string) {
  const validFlavors = ["味なし", "きなこ", "みたらし", "あんこ", "のり醤油"] as const;
  const matchedFlavor = validFlavors.find((f) => f === flavor) ?? "その他";

  return {
    toClassName: () => flavorBadgeRecipe({ flavor: matchedFlavor }),
    toColor: () => match(flavor)
      .with("味なし", () => ({ bg: "gray.100", borderColor: "gray.300", color: "gray.700" }))
      .with("きなこ", () => ({ bg: "amber.100", borderColor: "amber.300", color: "amber.900" }))
      .with("みたらし", () => ({ bg: "orange.100", borderColor: "orange.300", color: "orange.900" }))
      .with("あんこ", () => ({ bg: "purple.100", borderColor: "purple.300", color: "purple.900" }))
      .with("のり醤油", () => ({ bg: "emerald.100", borderColor: "emerald.300", color: "emerald.900" }))
      .otherwise(() => ({ bg: "gray.100", borderColor: "gray.300", color: "gray.800" })),
  };
}

export function orderRequiresCooking(items: ReadonlyArray<{ id: string }>): boolean {
  // 缶ジュース・ペットボトル等のドリンクのみの場合は調理不要（直接「受取待ち」へ）
  // だんご等、調理が必要な商品が含まれている場合は調理待ちとする
  return items.some((item) => ItemImpl(item as unknown as Item).getGroup()?.name === "だんご");
}
