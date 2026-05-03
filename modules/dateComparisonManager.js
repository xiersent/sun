// modules/dateComparisonManager.js — сравнение волн для двух дат (записей из списка) в текущий момент на визоре

/** Значение <option> «дата B = как дата A»; в dateSelections.typeB сохраняется null. */
if (typeof window.SUN_DATE_B_SAME_AS_A === 'undefined') {
    window.SUN_DATE_B_SAME_AS_A = '__sun_same_as_a__';
}

class DateComparisonManager {
    constructor() {
        this._updateRaf = null;
        /** Кэш состава списка дат — чтобы не пересобирать option при каждом клике */
        this._cachedDateListSignature = null;
        /** Глубина программной записи в select — игнорировать всплывающие change (и каскад из _resolveDuplicateSelection) */
        this._progSelectDepth = 0;
        /** Вкладка отчёта: phaseMatch | phaseGap | quadrature */
        this._compareTabMode = 'phaseMatch';
        this.cacheElements();
        this.init();
    }

    _progSelectEnter() {
        this._progSelectDepth++;
    }

    _progSelectExit() {
        this._progSelectDepth = Math.max(0, this._progSelectDepth - 1);
    }

    _progSelectActive() {
        return this._progSelectDepth > 0;
    }

    /**
     * Сигнатура для пересборки option/optgroup: набор дат, порядок и состав групп, имена (как в списке слева).
     * Без expanded — сворачивание группы не трогает порядок в селекте.
     */
    _computeDateListSignature() {
        const dates = window.appState.data.dates || [];
        const pg = window.appState.data.personGroups || [];
        if (dates.length === 0 && pg.length === 0) {
            return '0';
        }
        let dpart = '';
        for (let i = 0; i < dates.length; i++) {
            const d = dates[i];
            dpart += `${String(d.id)}\t${String(d.name || '')}\t${d.date};`;
        }
        let s = `${dates.length}|${dpart}|g${pg.length}:`;
        for (let i = 0; i < pg.length; i++) {
            const g = pg[i];
            const ids = (g.dates || []).map(String).join(',');
            s += `${String(g.id)}\t${String(g.name || '')}\t${ids}|`;
        }
        return s;
    }

    invalidateDateListSignatureCache() {
        this._cachedDateListSignature = null;
    }

    _optionValueExists(sel, valueStr) {
        if (!valueStr) return true;
        const opts = sel.options;
        for (let i = 0; i < opts.length; i++) {
            if (opts[i].value === valueStr) return true;
        }
        return false;
    }

    /**
     * Перед перерисовкой списка дат: полная пересборка селектов только если изменился набор id.
     */
    ensureSelectsSyncedWithDateList() {
        if (!this.elA || !this.elB) {
            window.sunDateListLog && window.sunDateListLog('ensureSelects:skip no elA/elB');
            return;
        }
        const sig = this._computeDateListSignature();
        const sigChanged = sig !== this._cachedDateListSignature;
        window.sunDateListLog && window.sunDateListLog('ensureSelects', {
            sigChanged,
            sig,
            cached: this._cachedDateListSignature,
            dateSelections: { ...window.appState.dateSelections }
        });
        if (sigChanged) {
            this._cachedDateListSignature = sig;
            this.populateSelects();
        } else {
            this.applySelectValuesFromDateSelections();
        }
    }

