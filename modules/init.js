// modules/init.js
// modules/init.js - ОБНОВЛЕННЫЙ (без notes)
const __lp = typeof window !== 'undefined' ? window.__loadPerf : null;

document.addEventListener('DOMContentLoaded', async () => {
    __lp && __lp.mark('domcontentloaded_handler_start');

    const graphElement = document.getElementById('graphElement');
    if (!graphElement) {
        __lp && __lp.mark('init_abort', { reason: 'no_graphElement' });
        return;
    }

    if (!window.appState) {
        __lp && __lp.mark('init_abort', { reason: 'no_appState' });
        return;
    }

    try {
        __lp && __lp.phaseStart('appState_load');
        await window.appState.load();
        __lp && __lp.phaseEnd('appState_load');

        __lp && __lp.mark('timeUtils_dom_construct');
        window.timeUtils = window.timeUtils || new TimeUtils();
        window.dom = window.dom || new DOM();

        const managers = [
            { name: 'dates', class: DatesManager },
            { name: 'appCore', class: AppCore },
            { name: 'waves', class: WavesManager },
            { name: 'grid', class: GridManager },
            { name: 'uiManager', class: UIManager },
            { name: 'dataManager', class: DataManager },
            { name: 'unifiedListManager', class: UnifiedListManager },
            { name: 'importExport', class: ImportExportManager },
            { name: 'stateIntersectionManager', class: StateIntersectionManager },
            { name: 'summaryManager', class: SummaryManager },
            { name: 'eventManager', class: EventManager },
            { name: 'timeBarManager' },
            { name: 'extremumTimeManager', class: ExtremumTimeManager }
        ];

        __lp && __lp.phaseStart('managers_construct');
        for (const manager of managers) {
            if (!window[manager.name] && manager.class) {
                window[manager.name] = new manager.class();
            }
        }
        __lp && __lp.phaseEnd('managers_construct');

        if (window.appCore && window.appCore.init) {
            __lp && __lp.phaseStart('appCore_init');
            await window.appCore.init();
            __lp && __lp.phaseEnd('appCore_init');
        }

        if (window.timeBarManager && window.timeBarManager.init) {
            __lp && __lp.phaseStart('timeBarManager_init');
            window.timeBarManager.init();
            __lp && __lp.phaseEnd('timeBarManager_init');
        }

        __lp && __lp.phaseStart('finalizeInitialization');
        await finalizeInitialization();
        __lp && __lp.phaseEnd('finalizeInitialization');

        __lp && __lp.mark('app_ready_sync');
    } catch (error) {
        __lp && __lp.mark('init_error', { message: error && error.message, name: error && error.name });
        console.error('[LoadPerf] init', error);
    }
});

async function finalizeInitialization() {
    const __lp = typeof window !== 'undefined' ? window.__loadPerf : null;

    if (window.appState) {
        window.appState.editingDateId = null;
        window.appState.editingWaveId = null;
        window.appState.editingGroupId = null;
        window.appState.editingPersonGroupId = null;
    }

    const now = new Date();
    const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);

    __lp && __lp.mark('finalize_active_date');
    if (!window.appState.currentDate || window.appState.currentDate instanceof Date === false) {
        window.appState.currentDate = startOfDay;
    }

    if (window.appState.activeDateId) {
        if (window.dates && window.dates.setActiveDate) {
            window.dates.setActiveDate(window.appState.activeDateId, true);
        }
    } else if (window.appState.data.dates.length > 0) {
        const firstDateId = window.appState.data.dates[0].id;
        window.appState.activeDateId = firstDateId;
        if (window.dates && window.dates.setActiveDate) {
            window.dates.setActiveDate(firstDateId, true);
        }
    } else {
        window.appState.baseDate = startOfDay.getTime();
        if (window.dates && window.dates.recalculateCurrentDay) {
            window.dates.recalculateCurrentDay(true);
        }
    }

    if (window.dataManager) {
        const listsDoneInAppCore = window.appCore && window.appCore._listsHydratedOnInit;
        if (!listsDoneInAppCore) {
            __lp && __lp.phaseStart('finalize_dataManager_lists');
            await window.dataManager.updateDateList();
            await window.dataManager.updateWavesGroups();
            __lp && __lp.phaseEnd('finalize_dataManager_lists');
        } else {
            __lp && __lp.mark('finalize_dataManager_lists_skipped_redundant');
        }
    }

    if (window.grid) {
        if (window.grid.updateCenterDate) {
            __lp && __lp.mark('finalize_grid_updateCenterDate');
            window.grid.updateCenterDate();
        }
    }

    if (window.summaryManager) {
        __lp && __lp.phaseStart('finalize_summary');
        if (window.summaryManager.populateGroupSelect) {
            window.summaryManager.populateGroupSelect();
        }
        if (window.summaryManager.updateSummary) {
            window.summaryManager.updateSummary();
        }
        __lp && __lp.phaseEnd('finalize_summary');
    }

    const mainDateInputDate = document.getElementById('mainDateInputDate');
    const mainDateInputTime = document.getElementById('mainDateInputTime');

    if (mainDateInputDate && mainDateInputTime && window.timeUtils) {
        const formatted = window.timeUtils.formatForDateTimeInputs(window.appState.currentDate);
        mainDateInputDate.value = formatted.date;
        mainDateInputTime.value = formatted.time;
    }

    if (window.dates && window.dates.updateTodayButton) {
        window.dates.updateTodayButton();
    }

    if (window.uiManager && window.uiManager.restoreTabState) {
        __lp && __lp.mark('finalize_restoreTabState');
        window.uiManager.restoreTabState();
    }

    if (window.uiManager && window.uiManager.syncExtremumWaveColorHighlightButton) {
        window.uiManager.syncExtremumWaveColorHighlightButton();
    }

    if (window.extremumTimeManager && window.extremumTimeManager.init) {
        __lp && __lp.mark('finalize_extremumTimeManager_init');
        window.extremumTimeManager.init();
    }

    if (window.appState && window.appState.activeDateId) {
        if (!window.appState.dateSelections) {
            window.appState.dateSelections = {
                typeA: null,
                typeB: null
            };
        }

        const activeDateIdStr = String(window.appState.activeDateId);
        const currentTypeAStr = window.appState.dateSelections.typeA
            ? String(window.appState.dateSelections.typeA)
            : null;

        if (currentTypeAStr !== activeDateIdStr) {
            window.appState.dateSelections.typeA = window.appState.activeDateId;
            window.appState.dateSelections.typeB = null;
            window.appState.save();

            if (window.unifiedListManager && window.unifiedListManager.updateDatesList) {
                window.unifiedListManager.updateDatesList();
            }
        }
    }

    if (window.stateIntersectionManager && window.stateIntersectionManager.refresh) {
        __lp && __lp.mark('finalize_stateIntersection_refresh');
        window.stateIntersectionManager.refresh();
    }
}

window.finalizeInitialization = finalizeInitialization;

if (typeof window !== 'undefined' && window.__loadPerf) {
    window.__loadPerf.mark('init_module_script_parsed');
}