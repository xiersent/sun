class AutoSaveHandler {
    constructor() {
        this.debounceTimers = new Map();
        this.debounceDelay = 1000;
        this.autoSaveInterval = null;
        this.isInitialized = false;
        
        this.init();
    }
    
    init() {
        if (this.isInitialized) return;
        
        this.setupEventListeners();
        
        this.autoSaveInterval = setInterval(() => {
            this.autoSave();
        }, 30000);
        
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
    
    debouncedSave(key = 'default') {
        if (this.debounceTimers.has(key)) {
            clearTimeout(this.debounceTimers.get(key));
        }
        
        const timer = setTimeout(() => {
            this.save();
            this.debounceTimers.delete(key);
        }, this.debounceDelay);
        
        this.debounceTimers.set(key, timer);
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
        this.debounceTimers.forEach(timer => clearTimeout(timer));
        this.debounceTimers.clear();
        
        this.save();
    }
    
    destroy() {
        this.debounceTimers.forEach(timer => clearTimeout(timer));
        this.debounceTimers.clear();
        
        if (this.autoSaveInterval) {
            clearInterval(this.autoSaveInterval);
            this.autoSaveInterval = null;
        }
        
        this.isInitialized = false;
    }
}

window.autoSaveHandler = new AutoSaveHandler();