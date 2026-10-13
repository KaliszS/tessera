import type { ColumnType, Row } from "./schema";

/** RFC 4180 CSV: quoted fields, doubled quotes, CRLF or LF. */
export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let quoted = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (quoted) {
      if (c === '"' && text[i + 1] === '"') {
        field += '"';
        i++;
      } else if (c === '"') {
        quoted = false;
      } else {
        field += c;
      }
    } else if (c === '"') {
      quoted = true;
    } else if (c === ",") {
      row.push(field);
      field = "";
    } else if (c === "\n" || c === "\r") {
      if (c === "\r" && text[i + 1] === "\n") i++;
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
    } else {
      field += c;
    }
  }
  if (field !== "" || row.length > 0) {
    row.push(field);
    rows.push(row);
  }
  return rows.filter((r) => !(r.length === 1 && r[0].trim() === "") && !r[0].startsWith("#"));
}

function convert(raw: string, type: ColumnType, where: string): Row[string] {
  const v = raw.trim();
  if (v === "") return type.endsWith("_list") ? [] : null;
  switch (type) {
    case "string":
      return v;
    case "int":
    case "number": {
      const n = Number(v);
      if (Number.isNaN(n) || (type === "int" && !Number.isInteger(n))) throw new Error(`${where}: expected ${type}, got "${v}"`);
      return n;
    }
    case "bool":
      if (!["true", "false", "1", "0", "yes", "no"].includes(v.toLowerCase())) throw new Error(`${where}: expected bool, got "${v}"`);
      return ["true", "1", "yes"].includes(v.toLowerCase());
    case "string_list":
      return v.split(";").map((s) => s.trim()).filter(Boolean);
    case "int_list":
      return v.split(";").map((s) => {
        const n = Number(s.trim());
        if (!Number.isInteger(n)) throw new Error(`${where}: expected int list, got "${v}"`);
        return n;
      });
  }
}

/** Empty scalar cells are omitted so JSONata paths and aggregates skip them. */
export function csvToRows(text: string, columns: Record<string, ColumnType>, file: string): Row[] {
  const [header, ...body] = parseCsv(text);
  if (!header) return [];
  const names = header.map((h) => h.trim());
  return body.map((cells, i) => {
    const row: Row = {};
    names.forEach((name, j) => {
      const v = convert(cells[j] ?? "", columns[name] ?? "string", `${file}:${i + 2}:${name}`);
      if (v !== null) row[name] = v;
    });
    return row;
  });
}
