// modules/waves.js - ПОЛНЫЙ ОБНОВЛЕННЫЙ ФАЙЛ
function __waveDbg() {
    const w = window.__waveRenderDebug;
    return w && w.isEnabled() ? w : null;
}

/**
 * Если true — `waveBold` снова добавляет класс .bold (stroke-width в CSS).
 * Сейчас false: `appState.waveBold` — флаг видимости слоя B (пара `waveVisibility` для A); UI — .wave-b-visibility-check.
 */
const WAVE_BOLD_STROKE_VISUAL_ENABLED = false;

class WavesManager {
    constructor() {
        this.elements = {};
        this.waveContainers = {};
        this.wavePaths = {};
        /** Вторая синусоида (персона B), полупрозрачная */
        this.waveBPaths = {};
        /** SVG-группы для translate фаз: { a, b } */
        this.wavePathLayerGroups = {};
        this.initialized = false;
        this.waveLabels = {};
        this.waveLabelElements = {};
        this.lastUpdateTime = 0;
        this.updateInterval = 50;
        this._enabledWaveIdSetForFrame = null;
    }
    
    _isWaveInEnabledGroupThisFrame(waveId) {
        if (this._enabledWaveIdSetForFrame) {
            return this._enabledWaveIdSetForFrame.has(String(waveId));
        }
        return this.isWaveGroupEnabled(waveId);
    }
    
    /** Сброс ссылок на DOM волн (после уничтожения контейнеров из document) */
    clearWaveDomReferences() {
        this.waveContainers = {};
        this.wavePaths = {};
        this.waveBPaths = {};
        this.wavePathLayerGroups = {};
    }

    /** См. WAVE_BOLD_STROKE_VISUAL_ENABLED — для внешних модулей (например сохранение стиля волны). */
    isBoldStrokeVisualEnabled() {
        return WAVE_BOLD_STROKE_VISUAL_ENABLED;
    }

    init() {
        if (this.initialized) {
            return;
        }
        
        const d = __waveDbg();
        const endInit = d && d.t('waves.init', {});
        try {
            this.createVisibleWaveElements();
            this.updatePosition();
            this.initialized = true;
        } finally {
            endInit && endInit({});
        }
    }
    
    calculateRequiredPeriods(periodPx) {
        const viewportWidth = window.appState.graphWidth;
        
        if (periodPx < 250) {
            return 30;
        }
        
        if (periodPx < 500) {
            return 20;
        }
        
        if (periodPx < 1000) {
            return 15;
        }
        
        if (periodPx < 1500) {
            return 10;
        }
        
        const periodsToCoverViewport = Math.ceil(viewportWidth / periodPx);
        const safetyMargin = 3;
        
        return Math.max(3, periodsToCoverViewport + safetyMargin);
    }
    
    isWaveGroupEnabled(waveId) {
        const waveIdStr = String(waveId);
        
        for (const group of window.appState.data.groups) {
            if (group.waves && group.waves.some(wId => String(wId) === waveIdStr)) {
                if (group.enabled) {
                    return true;
                }
            }
        }
        
        return false;
    }

    /**
     * Смещение в днях для персоны B (дата B в сравнении), тот же визор, что и у A.
     * @returns {number|null}
     */
    _getSecondPersonDayOffset() {
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
        const dates = window.appState.data.dates || [];
        const personB = dates.find((d) => String(d.id) === idB);
        if (!personB) {
            return null;
        }
        const useExact =
            window.dates && typeof window.dates.lastRecalculateUsedExactTime === 'boolean'
                ? window.dates.lastRecalculateUsedExactTime
                : true;
        const vizor = window.appState.currentDate;
        if (!window.dates || typeof window.dates.computeDayOffsetFromBirth !== 'function') {
            return null;
        }
        return window.dates.computeDayOffsetFromBirth(personB.date, vizor, useExact);
    }

    _shouldDrawSecondPersonWave(waveIdStr) {
        if (!window.appState.waveBold[waveIdStr]) {
            return false;
        }
        return this._getSecondPersonDayOffset() != null;
    }

    /**
     * Какие фазы персоны рисуются и нужны выноски/нули/пересечения: A (визор), B (дата B), или оба.
     * @returns {{ key: 'a'|'b', day: number }[]}
     */
    _visibleLayersForWave(wave) {
        const waveIdStr = String(wave.id);
        const isWaveVisible = window.appState.waveVisibility[waveIdStr] !== false;
        const groupOk = this._isWaveInEnabledGroupThisFrame(wave.id);
        const shouldShowA = isWaveVisible && groupOk;
        const showB = groupOk && this._shouldDrawSecondPersonWave(waveIdStr);
        const layers = [];
        if (shouldShowA) {
            layers.push({ key: 'a', day: window.appState.currentDay || 0 });
        }
        if (showB) {
            const dayB = this._getSecondPersonDayOffset();
            if (dayB != null) {
                layers.push({ key: 'b', day: dayB });
            }
        }
        return layers;
    }

    /**
     * Нужен DOM-контейнер волны: видимая A или включённый слой B (чекбокс «вторая персона»).
     * Видимость A не обязательна, если рисуется только B.
     */
    waveNeedsGraphContainer(waveId) {
        const waveIdStr = String(waveId);
        if (!this.isWaveGroupEnabled(waveId)) {
            return false;
        }
        const isWaveVisible = window.appState.waveVisibility[waveIdStr] !== false;
        if (isWaveVisible) {
            return true;
        }
        return this._shouldDrawSecondPersonWave(waveIdStr);
    }

    /**
     * День отсчёта фазы для подписей/пересечений: при видимой A — currentDay; только слой B — смещение персоны B.
     */
    getEffectiveDayOffsetForWave(wave) {
        const waveIdStr = String(wave.id);
        if (!this.isWaveGroupEnabled(wave.id)) {
            return window.appState.currentDay || 0;
        }
        const isWaveVisible = window.appState.waveVisibility[waveIdStr] !== false;
        const shouldShowA = isWaveVisible;
        const showBOnly = !shouldShowA && this._shouldDrawSecondPersonWave(waveIdStr);
        if (showBOnly) {
            const dayB = this._getSecondPersonDayOffset();
            if (dayB != null) {
                return dayB;
            }
        }
        return window.appState.currentDay || 0;
    }

    createVisibleWaveElements() {
        const d = __waveDbg();
        const endAll = d && d.t('waves.createVisibleWaveElements', {});
        let createdCount = 0;
        try {
            const endClear = d && d.t('waves.createVisibleWaveElements.clearDom', {});
            document.querySelectorAll('.wave-container').forEach(c => c.remove());
            document.querySelectorAll('.wave-label').forEach(l => l.remove());
            
            const axisXPointsContainer = document.querySelector('.wave-axis-x-points');
            if (axisXPointsContainer) {
                axisXPointsContainer.innerHTML = '';
            }
            endClear && endClear({});
            
            this.clearWaveDomReferences();
            this.waveLabelElements = {};

            if (!window.appState.hasActivePerson()) {
                d && d.log('waves.createVisibleWaveElements.skip', { reason: 'noActivePerson' });
                return;
            }
            
            window.appState.data.waves.forEach((wave) => {
                if (this.waveNeedsGraphContainer(wave.id)) {
                    this.createWaveElement(wave);
                    createdCount++;
                }
            });
        } finally {
            endAll &&
                endAll({
                    createdCount,
                    totalWaves: window.appState.data.waves.length
                });
        }
    }

    /**
     * Смена только видимости/групп: создать недостающие контейнеры волн и убрать лишние без полного пересоздания всех SVG.
     * Быстрее, чем recreateAllWaveElements(), при переключении шаблонов отображения.
     */
    reconcileVisibleWaveElements() {
        const d = __waveDbg();
        const end = d && d.t('waves.reconcileVisibleWaveElements', {});
        try {
            if (!window.appState.hasActivePerson()) {
                document.querySelectorAll('.wave-container').forEach((c) => c.remove());
                document.querySelectorAll('.wave-label').forEach((l) => l.remove());
                const axisXPointsContainer = document.querySelector('.wave-axis-x-points');
                if (axisXPointsContainer) {
                    axisXPointsContainer.innerHTML = '';
                }
                this.clearWaveDomReferences();
                this.waveLabelElements = {};
                return;
            }

            window.appState.data.waves.forEach((wave) => {
                const waveIdStr = String(wave.id);
                const needsContainer = this.waveNeedsGraphContainer(wave.id);

                if (needsContainer) {
                    if (!this.waveContainers[wave.id] && !this.waveContainers[waveIdStr]) {
                        this.createWaveElement(wave);
                    }
                } else {
                    const cont = this.waveContainers[wave.id] || this.waveContainers[waveIdStr];
                    if (cont) {
                        cont.remove();
                        delete this.waveContainers[wave.id];
                        delete this.waveContainers[waveIdStr];
                        delete this.wavePaths[wave.id];
                        delete this.wavePaths[waveIdStr];
                        delete this.waveBPaths[wave.id];
                        delete this.waveBPaths[waveIdStr];
                        delete this.wavePathLayerGroups[wave.id];
                        delete this.wavePathLayerGroups[waveIdStr];
                        delete window.appState.periods[wave.id];
                        delete window.appState.periods[waveIdStr];

                        const leftLabel = document.getElementById(`waveLabel${waveIdStr}-left`);
                        const rightLabel = document.getElementById(`waveLabel${waveIdStr}-right`);
                        const leftB = document.getElementById(`waveLabel${waveIdStr}-left-person-b`);
                        const rightB = document.getElementById(`waveLabel${waveIdStr}-right-person-b`);
                        if (leftLabel) leftLabel.remove();
                        if (rightLabel) rightLabel.remove();
                        if (leftB) leftB.remove();
                        if (rightB) rightB.remove();
                        document
                            .querySelectorAll(`.wave-label.vertical[data-wave-id="${waveIdStr}"]`)
                            .forEach((el) => el.remove());

                        delete this.waveLabelElements[`${waveIdStr}-left`];
                        delete this.waveLabelElements[`${waveIdStr}-right`];
                        delete this.waveLabelElements[`${waveIdStr}-left-person-b`];
                        delete this.waveLabelElements[`${waveIdStr}-right-person-b`];
                        Object.keys(this.waveLabelElements).forEach((key) => {
                            if (key.startsWith(`${waveIdStr}-top`) || key.startsWith(`${waveIdStr}-bottom`)) {
                                delete this.waveLabelElements[key];
                            }
                        });
                    }
                }
            });

            this.updatePosition({ forceWaveLabels: true });
        } finally {
            end && end({});
        }
    }
    
