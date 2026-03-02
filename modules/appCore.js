
class AppCore {
    constructor() {
        this.elements = {};
        this.cacheElements();
        this.isInitializing = false;
        this.versionStorageKey = 'zaraza_last_versions';
    }
    
    cacheElements() {
        const ids = [
            'warningOverlay', 'acceptWarning', 'browserInfo', 'versionInfo', 'todayInfo',
            'graphContainer', 'graphElement', 'centerDateLabel',
            'dateListForDates', 'wavesList', 'notesList', 'noteInput',
            'dbImportTextarea', 'dbImportProgress', 'dbImportProgressBar',
            'dbImportStatus', 'intersectionResults', 'intersectionStats',
            'warningBox', 'currentDay', 'summaryPanel', 'summaryGroupSelect',
            'summaryStateSelect', 'summaryResults',
            'readParableBtn', 'parableModal', 'parableContent', 'closeParableBtn',
            'dynamicVersionContainer'
        ];
        
        ids.forEach(id => {
            const el = document.getElementById(id);
            if (el) this.elements[id] = el;
        });
    }
    
    async init() {
        if (this.isInitializing) return;
        this.isInitializing = true;
        
        try {
            this.setupEventListeners();
            this.updateCSSVariables();
            this.loadParableText();

            if (window.appState && window.appState.graphHidden) {
                document.body.classList.add('graph-hidden');
            }
            
            // Определяем устройство
            const isMobile = this.isMobileDevice();
            
            if (isMobile) {
                document.body.classList.add('mobile-device');
                this.showMobileWarning();
                return;
            }
            
            // Десктопная версия
            if (window.appState.showStars) {
                document.body.classList.add('stars-mode');
                document.body.classList.remove('names-mode');
            } else {
                document.body.classList.remove('stars-mode');
                document.body.classList.add('names-mode');
            }
            
            const now = new Date();
            const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
            window.appState.currentDate = startOfDay;
            
            await this.initializeAppComponents();
            
            // Показываем десктопную плашку
            this.showDesktopWarning();
            
        } catch (error) {
            console.error('AppCore init error:', error);
            throw error;
        } finally {
            this.isInitializing = false;
        }
    }
    
