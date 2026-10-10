import type { Order } from "@/types/order";
import type { Nullable } from "@/types/utils";
import { persistentAtom } from "@nanostores/persistent";
import { match } from "ts-pattern";
import { getLocalStorageKey } from "@/lib/consts";
import { waitMs } from "..";

const coder = {
  encode: JSON.stringify,
  decode: JSON.parse,
};

export const $orders = persistentAtom<Order[]>(
  getLocalStorageKey("orders"),
  [],
  coder,
);

// 受付番号によるインデックス（パフォーマンス最適化用）
// receiptNumber -> { order: Order, index: number }[]のマッピング
const receiptNumberIndex = new Map<
  number,
  Array<{ order: Order; index: number }>
>();

// インデックスを構築する関数
function buildReceiptNumberIndex(orders: readonly Order[]): void {
  receiptNumberIndex.clear();

  orders.forEach((order, index) => {
    const receiptNumber = order.receiptNumber;
    const existing = receiptNumberIndex.get(receiptNumber) || [];
    existing.push({ order, index });
    receiptNumberIndex.set(receiptNumber, existing);
  });

  // 各受付番号のグループをcreatedAtで事前にソート（昇順、最古が先頭: FIFO）
  for (const [, orderGroup] of receiptNumberIndex) {
    orderGroup.sort((a, b) => {
      const dateA = new Date(a.order.createdAt).getTime();
      const dateB = new Date(b.order.createdAt).getTime();
      return dateA - dateB; // 昇順 (FIFO)
    });
  }
}

// $ordersの変更を監視してインデックスを更新
$orders.subscribe((orders) => {
  buildReceiptNumberIndex(orders);
});

// 初期化時にインデックスを構築
buildReceiptNumberIndex($orders.get());

// 最後に確定された注文のIDを追跡（ハイライト用）
export const $lastConfirmedOrderId = persistentAtom<Nullable<string>>(
  getLocalStorageKey("lastConfirmedOrderId"),
  null,
  coder,
);

// 最後にステータス変更された注文の受付番号を追跡（ハイライト用）
export const $lastStatusChangedReceiptNumber = persistentAtom<Nullable<number>>(
  getLocalStorageKey("lastStatusChangedReceiptNumber"),
  null,
  coder,
);

// 注文ステータスを変更する関数
export function changeOrderStatus(
  receiptNumber: number,
  newStatus: Order["status"],
): boolean {
  // Mapインデックスから該当する注文を取得
  const matchingOrders = receiptNumberIndex.get(receiptNumber);

  if (!matchingOrders || matchingOrders.length === 0) {
    return false;
  }

  // 遷移元として有効なステータスを持つ最古の注文を探す (FIFO)
  const validSourceStatuses: ReadonlyArray<Order["status"]> = match(newStatus)
    .with("WAITING_PICKUP", () => ["WAITING_COOKING"] as const)
    .with("PICKED_UP", () => ["WAITING_PICKUP"] as const)
    .with("WAITING_COOKING", () => ["UNCONFIRMED"] as const)
    .with("REFUNDED", () => ["WAITING_COOKING", "WAITING_PICKUP", "PICKED_UP"] as const)
    .with("CANCELED", () => ["UNCONFIRMED", "WAITING_COOKING", "WAITING_PICKUP"] as const)
    .with("UNCONFIRMED", () => [] as const)
    .exhaustive();
  const targetCandidate = matchingOrders.find(({ order }) =>
    validSourceStatuses.includes(order.status),
  );

  if (!targetCandidate) {
    return false;
  }

  const { order } = targetCandidate;
  const orders = $orders.get();
  const actualIndex = orders.findIndex((o) => o.id === order.id);

  if (actualIndex === -1) {
    return false;
  }

  const currentOrder = orders[actualIndex]!;
  const updatedOrders = [...orders];
  updatedOrders[actualIndex] = {
    ...currentOrder,
    status: newStatus,
    statusChange: [
      ...currentOrder.statusChange,
      {
        to: newStatus,
        at: new Date().toISOString(),
      },
    ],
  };

  $orders.set(updatedOrders);

  // ハイライト用に受付番号を記録
  $lastStatusChangedReceiptNumber.set(null);
  void waitMs(300).then(() => {
    $lastStatusChangedReceiptNumber.set(receiptNumber);
  });

  return true;
}
