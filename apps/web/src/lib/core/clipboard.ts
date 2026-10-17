/** Copies text that may still be loading. The clipboard call starts inside the click, which Safari requires. */
export function copyText(text: string | Promise<string>): Promise<void> {
  const clip = navigator.clipboard;
  if (!clip) return Promise.reject(new Error("clipboard unavailable"));
  if (typeof text === "string") return clip.writeText(text);
  const later = () => text.then((t) => clip.writeText(t));
  if (typeof ClipboardItem === "undefined" || !clip.write) return later();
  const blob = text.then((t) => new Blob([t], { type: "text/plain" }));
  return clip.write([new ClipboardItem({ "text/plain": blob })]).catch(later);
}