    createWaveElement(wave) {
        const d = __waveDbg();
        const verbose = d && d.isVerbose && d.isVerbose();
        const endWave = verbose && d.t('waves.createWaveElement', { id: wave.id, name: wave.name });
        try {
        const container = document.createElement('div');
        container.className = 'wave-container';
        container.id = `waveContainer${wave.id}`;
        
        const periodPx = wave.period * window.appState.config.squareSize;
        
        const totalPeriods = this.calculateRequiredPeriods(periodPx);
        const containerWidth = periodPx * totalPeriods;
        
        container.style.width = `${containerWidth}px`;
        container.style.height = '100%';
        container.style.position = 'absolute';
        container.style.top = '0';
        container.style.left = '0';
        
        container.dataset.totalPeriods = totalPeriods;
        container.dataset.periodPx = periodPx;
        container.dataset.wavePeriod = wave.period;
        container.dataset.waveId = wave.id;
        
        const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        svg.classList.add('wave');
        svg.setAttribute('preserveAspectRatio', 'none');
        svg.setAttribute('viewBox', `0 0 ${containerWidth} ${window.appState.config.graphHeight}`);
        svg.style.width = '100%';
        svg.style.height = '100%';
        
        const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
        path.classList.add('wave-path');
        path.id = `wavePath${wave.id}`;
        path.style.stroke = wave.color;

        const pathB = document.createElementNS('http://www.w3.org/2000/svg', 'path');
        pathB.classList.add('wave-path', 'wave-path--person-b');
        pathB.style.stroke = wave.color;

        let waveType = wave.type;

        for (const group of window.appState.data.groups) {
            if (group.waves && Array.isArray(group.waves)) {
                const waveInGroup = group.waves.some(waveId => {
                    const waveIdStr = String(waveId);
                    const currentWaveIdStr = String(wave.id);
                    return waveIdStr === currentWaveIdStr;
                });

                if (waveInGroup && group.styleEnabled && group.styleType) {
                    waveType = group.styleType;
                    break;
                }
            }
        }

        if (waveType && waveType !== 'solid') {
            const styleCls = window.dom.getWaveStyle(waveType);
            path.classList.add(styleCls);
            pathB.classList.add(styleCls);
        }

        const waveIdStr = String(wave.id);
        if (WAVE_BOLD_STROKE_VISUAL_ENABLED && window.appState.waveBold[waveIdStr]) {
            path.classList.add('bold');
        }

        const gA = document.createElementNS('http://www.w3.org/2000/svg', 'g');
        gA.classList.add('wave-svg-layer', 'wave-svg-layer--a');
        const gB = document.createElementNS('http://www.w3.org/2000/svg', 'g');
        gB.classList.add('wave-svg-layer', 'wave-svg-layer--b');
        gB.setAttribute('display', 'none');

        gA.appendChild(path);
        gB.appendChild(pathB);

        const endSine = verbose && d.t('waves.createWaveElement.generateSineWave', { id: wave.id });
        this.generateSineWave(periodPx, path, container, totalPeriods);
        this.generateSineWave(periodPx, pathB, container, totalPeriods);
        endSine && endSine({});

        svg.appendChild(gA);
        svg.appendChild(gB);
        container.appendChild(svg);
        
        const graphElement = document.getElementById('graphElement');
        if (graphElement) {
            graphElement.appendChild(container);
        }
        
        this.waveContainers[wave.id] = container;
        this.wavePaths[wave.id] = path;
        this.waveBPaths[wave.id] = pathB;
        this.wavePathLayerGroups[wave.id] = { a: gA, b: gB };
        window.appState.periods[wave.id] = periodPx;
        } finally {
            endWave && endWave({});
        }
    }
    
    generateSineWave(periodPx, wavePath, waveContainer, totalPeriods = 3) {
        const totalWidth = periodPx * totalPeriods;
        const points = 1500;
        const step = totalWidth / points;
        
        const phaseOffsetPixels = window.appState.config.phaseOffsetDays * window.appState.config.squareSize;
        const centerY = window.appState.config.graphHeight / 2;
        const amplitude = window.appState.config.amplitude;
        
        const waveSvg = waveContainer.querySelector('.wave');
        if (waveSvg) {
            waveSvg.setAttribute('viewBox', `0 0 ${totalWidth} ${window.appState.config.graphHeight}`);
        }
        
        // M(0,y) по той же формуле, что и остальные точки — иначе излом при ненулевом phaseOffset.
        const y0 = centerY - amplitude * Math.sin(2 * Math.PI * (0 + phaseOffsetPixels) / periodPx);
        let pathData = `M0,${y0} `;
        
        for (let i = 1; i <= points; i++) {
            const x = i * step;
            
            const y = centerY - amplitude * Math.sin(2 * Math.PI * (x + phaseOffsetPixels) / periodPx);
            
            pathData += `L${x},${y} `;
        }
        
        if (wavePath) {
            wavePath.setAttribute('d', pathData);
        }
        
        const waveId = waveContainer.dataset.waveId;
        if (waveId) {
            window.appState.periods[waveId] = periodPx;
        }
    }
    
    updateWaveContainer(waveId, periodPx) {
        const container = this.waveContainers[waveId];
        if (container) {
            const totalPeriods = this.calculateRequiredPeriods(periodPx);
            const containerWidth = periodPx * totalPeriods;
            
            container.style.width = `${containerWidth}px`;
            container.dataset.totalPeriods = totalPeriods;
            container.dataset.periodPx = periodPx;
            
            const waveSvg = container.querySelector('.wave');
            if (waveSvg) {
                waveSvg.setAttribute('viewBox', `0 0 ${containerWidth} ${window.appState.config.graphHeight}`);
            }
            
            const wavePath = this.wavePaths[waveId];
            if (wavePath) {
                this.generateSineWave(periodPx, wavePath, container, totalPeriods);
            }
            const wavePathB = this.waveBPaths[waveId];
            if (wavePathB) {
                this.generateSineWave(periodPx, wavePathB, container, totalPeriods);
            }
        }
    }
    
    getActiveWaves() {
        return window.appState.data.waves.filter((wave) => this.waveNeedsGraphContainer(wave.id));
    }
    
    // ========== НОВЫЕ МЕТОДЫ ДЛЯ ПОДСВЕТКИ ЭКСТРЕМУМОВ ==========
    
    calculateWaveStateAtDay(wave, currentDay) {
        if (!wave.period || wave.period <= 0) return 0;
        
        const phase = (currentDay % wave.period);
        const normalizedPhase = (phase / wave.period) * 2 * Math.PI;
        const waveState = Math.sin(normalizedPhase) * 5;
        
        return waveState;
    }

    /**
     * Направление волны в моменте day: +1 восходящая, −1 низходящая, 0 у экстремума (плоско).
     * Совпадает со знаком d/dt от sin(фаза)·5 по оси дней.
     */
    calculateWaveDirectionAtDay(wave, currentDay) {
        if (!wave.period || wave.period <= 0) return 0;
        const phase = currentDay % wave.period;
        const normalizedPhase = (phase / wave.period) * 2 * Math.PI;
        const deriv = Math.cos(normalizedPhase);
        const flatEps = 0.08;
        if (Math.abs(deriv) < flatEps) return 0;
        return deriv > 0 ? 1 : -1;
    }

    formatWaveDirectionLabel(dir) {
        if (dir > 0) return '↑';
        if (dir < 0) return '↓';
        return '—';
    }

    formatWaveDirectionTitle(dir) {
        if (dir > 0) return 'восходящая';
        if (dir < 0) return 'низходящая';
        return 'экстремум';
    }
    
    isExtremumHighlightEnabled() {
        return window.appState && window.appState.extremumWaveColorHighlight === true;
    }
    
    /** Слой A: экстремум по currentDay; слой B: по дню персоны B (независимо от A). */
    setWaveStrokeColor(waveId, isExtremumA, isExtremumB = false) {
        const widStr = String(waveId);
        const wave = window.appState.data.waves.find((w) => String(w.id) === widStr);
        if (!wave) return;

        const path = this.wavePaths[waveId] || this.wavePaths[widStr];
        if (path) {
            path.style.stroke = isExtremumA ? '#ff0000' : wave.color;
        }

        const pathB = this.waveBPaths[waveId] || this.waveBPaths[widStr];
        if (pathB) {
            pathB.style.stroke = isExtremumB ? '#ff0000' : wave.color;
        }
    }
    

