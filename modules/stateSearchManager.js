/**
 * @file stateSearchManager.js
 * Вкладка «Поиск состояний»: несколько сигналов с условиями (И), таблица дат.
 */
class StateSearchManager {
    constructor() {
        this.defaultLimitYears = 100;
        /** Допуск совпадения моментов разных сигналов (~30 с). */
        this._hitTimeEpsilonMs = 30 * 1000;
        this.elements = {};
        this._dataReady = false;
        this._waveListSig = null;
        this._settingsAutosaveBound = false;
        this._saveSettingsTimer = null;
        this.cacheElements();
        this.init();
    }

    cacheElements() {
        const ids = [
            'stateSearchConditions',
            'btnStateSearchAddCondition',
            'btnStateSearchRun',
            'btnStateSearchShowWaves',
            'stateSearchLimitYears',
            'stateSearchResults'
        ];
        ids.forEach((id) => {
            const el = window.dom.byKey(id);
            if (el) this.elements[id] = el;
        });
    }

    init() {
        this.setupEventListeners();
    }

    /** После загрузки appState — восстановить условия и option в селектах. */
    syncAfterDataReady() {
        this._dataReady = true;
        this.refreshWaveSelects();
        this._restoreSettings();
        this._bindSettingsAutosave();
    }

    _getSettingsStorage() {
        if (!window.appState || !window.appState.data) {
            return null;
        }
        if (!window.appState.data.uiSettings) {
            window.appState.data.uiSettings = {};
        }
        if (!window.appState.data.uiSettings.stateSearch) {
            window.appState.data.uiSettings.stateSearch = {
                limitYears: this.defaultLimitYears,
                conditions: []
            };
        }
        return window.appState.data.uiSettings.stateSearch;
    }

    _readConditionsForSave() {
        const container = this.elements.stateSearchConditions;
        if (!container) {
            return [];
        }
        const rows = [];
        container.querySelectorAll('.sun-stateSearchConditionRow').forEach((row) => {
            const waveSel = row.querySelector('.sun-stateSearchWaveSelect');
            const stateSel = row.querySelector('.sun-stateSearchStateSelect');
            const dirSel = row.querySelector('.sun-stateSearchDirSelect');
            rows.push({
                waveId: waveSel && waveSel.value ? String(waveSel.value) : '',
                state: stateSel ? Math.round(parseFloat(stateSel.value)) : 0,
                direction: dirSel ? String(dirSel.value) : '',
                personLayer: this._readPersonLayerFromRow(row)
            });
        });
        return rows;
    }

    _saveSettings() {
        const storage = this._getSettingsStorage();
        if (!storage) {
            return;
        }
        const limitEl = this.elements.stateSearchLimitYears;
        let limitYears = limitEl ? parseInt(limitEl.value, 10) : this.defaultLimitYears;
        if (!Number.isFinite(limitYears) || limitYears < 1) {
            limitYears = this.defaultLimitYears;
        }
        if (limitYears > 500) {
            limitYears = 500;
        }
        if (limitEl) {
            limitEl.value = String(limitYears);
        }
        storage.limitYears = limitYears;
        storage.conditions = this._readConditionsForSave();
        if (window.appState.saveDebounced) {
            window.appState.saveDebounced();
        } else if (window.appState.save) {
            window.appState.save();
        }
    }

    _scheduleSaveSettings() {
        if (this._saveSettingsTimer) {
            clearTimeout(this._saveSettingsTimer);
        }
        this._saveSettingsTimer = setTimeout(() => {
            this._saveSettingsTimer = null;
            this._saveSettings();
        }, 250);
    }

    _restoreSettings() {
        const container = this.elements.stateSearchConditions;
        if (!container) {
            return;
        }
        const storage = this._getSettingsStorage();
        const limitEl = this.elements.stateSearchLimitYears;
        if (limitEl && storage && Number.isFinite(storage.limitYears)) {
            limitEl.value = String(storage.limitYears);
        }
        container.innerHTML = '';
        const presets =
            storage && Array.isArray(storage.conditions) && storage.conditions.length
                ? storage.conditions
                : [{ waveId: '', state: 0, direction: '', personLayer: 'a' }];
        for (let i = 0; i < presets.length; i++) {
            this.addConditionRow(presets[i], { skipSave: true });
        }
    }

