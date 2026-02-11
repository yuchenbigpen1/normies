/**
 * Centralized branding assets for Normies
 * Used by OAuth callback pages
 */

export const NORMIES_LOGO = [
  '███    ██  ██████  ██████  ███    ███ ██ ███████ ███████',
  '████   ██ ██    ██ ██   ██ ████  ████ ██ ██      ██     ',
  '██ ██  ██ ██    ██ ██████  ██ ████ ██ ██ █████   ███████',
  '██  ██ ██ ██    ██ ██   ██ ██  ██  ██ ██ ██           ██',
  '██   ████  ██████  ██   ██ ██      ██ ██ ███████ ███████',
] as const;

// Backwards-compatible aliases
export const CRAFT_LOGO = NORMIES_LOGO;

/** Logo as a single string for HTML templates */
export const NORMIES_LOGO_HTML = NORMIES_LOGO.map((line) => line.trimEnd()).join('\n');
export const CRAFT_LOGO_HTML = NORMIES_LOGO_HTML;

/** Session viewer base URL */
export const VIEWER_URL = 'https://agents.craft.do';