    /**
     * Только выставить value у селектов из dateSelections (без innerHTML).
     */
    applySelectValuesFromDateSelections() {
        if (!this.elA || !this.elB) return;
        this._progSelectEnter();
        try {
        const ds = window.appState.dateSelections || { typeA: null, typeB: null };
        const dates = window.appState.data.dates || [];
        const str = (id) => (id != null && String(id) !== '' ? String(id) : '');
        const activeStr =
            window.appState.activeDateId != null && String(window.appState.activeDateId) !== ''
                ? String(window.appState.activeDateId)
                : '';
        let a = str(ds.typeA);
        if (activeStr) {
            a = activeStr;
        }
        let b = str(ds.typeB);
        window.sunDateListLog && window.sunDateListLog('applySelectValues:enter', { a, b, optCountA: this.elA.options.length });
        if ((a && !this._optionValueExists(this.elA, a)) || (b && !this._optionValueExists(this.elB, b))) {
            window.sunDateListLog &&
                window.sunDateListLog('applySelectValues:→ populateSelects (missing option)', {
                    a,
                    b,
                    existsA: a ? this._optionValueExists(this.elA, a) : true,
                    existsB: b ? this._optionValueExists(this.elB, b) : true
                });
            this._cachedDateListSignature = null;
            this.populateSelects();
            return;
        }
        this.elA.value = a || '';
        const sameVal = window.SUN_DATE_B_SAME_AS_A;
        const wantSameB = !b || (a && String(b) === String(a));
        if (wantSameB && this._optionValueExists(this.elB, sameVal)) {
            this.elB.value = sameVal;
        } else if (b && this._optionValueExists(this.elB, b)) {
            this.elB.value = b;
        } else if (this._optionValueExists(this.elB, sameVal)) {
            this.elB.value = sameVal;
        } else {
            this.elB.value = '';
        }
        if (a && String(this.elA.value) !== a) {
            window.sunDateListLog &&
                window.sunDateListLog('applySelectValues:→ populateSelects (elA mismatch)', {
                    a,
                    got: this.elA.value
                });
            this._cachedDateListSignature = null;
            this.populateSelects();
            return;
        }
        const expectedB =
            wantSameB && this._optionValueExists(this.elB, sameVal)
                ? sameVal
                : b && this._optionValueExists(this.elB, b)
                  ? b
                  : this._optionValueExists(this.elB, sameVal)
                    ? sameVal
                    : '';
        if (b && String(b) !== String(a) && String(this.elB.value) !== String(expectedB)) {
            window.sunDateListLog &&
                window.sunDateListLog('applySelectValues:→ populateSelects (elB mismatch)', {
                    b,
                    expectedB,
                    got: this.elB.value
                });
            this._cachedDateListSignature = null;
            this.populateSelects();
            return;
        }
        let needApply = false;
        if (!this.elA.value && dates[0]) {
            if (!a) {
                window.sunDateListLog &&
                    window.sunDateListLog('applySelectValues:default elA to first date', { firstId: dates[0].id });
                this.elA.value = String(dates[0].id);
                needApply = true;
            } else {
                window.sunDateListLog &&
                    window.sunDateListLog('applySelectValues:→ populateSelects (empty elA but a set)', { a });
                this._cachedDateListSignature = null;
                this.populateSelects();
                return;
            }
        }
        if (
            this.elA.value &&
            this.elB.value &&
            String(this.elA.value) === String(this.elB.value)
        ) {
            window.sunDateListLog && window.sunDateListLog('applySelectValues:resolve duplicate A/B');
            this._resolveDuplicateSelection('a');
            needApply = true;
        }
        if (needApply) {
            this._applySelectsToDateSelections();
        }
        window.sunDateListLog &&
            window.sunDateListLog('applySelectValues:done', {
                elA: this.elA.value,
                elB: this.elB.value,
                needApply
            });
        } finally {
            this._progSelectExit();
            if (
                window.stateIntersectionManager &&
                typeof window.stateIntersectionManager.mirrorCompareSelectsToIntersection === 'function'
            ) {
                window.stateIntersectionManager.mirrorCompareSelectsToIntersection();
            }
        }
    }

    cacheElements() {
        this.elA = document.getElementById('dateCompareSelectA');
        this.elB = document.getElementById('dateCompareSelectB');
        this.elTableWrap = document.getElementById('dateCompareResults');
        this.elHint = document.getElementById('dateCompareVizorHint');
        this.elViewTablist = document.querySelector('.date-comparison-view-tabs');
    }

