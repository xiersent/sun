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
        this.create1000Waves();
        
        const s25LocalDate = new Date(1990, 0, 25, 0, 0, 0, 0);
        
        const now = new Date();
        const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
        
        this.initialData = {
            version: "1.0",
            created: "2024-01-01",
            waves: this.waves120.concat(this.waves31).concat(this.waves1000).concat([
                { id: 24, name: '24 красность', description: 'Физический ритм', period: 24, color: '#FF0000', type: 'solid', category: 'classic', visible: true, bold: false, cornerColor: false },
                { id: 28, name: '28 зеленость', description: 'Эмоциональный ритм', period: 28, color: '#008000', type: 'solid', category: 'classic', visible: true, bold: false, cornerColor: false },
                { id: 33, name: '33 синесть', description: 'Интеллектуальный ритм', period: 33, color: '#0000FF', type: 'solid', category: 'classic', visible: true, bold: false, cornerColor: false },
                { id: 38, name: '38 фиолетовость', description: 'Интуитивный ритм', period: 38, color: '#800080', type: 'solid', category: 'classic', visible: true, bold: false, cornerColor: false },
                { id: 25, name: '25 черность', description: 'Экспериментальный ритм', period: 25, color: '#000000', type: 'solid', category: 'experimental', visible: true, bold: false, cornerColor: false },
                { id: 365, name: 'Текущий год', description: 'Ритм текущего года', period: 365.25, color: '#FFA500', type: 'solid', category: 'experimental', visible: true, bold: false, cornerColor: false },
                { id: 3652422, name: 'Тропический год', description: 'Астрономический (весеннее равноденствие)', period: 365.2422, color: '#FF6B35', type: 'dashed', category: 'experimental', visible: false, bold: false, cornerColor: false },
                { id: 3652425, name: 'Григорианский год', description: 'Календарный (средний за 400 лет)', period: 365.2425, color: '#4CAF50', type: 'dashed', category: 'experimental', visible: false, bold: false, cornerColor: false },
                { id: 36525636, name: 'Сидерический год', description: 'Относительно звёзд', period: 365.25636, color: '#9C27B0', type: 'dashed', category: 'experimental', visible: false, bold: false, cornerColor: false },
                { id: 36525964, name: 'Аномалистический год', description: 'От перигелия до перигелия', period: 365.25964, color: '#FF9800', type: 'dashed', category: 'experimental', visible: false, bold: false, cornerColor: false },
                { id: 36524167, name: 'Драконический год', description: 'Относительно узлов Луны', period: 365.24167, color: '#E91E63', type: 'dashed', category: 'experimental', visible: false, bold: false, cornerColor: false }
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
                { id: 'classic-group', name: 'Классическая', enabled: false, waves: [24, 28, 33, 38], styleEnabled: false, styleBold: false, styleColor: '#666666', styleColorEnabled: false, styleType: 'solid', expanded: false, hidden: true },
                { id: 'experimental-group', name: 'Экспериментальная', enabled: false, waves: [25, 365, 3652422, 3652425, 36525636, 36525964, 36524167], styleEnabled: false, styleBold: false, styleColor: '#666666', styleColorEnabled: false, styleType: 'solid', expanded: false },
                { id: '120-waves-group', name: '120 колосков', enabled: false, waves: this.waves120Ids, styleEnabled: true, styleBold: false, styleColor: '#666666', styleColorEnabled: false, styleType: 'dashed', expanded: false },
                { id: '31-waves-group', name: '31 прутик', enabled: false, waves: this.waves31Ids, styleEnabled: true, styleBold: false, styleColor: '#666666', styleColorEnabled: false, styleType: 'dotted', expanded: false },
                { id: '1000-roads-group', name: '1000 дорог', enabled: false, waves: this.waves1000Ids, styleEnabled: true, styleBold: false, styleColor: '#C0C0C0', styleColorEnabled: true, styleType: 'long-dash', expanded: false }
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
                dateSelections: {
                    typeA: null,
                    typeB: null
                }
            }
        };
        
        this.load();
    }
    
    create120Waves() {
        this.waves120 = [];
        this.waves120Ids = [];
        
        const standardColor = '#C0C0C0';
        
        for (let i = 1; i <= 120; i++) {
            const waveId = `wave-120-${i}`;
            this.waves120Ids.push(waveId);
            
            const wave = {
                id: waveId,
                name: `Колосок ${i}`,
                description: `Период ${i} дней`,
                period: i,
                color: standardColor,
                type: 'dashed',
                category: '120-waves',
                visible: false,
                bold: false,
                cornerColor: false,
                isDefaultColor: true
            };
            
            this.waves120.push(wave);
        }
    }
    
    create31Waves() {
        this.waves31 = [];
        this.waves31Ids = [];
        
        const standardColor = '#C0C0C0';
        
        for (let i = 1; i <= 31; i++) {
            const waveId = `wave-31-${i}`;
            this.waves31Ids.push(waveId);
            
            const wave = {
                id: waveId,
                name: `Прутик ${i}`,
                description: `Период ${i} дней`,
                period: i,
                color: standardColor,
                type: 'dotted',
                category: '31-waves',
                visible: false,
                bold: false,
                cornerColor: false,
                isDefaultColor: true
            };
            
            this.waves31.push(wave);
        }
    }
    
	create1000Waves() {
		this.waves1000 = [];
		this.waves1000Ids = [];
		
		const standardColor = '#C0C0C0';
		
		for (let i = 1; i <= 1000; i++) {
			const waveId = `wave-1000-${i}`;
			this.waves1000Ids.push(waveId);
			
			const threeDigitNum = i.toString().padStart(3, '0');  // <-- НОВОЕ
			
			const wave = {
				id: waveId,
				name: `Дорога ${threeDigitNum}`,  // <-- ИЗМЕНЕНО
				description: `Период ${i} дней`,
				period: i,
				color: standardColor,
				type: 'long-dash',
				category: '1000-roads',
				visible: false,
				bold: false,
				cornerColor: false,
				isDefaultColor: true
			};
			
			this.waves1000.push(wave);
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
        
        this.data.uiSettings.dateSelections = this.dateSelections;

        localStorage.setItem('appData', JSON.stringify(this.data));
    }
    
    load() {
        const saved = localStorage.getItem('appData');
        if (saved) {
            try {
                const data = JSON.parse(saved);
                this.data = data;
                this.convertDatesToTimestamp();
                
                // ===== ЗАПУСК МИГРАЦИЙ =====
                if (window.MigrationsManager) {
                    const migrations = new window.MigrationsManager(this);
                    migrations.runAllMigrations();
                } else {
                    this.runLegacyMigrations();
                }
                // ===== КОНЕЦ МИГРАЦИЙ =====
                
                this.data.waves.forEach(wave => {
                    const waveIdStr = String(wave.id);
                    if (typeof wave.id === 'number') {
                        wave.id = waveIdStr;
                    }
                    if (waveIdStr.startsWith('wave-31-')) {
                        const match = waveIdStr.match(/wave-31-(\d+)/);
                        if (match) {
                            const num = parseInt(match[1]);
                            wave.name = `Прутик ${num}`;
                            wave.description = `Период ${num} дней`;
                        }
                    }
                    if (waveIdStr.startsWith('wave-1000-')) {
                        const match = waveIdStr.match(/wave-1000-(\d+)/);
                        if (match) {
                            const num = parseInt(match[1]);
                            if (!wave.name || wave.name.startsWith('Корешок')) {
                                wave.name = `Дорога ${num}`;
                            }
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
                
                this.fixStandardWaveColors();
                
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
    
    runLegacyMigrations() {
        // Миграция 1
        if (this.data.groups) {
            const old31Group = this.data.groups.find(g => g.id === '31-waves-group' && g.name === '31 колосок');
            if (old31Group) old31Group.name = '31 прутик';
        }
        
        // Миграция 2
        const classicGroup = this.data.groups.find(g => g.id === 'classic-group');
        if (classicGroup) {
            classicGroup.enabled = false;
            classicGroup.hidden = true;
            classicGroup.expanded = false;
        }
        
        // Миграция 3: добавление 120 колосков
        const has120Waves = this.data.waves.some(w => String(w.id).startsWith('wave-120-'));
        if (!has120Waves && this.waves120) {
            this.data.waves = this.data.waves.concat(this.waves120);
            if (!this.data.groups.some(g => g.id === '120-waves-group')) {
                this.data.groups.push({
                    id: '120-waves-group', name: '120 колосков', enabled: true,
                    waves: this.waves120Ids, styleEnabled: true, styleType: 'dashed',
                    styleBold: false, styleColor: '#666666', styleColorEnabled: false, expanded: false
                });
            }
        }
        
        // Миграция 4: добавление 31 прутика
        const has31Waves = this.data.waves.some(w => String(w.id).startsWith('wave-31-'));
        if (!has31Waves && this.waves31) {
            this.data.waves = this.data.waves.concat(this.waves31);
            if (!this.data.groups.some(g => g.id === '31-waves-group')) {
                this.data.groups.push({
                    id: '31-waves-group', name: '31 прутик', enabled: true,
                    waves: this.waves31Ids, styleEnabled: true, styleType: 'dotted',
                    styleBold: false, styleColor: '#666666', styleColorEnabled: false, expanded: false
                });
            }
        }
        
        // Миграция 5: добавление 1000 дорог
        const has1000Waves = this.data.waves.some(w => String(w.id).startsWith('wave-1000-'));
        if (!has1000Waves && this.waves1000) {
            this.data.waves = this.data.waves.concat(this.waves1000);
            if (!this.data.groups.some(g => g.id === '1000-roads-group')) {
                this.data.groups.push({
                    id: '1000-roads-group', name: '1000 дорог', enabled: false,
                    waves: this.waves1000Ids, styleEnabled: true, styleType: 'long-dash',
                    styleBold: false, styleColor: '#C0C0C0', styleColorEnabled: true, expanded: false
                });
            }
        }
        
        // Миграция 6: переименование
        const rootsGroup = this.data.groups.find(g => g.id === '1000-roots-group');
        if (rootsGroup && rootsGroup.name === '1000 корешков') {
            rootsGroup.id = '1000-roads-group';
            rootsGroup.name = '1000 дорог';
        }
        
        this.data.waves.forEach(wave => {
            if (wave.name && wave.name.startsWith('Корешок')) {
                const match = wave.name.match(/\d+/);
                if (match) wave.name = `Дорога ${match[0]}`;
            }
        });
        
        // Миграция 7: добавление астрономических годов
        const experimentalGroup = this.data.groups.find(g => g.id === 'experimental-group');
        if (experimentalGroup) {
            const years = [
                { id: 3652422, name: 'Тропический год', period: 365.2422, color: '#FF6B35', type: 'dashed' },
                { id: 3652425, name: 'Григорианский год', period: 365.2425, color: '#4CAF50', type: 'dashed' },
                { id: 36525636, name: 'Сидерический год', period: 365.25636, color: '#9C27B0', type: 'dashed' },
                { id: 36525964, name: 'Аномалистический год', period: 365.25964, color: '#FF9800', type: 'dashed' },
                { id: 36524167, name: 'Драконический год', period: 365.24167, color: '#E91E63', type: 'dashed' }
            ];
            
            years.forEach(year => {
                if (!this.data.waves.some(w => w.id === year.id)) {
                    this.data.waves.push({ ...year, category: 'experimental', visible: false, bold: false, cornerColor: false });
                    if (!experimentalGroup.waves.includes(year.id)) {
                        experimentalGroup.waves.push(year.id);
                    }
                }
            });
        }
        
        // Миграция 8: удаление 25 черность
        const expGroup = this.data.groups.find(g => g.id === 'experimental-group');
        if (expGroup && expGroup.waves) {
            const idx = expGroup.waves.indexOf(25);
            if (idx !== -1) expGroup.waves.splice(idx, 1);
        }
        
        // Миграция 9: обновление категории
        this.data.waves.forEach(wave => {
            if (String(wave.id).startsWith('wave-1000-') && wave.category === '1000-roots') {
                wave.category = '1000-roads';
            }
        });

		// Миграция 11: переименование дорог в трёхзначный формат
		this.data.waves.forEach(wave => {
			const waveIdStr = String(wave.id);
			if (waveIdStr.startsWith('wave-1000-')) {
				const match = waveIdStr.match(/wave-1000-(\d+)/);
				if (match) {
					const num = parseInt(match[1]);
					const threeDigitNum = num.toString().padStart(3, '0');
					const expectedName = `Дорога ${threeDigitNum}`;
					if (wave.name !== expectedName) {
						wave.name = expectedName;
					}
				}
			}
		});
        
        this.save();
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
            
            if (waveIdStr.startsWith('wave-120-') || waveIdStr.startsWith('wave-31-') || waveIdStr.startsWith('wave-1000-')) {
                wave.color = '#C0C0C0';
                wave.isDefaultColor = true;
            }
            
            this.waveVisibility[waveIdStr] = wave.visible !== undefined ? wave.visible : true;
            this.waveBold[waveIdStr] = wave.bold || false;
            this.waveCornerColor[waveIdStr] = wave.cornerColor || false;
        });
        
        this.data.uiSettings.waveVisibility = this.waveVisibility;
        this.data.uiSettings.waveBold = this.waveBold;
        this.data.uiSettings.waveCornerColor = this.waveCornerColor;
        
        this.dateSelections = {
            typeA: null,
            typeB: null
        };
        this.data.uiSettings.dateSelections = this.dateSelections;
    }
    
    resetDefaultWaveColors() {
        const classicWaves = [24, 28, 33, 38, 25, 365];
        
        classicWaves.forEach(waveId => {
            const wave = this.data.waves.find(w => String(w.id) === String(waveId));
            if (wave) {
                wave.isDefaultColor = false;
            }
        });
        
        this.save();
        
        if (window.unifiedListManager && window.unifiedListManager.updateWavesList) {
            window.unifiedListManager.updateWavesList();
        }
        
        if (window.waves && window.waves.updatePosition) {
            window.waves.updatePosition();
        }
        
        return classicWaves.length;
    }
    
    migrateWaveColors() {
        const standardColor = '#C0C0C0';
        let migratedCount = 0;
        
        this.data.waves.forEach(wave => {
            const waveIdStr = String(wave.id);
            const is120Wave = waveIdStr.startsWith('wave-120-');
            const is31Wave = waveIdStr.startsWith('wave-31-');
            const is1000Wave = waveIdStr.startsWith('wave-1000-');
            
            if (is120Wave || is31Wave || is1000Wave) {
                if (wave.isDefaultColor === undefined) {
                    wave.isDefaultColor = true;
                    wave.color = standardColor;
                    migratedCount++;
                } else if (wave.isDefaultColor === true) {
                    wave.color = standardColor;
                }
            }
        });
        
        if (migratedCount > 0) {
            this.save();
        }
        
        return migratedCount;
    }
    
    fixStandardWaveColors() {
        const standardColor = '#C0C0C0';
        
        this.data.waves.forEach(wave => {
            const waveIdStr = String(wave.id);
            
            const is120Wave = waveIdStr.startsWith('wave-120-');
            const is31Wave = waveIdStr.startsWith('wave-31-');
            const is1000Wave = waveIdStr.startsWith('wave-1000-');
            
            if (is120Wave || is31Wave || is1000Wave) {
                if (wave.isDefaultColor === undefined) {
                    wave.isDefaultColor = true;
                }
                
                if (wave.isDefaultColor === true) {
                    wave.color = standardColor;
                    
                    if (window.waves && window.waves.wavePaths && window.waves.wavePaths[wave.id]) {
                        window.waves.wavePaths[wave.id].style.stroke = standardColor;
                    }
                }
            }
        });
        
        this.save();
    }
    
    convertDatesToTimestamp() {
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
    
    isTimestamp(value) {
        return typeof value === 'number' && !isNaN(value) && value > 0;
    }
    
    generateId() {
        return Date.now().toString(36) + Math.random().toString(36).substr(2);
    }
}

window.appState = new AppState();