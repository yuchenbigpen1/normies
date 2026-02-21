/**
 * Tests for codex/binary-resolver.ts
 *
 * Resolution order:
 * 1. CODEX_PATH env var (explicit override)
 * 2. Bundled binary via _vendorRoot
 * 3. System PATH fallback
 */
import { describe, it, expect, beforeEach, afterEach } from 'bun:test';
import { mkdirSync, writeFileSync, rmSync, mkdtempSync, existsSync } from 'fs';
import { join } from 'path';
import { tmpdir, platform, arch } from 'os';

// ─── helpers ────────────────────────────────────────────────────────────────

function platformArch(): string {
  const p = platform();
  const a = arch();
  return `${p}-${a}`;
}

function binaryName(): string {
  return platform() === 'win32' ? 'codex.exe' : 'codex';
}

function makeTempDir(): string {
  return mkdtempSync(join(tmpdir(), 'codex-test-'));
}

function createFakeBinary(dir: string): string {
  const binPath = join(dir, binaryName());
  writeFileSync(binPath, '#!/bin/sh\necho fake codex', { mode: 0o755 });
  return binPath;
}

// ─── tests ──────────────────────────────────────────────────────────────────

describe('binary-resolver', () => {
  let originalCodexPath: string | undefined;
  let tempDirs: string[] = [];

  beforeEach(() => {
    originalCodexPath = process.env.CODEX_PATH;
    delete process.env.CODEX_PATH;
    tempDirs = [];
  });

  afterEach(() => {
    if (originalCodexPath !== undefined) {
      process.env.CODEX_PATH = originalCodexPath;
    } else {
      delete process.env.CODEX_PATH;
    }
    // Clean up temp dirs
    for (const dir of tempDirs) {
      try { rmSync(dir, { recursive: true }); } catch {}
    }
  });

  // Import the module fresh for each test group to reset _vendorRoot state
  describe('CODEX_PATH env var', () => {
    it('resolves to CODEX_PATH when file exists', async () => {
      const tmp = makeTempDir();
      tempDirs.push(tmp);
      const fakeBin = createFakeBinary(tmp);

      process.env.CODEX_PATH = fakeBin;

      const { resolveCodexBinary, setVendorRoot } = await import('../src/codex/binary-resolver.ts');
      setVendorRoot('');

      const result = resolveCodexBinary();
      expect(result.path).toBe(fakeBin);
      expect(result.source).toBe('CODEX_PATH environment variable');
    });

    it('falls through when CODEX_PATH points to nonexistent file', async () => {
      process.env.CODEX_PATH = '/nonexistent/path/codex';

      const { resolveCodexBinary, setVendorRoot } = await import('../src/codex/binary-resolver.ts');
      setVendorRoot('');

      const result = resolveCodexBinary();
      // Should fall through to system PATH fallback
      expect(result.path).toBe('codex');
      expect(result.source).toBe('system PATH');
    });
  });

  describe('bundled binary via vendorRoot', () => {
    it('finds bundled binary when vendorRoot and binary exist', async () => {
      const root = makeTempDir();
      tempDirs.push(root);

      // Create vendor/codex/{platform-arch}/codex structure
      const pa = platformArch();
      const vendorDir = join(root, 'vendor', 'codex', pa);
      mkdirSync(vendorDir, { recursive: true });
      const fakeBin = createFakeBinary(vendorDir);

      delete process.env.CODEX_PATH;

      const { resolveCodexBinary, setVendorRoot } = await import('../src/codex/binary-resolver.ts');
      setVendorRoot(root);

      const result = resolveCodexBinary();
      expect(result.path).toBe(fakeBin);
      expect(result.source).toBe('bundled binary');
    });

    it('falls through to system PATH when bundled binary is missing', async () => {
      const root = makeTempDir();
      tempDirs.push(root);
      // vendorRoot exists but no binary inside

      delete process.env.CODEX_PATH;

      const { resolveCodexBinary, setVendorRoot } = await import('../src/codex/binary-resolver.ts');
      setVendorRoot(root);

      const result = resolveCodexBinary();
      expect(result.path).toBe('codex');
      expect(result.source).toBe('system PATH');
    });
  });

  describe('system PATH fallback', () => {
    it('returns codex system command when nothing else is found', async () => {
      delete process.env.CODEX_PATH;

      const { resolveCodexBinary, setVendorRoot } = await import('../src/codex/binary-resolver.ts');
      setVendorRoot('');

      const result = resolveCodexBinary();
      expect(result.path).toBe('codex');
      expect(result.source).toBe('system PATH');
    });
  });

  describe('getCodexPath', () => {
    it('returns string path', async () => {
      delete process.env.CODEX_PATH;

      const { getCodexPath, setVendorRoot } = await import('../src/codex/binary-resolver.ts');
      setVendorRoot('');

      const path = getCodexPath();
      expect(typeof path).toBe('string');
      expect(path.length).toBeGreaterThan(0);
    });
  });

  describe('vendor directory structure', () => {
    it('vendor/codex/{platform-arch}/ directory exists in project root', () => {
      // This test verifies the binary was downloaded to the vendor directory.
      // It fails until download-codex.sh has been run.
      const projectRoot = join(__dirname, '..', '..', '..');
      const pa = platformArch();
      const vendorDir = join(projectRoot, 'vendor', 'codex', pa);
      const binPath = join(vendorDir, binaryName());

      expect(existsSync(vendorDir)).toBe(true);
      expect(existsSync(binPath)).toBe(true);
    });
  });
});
