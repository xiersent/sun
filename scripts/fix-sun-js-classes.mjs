import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');

const REPLACEMENTS = [
  ["classList.toggle('uiBtnToggleOff'", "classList.toggle('sun-uiBtnToggleOff'"],
  ["classList.remove('uiBtnToggleOff')", "classList.remove('sun-uiBtnToggleOff')"],
  ["classList.add('uiBtnToggleOff')", "classList.add('sun-uiBtnToggleOff')"],
  ["classList.add('uiHidden')", "classList.add('sun-uiHidden')"],
  ["classList.remove('uiHidden')", "classList.remove('sun-uiHidden')"],
  ["classList.add('graphHidden')", "classList.add('sun-graphHidden')"],
  ["classList.remove('graphHidden')", "classList.remove('sun-graphHidden')"],
  ["classList.add('grayMode')", "classList.add('sun-grayMode')"],
  ["classList.remove('grayMode')", "classList.remove('sun-grayMode')"],
  ["classList.add('graphGrayMode')", "classList.add('sun-graphGrayMode')"],
  ["classList.remove('graphGrayMode')", "classList.remove('sun-graphGrayMode')"],
  ["classList.contains('graphGrayMode')", "classList.contains('sun-graphGrayMode')"],
  ["classList.add('starsMode')", "classList.add('sun-starsMode')"],
  ["classList.remove('starsMode')", "classList.remove('sun-starsMode')"],
  ["classList.add('namesMode')", "classList.add('sun-namesMode')"],
  ["classList.remove('namesMode')", "classList.remove('sun-namesMode')"],
  ["classList.add('mobileDevice')", "classList.add('sun-mobileDevice')"],
  ["classList.add('today-inactive')", "classList.add('sun-todayInactive')"],
  ["classList.remove('today-inactive')", "classList.remove('sun-todayInactive')"],
  ["classList.toggle('flip-v-active'", "classList.toggle('sun-flipVActive'"],
  ["'sun-hourMarker clickable'", "'sun-hourMarker sun-clickable'"],
  ["classList.add('midnight')", "classList.add('sun-midnight')"],
  ["classList.toggle('bold'", "classList.toggle('sun-bold'"],
  ["classList.add('bold'", "classList.add('sun-bold'"],
  ["classList.remove('solid', 'dashed', 'dotted', 'zigzag', 'dash-dot', 'long-dash')",
   "classList.remove('sun-solid', 'sun-dashed', 'sun-dotted', 'sun-zigzag', 'sun-dashDot', 'sun-longDash')"],
  ['.wave-svg-layer--a', '.sun-waveSvgLayerA'],
  ['.wave-svg-layer--b', '.sun-waveSvgLayerB'],
  ['.sun-waveSvgLayer--a', '.sun-waveSvgLayerA'],
  ['.sun-waveSvgLayer--b', '.sun-waveSvgLayerB'],
  ["'wave-svg-layer', 'wave-svg-layer--a'", "'sun-waveSvgLayer', 'sun-waveSvgLayerA'"],
  ["'wave-svg-layer', 'wave-svg-layer--b'", "'sun-waveSvgLayer', 'sun-waveSvgLayerB'"],
  ["'sun-waveSvgLayer', 'sun-waveSvgLayer--a'", "'sun-waveSvgLayer', 'sun-waveSvgLayerA'"],
  ["'sun-waveSvgLayer', 'sun-waveSvgLayer--b'", "'sun-waveSvgLayer', 'sun-waveSvgLayerB'"],
  ['sun-wavePath--person-b', 'sun-wavePathPersonB'],
  ['sun-waveAxisXPoint--person-b', 'sun-waveAxisXPointPersonB'],
  ['.wave-container', '.sun-waveContainer'],
  ['.wave-axis-x-points', '.sun-waveAxisXPoints'],
  ['.date-row', '.sun-dateRow'],
  ["contains('date-row')", "contains('sun-dateRow')"],
  ["closest('.date-row')", "closest('.sun-dateRow')"],
  ['sun-waveContainer--swapped', 'sun-waveContainerSwapped'],
  ["classList.add('wave')", "classList.add('sun-wave')"],
  ["querySelector('.wave')", "querySelector('.sun-wave')"],
  ["querySelector('svg.wave')", "querySelector('svg.sun-wave')"],
  ['.group-total-count', '.sun-groupTotalCount'],
  ["classList.contains('show')", "classList.contains('sun-show')"],
  ["classList.add('show')", "classList.add('sun-show')"],
  ["classList.remove('show')", "classList.remove('sun-show')"],
  ["'sun-gridLine x'", "'sun-gridLine sun-gridLineX'"],
  ["'sun-gridLine y'", "'sun-gridLine sun-gridLineY'"],
  ["'sun-gridLine dayH'", "'sun-gridLine sun-dayH'"],
  ["'sun-gridLine stateV'", "'sun-gridLine sun-stateV'"],
  [".sun-gridLine.x, .sun-gridLine.stateV", ".sun-gridLine.sun-gridLineX, .sun-gridLine.sun-stateV"],
  ["contains('dayH')", "contains('sun-dayH')"],
  ['`sun-waveLabel horizontal ', '`sun-waveLabel sun-horizontal '],
  ['`sun-waveLabel vertical ', '`sun-waveLabel sun-vertical '],
  ["path.classList.add(newType)", "path.classList.add(window.dom.getWaveStyle(newType))"],
  ["pathB.classList.add(newType)", "pathB.classList.add(window.dom.getWaveStyle(newType))"],
];

function patchFile(filePath) {
  let data = fs.readFileSync(filePath, 'utf8');
  const orig = data;
  for (const [old, neu] of REPLACEMENTS) {
    data = data.split(old).join(neu);
  }
  if (data !== orig) {
    fs.writeFileSync(filePath, data, 'utf8');
    console.log('updated', path.relative(root, filePath));
  }
}

function walk(dir) {
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, ent.name);
    if (ent.isDirectory()) {
      if (ent.name === 'node_modules') continue;
      walk(p);
    } else if (/\.(js|html|ejs)$/.test(ent.name)) {
      patchFile(p);
    }
  }
}

walk(path.join(root, 'modules'));
walk(path.join(root, 'templates'));
patchFile(path.join(root, 'index.html'));
