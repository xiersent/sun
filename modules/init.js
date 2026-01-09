document.addEventListener('DOMContentLoaded', async () => {
    const graphElement = document.getElementById('graphElement');
    if (!graphElement) {
        return;
    }
    
    if (!window.appState) {
        return;
    }
    
    try {
        window.appState.load();
        
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
            { name: 'intersectionManager', class: WaveIntersectionManager },
            { name: 'summaryManager', class: SummaryManager },
            { name: 'eventManager', class: EventManager }
        ];
        
        for (const manager of managers) {
            if (!window[manager.name] && manager.class) {
                window[manager.name] = new manager.class();
            }
        }
        
        if (window.unifiedListManager && window.unifiedListManager.initTemplates) {
            window.unifiedListManager.initTemplates().catch(err => {
            });
        }
        
        if (window.appCore && window.appCore.init) {
            await window.appCore.init();
        } else {
        }
        
        await this.finalizeInitialization();
        
    } catch (error) {
    }
});

async function finalizeInitialization() {
    if (window.appState) {
        window.appState.editingDateId = null;
        window.appState.editingWaveId = null;
        window.appState.editingGroupId = null;
    }
    
    const now = new Date();
    const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
    
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
        await window.dataManager.updateDateList();
        await window.dataManager.updateWavesGroups();
        if (window.dataManager.updateNotesList) {
            window.dataManager.updateNotesList();
        }
    }
    
    if (window.grid) {
        if (window.grid.updateCenterDate) {
            window.grid.updateCenterDate();
        }
        if (window.grid.updateGridNotesHighlight) {
            window.grid.updateGridNotesHighlight();
        }
    }
    
    if (window.summaryManager) {
        if (window.summaryManager.populateGroupSelect) {
            window.summaryManager.populateGroupSelect();
        }
        if (window.summaryManager.updateSummary) {
            window.summaryManager.updateSummary();
        }
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
        window.uiManager.restoreTabState();
    }
}

window.finalizeInitialization = finalizeInitialization;