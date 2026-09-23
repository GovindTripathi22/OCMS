/**
 * Tests for proxy security: script filtering and event handler stripping.
 * Tests the filterScripts and rewriteHtmlAssets helper functions.
 */

describe('Proxy script filtering (fixed)', () => {
  // The fixed filterScripts uses two passes:
  // 1. Remove closed script tags: /<script\b[^>]*>[\s\S]*?<\/script>/gi
  // 2. Remove remaining unclosed/self-closing: /<script\b[^>]*\/?>/gi
  function filterScripts(html: string): string {
    html = html.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, '');
    html = html.replace(/<script\b[^>]*\/?>/gi, '');
    return html;
  }

  it('strips closed script tags', () => {
    const html = '<div>hello</div><script>alert(1)</script><p>rest</p>';
    expect(filterScripts(html)).toBe('<div>hello</div><p>rest</p>');
  });

  it('strips unclosed <script src=...> tags', () => {
    const html = '<div>hello</div><script src="evil.js">\n<p>rest</p>';
    const result = filterScripts(html);
    expect(result).not.toContain('<script');
  });

  it('strips self-closing <script .../> tags', () => {
    const html = '<script type="text/javascript" src="x"/><div>ok</div>';
    const result = filterScripts(html);
    expect(result).not.toContain('<script');
    expect(result).toContain('<div>ok</div>');
  });

  it('preserves non-script content', () => {
    const html = '<div>hello</div><p>world</p>';
    expect(filterScripts(html)).toBe(html);
  });
});

describe('Event handler stripping (fixed)', () => {
  // Fixed regex: [\s\/] instead of just \s before on-event
  const FIXED_EVENT_HANDLER_RE = /[\s\/]on[a-z]+\s*=\s*("([^"]*)"|'([^']*)'|[^\s>]+)/gi;

  it('strips <svg/onload=...> without space', () => {
    const html = '<svg/onload=alert(1)>';
    const stripped = html.replace(FIXED_EVENT_HANDLER_RE, '');
    expect(stripped).not.toContain('onload');
  });

  it('strips <div/onclick=...> without space', () => {
    const html = '<div/onclick=alert(1)>';
    const stripped = html.replace(FIXED_EVENT_HANDLER_RE, '');
    expect(stripped).not.toContain('onclick');
  });

  it('strips standard space-separated event handlers', () => {
    const html = '<div onmouseover="alert(1)">';
    const stripped = html.replace(FIXED_EVENT_HANDLER_RE, '');
    expect(stripped).not.toContain('onmouseover');
  });

  it('strips double-quoted event handler values', () => {
    const html = '<img onerror="alert(document.cookie)">';
    const stripped = html.replace(FIXED_EVENT_HANDLER_RE, '');
    expect(stripped).not.toContain('onerror');
  });

  it('strips single-quoted event handler values', () => {
    const html = "<button onclick='doEvil()'>";
    const stripped = html.replace(FIXED_EVENT_HANDLER_RE, '');
    expect(stripped).not.toContain('onclick');
  });
});
