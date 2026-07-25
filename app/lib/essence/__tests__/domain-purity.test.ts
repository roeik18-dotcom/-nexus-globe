/**
 * Domain Purity — ensure no browser/Next.js/Node.js-only APIs in essence modules.
 */

import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ESSENCE_DIR = path.join(__dirname, '..');

const FORBIDDEN_IMPORT_PATTERNS: Array<{ pattern: RegExp; label: string }> = [
  { pattern: /from ['"]react['"]/, label: 'react' },
  { pattern: /from ['"]next\//, label: 'next/*' },
  { pattern: /from ['"]fs['"]/, label: 'node:fs' },
  { pattern: /from ['"]node:fs['"]/, label: 'node:fs' },
  { pattern: /from ['"]path['"]/, label: 'node:path' },
  { pattern: /from ['"]node:path['"]/, label: 'node:path' },
  { pattern: /from ['"]crypto['"]/, label: 'node:crypto' },
  { pattern: /from ['"]node:crypto['"]/, label: 'node:crypto' },
  { pattern: /from ['"]child_process['"]/, label: 'child_process' },
];

const FORBIDDEN_GLOBALS: Array<{ pattern: RegExp; label: string }> = [
  { pattern: /\bwindow\./, label: 'window.*' },
  { pattern: /\bdocument\./, label: 'document.*' },
  { pattern: /\blocalStorage\./, label: 'localStorage' },
  { pattern: /\bsessionStorage\./, label: 'sessionStorage' },
  { pattern: /\bnavigator\./, label: 'navigator' },
];

function getEssenceSourceFiles(): string[] {
  return fs.readdirSync(ESSENCE_DIR)
    .filter(f =>
      f.endsWith('.ts') &&
      !f.endsWith('.test.ts') &&
      f !== '__tests__'
    )
    .map(f => path.join(ESSENCE_DIR, f));
}

describe('domain-purity', () => {
  const files = getEssenceSourceFiles();

  it('has at least the core source files', () => {
    expect(files.length).toBeGreaterThanOrEqual(7);
    const names = files.map(f => path.basename(f));
    expect(names).toContain('schema.ts');
    expect(names).toContain('ontology.ts');
    expect(names).toContain('pipeline.ts');
    expect(names).toContain('api.ts');
    expect(names).toContain('access.ts');
  });

  for (const { pattern, label } of FORBIDDEN_IMPORT_PATTERNS) {
    it(`no essence source file imports '${label}'`, () => {
      const violations: string[] = [];
      for (const file of files) {
        const content = fs.readFileSync(file, 'utf8');
        if (pattern.test(content)) {
          violations.push(path.basename(file));
        }
      }
      expect(violations, `Forbidden import '${label}' found in: ${violations.join(', ')}`).toHaveLength(0);
    });
  }

  for (const { pattern, label } of FORBIDDEN_GLOBALS) {
    it(`no essence source file uses browser global '${label}'`, () => {
      const violations: string[] = [];
      for (const file of files) {
        const content = fs.readFileSync(file, 'utf8');
        if (pattern.test(content)) {
          violations.push(path.basename(file));
        }
      }
      expect(violations, `Forbidden global '${label}' found in: ${violations.join(', ')}`).toHaveLength(0);
    });
  }
});
