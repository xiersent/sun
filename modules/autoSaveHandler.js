// modules/autoSaveHandler.js
class AutoSaveHandler {
    constructor() {
        this.debounceTimers = new Map();
        this.debounceDelay = 1000; // 1 секунда
        this.autoSaveInterval = null;
        this.isInitialized = false;
        
        this.init();
    }
    
    init() {
        if (this.isInitialized) return;
        
        console.log('AutoSaveHandler: инициализация...');
        
        // Настройка обработчиков событий
        this.setupEventListeners();
        
        // Автосохранение по таймеру (каждые 30 секунд)
        this.autoSaveInterval = setInterval(() => {
            this.autoSave();
        }, 30000);
        
        // Автосохранение при видимости страницы
        document.addEventListener('visibilitychange', () => {
            if (document.visibilityState === 'hidden') {
                this.forceSave();
            }
        });
        
        // Автосохранение при закрытии страницы
        window.addEventListener('beforeunload', () => {
            this.forceSave();
        });
        
        this.isInitialized = true;
        console.log('AutoSaveHandler: инициализация завершена');
    }
    
    setupEventListeners() {
        // Сохраняем при изменении input элементов
        document.addEventListener('change', (e) => {
            if (e.target.matches('input, select, textarea')) {
                this.debouncedSave();
            }
        });
        
        // Сохраняем при вводе текста (с дебаунсом)
        document.addEventListener('input', (e) => {
            if (e.target.matches('textarea, input[type="text"], input[type="number"]')) {
                this.debouncedSave();
            }
        });
        
        // Сохраняем при клике на кнопки (кроме навигации)
        document.addEventListener('click', (e) => {
            const button = e.target.closest('button');
            if (button) {
                const action = button.dataset?.action;
                // Сохраняем после всех действий, кроме навигации
                if (action && !['prevDay', 'nextDay'].includes(action)) {
                    this.debouncedSave();
                }
            }
        });
        
        // Сохраняем при изменении чекбоксов
        document.addEventListener('click', (e) => {
            if (e.target.matches('input[type="checkbox"]')) {
                this.debouncedSave();
            }
        });
        
        // Сохраняем при изменении цвета
        document.addEventListener('change', (e) => {
            if (e.target.matches('input[type="color"]')) {
                this.debouncedSave();
            }
        });
    }
    
    debouncedSave(key = 'default') {
        // Очищаем предыдущий таймер
        if (this.debounceTimers.has(key)) {
            clearTimeout(this.debounceTimers.get(key));
        }
        
        // Устанавливаем новый таймер
        const timer = setTimeout(() => {
            this.save();
            this.debounceTimers.delete(key);
        }, this.debounceDelay);
        
        this.debounceTimers.set(key, timer);
    }
    
    save() {
        if (window.appState && window.appState.save) {
            window.appState.save();
            console.log('AutoSaveHandler: состояние сохранено');
        }
    }
    
    autoSave() {
        if (!document.hidden && window.appState) {
            this.save();
        }
    }
    
    forceSave() {
        // Очищаем все таймеры дебаунса
        this.debounceTimers.forEach(timer => clearTimeout(timer));
        this.debounceTimers.clear();
        
        // Принудительно сохраняем
        this.save();
    }
    
    destroy() {
        // Очищаем таймеры
        this.debounceTimers.forEach(timer => clearTimeout(timer));
        this.debounceTimers.clear();
        
        // Останавливаем интервал автосохранения
        if (this.autoSaveInterval) {
            clearInterval(this.autoSaveInterval);
            this.autoSaveInterval = null;
        }
        
        this.isInitialized = false;
        console.log('AutoSaveHandler: уничтожен');
    }
}

window.autoSaveHandler = new AutoSaveHandler();