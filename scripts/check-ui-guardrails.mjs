#!/usr/bin/env node
/**
 * Guardrail UI Automated Check (Phase 3.4)
 *
 * Mencegah regresi ukuran font micro (text-[9px], text-[10px]) maupun
 * glass transparency yang menyebabkan kegagalan kontras di layar mobile.
 */

import fs from 'node:fs';
import path from 'node:path';

const SRC_ROOT = path.resolve(process.cwd(), 'src');

const FORBIDDEN_RULES = [
  {
    name: 'micro-font-9px',
    regex: /\btext-\[9px\]/g,
    message: 'Gunakan text-xs (12px) untuk teks informatif atau text-[11px] hanya untuk badge kompak.',
  },
  {
    name: 'micro-font-10px',
    regex: /\btext-\[10px\]/g,
    message: 'Gunakan text-xs (12px) untuk teks informatif atau text-[11px] hanya untuk badge kompak.',
  },
  {
    name: 'low-contrast-glass',
    regex: /\bbg-white\/(?:1|30)(?=[\s"'`])/g,
    message: 'Hindari bg-white/1 atau bg-white/30 pada latar terang; gunakan bg-white/90 atau bg-slate-900/35 untuk teks putih.',
  },
];

function walkFiles(dir) {
  const results = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      results.push(...walkFiles(fullPath));
    } else if (/\.(tsx?|css)$/.test(entry.name)) {
      results.push(fullPath);
    }
  }
  return results;
}

const files = walkFiles(SRC_ROOT);
const violations = [];

for (const filePath of files) {
  const relPath = path.relative(process.cwd(), filePath);
  const content = fs.readFileSync(filePath, 'utf8');
  const lines = content.split('\n');

  lines.forEach((line, idx) => {
    // Skip doc comments
    if (/^\s*(\/\/|\*|\/\*)/.test(line)) return;

    for (const rule of FORBIDDEN_RULES) {
      rule.regex.lastIndex = 0;
      if (rule.regex.test(line)) {
        violations.push({
          file: relPath,
          line: idx + 1,
          rule: rule.name,
          message: rule.message,
          snippet: line.trim().slice(0, 120),
        });
      }
    }
  });
}

if (violations.length > 0) {
  console.error(`\n[check:ui] Ditemukan ${violations.length} pelanggaran UI Guardrails:\n`);
  for (const v of violations.slice(0, 50)) {
    console.error(`  - ${v.file}:${v.line} [${v.rule}] -> ${v.message}\n    ${v.snippet}`);
  }
  process.exit(1);
}

console.log(`[check:ui] Lolos (${files.length} file dipindai, 0 pelanggaran font micro / glass opacity).`);
