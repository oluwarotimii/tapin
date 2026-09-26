"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Captures keystrokes from a single always-focused input serving two
 * sources at once:
 *  - An OTG RFID dongle presenting as a USB keyboard (HID). It "types" the
 *    card identifier followed by Enter. Card IDs always start with a
 *    letter ("CARD-...", see generateCardId()), so the first keystroke
 *    alone identifies this as a card read — buffered invisibly (masked on
 *    screen) until Enter, same as before.
 *  - A student typing their numeric ID on a physical keyboard. The first
 *    keystroke being a digit identifies this as a code entry — shown
 *    plainly on screen as typed, auto-submitted the moment it reaches
 *    codeLength characters (no Enter needed).
 */

export interface HidCaptureOptions {
  enabled: boolean;
  onCard: (cardId: string) => void;
  /** Fires the moment a digit-only buffer reaches codeLength. */
  onCode?: (code: string) => void;
  /** Digits required before onCode fires. Defaults to 4. */
  codeLength?: number;
  /** Optional terminator that ends a card read. Defaults to Enter. */
  terminator?: string;
  /** Min characters before a card read can be accepted (guards against stray keys). */
  minLength?: number;
}

type Mode = "idle" | "code" | "card";

export function useHidCapture({
  enabled,
  onCard,
  onCode,
  codeLength = 4,
  terminator = "Enter",
  minLength = 4,
}: HidCaptureOptions) {
  const inputRef = useRef<HTMLInputElement>(null);
  const bufferRef = useRef("");
  const modeRef = useRef<Mode>("idle");
  const [displayValue, setDisplayValue] = useState("");
  const onCardRef = useRef(onCard);
  onCardRef.current = onCard;
  const onCodeRef = useRef(onCode);
  onCodeRef.current = onCode;

  const [armed, setArmed] = useState(enabled);

  // Re-arm as the parent toggles enablement.
  useEffect(() => {
    setArmed(enabled);
  }, [enabled]);

  const refocus = () => {
    // Restore the entry field whenever the user clicks anywhere else so a
    // tap/keystroke is never dropped.
    if (document.activeElement !== inputRef.current) {
      inputRef.current?.focus({ preventScroll: true });
    }
  };

  useEffect(() => {
    if (!armed) return;
    // Focus on mount.
    inputRef.current?.focus({ preventScroll: true });
    // Keep focus even if the user clicks the page; the kiosk is full-screen.
    document.addEventListener("pointerdown", refocus);
    return () => document.removeEventListener("pointerdown", refocus);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [armed]);

  function reset() {
    bufferRef.current = "";
    modeRef.current = "idle";
    setDisplayValue("");
  }

  function render() {
    setDisplayValue(
      modeRef.current === "card"
        ? "•".repeat(bufferRef.current.length)
        : bufferRef.current,
    );
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!armed) return;
    if (e.key === terminator) {
      const value = bufferRef.current;
      const mode = modeRef.current;
      reset();
      if (mode === "card" && value.length >= minLength) {
        onCardRef.current(value);
      }
      e.preventDefault();
      return;
    }
    if (e.key === "Backspace") {
      bufferRef.current = bufferRef.current.slice(0, -1);
      if (!bufferRef.current) modeRef.current = "idle";
      render();
      e.preventDefault();
      return;
    }
    if (e.key.length === 1) {
      if (modeRef.current === "idle") {
        modeRef.current = /^[0-9]$/.test(e.key) ? "code" : "card";
      }
      bufferRef.current += e.key;
      e.preventDefault();

      if (
        modeRef.current === "code" &&
        onCodeRef.current &&
        bufferRef.current.length === codeLength
      ) {
        const code = bufferRef.current;
        reset();
        onCodeRef.current(code);
        return;
      }
      render();
    }
  };

  return { inputRef, handleKeyDown, displayValue, resetInput: reset };
}
