// modules/state.js
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
        
        this.create120Waves();
        this.create31Waves();
        
        const s25LocalDate = new Date(1990, 0, 25, 0, 0, 0, 0);
        
        const now = new Date();
        const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
        
        this.initialData = {
            version: "1.0",
            created: "2024-01-01",
            waves: this.waves120.concat(this.waves31).concat([
                { id: 24, name: '24 красность', description: 'Физический ритм', period: 24, color: '#FF0000', type: 'solid', category: 'classic', visible: true, bold: false, cornerColor: false },
                { id: 28, name: '28 зеленость', description: 'Эмоциональный ритм', period: 28, color: '#008000', type: 'solid', category: 'classic', visible: true, bold: false, cornerColor: false },
                { id: 33, name: '33 синесть', description: 'Интеллектуальный ритм', period: 33, color: '#0000FF', type: 'solid', category: 'classic', visible: true, bold: false, cornerColor: false },
                { id: 38, name: '38 фиолетовость', description: 'Интуитивный ритм', period: 38, color: '#800080', type: 'solid', category: 'classic', visible: true, bold: false, cornerColor: false },
                { id: 25, name: '25 черность', description: 'Экспериментальный ритм', period: 25, color: '#000000', type: 'solid', category: 'experimental', visible: true, bold: false, cornerColor: false },
                { id: 365, name: 'Текущий год', description: 'Ритм текущего года', period: 365.25, color: '#FFA500', type: 'solid', category: 'experimental', visible: true, bold: false, cornerColor: false }
            ]),
            dates: [
                { 
                    id: 's25', 
                    date: s25LocalDate.getTime(),
                    name: 's25' 
                }
            ],
            notes: [],
            groups: [
                { id: 'default-group', name: 'Стандартная', enabled: false, waves: [], styleEnabled: false, styleBold: false, styleColor: '#666666', styleColorEnabled: false, styleType: 'solid', expanded: true },
                { id: 'classic-group', name: 'Классическая', enabled: false, waves: [24, 28, 33, 38], styleEnabled: false, styleBold: false, styleColor: '#666666', styleColorEnabled: false, styleType: 'solid', expanded: false },
                { id: 'experimental-group', name: 'Экспериментальная', enabled: false, waves: [25, 365], styleEnabled: false, styleBold: false, styleColor: '#666666', styleColorEnabled: false, styleType: 'solid', expanded: false },
                { id: '120-waves-group', name: '120 колосков', enabled: false, waves: this.waves120Ids, styleEnabled: true, styleBold: false, styleColor: '#666666', styleColorEnabled: false, styleType: 'dashed', expanded: false },
                { id: '31-waves-group', name: '31 колосок', enabled: false, waves: this.waves31Ids, styleEnabled: true, styleBold: false, styleColor: '#666666', styleColorEnabled: false, styleType: 'dotted', expanded: false }
            ],
            uiSettings: {
                currentDate: Date.now(),
                baseDate: todayStart.getTime(),
                currentDay: 0,
                transform: { scaleX: 1, scaleY: 1, rotation: 0 },
                uiHidden: false,
                graphHidden: false,
                graphBgWhite: true,
                showStars: true,
                grayMode: false,
                graphGrayMode: false,
                cornerSquaresVisible: true,
                activeDateId: 's25',
                waveVisibility: {},
                waveBold: {},
                waveCornerColor: {},
                // ДОБАВЛЕНО: состояния выделения дат
                dateSelections: {
                    typeA: null,  // ID даты с выделением типа A
                    typeB: null   // ID даты с выделением типа B
                },
				// В constructor() AppState заменить initialData.presets:
				presets: {
					activePresetId: 'preset1',
					list: [
						{ 
							id: 'preset1', 
							name: 'Пресет', 
							waveVisibility: {},
							groupStates: {},
							waveBold: {},
							waveCornerColor: {},
							uiSettings: {}
						},
						{ 
							id: 'preset2', 
							name: 'Пресет', 
							waveVisibility: {},
							groupStates: {},
							waveBold: {},
							waveCornerColor: {},
							uiSettings: {}
						},
						{ 
							id: 'preset3', 
							name: 'Пресет', 
							waveVisibility: {},
							groupStates: {},
							waveBold: {},
							waveCornerColor: {},
							uiSettings: {}
						},
						{ 
							id: 'preset4', 
							name: 'Пресет', 
							waveVisibility: {},
							groupStates: {},
							waveBold: {},
							waveCornerColor: {},
							uiSettings: {}
						},
						{ 
							id: 'preset5', 
							name: 'Пресет', 
							waveVisibility: {},
							groupStates: {},
							waveBold: {},
							waveCornerColor: {},
							uiSettings: {}
						}
					]
				}
            }
        };
        
        this.load();
    }
    
    create120Waves() {
        this.waves120 = [];
        this.waves120Ids = [];
        
        const colorPalette = [
            '#1f77b4', '#ff7f0e', '#2ca02c', '#d62728', '#9467bd',
            '#8c564b', '#e377c2', '#7f7f7f', '#bcbd22', '#17becf',
            '#e41a1c', '#377eb8', '#4daf4a', '#984ea3', '#ff7f00',
            '#ffff33', '#a65628', '#f781bf', '#999999',
            '#66c2a5', '#fc8d62', '#8da0cb', '#e78ac3', '#a6d854',
            '#ffd92f', '#e5c494', '#b3b3b3',
            '#8dd3c7', '#ffffb3', '#bebada', '#fb8072', '#80b1d3',
            '#fdb462', '#b3de69', '#fccde5', '#d9d9d9', '#bc80bd',
            '#ccebc5', '#ffed6f',
            '#a6cee3', '#1f78b4', '#b2df8a', '#33a02c', '#fb9a99',
            '#e31a1c', '#fdbf6f', '#ff7f00', '#cab2d6', '#6a3d9a',
            '#ffff99', '#b15928',
            '#fbb4ae', '#b3cde3', '#ccebc5', '#decbe4', '#fed9a6',
            '#ffffcc', '#e5d8bd', '#fddaec', '#f2f2f2',
            '#b3e2cd', '#fdcdac', '#cbd5e8', '#f4cae4', '#e6f5c9',
            '#fff2ae', '#f1e2cc', '#cccccc',
            '#1b9e77', '#d95f02', '#7570b3', '#e7298a', '#66a61e',
            '#e6ab02', '#a6761d', '#666666',
            '#7fc97f', '#beaed4', '#fdc086', '#ffff99', '#386cb0',
            '#f0027f', '#bf5b17', '#666666'
        ];
        
        const additionalColors = [
            '#1abc9c', '#2ecc71', '#3498db', '#9b59b6', '#34495e',
            '#16a085', '#27ae60', '#2980b9', '#8e44ad', '#2c3e50',
            '#f1c40f', '#e67e22', '#e74c3c', '#ecf0f1', '#95a5a6',
            '#f39c12', '#d35400', '#c0392b', '#bdc3c7', '#7f8c8d',
            '#55efc4', '#81ecec', '#74b9ff', '#a29bfe', '#dfe6e9',
            '#00b894', '#00cec9', '#0984e3', '#6c5ce7', '#ffeaa7',
            '#fab1a0', '#ff7675', '#fd79a8', '#fdcb6e', '#e17055',
            '#d63031', '#feca57', '#5f27cd', '#54a0ff', '#00d2d3'
        ];
        
        const allColors = [...colorPalette, ...additionalColors];
        
        for (let i = 1; i <= 120; i++) {
            const waveId = `wave-120-${i}`;
            this.waves120Ids.push(waveId);
            
            const wave = {
                id: waveId,
                name: `Колосок ${i}`,
                description: `Период ${i} дней`,
                period: i,
                color: allColors[(i - 1) % allColors.length],
                type: 'dashed',
                category: '120-waves',
                visible: false,
                bold: false,
                cornerColor: false
            };
            
            this.waves120.push(wave);
        }
    }
    
    create31Waves() {
        this.waves31 = [];
        this.waves31Ids = [];
        
        const colors31 = [
            '#FF6B6B', '#4ECDC4', '#FFD166', '#06D6A0', '#118AB2',
            '#EF476F', '#1B9AAA', '#FF9A00', '#9B5DE5', '#00BBF9',
            '#F15BB5', '#00F5D4', '#00BBF9', '#FEE440', '#9B5DE5',
            '#00F5D4', '#FF9A00', '#06D6A0', '#118AB2', '#EF476F',
            '#4ECDC4', '#FFD166', '#FF6B6B', '#1B9AAA', '#9B5DE5',
            '#00BBF9', '#F15BB5', '#00F5D4', '#FEE440', '#06D6A0',
            '#118AB2'
        ];
        
        for (let i = 1; i <= 31; i++) {
            const waveId = `wave-31-${i}`;
            this.waves31Ids.push(waveId);
            
            const wave = {
                id: waveId,
                name: `Колосок ${i}`,
                description: `Период ${i} дней`,
                period: i,
                color: colors31[(i - 1) % colors31.length],
                type: 'dotted',
                category: '31-waves',
                visible: false,
                bold: false,
                cornerColor: false
            };
            
            this.waves31.push(wave);
        }
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
        
        // ДОБАВЛЕНО: сохранение состояний выделения дат
        this.data.uiSettings.dateSelections = this.dateSelections;

        // ДОБАВЛЕНО: сохранение пресетов
        this.data.uiSettings.presets = this.presets;

        localStorage.setItem('appData', JSON.stringify(this.data));
    }
    
    load() {
        const saved = localStorage.getItem('appData');
        if (saved) {
            try {
                const data = JSON.parse(saved);
                this.data = data;
                
                this.convertDatesToTimestamp();
                
                const has120Waves = this.data.waves.some(w => {
                    const waveIdStr = String(w.id);
                    return waveIdStr.startsWith('wave-120-');
                });
                
                if (!has120Waves) {
                    this.data.waves = this.data.waves.concat(this.waves120);
                    
                    if (!this.data.groups.some(g => g.id === '120-waves-group')) {
                        this.data.groups.push({
                            id: '120-waves-group',
                            name: '120 колосков',
                            enabled: true,
                            waves: this.waves120Ids,
                            styleEnabled: true,
                            styleBold: false,
                            styleColor: '#666666',
                            styleColorEnabled: false,
                            styleType: 'dashed',
                            expanded: false
                        });
                    }
                }
                
                const has31Waves = this.data.waves.some(w => {
                    const waveIdStr = String(w.id);
                    return waveIdStr.startsWith('wave-31-');
                });
                
                if (!has31Waves) {
                    this.data.waves = this.data.waves.concat(this.waves31);
                        
                    if (!this.data.groups.some(g => g.id === '31-waves-group')) {
                        this.data.groups.push({
                            id: '31-waves-group',
                            name: '31 колосок',
                            enabled: true,
                            waves: this.waves31Ids,
                            styleEnabled: true,
                            styleBold: false,
                            styleColor: '#666666',
                            styleColorEnabled: false,
                            styleType: 'dotted',
                            expanded: false
                        });
                    }
                }
                
                this.data.waves.forEach(wave => {
                    const waveIdStr = String(wave.id);
                    if (typeof wave.id === 'number') {
                        wave.id = waveIdStr;
                    }
                    if (waveIdStr.startsWith('wave-31-')) {
                        const match = waveIdStr.match(/wave-31-(\d+)/);
                        if (match) {
                            const num = parseInt(match[1]);
                            wave.name = `Колосок ${num}`;
                            wave.description = `Период ${num} дней`;
                        }
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
                
                this.transform = data.uiSettings.transform;
                this.uiHidden = data.uiSettings.uiHidden || false;
                this.graphHidden = data.uiSettings.graphHidden || false;
                this.graphBgWhite = data.uiSettings.graphBgWhite !== undefined ? data.uiSettings.graphBgWhite : true;
                this.showStars = data.uiSettings.showStars !== undefined ? data.uiSettings.showStars : true;
                this.grayMode = data.uiSettings.grayMode || false;
                this.graphGrayMode = data.uiSettings.graphGrayMode !== undefined ? data.uiSettings.graphGrayMode : false;
                this.cornerSquaresVisible = data.uiSettings.cornerSquaresVisible !== undefined ? data.uiSettings.cornerSquaresVisible : true;
                
                this.editingDateId = null;
                this.editingWaveId = null;
                this.editingGroupId = null;
                
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
                
                // ДОБАВЛЕНО: Загрузка пресетов
                if (data.uiSettings.presets) {
                    this.presets = data.uiSettings.presets;
                } else {
                    // Если пресетов нет - создаем по умолчанию
                    this.presets = {
                        activePresetId: 'preset1',
                        list: [
                            { id: 'preset1', name: 'Пресет', waveVisibility: {} },
                            { id: 'preset2', name: 'Пресет', waveVisibility: {} },
                            { id: 'preset3', name: 'Пресет', waveVisibility: {} },
                            { id: 'preset4', name: 'Пресет', waveVisibility: {} },
                            { id: 'preset5', name: 'Пресет', waveVisibility: {} }
                        ]
                    };
                    
                    // МИГРАЦИЯ: переносим текущие включенные колоски в первый пресет
                    if (data.uiSettings.waveVisibility) {
                        this.presets.list[0].waveVisibility = { ...data.uiSettings.waveVisibility };
                    }
                }
                
                // Загружаем активный пресет в waveVisibility
                this.loadActivePreset();
                
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
                
                // ДОБАВЛЕНО: загрузка состояний выделения дат
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
                this.reset();
            }
        } else {
            this.reset();
        }
    }

    reset() {
        this.data = JSON.parse(JSON.stringify(this.initialData));
        
        this.currentDate = new Date();
        
        const now = new Date();
        this.baseDate = new Date(
            now.getFullYear(),
            now.getMonth(),
            now.getDate(),
            0, 0, 0, 0
        );
        
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
        this.activeDateId = 's25';
        
        this.editingDateId = null;
        this.editingWaveId = null;
        this.editingGroupId = null;
        
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
        
        this.data.waves.forEach(wave => {
            const waveIdStr = String(wave.id);
            this.waveVisibility[waveIdStr] = wave.visible !== undefined ? wave.visible : true;
            this.waveBold[waveIdStr] = wave.bold || false;
            this.waveCornerColor[waveIdStr] = wave.cornerColor || false;
        });
        
        this.data.uiSettings.waveVisibility = this.waveVisibility;
        this.data.uiSettings.waveBold = this.waveBold;
        this.data.uiSettings.waveCornerColor = this.waveCornerColor;
        
        // ДОБАВЛЕНО: сброс состояний выделения дат
        this.dateSelections = {
            typeA: null,
            typeB: null
        };
        this.data.uiSettings.dateSelections = this.dateSelections;
        
        // ДОБАВЛЕНО: сброс пресетов
        this.presets = {
            activePresetId: 'preset1',
            list: [
                { id: 'preset1', name: 'Пресет', waveVisibility: {} },
                { id: 'preset2', name: 'Пресет', waveVisibility: {} },
                { id: 'preset3', name: 'Пресет', waveVisibility: {} },
                { id: 'preset4', name: 'Пресет', waveVisibility: {} },
                { id: 'preset5', name: 'Пресет', waveVisibility: {} }
            ]
        };
        this.data.uiSettings.presets = this.presets;
    }

    convertDatesToTimestamp() {
        this.data.dates.forEach(date => {
            if (date.date && !this.isTimestamp(date.date)) {
                try {
                    const dateObj = new Date(date.date);
                    if (!isNaN(dateObj.getTime())) {
                        date.date = dateObj.getTime();
                    }
                } catch (e) {
                }
            }
        });
        
        this.data.notes.forEach(note => {
            if (note.date && !this.isTimestamp(note.date)) {
                try {
                    const dateObj = new Date(note.date);
                    if (!isNaN(dateObj.getTime())) {
                        note.date = dateObj.getTime();
                    }
                } catch (e) {
                }
            }
        });
        
        ['currentDate', 'baseDate'].forEach(key => {
            if (this.data.uiSettings[key] && !this.isTimestamp(this.data.uiSettings[key])) {
                try {
                    const dateObj = new Date(this.data.uiSettings[key]);
                    if (!isNaN(dateObj.getTime())) {
                        this.data.uiSettings[key] = dateObj.getTime();
                    }
                } catch (e) {
                }
            }
        });
    }

    isTimestamp(value) {
        return typeof value === 'number' && !isNaN(value) && value > 0;
    }
    
    generateId() {
        return Date.now().toString(36) + Math.random().toString(36).substr(2);
    }
    
	// Заменить существующие методы:

	// modules/state.js - полный исправленный метод loadActivePreset
	loadActivePreset() {
		if (!this.presets || !this.presets.activePresetId) return;

		const activePreset = this.presets.list.find(p => p.id === this.presets.activePresetId);
		if (activePreset) {
			// 1. ВАЖНОЕ ИСПРАВЛЕНИЕ: Сначала полностью сбрасываем все состояния
			
			// 1.1 Сбрасываем видимость колосков
			this.waveVisibility = {};
			
			// 1.2 Сбрасываем жирность колосков
			this.waveBold = {};
			
			// 1.3 Сбрасываем окраску краев
			this.waveCornerColor = {};
			
			// 2. Загружаем видимость колосков из пресета
			if (activePreset.waveVisibility && Object.keys(activePreset.waveVisibility).length > 0) {
				// Копируем видимость из пресета
				Object.keys(activePreset.waveVisibility).forEach(waveId => {
					if (activePreset.waveVisibility[waveId] === true) {
						this.waveVisibility[waveId] = true;
					}
				});
				
				// Для всех остальных колосков устанавливаем false
				this.data.waves.forEach(wave => {
					const waveIdStr = String(wave.id);
					if (this.waveVisibility[waveIdStr] === undefined) {
						this.waveVisibility[waveIdStr] = false;
					}
				});
			} else {
				// Пустой пресет - все колоски выключены
				this.data.waves.forEach(wave => {
					const waveIdStr = String(wave.id);
					this.waveVisibility[waveIdStr] = false;
				});
			}

			// 3. Загружаем состояния групп
			if (activePreset.groupStates && Object.keys(activePreset.groupStates).length > 0) {
				// Применяем сохраненные состояния ко ВСЕМ группам
				this.data.groups.forEach(group => {
					const groupIdStr = String(group.id);
					if (activePreset.groupStates[groupIdStr] !== undefined) {
						group.enabled = activePreset.groupStates[groupIdStr];
					} else {
						// Если состояния нет в пресете - устанавливаем false
						group.enabled = false;
					}
				});
			} else {
				// Если в пресете нет сохраненных состояний групп
				// Устанавливаем все группы ВЫКЛЮЧЕННЫМИ
				this.data.groups.forEach(group => {
					group.enabled = false;
				});
			}

			// 4. Загружаем жирность колосков из пресета
			if (activePreset.waveBold && Object.keys(activePreset.waveBold).length > 0) {
				// Копируем жирность из пресета
				Object.keys(activePreset.waveBold).forEach(waveId => {
					if (activePreset.waveBold[waveId] === true) {
						this.waveBold[waveId] = true;
					}
				});
				
				// Для всех остальных колосков устанавливаем false
				this.data.waves.forEach(wave => {
					const waveIdStr = String(wave.id);
					if (this.waveBold[waveIdStr] === undefined) {
						this.waveBold[waveIdStr] = false;
					}
				});
			} else {
				// Если в пресете нет жирности - все колоски нежирные
				this.data.waves.forEach(wave => {
					const waveIdStr = String(wave.id);
					this.waveBold[waveIdStr] = false;
				});
			}

			// 5. Загружаем окраску краев из пресета
			if (activePreset.waveCornerColor && Object.keys(activePreset.waveCornerColor).length > 0) {
				// Копируем окраску из пресета
				Object.keys(activePreset.waveCornerColor).forEach(waveId => {
					if (activePreset.waveCornerColor[waveId] === true) {
						this.waveCornerColor[waveId] = true;
					}
				});
				
				// Для всех остальных колосков устанавливаем false
				this.data.waves.forEach(wave => {
					const waveIdStr = String(wave.id);
					if (this.waveCornerColor[waveIdStr] === undefined) {
						this.waveCornerColor[waveIdStr] = false;
					}
				});
			} else {
				// Если в пресете нет окраски - все края не окрашены
				this.data.waves.forEach(wave => {
					const waveIdStr = String(wave.id);
					this.waveCornerColor[waveIdStr] = false;
				});
			}

			// 6. Загружаем настройки интерфейса
			if (activePreset.uiSettings) {
				if (activePreset.uiSettings.uiHidden !== undefined) {
					this.uiHidden = activePreset.uiSettings.uiHidden;
				}
				if (activePreset.uiSettings.graphHidden !== undefined) {
					this.graphHidden = activePreset.uiSettings.graphHidden;
				}
				if (activePreset.uiSettings.graphBgWhite !== undefined) {
					this.graphBgWhite = activePreset.uiSettings.graphBgWhite;
				}
				if (activePreset.uiSettings.showStars !== undefined) {
					this.showStars = activePreset.uiSettings.showStars;
				}
				if (activePreset.uiSettings.grayMode !== undefined) {
					this.grayMode = activePreset.uiSettings.grayMode;
				}
				if (activePreset.uiSettings.graphGrayMode !== undefined) {
					this.graphGrayMode = activePreset.uiSettings.graphGrayMode;
				}
				if (activePreset.uiSettings.cornerSquaresVisible !== undefined) {
					this.cornerSquaresVisible = activePreset.uiSettings.cornerSquaresVisible;
				}
			}
			
			// 7. После загрузки пресета, синхронизируем UI
			setTimeout(() => {
				this.syncWaveBoldUI();
				this.syncGroupUIStates();
				
				// Обновляем цвета краев
				if (window.waves && window.waves.updateCornerSquareColors) {
					window.waves.updateCornerSquareColors();
				}
			}, 100);
		}
	}

	// modules/state.js - исправить метод savePreset
	savePreset(presetId) {
		if (!this.presets || !presetId) return;

		const preset = this.presets.list.find(p => p.id === presetId);
		if (preset) {
			// Сохраняем видимость колосков (только включенные)
			preset.waveVisibility = {};
			Object.keys(this.waveVisibility).forEach(waveId => {
				if (this.waveVisibility[waveId] === true) {
					preset.waveVisibility[waveId] = true;
				}
			});

			// Сохраняем состояния ВСЕХ групп
			preset.groupStates = {};
			this.data.groups.forEach(group => {
				const groupIdStr = String(group.id);
				preset.groupStates[groupIdStr] = group.enabled === true;
			});

			// ВАЖНОЕ ИСПРАВЛЕНИЕ: Сохраняем жирность колосков
			preset.waveBold = {};
			this.data.waves.forEach(wave => {
				const waveIdStr = String(wave.id);
				const isBold = this.waveBold[waveIdStr] === true;
				if (isBold) {
					preset.waveBold[waveIdStr] = true;
				}
			});

			// Сохраняем окраску краев (только включенные)
			preset.waveCornerColor = {};
			Object.keys(this.waveCornerColor).forEach(waveId => {
				if (this.waveCornerColor[waveId] === true) {
					preset.waveCornerColor[waveId] = true;
				}
			});

			// Сохраняем настройки интерфейса
			preset.uiSettings = {
				uiHidden: this.uiHidden,
				graphHidden: this.graphHidden,
				graphBgWhite: this.graphBgWhite,
				showStars: this.showStars,
				grayMode: this.grayMode,
				graphGrayMode: this.graphGrayMode,
				cornerSquaresVisible: this.cornerSquaresVisible
			};

			this.save();
		}
	}

	// В modules/state.js добавить метод:
	syncGroupUIStates() {
		// Синхронизируем чекбоксы групп в UI с состоянием в данных
		this.data.groups.forEach(group => {
			const checkbox = document.querySelector(`.wave-group-toggle[data-group-id="${group.id}"]`);
			if (checkbox) {
				checkbox.checked = group.enabled === true;
			}
		});
	}

	// modules/state.js - добавить метод syncWaveBoldUI
	syncWaveBoldUI() {
		// Синхронизируем чекбоксы жирности в UI с состоянием в данных
		this.data.waves.forEach(wave => {
			const waveIdStr = String(wave.id);
			const isBold = this.waveBold[waveIdStr] === true;
			
			// Обновляем чекбоксы в списке
			const checkbox = document.querySelector(`.wave-bold-check[data-id="${waveIdStr}"]`);
			if (checkbox) {
				checkbox.checked = isBold;
			}
			
			// Обновляем стиль волны на графике
			if (window.waves && window.waves.wavePaths && window.waves.wavePaths[wave.id]) {
				const path = window.waves.wavePaths[wave.id];
				path.classList.toggle('bold', isBold);
			}
		});
	}

	switchPreset(presetId) {
		if (!this.presets || !presetId) return;
		
		// Сохраняем текущий пресет перед переключением
		this.savePreset(this.presets.activePresetId);
		
		// Переключаемся на новый
		this.presets.activePresetId = presetId;
		this.loadActivePreset();
		
		// Синхронизируем UI состояния групп
		this.syncGroupUIStates();
		
		// СИНХРОНИЗАЦИЯ: обновляем чекбоксы жирности в UI
		this.syncWaveBoldUI();
		
		// Применяем UI настройки
		this.applyUISettingsFromPreset();
		
		// Пересоздаем волны с новыми настройками
		// Вместо этого метода вызываем обновление волн через waves
		if (window.waves && window.waves.recreateAllWavesForPreset) {
			window.waves.recreateAllWavesForPreset();
		}
		
		this.save();
	}

	applyUISettingsFromPreset() {
		// Применяем настройки интерфейса
		if (this.uiHidden) {
			document.body.classList.add('ui-hidden');
			if (window.timeBarManager && window.timeBarManager.container) {
				window.timeBarManager.container.style.display = 'none';
			}
		} else {
			document.body.classList.remove('ui-hidden');
			if (window.timeBarManager && window.timeBarManager.container) {
				window.timeBarManager.container.style.display = 'block';
			}
		}
		
		if (this.graphHidden) {
			document.body.classList.add('graph-hidden');
		} else {
			document.body.classList.remove('graph-hidden');
		}
		
		if (this.showStars) {
			document.body.classList.add('stars-mode');
			document.body.classList.remove('names-mode');
		} else {
			document.body.classList.remove('stars-mode');
			document.body.classList.add('names-mode');
		}
		
		if (this.grayMode) {
			document.body.classList.add('gray-mode');
		} else {
			document.body.classList.remove('gray-mode');
		}
		
		if (this.graphGrayMode) {
			document.body.classList.add('graph-gray-mode');
			const graphContainer = document.getElementById('graphContainer');
			if (graphContainer) {
				graphContainer.classList.add('graph-gray-mode');
			}
		} else {
			document.body.classList.remove('graph-gray-mode');
			const graphContainer = document.getElementById('graphContainer');
			if (graphContainer) {
				graphContainer.classList.remove('graph-gray-mode');
			}
		}
		
		const allSquares = document.querySelectorAll('.corner-square');
		allSquares.forEach(square => {
			square.style.display = this.cornerSquaresVisible ? 'block' : 'none';
		});
		
		const graphContainer = document.getElementById('graphContainer');
		if (graphContainer) {
			if (!this.graphBgWhite) {
				graphContainer.classList.add('dark-mode');
			} else {
				graphContainer.classList.remove('dark-mode');
			}
		}
	}

	renamePreset(presetId, newName) {
		if (!this.presets || !presetId) return;
		
		const preset = this.presets.list.find(p => p.id === presetId);
		if (preset && newName && newName.trim() !== '') {
			preset.name = newName.trim();
			this.save();
		}
	}

	// modules/state.js - добавить метод resetWaveBoldForPreset
	resetWaveBoldForPreset() {
		// Сбрасываем жирность всех колосков
		this.waveBold = {};
		this.data.waves.forEach(wave => {
			const waveIdStr = String(wave.id);
			this.waveBold[waveIdStr] = false;
		});
		
		// Обновляем UI чекбоксов
		if (window.unifiedListManager && window.unifiedListManager.updateWavesList) {
			setTimeout(() => {
				window.unifiedListManager.updateWavesList();
			}, 100);
		}
	}

    
    renamePreset(presetId, newName) {
        if (!this.presets || !presetId) return;
        
        const preset = this.presets.list.find(p => p.id === presetId);
        if (preset && newName && newName.trim() !== '') {
            preset.name = newName.trim();
            this.save();
        }
    }
}

window.appState = new AppState();