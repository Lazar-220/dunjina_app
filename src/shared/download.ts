/** Saves text as a file through the browser's standard download mechanism. */
export function downloadTextFile(fileName: string, text: string, mimeType = 'application/json'): void {
  const url = URL.createObjectURL(new Blob([text], { type: mimeType }));
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  document.body.append(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}
