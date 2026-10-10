import type { ReactElement } from "react";
import type { ItemNumber } from "@/types/item";
import type { OmitStrict } from "@/types/utils";
import { useStore } from "@nanostores/react";
import { sva } from "panda/css";
import { HStack, styled as p } from "panda/jsx";
import { memo, useEffect, useMemo, useRef } from "react";
import { match, P } from "ts-pattern";
import { Expanded } from "@/components/atomic/Expanded";
import { Table } from "@/components/atomic/Table";
import { OrderStatusLabel } from "@/components/OrderStatusLabel";
import { wrapValidation } from "@/lib/arktype";
import { ItemImpl } from "@/lib/item";
import { DangoFlavorImpl, OrderStatusImpl, ReceiptNumberImpl } from "@/lib/order";
import {
  $currentOrder,
  $depositAmount,
  $discountCode,
  $normalizedCurrentOrderItems,
  findDiscountByNumber,
} from "@/lib/stores/current-order";
import { $items } from "@/lib/stores/items";
import {
  $lastConfirmedOrderId,
  $lastStatusChangedReceiptNumber,
  $orders,
} from "@/lib/stores/orders";
import { dateToStr } from "@/lib/time";
import { Discount, DiscountNumber } from "@/types/item";
import { Order } from "@/types/order";

type OrderQueueProps = {
  size?: "small" | "large";
  filterGroupId?: string;
  filterStatus?: Order["status"] | Array<Order["status"]>;
  visibleColumns?: {
    receiptNumber?: boolean;
    itemNumber?: boolean;
    itemContent?: boolean;
    status?: boolean;
    orderTime?: boolean;
    pickupTime?: boolean;
  };
};

type DisplayOrderItem = Order["items"][number] & {
  itemNumber: ItemNumber | null;
};
type DisplayOrder = OmitStrict<Order, "items"> & { items: DisplayOrderItem[] };

const orderQueueStyles = sva({
  slots: [
    "container",
    "table",
    "headerRow",
    "headerCell",
    "bodyRow",
    "bodyCell",
    "receiptNumber",
    "itemDetails",
    "orderItem",
    "itemNumber",
    "itemName",
    "itemPrice",
    "itemAmount",
  ],
  base: {
    container: {
      h: "full",
      maxH: "full",
      overflowY: "auto",
    },
    table: {
      w: "full",
    },
    headerRow: {},
    headerCell: {
      fontWeight: "bold",
      p: "2",
    },
    bodyRow: {},
    bodyCell: {
      p: "2",
    },
    receiptNumber: {
      bg: "white",
      border: "1px solid",
      ml: "auto",
      mr: "0",
      textAlign: "center",
      fontFamily: "mono",
    },
    itemDetails: {
      display: "flex",
      gap: "2",
      mt: "1",
    },
    orderItem: {
      display: "flex",
      gap: "2",
      alignItems: "center",
    },
    itemNumber: {
      fontFamily: "mono",
      fontWeight: "medium",
      textAlign: "right",
    },
    itemName: {
      flex: "1",
    },
    itemPrice: {
      textAlign: "right",
      fontFamily: "mono",
    },
    itemAmount: {
      textAlign: "center",
      fontFamily: "mono",
    },
  },
  variants: {
    size: {
      small: {
        headerCell: {
          fontSize: "sm",
        },
        bodyCell: {
          fontSize: "sm",
        },
        receiptNumber: {
          w: "[30px]",
          fontSize: "sm",
        },
        itemNumber: {
          w: "16",
          fontSize: "xs",
        },
        itemName: {
          fontSize: "xs",
        },
        itemPrice: {
          w: "20",
          fontSize: "xs",
        },
        itemAmount: {
          w: "12",
          fontSize: "xs",
        },
      },
      large: {
        headerCell: {
          fontSize: "3xl",
          p: "4",
        },
        bodyCell: {
          fontSize: "3xl",
          p: "4",
        },
        receiptNumber: {
          w: "[100px]",
          fontSize: "5xl",
          fontWeight: "bold",
          border: "3px solid",
        },
        itemNumber: {
          w: "32",
          fontSize: "4xl",
        },
        itemName: {
          fontSize: "5xl",
          fontWeight: "bold",
        },
        itemPrice: {
          w: "40",
          fontSize: "2xl",
          display: "none",
        },
        itemAmount: {
          w: "24",
          fontSize: "5xl",
        },
        itemDetails: {
          fontSize: "xl",
          gap: "4",
          mt: "2",
        },
        orderItem: {
          gap: "4",
        },
      },
    },
  },
  defaultVariants: {
    size: "small",
  },
});

const DEFAULT_VISIBLE_COLUMNS: Required<
  NonNullable<OrderQueueProps["visibleColumns"]>
