// modules/dataManager.js
class DataManager {
    constructor() {
        this.elements = window.appCore ? window.appCore.elements : {};
    }
    
    async updateDateList() {
        await window.unifiedListManager.renderListWithWait('dateListForDates', window.appState.data.dates, 'date');
    }
    
    async updateWavesGroups() {
        const container = document.getElementById('wavesList');
        if (!container) {
            return;
        }
        
        await window.unifiedListManager.renderListWithWait('wavesList', [], 'group');
        
        const allGroups = window.appState.data.groups.map((group, index) => {
            return window.unifiedListManager.prepareGroupData(group, index);
        });
        
        await window.unifiedListManager.renderListWithWait('wavesList', allGroups, 'group');

        if (window.summaryManager && window.summaryManager.refresh) {
            window.summaryManager.refresh();
        }
    }
}

window.dataManager = new DataManager();