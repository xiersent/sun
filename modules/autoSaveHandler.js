/**
 * @file autoSaveHandler.js
 * Автосохранение appState при изменениях форм и перед закрытием страницы.
 */
class AutoSaveHandler {
    constructor() {
        this._saveRaf = null;
        this.isInitialized = false;

        this.init();
    }

    /** Подписка на change/input/click и beforeunload. */
    init() {
        if (this.isInitialized) return;

        this.setupEventListeners();

        document.addEventListener('visibilitychange', () => {
            if (document.visibilityState === 'hidden') {
                this.forceSave();
            }
        });
        
        window.addEventListener('beforeunload', () => {
            this.forceSave();
        });
        
        this.isInitialized = true;
    }
    
    /** Делегирование событий форм для debouncedSave. */
    setupEventListeners() {
        document.addEventListener('change', (e) => {
            if (e.target.matches('input, select, textarea')) {
                this.debouncedSave();
            }
        });
        
        document.addEventListener('input', (e) => {
            if (e.target.matches('textarea, input[type="text"], input[type="number"]')) {
                this.debouncedSave();
            }
        });
        
        document.addEventListener('click', (e) => {
            const button = e.target.closest('button');
            if (button) {
                const action = button.dataset?.action;
                if (action && !['prevDay', 'nextDay'].includes(action)) {
                    this.debouncedSave();
                }
            }
        });
        
        document.addEventListener('click', (e) => {
            if (e.target.matches('input[type="checkbox"]')) {
                this.debouncedSave();
            }
        });
        
        document.addEventListener('change', (e) => {
            if (e.target.matches('input[type="color"]')) {
                this.debouncedSave();
            }
        });
    }
    
    /** save в следующем animation frame. */
    debouncedSave() {
        if (this._saveRaf != null) {
            cancelAnimationFrame(this._saveRaf);
        }
        this._saveRaf = requestAnimationFrame(() => {
            this._saveRaf = null;
            this.save();
        });
    }
    
    /** Вызывает appState.save(). */
    save() {
        if (window.appState && window.appState.save) {
            window.appState.save();
        }
    }
    
    /** save если вкладка видима. */
    autoSave() {
        if (!document.hidden && window.appState) {
            this.save();
        }
    }
    
    /** Немедленный save без debounce. */
    forceSave() {
        if (this._saveRaf != null) {
            cancelAnimationFrame(this._saveRaf);
            this._saveRaf = null;
        }
        this.save();
    }

    /** Отмена RAF и сброс флага инициализации. */
    destroy() {
        if (this._saveRaf != null) {
            cancelAnimationFrame(this._saveRaf);
            this._saveRaf = null;
        }
        this.isInitialized = false;
    }
}

window.autoSaveHandler = new AutoSaveHandler();