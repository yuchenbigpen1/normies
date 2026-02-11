/**
 * Root build entrypoint.
 *
 * Keeps `bun run build` aligned with the desktop app release path.
 */

function run(command: string[]): void {
  const proc = Bun.spawnSync(command, { stdio: ['inherit', 'inherit', 'inherit'] });
  if (proc.exitCode !== 0) process.exit(proc.exitCode);
}

run(['bun', 'run', 'electron:build']);