> = {
  receiptNumber: true,
  itemNumber: true,
  itemContent: true,
  status: true,
  orderTime: true,
  pickupTime: true,
};

// メモ化された注文行コンポーネント
const OrderQueueRow = memo(
  ({
    order,
    isLastConfirmed,
    isLastStatusChanged,
    size = "small",
    visibleColumns = DEFAULT_VISIBLE_COLUMNS,
  }: {
    order: DisplayOrder;
    isLastConfirmed?: boolean;
    isLastStatusChanged?: boolean;
    size?: "small" | "large";
    visibleColumns?: OrderQueueProps["visibleColumns"];
  }): ReactElement => {
    const styles = orderQueueStyles({ size });

    return (
      <p.tr
        className={styles.bodyRow}
        data-highlight-warn-once={
          isLastConfirmed === true || isLastStatusChanged === true
            ? "true"
            : undefined
        }
        key={order.id}
        style={{ backgroundColor: OrderStatusImpl(order.status).toColor().bg }}
      >
        <p.td />
        {visibleColumns?.receiptNumber !== false && (
          <p.td className={styles.bodyCell} textAlign="right">
            <p.p className={styles.receiptNumber}>
              {ReceiptNumberImpl(order.receiptNumber).toStr()}
            </p.p>
          </p.td>
        )}
        {visibleColumns?.itemContent !== false && (
          <p.td className={styles.bodyCell}>
            {order.items.filter((item) => order.status === "UNCONFIRMED" || item.amount > 0).map((item) => (
              <p.div className={styles.orderItem} key={item.id}>
                {visibleColumns?.itemNumber !== false && (
                  <p.div className={styles.itemNumber} position="relative">
                    {item.itemNumber != null
                      ? `T${ReceiptNumberImpl(item.itemNumber).toStr()}`
                      : "--"}
                  </p.div>
                )}
                <p.div className={styles.itemName}>
                  {item.flavors && item.flavors.length > 0
                    ? (
                        <HStack alignItems="center" flexWrap="wrap" gap="1">
                          <p.span color="gray.500" fontSize="[11px]">
                            だんご
                          </p.span>
                          {item.flavors.map((flavor) => {
                            const color = DangoFlavorImpl(flavor).toColor();
                            return (
                              <p.span
                                bg={color.bg}
                                borderColor={color.borderColor}
                                borderRadius="sm"
                                borderWidth="1px"
                                color={color.color}
                                fontSize={size === "large" ? "2xl" : "sm"}
                                fontWeight="bold"
                                key={flavor}
                                px="1.5"
                                py="0.5"
                                whiteSpace="nowrap"
                              >
                                {flavor}
                              </p.span>
                            );
                          })}
                        </HStack>
                      )
                    : (
                        <>
                          {match(ItemImpl(item).getGroup()?.name)
                            .with(P.nullish, () => "")
                            .otherwise((name) => `${name}/`)}
                          {item.name}
                        </>
                      )}
                </p.div>
                <p.div className={styles.itemPrice}>{item.price}</p.div>
                <p.div className={styles.itemAmount}>{item.amount}</p.div>
              </p.div>
            ))}
          </p.td>
        )}
        {visibleColumns?.status !== false && (
          <p.td className={styles.bodyCell} textAlign="center">
            <OrderStatusLabel orderStatus={order.status} size={size} />
          </p.td>
        )}
        {visibleColumns?.orderTime !== false && (
          <p.td className={styles.bodyCell} fontFamily="mono" textAlign="center">
            {dateToStr(order.createdAt).timeOnly}
          </p.td>
        )}
        {visibleColumns?.pickupTime !== false && (
          <p.td className={styles.bodyCell} textAlign="center">
            {order.status === "PICKED_UP"
              ? new Date(
                  order.statusChange.find((sc) => sc.to === "PICKED_UP")?.at
                  ?? order.createdAt,
                ).toLocaleTimeString("ja-JP", {
                  hour: "2-digit",
                  minute: "2-digit",
                })
              : "--:--"}
          </p.td>
        )}
      </p.tr>
    );
  },
);

