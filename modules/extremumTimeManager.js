/**
 * @file extremumTimeManager.js
 * Маркеры прохождения состояний ±5 на временной шкале по видимым волнам
 * и полосы встречных пересечений A×B / B×A (↑↓ в 0…−5, ↓↑ в 0…+5).
 */
class ExtremumTimeManager {
    constructor() {
        this.markers = [];
        this.labels = [];
        this.groupTolerance = 1 * 60 * 1000;
        this._visibilityRefreshQueued = false;
    }

    /** Ждёт #timeBarStateStack и запускает расчёт экстремумов. */
    init() {
        const stack = window.dom.byKey('timeBarStateStack');
        if (!stack) {
            requestAnimationFrame(() => this.init());
            return;
        }
        this.installWaveVisibilityObserver();
        this.updateExtremums();
        this.setupDateChangeObserver();
    }

    /**
     * Доли цикла [0,1), в которых 5·sin(2πf) = k (целое −5…5).
     */
    _cycleFractionsForState(k) {
        if (k === 5) return [0.25];
        if (k === -5) return [0.75];
        if (k === 0) return [0, 0.5];
        const s = k / 5;
        const a = Math.asin(s) / (2 * Math.PI);
        const b = (Math.PI - Math.asin(s)) / (2 * Math.PI);
        return [a, b];
    }

    /** Учитывается ли волна с учётом фильтра timeBarManager. */
    _isWaveRelevant(wave) {
        if (window.timeBarManager && typeof window.timeBarManager.isTimeBarGroupVisibleForWave === 'function') {
            return window.timeBarManager.isTimeBarGroupVisibleForWave(wave.id);
        }
        return true;
    }

    /** Волна для полос пересечений A×B / B×A (отдельный фильтр групп). */
    _isWaveRelevantForIntersection(wave) {
        if (
            window.timeBarManager &&
            typeof window.timeBarManager.isIntersectionGroupVisibleForWave === 'function'
        ) {
            return window.timeBarManager.isIntersectionGroupVisibleForWave(wave.id);
        }
        return this._isWaveRelevant(wave);
    }

    /** Волна для множественной полосы пересечений. */
    _isWaveRelevantForMultiIntersection(wave) {
        if (
            window.timeBarManager &&
            typeof window.timeBarManager.isMultiIntersectionGroupVisibleForWave === 'function'
        ) {
            return window.timeBarManager.isMultiIntersectionGroupVisibleForWave(wave.id);
        }
        return this._isWaveRelevantForIntersection(wave);
    }