    init() {
        if (this.elA) {
            this.elA.addEventListener('change', () => {
                if (this._progSelectActive()) {
                    return;
                }
                this._onSelectChange('a');
            });
        }
        if (this.elB) {
            this.elB.addEventListener('change', () => {
                if (this._progSelectActive()) {
                    return;
                }
                this._onSelectChange('b');
            });
        }
        if (this.elViewTablist) {
            this.elViewTablist.addEventListener('click', (e) => {
                const btn = e.target.closest('.date-comparison-view-tab');
                if (!btn || !this.elViewTablist.contains(btn)) return;
                const mode = btn.getAttribute('data-date-compare-view');
                if (!mode || mode === this._compareTabMode) return;
                this._compareTabMode = mode;
                const tabs = this.elViewTablist.querySelectorAll('.date-comparison-view-tab');
                for (let i = 0; i < tabs.length; i++) {
                    const t = tabs[i];
                    const on = t === btn;
                    t.classList.toggle('active', on);
                    t.setAttribute('aria-selected', on ? 'true' : 'false');
                }
                this.updateComparison();
            });
        }
    }

    debouncedUpdate() {
        if (this._updateRaf != null) {
            cancelAnimationFrame(this._updateRaf);
        }
        this._updateRaf = requestAnimationFrame(() => {
            this._updateRaf = null;
            this.updateComparison();
            // updatePosition уже вызывается из dates.setDate / navigateDay / setActiveDate и т.д.;
            // повтор на следующем кадре давал полную пересборку выносок и точек пересечений дважды.
        });
    }

    /** @deprecated используйте ensureSelectsSyncedWithDateList + updateComparison из dataManager */
    refresh() {
        this.ensureSelectsSyncedWithDateList();
        this.updateComparison();
        if (window.waves && typeof window.waves.updatePosition === 'function') {
            window.waves.updatePosition();
        }
    }

    _onSelectChange(which) {
        if (this._progSelectActive()) {
            return;
        }
        this._resolveDuplicateSelection(which);
        if (which === 'a' && this.elA && this.elA.value && window.dates) {
            if (this.elB && this.elB.value) {
                window.dates.ensurePersonGroupExpandedForDateId(this.elB.value);
            }
            window.dates.setActiveDate(this.elA.value, true);
            return;
        }
        if (which === 'b' && this.elB && this.elB.value && window.dates) {
            window.dates.ensurePersonGroupExpandedForDateId(this.elB.value);
        }
        this._applySelectsToDateSelections();
        if (window.dataManager && window.dataManager.updateDateList) {
            window.dataManager.updateDateList();
        } else {
            if (window.unifiedListManager && window.unifiedListManager.updateDatesList) {
                window.unifiedListManager.updateDatesList();
            }
            this.updateComparison();
        }
    }

    /**
     * Обновить только селекты и таблицу; список дат уже перерисован вызывающим кодом.
     */
    syncSelectsFromAppState() {
        this.applySelectValuesFromDateSelections();
        this.updateComparison();
        if (window.waves && typeof window.waves.updatePosition === 'function') {
            window.waves.updatePosition();
        }
    }

