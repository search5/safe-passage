// Minimal runtime stand-in for the 'obsidian' package in the vitest environment.
// The real 'obsidian' package ships types only (main: ""), so it has nothing to resolve
// at runtime outside of the actual Obsidian app. Only add exports here as tests need them.

export function normalizePath(path: string): string {
  const normalized = path.replace(/\\/g, '/').replace(/\/+/g, '/').replace(/\/$/, '');
  return normalized.replace(/^\//, '');
}

export function getLanguage(): string {
  return 'en';
}

export class App {}
