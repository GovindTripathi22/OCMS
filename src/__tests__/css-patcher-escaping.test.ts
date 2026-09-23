import { patchCssWithThemeColors } from '@/lib/theme-css-patcher';

describe('patchCssWithThemeColors escaping', () => {
  it('does not expand $& in existing CSS values', () => {
    const css = ':root { --color-primary: #ff0000; --other: content-with-$&-symbol; }';
    const colors = ['#111111', '#222222', '#333333', '#444444', '#555555'];
    const result = patchCssWithThemeColors(css, colors);
    // The $& must remain literal — it must NOT be expanded to the full regex match.
    // Before the fix, $& was replaced with the entire matched :root block, duplicating it.
    expect(result).toContain('$&-symbol');
    // The match must not be duplicated inside the value
    expect(result.indexOf(':root')).toBe(result.lastIndexOf(':root'));
    expect(result).toContain('#111111');
  });

  it("does not expand $' in existing CSS values", () => {
    const css = ":root { --color-primary: #ff0000; --font: 'Helvetica'; }";
    const colors = ['#aaaaaa', '#bbbbbb', '#cccccc', '#dddddd', '#eeeeee'];
    const result = patchCssWithThemeColors(css, colors);
    expect(result).toContain('#aaaaaa');
  });
});
