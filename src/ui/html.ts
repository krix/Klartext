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
    <svg viewBox="0 0 48 48" role="presentation">
      <rect x="1" y="1" width="46" height="46" rx="15" fill="var(--ink)"></rect>
      <g transform="rotate(-16 24 25)">
        <path d="M18 9h12v21l-6 9-6-9z" fill="var(--accent)"></path>
        <path d="M18 30h12l-6 9z" fill="#f6d8b6"></path>
        <path d="M21.6 36h4.8L24 39z" fill="var(--ink)"></path>
        <rect x="18" y="15" width="12" height="3.5" fill="var(--ink)" opacity=".28"></rect>
      </g>
      <path d="M35 7l2 6 6 2-6 2-2 6-2-6-6-2 6-2z" fill="var(--fun-coral)"></path>
    </svg>
  </span>`;
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
