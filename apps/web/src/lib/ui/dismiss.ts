import type { Attachment } from "svelte/attachments";

/** Closes a popover on a pointer press outside the element or on Escape; attach it only while the popover is open. */
export function dismiss(close: () => void): Attachment<HTMLElement> {
  return (node) => {
    const outside = (e: PointerEvent) => {
      if (!node.contains(e.target as Node)) close();
    };
    const escape = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
    };
    document.addEventListener("pointerdown", outside);
    document.addEventListener("keydown", escape);
    return () => {
      document.removeEventListener("pointerdown", outside);
      document.removeEventListener("keydown", escape);
    };
  };
}
