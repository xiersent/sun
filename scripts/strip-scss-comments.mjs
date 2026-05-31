import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const scssPath = path.join(path.dirname(fileURLToPath(import.meta.url)), '../styles/styles.scss');
const lines = fs.readFileSync(scssPath, 'utf8').split('\n');

const keepSection = new Set([
  '/* Mixins */',
  '/* Variables */',
  '/* Global */',
  '/* Keyframes */',
  '/* Блок .sun- */',
]);

const out = [];
let skipBlockComment = false;

for (let i = 0; i < lines.length; i++) {
  const line = lines[i];
  const trimmed = line.trim();

  if (trimmed.startsWith('/**')) {
    skipBlockComment = true;
    continue;
  }
  if (skipBlockComment) {
    if (trimmed.endsWith('*/') && !trimmed.startsWith('/**')) {
      skipBlockComment = false;
    }
    continue;
  }

  if (trimmed === '/*#region*/' || trimmed === '/*#endregion*/') continue;
  if (/^\/\* -+\*\/$/.test(trimmed)) continue;
  if (keepSection.has(trimmed)) {
    out.push(line);
    continue;
  }

  if (/^\s*\/\//.test(line)) continue;
  if (/^\s*\/\*[^*]*\*\/\s*$/.test(line)) continue;

  out.push(line);
}

let text = out.join('\n');
text = text.replace(/\n{3,}/g, '\n\n');
fs.writeFileSync(scssPath, text, 'utf8');
console.log('Stripped comments from styles.scss');
