// modules/import.js
class ImportExportManager {
    constructor() {
        this.SQL = null;
        this.currentDB = null;
        this.dbImportData = null;
    }
    
    async initSQL() {
        if (!this.SQL && window.SQL) {
            this.SQL = window.SQL;
        }
        return this.SQL;
    }
    
    isTimestamp(value) {
        return typeof value === 'number' && !isNaN(value) && value > 0;
    }
    
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
    
    importAll(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = function(event) {
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
                            
                            window.appState.data = convertedData;

                            if (!window.appState.data.personGroups || !window.appState.data.personGroups.length) {
                                if (window.appState.data.dates && window.appState.data.dates.length) {
                                    window.appState.data.personGroups = [{
                                        id: 'default-person-group',
                                        name: 'По умолчанию',
                                        dates: window.appState.data.dates.map(d => d.id),
                                        expanded: true
                                    }];
                                } else {
                                    window.appState.data.personGroups = [];
                                }
                            }
                            if (window.dates && window.dates.syncPersonGroupsLayout) {
                                window.dates.syncPersonGroupsLayout();
                            }
                            
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
                            
                            window.appState.currentDate = new Date(convertedData.uiSettings.currentDate);
                            window.appState.baseDate = new Date(convertedData.uiSettings.baseDate);
                            window.appState.currentDay = convertedData.uiSettings.currentDay;
                            window.appState.transform = convertedData.uiSettings.transform;
                            window.appState.uiHidden = convertedData.uiSettings.uiHidden || false;
                            window.appState.graphHidden = convertedData.uiSettings.graphHidden || false;
                            window.appState.showStars = convertedData.uiSettings.showStars !== undefined ? convertedData.uiSettings.showStars : true;
                            window.appState.grayMode = convertedData.uiSettings.grayMode || false;
                            window.appState.graphGrayMode = convertedData.uiSettings.graphGrayMode !== undefined ? convertedData.uiSettings.graphGrayMode : false;
                            window.appState.cornerSquaresVisible = convertedData.uiSettings.cornerSquaresVisible !== undefined ? convertedData.uiSettings.cornerSquaresVisible : true;
                            window.appState.waveIntersectionsVisible = convertedData.uiSettings.waveIntersectionsVisible !== undefined ? convertedData.uiSettings.waveIntersectionsVisible : true;
                            window.appState.extremumWaveColorHighlight = convertedData.uiSettings.extremumWaveColorHighlight !== undefined ? convertedData.uiSettings.extremumWaveColorHighlight : false;
                            
                            if (window.appState.uiHidden) {
                                document.body.classList.add('ui-hidden');
                            } else {
                                document.body.classList.remove('ui-hidden');
                            }
                            
                            if (window.appState.graphHidden) {
                                document.body.classList.add('graph-hidden');
                            } else {
                                document.body.classList.remove('graph-hidden');
                            }
                            
                            if (window.appState.showStars) {
                                document.body.classList.add('stars-mode');
                                document.body.classList.remove('names-mode');
                            } else {
                                document.body.classList.remove('stars-mode');
                                document.body.classList.add('names-mode');
                            }
                            
                            if (window.appState.grayMode) {
                                document.body.classList.add('gray-mode');
                            } else {
                                document.body.classList.remove('gray-mode');
                            }
                            
                            const graphContainer = document.getElementById('graphContainer');
                            if (graphContainer) {
                                graphContainer.classList.remove('dark-mode');
                                graphContainer.style.backgroundColor = '';
                            }
                            
                            const allSquares = document.querySelectorAll('.corner-square');
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
                            
                            document.querySelectorAll('.wave-container').forEach(container => {
                                container.remove();
                            });
                            
                            window.waves.clearWaveDomReferences();

                            window.appState.data.waves.forEach(wave => {
                                window.waves.createWaveElement(wave);
                            });

                            window.dataManager.updateDateList();
                            window.dataManager.updateWavesGroups();
                            if (window.displayViewTemplatesManager && window.displayViewTemplatesManager.init) {
                                window.displayViewTemplatesManager.init();
                            }
                            window.grid.updateCenterDate();
                            window.waves.updatePosition();
                            window.waves.updateCornerSquareColors();
                            if (window.uiManager && window.uiManager.syncExtremumWaveColorHighlightButton) {
                                window.uiManager.syncExtremumWaveColorHighlightButton();
                            }
                            window.appState.save();
                            
                            alert('Все данные успешно импортированы!');
                            
                        } else if (isDatesOnly) {
                            window.appState.data.dates = convertedData.dates || [];
                            if (convertedData.personGroups && convertedData.personGroups.length) {
                                window.appState.data.personGroups = convertedData.personGroups;
                            } else if (window.appState.data.dates.length > 0) {
                                window.appState.data.personGroups = [{
                                    id: 'default-person-group',
                                    name: 'По умолчанию',
                                    dates: window.appState.data.dates.map(d => d.id),
                                    expanded: true
                                }];
                            } else {
                                window.appState.data.personGroups = [];
                            }
                            if (window.dates && window.dates.syncPersonGroupsLayout) {
                                window.dates.syncPersonGroupsLayout();
                            }
                            
                            if (window.appState.data.dates.length > 0 && !window.appState.data.dates.find(d => d.id === window.appState.activeDateId)) {
                                window.appState.activeDateId = window.appState.data.dates[0].id;
                                const activeDate = window.appState.data.dates.find(d => d.id === window.appState.activeDateId);
                                if (activeDate) {
                                    window.appState.baseDate = new Date(activeDate.date);
                                }
                            }
                            
                            window.dataManager.updateDateList();
                            window.grid.updateCenterDate();
                            window.appState.save();
                            
                            alert('Даты успешно импортированы!');
                            
                        } else if (isWavesOnly) {
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
                            
                            document.querySelectorAll('.wave-container').forEach(container => {
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
    
    clearImportResults() {
        const textarea = document.getElementById('dbImportTextarea');
        if (textarea) textarea.value = '';
        const progress = document.getElementById('dbImportProgress');
        if (progress) progress.style.display = 'none';
        const progressBar = document.getElementById('dbImportProgressBar');
        if (progressBar) progressBar.style.width = '0%';
        const status = document.getElementById('dbImportStatus');
        if (status) status.innerHTML = '';
    }
    
    updateDBImportProgress(percent, message = '') {
        const progressBar = document.getElementById('dbImportProgressBar');
        const status = document.getElementById('dbImportStatus');
        
        if (progressBar) {
            progressBar.style.width = percent + '%';
        }
        
        if (message && status) {
            status.innerHTML = `<div class="db-import-status info">${message}</div>`;
        }
    }
    
    showDBImportStatus(message, type = 'info') {
        const status = document.getElementById('dbImportStatus');
        if (status) {
            status.innerHTML = `<div class="db-import-status ${type}">${message}</div>`;
        }
    }
}

window.importExport = new ImportExportManager();