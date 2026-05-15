// modules/extremumTimeManager.js — полосы состояний +5…−5, моменты прохождения sin(фаза)·5
class ExtremumTimeManager {
    constructor() {
        this.markers = [];
        this.labels = [];
        this.groupTolerance = 1 * 60 * 1000;
        this._visibilityRefreshQueued = false;
    }

    init() {
        const stack = document.getElementById('timeBarStateStack');
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

    _isWaveRelevant(wave) {
        if (window.timeBarManager && typeof window.timeBarManager.isTimeBarGroupVisibleForWave === 'function') {
            return window.timeBarManager.isTimeBarGroupVisibleForWave(wave.id);
        }
        return true;
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

        const dayMs = 24 * 60 * 60 * 1000;
        const events = [];

        window.appState.data.waves.forEach((wave) => {
            if (!wave.period || wave.period <= 0) return;
            if (!this._isWaveRelevant(wave)) return;

            const daysFromBaseToStart = window.timeUtils.getDaysBetween(baseDate, dayStart);
            let p0 = (daysFromBaseToStart % wave.period) / wave.period;
            if (p0 < 0) p0 += 1;

            for (let k = 5; k >= -5; k--) {
                const targets = this._cycleFractionsForState(k);
                for (const targetF of targets) {
                    const dayFracs = this._dayFractionsForCycleTarget(p0, wave.period, targetF);
                    for (const d of dayFracs) {
                        const t = new Date(dayStart.getTime() + d * dayMs);
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
            }
        });

        return events.sort((a, b) => a.time.getTime() - b.time.getTime());
    }

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

    _getTrackForState(state) {
        return document.querySelector(`.time-bar-state-track[data-state="${state}"]`);
    }

    _isRowHidden(state) {
        const row = document.querySelector(`.time-bar-state-row[data-state="${state}"]`);
        return !!(row && row.classList.contains('time-bar-state-row--hidden'));
    }

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

    _buildSegmentElement(group, frac) {
        const waveNameMap = new Map();
        group.waves.forEach((wave) => {
            waveNameMap.set(wave.name, wave.id);
        });
        const uniqueNames = Array.from(waveNameMap.keys());
        const waveIds = Array.from(waveNameMap.values());
        const namesHtml = uniqueNames
            .map((name, index) => {
                const waveId = waveIds[index];
                const checked = this._isWaveVisibilityChecked(waveId);
                const cls = checked
                    ? 'extremum-wave-name extremum-wave-name--on-vizor'
                    : 'extremum-wave-name';
                return `<span class="${cls}" data-wave-id="${waveId}">${name}</span>`;
            })
            .join(', ');

        const slot = document.createElement('div');
        slot.className = 'time-bar-segment-slot';
        slot.style.left = `${Math.max(0, Math.min(100, frac * 100))}%`;

        const seg = document.createElement('div');
        seg.className = 'time-bar-segment';

        const label = document.createElement('div');
        label.className = 'extremum-label extremum-label-top time-bar-segment-label';

        const labelText = document.createElement('div');
        labelText.className = 'extremum-label-text';
        labelText.innerHTML = namesHtml;

        const arrowTop = document.createElement('div');
        arrowTop.className = 'extremum-label-arrow extremum-label-arrow-top';

        const arrowBottom = document.createElement('div');
        arrowBottom.className = 'extremum-label-arrow extremum-label-arrow-bottom';

        label.appendChild(arrowTop);
        label.appendChild(labelText);
        label.appendChild(arrowBottom);
        seg.appendChild(label);
        slot.appendChild(seg);

        queueMicrotask(() => {
            labelText.querySelectorAll('.extremum-wave-name').forEach((span) => {
                span.addEventListener('click', (ev) => {
                    ev.preventDefault();
                    ev.stopPropagation();
                    const waveId = span.dataset.waveId;
                    if (waveId) {
                        const checkbox = document.querySelector(`.wave-visibility-check[data-id="${waveId}"]`);
                        if (checkbox) checkbox.click();
                    }
                });
            });
        });

        return slot;
    }

    renderMarkers(groupedByState) {
        this.clearAll();
        const dayMs = 24 * 60 * 60 * 1000;

        for (let state = 5; state >= -5; state--) {
            if (this._isRowHidden(state)) continue;
            const track = this._getTrackForState(state);
            if (!track) continue;
            const groups = (groupedByState.get(state) || []).slice().sort((a, b) => a.time.getTime() - b.time.getTime());
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

    clearAll() {
        document.querySelectorAll('.time-bar-state-track').forEach((track) => {
            track.innerHTML = '';
        });
        this.markers = [];
        this.labels = [];
    }

    updateExtremums() {
        if (!document.getElementById('timeBarStateStack')) return;

        if (!window.appState.hasActivePerson()) {
            this.renderMarkers(new Map());
            return;
        }

        const currentDate = window.appState.currentDate || new Date();
        const events = this.calculateStateEventsForDay(currentDate);
        const grouped = this.groupEventsByState(events);
        this.renderMarkers(grouped);
    }

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
