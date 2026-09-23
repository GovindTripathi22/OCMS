import { safePathInsideRoot } from '@/lib/validation';
import path from 'path';
import os from 'os';
import fs from 'fs';

describe('safePathInsideRoot', () => {
  const testRoot = path.join(os.tmpdir(), 'ocms-test-root-' + Date.now());

  beforeAll(() => {
    fs.mkdirSync(testRoot, { recursive: true });
    fs.mkdirSync(path.join(testRoot, 'subdir'), { recursive: true });
    fs.writeFileSync(path.join(testRoot, 'subdir', 'file.css'), 'body{}');
  });

  afterAll(() => {
    fs.rmSync(testRoot, { recursive: true, force: true });
  });

  it('returns null (not throws) for malformed % input like %ZZ', () => {
    // This MUST NOT throw URIError
    expect(() => safePathInsideRoot(testRoot, '%ZZ')).not.toThrow();
    const result = safePathInsideRoot(testRoot, '%ZZ');
    expect(result).toBeNull();
  });

  it('returns null for malformed %% input', () => {
    expect(() => safePathInsideRoot(testRoot, 'foo%bar%ZZ')).not.toThrow();
    const result = safePathInsideRoot(testRoot, 'foo%bar%ZZ');
    expect(result).toBeNull();
  });

  it('rejects .. traversal', () => {
    expect(safePathInsideRoot(testRoot, '../etc/passwd')).toBeNull();
  });

  it('rejects null bytes', () => {
    expect(safePathInsideRoot(testRoot, 'file\x00.css')).toBeNull();
  });

  it('accepts valid subpath', () => {
    const result = safePathInsideRoot(testRoot, 'subdir/file.css');
    expect(result).not.toBeNull();
    expect(result).toContain('subdir');
  });

  it('rejects absolute paths', () => {
    expect(safePathInsideRoot(testRoot, '/etc/passwd')).toBeNull();
  });
});
