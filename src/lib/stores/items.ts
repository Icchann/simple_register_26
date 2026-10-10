import { persistentAtom } from "@nanostores/persistent";
import { type } from "arktype";
import { atom } from "nanostores";
import { getLocalStorageKey } from "@/lib/consts";
import { ItemGroup, ItemWithItemNumber } from "@/types/item";
import ITEM_GROUPS from "~/data/item_groups.json";

const SoldOutIdsSchema = type("string[]");

const VALID_ITEM_ID_MAP: Record<string, true> = Object.fromEntries(
  ITEM_GROUPS.flatMap((group) => group.children.map((child) => [child.id, true])),
);

function safeDecode(value: string): string[] {
  try {
    if (value === "" || value === "undefined" || value === "null") {
      return [];
    }
    const parsed: unknown = JSON.parse(value);
    const validated = SoldOutIdsSchema(parsed);
    if (validated instanceof type.errors) {
      return [];
    }
    return Array.from(new Set(validated)).filter((id) => VALID_ITEM_ID_MAP[id] === true);
  } catch {
    return [];
  }
}

function safeEncode(value: string[]): string {
  try {
    const validOnly = value.filter((id) => VALID_ITEM_ID_MAP[id] === true);
    return JSON.stringify(validOnly);
  } catch {
    return "[]";
  }
}

function getInitialSoldOutIds(): string[] {
  if (typeof window === "undefined" || typeof localStorage === "undefined") {
    return [];
  }
  try {
    const raw = localStorage.getItem(getLocalStorageKey("soldOutItemIds"));
    if (raw == null) {
      return [];
    }
    return safeDecode(raw);
  } catch {
    return [];
  }
}

export const soldOutStorageCoder = {
  encode: safeEncode,
  decode: safeDecode,
};
const coder = soldOutStorageCoder;

const ItemGroupWithItemNumber = ItemGroup
  .merge({
    children: ItemWithItemNumber.array(),
  });
export type ItemGroupWithItemNumber = typeof ItemGroupWithItemNumber.infer;

export const $soldOutItemIds = persistentAtom<string[]>(
  getLocalStorageKey("soldOutItemIds"),
  getInitialSoldOutIds(),
  coder,
);
function buildItems(soldOutIds: readonly string[]): ItemGroupWithItemNumber[] {
  return ITEM_GROUPS.map((data, groupIdx) => {
    const dataWithItemNumber = {
      ...data,
      children: data.children.map((child, itemIdx) => ({
        ...child,
        itemNumber: groupIdx * 10 + itemIdx,
        isSoldOut: soldOutIds.includes(child.id),
      })),
    };
    return ItemGroupWithItemNumber.assert(dataWithItemNumber);
  });
}

export const $items = atom<ItemGroupWithItemNumber[]>(
  buildItems($soldOutItemIds.get()),
);

$soldOutItemIds.subscribe((soldOutIds) => {
  $items.set(buildItems(soldOutIds));
});

export function toggleItemSoldOut(itemId: string): void {
  const current = $soldOutItemIds.get();
  const next = current.includes(itemId)
    ? current.filter((id) => id !== itemId)
    : [...current, itemId];
  $soldOutItemIds.set(next);
}

export function setItemSoldOut(itemId: string, isSoldOut: boolean): void {
  const current = $soldOutItemIds.get();
  const exists = current.includes(itemId);
  if (isSoldOut && !exists) {
    $soldOutItemIds.set([...current, itemId]);
  } else if (!isSoldOut && exists) {
    $soldOutItemIds.set(current.filter((id) => id !== itemId));
  }
}

export function toggleItemSoldOutByNumber(itemNumber: number): boolean {
  const items = $items.get();
  for (const group of items) {
    for (const child of group.children) {
      if (child.itemNumber === itemNumber) {
        toggleItemSoldOut(child.id);
        return true;
      }
    }
  }
  return false;
}
