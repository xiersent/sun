// optimized3/modules/import.js
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
    
    // НОВЫЙ МЕТОД: Проверка, является ли значение timestamp
    isTimestamp(value) {
        return typeof value === 'number' && !isNaN(value) && value > 0;
    }
    
    // НОВЫЙ МЕТОД: Конвертация импортированных дат в timestamp
    convertImportedDatesToTimestamp(data) {
        // Конвертировать dates
        if (data.dates) {
            data.dates.forEach(date => {
                if (date.date && !this.isTimestamp(date.date)) {
                    try {
                        const dateObj = new Date(date.date);
                        if (!isNaN(dateObj.getTime())) {
                            date.date = dateObj.getTime();
                            console.log('Конвертирована импортированная дата в timestamp:', date.date);
                        }
                    } catch (e) {
                        console.warn('Ошибка конвертации импортированной даты:', date.date, e);
                    }
                }
            });
        }
        
        // Конвертировать notes
        if (data.notes) {
            data.notes.forEach(note => {
                if (note.date && !this.isTimestamp(note.date)) {
                    try {
                        const dateObj = new Date(note.date);
                        if (!isNaN(dateObj.getTime())) {
                            note.date = dateObj.getTime();
                            console.log('Конвертирована импортированная заметка в timestamp:', note.date);
                        }
                    } catch (e) {
                        console.warn('Ошибка конвертации импортированной заметки:', note.date, e);
                    }
                }
            });
        }
        
        // Конвертировать uiSettings даты
        if (data.uiSettings) {
            ['currentDate', 'baseDate'].forEach(key => {
                if (data.uiSettings[key] && !this.isTimestamp(data.uiSettings[key])) {
                    try {
                        const dateObj = new Date(data.uiSettings[key]);
                        if (!isNaN(dateObj.getTime())) {
                            data.uiSettings[key] = dateObj.getTime();
                            console.log(`Конвертирован импортированный ${key} в timestamp:`, data.uiSettings[key]);
                        }
                    } catch (e) {
                        console.warn(`Ошибка конвертации импортированного ${key}:`, e);
                    }
                }
            });
        }
        
        return data;
    }
    
    exportAll() {
        const dataToSave = {
            ...window.appState.data
        };
        
        dataToSave.uiSettings.currentDate = window.appState.currentDate.getTime(); // timestamp
        dataToSave.uiSettings.baseDate = window.appState.baseDate.getTime(); // timestamp
        dataToSave.uiSettings.currentDay = window.appState.currentDay;
        dataToSave.uiSettings.transform = window.appState.transform;
        dataToSave.uiSettings.uiHidden = window.appState.uiHidden;
        dataToSave.uiSettings.graphHidden = window.appState.graphHidden;
        dataToSave.uiSettings.graphBgWhite = window.appState.graphBgWhite;
        dataToSave.uiSettings.showStars = window.appState.showStars;
        dataToSave.uiSettings.grayMode = window.appState.grayMode;
        dataToSave.uiSettings.graphGrayMode = window.appState.graphGrayMode;
        dataToSave.uiSettings.cornerSquaresVisible = window.appState.cornerSquaresVisible;
        dataToSave.exportDate = new Date().getTime(); // timestamp
        dataToSave.version = '1.0';
        
        const dataStr = JSON.stringify(dataToSave, null, 2);
        const dataBlob = new Blob([dataStr], {
            type: 'application/json'
        });
        const url = URL.createObjectURL(dataBlob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `${window.dom.formatDate(new Date())}_all.json`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
    }
    
    exportDates() {
        const dataToSave = {
            dates: window.appState.data.dates,
            notes: window.appState.data.notes,
            exportDate: new Date().getTime(), // timestamp
            version: '1.0',
            type: 'dates-only'
        };
        
        const dataStr = JSON.stringify(dataToSave, null, 2);
        const dataBlob = new Blob([dataStr], {
            type: 'application/json'
        });
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
            exportDate: new Date().getTime(), // timestamp
            version: '1.0',
            type: 'waves-only'
        };
        
        const dataStr = JSON.stringify(dataToSave, null, 2);
        const dataBlob = new Blob([dataStr], {
            type: 'application/json'
        });
        const url = URL.createObjectURL(dataBlob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `${window.dom.formatDate(new Date())}_waves.json`;
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
                    
                    // КОНВЕРТИРОВАТЬ ИМПОРТИРОВАННЫЕ ДАННЫЕ В TIMESTAMP
                    const convertedData = window.importExport.convertImportedDatesToTimestamp(data);
                    
                    const isFullExport = convertedData.waves && convertedData.groups && convertedData.dates;
                    const isDatesOnly = convertedData.type === 'dates-only' || (convertedData.dates && !convertedData.waves);
                    const isWavesOnly = convertedData.type === 'waves-only' || (convertedData.waves && !convertedData.dates);
                    
                    if (!isFullExport && !isDatesOnly && !isWavesOnly) {
                        throw new Error('Неверный формат файла. Ожидается полный экспорт, экспорт дат или экспорт колосков.');
                    }
                    
                    let message = '';
                    
                    if (isFullExport) {
                        message = 'Импортировать ВСЕ данные? Текущие данные будут заменены.';
                    } else if (isDatesOnly) {
                        message = 'Импортировать даты и заметки? Существующие даты и заметки будут заменены.';
                    } else if (isWavesOnly) {
                        message = 'Импортировать колоски и группы? Существующие колоски и группы будут заменены.';
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
                                        name: '31 колосок',
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
                            
                            convertedData.waves.forEach(wave => {
                                const waveIdStr = String(wave.id);
                                if (waveIdStr.startsWith('wave-31-')) {
                                    const match = waveIdStr.match(/wave-31-(\d+)/);
                                    if (match) {
                                        const num = parseInt(match[1]);
                                        wave.name = `Колосок ${num}`;
                                        wave.description = `Период ${num} дней`;
                                    }
                                }
                            });
                            
                            const defaultGroupIndex = convertedData.groups.findIndex(g => g.id === 'default-group');
                            if (defaultGroupIndex > 0) {
                                const defaultGroup = convertedData.groups.splice(defaultGroupIndex, 1)[0];
                                convertedData.groups.unshift(defaultGroup);
                            }
                            
                            window.appState.data = convertedData;
                            
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
                            
                            // Преобразуем timestamp обратно в Date объекты
                            window.appState.currentDate = new Date(convertedData.uiSettings.currentDate);
                            window.appState.baseDate = new Date(convertedData.uiSettings.baseDate);
                            window.appState.currentDay = convertedData.uiSettings.currentDay;
                            window.appState.transform = convertedData.uiSettings.transform;
                            window.appState.uiHidden = convertedData.uiSettings.uiHidden || false;
                            window.appState.graphHidden = convertedData.uiSettings.graphHidden || false;
                            window.appState.graphBgWhite = convertedData.uiSettings.graphBgWhite !== undefined ? convertedData.uiSettings.graphBgWhite : true;
                            window.appState.showStars = convertedData.uiSettings.showStars !== undefined ? convertedData.uiSettings.showStars : true;
                            window.appState.grayMode = convertedData.uiSettings.grayMode || false;
                            window.appState.graphGrayMode = convertedData.uiSettings.graphGrayMode !== undefined ? convertedData.uiSettings.graphGrayMode : false;
                            window.appState.cornerSquaresVisible = convertedData.uiSettings.cornerSquaresVisible !== undefined ? convertedData.uiSettings.cornerSquaresVisible : true;
                            
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
                                graphContainer.style.backgroundColor = window.appState.graphBgWhite ? '#fff' : '#000';
                            }
                            
                            const allSquares = document.querySelectorAll('.corner-square');
                            allSquares.forEach(square => {
                                square.style.display = window.appState.cornerSquaresVisible ? 'block' : 'none';
                            });
                            
                            document.querySelectorAll('.wave-container').forEach(container => {
                                container.remove();
                            });
                            
                            window.waves.waveContainers = {};
                            window.waves.wavePaths = {};
                            
                            window.appState.data.waves.forEach(wave => {
                                window.waves.createWaveElement(wave);
                            });
                            
                            window.dataManager.updateDateList();
                            window.dataManager.updateWavesGroups();
                            window.dataManager.updateNotesList();
                            window.grid.updateGridNotesHighlight();
                            window.grid.updateCenterDate();
                            window.waves.updatePosition();
                            window.waves.updateCornerSquareColors();
                            window.appState.save();
                            
                            alert('Все данные успешно импортированы!');
                            
                        } else if (isDatesOnly) {
                            window.appState.data.dates = convertedData.dates || [];
                            window.appState.data.notes = convertedData.notes || [];
                            
                            if (window.appState.data.dates.length > 0 && !window.appState.data.dates.find(d => d.id === window.appState.activeDateId)) {
                                window.appState.activeDateId = window.appState.data.dates[0].id;
                                const activeDate = window.appState.data.dates.find(d => d.id === window.appState.activeDateId);
                                if (activeDate) {
                                    window.appState.baseDate = new Date(activeDate.date);
                                }
                            }
                            
                            window.dataManager.updateDateList();
                            window.dataManager.updateNotesList();
                            window.grid.updateGridNotesHighlight();
                            window.grid.updateCenterDate();
                            window.appState.save();
                            
                            alert('Даты и заметки успешно импортированы!');
                            
                        } else if (isWavesOnly) {
                            window.appState.data.waves = convertedData.waves || [];
                            window.appState.data.groups = convertedData.groups || [];
                            
                            const standardGroups = ['classic-group', 'experimental-group', '120-waves-group', '31-waves-group', 'default-group'];
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
                                        wave.name = `Колосок ${num}`;
                                        wave.description = `Период ${num} дней`;
                                    }
                                }
                            });
                            
                            const defaultGroupIndex = window.appState.data.groups.findIndex(g => g.id === 'default-group');
                            if (defaultGroupIndex > 0) {
                                const defaultGroup = window.appState.data.groups.splice(defaultGroupIndex, 1)[0];
                                window.appState.data.groups.unshift(defaultGroup);
                            }
                            
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
                            
                            window.waves.waveContainers = {};
                            window.waves.wavePaths = {};
                            
                            window.appState.data.waves.forEach(wave => {
                                window.waves.createWaveElement(wave);
                            });
                            
                            window.dataManager.updateWavesGroups();
                            window.waves.updatePosition();
                            window.waves.updateCornerSquareColors();
                            window.appState.save();
                            
                            alert('Колоски и группы успешно импортированы!');
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
    
    async importDB(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = async (e) => {
                try {
                    await this.initSQL();
                    
                    if (!this.SQL) {
                        throw new Error('SQL.js не загружен');
                    }
                    
                    const uint8Array = new Uint8Array(e.target.result);
                    this.currentDB = new this.SQL.Database(uint8Array);
                    window.appState.currentDB = this.currentDB;
                    
                    let result = '=== УСПЕШНАЯ ЗАГРРУЗКА БАЗЫ ДАННЫХ ===\n\n';
                    result += `Файл: ${file.name}\n`;
                    result += `Размер: ${file.size} байт\n`;
                    result += `Статус: ✅ Валидная SQLite база данных\n\n`;
                    
                    const tablesQuery = "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'";
                    const tablesResult = this.currentDB.exec(tablesQuery);
                    
                    if (tablesResult.length) {
                        const tables = tablesResult[0].values.map(row => row[0]);
                        result += `Обнаружено таблиц: ${tables.length}\n`;
                        result += `Таблицы: ${tables.join(', ')}\n\n`;
                        result += 'Используйте кнопку "Анализировать DB" для детального анализа структуры базы.\n';
                        result += 'Используйте кнопку "Мигрировать в заметки" для преобразования данных в заметки.';
                        
                        this.dbImportData = {
                            tables: tables,
                            stats: {},
                            totalRecords: 0
                        };
                        window.appState.dbImportData = this.dbImportData;
                    } else {
                        result += 'В базе данных не найдено пользовательских таблиц.';
                    }
                    
                    resolve(result);
                } catch (error) {
                    console.error('DB Import Error:', error);
                    reject(error);
                }
            };
            
            reader.onerror = function(error) {
                reject(new Error(`Ошибка чтения файла: ${error.target.error.name}`));
            };
            
            try {
                reader.readAsArrayBuffer(file);
            } catch (readError) {
                reject(new Error(`Ошибка запуска чтения файла: ${readError.message}`));
            }
        });
    }
    
    async analyzeDB() {
        if (!this.currentDB) {
            throw new Error('Сначала загрузите DB файл через кнопку "Импорт заметок Metaslip"');
        }
        
        let result = '=== АНАЛИЗ БАЗЫ ДАННЫХ SQLite ===\n\n';
        
        const tablesQuery = "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'";
        const tablesResult = this.currentDB.exec(tablesQuery);
        
        if (!tablesResult.length) {
            throw new Error('В базе данных не найдено таблиц');
        }
        
        const tables = tablesResult[0].values.map(row => row[0]);
        result += `Найдено таблиц: ${tables.length}\n`;
        result += `Таблицы: ${tables.join(', ')}\n\n`;
        
        result += '=== СТРУКТУРА ТАБЛИЦ ===\n\n';
        
        let totalRecords = 0;
        
        tables.forEach((tableName, index) => {
            result += `--- ${tableName} ---\n`;
            
            const schemaQuery = `PRAGMA table_info("${tableName}")`;
            const schemaResult = this.currentDB.exec(schemaQuery);
            
            if (schemaResult.length) {
                const columns = schemaResult[0].values.map(row => ({
                    name: row[1],
                    type: row[2],
                    notnull: row[3],
                    defaultValue: row[4],
                    pk: row[5]
                }));
                
                result += `Колонки: ${columns.map(col => col.name).join(', ')}\n`;
                
                const countQuery = `SELECT COUNT(*) as count FROM "${tableName}"`;
                const countResult = this.currentDB.exec(countQuery);
                const recordCount = countResult.length ? countResult[0].values[0][0] : 0;
                totalRecords += recordCount;
                result += `Записей: ${recordCount}\n`;
                
                if (this.dbImportData) {
                    this.dbImportData.stats[tableName] = {
                        columns: columns.length,
                        records: recordCount
                    };
                }
                
                const sampleQuery = `SELECT * FROM "${tableName}" LIMIT 2`;
                const sampleResult = this.currentDB.exec(sampleQuery);
                
                if (sampleResult.length && sampleResult[0].values.length > 0) {
                    result += `Пример данных:\n`;
                    sampleResult[0].values.forEach((row, rowIndex) => {
                        result += `  ${rowIndex + 1}. ${JSON.stringify(row)}\n`;
                    });
                }
                result += '\n';
            }
        });
        
        result += '=== СТАТИСТИКА ===\n\n';
        result += `Всего таблиц: ${tables.length}\n`;
        result += `Всего записей: ${totalRecords}\n\n`;
        
        Object.entries(this.dbImportData?.stats || {}).forEach(([tableName, stats]) => {
            result += `${tableName}: ${stats.records} записей, ${stats.columns} колонок\n`;
        });
        
        result += '\n=== ВОЗМОЖНОСТИ МИГРАЦИИ ===\n\n';
        
        if (tables.includes('meta_card_rows')) {
            result += '✓ Обнаружены карточки (meta_card_rows) - можно мигрировать в заметки\n';
        }
        if (tables.includes('reference_rows')) {
            result += '✓ Обнаружены ссылки между карточками (reference_rows)\n';
        }
        if (tables.includes('edge_rows')) {
            result += '✓ Обнаружены иерархические связи (edge_rows)\n';
        }
        if (tables.includes('tag_rows') || tables.includes('meta_card_tag_rows')) {
            result += '✓ Обнаружены теги\n';
        }
        
        if (this.dbImportData) {
            this.dbImportData.totalRecords = totalRecords;
            this.dbImportData.tables = tables;
        }
        
        return result;
    }
    
    migrateDBToNotes() {
        if (!this.currentDB) {
            throw new Error('Сначала загрузите и проанализируйте DB файл');
        }
        
        let migrationReport = '=== МИГРАЦИЯ ДАННЫХ ИЗ БАЗЫ В ЗАМЕТКИ ===\n\n';
        let notesCreated = 0;
        let entitiesProcessed = 0;
        
        const tables = this.dbImportData?.tables || [];
        
        if (tables.includes('meta_card_rows')) {
            const cardsQuery = `SELECT * FROM meta_card_rows`;
            const cardsResult = this.currentDB.exec(cardsQuery);
            
            if (cardsResult.length) {
                const columnNames = cardsResult[0].columns;
                const cards = cardsResult[0].values.map(row => {
                    const card = {};
                    columnNames.forEach((colName, index) => {
                        card[colName] = row[index];
                    });
                    return card;
                });
                
                migrationReport += `Найдено карточек: ${cards.length}\n\n`;
                
                cards.forEach((card, index) => {
                    try {
                        const existingNote = window.appState.data.notes.find(note => {
                            const noteDate = new Date(note.date);
                            const cardDate = new Date(card.created_at * 1000);
                            return noteDate.getTime() === cardDate.getTime() && note.content.includes(card.id || '');
                        });
                        
                        if (existingNote) {
                            migrationReport += `Пропущена дублирующая карточка ${card.id}\n`;
                            return;
                        }
                        
                        const noteDate = new Date(card.created_at * 1000 || Date.now());
                        const noteContent = this.createNoteFromCard(card);
                        
                        const newNote = {
                            id: window.appState.generateId(),
                            date: noteDate.getTime(), // Сохраняем как timestamp
                            content: noteContent
                        };
                        
                        window.appState.data.notes.push(newNote);
                        notesCreated++;
                        entitiesProcessed++;
                    } catch (error) {
                        migrationReport += `Ошибка обработки карточки ${card.id}: ${error.message}\n`;
                    }
                });
                
                migrationReport += `Создано заметок из карточек: ${notesCreated}\n`;
            }
        }
        
        window.appState.save();
        migrationReport += `\n=== ИТОГИ МИГРАЦИИ ===\n\n`;
        migrationReport += `Всего обработано сущностей: ${entitiesProcessed}\n`;
        migrationReport += `Создано новых заметок: ${notesCreated}\n`;
        migrationReport += `Общее количество заметки: ${window.appState.data.notes.length}\n`;
        
        if (notesCreated > 0) {
            migrationReport += `\nЗаметки успешно созданы и привязаны к соответствующим датам.\n`;
            migrationReport += `Используйте навигацию по графику для просмотра импортированных данных.\n`;
        }
        
        return migrationReport;
    }
    
    createNoteFromCard(card) {
        let timeString = '';
        if (card.created_at) {
            const date = new Date(card.created_at * 1000);
            timeString = `${date.getHours().toString().padStart(2, '0')}:${date.getMinutes().toString().padStart(2, '0')}`;
        }
        
        let content = '';
        if (card.title && card.title !== 'Без названия') {
            content += `${timeString} ${window.dom.formatDate(new Date(card.created_at * 1000))} (${window.dom.getWeekdayName(new Date(card.created_at * 1000))}) | ${card.title}`;
        } else {
            content += `${timeString} ${window.dom.formatDate(new Date(card.created_at * 1000))} (${window.dom.getWeekdayName(new Date(card.created_at * 1000))})`;
        }
        
        if (card.content) {
            content += ` | ${card.content}`;
        }
        
        let metadata = `МЕТАДАННЫЕ:\n`;
        metadata += `ID: ${card.id}\n`;
        metadata += `Создана: ${new Date(card.created_at * 1000).toLocaleString()}\n`;
        metadata += `Обновлена: ${new Date(card.updated_at * 1000).toLocaleString()}\n`;
        
        if (card.sync_status !== undefined) {
            metadata += `Статус синхронизации: ${card.sync_status}\n`;
        }
        
        metadata += `\n---\nИмпортировано из базы данных: ${new Date().toLocaleString()}`;
        
        content += `\n\n<button class="spoiler-toggle" onclick="window.uiManager.toggleSpoiler(this)">Показать метаданные</button>\n<div class="spoiler-content">${metadata}</div>`;
        
        return content;
    }
    
    clearImportResults() {
        document.getElementById('dbImportTextarea').value = '';
        document.getElementById('dbImportProgress').style.display = 'none';
        document.getElementById('dbImportProgressBar').style.width = '0%';
        document.getElementById('dbImportStatus').innerHTML = '';
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