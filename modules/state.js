// modules/state.js - ОЧИЩЕННЫЙ (без начальных данных)
class AppState {
    constructor() {
        this.config = {
            baseSize: 10,
            squareSize: 50,
            graphHeight: 500,
            amplitude: 250,
            gridSquaresX: 24,
            phaseOffsetDays: -12,
            weekdays: ['Вс', 'Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб'],
            weekdaysFull: ['Воскресенье', 'Понедельник', 'Вторник', 'Среда', 'Четверг', 'Пятница', 'Суббота'],
            minVisiblePeriods: 3,
            viewportCoverageFactor: 1.2,
            safetyMarginPeriods: 1,
            maxRenderPoints: 3000
        };
        
        // Создаём пустые массивы для волн (они будут заполнены миграцией)
        this.createEmptyWavesArrays();
        
        // ПУСТЫЕ НАЧАЛЬНЫЕ ДАННЫЕ (без волн, групп и дат)
        this.initialData = {
            version: "1.0",
            created: "2024-01-01",
            waves: [],  // ПУСТО - заполнится миграцией
            dates: [],  // ПУСТО - заполнится миграцией
            personGroups: [], // группы персон (порядок id в dates[]); заполняется миграцией 002
            notes: [],
            groups: [],  // ПУСТО - заполнится миграцией
            uiSettings: {
                currentDate: Date.now(),
                baseDate: this.getTodayStartTimestamp(),
                currentDay: 0,
                transform: { scaleX: 1, scaleY: 1, rotation: 0 },
                uiHidden: false,
                graphHidden: false,
                graphBgWhite: true,
                showStars: true,
                grayMode: false,
                graphGrayMode: false,
                cornerSquaresVisible: true,
                activeDateId: null,
                waveVisibility: {},
                waveBold: {},
                waveCornerColor: {},
                dateSelections: {
                    typeA: null,
                    typeB: null
                },
                waveIntersectionsVisible: true
            }
        };
        
        this._saveDebounceTimer = null;
        this._loadInProgress = null;
        // Полная загрузка (localStorage + миграции) — только из init.js с await;
        // до DOMContentLoaded MigrationsManager ещё не подключён.
        this.applyMemoryDefaultsFromReset({ skipSave: true });
    }
    
    getTodayStartTimestamp() {
        const now = new Date();
        return new Date(
            now.getFullYear(),
            now.getMonth(),
            now.getDate(),
            0, 0, 0, 0
        ).getTime();
    }
    
    createEmptyWavesArrays() {
        // Пустые массивы - миграция заполнит их
        this.waves120 = [];
        this.waves120Ids = [];
        this.waves31 = [];
        this.waves31Ids = [];
        this.waves1000 = [];
        this.waves1000Ids = [];
    }
    
    save() {
        if (!(this.baseDate instanceof Date)) {
            if (typeof this.baseDate === 'number') {
                this.baseDate = new Date(this.baseDate);
            } else {
                const now = new Date();
                this.baseDate = new Date(
                    now.getFullYear(),
                    now.getMonth(),
                    now.getDate(),
                    0, 0, 0, 0
                );
            }
        }
        
        this.data.uiSettings.currentDate = this.currentDate.getTime();
        this.data.uiSettings.baseDate = this.baseDate.getTime();
        
        this.data.uiSettings.currentDay = this.currentDay;
        this.data.uiSettings.transform = this.transform;
        this.data.uiSettings.uiHidden = this.uiHidden;
        this.data.uiSettings.graphHidden = this.graphHidden;
        this.data.uiSettings.graphBgWhite = this.graphBgWhite;
        this.data.uiSettings.showStars = this.showStars;
        this.data.uiSettings.grayMode = this.grayMode;
        this.data.uiSettings.graphGrayMode = this.graphGrayMode;
        this.data.uiSettings.cornerSquaresVisible = this.cornerSquaresVisible;
        this.data.uiSettings.activeDateId = this.activeDateId;
        
        this.data.uiSettings.waveVisibility = this.waveVisibility;
        this.data.uiSettings.waveBold = this.waveBold;
        this.data.uiSettings.waveCornerColor = this.waveCornerColor;
        
        this.data.uiSettings.dateSelections = this.dateSelections;
        this.data.uiSettings.waveIntersectionsVisible = this.waveIntersectionsVisible;

        localStorage.setItem('appData', JSON.stringify(this.data));
    }
    
