import type { Order } from "@/types/order";
import { format } from "@formkit/tempo";
import { match } from "ts-pattern";
import { ItemImpl } from "@/lib/item";
import { OrderStatusImpl } from "@/lib/order";

function formatJst(isoString: string | null | undefined): string {
  if (isoString == null || isoString === "") {
    return "";
  }
  try {
    return format(new Date(isoString), "YYYY-MM-DD HH:mm:ss");
  } catch {
    return isoString;
  }
}

/**
 * スプレッドシートの数式インジェクション（Formula Injection）を無害化する
 * 先頭が '=', '+', '-', '@', '\t', '\r' で始まる非数値文字列の場合、
 * 先頭にシングルクォーテーション "'" を付与してテキストリテラルとして安全に評価させる
 */
function sanitizeFormulaInjection(value: string): string {
  if (value.length === 0) {
    return "";
  }
  const firstChar = value.charAt(0);
  // 純粋な数値（金額など負の数を含む）は除外
  if (/^-?\d+(?:\.\d+)?$/.test(value)) {
    return value;
  }
  if (
    firstChar === "="
    || firstChar === "+"
    || firstChar === "-"
    || firstChar === "@"
    || firstChar === "\t"
    || firstChar === "\r"
  ) {
    return `'${value}`;
  }
  return value;
}

function escapeCsvValue(val: unknown): string {
  if (val == null) {
    return "";
  }
  const safeStr = sanitizeFormulaInjection(String(val));
  if (safeStr.includes(",") || safeStr.includes("\"") || safeStr.includes("\n") || safeStr.includes("\r")) {
    return `"${safeStr.replace(/"/g, "\"\"")}"`;
  }
  return safeStr;
}

function escapeTsvValue(val: unknown): string {
  if (val == null) {
    return "";
  }
  const safeStr = sanitizeFormulaInjection(String(val));
  return safeStr.replace(/\t/g, " ").replace(/[\r\n]+/g, " ");
}

/**
 * 【会計用】売上伝票一覧（レジ締め・出納・売上報告専用）
 * 調理時間や味などの現場用情報はすべて除去し、会計・金銭授受のみを整理した行列
 */
export function buildAccountingRows(orders: readonly Order[]): string[][] {
  const headers = [
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
  ];

  const rows: string[][] = [headers];

  let recordNo = 1;
  let salesCount = 0;
  let refundCount = 0;
  let totalEffectiveItems = 0;
  let totalEffectiveSubtotal = 0;
  let totalEffectiveDiscount = 0;
  let totalSalesCharge = 0;
  let totalRefundCharge = 0;
  let totalDeposit = 0;
  let totalChange = 0;

  for (const order of orders) {
    // 確定日時（statusChange の initialStatus 遷移時刻、なければ createdAt）
    const confirmedEntry = order.statusChange.find((sc) => sc.to !== "UNCONFIRMED");
    const confirmedAt = confirmedEntry?.at ?? order.createdAt;

    // 会計区分（売上 / 返金 / 取消 / 未確定）
    const category = match(order.status)
      .with("REFUNDED", () => "返金")
      .with("CANCELED", () => "取消")
      .with("UNCONFIRMED", () => "未確定")
      .otherwise(() => "売上");

    let totalItemCount = 0;
    let subtotalAmount = 0;
    let totalDiscountAmount = 0;

    for (const item of order.items) {
      totalItemCount += item.amount;
      subtotalAmount += item.price * item.amount;
      if (order.appliedDiscount?.amount != null) {
        const itemDiscount = order.appliedDiscount.amount[item.id] ?? 0;
        totalDiscountAmount += itemDiscount * item.amount;
      }
    }

    const totalCharge = Math.max(0, subtotalAmount - totalDiscountAmount);
    const change = Math.max(0, order.depositAmount - totalCharge);

    // 集計加算
    if (category === "売上") {
      salesCount++;
      totalEffectiveItems += totalItemCount;
      totalEffectiveSubtotal += subtotalAmount;
      totalEffectiveDiscount += totalDiscountAmount;
      totalSalesCharge += totalCharge;
      totalDeposit += order.depositAmount;
      totalChange += change;
    } else if (category === "返金") {
      refundCount++;
      totalRefundCharge += totalCharge;
    }

    rows.push([
      String(recordNo++),
      formatJst(confirmedAt),
      category,
      String(totalItemCount),
      String(subtotalAmount),
      order.appliedDiscount?.name ?? "",
      String(totalDiscountAmount),
      String(totalCharge),
      String(order.depositAmount),
      String(change),
    ]);
  }

  // 最終行: 今回の売上合計行
  const netSales = Math.max(0, totalSalesCharge - totalRefundCharge);
  const categorySummary = refundCount > 0
    ? `売上${salesCount}件/返金${refundCount}件`
    : `売上${salesCount}件`;

  rows.push([
    "合計（今回の売上）",
    "",
    categorySummary,
    String(totalEffectiveItems),
    String(totalEffectiveSubtotal),
    "",
    String(totalEffectiveDiscount),
    String(netSales),
    String(totalDeposit),
    String(totalChange),
  ]);

  return rows;
}

/**
 * 【全売上データ】商品明細一覧（詳細・ピボット分析用）
 */
