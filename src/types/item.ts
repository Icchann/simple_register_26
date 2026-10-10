import { type } from "arktype";

const Price = type("0 <= number.integer <= 500");

export const ItemNumber = type("0 <= number.integer#itemNumber <= 100");
export type ItemNumber = typeof ItemNumber.infer;

export const DiscountNumber = type("0 <= number.integer#discountNumber <= 10");
export type DiscountNumber = typeof DiscountNumber.infer;

export const Item = type({
  "id": "string#itemId",
  "name": "string",
  "price": Price,
  "flavors?": "string[]",
});
export type Item = typeof Item.infer;

export const ItemWithItemNumber = Item.merge({
  itemNumber: ItemNumber,
});
export type ItemWithItemNumber = typeof ItemWithItemNumber.infer;

export const Discount = type({
  id: type("string#discountId"),
  name: "string",
  amount: type.Record(Item.get("id"), Price).optional(),
});
export type Discount = typeof Discount.infer;

export const ItemGroup = type({
  id: "string#itemGroupId",
  name: "string",
  children: Item.array(),
});
export type ItemGroup = typeof ItemGroup.infer;
