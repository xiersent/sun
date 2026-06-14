/**
 * @file waves.js
 * Менеджер волн: SVG-синусоиды, слои A/B, выноски, пересечения, точки на оси X, навигация по времени.
 */
/** Хелпер профилирования waveRenderDebug. */
function __waveDbg() {
    const w = window.__waveRenderDebug;
    return w && w.isEnabled() ? w : null;
}

/**
 * Если true — `waveBold` снова добавляет класс .bold (stroke-width в CSS).
 * Сейчас false: `appState.waveBold` — флаг видимости слоя B (пара `waveVisibility` для A); UI — .sun-waveBVisibilityCheck.
 */
const WAVE_BOLD_STROKE_VISUAL_ENABLED = false;

class WavesManager {
    /** Инициализация кэшей DOM волн и выносок. */
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

    /** Проверяет, входит ли волна в включённую группу на текущем кадре (кэш или isWaveGroupEnabled). */
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

    /** Преобразует логическую точку графа в экранные координаты через wavesTransformLayer. */
    _mapLabelDisplayPoint(x, y, graphW, graphH) {
        if (window.wavesTransformLayer && window.wavesTransformLayer.mapGraphPointToDisplay) {
            return window.wavesTransformLayer.mapGraphPointToDisplay(x, y, graphW, graphH);
        }
        return { x, y };
    }

    /** Выноски вне #wavesTransformLayer — экранные координаты с учётом flip в mapLogicalOffsets. */
    _mapLabelPointForViewport(x, y) {
        const { w: lw, h: lh } = this._getLogicalGraphSize();
        return this._mapLabelDisplayPoint(x, y, lw, lh);
    }

    /** Логические размеры графа из appState (ширина и высота). */
    _getLogicalGraphSize() {
        return {
            w: window.appState.graphWidth,
            h: window.appState.config.graphHeight
        };
    }

    /** Отображаемые размеры графа с учётом поворота/масштаба transform-слоя. */
    _getDisplayGraphSize() {
        const wtl = window.wavesTransformLayer;
        if (wtl && wtl.getDisplayGraphWidth) {
            return { w: wtl.getDisplayGraphWidth(), h: wtl.getDisplayGraphHeight() };
        }
        const { w, h } = this._getLogicalGraphSize();
        return { w, h };
    }

    /**
     * Точка в #wavesMount: при 180° без flip — логические px (поворот слоя через CSS);
     * иначе mapGraphPointToLayer (flip — CSS scale на #wavesTransformLayer).
     */
    _mapOverlayPoint(logicalX, logicalY) {
        const { w: lw, h: lh } = this._getLogicalGraphSize();
        const wtl = window.wavesTransformLayer;
        if (wtl && wtl.getRotationQuarter() === 2) {
            const flip =
                (wtl.isScaleXFlipped && wtl.isScaleXFlipped()) ||
                (wtl.isScaleYFlipped && wtl.isScaleYFlipped());
            if (!flip) {
                return { x: logicalX, y: logicalY };
            }
        }
        if (wtl && wtl.mapGraphPointToLayer) {
            return wtl.mapGraphPointToLayer(logicalX, logicalY, lw, lh);
        }
        return this._mapLabelDisplayPoint(logicalX, logicalY, lw, lh);
    }

    /** Y-начало для SVG-пути при вертикальной прокрутке волны (ось дней вдоль display Y). */
    _getWavePathScrollOriginY() {
        const { w: lw } = this._getLogicalGraphSize();
        const { h: dh } = this._getDisplayGraphSize();
        return dh / 2 - lw / 2;
    }

    /** Определяет ось и слот (left/right/top/bottom) для выноски по логическому краю. */
    _resolveWaveLabelPlacement(logicalEdge) {
        if (window.wavesTransformLayer && window.wavesTransformLayer.resolveWaveLabelPlacement) {
            return window.wavesTransformLayer.resolveWaveLabelPlacement(logicalEdge);
        }
        if (logicalEdge === 'left' || logicalEdge === 'right') {
            return { axis: 'horizontal', slot: logicalEdge };
        }
        return { axis: 'vertical', slot: logicalEdge };
    }

    /** Возвращает DOM-контейнер полосы выносок по слоту (left, right, top, bottom). */
    _getWaveLabelContainer(slot) {
        const map = {
            left: '.sun-waveLabelsLeft',
            right: '.sun-waveLabelsRight',
            top: '.sun-waveLabelsTop',
            bottom: '.sun-waveLabelsBottom'
        };
        return document.querySelector(map[slot]);
    }

    /** Сбрасывает inline-стили позиционирования элемента выноски. */
    _resetWaveLabelPositionStyles(el) {
        el.style.left = '';
        el.style.right = '';
        el.style.top = '';
        el.style.bottom = '';
        el.style.marginLeft = '';
        el.style.marginRight = '';
        el.style.marginTop = '';
        el.style.marginBottom = '';
        el.style.width = 'auto';
        el.style.maxWidth = '';
    }

    /** Имя волны (боковые выноски; при повороте могут оказаться в полосах top/bottom). */
    _applyWaveNameTypography(el) {
        el.classList.remove('sun-waveLabelExtremum');
        el.classList.add('sun-waveLabelName');
        el.style.fontFamily = '';
        el.style.letterSpacing = '';
        el.style.textAlign = '';
        const textEl = el.querySelector('.sun-waveLabelText');
        if (textEl) {
            textEl.style.textAlign = '';
        }
    }

    /** Время экстремума (верх/низ или боковые полосы после поворота). */
    _applyExtremumTimeTypography(el) {
        el.classList.remove('sun-waveLabelName');
        el.classList.add('sun-waveLabelExtremum');
        el.style.fontFamily = '';
        el.style.letterSpacing = '';
        const textEl = el.querySelector('.sun-waveLabelText');
        if (textEl) {
            textEl.style.textAlign = 'center';
        }
    }

    /** Расставляет выноску по оси horizontal/vertical в экранных координатах. */
    _applyWaveLabelLayout(el, placement, displayPoint) {
        el.dataset.labelType = placement.axis;
        this._resetWaveLabelPositionStyles(el);
        if (placement.axis === 'horizontal') {
            el.style.top = `${displayPoint.y}px`;
            el.style.transform = 'translateY(-50%)';
        } else {
            el.style.left = `${displayPoint.x}px`;
            el.style.transform = 'translateX(-50%)';
        }
    }

    /** Синхронизирует геометрию стрелки выноски (горизонтальная или вертикальная полоса). */
    _syncWaveLabelGeometry(el, placement, waveColor) {
        if (placement.axis === 'horizontal') {
            this._syncHorizontalLabelSideGeometry(el, placement.slot, waveColor);
        } else {
            this._syncVerticalLabelBandGeometry(el, placement.slot, waveColor);
        }
    }

    /** Удаляет устаревшие элементы выносок из всех четырёх полос. */
    _cleanupWaveLabelContainers(activeDomIds) {
        [
            document.querySelector('.sun-waveLabelsLeft'),
            document.querySelector('.sun-waveLabelsRight'),
            document.querySelector('.sun-waveLabelsTop'),
            document.querySelector('.sun-waveLabelsBottom')
        ].forEach((container) => {
            if (container) {
                this._removeStaleLabelElements(container, '.sun-waveLabel', activeDomIds);
            }
        });
    }

    /** Преобразует логическую Y-координату в отображаемую (flip/поворот). */
    _mapLabelDisplayY(y, graphH) {
        if (window.wavesTransformLayer && window.wavesTransformLayer.mapDisplayY) {
            return window.wavesTransformLayer.mapDisplayY(y, graphH);
        }
        return y;
    }

    /** Преобразует логическую X-координату в отображаемую (flip/поворот). */
    _mapLabelDisplayX(x, graphW) {
        if (window.wavesTransformLayer && window.wavesTransformLayer.mapDisplayX) {
            return window.wavesTransformLayer.mapDisplayX(x, graphW);
        }
        return x;
    }

    /** Возвращает визуальную сторону боковой выноски с учётом flip раскладки. */
    _horizontalLabelSideForFlip(side) {
        return this._resolveWaveLabelPlacement(side).slot;
    }

    /** Возвращает визуальную полосу (top/bottom) вертикальной выноски с учётом flip. */
    _verticalLabelBandForFlip(position) {
        return this._resolveWaveLabelPlacement(position).slot;
    }

    /** True, если оси волн и дней поменяны местами (вертикальная прокрутка). */
    _isWaveAxisSwapped() {
        return !!(
            window.wavesTransformLayer &&
            window.wavesTransformLayer.isAxisSwapped &&
            window.wavesTransformLayer.isAxisSwapped()
        );
    }

