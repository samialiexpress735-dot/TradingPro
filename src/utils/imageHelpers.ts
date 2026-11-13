/**
 * Downscale + re-encode an uploaded screenshot to a small JPEG data URL.
 * Trades (and their chart images) are persisted as JSON, so a raw 5 MB screenshot as base64 can blow the storage quota.
 */
export async function compressImageToDataUrl(file: File, maxDim = 1280, quality = 0.82): Promise<string> {
  if (!file.type.startsWith('image/')) throw new Error('Please choose an image file.');
  const bitmapUrl = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const el = new Image();
      el.onload = () => resolve(el);
      el.onerror = () => reject(new Error('That image could not be read.'));
      el.src = bitmapUrl;
    });
    const scale = Math.min(1, maxDim / Math.max(img.width, img.height));
    const w = Math.max(1, Math.round(img.width * scale));
    const h = Math.max(1, Math.round(img.height * scale));
    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Image processing is not available in this browser.');
    ctx.fillStyle = '#ffffff'; // JPEG has no alpha
    ctx.fillRect(0, 0, w, h);
    ctx.drawImage(img, 0, 0, w, h);
    return canvas.toDataURL('image/jpeg', quality);
  } finally {
    URL.revokeObjectURL(bitmapUrl);
  }
}
