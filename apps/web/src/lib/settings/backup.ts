import { exportSettings, importSettings } from "../core/db";
import { download } from "../core/util";

export async function exportToFile() {
  const data = await exportSettings(true);
  download(`tessera-settings-${new Date().toISOString().slice(0, 10)}.json`, JSON.stringify(data));
}

export async function importFromFile(file: File) {
  await importSettings(JSON.parse(await file.text()));
  location.reload();
}