    _applySelectsToDateSelections() {
        if (!window.appState.dateSelections) {
            window.appState.dateSelections = {
                typeA: null,
                typeB: null
            };
        }
        const norm = (v) => (v != null && String(v) !== '' ? String(v) : null);
        const active = window.appState.activeDateId;
        let a =
            active != null && String(active) !== ''
                ? String(active)
                : this.elA && this.elA.value
                  ? this.elA.value
                  : null;
        let b = this.elB && this.elB.value ? this.elB.value : null;
        if (b === window.SUN_DATE_B_SAME_AS_A) {
            b = null;
        }
        let na = norm(a);
        let nb = norm(b);
        if (na && nb && na === nb) {
            const dates = window.appState.data.dates || [];
            const alt = dates.find((d) => String(d.id) !== na);
            this._progSelectEnter();
            try {
                if (alt) {
                    b = String(alt.id);
                    nb = norm(b);
                    if (this.elB && this._optionValueExists(this.elB, b)) {
                        this.elB.value = b;
                    }
                } else {
                    b = null;
                    nb = null;
                    if (this.elB) {
                        this.elB.value = '';
                    }
                }
            } finally {
                this._progSelectExit();
            }
        }
        if (this.elA && na && String(this.elA.value) !== na && this._optionValueExists(this.elA, na)) {
            this._progSelectEnter();
            try {
                this.elA.value = na;
            } finally {
                this._progSelectExit();
            }
        }
        const oa = norm(window.appState.dateSelections.typeA);
        const ob = norm(window.appState.dateSelections.typeB);
        if (na === oa && nb === ob) {
            if (
                window.stateIntersectionManager &&
                typeof window.stateIntersectionManager.mirrorCompareSelectsToIntersection === 'function'
            ) {
                window.stateIntersectionManager.mirrorCompareSelectsToIntersection();
            }
            return;
        }
        window.sunDateListLog &&
            window.sunDateListLog('_applySelectsToDateSelections:save', {
                from: { typeA: window.appState.dateSelections.typeA, typeB: window.appState.dateSelections.typeB },
                to: { a, b },
                norm: { na, nb, oa, ob },
                activeDateId: window.appState.activeDateId
            });
        window.appState.dateSelections.typeA = a;
        window.appState.dateSelections.typeB = b;
        window.appState.save();
        if (window.waves && typeof window.waves.updatePosition === 'function') {
            window.waves.updatePosition();
        }
        if (
            window.stateIntersectionManager &&
            typeof window.stateIntersectionManager.mirrorCompareSelectsToIntersection === 'function'
        ) {
            window.stateIntersectionManager.mirrorCompareSelectsToIntersection();
        }
        if (window.stateIntersectionManager && typeof window.stateIntersectionManager.updateIntersections === 'function') {
            window.stateIntersectionManager.updateIntersections();
        }
    }

    _resolveDuplicateSelection(changedWhich) {
        if (!this.elA || !this.elB) return;
        const dates = window.appState.data.dates || [];
        if (dates.length < 2) return;

        const idA = this.elA.value;
        const idB = this.elB.value;
        if (idB === window.SUN_DATE_B_SAME_AS_A) {
            return;
        }
        if (idA && idB && String(idA) === String(idB)) {
            const alt = dates.find((d) => String(d.id) !== String(idA));
            if (!alt) return;
            this._progSelectEnter();
            try {
                if (changedWhich === 'a') {
                    this.elB.value = alt.id;
                } else {
                    this.elA.value = alt.id;
                }
            } finally {
                this._progSelectExit();
            }
        }
    }

    /**
     * Порядок дат как в селектах сравнения: по группам персон, внутри группы — по списку g.dates.
     * Заголовки групп — native optgroup label (не выбираются, только подпись секции).
     */
    /**
     * @param {HTMLSelectElement} sel
     * @param {boolean} [isDateBSlot] true — первая опция «та же дата, что А» (для селекта даты B)
     */
    _fillCompareSelectOptions(sel, isDateBSlot) {
        sel.innerHTML = '';
        if (isDateBSlot) {
            const same = document.createElement('option');
            same.value = window.SUN_DATE_B_SAME_AS_A;
            same.textContent = 'Сравнение с той же датой';
            sel.appendChild(same);
        } else {
            const empty = document.createElement('option');
            empty.value = '';
            empty.textContent = '— выберите —';
            sel.appendChild(empty);
        }

        const allDates = window.appState.data.dates || [];
        const datesById = new Map();
        for (let i = 0; i < allDates.length; i++) {
            datesById.set(String(allDates[i].id), allDates[i]);
        }

        const appendOption = (d) => {
            const opt = document.createElement('option');
            opt.value = d.id;
            const birth = window.timeUtils ? window.timeUtils.formatDate(d.date) : '';
            opt.textContent = (d.name || 'Без названия') + (birth ? ` · ${birth}` : '');
            return opt;
        };

        const pg = window.appState.data.personGroups || [];
        if (pg.length === 0) {
            for (let i = 0; i < allDates.length; i++) {
                sel.appendChild(appendOption(allDates[i]));
            }
            return;
        }

        if (window.dates && typeof window.dates.ensurePersonGroupsShape === 'function') {
            window.dates.ensurePersonGroupsShape();
        }

        const assigned = new Set();
        for (let gi = 0; gi < pg.length; gi++) {
            const g = pg[gi];
            const groupDates = [];
            const ids = g.dates || [];
            for (let j = 0; j < ids.length; j++) {
                const d = datesById.get(String(ids[j]));
                if (d) {
                    groupDates.push(d);
                    assigned.add(String(d.id));
                }
            }
            if (groupDates.length === 0) {
                continue;
            }
            const og = document.createElement('optgroup');
            og.label = g.name || 'Группа';
            for (let k = 0; k < groupDates.length; k++) {
                og.appendChild(appendOption(groupDates[k]));
            }
            sel.appendChild(og);
        }

        const orphans = [];
        for (let i = 0; i < allDates.length; i++) {
            if (!assigned.has(String(allDates[i].id))) {
                orphans.push(allDates[i]);
            }
        }
        if (orphans.length > 0) {
            const og = document.createElement('optgroup');
            og.label = 'Прочие';
            for (let i = 0; i < orphans.length; i++) {
                og.appendChild(appendOption(orphans[i]));
            }
            sel.appendChild(og);
        }
    }

