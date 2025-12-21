// optimized3/modules/appCore.js
// optimized3/modules/appCore.js
class AppCore {
    constructor() {
        this.elements = {};
        this.cacheElements();
    }
    
    cacheElements() {
        const ids = [
            'warningOverlay', 'acceptWarning', 'browserInfoWarning', 'dontAskAgain',
            'graphContainer', 'graphElement', 'centerDateLabel',
            'dateListForDates', 'wavesList', 'notesList', 'noteInput',
            'dbImportTextarea', 'dbImportProgress', 'dbImportProgressBar',
            'dbImportStatus', 'intersectionResults', 'intersectionStats'
        ];
        
        ids.forEach(id => {
            const el = document.getElementById(id);
            if (el) this.elements[id] = el;
        });
    }
    
    init() {
        this.setupEventListeners();
        this.updateCSSVariables();
        
        // Загрузка состояния
        window.appState.load();
        
        // Проверяем, что все модули созданы
        if (!window.dates) {
            console.warn('AppCore: DatesManager не создан, создаем...');
            if (typeof DatesManager !== 'undefined') {
                window.dates = new DatesManager();
            }
        }
        
        if (!window.waves) {
            console.warn('AppCore: WavesManager не создан, создаем...');
            if (typeof WavesManager !== 'undefined') {
                window.waves = new WavesManager();
            }
        }
        
        if (!window.grid) {
            console.warn('AppCore: GridManager не создан, создаем...');
            if (typeof GridManager !== 'undefined') {
                window.grid = new GridManager();
            }
        }
        
        if (!window.importExport) {
            console.warn('AppCore: ImportExportManager не создан, создаем...');
            if (typeof ImportExportManager !== 'undefined') {
                window.importExport = new ImportExportManager();
            }
        }
        
        if (!window.dataManager) {
            console.warn('AppCore: DataManager не создан, создаем...');
            if (typeof DataManager !== 'undefined') {
                window.dataManager = new DataManager();
            }
        }
        
        if (!window.uiManager) {
            console.warn('AppCore: UIManager не создан, создаем...');
            if (typeof UIManager !== 'undefined') {
                window.uiManager = new UIManager();
            }
        }
        
        // Ждем немного чтобы шаблоны успели загрузиться
        setTimeout(() => {
            // Инициализация волн и сетки
            if (window.waves && window.waves.init) {
                window.waves.init();
            }
            
            if (window.grid && window.grid.createGrid) {
                window.grid.createGrid();
            }
            
            // УСТАНОВИТЬ РЕЖИМ ОТОБРАЖЕНИЯ ЗВЕЗД/ИМЕН ПРИ ЗАГРУЗКЕ
            if (window.appState.showStars) {
                document.body.classList.add('stars-mode');
                document.body.classList.remove('names-mode');
            } else {
                document.body.classList.remove('stars-mode');
                document.body.classList.add('names-mode');
            }
            
            // Обновление UI через единый менеджер списков
            if (window.dataManager) {
                window.dataManager.updateDateList();
                window.dataManager.updateWavesGroups();
                window.dataManager.updateNotesList();
            }
            
            // ВАЖНОЕ ИСПРАВЛЕНИЕ: Активация дефолтной даты при первом запуске
            this.activateDefaultDateOnStartup();
            
            // Если есть активная дата, обновляем положение
            if (window.appState.activeDateId) {
                setTimeout(() => {
                    if (window.dates && window.dates.recalculateCurrentDay) {
                        window.dates.recalculateCurrentDay();
                    }
                    
                    if (window.waves && window.waves.updatePosition) {
                        window.waves.updatePosition();
                    }
                    
                    if (window.grid && window.grid.updateCenterDate) {
                        window.grid.updateCenterDate();
                        window.grid.updateGridNotesHighlight();
                    }
                    
                    if (window.uiManager && window.uiManager.updateUI) {
                        window.uiManager.updateUI();
                    }
                    
                    // ПРОВЕРЯЕМ И ОБНОВЛЯЕМ КНОПКУ "СЕГОДНЯ" ПРИ ЗАГРУЗКЕ
                    if (window.dates && window.dates.updateTodayButton) {
                        window.dates.updateTodayButton();
                    }
                }, 50);
            }
            
            // Устанавливаем правильный фон графика
            const graphContainer = document.getElementById('graphContainer');
            if (graphContainer) {
                if (window.appState.graphBgWhite) {
                    graphContainer.style.backgroundColor = '#fff';
                    graphContainer.classList.remove('dark-mode');
                } else {
                    graphContainer.style.backgroundColor = '#000';
                    graphContainer.classList.add('dark-mode');
                }
                
                // Устанавливаем режим серости для графика
                if (window.appState.graphGrayMode) {
                    graphContainer.classList.add('graph-gray-mode');
                } else {
                    graphContainer.classList.remove('graph-gray-mode');
                }
            }
            
            // Показываем предупреждение если пользователь не отметил "Больше не спрашивать"
            const warningAccepted = localStorage.getItem('warningAccepted');
            const dontAskAgain = localStorage.getItem('warningDontAskAgain');
            
            if (!dontAskAgain) {
                this.showWarning();
            } else {
                this.elements.warningOverlay.classList.add('hidden');
                document.body.style.overflow = 'auto';
            }
            
            // НЕ рандомизируем порядок панелей, сохраняем пропорции 1/3 и 2/3
            
            // ДОПОЛНИТЕЛЬНО: Проверка данных волн в группах после загрузки
            setTimeout(() => {
                console.log('AppCore: проверка данных волн в группах...');
                if (window.debugGroups) {
                    window.debugGroups();
                }
            }, 2000);
            
            // Инициализируем EventManager если он ещё не создан
            if (!window.eventManager) {
                console.log('AppCore: инициализация EventManager...');
                if (typeof EventManager !== 'undefined') {
                    window.eventManager = new EventManager();
                }
            }
        }, 150); // Увеличена задержка для загрузки шаблонов
    }
    
