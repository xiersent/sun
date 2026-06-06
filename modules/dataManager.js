/**
 * @file dataManager.js
 * Обновление списков дат и групп волн через unifiedListManager.
 */
(function initSunDateListLog() {
    if (typeof window.sunDateListLog === 'function') {
        return;
    }
    window.sunDateListLog = function sunDateListLog(...args) {
        if (window.__SUN_DEBUG_DATE_LIST === false) {
            return;
        }
        console.log('[sunDateList]', ...args);
    };
})();

/** Слой B волн / сравнение дат. Отключить: window.__SUN_DEBUG_WAVE_LAYER_B = false */
(function initSunWaveLayerBLog() {
    if (typeof window.sunWaveLayerBLog === 'function') {
        return;
    }
    window.sunWaveLayerBLog = function sunWaveLayerBLog(message, payload) {
        if (window.__SUN_DEBUG_WAVE_LAYER_B === false) {
            return;
        }
        if (payload !== undefined) {
            console.log('[sun:waveLayerB]', message, payload);
        } else {
            console.log('[sun:waveLayerB]', message);
        }
    };
})();

class DataManager {
    constructor() {
        this.elements = window.appCore ? window.appCore.elements : {};
    }

    /** Обновить подписи A/B во вкладке «Поиск состояний». */
    refreshStateSearchPersonSelects() {
        if (window.stateSearchManager && typeof window.stateSearchManager.refreshPersonSelects === 'function') {
            window.stateSearchManager.refreshPersonSelects();
        }
    }
    
    /** Полная перерисовка списка персон и синхронизация A/B. */
    async updateDateList() {
        window.sunDateListLog && window.sunDateListLog('updateDateList:enter', {
            activeDateId: window.appState.activeDateId,
            dateSelections: { ...window.appState.dateSelections }
        });
        if (!window.unifiedListManager.templatesLoaded) {
            await window.unifiedListManager.initTemplates().catch(() => {});
        }
        if (window.unifiedListManager.updateDatesList) {
            window.unifiedListManager.updateDatesList();
        }
        window.sunDateListLog && window.sunDateListLog('updateDateList:after updateDatesList', {
            dateSelections: { ...window.appState.dateSelections },
            selA: window.dateComparisonManager && window.dateComparisonManager.elA
                ? window.dateComparisonManager.elA.value
                : null,
            selB: window.dateComparisonManager && window.dateComparisonManager.elB
                ? window.dateComparisonManager.elB.value
                : null
        });
        if (window.unifiedListManager.syncDateListSelectionVisuals) {
            window.unifiedListManager.syncDateListSelectionVisuals();
        }
        window.sunDateListLog && window.sunDateListLog('updateDateList:after syncDateListSelectionVisuals', {
            dateSelections: { ...window.appState.dateSelections }
        });
        window.sunDateListLog && window.sunDateListLog('updateDateList:done');
    }

    /**
     * Смена только выделения персоны A/B в списке дат — без полной перерисовки списка и без повторного updateDateList.
     * @param {'a'|'b'|'both'} [changedType]
     */
    applyDateSelectionChange(changedType = 'both') {
        window.sunDateListLog &&
            window.sunDateListLog('applyDateSelectionChange', {
                changedType,
                dateSelections: { ...window.appState.dateSelections }
            });

        if (window.unifiedListManager && window.unifiedListManager.syncDateListSelectionVisuals) {
            window.unifiedListManager.syncDateListSelectionVisuals();
        }
        if (
            window.dateComparisonManager &&
            window.dateComparisonManager.ensureSelectsSyncedWithDateList
        ) {
            window.dateComparisonManager.ensureSelectsSyncedWithDateList();
        }

        const layer =
            changedType === 'a' || changedType === 'b' ? changedType : 'both';
        if (window.waves) {
            if (layer === 'b' && typeof window.waves.reconcileVisibleWaveElements === 'function') {
                window.waves.reconcileVisibleWaveElements();
            } else {
                window.waves.updatePosition();
                if (typeof window.waves.updateCornerSquareColors === 'function') {
                    window.waves.updateCornerSquareColors();
                }
            }
        }

        if (window.extremumTimeManager && window.extremumTimeManager.updateExtremums) {
            window.extremumTimeManager.updateExtremums();
        }
        if (window.grid && window.grid.updateCenterDate) {
            window.grid.updateCenterDate();
        }

        if (window.stateIntersectionManager && window.stateIntersectionManager.debouncedUpdate) {
            window.stateIntersectionManager.debouncedUpdate();
        } else if (
            window.stateIntersectionManager &&
            window.stateIntersectionManager.updateIntersections
        ) {
            window.stateIntersectionManager.updateIntersections();
        }
        if (window.summaryManager && window.summaryManager.debouncedUpdate) {
            window.summaryManager.debouncedUpdate();
        } else if (window.summaryManager && window.summaryManager.updateSummary) {
            window.summaryManager.updateSummary();
        }
        if (window.dateComparisonManager && window.dateComparisonManager.debouncedUpdate) {
            window.dateComparisonManager.debouncedUpdate();
        }
    }
    
    /** Перерисовка списка групп и волн на вкладке сигналов. */
    async updateWavesGroups() {
        const container = window.dom.byKey('wavesList');
        if (!container) {
            return;
        }
        
        await window.unifiedListManager.renderListWithWait('wavesList', [], 'group');
        
        const lookups = window.unifiedListManager.buildWaveListLookups();
        const allGroups = window.appState.data.groups.map((group, index) => {
            return window.unifiedListManager.prepareGroupData(group, index, lookups);
        });
        
        await window.unifiedListManager.renderListWithWait('wavesList', allGroups, 'group');

        if (window.summaryManager && window.summaryManager.refresh) {
            window.summaryManager.refresh();
        }
        if (window.dateComparisonManager && window.dateComparisonManager.updateComparison) {
            window.dateComparisonManager.updateComparison();
        }
    }
}

window.dataManager = new DataManager();