    /** Пересобирает размеры контейнеров и SVG-пути волн после смены transform-раскладки. */
    rebuildForTransformLayout() {
        const graphW = window.appState.graphWidth;
        const graphH = window.appState.config.graphHeight;
        window.appState.data.waves.forEach((wave) => {
            const waveIdStr = String(wave.id);
            const container = this.waveContainers[wave.id] || this.waveContainers[waveIdStr];
            if (!container) {
                return;
            }
            const periodPx =
                window.appState.periods[wave.id] ||
                wave.period * window.appState.config.squareSize;
            const totalPeriods = parseInt(container.dataset.totalPeriods, 10) ||
                this.calculateRequiredPeriods(periodPx);
            const swapped = this._isWaveAxisSwapped();
            if (swapped) {
                container.classList.add('sun-waveContainerSwapped');
                const containerHeight = periodPx * totalPeriods;
                container.style.width = '100%';
                container.style.height = `${containerHeight}px`;
            } else {
                container.classList.remove('sun-waveContainerSwapped');
                const containerWidth = periodPx * totalPeriods;
                container.style.width = `${containerWidth}px`;
                container.style.height = '100%';
            }
            const path = this.wavePaths[wave.id] || this.wavePaths[waveIdStr];
            const pathB = this.waveBPaths[wave.id] || this.waveBPaths[waveIdStr];
            this.generateSineWave(periodPx, path, container, totalPeriods);
            if (pathB) {
                this.generateSineWave(periodPx, pathB, container, totalPeriods);
            }
        });
    }

    /** Точка монтирования волн и волновых оверлеев (внутри #wavesTransformLayer) */
    _getWavesMountElement() {
        if (window.wavesTransformLayer && window.wavesTransformLayer.getMountElement) {
            const mount = window.wavesTransformLayer.getMountElement();
            if (mount) {
                return mount;
            }
        }
        return window.dom.byKey('graphElement');
    }

    /** См. WAVE_BOLD_STROKE_VISUAL_ENABLED — для внешних модулей (например сохранение стиля волны). */
    isBoldStrokeVisualEnabled() {
        return WAVE_BOLD_STROKE_VISUAL_ENABLED;
    }

    /** Первичная инициализация: создание DOM волн и первый updatePosition. */
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

