export interface Toast {
  id: number;
  text: string;
  kind: "info" | "error";
}

class Toasts {
  items = $state.raw<Toast[]>([]);
  private next = 0;

  show(text: string, kind: Toast["kind"] = "info", ms = 5000) {
    const id = ++this.next;
    this.items = [...this.items, { id, text, kind }];
    setTimeout(() => this.dismiss(id), ms);
  }

  dismiss(id: number) {
    this.items = this.items.filter((t) => t.id !== id);
  }
}

export const toasts = new Toasts();
