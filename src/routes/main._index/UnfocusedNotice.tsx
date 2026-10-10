import type { ReactElement } from "react";
import { useStore } from "@nanostores/react";
import { styled as p } from "panda/jsx";
import { useEffect, useState } from "react";
import { restoreAppFocus } from "@/lib/focus-manager";
import { $isFlavorDialogOpen, $overlayType } from "@/lib/stores/overlay";

function getInitialIsUnfocused(): boolean {
  if (typeof document === "undefined") {
    return false;
  }
  const activeEl = document.activeElement;
  return !(
    activeEl instanceof HTMLInputElement
    || (activeEl instanceof HTMLButtonElement && activeEl.getAttribute("data-register-focus") === "true")
  );
}

export function UnfocusedNotice(): ReactElement | null {
  const [isUnfocused, setIsUnfocused] = useState(getInitialIsUnfocused);
  const overlayType = useStore($overlayType);
  const isFlavorDialogOpen = useStore($isFlavorDialogOpen);

  useEffect(() => {
    const checkFocus = (): void => {
      // モーダルや味選択ダイアログが開いている場合は通常フォーカス管理下にあるため表示しない
      if ($overlayType.get() != null || $isFlavorDialogOpen.get()) {
        setIsUnfocused(false);
        return;
      }

      const activeEl = document.activeElement;
      const isInputFocused = activeEl instanceof HTMLInputElement
        || (activeEl instanceof HTMLButtonElement && activeEl.getAttribute("data-register-focus") === "true");

      setIsUnfocused(!isInputFocused);
    };

    const handleFocusChange = (): void => {
      requestAnimationFrame(checkFocus);
    };

    const handleKeyDown = (e: KeyboardEvent): void => {
      if (e.ctrlKey || e.metaKey || e.altKey) {
        return;
      }
      if ($overlayType.get() == null && !$isFlavorDialogOpen.get()) {
        const activeEl = document.activeElement;
        const isInputFocused = activeEl instanceof HTMLInputElement
          || (activeEl instanceof HTMLButtonElement && activeEl.getAttribute("data-register-focus") === "true");
        if (!isInputFocused) {
          restoreAppFocus();
        }
      }
    };

    window.addEventListener("focus", handleFocusChange, true);
    window.addEventListener("blur", handleFocusChange, true);
    window.addEventListener("pointerdown", handleFocusChange, true);
    window.addEventListener("keydown", handleKeyDown, true);

    return (): void => {
      window.removeEventListener("focus", handleFocusChange, true);
      window.removeEventListener("blur", handleFocusChange, true);
      window.removeEventListener("pointerdown", handleFocusChange, true);
      window.removeEventListener("keydown", handleKeyDown, true);
    };
  }, []);

  if (!isUnfocused || overlayType != null || isFlavorDialogOpen) {
    return null;
  }

  return (
    <p.div
      bottom="10"
      left="50%"
      pointerEvents="auto"
      position="absolute"
      transform="translateX(-50%)"
      zIndex="40"
    >
      <p.button
        alignItems="center"
        animation="pulse"
        bg="amber.500"
        borderColor="amber.600"
        borderRadius="md"
        borderWidth="2px"
        boxShadow="2xl"
        color="black"
        cursor="pointer"
        display="flex"
        fontSize="sm"
        fontWeight="bold"
        gap="1.5"
        onClick={() => {
          restoreAppFocus();
        }}
        px="4"
        py="2"
      >
        <IconMaterialSymbolsWarning />
        <span>次項目または後退キーを押してください</span>
      </p.button>
    </p.div>
  );
}
