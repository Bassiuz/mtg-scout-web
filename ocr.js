// In-browser OCR for Scout scans, called from lib/ocr/tesseract_web.dart.
// Needs Tesseract.js v5 (index.html): v6+ no longer returns `data.lines` by default.
//
// Raw Tesseract misreads phone photos of a TV (small light-on-blue text, glare),
// so the image is grayscaled and upscaled first, and lines Tesseract is not
// confident about (bezel, reflections, table edge) are dropped.
//
// Tuned on a 900x1600 photo of an EventLink registration screen: raw read 7 of
// 13 rows; gray at 1600-2000px wide read 13 of 13, narrower or wider lost rows.
// Name words scored >= 85 confidence, junk words <= 63.
const SCOUT_OCR_MIN_WIDTH = 1800;
const SCOUT_OCR_MIN_CONFIDENCE = 75;

async function scoutRecognize(url) {
  const img = new Image();
  img.src = url;
  await img.decode();
  const w = img.naturalWidth, h = img.naturalHeight;
  // Upscale small images, never shrink sharp ones; 16MP is the iOS canvas limit.
  const scale = Math.min(Math.max(1, SCOUT_OCR_MIN_WIDTH / w), Math.sqrt(16e6 / (w * h)));
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(w * scale);
  canvas.height = Math.round(h * scale);
  const ctx = canvas.getContext('2d');
  ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
  const pixels = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const p = pixels.data;
  for (let i = 0; i < p.length; i += 4) {
    p[i] = p[i + 1] = p[i + 2] = 0.299 * p[i] + 0.587 * p[i + 1] + 0.114 * p[i + 2];
  }
  ctx.putImageData(pixels, 0, 0);

  const { data } = await Tesseract.recognize(canvas, 'eng');
  return data.lines
    .filter((line) => line.words.some(
      (word) => /\p{L}/u.test(word.text) && word.confidence >= SCOUT_OCR_MIN_CONFIDENCE))
    .map((line) => line.text.trim())
    .join('\n');
}
