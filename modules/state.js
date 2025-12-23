// optimized3/modules/state.js
class AppState {
    constructor() {
        this.config = {
            baseSize: 10,
            squareSize: 50,
            graphHeight: 500,
            amplitude: 250,
            gridSquaresX: 24,
            phaseOffsetDays: -12,
            weekdays: ['Вс', 'Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Срб'],
            weekdaysFull: ['Воскресенье', 'Понедельник', 'Вторник', 'Среда', 'Четверг', 'Пятница', 'Суббота'],
            
            // НОВЫЕ ПАРАМЕТРЫ ДЛЯ ДИНАМИЧЕСКИХ ПЕРИОДОВ
            minVisiblePeriods: 3,           // Минимум периодов для эффекта бесконечности
            viewportCoverageFactor: 1.2,    // Контейнер должен быть шире визора на 20%
            safetyMarginPeriods: 1,         // Дополнительный период "про запас"
            maxRenderPoints: 3000           // Ограничение на количество точек рендеринга
        };
        
        this.create120Waves();
        this.create31Waves();
        
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
                { id: 's25', date: '1990-01-25T00:00:00.000Z', name: 's25' }
            ],
            notes: [],
            groups: [
                { id: 'default-group', name: 'Основная группа', enabled: false, waves: [], styleEnabled: false, styleBold: false, styleColor: '#666666', styleColorEnabled: false, styleType: 'solid', expanded: true },
                { id: 'classic-group', name: 'Классическая', enabled: false, waves: [24, 28, 33, 38], styleEnabled: false, styleBold: false, styleColor: '#666666', styleColorEnabled: false, styleType: 'solid', expanded: false },
                { id: 'experimental-group', name: 'Экспериментальные', enabled: false, waves: [25, 365], styleEnabled: false, styleBold: false, styleColor: '#666666', styleColorEnabled: false, styleType: 'solid', expanded: false },
                { id: '120-waves-group', name: '120 колосков', enabled: false, waves: this.waves120Ids, styleEnabled: true, styleBold: false, styleColor: '#666666', styleColorEnabled: false, styleType: 'dashed', expanded: false },
                { id: '31-waves-group', name: '31 колосок', enabled: false, waves: this.waves31Ids, styleEnabled: true, styleBold: false, styleColor: '#666666', styleColorEnabled: false, styleType: 'dotted', expanded: false }
            ],
            uiSettings: {
                currentDate: new Date().toISOString(),
                baseDate: new Date().toISOString(),
                currentDay: 0,
                transform: { scaleX: 1, scaleY: 1, rotation: 0 },
                uiHidden: false,
                graphHidden: false,
                graphBgWhite: true,
                showStars: true,
                grayMode: false,
                graphGrayMode: false,
                showTooltips: false,
                cornerSquaresVisible: true,
                activeDateId: 's25',
                editingDateId: null,
                editingWaveId: null,
                editingGroupId: null,
                waveVisibility: {},
                waveBold: {},
                waveCornerColor: {}
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
    
    load() {
        const saved = localStorage.getItem('appData');
        if (saved) {
            try {
                const data = JSON.parse(saved);
                this.data = data;
                
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
                
                const defaultGroupIndex = this.data.groups.findIndex(g => g.id === 'default-group');
                if (defaultGroupIndex > 0) {
                    const defaultGroup = this.data.groups.splice(defaultGroupIndex, 1)[0];
                    this.data.groups.unshift(defaultGroup);
                }
                
                this.currentDate = new Date(data.uiSettings.currentDate);
                this.baseDate = new Date(data.uiSettings.baseDate);
                this.currentDay = data.uiSettings.currentDay;
                this.transform = data.uiSettings.transform;
                this.uiHidden = data.uiSettings.uiHidden || false;
                this.graphHidden = data.uiSettings.graphHidden || false;
                this.graphBgWhite = data.uiSettings.graphBgWhite !== undefined ? data.uiSettings.graphBgWhite : true;
                this.showStars = data.uiSettings.showStars !== undefined ? data.uiSettings.showStars : true;
                this.grayMode = data.uiSettings.grayMode || false;
                this.graphGrayMode = data.uiSettings.graphGrayMode !== undefined ? data.uiSettings.graphGrayMode : false;
                this.showTooltips = data.uiSettings.showTooltips !== undefined ? data.uiSettings.showTooltips : false;
                this.cornerSquaresVisible = data.uiSettings.cornerSquaresVisible !== undefined ? data.uiSettings.cornerSquaresVisible : true;
                this.editingDateId = data.uiSettings.editingDateId || null;
                this.editingWaveId = data.uiSettings.editingWaveId || null;
                this.editingGroupId = data.uiSettings.editingGroupId || null;
                
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
                            this.baseDate = new Date(activeDate.date);
                        } catch (error) {
                            console.error('Error parsing active date:', error);
                            this.baseDate = new Date();
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
                this.tooltipZIndex = 100;
                this.waveOriginalColors = {};
                this.periods = {};
                
                // ВОССТАНОВЛЕНИЕ СОСТОЯНИЯ ВОЛН
                this.waveVisibility = {};
                this.waveBold = {};
                this.waveCornerColor = {};
                
                // Загружаем сохраненные состояния
                if (data.uiSettings.waveVisibility) {
                    this.waveVisibility = data.uiSettings.waveVisibility;
                }
                if (data.uiSettings.waveBold) {
                    this.waveBold = data.uiSettings.waveBold;
                }
                if (data.uiSettings.waveCornerColor) {
                    this.waveCornerColor = data.uiSettings.waveCornerColor;
                }
                
                // Инициализируем состояния, если их нет
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
                
            } catch (e) {
                console.error('Ошибка загрузки состояния:', e);
                this.reset();
            }
        } else {
            this.reset();
        }
    }
    
    reset() {
        this.data = JSON.parse(JSON.stringify(this.initialData));
        
        this.currentDate = new Date();
        this.baseDate = new Date();
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
        this.showTooltips = false;
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
        this.tooltipZIndex = 100;
        this.waveOriginalColors = {};
        this.periods = {};
        
        // ИНИЦИАЛИЗАЦИЯ СОСТОЯНИЙ ВОЛН
        this.waveVisibility = {};
        this.waveBold = {};
        this.waveCornerColor = {};
        
        this.data.waves.forEach(wave => {
            const waveIdStr = String(wave.id);
            this.waveVisibility[waveIdStr] = wave.visible !== undefined ? wave.visible : true;
            this.waveBold[waveIdStr] = wave.bold || false;
            this.waveCornerColor[waveIdStr] = wave.cornerColor || false;
        });
        
        // Сохраняем начальные состояния в uiSettings
        this.data.uiSettings.waveVisibility = this.waveVisibility;
        this.data.uiSettings.waveBold = this.waveBold;
        this.data.uiSettings.waveCornerColor = this.waveCornerColor;
    }
    
    save() {
        this.data.uiSettings.currentDate = this.currentDate.toISOString();
        this.data.uiSettings.baseDate = this.baseDate.toISOString();
        this.data.uiSettings.currentDay = this.currentDay;
        this.data.uiSettings.transform = this.transform;
        this.data.uiSettings.uiHidden = this.uiHidden;
        this.data.uiSettings.graphHidden = this.graphHidden;
        this.data.uiSettings.graphBgWhite = this.graphBgWhite;
        this.data.uiSettings.showStars = this.showStars;
        this.data.uiSettings.grayMode = this.grayMode;
        this.data.uiSettings.graphGrayMode = this.graphGrayMode;
        this.data.uiSettings.showTooltips = this.showTooltips;
        this.data.uiSettings.cornerSquaresVisible = this.cornerSquaresVisible;
        this.data.uiSettings.activeDateId = this.activeDateId;
        this.data.uiSettings.editingDateId = this.editingDateId;
        this.data.uiSettings.editingWaveId = this.editingWaveId;
        this.data.uiSettings.editingGroupId = this.editingGroupId;
        
        // СОХРАНЕНИЕ СОСТОЯНИЙ ВОЛН
        this.data.uiSettings.waveVisibility = this.waveVisibility;
        this.data.uiSettings.waveBold = this.waveBold;
        this.data.uiSettings.waveCornerColor = this.waveCornerColor;
        
        localStorage.setItem('appData', JSON.stringify(this.data));
    }
    
    generateId() {
        return Date.now().toString(36) + Math.random().toString(36).substr(2);
    }
}

window.appState = new AppState();