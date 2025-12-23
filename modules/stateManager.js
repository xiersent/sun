// modules/stateManager.js
class StateManager {
    constructor() {
        this.statePaths = {};
        this.autoSaveEnabled = true;
        this.saveQueue = new Set();
        this.isSaving = false;
    }
    
    // Регистрация пути для сохранения
    registerPath(path, getter, setter) {
        this.statePaths[path] = { getter, setter };
    }
    
    // Получение текущего состояния
    getState() {
        const state = {
            uiSettings: {},
            states: {},
            data: {}
        };
        
        // Собираем все данные
        Object.entries(this.statePaths).forEach(([path, { getter }]) => {
            const value = getter();
            this.setNestedProperty(state, path, value);
        });
        
        return state;
    }
    
    // Автоматическое сохранение
    autoSave() {
        if (!this.autoSaveEnabled || this.isSaving) return;
        
        this.isSaving = true;
        
        try {
            const state = this.getState();
            
            // Добавляем метаданные
            state._metadata = {
                version: '2.0',
                savedAt: new Date().toISOString(),
                schemaVersion: 1
            };
            
            // Сохраняем в localStorage
            localStorage.setItem('appStateV2', JSON.stringify(state));
            
            console.log('Состояние сохранено автоматически');
        } catch (error) {
            console.error('Ошибка автоматического сохранения:', error);
        } finally {
            this.isSaving = false;
        }
    }
    
    // Восстановление состояния
    restore() {
        const saved = localStorage.getItem('appStateV2');
        if (!saved) {
            console.log('Нет сохраненного состояния V2');
            return false;
        }
        
        try {
            const state = JSON.parse(saved);
            
            // Проверяем версию
            if (!state._metadata || state._metadata.version !== '2.0') {
                console.warn('Неверная версия сохраненного состояния');
                return false;
            }
            
            // Восстанавливаем все зарегистрированные пути
            let restoredCount = 0;
            Object.entries(this.statePaths).forEach(([path, { setter }]) => {
                const value = this.getNestedProperty(state, path);
                if (value !== undefined) {
                    try {
                        setter(value);
                        restoredCount++;
                    } catch (error) {
                        console.error(`Ошибка восстановления пути ${path}:`, error);
                    }
                }
            });
            
            console.log(`Восстановлено ${restoredCount} путей состояния`);
            return restoredCount > 0;
        } catch (error) {
            console.error('Ошибка восстановления состояния:', error);
            return false;
        }
    }
    
    // Принудительное сохранение
    forceSave() {
        this.autoSaveEnabled = true;
        this.autoSave();
    }
    
    // Отключение автосохранения
    disableAutoSave() {
        this.autoSaveEnabled = false;
    }
    
    // Включение автосохранения
    enableAutoSave() {
        this.autoSaveEnabled = true;
    }
    
    // Вспомогательные методы для работы с вложенными свойствами
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
    
    // Миграция из старого формата
    migrateFromV1() {
        const oldData = localStorage.getItem('appData');
        if (!oldData) return false;
        
        try {
            const oldState = JSON.parse(oldData);
            
            // Мигрируем основные настройки
            if (oldState.uiSettings) {
                // UI настройки
                const uiSettings = oldState.uiSettings;
                
                // Регистрируем и восстанавливаем
                if (this.statePaths['uiSettings'] && this.statePaths['uiSettings'].setter) {
                    this.statePaths['uiSettings'].setter(uiSettings);
                }
                
                // Состояния волн
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
            
            // Мигрируем данные
            if (oldState.data && this.statePaths['data']) {
                this.statePaths['data'].setter(oldState.data);
            }
            
            console.log('Миграция из V1 выполнена успешно');
            this.forceSave();
            
            // Удаляем старые данные после успешной миграции
            localStorage.removeItem('appData');
            
            return true;
        } catch (error) {
            console.error('Ошибка миграции из V1:', error);
            return false;
        }
    }
}

window.stateManager = new StateManager();