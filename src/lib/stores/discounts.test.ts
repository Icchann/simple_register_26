import { describe, expect, it } from "bun:test";
import DISCOUNTS from "~/data/discount.json";
import ITEM_GROUPS from "~/data/item_groups.json";

describe("discount amount integrity", () => {
  it("商品価格を上回る割引が存在せず、支払い金額がマイナスにならないことを保証する", () => {
    const allItems = ITEM_GROUPS.flatMap((group) => group.children);

    for (const discount of DISCOUNTS) {
      for (const [itemId, discountAmount] of Object.entries(discount.amount)) {
        const item = allItems.find((it) => it.id === itemId);
        expect(item).toBeDefined();
        if (item) {
          // 割引額が商品定価を超過していないことをコード（テスト）で厳格に保証
          // 超過している場合はテストが落ちてビルド・コミットが阻止される
          expect(discountAmount).toBeLessThanOrEqual(item.price);
        }
      }
    }
  });
});
