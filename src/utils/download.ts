export function downloadTextFile(filename: string, content: string, mimeType = "text/plain;charset=utf-8") {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 500);
}

export function toCsv(rows: Array<Array<string | number>>) {
  return rows
    .map((row) => row.map((cell) => `"${String(cell).replaceAll("\"", "\"\"")}"`).join(","))
    .join("\n");
}

export function timestampedFilename(prefix: string, extension: string) {
  const stamp = new Date().toISOString().slice(0, 19).replace(/[-:T]/g, "");
  return `${prefix}-${stamp}.${extension}`;
}
