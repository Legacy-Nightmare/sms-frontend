import type { jsPDF } from "jspdf";
import regularFontUrl from "@/assets/fonts/NotoSansBengali-Regular.ttf?url";
import boldFontUrl from "@/assets/fonts/NotoSansBengali-Bold.ttf?url";

// F-04: jsPDF's built-in fonts (Helvetica etc.) only support WinAnsi, so any
// Bengali name prints as garbage glyphs. Noto Sans Bengali covers both
// Bengali and Latin, so it's safe to use for any name field regardless of
// script. Fetched once per page session and cached — the fonts aren't
// bundled as a giant base64 string in source, following the same
// fetch+base64 approach already used for images in this codebase.
let regularBase64: string | null = null;
let boldBase64: string | null = null;

async function fetchFontBase64(url: string): Promise<string> {
  const res = await fetch(url);
  const buffer = await res.arrayBuffer();
  let binary = "";
  for (const byte of new Uint8Array(buffer)) binary += String.fromCharCode(byte);
  return btoa(binary);
}

export const BENGALI_FONT = "NotoSansBengali";

export async function registerBengaliFont(doc: jsPDF): Promise<void> {
  if (!regularBase64) regularBase64 = await fetchFontBase64(regularFontUrl);
  if (!boldBase64) boldBase64 = await fetchFontBase64(boldFontUrl);
  doc.addFileToVFS("NotoSansBengali-Regular.ttf", regularBase64);
  doc.addFont("NotoSansBengali-Regular.ttf", BENGALI_FONT, "normal");
  doc.addFileToVFS("NotoSansBengali-Bold.ttf", boldBase64);
  doc.addFont("NotoSansBengali-Bold.ttf", BENGALI_FONT, "bold");
}
