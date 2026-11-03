export async function exportData(data) {
  const url = URL.createObjectURL(
    new Blob([JSON.stringify(data, null, 2)], { type: "application/json" }),
  );
  const a = document.createElement("a");
  a.href = url;
  a.download = `bolso-backup-${Date.now()}.json`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
export function importData() {
  return new Promise((resolve, reject) => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = ".json,application/json";
    input.oncancel = () => resolve(null);
    input.onchange = async () => {
      try {
        const file = input.files[0];
        if (!file) return resolve(null);
        if (file.size > 5000000) throw Error("O arquivo deve ter até 5 MB.");
        resolve(JSON.parse(await file.text()));
      } catch (e) {
        reject(e);
      }
    };
    input.click();
  });
}