    // НОВЫЙ МЕТОД: Активация дефолтной даты при старте
    activateDefaultDateOnStartup() {
        console.log('AppCore: проверка активации дефолтной даты при старте...');
        
        // Проверяем, есть ли активная дата и корректно ли она установлена
        const hasValidActiveDate = window.appState.activeDateId && 
                                  window.appState.data.dates.some(d => d.id === window.appState.activeDateId);
        
        if (!hasValidActiveDate || !window.appState.baseDate || isNaN(window.appState.baseDate.getTime())) {
            console.log('AppCore: активная дата не установлена или некорректна, активируем дефолтную...');
            
            // Находим дефолтную дату (s25)
            const defaultDateId = 's25';
            const defaultDate = window.appState.data.dates.find(d => d.id === defaultDateId);
            
            if (defaultDate) {
                console.log('AppCore: активируем дефолтную дату:', defaultDateId);
                
                // Устанавливаем как активную
                window.appState.activeDateId = defaultDateId;
                
                try {
                    const date = new Date(defaultDate.date);
                    if (isNaN(date.getTime())) {
                        throw new Error('Некорректная дата в объекте');
                    }
                    
                    window.appState.baseDate = new Date(date);
                    console.log('AppCore: установлена базовая дата из дефолтной:', defaultDate.date);
                    
                    // Пересчитываем текущий день
                    if (window.dates && window.dates.recalculateCurrentDay) {
                        window.dates.recalculateCurrentDay();
                    }
                    
                    // Обновляем графики
                    if (window.grid && window.grid.createGrid) {
                        window.grid.createGrid();
                    }
                    if (window.grid && window.grid.updateCenterDate) {
                        window.grid.updateCenterDate();
                        window.grid.updateGridNotesHighlight();
                    }
                    if (window.waves && window.waves.updatePosition) {
                        window.waves.updatePosition();
                    }
                    
                    window.appState.save();
                    
                    console.log('AppCore: дефолтная дата успешно активирована');
                    
                } catch (error) {
                    console.error('AppCore: ошибка активации дефолтной даты:', error);
                    // Если ошибка, устанавливаем сегодняшнюю дату
                    window.appState.baseDate = new Date();
                    if (window.dates && window.dates.recalculateCurrentDay) {
                        window.dates.recalculateCurrentDay();
                    }
                    window.appState.save();
                }
            } else {
                console.error('AppCore: дефолтная дата не найдена в данных');
                
                // Если нет дефолтной даты, берем первую из списка
                if (window.appState.data.dates && window.appState.data.dates.length > 0) {
                    const firstDate = window.appState.data.dates[0];
                    console.log('AppCore: используем первую дату из списка:', firstDate.id);
                    if (window.dates && window.dates.setActiveDate) {
                        window.dates.setActiveDate(firstDate.id);
                    }
                } else {
                    // Если вообще нет дат, устанавливаем сегодняшнюю
                    console.log('AppCore: нет дат в списке, устанавливаем сегодняшнюю');
                    window.appState.baseDate = new Date();
                    if (window.dates && window.dates.recalculateCurrentDay) {
                        window.dates.recalculateCurrentDay();
                    }
                    window.appState.save();
                }
            }
        } else {
            console.log('AppCore: активная дата уже корректно установлена:', window.appState.activeDateId);
        }
    }
    
