import logoUrl from '../assets/logo.png';

/** Alle Texte aus Daten oder KI-Antworten werden vor dem Einfügen in HTML maskiert. */
export function escapeHtml(value: unknown): string {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/** Das Logo erscheint in der Kopfleiste und – über npm run icons – in den PWA-Icons. */
export function brand(): string {
  return `<span class="brand-mark" aria-hidden="true"><img src="${logoUrl}" alt="" /></span>`;
}

export function header(parentUnlocked = false, active: 'topics' | '' = ''): string {
  return `<header class="topbar">
    <a class="brand" href="#" data-action="home" aria-label="Klartext – zur Startseite">
      ${brand()}<span>Klartext<small>Rechtschreibung üben</small></span>
    </a>
    <nav class="topnav" aria-label="Hauptnavigation">
      <button class="link-button ${active === 'topics' ? 'is-active' : ''}" type="button" data-action="topics"${active === 'topics' ? ' aria-current="page"' : ''}>Themen</button>
      <button class="link-button" type="button" data-action="${parentUnlocked ? 'parent-home' : 'parent'}">${parentUnlocked ? 'Elternbereich' : 'Elternbereich 🔒'}</button>
    </nav>
  </header>`;
}
