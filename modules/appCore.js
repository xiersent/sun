// modules/appCore.js
class AppCore {
    constructor() {
        this.elements = {};
        this.cacheElements();
    }
    
    cacheElements() {
        const ids = [
            'warningOverlay', 'acceptWarning', 'browserInfo', 'versionInfo', 'todayInfo',
            'graphContainer', 'graphElement', 'centerDateLabel',
            'dateListForDates', 'wavesList', 'notesList', 'noteInput',
            'dbImportTextarea', 'dbImportProgress', 'dbImportProgressBar',
            'dbImportStatus', 'intersectionResults', 'intersectionStats',
            'warningBox', 'currentDay', 'summaryPanel', 'summaryGroupSelect',
            'summaryStateSelect', 'summaryResults',  // УДАЛЕНО: summaryStats
            'readParableBtn', 'parableModal', 'parableContent', 'closeParableBtn'  // НОВОЕ: элементы притчи
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
        
        // НЕМЕДЛЕННО обновляем центральную дату после загрузки состояния
        if (window.grid && window.grid.updateCenterDate) {
            window.grid.updateCenterDate();
        }
        
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
        
        if (!window.summaryManager) {
            console.warn('AppCore: SummaryManager не создан, создаем...');
            if (typeof SummaryManager !== 'undefined') {
                window.summaryManager = new SummaryManager();
            }
        }
        
        // Инициализация приложения
        this.initializeApp();
    }
    

    async initializeAppComponents() {
        // ВАЖНОЕ ИЗМЕНЕНИЕ: Ждем загрузки шаблонов перед рендерингом UI
        console.log('AppCore: ожидание загрузки шаблонов...');
        
        if (window.unifiedListManager && window.unifiedListManager.initTemplates) {
            try {
                // Начинаем загрузку шаблонов
                const templatesPromise = window.unifiedListManager.initTemplates();
                
                // ВАЖНО: Инициализируем волны с правильным currentDay
                if (window.waves && window.waves.init) {
                    console.log('AppCore: инициализация WavesManager...');
                    await window.waves.init(); // Ждем инициализации волн
                }
                
                if (window.grid && window.grid.createGrid) {
                    window.grid.createGrid();
                }
                
                // Инициализируем сводную информацию
                if (window.summaryManager && window.summaryManager.init) {
                    console.log('AppCore: инициализация SummaryManager...');
                    window.summaryManager.init();
                }
                
                // Ждем завершения загрузки шаблонов
                await templatesPromise;
                console.log('AppCore: шаблоны загружены успешно');
                
            } catch (error) {
                console.error('AppCore: ошибка загрузки шаблонов:', error);
            }
        }
        
        // Теперь рендерим UI с загруженными шаблонами
        console.log('AppCore: рендеринг UI...');
        
        if (window.dataManager) {
            // Используем асинхронные вызовы
            if (window.dataManager.updateDateList) {
                await window.dataManager.updateDateList();
            }
            
            if (window.dataManager.updateWavesGroups) {
                await window.dataManager.updateWavesGroups();
            }
            
            if (window.dataManager.updateNotesList) {
                window.dataManager.updateNotesList();
            }
        }
        
        // ИСПРАВЛЕНИЕ: Устанавливаем фон графика ТОЛЬКО через CSS-классы
        const graphContainer = document.getElementById('graphContainer');
        if (graphContainer) {
            // УДАЛЕНО: Установка inline-стилей для фона
            // ВМЕСТО ЭТОГО: Только управление CSS-классами
            
            if (!window.appState.graphBgWhite) {
                graphContainer.classList.add('dark-mode');
            } else {
                graphContainer.classList.remove('dark-mode');
            }
            
            if (window.appState.graphGrayMode) {
                graphContainer.classList.add('graph-gray-mode');
            } else {
                graphContainer.classList.remove('graph-gray-mode');
            }
        }
        
        // НОВОЕ: Устанавливаем начальное значение в mainDateInput
        const mainDateInput = document.getElementById('mainDateInput');
        if (mainDateInput && window.dom) {
            mainDateInput.value = window.dom.formatDateForDateTimeInputWithSeconds(window.appState.currentDate);
            console.log('AppCore: установлено начальное значение в mainDateInput:', mainDateInput.value);
        }
        
        // НОВОЕ: Загружаем текст притчи в модальное окно
        this.loadParableText();
        
        // ПОКАЗЫВАЕМ ПРЕДУПРЕЖДЕНИЕ ВСЕГДА
        this.showWarning();
        
        // НЕ рандомизируем порядок панелей, сохраняем пропорции 1/3 и 2/3
        
        // ДОПОЛНИТЕЛЬНО: Проверка данных волн в группах после загрузка
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
        
        // Обновляем кнопку "Сегодня"
        if (window.dates && window.dates.updateTodayButton) {
            window.dates.updateTodayButton();
        }
        
        console.log('AppCore: инициализация завершена');
    }

    // И измените вызов в методе initializeApp():
    async initializeApp() {
        // Проверяем мобильное устройство
        const isMobile = this.isMobileDevice();
        
        if (isMobile) {
            // Для мобильных - показываем только предупреждение
            this.showWarning();
            // Добавляем класс для мобильных устройств
            document.body.classList.add('mobile-device');
            console.log('AppCore: Мобильное устройство обнаружено, показываем только предупреждение');
            return; // Прерываем дальнейшую инициализацию
        }
        
        // Продолжаем стандартную инициализацию для десктопов
        console.log('AppCore: Десктоп устройство, продолжаем стандартную инициализацию');
        
        // Устанавливаем режим отображения звезд/имен
        if (window.appState.showStars) {
            document.body.classList.add('stars-mode');
            document.body.classList.remove('names-mode');
        } else {
            document.body.classList.remove('stars-mode');
            document.body.classList.add('names-mode');
        }
        
        // ИЗМЕНЕНО: Устанавливаем начальное время на ТОЧНОЕ время (сейчас)
        const now = new Date();
        window.appState.currentDate = new Date(now);
        
        // Пересчитываем с учетом времени
        if (window.dates && window.dates.recalculateCurrentDay) {
            window.dates.recalculateCurrentDay(true);
        }
        
        // Замените старый код на вызов нового метода:
        await this.initializeAppComponents();
        
        // ГАРАНТИРОВАННАЯ ИНИЦИАЛИЗАЦИЯ - добавляем этот блок
        console.log('=== ГАРАНТИРОВАННАЯ ИНИЦИАЛИЗАЦИЯ В AppCore ===');
        
        // Даем время всем модулям загрузиться
        setTimeout(() => {
            if (window.dates) {
                // Вызываем force initialize
                if (window.dates.forceInitialize) {
                    window.dates.forceInitialize();
                } else {
                    // Fallback: базовая инициализация
                    if (window.dates.recalculateCurrentDay) {
                        window.dates.recalculateCurrentDay(true); // ИСПРАВЛЕНО: true для точного времени
                    }
                    if (window.appState.activeDateId && window.dates.setActiveDate) {
                        window.dates.setActiveDate(window.appState.activeDateId, true); // ИСПРАВЛЕНО: true для точного времени
                    }
                }
            }
        }, 500);
        
        console.log('AppCore: инициализация завершена');
    }

    
    // Метод для получения версии из файла
    async getVersion() {
        try {
            // Пробуем загрузить версию
            const response = await fetch('version.txt');
            if (response.ok) {
                return (await response.text()).trim();
            }
            return '(файл не найден)';
        } catch (error) {
            console.error('Ошибка загрузки версии:', error);
            return '(ошибка загрузки)';
        }
    }
    
    // Метод для определения мобильного устройства
    isMobileDevice() {
        // Более точная проверка на мобильное устройство
        const userAgent = navigator.userAgent.toLowerCase();
        
        // Проверка по userAgent
        const isMobileUserAgent = /mobile|android|iphone|ipad|ipod|windows phone/i.test(userAgent);
        
        // Проверка по сенсорному вводу
        const isTouchDevice = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
        
        // Проверка по соотношению сторон и размеру экрана
        const hasMobileViewport = window.innerWidth <= 768 || 
                                 (window.innerHeight > window.innerWidth && window.innerWidth < 1024);
        
        // Проверка на планшет (iPad и другие)
        const isTablet = /(ipad|tablet|(android(?!.*mobile))|(windows(?!.*phone)(.*touch)))/i.test(userAgent);
        
        // Если это планшет, считаем его мобильным для нашего приложения
        return isMobileUserAgent || isTouchDevice || hasMobileViewport || isTablet;
    }
    
    showWarning() {
        const warningOverlay = document.getElementById('warningOverlay') || this.elements.warningOverlay;
        if (!warningOverlay) return;
        
        // Проверяем мобильное устройство
        const isMobile = this.isMobileDevice();
        
        if (isMobile) {
            // Для мобильных устройств - только предупреждение, без кнопки
            this.showMobileWarning(warningOverlay);
            return;
        }
        
        // Для десктопов - стандартное поведение
        this.showDesktopWarning(warningOverlay);
    }
    
    showDesktopWarning(warningOverlay) {
        // Существующая логика для десктопов
        warningOverlay.classList.remove('hidden');
        warningOverlay.classList.add('desktop-warning');
        document.body.style.overflow = 'hidden';
        
        // Загружаем информацию ОТДЕЛЬНО для каждой строки
        
        // 1. Информация о браузере - СРАЗУ, синхронно
        const browserInfoEl = document.getElementById('browserInfo');
        if (browserInfoEl) {
            browserInfoEl.textContent = this.getBrowserInfo();
        }
        
        // 2. Информация о сегодняшней дате - СРАЗУ, синхронно
        const todayInfoEl = document.getElementById('todayInfo');
        if (todayInfoEl) {
            const today = new Date();
            const todayFormatted = `${today.getDate().toString().padStart(2, '0')}.${(today.getMonth() + 1).toString().padStart(2, '0')}.${today.getFullYear()}`;
            todayInfoEl.textContent = todayFormatted;
        }
        
        // 3. Версия приложения - АСИНХРОННО
        const versionInfoEl = document.getElementById('versionInfo');
        if (versionInfoEl) {
            versionInfoEl.textContent = 'Загрузка...';
            
            this.getVersion().then(version => {
                if (versionInfoEl) {
                    versionInfoEl.textContent = version || 'неизвестно';
                }
            }).catch(error => {
                if (versionInfoEl) {
                    versionInfoEl.textContent = 'неизвестно';
                }
            });
        }
    }
    
    showMobileWarning(warningOverlay) {
        // Скрываем весь основной контент
        document.querySelectorAll('.interface-container, .corner-square').forEach(el => {
            el.style.display = 'none';
        });
        
        // Настраиваем предупреждение для мобильных
        warningOverlay.classList.remove('hidden');
        warningOverlay.classList.add('mobile-warning-overlay');
        
        // Убираем кнопку "Согласиться и продолжить"
        const acceptButton = document.getElementById('acceptWarning');
        if (acceptButton) {
            acceptButton.style.display = 'none';
        }
        
        // Убираем кнопку "прочесть притчу"
        const parableButton = document.getElementById('readParableBtn');
        if (parableButton) {
            parableButton.style.display = 'none';
        }
        
        // Изменяем содержимое предупреждения
        const warningBox = warningOverlay.querySelector('.warning-box');
        if (warningBox) {
            warningBox.classList.add('mobile-warning-box');
            
            // Обновляем заголовок и текст для мобильных
            const warningTitle = warningBox.querySelector('.warning-title');
            if (warningTitle) {
                warningTitle.textContent = 'НЕДОСТУПНО НА МОБИЛЬНЫХ УСТРОЙСТВАХ';
                warningTitle.style.color = '#ff0000';
            }
            
            const warningText = warningBox.querySelector('.warning-text');
            if (warningText) {
                warningText.innerHTML = ``;
            }
            
            // Обновляем информацию о браузере
            const browserInfoEl = document.getElementById('browserInfo');
            if (browserInfoEl) {
                browserInfoEl.textContent = `Мобильное устройство (${this.getMobileDeviceType()})`;
            }
            
            // Обновляем информацию о сегодняшней дате
            const todayInfoEl = document.getElementById('todayInfo');
            if (todayInfoEl) {
                const today = new Date();
                const todayFormatted = `${today.getDate().toString().padStart(2, '0')}.${(today.getMonth() + 1).toString().padStart(2, '0')}.${today.getFullYear()}`;
                todayInfoEl.textContent = todayFormatted;
            }
            
            // Обновляем версию
            const versionInfoEl = document.getElementById('versionInfo');
            if (versionInfoEl) {
                versionInfoEl.textContent = 'Только для ПК';
            }
            
            // Добавляем кнопку для повторной проверки
            const retryButton = document.createElement('button');
            retryButton.className = 'ui-btn mobile-retry-btn';
            retryButton.textContent = 'Проверить снова (если вы на компьютере)';
            retryButton.style.marginTop = '20px';
            retryButton.style.backgroundColor = '#666';
            retryButton.addEventListener('click', () => {
                location.reload();
            });
            
            warningBox.appendChild(retryButton);
        }
    }
    
    getMobileDeviceType() {
        const ua = navigator.userAgent.toLowerCase();
        if (ua.includes('iphone')) return 'iPhone';
        if (ua.includes('ipad')) return 'iPad';
        if (ua.includes('android')) return 'Android';
        if (ua.includes('windows phone')) return 'Windows Phone';
        return 'Мобильное устройство';
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
        
        // НОВОЕ: Обработчик для кнопки "прочесть притчу"
        const readParableBtn = document.getElementById('readParableBtn');
        if (readParableBtn) {
            readParableBtn.addEventListener('click', () => {
                this.showParableModal();
            });
        }
        
        // НОВОЕ: Обработчик для кнопки закрытия притчи
        const closeParableBtn = document.getElementById('closeParableBtn');
        if (closeParableBtn) {
            closeParableBtn.addEventListener('click', () => {
                this.hideParableModal();
            });
        }
        
        // Обработчик для кнопки "Согласиться и продолжить" - ДОБАВЛЯЕМ СРАЗУ
        const acceptWarningBtn = document.getElementById('acceptWarning');
        if (acceptWarningBtn) {
            acceptWarningBtn.addEventListener('click', () => {
                const warningOverlay = document.getElementById('warningOverlay');
                if (warningOverlay) {
                    warningOverlay.classList.add('hidden');
                    document.body.style.overflow = 'auto';
                }
            });
        }
        
        // ОБРАБОТЧИКИ ПЕРЕМЕЩЕНЫ В eventManager.js
        // Делегирование событий теперь обрабатывается через EventManager
        
        // Оставляем только специфичные обработчики, которые неудобно обрабатывать через делегирование
        
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
                    
                    // Обновляем сводную информацию при добавлении новой волны
                    if (window.summaryManager && window.summaryManager.refresh) {
                        window.summaryManager.refresh();
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
                            
                            // Обновляем сводную информацию после импорта
                            if (window.summaryManager && window.summaryManager.refresh) {
                                window.summaryManager.refresh();
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
                case 'Escape':
                    // Закрыть модальное окно притчи при нажатии ESC
                    if (this.elements.parableModal && !this.elements.parableModal.classList.contains('hidden')) {
                        this.hideParableModal();
                    }
                    break;
            }
        });
        
        console.log('AppCore: обработчики событий настроены');
    }
    
