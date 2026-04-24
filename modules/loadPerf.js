/**
 * Метки загрузки страницы: performance.mark + console.debug + window.__loadPerf.entries
 * В консоли: __loadPerf.dump() — JSON для профилирования
 */
(function (global) {
    const MARK_PREFIX = 'zaraza:';
    const perf = global.performance;
    const navStart =
        perf && perf.timing && perf.timing.navigationStart > 0
            ? perf.timing.navigationStart
            : perf && perf.timeOrigin
              ? perf.timeOrigin
              : Date.now();

    function nowMs() {
        return perf && perf.now ? perf.now() : Date.now() - navStart;
    }

    const entries = [];
    const openPhases = Object.create(null);

    function mark(name, detail) {
        const ms = nowMs();
        const row = {
            name: String(name),
            ms: Math.round(ms * 1000) / 1000,
            detail: detail !== undefined ? detail : undefined
        };
        entries.push(row);
        try {
            if (perf && perf.mark) perf.mark(MARK_PREFIX + name);
        } catch (e) { /* ignore */ }
        if (global.console && console.log) {
            console.log('[LoadPerf]', name, ms.toFixed(2) + 'ms', detail !== undefined ? detail : '');
        }
    }

    function phaseStart(name) {
        openPhases[name] = nowMs();
        mark(name + '_start');
    }

    function phaseEnd(name) {
        const start = openPhases[name];
        if (start == null) {
            mark(name + '_end', { warn: 'phaseStart не вызывался' });
            return;
        }
        const dur = nowMs() - start;
        delete openPhases[name];
        mark(name + '_end', { durationMs: Math.round(dur * 1000) / 1000 });
        try {
            if (perf && perf.measure) {
                perf.measure(MARK_PREFIX + name, MARK_PREFIX + name + '_start', MARK_PREFIX + name + '_end');
            }
        } catch (e) { /* ignore */ }
    }

    function dump() {
        return JSON.stringify(entries, null, 2);
    }

    const api = {
        mark,
        phaseStart,
        phaseEnd,
        entries,
        dump,
        nowMs
    };

    global.__loadPerf = api;
    mark('loadPerf_module');

    function onReadyState() {
        if (document.readyState === 'interactive') {
            mark('dom_interactive');
        }
        if (document.readyState === 'complete') {
            mark('dom_complete');
        }
    }
    document.addEventListener('readystatechange', onReadyState);
    onReadyState();

    global.addEventListener('load', function onWindowLoad() {
        mark('window_load');
        if (perf && perf.timing) {
            const t = perf.timing;
            mark('navigation_timing', {
                domContentLoadedEventEnd: t.domContentLoadedEventEnd
                    ? t.domContentLoadedEventEnd - t.navigationStart
                    : null,
                loadEventEnd: t.loadEventEnd ? t.loadEventEnd - t.navigationStart : null,
                domInteractive: t.domInteractive ? t.domInteractive - t.navigationStart : null
            });
        }
    });

    if (global.PerformanceObserver) {
        try {
            const po = new PerformanceObserver(function (list) {
                for (const e of list.getEntries()) {
                    if (e.name === 'first-contentful-paint' || e.name === 'first-paint') {
                        mark('paint_' + e.name.replace(/-/g, '_'), { startTime: Math.round(e.startTime * 1000) / 1000 });
                    }
                }
            });
            po.observe({ type: 'paint', buffered: true });
            global.setTimeout(function () {
                try {
                    po.disconnect();
                } catch (e2) { /* ignore */ }
            }, 15000);
        } catch (e) { /* ignore */ }
    }
})(typeof window !== 'undefined' ? window : this);
