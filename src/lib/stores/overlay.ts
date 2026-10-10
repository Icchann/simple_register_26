/* eslint-disable ts/explicit-function-return-type */

import type { Nullable } from "@/types/utils";
import { atom } from "nanostores";
import { match } from "ts-pattern";

export type OverlayType
  = "COOKING_COMPLETE"
    | "PICKUP_COMPLETE"
    | "ORDER_EDIT"
    | "ITEM_EDIT";

export const $overlayType = atom<Nullable<OverlayType>>(null);
export const $isFlavorDialogOpen = atom<boolean>(false);

export function showOverlay(type: OverlayType): void {
  $overlayType.set(type);
}

export function closeOverlay(): void {
  $overlayType.set(null);
}

export function OverlayTypeImpl(type: Nullable<OverlayType>) {
  return {
    toStr: () => match(type)
      .with("COOKING_COMPLETE", () => "調理完了")
      .with("PICKUP_COMPLETE", () => "受取完了")
      .with("ORDER_EDIT", () => "注文修正")
      .with("ITEM_EDIT", () => "商品修正")
      .otherwise(() => "なし"),
  };
}
