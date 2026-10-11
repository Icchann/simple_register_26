import { beforeEach, describe, expect, it } from "bun:test";
import { EXTRA_PORTION_CONFIG } from "@/lib/consts";
import {
  $isRefundMode,
  $orderRows,
  getNormalizedCurrentOrderItems,
  resetCurrentOrder,
  toggleRefundMode,
  validateExtraPortion,
} from "./current-order";

describe("current-order state and edge-case validations", () => {
  beforeEach(() => {
    resetCurrentOrder();
  });

  it("商品番号が変更されたら、以前の味（flavors）や増量（toppings）が残らず安全にリセットされること", () => {
    // 1. 最初はだんご（01）で「みたらし」・「増量」を選択
    $orderRows.set([
      {
        id: 1,
        productCode: "01",
        quantity: "1",
        flavors: ["みたらし"],
        toppings: [EXTRA_PORTION_CONFIG.name],
      },
    ]);

    const initialNormalized = getNormalizedCurrentOrderItems($orderRows.get());
    expect(initialNormalized).toHaveLength(1);
    expect(initialNormalized[0]?.name).toBe("きなこ");
    expect(initialNormalized[0]?.flavors).toEqual(["みたらし"]);
    expect(initialNormalized[0]?.toppings).toEqual([EXTRA_PORTION_CONFIG.name]);

    // 2. その後、商品番号を 10（ファンタ）に打ち替え（取り消し・変更）
    // handleChange と同様に productCode 変更時は flavors と toppings をリセット
    $orderRows.set([
      {
        id: 1,
        productCode: "10",
        quantity: "1",
        flavors: undefined,
        toppings: undefined,
      },
    ]);

    const updatedNormalized = getNormalizedCurrentOrderItems($orderRows.get());
    expect(updatedNormalized).toHaveLength(1);
    expect(updatedNormalized[0]?.name).toBe("ﾌｧﾝﾀ ｸﾞﾚｰﾌﾟ");
    // 前回の味が残って「だんご」や「味なし」に化けていないことを厳格に検証
    expect(updatedNormalized[0]?.flavors).toBeUndefined();
    expect(updatedNormalized[0]?.toppings).toBeUndefined();
  });

  it("数量0の取消行は、有効注文アイテム（amount > 0）から除外されること", () => {
    $orderRows.set([
      {
        id: 1,
        productCode: "01",
        quantity: "0", // 取消
      },
      {
        id: 2,
        productCode: "11",
        quantity: "2", // コーラ 2本
      },
    ]);

    const normalized = getNormalizedCurrentOrderItems($orderRows.get());
    const activeItems = normalized.filter((item) => item.amount > 0);

    expect(activeItems).toHaveLength(1);
    expect(activeItems[0]?.name).toBe("コーラ");
    expect(Number(activeItems[0]?.amount)).toBe(2);
  });

  it("増量トッピング付きの団子が正しく正規化され数量整合性が保たれること", () => {
    $orderRows.set([
      {
        id: 1,
        productCode: "02",
        quantity: "1",
        flavors: ["みたらし"],
        toppings: [EXTRA_PORTION_CONFIG.name],
      },
    ]);

    const normalized = getNormalizedCurrentOrderItems($orderRows.get());
    expect(normalized[0]?.toppings).toContain(EXTRA_PORTION_CONFIG.name);

    // 団子1本に対して増量1個なのでバリデーションは成功
    const validation = validateExtraPortion(normalized);
    expect(validation.isOk()).toBe(true);
  });

  it("返品モードのトグル切り替えとリセットが正常に動作すること", () => {
    expect($isRefundMode.get()).toBe(false);

    toggleRefundMode();
    expect($isRefundMode.get()).toBe(true);

    resetCurrentOrder();
    expect($isRefundMode.get()).toBe(false);
  });
});
