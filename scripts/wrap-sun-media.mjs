import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const scssPath = path.join(path.dirname(fileURLToPath(import.meta.url)), '../styles/styles.scss');
let text = fs.readFileSync(scssPath, 'utf8');

function findBlockBounds(source, marker) {
  const start = source.indexOf(marker);
  let i = start + marker.length;
  let depth = 1;
  while (i < source.length && depth > 0) {
    if (source[i] === '{') depth++;
    else if (source[i] === '}') depth--;
    i++;
  }
  return { start, end: i };
}

const b = findBlockBounds(text, '.sun-{');
let sun = text.slice(b.start, b.end);

sun = sun.replace(
  /^(\t&[^{\n]+)\{([^@\n\{][^}]*)\}$/gm,
  (m, sel, body) => {
    if (body.includes('@media')) return m;
    if (!body.includes(':')) return m;
    return `${sel}{\n\t\t@media(min-width: 0px){${body}}\n\t}`;
  }
);

text = text.slice(0, b.start) + sun + text.slice(b.end);
fs.writeFileSync(scssPath, text, 'utf8');
console.log('Wrapped remaining one-line rules in @media');