    /** Midnight birth ms for person date id. */
    _getBirthMsForDateId(dateId) {
        if (dateId == null || String(dateId) === '') return null;
        if (
            window.stateIntersectionManager &&
            typeof window.stateIntersectionManager._getBirthStartMsForDateId === 'function'
        ) {
            const ms = window.stateIntersectionManager._getBirthStartMsForDateId(dateId);
            if (ms != null) return ms;
        }
        const person = ((window.appState.data && window.appState.data.dates) || []).find(
            (d) => String(d.id) === String(dateId)
        );
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

    /**
     * Доли суток от полуночи [0,1), когда доля цикла = targetF.
     * fract(p0 + d/P) = targetF  ⇒  d = P·(m + targetF − p0), d ∈ [0,1).
     */
    _dayFractionsForCycleTarget(p0, periodDays, targetF) {
        const hits = [];
        const p = periodDays;
        const from = -Math.ceil(p) - 3;
        const to = Math.ceil(p) + 3;
        for (let m = from; m <= to; m++) {
            const d = p * (m + targetF - p0);
            if (d >= 0 && d < 1 - 1e-12) {
                hits.push(d);
            }
        }
        return hits;
    }

    /** События состояний ±5 всех волн за сутки. */
    calculateStateEventsForDay(date) {
        if (!window.appState?.data?.waves) return [];

        const dayStart = new Date(date);
        dayStart.setHours(0, 0, 0, 0);
        const dayEnd = new Date(date);
        dayEnd.setHours(23, 59, 59, 999);

        const baseDate =
            window.appState.baseDate instanceof Date
                ? window.appState.baseDate
                : new Date(window.appState.baseDate);

        const events = [];

        const birthDayIndex = window.timeUtils
            ? window.timeUtils.getDaysBetween(baseDate, dayStart)
            : 0;

        window.appState.data.waves.forEach((wave) => {
            if (!wave.period || wave.period <= 0) return;
            if (!this._isWaveRelevant(wave)) return;
            if (!window.waves || typeof window.waves.findStateHitTimestampsOnBirthDay !== 'function') {
                return;
            }

            for (let k = 5; k >= -5; k--) {
                const hitMsList = window.waves.findStateHitTimestampsOnBirthDay(
                    wave,
                    birthDayIndex,
                    k,
                    null
                );
                for (let hi = 0; hi < hitMsList.length; hi++) {
                    const t = new Date(hitMsList[hi]);
                    if (t >= dayStart && t <= dayEnd) {
                        events.push({
                            time: t,
                            wave,
                            state: k,
                            color: wave.color || '#666666'
                        });
                    }
                }
            }
        });

        return events.sort((a, b) => a.time.getTime() - b.time.getTime());
    }

    /** Группировка событий по уровню состояния. */
    groupEventsByState(events) {
        /** @type {Map<number, Array<{ time: Date, waves: unknown[], colors: string[] }>>} */
        const byState = new Map();
        for (let k = 5; k >= -5; k--) {
            byState.set(k, []);
        }
        for (const e of events) {
            const list = byState.get(e.state);
            if (list) list.push(e);
        }
        const grouped = new Map();
        for (const [state, list] of byState) {
            if (list.length === 0) {
                grouped.set(state, []);
                continue;
            }
            list.sort((a, b) => a.time.getTime() - b.time.getTime());
            grouped.set(state, this._groupByTimeThreshold(list));
        }
        return grouped;
    }

    /** Слияние близких по времени событий одного state. */
    _groupByTimeThreshold(extremums) {
        if (extremums.length === 0) return [];
        const groups = [];
        let currentGroup = {
            time: extremums[0].time,
            waves: [extremums[0].wave],
            colors: [extremums[0].color],
            state: extremums[0].state
        };
        for (let i = 1; i < extremums.length; i++) {
            const cur = extremums[i];
            const timeDiff = Math.abs(cur.time.getTime() - currentGroup.time.getTime());
            if (timeDiff <= this.groupTolerance) {
                currentGroup.waves.push(cur.wave);
                currentGroup.colors.push(cur.color);
            } else {
                groups.push({ ...currentGroup });
                currentGroup = {
                    time: cur.time,
                    waves: [cur.wave],
                    colors: [cur.color],
                    state: cur.state
                };
            }
        }
        groups.push(currentGroup);
        return groups;
    }

    /** Внутренний метод getTrackForState. */
    _getTrackForState(state, stackEl) {
        const root = stackEl || document;
        return root.querySelector(`.sun-timeBarStateTrack[data-state="${state}"]`);
    }

    /** Внутренний метод isRowHidden. */
    _isRowHidden(state, stackEl) {
        const root = stackEl || document;
        const row = root.querySelector(`.sun-timeBarStateRow[data-state="${state}"]`);
        return !!(row && row.classList.contains('sun-timeBarStateRowHidden'));
    }

    /** Остаток по модулю периода (дней), всегда в [0, period). */
    _modPositiveDays(days, period) {
        let m = days % period;
        if (m < 0) m += period;
        return m;
    }

    /**
     * Опоры фаз A/B для полосы пересечений (как на вкладке «Пересечения»).
     * @returns {{ baseMsA: number, baseMsB: number, samePerson: boolean }|null}
     */
    _getPersonPhaseBases() {
        if (
            window.stateIntersectionManager &&
            typeof window.stateIntersectionManager._getIntersectionPhaseBases === 'function'
        ) {
            const bases = window.stateIntersectionManager._getIntersectionPhaseBases();
            if (bases && bases.baseMsA != null && bases.baseMsB != null) {
                return {
                    baseMsA: bases.baseMsA,
                    baseMsB: bases.baseMsB,
                    samePerson: !!bases.samePerson
                };
            }
        }

        const ds = (window.appState && window.appState.dateSelections) || { typeA: null, typeB: null };
        const active = window.appState && window.appState.activeDateId;
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

        const birthMsForId = (dateId) => {
            if (dateId == null || String(dateId) === '') return null;
            const person = ((window.appState.data && window.appState.data.dates) || []).find(
                (d) => String(d.id) === String(dateId)
            );
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
        };

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
        const baseMsA = birthMsForId(idA) ?? fallbackMs;
        const baseMsB = birthMsForId(idB) ?? baseMsA;
        return {
            baseMsA,
            baseMsB,
            samePerson: String(idA) === String(idB)
        };
    }

    /**
     * Угол фазы волны в момент timeMs от даты рождения (радианы).
     * value = sin(angle), знак производной = знак cos(angle).
     */
    _getWaveAngleAtTime(wave, timeMs, birthStartMs) {
        const msPerDay = 24 * 60 * 60 * 1000;
        const daysFromBase = (timeMs - birthStartMs) / msPerDay;
        const phase = this._modPositiveDays(daysFromBase, wave.period) / wave.period;
        return phase * 2 * Math.PI;
    }

    /**
     * Тип встречного пересечения для полосы:
     * — 'upDown': первый↑ второй↓, состояние в [−5…0];
     * — 'downUp': первый↓ второй↑, состояние в [0…+5];
     * — null: не подходит.
     * @returns {'upDown'|'downUp'|null}
     */
    _getOpposedCrossingKind(waveFirst, waveSecond, timeMs, value, baseMsFirst, baseMsSecond) {
        if (!waveFirst || !waveSecond || !Number.isFinite(value)) return null;
        const angleFirst = this._getWaveAngleAtTime(waveFirst, timeMs, baseMsFirst);
        const angleSecond = this._getWaveAngleAtTime(waveSecond, timeMs, baseMsSecond);
        const dFirst = Math.cos(angleFirst);
        const dSecond = Math.cos(angleSecond);
        const state = value * 5;
        const eps = 1e-10;

        if (dFirst > eps && dSecond < -eps && state <= 0 + 1e-9 && state >= -5 - 1e-9) {
            return 'upDown';
        }
        if (dFirst < -eps && dSecond > eps && state >= 0 - 1e-9 && state <= 5 + 1e-9) {
            return 'downUp';
        }
        return null;
    }

    /** @deprecated см. _getOpposedCrossingKind */
    _isOpposedAbCrossingForStrip(waveA, waveB, timeMs, value, baseMsA, baseMsB) {
        return this._getOpposedCrossingKind(waveA, waveB, timeMs, value, baseMsA, baseMsB) != null;
    }

    /**
     * Пересечения фаз за сутки (как «Пересечения» / «Шкала времени»),
     * отфильтрованные до встречных движений.
     * @param {Date} date
     * @param {'ab'|'ba'} [orientation='ab'] ab: первый сигнал — фаза A; ba — фаза B.
     * @param {{ baseMsA: number, baseMsB: number, samePerson?: boolean }|null} [basesOverride]
     * @param {{ waveFilter?: (wave: object) => boolean }} [options]
     */
    calculateABIntersectionEventsForDay(date, orientation = 'ab', basesOverride = null, options = null) {
        if (!window.appState?.data?.waves) return [];

        const bases = basesOverride || this._getPersonPhaseBases();
        if (!bases || bases.samePerson) return [];
        if (bases.baseMsA == null || bases.baseMsB == null) return [];

        const waveFilter =
            options && typeof options.waveFilter === 'function'
                ? options.waveFilter
                : (wave) => this._isWaveRelevantForIntersection(wave);

        const waves = window.appState.data.waves.filter(
            (wave) => wave.period && wave.period > 0 && waveFilter(wave)
        );
        if (waves.length < 2) return [];

        const sim = window.stateIntersectionManager;
        if (!sim || typeof sim.findIntersectionsWithSelectedWave !== 'function') {
            return [];
        }

        const isBA = orientation === 'ba';
        const baseFirst = isBA ? bases.baseMsB : bases.baseMsA;
        const baseSecond = isBA ? bases.baseMsA : bases.baseMsB;

        const events = [];
        for (let i = 0; i < waves.length; i++) {
            const list = sim.findIntersectionsWithSelectedWave(
                waves[i],
                waves,
                date,
                baseFirst,
                baseSecond
            );
            for (let j = 0; j < list.length; j++) {
                const inter = list[j];
                const crossingKind = this._getOpposedCrossingKind(
                    inter.wave1,
                    inter.wave2,
                    inter.time.getTime(),
                    inter.value,
                    baseFirst,
                    baseSecond
                );
                if (!crossingKind) {
                    continue;
                }
                /* waveA / waveB — всегда слои персон A и B (для подписей и клика). */
                const waveA = isBA ? inter.wave2 : inter.wave1;
                const waveB = isBA ? inter.wave1 : inter.wave2;
                events.push({
                    time: inter.time,
                    wave: waveA,
                    waveB,
                    waveA,
                    value: inter.value,
                    color: (waveA && waveA.color) || '#666666',
                    colorB: (waveB && waveB.color) || '#666666',
                    orientation: isBA ? 'ba' : 'ab',
                    crossingKind
                });
            }
        }

        const unique = [];
        for (const inter of events) {
            let isDuplicate = false;
            for (const existing of unique) {
                if (
                    Math.abs(existing.time.getTime() - inter.time.getTime()) < 1000 &&
                    String(existing.waveA.id) === String(inter.waveA.id) &&
                    String(existing.waveB.id) === String(inter.waveB.id) &&
                    existing.crossingKind === inter.crossingKind
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

    /**
     * Группировка пересечений по времени (одна горизонтальная полоса).
     * @returns {Array<{ time: Date, pairs: Array<{ waveA: object, waveB: object, colorA: string, colorB: string, crossingKind: 'upDown'|'downUp' }>, orientation: 'ab'|'ba' }>}
     */
    groupABIntersectionEventsByTime(events, orientation = 'ab') {
        if (!events || events.length === 0) return [];
        const sorted = events.slice().sort((a, b) => a.time.getTime() - b.time.getTime());
        const toPair = (e) => ({
            waveA: e.waveA || e.wave,
            waveB: e.waveB,
            colorA: e.color,
            colorB: e.colorB,
            crossingKind: e.crossingKind === 'downUp' ? 'downUp' : 'upDown'
        });
        const groups = [];
        let current = {
            time: sorted[0].time,
            orientation,
            pairs: [toPair(sorted[0])]
        };
        const pairKey = (p) => `${p.waveA.id}|${p.waveB.id}|${p.crossingKind}`;
        for (let i = 1; i < sorted.length; i++) {
            const cur = sorted[i];
            const timeDiff = Math.abs(cur.time.getTime() - current.time.getTime());
            const pair = toPair(cur);
            if (timeDiff <= this.groupTolerance) {
                const key = pairKey(pair);
                if (!current.pairs.some((p) => pairKey(p) === key)) {
                    current.pairs.push(pair);
                }
            } else {
                groups.push(current);
                current = { time: cur.time, orientation, pairs: [pair] };
            }
        }
        groups.push(current);
        return groups;
    }

    /** Подпись волны для выноски (период или имя). */
    _waveSegmentLabelText(wave, labelMode) {
        if (labelMode === 'name') {
            return wave && wave.name != null && String(wave.name) !== '' ? String(wave.name) : '—';
        }
        return this._formatWavePeriodLabel(wave);
    }

    /**
     * Сегмент пересечения в одном slot.
     * ab: подпись «A × B»; ba: «B × A».
     * @param {'ab'|'ba'} [orientation='ab']
     * @param {{ interactive?: boolean, labelMode?: string }} [options]
     */
    _buildABIntersectionSegmentElement(group, frac, orientation = 'ab', options = null) {
        const opts = options && typeof options === 'object' ? options : {};
        const interactive = opts.interactive !== false;
        const labelMode =
            opts.labelMode ||
            (window.timeBarManager &&
            typeof window.timeBarManager.getIntersectionSegmentLabelMode === 'function'
                ? window.timeBarManager.getIntersectionSegmentLabelMode()
                : window.timeBarManager && typeof window.timeBarManager.getSegmentLabelMode === 'function'
                  ? window.timeBarManager.getSegmentLabelMode()
                  : 'period');
        const isBA = orientation === 'ba' || group.orientation === 'ba';

        const labelsHtml = (group.pairs || [])
            .map((pair) => {
                const bothOn =
                    interactive &&
                    this._isWaveVisibilityChecked(pair.waveA.id) &&
                    this._isWaveBoldChecked(pair.waveB.id);
                const pairCls = interactive
                    ? bothOn
                        ? 'sun-timeBarIntersectionPair sun-timeBarIntersectionPairOnVizor'
                        : 'sun-timeBarIntersectionPair'
                    : 'sun-timeBarIntersectionPair sun-timeBarIntersectionPairReadonly';
                const checkedA = interactive && this._isWaveVisibilityChecked(pair.waveA.id);
                const checkedB = interactive && this._isWaveBoldChecked(pair.waveB.id);
                const clsA = checkedA
                    ? 'sun-extremumWaveName sun-extremumWaveNameInSegment sun-extremumWaveNameOnVizor'
                    : 'sun-extremumWaveName sun-extremumWaveNameInSegment';
                const clsB = checkedB
                    ? 'sun-extremumWaveName sun-extremumWaveNameInSegment sun-extremumWaveNameOnVizor'
                    : 'sun-extremumWaveName sun-extremumWaveNameInSegment';
                const labelA = this._waveSegmentLabelText(pair.waveA, labelMode);
                const labelB = this._waveSegmentLabelText(pair.waveB, labelMode);
                const left = isBA
                    ? `<span class="${clsB}" data-wave-id="${pair.waveB.id}" data-person="b">${labelB}</span>`
                    : `<span class="${clsA}" data-wave-id="${pair.waveA.id}" data-person="a">${labelA}</span>`;
                const right = isBA
                    ? `<span class="${clsA}" data-wave-id="${pair.waveA.id}" data-person="a">${labelA}</span>`
                    : `<span class="${clsB}" data-wave-id="${pair.waveB.id}" data-person="b">${labelB}</span>`;
                const sepSrc =
                    pair.crossingKind === 'downUp'
                        ? 'images/intersection-sep-down-up.png'
                        : 'images/intersection-sep-up-down.png';
                const sep = `<img class="sun-timeBarIntersectionPairSep" src="${sepSrc}" alt="×" decoding="async" draggable="false">`;
                return (
                    `<span class="${pairCls}" data-wave-a="${pair.waveA.id}" data-wave-b="${pair.waveB.id}" data-crossing-kind="${pair.crossingKind || 'upDown'}">` +
                    left +
                    ` ${sep} ` +
                    right +
                    `</span>`
                );
            })
            .join(', ');

        const slot = document.createElement('div');
        slot.className = 'sun-timeBarSegmentSlot';
        slot.style.left = `${Math.max(0, Math.min(100, frac * 100))}%`;

        const seg = document.createElement('div');
        seg.className = 'sun-timeBarSegment';

        const label = document.createElement('div');
        label.className = 'sun-extremumLabel sun-extremumLabelTop sun-timeBarSegmentLabel';

        const labelText = document.createElement('div');
        labelText.className = 'sun-extremumLabelText sun-extremumLabelTextInSegment';
        labelText.innerHTML = labelsHtml;

        const arrowTop = document.createElement('div');
        arrowTop.className =
            'sun-extremumLabelArrow sun-extremumLabelArrowTop sun-extremumLabelArrowInSegment sun-extremumLabelArrowTopInSegment';

        const arrowBottom = document.createElement('div');
        arrowBottom.className =
            'sun-extremumLabelArrow sun-extremumLabelArrowBottom sun-extremumLabelArrowInSegment sun-extremumLabelArrowBottomInSegment';

        label.appendChild(arrowTop);
        label.appendChild(labelText);
        label.appendChild(arrowBottom);
        seg.appendChild(label);
        slot.appendChild(seg);

        if (interactive) {
            queueMicrotask(() => {
                labelText.querySelectorAll('.sun-timeBarIntersectionPair').forEach((pairEl) => {
                    pairEl.addEventListener('click', (ev) => {
                        ev.preventDefault();
                        ev.stopPropagation();
                        const idA = pairEl.dataset.waveA;
                        const idB = pairEl.dataset.waveB;
                        if (idA && idB) {
                            this._toggleIntersectionPairLayers(idA, idB);
                        }
                    });
                });
            });
        }

        return slot;
    }

    /** Отрисовка пересечений на горизонтальной полосе A×B или B×A. */
    renderABIntersectionMarkers(groups, trackEl, orientation = 'ab', options = null) {
        const track =
            trackEl ||
            window.dom.byKey(orientation === 'ba' ? 'timeBarIntersectionTrackBA' : 'timeBarIntersectionTrack');
        if (!track) return;
        const dayMs = 24 * 60 * 60 * 1000;
        const list = (groups || []).slice().sort((a, b) => a.time.getTime() - b.time.getTime());
        for (let i = 0; i < list.length; i++) {
            const group = list[i];
            const frac = this._dayFractionForTime(group.time, dayMs);
            const slot = this._buildABIntersectionSegmentElement(group, frac, orientation, options);
            slot.style.zIndex = String(9 + (list.length - 1 - i));
            track.appendChild(slot);
            this.markers.push(slot);
        }
    }

    /** Внутренний метод dayFractionForTime. */
    _dayFractionForTime(time, dayMs) {
        const dayStart = new Date(time);
        dayStart.setHours(0, 0, 0, 0);
        return Math.max(0, Math.min(1, (time.getTime() - dayStart.getTime()) / dayMs));
    }

    /** Подчёркивание: слой A из appState.waveVisibility (источник правды для чекбокса). */
    _isWaveVisibilityChecked(waveId) {
        if (!window.appState || !window.appState.waveVisibility) {
            return false;
        }
        return window.appState.waveVisibility[String(waveId)] !== false;
    }

    /** Подчёркивание слоя B: appState.waveBold (чекбокс .sun-waveBVisibilityCheck). */
    _isWaveBoldChecked(waveId) {
        if (!window.appState || !window.appState.waveBold) {
            return false;
        }
        return window.appState.waveBold[String(waveId)] === true;
    }

    /**
     * Клик по плашке пересечения: одновременно вкл/выкл слой A и слой B пары.
     * Если оба включены — выключает оба; иначе включает оба.
     */
    _toggleIntersectionPairLayers(waveAId, waveBId) {
        const idA = String(waveAId);
        const idB = String(waveBId);
        if (!idA || !idB) return;

        const bothOn = this._isWaveVisibilityChecked(idA) && this._isWaveBoldChecked(idB);
        const wantOn = !bothOn;
        const $empty = window.jQuery ? window.jQuery() : null;

        if (window.eventManager) {
            if (typeof window.eventManager.handleWaveVisibilityChange === 'function') {
                window.eventManager.handleWaveVisibilityChange(idA, wantOn, $empty || undefined);
            } else if (window.appState) {
                window.appState.waveVisibility[idA] = wantOn;
            }
            if (typeof window.eventManager.handleWavePersonBVisibilityChange === 'function') {
                window.eventManager.handleWavePersonBVisibilityChange(idB, wantOn, $empty || undefined);
            } else if (window.appState) {
                window.appState.waveBold[idB] = wantOn;
            }
        } else if (window.appState) {
            window.appState.waveVisibility[idA] = wantOn;
            window.appState.waveBold[idB] = wantOn;
            if (window.appState.saveDebounced) {
                window.appState.saveDebounced();
            }
            if (window.waves && window.waves.updatePosition) {
                window.waves.updatePosition({ forceWaveLabels: true });
            }
        }

        document.querySelectorAll(`.sun-waveVisibilityCheck[data-id="${idA}"]`).forEach((el) => {
            el.checked = wantOn;
        });
        document.querySelectorAll(`.sun-waveBVisibilityCheck[data-id="${idB}"]`).forEach((el) => {
            el.checked = wantOn;
        });
    }

    /** Внутренний метод scheduleVisibilityRefresh. */
    _scheduleVisibilityRefresh() {
        if (this._visibilityRefreshQueued) {
            return;
        }
        this._visibilityRefreshQueued = true;
        queueMicrotask(() => {
            this._visibilityRefreshQueued = false;
            this.updateExtremums();
        });
    }

    /** Любое изменение waveVisibility → перерисовка выносок на time-bar. */
    installWaveVisibilityObserver() {
        if (!window.appState) {
            return;
        }
        const raw = window.appState.waveVisibility;
        if (!raw || typeof raw !== 'object') {
            return;
        }
        if (raw.__isWaveVisibilityProxy) {
            return;
        }

        const mgr = this;
        const proxy = new Proxy(raw, {
            set(target, prop, value) {
                const prev = target[prop];
                const ok = Reflect.set(target, prop, value);
                if (prev !== value) {
                    mgr._scheduleVisibilityRefresh();
                }
                return ok;
            },
            deleteProperty(target, prop) {
                const had = Object.prototype.hasOwnProperty.call(target, prop);
                const ok = Reflect.deleteProperty(target, prop);
                if (had) {
                    mgr._scheduleVisibilityRefresh();
                }
                return ok;
            }
        });
        Object.defineProperty(proxy, '__isWaveVisibilityProxy', { value: true, enumerable: false });
        Object.defineProperty(proxy, '__waveVisibilityTarget', { value: raw, enumerable: false });
        window.appState.waveVisibility = proxy;
    }

    /** Подпись периода волны для выносок timeBar. */
    _formatWavePeriodLabel(wave) {
        const period = Number(wave.period);
        if (!Number.isFinite(period) || period <= 0) {
            return '—';
        }
        const text = Number.isInteger(period) ? String(period) : String(Math.round(period * 10) / 10);
        return text;
    }

    /** Внутренний метод buildSegmentElement. */
    _buildSegmentElement(group, frac) {
        const labelMode = (window.timeBarManager && typeof window.timeBarManager.getSegmentLabelMode === 'function')
            ? window.timeBarManager.getSegmentLabelMode()
            : 'period';

        let wavesForLabels;
        if (labelMode === 'name') {
            wavesForLabels = group.waves;
        } else {
            const waveByPeriod = new Map();
            group.waves.forEach((wave) => {
                const periodKey = String(wave.period);
                if (!waveByPeriod.has(periodKey)) {
                    waveByPeriod.set(periodKey, wave);
                }
            });
            wavesForLabels = Array.from(waveByPeriod.values());
        }

        const labelsHtml = wavesForLabels
            .map((wave) => {
                const checked = this._isWaveVisibilityChecked(wave.id);
                const cls = checked
                    ? 'sun-extremumWaveName sun-extremumWaveNameInSegment sun-extremumWaveNameOnVizor'
                    : 'sun-extremumWaveName sun-extremumWaveNameInSegment';
                const label = labelMode === 'name'
                    ? (wave.name || '—')
                    : this._formatWavePeriodLabel(wave);
                return `<span class="${cls}" data-wave-id="${wave.id}">${label}</span>`;
            })
            .join(', ');

        const slot = document.createElement('div');
        slot.className = 'sun-timeBarSegmentSlot';
        slot.style.left = `${Math.max(0, Math.min(100, frac * 100))}%`;

        const seg = document.createElement('div');
        seg.className = 'sun-timeBarSegment';

        const label = document.createElement('div');
        label.className = 'sun-extremumLabel sun-extremumLabelTop sun-timeBarSegmentLabel';

        const labelText = document.createElement('div');
        labelText.className = 'sun-extremumLabelText sun-extremumLabelTextInSegment';
        labelText.innerHTML = labelsHtml;

        const arrowTop = document.createElement('div');
        arrowTop.className = 'sun-extremumLabelArrow sun-extremumLabelArrowTop sun-extremumLabelArrowInSegment sun-extremumLabelArrowTopInSegment';

        const arrowBottom = document.createElement('div');
        arrowBottom.className = 'sun-extremumLabelArrow sun-extremumLabelArrowBottom sun-extremumLabelArrowInSegment sun-extremumLabelArrowBottomInSegment';

        label.appendChild(arrowTop);
        label.appendChild(labelText);
        label.appendChild(arrowBottom);
        seg.appendChild(label);
        slot.appendChild(seg);

        queueMicrotask(() => {
            labelText.querySelectorAll('.sun-extremumWaveName').forEach((span) => {
                span.addEventListener('click', (ev) => {
                    ev.preventDefault();
                    ev.stopPropagation();
                    const waveId = span.dataset.waveId;
                    if (waveId) {
                        const checkbox = document.querySelector(`.sun-waveVisibilityCheck[data-id="${waveId}"]`);
                        if (checkbox) checkbox.click();
                    }
                });
            });
        });

        return slot;
    }

    /** Отрисовка маркеров экстремумов на шкале. */
    renderMarkers(groupedByState, stackEl) {
        const stack =
            stackEl ||
            window.dom.byKey('timeBarStateStack') ||
            document.querySelector('.sun-timeBarStateStack');
        if (!stack) return;

        const dayMs = 24 * 60 * 60 * 1000;

        for (let state = 5; state >= -5; state--) {
            if (this._isRowHidden(state, stack)) continue;
            const track = this._getTrackForState(state, stack);
            if (!track) continue;
            const groups = (groupedByState.get(state) || [])
                .slice()
                .sort((a, b) => a.time.getTime() - b.time.getTime());
            if (!groups.length) continue;

            for (let i = 0; i < groups.length; i++) {
                const group = groups[i];
                const frac = this._dayFractionForTime(group.time, dayMs);
                const slot = this._buildSegmentElement(group, frac);
                /* Раньше по времени — выше z-index (перекрывают более поздние). */
                slot.style.zIndex = String(9 + (groups.length - 1 - i));
                track.appendChild(slot);
                this.markers.push(slot);
            }
        }
    }

    /** Очищает all. */
    clearAll() {
        document.querySelectorAll('.sun-timeBarStateTrack').forEach((track) => {
            track.innerHTML = '';
        });
        this.markers = [];
        this.labels = [];
    }

    /** Перерисовка маркеров на timeBarStateStack и полосе пересечений A×B. */
    updateExtremums() {
        if (!window.dom.byKey('timeBarStateStack')) return;

        if (window.timeBarManager && typeof window.timeBarManager.buildStateStackRows === 'function') {
            window.timeBarManager.buildStateStackRows();
        }
        if (
            window.timeBarManager &&
            typeof window.timeBarManager._updateIntersectionRowLabels === 'function'
        ) {
            window.timeBarManager._updateIntersectionRowLabels();
        }
        if (
            window.timeBarManager &&
            typeof window.timeBarManager._applyIntersectionStripVisibility === 'function'
        ) {
            window.timeBarManager._applyIntersectionStripVisibility();
        }

        this.clearAll();

        if (!window.appState.hasActivePerson()) {
            return;
        }

        const currentDate = window.appState.currentDate || new Date();
        const events = this.calculateStateEventsForDay(currentDate);
        const grouped = this.groupEventsByState(events);
        this.renderMarkers(grouped, window.dom.byKey('timeBarStateStack'));

        const trackAB = window.dom.byKey('timeBarIntersectionTrack');
        if (
            trackAB &&
            (!window.timeBarManager ||
                typeof window.timeBarManager.isIntersectionStripVisible !== 'function' ||
                window.timeBarManager.isIntersectionStripVisible('ab'))
        ) {
            const abEvents = this.calculateABIntersectionEventsForDay(currentDate, 'ab');
            const abGrouped = this.groupABIntersectionEventsByTime(abEvents, 'ab');
            this.renderABIntersectionMarkers(abGrouped, trackAB, 'ab');
        }
        const trackBA = window.dom.byKey('timeBarIntersectionTrackBA');
        if (
            trackBA &&
            (!window.timeBarManager ||
                typeof window.timeBarManager.isIntersectionStripVisible !== 'function' ||
                window.timeBarManager.isIntersectionStripVisible('ba'))
        ) {
            const baEvents = this.calculateABIntersectionEventsForDay(currentDate, 'ba');
            const baGrouped = this.groupABIntersectionEventsByTime(baEvents, 'ba');
            this.renderABIntersectionMarkers(baGrouped, trackBA, 'ba');
        }

        this._updateMultiIntersectionExtremums(currentDate);
    }

    /** Полосы B×A / A×B для каждой Б (без клика по плашкам). */
    _updateMultiIntersectionExtremums(currentDate) {
        if (
            !window.timeBarManager ||
            typeof window.timeBarManager.getMultiIntersectionPrimaryId !== 'function'
        ) {
            return;
        }
        if (typeof window.timeBarManager._ensureMultiIntersectionTimeBar === 'function') {
            window.timeBarManager._ensureMultiIntersectionTimeBar();
        }

        const primaryId = window.timeBarManager.getMultiIntersectionPrimaryId();
        const secondaryIds = window.timeBarManager.getMultiIntersectionSecondaryIds();
        const baseMsA = this._getBirthMsForDateId(primaryId);
        if (baseMsA == null || !secondaryIds.length) return;

        const labelMode =
            typeof window.timeBarManager.getMultiIntersectionSegmentLabelMode === 'function'
                ? window.timeBarManager.getMultiIntersectionSegmentLabelMode()
                : 'period';
        const renderOpts = { interactive: false, labelMode };
        const waveFilter = (wave) => this._isWaveRelevantForMultiIntersection(wave);

        for (let i = 0; i < secondaryIds.length; i++) {
            const sid = secondaryIds[i];
            const baseMsB = this._getBirthMsForDateId(sid);
            if (baseMsB == null || String(sid) === String(primaryId)) continue;

            const bases = {
                baseMsA,
                baseMsB,
                samePerson: false
            };

            ['ba', 'ab'].forEach((orientation) => {
                if (
                    typeof window.timeBarManager.isMultiIntersectionStripVisible === 'function' &&
                    !window.timeBarManager.isMultiIntersectionStripVisible(sid, orientation)
                ) {
                    return;
                }
                const track =
                    document.getElementById(
                        `timeBarMultiIntersectionTrack-${sid}-${orientation}`
                    ) ||
                    document.querySelector(
                        `.sun-timeBarMultiIntersectionTrack[data-secondary-id="${String(sid).replace(/"/g, '')}"][data-orientation="${orientation}"]`
                    );
                if (!track) return;

                const events = this.calculateABIntersectionEventsForDay(
                    currentDate,
                    orientation,
                    bases,
                    { waveFilter }
                );
                const grouped = this.groupABIntersectionEventsByTime(events, orientation);
                this.renderABIntersectionMarkers(grouped, track, orientation, renderOpts);
            });
        }
    }

    /** Пересчёт при смене currentDate. */
    setupDateChangeObserver() {
        const originalCurrentDate = window.appState.currentDate;
        const desc = Object.getOwnPropertyDescriptor(window.appState, 'currentDate');
        const prevSet = desc && desc.set;
        Object.defineProperty(window.appState, 'currentDate', {
            get() {
                return this._currentDate;
            },
            set(value) {
                this._currentDate = value;
                if (typeof prevSet === 'function') {
                    try {
                        prevSet.call(window.appState, value);
                    } catch (e) {
                        /* ignore */
                    }
                }
                queueMicrotask(() => {
                    if (window.extremumTimeManager && window.extremumTimeManager.updateExtremums) {
                        window.extremumTimeManager.updateExtremums();
                    }
                });
            }
        });

        window.appState._currentDate = originalCurrentDate;
    }
}

/** Повторно обернуть waveVisibility после перезагрузки appState (импорт, сброс). */
ExtremumTimeManager.reinstallWaveVisibilityObserver = function reinstallWaveVisibilityObserver() {
    if (window.extremumTimeManager && window.extremumTimeManager.installWaveVisibilityObserver) {
        const vis = window.appState && window.appState.waveVisibility;
        if (vis && vis.__isWaveVisibilityProxy && vis.__waveVisibilityTarget) {
            window.appState.waveVisibility = vis.__waveVisibilityTarget;
        }
        window.extremumTimeManager.installWaveVisibilityObserver();
    }
};

window.extremumTimeManager = new ExtremumTimeManager();
