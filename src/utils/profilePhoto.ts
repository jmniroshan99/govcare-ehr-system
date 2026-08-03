const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? "http://127.0.0.1:4001";

const imageDataUrlPattern = /^data:image\/(?:png|jpe?g|webp|gif);base64,/i;
const absoluteUrlPattern = /^https?:\/\//i;

export function normalisePatientPhotoSource(value?: string | null): string | null {
  const source = value?.trim();
  if (!source) return null;

  if (imageDataUrlPattern.test(source) || source.startsWith("blob:") || absoluteUrlPattern.test(source)) {
    return source;
  }

  // Never try to render a browser file-picker path such as C:\\fakepath\\photo.jpg.
  if (/^[a-z]:\\/i.test(source) || source.includes("\\fakepath\\")) return null;

  if (source.startsWith("/")) return `${API_BASE_URL.replace(/\/$/, "")}${source}`;
  return null;
}

export async function preparePatientProfilePhoto(file: File): Promise<string> {
  if (!file.type.startsWith("image/")) throw new Error("Choose a valid image file.");
  if (file.size > 10 * 1024 * 1024) throw new Error("Patient photo must be smaller than 10 MB.");

  const objectUrl = URL.createObjectURL(file);
  try {
    const image = await new Promise<HTMLImageElement>((resolve, reject) => {
      const element = new Image();
      element.onload = () => resolve(element);
      element.onerror = () => reject(new Error("The selected patient photo could not be read."));
      element.src = objectUrl;
    });

    const size = 480;
    const canvas = document.createElement("canvas");
    canvas.width = size;
    canvas.height = size;
    const context = canvas.getContext("2d");
    if (!context) throw new Error("Patient photo processing is unavailable in this browser.");

    const sourceSize = Math.min(image.naturalWidth, image.naturalHeight);
    const sourceX = Math.max(0, (image.naturalWidth - sourceSize) / 2);
    const sourceY = Math.max(0, (image.naturalHeight - sourceSize) / 2);
    context.drawImage(image, sourceX, sourceY, sourceSize, sourceSize, 0, 0, size, size);

    const dataUrl = canvas.toDataURL("image/jpeg", 0.82);
    if (!imageDataUrlPattern.test(dataUrl)) throw new Error("The patient photo could not be encoded.");
    return dataUrl;
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}
