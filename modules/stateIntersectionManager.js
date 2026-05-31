/**
 * @file stateIntersectionManager.js
 * Вкладка «Пересечения»: выбранный сигнал и пересечения с остальными.
 */
// Показывает пересечения ВЫБРАННОГО сигнала со всеми остальными

class StateIntersectionManager {
    constructor() {
        this.elements = {};
        this.cacheElements();
        
        this.selectedWaveId = null;
        this.isUpdating = false;
        this._intersectionUpdateRaf = null;
        this._intersectionDateMirrorSilent = false;
        this._intersectionWaveSelectMirrorSilent = false;
        this._intersectionWaveSelectSig = null;
        this.lastIntersectionBaseMsA = null;
        this.lastIntersectionBaseMsB = null;
        this._onWaveCornerSelectionChanged = this._onWaveCornerSelectionChanged.bind(this);
        this.currentSortMode = 'period-desc'; // 'period-desc' или 'time-asc'
        
        this.init();
    }
    
    /** Кэширует DOM вкладки «Пересечения». */
    cacheElements() {
        const ids = [
            'intersectionPanel',
            'intersectionDateSelectA',
            'intersectionDateSelectB',
            'intersectionSortSelect',  // ДОБАВЛЕНО
            'intersectionWaveSelect',
            'intersectionResults',
            'intersectionStats'
        ];
        
        ids.forEach(id => {
            const el = document.getElementById(id);
            if (el) this.elements[id] = el;
        });
    }
    
    /** Слушатели, сортировка, зеркалирование селектов, первый расчёт. */
    init() {
        this.setupEventListeners();
        this.restoreSortSelection();  // ДОБАВЛЕНО
        this.setupWaveSelectionObserver();
        this.setupDateObservers();
        this.setupIntersectionDateSelects();
        this.selectedWaveId = this.getSelectedWaveId();
        this.updateIntersections();
        setTimeout(() => {
            this.mirrorCompareSelectsToIntersection();
        }, 0);
    }
    
    /** Сортировка, очистка, селект волны, кнопка time rail. */
    setupEventListeners() {
        // ДОБАВЛЕНО: Обработчик для селекта сортировки
        const sortSelect = this.elements.intersectionSortSelect;
        if (sortSelect) {
            sortSelect.addEventListener('change', (e) => {
                this.currentSortMode = e.target.value;
                this.saveSortSelection();
                this.displayResults(this.lastIntersections, this.lastSelectedWave, this.lastCurrentDate);
            });
        }
        
        const clearBtn = document.getElementById('btnClearWaveSelection');
        if (clearBtn) {
            clearBtn.addEventListener('click', () => {
                this.clearSelection();
            });
        }

        const waveSel = this.elements.intersectionWaveSelect;
        if (waveSel) {
            waveSel.addEventListener('change', () => {
                if (this._intersectionWaveSelectMirrorSilent) return;
                const v = waveSel.value;
                if (!v) {
                    this.clearSelection();
                    return;
                }
                if (window.waves && typeof window.waves.setWaveCornerColor === 'function') {
                    window.waves.setWaveCornerColor(v, true);
                }
            });
        }

        const railBtn = document.getElementById('btnIntersectionTimeRail');
        if (railBtn) {
            railBtn.addEventListener('click', () => {
                if (
                    !window.intersectionTimeRailOverlay ||
                    !this.lastIntersections ||
                    this.lastIntersections.length === 0 ||
                    !this.lastSelectedWave ||
                    !this.lastCurrentDate
                ) {
                    return;
                }
                const byTime = [...this.lastIntersections].sort(
                    (a, b) => a.time.getTime() - b.time.getTime()
                );
                window.intersectionTimeRailOverlay.open(byTime, this.lastSelectedWave, this.lastCurrentDate);
            });
        }
    }

    /** Вкл/выкл кнопки открытия рельса времени. */
    syncTimeRailOverlayButton() {
        const btn = document.getElementById('btnIntersectionTimeRail');
        if (!btn) return;
        const ok =
            this.lastIntersections &&
            this.lastIntersections.length > 0 &&
            this.lastSelectedWave &&
            this.lastCurrentDate;
        btn.disabled = !ok;
    }
    
