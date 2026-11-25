import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import { createHash } from 'node:crypto';

const dist = 'dist';
const template = readFileSync('scripts/sw-template.js', 'utf8');

// Favicons mit einem Inhalts-Hash versehen: Browser und Service Worker dürfen
// ein altes Icon nicht aus dem Cache weiterzeigen, wenn die Datei sich ändert.
const iconFiles = ['icon-192.png', 'icon-512.png', 'apple-touch-icon.png', 'logo.png'];
const iconHash = createHash('sha256');
for (const icon of iconFiles) iconHash.update(readFileSync(join(dist, icon)));
const iconVersion = iconHash.digest('hex').slice(0, 10);
const indexPath = join(dist, 'index.html');
writeFileSync(
  indexPath,
  readFileSync(indexPath, 'utf8').replace(/(href="\.\/(?:icon-(?:192|512)|apple-touch-icon)\.png)"/g, `$1?v=${iconVersion}"`),
);

function filesIn(directory) {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name);
    return entry.isDirectory() ? filesIn(path) : [path];
  });
}

const assets = filesIn(dist)
  .filter((path) => !path.endsWith(`${sep}sw.js`))
  .map((path) => `./${relative(dist, path).split(sep).join('/')}`)
  .sort();

// Hash über die Dateiinhalte -> neuer Cache-Name bei jedem echten Update.
const hash = createHash('sha256');
for (const asset of assets) hash.update(readFileSync(join(dist, asset.slice(2))));
const version = hash.digest('hex').slice(0, 12);

const source = template
  .replace('__VERSION__', version)
  .replace('__PRECACHE__', JSON.stringify([...assets, './'], null, 2));

writeFileSync(join(dist, 'sw.js'), source, 'utf8');
console.log(`Service Worker geschrieben: ${assets.length} gecachte Dateien (${version}).`);