export function buildItemDetailRows(orders: readonly Order[]): string[][] {
  const headers = [
    "注文ID",
    "受付番号",
    "受付日時",
    "注文確定日時",
    "ステータス",
    "有効売上フラグ",
    "商品グループ",
    "商品名",
    "味・トッピング",
    "単価",
    "数量",
    "小計金額",
    "適用割引名",
    "商品別割引額",
    "実質売上金額",
  ];

  const rows: string[][] = [headers];

  for (const order of orders) {
    const isEffective = ["PICKED_UP", "WAITING_PICKUP", "WAITING_COOKING"].includes(order.status) ? "1" : "0";
    const statusLabel = OrderStatusImpl(order.status).toLabelStr();
    const confirmedEntry = order.statusChange.find((sc) => sc.to !== "UNCONFIRMED");
    const confirmedAt = confirmedEntry?.at ?? order.createdAt;

    for (const item of order.items) {
      const itemGroup = ItemImpl(item).getGroup()?.name ?? "";
      const flavorStr = item.flavors && item.flavors.length > 0 ? item.flavors.join(", ") : "";
      const subtotal = item.price * item.amount;

      let discountAmount = 0;
      if (order.appliedDiscount?.amount != null) {
        const perItemDiscount = order.appliedDiscount.amount[item.id] ?? 0;
        discountAmount = perItemDiscount * item.amount;
      }
      const netAmount = Math.max(0, subtotal - discountAmount);

      rows.push([
        order.id,
        String(order.receiptNumber).padStart(2, "0"),
        formatJst(order.createdAt),
        formatJst(confirmedAt),
        statusLabel,
        isEffective,
        itemGroup,
        item.name,
        flavorStr,
        String(item.price),
        String(item.amount),
        String(subtotal),
        order.appliedDiscount?.name ?? "",
        String(discountAmount),
        String(netAmount),
      ]);
    }
  }

  return rows;
}

/**
 * 【全売上データ】注文サマリー一覧（調理時間・運用分析用）
 */
export function buildOrderSummaryRows(orders: readonly Order[]): string[][] {
  const headers = [
    "注文ID",
    "受付番号",
    "受付日時",
    "注文確定日時",
    "ステータス",
    "有効売上フラグ",
    "注文内容サマリ",
    "商品合計点数",
    "小計金額",
    "適用割引名",
    "割引合計額",
    "請求金額(合計)",
    "預かり金額",
    "お釣り",
    "調理時間(分)",
    "提供総時間(分)",
  ];

  const rows: string[][] = [headers];

  for (const order of orders) {
    const isEffective = ["PICKED_UP", "WAITING_PICKUP", "WAITING_COOKING"].includes(order.status) ? "1" : "0";
    const statusLabel = OrderStatusImpl(order.status).toLabelStr();

    const confirmedEntry = order.statusChange.find((sc) => sc.to !== "UNCONFIRMED");
    const confirmedAt = confirmedEntry?.at ?? order.createdAt;

    const cookingCompleteEntry = order.statusChange.find((sc) => sc.to === "WAITING_PICKUP");
    const pickedUpEntry = order.statusChange.find((sc) => sc.to === "PICKED_UP");

    let cookingTime = "";
    if (cookingCompleteEntry?.at != null && cookingCompleteEntry.at !== "") {
      const diffMin = (new Date(cookingCompleteEntry.at).getTime() - new Date(confirmedAt).getTime()) / 60000;
      cookingTime = diffMin > 0 ? diffMin.toFixed(1) : "0.0";
    }

    let totalTime = "";
    if (pickedUpEntry?.at != null && pickedUpEntry.at !== "") {
      const diffMin = (new Date(pickedUpEntry.at).getTime() - new Date(confirmedAt).getTime()) / 60000;
      totalTime = diffMin > 0 ? diffMin.toFixed(1) : "0.0";
    }

    let totalItems = 0;
    let subtotalAmount = 0;
    let totalDiscountAmount = 0;
    const summaryParts: string[] = [];

    for (const item of order.items) {
      totalItems += item.amount;
      subtotalAmount += item.price * item.amount;
      const flavorText = item.flavors != null && item.flavors.length > 0 ? `(${item.flavors.join(",")})` : "";
      summaryParts.push(`${item.name}${flavorText}x${item.amount}`);

      if (order.appliedDiscount?.amount != null) {
        const d = order.appliedDiscount.amount[item.id] ?? 0;
        totalDiscountAmount += d * item.amount;
      }
    }

    const totalCharge = Math.max(0, subtotalAmount - totalDiscountAmount);
    const change = Math.max(0, order.depositAmount - totalCharge);

    rows.push([
      order.id,
      String(order.receiptNumber).padStart(2, "0"),
      formatJst(order.createdAt),
      formatJst(confirmedAt),
      statusLabel,
      isEffective,
      summaryParts.join(", "),
      String(totalItems),
      String(subtotalAmount),
      order.appliedDiscount?.name ?? "",
      String(totalDiscountAmount),
      String(totalCharge),
      String(order.depositAmount),
      String(change),
      cookingTime,
      totalTime,
    ]);
  }

  return rows;
}

export function matrixToTsv(matrix: string[][]): string {
  return matrix.map((row) => row.map(escapeTsvValue).join("\t")).join("\r\n");
}

export function matrixToCsv(matrix: string[][]): string {
  return matrix.map((row) => row.map(escapeCsvValue).join(",")).join("\r\n");
}

export function createCsvBlob(csvText: string): Blob {
  const bom = new Uint8Array([0xEF, 0xBB, 0xBF]);
  return new Blob([bom, csvText], { type: "text/csv;charset=utf-8;" });
}
