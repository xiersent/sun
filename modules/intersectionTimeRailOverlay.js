/**
 * @file intersectionTimeRailOverlay.js
 * Оверлей «рельса времени» для списка пересечений выбранного сигнала.
 */
/** Сколько календарных дней показывать на рельсе (включая день визора). */
const RAIL_TIMELINE_DAYS = 7;

class IntersectionTimeRailOverlay {
    constructor() {
        this.root = null;
        this.backdrop = null;
        this.viewport = null;
        this.track = null;
        this.waveAxis = null;
        this.nowLabel = null;
        this.mirrorNext = null;
        this.mirrorPrev = null;
        this.mirrorDuration = null;
        this.mirrorCountdown = null;
        this._mirrorMerged = null;
        this._raf = null;
        this._open = false;
        this._dayStartMs = 0;
        /** Длина шкалы от _dayStartMs, мс (несколько суток). */
        this._timelineSpanMs = 86400000;
        this._dayHeightPx = 4000;
        this._selectedWave = null;
        this.personSelectA = null;
        this.personSelectB = null;
        this.viewportHoursSelect = null;
        this.waveSelect = null;
        /** Сколько часов суток умещается по вертикали на экран (см. опции «Обзор»). */
        this._hoursInViewport = 1;
        this._openSortedIntersections = null;
        this._railPersonListSig = null;
        this._railWaveListSig = null;
        /** @type {null | (() => void)} */
        this._onCompareElAChangeBound = null;
        /** @type {null | (() => void)} */
        this._onCompareElBChangeBound = null;
        /** @type {null | (() => void)} */
        this._onWaveCornerRailBound = null;
    }

