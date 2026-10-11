import type { ReactElement } from "react";
import { HStack } from "panda/jsx";
import { Expanded } from "@/components/atomic/Expanded";
import { OrderQueue } from "@/components/OrderQueue";
import { Time } from "@/components/Time";

export default function (): ReactElement {
  return (
    <Expanded basedOn="screen" display="flex" flexDir="column" gap="2" py="2">
      <HStack justifyContent="space-between" px="2" w="full">
        <Time />
      </HStack>
      <OrderQueue
        // cspell: disable-next-line
        filterGroupId="bf8hypkw4ahz8t6bv3i0o0ot"
        filterStatus="WAITING_COOKING"
        size="large"
        visibleColumns={{
          receiptNumber: true,
          itemNumber: true,
          itemContent: true,
          status: true,
          orderTime: true,
          pickupTime: false,
        }}
      />
    </Expanded>
  );
}