    saveDebounced(delayMs = 200) {
        if (this._saveDebounceTimer) {
            clearTimeout(this._saveDebounceTimer);
        }
        this._saveDebounceTimer = setTimeout(() => {
            this._saveDebounceTimer = null;
            this.save();
        }, delayMs);
    }
    
    flushPendingSave() {
        if (this._saveDebounceTimer) {
            clearTimeout(this._saveDebounceTimer);
            this._saveDebounceTimer = null;
            this.save();
        }
    }
    
    async load() {
        if (this._loadInProgress) {
            return this._loadInProgress;
        }
        this._loadInProgress = this._loadImpl();
        try {
            await this._loadInProgress;
        } finally {
            this._loadInProgress = null;
        }
    }

    async _loadImpl() {
        const saved = localStorage.getItem('appData');
        if (saved) {
            try {
                const data = JSON.parse(saved);
                this.data = data;
                this.convertDatesToTimestamp();
                
                // ===== ЗАПУСК МИГРАЦИЙ (async: динамическая подгрузка migrations/*.js) =====
                if (window.MigrationsManager) {
                    const migrations = new window.MigrationsManager(this);
                    await migrations.runAllMigrations();
                }
                // ===== КОНЕЦ МИГРАЦИЙ =====
                
                // Преобразование ID волн (числовые → строковые)
                this.data.waves.forEach(wave => {
                    const waveIdStr = String(wave.id);
                    if (typeof wave.id === 'number') {
                        wave.id = waveIdStr;
                    }
                });
                
                if (window.timeUtils) {
                    this.currentDate = window.timeUtils.toLocalDate(data.uiSettings.currentDate);
                    
                    const baseDateLocal = window.timeUtils.toLocalDate(data.uiSettings.baseDate);
                    this.baseDate = window.timeUtils.getStartOfDay(baseDateLocal);
                } else {
                    this.currentDate = new Date(data.uiSettings.currentDate);
                    
                    let baseDateValue = data.uiSettings.baseDate;
                    if (typeof baseDateValue === 'number') {
                        const baseDateObj = new Date(baseDateValue);
                        this.baseDate = new Date(
                            baseDateObj.getFullYear(),
                            baseDateObj.getMonth(),
                            baseDateObj.getDate(),
                            0, 0, 0, 0
                        );
                    } else if (baseDateValue instanceof Date) {
                        const baseDateObj = new Date(baseDateValue.getTime());
                        this.baseDate = new Date(
                            baseDateObj.getFullYear(),
                            baseDateObj.getMonth(),
                            baseDateObj.getDate(),
                            0, 0, 0, 0
                        );
                    } else {
                        const now = new Date();
                        this.baseDate = new Date(
                            now.getFullYear(),
                            now.getMonth(),
                            now.getDate(),
                            0, 0, 0, 0
                        );
                    }
                }
                
                if (data.uiSettings.currentDay !== undefined && 
                    data.uiSettings.currentDay !== null &&
                    typeof data.uiSettings.currentDay === 'number' &&
                    !isNaN(data.uiSettings.currentDay)) {
                    this.currentDay = data.uiSettings.currentDay;
                } else {
                    this.currentDay = 0;
                }
                
                this.transform = data.uiSettings.transform || { scaleX: 1, scaleY: 1, rotation: 0 };
                this.uiHidden = data.uiSettings.uiHidden || false;
                this.graphHidden = data.uiSettings.graphHidden || false;
                this.graphBgWhite = data.uiSettings.graphBgWhite !== undefined ? data.uiSettings.graphBgWhite : true;
                this.showStars = data.uiSettings.showStars !== undefined ? data.uiSettings.showStars : true;
                this.grayMode = data.uiSettings.grayMode || false;
                this.graphGrayMode = data.uiSettings.graphGrayMode !== undefined ? data.uiSettings.graphGrayMode : false;
                this.cornerSquaresVisible = data.uiSettings.cornerSquaresVisible !== undefined ? data.uiSettings.cornerSquaresVisible : true;
                this.waveIntersectionsVisible = data.uiSettings.waveIntersectionsVisible !== undefined ? data.uiSettings.waveIntersectionsVisible : true;
                
                this.editingDateId = null;
                this.editingWaveId = null;
                this.editingGroupId = null;
                this.editingPersonGroupId = null;
                
                if (data.uiSettings.activeDateId) {
                    this.activeDateId = data.uiSettings.activeDateId;
                } else if (data.dates && data.dates.length > 0) {
                    this.activeDateId = data.dates[0].id;
                } else {
                    this.activeDateId = null;
                }
                
                if (this.activeDateId) {
                    const activeDate = data.dates.find(d => d.id === this.activeDateId);
                    if (activeDate) {
                        try {
                            const activeDateLocal = window.timeUtils ? 
                                window.timeUtils.toLocalDate(activeDate.date) : 
                                new Date(activeDate.date);
                            
                            this.baseDate = window.timeUtils ? 
                                window.timeUtils.getStartOfDay(activeDateLocal) : 
                                new Date(
                                    activeDateLocal.getFullYear(),
                                    activeDateLocal.getMonth(),
                                    activeDateLocal.getDate(),
                                    0, 0, 0, 0
                                );
                        } catch (error) {
                            const now = new Date();
                            this.baseDate = new Date(
                                now.getFullYear(),
                                now.getMonth(),
                                now.getDate(),
                                0, 0, 0, 0
                            );
                        }
                    }
                }
                
                this.virtualPosition = this.currentDay * this.config.squareSize;
                this.graphWidth = this.config.gridSquaresX * this.config.squareSize;
                this.isProgrammaticDateChange = false;
                this.SQL = null;
                this.currentDB = null;
                this.dbImportData = null;
                this.intersectionWaves = [];
                this.intersectionResults = [];
                this.waveOriginalColors = {};
                this.periods = {};
                
                this.waveVisibility = {};
                this.waveBold = {};
                this.waveCornerColor = {};
                
                if (data.uiSettings.waveVisibility) {
                    this.waveVisibility = data.uiSettings.waveVisibility;
                }
                if (data.uiSettings.waveBold) {
                    this.waveBold = data.uiSettings.waveBold;
                }
                if (data.uiSettings.waveCornerColor) {
                    this.waveCornerColor = data.uiSettings.waveCornerColor;
                }
                
                this.data.waves.forEach(wave => {
                    const waveIdStr = String(wave.id);
                    if (this.waveVisibility[waveIdStr] === undefined) {
                        this.waveVisibility[waveIdStr] = wave.visible !== undefined ? wave.visible : true;
                    }
                    if (this.waveBold[waveIdStr] === undefined) {
                        this.waveBold[waveIdStr] = wave.bold || false;
                    }
                    if (this.waveCornerColor[waveIdStr] === undefined) {
                        this.waveCornerColor[waveIdStr] = wave.cornerColor || false;
                    }
                });
                
                if (data.uiSettings.dateSelections) {
                    this.dateSelections = data.uiSettings.dateSelections;
                } else {
                    this.dateSelections = {
                        typeA: null,
                        typeB: null
                    };
                }
                
                if (!(this.baseDate instanceof Date)) {
                    if (typeof this.baseDate === 'number') {
                        const baseDateValue = this.baseDate;
                        this.baseDate = new Date(baseDateValue);
                    } else {
                        const now = new Date();
                        this.baseDate = new Date(
                            now.getFullYear(),
                            now.getMonth(),
                            now.getDate(),
                            0, 0, 0, 0
                        );
                    }
                }
                
                setTimeout(() => {
                    if (window.dates && window.dates.forceInitialize) {
                        window.dates.forceInitialize();
                    }
                }, 100);
                
            } catch (e) {
                console.error('Error loading state:', e);
                this.reset();
            }
        } else {
            this.reset();
        }
    }
    
