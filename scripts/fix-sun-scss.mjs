/**
 * Fix .sun- block in styles.scss:
 * - split comma-separated selector lists
 * - wrap declarations in @media(min-width: 0px) where missing
 * - replace legacy class names with #{&}…
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const scssPath = path.join(__dirname, '../styles/styles.scss');
const text = fs.readFileSync(scssPath, 'utf8');

function findBlockBounds(source, marker) {
  const start = source.indexOf(marker);
  if (start < 0) return null;
  let i = start + marker.length;
  let depth = 1;
  while (i < source.length && depth > 0) {
    const ch = source[i];
    if (ch === '{') depth++;
    else if (ch === '}') depth--;
    i++;
  }
  return { start, end: i };
}

const bounds = findBlockBounds(text, '.sun-{');
if (!bounds) {
  console.error('.sun-{ not found');
  process.exit(1);
}

let sun = text.slice(bounds.start, bounds.end);
const before = text.slice(0, bounds.start);
const after = text.slice(bounds.end);

const REPLACEMENTS = [
  ['&app.starsMode', '&app#{&}starsMode'],
  ['&app.namesMode', '&app#{&}namesMode'],
  ['&app.grayMode', '&app#{&}grayMode'],
  ['&app.uiHidden', '&app#{&}uiHidden'],
  ['&app.graphHidden', '&app#{&}graphHidden'],
  ['&app.graphGrayMode', '&app#{&}graphGrayMode'],
  ['&app.mobileDevice', '&app#{&}mobileDevice'],
  ['&graphContainer.graphGrayMode', '&graphContainer#{&}graphGrayMode'],
  ['&timeBarStateRow.timeBarHoursRow', '&timeBarStateRow#{&}timeBarHoursRow'],
  ['&btnToday.today-inactive', '&btnToday#{&}todayInactive'],
  ['&btnFlipV.flip-v-active', '&btnFlipV#{&}flipVActive'],
  ['.listItemDragOverBottom', '#{&}listItemDragOverBottom'],
  ['.listItemDragOverTop', '#{&}listItemDragOverTop'],
  ['.listItemEditActions', '#{&}listItemEditActions'],
  ['.listItemNormalView', '#{&}listItemNormalView'],
  ['.listItemEditForm', '#{&}listItemEditForm'],
  ['.groupChildrenDragOver', '#{&}groupChildrenDragOver'],
  ['.personGroupChildren', '#{&}personGroupChildren'],
  ['.listItemDragging', '#{&}listItemDragging'],
  ['.listItemEditing', '#{&}listItemEditing'],
  ['.listItemDragHandle', '#{&}listItemDragHandle'],
  ['.intersectionTimeRailMirrorCountdown', '#{&}intersectionTimeRailMirrorCountdown'],
  ['.intersectionTimeRailMirrorDuration', '#{&}intersectionTimeRailMirrorDuration'],
  ['.intersectionTimeRailOpen', '#{&}intersectionTimeRailOpen'],
  ['.dateComparisonActions', '#{&}dateComparisonActions'],
  ['.dateComparisonState', '#{&}dateComparisonState'],
  ['.intersectionMatchType', '#{&}intersectionMatchType'],
  ['.intersectionControls', '#{&}intersectionControls'],
  ['.intersectionPeriod', '#{&}intersectionPeriod'],
  ['.intersectionInfo', '#{&}intersectionInfo'],
  ['.summaryResultsContainer', '#{&}summaryResultsContainer'],
  ['.dateDescriptionEdit', '#{&}dateDescriptionEdit'],
  ['.waveLabelPersonB', '#{&}waveLabelPersonB'],
  ['.waveLabelExtremum', '#{&}waveLabelExtremum'],
  ['.waveLabelName', '#{&}waveLabelName'],
  ['.waveAxisXPointPersonB', '#{&}waveAxisXPointPersonB'],
  ['.timeBarContainer', '#{&}timeBarContainer'],
  ['.timeBarHoursRow', '#{&}timeBarHoursRow'],
  ['.noteContentWrapper', '#{&}noteContentWrapper'],
  ['.dateGenderSelect', '#{&}dateGenderSelect'],
  ['.dateGenderBadge', '#{&}dateGenderBadge'],
  ['.dateNameEdit', '#{&}dateNameEdit'],
  ['.dateDragHandle', '#{&}dateDragHandle'],
  ['.waveDragHandle', '#{&}waveDragHandle'],
  ['.listItemWave', '#{&}listItemWave'],
  ['.listItemDate', '#{&}listItemDate'],
  ['.groupChildren', '#{&}groupChildren'],
  ['.listItemExpanded', '#{&}listItemExpanded'],
  ['.today-inactive', '#{&}todayInactive'],
  ['.flip-v-active', '#{&}flipVActive'],
  ['.exactMatch', '#{&}exactMatch'],
  ['.closeMatch', '#{&}closeMatch'],
  ['.pagelImage', '#{&}pagelImage'],
  ['.longDash', '#{&}longDash'],
  ['.dashDot', '#{&}dashDot'],
  ['.zigzag', '#{&}zigzag'],
  ['.dashed', '#{&}dashed'],
  ['.dotted', '#{&}dotted'],
  ['.solid', '#{&}solid'],
  ['.horizontal', '#{&}horizontal'],
  ['.vertical', '#{&}vertical'],
  ['.clickable', '#{&}clickable'],
  ['.midnight', '#{&}midnight'],
  ['.bold', '#{&}bold'],
  ['.show', '#{&}show'],
  ['.success', '#{&}success'],
  ['.error', '#{&}error'],
  ['.info', '#{&}info'],
  ['.left', '#{&}left'],
  ['.right', '#{&}right'],
  ['.stateV', '#{&}stateV'],
  ['.dayH', '#{&}dayH'],
  ['.uiBtn', '#{&}uiBtn'],
  ['.wave', '#{&}wave'],
  ['.x', '#{&}gridLineX'],
  ['.y', '#{&}gridLineY'],
];

for (const [from, to] of REPLACEMENTS) {
  sun = sun.split(from).join(to);
}

sun = sun.replace(/\tlistItemDate\.sun-active\{/g, '\t&listItemDate.sun-active{');

sun = sun.replace(
  /^(\t&[^{\n]+)\{([^@\n\{][^}]*)\}$/gm,
  (m, sel, body) => {
    if (body.includes('@media')) return m;
    if (!body.includes(':')) return m;
    return `${sel}{\n\t\t@media(min-width: 0px){${body}}\n\t}`;
  }
);

const out = before + sun + after;
fs.writeFileSync(scssPath, out, 'utf8');
console.log('Fixed .sun- block', bounds.start, '-', bounds.end);
