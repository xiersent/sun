/**
 * CSS scale только на слое волн (#wavesMount). flipH/V — scale; rotate — перестройка осей (без CSS rotate).
 * Выноски снаружи graph-container — mapGraphPointToDisplay / resolveWaveLabelPlacement.
 */
class WavesTransformLayerManager {
    static LAYER_ID = 'wavesTransformLayer';
    static MOUNT_ID = 'wavesMount';

    getLayerElement() {
        return document.getElementById(WavesTransformLayerManager.LAYER_ID);
    }

    getMountElement() {
        return (
            document.getElementById(WavesTransformLayerManager.MOUNT_ID) ||
            this.getLayerElement()
        );
    }

    getTransformState() {
        const t = window.appState && window.appState.transform;
        return {
            scaleX: t && t.scaleX != null ? t.scaleX : 1,
            scaleY: t && t.scaleY != null ? t.scaleY : 1,
            rotation: t && t.rotation != null ? Number(t.rotation) : 0
        };
    }

    isScaleYFlipped() {
        return this.getTransformState().scaleY < 0;
    }

    isScaleXFlipped() {
        return this.getTransformState().scaleX < 0;
    }

    getNormalizedRotation() {
        const rot = Number(this.getTransformState().rotation) || 0;
        return ((rot % 360) + 360) % 360;
    }

    /** 0 = 0°, 1 = 90°, 2 = 180°, 3 = 270° */
    getRotationQuarter() {
        return Math.round(this.getNormalizedRotation() / 90) % 4;
    }

    isAxisSwapped() {
        return this.getRotationQuarter() % 2 === 1;
    }

    /**
     * Направление прокрутки по оси дней (сетка, SVG-группы волн).
     * ↶ −90° (q=3): ось дней на экране по −Y — знак обратный q=0/q=1.
     */
    getDayAxisScrollMultiplier() {
        return this.getRotationQuarter() === 3 ? -1 : 1;
    }

    /** Пиксели сдвига сетки/волн/выносок для дробной части currentDay. */
    getDayAxisScrollPx(fractionalDay) {
        const frac = Number(fractionalDay) || 0;
        const sq = window.appState.config.squareSize;
        return this.getDayAxisScrollMultiplier() * (-frac * sq);
    }

    /** Пиксели translate SVG-волны (полный currentDay в периоде). */
    getWaveLayerScrollPx(currentPositionPx) {
        return this.getDayAxisScrollMultiplier() * (-Number(currentPositionPx) || 0);
    }

    getLogicalGraphWidth() {
        return window.appState.graphWidth;
    }

    getLogicalGraphHeight() {
        return window.appState.config.graphHeight;
    }

    /** Размеры контейнера графика на экране (при 90°/270° ширина и высота меняются местами). */
    getDisplayGraphWidth() {
        const lw = this.getLogicalGraphWidth();
        const lh = this.getLogicalGraphHeight();
        return this.isAxisSwapped() ? lh : lw;
    }

    getDisplayGraphHeight() {
        const lw = this.getLogicalGraphWidth();
        const lh = this.getLogicalGraphHeight();
        return this.isAxisSwapped() ? lw : lh;
    }

    getTransformLayoutSignature() {
        const t = this.getTransformState();
        return [this.getRotationQuarter(), t.scaleX, t.scaleY].join('|');
    }

    /**
     * Логические смещения: dayOffset (клетки по оси дней), stateLevel (−5…+5).
     * @returns {{ x: number, y: number }} пиксели от центра графика
     */
    mapLogicalOffsets(dayOffset, stateLevel) {
        const sq = window.appState.config.squareSize;
        let d = Number(dayOffset) || 0;
        let s = Number(stateLevel);
        if (Number.isNaN(s)) {
            s = 0;
        }
        if (this.isScaleXFlipped()) {
            d = -d;
        }
        if (this.isScaleYFlipped()) {
            s = -s;
        }
        const dayPx = d * sq;
        const statePx = -s * sq;
        switch (this.getRotationQuarter()) {
            case 1:
                return { x: -statePx, y: dayPx };
            case 2:
                return { x: -dayPx, y: -statePx };
            case 3:
                return { x: statePx, y: -dayPx };
            default:
                return { x: dayPx, y: statePx };
        }
    }