    // opts.forceWaveLabels — сразу пересобрать боковые выноски (обход throttle 50 мс).
    updatePosition(opts = {}) {
        const d = __waveDbg();
        const endTotal = d && d.t('waves.updatePosition', { forceWaveLabels: !!opts.forceWaveLabels });
        const enabledWaveIds = new Set();
        for (const group of window.appState.data.groups) {
            if (group.enabled && group.waves) {
                for (const wId of group.waves) {
                    enabledWaveIds.add(String(wId));
                }
            }
        }
        this._enabledWaveIdSetForFrame = enabledWaveIds;
        
        let waveLoopShown = 0;
        let waveLoopHiddenDom = 0;
        let waveLoopNoContainer = 0;
        
        try {
            const endTb = d && d.t('waves.updatePosition.timeBar', {});
            if (window.timeBarManager && window.timeBarManager.updateTimeIndicator) {
                window.timeBarManager.updateTimeIndicator();
            }
            endTb && endTb({});
            
            if (!window.appState.hasActivePerson()) {
                window.sunWaveLayerBLog &&
                    window.sunWaveLayerBLog('updatePosition:skip (no active person)');
                this.removeWaveIntersectionPoints();
                return;
            }
            
            const endGrid = d && d.t('waves.updatePosition.gridOffset', {});
            if (window.grid && window.grid.updateGridOffset) {
                window.grid.updateGridOffset();
            }
            endGrid && endGrid({});
            
            const currentDay = window.appState.currentDay || 0;
            const layerBTrace = [];
            
            const endLoop = d && d.t('waves.updatePosition.waveLoop', { currentDay });
            window.appState.data.waves.forEach(wave => {
                const waveIdStr = String(wave.id);
                const isWaveVisible = window.appState.waveVisibility[waveIdStr] !== false;
                const groupOk = this._isWaveInEnabledGroupThisFrame(wave.id);
                const shouldShowA = isWaveVisible && groupOk;
                const showB = groupOk && this._shouldDrawSecondPersonWave(waveIdStr);
                const containerVisible = shouldShowA || showB;

                const highlight = this.isExtremumHighlightEnabled();
                let isExtremumA = false;
                let isExtremumB = false;
                if (highlight && shouldShowA) {
                    const s = this.calculateWaveStateAtDay(wave, currentDay);
                    isExtremumA = s >= 4 || s <= -4;
                }
                if (highlight && showB) {
                    const dayB = this._getSecondPersonDayOffset();
                    if (dayB != null) {
                        const s = this.calculateWaveStateAtDay(wave, dayB);
                        isExtremumB = s >= 4 || s <= -4;
                    }
                }
                this.setWaveStrokeColor(wave.id, isExtremumA, isExtremumB);

                if (containerVisible && (shouldShowA || (showB && this._getSecondPersonDayOffset() != null))) {
                    this.updateWaveLabelsColorForLayers(
                        wave.id,
                        shouldShowA,
                        showB && this._getSecondPersonDayOffset() != null,
                        isExtremumA,
                        isExtremumB
                    );
                }
                
                const wavePeriodPixels = window.appState.periods[wave.id] || 
                                    (wave.period * window.appState.config.squareSize);
                
                if (!wavePeriodPixels || wavePeriodPixels <= 0) {
                    return;
                }
                
                let currentPositionPx = (currentDay * window.appState.config.squareSize) % wavePeriodPixels;
                if (currentPositionPx < 0) {
                    currentPositionPx = wavePeriodPixels + currentPositionPx;
                }
                
                const container =
                    this.waveContainers[wave.id] || this.waveContainers[waveIdStr];
                if (container) {
                    container.style.transition = 'none';
                    container.style.transform = '';
                    container.style.display = containerVisible ? 'block' : 'none';
                    if (containerVisible) {
                        waveLoopShown++;
                    } else {
                        waveLoopHiddenDom++;
                    }

                    const path = this.wavePaths[wave.id] || this.wavePaths[waveIdStr];
                    if (path) {
                        path.classList.toggle(
                            'bold',
                            !!(WAVE_BOLD_STROKE_VISUAL_ENABLED && window.appState.waveBold[waveIdStr])
                        );
                    }

                    let layers = this.wavePathLayerGroups[wave.id] || this.wavePathLayerGroups[waveIdStr];
                    let layerBRepairedFromDom = false;
                    if (
                        layers &&
                        layers.a &&
                        layers.b &&
                        (!container.contains(layers.a) || !container.contains(layers.b))
                    ) {
                        delete this.wavePathLayerGroups[wave.id];
                        delete this.wavePathLayerGroups[waveIdStr];
                        layers = null;
                    }
                    if ((!layers || !layers.a || !layers.b) && container.querySelector) {
                        const svg = container.querySelector('svg.wave');
                        const gA = svg && svg.querySelector('.wave-svg-layer--a');
                        const gB = svg && svg.querySelector('.wave-svg-layer--b');
                        if (gA && gB) {
                            layerBRepairedFromDom = true;
                            layers = { a: gA, b: gB };
                            this.wavePathLayerGroups[wave.id] = layers;
                            this.wavePathLayerGroups[waveIdStr] = layers;
                        }
                    }
                    if (layers && layers.a && layers.b) {
                        layers.a.setAttribute('transform', `translate(${-currentPositionPx},0)`);
                        if (shouldShowA) {
                            layers.a.removeAttribute('display');
                        } else {
                            layers.a.setAttribute('display', 'none');
                        }
                        if (showB) {
                            const dayB = this._getSecondPersonDayOffset();
                            if (dayB != null) {
                                let posB =
                                    (dayB * window.appState.config.squareSize) % wavePeriodPixels;
                                if (posB < 0) {
                                    posB = wavePeriodPixels + posB;
                                }
                                layers.b.setAttribute('transform', `translate(${-posB},0)`);
                                layers.b.removeAttribute('display');
                            } else {
                                layers.b.setAttribute('display', 'none');
                            }
                        } else {
                            layers.b.setAttribute('display', 'none');
                        }
                    } else {
                        container.style.transform = `translateX(${-currentPositionPx}px)`;
                    }

                    if (
                        window.sunWaveLayerBLog &&
                        (window.appState.waveBold[waveIdStr] === true || showB)
                    ) {
                        const dayBForLog = this._getSecondPersonDayOffset();
                        layerBTrace.push({
                            waveId: waveIdStr,
                            showB,
                            shouldShowA,
                            waveBold: window.appState.waveBold[waveIdStr],
                            groupOk,
                            containerVisible,
                            dayB: dayBForLog,
                            hasContainer: true,
                            hasLayersMap: !!(layers && layers.a && layers.b),
                            repairedFromDom: layerBRepairedFromDom,
                            gBDisplay:
                                layers && layers.b ? layers.b.getAttribute('display') : null,
                            fallbackContainerTransformOnly: !(
                                layers &&
                                layers.a &&
                                layers.b
                            )
                        });
                    }
                } else if (containerVisible) {
                    waveLoopNoContainer++;
                    if (
                        window.sunWaveLayerBLog &&
                        (window.appState.waveBold[waveIdStr] === true || showB)
                    ) {
                        layerBTrace.push({
                            waveId: waveIdStr,
                            showB,
                            shouldShowA,
                            waveBold: window.appState.waveBold[waveIdStr],
                            groupOk,
                            containerVisible,
                            dayB: this._getSecondPersonDayOffset(),
                            hasContainer: false,
                            note: 'missingContainerButVisible'
                        });
                    }
                }
            });
            if (layerBTrace.length && window.sunWaveLayerBLog) {
                const now = Date.now();
                const force = !!opts.forceWaveLabels;
                const every = window.__SUN_DEBUG_WAVE_LAYER_B_EVERY_FRAME === true;
                if (force || every || now - (this._layerBPosLogLast || 0) >= 500) {
                    this._layerBPosLogLast = now;
                    window.sunWaveLayerBLog('updatePosition', {
                        forceWaveLabels: force,
                        currentDay,
                        globalDayB: this._getSecondPersonDayOffset(),
                        dateSelections: window.appState.dateSelections
                            ? { ...window.appState.dateSelections }
                            : null,
                        trace: layerBTrace,
                        trace0: layerBTrace[0] || null,
                        shouldDrawSecondPersonThisWave:
                            layerBTrace[0] &&
                            layerBTrace[0].waveId != null
                                ? this._shouldDrawSecondPersonWave(String(layerBTrace[0].waveId))
                                : null
                    });
                }
            }
            endLoop &&
                endLoop({
                    shown: waveLoopShown,
                    hiddenDom: waveLoopHiddenDom,
                    missingContainerButVisible: waveLoopNoContainer,
                    waveCount: window.appState.data.waves.length
                });
            
            this.updateAllWaveLabels(opts);
            
            const endVTime = d && d.t('waves.updatePosition.verticalWaveLabelsTime', {});
            this.updateVerticalWaveLabelsTime();
            endVTime && endVTime({});
            
            const endInter = d && d.t('waves.updatePosition.renderWaveIntersectionPoints', {});
            this.renderWaveIntersectionPoints();
            endInter && endInter({});
        } finally {
            this._enabledWaveIdSetForFrame = null;
            endTotal &&
                endTotal({
                    waveLoopShown,
                    waveLoopHiddenDom,
                    waveLoopNoContainer
                });
        }
    }


    _applyLabelColors(el, wave, isExtremum) {
        const color = isExtremum ? '#ff0000' : wave.color;
        const textColor = this.getContrastTextColor(color);
        el.style.backgroundColor = color;
        el.style.color = textColor;
        const arrow = el.querySelector('.wave-label-arrow');
        if (!arrow) return;
        const side = el.dataset.side;
        const pos = el.dataset.position;
        if (side === 'left') {
            arrow.style.borderColor = `transparent transparent transparent ${color}`;
        } else if (side === 'right') {
            arrow.style.borderColor = `transparent ${color} transparent transparent`;
        } else if (pos === 'top') {
            arrow.style.borderColor = `${color} transparent transparent transparent`;
        } else if (pos === 'bottom') {
            arrow.style.borderColor = `transparent transparent ${color} transparent`;
        }
    }

    /** Отдельная подсветка экстремумов для слоёв A и B (оба могут быть на графике). */
    updateWaveLabelsColorForLayers(waveId, hasLayerA, hasLayerB, isExtremumA, isExtremumB) {
        const waveIdStr = String(waveId);
        const wave = window.appState.data.waves.find(w => String(w.id) === waveIdStr);
        if (!wave) return;

        if (hasLayerA) {
            const leftA = document.getElementById(`waveLabel${waveIdStr}-left`);
            const rightA = document.getElementById(`waveLabel${waveIdStr}-right`);
            if (leftA) this._applyLabelColors(leftA, wave, isExtremumA);
            if (rightA) this._applyLabelColors(rightA, wave, isExtremumA);
            document
                .querySelectorAll(`.wave-label.vertical[data-wave-id="${waveIdStr}"][data-wave-layer="a"]`)
                .forEach((label) => this._applyLabelColors(label, wave, isExtremumA));
        }
        if (hasLayerB) {
            const leftB = document.getElementById(`waveLabel${waveIdStr}-left-person-b`);
            const rightB = document.getElementById(`waveLabel${waveIdStr}-right-person-b`);
            if (leftB) this._applyLabelColors(leftB, wave, isExtremumB);
            if (rightB) this._applyLabelColors(rightB, wave, isExtremumB);
            document
                .querySelectorAll(`.wave-label.vertical[data-wave-id="${waveIdStr}"][data-wave-layer="b"]`)
                .forEach((label) => this._applyLabelColors(label, wave, isExtremumB));
        }
    }
    
    
    updateAllWaveLabels(opts = {}) {
        const d = __waveDbg();
        const end = d && d.t('waves.updateAllWaveLabels', { forceWaveLabels: !!opts.forceWaveLabels });
        try {
            this.updateHorizontalWaveLabels(opts);
            this.updateVerticalWaveLabels();
            this.updateAxisXIntersectionPoints();
        } finally {
            end && end({});
        }
    }
    
    updateHorizontalWaveLabels(opts = {}) {
        const d = __waveDbg();
        const now = Date.now();
        
        if (!opts.forceWaveLabels && now - this.lastUpdateTime < this.updateInterval) {
            d &&
                d.log('waves.updateHorizontalWaveLabels.skipThrottle', {
                    forceWaveLabels: false,
                    deltaMs: now - this.lastUpdateTime,
                    intervalMs: this.updateInterval
                });
            return;
        }
        
        this.lastUpdateTime = now;
        
        const leftContainer = document.querySelector('.wave-labels-left');
        const rightContainer = document.querySelector('.wave-labels-right');
        
        if (!leftContainer || !rightContainer) {
            d && d.log('waves.updateHorizontalWaveLabels.skip', { reason: 'noContainers' });
            return;
        }
        
        const end = d && d.t('waves.updateHorizontalWaveLabels', { forceWaveLabels: !!opts.forceWaveLabels });
        try {
            leftContainer.innerHTML = '';
            rightContainer.innerHTML = '';
            
            window.appState.data.waves.forEach((wave) => {
                if (!this.waveNeedsGraphContainer(wave.id)) {
                    return;
                }

                for (const layer of this._visibleLayersForWave(wave)) {
                    const effDay = layer.day;
                    const leftY = this.calculateWaveYAtXForDay(wave, 0, effDay);
                    const rightY = this.calculateWaveYAtXForDay(wave, window.appState.graphWidth, effDay);

                    if (leftY >= 0 && leftY <= window.appState.config.graphHeight) {
                        this.createHorizontalWaveLabel(wave, leftY, 'left', leftContainer, layer.key);
                    }

                    if (rightY >= 0 && rightY <= window.appState.config.graphHeight) {
                        this.createHorizontalWaveLabel(wave, rightY, 'right', rightContainer, layer.key);
                    }
                }
            });
        } finally {
            end &&
                end({
                    leftLabels: leftContainer.children.length,
                    rightLabels: rightContainer.children.length
                });
        }
    }
    
