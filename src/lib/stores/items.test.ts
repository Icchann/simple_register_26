import { beforeEach, describe, expect, it } from "bun:test";
import { findItemByNumber } from "./current-order";
import {
  $items,
  $soldOutItemIds,
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
});