    /**
     * Число периодов синусоиды в SVG для покрытия viewport с запасом.
     * @param {number} periodPx период волны в пикселях
     * @returns {number}
     */
    calculateRequiredPeriods(periodPx) {
        const wtl = window.wavesTransformLayer;
        const viewportWidth =
            wtl && wtl.isAxisSwapped && wtl.isAxisSwapped()
                ? wtl.getDisplayGraphHeight()
                : window.appState.graphWidth;
        
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

    /** True, если волна входит хотя бы в одну включённую группу. */
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

    /** Нужно ли рисовать полупрозрачную синусоиду персоны B для данной волны. */
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
        if (!this.isWaveGroupEnabled(waveId)) {
            return false;
        }
        const waveIdStr = String(waveId);
        if (window.appState.waveVisibility[waveIdStr] !== false) {
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

    /** Полное пересоздание DOM контейнеров волн, выносок и точек оси X. */
    createVisibleWaveElements() {
        const d = __waveDbg();
        const endAll = d && d.t('waves.createVisibleWaveElements', {});
        let createdCount = 0;
        try {
            const endClear = d && d.t('waves.createVisibleWaveElements.clearDom', {});
            document.querySelectorAll('.sun-waveContainer').forEach(c => c.remove());
            document.querySelectorAll('.sun-waveLabel').forEach(l => l.remove());
            
            const axisXPointsContainer = document.querySelector('.sun-waveAxisXPoints');
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
                document.querySelectorAll('.sun-waveContainer').forEach((c) => c.remove());
                document.querySelectorAll('.sun-waveLabel').forEach((l) => l.remove());
                const axisXPointsContainer = document.querySelector('.sun-waveAxisXPoints');
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

                        const leftLabel = window.dom.byKey(`waveLabel${waveIdStr}-left`);
                        const rightLabel = window.dom.byKey(`waveLabel${waveIdStr}-right`);
                        const leftB = window.dom.byKey(`waveLabel${waveIdStr}-left-person-b`);
                        const rightB = window.dom.byKey(`waveLabel${waveIdStr}-right-person-b`);
                        if (leftLabel) leftLabel.remove();
                        if (rightLabel) rightLabel.remove();
                        if (leftB) leftB.remove();
                        if (rightB) rightB.remove();
                        document
                            .querySelectorAll(`.sun-waveLabel.sun-vertical[data-wave-id="${waveIdStr}"]`)
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

    /** Создаёт DOM-контейнер одной волны: SVG, пути A/B, монтирование в #wavesMount. */
    createWaveElement(wave) {
        const d = __waveDbg();
        const verbose = d && d.isVerbose && d.isVerbose();
        const endWave = verbose && d.t('waves.createWaveElement', { id: wave.id, name: wave.name });
        try {
        const container = document.createElement('div');
        const swapped = this._isWaveAxisSwapped();
        container.className = 'sun-waveContainer';
        if (swapped) {
            container.classList.add('sun-waveContainerSwapped');
        }
        container.id = `waveContainer${wave.id}`;
        
        const periodPx = wave.period * window.appState.config.squareSize;
        
        const totalPeriods = this.calculateRequiredPeriods(periodPx);
        const totalSpan = periodPx * totalPeriods;
        const containerWidth = swapped ? null : totalSpan;
        
        container.style.width = swapped ? '100%' : `${containerWidth}px`;
        container.style.height = swapped ? `${totalSpan}px` : '100%';
        container.style.position = 'absolute';
        container.style.top = '0';
        container.style.left = '0';
        
        container.dataset.totalPeriods = totalPeriods;
        container.dataset.periodPx = periodPx;
        container.dataset.wavePeriod = wave.period;
        container.dataset.waveId = wave.id;
        
        const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        svg.classList.add('sun-wave');
        svg.setAttribute('preserveAspectRatio', 'none');
        const { w: dw, h: dh } = this._getDisplayGraphSize();
        const lh = window.appState.config.graphHeight;
        svg.setAttribute(
            'viewBox',
            swapped ? `0 0 ${dw} ${totalSpan}` : `0 0 ${containerWidth || dw} ${lh}`
        );
        svg.style.width = '100%';
        svg.style.height = '100%';
        
        const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
        path.classList.add('sun-wavePath');
        path.id = `wavePath${wave.id}`;
        path.style.stroke = wave.color;

        const pathB = document.createElementNS('http://www.w3.org/2000/svg', 'path');
        pathB.classList.add('sun-wavePath', 'sun-wavePathPersonB');
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
            path.classList.add('sun-bold');
        }

        const gA = document.createElementNS('http://www.w3.org/2000/svg', 'g');
        gA.classList.add('sun-waveSvgLayer', 'sun-waveSvgLayerA');
        const gB = document.createElementNS('http://www.w3.org/2000/svg', 'g');
        gB.classList.add('sun-waveSvgLayer', 'sun-waveSvgLayerB');
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
        
        const mount = this._getWavesMountElement();
        if (mount) {
            mount.appendChild(container);
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

    /**
     * Генерирует SVG path синусоиды в контейнере волны.
     * @param {number} periodPx период в пикселях
     * @param {number} [totalPeriods=3] число периодов в path
     */
    generateSineWave(periodPx, wavePath, waveContainer, totalPeriods = 3) {
        const { w: lw, h: lh } = this._getLogicalGraphSize();
        const { w: dw, h: dh } = this._getDisplayGraphSize();
        const swapped = this._isWaveAxisSwapped();
        const totalSpan = periodPx * totalPeriods;
        const points = 1500;
        const step = totalSpan / points;

        const phaseOffsetPixels = window.appState.config.phaseOffsetDays * window.appState.config.squareSize;
        const centerY = lh / 2;
        const amplitude = window.appState.config.amplitude;
        const scrollOriginY = this._getWavePathScrollOriginY();

        const waveSvg = waveContainer.querySelector('.sun-wave');
        if (waveSvg) {
            waveSvg.setAttribute(
                'viewBox',
                swapped ? `0 0 ${dw} ${totalSpan}` : `0 0 ${totalSpan} ${lh}`
            );
        }

        let pathData = '';
        for (let i = 0; i <= points; i++) {
            const logicalX = i * step;
            const logicalY =
                centerY -
                amplitude * Math.sin((2 * Math.PI * (logicalX + phaseOffsetPixels)) / periodPx);
            let px;
            let py;
            if (swapped) {
                const d = this._mapOverlayPoint(logicalX, logicalY);
                px = d.x;
                py = d.y - scrollOriginY;
            } else {
                px = logicalX;
                py = logicalY;
            }
            pathData += `${i === 0 ? 'M' : 'L'}${px},${py} `;
        }

        if (wavePath) {
            wavePath.setAttribute('d', pathData);
        }

        const waveId = waveContainer.dataset.waveId;
        if (waveId) {
            window.appState.periods[waveId] = periodPx;
        }
    }

    /** Обновляет размер контейнера и перегенерирует path A/B при смене periodPx. */
    updateWaveContainer(waveId, periodPx) {
        const container = this.waveContainers[waveId];
        if (container) {
            const totalPeriods = this.calculateRequiredPeriods(periodPx);
            const swapped = this._isWaveAxisSwapped();
            container.dataset.totalPeriods = totalPeriods;
            container.dataset.periodPx = periodPx;
            if (swapped) {
                container.style.width = '100%';
                container.style.height = `${periodPx * totalPeriods}px`;
            } else {
                container.style.width = `${periodPx * totalPeriods}px`;
                container.style.height = '100%';
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

    /** Список волн, для которых нужен графический контейнер на текущей дате. */
    getActiveWaves() {
        return window.appState.data.waves.filter((wave) => this.waveNeedsGraphContainer(wave.id));
    }
    
    // ========== НОВЫЕ МЕТОДЫ ДЛЯ ПОДСВЕТКИ ЭКСТРЕМУМОВ ==========
    
    /** Состояние сигнала (−5…+5) в центре графа — то, что видно после «Перейти к дате». */
    calculateWaveStateAtGraphCenter(wave, effDay) {
        const graphW = window.appState.graphWidth;
        const y = this.calculateWaveYAtXForDay(wave, graphW / 2, effDay);
        const centerY = window.appState.config.graphHeight / 2;
        const amplitude = window.appState.config.amplitude;
        if (!amplitude) {
            return 0;
        }
        return -((y - centerY) / amplitude) * 5;
    }

    /** Направление сигнала в центре графа. */
    calculateWaveDirectionAtGraphCenter(wave, effDay) {
        const f = this._getVisualCycleFractionAtGraphCenter(wave, effDay);
        const deriv = Math.cos(f * 2 * Math.PI);
        const flatEps = 0.08;
        if (Math.abs(deriv) < flatEps) {
            return 0;
        }
        return deriv > 0 ? 1 : -1;
    }

    /** Доля цикла в центре графа (фаза для поиска моментов внутри суток). */
    _getVisualCycleFractionAtGraphCenter(wave, effDay) {
        const sq = window.appState.config.squareSize;
        const wavePeriodPixels =
            window.appState.periods[wave.id] || wave.period * sq;
        if (!wavePeriodPixels || wavePeriodPixels <= 0) {
            return 0;
        }
        const graphW = window.appState.graphWidth;
        const phaseOffsetPixels = (window.appState.config.phaseOffsetDays || 0) * sq;
        let currentOffsetPx = (effDay * sq) % wavePeriodPixels;
        if (currentOffsetPx < 0) {
            currentOffsetPx += wavePeriodPixels;
        }
        const relativeX = graphW / 2 + currentOffsetPx;
        return this._normalizeCycleFraction((relativeX + phaseOffsetPixels) / wavePeriodPixels);
    }

    /**
     * Значение sin-волны в точке дня (амplitude × sin), шкала ±5.
     * Совпадает с центром графа (не использует phaseOffsetDays в формуле дней).
     * @returns {number}
     */
    calculateWaveStateAtDay(wave, currentDay) {
        if (!wave.period || wave.period <= 0) {
            return 0;
        }
        return this.calculateWaveStateAtGraphCenter(wave, currentDay);
    }

    /**
     * Направление волны в моменте day: +1 восходящая, −1 низходящая, 0 у экстремума (плоско).
     */
    calculateWaveDirectionAtDay(wave, currentDay) {
        if (!wave.period || wave.period <= 0) {
            return 0;
        }
        return this.calculateWaveDirectionAtGraphCenter(wave, currentDay);
    }

    /** Символ направления волны для UI: ↑, ↓ или —. */
    formatWaveDirectionLabel(dir) {
        if (dir > 0) return '↑';
        if (dir < 0) return '↓';
        return '—';
    }

    /** Текстовое описание направления волны для title/tooltip. */
    formatWaveDirectionTitle(dir) {
        if (dir > 0) return 'восходящая';
        if (dir < 0) return 'низходящая';
        return 'экстремум';
    }

    /** Доли цикла [0,1), где 5·sin(2πf) = k (целое −5…5). */
    getCycleFractionsForIntegerState(k) {
        k = Math.round(Number(k));
        if (k === 5) {
            return [0.25];
        }
        if (k === -5) {
            return [0.75];
        }
        if (k === 0) {
            return [0, 0.5];
        }
        if (k > 5 || k < -5) {
            return [];
        }
        const s = k / 5;
        const a = Math.asin(s) / (2 * Math.PI);
        const b = (Math.PI - Math.asin(s)) / (2 * Math.PI);
        return [a, b];
    }

    _normalizeCycleFraction(f) {
        let x = f % 1;
        if (x < 0) {
            x += 1;
        }
        return x;
    }

    /**
     * Доли суток [0,1), когда fract(p0 + d/P) = targetF (p0 — доля цикла в полночь).
     */
    getDayFractionsForCycleTarget(p0, periodDays, targetF) {
        const hits = [];
        const p = periodDays;
        const tf = this._normalizeCycleFraction(targetF);
        const from = -Math.ceil(p) - 3;
        const to = Math.ceil(p) + 3;
        for (let m = from; m <= to; m++) {
            const d = p * (m + tf - p0);
            if (d >= 0 && d < 1 - 1e-12) {
                hits.push(d);
            }
        }
        return hits;
    }

    /** effDay от даты рождения (как recalculateCurrentDay). @param {number} [birthTimeMs] */
    getEffDayFromTimestamp(timestamp, birthTimeMs) {
        const birthMs =
            birthTimeMs != null
                ? birthTimeMs
                : typeof window.appState.baseDate === 'number'
                  ? window.appState.baseDate
                  : new Date(window.appState.baseDate).getTime();
        if (window.dates && typeof window.dates.computeDayOffsetFromBirth === 'function') {
            return window.dates.computeDayOffsetFromBirth(birthMs, timestamp, true);
        }
        return (timestamp - birthMs) / (24 * 60 * 60 * 1000);
    }

    /** effDay в полночь birthDayIndex-го календарного дня от birthTimeMs. */
    getEffDayAtBirthCalendarDay(birthDayIndex, birthTimeMs) {
        const d = this.getCalendarDateFromBirthDayIndex(birthDayIndex, 0, birthTimeMs);
        return this.getEffDayFromTimestamp(d.getTime(), birthTimeMs);
    }

    /** Календарная дата: birth + birthDayIndex суток + доля суток. @param {number} [birthTimeMs] */
    getCalendarDateFromBirthDayIndex(birthDayIndex, dayFraction, birthTimeMs) {
        const baseMs =
            birthTimeMs != null
                ? birthTimeMs
                : typeof window.appState.baseDate === 'number'
                  ? window.appState.baseDate
                  : new Date(window.appState.baseDate).getTime();
        const baseDate = new Date(baseMs);
        const d = new Date(baseDate);
        d.setDate(d.getDate() + Math.floor(birthDayIndex));
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

    /** Совпадение sin-состояния с целым уровнем −5…5. */
    stateMatchesIntegerTarget(state, target, epsilon) {
        const eps = epsilon != null ? epsilon : 0.02;
        const t = Math.round(Number(target));
        if (t === 5) {
            return state > 0 && Math.abs(state - 5) <= eps;
        }
        if (t === -5) {
            return state < 0 && Math.abs(state + 5) <= eps;
        }
        if (t === 0) {
            return Math.abs(state) <= eps;
        }
        if (t > 0) {
            return state > 0 && Math.abs(state - t) <= eps;
        }
        if (t < 0) {
            return state < 0 && Math.abs(state - t) <= eps;
        }
        return Math.abs(state - t) <= eps;
    }

    /**
     * Точные моменты (ms) внутри birthDayIndex-го дня, когда сигнал в targetState.
     * @param {number|null} direction +1, −1, 0 или null (любое)
     * @param {number} [birthTimeMs] дата рождения персоны (по умолчанию baseDate / A)
     * @returns {number[]}
     */
    findStateHitTimestampsOnBirthDay(wave, birthDayIndex, targetState, direction, birthTimeMs) {
        if (!wave.period || wave.period <= 0) {
            return [];
        }
        const effDayStart = this.getEffDayAtBirthCalendarDay(birthDayIndex, birthTimeMs);
        const p0 = this._getVisualCycleFractionAtGraphCenter(wave, effDayStart);
        const targetFractions = this.getCycleFractionsForIntegerState(targetState);
        const hits = [];

        for (let ti = 0; ti < targetFractions.length; ti++) {
            const targetF = this._normalizeCycleFraction(targetFractions[ti]);
            const dayFracs = this.getDayFractionsForCycleTarget(p0, wave.period, targetF);
            for (let di = 0; di < dayFracs.length; di++) {
                const ts = this.getCalendarDateFromBirthDayIndex(
                    birthDayIndex,
                    dayFracs[di],
                    birthTimeMs
                ).getTime();
                const effDay = this.getEffDayFromTimestamp(ts, birthTimeMs);
                const state = this.calculateWaveStateAtDay(wave, effDay);
                if (!this.stateMatchesIntegerTarget(state, targetState)) {
                    continue;
                }
                if (direction != null) {
                    const dir = this.calculateWaveDirectionAtDay(wave, effDay);
                    if (dir !== direction) {
                        continue;
                    }
                }
                hits.push(ts);
            }
        }

        hits.sort((a, b) => a - b);
        return hits;
    }

    /** Включена ли подсветка экстремумов красным цветом stroke и выносок. */
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

    /**
     * Главный кадр: сдвиг волн, экстремумы, пересечения, выноски, точки оси X.
     * @param {Object} [opts] forceWaveLabels — обход throttle; light — только transform волн
     */
    updatePosition(opts = {}) {
        const light = opts.light === true;
        const d = __waveDbg();
        const endTotal = d && d.t('waves.updatePosition', { forceWaveLabels: !!opts.forceWaveLabels, light });
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
            if (!light) {
                const endTb = d && d.t('waves.updatePosition.timeBar', {});
                if (window.timeBarManager && window.timeBarManager.updateTimeIndicator) {
                    window.timeBarManager.updateTimeIndicator();
                }
                endTb && endTb({});
            }
            
            if (!window.appState.hasActivePerson()) {
                window.sunWaveLayerBLog &&
                    window.sunWaveLayerBLog('updatePosition:skip (no active person)');
                this.removeWaveIntersectionPoints();
                return;
            }
            
            if (!light) {
                const endGrid = d && d.t('waves.updatePosition.gridOffset', {});
                if (window.grid && window.grid.updateGridOffset) {
                    window.grid.updateGridOffset();
                }
                endGrid && endGrid({});
            }
            
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
                if (highlight) {
                    this.setWaveStrokeColor(wave.id, isExtremumA, isExtremumB);
                } else {
                    this.setWaveStrokeColor(wave.id, false, false);
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
                            'sun-bold',
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
                        const svg = container.querySelector('svg.sun-wave');
                        const gA = svg && svg.querySelector('.sun-waveSvgLayerA');
                        const gB = svg && svg.querySelector('.sun-waveSvgLayerB');
                        if (gA && gB) {
                            layerBRepairedFromDom = true;
                            layers = { a: gA, b: gB };
                            this.wavePathLayerGroups[wave.id] = layers;
                            this.wavePathLayerGroups[waveIdStr] = layers;
                        }
                    }
                    if (layers && layers.a && layers.b) {
                        const wtl = window.wavesTransformLayer;
                        const scrollPx =
                            wtl && wtl.getWaveLayerScrollPx
                                ? wtl.getWaveLayerScrollPx(currentPositionPx)
                                : -currentPositionPx;
                        if (this._isWaveAxisSwapped()) {
                            layers.a.setAttribute('transform', `translate(0,${scrollPx})`);
                        } else {
                            layers.a.setAttribute('transform', `translate(${scrollPx},0)`);
                        }
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
                                const scrollPxB =
                                    wtl && wtl.getWaveLayerScrollPx
                                        ? wtl.getWaveLayerScrollPx(posB)
                                        : -posB;
                                if (this._isWaveAxisSwapped()) {
                                    layers.b.setAttribute('transform', `translate(0,${scrollPxB})`);
                                } else {
                                    layers.b.setAttribute('transform', `translate(${scrollPxB},0)`);
                                }
                                layers.b.removeAttribute('display');
                            } else {
                                layers.b.setAttribute('display', 'none');
                            }
                        } else {
                            layers.b.setAttribute('display', 'none');
                        }
                    } else {
                        const scrollPx =
                            wtl && wtl.getWaveLayerScrollPx
                                ? wtl.getWaveLayerScrollPx(currentPositionPx)
                                : -currentPositionPx;
                        if (this._isWaveAxisSwapped()) {
                            container.style.transform = `translateY(${scrollPx}px)`;
                        } else {
                            container.style.transform = `translateX(${scrollPx}px)`;
                        }
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

            const endInter = d && d.t('waves.updatePosition.renderWaveIntersectionPoints', {});
            this.renderWaveIntersectionPoints();
            endInter && endInter({});

            const endAxis = d && d.t('waves.updatePosition.axisXPoints', {});
            this.updateAxisXIntersectionPoints();
            endAxis && endAxis({});

            const labelOpts = {
                ...opts,
                forceWaveLabels: !!(opts.forceWaveLabels || light),
                skipStaleCleanup: true
            };
            const activeDomIds = new Set();
            this.updateHorizontalWaveLabels({ ...labelOpts, activeDomIds });
            this.updateVerticalWaveLabels({ activeDomIds });
            this._cleanupWaveLabelContainers(activeDomIds);

            const endVTime = d && d.t('waves.updatePosition.verticalWaveLabelsTime', {});
            this.updateVerticalWaveLabelsTime();
            endVTime && endVTime({});
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

    /** Задаёт фон, текст и цвет стрелки выноски (обычный или экстремум). */
    _applyLabelColors(el, wave, isExtremum) {
        const color = isExtremum ? '#ff0000' : wave.color;
        const textColor = this.getContrastTextColor(color);
        el.style.backgroundColor = color;
        el.style.color = textColor;
        const arrow = el.querySelector('.sun-waveLabelArrow');
        if (!arrow) return;
        const side = el.dataset.side;
        if (side === 'left') {
            arrow.style.borderColor = `transparent transparent transparent ${color}`;
        } else if (side === 'right') {
            arrow.style.borderColor = `transparent ${color} transparent transparent`;
        } else if (el.dataset.labelType === 'vertical') {
            const band = el.dataset.visualBand || el.dataset.position;
            if (band === 'bottom') {
                arrow.style.borderColor = `transparent transparent ${color} transparent`;
            } else {
                arrow.style.borderColor = `${color} transparent transparent transparent`;
            }
        }
    }

    /** Отдельная подсветка экстремумов для слоёв A и B (оба могут быть на графике). */
    updateWaveLabelsColorForLayers(waveId, hasLayerA, hasLayerB, isExtremumA, isExtremumB) {
        const waveIdStr = String(waveId);
        const wave = window.appState.data.waves.find(w => String(w.id) === waveIdStr);
        if (!wave) return;

        if (hasLayerA) {
            const leftA = window.dom.byKey(`waveLabel${waveIdStr}-left`);
            const rightA = window.dom.byKey(`waveLabel${waveIdStr}-right`);
            if (leftA) this._applyLabelColors(leftA, wave, isExtremumA);
            if (rightA) this._applyLabelColors(rightA, wave, isExtremumA);
            document
                .querySelectorAll(`.sun-waveLabel.sun-vertical[data-wave-id="${waveIdStr}"][data-wave-layer="a"]`)
                .forEach((label) => this._applyLabelColors(label, wave, isExtremumA));
        }
        if (hasLayerB) {
            const leftB = window.dom.byKey(`waveLabel${waveIdStr}-left-person-b`);
            const rightB = window.dom.byKey(`waveLabel${waveIdStr}-right-person-b`);
            if (leftB) this._applyLabelColors(leftB, wave, isExtremumB);
            if (rightB) this._applyLabelColors(rightB, wave, isExtremumB);
            document
                .querySelectorAll(`.sun-waveLabel.sun-vertical[data-wave-id="${waveIdStr}"][data-wave-layer="b"]`)
                .forEach((label) => this._applyLabelColors(label, wave, isExtremumB));
        }
    }

    /** Пересобирает все выноски и точки пересечения с осью X (без throttle). */
    updateAllWaveLabels(opts = {}) {
        const d = __waveDbg();
        const end = d && d.t('waves.updateAllWaveLabels', { forceWaveLabels: !!opts.forceWaveLabels });
        try {
            const activeDomIds = new Set();
            this.updateHorizontalWaveLabels({ ...opts, activeDomIds, skipStaleCleanup: true });
            this.updateVerticalWaveLabels({ activeDomIds, skipStaleCleanup: true });
            this._cleanupWaveLabelContainers(activeDomIds);
            this.updateAxisXIntersectionPoints();
        } finally {
            end && end({});
        }
    }

    /** DOM id боковой выноски: waveLabel{id}-{side}[-person-b]. */
    _horizontalWaveLabelDomId(waveId, side, layerKey) {
        const suffix = layerKey === 'b' ? '-person-b' : '';
        return `waveLabel${waveId}-${side}${suffix}`;
    }

    /** DOM id вертикальной выноски экстремума с индексом и слоем. */
    _verticalWaveLabelDomId(waveId, position, index, layerKey) {
        const suffix = layerKey === 'b' ? '-person-b' : '';
        return `waveLabel${waveId}-${position}-${index}${suffix}`;
    }

    /** Ключ data-axis-key для точки пересечения волны с осью X. */
    _axisXPointKey(waveId, layerKey, x) {
        return `${String(waveId)}-${layerKey}-${Math.round(x * 100)}`;
    }

    /** Удаляет из контейнера выноски, отсутствующие в activeDomIds. */
    _removeStaleLabelElements(container, selector, activeDomIds) {
        container.querySelectorAll(selector).forEach((el) => {
            if (activeDomIds.has(el.id)) {
                return;
            }
            if (el.id && el.id.startsWith('waveLabel')) {
                const cacheKey = el.id.slice('waveLabel'.length);
                delete this.waveLabelElements[cacheKey];
            }
            el.remove();
        });
    }

    /**
     * Боковые выноски (имя волны): полное обновление текста, позиции и геометрии.
     */
    _syncHorizontalWaveLabelContent(el, wave, displayPoint, logicalEdge, placement, layerKey, effDay) {
        const waveIdStr = String(wave.id);
        el.dataset.waveId = waveIdStr;
        el.dataset.waveLayer = layerKey;
        el.dataset.logicalEdge = logicalEdge;
        delete el.dataset.logicalBand;
        delete el.dataset.refX;
        delete el.dataset.extremumTime;
        delete el.dataset.visualBand;
        delete el.dataset.position;

        const textEl = el.querySelector('.sun-waveLabelText');
        if (textEl) {
            textEl.textContent = wave.name;
        }

        const state = this.calculateWaveStateAtDay(wave, effDay);
        const isExtremum =
            this.isExtremumHighlightEnabled() && (state >= 4 || state <= -4);
        this._applyLabelColors(el, wave, isExtremum);
        const fill = isExtremum ? '#ff0000' : wave.color || '#666666';
        this._applyWaveLabelLayout(el, placement, displayPoint);
        this._syncWaveLabelGeometry(el, placement, fill);
        this._applyWaveNameTypography(el);
    }

    /** Сброс боковых выносок при смене раскладки (поворот/сброс transform). */
    clearSideWaveLabelsAfterLayoutChange() {
        document.querySelectorAll('.sun-waveLabel[data-logical-edge]').forEach((el) => {
            if (el.id && el.id.startsWith('waveLabel')) {
                delete this.waveLabelElements[el.id.slice('waveLabel'.length)];
            }
            el.remove();
        });
        this.lastUpdateTime = 0;
    }

    /** Определяет визуальную сторону (left/right) боковой выноски по DOM-родителю. */
    _sideFromLabelElement(el) {
        if (el.closest('.sun-waveLabelsLeft')) {
            return 'left';
        }
        if (el.closest('.sun-waveLabelsRight')) {
            return 'right';
        }
        return el.dataset.visualSide || el.dataset.side || 'left';
    }

    /**
     * Стрелка к графику: left-полоса — справа плашки вправо; right-полоса — слева плашки влево.
     * @param {'left'|'right'} side
     */
    _syncHorizontalLabelSideGeometry(el, side, waveColor) {
        const color = waveColor || el.style.backgroundColor || '#666666';
        const layerKey = el.dataset.waveLayer || 'a';
        el.className =
            layerKey === 'b'
                ? `sun-waveLabel sun-horizontal sun-${side} sun-waveLabelPersonB`
                : `sun-waveLabel sun-horizontal sun-${side}`;
        el.dataset.visualSide = side;
        el.dataset.side = side;

        el.style.left = '';
        el.style.right = '';
        el.style.marginLeft = '';
        el.style.marginRight = '';

        let arrow = el.querySelector('.sun-waveLabelArrow');
        if (!arrow) {
            arrow = document.createElement('div');
            arrow.className = 'sun-waveLabelArrow';
            el.appendChild(arrow);
        }

        arrow.style.position = 'absolute';
        arrow.style.top = '50%';
        arrow.style.bottom = '';
        arrow.style.left = '';
        arrow.style.right = '';
        arrow.style.width = '0';
        arrow.style.height = '0';
        arrow.style.borderStyle = 'solid';
        arrow.style.zIndex = '1';
        arrow.style.transform = 'translateY(-50%)';

        const edgeGap = '6px';

        if (side === 'left') {
            el.style.right = '0';
            el.style.marginRight = edgeGap;
            arrow.style.right = '-6px';
            arrow.style.borderWidth = '4px 0 4px 6px';
            arrow.style.borderColor = `transparent transparent transparent ${color}`;
        } else {
            el.style.left = '0';
            el.style.marginLeft = edgeGap;
            arrow.style.left = '-6px';
            arrow.style.borderWidth = '4px 6px 4px 0';
            arrow.style.borderColor = `transparent ${color} transparent transparent`;
        }

    }

    /** Обновляет текст, позицию и стиль вертикальной выноски времени экстремума. */
    _syncVerticalWaveLabelContent(el, wave, x, effDay, layerKey, logicalBand) {
        const graphW = window.appState.graphWidth;
        const graphH = window.appState.config.graphHeight;
        const amplitude = window.appState.config.amplitude;
        const logical =
            logicalBand ||
            el.dataset.logicalBand ||
            this._bandFromLabelElement(el);
        el.dataset.logicalBand = logical;
        const graphY =
            logical === 'top' ? graphH / 2 - amplitude : graphH / 2 + amplitude;
        const displayPoint = this._mapLabelPointForViewport(x, graphY);
        const placement = this._resolveWaveLabelPlacement(logical);
        this._applyWaveLabelLayout(el, placement, displayPoint);
        el.dataset.refX = String(x);
        const extremumTime = this.calculateTimeFromXCoordinate(wave, x, effDay, layerKey);
        el.dataset.extremumTime = String(extremumTime.getTime());
        const textEl = el.querySelector('.sun-waveLabelText');
        if (textEl) {
            textEl.textContent = this.formatExtremumTime(extremumTime);
        }
        const state = this.calculateWaveStateAtDay(wave, effDay);
        const isExtremum =
            this.isExtremumHighlightEnabled() && (state >= 4 || state <= -4);
        this._applyLabelColors(el, wave, isExtremum);
        const fill = isExtremum ? '#ff0000' : wave.color || '#666666';
        this._syncWaveLabelGeometry(el, placement, fill);
        this._applyExtremumTimeTypography(el);
    }

    /** Определяет логическую полосу (top/bottom) вертикальной выноски по DOM. */
    _bandFromLabelElement(el) {
        if (el.closest('.sun-waveLabelsTop')) {
            return 'top';
        }
        if (el.closest('.sun-waveLabelsBottom')) {
            return 'bottom';
        }
        return el.dataset.visualBand || el.dataset.position || 'top';
    }

    /**
     * Стрелка к графику: top-полоса — снизу плашки вниз; bottom-полоса — сверху плашки вверх.
     * @param {'top'|'bottom'} band
     */
    _syncVerticalLabelBandGeometry(el, band, waveColor) {
        const color = waveColor || el.style.backgroundColor || '#666666';
        const layerKey = el.dataset.waveLayer || 'a';
        el.className =
            layerKey === 'b'
                ? `sun-waveLabel sun-vertical sun-${band} sun-waveLabelPersonB`
                : `sun-waveLabel sun-vertical sun-${band}`;
        el.dataset.visualBand = band;
        el.dataset.position = band;

        el.style.top = '';
        el.style.bottom = '';
        el.style.marginTop = '';
        el.style.marginBottom = '';

        let arrow = el.querySelector('.sun-waveLabelArrow');
        if (!arrow) {
            arrow = document.createElement('div');
            arrow.className = 'sun-waveLabelArrow';
            el.appendChild(arrow);
        }

        arrow.style.position = 'absolute';
        arrow.style.left = '50%';
        arrow.style.right = '';
        arrow.style.width = '0';
        arrow.style.height = '0';
        arrow.style.borderStyle = 'solid';
        arrow.style.zIndex = '1';
        arrow.style.transform = 'translateX(-50%)';

        const edgeGap = '6px';

        if (band === 'top') {
            el.style.top = '';
            el.style.marginTop = '';
            el.style.bottom = '0';
            el.style.marginBottom = edgeGap;
            arrow.style.top = '';
            arrow.style.bottom = '-6px';
            arrow.style.borderWidth = '6px 4px 0 4px';
            arrow.style.borderColor = `${color} transparent transparent transparent`;
        } else {
            el.style.top = '0';
            el.style.marginTop = edgeGap;
            el.style.bottom = '';
            el.style.marginBottom = '';
            arrow.style.top = '-6px';
            arrow.style.bottom = '';
            arrow.style.borderWidth = '0 4px 6px 4px';
            arrow.style.borderColor = `transparent transparent ${color} transparent`;
        }

    }

    /** Позиционирует DOM-точку пересечения с осью X в координатах слоя волн. */
    _syncAxisXPointPosition(el, x, refDay) {
        const centerY = window.appState.config.graphHeight / 2;
        const d = this._mapOverlayPoint(x, centerY);
        el.style.transition = 'none';
        el.style.left = `${d.x}px`;
        el.style.top = `${d.y}px`;
        el.style.transition = 'transform 0.2s, box-shadow 0.2s';
        el.dataset.x = String(x);
        if (refDay !== undefined && refDay !== null) {
            el.dataset.refDay = String(refDay);
        }
    }

    /** Создаёт или возвращает контейнер .sun-waveIntersectionPoints в #wavesMount. */
    _ensureWaveIntersectionPointsContainer() {
        let container = document.querySelector('.sun-waveIntersectionPoints');
        if (container) {
            return container;
        }
        container = document.createElement('div');
        container.className = 'sun-waveIntersectionPoints';
        container.style.position = 'absolute';
        container.style.width = '100%';
        container.style.height = '100%';
        container.style.pointerEvents = 'none';
        container.style.zIndex = '9';
        container.style.top = '0';
        container.style.left = '0';
        const mount = this._getWavesMountElement();
        if (mount) {
            mount.appendChild(container);
        }
        return container;
    }

    /** Формирует многострочный title для маркера пересечения двух волн. */
    _buildWaveIntersectionPointTitle(point) {
        const timeStr = this.formatExtremumTime(point.time);
        const timeBefore = new Date(point.time.getTime() - 2.5 * 60 * 1000);
        const timeAfter = new Date(point.time.getTime() + 2.5 * 60 * 1000);
        let titleText = `${point.wavePair}\n${timeStr}`;
        titleText += `\n---`;
        titleText += `\n${this.formatExtremumTime(timeBefore)} (началось)`;
        titleText += `\n${this.formatExtremumTime(timeAfter)} (закончилось)`;
        return titleText;
    }

    /** Создаёт кликабельный DOM-элемент маркера пересечения двух волн. */
    _createWaveIntersectionPointElement(point) {
        const pointElement = document.createElement('div');
        pointElement.className = 'sun-waveIntersectionPoint';
        pointElement.dataset.time = point.time.toISOString();
        pointElement.dataset.wavePair = point.wavePair;
        pointElement.title = this._buildWaveIntersectionPointTitle(point);
        const d = this._mapOverlayPoint(point.x, point.y);
        pointElement.style.position = 'absolute';
        pointElement.style.left = `${d.x}px`;
        pointElement.style.top = `${d.y}px`;
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
            const iso = e.currentTarget.dataset.time;
            if (iso) {
                this.navigateToIntersectionTime(new Date(iso));
            }
        });

        return pointElement;
    }

    /** Обновляет боковые выноски имён волн (left/right) для всех видимых слоёв. */
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
            return opts.activeDomIds || null;
        }
        
        this.lastUpdateTime = now;
        
        const end = d && d.t('waves.updateHorizontalWaveLabels', { forceWaveLabels: !!opts.forceWaveLabels });
        try {
            const activeDomIds = opts.activeDomIds || new Set();
            const graphH = window.appState.config.graphHeight;
            const graphW = window.appState.graphWidth;
            const amplitude = window.appState.config.amplitude;
            const centerY = graphH / 2;

            window.appState.data.waves.forEach((wave) => {
                if (!this.waveNeedsGraphContainer(wave.id)) {
                    return;
                }

                for (const layer of this._visibleLayersForWave(wave)) {
                    const effDay = layer.day;
                    const sides = [
                        { side: 'left', y: this.calculateWaveYAtXForDay(wave, 0, effDay) },
                        {
                            side: 'right',
                            y: this.calculateWaveYAtXForDay(wave, graphW, effDay)
                        }
                    ];

                    sides.forEach(({ side, y }) => {
                        if (y < 0 || y > graphH) {
                            return;
                        }
                        const graphX = side === 'left' ? 0 : graphW;
                        const placement = this._resolveWaveLabelPlacement(side);
                        const container = this._getWaveLabelContainer(placement.slot);
                        if (!container) {
                            return;
                        }
                        const displayPoint = this._mapLabelPointForViewport(graphX, y);
                        const domId = this._horizontalWaveLabelDomId(wave.id, side, layer.key);
                        activeDomIds.add(domId);
                        let el = window.dom.byKey(domId);
                        if (!el) {
                            el = this.createHorizontalWaveLabel(
                                wave,
                                displayPoint,
                                side,
                                placement,
                                container,
                                layer.key
                            );
                        } else {
                            if (el.parentNode !== container) {
                                container.appendChild(el);
                            }
                            this._syncHorizontalWaveLabelContent(
                                el,
                                wave,
                                displayPoint,
                                side,
                                placement,
                                layer.key,
                                effDay
                            );
                        }
                    });
                }
            });

            if (!opts.skipStaleCleanup) {
                this._cleanupWaveLabelContainers(activeDomIds);
            }
            return activeDomIds;
        } finally {
            end &&
                end({
                    leftLabels: document.querySelector('.sun-waveLabelsLeft')?.children.length,
                    rightLabels: document.querySelector('.sun-waveLabelsRight')?.children.length
                });
        }
    }

    /** Обновляет верхние/нижние выноски времени экстремумов. */
    updateVerticalWaveLabels(opts = {}) {
        const d = __waveDbg();
        const topContainer = document.querySelector('.sun-waveLabelsTop');
        const bottomContainer = document.querySelector('.sun-waveLabelsBottom');
        
        if (!topContainer || !bottomContainer) {
            d && d.log('waves.updateVerticalWaveLabels.skip', { reason: 'noContainers' });
            return opts.activeDomIds || null;
        }
        
        const end = d && d.t('waves.updateVerticalWaveLabels', {});
        try {
            const activeDomIds = opts.activeDomIds || new Set();
            const graphW = window.appState.graphWidth;
            const graphH = window.appState.config.graphHeight;
            const amplitude = window.appState.config.amplitude;
            const centerY = graphH / 2;

            window.appState.data.waves.forEach((wave) => {
                if (!this.waveNeedsGraphContainer(wave.id)) {
                    return;
                }

                for (const layer of this._visibleLayersForWave(wave)) {
                    const effDay = layer.day;
                    const bands = [
                        { position: 'top', xs: this.findAllExtremumXs(wave, 'top', effDay) },
                        { position: 'bottom', xs: this.findAllExtremumXs(wave, 'bottom', effDay) }
                    ];

                    bands.forEach(({ position, xs }) => {
                        const graphY =
                            position === 'top' ? centerY - amplitude : centerY + amplitude;
                        const placement = this._resolveWaveLabelPlacement(position);
                        const container = this._getWaveLabelContainer(placement.slot);
                        if (!container) {
                            return;
                        }
                        xs.forEach((x, idx) => {
                            const displayPoint = this._mapLabelPointForViewport(x, graphY);
                            const domId = this._verticalWaveLabelDomId(
                                wave.id,
                                position,
                                idx,
                                layer.key
                            );
                            activeDomIds.add(domId);
                            let el = window.dom.byKey(domId);
                            if (!el) {
                                this.createVerticalWaveLabel(
                                    wave,
                                    x,
                                    position,
                                    placement,
                                    displayPoint,
                                    container,
                                    idx,
                                    layer.key,
                                    effDay
                                );
                            } else {
                                if (el.parentNode !== container) {
                                    container.appendChild(el);
                                }
                                this._syncVerticalWaveLabelContent(
                                    el,
                                    wave,
                                    x,
                                    effDay,
                                    layer.key,
                                    position
                                );
                            }
                        });
                    });
                }
            });

            if (!opts.skipStaleCleanup) {
                this._cleanupWaveLabelContainers(activeDomIds);
            }
            return activeDomIds;
        } finally {
            end &&
                end({
                    topLabels: topContainer.children.length,
                    bottomLabels: bottomContainer.children.length
                });
        }
    }

    /** Синхронизирует DOM-точки пересечения волн с горизонтальной осью (y = centerY). */
    updateAxisXIntersectionPoints() {
        const d = __waveDbg();
        let axisXPointsContainer = document.querySelector('.sun-waveAxisXPoints');
        if (!axisXPointsContainer) {
            axisXPointsContainer = document.createElement('div');
            axisXPointsContainer.className = 'sun-waveAxisXPoints';
            axisXPointsContainer.style.position = 'absolute';
            axisXPointsContainer.style.width = '100%';
            axisXPointsContainer.style.height = '100%';
            axisXPointsContainer.style.pointerEvents = 'none';
            axisXPointsContainer.style.zIndex = '8';
            axisXPointsContainer.style.top = '0';
            axisXPointsContainer.style.left = '0';
            
            const mount = this._getWavesMountElement();
            if (mount) {
                mount.appendChild(axisXPointsContainer);
            }
        }
        
        if (axisXPointsContainer.classList.contains('sun-hidden')) {
            axisXPointsContainer.innerHTML = '';
            d && d.log('waves.updateAxisXIntersectionPoints.skip', { reason: 'hidden' });
            return;
        }
        
        const end = d && d.t('waves.updateAxisXIntersectionPoints', {});
        let pointCount = 0;
        try {
            const activeKeys = new Set();

            window.appState.data.waves.forEach((wave) => {
                if (!this.waveNeedsGraphContainer(wave.id)) {
                    return;
                }

                for (const layer of this._visibleLayersForWave(wave)) {
                    const intersectionPoints = this.findAxisXIntersectionPoints(wave, layer.day);
                    intersectionPoints.forEach((x) => {
                        const key = this._axisXPointKey(wave.id, layer.key, x);
                        activeKeys.add(key);
                        let point = axisXPointsContainer.querySelector(
                            `[data-axis-key="${CSS.escape(key)}"]`
                        );
                        if (!point) {
                            point = this.createAxisXPoint(
                                wave,
                                x,
                                axisXPointsContainer,
                                layer.day,
                                layer.key
                            );
                        } else {
                            this._syncAxisXPointPosition(point, x, layer.day);
                        }
                        pointCount++;
                    });
                }
            });

            axisXPointsContainer.querySelectorAll('.sun-waveAxisXPoint').forEach((el) => {
                if (!activeKeys.has(el.dataset.axisKey)) {
                    el.remove();
                }
            });
        } finally {
            end && end({ axisXPointElements: pointCount });
        }
    }

    /**
     * X-координаты нулей синусоиды (пересечений с осью) в пределах ширины графа.
     * @returns {number[]}
     */
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

    /** Создаёт DOM-элемент точки пересечения волны с осью X и вешает навигацию по клику. */
    createAxisXPoint(wave, x, container, refDay, layerKey = 'a') {
        const waveColor = wave.color || '#666666';
        const textColor = this.getContrastTextColor(waveColor);
        
        const point = document.createElement('div');
        point.className =
            layerKey === 'b'
                ? 'sun-waveAxisXPoint sun-waveAxisXPointPersonB'
                : 'sun-waveAxisXPoint';
        point.dataset.waveId = wave.id;
        point.dataset.x = x;
        point.dataset.waveLayer = layerKey;
        point.dataset.axisKey = this._axisXPointKey(wave.id, layerKey, x);
        if (refDay !== undefined && refDay !== null) {
            point.dataset.refDay = String(refDay);
        }
        
        point.style.position = 'absolute';
        point.style.width = '6px';
        point.style.height = '6px';
        point.style.borderRadius = '50%';
        point.style.backgroundColor = waveColor;
        point.style.border = `1px solid ${textColor}`;
        point.style.cursor = 'pointer';
        point.style.pointerEvents = 'auto';
        point.style.zIndex = '9';
        point.style.transition = 'transform 0.2s, box-shadow 0.2s';
        this._syncAxisXPointPosition(point, x, refDay);
        
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

    /** Переходит к календарному времени пересечения волны с осью X в столбце x. */
    navigateToAxisXIntersection(wave, x, refDay, layerKey = 'a') {
        // Время календаря в столбце x текущего визора; совпадает с фазой точки эквилибриума по этой x
        // (старая логика через phaseInPeriod и «первое» пересечение от leftDate ломалась при нескольких нулях на экране)
        const intersectionTime = this.calculateTimeFromXCoordinate(wave, x, refDay, layerKey);
        if (window.dates && window.dates.setDate) {
            window.dates.setDate(intersectionTime, true);
        }
    }

    /** Убирает дробные мс от float-арифметики дней (04:59:59.999 → 05:00:00). */
    _snapTimeToSecond(value) {
        const ms = value instanceof Date ? value.getTime() : Number(value);
        if (!Number.isFinite(ms)) {
            return new Date();
        }
        return new Date(Math.round(ms / 1000) * 1000);
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
        return this._snapTimeToSecond(baseMs + targetDay * 24 * 3600 * 1000);
    }

    /** Нормализованная фаза волны [0, 1) для заданного календарного времени. */
    getPhaseAtTime(wave, time) {
        const daysFromBase = window.timeUtils.getDaysBetween(window.appState.baseDate, time);
        
        const phase = (daysFromBase % wave.period) / wave.period;
        
        return phase < 0 ? phase + 1 : phase;
    }

    /** Возвращает чёрный или белый цвет текста для контраста с фоном (#hex). */
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
    

    /** Создаёт DOM боковой выноски с именем волны и обработчиками клика/hover. */
    createHorizontalWaveLabel(wave, displayPoint, logicalEdge, placement, container, layerKey = 'a') {
        const suffix = layerKey === 'b' ? '-person-b' : '';
        const labelId = `${wave.id}-${logicalEdge}${suffix}`;
        const effDay =
            layerKey === 'b' ? this._getSecondPersonDayOffset() : window.appState.currentDay || 0;
        const state = this.calculateWaveStateAtDay(wave, effDay);
        const atExtremum = (state >= 4 || state <= -4);
        const isExtremum = this.isExtremumHighlightEnabled() && atExtremum;
        
        const waveColor = isExtremum ? '#ff0000' : (wave.color || '#666666');
        const textColor = this.getContrastTextColor(waveColor);
        
        const labelElement = document.createElement('div');
        labelElement.id = `waveLabel${labelId}`;
        labelElement.dataset.waveId = wave.id;
        labelElement.dataset.waveLayer = layerKey;
        labelElement.dataset.logicalEdge = logicalEdge;
        
        labelElement.style.position = 'absolute';
        labelElement.style.width = 'auto';
        labelElement.style.backgroundColor = waveColor;
        labelElement.style.color = textColor;
        if (layerKey !== 'b') {
            labelElement.style.opacity = '0.7';
        }
        labelElement.style.zIndex = '1';
        labelElement.style.padding = '2px 6px';
        labelElement.style.borderRadius = '3px';
        labelElement.style.fontSize = '11px';
        labelElement.style.cursor = 'pointer';
        labelElement.style.fontWeight = '500';
        labelElement.style.whiteSpace = 'nowrap';
        
        const text = document.createElement('div');
        text.className = 'sun-waveLabelText';
        text.textContent = wave.name;
        text.style.position = 'relative';
        text.style.zIndex = '2';
        
        labelElement.appendChild(text);
        container.appendChild(labelElement);
        this._applyWaveLabelLayout(labelElement, placement, displayPoint);
        this._syncWaveLabelGeometry(labelElement, placement, waveColor);
        this._applyWaveNameTypography(labelElement);
        
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

    /** Создаёт DOM вертикальной выноски времени экстремума на полосе top/bottom. */
    createVerticalWaveLabel(
        wave,
        x,
        logicalBand,
        placement,
        displayPoint,
        container,
        index = 0,
        layerKey = 'a',
        effDay
    ) {
        const suffix = layerKey === 'b' ? '-person-b' : '';
        const labelId = `${wave.id}-${logicalBand}-${index}${suffix}`;
        const day =
            effDay !== undefined && effDay !== null
                ? effDay
                : layerKey === 'b'
                  ? this._getSecondPersonDayOffset()
                  : window.appState.currentDay || 0;
        const state = this.calculateWaveStateAtDay(wave, day);
        const atExtremum = (state >= 4 || state <= -4);
        const isExtremum = this.isExtremumHighlightEnabled() && atExtremum;
        
        const waveColor = isExtremum ? '#ff0000' : (wave.color || '#666666');
        const textColor = this.getContrastTextColor(waveColor);
        
        const extremumTime = this.calculateTimeFromXCoordinate(wave, x, day, layerKey);
        const timeString = this.formatExtremumTime(extremumTime);
        
        const labelElement = document.createElement('div');
        labelElement.id = `waveLabel${labelId}`;
        labelElement.dataset.waveId = wave.id;
        labelElement.dataset.waveLayer = layerKey;
        labelElement.dataset.logicalBand = logicalBand;
        labelElement.dataset.refX = String(x);
        labelElement.dataset.extremumTime = extremumTime.getTime();
        
        labelElement.style.position = 'absolute';
        labelElement.style.width = 'auto';
        labelElement.style.backgroundColor = waveColor;
        labelElement.style.color = textColor;
        if (layerKey !== 'b') {
            labelElement.style.opacity = '0.7';
        }
        labelElement.style.zIndex = '1';
        labelElement.style.padding = '2px 6px';
        labelElement.style.borderRadius = '3px';
        labelElement.style.fontSize = '11px';
        labelElement.style.cursor = 'pointer';
        labelElement.style.fontWeight = '500';
        labelElement.style.whiteSpace = 'nowrap';
        
        const text = document.createElement('div');
        text.className = 'sun-waveLabelText';
        text.textContent = timeString;
        
        labelElement.appendChild(text);
        container.appendChild(labelElement);
        this._applyWaveLabelLayout(labelElement, placement, displayPoint);
        this._syncWaveLabelGeometry(labelElement, placement, waveColor);
        this._applyExtremumTimeTypography(labelElement);
        
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

    
    /** Клик по боковой выноске слоя B — тот же путь, что чекбокс .sun-waveBVisibilityCheck (см. handleWavePersonBVisibilityChange). */
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
                const $bVis = $(`.sun-waveBVisibilityCheck[data-id="${waveIdStr}"]`);
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
        document.querySelectorAll(`.sun-waveBVisibilityCheck[data-id="${waveIdStr}"]`).forEach((el) => {
            el.checked = applied;
        });
    }

    /** Клик по боковой выноске слоя A — переключает видимость волны (как чекбокс). */
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
            const $vis = $(`.sun-waveVisibilityCheck[data-id="${waveIdStr}"]`);
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

    /** Клик по вертикальной выноске — навигация к времени экстремума. */
    onVerticalWaveLabelClick(labelElement) {
        const storedMs = labelElement.dataset.extremumTime;
        if (storedMs !== undefined && storedMs !== '' && Number.isFinite(Number(storedMs))) {
            this.navigateToExtremumTime(Number(storedMs));
            return;
        }

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

    /** Устанавливает дату визора на время экстремума через dates.setDate. */
    navigateToExtremumTime(timestamp) {
        const extremumDate = this._snapTimeToSecond(timestamp);
        
        if (window.dates && window.dates.setDate) {
            window.dates.setDate(extremumDate, true);
        }
    }

    /** Вычисляет ближайшее время экстремума (top/bottom) в видимом диапазоне графа. */
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
            return this._snapTimeToSecond(extremumTime);
        }
        
        const nextExtremumTime = new Date(extremumTime.getTime() + (wave.period * 24 * 3600 * 1000));
        return this._snapTimeToSecond(nextExtremumTime);
    }

    /** Форматирует время экстремума как HH:MM:SS для подписи выноски. */
    formatExtremumTime(date) {
        const snapped = this._snapTimeToSecond(date);
        const hours = snapped.getHours().toString().padStart(2, '0');
        const minutes = snapped.getMinutes().toString().padStart(2, '0');
        const seconds = snapped.getSeconds().toString().padStart(2, '0');
        
        return `${hours}:${minutes}:${seconds}`;
    }

    /** Обновляет текст времени на всех вертикальных выносках при сдвиге визора. */
    updateVerticalWaveLabelsTime() {
        const d = __waveDbg();
        const labels = document.querySelectorAll('.sun-waveLabel.sun-vertical');
        const end = d && d.t('waves.updateVerticalWaveLabelsTime', { count: labels.length });
        try {
        labels.forEach(label => {
            if (label.dataset.logicalEdge) {
                return;
            }
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
            const snappedMs = extremumTime.getTime();
            const timeString = this.formatExtremumTime(extremumTime);
            
            const textElement = label.querySelector('.sun-waveLabelText');
            if (textElement) {
                textElement.textContent = timeString;
            }
            label.dataset.extremumTime = String(snappedMs);
            this._applyExtremumTimeTypography(label);
        });
        } finally {
            end && end({});
        }
    }

    /** Y-координата синусоиды в точке x для заданного дня отсчёта фазы. */
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

    /** Y-координата синусоиды в x с effective day текущего слоя волны. */
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

    /** Все X, где волна пересекает горизонталь targetY в пределах графа. */
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

    /** Создаёт контейнеры волн, отсутствующие в кэше, для активной даты. */
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

    /** Добавляет пользовательскую волну в appState, группу default и DOM. */
    addCustomWave(name, period, type, color, note) {
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
            note: typeof note === 'string' ? note : '',
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

    /** Удаляет волну из данных, групп, DOM и кэшей менеджера. */
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
        
        const leftLabel = window.dom.byKey(`waveLabel${waveIdStr}-left`);
        const rightLabel = window.dom.byKey(`waveLabel${waveIdStr}-right`);
        const leftB = window.dom.byKey(`waveLabel${waveIdStr}-left-person-b`);
        const rightB = window.dom.byKey(`waveLabel${waveIdStr}-right-person-b`);
        
        if (leftLabel) leftLabel.remove();
        if (rightLabel) rightLabel.remove();
        if (leftB) leftB.remove();
        if (rightB) rightB.remove();
        
        document.querySelectorAll(`.sun-waveLabel.sun-vertical[data-wave-id="${waveIdStr}"]`).forEach(el => el.remove());
        
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

    /** Красит угловые квадраты цветом волны с включённым waveCornerColor. */
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
        
        document.querySelectorAll('.sun-cornerSquare').forEach(square => {
            if (hasActiveWave) {
                square.style.backgroundColor = activeColor;
            } else {
                square.style.backgroundColor = 'red';
            }
        });
    }

    /** Включает/выключает подсветку углов для одной волны (остальные сбрасываются). */
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
        
        document.querySelectorAll('.sun-waveCornerColorCheck').forEach(checkbox => {
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

    /** Возвращает объекты волн группы по списку id в group.waves. */
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

    /** Разница в днях между двумя датами (timeUtils или fallback). */
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

    /** Точки пересечения двух волн при заданных днях отсчёта фаз слоёв A/B. */
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

    /** Точки пересечения двух волн для effective day обеих волн (слой A). */
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

    /** Точная навигация: обновляет currentDate/Day, сетку и UI миллисекунд. */
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
        window.dom.byKey('currentDay').textContent = 
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

    /** Фаза синусоиды в пикселях (радианы) для заданного дня отсчёта. */
    getPixelPhaseForDay(wave, effDay) {
        const periodPx = wave.period * window.appState.config.squareSize;
        const phaseOffsetPixels = window.appState.config.phaseOffsetDays * window.appState.config.squareSize;

        const currentOffsetPx = (effDay * window.appState.config.squareSize) % periodPx;
        const normalizedOffset = currentOffsetPx < 0 ? periodPx + currentOffsetPx : currentOffsetPx;

        return (2 * Math.PI * (phaseOffsetPixels + normalizedOffset)) / periodPx;
    }

    /** Фаза синусоиды в пикселях для effective day текущего слоя волны. */
    getPixelPhase(wave) {
        return this.getPixelPhaseForDay(wave, this.getEffectiveDayOffsetForWave(wave));
    }

    /** Строит объект точки пересечения двух волн в x (координаты, волны, время). */
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

    /** Бинарный поиск уточнения X пересечения двух синусоид на отрезке [x1, x2]. */
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

    /** Все пересечения пар видимых волн и слоёв A/B в пределах графа. */
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

    /** Убирает точки пересечения, расположенные ближе minDistance по оси X. */
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

    /** Рендерит до 50 маркеров пересечений волн в .sun-waveIntersectionPoints. */
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

        const endCalc = d && d.t('waves.renderWaveIntersectionPoints.calculateAllWaveIntersections', {});
        const intersections = this.calculateAllWaveIntersections();
        endCalc &&
            endCalc({
                intersectionPairs: intersections.length,
                activeWaves: this.getActiveWaves().length
            });

        const maxPointsToShow = 50;
        const pointsToShow = intersections.slice(0, maxPointsToShow);

        const endDom = d && d.t('waves.renderWaveIntersectionPoints.buildDom', {
            pointsToShow: pointsToShow.length
        });
        const container = this._ensureWaveIntersectionPointsContainer();
        const activeKeys = new Set();

        pointsToShow.forEach((point, index) => {
            const key = `i${index}`;
            activeKeys.add(key);
            let pointElement = container.querySelector(`[data-intersection-key="${key}"]`);
            if (!pointElement) {
                pointElement = this._createWaveIntersectionPointElement(point);
                pointElement.dataset.intersectionKey = key;
                container.appendChild(pointElement);
            } else {
                const d = this._mapOverlayPoint(point.x, point.y);
                pointElement.style.transition = 'none';
                pointElement.style.left = `${d.x}px`;
                pointElement.style.top = `${d.y}px`;
                pointElement.style.transition = 'transform 0.2s, box-shadow 0.2s';
                pointElement.dataset.time = point.time.toISOString();
                pointElement.dataset.wavePair = point.wavePair;
                pointElement.title = this._buildWaveIntersectionPointTitle(point);
            }
        });

        container.querySelectorAll('.sun-waveIntersectionPoint').forEach((el) => {
            if (!activeKeys.has(el.dataset.intersectionKey)) {
                el.remove();
            }
        });

        endDom && endDom({});

        return container;
    }

    /** Удаляет все DOM-слои .sun-waveIntersectionPoints с графа. */
    removeWaveIntersectionPoints() {
        const d = __waveDbg();
        const nodes = document.querySelectorAll('.sun-waveIntersectionPoints');
        if (d && nodes.length) {
            d.log('waves.removeWaveIntersectionPoints', { layers: nodes.length });
        }
        nodes.forEach(el => el.remove());
    }

    /** Устанавливает title на элементе маркера пересечения (пара волн и время). */
    showIntersectionTooltip(element, point) {
        element.title = `${point.wave1.name} × ${point.wave2.name}\n${this.formatExtremumTime(point.time)}`;
    }

    /** Удаляет всплывающие .intersection-tooltip из document. */
    hideIntersectionTooltip() {
        document.querySelectorAll('.intersection-tooltip').forEach(el => el.remove());
    }

    /** Переходит к времени пересечения двух волн через dates.setDate. */
    navigateToIntersectionTime(time) {
        if (window.dates && window.dates.setDate) {
            window.dates.setDate(time, true);
        }
    }
}

window.waves = new WavesManager();