    /** Тот же состав option/optgroup, что у селектов «Дата A» / «Дата B» на вкладке сравнения. */
    fillCompareSelectOptions(sel, isDateBSlot) {
        this._fillCompareSelectOptions(sel, !!isDateBSlot);
    }

    _firstDateIdInCompareSelectOrder() {
        const allDates = window.appState.data.dates || [];
        if (allDates.length === 0) {
            return null;
        }
        const pg = window.appState.data.personGroups || [];
        if (pg.length === 0) {
            return allDates[0].id;
        }
        const datesById = new Map();
        for (let i = 0; i < allDates.length; i++) {
            datesById.set(String(allDates[i].id), allDates[i]);
        }
        for (let gi = 0; gi < pg.length; gi++) {
            const ids = pg[gi].dates || [];
            for (let j = 0; j < ids.length; j++) {
                const d = datesById.get(String(ids[j]));
                if (d) {
                    return d.id;
                }
            }
        }
        return allDates[0].id;
    }

    populateSelects() {
        if (!this.elA || !this.elB) return;
        this._progSelectEnter();
        try {
        this._fillCompareSelectOptions(this.elA, false);
        this._fillCompareSelectOptions(this.elB, true);

        const ds = window.appState.dateSelections || { typeA: null, typeB: null };
        const setIfOption = (sel, id) => {
            const s = id != null && String(id) !== '' ? String(id) : '';
            if (s && this._optionValueExists(sel, s)) {
                sel.value = s;
            } else {
                sel.value = '';
            }
        };
        const typeAUnsetInState =
            (ds.typeA == null || String(ds.typeA) === '') &&
            (window.appState.activeDateId == null || String(window.appState.activeDateId) === '');
        const typeAForEl =
            window.appState.activeDateId != null && String(window.appState.activeDateId) !== ''
                ? window.appState.activeDateId
                : ds.typeA;
        setIfOption(this.elA, typeAForEl);
        const sameAsA = window.SUN_DATE_B_SAME_AS_A;
        const aStrForB = typeAForEl != null && String(typeAForEl) !== '' ? String(typeAForEl) : '';
        const bStored = ds.typeB != null && String(ds.typeB) !== '' ? String(ds.typeB) : '';
        const useSameAsA =
            !bStored ||
            (aStrForB && bStored === aStrForB);
        if (useSameAsA && this._optionValueExists(this.elB, sameAsA)) {
            this.elB.value = sameAsA;
        } else if (bStored && this._optionValueExists(this.elB, bStored)) {
            this.elB.value = bStored;
        } else if (this._optionValueExists(this.elB, sameAsA)) {
            this.elB.value = sameAsA;
        }
        if (!this.elA.value && typeAUnsetInState) {
            const firstId = this._firstDateIdInCompareSelectOrder();
            if (firstId != null) {
                this.elA.value = String(firstId);
            }
        }

        this._resolveDuplicateSelection('a');
        this._applySelectsToDateSelections();
        this._cachedDateListSignature = this._computeDateListSignature();
        window.sunDateListLog &&
            window.sunDateListLog('populateSelects:done', {
                elA: this.elA.value,
                elB: this.elB.value,
                dateSelections: { ...window.appState.dateSelections }
            });
        } finally {
            this._progSelectExit();
        }
    }