    /**
     * Сброс полей в памяти как в reset(); по умолчанию пишет в localStorage.
     * @param {{ skipSave?: boolean }} [opts]
     */
    applyMemoryDefaultsFromReset(opts = {}) {
        const skipSave = !!opts.skipSave;
        // Копируем пустые начальные данные
        this.data = JSON.parse(JSON.stringify(this.initialData));
        
        const now = new Date();
        const todayStart = new Date(
            now.getFullYear(),
            now.getMonth(),
            now.getDate(),
            0, 0, 0, 0
        );
        
        this.currentDate = new Date();
        this.baseDate = todayStart;
        this.currentDay = 0;
        this.virtualPosition = 0;
        this.graphWidth = this.config.gridSquaresX * this.config.squareSize;
        this.transform = { scaleX: 1, scaleY: 1, rotation: 0 };
        this.uiHidden = false;
        this.graphHidden = false;
        this.graphBgWhite = true;
        this.showStars = true;
        this.grayMode = false;
        this.graphGrayMode = false;
        this.cornerSquaresVisible = true;
        this.waveIntersectionsVisible = true;
        this.activeDateId = null;
        
        this.editingDateId = null;
        this.editingWaveId = null;
        this.editingGroupId = null;
        this.editingPersonGroupId = null;
        
        this.isProgrammaticDateChange = false;
        this.SQL = null;
        this.currentDB = null;
        this.dbImportData = null;
        this.intersectionWaves = [];
        this.intersectionResults = [];
        this.waveOriginalColors = {};
        this.periods = {};
        
        this.waveVisibility = {};
        this.waveBold = {};
        this.waveCornerColor = {};
        
        this.dateSelections = {
            typeA: null,
            typeB: null
        };
        this.data.uiSettings.dateSelections = this.dateSelections;
        
        if (!skipSave) {
            this.save();
        }
    }

