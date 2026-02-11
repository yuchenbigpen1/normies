import { rmSync, existsSync, unlinkSync } from 'fs';
import { homedir } from 'os';
import { join } from 'path';

const args = process.argv.slice(2);
const tokenOnly = args.includes('--token-only');
const configDir = process.env.NORMIES_CONFIG_DIR || join(homedir(), '.normies');

if (tokenOnly) {
  const tokenFiles = [
    join(configDir, 'credentials.enc'),
    join(configDir, 'config.json'),
  ];

  let removed = 0;
  for (const file of tokenFiles) {
    if (existsSync(file)) {
      unlinkSync(file);
      removed++;
    }
  }

  console.log(`[fresh-start] Token reset complete. Removed ${removed} file(s).`);
  process.exit(0);
}

if (existsSync(configDir)) {
  rmSync(configDir, { recursive: true, force: true });
  console.log(`[fresh-start] Removed ${configDir}`);
} else {
  console.log(`[fresh-start] Nothing to remove at ${configDir}`);
}

