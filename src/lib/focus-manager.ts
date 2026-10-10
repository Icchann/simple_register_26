import { $orderPhase } from "./stores/phase";

type FocusFunction = () => void;

let receiptInput: HTMLInputElement | null = null;
let discountFocusHelper: FocusFunction | null = null;
let paymentFocusHelper: FocusFunction | null = null;

type OrderFocusHelpers = {
  focusFirstRowProductInput?: FocusFunction;
  focusLastRowProductInput?: FocusFunction;
  focusActiveProductInput?: FocusFunction;
};

let orderFocusHelpers: OrderFocusHelpers = {};

export function registerReceiptInput(input: HTMLInputElement | null): void {
  receiptInput = input;
}

export function focusReceiptInput(): void {
  if (!receiptInput)
    return;
  receiptInput.focus();
  receiptInput.select?.();
}

export function registerOrderFocusHelpers(helpers: OrderFocusHelpers): void {
  orderFocusHelpers = helpers;
}

export function focusOrderFirstRowProduct(): void {
  orderFocusHelpers.focusFirstRowProductInput?.();
}

export function focusOrderLastRowProduct(): void {
  orderFocusHelpers.focusLastRowProductInput?.();
}

export function registerDiscountFocusHelper(helper: FocusFunction | null): void {
  discountFocusHelper = helper;
}

export function registerPaymentFocusHelper(helper: FocusFunction | null): void {
  paymentFocusHelper = helper;
}

export function restoreAppFocus(): void {
  const phase = $orderPhase.get();
  if (phase === "CHECK_RECEIPT_NUMBER") {
    focusReceiptInput();
  } else if (phase === "SELECT_ITEMS") {
    if (orderFocusHelpers.focusActiveProductInput) {
      orderFocusHelpers.focusActiveProductInput();
    } else {
      focusOrderLastRowProduct();
    }
  } else if (phase === "CHECK_DISCOUNT") {
    if (discountFocusHelper) {
      discountFocusHelper();
    }
  } else if (phase === "PROCESS_PAYMENT") {
    if (paymentFocusHelper) {
      paymentFocusHelper();
    }
  }
}