    /** Слушает zaraza:waveCornerSelectionChanged. */
    setupWaveSelectionObserver() {
        window.addEventListener('zaraza:waveCornerSelectionChanged', this._onWaveCornerSelectionChanged);
        window.addEventListener('beforeunload', () => {
            window.removeEventListener('zaraza:waveCornerSelectionChanged', this._onWaveCornerSelectionChanged);
        });
    }

    /** Пересчёт при смене выбранной волны угловым квадратом. */
    _onWaveCornerSelectionChanged() {
        const currentSelectedId = this.getSelectedWaveId();
        if (currentSelectedId !== this.selectedWaveId) {
            this.selectedWaveId = currentSelectedId;
            this.updateIntersections();
        }
    }
    
    /** Id волны с включённым waveCornerColor. */
    getSelectedWaveId() {
        if (!window.appState || !window.appState.waveCornerColor) return null;
        
        for (const [waveId, isSelected] of Object.entries(window.appState.waveCornerColor)) {
            if (isSelected) return waveId;
        }
        return null;
    }
    
    /**
     * Observers на currentDate/currentDay — в summaryManager.setupStateObservers()
     * (единый setter для сводки и вкладки «Пересечения»).
     */
    setupDateObservers() {}

    /** Селекты дат A/B на вкладке пересечений. */
    setupIntersectionDateSelects() {
        const elA = this.elements.intersectionDateSelectA;
        const elB = this.elements.intersectionDateSelectB;
        if (elA) {
            elA.addEventListener('change', () => this._onIntersectionDateSelectChange('a'));
        }
        if (elB) {
            elB.addEventListener('change', () => this._onIntersectionDateSelectChange('b'));
        }
    }

    /**
     * Синхронизировать селекты вкладки «Пересечения» с «Дата A» / «Дата B» вкладки сравнения (общий dateSelections).
     */
    mirrorCompareSelectsToIntersection() {
        const ia = this.elements.intersectionDateSelectA;
        const ib = this.elements.intersectionDateSelectB;
        if (!ia || !ib) return;
        const ca = document.getElementById('dateCompareSelectA');
        const cb = document.getElementById('dateCompareSelectB');
        const dcm = window.dateComparisonManager;
        if (!dcm || typeof dcm.fillCompareSelectOptions !== 'function') {
            return;
        }
        if (ca && !ca.options.length) {
            return;
        }
        this._intersectionDateMirrorSilent = true;
        try {
            dcm.fillCompareSelectOptions(ia, false);
            dcm.fillCompareSelectOptions(ib, true);
            if (ca && ca.value && [...ia.options].some((o) => o.value === ca.value)) {
                ia.value = ca.value;
            }
            if (cb && cb.value && [...ib.options].some((o) => o.value === cb.value)) {
                ib.value = cb.value;
            } else if (cb) {
                ib.value = cb.value || '';
            }
        } finally {
            this._intersectionDateMirrorSilent = false;
        }
    }

    /** Внутренний метод onIntersectionDateSelectChange. */
    _onIntersectionDateSelectChange(which) {
        if (this._intersectionDateMirrorSilent) return;
        const ia = this.elements.intersectionDateSelectA;
        const ib = this.elements.intersectionDateSelectB;
        const ca = document.getElementById('dateCompareSelectA');
        const cb = document.getElementById('dateCompareSelectB');
        const dcm = window.dateComparisonManager;
        if (!dcm || !ca || !cb) return;
        if (which === 'a' && ia) {
            if (ia.value && [...ca.options].some((o) => o.value === ia.value)) {
                ca.value = ia.value;
            }
            dcm._onSelectChange('a');
            return;
        }
        if (which === 'b' && ib) {
            if (ib.value && [...cb.options].some((o) => o.value === ib.value)) {
                cb.value = ib.value;
            }
            dcm._onSelectChange('b');
        }
    }

    /** Остаток по модулю периода (дней), всегда в [0, period). */
    _modPositiveDays(days, period) {
        let m = days % period;
        if (m < 0) m += period;
        return m;
    }

    /** Внутренний метод getBirthStartMsForDateId. */
    _getBirthStartMsForDateId(dateId) {
        if (dateId == null || String(dateId) === '') return null;
        const person = (window.appState.data.dates || []).find((d) => String(d.id) === String(dateId));
        if (!person || person.date == null) return null;
        const selectedDate = window.timeUtils
            ? window.timeUtils.toLocalDate(person.date)
            : new Date(person.date);
        return new Date(
            selectedDate.getFullYear(),
            selectedDate.getMonth(),
            selectedDate.getDate(),
            0,
            0,
            0,
            0
        ).getTime();
    }

