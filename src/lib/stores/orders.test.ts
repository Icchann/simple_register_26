import { describe, expect, it } from "bun:test";
import { type } from "arktype";
import { DANGO_FLAVORS, DangoFlavorImpl, orderRequiresCooking } from "@/lib/order";
import { MAX_ORDER_ITEM_AMOUNT, Order, OrderItemAmount } from "@/types/order";
import { $items } from "./items";
import { $orders, changeOrderStatus } from "./orders";

describe("changeOrderStatus with duplicate receipt numbers", () => {
  it("transitions duplicate receipt numbers in FIFO order without getting stuck", () => {
    const order1 = Order.assert({
      id: "a00000000000000000000001",
      receiptNumber: 1,
      createdAt: "2026-10-10T10:00:00.000Z",
      status: "WAITING_COOKING",
      statusChange: [
        { to: "UNCONFIRMED", at: "2026-10-10T10:00:00.000Z" },
        { to: "WAITING_COOKING", at: "2026-10-10T10:01:00.000Z" },
      ],
      items: [],
      depositAmount: 1000,
      appliedDiscount: null,
    });

    const order2 = Order.assert({
      id: "a00000000000000000000002",
      receiptNumber: 1,
      createdAt: "2026-10-10T10:05:00.000Z",
      status: "WAITING_COOKING",
      statusChange: [
        { to: "UNCONFIRMED", at: "2026-10-10T10:05:00.000Z" },
        { to: "WAITING_COOKING", at: "2026-10-10T10:06:00.000Z" },
      ],
      items: [],
      depositAmount: 1000,
      appliedDiscount: null,
    });

    // Initialize store with two orders having identical receiptNumber
    $orders.set([order1, order2]);

    // 1st cooking complete -> should transition oldest order (order1)
    const success1 = changeOrderStatus(1, "WAITING_PICKUP");
    expect(success1).toBe(true);

    const ordersAfterFirst = $orders.get();
    const updated1 = ordersAfterFirst.find((o) => o.id === "a00000000000000000000001");
    const updated2 = ordersAfterFirst.find((o) => o.id === "a00000000000000000000002");
    expect(updated1?.status).toBe("WAITING_PICKUP");
    expect(updated2?.status).toBe("WAITING_COOKING");

    // 2nd cooking complete -> should transition remaining order (order2)
    const success2 = changeOrderStatus(1, "WAITING_PICKUP");
    expect(success2).toBe(true);

    const ordersAfterSecond = $orders.get();
    const secondUpdated1 = ordersAfterSecond.find((o) => o.id === "a00000000000000000000001");
    const secondUpdated2 = ordersAfterSecond.find((o) => o.id === "a00000000000000000000002");
    expect(secondUpdated1?.status).toBe("WAITING_PICKUP");
    expect(secondUpdated2?.status).toBe("WAITING_PICKUP");

    // 3rd cooking complete -> should return false since none in WAITING_COOKING
    const success3 = changeOrderStatus(1, "WAITING_PICKUP");
    expect(success3).toBe(false);

    // 1st pickup complete -> should transition oldest order in WAITING_PICKUP (order1)
    const pickupSuccess1 = changeOrderStatus(1, "PICKED_UP");
    expect(pickupSuccess1).toBe(true);
    expect($orders.get().find((o) => o.id === "a00000000000000000000001")?.status).toBe("PICKED_UP");
    expect($orders.get().find((o) => o.id === "a00000000000000000000002")?.status).toBe("WAITING_PICKUP");

    // 2nd pickup complete -> should transition order2
    const pickupSuccess2 = changeOrderStatus(1, "PICKED_UP");
    expect(pickupSuccess2).toBe(true);
    expect($orders.get().find((o) => o.id === "a00000000000000000000002")?.status).toBe("PICKED_UP");
    // 3rd pickup complete -> should return false
    const pickupSuccess3 = changeOrderStatus(1, "PICKED_UP");
    expect(pickupSuccess3).toBe(false);
  });
});

describe("OrderItemAmount and 0-amount items", () => {
  it("accepts 0 and MAX_ORDER_ITEM_AMOUNT (100) but rejects negative or >100", () => {
    expect(MAX_ORDER_ITEM_AMOUNT).toBe(100);

    // 0 is valid (used to clear items)
    expect(OrderItemAmount(0) instanceof type.errors).toBe(false);
    // 100 is valid
    expect(OrderItemAmount(100) instanceof type.errors).toBe(false);

    // Negative is invalid
    expect(OrderItemAmount(-1) instanceof type.errors).toBe(true);
    // >100 is invalid
    expect(OrderItemAmount(101) instanceof type.errors).toBe(true);
  });
});

describe("orderRequiresCooking for drink-only orders", () => {
  it("returns false for cans and plastic bottles (no cooking needed)", () => {
    const items = $items.get();
    const canGroup = items.find((g) => g.name === "缶ジュース");
    const bottleGroup = items.find((g) => g.name === "ペットボトル");
    const canItem = canGroup?.children[0];
    const bottleItem = bottleGroup?.children[0];
    expect(canItem).toBeDefined();
    expect(bottleItem).toBeDefined();

    if (!canItem || !bottleItem) {
      return;
    }
    expect(orderRequiresCooking([{ id: canItem.id }, { id: bottleItem.id }])).toBe(false);
  });

  it("returns true when order includes dango items", () => {
    const items = $items.get();
    const dangoGroup = items.find((g) => g.name === "だんご");
    const canGroup = items.find((g) => g.name === "缶ジュース");
    const dangoItem = dangoGroup?.children[0];
    const canItem = canGroup?.children[0];
    expect(dangoItem).toBeDefined();
    if (!dangoItem) {
      return;
    }

    expect(orderRequiresCooking([{ id: dangoItem.id }])).toBe(true);
    if (canItem) {
      expect(orderRequiresCooking([{ id: dangoItem.id }, { id: canItem.id }])).toBe(true);
    }
  });
});

describe("DANGO_FLAVORS and 味なし", () => {
  it("includes 味なし with key 0 and gray color", () => {
    const plainFlavor = DANGO_FLAVORS.find((f) => f.name === "味なし");
    expect(plainFlavor).toBeDefined();
    expect(plainFlavor?.key).toBe("0");

    const color = DangoFlavorImpl("味なし").toColor();
    expect(color.bg).toBe("gray.100");
  });

  it("supports pairing 味なし with other flavors (half unflavored)", () => {
    const halfUnflavored = ["きなこ", "味なし"];
    expect(halfUnflavored).toHaveLength(2);
    expect(halfUnflavored).toContain("味なし");
    expect(halfUnflavored).toContain("きなこ");
  });
});
