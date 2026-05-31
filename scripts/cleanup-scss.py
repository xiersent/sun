# -*- coding: utf-8 -*-
"""Strip legacy mapping comments, remove kebab bridge, normalize sun- modifiers in styles.scss."""
import re
from pathlib import Path

scss = Path(__file__).resolve().parent.parent / "styles" / "styles.scss"
text = scss.read_text(encoding="utf-8")

bridge = "/* ------------------------------ */\n/* Мост на старые классы */"
idx = text.find(bridge)
if idx == -1:
    raise SystemExit("legacy bridge marker not found")
text = text[:idx].rstrip() + "\n"

lines = []
for line in text.splitlines(keepends=True):
    if re.match(r"\s*/\* разметка:", line):
        continue
    lines.append(line)
text = "".join(lines)

replacements = [
    (".tabButtonsFramed", "#{&}tabButtonsFramed"),
    (".buttonsPanel", "#{&}buttonsPanel"),
    (".compact", "#{&}compact"),
    (".today-active", "#{&}todayActive"),
    (".flip-h-active", "#{&}flipHActive"),
    (".dateComparisonViewTab", "#{&}dateComparisonViewTab"),
    (".waveGroupToggle", "#{&}waveGroupToggle"),
    (".graphAxisSwapped", "#{&}graphAxisSwapped"),
    (".timeBarControlsStates", "#{&}timeBarControlsStates"),
    (".timeBarControlsGroups", "#{&}timeBarControlsGroups"),
    (".intersectionFormRowActions", "#{&}intersectionFormRowActions"),
    (".uiBtnToggleOff", "#{&}uiBtnToggleOff"),
]
for old, new in replacements:
    text = text.replace(old, new)

corner = {
    ".tl": "#{&}cornerPosTl",
    ".tr": "#{&}cornerPosTr",
    ".bl": "#{&}cornerPosBl",
    ".br": "#{&}cornerPosBr",
    ".tc": "#{&}cornerPosTc",
    ".bc": "#{&}cornerPosBc",
    ".lc": "#{&}cornerPosLc",
    ".rc": "#{&}cornerPosRc",
    ".mt": "#{&}cornerPosMt",
    ".mb": "#{&}cornerPosMb",
    ".ml": "#{&}cornerPosMl",
    ".mr": "#{&}cornerPosMr",
    ".mt2": "#{&}cornerPosMt2",
    ".mb2": "#{&}cornerPosMb2",
    ".ml2": "#{&}cornerPosMl2",
    ".mr2": "#{&}cornerPosMr2",
}
for old, new in corner.items():
    text = text.replace(f"&cornerSquare{old}", f"&cornerSquare{new}")

# State modifiers: .active / .hidden on sun components
text = re.sub(
    r"(&(?:tabButton|tabContent|listItemDate|hourMarker|gridLineInner|xAxis|btnToday|btnFlipH|timeBarControlsToggle))\.active\b",
    r"\1.sun-active",
    text,
)
text = re.sub(
    r"(&(?:waveLabelsContainer|waveLabelsVerticalContainer|waveAxisXPoints|warningBox))\.hidden\b",
    r"\1.sun-hidden",
    text,
)
text = re.sub(
    r"(&listItemGroup|listItemPersonGroup):not\(\.listItemExpanded\)",
    r"\1:not(.sun-listItemExpanded)",
    text,
)
text = re.sub(
    r"&listItemGroup\.listItemExpanded",
    "&listItemGroup.sun-listItemExpanded",
    text,
)
text = re.sub(
    r"&listItemPersonGroup\.listItemExpanded",
    "&listItemPersonGroup.sun-listItemExpanded",
    text,
)

text = text.replace("&graph > .grid-static-container", "&graph > #{&}gridStaticContainer")
text = text.replace("&graph > .grid-absolute-container", "&graph > #{&}gridAbsoluteContainer")

scss.write_text(text, encoding="utf-8")
print(f"Wrote {scss} ({scss.stat().st_size} bytes)")
