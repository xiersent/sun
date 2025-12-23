// modules/debugState.js
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
        
        console.log(`[Save] ${action}`, data);
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
        
        // Проверяем основные настройки
        const requiredSettings = [
            'graphHeight6Squares',
            'graphGrayMode',
            'showTooltips',
            'cornerSquaresVisible'
        ];
        
        requiredSettings.forEach(setting => {
            if (window.appState.uiSettings[setting] === undefined) {
                missing.push(`uiSettings.${setting}`);
            }
        });
        
        if (missing.length > 0) {
            console.warn('Найдены непрописанные настройки:', missing);
            return missing;
        }
        
        return [];
    }
}

// Глобальные команды для отладки
window.debugState = new DebugState();

// Команды для консоли
window.showState = function() {
    console.log('=== ТЕКУЩЕЕ СОСТОЯНИЕ ===');
    console.log('UI Settings:', window.appState?.uiSettings);
    console.log('States:', window.appState?.states);
    console.log('Data counts:', {
        dates: window.appState?.data.dates.length,
        waves: window.appState?.data.waves.length,
        notes: window.appState?.data.notes.length,
        groups: window.appState?.data.groups.length
    });
    
    // Проверяем сохранение в localStorage
    const v1 = localStorage.getItem('appData');
    const v2 = localStorage.getItem('appStateV2');
    
    console.log('LocalStorage:');
    console.log('  V1 (старый формат):', v1 ? '✓ Есть' : '✗ Нет');
    console.log('  V2 (новый формат):', v2 ? '✓ Есть' : '✗ Нет');
    
    if (v2) {
        try {
            const parsed = JSON.parse(v2);
            console.log('  V2 метаданные:', parsed._metadata);
        } catch (e) {
            console.error('Ошибка парсинга V2:', e);
        }
    }
};

window.forceSaveAll = function() {
    console.log('Принудительное сохранение всех данных...');
    
    if (window.appState?.save) {
        window.appState.save();
    }
    
    if (window.stateManager?.forceSave) {
        window.stateManager.forceSave();
    }
    
    console.log('Сохранение завершено');
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
            console.log('✓ Все настройки корректно сохраняются');
        }
        return issues;
    }
    return [];
};