    // НОВЫЕ МЕТОДЫ ДЛЯ РАБОТЫ С ПРИТЧЕЙ
    
    loadParableText() {
        const parableContent = this.elements.parableContent;
        if (!parableContent) return;
        
        // Берем текст притчи из начала страницы (блок .aaa-blockquote)
        const parableBlock = document.querySelector('.aaa-blockquote');
        if (parableBlock) {
            parableContent.innerHTML = parableBlock.innerHTML;
        } else {
            // Если блок не найден, используем запасной текст
            parableContent.innerHTML = `
                <p>Говорят, когда-то одну девушку обвинили в ведовстве. В качестве наказания её отвезли на островок на озере – клочок каменистой почвы, где не было ни еды, ни укрытий. Её приговорили к мучительной медленной смерти от холода и голода.</p>
                <p>Вот только не знали в городе, что один юноша, увидев её глаза, прекрасные и сверкающие, подобно луне в летнюю ночь, поклялся ей в вечной любви. Когда ей вынесли приговор – по его мнению, несправедливый – он дал обет уберечь её от гибели. Выжидая удобного дня для совместного побега, он каждую ночь втайне переплывал озеро на лодке с едой и тёплой одеждой. А она каждую ночь вставала у воды и зажигала свечу, чтобы указать ему путь.</p>
                <p>Как-то раз, в поразительно ясную ночь, когда на небе не было ни облачка, юноша, как всегда, отчалил от берега. Он внимательно вглядывался в темноту, выискивая огонёк, который приведёт его к любимой. Однако в ту ночь луна светила до того ярко, что затмила бы собой любую свечу. Отражение луны в воде сбило юношу с пути. Он грёб, грёб и грёб к свету, всё надеясь, что вот-вот доплывёт. Иллюзорный отсвет луны до того заворожил его, что он не замечал ни ноющих рук, ни сбившегося дыхания... Когда лодка перевернулась, он был уже так измотан греблей, так ослабли его руки, что до берега он не добрался. Он упокоился в озере.</p>
                <p>Оставшись одна, девушка всё же не теряла надежды. Каждую ночь она выходила к воде и зажигала свечу. Говорят, и по сей день те, кто ищут истинную любовь, видят на озере свечу Светоносной девы, что надеется указать дорогу любимому.</p>
            `;
        }
    }
    
    showParableModal() {
        const parableModal = this.elements.parableModal;
        if (parableModal) {
            parableModal.classList.remove('hidden');
            // Блокируем прокрутку основного содержимого
            document.body.style.overflow = 'hidden';
        }
    }
    
    hideParableModal() {
        const parableModal = this.elements.parableModal;
        if (parableModal) {
            parableModal.classList.add('hidden');
            // Восстанавливаем прокрутку основного содержимого
            // (но оставляем скрытой, если warningOverlay еще виден)
            if (this.elements.warningOverlay.classList.contains('hidden')) {
                document.body.style.overflow = 'auto';
            } else {
                document.body.style.overflow = 'hidden';
            }
        }
    }
}

window.appCore = new AppCore();