    reset() {
        this.applyMemoryDefaultsFromReset({ skipSave: false });
    }
    
    convertDatesToTimestamp() {
        if (this.data.dates) {
            this.data.dates.forEach(date => {
                if (date.date && !this.isTimestamp(date.date)) {
                    try {
                        const dateObj = new Date(date.date);
                        if (!isNaN(dateObj.getTime())) {
                            date.date = dateObj.getTime();
                        }
                    } catch (e) {}
                }
            });
        }
        
        if (this.data.notes) {
            this.data.notes.forEach(note => {
                if (note.date && !this.isTimestamp(note.date)) {
                    try {
                        const dateObj = new Date(note.date);
                        if (!isNaN(dateObj.getTime())) {
                            note.date = dateObj.getTime();
                        }
                    } catch (e) {}
                }
            });
        }
        
        if (this.data.uiSettings) {
            ['currentDate', 'baseDate'].forEach(key => {
                if (this.data.uiSettings[key] && !this.isTimestamp(this.data.uiSettings[key])) {
                    try {
                        const dateObj = new Date(this.data.uiSettings[key]);
                        if (!isNaN(dateObj.getTime())) {
                            this.data.uiSettings[key] = dateObj.getTime();
                        }
                    } catch (e) {}
                }
            });
        }
    }
    
    isTimestamp(value) {
        return typeof value === 'number' && !isNaN(value) && value > 0;
    }
    
    generateId() {
        return Date.now().toString(36) + Math.random().toString(36).substr(2);
    }
}

window.appState = new AppState();
window.addEventListener('pagehide', () => window.appState.flushPendingSave());