/**
 * @file import.js
 * Экспорт и импорт данных приложения в JSON (полный, только даты, только сигналы).
 * Имя полного файла: {дата}_everything.json.
 */
class ImportExportManager {
    constructor() {
        /* legacy SQLite (sql.js) — отключено
        this.SQL = null;
        this.currentDB = null;
        this.dbImportData = null;
        */
    }

    /* legacy SQLite (sql.js) — отключено
    async initSQL() {
        if (!this.SQL && window.SQL) {
            this.SQL = window.SQL;
        }
        return this.SQL;
    }
    */
    /**
     * Проверка, что значение — положительная метка времени (мс).
     * @param {*} value
     * @returns {boolean}
     */
    isTimestamp(value) {
        return typeof value === 'number' && !isNaN(value) && value > 0;
    }

    /**
     * Нормализовать даты персон после импорта: timestamp, описание, пол.
     * @param {{ dates: object[] }} data
     */
    convertImportedDatesToTimestamp(data) {
        data.dates.forEach(date => {
            if (date.date && !this.isTimestamp(date.date)) {
                const dateObj = window.timeUtils.parseStringToLocal(date.date);
                date.date = dateObj.getTime();
            }
            if (typeof date.description !== 'string') {
                date.description = '';
            }
            if (window.dom && typeof window.dom.normalizePersonGender === 'function') {
                date.gender = window.dom.normalizePersonGender(date.gender);
            } else if (date.gender !== 'male' && date.gender !== 'female') {
                date.gender = 'unset';
            }
        });
    }

    /** Нормализовать заметки сигналов после импорта. */
    normalizeImportedWaves(data) {
        if (!data || !Array.isArray(data.waves)) {
            return;
        }
        data.waves.forEach((wave) => {
            if (typeof wave.note !== 'string') {
                wave.note = '';
            }
        });
    }

    /** Персоны и группы персон после импорта. */
    applyImportedPersonData(data) {
        if (!data) {
            return;
        }
        if (data.dates && data.dates.length) {
            this.convertImportedDatesToTimestamp(data);
        }

        if (!data.personGroups || !data.personGroups.length) {
            if (data.dates && data.dates.length) {
                data.personGroups = [{
                    id: 'default-person-group',
                    name: 'По умолчанию',
                    dates: data.dates.map((d) => d.id),
                    expanded: true
                }];
            } else {
                data.personGroups = [];
            }
        }

        if (window.dates && window.dates.syncPersonGroupsLayout) {
            window.dates.syncPersonGroupsLayout();
        }
    }

    /** Восстановить uiSettings в памяти appState (в т.ч. activeDateId). */
    applyImportedUiSettingsToMemory(convertedData) {
        const ui = convertedData.uiSettings || {};
        const dates = convertedData.dates || window.appState.data.dates || [];

        if (ui.currentDate != null) {
            window.appState.currentDate = window.timeUtils
                ? window.timeUtils.toLocalDate(ui.currentDate)
                : new Date(ui.currentDate);
        }

        if (ui.baseDate != null) {
            if (window.timeUtils) {
                const baseDateLocal = window.timeUtils.toLocalDate(ui.baseDate);
                window.appState.baseDate = window.timeUtils.getStartOfDay(baseDateLocal);
            } else {
                window.appState.baseDate = new Date(ui.baseDate);
            }
        }

        if (ui.currentDay !== undefined && ui.currentDay !== null) {
            window.appState.currentDay = ui.currentDay;
        }

        if (ui.transform) {
            window.appState.transform = ui.transform;
        }

        window.appState.uiHidden = ui.uiHidden || false;
        window.appState.graphHidden = ui.graphHidden || false;
        window.appState.showStars = ui.showStars !== undefined ? ui.showStars : true;
        window.appState.grayMode = ui.grayMode || false;
        window.appState.graphGrayMode = ui.graphGrayMode !== undefined ? ui.graphGrayMode : false;
        window.appState.cornerSquaresVisible = ui.cornerSquaresVisible !== undefined ? ui.cornerSquaresVisible : true;
        window.appState.waveIntersectionsVisible = ui.waveIntersectionsVisible !== undefined ? ui.waveIntersectionsVisible : true;
        window.appState.extremumWaveColorHighlight = ui.extremumWaveColorHighlight !== undefined ? ui.extremumWaveColorHighlight : false;
        window.appState.panelActiveTab =
            typeof ui.panelActiveTab === 'string' && ui.panelActiveTab ? ui.panelActiveTab : null;

        let activeId =
            ui.activeDateId != null && String(ui.activeDateId) !== '' ? ui.activeDateId : null;
        if (activeId != null && !dates.some((d) => String(d.id) === String(activeId))) {
            activeId = null;
        }
        if (activeId == null && dates.length > 0) {
            activeId = dates[0].id;
        }
        window.appState.activeDateId = activeId;

        if (ui.dateSelections) {
            window.appState.dateSelections = { ...ui.dateSelections };
        } else {
            window.appState.dateSelections = {
                typeA: activeId,
                typeB: null
            };
        }
        if (!window.appState.data.uiSettings) {
            window.appState.data.uiSettings = {};
        }
        window.appState.data.uiSettings.dateSelections = window.appState.dateSelections;
        window.appState.data.uiSettings.activeDateId = activeId;
    }

