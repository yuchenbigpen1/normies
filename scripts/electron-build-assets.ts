/**
 * Cross-platform assets copy script
 *
 * Copies shared documentation files (packages/shared/assets/docs/)
 * into the Electron dist directory so they are bundled with the app.
 * At runtime, packages/shared/src/docs/index.ts reads these files
 * and installs them to ~/.craft-agent/docs/.
 *
 * Without this step, the packaged app falls back to placeholder content.
 * See upstream issue #71
 */

import { existsSync, cpSync, mkdirSync } from "fs";
import { join } from "path";

const ROOT_DIR = join(import.meta.dir, "..");
const ELECTRON_DIR = join(ROOT_DIR, "apps/electron");

const srcDir = join(ROOT_DIR, "packages/shared/assets/docs");
const destDir = join(ELECTRON_DIR, "dist/assets/docs");

if (existsSync(srcDir)) {
  mkdirSync(join(ELECTRON_DIR, "dist/assets"), { recursive: true });
  cpSync(srcDir, destDir, { recursive: true, force: true });
  console.log("📦 Copied doc assets to dist");
} else {
  console.log("⚠️ No shared assets/docs directory found");
}

// Copy workspace skill templates (prompt-improver, etc.)
const templateSrcDir = join(ROOT_DIR, "packages/shared/assets/workspace-template");
const templateDestDir = join(ELECTRON_DIR, "dist/assets/workspace-template");

if (existsSync(templateSrcDir)) {
  mkdirSync(join(ELECTRON_DIR, "dist/assets"), { recursive: true });
  cpSync(templateSrcDir, templateDestDir, { recursive: true, force: true });
  console.log("📦 Copied workspace template to dist");
} else {
  console.log("⚠️ No workspace template directory found");
}