    /** Внутренний метод personDisplayName. */
    _personDisplayName(dateId) {
        const person = (window.appState.data.dates || []).find((d) => String(d.id) === String(dateId));
        if (!person) return '—';
        const birth = window.timeUtils ? window.timeUtils.formatDate(person.date) : '';
        const name = person.name || 'Без названия';
        return birth ? `${name} · ${birth}` : name;
    }

    /**
     * Опоры фаз: А — выбранный сигнал (wave1), Б — остальные (wave2). Совпадает с логикой слоёв A/B на графике.
     */
    _getIntersectionPhaseBases() {
        const ds = window.appState.dateSelections || { typeA: null, typeB: null };
        const active = window.appState.activeDateId;
        const idA =
            ds.typeA != null && String(ds.typeA) !== ''
                ? String(ds.typeA)
                : active != null && String(active) !== ''
                  ? String(active)
                  : '';
        let idB = ds.typeB != null && String(ds.typeB) !== '' ? String(ds.typeB) : '';
        if (!idB || idB === idA) {
            idB = idA;
        }
        const bdRaw =
            window.appState.baseDate instanceof Date
                ? window.appState.baseDate
                : new Date(window.appState.baseDate);
        const fallbackMs = new Date(
            bdRaw.getFullYear(),
            bdRaw.getMonth(),
            bdRaw.getDate(),
            0,
            0,
            0,
            0
        ).getTime();
        const baseMsA = this._getBirthStartMsForDateId(idA) ?? fallbackMs;
        const baseMsB = this._getBirthStartMsForDateId(idB) ?? baseMsA;
        return {
            idA,
            idB,
            baseMsA,
            baseMsB,
            labelA: idA ? this._personDisplayName(idA) : '—',
            labelB: idB ? this._personDisplayName(idB) : '—',
            samePerson: String(idA) === String(idB)
        };
    }
    
    /** RAF-отложенный updateIntersections. */
    debouncedUpdate() {
        if (this._intersectionUpdateRaf != null) {
            cancelAnimationFrame(this._intersectionUpdateRaf);
        }
        this._intersectionUpdateRaf = requestAnimationFrame(() => {
            this._intersectionUpdateRaf = null;
            this.updateIntersections();
        });
    }
    
    // ДОБАВЛЕНО: Сохранение/восстановление выбранной сортировки
    /** Режим сортировки из localStorage. */
    restoreSortSelection() {
        const savedSort = localStorage.getItem('intersectionSelectedSort');
        if (savedSort && this.elements.intersectionSortSelect) {
            this.currentSortMode = savedSort;
            this.elements.intersectionSortSelect.value = savedSort;
        }
    }
    
    /** Сохраняет режим сортировки пересечений. */
    saveSortSelection() {
        if (this.elements.intersectionSortSelect) {
            localStorage.setItem('intersectionSelectedSort', this.currentSortMode);
        }
    }
    
    /** Все сигналы данных (вкладка «Пересечения» без фильтра по группе отображения). */
    getAllWavesFromSelectedGroup() {
        if (!window.appState || !window.appState.data || !window.appState.data.waves) return [];
        return window.appState.data.waves;
    }

    /** Внутренний метод computeIntersectionWaveListSignature. */
    _computeIntersectionWaveListSignature() {
        if (!window.appState || !window.appState.data) return '';
        const waves = this.getAllWavesFromSelectedGroup();
        const ids = waves
            .map((w) => String(w.id))
            .sort()
            .join(',');
        const groups = window.appState.data.groups || [];
        const structure = groups.map((g) => `${g.id}:${(g.waves || []).join('.')}`).join('|');
        return `${structure}|${ids}`;
    }

