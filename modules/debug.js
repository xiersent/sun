/**
 * @file debug.js
 * Отладка волн в консоли: информация о периодах, маркеры границ периодов на контейнере.
 * Глобально: debugWaves(), showPeriodMarkers(), hidePeriodMarkers().
 */
class WavesDebugger {
    constructor() {
        this.debugInfo = {};
    }

    /**
     * Записать в debugInfo параметры волны (период в px, ширина контейнера).
     * @param {object} wave — объект сигнала из appState.data.waves
     */
    logWaveInfo(wave) {
        if (!window.waves) return;

        const periodPx = wave.period * window.appState.config.squareSize;
        const totalPeriods = window.waves.calculateRequiredPeriods(periodPx);
        const containerWidth = periodPx * totalPeriods;
    }

    /** Вывести в консоль данные по всем видимым и включённым волнам. */
    showAllWavesInfo() {
        window.appState.data.waves.forEach((wave) => {
            const waveIdStr = String(wave.id);
            const isWaveVisible = window.appState.waveVisibility[waveIdStr] !== false;
            const isGroupEnabled = window.waves.isWaveGroupEnabled(wave.id);

            if (isWaveVisible && isGroupEnabled) {
                this.logWaveInfo(wave);
            }
        });
    }

    /**
     * Нарисовать вертикальные линии границ периодов поверх .sun-waveContainer.
     * @param {HTMLElement} waveContainer
     */
    addPeriodMarkers(waveContainer) {
        if (!waveContainer || !waveContainer.dataset.periodPx) return;

        const periodPx = parseFloat(waveContainer.dataset.periodPx);
        const totalPeriods = parseInt(waveContainer.dataset.totalPeriods, 10) || 3;

        for (let i = 0; i <= totalPeriods; i++) {
            const marker = document.createElement('div');
            marker.className = 'period-marker';
            marker.style.position = 'absolute';
            marker.style.left = `${i * periodPx}px`;
            marker.style.top = '0';
            marker.style.width = '1px';
            marker.style.height = '100%';
            marker.style.backgroundColor = i === 0 || i === totalPeriods ? 'red' : 'rgba(255,0,0,0.3)';
            marker.style.zIndex = '1000';
            marker.style.pointerEvents = 'none';
            marker.title = `Период ${i}`;

            waveContainer.appendChild(marker);
        }
    }

    /** Удалить все .period-marker с графика. */
    removePeriodMarkers() {
        document.querySelectorAll('.period-marker').forEach((marker) => marker.remove());
    }
}

window.wavesDebugger = new WavesDebugger();

/** Консоль: показать информацию по видимым волнам. */
window.debugWaves = function () {
    window.wavesDebugger.showAllWavesInfo();
};

/** Консоль: маркеры периодов на всех контейнерах волн. */
window.showPeriodMarkers = function () {
    document.querySelectorAll('.sun-waveContainer').forEach((container) => {
        window.wavesDebugger.addPeriodMarkers(container);
    });
};

/** Консоль: убрать маркеры периодов. */
window.hidePeriodMarkers = function () {
    window.wavesDebugger.removePeriodMarkers();
};
