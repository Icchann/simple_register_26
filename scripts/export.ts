import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { Order } from "../src/types/order";
import {
  buildAccountingRows,
  buildItemDetailRows,
  buildOrderSummaryRows,
  matrixToCsv,
  matrixToTsv,
} from "../src/lib/export/spreadsheet";

const args = process.argv.slice(2);
const formatArg = args.find((a) => a.startsWith("--format="))?.split("=")[1] ?? "csv";
const outDirArg = args.find((a) => a.startsWith("--out="))?.split("=")[1] ?? "./exports";
const typeArg = args.find((a) => a.startsWith("--type="))?.split("=")[1] ?? "accounting";
const sourceFileArg = args.find((a) => a.startsWith("--file="))?.split("=")[1] ?? "./data/orders_backup.json";

async function main(): Promise<void> {
  console.log("🚀 シス研シンプルレジ エクスポートツール");

  const sourcePath = resolve(process.cwd(), sourceFileArg);
  if (!existsSync(sourcePath)) {
    console.warn(`⚠️ データファイルが見つかりません: ${sourcePath}`);
    console.warn("   ブラウザ/アプリで起動した画面の「スプレッドシート出力」から出力するか、--file で指定してください。");
    process.exit(1);
  }

  const rawJson = readFileSync(sourcePath, "utf-8");
  let parsed: unknown;
  try {
    parsed = JSON.parse(rawJson);
  } catch (e) {
    console.error("❌ JSON のパースに失敗しました:", e);
    process.exit(1);
  }

  const orders = parsed as Order[];
  console.log(`📦 読み込み完了: 全 ${orders.length} 件の注文データ`);

  const outDir = resolve(process.cwd(), outDirArg);
  if (!existsSync(outDir)) {
    mkdirSync(outDir, { recursive: true });
  }

  const timestamp = new Date().toISOString().replace(/[-:T]/g, "").slice(0, 14);
  const isCsv = formatArg.toLowerCase() === "csv";
  const ext = isCsv ? "csv" : "tsv";

  if (typeArg === "accounting" || typeArg === "all") {
    // 【会計用】
    const accountingRows = buildAccountingRows(orders);
    const content = isCsv ? "\uFEFF" + matrixToCsv(accountingRows) : matrixToTsv(accountingRows);
    const filePath = resolve(outDir, `accounting_${timestamp}.${ext}`);
    writeFileSync(filePath, content, "utf-8");
    console.log(`✅ 【会計用】データを出力しました: ${filePath}`);
  }

  if (typeArg === "full" || typeArg === "all") {
    // 【全売上データ】
    const itemRows = buildItemDetailRows(orders);
    const itemContent = isCsv ? "\uFEFF" + matrixToCsv(itemRows) : matrixToTsv(itemRows);
    const itemFile = resolve(outDir, `full_sales_items_${timestamp}.${ext}`);
    writeFileSync(itemFile, itemContent, "utf-8");
    console.log(`✅ 【全売上データ(商品別)】を出力しました: ${itemFile}`);

    const summaryRows = buildOrderSummaryRows(orders);
    const summaryContent = isCsv ? "\uFEFF" + matrixToCsv(summaryRows) : matrixToTsv(summaryRows);
    const summaryFile = resolve(outDir, `full_sales_orders_${timestamp}.${ext}`);
    writeFileSync(summaryFile, summaryContent, "utf-8");
    console.log(`✅ 【全売上データ(注文別)】を出力しました: ${summaryFile}`);
  }

  console.log("🎉 出力が完了しました。スプレッドシートでご利用ください。");
}

main().catch((err) => {
  console.error("致命的なエラー:", err);
  process.exit(1);
});
