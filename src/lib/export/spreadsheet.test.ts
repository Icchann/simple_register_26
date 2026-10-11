import { describe, expect, it } from "bun:test";
import { Order } from "@/types/order";
import {
  buildAccountingRows,
  buildItemDetailRows,
  matrixToCsv,
  matrixToTsv,
} from "./spreadsheet";

describe("spreadsheet export functions", () => {
  const dummyOrder = Order.assert({
    id: "ord_test_001",
    receiptNumber: 1,
    createdAt: "2026-10-10T10:15:00.000Z",
    status: "PICKED_UP",
    statusChange: [
      { to: "UNCONFIRMED", at: "2026-10-10T10:15:00.000Z" },
      { to: "WAITING_COOKING", at: "2026-10-10T10:15:30.000Z" },
      { to: "WAITING_PICKUP", at: "2026-10-10T10:17:30.000Z" },
      { to: "PICKED_UP", at: "2026-10-10T10:19:00.000Z" },
    ],
    items: [
      {
        id: "item_test_001",
        name: "みたらし",
        price: 150,
        amount: 2,
        flavors: ["みたらし"],
      },
    ],
    depositAmount: 500,
    appliedDiscount: null,
  });

  it("builds accounting rows with financial columns only and total row at the end", () => {
    const rows = buildAccountingRows([dummyOrder]);
    expect(rows).toHaveLength(3); // Header + 1 data row + 1 total row

    const headers = rows[0];
    expect(headers).toEqual([
      "No",
      "会計日時",
      "区分",
      "点数",
      "小計金額",
      "割引名",
      "割引額",
      "請求金額",
      "預かり金額",
      "お釣り",
    ]);

    const dataRow = rows[1];
    expect(dataRow?.[0]).toBe("1"); // No
    expect(dataRow?.[2]).toBe("売上"); // 区分
    expect(dataRow?.[3]).toBe("2"); // 点数
    expect(dataRow?.[4]).toBe("300"); // 小計
    expect(dataRow?.[6]).toBe("0"); // 割引額
    expect(dataRow?.[7]).toBe("300"); // 請求金額
    expect(dataRow?.[8]).toBe("500"); // 預かり金額
    expect(dataRow?.[9]).toBe("200"); // お釣り

    const totalRow = rows[2];
    expect(totalRow?.[0]).toBe("合計（今回の売上）");
    expect(totalRow?.[2]).toBe("売上1件");
    expect(totalRow?.[3]).toBe("2"); // 総点数
    expect(totalRow?.[7]).toBe("300"); // 今回の売上（請求金額合計）
    expect(totalRow?.[8]).toBe("500"); // 預かり金額合計
    expect(totalRow?.[9]).toBe("200"); // お釣り合計
  });

  it("handles refunded orders properly in accounting rows", () => {
    const refundedOrder = Order.assert({
      ...dummyOrder,
      id: "ord_refund_002",
      status: "REFUNDED",
    });
    const rows = buildAccountingRows([refundedOrder]);
    expect(rows[1]?.[2]).toBe("返金");
  });

  it("converts matrix to TSV and CSV strings correctly", () => {
    const matrix = [
      ["A", "B,C", "D\tE"],
      ["1", "2", "3"],
    ];
    const tsv = matrixToTsv(matrix);
    expect(tsv).toContain("A\tB,C\tD E\r\n1\t2\t3");
    const csv = matrixToCsv(matrix);
    expect(csv).toContain("\"B,C\"");
  });

  it("builds full sales item detail rows with toppings", () => {
    const orderWithTopping = Order.assert({
      ...dummyOrder,
      id: "ord_topping_001",
      items: [
        {
          id: "item_test_001",
          name: "みたらし",
          price: 220,
          amount: 2,
          flavors: ["みたらし"],
          toppings: ["増量"],
        },
      ],
    });
    const rows = buildItemDetailRows([orderWithTopping]);
    expect(rows).toHaveLength(2);
    expect(rows[1]?.[8]).toBe("みたらし [増量]");
    expect(rows[1]?.[9]).toBe("220"); // 単価
    expect(rows[1]?.[11]).toBe("440"); // 小計
  });

  it("prevents formula injection while preserving pure numbers", () => {
    const injectionMatrix = [
      ["=1+1", "@calc", "+cmd", "-dangerous", "-50", "100"],
    ];
    const tsv = matrixToTsv(injectionMatrix);
    expect(tsv).toContain("'=1+1");
    expect(tsv).toContain("'@calc");
    expect(tsv).toContain("'+cmd");
    expect(tsv).toContain("'-dangerous");
    // Pure numbers should NOT be prefixed with apostrophe
    expect(tsv).toContain("-50");
    expect(tsv).not.toContain("'-50");
    expect(tsv).toContain("100");
    expect(tsv).not.toContain("'100");
  });

  it("prevents delimiter corruption and column shifting in TSV and CSV", () => {
    const trickyMatrix = [
      ["Normal", "Line\nBreak\r\n", "Tab\tSeparated", "Has,Comma", "Quote\"Inside\""],
    ];
    const tsv = matrixToTsv(trickyMatrix);
    // TSV must NOT have internal newlines or tabs in a single line
    const tsvLines = tsv.split("\r\n");
    expect(tsvLines).toHaveLength(1);
    const tsvColumns = tsvLines[0]?.split("\t");
    expect(tsvColumns).toHaveLength(5);

    const csv = matrixToCsv(trickyMatrix);
    // CSV quotes commas and internal quotes according to RFC 4180
    expect(csv).toContain("\"Has,Comma\"");
    expect(csv).toContain("\"Quote\"\"Inside\"\"\"");
  });
});
