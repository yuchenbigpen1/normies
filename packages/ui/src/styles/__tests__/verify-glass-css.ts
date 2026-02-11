/**
 * Verification script for glass CSS variables and utility classes
 * Run with: bun run packages/ui/src/styles/__tests__/verify-glass-css.ts
 */

import { readFileSync } from 'fs';
import { join } from 'path';

const cssPath = join(import.meta.dir, '../index.css');
const electronCssPath = join(import.meta.dir, '../../../../../../apps/electron/src/renderer/index.css');

function verifyCSSContent(content: string): { passed: number; failed: string[] } {
  const checks = [
    { name: '--glass-blur variable', pattern: /--glass-blur:\s*\d+px/ },
    { name: '--glass-opacity variable', pattern: /--glass-opacity:\s*[\d.]+/ },
    { name: '--glass-border-opacity variable', pattern: /--glass-border-opacity:\s*[\d.]+/ },
    { name: '--glass-saturation variable', pattern: /--glass-saturation:\s*[\d.]+/ },
    { name: '.glass utility class', pattern: /\.glass\s*\{[^}]*backdrop-filter/ },
    { name: '.glass-light utility class', pattern: /\.glass-light\s*\{/ },
    { name: '.glass-medium utility class', pattern: /\.glass-medium\s*\{/ },
    { name: '.glass-strong utility class', pattern: /\.glass-strong\s*\{/ },
    { name: '.glass-border utility class', pattern: /\.glass-border\s*\{|\.glass-border::before/ },
  ];

  const results = checks.map(check => ({
    name: check.name,
    passed: check.pattern.test(content)
  }));

  const failed = results.filter(r => !r.passed).map(r => r.name);
  const passed = results.filter(r => r.passed).length;

  return { passed, failed };
}

// Run verification
console.log('🔍 Verifying glass CSS variables and utilities...\n');

try {
  // Try electron CSS first (where glass features should be)
  let content: string;
  let filePath: string;

  try {
    content = readFileSync(electronCssPath, 'utf-8');
    filePath = electronCssPath;
  } catch {
    content = readFileSync(cssPath, 'utf-8');
    filePath = cssPath;
  }

  const { passed, failed } = verifyCSSContent(content);

  console.log(`📄 Checked file: ${filePath}\n`);
  console.log(`✅ Passed: ${passed}/9 checks`);

  if (failed.length > 0) {
    console.log(`❌ Failed: ${failed.length} checks`);
    failed.forEach(name => console.log(`   - ${name}`));
    process.exit(1);
  } else {
    console.log('\n🎉 All glass CSS checks passed!');
    process.exit(0);
  }
} catch (error) {
  console.error('❌ Error reading CSS file:', error);
  process.exit(1);
}
