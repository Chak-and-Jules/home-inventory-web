import { describe, expect, it } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';
import en from './locales/en/common.json';
import tr from './locales/tr/common.json';

function keys(value: unknown, prefix = ''): string[] {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return [prefix];
  return Object.entries(value).flatMap(([key, child]) => keys(child, prefix ? `${prefix}.${key}` : key));
}
describe('UI translations', () => {
  it('has matching English and Turkish keys and interpolation variables', () => {
    expect(keys(en).sort()).toEqual(keys(tr).sort());
    for (const key of keys(en)) {
      const get = (data: unknown) => key.split('.').reduce<unknown>((value, part) => (value as Record<string, unknown>)[part], data);
      const placeholders = (value: unknown) => typeof value === 'string' ? [...value.matchAll(/{{(\w+)}}/g)].map((match) => match[1]).sort() : [];
      expect(placeholders(get(en)), key).toEqual(placeholders(get(tr)));
    }
  });
  it('defines all literal translation keys referenced by components', () => {
    const root = resolve(process.cwd(), 'src');
    const defined = new Set(keys(en));
    for (const file of readdirSync(root, { recursive: true }).map(String).filter((file) => file.endsWith('.tsx') && !file.includes('.test.'))) {
      const source = readFileSync(resolve(root, file), 'utf8');
      for (const match of source.matchAll(/\bt\(['"]([^'"]+)['"]/g)) {
        expect(defined.has(match[1]), `${file}: ${match[1]}`).toBe(true);
      }
    }
  });
});