// 確定済み注文のリスト（current-order の影響を受けない）
const ConfirmedOrdersList = memo(
  ({
    size = "small",
    filterGroupId,
    filterStatus,
    visibleColumns,
  }: {
    size?: "small" | "large";
    filterGroupId?: string;
    filterStatus?: Order["status"] | Array<Order["status"]>;
    visibleColumns?: OrderQueueProps["visibleColumns"];
  }): ReactElement => {
    const orders = useStore($orders);
    const items = useStore($items);
    const lastConfirmedOrderId = useStore($lastConfirmedOrderId);
    const lastStatusChangedReceiptNumber = useStore(
      $lastStatusChangedReceiptNumber,
    );

    const ordersWithItemNumbers = useMemo<DisplayOrder[]>(() => {
      const itemNumberMap = new Map<string, ItemNumber>();
      const itemGroupMap = new Map<string, string>();

      items.forEach((group) => {
        group.children.forEach((child) => {
          itemNumberMap.set(child.id, child.itemNumber);
          itemGroupMap.set(child.id, group.id);
        });
      });

      let filteredOrders = orders;

      // ステータスフィルター（配列対応）
      if (filterStatus != null) {
        if (Array.isArray(filterStatus)) {
          filteredOrders = filteredOrders.filter((order) =>
            filterStatus.includes(order.status),
          );
        } else {
          filteredOrders = filteredOrders.filter(
            (order) => order.status === filterStatus,
          );
        }
      }

      // グループIDフィルター（指定されたグループの商品を含む注文のみ）
      if (filterGroupId != null) {
        filteredOrders = filteredOrders.filter((order) =>
          order.items.some(
            (item) => (order.status === "UNCONFIRMED" || item.amount > 0) && itemGroupMap.get(item.id) === filterGroupId,
          ),
        );
      }

      return filteredOrders.map((order) => ({
        ...order,
        items: order.items
          .filter((item) => order.status === "UNCONFIRMED" || item.amount > 0)
          .map((item) => ({
            ...item,
            itemNumber: itemNumberMap.get(item.id) ?? null,
          })),
      }));
    }, [orders, items, filterGroupId, filterStatus]);

    return (
      <>
        {ordersWithItemNumbers.map((order) => (
          <OrderQueueRow
            isLastConfirmed={lastConfirmedOrderId === order.id}
            isLastStatusChanged={
              lastStatusChangedReceiptNumber === order.receiptNumber
            }
            key={order.id}
            order={order}
            size={size}
            visibleColumns={visibleColumns}
          />
        ))}
      </>
    );
  },
);

// 未確定注文のプレビュー（current-order の変更を購読）
const UnconfirmedOrderPreview = memo(
  ({
    size = "small",
    filterGroupId,
    filterStatus,
    visibleColumns,
  }: {
    size?: "small" | "large";
    filterGroupId?: string;
    filterStatus?: Order["status"] | Array<Order["status"]>;
    visibleColumns?: OrderQueueProps["visibleColumns"];
  }): ReactElement | null => {
    const currentOrder = useStore($currentOrder);
    const normalizedItems = useStore($normalizedCurrentOrderItems);
    const depositAmount = useStore($depositAmount);
    const items = useStore($items);
    const discountCode = useStore($discountCode);

    // ステータスフィルターチェック（UNCONFIRMEDが含まれているかチェック）
    if (filterStatus != null) {
      const allowUnconfirmed = Array.isArray(filterStatus)
        ? filterStatus.includes("UNCONFIRMED")
        : filterStatus === "UNCONFIRMED";

      if (!allowUnconfirmed) {
        return null;
      }
    }

    // 受付番号が発行されていない場合は表示しない
    if (
      currentOrder.orderId == null
      || currentOrder.receiptNumber == null
    ) {
      return null;
    }

    if (normalizedItems.length === 0) {
      return null;
    }

    // グループIDフィルター（プレビューにも適用）
    if (filterGroupId != null) {
      const itemGroupMap = new Map<string, string>();
      items.forEach((group) => {
        group.children.forEach((child) => {
          itemGroupMap.set(child.id, group.id);
        });
      });

      const hasTargetGroup = normalizedItems.some(
        (item) => itemGroupMap.get(item.id) === filterGroupId,
      );
      if (!hasTargetGroup) {
        return null;
      }
    }

    const itemNumberMap = new Map<string, ItemNumber>();
    items.forEach((group) => {
      group.children.forEach((child) => {
        itemNumberMap.set(child.id, child.itemNumber);
      });
    });

    // 預かり金額を数値に変換
    const cleanedDeposit = (depositAmount || "0").replace(/,/g, "");
    const depositAmountNumber = Number.parseInt(cleanedDeposit, 10);

    // 割引情報の処理
    const discountNumber = wrapValidation(
      DiscountNumber(Number.parseInt(discountCode, 10)),
    ).unwrapOr(null);
    const discountInfo = discountNumber != null
      ? findDiscountByNumber(discountNumber)
      : null;

    const previewOrderId = Order.get("id").from(currentOrder.orderId);
    const previewOrder: DisplayOrder = {
      id: previewOrderId,
      receiptNumber: currentOrder.receiptNumber,
      createdAt: new Date().toISOString(),
      status: "UNCONFIRMED" as const,
      statusChange: [],
      items: normalizedItems.map((item) => ({
        ...item,
        itemNumber: item.itemNumber,
      })),
      depositAmount: Order.get("depositAmount").from(depositAmountNumber),
      appliedDiscount: discountInfo ? Discount.assert(discountInfo) : null,
    };

    return (
      <OrderQueueRow
        order={previewOrder}
        size={size}
        visibleColumns={visibleColumns}
      />
    );
  },
);

