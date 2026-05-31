/**
 * Профилирование отрисовки / скрытия волн.
 *
 * Включение (после перезагрузки страницы):
 *   localStorage.setItem('zarazaWaveRenderDebug', '1')
 *   или в URL: ?waveRenderDebug=1
 *   или: window.ZARAZA_WAVE_RENDER_DEBUG = true
 *
 * Подробно по каждой createWaveElement / generateSineWave:
 *   localStorage.setItem('zarazaWaveRenderDebug', 'verbose')
 *
 * Консоль:
 *   __waveRenderDebug.dump()   — JSON буфера
 *   __waveRenderDebug.clear()  — очистить буфер
 *   __waveRenderDebug.invalidate() — сброс кэша «включено» (если меняли флаг без перезагрузки)
 */
(function (global) {
    const LS_KEY = 'zarazaWaveRenderDebug';
    const BUF_MAX = 1200;
    const buf = [];
    let cacheT = 0;
    let cacheEnabled = false;
    const CACHE_MS = 120;

    /** Проверить флаг отладки: global, localStorage, query ?waveRenderDebug=1. */
    function readEnabledRaw() {
        if (global.ZARAZA_WAVE_RENDER_DEBUG === true) {
            return true;
        }
        try {
            const v = global.localStorage && global.localStorage.getItem(LS_KEY);
            if (v === '1' || v === 'true' || v === 'verbose' || v === '2') {
                return true;
            }
        } catch (e) { /* ignore */ }
        try {
            if (typeof global.location !== 'undefined' && global.location.search) {
                if (/[?&]waveRenderDebug=1(?:&|$)/.test(global.location.search)) {
                    return true;
                }
            }
        } catch (e2) { /* ignore */ }
        return false;
    }

    /** Кэшированная проверка включения профилирования (~120 ms). */
    function isEnabled() {
        const now = Date.now();
        if (now - cacheT < CACHE_MS) {
            return cacheEnabled;
        }
        cacheT = now;
        cacheEnabled = readEnabledRaw();
        return cacheEnabled;
    }

    /** Подробный лог каждой createWaveElement / generateSineWave (localStorage verbose). */
    function isVerbose() {
        try {
            const v = global.localStorage && global.localStorage.getItem(LS_KEY);
            return v === 'verbose' || v === '2';
        } catch (e) {
            return false;
        }
    }

    /** Добавить строку в кольцевой буфер (макс. BUF_MAX записей). */
    function pushRow(row) {
        buf.push(row);
        if (buf.length > BUF_MAX) {
            buf.splice(0, buf.length - BUF_MAX);
        }
    }

    /** Записать этап в буфер и console.log [WaveRender]. */
    function log(stage, detail) {
        if (!isEnabled()) {
            return;
        }
        const t =
            global.performance && global.performance.now
                ? global.performance.now()
                : Date.now();
        const row = { t: Math.round(t * 1000) / 1000, stage };
        if (detail !== undefined && detail !== null && typeof detail === 'object') {
            Object.assign(row, detail);
        } else if (detail !== undefined) {
            row.detail = detail;
        }
        pushRow(row);
        if (global.console && global.console.log) {
            global.console.log('[WaveRender]', row.t.toFixed(2) + 'ms', stage, detail !== undefined ? detail : '');
        }
    }

    /**
     * Таймер этапа: log(stage.start), возвращает колбэк для stage.end с durationMs.
     * @param {string} stage
     * @param {object} [detail]
     * @returns {function(object=): void}
     */
    function t(stage, detail) {
        if (!isEnabled()) {
            return function () {};
        }
        const t0 =
            global.performance && global.performance.now
                ? global.performance.now()
                : Date.now();
        log(stage + '.start', detail);
        return function (endDetail) {
            const t1 =
                global.performance && global.performance.now
                    ? global.performance.now()
                    : Date.now();
            const durationMs = Math.round((t1 - t0) * 1000) / 1000;
            const out =
                endDetail !== undefined && endDetail !== null && typeof endDetail === 'object'
                    ? Object.assign({ durationMs }, endDetail)
                    : { durationMs, endDetail };
            log(stage + '.end', out);
        };
    }

    global.__waveRenderDebug = {
        log,
        t,
        isEnabled,
        isVerbose,
        /** Копия буфера событий отрисовки. */
        getBuffer: function () {
            return buf.slice();
        },
        /** JSON буфера для копирования в консоль. */
        dump: function () {
            return JSON.stringify(buf, null, 2);
        },
        /** Очистить буфер событий. */
        clear: function () {
            buf.length = 0;
        },
        /** Сбросить кэш isEnabled после смены флага без перезагрузки. */
        invalidate: function () {
            cacheT = 0;
        }
    };
})(typeof window !== 'undefined' ? window : globalThis);
