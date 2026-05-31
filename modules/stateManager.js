/**
 * @file stateManager.js
 * Альтернативный менеджер состояния v2 с регистрацией путей getter/setter.
 */
class StateManager {
    constructor() {
        this.statePaths = {};
        this.autoSaveEnabled = true;
        this.saveQueue = new Set();
        this.isSaving = false;
    }
    
    /** Регистрирует getter/setter для пути состояния v2. */
    registerPath(path, getter, setter) {
        this.statePaths[path] = { getter, setter };
    }
    
    /** Собирает объект состояния из зарегистрированных путей. */
    getState() {
        const state = {
            uiSettings: {},
            states: {},
            data: {}
        };
        
        Object.entries(this.statePaths).forEach(([path, { getter }]) => {
            const value = getter();
            this.setNestedProperty(state, path, value);
        });
        
        return state;
    }
    
    /** Запись appStateV2 в localStorage. */
    autoSave() {
        if (!this.autoSaveEnabled || this.isSaving) return;
        
        this.isSaving = true;
        
        try {
            const state = this.getState();
            
            state._metadata = {
                version: '2.0',
                savedAt: new Date().toISOString(),
                schemaVersion: 1
            };
            
            localStorage.setItem('appStateV2', JSON.stringify(state));
        } catch (error) {
        } finally {
            this.isSaving = false;
        }
    }
    
    /** Восстановление из appStateV2. */
    restore() {
        const saved = localStorage.getItem('appStateV2');
        if (!saved) {
            return false;
        }
        
        try {
            const state = JSON.parse(saved);
            
            if (!state._metadata || state._metadata.version !== '2.0') {
                return false;
            }
            
            let restoredCount = 0;
            Object.entries(this.statePaths).forEach(([path, { setter }]) => {
                const value = this.getNestedProperty(state, path);
                if (value !== undefined) {
                    try {
                        setter(value);
                        restoredCount++;
                    } catch (error) {
                    }
                }
            });
            
            return restoredCount > 0;
        } catch (error) {
            return false;
        }
    }
    
    /** Принудительный autoSave. */
    forceSave() {
        this.autoSaveEnabled = true;
        this.autoSave();
    }
    
    /** Отключает автосохранение v2. */
    disableAutoSave() {
        this.autoSaveEnabled = false;
    }
    
    /** Включает автосохранение v2. */
    enableAutoSave() {
        this.autoSaveEnabled = true;
    }
    
    /** Запись значения по точечному пути. */
    setNestedProperty(obj, path, value) {
        const keys = path.split('.');
        let current = obj;
        
        for (let i = 0; i < keys.length - 1; i++) {
            const key = keys[i];
            if (current[key] === undefined || typeof current[key] !== 'object') {
                current[key] = {};
            }
            current = current[key];
        }
        
        const lastKey = keys[keys.length - 1];
        current[lastKey] = value;
    }
    
    /** Чтение значения по точечному пути. */
    getNestedProperty(obj, path) {
        const keys = path.split('.');
        let current = obj;
        
        for (const key of keys) {
            if (current === undefined || current === null || typeof current !== 'object') {
                return undefined;
            }
            current = current[key];
        }
        
        return current;
    }
    
    /** Перенос appData → appStateV2. */
    migrateFromV1() {
        const oldData = localStorage.getItem('appData');
        if (!oldData) return false;
        
        try {
            const oldState = JSON.parse(oldData);
            
            if (oldState.uiSettings) {
                const uiSettings = oldState.uiSettings;
                
                if (this.statePaths['uiSettings'] && this.statePaths['uiSettings'].setter) {
                    this.statePaths['uiSettings'].setter(uiSettings);
                }
                
                if (uiSettings.waveVisibility && this.statePaths['states.waveVisibility']) {
                    this.statePaths['states.waveVisibility'].setter(uiSettings.waveVisibility);
                }
                
                if (uiSettings.waveBold && this.statePaths['states.waveBold']) {
                    this.statePaths['states.waveBold'].setter(uiSettings.waveBold);
                }
                
                if (uiSettings.waveCornerColor && this.statePaths['states.waveCornerColor']) {
                    this.statePaths['states.waveCornerColor'].setter(uiSettings.waveCornerColor);
                }
            }
            
            if (oldState.data && this.statePaths['data']) {
                this.statePaths['data'].setter(oldState.data);
            }
            
            this.forceSave();
            
            localStorage.removeItem('appData');
            
            return true;
        } catch (error) {
            return false;
        }
    }
}

window.stateManager = new StateManager();