    /**
     * Точка графика (пиксели) → экран внутри graph-container.
     */
    mapGraphPointToDisplay(x, y, graphW, graphH) {
        const lw = graphW != null ? graphW : this.getLogicalGraphWidth();
        const lh = graphH != null ? graphH : this.getLogicalGraphHeight();
        const dw = this.getDisplayGraphWidth();
        const dh = this.getDisplayGraphHeight();
        const sq = window.appState.config.squareSize;
        const dayOffset = (x - lw / 2) / sq;
        const stateLevel = -(y - lh / 2) / sq;
        const m = this.mapLogicalOffsets(dayOffset, stateLevel);
        return { x: dw / 2 + m.x, y: dh / 2 + m.y };
    }

    /**
     * Точка графа → координаты внутри #wavesTransformLayer (без flip scale: его даёт CSS transform слоя).
     */
    mapGraphPointToLayer(x, y, graphW, graphH) {
        const lw = graphW != null ? graphW : this.getLogicalGraphWidth();
        const lh = graphH != null ? graphH : this.getLogicalGraphHeight();
        const dw = this.getDisplayGraphWidth();
        const dh = this.getDisplayGraphHeight();
        const sq = window.appState.config.squareSize;
        const dayOffset = (x - lw / 2) / sq;
        const stateLevel = -(y - lh / 2) / sq;
        const dayPx = dayOffset * sq;
        const statePx = -stateLevel * sq;
        switch (this.getRotationQuarter()) {
            case 1:
                return { x: dw / 2 - statePx, y: dh / 2 + dayPx };
            case 2:
                return { x: dw / 2 - dayPx, y: dh / 2 - statePx };
            case 3:
                return { x: dw / 2 + statePx, y: dh / 2 - dayPx };
            default:
                return { x: dw / 2 + dayPx, y: dh / 2 + statePx };
        }
    }

    mapLogicalGraphEdge(edge) {
        let e = edge;
        if (this.isScaleXFlipped()) {
            if (e === 'left') {
                e = 'right';
            } else if (e === 'right') {
                e = 'left';
            }
        }
        if (this.isScaleYFlipped()) {
            if (e === 'top') {
                e = 'bottom';
            } else if (e === 'bottom') {
                e = 'top';
            }
        }
        return e;
    }

    /**
     * Логическая грань → контейнер выноски и тип (горизонтальная / вертикальная).
     */
    resolveWaveLabelPlacement(logicalEdge) {
        const edge = this.mapLogicalGraphEdge(logicalEdge);
        const table = {
            0: {
                left: { axis: 'horizontal', slot: 'left' },
                right: { axis: 'horizontal', slot: 'right' },
                top: { axis: 'vertical', slot: 'top' },
                bottom: { axis: 'vertical', slot: 'bottom' }
            },
            1: {
                left: { axis: 'vertical', slot: 'top' },
                right: { axis: 'vertical', slot: 'bottom' },
                top: { axis: 'horizontal', slot: 'right' },
                bottom: { axis: 'horizontal', slot: 'left' }
            },
            2: {
                left: { axis: 'horizontal', slot: 'right' },
                right: { axis: 'horizontal', slot: 'left' },
                top: { axis: 'vertical', slot: 'bottom' },
                bottom: { axis: 'vertical', slot: 'top' }
            },
            3: {
                left: { axis: 'vertical', slot: 'bottom' },
                right: { axis: 'vertical', slot: 'top' },
                top: { axis: 'horizontal', slot: 'left' },
                bottom: { axis: 'horizontal', slot: 'right' }
            }
        };
        const q = this.getRotationQuarter();
        const row = table[q] || table[0];
        return row[edge] || row.left;
    }

    mapDisplayY(y, graphH) {
        const lh = graphH != null ? graphH : this.getLogicalGraphHeight();
        const lw = this.getLogicalGraphWidth();
        return this.mapGraphPointToDisplay(0, y, lw, lh).y;
    }

    mapDisplayX(x, graphW) {
        const lw = graphW != null ? graphW : this.getLogicalGraphWidth();
        const lh = this.getLogicalGraphHeight();
        return this.mapGraphPointToDisplay(x, 0, lw, lh).x;
    }

    /** Размеры viewport графика на экране (при повороте). Не трогает --gw/--gh (time bar, панели). */
    applyDisplayGraphCssVariables() {
        if (typeof document === 'undefined') {
            return;
        }
        document.documentElement.style.setProperty('--dgw', `${this.getDisplayGraphWidth()}px`);
        document.documentElement.style.setProperty('--dgh', `${this.getDisplayGraphHeight()}px`);
    }

    mapGridDayOffset(offset) {
        const o = Number(offset) || 0;
        return this.isScaleXFlipped() ? -o : o;
    }

    mapNavigationDayDelta(delta) {
        const d = Number(delta) || 0;
        return this.isScaleXFlipped() ? -d : d;
    }

