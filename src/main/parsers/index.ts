import * as fs from 'fs/promises';
import * as path from 'path';
import { runOCR } from '../ocr';

const EXT_MAP: Record<string, string> = {
  '.pdf': 'pdf',
  '.docx': 'docx',
  '.xlsx': 'xlsx',
  '.xls': 'xlsx',
  '.png': 'image',
  '.jpg': 'image',
  '.jpeg': 'image',
  '.bmp': 'image',
  '.webp': 'image',
  '.tiff': 'image',
};

export async function parseFile(filePath: string): Promise<string> {
  const ext = path.extname(filePath).toLowerCase();
  const type = EXT_MAP[ext];

  if (!type) {
    return await fs.readFile(filePath, 'utf-8');
  }

  switch (type) {
    case 'pdf':
      return await parsePdf(filePath);
    case 'docx':
      return await parseDocx(filePath);
    case 'xlsx':
      return await parseXlsx(filePath);
    case 'image':
      return await parseImage(filePath);
    default:
      throw new Error(`不支持的文件格式: ${ext}`);
  }
}

async function parsePdf(filePath: string): Promise<string> {
  const mod = await import('pdfjs-dist/legacy/build/pdf.mjs');
  const pdfjs = mod.default || mod;
  const buffer = await fs.readFile(filePath);
  const data = new Uint8Array(buffer);
  const doc = await pdfjs.getDocument({ data }).promise;
  const parts: string[] = [];
  for (let i = 1; i <= doc.numPages; i++) {
    const page = await doc.getPage(i);
    const content = await page.getTextContent();
    const text = content.items.map((item: any) => item.str).join(' ');
    if (text.trim()) parts.push(text);
  }
  if (parts.length === 0) {
    throw new Error('PDF 文件无法提取文本内容，可能是扫描件');
  }
  return parts.join('\n\n');
}

async function parseDocx(filePath: string): Promise<string> {
  const mod = await import('mammoth');
  const mammoth = mod.default || mod;
  const buffer = await fs.readFile(filePath);
  const result = await mammoth.extractRawText({ buffer });
  if (!result.value || result.value.trim().length === 0) {
    throw new Error('DOCX 文件无法提取文本内容');
  }
  return result.value;
}

async function parseXlsx(filePath: string): Promise<string> {
  const mod = await import('xlsx');
  const XLSX = mod.default || mod;
  const workbook = XLSX.readFile(filePath);
  const parts: string[] = [];

  for (const sheetName of workbook.SheetNames) {
    const sheet = workbook.Sheets[sheetName];
    const csv = XLSX.utils.sheet_to_csv(sheet);
    if (csv.trim()) {
      parts.push(`=== ${sheetName} ===\n${csv}`);
    }
  }

  if (parts.length === 0) {
    throw new Error('XLSX 文件无法提取文本内容');
  }
  return parts.join('\n\n');
}

async function parseImage(filePath: string): Promise<string> {
  const buffer = await fs.readFile(filePath);
  const result = await runOCR(buffer, 1.0);

  if (!result.success) {
    throw new Error(`图片 OCR 失败: ${result.error}`);
  }

  const texts = result.matches
    .filter(m => m.confidence > 0.4)
    .sort((a, b) => a.bounds.y - b.bounds.y || a.bounds.x - b.bounds.x)
    .map(m => m.text);

  if (texts.length === 0) {
    throw new Error('图片中未识别到文字');
  }

  return texts.join('\n');
}
