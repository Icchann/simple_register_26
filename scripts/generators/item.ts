import Bun from "bun";
import { resolve } from "node:path";
import { createId } from "@paralleldrive/cuid2";
import { Discount, Item, ItemGroup } from "@/types/item";

const dirPjRoot = resolve(import.meta.dir, "..", "..");

const groupDefinitions = [
  {
    name: "ポップコーン",
    price: 150,
    helperDiscount: 150,
    items: ["塩", "カレー", "キャラメル"],
  },
  {
    name: "缶ジュース",
    price: 100,
    helperDiscount: 100,
    items: ["ファンタ", "コーラ"],
  },
  {
    name: "ペットボトル",
    price: 150,
    helperDiscount: 150,
    items: ["チルソン", "アクエリ", "MATCH", "水", "麦茶"],
  },
] as const;

const ITEM_GROUPS = groupDefinitions.map((groupDef) =>
  ItemGroup.assert({
    id: createId(),
    name: groupDef.name,
    children: groupDef.items.map((itemName) =>
      Item.assert({
        id: createId(),
        name: itemName,
        price: groupDef.price,
      }),
    ),
  }),
);

const discountAmounts: Record<string, number> = {};
ITEM_GROUPS.forEach((group, groupIndex) => {
  const groupDef = groupDefinitions[groupIndex];
  if (groupDef) {
    group.children.forEach((item) => {
      discountAmounts[item.id] = groupDef.helperDiscount;
    });
  }
});

const DISCOUNT = [
  Discount.assert({
    id: createId(),
    name: "お手伝い者割引",
    amount: discountAmounts,
  }),
];

const publicDataDir = resolve(dirPjRoot, "public", "data");

await Promise.all([
  Bun.write(
    resolve(publicDataDir, "item_groups.json"),
    JSON.stringify(ITEM_GROUPS, null, 2),
  ),
  Bun.write(
    resolve(publicDataDir, "discount.json"),
    JSON.stringify(DISCOUNT, null, 2),
  ),
]);
