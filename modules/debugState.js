class DebugState {
    constructor() {
        this.logs = [];
        this.maxLogs = 100;
    }
    
    logSave(action, data = {}) {
        const log = {
            timestamp: new Date().toISOString(),
            action,
            data,
            state: this.getStateSnapshot()
        };
        
        this.logs.unshift(log);
        if (this.logs.length > this.maxLogs) {
            this.logs.pop();
        }
    }
    
    getStateSnapshot() {
        if (!window.appState) return null;
        
        return {
            uiSettings: { ...window.appState.uiSettings },
            states: {
                waveVisibility: { ...window.appState.states.waveVisibility },
                waveBold: { ...window.appState.states.waveBold },
                waveCornerColor: { ...window.appState.states.waveCornerColor }
            },
            data: {
                datesCount: window.appState.data.dates.length,
                wavesCount: window.appState.data.waves.length,
                notesCount: window.appState.data.notes.length,
                groupsCount: window.appState.data.groups.length
            }
        };
    }
    
    exportLogs() {
        const data = {
            logs: this.logs,
            summary: {
                totalSaves: this.logs.length,
                lastSave: this.logs[0]?.timestamp,
                stateSnapshot: this.getStateSnapshot()
            }
        };
        
        const dataStr = JSON.stringify(data, null, 2);
        const blob = new Blob([dataStr], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        
        const a = document.createElement('a');
        a.href = url;
        a.download = `state-debug-${new Date().toISOString().slice(0, 19).replace(/:/g, '-')}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }
    
    checkForMissingSaves() {
        const missing = [];
        
        const requiredSettings = [
            'graphHeight6Squares',
            'graphGrayMode',
            'cornerSquaresVisible'
        ];
        
        requiredSettings.forEach(setting => {
            if (window.appState.uiSettings[setting] === undefined) {
                missing.push(`uiSettings.${setting}`);
            }
        });
        
        if (missing.length > 0) {
            return missing;
        }
        
        return [];
    }
}

window.debugState = new DebugState();

window.showState = function() {
};

window.forceSaveAll = function() {
    if (window.appState?.save) {
        window.appState.save();
    }
    
    if (window.stateManager?.forceSave) {
        window.stateManager.forceSave();
    }
};

window.exportStateDebug = function() {
    if (window.debugState?.exportLogs) {
        window.debugState.exportLogs();
    }
};

window.checkStateIssues = function() {
    if (window.debugState?.checkForMissingSaves) {
        const issues = window.debugState.checkForMissingSaves();
        if (issues.length === 0) {
        }
        return issues;
    }
    return [];
};