    updateVerticalWaveLabels() {
        const d = __waveDbg();
        const topContainer = document.querySelector('.wave-labels-top');
        const bottomContainer = document.querySelector('.wave-labels-bottom');
        
        if (!topContainer || !bottomContainer) {
            d && d.log('waves.updateVerticalWaveLabels.skip', { reason: 'noContainers' });
            return;
        }
        
        const end = d && d.t('waves.updateVerticalWaveLabels', {});
        try {
            topContainer.innerHTML = '';
            bottomContainer.innerHTML = '';
            
            window.appState.data.waves.forEach((wave) => {
                if (!this.waveNeedsGraphContainer(wave.id)) {
                    return;
                }

                for (const layer of this._visibleLayersForWave(wave)) {
                    const effDay = layer.day;
                    const topXs = this.findAllExtremumXs(wave, 'top', effDay);
                    topXs.forEach((topX, idx) => {
                        this.createVerticalWaveLabel(
                            wave,
                            topX,
                            'top',
                            topContainer,
                            idx,
                            layer.key,
                            effDay
                        );
                    });

                    const bottomXs = this.findAllExtremumXs(wave, 'bottom', effDay);
                    bottomXs.forEach((bottomX, idx) => {
                        this.createVerticalWaveLabel(
                            wave,
                            bottomX,
                            'bottom',
                            bottomContainer,
                            idx,
                            layer.key,
                            effDay
                        );
                    });
                }
            });
        } finally {
            end &&
                end({
                    topLabels: topContainer.children.length,
                    bottomLabels: bottomContainer.children.length
                });
        }
    }
    
    updateAxisXIntersectionPoints() {
        const d = __waveDbg();
        let axisXPointsContainer = document.querySelector('.wave-axis-x-points');
        if (!axisXPointsContainer) {
            axisXPointsContainer = document.createElement('div');
            axisXPointsContainer.className = 'wave-axis-x-points';
            axisXPointsContainer.style.position = 'absolute';
            axisXPointsContainer.style.width = '100%';
            axisXPointsContainer.style.height = '100%';
            axisXPointsContainer.style.pointerEvents = 'none';
            axisXPointsContainer.style.zIndex = '8';
            axisXPointsContainer.style.top = '0';
            axisXPointsContainer.style.left = '0';
            
            const graphElement = document.getElementById('graphElement');
            if (graphElement) {
                graphElement.appendChild(axisXPointsContainer);
            }
        }
        
        if (axisXPointsContainer.classList.contains('hidden')) {
            axisXPointsContainer.innerHTML = '';
            d && d.log('waves.updateAxisXIntersectionPoints.skip', { reason: 'hidden' });
            return;
        }
        
        const end = d && d.t('waves.updateAxisXIntersectionPoints', {});
        let pointCount = 0;
        try {
            axisXPointsContainer.innerHTML = '';
            
            window.appState.data.waves.forEach((wave) => {
                if (!this.waveNeedsGraphContainer(wave.id)) {
                    return;
                }

                for (const layer of this._visibleLayersForWave(wave)) {
                    const intersectionPoints = this.findAxisXIntersectionPoints(wave, layer.day);
                    intersectionPoints.forEach((x) => {
                        this.createAxisXPoint(wave, x, axisXPointsContainer, layer.day, layer.key);
                        pointCount++;
                    });
                }
            });
        } finally {
            end && end({ axisXPointElements: pointCount });
        }
    }
    
    findAxisXIntersectionPoints(wave, effDay) {
        const wavePeriodPixels = window.appState.periods[wave.id] ||
            (wave.period * window.appState.config.squareSize);
        
        if (!wavePeriodPixels) return [];
        
        const day = effDay !== undefined ? effDay : this.getEffectiveDayOffsetForWave(wave);
        let currentOffsetPx = (day * window.appState.config.squareSize) % wavePeriodPixels;
        if (currentOffsetPx < 0) currentOffsetPx = wavePeriodPixels + currentOffsetPx;

        const phaseOffsetPixels = window.appState.config.phaseOffsetDays * window.appState.config.squareSize;
        const graphW = window.appState.graphWidth;

        // y = centerY ⟺ sin(2π(relX+ph)/P) = 0 ⟺ (relX+ph)/P = k/2, k ∈ ℤ
        // relX = x + currentOffsetPx
        const halfPeriod = wavePeriodPixels / 2;
        const base = -phaseOffsetPixels - currentOffsetPx;

        const kMin = Math.floor((0 - base) / halfPeriod) - 1;
        const kMax = Math.ceil((graphW - base) / halfPeriod) + 1;

        const points = [];
        for (let k = kMin; k <= kMax; k++) {
            const x = k * halfPeriod + base;
            if (x >= -1e-6 && x <= graphW + 1e-6) {
                points.push(Math.min(graphW, Math.max(0, x)));
            }
        }

        points.sort((a, b) => a - b);
        const uniq = [];
        for (const px of points) {
            if (uniq.length && Math.abs(px - uniq[uniq.length - 1]) < 2) {
                continue;
            }
            uniq.push(px);
        }
        return uniq;
    }

    createAxisXPoint(wave, x, container, refDay, layerKey = 'a') {
        const centerY = window.appState.config.graphHeight / 2;
        const waveColor = wave.color || '#666666';
        const textColor = this.getContrastTextColor(waveColor);
        
        const point = document.createElement('div');
        point.className =
            layerKey === 'b'
                ? 'wave-axis-x-point wave-axis-x-point--person-b'
                : 'wave-axis-x-point';
        point.dataset.waveId = wave.id;
        point.dataset.x = x;
        point.dataset.waveLayer = layerKey;
        if (refDay !== undefined && refDay !== null) {
            point.dataset.refDay = String(refDay);
        }
        
        point.style.position = 'absolute';
        point.style.left = `${x}px`;
        point.style.top = `${centerY}px`;
        point.style.transform = 'translate(-50%, -50%)';
        point.style.width = '6px';
        point.style.height = '6px';
        point.style.borderRadius = '50%';
        point.style.backgroundColor = waveColor;
        point.style.border = `1px solid ${textColor}`;
        point.style.cursor = 'pointer';
        point.style.pointerEvents = 'auto';
        point.style.zIndex = '9';
        point.style.transition = 'all 0.2s';
        
        point.title =
            layerKey === 'b'
                ? `${wave.name} (B) — пересечение с осью`
                : `${wave.name} — пересечение с осью`;
        
        point.addEventListener('click', (e) => {
            e.stopPropagation();
            const rd = point.dataset.refDay !== undefined && point.dataset.refDay !== ''
                ? parseFloat(point.dataset.refDay, 10)
                : undefined;
            const lk = point.dataset.waveLayer === 'b' ? 'b' : 'a';
            this.navigateToAxisXIntersection(wave, x, rd, lk);
        });
        
        point.addEventListener('mouseenter', () => {
            point.style.transform = 'translate(-50%, -50%) scale(1.3)';
            point.style.zIndex = '10';
        });
        
        point.addEventListener('mouseleave', () => {
            point.style.transform = 'translate(-50%, -50%)';
            point.style.zIndex = '9';
        });
        
        container.appendChild(point);
    }
    
    navigateToAxisXIntersection(wave, x, refDay, layerKey = 'a') {
        // Время календаря в столбце x текущего визора; совпадает с фазой точки эквилибриума по этой x
        // (старая логика через phaseInPeriod и «первое» пересечение от leftDate ломалась при нескольких нулях на экране)
        const intersectionTime = this.calculateTimeFromXCoordinate(wave, x, refDay, layerKey);
        if (window.dates && window.dates.setDate) {
            window.dates.setDate(intersectionTime, true);
        }
    }

