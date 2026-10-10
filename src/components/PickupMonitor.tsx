import type { ReactElement } from "react";
import { useStore } from "@nanostores/react";
import { sva } from "panda/css";
import { Center, Grid, styled as p, VStack } from "panda/jsx";
import { useMemo } from "react";
import { Expanded } from "@/components/atomic/Expanded";
import { ReceiptNumberImpl } from "@/lib/order";
import { $lastStatusChangedReceiptNumber, $orders } from "@/lib/stores/orders";

type PickupMonitorProps = {
  size?: "small" | "large";
  basedOn?: "screen" | "container";
  isHighlightLonger?: boolean;
};

const LABEL_CONFIG = {
  small: {
    waitingLabel: "調理待ち",
    pickupLabel: "受取待ち",
  },
  large: {
    waitingLabel: "お待ち番号",
    pickupLabel: "お呼び出し中の番号",
  },
} as const;

const pickupMonitorStyles = sva({
  slots: ["title", "grid", "numberCard"],
  base: {
    title: {
      fontWeight: "bold",
      p: "1",
      px: "2",
      w: "full",
      whiteSpace: "nowrap",
    },
    grid: {
      gap: "2",
      p: "2",
      w: "full",
    },
    numberCard: {
      aspectRatio: "1 / 1",
      borderColor: "white",
      fontFamily: "mono",
      fontWeight: "bold",
      lineHeight: "none",
      p: "2",
    },
  },
  variants: {
    size: {
      small: {
        title: {
          fontSize: "clamp(1.1rem, 1.4vw, 1.5rem)",
        },
        grid: {
          gridTemplateColumns: "repeat(auto-fill, minmax(60px, 1fr))",
        },
        numberCard: {
          border: "1px solid",
          fontSize: "3xl",
        },
      },
      large: {
        title: {
          fontSize: "6xl",
        },
        grid: {
          gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))",
        },
        numberCard: {
          border: "5px solid",
          fontSize: "8xl",
        },
      },
    },
  },
  defaultVariants: {
    size: "small",
  },
});

export function PickupMonitor({ size = "small", basedOn, isHighlightLonger = false }: PickupMonitorProps): ReactElement {
  const orders = useStore($orders);
  const lastStatusChangedReceiptNumber = useStore($lastStatusChangedReceiptNumber);

  const { waitingCooking, waitingPickup } = useMemo(() => {
    const cooking = orders.filter((order) => order.status === "WAITING_COOKING");
    const pickup = orders.filter((order) => order.status === "WAITING_PICKUP");
    return { waitingCooking: cooking, waitingPickup: pickup };
  }, [orders]);

  const styles = pickupMonitorStyles({ size });
  const labels = LABEL_CONFIG[size];

  return (
    <Expanded basedOn={basedOn} bg="black" color="white" display="flex">
      <VStack alignItems="flex-start" gap="0" w="full">
        <p.p bg="amber.400" className={styles.title} color="black">
          {labels.waitingLabel}
        </p.p>
        <Grid className={styles.grid}>
          {waitingCooking.map((order) => (
            <Center className={styles.numberCard} key={order.id}>
              {ReceiptNumberImpl(order.receiptNumber).toStr()}
            </Center>
          ))}
        </Grid>
      </VStack>
      <VStack alignItems="flex-start" gap="0" w="full">
        <p.p bg="green.600" className={styles.title} color="white">
          {labels.pickupLabel}
        </p.p>
        <Grid className={styles.grid}>
          {waitingPickup.map((order) => (
            <Center
              className={styles.numberCard}
              {
                ...isHighlightLonger
                  ? { "data-highlight-warn-once-longer": order.receiptNumber === lastStatusChangedReceiptNumber }
                  : { "data-highlight-warn-once": order.receiptNumber === lastStatusChangedReceiptNumber }
              }
              key={order.id}
            >
              {ReceiptNumberImpl(order.receiptNumber).toStr()}
            </Center>
          ))}
        </Grid>
      </VStack>
    </Expanded>
  );
}
