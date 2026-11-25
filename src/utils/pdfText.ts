/**
 * Text helpers for the PDF scorecard. jsPDF's built-in fonts only cover Latin-1, so Hindi (Devanagari),
 * ₹, √ etc. are drawn on a browser canvas (which shapes Indic scripts correctly) and embedded as images.
 */

/** Map common typographic characters to ones the built-in PDF font has. */
export function toPdfText(text: string): string {
  return text
    .replace(/[‘’′]/g, "'")
    .replace(/[“”″]/g, '"')
    .replace(/[–—−]/g, '-')
    .replace(/…/g, '...')
    .replace(/ /g, ' ');
}

/** Anything outside Latin-1 (Devanagari, ₹, √ ...) must be drawn via canvas. */
export function needsRaster(text: string): boolean {
  return /[^\s!-ÿ]/.test(text);
}

export interface RasterText {
  dataUrl: string;
  widthMm: number;
  heightMm: number;
}

/** Draw wrapped text on a canvas and return it as a JPEG sized in millimetres. */
export function rasterText(text: string, widthMm: number, fontPt: number): RasterText {
  const scale = 2; // device pixels per CSS pixel (sharp enough for A4, keeps the PDF small)
  const pxPerMm = 96 / 25.4;
  const fontPx = fontPt * (96 / 72);
  const lineHeight = fontPx * 1.35;
  const maxWidth = widthMm * pxPerMm;
  const font = `${fontPx}px "Noto Sans Devanagari", "Nirmala UI", Mangal, "Noto Sans", Arial, sans-serif`;

  const measure = document.createElement('canvas').getContext('2d');
  if (!measure) return { dataUrl: '', widthMm, heightMm: 0 };
  measure.font = font;

  const lines: string[] = [];
  for (const para of text.split('\n')) {
    if (!para) {
      lines.push('');
      continue;
    }
    let line = '';
    for (const word of para.split(/(\s+)/)) {
      const candidate = line + word;
      if (line && measure.measureText(candidate).width > maxWidth) {
        lines.push(line.trimEnd());
        line = word.trimStart();
      } else {
        line = candidate;
      }
    }
    lines.push(line);
  }

  const canvas = document.createElement('canvas');
  canvas.width = Math.ceil(maxWidth * scale);
  canvas.height = Math.max(1, Math.ceil((lines.length * lineHeight + fontPx * 0.4) * scale));
  const ctx = canvas.getContext('2d');
  if (!ctx) return { dataUrl: '', widthMm, heightMm: 0 };
  ctx.scale(scale, scale);
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, maxWidth, canvas.height / scale);
  ctx.fillStyle = '#1e293b';
  ctx.font = font;
  ctx.textBaseline = 'top';
  lines.forEach((l, i) => ctx.fillText(l, 0, i * lineHeight + 1));
  return {
    dataUrl: canvas.toDataURL('image/jpeg', 0.8),
    widthMm,
    heightMm: canvas.height / scale / pxPerMm,
  };
}