    mapGridYLevel(level) {
        const l = Number(level);
        if (Number.isNaN(l)) {
            return 0;
        }
        return this.isScaleYFlipped() ? -l : l;
    }

    isScaleYFlippedForGrid() {
        return this.isScaleYFlipped();
    }

    isScaleXFlippedForGrid() {
        return this.isScaleXFlipped();
    }

    buildCssTransform(t) {
        const parts = [];
        if (this.getRotationQuarter() === 2) {
            parts.push('rotate(180deg)');
        }
        if (t) {
            const sx = t.scaleX != null ? t.scaleX : 1;
            const sy = t.scaleY != null ? t.scaleY : 1;
            if (sx !== 1) {
                parts.push(`scaleX(${sx})`);
            }
            if (sy !== 1) {
                parts.push(`scaleY(${sy})`);
            }
        }
        return parts.join(' ');
    }

    clearLabelPeerTransforms() {
        document.querySelectorAll('[data-waves-transform-peer]').forEach((el) => {
            el.style.transform = '';
            el.style.transformOrigin = '';
        });
    }

    migrateWaveDomFromGraphElement() {
        const mount = this.getMountElement();
        const graph = document.getElementById('graphElement');
        if (!mount || !graph) {
            return;
        }
        const selectors = ['.wave-container', '.wave-axis-x-points', '.wave-intersection-points'];
        selectors.forEach((sel) => {
            graph.querySelectorAll(sel).forEach((el) => {
                mount.appendChild(el);
            });
        });
    }

    clearLegacyGraphElementTransform() {
        const graph = document.getElementById('graphElement');
        if (graph) {
            graph.style.transform = '';
        }
    }

    /** Слой волн поверх сетки (z-index) и последним в DOM после пересоздания grid. */
    ensureWavesLayerAboveGrid() {
        const graph = document.getElementById('graphElement');
        const layer = this.getLayerElement();
        if (!graph || !layer) {
            return;
        }
        if (layer.parentNode === graph) {
            graph.appendChild(layer);
        }
        layer.style.zIndex = '10';
        graph.querySelectorAll('.grid-static-container, .grid-absolute-container').forEach((el) => {
            el.style.zIndex = '4';
        });
    }

    applyFromAppState() {
        this.migrateWaveDomFromGraphElement();
        this.clearLegacyGraphElementTransform();
        this.clearLabelPeerTransforms();

        if (!window.appState) {
            return;
        }

        const layoutSig = this.getTransformLayoutSignature();
        const hadPriorLayout = this._lastTransformLayoutSignature != null;
        const layoutChanged =
            hadPriorLayout && this._lastTransformLayoutSignature !== layoutSig;
        const initialLayoutWithRotation =
            !hadPriorLayout && this.getRotationQuarter() !== 0;

        const layer = this.getLayerElement();
        if (layer) {
            const css = this.buildCssTransform(window.appState.transform);
            layer.style.transform = css;
            layer.style.transformOrigin = '50% 50%';
        }

        this.applyDisplayGraphCssVariables();
        if (window.appCore && typeof window.appCore.updateCSSVariables === 'function') {
            window.appCore.updateCSSVariables();
        }

        if ((layoutChanged || initialLayoutWithRotation) && window.waves) {
            if (typeof window.waves.clearSideWaveLabelsAfterLayoutChange === 'function') {
                window.waves.clearSideWaveLabelsAfterLayoutChange();
            }
            if (typeof window.waves.reconcileVisibleWaveElements === 'function') {
                window.waves.reconcileVisibleWaveElements();
            }
            if (typeof window.waves.rebuildForTransformLayout === 'function') {
                window.waves.rebuildForTransformLayout();
            }
            if (typeof window.waves.updatePosition === 'function') {
                window.waves.updatePosition({ forceWaveLabels: true });
            }
        } else if (window.waves && typeof window.waves.updatePosition === 'function') {
            window.waves.updatePosition({ forceWaveLabels: true });
        }

        const layoutNeedsFullRefresh = layoutChanged || initialLayoutWithRotation;
        if (window.grid && typeof window.grid.applyTransformLayout === 'function') {
            window.grid.applyTransformLayout({ forceRecreate: layoutNeedsFullRefresh });
        } else if (window.grid && typeof window.grid.applyFlipState === 'function') {
            window.grid.applyFlipState();
        }

        if (window.timeBarManager && typeof window.timeBarManager.applyFlipState === 'function') {
            window.timeBarManager.applyFlipState();
        }

        this.ensureWavesLayerAboveGrid();

        this._lastTransformLayoutSignature = layoutSig;
    }
}

window.wavesTransformLayer = new WavesTransformLayerManager();
