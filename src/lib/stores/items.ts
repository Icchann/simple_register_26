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

export function getTodayDateString(d: Date = new Date()): string {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function getInitialSoldOutIds(): string[] {
  if (typeof window === "undefined" || typeof localStorage === "undefined") {
    return [];
  }
  try {
    const today = getTodayDateString();
    const savedDate = localStorage.getItem(getLocalStorageKey("soldOutDate"));
    // 保存されている日付が本日と異なる場合は、次の日の営業とみなして売り切れをクリア
    if (savedDate != null && savedDate !== today) {
      localStorage.removeItem(getLocalStorageKey("soldOutItemIds"));
      localStorage.setItem(getLocalStorageKey("soldOutDate"), today);
      return [];
    }
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

export const $soldOutDate = persistentAtom<string>(
  getLocalStorageKey("soldOutDate"),
  typeof window !== "undefined" && typeof localStorage !== "undefined"
    ? (localStorage.getItem(getLocalStorageKey("soldOutDate")) ?? getTodayDateString())
    : getTodayDateString(),
);

export const $soldOutItemIds = persistentAtom<string[]>(
  getLocalStorageKey("soldOutItemIds"),
  getInitialSoldOutIds(),
  coder,
);

/**
 * 日付が変わった（次の日になった）場合に売り切れ状態を自動クリアする
 */
export function checkAndResetSoldOutForNewDay(currentDateStr?: string): boolean {
  const today = currentDateStr ?? getTodayDateString();
  const savedDate = $soldOutDate.get();
  if (savedDate !== today) {
    $soldOutItemIds.set([]);
    $soldOutDate.set(today);
    return true;
  }
  return false;
}

/**
 * すべての商品の売り切れ状態をリセット（すべて「販売中」に戻す）
 */
export function resetAllSoldOutItems(): void {
  $soldOutItemIds.set([]);
  $soldOutDate.set(getTodayDateString());
}

// アプリ起動中に日付を跨いだ場合の自動リセットチェック（1分周期）
if (typeof window !== "undefined") {
  window.setInterval(() => {
    checkAndResetSoldOutForNewDay();
  }, 60_000);
}
function buildItems(soldOutIds: readonly string[]): ItemGroupWithItemNumber[] {
  return ITEM_GROUPS.map((data, groupIdx) => {
    const dataWithItemNumber = {
      ...data,
      children: data.children.map((child, itemIdx) => ({
        ...child,
        itemNumber: child.name === "増量" ? 90 : groupIdx * 10 + itemIdx,
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
  checkAndResetSoldOutForNewDay();
  const current = $soldOutItemIds.get();
  const next = current.includes(itemId)
    ? current.filter((id) => id !== itemId)
    : [...current, itemId];
  $soldOutItemIds.set(next);
  $soldOutDate.set(getTodayDateString());
}

export function setItemSoldOut(itemId: string, isSoldOut: boolean): void {
  checkAndResetSoldOutForNewDay();
  const current = $soldOutItemIds.get();
  const exists = current.includes(itemId);
  if (isSoldOut && !exists) {
    $soldOutItemIds.set([...current, itemId]);
    $soldOutDate.set(getTodayDateString());
  } else if (!isSoldOut && exists) {
    $soldOutItemIds.set(current.filter((id) => id !== itemId));
    $soldOutDate.set(getTodayDateString());
  }
}

export function toggleItemSoldOutByNumber(itemNumber: number): boolean {
  checkAndResetSoldOutForNewDay();
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