export function OrderQueue({
  size = "small",
  filterGroupId,
  filterStatus,
  visibleColumns = DEFAULT_VISIBLE_COLUMNS,
}: OrderQueueProps = {}): ReactElement {
  const orders = useStore($orders);
  const normalizedItems = useStore($normalizedCurrentOrderItems);
  const tableContainerRef = useRef<HTMLDivElement>(null);
  const styles = orderQueueStyles({ size });

  // 常に最下部にスクロール（注文数やプレビュー内容が変わったとき）
  useEffect(() => {
    if (tableContainerRef.current) {
      tableContainerRef.current.scrollTop
        = tableContainerRef.current.scrollHeight;
    }
  }, [orders.length, normalizedItems.length]);

  return (
    <Expanded>
      <p.div className={styles.container} ref={tableContainerRef}>
        <p.table className={styles.table}>
          <Table.head>
            {size === "large"
              ? (
                  <p.tr className={styles.headerRow}>
                    <p.th className={styles.headerCell} w="0"></p.th>
                    {visibleColumns.receiptNumber !== false && (
                      <p.th className={styles.headerCell} w="36">
                        受付番号
                      </p.th>
                    )}
                    {visibleColumns.itemContent !== false && (
                      <p.th className={styles.headerCell} w="stretch">
                        注文内容
                        <p.div
                          display="flex"
                          fontSize="xl"
                          fontWeight="normal"
                          gap="4"
                          mt="2"
                        >
                          {visibleColumns.itemNumber !== false && (
                            <p.div w="32">商品番号</p.div>
                          )}
                          <p.div flex="1" textAlign="left">
                            商品
                          </p.div>
                          <p.div textAlign="right" w="40">
                            価格 [円]
                          </p.div>
                          <p.div w="24">数量</p.div>
                        </p.div>
                      </p.th>
                    )}
                    {visibleColumns.status !== false && (
                      <p.th className={styles.headerCell} w="48">
                        状態
                      </p.th>
                    )}
                    {visibleColumns.orderTime !== false && (
                      <p.th className={styles.headerCell} w="40">
                        注文時刻
                      </p.th>
                    )}
                    {visibleColumns.pickupTime !== false && (
                      <p.th className={styles.headerCell} w="40">
                        受取時刻
                      </p.th>
                    )}
                  </p.tr>
                )
              : (
                  <p.tr className={styles.headerRow}>
                    <p.th className={styles.headerCell} w="0"></p.th>
                    {visibleColumns.receiptNumber !== false && (
                      <p.th className={styles.headerCell} w="20">
                        受付番号
                      </p.th>
                    )}
                    {visibleColumns.itemContent !== false && (
                      <p.th className={styles.headerCell} w="stretch">
                        注文内容
                        <p.div
                          display="flex"
                          fontSize="xs"
                          fontWeight="normal"
                          gap="2"
                          mt="1"
                        >
                          {visibleColumns.itemNumber !== false && (
                            <p.div w="16">商品番号</p.div>
                          )}
                          <p.div flex="1" textAlign="left">
                            商品
                          </p.div>
                          <p.div textAlign="right" w="20">
                            価格 [円]
                          </p.div>
                          <p.div w="12">数量</p.div>
                        </p.div>
                      </p.th>
                    )}
                    {visibleColumns.status !== false && (
                      <p.th className={styles.headerCell} w="24">
                        状態
                      </p.th>
                    )}
                    {visibleColumns.orderTime !== false && (
                      <p.th className={styles.headerCell} w="20">
                        注文時刻
                      </p.th>
                    )}
                    {visibleColumns.pickupTime !== false && (
                      <p.th className={styles.headerCell} w="20">
                        受取時刻
                      </p.th>
                    )}
                  </p.tr>
                )}
          </Table.head>
          <Table.body>
            <ConfirmedOrdersList
              {...(filterGroupId != null && { filterGroupId })}
              {...(filterStatus != null && { filterStatus })}
              size={size}
              visibleColumns={visibleColumns}
            />
            <UnconfirmedOrderPreview
              {...(filterGroupId != null && { filterGroupId })}
              {...(filterStatus != null && { filterStatus })}
              size={size}
              visibleColumns={visibleColumns}
            />
          </Table.body>
        </p.table>
      </p.div>
    </Expanded>
  );
}
