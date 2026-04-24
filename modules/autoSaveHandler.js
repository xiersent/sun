// modules/autoSaveHandler.js
class AutoSaveHandler {
    constructor() {
        this._saveRaf = null;
        this.isInitialized = false;

        this.init();
    }

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
    
    debouncedSave() {
        if (this._saveRaf != null) {
            cancelAnimationFrame(this._saveRaf);
        }
        this._saveRaf = requestAnimationFrame(() => {
            this._saveRaf = null;
            this.save();
        });
    }
    
    save() {
        if (window.appState && window.appState.save) {
            window.appState.save();
        }
    }
    
    autoSave() {
        if (!document.hidden && window.appState) {
            this.save();
        }
    }
    
    forceSave() {
        if (this._saveRaf != null) {
            cancelAnimationFrame(this._saveRaf);
            this._saveRaf = null;
        }
        this.save();
    }

    destroy() {
        if (this._saveRaf != null) {
            cancelAnimationFrame(this._saveRaf);
            this._saveRaf = null;
        }
        this.isInitialized = false;
    }
}

window.autoSaveHandler = new AutoSaveHandler();