    showWarning() {
        const browserInfo = this.getBrowserInfo();
        this.elements.browserInfoWarning.textContent = `Браузер: ${browserInfo}`;
        
        // Форсируем рефлоу перед показом, чтобы избежать плавления
        this.elements.browserInfoWarning.offsetHeight; 
        
        // Только теперь показываем
        this.elements.warningOverlay.classList.remove('hidden');
        document.body.style.overflow = 'hidden';
    }
    
    getBrowserInfo() {
        const ua = navigator.userAgent;
        if (ua.includes("Chrome") && !ua.includes("Edg")) return "Google Chrome";
        if (ua.includes("Firefox")) return "Mozilla Firefox";
        if (ua.includes("Safari") && !ua.includes("Chrome")) return "Apple Safari";
        if (ua.includes("Edg")) return "Microsoft Edge";
        return "Неизвестный браузер";
    }
    
    updateCSSVariables() {
        document.documentElement.style.setProperty('--gsx', window.appState.config.gridSquaresX);
        document.documentElement.style.setProperty('--gw', window.appState.graphWidth + 'px');
    }
    
    setupEventListeners() {
        console.log('AppCore: настройка обработчиков событий...');
        
        // ОБРАБОТЧИКИ ПЕРЕМЕЩЕНЫ В eventManager.js
        // Делегирование событий теперь обрабатывается через EventManager
        
        // Оставляем только специфичные обработчики, которые неудобно обрабатывать через делегирование
        
        // Обработчики для конкретных кнопок (предупреждение)
        if (this.elements.acceptWarning) {
            this.elements.acceptWarning.addEventListener('click', () => {
                this.elements.warningOverlay.classList.add('hidden');
                document.body.style.overflow = 'auto';
                localStorage.setItem('warningAccepted', 'true');
                
                // Сохраняем настройку "Больше не спрашивать"
                const dontAskAgain = document.getElementById('dontAskAgain');
                if (dontAskAgain && dontAskAgain.checked) {
                    localStorage.setItem('warningDontAskAgain', 'true');
                }
            });
        }
        
        // Форма добавления волны (оставляем для гарантии работы)
        const btnAddCustomWave = document.getElementById('btnAddCustomWave');
        if (btnAddCustomWave) {
            btnAddCustomWave.addEventListener('click', () => {
                const name = document.getElementById('customWaveName').value;
                const period = document.getElementById('customWavePeriod').value;
                const type = document.getElementById('customWaveType').value;
                const color = document.getElementById('customWaveColor').value;
                
                if (name && period) {
                    if (window.waves && window.waves.addCustomWave) {
                        window.waves.addCustomWave(name, period, type, color);
                    }
                    
                    if (window.dataManager && window.dataManager.updateWavesGroups) {
                        window.dataManager.updateWavesGroups();
                    }
                    
                    if (window.uiManager && window.uiManager.clearWaveForm) {
                        window.uiManager.clearWaveForm();
                    }
                }
            });
        }
        
        // Форма добавления даты (оставляем для гарантии работы)
        const btnAddDate = document.getElementById('btnAddDate');
        if (btnAddDate) {
            btnAddDate.addEventListener('click', () => {
                const dateValue = document.getElementById('dateInput').value;
                const name = document.getElementById('dateNameInput').value || 'Новая дата';
                
                if (dateValue) {
                    if (window.dates && window.dates.addDate) {
                        window.dates.addDate(dateValue, name);
                    }
                    
                    if (window.dataManager && window.dataManager.updateDateList) {
                        window.dataManager.updateDateList();
                    }
                }
            });
        }
        
        // Форма добавления заметки (оставляем для гарантии работы)
        const btnAddNote = document.getElementById('btnAddNote');
        if (btnAddNote) {
            btnAddNote.addEventListener('click', () => {
                const content = document.getElementById('noteInput').value;
                if (content) {
                    if (window.dates && window.dates.addNote) {
                        window.dates.addNote(content);
                    }
                    
                    if (window.dataManager && window.dataManager.updateNotesList) {
                        window.dataManager.updateNotesList();
                        document.getElementById('noteInput').value = '';
                    }
                }
            });
        }
        
        // Импорт файлов (оставляем для гарантии работы)
        const importAllFile = document.getElementById('importAllFile');
        const importDBFile = document.getElementById('importDBFile');
        
        if (importAllFile) {
            importAllFile.addEventListener('change', (e) => {
                const file = e.target.files[0];
                if (file) {
                    if (window.importExport && window.importExport.importAll) {
                        window.importExport.importAll(file).then(() => {
                            if (window.uiManager && window.uiManager.updateUI) {
                                window.uiManager.updateUI();
                            }
                        }).catch(err => {
                            alert('Ошибка импорта: ' + err.message);
                        });
                    }
                }
            });
        }
        
        if (importDBFile) {
            importDBFile.addEventListener('change', async (e) => {
                const file = e.target.files[0];
                if (file) {
                    try {
                        document.getElementById('dbImportProgress').style.display = 'block';
                        
                        if (window.importExport && window.importExport.updateDBImportProgress) {
                            window.importExport.updateDBImportProgress(30, 'Загрузка базы данных...');
                        }
                        
                        if (window.importExport && window.importExport.importDB) {
                            const result = await window.importExport.importDB(file);
                            document.getElementById('dbImportTextarea').value = result;
                            
                            if (window.importExport && window.importExport.updateDBImportProgress) {
                                window.importExport.updateDBImportProgress(100, 'База данных загружена!');
                            }
                            
                            if (window.importExport && window.importExport.showDBImportStatus) {
                                window.importExport.showDBImportStatus('База данных успешно загружена!', 'success');
                            }
                        }
                    } catch (error) {
                        if (window.importExport && window.importExport.showDBImportStatus) {
                            window.importExport.showDBImportStatus(`Ошибка загрузки базы: ${error.message}`, 'error');
                        }
                        document.getElementById('dbImportTextarea').value = `❌ ОШИБКА ЗАГРРУЗКИ БАЗЫ ДАННЫХ\n\nФайл: ${file.name}\nОшибка: ${error.message}`;
                    }
                }
            });
        }
        
        // Анализ DB (оставляем для гарантии работы)
        const btnAnalyzeDB = document.getElementById('btnAnalyzeDB');
        if (btnAnalyzeDB) {
            btnAnalyzeDB.addEventListener('click', async () => {
                try {
                    if (window.importExport && window.importExport.showDBImportStatus) {
                        window.importExport.showDBImportStatus('Анализ структуры базы данных...', 'info');
                    }
                    
                    document.getElementById('dbImportProgress').style.display = 'block';
                    
                    if (window.importExport && window.importExport.updateDBImportProgress) {
                        window.importExport.updateDBImportProgress(10);
                    }
                    
                    if (window.importExport && window.importExport.analyzeDB) {
                        const result = await window.importExport.analyzeDB();
                        document.getElementById('dbImportTextarea').value = result;
                        
                        if (window.importExport && window.importExport.updateDBImportProgress) {
                            window.importExport.updateDBImportProgress(100, 'Анализ завершен!');
                        }
                        
                        if (window.importExport && window.importExport.showDBImportStatus) {
                            window.importExport.showDBImportStatus('Анализ базы данных завершен успешно!', 'success');
                        }
                    }
                } catch (error) {
                    if (window.importExport && window.importExport.showDBImportStatus) {
                        window.importExport.showDBImportStatus(`Ошибка анализа: ${error.message}`, 'error');
                    }
                    document.getElementById('dbImportTextarea').value = `ОШИБКА АНАЛИЗА:\n\n${error.message}`;
                }
            });
        }
        
        // Миграция DB в заметки (оставляем для гарантии работы)
        const btnMigrateToNotes = document.getElementById('btnMigrateToNotes');
        if (btnMigrateToNotes) {
            btnMigrateToNotes.addEventListener('click', () => {
                try {
                    if (window.importExport && window.importExport.showDBImportStatus) {
                        window.importExport.showDBImportStatus('Начало миграции данных...', 'info');
                    }
                    
                    document.getElementById('dbImportProgress').style.display = 'block';
                    
                    if (window.importExport && window.importExport.updateDBImportProgress) {
                        window.importExport.updateDBImportProgress(10);
                    }
                    
                    if (window.importExport && window.importExport.migrateDBToNotes) {
                        const result = window.importExport.migrateDBToNotes();
                        document.getElementById('dbImportTextarea').value = result;
                        
                        if (window.importExport && window.importExport.updateDBImportProgress) {
                            window.importExport.updateDBImportProgress(100, 'Миграция завершена!');
                        }
                        
                        if (window.importExport && window.importExport.showDBImportStatus) {
                            window.importExport.showDBImportStatus('Миграция завершена успешно!', 'success');
                        }
                        
                        if (window.dataManager && window.dataManager.updateNotesList) {
                            window.dataManager.updateNotesList();
                        }
                        
                        if (window.grid && window.grid.updateGridNotesHighlight) {
                            window.grid.updateGridNotesHighlight();
                        }
                    }
                } catch (error) {
                    if (window.importExport && window.importExport.showDBImportStatus) {
                        window.importExport.showDBImportStatus(`Ошибка миграции: ${error.message}`, 'error');
                    }
                    document.getElementById('dbImportTextarea').value = `ОШИБКА МИГРАЦИИ:\n\n${error.message}`;
                }
            });
        }
        
        // Клавиатура - ОСТАВЛЯЕМ ТОЛЬКО СТРЕЛОЧКИ ДЛЯ ВИЗОРА
        document.addEventListener('keydown', (e) => {
            if (!window.dates) return;
            
            switch(e.key) {
                case 'ArrowLeft': 
                    if (window.dates.navigateDay) {
                        window.dates.navigateDay(-1); 
                    }
                    break;
                case 'ArrowRight': 
                    if (window.dates.navigateDay) {
                        window.dates.navigateDay(1); 
                    }
                    break;
            }
        });
        
        console.log('AppCore: обработчики событий настроены');
    }
}

window.appCore = new AppCore();