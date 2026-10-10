import type { ReactElement } from "react";
import { type } from "arktype";
import { useEffect, useRef, useState } from "react";
import { NumberInput } from "@/components/atomic/NumberInput";
import { ReceiptNumberImpl } from "@/lib/order";
import { ReceiptNumber } from "@/types/order";

export type ReceiptNumberInputProps = {
  onConfirm: (receiptNumber: number) => void;
  onInvalidReceiptNumber?: (receiptNumber: number) => void;
  autoFocus?: boolean;
};

export function ReceiptNumberInput({
  onConfirm,
  onInvalidReceiptNumber,
  autoFocus = true,
}: ReceiptNumberInputProps): ReactElement {
  const inputRef = useRef<HTMLInputElement>(null);
  const [localReceiptNumber, setLocalReceiptNumber] = useState<string>("");

  useEffect(() => {
    if (autoFocus && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [autoFocus]);

  const handleKeyDown = (event: React.KeyboardEvent<HTMLInputElement>): void => {
    if (event.key === "Backspace") {
      event.preventDefault();
      event.stopPropagation();
      setLocalReceiptNumber("");
      return;
    }

    if (event.key === "Enter") {
      event.preventDefault();
      event.stopPropagation();
      const receiptValue = event.currentTarget.value.trim();
      if (receiptValue === "")
        return;

      const receiptNumber = Number.parseInt(receiptValue, 10);
      if (Number.isNaN(receiptNumber))
        return;

      const validatedReceiptNumber = ReceiptNumber(receiptNumber);
      if (validatedReceiptNumber instanceof type.errors) {
        event.currentTarget.select();
        onInvalidReceiptNumber?.(receiptNumber);
        return;
      }

      onConfirm(validatedReceiptNumber);
    }
  };

  const handleKeyUp = (event: React.KeyboardEvent<HTMLInputElement>): void => {
    if (event.key === "Backspace") {
      event.preventDefault();
      event.stopPropagation();
      requestAnimationFrame(() => {
        inputRef.current?.focus();
        inputRef.current?.select();
      });
    }
  };

  return (
    <NumberInput
      h="12"
      onChange={(event) => {
        const value = event.target.value;
        setLocalReceiptNumber(value);
      }}
      onKeyDown={handleKeyDown}
      onKeyUp={handleKeyUp}
      outline={{
        base: "2px solid",
        _focus: "4px solid",
      }}
      outlineColor="black"
      ref={inputRef}
      textAlign="center"
      value={localReceiptNumber === "" ? "" : ReceiptNumberImpl(Number.parseInt(localReceiptNumber, 10)).toStr()}
      w="20"
    />
  );
}