    /** Перерисовка списков и активация импортированной персоны. */
    async finalizeImportUi(options = {}) {
        const { refreshWaves = true, refreshDisplayTemplates = false } = options;

        if (window.unifiedListManager) {
            window.unifiedListManager._datesListStructureSig = null;
        }

        if (window.extremumTimeManager && typeof window.extremumTimeManager.unwrapWaveVisibilityProxy === 'function') {
            window.extremumTimeManager.unwrapWaveVisibilityProxy();
        }

        if (window.dataManager && window.dataManager.updateDateList) {
            await window.dataManager.updateDateList({ forceFull: true });
        }

        if (window.dates && window.appState.activeDateId) {
            window.dates.setActiveDate(window.appState.activeDateId, true);
        }

        if (refreshWaves && window.dataManager && window.dataManager.updateWavesGroups) {
            await window.dataManager.updateWavesGroups();
        }

        if (refreshWaves && window.waves) {
            if (window.waves.updatePosition) {
                window.waves.updatePosition();
            }
            if (window.waves.updateCornerSquareColors) {
                window.waves.updateCornerSquareColors();
            }
        }

        if (window.grid && window.grid.updateCenterDate) {
            window.grid.updateCenterDate();
        }

        if (refreshDisplayTemplates && window.displayViewTemplatesManager && window.displayViewTemplatesManager.init) {
            window.displayViewTemplatesManager.init();
        }

        if (window.uiManager && window.uiManager.syncExtremumWaveColorHighlightButton) {
            window.uiManager.syncExtremumWaveColorHighlightButton();
        }

        if (window.appClassSync) {
            window.appClassSync.syncFromAppState();
        }
    }
    
