// optimized3/modules/appCore.js
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
            'warningBox', 'currentDay'
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
        
        // Инициализация приложения
        this.initializeApp();
    }
    
    initializeApp() {
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
        
        // ВАЖНОЕ ИСПРАВЛЕНИЕ: 1. СНАЧАЛА активируем дефолтную дату и РАССЧИТЫВАЕМ currentDay
        this.activateDefaultDateOnStartup();
        
        // 2. ОБНОВЛЯЕМ currentDay элемент СРАЗУ
        this.updateCurrentDayElement();
        
        // Устанавливаем режим отображения звезд/имен
        if (window.appState.showStars) {
            document.body.classList.add('stars-mode');
            document.body.classList.remove('names-mode');
        } else {
            document.body.classList.remove('stars-mode');
            document.body.classList.add('names-mode');
        }
        
        // 3. ПОТОМ инициализируем волны и сетку
        if (window.waves && window.waves.init) {
            window.waves.init();
        }
        
        if (window.grid && window.grid.createGrid) {
            window.grid.createGrid();
        }
        
        // 4. Обновление UI через единый менеджер списков
        if (window.dataManager) {
            window.dataManager.updateDateList();
            window.dataManager.updateWavesGroups();
            window.dataManager.updateNotesList();
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
        
        // ГАРАНТИЯ: Выполнить финальное обновление через 100мс
        setTimeout(() => {
            console.log('AppCore: финальное обновление UI...');
            console.log('Текущий currentDay:', window.appState.currentDay);
            console.log('Текущая дата визора:', window.appState.currentDate);
            console.log('Базовая дата:', window.appState.baseDate);
            
            // Еще раз обновляем currentDay
            if (window.dates && window.dates.recalculateCurrentDay) {
                window.dates.recalculateCurrentDay();
            }
            
            // Обновляем DOM элемент
            this.updateCurrentDayElement();
            
            // Обновляем позиции волн
            if (window.waves && window.waves.updatePosition) {
                window.waves.updatePosition();
            }
            
            // Обновляем кнопку "Сегодня"
            if (window.dates && window.dates.updateTodayButton) {
                window.dates.updateTodayButton();
            }
        }, 100);
    }
    
    // Метод для получения версии из файла
    async getVersion() {
        try {
            // Проверяем кэш
            const cachedVersion = localStorage.getItem('appVersion');
            const cacheTimestamp = localStorage.getItem('appVersionTimestamp');
            const now = Date.now();
            
            // Если версия в кэше и не старше 24 часов, используем её
            if (cachedVersion && cacheTimestamp && (now - parseInt(cacheTimestamp)) < 24 * 60 * 60 * 1000) {
                return cachedVersion;
            }
            
            // Загружаем свежую версию
            const response = await fetch('version.txt?t=' + now);
            if (response.ok) {
                const text = await response.text();
                const trimmedText = text.trim();
                
                // Сохраняем в кэш
                localStorage.setItem('appVersion', trimmedText);
                localStorage.setItem('appVersionTimestamp', now.toString());
                
                return trimmedText;
            }
        } catch (error) {
            console.error('Ошибка загрузки версии:', error);
        }
        return null;
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
    
    // НОВЫЙ МЕТОД: Активация дефолтной даты при старте
    activateDefaultDateOnStartup() {
        console.log('AppCore: проверка активации дефолтной даты при старте...');
        
        const hasValidActiveDate = window.appState.activeDateId && 
                                  window.appState.data.dates.some(d => d.id === window.appState.activeDateId);
        
        if (!hasValidActiveDate || !window.appState.baseDate || isNaN(window.appState.baseDate.getTime())) {
            console.log('AppCore: активная дата не установлена или некорректна, активируем дефолтную...');
            
            // Находим дефолтную дату (s25)
            const defaultDateId = 's25';
            const defaultDate = window.appState.data.dates.find(d => d.id === defaultDateId);
            
            if (defaultDate) {
                console.log('AppCore: активируем дефолтную дату через DatesManager:', defaultDateId);
                
                // ГАРАНТИЯ: Проверяем, что dates инициализирован
                if (window.dates && window.dates.setActiveDate) {
                    window.dates.setActiveDate(defaultDateId);
                } else {
                    console.error('AppCore: DatesManager не инициализирован, выполняем ручную активацию');
                    
                    // Ручная активация с гарантией расчета currentDay
                    window.appState.activeDateId = defaultDateId;
                    
                    try {
                        const date = new Date(defaultDate.date);
                        if (isNaN(date.getTime())) {
                            throw new Error('Некорректная дата в объекте');
                        }
                        
                        window.appState.baseDate = new Date(date);
                        console.log('AppCore: установлена базовая дата из дефолтной:', defaultDate.date);
                        
                        // ВАЖНО: Пересчитываем текущий день СРАЗУ
                        if (window.dates && window.dates.recalculateCurrentDay) {
                            window.dates.recalculateCurrentDay();
                        } else {
                            // Fallback: ручной расчет
                            window.appState.currentDay = this.getDaysBetweenDates(
                                window.appState.baseDate, 
                                window.appState.currentDate
                            );
                            console.log('AppCore: currentDay рассчитан вручную:', window.appState.currentDay);
                        }
                        
                        // Гарантируем создание волн
                        this.activateWavesForDefaultDate();
                        
                        // Сохраняем
                        window.appState.save();
                        
                        // ВАЖНО: Обновляем DOM элемент currentDay
                        this.updateCurrentDayElement();
                        
                    } catch (error) {
                        console.error('AppCore: ошибка активации дефолтной даты:', error);
                        // Если ошибка, устанавливаем сегодняшнюю дату
                        this.fallbackToToday();
                    }
                }
            } else {
                console.error('AppCore: дефолтная дата не найдена в данных');
                this.fallbackToFirstDateOrToday();
            }
        } else {
            console.log('AppCore: активная дата уже корректно установлена:', window.appState.activeDateId);
            
            // ВАЖНО: Даже если дата уже активна, нужно АКТИВИРОВАТЬ ВОЛНЫ СРАЗУ
            // и пересчитать currentDay
            if (window.dates && window.dates.recalculateCurrentDay) {
                window.dates.recalculateCurrentDay();
                console.log('AppCore: currentDay пересчитан:', window.appState.currentDay);
            }
            
            // Обновляем DOM элемент currentDay
            this.updateCurrentDayElement();
            
            this.activateWavesForDefaultDate();
        }
    }

    // НОВЫЙ МЕТОД: Активация волн для дефолтной даты
    activateWavesForDefaultDate() {
        console.log('AppCore: активация волн для активной даты...');
        
        if (!window.waves) {
            console.error('AppCore: WavesManager не доступен');
            return;
        }
        
        // 1. Удаляем старые контейнеры волн
        document.querySelectorAll('.wave-container').forEach(c => c.remove());
        window.waves.waveContainers = {};
        window.waves.wavePaths = {};
        
        // 2. Создаем элементы волн ЗАНОВО для активной даты
        // Пересоздаем ВСЕ волны, но с учетом видимости и включенных групп
        window.appState.data.waves.forEach(wave => {
            const waveIdStr = String(wave.id);
            const isWaveVisible = window.appState.waveVisibility[waveIdStr] !== false;
            
            // Проверяем, включена ли хоть одна группа с этой волной
            let isGroupEnabled = false;
            for (const group of window.appState.data.groups) {
                if (group.waves && group.waves.some(wId => String(wId) === waveIdStr)) {
                    if (group.enabled) {
                        isGroupEnabled = true;
                        break;
                    }
                }
            }
            
            // Создаем волну, если она видима и её группа включена
            if (isWaveVisible && isGroupEnabled) {
                window.waves.createWaveElement(wave);
            }
        });
        
        // 3. Обновляем позицию волн относительно текущей даты
        if (window.waves.updatePosition) {
            window.waves.updatePosition();
        }
        
        // 4. Обновляем цвета угловых квадратов
        if (window.waves.updateCornerSquareColors) {
            window.waves.updateCornerSquareColors();
        }
        
        console.log('AppCore: волны активированы для активной даты');
    }

    // НОВЫЙ МЕТОД: Откат к сегодняшней дате
    fallbackToToday() {
        console.log('AppCore: fallbackToToday - устанавливаем сегодняшнюю дату');
        
        window.appState.baseDate = new Date();
        window.appState.currentDate = new Date();
        window.appState.activeDateId = null;
        
        // ГАРАНТИЯ: Рассчитываем currentDay
        if (window.dates && window.dates.recalculateCurrentDay) {
            window.dates.recalculateCurrentDay();
        } else {
            // Ручной расчет
            const utc1 = Date.UTC(window.appState.baseDate.getFullYear(), 
                                 window.appState.baseDate.getMonth(), 
                                 window.appState.baseDate.getDate());
            const utc2 = Date.UTC(window.appState.currentDate.getFullYear(), 
                                 window.appState.currentDate.getMonth(), 
                                 window.appState.currentDate.getDate());
            window.appState.currentDay = Math.floor((utc2 - utc1) / (1000 * 60 * 60 * 24));
            console.log('currentDay рассчитан вручную:', window.appState.currentDay);
        }
        
        // Обновляем DOM элемент
        this.updateCurrentDayElement();
        
        // Сохраняем
        window.appState.save();
        
        console.log('Установлена сегодняшняя дата как базовая');
        
        this.activateWavesForDefaultDate();
        
        if (window.grid && window.grid.createGrid) {
            window.grid.createGrid();
        }
        if (window.grid && window.grid.updateCenterDate) {
            window.grid.updateCenterDate();
        }
    }

    // НОВЫЙ МЕТОД: Откат к первой дате или сегодняшней
    fallbackToFirstDateOrToday() {
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
            this.fallbackToToday();
        }
    }
    
    // НОВЫЙ МЕТОД: Расчет дней между датами (для fallback)
    getDaysBetweenDates(date1, date2) {
        if (!date1 || !date2) return 0;
        
        try {
            const d1 = new Date(date1);
            const d2 = new Date(date2);
            
            if (isNaN(d1.getTime()) || isNaN(d2.getTime())) {
                return 0;
            }
            
            const utc1 = Date.UTC(d1.getFullYear(), d1.getMonth(), d1.getDate());
            const utc2 = Date.UTC(d2.getFullYear(), d2.getMonth(), d2.getDate());
            return Math.floor((utc2 - utc1) / (1000 * 60 * 60 * 24));
        } catch (error) {
            console.error('Ошибка расчета дней между датами:', error);
            return 0;
        }
    }
    
    // НОВЫЙ МЕТОД: Обновление DOM элемента currentDay
    updateCurrentDayElement() {
        const currentDayElement = document.getElementById('currentDay');
        if (currentDayElement) {
            currentDayElement.textContent = window.appState.currentDay || 0;
            console.log('AppCore: DOM элемент currentDay обновлен:', window.appState.currentDay);
        } else {
            console.warn('AppCore: элемент currentDay не найден в DOM');
        }
    }
}

window.appCore = new AppCore();