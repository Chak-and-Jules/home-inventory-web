import { describe, expect, it } from 'vitest';
import { getCategoryOptions } from './categoryOptions';

describe('category dropdown ordering', () => {
  it('sorts parents and their children together in the selected language without mutating input', () => {
    const categories = [
      { ID: 'z', Name: 'Zeytin', ParentID: 'food' },
      { ID: 'tools', Name: 'Tools' },
      { ID: 'food', Name: 'Food' },
      { ID: 'i', Name: 'Ispanak', ParentID: 'food' },
      { ID: 'd', Name: 'İncir', ParentID: 'food' },
    ];
    expect(getCategoryOptions(categories, 'tr').map((option) => option.label))
      .toEqual(['- Food', '  Ispanak', '  İncir', '  Zeytin', '- Tools']);
    expect(categories[0].ID).toBe('z');
  });
  it('keeps orphans and deeper or cyclic data selectable exactly once', () => {
    const result = getCategoryOptions([
      { ID: 'a', Name: 'A', ParentID: 'missing' },
      { ID: 'b', Name: 'B', ParentID: 'a' },
      { ID: 'c', Name: 'C', ParentID: 'b' },
      { ID: 'd', Name: 'D', ParentID: 'e' },
      { ID: 'e', Name: 'E', ParentID: 'd' },
    ]);
    expect(result.map((option) => option.id)).toEqual(['a', 'b', 'c', 'd', 'e']);
  });
});
