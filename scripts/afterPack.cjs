/**
 * Root wrapper for electron-builder afterPack hook.
 *
 * Some build flows run electron-builder from repo root with `--project apps/electron`,
 * which resolves hook paths relative to the root project directory.
 * Delegate to the app-local hook to keep behavior identical across build entrypoints.
 */

module.exports = async function afterPack(context) {
  const appAfterPack = require('../apps/electron/scripts/afterPack.cjs');
  return appAfterPack(context);
};

