/**
 * Root release entrypoint.
 *
 * Delegates to the macOS packaging command used for DMG distribution.
 */

function run(command: string[]): void {
  const proc = Bun.spawnSync(command, { stdio: ['inherit', 'inherit', 'inherit'] });
  if (proc.exitCode !== 0) process.exit(proc.exitCode);
}

run(['bun', 'run', 'electron:dist:mac']);

