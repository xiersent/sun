// modules/dataManager.js
/** Отладка списка дат / чекбоксов A|B. Отключить: window.__SUN_DEBUG_DATE_LIST = false */
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

class DataManager {
    constructor() {
        this.elements = window.appCore ? window.appCore.elements : {};
    }
    
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
    
    async updateWavesGroups() {
        const container = document.getElementById('wavesList');
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