    /** Начало локального дня рождения: A — activeDate (baseDate), B — дата B из сравнения. */
    _getBaseDateMsForWaveLayer(layerKey) {
        if (layerKey === 'b') {
            const ds = window.appState.dateSelections;
            const idB = ds && ds.typeB;
            if (idB == null || String(idB) === '') {
                return this._getBaseDateMsForWaveLayer('a');
            }
            const personB = (window.appState.data.dates || []).find((d) => String(d.id) === String(idB));
            if (!personB || personB.date == null) {
                return this._getBaseDateMsForWaveLayer('a');
            }
            const selectedDate = new Date(personB.date);
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
        const bd = window.appState.baseDate;
        const raw = bd instanceof Date ? bd : new Date(bd);
        return new Date(
            raw.getFullYear(),
            raw.getMonth(),
            raw.getDate(),
            0,
            0,
            0,
            0
        ).getTime();
    }
    
    /**
     * @param {number} [refDay] день отсчёта фазы в центре графа для выбранного слоя
     * @param {'a'|'b'} [layerKey] чья база рождения добавлять к targetDay (у B иначе время уезжает)
     */
    calculateTimeFromXCoordinate(wave, x, refDay, layerKey = 'a') {
        const ref =
            refDay !== undefined && refDay !== null
                ? refDay
                : this.getEffectiveDayOffsetForWave(wave);

        const daysFromCenter = (x - (window.appState.graphWidth / 2)) / window.appState.config.squareSize;

        const targetDay = ref + daysFromCenter;

        const baseMs = this._getBaseDateMsForWaveLayer(layerKey);
        const pointTime = new Date(baseMs + targetDay * 24 * 3600 * 1000);

        return pointTime;
    }
    
    getPhaseAtTime(wave, time) {
        const daysFromBase = window.timeUtils.getDaysBetween(window.appState.baseDate, time);
        
        const phase = (daysFromBase % wave.period) / wave.period;
        
        return phase < 0 ? phase + 1 : phase;
    }
    
    getContrastTextColor(backgroundColor) {
        if (!backgroundColor) return '#000000';
        
        let r, g, b;
        
        if (backgroundColor.startsWith('#')) {
            const hex = backgroundColor.slice(1);
            if (hex.length === 3) {
                r = parseInt(hex[0] + hex[0], 16);
                g = parseInt(hex[1] + hex[1], 16);
                b = parseInt(hex[2] + hex[2], 16);
            } else if (hex.length === 6) {
                r = parseInt(hex.slice(0, 2), 16);
                g = parseInt(hex.slice(2, 4), 16);
                b = parseInt(hex.slice(4, 6), 16);
            } else {
                return '#000000';
            }
        } else {
            return '#000000';
        }
        
        const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
        return luminance > 0.5 ? '#000000' : '#ffffff';
    }
    

    
    createHorizontalWaveLabel(wave, y, side, container, layerKey = 'a') {
        const suffix = layerKey === 'b' ? '-person-b' : '';
        const labelId = `${wave.id}-${side}${suffix}`;
        const effDay =
            layerKey === 'b' ? this._getSecondPersonDayOffset() : window.appState.currentDay || 0;
        const state = this.calculateWaveStateAtDay(wave, effDay);
        const atExtremum = (state >= 4 || state <= -4);
        const isExtremum = this.isExtremumHighlightEnabled() && atExtremum;
        
        // Выбираем цвет: красный для экстремума, иначе цвет волны
        const waveColor = isExtremum ? '#ff0000' : (wave.color || '#666666');
        const textColor = this.getContrastTextColor(waveColor);
        
        const labelElement = document.createElement('div');
        labelElement.className =
            layerKey === 'b'
                ? `wave-label horizontal ${side} wave-label--person-b`
                : `wave-label horizontal ${side}`;
        labelElement.id = `waveLabel${labelId}`;
        labelElement.dataset.waveId = wave.id;
        labelElement.dataset.side = side;
        labelElement.dataset.labelType = 'horizontal';
        labelElement.dataset.waveLayer = layerKey;
        
        labelElement.style.position = 'absolute';
        labelElement.style.top = `${y}px`;
        labelElement.style.width = 'auto';
        labelElement.style.backgroundColor = waveColor;
        labelElement.style.color = textColor;
        labelElement.style.setProperty('--wave-label-fill', waveColor);
        if (layerKey !== 'b') {
            labelElement.style.opacity = '0.7';
        }
        labelElement.style.zIndex = '1';
        labelElement.style.padding = '2px 6px';
        labelElement.style.borderRadius = '3px';
        labelElement.style.fontSize = '11px';
        labelElement.style.transform = 'translateY(-50%)';
        labelElement.style.cursor = 'pointer';
        labelElement.style.fontWeight = '500';
        labelElement.style.whiteSpace = 'nowrap';
        
        const arrow = document.createElement('div');
        arrow.className = 'wave-label-arrow';
        arrow.style.position = 'absolute';
        arrow.style.top = '50%';
        arrow.style.transform = 'translateY(-50%)';
        arrow.style.width = '0';
        arrow.style.height = '0';
        arrow.style.borderStyle = 'solid';
        arrow.style.zIndex = '1';
        
        if (side === 'left') {
            arrow.style.right = '-6px';
            arrow.style.borderWidth = '4px 0 4px 6px';
            arrow.style.borderColor = `transparent transparent transparent ${waveColor}`;
            labelElement.style.right = '0';
            labelElement.style.marginRight = '10px';
        } else {
            arrow.style.left = '-6px';
            arrow.style.borderWidth = '4px 6px 4px 0';
            arrow.style.borderColor = `transparent ${waveColor} transparent transparent`;
            labelElement.style.left = '0';
            labelElement.style.marginLeft = '10px';
        }
        
        const text = document.createElement('div');
        text.className = 'wave-label-text';
        text.textContent = wave.name;
        text.title =
            layerKey === 'b'
                ? `${wave.name} (${wave.period} дн.) — клик: вкл/выкл волну B (как чекбокс «вторая персона»)`
                : `${wave.name} (${wave.period} дней)`;
        text.style.position = 'relative';
        text.style.zIndex = '2';
        
        labelElement.appendChild(text);
        labelElement.appendChild(arrow);
        container.appendChild(labelElement);
        
        this.waveLabelElements[labelId] = labelElement;
        
        labelElement.addEventListener('click', (e) => {
            e.stopPropagation();
            if (layerKey === 'b') {
                this.onHorizontalWaveLabelBClick(wave.id);
                return;
            }
            this.onHorizontalWaveLabelClick(wave.id);
        });
        
        if (layerKey === 'b') {
            labelElement.addEventListener('mouseenter', () => {
                labelElement.style.zIndex = '10';
            });
            labelElement.addEventListener('mouseleave', () => {
                labelElement.style.zIndex = '1';
            });
        } else {
            labelElement.addEventListener('mouseenter', () => {
                labelElement.style.opacity = '1';
                labelElement.style.zIndex = '10';
            });
            labelElement.addEventListener('mouseleave', () => {
                labelElement.style.opacity = '0.7';
                labelElement.style.zIndex = '1';
            });
        }
        
        return labelElement;
    }


    createVerticalWaveLabel(wave, x, position, container, index = 0, layerKey = 'a', effDay) {
        const suffix = layerKey === 'b' ? '-person-b' : '';
        const labelId = `${wave.id}-${position}-${index}${suffix}`;
        const day =
            effDay !== undefined && effDay !== null
                ? effDay
                : layerKey === 'b'
                  ? this._getSecondPersonDayOffset()
                  : window.appState.currentDay || 0;
        const state = this.calculateWaveStateAtDay(wave, day);
        const atExtremum = (state >= 4 || state <= -4);
        const isExtremum = this.isExtremumHighlightEnabled() && atExtremum;
        
        // Выбираем цвет: красный для экстремума, иначе цвет волны
        const waveColor = isExtremum ? '#ff0000' : (wave.color || '#666666');
        const textColor = this.getContrastTextColor(waveColor);
        
        const extremumTime = this.calculateTimeFromXCoordinate(wave, x, day, layerKey);
        const timeString = this.formatExtremumTime(extremumTime);
        
        const labelElement = document.createElement('div');
        labelElement.className =
            layerKey === 'b'
                ? `wave-label vertical ${position} wave-label--person-b`
                : `wave-label vertical ${position}`;
        labelElement.id = `waveLabel${labelId}`;
        labelElement.dataset.waveId = wave.id;
        labelElement.dataset.position = position;
        labelElement.dataset.labelType = 'vertical';
        labelElement.dataset.waveLayer = layerKey;
        labelElement.dataset.refX = String(x);
        labelElement.dataset.extremumTime = extremumTime.getTime();
        
        labelElement.style.position = 'absolute';
        labelElement.style.left = `${x}px`;
        labelElement.style.width = 'auto';
        labelElement.style.backgroundColor = waveColor;
        labelElement.style.color = textColor;
        labelElement.style.setProperty('--wave-label-fill', waveColor);
        if (layerKey !== 'b') {
            labelElement.style.opacity = '0.7';
        }
        labelElement.style.zIndex = '1';
        labelElement.style.padding = '2px 6px';
        labelElement.style.borderRadius = '3px';
        labelElement.style.fontSize = '11px';
        labelElement.style.transform = 'translateX(-50%)';
        labelElement.style.cursor = 'pointer';
        labelElement.style.fontFamily = 'monospace';
        labelElement.style.letterSpacing = '0.5px';
        labelElement.style.fontWeight = '500';
        labelElement.style.whiteSpace = 'nowrap';
        
        const text = document.createElement('div');
        text.className = 'wave-label-text';
        text.textContent = timeString;
        text.style.textAlign = 'center';
        
        const arrow = document.createElement('div');
        arrow.className = 'wave-label-arrow';
        arrow.style.position = 'absolute';
        arrow.style.width = '0';
        arrow.style.height = '0';
        arrow.style.borderStyle = 'solid';
        arrow.style.zIndex = '1';
        
        if (position === 'top') {
            arrow.style.bottom = '-6px';
            arrow.style.left = '50%';
            arrow.style.transform = 'translateX(-50%)';
            arrow.style.borderWidth = '6px 4px 0 4px';
            arrow.style.borderColor = `${waveColor} transparent transparent transparent`;
            labelElement.style.top = '0';
            labelElement.style.marginTop = '5px';
        } else {
            arrow.style.top = '-6px';
            arrow.style.left = '50%';
            arrow.style.transform = 'translateX(-50%)';
            arrow.style.borderWidth = '0 4px 6px 4px';
            arrow.style.borderColor = `transparent transparent ${waveColor} transparent`;
            labelElement.style.bottom = '0';
            labelElement.style.marginBottom = '5px';
        }
        
        labelElement.appendChild(text);
        labelElement.appendChild(arrow);
        container.appendChild(labelElement);
        
        labelElement.addEventListener('click', (e) => {
            e.stopPropagation();
            this.onVerticalWaveLabelClick(labelElement);
        });
        
        if (layerKey === 'b') {
            labelElement.addEventListener('mouseenter', () => {
                labelElement.style.zIndex = '10';
            });
            labelElement.addEventListener('mouseleave', () => {
                labelElement.style.zIndex = '1';
            });
        } else {
            labelElement.addEventListener('mouseenter', () => {
                labelElement.style.opacity = '1';
                labelElement.style.zIndex = '10';
            });
            labelElement.addEventListener('mouseleave', () => {
                labelElement.style.opacity = '0.7';
                labelElement.style.zIndex = '1';
            });
        }
        
        return labelElement;
    }

    
    /** Клик по боковой выноске слоя B — тот же путь, что чекбокс .wave-b-visibility-check (см. handleWavePersonBVisibilityChange). */
    onHorizontalWaveLabelBClick(waveId) {
        const waveIdStr = String(waveId);
        const wasLayerBOn = window.appState.waveBold[waveIdStr] === true;
        const newChecked = !wasLayerBOn;
        const d = __waveDbg();
        d &&
            d.log('waves.onHorizontalWaveLabelBClick', {
                waveId: waveIdStr,
                wasLayerBOn,
                becomesLayerBOn: newChecked
            });

        const applyPersonBVisibilityWithoutEventPath = () => {
            window.appState.waveBold[waveIdStr] = newChecked;
            window.appState.save();
            if (typeof this.reconcileVisibleWaveElements === 'function') {
                this.reconcileVisibleWaveElements();
            } else {
                this.updatePosition({ forceWaveLabels: true });
            }
            if (window.summaryManager && window.summaryManager.debouncedUpdate) {
                window.summaryManager.debouncedUpdate();
            } else if (window.summaryManager && window.summaryManager.updateSummary) {
                window.summaryManager.updateSummary();
            }
        };
        if (
            window.eventManager &&
            typeof window.eventManager.handleWavePersonBVisibilityChange === 'function'
        ) {
            const $ = window.jQuery;
            if ($) {
                const $bVis = $(`.wave-b-visibility-check[data-id="${waveIdStr}"]`);
                window.eventManager.handleWavePersonBVisibilityChange(
                    waveId,
                    newChecked,
                    $bVis.length ? $bVis : $()
                );
            } else {
                applyPersonBVisibilityWithoutEventPath();
            }
        } else {
            applyPersonBVisibilityWithoutEventPath();
        }

        const applied = window.appState.waveBold[waveIdStr] === true;
        document.querySelectorAll(`.wave-b-visibility-check[data-id="${waveIdStr}"]`).forEach((el) => {
            el.checked = applied;
        });
    }

    onHorizontalWaveLabelClick(waveId) {
        const waveIdStr = String(waveId);
        const isCurrentlyVisible = window.appState.waveVisibility[waveIdStr] !== false;
        const newChecked = !isCurrentlyVisible;
        const d = __waveDbg();
        d &&
            d.log('waves.onHorizontalWaveLabelClick', {
                waveId: waveIdStr,
                wasVisible: isCurrentlyVisible,
                becomesVisible: newChecked
            });
        // Тот же путь, что и чекбокс «Видимость»: без updateWavesList() — иначе полный EJS-рендер списка даёт сотни мс задержки.
        if (window.eventManager && window.eventManager.handleWaveVisibilityChange) {
            window.eventManager.handleWaveVisibilityChange(waveId, newChecked, $());
            const $vis = $(`.wave-visibility-check[data-id="${waveIdStr}"]`);
            if ($vis.length) {
                $vis.prop('checked', newChecked);
            }
        } else {
            window.appState.waveVisibility[waveIdStr] = newChecked;
            window.appState.saveDebounced();
            const wave = window.appState.data.waves.find(w => String(w.id) === waveIdStr);
            const isGroupEnabled = this.isWaveGroupEnabled(waveId);
            if (newChecked && isGroupEnabled && !this.waveContainers[waveId] && wave) {
                this.createWaveElement(wave);
            }
            this.updatePosition({ forceWaveLabels: true });
        }
    }
    
    onVerticalWaveLabelClick(labelElement) {
        const waveId = labelElement.dataset.waveId;
        const wave = window.appState.data.waves.find((w) => String(w.id) === String(waveId));
        if (!wave) return;

        const refX = labelElement.dataset.refX;
        const layerKey = labelElement.dataset.waveLayer === 'b' ? 'b' : 'a';
        const refDay =
            layerKey === 'b' ? this._getSecondPersonDayOffset() : window.appState.currentDay || 0;
        if (layerKey === 'b' && refDay == null) return;

        const extremumTime =
            refX !== undefined && refX !== ''
                ? this.calculateTimeFromXCoordinate(wave, parseFloat(refX, 10), refDay, layerKey)
                : this.calculateExtremumTime(wave, labelElement.dataset.position);

        this.navigateToExtremumTime(extremumTime.getTime());
    }
    
    navigateToExtremumTime(timestamp) {
        const extremumDate = new Date(timestamp);
        
        if (window.dates && window.dates.setDate) {
            window.dates.setDate(extremumDate, true);
        }
    }
    
    calculateExtremumTime(wave, position) {
        const periodPx = window.appState.periods[wave.id] || 
                        (wave.period * window.appState.config.squareSize);
        
        if (!periodPx) {
            return new Date();
        }
        
        const extremumPhaseFraction = position === 'top' ? 0.25 : 0.75;
        
        const baseDate = window.appState.baseDate;
        
        const squaresLeft = Math.floor(window.appState.config.gridSquaresX / 2);
        
        const currentDate = new Date(window.appState.currentDate);
        
        const leftDate = new Date(currentDate);
        leftDate.setDate(leftDate.getDate() - squaresLeft);
        leftDate.setHours(0, 0, 0, 0);
        
        const normalizedBaseDate = new Date(baseDate);
        normalizedBaseDate.setHours(0, 0, 0, 0);
        
        const daysFromBaseToLeft = window.timeUtils.getDaysBetween(normalizedBaseDate, leftDate);
        
        const wholeDaysFromBaseToLeft = Math.floor(daysFromBaseToLeft);
        
        const phaseAtLeft = (wholeDaysFromBaseToLeft % wave.period) / wave.period;
        
        const normalizedPhaseAtLeft = phaseAtLeft < 0 ? phaseAtLeft + 1 : phaseAtLeft;
        
        let phaseDiff = extremumPhaseFraction - normalizedPhaseAtLeft;
        if (phaseDiff < 0) {
            phaseDiff += 1.0;
        }
        
        const daysToExtremumFromLeft = phaseDiff * wave.period;
        
        const extremumTime = new Date(leftDate.getTime() + (daysToExtremumFromLeft * 24 * 3600 * 1000));
        
        const rightDate = new Date(leftDate);
        rightDate.setDate(rightDate.getDate() + window.appState.config.gridSquaresX);
        
        if (extremumTime >= leftDate && extremumTime <= rightDate) {
            return extremumTime;
        }
        
        const nextExtremumTime = new Date(extremumTime.getTime() + (wave.period * 24 * 3600 * 1000));
        return nextExtremumTime;
    }
    
    formatExtremumTime(date) {
        const hours = date.getHours().toString().padStart(2, '0');
        const minutes = date.getMinutes().toString().padStart(2, '0');
        const seconds = date.getSeconds().toString().padStart(2, '0');
        
        return `${hours}:${minutes}:${seconds}`;
    }
    
    updateVerticalWaveLabelsTime() {
        const d = __waveDbg();
        const labels = document.querySelectorAll('.wave-label.vertical');
        const end = d && d.t('waves.updateVerticalWaveLabelsTime', { count: labels.length });
        try {
        labels.forEach(label => {
            const waveId = label.dataset.waveId;
            const refX = label.dataset.refX;
            
            const wave = window.appState.data.waves.find(w => String(w.id) === waveId);
            if (!wave) return;

            const refDay =
                label.dataset.waveLayer === 'b'
                    ? this._getSecondPersonDayOffset()
                    : window.appState.currentDay || 0;
            if (label.dataset.waveLayer === 'b' && refDay == null) {
                return;
            }
            
            const layerKey = label.dataset.waveLayer === 'b' ? 'b' : 'a';
            const extremumTime = refX !== undefined && refX !== ''
                ? this.calculateTimeFromXCoordinate(wave, parseFloat(refX, 10), refDay, layerKey)
                : this.calculateExtremumTime(wave, label.dataset.position);
            const timeString = this.formatExtremumTime(extremumTime);
            
            const textElement = label.querySelector('.wave-label-text');
            if (textElement) {
                textElement.textContent = timeString;
            }
            label.dataset.extremumTime = String(extremumTime.getTime());
        });
        } finally {
            end && end({});
        }
    }
    
    calculateWaveYAtXForDay(wave, x, effDay) {
        const wavePeriodPixels = window.appState.periods[wave.id] ||
            wave.period * window.appState.config.squareSize;

        if (!wavePeriodPixels || wavePeriodPixels <= 0) {
            return window.appState.config.graphHeight / 2;
        }

        let currentOffsetPx = (effDay * window.appState.config.squareSize) % wavePeriodPixels;
        if (currentOffsetPx < 0) {
            currentOffsetPx = wavePeriodPixels + currentOffsetPx;
        }

        const relativeX = x + currentOffsetPx;
        const phaseOffsetPixels = window.appState.config.phaseOffsetDays * window.appState.config.squareSize;
        const centerY = window.appState.config.graphHeight / 2;
        const amplitude = window.appState.config.amplitude;

        return (
            centerY -
            amplitude *
                Math.sin((2 * Math.PI * (relativeX + phaseOffsetPixels)) / wavePeriodPixels)
        );
    }

    calculateWaveYAtX(wave, x) {
        return this.calculateWaveYAtXForDay(wave, x, this.getEffectiveDayOffsetForWave(wave));
    }

    /**
     * Все горизонтальные координаты экстремумов (верх/низ синусоиды) в пределах видимой ширины графа.
     * Раньше использовался один X ближе к центру — при малом периоде остальные пики не получали выносок.
     */
    findAllExtremumXs(wave, position, effDay) {
        const wavePeriodPixels = window.appState.periods[wave.id] ||
            (wave.period * window.appState.config.squareSize);
        
        if (!wavePeriodPixels || wavePeriodPixels <= 0) {
            return [];
        }
        
        const amplitude = window.appState.config.amplitude;
        if (amplitude <= 0) {
            return [];
        }
        
        const day = effDay !== undefined ? effDay : this.getEffectiveDayOffsetForWave(wave);
        let currentOffsetPx = (day * window.appState.config.squareSize) % wavePeriodPixels;
        if (currentOffsetPx < 0) {
            currentOffsetPx = wavePeriodPixels + currentOffsetPx;
        }

        const phaseOffsetPixels = window.appState.config.phaseOffsetDays * window.appState.config.squareSize;
        const graphW = window.appState.graphWidth;

        // Вершина: sin=1 → фаза 1/4 цикла; впадина: sin=-1 → 3/4 цикла (как в calculateExtremumTime)
        const quarter = position === 'top' ? 0.25 : 0.75;
        const base = quarter * wavePeriodPixels - phaseOffsetPixels - currentOffsetPx;
        
        const mMin = Math.floor((0 - base) / wavePeriodPixels) - 1;
        const mMax = Math.ceil((graphW - base) / wavePeriodPixels) + 1;
        
        const points = [];
        for (let m = mMin; m <= mMax; m++) {
            const x = base + m * wavePeriodPixels;
            if (x >= -1e-6 && x <= graphW + 1e-6) {
                points.push(Math.min(graphW, Math.max(0, x)));
            }
        }
        
        points.sort((a, b) => a - b);
        const uniq = [];
        for (const px of points) {
            if (uniq.length && Math.abs(px - uniq[uniq.length - 1]) < 2) {
                continue;
            }
            uniq.push(px);
        }
        return uniq;
    }
    
    /** Одна точка пересечения волны с горизонталью targetY, ближайшая к центру графа (для совместимости). */
    findWaveXAtY(wave, targetY) {
        const all = this.findAllWaveXAtY(wave, targetY);
        if (!all.length) return null;
        const cx = window.appState.graphWidth / 2;
        return all.reduce((best, x) =>
            (Math.abs(x - cx) < Math.abs(best - cx) ? x : best), all[0]);
    }
    
    findAllWaveXAtY(wave, targetY) {
        const wavePeriodPixels = window.appState.periods[wave.id] ||
            (wave.period * window.appState.config.squareSize);
        
        if (!wavePeriodPixels || wavePeriodPixels <= 0) {
            return [];
        }
        
        const centerY = window.appState.config.graphHeight / 2;
        const amplitude = window.appState.config.amplitude;
        
        if (Math.abs(targetY - centerY) > amplitude + 1e-9) {
            return [];
        }
        
        const sinValue = (centerY - targetY) / amplitude;
        
        if (Math.abs(sinValue) > 1 + 1e-9) {
            return [];
        }
        
        const theta = Math.asin(Math.max(-1, Math.min(1, sinValue)));

        const solutions = [theta, Math.PI - theta];

        const effDay = this.getEffectiveDayOffsetForWave(wave);
        let currentOffsetPx = (effDay * window.appState.config.squareSize) % wavePeriodPixels;

        if (currentOffsetPx < 0) {
            currentOffsetPx = wavePeriodPixels + currentOffsetPx;
        }

        const phaseOffsetPixels = window.appState.config.phaseOffsetDays * window.appState.config.squareSize;
        const graphW = window.appState.graphWidth;

        const points = [];
        solutions.forEach(solution => {
            for (let n = -20; n <= 20; n++) {
                const x = ((solution / (2 * Math.PI) + n) * wavePeriodPixels - phaseOffsetPixels - currentOffsetPx);
                const normalizedX = ((x % wavePeriodPixels) + wavePeriodPixels) % wavePeriodPixels;
                
                if (normalizedX >= 0 && normalizedX <= graphW) {
                    const dup = points.some(existing => Math.abs(existing - normalizedX) < 2);
                    if (!dup) {
                        points.push(normalizedX);
                    }
                }
            }
        });
        
        return points.sort((a, b) => a - b);
    }
    
    createVisibleWaveElementsForActiveDate() {
        const d = __waveDbg();
        const end = d && d.t('waves.createVisibleWaveElementsForActiveDate', {});
        let created = 0;
        try {
            if (!window.appState.hasActivePerson()) {
                return;
            }
            window.appState.data.waves.forEach((wave) => {
                if (this.waveNeedsGraphContainer(wave.id) && !this.waveContainers[wave.id]) {
                    this.createWaveElement(wave);
                    created++;
                }
            });
        } finally {
            end && end({ createdNewContainers: created });
        }
    }
    
    addCustomWave(name, period, type, color) {
        if (!name || !period) {
            alert('Пожалуйста, введите название и период сигнала');
            return null;
        }
        
        const newWave = {
            id: window.appState.generateId(),
            name: name,
            period: parseFloat(period),
            type: type,
            color: color,
            visible: true,
            bold: false,
            cornerColor: false
        };
        
        window.appState.data.waves.push(newWave);
        window.appState.waveVisibility[newWave.id] = true;
        window.appState.waveBold[newWave.id] = false;
        window.appState.waveCornerColor[newWave.id] = false;
        
        const defaultGroup = window.appState.data.groups.find(g => g.id === 'default-group');
        if (defaultGroup) {
            defaultGroup.waves.unshift(newWave.id);
            defaultGroup.expanded = true;
        }
        
        const d = __waveDbg();
        const endAdd = d && d.t('waves.addCustomWave', { name, period: newWave.period, id: newWave.id });
        try {
            if (window.appState.hasActivePerson() && this.isWaveGroupEnabled(newWave.id)) {
                this.createWaveElement(newWave);
            }
            
            this.updatePosition();
            if (window.displayViewTemplatesManager && window.displayViewTemplatesManager.onNewWaveAdded) {
                window.displayViewTemplatesManager.onNewWaveAdded(newWave);
            }
            window.appState.save();
        } finally {
            endAdd && endAdd({});
        }
        
        return newWave;
    }
    
    deleteWave(waveId) {
        if (!confirm('Уничтожить этот сигнал?')) return;
        
        const d = __waveDbg();
        const endDel = d && d.t('waves.deleteWave', { waveId });
        try {
        const waveIdStr = String(waveId);
        
        window.appState.data.groups.forEach(group => {
            if (group.waves) {
                group.waves = group.waves.filter(w => {
                    const wStr = String(w);
                    return wStr !== waveIdStr;
                });
            }
        });
        
        window.appState.data.waves = window.appState.data.waves.filter(wave => {
            return String(wave.id) !== waveIdStr;
        });
        
        delete window.appState.waveVisibility[waveIdStr];
        delete window.appState.waveBold[waveIdStr];
        delete window.appState.waveCornerColor[waveIdStr];
        delete window.appState.periods[waveIdStr];
        
        const waveContainer = this.waveContainers[waveIdStr];
        if (waveContainer) {
            waveContainer.remove();
            delete this.waveContainers[waveIdStr];
            delete this.wavePaths[waveIdStr];
            delete this.waveBPaths[waveIdStr];
            delete this.wavePathLayerGroups[waveIdStr];
        }
        
        const leftLabel = document.getElementById(`waveLabel${waveIdStr}-left`);
        const rightLabel = document.getElementById(`waveLabel${waveIdStr}-right`);
        const leftB = document.getElementById(`waveLabel${waveIdStr}-left-person-b`);
        const rightB = document.getElementById(`waveLabel${waveIdStr}-right-person-b`);
        
        if (leftLabel) leftLabel.remove();
        if (rightLabel) rightLabel.remove();
        if (leftB) leftB.remove();
        if (rightB) rightB.remove();
        
        document.querySelectorAll(`.wave-label.vertical[data-wave-id="${waveIdStr}"]`).forEach(el => el.remove());
        
        delete this.waveLabelElements[`${waveIdStr}-left`];
        delete this.waveLabelElements[`${waveIdStr}-right`];
        delete this.waveLabelElements[`${waveIdStr}-left-person-b`];
        delete this.waveLabelElements[`${waveIdStr}-right-person-b`];
        Object.keys(this.waveLabelElements).forEach(key => {
            if (key.startsWith(`${waveIdStr}-top`) || key.startsWith(`${waveIdStr}-bottom`)) {
                delete this.waveLabelElements[key];
            }
        });
        
            this.updatePosition();
            window.grid.updateGridNotesHighlight();
            window.appState.save();
        } finally {
            endDel && endDel({ waveIdStr: String(waveId) });
        }
    }
    
    updateCornerSquareColors() {
        let activeColor = 'red';
        let hasActiveWave = false;
        
        window.appState.data.waves.forEach(wave => {
            const waveIdStr = String(wave.id);
            if (window.appState.waveCornerColor[waveIdStr]) {
                activeColor = wave.color;
                hasActiveWave = true;
            }
        });
        
        document.querySelectorAll('.corner-square').forEach(square => {
            if (hasActiveWave) {
                square.style.backgroundColor = activeColor;
            } else {
                square.style.backgroundColor = 'red';
            }
        });
    }
    
    setWaveCornerColor(waveId, enabled) {
        const waveIdStr = String(waveId);
        
        if (enabled) {
            window.appState.data.waves.forEach(wave => {
                const otherWaveIdStr = String(wave.id);
                if (otherWaveIdStr !== waveIdStr) {
                    window.appState.waveCornerColor[otherWaveIdStr] = false;
                }
            });
        }
        
        window.appState.waveCornerColor[waveIdStr] = enabled;
        
        this.updateCornerSquareColors();
        
        document.querySelectorAll('.wave-corner-color-check').forEach(checkbox => {
            const checkboxWaveIdStr = String(checkbox.dataset.id);
            if (checkboxWaveIdStr === waveIdStr) {
                checkbox.checked = enabled;
            } else {
                checkbox.checked = false;
            }
        });

        // Без updateWavesList(): состояние чекбоксов уже синхронизировано выше; полный EJS-рендер списка даёт сотни мс и визуальный «миг».
        window.appState.saveDebounced();

        window.dispatchEvent(new CustomEvent('zaraza:waveCornerSelectionChanged'));
    }
    
    getAllWavesInGroup(group) {
        const waves = [];
        
        if (!group || !group.waves || !Array.isArray(group.waves)) {
            return waves;
        }
        
        group.waves.forEach(waveId => {
            const waveIdStr = String(waveId);
            const wave = window.appState.data.waves.find(w => {
                const wIdStr = String(w.id);
                return wIdStr === waveIdStr;
            });
            
            if (wave) {
                waves.push(wave);
            }
        });
        
        return waves;
    }
    
    calculateDaysBetweenDates(date1, date2) {
        if (!window.timeUtils || !window.timeUtils.getDaysBetweenExact) {
            const d1 = date1 instanceof Date ? date1 : new Date(date1);
            const d2 = date2 instanceof Date ? date2 : new Date(date2);
            
            if (isNaN(d1.getTime()) || isNaN(d2.getTime())) {
                return 0;
            }
            
            const timeDiff = d2.getTime() - d1.getTime();
            return timeDiff / (1000 * 60 * 60 * 24);
        }
        
        return window.timeUtils.getDaysBetweenExact(date1, date2);
    }
    
    findWaveIntersectionPointsForDays(wave1, wave2, day1, day2, layer1Key = 'a', layer2Key = 'a') {
        const points = [];

        const periodPx1 = wave1.period * window.appState.config.squareSize;
        const periodPx2 = wave2.period * window.appState.config.squareSize;

        const eq1 = {
            amplitude: window.appState.config.amplitude,
            omega: 2 * Math.PI / periodPx1,
            phi: this.getPixelPhaseForDay(wave1, day1)
        };

        const eq2 = {
            amplitude: window.appState.config.amplitude,
            omega: 2 * Math.PI / periodPx2,
            phi: this.getPixelPhaseForDay(wave2, day2)
        };

        for (let k = -10; k <= 10; k++) {
            if (Math.abs(eq1.omega - eq2.omega) > 1e-12) {
                const x1 = (eq2.phi - eq1.phi + 2 * Math.PI * k) / (eq1.omega - eq2.omega);
                if (x1 >= 0 && x1 <= window.appState.graphWidth) {
                    points.push(
                        this.createIntersectionPoint(x1, wave1, wave2, day1, day2, layer1Key, layer2Key)
                    );
                }
            }

            const x2 = (Math.PI - eq1.phi - eq2.phi + 2 * Math.PI * k) / (eq1.omega + eq2.omega);
            if (x2 >= 0 && x2 <= window.appState.graphWidth) {
                points.push(
                    this.createIntersectionPoint(x2, wave1, wave2, day1, day2, layer1Key, layer2Key)
                );
            }
        }

        return points.filter((p) => p !== null);
    }

    findWaveIntersectionPoints(wave1, wave2) {
        return this.findWaveIntersectionPointsForDays(
            wave1,
            wave2,
            this.getEffectiveDayOffsetForWave(wave1),
            this.getEffectiveDayOffsetForWave(wave2),
            'a',
            'a'
        );
    }
    
    navigateToPreciseTime(preciseTime) {
        const d = __waveDbg();
        const end = d && d.t('waves.navigateToPreciseTime', { preciseTime });
        try {
        const targetDate = new Date(preciseTime);
        
        window.appState.currentDate = targetDate;
        window.appState.currentDay = window.timeUtils.getDaysBetween(
            window.appState.baseDate, 
            targetDate
        );
        
        window.grid.refreshForCurrentDay();
        this.updatePosition();
        window.appState.save();
        
        const milliseconds = targetDate.getMilliseconds();
        document.getElementById('currentDay').textContent = 
            window.appState.currentDay.toFixed(5) + 
            ` (${milliseconds}ms)`;
        if (window.dates) {
            window.dates.lastRecalculateUsedExactTime = true;
        }
        if (window.dateComparisonManager && window.dateComparisonManager.debouncedUpdate) {
            window.dateComparisonManager.debouncedUpdate();
        }
        } finally {
            end && end({});
        }
    }
    
    getPixelPhaseForDay(wave, effDay) {
        const periodPx = wave.period * window.appState.config.squareSize;
        const phaseOffsetPixels = window.appState.config.phaseOffsetDays * window.appState.config.squareSize;

        const currentOffsetPx = (effDay * window.appState.config.squareSize) % periodPx;
        const normalizedOffset = currentOffsetPx < 0 ? periodPx + currentOffsetPx : currentOffsetPx;

        return (2 * Math.PI * (phaseOffsetPixels + normalizedOffset)) / periodPx;
    }

    getPixelPhase(wave) {
        return this.getPixelPhaseForDay(wave, this.getEffectiveDayOffsetForWave(wave));
    }
    
    createIntersectionPoint(x, wave1, wave2, day1, day2, layer1Key = 'a', layer2Key = 'a') {
        const centerY = window.appState.config.graphHeight / 2;
        const amplitude = window.appState.config.amplitude;
        const periodPx1 = wave1.period * window.appState.config.squareSize;
        const periodPx2 = wave2.period * window.appState.config.squareSize;
        const phaseOffsetPixels = window.appState.config.phaseOffsetDays * window.appState.config.squareSize;

        const offset1 = (day1 * window.appState.config.squareSize) % periodPx1;
        const offset2 = (day2 * window.appState.config.squareSize) % periodPx2;

        const y1 = centerY - amplitude * Math.sin(2 * Math.PI * (x + offset1 + phaseOffsetPixels) / periodPx1);
        const y2 = centerY - amplitude * Math.sin(2 * Math.PI * (x + offset2 + phaseOffsetPixels) / periodPx2);
        
        if (Math.abs(y1 - y2) > 0.01) return null;
        
        return {
            x: x,
            y: (y1 + y2) / 2,
            wave1: wave1,
            wave2: wave2,
            time: this.calculateTimeFromXCoordinate(wave1, x, day1, layer1Key)
        };
    }
    
    refineIntersectionPoint(wave1, wave2, x1, x2, offset1, offset2, periodPx1, periodPx2) {
        const maxIterations = 10;
        const tolerance = 0.01;
        
        let left = x1;
        let right = x2;
        
        for (let i = 0; i < maxIterations; i++) {
            const mid = (left + right) / 2;
            
            const y1 = window.appState.config.graphHeight / 2 - 
                    window.appState.config.amplitude * 
                    Math.sin(2 * Math.PI * (mid + offset1) / periodPx1);
            
            const y2 = window.appState.config.graphHeight / 2 - 
                    window.appState.config.amplitude * 
                    Math.sin(2 * Math.PI * (mid + offset2) / periodPx2);
            
            const diff = y1 - y2;
            
            if (Math.abs(diff) < tolerance) {
                return {
                    x: mid,
                    y: (y1 + y2) / 2,
                    wave1: wave1,
                    wave2: wave2
                };
            }
            
            const y1Left = window.appState.config.graphHeight / 2 - 
                        window.appState.config.amplitude * 
                        Math.sin(2 * Math.PI * (left + offset1) / periodPx1);
            
            const y2Left = window.appState.config.graphHeight / 2 - 
                        window.appState.config.amplitude * 
                        Math.sin(2 * Math.PI * (left + offset2) / periodPx2);
            
            const diffLeft = y1Left - y2Left;
            
            if (diffLeft * diff < 0) {
                right = mid;
            } else {
                left = mid;
            }
        }
        
        return null;
    }
    
    calculateAllWaveIntersections() {
        const visibleWaves = this.getActiveWaves();
        const allIntersections = [];

        const pushLayerPair = (wi, wj, Li, Lj) => {
            const points = this.findWaveIntersectionPointsForDays(
                wi,
                wj,
                Li.day,
                Lj.day,
                Li.key,
                Lj.key
            );
            const filteredPoints = this.filterClosePoints(points, 5);
            const tag =
                Li.key !== 'a' || Lj.key !== 'a'
                    ? ` (${Li.key.toUpperCase()}×${Lj.key.toUpperCase()})`
                    : '';
            filteredPoints.forEach((point) => {
                if (point) {
                    const intersectionTime = this.calculateTimeFromXCoordinate(
                        wi,
                        point.x,
                        Li.day,
                        Li.key
                    );
                    allIntersections.push({
                        ...point,
                        time: intersectionTime,
                        wavePair: `${wi.name} × ${wj.name}${tag}`
                    });
                }
            });
        };

        for (let i = 0; i < visibleWaves.length; i++) {
            const wi = visibleWaves[i];
            const layersI = this._visibleLayersForWave(wi);
            for (let a = 0; a < layersI.length; a++) {
                for (let b = a + 1; b < layersI.length; b++) {
                    pushLayerPair(wi, wi, layersI[a], layersI[b]);
                }
            }
        }

        for (let i = 0; i < visibleWaves.length; i++) {
            for (let j = i + 1; j < visibleWaves.length; j++) {
                const wi = visibleWaves[i];
                const wj = visibleWaves[j];
                const layersI = this._visibleLayersForWave(wi);
                const layersJ = this._visibleLayersForWave(wj);
                for (const Li of layersI) {
                    for (const Lj of layersJ) {
                        pushLayerPair(wi, wj, Li, Lj);
                    }
                }
            }
        }

        return allIntersections;
    }
    
    filterClosePoints(points, minDistance) {
        if (points.length === 0) return [];
        
        const sortedPoints = points.sort((a, b) => a.x - b.x);
        const filteredPoints = [sortedPoints[0]];
        
        for (let i = 1; i < sortedPoints.length; i++) {
            const lastPoint = filteredPoints[filteredPoints.length - 1];
            
            if (Math.abs(sortedPoints[i].x - lastPoint.x) >= minDistance) {
                filteredPoints.push(sortedPoints[i]);
            }
        }
        
        return filteredPoints;
    }
    
    renderWaveIntersectionPoints() {
        const d = __waveDbg();
        if (window.appState && window.appState.waveIntersectionsVisible === false) {
            this.removeWaveIntersectionPoints();
            d && d.log('waves.renderWaveIntersectionPoints.skip', { reason: 'waveIntersectionsVisible_false' });
            return;
        }
        
        if (!window.appState.hasActivePerson()) {
            this.removeWaveIntersectionPoints();
            d && d.log('waves.renderWaveIntersectionPoints.skip', { reason: 'noActivePerson' });
            return;
        }
        
        this.removeWaveIntersectionPoints();
        
        const endCalc = d && d.t('waves.renderWaveIntersectionPoints.calculateAllWaveIntersections', {});
        const intersections = this.calculateAllWaveIntersections();
        endCalc &&
            endCalc({
                intersectionPairs: intersections.length,
                activeWaves: this.getActiveWaves().length
            });
        
        const maxPointsToShow = 50;
        const pointsToShow = intersections.slice(0, maxPointsToShow);
        
        const endDom = d && d.t('waves.renderWaveIntersectionPoints.buildDom', { pointsToShow: pointsToShow.length });
        const container = document.createElement('div');
        container.className = 'wave-intersection-points';
        container.style.position = 'absolute';
        container.style.width = '100%';
        container.style.height = '100%';
        container.style.pointerEvents = 'none';
        container.style.zIndex = '9';
        container.style.top = '0';
        container.style.left = '0';
        
        pointsToShow.forEach(point => {
            const pointElement = document.createElement('div');
            pointElement.className = 'wave-intersection-point';
            pointElement.dataset.time = point.time.toISOString();
            pointElement.dataset.wavePair = point.wavePair;
            
            const timeStr = this.formatExtremumTime(point.time);
            
            const timeBefore = new Date(point.time.getTime() - 2.5 * 60 * 1000);
            const timeAfter = new Date(point.time.getTime() + 2.5 * 60 * 1000);
            
            const timeBeforeStr = this.formatExtremumTime(timeBefore);
            const timeAfterStr = this.formatExtremumTime(timeAfter);
            
            let titleText = `${point.wavePair}\n${timeStr}`;
            titleText += `\n---`;
            titleText += `\n${timeBeforeStr} (началось)`;
            titleText += `\n${timeAfterStr} (закончилось)`;
            
            pointElement.title = titleText;
            
            pointElement.style.position = 'absolute';
            pointElement.style.left = `${point.x}px`;
            pointElement.style.top = `${point.y}px`;
            pointElement.style.width = '8px';
            pointElement.style.height = '8px';
            pointElement.style.borderRadius = '50%';
            pointElement.style.backgroundColor = '#ff0000';
            pointElement.style.border = '2px solid #fff';
            pointElement.style.cursor = 'pointer';
            pointElement.style.pointerEvents = 'auto';
            pointElement.style.zIndex = '10';
            pointElement.style.opacity = '0.9';
            pointElement.style.transform = 'translate(-50%, -50%)';
            
            pointElement.addEventListener('mouseenter', (e) => {
                e.target.style.transform = 'translate(-50%, -50%) scale(1.5)';
                e.target.style.zIndex = '15';
            });
            
            pointElement.addEventListener('mouseleave', (e) => {
                e.target.style.transform = 'translate(-50%, -50%)';
                e.target.style.zIndex = '10';
            });
            
            pointElement.addEventListener('click', (e) => {
                e.stopPropagation();
                this.navigateToIntersectionTime(point.time);
            });
            
            container.appendChild(pointElement);
        });
        
        const graphElement = document.getElementById('graphElement');
        if (graphElement) {
            graphElement.appendChild(container);
        }
        
        endDom && endDom({});
        
        return container;
    }
    
    removeWaveIntersectionPoints() {
        const d = __waveDbg();
        const nodes = document.querySelectorAll('.wave-intersection-points');
        if (d && nodes.length) {
            d.log('waves.removeWaveIntersectionPoints', { layers: nodes.length });
        }
        nodes.forEach(el => el.remove());
    }
    
    showIntersectionTooltip(element, point) {
        element.title = `${point.wave1.name} × ${point.wave2.name}\n${this.formatExtremumTime(point.time)}`;
    }
    
    hideIntersectionTooltip() {
        document.querySelectorAll('.intersection-tooltip').forEach(el => el.remove());
    }
    
    navigateToIntersectionTime(time) {
        if (window.dates && window.dates.setDate) {
            window.dates.setDate(time, true);
        }
    }
}

window.waves = new WavesManager();