    /** Гарантирует dom. */
    ensureDom() {
        if (this.root) return;
        const root = document.createElement('div');
        root.id = 'intersectionTimeRailOverlay';
        root.className = 'sun-intersectionTimeRail';
        root.setAttribute('aria-hidden', 'true');
        root.innerHTML = `
            <div class="sun-intersectionTimeRailBackdrop" data-time-rail-close="1"></div>
            <button type="button" class="sun-uiBtn sun-intersectionTimeRailClose" data-time-rail-close="1">Закрыть</button>
            <div class="sun-intersectionTimeRailPanel">
                <div class="sun-intersectionTimeRailNowLine" aria-hidden="true"></div>
                <div class="sun-intersectionTimeRailPersonRow">
                    <div class="sun-intersectionTimeRailPersonField">
                        <label class="sun-intersectionFormLabel sun-intersectionTimeRailPersonLabel" for="intersectionTimeRailPersonA">Дата A</label>
                        <select id="intersectionTimeRailPersonA" class="sun-summarySelect sun-intersectionTimeRailPersonSelect" title="Активная персона (как «Дата A» на вкладке сравнения дат)"></select>
                    </div>
                    <div class="sun-intersectionTimeRailPersonField">
                        <label class="sun-intersectionFormLabel sun-intersectionTimeRailPersonLabel" for="intersectionTimeRailPersonB">Дата B</label>
                        <select id="intersectionTimeRailPersonB" class="sun-summarySelect sun-intersectionTimeRailPersonSelect" title="Фаза остальных сигналов (как «Дата B»; можно «Сравнение с той же датой»)"></select>
                    </div>
                    <div class="sun-intersectionTimeRailPersonField">
                        <label class="sun-intersectionFormLabel sun-intersectionTimeRailPersonLabel" for="intersectionTimeRailViewportHours">Обзор</label>
                        <select id="intersectionTimeRailViewportHours" class="sun-summarySelect sun-intersectionTimeRailPersonSelect" title="Видимый интервал суток по вертикали экрана"></select>
                    </div>
                    <div class="sun-intersectionTimeRailPersonField">
                        <label class="sun-intersectionFormLabel sun-intersectionTimeRailPersonLabel" for="intersectionTimeRailWave">Волна</label>
                        <select id="intersectionTimeRailWave" class="sun-summarySelect sun-intersectionTimeRailPersonSelect" title="Сигнал для анализа пересечений (как выбор «окраски углов» в списке волн)"></select>
                    </div>
                </div>
                <div class="sun-intersectionTimeRailNowIndicator" aria-hidden="true">
                    <span class="sun-intersectionTimeRailNowLabel"></span>
                </div>
                <div class="sun-intersectionTimeRailMirror" aria-hidden="true">
                    <div class="sun-intersectionTimeRailMirrorTitle">Зеркальное представление</div>
                    <div class="sun-intersectionTimeRailMirrorRow">
                        <span class="sun-intersectionTimeRailMirrorPrev" title="Последнее пересечение (раньше по времени)"></span>
                        <span class="sun-intersectionTimeRailMirrorHead" title="Голова, смотрящая вперёд на пользователя">👤</span>
                        <span class="sun-intersectionTimeRailMirrorNext" title="Следующее пересечение (позже по времени)"></span>
                    </div>
                    <div class="sun-intersectionTimeRailMirrorSep" aria-hidden="true">────→</div>
                    <div class="sun-intersectionTimeRailMirrorStats">
                        <div class="sun-intersectionTimeRailMirrorDuration sun-intersectionTimeRailMirrorDurationInStats"></div>
                        <div class="sun-intersectionTimeRailMirrorCountdown sun-intersectionTimeRailMirrorCountdownInStats"></div>
                    </div>
                </div>
                <div class="sun-intersectionTimeRailWaveAxis" aria-hidden="true"></div>
                <div class="sun-intersectionTimeRailViewport">
                    <div class="sun-intersectionTimeRailTrack"></div>
                </div>
            </div>
        `;
        document.body.appendChild(root);
        this.root = root;
        this.backdrop = root.querySelector('.sun-intersectionTimeRailBackdrop');
        this.viewport = root.querySelector('.sun-intersectionTimeRailViewport');
        this.track = root.querySelector('.sun-intersectionTimeRailTrack');
        this.waveAxis = root.querySelector('.sun-intersectionTimeRailWaveAxis');
        this.nowLabel = root.querySelector('.sun-intersectionTimeRailNowLabel');
        this.personSelectA = root.querySelector('#intersectionTimeRailPersonA');
        this.personSelectB = root.querySelector('#intersectionTimeRailPersonB');
        this.viewportHoursSelect = root.querySelector('#intersectionTimeRailViewportHours');
        this.waveSelect = root.querySelector('#intersectionTimeRailWave');
        this.mirrorNext = root.querySelector('.sun-intersectionTimeRailMirrorNext');
        this.mirrorPrev = root.querySelector('.sun-intersectionTimeRailMirrorPrev');
        this.mirrorDuration = root.querySelector('.sun-intersectionTimeRailMirrorDuration');
        this.mirrorCountdown = root.querySelector('.sun-intersectionTimeRailMirrorCountdown');

        root.addEventListener('click', (e) => {
            if (e.target.closest('[data-time-rail-close="1"]')) {
                this.close();
            }
        });
        if (this.personSelectA) {
            this.personSelectA.addEventListener('change', () => {
                const mgr = window.dateComparisonManager;
                if (mgr && mgr.elA) {
                    mgr._progSelectEnter();
                    try {
                        mgr.elA.value = this.personSelectA.value;
                    } finally {
                        mgr._progSelectExit();
                    }
                    mgr._onSelectChange('a');
                } else if (this.personSelectA.value && window.dates) {
                    window.dates.setActiveDate(this.personSelectA.value, true);
                }
                this._queueReopenRailFromIntersections();
            });
        }
        if (this.personSelectB) {
            this.personSelectB.addEventListener('change', () => {
                const mgr = window.dateComparisonManager;
                if (mgr && mgr.elB) {
                    mgr._progSelectEnter();
                    try {
                        mgr.elB.value = this.personSelectB.value;
                    } finally {
                        mgr._progSelectExit();
                    }
                    mgr._onSelectChange('b');
                }
                this._queueReopenRailFromIntersections();
            });
        }
        const elCompareA = window.dom.byKey('dateCompareSelectA');
        if (elCompareA && !this._onCompareElAChangeBound) {
            this._onCompareElAChangeBound = () => {
                if (!this._open || !this.personSelectA) {
                    return;
                }
                this._syncRailPersonSelectFromElA();
            };
            elCompareA.addEventListener('change', this._onCompareElAChangeBound);
        }
        const elCompareB = window.dom.byKey('dateCompareSelectB');
        if (elCompareB && !this._onCompareElBChangeBound) {
            this._onCompareElBChangeBound = () => {
                if (!this._open || !this.personSelectB) {
                    return;
                }
                this._syncRailPersonSelectFromElB();
            };
            elCompareB.addEventListener('change', this._onCompareElBChangeBound);
        }
        if (this.waveSelect) {
            this.waveSelect.addEventListener('change', () => {
                const id = this.waveSelect.value;
                if (!id) return;
                if (window.waves && typeof window.waves.setWaveCornerColor === 'function') {
                    window.waves.setWaveCornerColor(id, true);
                }
            });
        }
        if (!this._onWaveCornerRailBound) {
            this._onWaveCornerRailBound = () => {
                if (!this._open) return;
                if (this.waveSelect) {
                    this._syncRailWaveSelectFromAppState();
                }
                queueMicrotask(() => {
                    if (!this._open) return;
                    const sim = window.stateIntersectionManager;
                    const cd = window.appState && window.appState.currentDate;
                    const wave = sim && sim.lastSelectedWave;
                    if (!sim || !cd || !wave) return;
                    const list = sim.lastIntersections || [];
                    const byTime = [...list].sort((a, b) => a.time.getTime() - b.time.getTime());
                    this.open(byTime, wave, cd);
                });
            };
            window.addEventListener('zaraza:waveCornerSelectionChanged', this._onWaveCornerRailBound);
        }
        this._initViewportHoursSelect();
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && this._open) {
                this.close();
            }
        });
    }

    /** Внутренний метод syncRailPersonSelectFromElA. */
    _syncRailPersonSelectFromElA() {
        const mgr = window.dateComparisonManager;
        if (!this.personSelectA || !mgr || !mgr.elA) {
            return;
        }
        if (this.personSelectA.value !== mgr.elA.value) {
            this.personSelectA.value = mgr.elA.value;
        }
    }

    /** Внутренний метод syncRailPersonSelectFromElB. */
    _syncRailPersonSelectFromElB() {
        const mgr = window.dateComparisonManager;
        if (!this.personSelectB || !mgr || !mgr.elB) {
            return;
        }
        if (this.personSelectB.value !== mgr.elB.value) {
            this.personSelectB.value = mgr.elB.value;
        }
    }

    /** Внутренний метод queueReopenRailFromIntersections. */
    _queueReopenRailFromIntersections() {
        if (!this._open) {
            return;
        }
        queueMicrotask(() => {
            if (!this._open) {
                return;
            }
            const sim = window.stateIntersectionManager;
            if (
                sim &&
                typeof sim.updateIntersections === 'function' &&
                window.appState &&
                window.appState.currentDate
            ) {
                sim.updateIntersections();
                const list = sim.lastIntersections;
                const wave = sim.lastSelectedWave || this._selectedWave;
                if (list && list.length > 0 && wave && window.appState.currentDate) {
                    const byTime = [...list].sort((a, b) => a.time.getTime() - b.time.getTime());
                    this.open(byTime, wave, window.appState.currentDate);
                }
            }
        });
    }

    /** Внутренний метод refreshRailPersonSelectIfNeeded. */
    _refreshRailPersonSelectIfNeeded() {
        const mgr = window.dateComparisonManager;
        if (!this.personSelectA || !mgr || typeof mgr._computeDateListSignature !== 'function') {
            return;
        }
        const sig = mgr._computeDateListSignature();
        if (sig !== this._railPersonListSig) {
            this._railPersonListSig = sig;
            mgr.fillCompareSelectOptions(this.personSelectA, false);
            if (this.personSelectB) {
                mgr.fillCompareSelectOptions(this.personSelectB, true);
            }
        }
        this._syncRailPersonSelectFromElA();
        this._syncRailPersonSelectFromElB();
    }

    /** Внутренний метод computeRailWaveListSignature. */
    _computeRailWaveListSignature() {
        const sim = window.stateIntersectionManager;
        if (!sim || !window.appState || !window.appState.data) return '';
        const waves = typeof sim.getAllWavesFromSelectedGroup === 'function' ? sim.getAllWavesFromSelectedGroup() : [];
        const ids = waves
            .map((w) => String(w.id))
            .sort()
            .join(',');
        const groups = window.appState.data.groups || [];
        const structure = groups.map((g) => `${g.id}:${(g.waves || []).join('.')}`).join('|');
        return `${structure}|${ids}`;
    }

    /**
     * Состав option/optgroup как у «Дата A»: секции по группам волн, подпись optgroup не выбирается;
     * волны вне групп — в «Прочие». Без групп в данных — плоский список.
     */
    _fillRailWaveSelectOptions() {
        if (!this.waveSelect) return;
        const sim = window.stateIntersectionManager;
        const allowedWaves =
            sim && typeof sim.getAllWavesFromSelectedGroup === 'function' ? sim.getAllWavesFromSelectedGroup() : [];
        const sel = this.waveSelect;
        sel.innerHTML = '';

        const appendWaveOption = (w) => {
            const o = document.createElement('option');
            o.value = String(w.id);
            o.textContent = w.name != null ? String(w.name) : `id ${w.id}`;
            return o;
        };

        const allowedById = new Set(allowedWaves.map((w) => String(w.id)));
        if (allowedById.size === 0) {
            return;
        }

        const data = window.appState.data;
        const groups = data && data.groups ? data.groups : [];
        const allWaves = data && data.waves ? data.waves : [];

        if (groups.length === 0) {
            for (let i = 0; i < allowedWaves.length; i++) {
                sel.appendChild(appendWaveOption(allowedWaves[i]));
            }
            return;
        }

        const assigned = new Set();
        for (let gi = 0; gi < groups.length; gi++) {
            const g = groups[gi];
            const waveIds = g.waves || [];
            if (waveIds.length === 0) {
                continue;
            }
            const groupWaves = [];
            for (let wi = 0; wi < waveIds.length; wi++) {
                const wid = String(waveIds[wi]);
                if (!allowedById.has(wid)) {
                    continue;
                }
                const w = allWaves.find((x) => String(x.id) === wid);
                if (w) {
                    groupWaves.push(w);
                    assigned.add(wid);
                }
            }
            if (groupWaves.length === 0) {
                continue;
            }
            const og = document.createElement('optgroup');
            og.label = g.name || 'Группа';
            for (let i = 0; i < groupWaves.length; i++) {
                og.appendChild(appendWaveOption(groupWaves[i]));
            }
            sel.appendChild(og);
        }

        const orphans = [];
        for (let i = 0; i < allowedWaves.length; i++) {
            const w = allowedWaves[i];
            if (!assigned.has(String(w.id))) {
                orphans.push(w);
            }
        }
        if (orphans.length > 0) {
            const og = document.createElement('optgroup');
            og.label = 'Прочие';
            for (let i = 0; i < orphans.length; i++) {
                og.appendChild(appendWaveOption(orphans[i]));
            }
            sel.appendChild(og);
        }
    }

    /** Внутренний метод syncRailWaveSelectFromAppState. */
    _syncRailWaveSelectFromAppState() {
        if (!this.waveSelect || this.waveSelect.options.length === 0) return;
        const sim = window.stateIntersectionManager;
        const id = sim && typeof sim.getSelectedWaveId === 'function' ? sim.getSelectedWaveId() : null;
        const str = id != null ? String(id) : '';
        if (str && [...this.waveSelect.options].some((o) => o.value === str)) {
            this.waveSelect.value = str;
        }
    }

    /** Внутренний метод refreshRailWaveSelectIfNeeded. */
    _refreshRailWaveSelectIfNeeded() {
        if (!this.waveSelect) return;
        const sig = this._computeRailWaveListSignature();
        if (sig !== this._railWaveListSig) {
            this._railWaveListSig = sig;
            this._fillRailWaveSelectOptions();
        }
        this._syncRailWaveSelectFromAppState();
    }

    /** Внутренний метод formatViewportHoursRu. */
    _formatViewportHoursRu(hours) {
        const totalMin = Math.round(Number(hours) * 60);
        if (totalMin < 60) {
            return `${totalMin} мин`;
        }
        const hh = Math.floor(totalMin / 60);
        const mm = totalMin % 60;
        if (mm === 0) {
            return hh === 1 ? '1 ч' : `${hh} ч`;
        }
        return `${hh} ч ${mm} мин`;
    }

    /** Допустимые значения селекта «Обзор»: 1…4 мин, затем 5…55 шаг 5, затем 60…1440 шаг 60. */
    _getViewportMinutesOptions() {
        const out = [];
        for (let m = 1; m <= 4; m++) {
            out.push(m);
        }
        for (let m = 5; m <= 55; m += 5) {
            out.push(m);
        }
        for (let hh = 1; hh <= 24; hh++) {
            out.push(hh * 60);
        }
        return out;
    }

    /** Внутренний метод snapViewportMinutes. */
    _snapViewportMinutes(totalMin) {
        const allowed = this._getViewportMinutesOptions();
        let best = allowed[0];
        let bestD = Math.abs(best - totalMin);
        for (let i = 1; i < allowed.length; i++) {
            const x = allowed[i];
            const d = Math.abs(x - totalMin);
            if (d < bestD) {
                best = x;
                bestD = d;
            }
        }
        return best;
    }

    /** Внутренний метод parseStoredViewportToMinutes. */
    _parseStoredViewportToMinutes(raw) {
        if (raw == null || raw === '') {
            return null;
        }
        const s = String(raw).trim();
        if (s.includes('.') || s.includes(',')) {
            const h = parseFloat(s.replace(',', '.'));
            if (Number.isFinite(h) && h > 0) {
                return this._snapViewportMinutes(Math.round(h * 60));
            }
            return null;
        }
        const n = parseInt(s, 10);
        if (Number.isFinite(n) && n > 0) {
            return this._snapViewportMinutes(n);
        }
        return null;
    }

    /** Внутренний метод initViewportHoursSelect. */
    _initViewportHoursSelect() {
        if (!this.viewportHoursSelect || this.viewportHoursSelect.dataset.railViewportInit === '1') {
            return;
        }
        this.viewportHoursSelect.dataset.railViewportInit = '1';
        const sel = this.viewportHoursSelect;
        sel.innerHTML = '';
        const allowed = this._getViewportMinutesOptions();
        for (let i = 0; i < allowed.length; i++) {
            const minutes = allowed[i];
            const opt = document.createElement('option');
            opt.value = String(minutes);
            opt.textContent = this._formatViewportHoursRu(minutes / 60);
            sel.appendChild(opt);
        }
        const key = 'intersectionTimeRailHoursInViewport';
        let minutes = 60;
        try {
            const raw = localStorage.getItem(key);
            const parsed = this._parseStoredViewportToMinutes(raw);
            if (parsed != null) {
                minutes = parsed;
            }
        } catch (e) {
            /* ignore */
        }
        minutes = this._snapViewportMinutes(minutes);
        const minStr = String(minutes);
        sel.value = [...sel.options].some((o) => o.value === minStr) ? minStr : '60';
        this._hoursInViewport = parseInt(sel.value, 10) / 60;

        sel.addEventListener('change', () => {
            const nm = parseInt(sel.value, 10);
            if (!Number.isFinite(nm) || !allowed.includes(nm)) {
                return;
            }
            this._hoursInViewport = nm / 60;
            try {
                localStorage.setItem(key, String(nm));
            } catch (e) {
                /* ignore */
            }
            if (this._open && this._openSortedIntersections) {
                this._rebuildTrackForViewportChange();
            }
        });
    }

    /** Внутренний метод syncHoursInViewportFromSelect. */
    _syncHoursInViewportFromSelect() {
        if (!this.viewportHoursSelect) {
            return;
        }
        const nm = parseInt(this.viewportHoursSelect.value, 10);
        const allowed = this._getViewportMinutesOptions();
        if (Number.isFinite(nm) && allowed.includes(nm)) {
            this._hoursInViewport = nm / 60;
        }
    }

    /** Внутренний метод updateDayHeightPx. */
    _updateDayHeightPx() {
        const vh = window.innerHeight || 600;
        if (!Number.isFinite(this._hoursInViewport) || this._hoursInViewport <= 0) {
            this._hoursInViewport = 1;
        }
        const h = Math.max(this._hoursInViewport, 1 / 60);
        /** Не фиксировать минимум в 3600px — при ~1200px окна от ~8 ч «Обзор» упирался в потолок и масштаб переставал меняться. */
        const minPx = Math.max(1, Math.round(vh));
        const spanH = (this._timelineSpanMs || 86400000) / 3600000;
        this._dayHeightPx = Math.max(minPx, Math.round(vh * (spanH / h)));
    }

    /**
     * @param {Array<{ time: Date, wave2: object, value: number }>} intersectionsSortedByTime
     */
    _buildTrackParts(intersectionsSortedByTime) {
        const parts = [];
        const spanMs = this._timelineSpanMs || 86400000;
        const totalHours = Math.round(spanMs / 3600000);
        for (let hr = 0; hr <= totalHours; hr++) {
            const frac = Math.min(1, (hr * 3600000) / spanMs);
            const y = this._yFromTopForFraction(frac);
            const tickMs = this._dayStartMs + hr * 3600000;
            const label = this._formatRulerTickLabel(tickMs);
            const esc = this._escape(label);
            parts.push(
                `<div class="sun-intersectionTimeRailHour" style="top:${y}px"></div>` +
                    `<div class="sun-intersectionTimeRailHourLabel sun-intersectionTimeRailHourLabelStart" style="top:${y}px">${esc}</div>` +
                    `<div class="sun-intersectionTimeRailHourLabel sun-intersectionTimeRailHourLabelEnd" style="top:${y}px">${esc}</div>`
            );
        }

        const merged = this._groupIntersectionsBySameSecond(intersectionsSortedByTime);

        const HALF_WINDOW_MS = 2.5 * 60 * 1000;
        const bracketRelToBg = new Map();

        for (const group of merged) {
            const waves = this._uniqueWavesInGroup(group.items);
            const bg = this._crossBarBackgroundForWaves(waves);
            const centerMs = group.time.getTime();
            for (const abs of [centerMs - HALF_WINDOW_MS, centerMs + HALF_WINDOW_MS]) {
                let rel = abs - this._dayStartMs;
                rel = Math.max(0, Math.min(spanMs, rel));
                const key = Math.round(rel);
                if (!bracketRelToBg.has(key)) bracketRelToBg.set(key, bg);
            }
        }

        for (const key of [...bracketRelToBg.keys()].sort((a, b) => a - b)) {
            const bg = bracketRelToBg.get(key);
            const edgeDate = new Date(this._dayStartMs + key);
            const timeStr = this._escape(this._formatEdgeTime(edgeDate));
            const frac = key / spanMs;
            const yb = this._yFromTopForFraction(Math.min(0.999999999, frac));
            parts.push(
                `<div class="sun-intersectionTimeRailCrossWindow" style="top:${yb}px">` +
                    `<span class="sun-intersectionTimeRailCrossWindowTime">${timeStr}</span>` +
                    `<span class="sun-intersectionTimeRailCrossWindowBar" style="background:${bg}"></span>` +
                    `</div>`
            );
        }

        for (const group of merged) {
            const t = group.time.getTime();
            let frac = (t - this._dayStartMs) / spanMs;
            frac = Math.min(1, Math.max(0, frac));
            const y = this._yFromTopForFraction(frac);
            const waves = this._uniqueWavesInGroup(group.items);
            const bg = this._crossBarBackgroundForWaves(waves);
            const nameParts = waves.map((w) => this._escape(w.name || '—')).filter(Boolean);
            const namesHtml = nameParts.length ? nameParts.join(', ') : '—';
            const timeHtml = this._escape(this._formatEdgeTime(group.time));
            parts.push(
                `<div class="sun-intersectionTimeRailCross" style="top:${y}px">` +
                    `<span class="sun-intersectionTimeRailCrossTime">${timeHtml}</span>` +
                    `<span class="sun-intersectionTimeRailCrossBar" style="background:${bg}"></span>` +
                    `<span class="sun-intersectionTimeRailCrossNames">${namesHtml}</span>` +
                    `</div>`
            );
        }

        return { merged, parts };
    }

    /** Внутренний метод rebuildTrackForViewportChange. */
    _rebuildTrackForViewportChange() {
        if (!this.track || !this._openSortedIntersections) {
            return;
        }
        this._syncHoursInViewportFromSelect();
        this._updateDayHeightPx();
        const { merged, parts } = this._buildTrackParts(this._openSortedIntersections);
        this.track.style.height = `${this._dayHeightPx}px`;
        this.track.innerHTML = parts.join('');
        this._mirrorMerged = merged;
    }

    /** Внутренний метод isVizorDateToday. */
    _isVizorDateToday() {
        if (window.timeBarManager && typeof window.timeBarManager.isCurrentDateToday === 'function') {
            return window.timeBarManager.isCurrentDateToday();
        }
        const today = new Date();
        const v = window.appState && window.appState.currentDate;
        if (!v) return false;
        const a = new Date(today.getFullYear(), today.getMonth(), today.getDate(), 0, 0, 0, 0).getTime();
        const b = new Date(v.getFullYear(), v.getMonth(), v.getDate(), 0, 0, 0, 0).getTime();
        return a === b;
    }

    /** Доля всей шкалы [0,1): от полуночи первого дня до «сейчас» на линии времени (или полдень для прочих дат визора). */
    _fractionOfTimelineNow() {
        const span = this._timelineSpanMs || 86400000;
        const nowMs = this._nowMsOnVizorDay();
        const f = (nowMs - this._dayStartMs) / span;
        return Math.min(0.999999, Math.max(0, f));
    }

    /** Подпись деления шкалы (дата + час), чтобы ночь следующего дня читалась однозначно. */
    _formatRulerTickLabel(ms) {
        const d = new Date(ms);
        return `${this._pad2(d.getDate())}.${this._pad2(d.getMonth() + 1)} ${this._pad2(d.getHours())}:00`;
    }

    /** y от верха трека: 0 = полночь (рано), вниз — позже. */
    _yFromTopForFraction(frac) {
        return this._dayHeightPx * frac;
    }

    /** Внутренний метод pad2. */
    _pad2(n) {
        return String(n).padStart(2, '0');
    }

    /** Внутренний метод formatEdgeTime. */
    _formatEdgeTime(date) {
        if (window.waves && typeof window.waves.formatExtremumTime === 'function') {
            return window.waves.formatExtremumTime(date);
        }
        const d = date instanceof Date ? date : new Date(date);
        return `${this._pad2(d.getHours())}:${this._pad2(d.getMinutes())}:${this._pad2(d.getSeconds())}`;
    }

    /** Момент «сейчас» на шкале: реальное время в день визора или полдень. */
    _nowMsOnVizorDay() {
        if (this._isVizorDateToday()) return Date.now();
        return this._dayStartMs + 0.5 * 86400000;
    }

    /**
     * @param {Array<{ time: Date, items: unknown[] }>} merged
     * @returns {{ prev: typeof merged[0] | null, next: typeof merged[0] | null }}
     */
    _findPrevNextMirror(merged, nowMs) {
        let prev = null;
        let next = null;
        if (!merged || merged.length === 0) return { prev: null, next: null };
        for (const g of merged) {
            if (!g || !g.time) continue;
            const t = g.time.getTime();
            if (t <= nowMs) prev = g;
            if (t > nowMs && next == null) next = g;
        }
        return { prev, next };
    }

    /** Внутренний метод formatMirrorCellText. */
    _formatMirrorCellText(group) {
        if (!group || !group.time) return '—';
        const waves = this._uniqueWavesInGroup(group.items || []);
        const names = waves.map((w) => String(w.name || '—')).join(', ');
        const timeStr = this._formatEdgeTime(group.time);
        return `${timeStr} · ${names}`;
    }

    /**
     * Длительность по-русски с секундами: «2 ч 5 мин 3 с», «12 мин 0 с», «45 с».
     * @returns {string|null} null если интервал неположительный или не число.
     */
    _formatDeltaMsHumanRu(deltaMs) {
        if (deltaMs == null || deltaMs <= 0 || !Number.isFinite(deltaMs)) return null;
        let restSec = Math.floor(deltaMs / 1000);
        const h = Math.floor(restSec / 3600);
        restSec -= h * 3600;
        const m = Math.floor(restSec / 60);
        const s = restSec - m * 60;
        if (h > 0) return `${h} ч ${m} мин ${s} с`;
        if (m > 0) return `${m} мин ${s} с`;
        return `${s} с`;
    }

    /** Внутренний метод formatDurationStateRu. */
    _formatDurationStateRu(deltaMs) {
        const part = this._formatDeltaMsHumanRu(deltaMs);
        if (!part) return 'Длительность состояния: —';
        return `Длительность состояния: ${part}`;
    }

    /** Как длительность: префикс + «X ч Y мин Z с» (секунды всегда). */
    _formatCountdownToNextRu(remainingMs) {
        const prefix = 'До пересечения: ';
        if (remainingMs == null || !Number.isFinite(remainingMs)) return `${prefix}—`;
        if (remainingMs <= 0) return `${prefix}0 с`;
        const part = this._formatDeltaMsHumanRu(remainingMs);
        return part ? `${prefix}${part}` : `${prefix}—`;
    }

    /** Внутренний метод updateMirrorView. */
    _updateMirrorView() {
        if (!this.mirrorNext || !this.mirrorPrev || !this.mirrorDuration) return;
        const merged = this._mirrorMerged;
        if (!merged || merged.length === 0) {
            this.mirrorNext.textContent = '—';
            this.mirrorPrev.textContent = '—';
            this.mirrorDuration.textContent = 'Длительность состояния: —';
            if (this.mirrorCountdown) this.mirrorCountdown.textContent = 'До пересечения: —';
            return;
        }
        const nowMs = this._nowMsOnVizorDay();
        const { prev, next } = this._findPrevNextMirror(merged, nowMs);
        this.mirrorNext.textContent = this._formatMirrorCellText(next);
        this.mirrorPrev.textContent = this._formatMirrorCellText(prev);
        if (prev && next) {
            const d = next.time.getTime() - prev.time.getTime();
            this.mirrorDuration.textContent = this._formatDurationStateRu(d);
        } else {
            this.mirrorDuration.textContent = 'Длительность состояния: —';
        }
        if (this.mirrorCountdown) {
            if (next && next.time) {
                const left = next.time.getTime() - nowMs;
                this.mirrorCountdown.textContent = this._formatCountdownToNextRu(left);
            } else {
                this.mirrorCountdown.textContent = 'До пересечения: —';
            }
        }
    }

    /** Внутренний метод updateNowLabel. */
    _updateNowLabel() {
        if (!this.nowLabel) return;
        if (this._isVizorDateToday()) {
            const n = new Date();
            this.nowLabel.textContent = `${this._pad2(n.getHours())}:${this._pad2(n.getMinutes())}:${this._pad2(
                n.getSeconds()
            )}`;
        } else {
            const d = new Date(this._dayStartMs);
            d.setHours(12, 0, 0, 0);
            const dateStr = d.toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit', year: 'numeric' });
            this.nowLabel.textContent = `12:00:00 · ${dateStr}`;
        }
    }

    /** Внутренний метод escape. */
    _escape(s) {
        return String(s)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;');
    }

    /** Внутренний метод sanitizeColor. */
    _sanitizeColor(c) {
        return String(c || '#888').replace(/[^#a-zA-Z0-9(),.%\s-]/g, '') || '#888';
    }

    /** Секунда внутри дня визора — для слияния меток на шкале. */
    _intersectionSecondKey(timeMs) {
        return Math.floor((timeMs - this._dayStartMs) / 1000);
    }

    /**
     * @param {Array<{ time: Date, wave2: object, value: number }>} sorted
     * @returns {Array<{ time: Date, items: typeof sorted }>}
     */
    _groupIntersectionsBySameSecond(sorted) {
        const out = [];
        let bucket = null;
        for (const inter of sorted) {
            if (!inter || !inter.time || !inter.wave2) continue;
            const d = inter.time instanceof Date ? inter.time : new Date(inter.time);
            const key = this._intersectionSecondKey(d.getTime());
            if (!bucket || bucket.secKey !== key) {
                if (bucket) out.push(bucket);
                bucket = { secKey: key, time: d, items: [inter] };
            } else {
                bucket.items.push(inter);
            }
        }
        if (bucket) out.push(bucket);
        return out;
    }

    /** Уникальные волны в группе (по id), порядок как во входном списке. */
    _uniqueWavesInGroup(items) {
        const seen = new Set();
        const waves = [];
        for (const it of items) {
            const w = it.wave2;
            const id = w.id != null ? String(w.id) : `n:${String(w.name || '')}`;
            if (seen.has(id)) continue;
            seen.add(id);
            waves.push(w);
        }
        return waves;
    }

    /** Один цвет или linear-gradient по нескольким волнам. */
    _crossBarBackgroundForWaves(waves) {
        const colors = waves.map((w) => this._sanitizeColor(w.color));
        if (colors.length === 0) return '#888';
        if (colors.length === 1) return colors[0];
        const n = colors.length;
        const stops = [];
        for (let i = 0; i < n; i++) {
            const a = (i / n) * 100;
            const b = ((i + 1) / n) * 100;
            const c = colors[i];
            stops.push(`${c} ${a}%`, `${c} ${b}%`);
        }
        return `linear-gradient(90deg, ${stops.join(', ')})`;
    }

    /**
     * @param {Array<{ time: Date, wave2: object, value: number }>} intersectionsSortedByTime — по возрастанию time
     * @param {{ id: unknown, name?: string, color?: string }} selectedWave
     * @param {Date} currentDate — день визора
     */
    open(intersectionsSortedByTime, selectedWave, currentDate) {
        this.ensureDom();
        this._railPersonListSig = null;
        this._railWaveListSig = null;
        this._refreshRailPersonSelectIfNeeded();
        this._refreshRailWaveSelectIfNeeded();
        this._selectedWave = selectedWave;
        const dayStart = new Date(currentDate);
        dayStart.setHours(0, 0, 0, 0);
        this._dayStartMs = dayStart.getTime();
        this._timelineSpanMs = RAIL_TIMELINE_DAYS * 86400000;
        const spanEnd = this._dayStartMs + this._timelineSpanMs;

        let sorted = intersectionsSortedByTime ? [...intersectionsSortedByTime] : [];
        sorted.sort((a, b) => a.time.getTime() - b.time.getTime());
        const sim = window.stateIntersectionManager;
        if (sim && selectedWave && typeof sim.findIntersectionsMultiDay === 'function') {
            const waves = sim.getAllWavesFromSelectedGroup();
            if (waves && waves.length >= 2) {
                const md = sim.findIntersectionsMultiDay(
                    selectedWave,
                    waves,
                    currentDate,
                    RAIL_TIMELINE_DAYS,
                    sim.lastIntersectionBaseMsA,
                    sim.lastIntersectionBaseMsB
                );
                if (md && md.length > 0) {
                    sorted = md;
                }
            }
        }
        sorted = sorted.filter((it) => {
            if (!it || !it.time) return false;
            const t = it.time instanceof Date ? it.time.getTime() : new Date(it.time).getTime();
            return t >= this._dayStartMs && t < spanEnd;
        });
        this._openSortedIntersections = sorted;

        this._syncHoursInViewportFromSelect();
        this._updateDayHeightPx();

        const waveColor =
            String(selectedWave.color || '#2196f3').replace(/[^#a-zA-Z0-9(),.%\s-]/g, '') || '#2196f3';
        this.waveAxis.style.background = waveColor;

        const { merged, parts } = this._buildTrackParts(sorted);

        this.track.style.height = `${this._dayHeightPx}px`;
        this.track.innerHTML = parts.join('');
        this.track.style.transform = 'translate3d(0, 0, 0)';

        this._mirrorMerged = merged;

        this._open = true;
        this.root.classList.remove('intersection-time-rail', 'intersection-time-rail--open');
        this.root.classList.add('sun-intersectionTimeRailOpen');
        this.root.setAttribute('aria-hidden', 'false');

        if (this._raf != null) {
            cancelAnimationFrame(this._raf);
            this._raf = null;
        }
        const loop = () => {
            if (!this._open) return;
            const frac = this._fractionOfTimelineNow();
            const yNow = this._yFromTopForFraction(frac);
            const mid = this.viewport.clientHeight / 2;
            const ty = mid - yNow;
            this.track.style.transform = `translate3d(0, ${ty}px, 0)`;
            this._updateNowLabel();
            this._updateMirrorView();
            this._refreshRailPersonSelectIfNeeded();
            this._refreshRailWaveSelectIfNeeded();
            this._raf = requestAnimationFrame(loop);
        };
        this._updateNowLabel();
        this._updateMirrorView();
        this._raf = requestAnimationFrame(loop);
    }

    /** Закрывает оверлей рельса времени. */
    close() {
        this._open = false;
        this._openSortedIntersections = null;
        this._mirrorMerged = null;
        if (this._raf != null) {
            cancelAnimationFrame(this._raf);
            this._raf = null;
        }
        if (this.root) {
            this.root.classList.remove('sun-intersectionTimeRailOpen', 'intersection-time-rail--open');
            this.root.setAttribute('aria-hidden', 'true');
        }
    }
}

window.intersectionTimeRailOverlay = new IntersectionTimeRailOverlay();
