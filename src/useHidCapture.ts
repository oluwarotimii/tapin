"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Captures card reads from an OTG RFID dongle that presents as a USB
 * keyboard (HID). The dongle "types" the card identifier followed by an
 * Enter key press. Everything is swallowed into an invisible input so the
 * card detail is never rendered on screen.
 */

export interface HidCaptureOptions {
  enabled: boolean;
  onCard: (cardId: string) => void;
  /** Optional terminator that ends a read. Defaults to Enter. */
  terminator?: string;
  /** Min characters before a scan can be accepted (guards against stray keys). */
  minLength?: number;
}

export function useHidCapture({
  enabled,
  onCard,
  terminator = "Enter",
  minLength = 4,
}: HidCaptureOptions) {
  const inputRef = useRef<HTMLInputElement>(null);
  const bufferRef = useRef("");
  const onCardRef = useRef(onCard);
  onCardRef.current = onCard;

  const [armed, setArmed] = useState(enabled);

  // Re-arm as the parent toggles enablement.
  useEffect(() => {
    setArmed(enabled);
  }, [enabled]);

  const refocus = () => {
    // Restore the entry field whenever the user clicks anywhere else so a
    // tap is never dropped.
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

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!armed) return;
    if (e.key === terminator) {
      const cardId = bufferRef.current;
      bufferRef.current = "";
      if (cardId && cardId.length >= minLength) {
        onCardRef.current(cardId);
        return;
      }
      if (cardId) {
        // Non-blank but too short: treat as noise.
        bufferRef.current = "";
      }
      e.preventDefault();
      return;
    }
    if (e.key === "Backspace") {
      bufferRef.current = bufferRef.current.slice(0, -1);
      e.preventDefault();
    } else if (e.key.length === 1) {
      bufferRef.current += e.key;
      e.preventDefault();
    }
  };

  return { inputRef, handleKeyDown };
}
