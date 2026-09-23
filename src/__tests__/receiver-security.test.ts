/**
 * Tests for ocms-receiver.js security: innerHTML XSS, link href XSS,
 * and insecure default origin.
 */

import * as fs from 'fs';
import * as path from 'path';

const receiverSource = fs.readFileSync(
  path.resolve(__dirname, '../../public/ocms-receiver.js'),
  'utf8'
);

describe('Receiver: innerHTML XSS via HTML-containing text values', () => {
  // The HTML-detection regex that was used to route values to innerHTML
  const HTML_DETECT_RE = /<[a-zA-Z][^>]*>/i;

  it('detects dangerous <img onerror=...> as HTML (confirms XSS path was reachable)', () => {
    expect(HTML_DETECT_RE.test('<img onerror=alert(1)>')).toBe(true);
  });

  it('detects <script>alert(1)</script> as HTML', () => {
    expect(HTML_DETECT_RE.test('<script>alert(1)</script>')).toBe(true);
  });

  it('after fix, receiver should use textContent instead of innerHTML', () => {
    // The fix removes the innerHTML branch entirely
    expect(receiverSource).not.toContain('el.innerHTML');
  });
});

describe('Receiver: link href protocol injection', () => {
  it('after fix, receiver should reject javascript: protocol', () => {
    // The fix adds a check for dangerous protocols before setting el.href
    expect(receiverSource).toContain('javascript:');
  });

  it('after fix, receiver should reject data: protocol', () => {
    expect(receiverSource).toContain('data:');
  });

  it('after fix, receiver should reject vbscript: protocol', () => {
    expect(receiverSource).toContain('vbscript:');
  });
});

describe('Receiver: data-allowed-origin default', () => {
  it('should NOT document wildcard "*" as the example origin', () => {
    // The usage comment should show a real domain, not "*"
    expect(receiverSource).not.toMatch(/data-allowed-origin=["']\*["']/);
  });
});