    _matchPercent(stateA, stateB) {
        const diff = Math.abs(stateA - stateB);
        return 100 * (1 - diff / 10);
    }

    _matchClass(pct) {
        if (pct >= 99.5) return 'intersection-item-exact';
        if (pct >= 85) return 'intersection-item-very-close';
        if (pct >= 65) return 'intersection-item-close';
        if (pct >= 45) return 'intersection-item-fairly-close';
        if (pct >= 25) return 'intersection-item-nearby';
        return 'intersection-item-within-tolerance';
    }

    /**
     * Близость к «квадратуре»: |Δсостояния| ≈ 5 (середина между совпадением и противофазой на шкале −5…+5).
     */
    _quadraturePct(stateA, stateB) {
        const d = Math.abs(stateA - stateB);
        return Math.max(0, Math.min(100, 100 * (1 - Math.abs(d - 5) / 5)));
    }

    updateComparison() {
        if (!this.elTableWrap) return;

        const dates = window.appState.data.dates || [];
        const waves = window.appState.data.waves || [];

        if (this.elHint && window.timeUtils && window.appState.currentDate) {
            const dt = window.timeUtils.formatDateTime(window.appState.currentDate.getTime());
            this.elHint.textContent = `Момент на визоре: ${dt} (как у полосы дней на графике).`;
        }

        if (dates.length < 2) {
            this.elTableWrap.innerHTML =
                '<div class="summary-empty">Добавьте в список как минимум две даты, чтобы сравнить волны.</div>';
            return;
        }

        // Чекбоксы A/B в списке дат меняют dateSelections напрямую; селекты должны совпадать перед чтением id.
        if (this.elA && this.elB) {
            this.applySelectValuesFromDateSelections();
        }

        const idA = this.elA ? this.elA.value : '';
        const rawB = this.elB ? this.elB.value : '';
        const sameVal = window.SUN_DATE_B_SAME_AS_A;
        const idB = rawB === sameVal ? '' : rawB;
        if (!idA) {
            this.elTableWrap.innerHTML =
                '<div class="summary-empty">Выберите дату A в списке выше.</div>';
            return;
        }
        if (!idB) {
            this.elTableWrap.innerHTML =
                rawB === sameVal
                    ? '<div class="summary-empty">Для отчёта по двум датам выберите в «Дата B» другую персону. Режим «Сравнение с той же датой» используется на вкладке «Пересечения» (фазы всех сигналов от даты A).</div>'
                    : '<div class="summary-empty">Выберите две разные даты в списках выше.</div>';
            return;
        }
        if (String(idA) === String(idB)) {
            this.elTableWrap.innerHTML =
                '<div class="summary-empty">Выберите две разные даты в списках выше.</div>';
            return;
        }

        if (!window.waves || typeof window.waves.calculateWaveStateAtDay !== 'function') {
            this.elTableWrap.innerHTML = '<div class="summary-empty">Загрузка модулей…</div>';
            return;
        }

        const personA = dates.find((d) => String(d.id) === String(idA));
        const personB = dates.find((d) => String(d.id) === String(idB));
        if (!personA || !personB) {
            this.elTableWrap.innerHTML = '<div class="summary-empty">Не удалось найти выбранные даты.</div>';
            return;
        }

        const useExact =
            window.dates && typeof window.dates.lastRecalculateUsedExactTime === 'boolean'
                ? window.dates.lastRecalculateUsedExactTime
                : true;
        const vizor = window.appState.currentDate;
        const dayA = window.dates.computeDayOffsetFromBirth(personA.date, vizor, useExact);
        const dayB = window.dates.computeDayOffsetFromBirth(personB.date, vizor, useExact);

        const rows = [];
        for (let i = 0; i < waves.length; i++) {
            const wave = waves[i];
            if (!wave.period || wave.period <= 0) continue;
            const sA = window.waves.calculateWaveStateAtDay(wave, dayA);
            const sB = window.waves.calculateWaveStateAtDay(wave, dayB);
            const pct = this._matchPercent(sA, sB);
            rows.push({
                wave,
                stateA: sA,
                stateB: sB,
                pct,
                gapPct: 100 - pct,
                quadPct: this._quadraturePct(sA, sB)
            });
        }

        const mode = this._compareTabMode || 'phaseMatch';
        if (mode === 'phaseGap') {
            rows.sort((a, b) => b.gapPct - a.gapPct);
        } else if (mode === 'quadrature') {
            rows.sort((a, b) => b.quadPct - a.quadPct);
        } else {
            rows.sort((a, b) => b.pct - a.pct);
        }

        if (rows.length === 0) {
            this.elTableWrap.innerHTML = '<div class="summary-empty">Нет волн с положительным периодом.</div>';
            return;
        }

        const metricHeader =
            mode === 'phaseGap'
                ? 'Разность фаз, %'
                : mode === 'quadrature'
                  ? 'Квадратура, %'
                  : 'Совпадение, %';

        /* Кнопка «Показать A и B» — на всех видах таблицы этой вкладки (как в «Состояниях» / «Пересечениях»). */
        const showBothLayersBtnCol = true;

        const head = `
            <table class="date-comparison-table">
                <thead>
                    <tr>
                        <th>№</th>
                        <th>Сигнал</th>
                        <th>Сост. A</th>
                        <th>Сост. B</th>
                        <th>${metricHeader}</th>
                        ${showBothLayersBtnCol ? '<th class="date-comparison-actions">График</th>' : ''}
                    </tr>
                </thead>
                <tbody>
        `;
        const body = rows
            .map((row, idx) => {
                let metricPct;
                let cls;
                if (mode === 'phaseGap') {
                    metricPct = row.gapPct;
                    cls = this._matchClass(row.gapPct);
                } else if (mode === 'quadrature') {
                    metricPct = row.quadPct;
                    cls = this._matchClass(row.quadPct);
                } else {
                    metricPct = row.pct;
                    cls = this._matchClass(row.pct);
                }
                const name = `${this._escapeHtml(row.wave.name || '')} <span class="date-comparison-period">(${row.wave.period} дн.)</span>`;
                const vizorLabel =
                    window.dom && typeof window.dom.getDateCompareVizorToggleLabel === 'function'
                        ? window.dom.getDateCompareVizorToggleLabel(row.wave.id)
                        : 'Показать A и B';
                const vizorCell = showBothLayersBtnCol
                    ? `<td class="date-comparison-actions"><button type="button" class="ui-btn show-on-vizor-btn date-compare-vizor-btn" data-wave-id="${row.wave.id}">${this._escapeHtml(vizorLabel)}</button></td>`
                    : '';
                return `<tr>
                    <td class="date-comparison-num">${idx + 1}</td>
                    <td class="date-comparison-name">
                        <span class="date-comparison-color" style="background-color:${row.wave.color || '#666'}"></span>
                        ${name}
                    </td>
                    <td>${row.stateA.toFixed(2)}</td>
                    <td>${row.stateB.toFixed(2)}</td>
                    <td><span class="intersection-result-closeness ${cls}">${metricPct.toFixed(1)}%</span></td>
                    ${vizorCell}
                </tr>`;
            })
            .join('');
        const foot = '</tbody></table>';

        this.elTableWrap.innerHTML = head + body + foot;
    }

    _escapeHtml(s) {
        return String(s)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;');
    }
}

window.dateComparisonManager = new DateComparisonManager();
