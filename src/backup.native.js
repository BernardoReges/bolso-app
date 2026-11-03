import { File, Paths } from "expo-file-system";
import * as Sharing from "expo-sharing";
import * as Picker from "expo-document-picker";
export async function exportData(data) {
  const file = new File(Paths.cache, `bolso-backup-${Date.now()}.json`);
  file.create();
  file.write(JSON.stringify(data, null, 2));
  if (!(await Sharing.isAvailableAsync()))
    throw Error(
      "O compartilhamento de arquivos não está disponível neste aparelho.",
    );
  await Sharing.shareAsync(file.uri, {
    mimeType: "application/json",
    dialogTitle: "Guardar backup do Bolso",
  });
}
export async function importData() {
  const result = await Picker.getDocumentAsync({
    type: ["application/json", "text/plain", "application/octet-stream"],
    copyToCacheDirectory: true,
  });
  if (result.canceled) return null;
  const asset = result.assets[0];
  if ((asset.size || 0) > 5000000) throw Error("O arquivo deve ter até 5 MB.");
  const text = await new File(asset.uri).text();
  if (text.length > 5000000) throw Error("O arquivo deve ter até 5 MB.");
  return JSON.parse(text);
}
