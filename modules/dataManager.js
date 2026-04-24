// modules/dataManager.js
class DataManager {
    constructor() {
        this.elements = window.appCore ? window.appCore.elements : {};
    }
    
    async updateDateList() {
        if (!window.unifiedListManager.templatesLoaded) {
            await window.unifiedListManager.initTemplates().catch(() => {});
        }
        if (window.unifiedListManager.updateDatesList) {
            window.unifiedListManager.updateDatesList();
        }
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
    }
}

window.dataManager = new DataManager();