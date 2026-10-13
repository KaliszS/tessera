export interface ChoiceOption {
  id: string;
  label: string;
  danger?: boolean;
}

export interface DialogRequest {
  title: string;
  body?: string;
  input?: { label?: string; value: string; type: "text" | "number" };
  confirmLabel?: string;
  danger?: boolean;
  options?: ChoiceOption[];
  resolve: (value: string | boolean | null) => void;
}

class Dialogs {
  current = $state.raw<DialogRequest | null>(null);

  open(req: Omit<DialogRequest, "resolve">): Promise<string | boolean | null> {
    this.current?.resolve(null);
    return new Promise((resolve) => (this.current = { ...req, resolve }));
  }

  close(value: string | boolean | null) {
    const req = this.current;
    this.current = null;
    req?.resolve(value);
  }
}

export const dialogs = new Dialogs();

/** Asks for a value; resolves to null when cancelled. */
export async function ask(title: string, value = "", type: "text" | "number" = "text", label?: string) {
  const v = await dialogs.open({ title, input: { value, type, label } });
  return typeof v === "string" ? v : null;
}

export async function askNumber(title: string, value: number, label?: string) {
  const v = await ask(title, String(value), "number", label);
  if (v === null || v.trim() === "" || Number.isNaN(Number(v))) return null;
  return Number(v);
}

export async function confirmAction(title: string, body?: string, confirmLabel?: string, danger = false) {
  return (await dialogs.open({ title, body, confirmLabel, danger })) === true;
}

/** Shows a list of actions; resolves to the chosen id or null. */
export async function choose(title: string, options: ChoiceOption[]) {
  const v = await dialogs.open({ title, options });
  return typeof v === "string" ? v : null;
}
