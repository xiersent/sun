/**
 * CSS-трансформация только слоя волн (#wavesMount внутри #graphElement).
 * Выноски снаружи graph-container — координаты через mapDisplayY / mapDisplayX.
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

    /**
     * Y в координатах графика → позиция для выносок (без CSS scale на контейнере подписей).
     * @param {number} y
     * @param {number} [graphH]
     */
    mapDisplayY(y, graphH) {
        const h = graphH != null ? graphH : window.appState.config.graphHeight;
        return this.isScaleYFlipped() ? h - y : y;
    }

    /**
     * X в координатах графика → позиция для вертикальных выносок.
     * @param {number} x
     * @param {number} [graphW]
     */
    mapDisplayX(x, graphW) {
        const w = graphW != null ? graphW : window.appState.graphWidth;
        return this.isScaleXFlipped() ? w - x : x;
    }

    /** Смещение дня на оси X для позиции линий/дат сетки (логический offset в data-day-offset не меняется). */
    mapGridDayOffset(offset) {
        const o = Number(offset) || 0;
        return this.isScaleXFlipped() ? -o : o;
    }

    /** Шаг навигации по дням: при flipH ←/→ должны совпадать с зеркальной осью времени. */
    mapNavigationDayDelta(delta) {
        const d = Number(delta) || 0;
        return this.isScaleXFlipped() ? -d : d;
    }

    /** Логический уровень Y (−5…+5) → отображаемый при flipV (как mapGridDayOffset для дат). */
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

    /**
     * @param {{ scaleX?: number, scaleY?: number, rotation?: number }} t
     * @returns {string}
     */
    buildCssTransform(t) {
        if (!t) {
            return '';
        }
        const rot = Number(t.rotation) || 0;
        const sx = t.scaleX != null ? t.scaleX : 1;
        const sy = t.scaleY != null ? t.scaleY : 1;
        if (rot === 0 && sx === 1 && sy === 1) {
            return '';
        }
        let css = '';
        if (rot !== 0) {
            css += `rotate(${rot}deg) `;
        }
        css += `scaleX(${sx}) scaleY(${sy})`;
        return css.trim();
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

    applyFromAppState() {
        this.migrateWaveDomFromGraphElement();
        this.clearLegacyGraphElementTransform();
        this.clearLabelPeerTransforms();

        if (!window.appState) {
            return;
        }

        const layer = this.getLayerElement();
        if (layer) {
            const css = this.buildCssTransform(window.appState.transform);
            layer.style.transform = css;
            layer.style.transformOrigin = '50% 50%';
        }

        if (window.waves && typeof window.waves.updatePosition === 'function') {
            window.waves.updatePosition({ forceWaveLabels: true });
        }

        if (window.grid && typeof window.grid.applyFlipState === 'function') {
            window.grid.applyFlipState();
        }

        if (window.timeBarManager && typeof window.timeBarManager.applyFlipState === 'function') {
            window.timeBarManager.applyFlipState();
        }
    }
}

window.wavesTransformLayer = new WavesTransformLayerManager();
