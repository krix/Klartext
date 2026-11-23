/** Alle Texte aus Daten oder KI-Antworten werden vor dem Einfügen in HTML maskiert. */
export function escapeHtml(value: unknown): string {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export function brand(): string {
  return `<span class="brand-mark" aria-hidden="true">
    <svg viewBox="0 0 44 44" role="presentation">
      <rect x="1" y="1" width="42" height="42" rx="12" fill="var(--ink)"></rect>
      <path d="M14 10v24M14 20l13-10M17 23l12 11" fill="none" stroke="var(--accent)" stroke-width="5" stroke-linecap="round" stroke-linejoin="round"></path>
    </svg>
  </span>`;
}

export function header(parentUnlocked = false): string {
  return `<header class="topbar">
    <a class="brand" href="#" data-action="home" aria-label="Klartext – zur Startseite">
      ${brand()}<span>Klartext<small>Rechtschreibung üben</small></span>
    </a>
    <nav class="topnav" aria-label="Hauptnavigation">
      <button class="link-button" type="button" data-action="${parentUnlocked ? 'parent-home' : 'parent'}">${parentUnlocked ? 'Elternbereich' : 'Elternbereich 🔒'}</button>
    </nav>
  </header>`;
}
