import type { ReactElement } from "react";
import { css } from "panda/css";
import { styled as p } from "panda/jsx";
import { Expanded } from "@/components/atomic/Expanded";
import { ActiveArea } from "./ActiveArea";
import { BasicInfo } from "./BasicInfo";
import { OrderQueue } from "./OrderQueue";
import { PickupMonitor } from "./PickupMonitor";
import { StatusBar } from "./StatusBar";
import { UnfocusedNotice } from "./UnfocusedNotice";

export default function (): ReactElement {
  return (
    <Expanded basedOn="screen" overflowX="auto" overflowY="hidden" position="relative">
      <p.div
        className={css({
          "& > *": {
            outline: "1px solid",
            outlineColor: "gray.200",
          },
        })}
        display="grid"
        gridTemplateAreas={`
          "basic-info order-queue"
          "pickup-monitor order-queue"
          "pickup-monitor order-queue"
          "active-area active-area"
          "active-area active-area"
          "status-bar status-bar"
        `}
        gridTemplateColumns="2fr 3fr"
        gridTemplateRows="repeat(5, minmax(0, 1fr)) auto"
        h="full"
        minH="0"
        minW="[1024px]"
        overflow="hidden"
      >
        <p.div gridArea="basic-info" minH="0" overflow="hidden"><BasicInfo /></p.div>
        <p.div gridArea="pickup-monitor" minH="0" overflow="hidden"><PickupMonitor /></p.div>
        <p.div gridArea="order-queue" minH="0" overflow="hidden"><OrderQueue /></p.div>
        <p.div gridArea="active-area" minH="0" overflow="hidden"><ActiveArea /></p.div>
        <p.div gridArea="status-bar" minH="0"><StatusBar /></p.div>
      </p.div>
      <UnfocusedNotice />
    </Expanded>
  );
}
