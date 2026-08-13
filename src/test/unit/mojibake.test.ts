import { describe, expect, it } from 'vitest';
import fs from 'fs';
import path from 'path';

function findFilesRecursive(dir: string, fileList: string[] = []): string[] {
  if (!fs.existsSync(dir)) return fileList;
  const files = fs.readdirSync(dir);
  for (const file of files) {
    const filePath = path.join(dir, file);
    const stat = fs.statSync(filePath);
    if (stat.isDirectory()) {
      findFilesRecursive(filePath, fileList);
    } else if (/\.(tsx?|jsx?|html|css)$/.test(file) && !file.includes('.test.') && !filePath.includes(path.join('src', 'test'))) {
      fileList.push(filePath);
    }
  }
  return fileList;
}

describe('Mojibake Source Code Audit', () => {
  it('ensures no UI source code contains corrupted characters (mojibake)', () => {
    const rootDir = path.resolve(process.cwd(), 'src');
    const files = findFilesRecursive(rootDir);

    // Using hex unicode escapes so the test file itself does not contain literal mojibake bytes
    const corruptedPatterns = [
      /\u00e2\u20ac\u00a2/, // \u00e2\u20ac\u00a2
      /\u00e2\u20ac/,       // \u00e2\u20ac
      /\u00c3\u00a2/,       // \u00c3\u00a2
      /\u00c3/,             // \u00c3
      /\ufffd/,             // replacement character
    ];

    const violations: Array<{ file: string; match: string }> = [];

    for (const filePath of files) {
      const content = fs.readFileSync(filePath, 'utf-8');
      for (const pattern of corruptedPatterns) {
        if (pattern.test(content)) {
          const relativePath = path.relative(process.cwd(), filePath);
          violations.push({ file: relativePath, match: pattern.toString() });
        }
      }
    }

    expect(
      violations,
      `Ditemukan karakter mojibake pada file berikut:\n${violations
        .map((v) => `${v.file} (pattern: ${v.match})`)
        .join('\n')}`
    ).toEqual([]);
  });
});