    _bindSettingsAutosave() {
        if (this._settingsAutosaveBound) {
            return;
        }
        this._settingsAutosaveBound = true;
        const container = this.elements.stateSearchConditions;
        const limitEl = this.elements.stateSearchLimitYears;
        if (container) {
            container.addEventListener('change', () => this._scheduleSaveSettings());
        }
        if (limitEl) {
            limitEl.addEventListener('change', () => this._scheduleSaveSettings());
            limitEl.addEventListener('input', () => this._scheduleSaveSettings());
        }
    }

    setupEventListeners() {
        const addBtn = this.elements.btnStateSearchAddCondition;
        const runBtn = this.elements.btnStateSearchRun;
        const showWavesBtn = this.elements.btnStateSearchShowWaves;
        const results = this.elements.stateSearchResults;

        if (addBtn) {
            addBtn.addEventListener('click', () => {
                this.refreshWaveSelects();
                this.addConditionRow();
                this._scheduleSaveSettings();
            });
        }
        if (runBtn) {
            runBtn.addEventListener('click', () => this.runSearch());
        }
        if (showWavesBtn) {
            showWavesBtn.addEventListener('click', () => this.showSearchWavesOnGraph());
        }
        if (results) {
            results.addEventListener('click', (e) => {
                const btn = e.target.closest('.sun-stateSearchGoToDateBtn');
                if (!btn) return;
                e.preventDefault();
                const ts = btn.dataset.dateTs;
                if (ts) {
                    this.goToDate(Number(ts));
                }
            });
        }
    }

    /** Все сигналы данных (как intersectionWaveSelect). */
    _getAllWaves() {
        if (!window.appState || !window.appState.data || !window.appState.data.waves) return [];
        return window.appState.data.waves;
    }

    /** Подпись списка сигналов для пересборки option. */
    _computeWaveListSignature() {
        if (!window.appState || !window.appState.data) return '';
        const waves = this._getAllWaves();
        const ids = waves
            .map((w) => String(w.id))
            .sort()
            .join(',');
        const groups = window.appState.data.groups || [];
        const structure = groups.map((g) => `${g.id}:${(g.waves || []).join('.')}`).join('|');
        return `${structure}|${ids}`;
    }

