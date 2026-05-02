// modules/dateComparisonManager.js — сравнение волн для двух дат (записей из списка) в текущий момент на визоре
class DateComparisonManager {
    constructor() {
        this._updateRaf = null;
        this.cacheElements();
        this.init();
    }

    cacheElements() {
        this.elA = document.getElementById('dateCompareSelectA');
        this.elB = document.getElementById('dateCompareSelectB');
        this.elTableWrap = document.getElementById('dateCompareResults');
        this.elHint = document.getElementById('dateCompareVizorHint');
    }

    init() {
        if (this.elA) {
            this.elA.addEventListener('change', () => this._onSelectChange('a'));
        }
        if (this.elB) {
            this.elB.addEventListener('change', () => this._onSelectChange('b'));
        }
    }

    debouncedUpdate() {
        if (this._updateRaf != null) {
            cancelAnimationFrame(this._updateRaf);
        }
        this._updateRaf = requestAnimationFrame(() => {
            this._updateRaf = null;
            this.updateComparison();
        });
    }

    refresh() {
        this.populateSelects();
        this.updateComparison();
        if (window.unifiedListManager && window.unifiedListManager.updateDatesList) {
            window.unifiedListManager.updateDatesList();
        }
    }

    _onSelectChange(which) {
        this._resolveDuplicateSelection(which);
        this._applySelectsToDateSelections();
        if (window.unifiedListManager && window.unifiedListManager.updateDatesList) {
            window.unifiedListManager.updateDatesList();
        }
        this.updateComparison();
    }

    /**
     * Синхронизация с чекбоксами A/B в списке дат (общий источник — appState.dateSelections).
     */
    syncSelectsFromAppState() {
        this.populateSelects();
        this.updateComparison();
        if (window.unifiedListManager && window.unifiedListManager.updateDatesList) {
            window.unifiedListManager.updateDatesList();
        }
    }

    _applySelectsToDateSelections() {
        if (!window.appState.dateSelections) {
            window.appState.dateSelections = {
                typeA: null,
                typeB: null
            };
        }
        const a = this.elA && this.elA.value ? this.elA.value : null;
        const b = this.elB && this.elB.value ? this.elB.value : null;
        window.appState.dateSelections.typeA = a;
        window.appState.dateSelections.typeB = b;
        window.appState.save();
    }

    _resolveDuplicateSelection(changedWhich) {
        if (!this.elA || !this.elB) return;
        const dates = window.appState.data.dates || [];
        if (dates.length < 2) return;

        const idA = this.elA.value;
        const idB = this.elB.value;
        if (idA && idB && String(idA) === String(idB)) {
            const alt = dates.find((d) => String(d.id) !== String(idA));
            if (!alt) return;
            if (changedWhich === 'a') {
                this.elB.value = alt.id;
            } else {
                this.elA.value = alt.id;
            }
        }
    }

    populateSelects() {
        if (!this.elA || !this.elB) return;

        const dates = window.appState.data.dates || [];

        const fill = (sel) => {
            sel.innerHTML = '';
            const empty = document.createElement('option');
            empty.value = '';
            empty.textContent = '— выберите —';
            sel.appendChild(empty);
            dates.forEach((d) => {
                const opt = document.createElement('option');
                opt.value = d.id;
                const birth = window.timeUtils ? window.timeUtils.formatDate(d.date) : '';
                opt.textContent = (d.name || 'Без названия') + (birth ? ` · ${birth}` : '');
                sel.appendChild(opt);
            });
        };

        fill(this.elA);
        fill(this.elB);

        const ds = window.appState.dateSelections || { typeA: null, typeB: null };
        const setIfOption = (sel, id) => {
            const s = id != null && String(id) !== '' ? String(id) : '';
            if (s && [...sel.options].some((o) => o.value === s)) {
                sel.value = s;
            } else {
                sel.value = '';
            }
        };
        setIfOption(this.elA, ds.typeA);
        setIfOption(this.elB, ds.typeB);
        if (!this.elA.value && dates[0]) {
            this.elA.value = String(dates[0].id);
        }

        this._resolveDuplicateSelection('a');
        this._applySelectsToDateSelections();
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

        const idA = this.elA ? this.elA.value : '';
        const idB = this.elB ? this.elB.value : '';
        if (!idA || !idB || String(idA) === String(idB)) {
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
                pct
            });
        }

        rows.sort((a, b) => b.pct - a.pct);

        if (rows.length === 0) {
            this.elTableWrap.innerHTML = '<div class="summary-empty">Нет волн с положительным периодом.</div>';
            return;
        }

        const head = `
            <table class="date-comparison-table">
                <thead>
                    <tr>
                        <th>№</th>
                        <th>Сигнал</th>
                        <th>Сост. A</th>
                        <th>Сост. B</th>
                        <th>Совпадение</th>
                    </tr>
                </thead>
                <tbody>
        `;
        const body = rows
            .map((row, idx) => {
                const cls = this._matchClass(row.pct);
                const name = `${this._escapeHtml(row.wave.name || '')} <span class="date-comparison-period">(${row.wave.period} дн.)</span>`;
                return `<tr>
                    <td class="date-comparison-num">${idx + 1}</td>
                    <td class="date-comparison-name">
                        <span class="date-comparison-color" style="background-color:${row.wave.color || '#666'}"></span>
                        ${name}
                    </td>
                    <td>${row.stateA.toFixed(2)}</td>
                    <td>${row.stateB.toFixed(2)}</td>
                    <td><span class="intersection-result-closeness ${cls}">${row.pct.toFixed(1)}%</span></td>
                </tr>`;
            })
            .join('');
        const foot = '</tbody></table>';

        this.elTableWrap.innerHTML =
            `<p class="date-comparison-legend">100% — одинаковое состояние волны (кривые совпадают по фазе); ~0% — противоположные состояния (максимальный разброс).</p>` +
            head +
            body +
            foot;
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
