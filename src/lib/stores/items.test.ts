import { beforeEach, describe, expect, it } from "bun:test";
import { findItemByNumber } from "./current-order";
import {
  $items,
  $soldOutDate,
  $soldOutItemIds,
  checkAndResetSoldOutForNewDay,
  getTodayDateString,
  resetAllSoldOutItems,
  setItemSoldOut,
  soldOutStorageCoder,
  toggleItemSoldOut,
  toggleItemSoldOutByNumber,
} from "./items";

describe("items store sold-out management", () => {
  beforeEach(() => {
    $soldOutItemIds.set([]);
  });

  it("toggles item sold-out status by id", () => {
    const allItems = $items.get();
    const targetItem = allItems[0]?.children[0];
    expect(targetItem).toBeDefined();
    if (!targetItem) {
      return;
    }

    expect(targetItem.isSoldOut).toBe(false);

    toggleItemSoldOut(targetItem.id);
    expect($soldOutItemIds.get()).toContain(targetItem.id);

    const updatedItems = $items.get();
    const updatedTarget = updatedItems[0]?.children.find((c) => c.id === targetItem.id);
    expect(updatedTarget?.isSoldOut).toBe(true);

    toggleItemSoldOut(targetItem.id);
    expect($soldOutItemIds.get()).not.toContain(targetItem.id);

    const revertedItems = $items.get();
    const revertedTarget = revertedItems[0]?.children.find((c) => c.id === targetItem.id);
    expect(revertedTarget?.isSoldOut).toBe(false);
  });

  it("toggles item sold-out status by item number", () => {
    const allItems = $items.get();
    const targetItem = allItems[0]?.children[1];
    expect(targetItem).toBeDefined();
    if (!targetItem) {
      return;
    }

    const success = toggleItemSoldOutByNumber(targetItem.itemNumber);
    expect(success).toBe(true);
    expect($soldOutItemIds.get()).toContain(targetItem.id);

    const found = findItemByNumber(targetItem.itemNumber);
    expect(found?.isSoldOut).toBe(true);

    toggleItemSoldOutByNumber(targetItem.itemNumber);
    const foundAfter = findItemByNumber(targetItem.itemNumber);
    expect(foundAfter?.isSoldOut).toBe(false);
  });

  it("sets item sold-out explicitly", () => {
    const allItems = $items.get();
    const targetItem = allItems[1]?.children[0];
    expect(targetItem).toBeDefined();
    if (!targetItem) {
      return;
    }

    setItemSoldOut(targetItem.id, true);
    expect($soldOutItemIds.get()).toContain(targetItem.id);

    setItemSoldOut(targetItem.id, true); // idempotent
    expect($soldOutItemIds.get().filter((id) => id === targetItem.id).length).toBe(1);

    setItemSoldOut(targetItem.id, false);
    expect($soldOutItemIds.get()).not.toContain(targetItem.id);
  });
  it("safely handles corrupted, malformed, or invalid localStorage data", () => {
    const allItems = $items.get();
    const validId = allItems[0]?.children[0]?.id;
    expect(validId).toBeDefined();
    if (!validId) {
      return;
    }

    // Corrupted JSON
    expect(soldOutStorageCoder.decode("{invalid-json")).toEqual([]);
    expect(soldOutStorageCoder.decode("undefined")).toEqual([]);
    expect(soldOutStorageCoder.decode("")).toEqual([]);

    // Invalid types (non-string arrays)
    expect(soldOutStorageCoder.decode("[123, 456]")).toEqual([]);
    expect(soldOutStorageCoder.decode("{\"some\": \"object\"}")).toEqual([]);
    expect(soldOutStorageCoder.decode("123")).toEqual([]);

    // Obsolete/unknown IDs are filtered out
    expect(soldOutStorageCoder.decode(JSON.stringify([validId, "non-existent-ghost-id"]))).toEqual([validId]);

    // Safe encoding filters invalid IDs
    const encoded = soldOutStorageCoder.encode([validId, "random-fake-id"]);
    expect(JSON.parse(encoded)).toEqual([validId]);
  });

  it("resets all sold-out items completely for the next day", () => {
    const allItems = $items.get();
    const item1 = allItems[0]?.children[0];
    const item2 = allItems[0]?.children[1];
    expect(item1).toBeDefined();
    expect(item2).toBeDefined();
    if (!item1 || !item2) {
      return;
    }

    setItemSoldOut(item1.id, true);
    setItemSoldOut(item2.id, true);
    expect($soldOutItemIds.get()).toHaveLength(2);

    // Reset all sold-out items
    resetAllSoldOutItems();
    expect($soldOutItemIds.get()).toHaveLength(0);

    const itemsAfter = $items.get();
    const after1 = itemsAfter[0]?.children.find((c) => c.id === item1.id);
    const after2 = itemsAfter[0]?.children.find((c) => c.id === item2.id);
    expect(after1?.isSoldOut).toBe(false);
    expect(after2?.isSoldOut).toBe(false);
    expect($soldOutDate.get()).toBe(getTodayDateString());
  });

  it("automatically resets sold-out items when the date changes to a new day", () => {
    const allItems = $items.get();
    const item1 = allItems[0]?.children[0];
    expect(item1).toBeDefined();
    if (!item1) {
      return;
    }

    setItemSoldOut(item1.id, true);
    expect($soldOutItemIds.get()).toContain(item1.id);

    // Same day check -> should not reset
    const today = getTodayDateString();
    $soldOutDate.set(today);
    const didResetSameDay = checkAndResetSoldOutForNewDay(today);
    expect(didResetSameDay).toBe(false);
    expect($soldOutItemIds.get()).toContain(item1.id);

    // Next day check (simulate tomorrow's date)
    const didResetNextDay = checkAndResetSoldOutForNewDay("2099-12-31");
    expect(didResetNextDay).toBe(true);
    expect($soldOutItemIds.get()).toHaveLength(0);
    expect($soldOutDate.get()).toBe("2099-12-31");
  });

  it("formats date strings consistently as YYYY-MM-DD", () => {
    const testDate = new Date(2026, 9, 10); // 2026-10-10
    expect(getTodayDateString(testDate)).toBe("2026-10-10");
  });
});
