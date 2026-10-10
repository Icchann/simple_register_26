import { type } from "arktype";
import { Discount, Item } from "./item";

export const OrderNumber = type("0 <= number.integer#orderNumber <= 9999");
export type OrderNumber = typeof OrderNumber.infer;

export const MAX_RECEIPT_NUMBER = 50 as const;
export const ReceiptNumber = type(`1 <= number.integer#receiptNumber <= ${MAX_RECEIPT_NUMBER}`);
export type ReceiptNumber = typeof ReceiptNumber.infer;
export const MAX_ORDER_ITEM_AMOUNT = 100 as const;
export const OrderItemAmount = type(`0 <= number.integer#orderItemAmount <= ${MAX_ORDER_ITEM_AMOUNT}`);
export type OrderItemAmount = typeof OrderItemAmount.infer;

export const OrderStatus = type(
  "'UNCONFIRMED' | 'WAITING_COOKING' | 'WAITING_PICKUP' | 'PICKED_UP' | 'REFUNDED' | 'CANCELED'",
);
export type OrderStatus = typeof OrderStatus.infer;

export const Order = type({
  id: "string#orderId",
  receiptNumber: ReceiptNumber,
  createdAt: "string.date.iso",
  status: OrderStatus,
  statusChange: type({
    to: OrderStatus,
    at: "string.date.iso",
  }).array(),
  items: Item.merge({ amount: OrderItemAmount }).array(),
  depositAmount: type("0 <= number.integer#depositAmount <= 100000"),
  appliedDiscount: Discount.or("null"),
});
export type Order = typeof Order.infer;
