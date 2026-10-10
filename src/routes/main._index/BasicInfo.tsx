import type { ReactElement } from "react";
import { useStore } from "@nanostores/react";
import { HStack, styled as p, VStack } from "panda/jsx";
import { useMemo } from "react";
import { Card } from "@/components/atomic/Card";
import { Expanded } from "@/components/atomic/Expanded";
import { Time } from "@/components/Time";
import { $orders } from "@/lib/stores/orders";

export function BasicInfo(): ReactElement {
  const orders = useStore($orders);

  // 合計受付数と合計受取済数を計算
  const { totalAccepted, totalPickedUp } = useMemo(() => {
    const accepted = orders.length;
    const pickedUp = orders.filter((order) => order.status === "PICKED_UP").length;
    return { totalAccepted: accepted, totalPickedUp: pickedUp };
  }, [orders]);

  return (
    <Expanded display="flex" flexDir="column" gap="2" p="2">
      <HStack justifyContent="space-between" w="full">
        <Time />
      </HStack>
      <HStack alignItems="stretch" flex="1" gap="2">
        <Card centralized>
          <VStack gap="1">
            <p.p fontSize="clamp(11px, 0.9vw, 15px)" whiteSpace="nowrap">合計受付数</p.p>
            <p.code fontSize="clamp(2rem, 3.5vw, 3.5rem)" lineHeight="none" mx="auto">{totalAccepted}</p.code>
          </VStack>
        </Card>
        <Card centralized>
          <VStack gap="1">
            <p.p fontSize="clamp(11px, 0.9vw, 15px)" whiteSpace="nowrap">合計受取済数</p.p>
            <p.code fontSize="clamp(2rem, 3.5vw, 3.5rem)" lineHeight="none" mx="auto">{totalPickedUp}</p.code>
          </VStack>
        </Card>
      </HStack>
    </Expanded>
  );
}
