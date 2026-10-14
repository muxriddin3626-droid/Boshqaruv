const MAX_SIDE = 1600;
const MAX_DATA_URL_LENGTH = 3_800_000; // ~2.8 MB — server chegarasi 3 MB

function loadImage(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const image = new Image();
    image.onload = () => {
      URL.revokeObjectURL(url);
      resolve(image);
    };
    image.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("Rasmni ochib bo'lmadi"));
    };
    image.src = url;
  });
}

/**
 * Daftar rasmini JPEG'ga o'girib, uzun tomonini 1600px gacha kichraytiradi:
 * telefon kamerasi 5-10 MB rasm beradi, qo'lyozmani o'qish uchun esa shu yetarli.
 */
export async function compressPhoto(file: File): Promise<string> {
  if (!file.type.startsWith("image/")) throw new Error("Faqat rasm yuklash mumkin");
  const image = await loadImage(file);
  const scale = Math.min(1, MAX_SIDE / Math.max(image.naturalWidth, image.naturalHeight));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(image.naturalWidth * scale);
  canvas.height = Math.round(image.naturalHeight * scale);
  const context = canvas.getContext("2d");
  if (!context) throw new Error("Rasmni tayyorlab bo'lmadi");
  context.fillStyle = "#ffffff";
  context.fillRect(0, 0, canvas.width, canvas.height);
  context.drawImage(image, 0, 0, canvas.width, canvas.height);
  for (const quality of [0.82, 0.65, 0.5]) {
    const dataUrl = canvas.toDataURL("image/jpeg", quality);
    if (dataUrl.length <= MAX_DATA_URL_LENGTH) return dataUrl;
  }
  throw new Error("Rasm juda katta — yaqinroqdan, faqat yechimni suratga oling");
}