    /** Построение option/optgroup как у #intersectionWaveSelect. */
    _fillWaveSelectOptions(sel) {
        if (!sel || !window.appState || !window.appState.data) return;

        const allowedWaves = this._getAllWaves();
        sel.innerHTML = '';

        const empty = document.createElement('option');
        empty.value = '';
        empty.textContent = '— выберите сигнал —';
        sel.appendChild(empty);

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
        const groups = data.groups || [];
        const allWaves = data.waves || [];

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
            if (waveIds.length === 0) continue;
            const groupWaves = [];
            for (let wi = 0; wi < waveIds.length; wi++) {
                const wid = String(waveIds[wi]);
                if (!allowedById.has(wid)) continue;
                const w = allWaves.find((x) => String(x.id) === wid);
                if (w) {
                    groupWaves.push(w);
                    assigned.add(wid);
                }
            }
            if (groupWaves.length === 0) continue;
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

    _syncWaveSelectValue(sel, preferredValue) {
        if (!sel) return;
        const str = preferredValue != null && String(preferredValue) !== '' ? String(preferredValue) : '';
        if (str && [...sel.options].some((o) => o.value === str)) {
            sel.value = str;
        } else {
            sel.value = '';
        }
    }

    /** Сигналы с положительным периодом (для расчёта состояния). */
    _getSearchableWaves() {
        return this._getAllWaves().filter((w) => w.period && w.period > 0);
    }

    _normalizePersonLayer(value) {
        return value === 'b' ? 'b' : 'a';
    }

    _readPersonLayerFromRow(row) {
        const personSel = row.querySelector('.sun-stateSearchPersonSelect');
        return this._normalizePersonLayer(personSel ? personSel.value : 'a');
    }

    /** ms даты рождения персоны A (активная) или B (dateSelections.typeB). */
    _getPersonBirthMs(personLayer) {
        if (!window.appState) {
            return null;
        }
        const layer = this._normalizePersonLayer(personLayer);
        if (layer === 'a') {
            if (!window.appState.hasActivePerson || !window.appState.hasActivePerson()) {
                return null;
            }
            const bd = window.appState.baseDate;
            return typeof bd === 'number' ? bd : new Date(bd).getTime();
        }
        const ds = window.appState.dateSelections;
        if (!ds || ds.typeB == null || String(ds.typeB) === '') {
            return null;
        }
        const idB = String(ds.typeB);
        const idA =
            window.appState.activeDateId != null && String(window.appState.activeDateId) !== ''
                ? String(window.appState.activeDateId)
                : '';
        if (idB === idA) {
            return null;
        }
        const dates = window.appState.data && window.appState.data.dates;
        if (!dates) {
            return null;
        }
        const personB = dates.find((d) => String(d.id) === idB);
        if (!personB || personB.date == null) {
            return null;
        }
        return typeof personB.date === 'number' ? personB.date : new Date(personB.date).getTime();
    }

    _isPersonLayerAvailable(personLayer) {
        return this._getPersonBirthMs(personLayer) != null;
    }

    _getPersonDateId(personLayer) {
        if (!window.appState) {
            return null;
        }
        const layer = this._normalizePersonLayer(personLayer);
        if (layer === 'a') {
            const active = window.appState.activeDateId;
            if (active != null && String(active) !== '') {
                return String(active);
            }
            const ds = window.appState.dateSelections;
            if (ds && ds.typeA != null && String(ds.typeA) !== '') {
                return String(ds.typeA);
            }
            return null;
        }
        const ds = window.appState.dateSelections;
        if (!ds || ds.typeB == null || String(ds.typeB) === '') {
            return null;
        }
        const idB = String(ds.typeB);
        const idA =
            window.appState.activeDateId != null && String(window.appState.activeDateId) !== ''
                ? String(window.appState.activeDateId)
                : '';
        if (idB === idA) {
            return null;
        }
        return idB;
    }

    _getPersonDisplayName(personLayer) {
        const id = this._getPersonDateId(personLayer);
        if (!id) {
            return '';
        }
        const dates = window.appState.data && window.appState.data.dates;
        if (!dates) {
            return '';
        }
        const person = dates.find((d) => String(d.id) === id);
        if (!person) {
            return '';
        }
        return person.name || 'Без названия';
    }

    _getPersonSelectLabel(personLayer) {
        const letter = this._normalizePersonLayer(personLayer) === 'b' ? 'B' : 'A';
        const name = this._getPersonDisplayName(personLayer);
        return name ? `${letter} · ${name}` : letter;
    }

    _buildPersonSelectOptions(selectedLayer) {
        const layer = this._normalizePersonLayer(selectedLayer);
        const bAvailable = this._isPersonLayerAvailable('b');
        const opts = [
            { value: 'a', label: this._getPersonSelectLabel('a') },
            {
                value: 'b',
                label: this._getPersonSelectLabel('b'),
                disabled: !bAvailable && layer !== 'b'
            }
        ];
        return opts
            .map((o) => {
                const sel = layer === o.value ? ' selected' : '';
                const dis = o.disabled ? ' disabled' : '';
                const title =
                    o.value === 'b' && o.disabled
                        ? ' title="Выберите дату B"'
                        : o.value === 'b' && !bAvailable && layer === 'b'
                          ? ' title="Дата B не выбрана — поиск не выполнится"'
                          : o.label !== (o.value === 'b' ? 'B' : 'A')
                            ? ` title="${this._escapeHtml(o.label)}"`
                            : '';
                return `<option value="${o.value}"${sel}${dis}${title}>${this._escapeHtml(o.label)}</option>`;
            })
            .join('');
    }

    _syncPersonSelectValue(sel, preferredLayer) {
        if (!sel) {
            return;
        }
        sel.value = this._normalizePersonLayer(preferredLayer);
    }

    /**
     * Индекс календарного дня от рождения выбранной персоны для суток dayIndex активной персоны A.
     */
    _getBirthDayIndexForSearchDay(dayIndex, personLayer) {
        const layer = this._normalizePersonLayer(personLayer);
        if (layer === 'a') {
            return dayIndex;
        }
        const birthA = this._getPersonBirthMs('a');
        const birthB = this._getPersonBirthMs('b');
        if (birthA == null || birthB == null) {
            return dayIndex;
        }
        let anchor;
        if (window.waves && typeof window.waves.getCalendarDateFromBirthDayIndex === 'function') {
            anchor = window.waves.getCalendarDateFromBirthDayIndex(dayIndex, 0, birthA);
        } else {
            anchor = new Date(birthA);
            anchor.setDate(anchor.getDate() + Math.floor(dayIndex));
            anchor.setHours(0, 0, 0, 0);
        }
        const bBirth = new Date(birthB);
        bBirth.setHours(0, 0, 0, 0);
        return Math.round((anchor.getTime() - bBirth.getTime()) / (24 * 60 * 60 * 1000));
    }

    _buildStateSelectOptions(selectedState) {
        let html = '';
        for (let i = 5; i >= -5; i--) {
            const sel = Number(selectedState) === i ? ' selected' : '';
            html += `<option value="${i}"${sel}>${i}</option>`;
        }
        return html;
    }

    _buildDirectionSelectOptions(selectedDir) {
        const opts = [
            { value: '', label: 'Любое' },
            { value: '1', label: '↑ восходящая' },
            { value: '-1', label: '↓ низходящая' },
            { value: '0', label: '— экстремум' }
        ];
        return opts
            .map((o) => {
                const sel = String(selectedDir) === o.value ? ' selected' : '';
                return `<option value="${o.value}"${sel}>${o.label}</option>`;
            })
            .join('');
    }

    addConditionRow(preset, options) {
        const container = this.elements.stateSearchConditions;
        if (!container) return;

        const skipSave = options && options.skipSave === true;
        const row = document.createElement('div');
        row.className = 'sun-stateSearchConditionRow';

        const waveId = preset && preset.waveId != null ? preset.waveId : '';
        const state = preset && preset.state != null ? preset.state : 0;
        const direction = preset && preset.direction != null ? preset.direction : '';
        const personLayer =
            preset && preset.personLayer != null ? preset.personLayer : 'a';

        row.innerHTML = `
            <div class="sun-intersectionSelectGroup sun-stateSearchConditionWave">
                <label class="sun-intersectionFormLabel">Сигнал</label>
                <select class="sun-summarySelect sun-stateSearchWaveSelect"></select>
            </div>
            <div class="sun-intersectionSelectGroup sun-stateSearchConditionPerson">
                <label class="sun-intersectionFormLabel">Персона</label>
                <select class="sun-summarySelect sun-stateSearchPersonSelect">${this._buildPersonSelectOptions(personLayer)}</select>
            </div>
            <div class="sun-intersectionSelectGroup sun-stateSearchConditionState">
                <label class="sun-intersectionFormLabel">Состояние</label>
                <select class="sun-summarySelect sun-stateSearchStateSelect">${this._buildStateSelectOptions(state)}</select>
            </div>
            <div class="sun-intersectionSelectGroup sun-stateSearchConditionDir">
                <label class="sun-intersectionFormLabel">Направление</label>
                <select class="sun-summarySelect sun-stateSearchDirSelect">${this._buildDirectionSelectOptions(direction)}</select>
            </div>
            <button type="button" class="sun-uiBtn sun-stateSearchRemoveCondition" title="Удалить условие" aria-label="Удалить условие">⨯</button>
        `;

        row.querySelector('.sun-stateSearchRemoveCondition').addEventListener('click', () => {
            if (container.querySelectorAll('.sun-stateSearchConditionRow').length <= 1) {
                row.querySelector('.sun-stateSearchWaveSelect').value = '';
                row.querySelector('.sun-stateSearchStateSelect').value = '0';
                row.querySelector('.sun-stateSearchDirSelect').value = '';
                const personSel = row.querySelector('.sun-stateSearchPersonSelect');
                if (personSel) {
                    personSel.value = 'a';
                }
                this._scheduleSaveSettings();
                return;
            }
            row.remove();
            this._scheduleSaveSettings();
        });

        container.appendChild(row);

        const waveSel = row.querySelector('.sun-stateSearchWaveSelect');
        this._fillWaveSelectOptions(waveSel);
        this._syncWaveSelectValue(waveSel, waveId);

        if (!skipSave) {
            this._scheduleSaveSettings();
        }
    }

    _readConditions() {
        const container = this.elements.stateSearchConditions;
        if (!container) return [];

        const wavesById = new Map();
        this._getSearchableWaves().forEach((w) => wavesById.set(String(w.id), w));

        const conditions = [];
        container.querySelectorAll('.sun-stateSearchConditionRow').forEach((row) => {
            const waveSel = row.querySelector('.sun-stateSearchWaveSelect');
            const stateSel = row.querySelector('.sun-stateSearchStateSelect');
            const dirSel = row.querySelector('.sun-stateSearchDirSelect');
            if (!waveSel || !waveSel.value) return;

            const wave = wavesById.get(String(waveSel.value));
            if (!wave) return;

            const targetState = Math.round(parseFloat(stateSel ? stateSel.value : '0'));
            let direction = dirSel ? dirSel.value : '';
            if (direction !== '' && direction !== '1' && direction !== '-1' && direction !== '0') {
                direction = '';
            }
            const personLayer = this._readPersonLayerFromRow(row);

            conditions.push({
                wave,
                targetState: Number.isFinite(targetState) ? targetState : 0,
                direction: direction === '' ? null : parseInt(direction, 10),
                personLayer
            });
        });

        return conditions;
    }

    _readSearchDayRange() {
        const limitEl = this.elements.stateSearchLimitYears;
        let limitYears = limitEl ? parseInt(limitEl.value, 10) : this.defaultLimitYears;
        if (!Number.isFinite(limitYears) || limitYears < 1) {
            limitYears = this.defaultLimitYears;
        }
        if (limitYears > 500) {
            limitYears = 500;
        }
        const fromDay = 0;
        const toDay = Math.floor(limitYears * 365.25) - 1;
        return { fromDay, toDay };
    }

    /** Смещение в днях от рождения — как recalculateCurrentDay на визоре. */
    _effDayFromTimestamp(timestamp) {
        if (window.waves && typeof window.waves.getEffDayFromTimestamp === 'function') {
            return window.waves.getEffDayFromTimestamp(timestamp);
        }
        if (window.dates && typeof window.dates.computeDayOffsetFromBirth === 'function') {
            return window.dates.computeDayOffsetFromBirth(window.appState.baseDate, timestamp, true);
        }
        const baseMs =
            typeof window.appState.baseDate === 'number'
                ? window.appState.baseDate
                : new Date(window.appState.baseDate).getTime();
        return (timestamp - baseMs) / (24 * 60 * 60 * 1000);
    }

    /** Точные моменты (ms), когда одно условие выполняется в сутки dayIndex активной персоны A. */
    _hitTimestampsForCondition(dayIndex, condition) {
        const birthMs = this._getPersonBirthMs(condition.personLayer);
        if (birthMs == null) {
            return [];
        }
        const birthDayIndex = this._getBirthDayIndexForSearchDay(dayIndex, condition.personLayer);
        if (birthDayIndex < 0) {
            return [];
        }
        if (window.waves && typeof window.waves.findStateHitTimestampsOnBirthDay === 'function') {
            return window.waves.findStateHitTimestampsOnBirthDay(
                condition.wave,
                birthDayIndex,
                condition.targetState,
                condition.direction,
                birthMs
            );
        }
        return [];
    }

    _conditionMatchesAtTimestamp(condition, timestamp) {
        const birthMs = this._getPersonBirthMs(condition.personLayer);
        if (birthMs == null || !window.waves) {
            return false;
        }
        const effDay = window.waves.getEffDayFromTimestamp(timestamp, birthMs);
        const state = window.waves.calculateWaveStateAtDay(condition.wave, effDay);
        if (state !== condition.targetState) {
            return false;
        }
        if (condition.direction == null) {
            return true;
        }
        const dir = window.waves.calculateWaveDirectionAtGraphCenter(condition.wave, effDay);
        return dir === condition.direction;
    }

    /** Убирает дубликаты моментов, отличающихся меньше чем на epsilon. */
    _dedupeHitTimestamps(timestamps) {
        if (!timestamps.length) {
            return [];
        }
        const eps = this._hitTimeEpsilonMs;
        const sorted = timestamps.slice().sort((a, b) => a - b);
        const out = [sorted[0]];
        for (let i = 1; i < sorted.length; i++) {
            if (sorted[i] - out[out.length - 1] > eps) {
                out.push(sorted[i]);
            }
        }
        return out;
    }

    /**
     * Попадания текущего и предыдущего дня (для сверки через полночь).
     * @returns {{ currLists: number[][], prevLists: number[][]|null, expandedLists: number[][] }}
     */
    _hitListsWithPreviousDay(dayIndex, conditions) {
        const currLists = conditions.map((c) => this._hitTimestampsForCondition(dayIndex, c));
        let prevLists = null;
        let expandedLists = currLists;

        if (dayIndex >= 1) {
            prevLists = conditions.map((c) => this._hitTimestampsForCondition(dayIndex - 1, c));
            expandedLists = conditions.map((_, i) => prevLists[i].concat(currLists[i]));
        }

        return { currLists, prevLists, expandedLists };
    }

    /**
     * Моменты суток, когда выполняются все условия (И).
     * Один сигнал — все точные попадания (период 25 может быть не в полночь).
     * Несколько сигналов — общий момент (±epsilon) с учётом предыдущего дня; иначе те же сутки.
     */
    _findCommonHitTimestamps(dayIndex, conditions) {
        const { currLists, expandedLists } = this._hitListsWithPreviousDay(dayIndex, conditions);

        if (conditions.length === 1) {
            if (currLists[0].length === 0) {
                return [];
            }
            return this._dedupeHitTimestamps(currLists[0]);
        }

        const hasHitOnCurrentDay = currLists.some((list) => list.length > 0);
        if (!hasHitOnCurrentDay) {
            return [];
        }

        for (let i = 0; i < expandedLists.length; i++) {
            if (expandedLists[i].length === 0) {
                return [];
            }
        }

        const eps = this._hitTimeEpsilonMs;
        const instantMatches = [];

        for (let i = 0; i < expandedLists[0].length; i++) {
            const t0 = expandedLists[0][i];
            const aligned = [t0];
            let ok = true;
            for (let j = 1; j < expandedLists.length; j++) {
                let matched = null;
                for (let k = 0; k < expandedLists[j].length; k++) {
                    if (Math.abs(expandedLists[j][k] - t0) <= eps) {
                        matched = expandedLists[j][k];
                        break;
                    }
                }
                if (matched == null) {
                    ok = false;
                    break;
                }
                aligned.push(matched);
            }
            if (ok) {
                instantMatches.push(
                    Math.round(aligned.reduce((sum, t) => sum + t, 0) / aligned.length)
                );
            }
        }

        if (instantMatches.length > 0) {
            return this._dedupeHitTimestamps(instantMatches);
        }

        const unionCandidates = new Set();
        for (let ui = 0; ui < expandedLists.length; ui++) {
            for (let uj = 0; uj < expandedLists[ui].length; uj++) {
                unionCandidates.add(expandedLists[ui][uj]);
            }
        }
        const unionMatches = [];
        unionCandidates.forEach((t) => {
            if (conditions.every((c) => this._conditionMatchesAtTimestamp(c, t))) {
                unionMatches.push(t);
            }
        });
        if (unionMatches.length > 0) {
            return this._dedupeHitTimestamps(unionMatches);
        }

        return [this._calendarDateForDayOffset(dayIndex, 0).getTime()];
    }

    _calendarDateForDayOffset(dayOffset, dayFraction) {
        if (window.waves && typeof window.waves.getCalendarDateFromBirthDayIndex === 'function') {
            return window.waves.getCalendarDateFromBirthDayIndex(dayOffset, dayFraction);
        }
        const baseDate = new Date(window.appState.baseDate);
        const d = new Date(baseDate);
        d.setDate(d.getDate() + Math.floor(dayOffset));
        d.setHours(0, 0, 0, 0);
        if (dayFraction != null && Number.isFinite(dayFraction)) {
            const totalSeconds = Math.round(dayFraction * 24 * 60 * 60);
            const hours = Math.floor(totalSeconds / 3600);
            const minutes = Math.floor((totalSeconds % 3600) / 60);
            const seconds = totalSeconds % 60;
            d.setHours(hours, minutes, seconds, 0);
        }
        return d;
    }

    _formatResultDate(date) {
        if (window.timeUtils && typeof window.timeUtils.formatDate === 'function') {
            return window.timeUtils.formatDate(date.getTime());
        }
        return date.toLocaleDateString('ru-RU');
    }

    runSearch() {
        const resultsEl = this.elements.stateSearchResults;
        if (!resultsEl) return;

        this.refreshWaveSelects();

        if (!window.appState || !window.appState.hasActivePerson || !window.appState.hasActivePerson()) {
            resultsEl.innerHTML =
                '<div class="sun-summaryEmpty">Выберите персону в списке дат — поиск строится от её даты рождения.</div>';
            return;
        }

        const conditions = this._readConditions();
        if (conditions.length === 0) {
            resultsEl.innerHTML =
                '<div class="sun-summaryEmpty">Добавьте хотя бы один сигнал с условиями.</div>';
            return;
        }

        const missingB = conditions.some(
            (c) => c.personLayer === 'b' && !this._isPersonLayerAvailable('b')
        );
        if (missingB) {
            resultsEl.innerHTML =
                '<div class="sun-summaryEmpty">Для условий с персоной B выберите дату B на вкладке сравнения дат.</div>';
            return;
        }

        const { fromDay, toDay } = this._readSearchDayRange();
        const matches = [];
        const seenHitMs = new Set();

        for (let day = fromDay; day <= toDay; day++) {
            const hitMsList = this._findCommonHitTimestamps(day, conditions);
            for (let hi = 0; hi < hitMsList.length; hi++) {
                const hitMs = hitMsList[hi];
                if (seenHitMs.has(hitMs)) {
                    continue;
                }
                seenHitMs.add(hitMs);
                const date = new Date(hitMs);
                const effDay = this._effDayFromTimestamp(hitMs);
                matches.push({
                    day: Math.floor(effDay),
                    hitDayOffset: effDay,
                    date
                });
            }
        }

        this._renderResults(matches);
    }

    _renderResults(matches) {
        const resultsEl = this.elements.stateSearchResults;
        if (!resultsEl) return;

        if (matches.length === 0) {
            resultsEl.innerHTML = '<div class="sun-summaryEmpty">Совпадений не найдено.</div>';
            return;
        }

        const rows = matches
            .map((m) => {
                const dateStr = this._escapeHtml(this._formatResultDate(m.date));
                return `<tr class="sun-dateComparisonTableRow">
                    <td class="sun-dateComparisonTableCell">${dateStr}</td>
                    <td class="sun-dateComparisonTableCell sun-dateComparisonState">${m.day}</td>
                    <td class="sun-dateComparisonTableCell sun-dateComparisonActions">
                        <button type="button" class="sun-uiBtn sun-stateSearchGoToDateBtn" data-date-ts="${m.date.getTime()}">Перейти к дате</button>
                    </td>
                </tr>`;
            })
            .join('');

        resultsEl.innerHTML = `
            <table class="sun-dateComparisonTable sun-stateSearchTable">
                <thead>
                    <tr class="sun-dateComparisonTableRow">
                        <th class="sun-dateComparisonTableHeadCell">Дата</th>
                        <th class="sun-dateComparisonTableHeadCell">День</th>
                        <th class="sun-dateComparisonTableHeadCell sun-dateComparisonActions"></th>
                    </tr>
                </thead>
                <tbody>${rows}</tbody>
            </table>
        `;
    }

    goToDate(timestamp) {
        if (!Number.isFinite(timestamp) || !window.dates || typeof window.dates.setDate !== 'function') {
            return;
        }
        window.dates.setDate(new Date(timestamp), true);
    }

    /** Спросить включение отключённых групп для сигналов поиска; отфильтровать те, что нельзя показать. */
    _confirmGroupsForSearchWaves(idsA, idsB) {
        if (!window.appState || !window.waves || !window.appState.data.groups) {
            return { idsA, idsB, enabledGroupIds: [] };
        }

        const wavesToShow = new Set([...idsA, ...idsB]);
        const disabledGroups = new Map();

        for (const wid of wavesToShow) {
            if (window.waves.isWaveGroupEnabled(wid)) {
                continue;
            }
            for (let gi = 0; gi < window.appState.data.groups.length; gi++) {
                const group = window.appState.data.groups[gi];
                if (group.enabled) {
                    continue;
                }
                if (group.waves && group.waves.some((wId) => String(wId) === String(wid))) {
                    disabledGroups.set(String(group.id), group);
                }
            }
        }

        const enabledGroupIds = [];
        for (const [groupId, group] of disabledGroups) {
            const shouldEnable = window.confirm(
                `Группа "${group.name}" отключена. Включить её для отображения сигнала?`
            );
            if (shouldEnable) {
                group.enabled = true;
                enabledGroupIds.push(groupId);
            }
        }

        if (enabledGroupIds.length > 0) {
            enabledGroupIds.forEach((groupId) => {
                document.querySelectorAll('.sun-waveGroupToggle').forEach((el) => {
                    if (String(el.getAttribute('data-group-id')) === String(groupId)) {
                        el.checked = true;
                    }
                });
                if (
                    window.unifiedListManager &&
                    typeof window.unifiedListManager.updateGroupStats === 'function'
                ) {
                    window.unifiedListManager.updateGroupStats(groupId);
                }
            });
        }

        const filteredA = new Set(idsA);
        const filteredB = new Set(idsB);
        for (const wid of filteredA) {
            if (!window.waves.isWaveGroupEnabled(wid)) {
                filteredA.delete(wid);
            }
        }
        for (const wid of filteredB) {
            if (!window.waves.isWaveGroupEnabled(wid)) {
                filteredB.delete(wid);
            }
        }

        return { idsA: filteredA, idsB: filteredB, enabledGroupIds };
    }

    /** Скрыть все сигналы и включить только из условий поиска. */
    showSearchWavesOnGraph() {
        const conditions = this._readConditions();
        if (conditions.length === 0) {
            window.alert('Добавьте хотя бы один сигнал с условиями в поиске.');
            return;
        }

        let idsA = new Set();
        let idsB = new Set();
        for (let ci = 0; ci < conditions.length; ci++) {
            const c = conditions[ci];
            const wid = String(c.wave.id);
            if (c.personLayer === 'b') {
                idsB.add(wid);
            } else {
                idsA.add(wid);
            }
        }

        const groupResult = this._confirmGroupsForSearchWaves(idsA, idsB);
        idsA = groupResult.idsA;
        idsB = groupResult.idsB;
        const enabledGroupIds = groupResult.enabledGroupIds;

        const waves = window.appState && window.appState.data && window.appState.data.waves;
        if (!waves || !waves.length) {
            return;
        }

        for (let i = 0; i < waves.length; i++) {
            const wid = String(waves[i].id);
            window.appState.waveVisibility[wid] = idsA.has(wid);
            window.appState.waveBold[wid] = idsB.has(wid);
        }

        if (window.appState.saveDebounced) {
            window.appState.saveDebounced();
        } else if (window.appState.save) {
            window.appState.save();
        }

        if (
            window.unifiedListManager &&
            typeof window.unifiedListManager.syncWavesListVisibilityFromAppState === 'function'
        ) {
            window.unifiedListManager.syncWavesListVisibilityFromAppState();
        }
        if (enabledGroupIds.length > 0 && window.eventManager && typeof window.eventManager.recreateAllWaveElements === 'function') {
            window.eventManager.recreateAllWaveElements();
        } else if (window.waves && typeof window.waves.reconcileVisibleWaveElements === 'function') {
            window.waves.reconcileVisibleWaveElements();
        }
        if (window.waves && typeof window.waves.updatePosition === 'function') {
            window.waves.updatePosition({ forceWaveLabels: true });
        }
        if (window.extremumTimeManager && typeof window.extremumTimeManager.updateExtremums === 'function') {
            window.extremumTimeManager.updateExtremums();
        }
        if (window.summaryManager && typeof window.summaryManager.debouncedUpdate === 'function') {
            window.summaryManager.debouncedUpdate();
        }
        if (window.dom && typeof window.dom.refreshShowOnVizorButtonLabels === 'function') {
            window.dom.refreshShowOnVizorButtonLabels();
        }
    }

    refreshPersonSelects() {
        const container = this.elements.stateSearchConditions;
        if (!container) {
            return;
        }
        container.querySelectorAll('.sun-stateSearchConditionRow').forEach((row) => {
            const sel = row.querySelector('.sun-stateSearchPersonSelect');
            if (!sel) {
                return;
            }
            const current = sel.value;
            sel.innerHTML = this._buildPersonSelectOptions(current);
            this._syncPersonSelectValue(sel, current);
        });
    }

    refreshWaveSelects() {
        const container = this.elements.stateSearchConditions;
        if (!container) return;

        this.refreshPersonSelects();

        const sig = this._computeWaveListSignature();
        const needsRebuild = sig !== this._waveListSig;
        if (needsRebuild) {
            this._waveListSig = sig;
        }

        container.querySelectorAll('.sun-stateSearchConditionRow').forEach((row) => {
            const sel = row.querySelector('.sun-stateSearchWaveSelect');
            if (!sel) return;
            const current = sel.value;
            if (needsRebuild || sel.options.length <= 1) {
                this._fillWaveSelectOptions(sel);
            }
            this._syncWaveSelectValue(sel, current);
        });
    }

    _escapeHtml(s) {
        return String(s)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;');
    }
}

window.stateSearchManager = new StateSearchManager();