    /** Внутренний метод fillIntersectionWaveSelectOptions. */
    _fillIntersectionWaveSelectOptions() {
        const sel = this.elements.intersectionWaveSelect;
        if (!sel || !window.appState || !window.appState.data) return;

        const allowedWaves = this.getAllWavesFromSelectedGroup();
        sel.innerHTML = '';

        const empty = document.createElement('option');
        empty.value = '';
        empty.textContent = '— не выбран —';
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

    /** Обновляет select волны при смене corner color. */
    refreshIntersectionWaveSelectIfNeeded() {
        const sel = this.elements.intersectionWaveSelect;
        if (!sel) return;
        const sig = this._computeIntersectionWaveListSignature();
        if (sig !== this._intersectionWaveSelectSig) {
            this._intersectionWaveSelectSig = sig;
            this._fillIntersectionWaveSelectOptions();
        }
        this._syncIntersectionWaveSelectFromAppState();
    }

    /** Внутренний метод syncIntersectionWaveSelectFromAppState. */
    _syncIntersectionWaveSelectFromAppState() {
        const sel = this.elements.intersectionWaveSelect;
        if (!sel) return;
        const id = this.getSelectedWaveId();
        const str = id != null && String(id) !== '' ? String(id) : '';
        this._intersectionWaveSelectMirrorSilent = true;
        try {
            if (str && [...sel.options].some((o) => o.value === str)) {
                sel.value = str;
            } else {
                sel.value = '';
            }
        } finally {
            this._intersectionWaveSelectMirrorSilent = false;
        }
    }
    
    /** Пересечения выбранной волны с остальными за день. */
    findIntersectionsWithSelectedWave(selectedWave, otherWaves, date, baseMsA, baseMsB) {
        const allIntersections = [];
        
        const dayStart = new Date(date);
        dayStart.setHours(0, 0, 0, 0);
        const dayEnd = new Date(dayStart);
        dayEnd.setHours(23, 59, 59, 999);

        const msPerDay = 1000 * 60 * 60 * 24;
        const bA = baseMsA != null ? baseMsA : this._getIntersectionPhaseBases().baseMsA;
        const bB = baseMsB != null ? baseMsB : bA;
        
        const getWaveValue = (wave, timeMs, birthStartMs) => {
            const daysFromBase = (timeMs - birthStartMs) / msPerDay;
            const phase = this._modPositiveDays(daysFromBase, wave.period) / wave.period;
            const angle = phase * 2 * Math.PI;
            return Math.sin(angle);
        };
        
        for (const otherWave of otherWaves) {
            if (String(otherWave.id) === String(selectedWave.id)) continue;
            
            const T1 = selectedWave.period;
            const T2 = otherWave.period;
            
            const daysToStartA = (dayStart.getTime() - bA) / msPerDay;
            const daysToStartB = (dayStart.getTime() - bB) / msPerDay;
            const phase1 = this._modPositiveDays(daysToStartA, T1) / T1;
            const phase2 = this._modPositiveDays(daysToStartB, T2) / T2;
            
            const phi1 = phase1 * 2 * Math.PI;
            const phi2 = phase2 * 2 * Math.PI;
            
            const omega1 = 2 * Math.PI / T1;
            const omega2 = 2 * Math.PI / T2;
            
            // Первое семейство решений
            if (Math.abs(omega1 - omega2) > 1e-10) {
                for (let k = -10; k <= 10; k++) {
                    const t = (phi2 - phi1 + 2 * Math.PI * k) / (omega1 - omega2);
                    const timeMs = dayStart.getTime() + t * 24 * 60 * 60 * 1000;
                    
                    if (timeMs >= dayStart.getTime() && timeMs <= dayEnd.getTime()) {
                        const y1 = getWaveValue(selectedWave, timeMs, bA);
                        const y2 = getWaveValue(otherWave, timeMs, bB);
                        
                        if (Math.abs(y1 - y2) < 1e-8) {
                            allIntersections.push({
                                time: new Date(timeMs),
                                wave1: selectedWave,
                                wave2: otherWave,
                                value: y1
                            });
                        }
                    }
                }
            }
            
            // Второе семейство решений
            for (let k = -10; k <= 10; k++) {
                const t = (Math.PI - phi1 - phi2 + 2 * Math.PI * k) / (omega1 + omega2);
                const timeMs = dayStart.getTime() + t * 24 * 60 * 60 * 1000;
                
                if (timeMs >= dayStart.getTime() && timeMs <= dayEnd.getTime()) {
                    const y1 = getWaveValue(selectedWave, timeMs, bA);
                    const y2 = getWaveValue(otherWave, timeMs, bB);
                    
                    if (Math.abs(y1 - y2) < 1e-8) {
                        allIntersections.push({
                            time: new Date(timeMs),
                            wave1: selectedWave,
                            wave2: otherWave,
                            value: y1
                        });
                    }
                }
            }
        }
        
        // Убираем дубликаты
        const uniqueIntersections = [];
        for (const inter of allIntersections) {
            let isDuplicate = false;
            for (const existing of uniqueIntersections) {
                if (Math.abs(existing.time.getTime() - inter.time.getTime()) < 1000 &&
                    String(existing.wave1.id) === String(inter.wave1.id) &&
                    String(existing.wave2.id) === String(inter.wave2.id)) {
                    isDuplicate = true;
                    break;
                }
            }
            if (!isDuplicate) {
                uniqueIntersections.push(inter);
            }
        }
        
        return uniqueIntersections.sort((a, b) => a.time - b.time);
    }

    /**
     * Пересечения выбранной волны с остальными за несколько календарных дней подряд (от полуночи firstDayDate).
     * @param {object} selectedWave
     * @param {object[]} otherWaves
     * @param {Date} firstDayDate
     * @param {number} numDays целое >= 1
     * @returns {Array<{ time: Date, wave1: object, wave2: object, value: number }>}
     */
    /** Поиск пересечений на несколько дней вперёд. */
    findIntersectionsMultiDay(selectedWave, otherWaves, firstDayDate, numDays, baseMsA, baseMsB) {
        const n = Math.max(1, Math.floor(Number(numDays) || 1));
        const bA = baseMsA != null ? baseMsA : this.lastIntersectionBaseMsA;
        const bB = baseMsB != null ? baseMsB : this.lastIntersectionBaseMsB ?? bA;
        const merged = [];
        for (let i = 0; i < n; i++) {
            const day = new Date(firstDayDate);
            day.setHours(0, 0, 0, 0);
            day.setDate(day.getDate() + i);
            const one = this.findIntersectionsWithSelectedWave(selectedWave, otherWaves, day, bA, bB);
            merged.push(...one);
        }
        const unique = [];
        for (const inter of merged) {
            let isDuplicate = false;
            for (const existing of unique) {
                if (
                    Math.abs(existing.time.getTime() - inter.time.getTime()) < 1000 &&
                    String(existing.wave1.id) === String(inter.wave1.id) &&
                    String(existing.wave2.id) === String(inter.wave2.id)
                ) {
                    isDuplicate = true;
                    break;
                }
            }
            if (!isDuplicate) {
                unique.push(inter);
            }
        }
        return unique.sort((a, b) => a.time.getTime() - b.time.getTime());
    }

    /** Расчёт пересечений выбранной волны с остальными. */
    updateIntersections() {
        if (this.isUpdating) return;
        
        try {
            this.isUpdating = true;
            this.refreshIntersectionWaveSelectIfNeeded();
            
            if (!window.appState.hasActivePerson()) {
                this.lastIntersections = [];
                this.lastSelectedWave = null;
                this.lastIntersectionPhaseInfo = null;
                this.showNoIntersectionsMessage(
                    'Выберите персону в списке дат — без неё график и пересечения не строятся.'
                );
                if (this.elements.intersectionStats) {
                    this.elements.intersectionStats.style.display = 'none';
                    this.elements.intersectionStats.innerHTML = '';
                }
                return;
            }
            
            // После load() чекбоксы «окраска углов» в appState, а selectedWaveId мог
            // остаться null из конструктора (скрипт грузится до await appState.load()).
            this.selectedWaveId = this.getSelectedWaveId();
            
            if (!this.selectedWaveId) {
                this.showNoWaveSelectedMessage();
                return;
            }
            
            const selectedWave = this.findWaveById(this.selectedWaveId);
            if (!selectedWave) {
                this.showNoWaveSelectedMessage();
                return;
            }
            
            const allWaves = this.getAllWavesFromSelectedGroup();
            
            if (allWaves.length < 2) {
                this.lastIntersections = [];
                this.lastSelectedWave = null;
                this.lastIntersectionPhaseInfo = null;
                this.showNoIntersectionsMessage('Недостаточно сигналов для поиска пересечений');
                if (this.elements.intersectionStats) {
                    this.elements.intersectionStats.style.display = 'none';
                    this.elements.intersectionStats.innerHTML = '';
                }
                return;
            }
            
            const currentDate = window.appState.currentDate || new Date();

            const phaseBases = this._getIntersectionPhaseBases();
            this.lastIntersectionBaseMsA = phaseBases.baseMsA;
            this.lastIntersectionBaseMsB = phaseBases.baseMsB;
            this.lastIntersectionPhaseInfo = {
                labelA: phaseBases.labelA,
                labelB: phaseBases.labelB,
                samePerson: phaseBases.samePerson
            };
            
            const intersections = this.findIntersectionsWithSelectedWave(
                selectedWave, 
                allWaves, 
                currentDate,
                phaseBases.baseMsA,
                phaseBases.baseMsB
            );
            
            // Сохраняем для использования при смене сортировки
            this.lastIntersections = intersections;
            this.lastSelectedWave = selectedWave;
            this.lastCurrentDate = currentDate;
            
            this.displayResults(intersections, selectedWave, currentDate);
            
        } catch (error) {
            console.error('Error updating intersections:', error);
            this.lastIntersections = [];
            this.lastSelectedWave = null;
            this.lastIntersectionPhaseInfo = null;
            this.showNoIntersectionsMessage('Ошибка при расчете пересечений');
            if (this.elements.intersectionStats) {
                this.elements.intersectionStats.style.display = 'none';
                this.elements.intersectionStats.innerHTML = '';
            }
        } finally {
            this.isUpdating = false;
        }
    }
    
    /** Объект волны по id из appState.data.waves. */
    findWaveById(waveId) {
        if (!window.appState || !window.appState.data) return null;
        return window.appState.data.waves.find(w => String(w.id) === String(waveId));
    }
    
    // ОБНОВЛЕНО: Сортировка результатов по выбранному режиму
    /** Сортировка по period-desc или time-asc. */
    sortIntersections(intersections) {
        if (this.currentSortMode === 'time-asc') {
            // Сортировка по времени от наименьшего к наибольшему
            return [...intersections].sort((a, b) => a.time.getTime() - b.time.getTime());
        } else {
            // Сортировка по периоду от большего к меньшему (по умолчанию)
            return [...intersections].sort((a, b) => {
                const periodA = a.wave2.period;
                const periodB = b.wave2.period;
                return periodB - periodA;
            });
        }
    }
    
    /** Отрисовка списка пересечений с учётом сортировки. */
    displayResults(intersections, selectedWave, currentDate) {
        const container = this.elements.intersectionResults;
        const stats = this.elements.intersectionStats;
        
        if (!container) return;

        if (stats && this.lastIntersectionPhaseInfo) {
            const inf = this.lastIntersectionPhaseInfo;
            const waveName = this.escapeHtml(selectedWave.name);
            let body;
            if (inf.samePerson) {
                body = `Фаза всех сигналов от одной персоны: <strong>${this.escapeHtml(inf.labelA)}</strong>.`;
            } else {
                body =
                    `Выбранный сигнал «<strong>${waveName}</strong>» — фаза <strong>А</strong> (${this.escapeHtml(inf.labelA)}); ` +
                    `остальные сигналы — фаза <strong>Б</strong> (${this.escapeHtml(inf.labelB)}).`;
            }
            stats.innerHTML = `<div class="intersection-stats-content">${body}</div>`;
            stats.style.display = 'block';
        }
        
        if (intersections.length === 0) {
            container.innerHTML = `
                <div class="list-empty">
                    <div style="text-align: center; padding: 20px;">
                        <div style="font-size: 32px; margin-bottom: 10px;">📊</div>
                        <div>Нет пересечений сигнала <strong>${this.escapeHtml(selectedWave.name)}</strong> в выбранный день</div>
                    </div>
                </div>
            `;
            this.syncTimeRailOverlayButton();
            return;
        }
        
        // ПРИМЕНЯЕМ СОРТИРОВКУ
        const sortedIntersections = this.sortIntersections(intersections);
        const useLayerB =
            this.lastIntersectionPhaseInfo && this.lastIntersectionPhaseInfo.samePerson === false;

        const msPerDay = 24 * 60 * 60 * 1000;
        const baseMsB = this.lastIntersectionBaseMsB != null ? this.lastIntersectionBaseMsB : this._getIntersectionPhaseBases().baseMsB;

        const resultsHTML = sortedIntersections.map((inter, index) => {
            const wave = inter.wave2;
            const timeStr = this.formatTime(inter.time);
            const dayAtInter = (inter.time.getTime() - baseMsB) / msPerDay;
            const stateAtInter =
                window.waves && typeof window.waves.calculateWaveStateAtDay === 'function'
                    ? window.waves.calculateWaveStateAtDay(wave, dayAtInter)
                    : inter.value * 5;
            const dirAtInter =
                window.waves && typeof window.waves.calculateWaveDirectionAtDay === 'function'
                    ? window.waves.calculateWaveDirectionAtDay(wave, dayAtInter)
                    : 0;
            const dirLabel =
                window.waves && typeof window.waves.formatWaveDirectionLabel === 'function'
                    ? window.waves.formatWaveDirectionLabel(dirAtInter)
                    : '—';
            const dirTitle =
                window.waves && typeof window.waves.formatWaveDirectionTitle === 'function'
                    ? window.waves.formatWaveDirectionTitle(dirAtInter)
                    : '';
            const vizorBtnClass = useLayerB ? 'ui-btn show-on-vizor-btn intersection-vizor-b-btn' : 'ui-btn show-on-vizor-btn';
            const vizorLabel =
                window.dom && useLayerB
                    ? window.dom.getIntersectionVizorToggleLabelForWaveB(wave.id)
                    : window.dom
                      ? window.dom.getWaveVizorToggleButtonLabel(wave.id)
                      : 'Показать волну';
            
            return `
                <div class="summary-item">
                    <div class="summary-item-info">
                        <div class="summary-item-name">
                            <span class="summary-item-index">${index + 1}.</span>
                            <span style="color: ${wave.color || '#666'}">
                                ${this.escapeHtml(wave.name)}
                            </span>
                            <span class="wave-period-badge">${wave.period} дней</span>
                        </div>
                        <div class="summary-item-details">
                            <span class="summary-item-state">🕐 ${timeStr}</span>
                            <span class="summary-item-difference">Состояние: ${stateAtInter.toFixed(2)} <span class="wave-direction-label" title="${this.escapeHtml(dirTitle)}">${dirLabel}</span></span>
                        </div>
                    </div>
                    <div class="summary-item-color" style="background-color: ${wave.color || '#666'}"></div>
                    <div class="summary-item-actions">
                        <button type="button" class="${vizorBtnClass}" data-wave-id="${wave.id}">
                            ${vizorLabel}
                        </button>
                    </div>
                </div>
            `;
        }).join('');
        
        container.innerHTML = resultsHTML;

        queueMicrotask(() => {
            container.querySelectorAll('.show-on-vizor-btn:not(.date-compare-vizor-btn)').forEach(btn => {
                btn.replaceWith(btn.cloneNode(true));
            });

            container.querySelectorAll('.show-on-vizor-btn:not(.date-compare-vizor-btn)').forEach(btn => {
                btn.addEventListener('click', (e) => {
                    e.preventDefault();
                    e.stopPropagation();

                    const waveId = btn.dataset.waveId;
                    if (!waveId) return;

                    if (btn.classList.contains('intersection-vizor-b-btn')) {
                        let bCheckbox = null;
                        document.querySelectorAll('.wave-b-visibility-check').forEach((cb) => {
                            if (String(cb.getAttribute('data-id') || '') === String(waveId)) {
                                bCheckbox = cb;
                            }
                        });
                        if (bCheckbox) {
                            const isChecked = bCheckbox.checked;
                            bCheckbox.checked = !isChecked;
                            bCheckbox.dispatchEvent(
                                new Event('change', {
                                    bubbles: true,
                                    cancelable: true
                                })
                            );
                            if (window.eventManager && window.eventManager.handleWavePersonBVisibilityChange) {
                                window.eventManager.handleWavePersonBVisibilityChange(
                                    waveId,
                                    !isChecked,
                                    $(bCheckbox)
                                );
                            }
                        } else if (window.eventManager && window.eventManager.handleWavePersonBVisibilityChange) {
                            const wid = String(waveId);
                            const cur = window.appState.waveBold[wid] === true;
                            const next = !cur;
                            const $fake = $('<input type="checkbox" />');
                            $fake.prop('checked', next);
                            window.eventManager.handleWavePersonBVisibilityChange(waveId, next, $fake);
                        }
                    } else {
                        let checkbox = null;
                        checkbox = document.querySelector(`.wave-visibility-check[data-id="${waveId}"]`);

                        if (!checkbox) {
                            checkbox = document.querySelector(
                                `.group-children .wave-visibility-check[data-id="${waveId}"]`
                            );
                        }

                        if (checkbox) {
                            const isChecked = checkbox.checked;
                            checkbox.checked = !isChecked;

                            const changeEvent = new Event('change', {
                                bubbles: true,
                                cancelable: true
                            });
                            checkbox.dispatchEvent(changeEvent);

                            if (window.eventManager && window.eventManager.handleWaveVisibilityChange) {
                                const $checkbox = $(checkbox);
                                window.eventManager.handleWaveVisibilityChange(waveId, !isChecked, $checkbox);
                            }
                        } else {
                            if (window.appState && window.appState.waveVisibility) {
                                const waveIdStr = String(waveId);
                                const currentState = window.appState.waveVisibility[waveIdStr];
                                window.appState.waveVisibility[waveIdStr] = currentState === false;
                                window.appState.save();

                                if (window.waves && window.waves.updatePosition) {
                                    window.waves.updatePosition();
                                }

                                if (window.unifiedListManager && window.unifiedListManager.updateWavesList) {
                                    window.unifiedListManager.updateWavesList();
                                }
                            }
                        }
                    }
                    if (window.dom && window.dom.refreshShowOnVizorButtonLabels) {
                        window.dom.refreshShowOnVizorButtonLabels();
                    }
                });
            });
        });
        this.syncTimeRailOverlayButton();
    }
    
    /** Пустое состояние: волна не выбрана. */
    showNoWaveSelectedMessage() {
        this.lastIntersections = [];
        this.lastSelectedWave = null;
        this.lastIntersectionPhaseInfo = null;
        const container = this.elements.intersectionResults;
        const stats = this.elements.intersectionStats;
        
        if (container) {
            container.innerHTML = `
                <div class="list-empty">
                    <div style="text-align: center; padding: 20px;">
                        <div style="font-size: 32px; margin-bottom: 10px;">🎯</div>
                        <div>Выберите сигнал для анализа пересечений</div>
                        <div style="font-size: 11px; color: #666; margin-top: 8px;">
                            Выберите сигнал в списке <strong>«Сигнал»</strong> выше или чекбокс <strong>«Окрасить края»</strong> в списке волн
                        </div>
                        <div style="font-size: 11px; color: #666; margin-top: 4px;">
                            Рекомендация: используйте один из сигналов из экспериментальной группы.
                        </div>
                    </div>
                </div>
            `;
        }
        
        if (stats) {
            stats.style.display = 'none';
            stats.innerHTML = '';
        }
        this.syncTimeRailOverlayButton();
    }
    
    /** Пустое состояние: пересечений нет. */
    showNoIntersectionsMessage(message) {
        const container = this.elements.intersectionResults;
        const stats = this.elements.intersectionStats;
        if (stats) {
            stats.style.display = 'none';
            stats.innerHTML = '';
        }
        
        if (container) {
            container.innerHTML = `
                <div class="list-empty">
                    <div style="text-align: center; padding: 20px;">
                        <div style="font-size: 32px; margin-bottom: 10px;">📊</div>
                        <div>${message || 'Нет пересечений'}</div>
                    </div>
                </div>
            `;
        }
        this.syncTimeRailOverlayButton();
    }
    
    /** Снимает выбор волны (corner color) и очищает результаты. */
    clearSelection() {
        if (!window.appState) return;
        
        let hasSelection = false;
        Object.keys(window.appState.waveCornerColor).forEach(waveId => {
            if (window.appState.waveCornerColor[waveId]) {
                hasSelection = true;
            }
            window.appState.waveCornerColor[waveId] = false;
        });
        
        if (hasSelection) {
            window.appState.save();
            
            if (window.unifiedListManager) {
                window.unifiedListManager.updateWavesList();
            }
            
            if (window.waves) {
                window.waves.updateCornerSquareColors();
            }
        }
        
        this.selectedWaveId = null;
        this.refreshIntersectionWaveSelectIfNeeded();
        this.showNoWaveSelectedMessage();
    }
    
    /** Форматирует Date для строки пересечения. */
    formatTime(date) {
        const hours = date.getHours().toString().padStart(2, '0');
        const minutes = date.getMinutes().toString().padStart(2, '0');
        const seconds = date.getSeconds().toString().padStart(2, '0');
        return `${hours}:${minutes}:${seconds}`;
    }
    
    /** Экранирование HTML в тексте для безопасной вставки. */
    escapeHtml(text) {
        if (!text) return '';
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
    
    /** Зеркалирование селектов и полный пересчёт пересечений. */
    refresh() {
        this.mirrorCompareSelectsToIntersection();
        this.updateIntersections();
    }
}

window.stateIntersectionManager = new StateIntersectionManager();