    /** Скачать JSON со всеми данными, настройками UI и transform (файл *_everything.json). */
    exportAll() {
        const dataToSave = {
            ...window.appState.data
        };
        
        dataToSave.uiSettings.currentDate = window.appState.currentDate.getTime();
        dataToSave.uiSettings.baseDate = window.appState.baseDate.getTime();
        dataToSave.uiSettings.currentDay = window.appState.currentDay;
        dataToSave.uiSettings.transform = window.appState.transform;
        dataToSave.uiSettings.uiHidden = window.appState.uiHidden;
        dataToSave.uiSettings.graphHidden = window.appState.graphHidden;
        dataToSave.uiSettings.showStars = window.appState.showStars;
        dataToSave.uiSettings.grayMode = window.appState.grayMode;
        dataToSave.uiSettings.graphGrayMode = window.appState.graphGrayMode;
        dataToSave.uiSettings.cornerSquaresVisible = window.appState.cornerSquaresVisible;
        dataToSave.uiSettings.waveIntersectionsVisible = window.appState.waveIntersectionsVisible;
        dataToSave.uiSettings.extremumWaveColorHighlight = window.appState.extremumWaveColorHighlight;
        delete dataToSave.uiSettings.graphBgWhite;
        dataToSave.exportDate = new Date().getTime();
        dataToSave.version = '1.0';
        
        const dataStr = JSON.stringify(dataToSave, null, 2);
        const dataBlob = new Blob([dataStr], { type: 'application/json' });
        const url = URL.createObjectURL(dataBlob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `${window.dom.formatDate(new Date())}_everything.json`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
    }
    
    /** Скачать JSON только с персонами и группами персон (*_dates.json). */
    exportDates() {
        const dataToSave = {
            dates: window.appState.data.dates,
            personGroups: window.appState.data.personGroups || [],
            exportDate: new Date().getTime(),
            version: '1.0',
            type: 'dates-only'
        };
        
        const dataStr = JSON.stringify(dataToSave, null, 2);
        const dataBlob = new Blob([dataStr], { type: 'application/json' });
        const url = URL.createObjectURL(dataBlob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `${window.dom.formatDate(new Date())}_dates.json`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
    }
    
    /** Скачать JSON только с сигналами и группами сигналов (*_signals.json). */
    exportWaves() {
        const dataToSave = {
            waves: window.appState.data.waves,
            groups: window.appState.data.groups,
            exportDate: new Date().getTime(),
            version: '1.0',
            type: 'waves-only'
        };
        
        const dataStr = JSON.stringify(dataToSave, null, 2);
        const dataBlob = new Blob([dataStr], { type: 'application/json' });
        const url = URL.createObjectURL(dataBlob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `${window.dom.formatDate(new Date())}_signals.json`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
    }
    
    /**
     * Импорт из выбранного JSON-файла (полный / даты / сигналы).
     * @param {File} file
     * @returns {Promise<void>}
     */
    importAll(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = async (event) => {
                try {
                    const data = JSON.parse(event.target.result);
                    
                    const convertedData = data;
                    
                    const isFullExport = convertedData.waves && convertedData.groups && convertedData.dates;
                    const isDatesOnly = convertedData.type === 'dates-only' || (convertedData.dates && !convertedData.waves);
                    const isWavesOnly = convertedData.type === 'waves-only' || (convertedData.waves && !convertedData.dates);
                    
                    if (!isFullExport && !isDatesOnly && !isWavesOnly) {
                        throw new Error('Неверный формат файла. Ожидается полный экспорт, экспорт дат или экспорт сигналов.');
                    }
                    
                    let message = '';
                    
                    if (isFullExport) {
                        message = 'Импортировать ВСЕ данные? Текущие данные будут заменены.';
                    } else if (isDatesOnly) {
                        message = 'Импортировать даты? Существующие даты будут заменены.';
                    } else if (isWavesOnly) {
                        message = 'Импортировать сигналы и группы? Существующие сигналы и группы будут заменены.';
                    }
                    
                    if (confirm(message)) {
                        if (isFullExport) {
                            const has120Waves = convertedData.waves.some(w => {
                                const waveIdStr = String(w.id);
                                return waveIdStr.startsWith('wave-120-');
                            });
                            
                            if (!has120Waves) {
                                const waves120 = window.appState.waves120 || [];
                                const waves120Ids = window.appState.waves120Ids || [];
                                
                                convertedData.waves = convertedData.waves.concat(waves120);
                                
                                if (!convertedData.groups.some(g => g.id === '120-waves-group')) {
                                    convertedData.groups.push({
                                        id: '120-waves-group',
                                        name: '120 колосков',
                                        enabled: false,
                                        waves: waves120Ids,
                                        styleEnabled: true,
                                        styleBold: false,
                                        styleColor: '#666666',
                                        styleColorEnabled: false,
                                        styleType: 'dashed',
                                        expanded: false
                                    });
                                }
                            }
                            
                            const has31Waves = convertedData.waves.some(w => {
                                const waveIdStr = String(w.id);
                                return waveIdStr.startsWith('wave-31-');
                            });
                            
                            if (!has31Waves) {
                                const waves31 = window.appState.waves31 || [];
                                const waves31Ids = window.appState.waves31Ids || [];
                                
                                convertedData.waves = convertedData.waves.concat(waves31);
                                
                                if (!convertedData.groups.some(g => g.id === '31-waves-group')) {
                                    convertedData.groups.push({
                                        id: '31-waves-group',
                                        name: '31 прутик',
                                        enabled: false,
                                        waves: waves31Ids,
                                        styleEnabled: true,
                                        styleBold: false,
                                        styleColor: '#666666',
                                        styleColorEnabled: false,
                                        styleType: 'dotted',
                                        expanded: false
                                    });
                                }
                            }
                            
                            // ===== МИГРАЦИЯ ДЛЯ 1000 ДОРОГ =====
                            const has1000Waves = convertedData.waves.some(w => {
                                const waveIdStr = String(w.id);
                                return waveIdStr.startsWith('wave-1000-');
                            });
                            
                            if (!has1000Waves) {
                                const waves1000 = window.appState.waves1000 || [];
                                const waves1000Ids = window.appState.waves1000Ids || [];
                                
                                convertedData.waves = convertedData.waves.concat(waves1000);
                                
                                if (!convertedData.groups.some(g => g.id === '1000-roads-group')) {
                                    convertedData.groups.push({
                                        id: '1000-roads-group',
                                        name: '1000 дорог',
                                        enabled: false,
                                        waves: waves1000Ids,
                                        styleEnabled: true,
                                        styleBold: false,
                                        styleColor: '#C0C0C0',
                                        styleColorEnabled: true,
                                        styleType: 'long-dash',
                                        expanded: false
                                    });
                                }
                            }
                            // ===== КОНЕЦ МИГРАЦИИ =====
                            
                            convertedData.waves.forEach(wave => {
                                const waveIdStr = String(wave.id);
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
                                        wave.name = `Дорога ${num}`;
                                        wave.description = `Период ${num} дней`;
                                    }
                                }
                            });

                            this.normalizeImportedWaves(convertedData);
                            
                            window.appState.data = convertedData;
                            this.applyImportedPersonData(window.appState.data);
                            
                            window.appState.waveVisibility = {};
                            window.appState.waveBold = {};
                            window.appState.waveCornerColor = {};
                            
                            if (convertedData.uiSettings && convertedData.uiSettings.waveVisibility) {
                                window.appState.waveVisibility = convertedData.uiSettings.waveVisibility;
                            }
                            if (convertedData.uiSettings && convertedData.uiSettings.waveBold) {
                                window.appState.waveBold = convertedData.uiSettings.waveBold;
                            }
                            if (convertedData.uiSettings && convertedData.uiSettings.waveCornerColor) {
                                window.appState.waveCornerColor = convertedData.uiSettings.waveCornerColor;
                            }
                            
                            window.appState.data.waves.forEach(wave => {
                                const waveIdStr = String(wave.id);
                                if (window.appState.waveVisibility[waveIdStr] === undefined) {
                                    window.appState.waveVisibility[waveIdStr] = wave.visible !== undefined ? wave.visible : true;
                                }
                                if (window.appState.waveBold[waveIdStr] === undefined) {
                                    window.appState.waveBold[waveIdStr] = wave.bold || false;
                                }
                                if (window.appState.waveCornerColor[waveIdStr] === undefined) {
                                    window.appState.waveCornerColor[waveIdStr] = wave.cornerColor || false;
                                }
                            });
                            
                            this.applyImportedUiSettingsToMemory(convertedData);
                            
                            const graphContainer = window.dom.byKey('graphContainer');
                            if (graphContainer) {
                                graphContainer.style.backgroundColor = '';
                            }
                            
                            const allSquares = document.querySelectorAll('.sun-cornerSquare');
                            allSquares.forEach(square => {
                                square.style.display = window.appState.cornerSquaresVisible ? 'block' : 'none';
                            });
                            
                            convertedData.waves.forEach(wave => {
                                const waveIdStr = String(wave.id);
                                const is120Wave = waveIdStr.startsWith('wave-120-');
                                const is31Wave = waveIdStr.startsWith('wave-31-');
                                const is1000Wave = waveIdStr.startsWith('wave-1000-');
                                
                                if (is120Wave || is31Wave || is1000Wave) {
                                    if (wave.isDefaultColor === undefined) {
                                        wave.isDefaultColor = true;
                                    }
                                    
                                    if (wave.isDefaultColor === true) {
                                        wave.color = '#C0C0C0';
                                    }
                                }
                            });
                            
                            document.querySelectorAll('.sun-waveContainer').forEach(container => {
                                container.remove();
                            });
                            
                            window.waves.clearWaveDomReferences();

                            window.appState.data.waves.forEach(wave => {
                                window.waves.createWaveElement(wave);
                            });

                            await this.finalizeImportUi({
                                refreshWaves: true,
                                refreshDisplayTemplates: true
                            });
                            window.appState.save();
                            
                            alert('Все данные успешно импортированы!');
                            
                        } else if (isDatesOnly) {
                            window.appState.data.dates = convertedData.dates || [];
                            if (convertedData.personGroups && convertedData.personGroups.length) {
                                window.appState.data.personGroups = convertedData.personGroups;
                            }
                            this.applyImportedPersonData(window.appState.data);
                            this.applyImportedUiSettingsToMemory({
                                dates: window.appState.data.dates,
                                uiSettings: convertedData.uiSettings || {}
                            });

                            await this.finalizeImportUi({ refreshWaves: false });
                            window.appState.save();
                            
                            alert('Даты успешно импортированы!');
                            
                        } else if (isWavesOnly) {
                            this.normalizeImportedWaves(convertedData);
                            window.appState.data.waves = convertedData.waves || [];
                            window.appState.data.groups = convertedData.groups || [];
                            
                            const standardGroups = ['classic-group', 'experimental-group', '120-waves-group', '31-waves-group', '1000-roads-group', 'default-group'];
                            standardGroups.forEach(groupId => {
                                if (!window.appState.data.groups.find(g => g.id === groupId)) {
                                    const defaultGroup = window.appState.initialData.groups.find(g => g.id === groupId);
                                    if (defaultGroup) {
                                        window.appState.data.groups.push({...defaultGroup});
                                    }
                                }
                            });
                            
                            window.appState.data.waves.forEach(wave => {
                                const waveIdStr = String(wave.id);
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
                                        wave.name = `Дорога ${num}`;
                                        wave.description = `Период ${num} дней`;
                                    }
                                }
                            });
                            
                            window.appState.waveVisibility = {};
                            window.appState.waveBold = {};
                            window.appState.waveCornerColor = {};
                            window.appState.data.waves.forEach(wave => {
                                const waveIdStr = String(wave.id);
                                window.appState.waveVisibility[waveIdStr] = wave.visible !== undefined ? wave.visible : true;
                                window.appState.waveBold[waveIdStr] = wave.bold || false;
                                window.appState.waveCornerColor[waveIdStr] = wave.cornerColor || false;
                            });
                            
                            document.querySelectorAll('.sun-waveContainer').forEach(container => {
                                container.remove();
                            });
                            
                            window.waves.clearWaveDomReferences();

                            window.appState.data.waves.forEach(wave => {
                                window.waves.createWaveElement(wave);
                            });

                            window.dataManager.updateWavesGroups();
                            if (window.displayViewTemplatesManager && window.displayViewTemplatesManager.init) {
                                window.displayViewTemplatesManager.init();
                            }
                            window.waves.updatePosition();
                            window.waves.updateCornerSquareColors();
                            window.appState.save();
                            
                            alert('Сигналы и группы успешно импортированы!');
                        }
                        
                        resolve();
                    }
                } catch (error) {
                    alert('Ошибка импорта: ' + error.message);
                    reject(error);
                }
            };
            reader.readAsText(file);
        });
    }
    
    /* legacy SQLite UI — отключено
    clearImportResults() {
        const textarea = window.dom.byKey('dbImportTextarea');
        if (textarea) textarea.value = '';
        const progress = window.dom.byKey('dbImportProgress');
        if (progress) progress.style.display = 'none';
        const progressBar = window.dom.byKey('dbImportProgressBar');
        if (progressBar) progressBar.style.width = '0%';
        const status = window.dom.byKey('dbImportStatus');
        if (status) status.innerHTML = '';
    }
    
    updateDBImportProgress(percent, message = '') {
        const progressBar = window.dom.byKey('dbImportProgressBar');
        const status = window.dom.byKey('dbImportStatus');
        
        if (progressBar) {
            progressBar.style.width = percent + '%';
        }
        
        if (message && status) {
            status.innerHTML = `<div class="db-import-status info">${message}</div>`;
        }
    }
    
    showDBImportStatus(message, type = 'info') {
        const status = window.dom.byKey('dbImportStatus');
        if (status) {
            status.innerHTML = `<div class="db-import-status ${type}">${message}</div>`;
        }
    }
    */
}

window.importExport = new ImportExportManager();