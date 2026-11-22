import type { jsPDF } from "jspdf";
import regularFontUrl from "@/assets/fonts/NotoSansBengali-Regular.ttf?url";
import boldFontUrl from "@/assets/fonts/NotoSansBengali-Bold.ttf?url";

// jsPDF can't shape Bengali (it draws glyphs in logical order, so the ি vowel
// sign lands after its consonant — F-04) and Noto Sans Bengali has no Latin
// letters (embedding it as the PDF font printed English names blank — F-30).
// So a name containing Bengali is rasterised by the browser's own text engine
// (correct shaping, per-glyph fallback for Latin) and placed as an image;
// every other name stays ordinary selectable Helvetica text.
const BENGALI = /[ঀ-৿]/;
const PT_TO_MM = 25.4 / 72;
const PX_PER_MM = 12;

let fontsReady: Promise<void> | null = null;

export function loadNameFonts(): Promise<void> {
  fontsReady ??= Promise.all(
    (
      [
        [regularFontUrl, "400"],
        [boldFontUrl, "700"],
      ] as const
    ).map(async ([url, weight]) => {
      const face = new FontFace("NotoSansBengali", `url(${url})`, { weight });
      await face.load();
      document.fonts.add(face);
    }),
  ).then(
    () => undefined,
    // Canvas then falls back to a system Bengali font — still shaped, just not Noto.
    () => undefined,
  );
  return fontsReady;
}

export interface NameOpts {
  sizePt: number;
  minPt?: number;
  bold?: boolean;
  color?: [number, number, number];
  maxLines?: number;
  lineMm?: number;
}

type Measure = (text: string, pt: number) => number;

// Shrink to one line first; only when minPt still overflows, wrap on spaces.
// shortcut: a single word wider than maxWidth at minPt, or more words than
// maxLines allows, overflows the cell instead of being cut — upgrade if
// real names ever hit it.
export function layoutName(
  measure: Measure,
  text: string,
  maxWidth: number,
  sizePt: number,
  minPt: number,
  maxLines: number,
): { pt: number; lines: string[] } {
  for (let pt = sizePt; pt >= minPt; pt -= 0.5) {
    if (measure(text, pt) <= maxWidth) return { pt, lines: [text] };
  }
  const lines: string[] = [];
  let cur = "";
  for (const word of text.split(/\s+/)) {
    const next = cur ? `${cur} ${word}` : word;
    if (cur && measure(next, minPt) > maxWidth) {
      lines.push(cur);
      cur = word;
    } else {
      cur = next;
    }
  }
  lines.push(cur);
  const head = lines.slice(0, maxLines - 1);
  return { pt: minPt, lines: [...head, lines.slice(maxLines - 1).join(" ")] };
}

const fontSpec = (pt: number, bold: boolean) =>
  `${bold ? 700 : 400} ${pt * PT_TO_MM * PX_PER_MM}px NotoSansBengali, Arial, Helvetica, sans-serif`;

function canvasMeasure(bold: boolean): Measure {
  const ctx = document.createElement("canvas").getContext("2d")!;
  return (text, pt) => {
    ctx.font = fontSpec(pt, bold);
    return ctx.measureText(text).width / PX_PER_MM;
  };
}

function drawBengaliLine(
  doc: jsPDF,
  line: string,
  x: number,
  y: number,
  pt: number,
  bold: boolean,
  color: [number, number, number],
) {
  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d")!;
  const px = pt * PT_TO_MM * PX_PER_MM;
  ctx.font = fontSpec(pt, bold);
  const pad = 2;
  const above = px * 1.15;
  canvas.width = Math.ceil(ctx.measureText(line).width) + pad * 2;
  canvas.height = Math.ceil(above + px * 0.55);
  ctx.font = fontSpec(pt, bold);
  ctx.fillStyle = `rgb(${color.join(",")})`;
  ctx.textBaseline = "alphabetic";
  ctx.fillText(line, pad, above);
  doc.addImage(
    canvas.toDataURL("image/png"),
    "PNG",
    x - pad / PX_PER_MM,
    y - above / PX_PER_MM,
    canvas.width / PX_PER_MM,
    canvas.height / PX_PER_MM,
  );
}

// `y` is the text baseline in mm for a single-line name. A wrapped name is
// lifted a little per extra line so its last line stays inside a fixed-height
// cell. Call `await loadNameFonts()` once per document first.
export function drawName(doc: jsPDF, text: string, x: number, y: number, maxWidth: number, o: NameOpts) {
  const bold = o.bold ?? true;
  const color = o.color ?? [0, 0, 0];
  const lineMm = o.lineMm ?? 2.5;
  const bengali = BENGALI.test(text);
  doc.setFont("helvetica", bold ? "bold" : "normal");
  const measure: Measure = bengali
    ? canvasMeasure(bold)
    : (s, pt) => {
        doc.setFontSize(pt);
        return doc.getTextWidth(s);
      };
  const { pt, lines } = layoutName(measure, text, maxWidth, o.sizePt, o.minPt ?? o.sizePt, o.maxLines ?? 2);
  const top = y - (lines.length - 1) * 1.6;
  doc.setFontSize(pt);
  doc.setTextColor(...color);
  lines.forEach((line, i) => {
    const ly = top + i * lineMm;
    if (bengali) drawBengaliLine(doc, line, x, ly, pt, bold, color);
    else doc.text(line, x, ly);
  });
}