    async initializeAppComponents() {
        if (window.unifiedListManager && window.unifiedListManager.initTemplates) {
            try {
                await window.unifiedListManager.initTemplates();
            } catch (error) {}
        }
        
        if (window.waves && window.waves.init) {
            await window.waves.init();
        }
        
        if (window.grid && window.grid.createGrid) {
            window.grid.createGrid();
        }
        
        if (window.summaryManager && window.summaryManager.init) {
            window.summaryManager.init();
        }
        
        if (window.dataManager) {
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
        
        this.updateGraphBackground();
        this.setDateTimeInputs();
        
        if (window.dates && window.dates.updateTodayButton) {
            window.dates.updateTodayButton();
        }
        
        // Сохраняем текущие версии после успешной загрузки
        setTimeout(async () => {
            try {
                const versions = await this.loadVersions();
                this.saveCurrentVersions(versions);
            } catch (error) {
                // Игнорируем ошибки сохранения
            }
        }, 1000);
    }
    
    updateGraphBackground() {
        const graphContainer = document.getElementById('graphContainer');
        if (graphContainer) {
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
    }
    
    setDateTimeInputs() {
        const mainDateInputDate = document.getElementById('mainDateInputDate');
        const mainDateInputTime = document.getElementById('mainDateInputTime');
        
        if (mainDateInputDate && mainDateInputTime && window.timeUtils) {
            const formatted = window.timeUtils.formatForDateTimeInputs(window.appState.currentDate);
            mainDateInputDate.value = formatted.date;
            mainDateInputTime.value = formatted.time;
        }
    }

    // НОВЫЙ МЕТОД: Загрузка всех версий из одного JSON файла
    async loadVersions() {
        try {
            const timestamp = new Date().getTime();
            const response = await fetch(`versions.json?t=${timestamp}`);
            if (response.ok) {
                return await response.json();
            }
            return [];
        } catch (error) {
            console.error('Error loading versions:', error);
            return [];
        }
    }

    showDesktopWarning() {
        const warningOverlay = document.getElementById('warningOverlay');
        const warningBox = document.querySelector('.warning-box');
        
        if (!warningOverlay || !warningBox) return;
        
        // Показываем overlay
        warningOverlay.classList.add('desktop-warning');
        document.body.style.overflow = 'hidden';
        
        // Показываем плашку
        warningBox.classList.remove('hidden');
        
        // Заполняем информацию
        this.fillWarningInfo(warningBox);
        
        // Показываем кнопки притчи
        const readParableBtn = document.getElementById('readParableBtn');
        if (readParableBtn) {
            readParableBtn.style.display = 'inline-block';
        }
    }
    
    showMobileWarning() {
        const warningOverlay = document.getElementById('warningOverlay');
        const warningBox = document.querySelector('.warning-box');
        
        if (!warningOverlay || !warningBox) return;
        
        // Скрываем основной интерфейс
        document.querySelectorAll('.interface-container, .corner-square').forEach(el => {
            el.style.display = 'none';
        });
        
        // Показываем overlay с мобильным стилем
        warningOverlay.classList.add('mobile-warning-overlay');
        document.body.style.overflow = 'hidden';
        
        // Показываем плашку
        warningBox.classList.remove('hidden');
        warningBox.classList.add('mobile-warning-box');
        
        // Обновляем содержимое для мобильной версии
        this.updateMobileWarningContent(warningBox);
        
        // Скрываем ненужные кнопки
        const acceptButtons = warningBox.querySelectorAll('[data-action="acceptWarning"]');
        acceptButtons.forEach(btn => {
            btn.style.display = 'none';
        });
        
        const parableButton = document.getElementById('readParableBtn');
        if (parableButton) {
            parableButton.style.display = 'none';
        }
    }
    
    // Загружаем сохраненные версии
    getLastVersions() {
        try {
            const saved = localStorage.getItem(this.versionStorageKey);
            return saved ? JSON.parse(saved) : {};
        } catch (error) {
            return {};
        }
    }
    
    // ОБНОВЛЕННЫЙ МЕТОД: Сохранение версий
    saveCurrentVersions(versions) {
        try {
            const versionsObj = {
                timestamp: new Date().getTime(),
                browser: this.getBrowserInfo()
            };
            
            versions.forEach(entry => {
                versionsObj[entry.id] = entry.content;
            });
            
            localStorage.setItem(this.versionStorageKey, JSON.stringify(versionsObj));
        } catch (error) {
            // Игнорируем ошибки сохранения
        }
    }
    
    // Проверяем, изменилась ли версия
    isVersionChanged(id, currentValue) {
        const lastVersions = this.getLastVersions();
        const lastValue = lastVersions[id];
        
        // Если нет сохраненной версии - не выделяем
        if (!lastValue) return false;
        
        // Сравниваем строки
        return currentValue !== lastValue && 
               currentValue !== 'неизвестно' && 
               !currentValue.includes('ошибка');
    }
    
    // ОБНОВЛЕННЫЙ МЕТОД: Заполнение информации в предупреждении
    async fillWarningInfo(warningBox) {
        // Информация о браузере
        const browserInfoEl = warningBox.querySelector('#browserInfo');
        if (browserInfoEl) {
            const browserInfo = this.getBrowserInfo();
            browserInfoEl.textContent = browserInfo;
            
            // Проверяем изменения браузера
            const lastVersions = this.getLastVersions();
            if (lastVersions.browser && browserInfo !== lastVersions.browser) {
                browserInfoEl.style.fontWeight = '700';
                browserInfoEl.style.color = '#000000';
            }
        }

        // Текущее время
        const todayInfoEl = warningBox.querySelector('#todayInfo');
        if (todayInfoEl) {
            const today = new Date();
            todayInfoEl.textContent = window.timeUtils.formatDateTime(today);
            todayInfoEl.style.fontWeight = '400';
            todayInfoEl.style.color = '#666';
        }

        // Загружаем версии из JSON
        const versions = await this.loadVersions();
        
        // Получаем контейнер для динамических элементов
        const container = warningBox.querySelector('#dynamicVersionContainer');
        if (!container) return;

        // Находим элемент "Сейчас" (последний дочерний элемент)
        const items = container.querySelectorAll('.warning-info-item');
        const todayItem = items[items.length - 1];
        const browserItem = items[0];
        
        // Удаляем все старые динамические элементы (все кроме браузера и "сейчас")
        for (let i = items.length - 1; i >= 0; i--) {
            if (items[i] !== todayItem && items[i] !== browserItem) {
                items[i].remove();
            }
        }

        // Создаем элементы для каждой записи из JSON
        versions.forEach(entry => {
            const item = document.createElement('div');
            item.className = 'warning-info-item';
            item.dataset.versionId = entry.id;
            
            const titleSpan = document.createElement('strong');
            titleSpan.textContent = entry.title;
            
            const separatorSpan = document.createElement('span');
            separatorSpan.style.flex = '1';
            separatorSpan.style.borderBottom = '1px dotted';
            separatorSpan.style.alignSelf = 'stretch';
            
            const valueSpan = document.createElement('span');
            valueSpan.className = 'version-value';
            
            // Автоматически определяем многострочность по наличию \n
            if (entry.content && entry.content.includes('\n')) {
                valueSpan.innerHTML = entry.content.replace(/\n/g, '<br>');
                valueSpan.style.whiteSpace = 'pre-wrap';
                valueSpan.style.textAlign = 'left';
            } else {
                valueSpan.textContent = entry.content || 'неизвестно';
            }
            
            // Проверяем изменения
            if (this.isVersionChanged(entry.id, entry.content)) {
                valueSpan.style.fontWeight = '700';
                valueSpan.style.color = '#000000';
            }
            
            item.appendChild(titleSpan);
            item.appendChild(separatorSpan);
            item.appendChild(valueSpan);
            
            // Вставляем перед элементом "Сейчас"
            container.insertBefore(item, todayItem);
        });

        // Сохраняем версии для будущих проверок
        this.saveCurrentVersions(versions);
    }

    updateMobileWarningContent(warningBox) {
        const warningTitle = warningBox.querySelector('.warning-title');
        if (warningTitle) {
            warningTitle.textContent = 'НЕДОСТУПНО НА МОБИЛЬНЫХ УСТРОЙСТВАХ';
            warningTitle.style.color = '#000000';
        }
        
        // Заполняем информацию
        const browserInfoEl = warningBox.querySelector('#browserInfo');
        if (browserInfoEl) {
            browserInfoEl.textContent = `Мобильное устройство (${this.getMobileDeviceType()})`;
        }
        
        // Текущее время
        const todayInfoEl = warningBox.querySelector('#todayInfo');
        if (todayInfoEl) {
            const today = new Date();
            todayInfoEl.textContent = window.timeUtils.formatDateTime(today);
            todayInfoEl.style.fontWeight = '700';
            todayInfoEl.style.color = '#000000';
        }
        
        // Показываем информацию о системе
        const warningInfo = warningBox.querySelector('.warning-info');
        if (warningInfo) {
            warningInfo.style.display = 'flex';
        }
        
        // Загружаем версии для мобильной версии
        this.loadVersions().then(versions => {
            const container = warningBox.querySelector('#dynamicVersionContainer');
            if (!container) return;
            
            const items = container.querySelectorAll('.warning-info-item');
            const todayItem = items[items.length - 1];
            const browserItem = items[0];
            
            // Удаляем старые динамические элементы
            for (let i = items.length - 1; i >= 0; i--) {
                if (items[i] !== todayItem && items[i] !== browserItem) {
                    items[i].remove();
                }
            }
            
            // Добавляем новые элементы
            versions.forEach(entry => {
                const item = document.createElement('div');
                item.className = 'warning-info-item';
                
                const titleSpan = document.createElement('strong');
                titleSpan.textContent = entry.title;
                
                const separatorSpan = document.createElement('span');
                separatorSpan.style.flex = '1';
                separatorSpan.style.borderBottom = '1px dotted';
                separatorSpan.style.alignSelf = 'stretch';
                
                const valueSpan = document.createElement('span');
                
                if (entry.content && entry.content.includes('\n')) {
                    valueSpan.innerHTML = entry.content.replace(/\n/g, '<br>');
                    valueSpan.style.whiteSpace = 'pre-wrap';
                } else {
                    valueSpan.textContent = entry.content || 'неизвестно';
                }
                
                // На мобильных выделяем все поля жирным
                valueSpan.style.fontWeight = '700';
                valueSpan.style.color = '#000000';
                
                item.appendChild(titleSpan);
                item.appendChild(separatorSpan);
                item.appendChild(valueSpan);
                
                container.insertBefore(item, todayItem);
            });
        });
        
        // Добавляем кнопку проверки
        this.addMobileRetryButton(warningBox);
    }
    
    addMobileRetryButton(warningBox) {
        const oldButton = warningBox.querySelector('.mobile-retry-btn');
        if (oldButton) {
            oldButton.remove();
        }
        
        const retryButton = document.createElement('button');
        retryButton.className = 'ui-btn mobile-retry-btn';
        retryButton.textContent = 'Проверить снова (если вы на компьютере)';
        retryButton.style.marginTop = '20px';
        retryButton.style.backgroundColor = '#666';
        retryButton.style.width = '100%';
        retryButton.style.padding = '12px';
        
        retryButton.addEventListener('click', () => {
            location.reload();
        });
        
        warningBox.appendChild(retryButton);
    }
    
    isMobileDevice() {
        const userAgent = navigator.userAgent.toLowerCase();
        
        const isMobileUserAgent = /mobile|android|iphone|ipad|ipod|windows phone/i.test(userAgent);
        const isTouchDevice = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
        const hasMobileViewport = window.innerWidth <= 768 || 
                                 (window.innerHeight > window.innerWidth && window.innerWidth < 1024);
        const isTablet = /(ipad|tablet|(android(?!.*mobile))|(windows(?!.*phone)(.*touch)))/i.test(userAgent);
        
        return isMobileUserAgent || isTouchDevice || hasMobileViewport || isTablet;
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
        
        // Google Chrome
        if (ua.includes("Chrome") && !ua.includes("Edg")) {
            const match = ua.match(/Chrome\/([\d.]+)/);
            return match ? `Google Chrome ${match[1]}` : "Google Chrome";
        }
        
        // Microsoft Edge
        if (ua.includes("Edg")) {
            const match = ua.match(/Edg\/([\d.]+)/);
            return match ? `Microsoft Edge ${match[1]}` : "Microsoft Edge";
        }
        
        // Firefox
        if (ua.includes("Firefox")) {
            const match = ua.match(/Firefox\/([\d.]+)/);
            return match ? `Mozilla Firefox ${match[1]}` : "Mozilla Firefox";
        }
        
        // Safari
        if (ua.includes("Safari") && !ua.includes("Chrome")) {
            const match = ua.match(/Version\/([\d.]+)/);
            return match ? `Apple Safari ${match[1]}` : "Apple Safari";
        }
        
        // Opera
        if (ua.includes("Opera") || ua.includes("OPR")) {
            const match = ua.match(/(?:Opera|OPR)\/([\d.]+)/);
            return match ? `Opera ${match[1]}` : "Opera";
        }
        
        // Internet Explorer
        if (ua.includes("MSIE") || ua.includes("Trident")) {
            const match = ua.match(/(?:MSIE |Trident\/.*rv:)([\d.]+)/);
            return match ? `Internet Explorer ${match[1]}` : "Internet Explorer";
        }
        
        // Brave
        if (ua.includes("Brave")) {
            const match = ua.match(/Chrome\/([\d.]+)/);
            return match ? `Brave ${match[1]}` : "Brave";
        }
        
        return "Неизвестный браузер";
    }
    
    updateCSSVariables() {
        document.documentElement.style.setProperty('--gsx', window.appState.config.gridSquaresX);
        document.documentElement.style.setProperty('--gw', window.appState.graphWidth + 'px');
    }
    
    setupEventListeners() {
        const readParableBtn = document.getElementById('readParableBtn');
        if (readParableBtn) {
            readParableBtn.addEventListener('click', () => {
                this.showParableModal();
            });
        }
        
        const closeParableBtn = document.getElementById('closeParableBtn');
        if (closeParableBtn) {
            closeParableBtn.addEventListener('click', () => {
                this.hideParableModal();
            });
        }
        
        document.addEventListener('click', (e) => {
            const target = e.target;
            if (target.matches('[data-action="acceptWarning"]')) {
                const warningOverlay = document.getElementById('warningOverlay');
                const warningBox = document.querySelector('.warning-box');
                if (warningOverlay && warningBox) {
                    warningOverlay.classList.remove('desktop-warning', 'mobile-warning-overlay');
                    warningOverlay.classList.add('hidden');
                    warningBox.classList.add('hidden');
                    document.body.style.overflow = 'auto';
                    document.body.classList.remove('ui-hidden');
                }
                e.preventDefault();
                e.stopPropagation();
            }
        });
        
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
                    
                    if (window.summaryManager && window.summaryManager.refresh) {
                        window.summaryManager.refresh();
                    }
                }
            });
        }
        
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
                        document.getElementById('dbImportTextarea').value = `❌ ОШИБКА ЗАГРУЗКИ БАЗЫ ДАННЫХ\n\nФайл: ${file.name}\nОшибка: ${error.message}`;
                    }
                }
            });
        }
        
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
                    if (this.elements.parableModal && !this.elements.parableModal.classList.contains('hidden')) {
                        this.hideParableModal();
                    }
                    break;
            }
        });
    }
    
    loadParableText() {
        const parableContent = this.elements.parableContent;
        if (!parableContent) return;
        
        const parableBlock = document.querySelector('.aaa-blockquote');
        if (parableBlock) {
            parableContent.innerHTML = parableBlock.innerHTML;
        } else {
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
            document.body.style.overflow = 'hidden';
        }
    }
    
    hideParableModal() {
        const parableModal = this.elements.parableModal;
        if (parableModal) {
            parableModal.classList.add('hidden');
            if (this.elements.warningOverlay.classList.contains('hidden')) {
                document.body.style.overflow = 'auto';
            } else {
                document.body.style.overflow = 'hidden';
            }
        }
    }
}

window.appCore = new AppCore();