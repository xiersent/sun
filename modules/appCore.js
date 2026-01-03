// modules/appCore.js - ПОЛНОСТЬЮ ПЕРЕРАБОТАННЫЙ С UTC
class AppCore {
    constructor() {
        this.elements = {};
        this.isInitialized = false;
        this.initializationPromise = null;
        this.initializationAttempts = 0;
        this.maxInitializationAttempts = 3;
        
        this.cacheElements();
        this.setupGlobalErrorHandlers();
    }
    
    setupGlobalErrorHandlers() {
        // Обработчик необработанных ошибок Promise
        window.addEventListener('unhandledrejection', (event) => {
            console.error('Необработанная ошибка Promise:', event.reason);
            console.error('В стеке:', event.reason?.stack);
        });
        
        // Обработчик глобальных ошибок
        window.addEventListener('error', (event) => {
            console.error('Глобальная ошибка:', event.error);
            console.error('В файле:', event.filename, 'строка:', event.lineno);
        });
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
            'mainDateInput', 'dateInput', 'dateNameInput', 'btnAddDate',
            'btnPrevDay', 'btnNextDay', 'btnToday', 'btnNow', 'btnSetDate'
        ];
        
        ids.forEach(id => {
            const el = document.getElementById(id);
            if (el) this.elements[id] = el;
        });
    }
    
    async init() {
        if (this.isInitialized) {
            console.log('AppCore уже инициализирован');
            return;
        }
        
        if (this.initializationPromise) {
            return this.initializationPromise;
        }
        
        this.initializationPromise = this._initializeApp()
            .then(() => {
                this.isInitialized = true;
                console.log('AppCore: инициализация успешно завершена');
            })
            .catch((error) => {
                console.error('AppCore: критическая ошибка инициализации:', error);
                this.showInitializationError(error);
                throw error;
            });
        
        return this.initializationPromise;
    }
    
    async _initializeApp() {
        console.log('=== AppCore: начата инициализация (UTC режим) ===');
        
        // Проверка критических зависимостей
        this.checkCriticalDependencies();
        
        // Обновляем CSS переменные
        this.updateCSSVariables();
        
        // Загружаем состояние приложения
        if (window.appState && window.appState.load) {
            console.log('AppCore: загрузка состояния приложения...');
            window.appState.load();
        } else {
            console.error('AppCore: appState не найден!');
            throw new Error('Критическая зависимость: appState не загружен');
        }
        
        // Инициализируем основные модули
        await this.initializeCoreModules();
        
        // Настройка обработчиков событий
        this.setupEventListeners();
        
        // Загрузка компонентов приложения
        await this.initializeAppComponents();
        
        // Проверяем мобильное устройство и показываем предупреждение
        this.checkDeviceAndShowWarning();
        
        // Загружаем текст притчи
        this.loadParableText();
        
        // Проверяем согласованность дат
        if (window.timeUtils && window.timeUtils.validateDateConsistency) {
            setTimeout(() => {
                window.timeUtils.validateDateConsistency();
            }, 1000);
        }
        
        console.log('=== AppCore: инициализация завершена ===');
    }
    
    checkCriticalDependencies() {
        const required = ['appState', 'timeUtils', 'dom'];
        const missing = [];
        
        required.forEach(dep => {
            if (!window[dep]) {
                missing.push(dep);
                console.error(`Критическая зависимость отсутствует: ${dep}`);
            }
        });
        
        if (missing.length > 0) {
            throw new Error(`Отсутствуют критические зависимости: ${missing.join(', ')}`);
        }
        
        console.log('Все критические зависимости загружены');
    }
    
    async initializeCoreModules() {
        console.log('AppCore: инициализация основных модулей...');
        
        // Создаем модули, если они еще не созданы
        const modules = [
            { name: 'dates', constructor: DatesManager },
            { name: 'waves', constructor: WavesManager },
            { name: 'grid', constructor: GridManager },
            { name: 'uiManager', constructor: UIManager },
            { name: 'dataManager', constructor: DataManager },
            { name: 'unifiedListManager', constructor: UnifiedListManager },
            { name: 'importExport', constructor: ImportExportManager },
            { name: 'summaryManager', constructor: SummaryManager },
            { name: 'eventManager', constructor: EventManager },
            { name: 'intersectionManager', constructor: WaveIntersectionManager }
        ];
        
        modules.forEach(({ name, constructor }) => {
            if (!window[name] && typeof constructor !== 'undefined') {
                console.log(`Создаем ${name}...`);
                window[name] = new constructor();
            } else if (!window[name]) {
                console.warn(`Конструктор для ${name} не найден`);
            }
        });
        
        // Специальная обработка для unifiedListManager (требует загрузки шаблонов)
        if (window.unifiedListManager && window.unifiedListManager.initTemplates) {
            console.log('Начинаем предварительную загрузку шаблонов...');
            try {
                await window.unifiedListManager.initTemplates();
                console.log('Шаблоны успешно загружены');
            } catch (error) {
                console.error('Ошибка загрузки шаблонов:', error);
            }
        }
    }
    
    async initializeAppComponents() {
        console.log('AppCore: инициализация компонентов приложения...');
        
        // Устанавливаем начальную дату в UTC
        this.initializeUTCDate();
        
        // Инициализируем волны
        if (window.waves && window.waves.init) {
            console.log('Инициализация WavesManager...');
            await window.waves.init();
        }
        
        // Создаем сетку
        if (window.grid && window.grid.createGrid) {
            console.log('Создание сетки...');
            window.grid.createGrid();
        }
        
        // Инициализируем сводную информацию
        if (window.summaryManager && window.summaryManager.init) {
            console.log('Инициализация SummaryManager...');
            window.summaryManager.init();
        }
        
        // Настраиваем UI
        this.setupInitialUIState();
        
        // Рендерим UI с загруженными шаблонами
        await this.renderUIComponents();
        
        // Гарантированная инициализация дат
        this.guaranteedDatesInitialization();
        
        // Обновляем кнопку "Сегодня"
        if (window.dates && window.dates.updateTodayButton) {
            window.dates.updateTodayButton();
        }
        
        console.log('Компоненты приложения инициализированы');
    }
    
    initializeUTCDate() {
        console.log('AppCore: установка начальной даты в UTC...');
        
        if (!window.appState || !window.timeUtils) {
            console.error('Не удалось установить UTC дату: отсутствуют зависимости');
            return;
        }
        
        // Устанавливаем ТОЧНОЕ текущее время в UTC
        window.appState.currentDate = window.timeUtils.nowUTC();
        
        console.log('Начальная дата установлена (UTC):', {
            iso: window.appState.currentDate.toISOString(),
            utcString: window.appState.currentDate.toUTCString(),
            hours: window.appState.currentDate.getUTCHours(),
            minutes: window.appState.currentDate.getUTCMinutes(),
            seconds: window.appState.currentDate.getUTCSeconds()
        });
        
        // Устанавливаем начальное значение в mainDateInput через timeUtils
        const mainDateInput = document.getElementById('mainDateInput');
        if (mainDateInput && window.timeUtils) {
            const formatted = window.timeUtils.formatForDateTimeInputUTC(
                window.appState.currentDate.getTime()
            );
            mainDateInput.value = formatted;
            mainDateInput.placeholder = formatted;
            console.log('mainDateInput установлен на:', formatted);
        }
    }
    
    setupInitialUIState() {
        console.log('AppCore: настройка начального состояния UI...');
        
        // Устанавливаем режим отображения звезд/имен
        if (window.appState.showStars) {
            document.body.classList.add('stars-mode');
            document.body.classList.remove('names-mode');
        } else {
            document.body.classList.remove('stars-mode');
            document.body.classList.add('names-mode');
        }
        
        // Настраиваем график через CSS-классы
        const graphContainer = document.getElementById('graphContainer');
        if (graphContainer) {
            // Темный режим графика
            if (!window.appState.graphBgWhite) {
                graphContainer.classList.add('dark-mode');
            } else {
                graphContainer.classList.remove('dark-mode');
            }
            
            // Серый режим графика
            if (window.appState.graphGrayMode) {
                graphContainer.classList.add('graph-gray-mode');
            } else {
                graphContainer.classList.remove('graph-gray-mode');
            }
            
            console.log('График настроен:', {
                darkMode: graphContainer.classList.contains('dark-mode'),
                grayMode: graphContainer.classList.contains('graph-gray-mode')
            });
        }
        
        // Серый режим всего приложения
        if (window.appState.grayMode) {
            document.body.classList.add('gray-mode');
        } else {
            document.body.classList.remove('gray-mode');
        }
        
        // Угловые квадраты
        const allSquares = document.querySelectorAll('.corner-square');
        allSquares.forEach(square => {
            square.style.display = window.appState.cornerSquaresVisible ? 'block' : 'none';
        });
        
        // Скрытие UI
        if (window.appState.uiHidden) {
            document.body.classList.add('ui-hidden');
        } else {
            document.body.classList.remove('ui-hidden');
        }
        
        // Скрытие графика
        if (window.appState.graphHidden) {
            document.body.classList.add('graph-hidden');
        } else {
            document.body.classList.remove('graph-hidden');
        }
    }
    
    async renderUIComponents() {
        console.log('AppCore: рендеринг UI компонентов...');
        
        if (!window.dataManager) {
            console.warn('DataManager не доступен, пропускаем рендеринг UI');
            return;
        }
        
        try {
            // Рендерим списки с ожиданием загрузки шаблонов
            if (window.dataManager.updateDateList) {
                await window.dataManager.updateDateList();
            }
            
            if (window.dataManager.updateWavesGroups) {
                await window.dataManager.updateWavesGroups();
            }
            
            if (window.dataManager.updateNotesList) {
                window.dataManager.updateNotesList();
            }
            
            console.log('UI компоненты отрендерены');
        } catch (error) {
            console.error('Ошибка рендеринга UI:', error);
        }
    }
    
    guaranteedDatesInitialization() {
        console.log('AppCore: гарантированная инициализация дат...');
        
        if (!window.dates || !window.appState) {
            console.error('Не удалось инициализировать даты: отсутствуют зависимости');
            return;
        }
        
        // Проверяем currentDay
        if (window.appState.currentDay === undefined || 
            window.appState.currentDay === null ||
            typeof window.appState.currentDay !== 'number' ||
            isNaN(window.appState.currentDay)) {
            
            console.warn('currentDay некорректен, исправляем на 0');
            window.appState.currentDay = 0;
            window.appState.save();
        }
        
        // Принудительная инициализация дат
        setTimeout(() => {
            if (window.dates.forceInitialize) {
                console.log('Выполняем forceInitialize...');
                window.dates.forceInitialize();
            } else if (window.dates.recalculateCurrentDay) {
                console.log('Выполняем recalculateCurrentDay...');
                window.dates.recalculateCurrentDay(true);
            }
            
            // Проверяем и обновляем currentDay в DOM
            const currentDayElement = document.getElementById('currentDay');
            if (currentDayElement && window.dom) {
                const formatted = window.dom.formatCurrentDayWithSeconds(window.appState.currentDay);
                currentDayElement.textContent = formatted;
                console.log('DOM элемент currentDay обновлен:', formatted);
            }
        }, 100);
    }
    
    checkDeviceAndShowWarning() {
        console.log('AppCore: проверка устройства...');
        
        const isMobile = this.isMobileDevice();
        
        if (isMobile) {
            // Для мобильных - показываем специальное предупреждение
            this.showMobileWarning();
            document.body.classList.add('mobile-device');
            console.log('Обнаружено мобильное устройство');
        } else {
            // Для десктопов - стандартное предупреждение
            this.showDesktopWarning();
            console.log('Обнаружено десктоп устройство');
        }
    }
    
    isMobileDevice() {
        // Комплексная проверка на мобильное устройство
        const userAgent = navigator.userAgent.toLowerCase();
        
        // Проверка по userAgent
        const isMobileUserAgent = /mobile|android|iphone|ipad|ipod|windows phone/i.test(userAgent);
        
        // Проверка по сенсорному вводу
        const isTouchDevice = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
        
        // Проверка по размеру экрана
        const hasMobileViewport = window.innerWidth <= 768 || 
                                 (window.innerHeight > window.innerWidth && window.innerWidth < 1024);
        
        // Проверка на планшет
        const isTablet = /(ipad|tablet|(android(?!.*mobile))|(windows(?!.*phone)(.*touch)))/i.test(userAgent);
        
        // Если это планшет, считаем его мобильным для нашего приложения
        return isMobileUserAgent || (isTouchDevice && hasMobileViewport) || isTablet;
    }
    
    showMobileWarning() {
        const warningOverlay = document.getElementById('warningOverlay');
        if (!warningOverlay) return;
        
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
        
        // Обновляем содержимое предупреждения
        const warningBox = warningOverlay.querySelector('.warning-box');
        if (warningBox) {
            warningBox.classList.add('mobile-warning-box');
            
            // Обновляем заголовок и текст для мобильных
            const warningTitle = warningBox.querySelector('.warning-title');
            if (warningTitle) {
                warningTitle.textContent = 'НЕДОСТУПНО НА МОБИЛЬНЫХ УСТРОЙСТВАХ';
                warningTitle.style.color = '#ff0000';
                warningTitle.style.fontSize = '18px';
            }
            
            const warningText = warningBox.querySelector('.warning-text');
            if (warningText) {
                warningText.innerHTML = `
                    <p>Это приложение предназначено только для использования на компьютерах.</p>
                    <p>Для работы требуется:</p>
                    <ul>
                        <li>Клавиатура для навигации</li>
                        <li>Мышь для точного взаимодействия</li>
                        <li>Экран с разрешением не менее 1024x768</li>
                    </ul>
                    <p>Пожалуйста, откройте эту страницу на компьютере.</p>
                `;
                warningText.style.textAlign = 'left';
                warningText.style.fontSize = '14px';
            }
            
            // Обновляем информацию
            this.updateWarningInfoForMobile(warningBox);
            
            // Добавляем кнопку для повторной проверки
            this.addMobileRetryButton(warningBox);
        }
    }
    
    updateWarningInfoForMobile(warningBox) {
        // Информация о браузере
        const browserInfoEl = document.getElementById('browserInfo');
        if (browserInfoEl) {
            browserInfoEl.textContent = `Мобильное устройство (${this.getMobileDeviceType()})`;
        }
        
        // Информация о сегодняшней дате
        const todayInfoEl = document.getElementById('todayInfo');
        if (todayInfoEl && window.timeUtils) {
            const today = window.timeUtils.nowUTC();
            const todayFormatted = window.timeUtils.formatDateUTC(today);
            todayInfoEl.textContent = todayFormatted;
        }
        
        // Информация о версии
        const versionInfoEl = document.getElementById('versionInfo');
        if (versionInfoEl) {
            versionInfoEl.textContent = 'Только для ПК';
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
    
    addMobileRetryButton(warningBox) {
        const retryButton = document.createElement('button');
        retryButton.className = 'ui-btn mobile-retry-btn';
        retryButton.textContent = 'Проверить снова (если вы на компьютере)';
        retryButton.style.marginTop = '20px';
        retryButton.style.backgroundColor = '#666';
        retryButton.style.width = '100%';
        retryButton.style.padding = '12px';
        
        retryButton.addEventListener('click', () => {
            console.log('Пользователь запросил повторную проверку устройства');
            location.reload();
        });
        
        warningBox.appendChild(retryButton);
    }
    
    showDesktopWarning() {
        const warningOverlay = document.getElementById('warningOverlay');
        if (!warningOverlay) return;
        
        warningOverlay.classList.remove('hidden');
        warningOverlay.classList.add('desktop-warning');
        document.body.style.overflow = 'hidden';
        
        // Загружаем информацию для десктопов
        this.updateWarningInfoForDesktop();
    }
    
    updateWarningInfoForDesktop() {
        // 1. Информация о браузере - сразу
        const browserInfoEl = document.getElementById('browserInfo');
        if (browserInfoEl) {
            browserInfoEl.textContent = this.getBrowserInfo();
        }
        
        // 2. Информация о сегодняшней дате - сразу
        const todayInfoEl = document.getElementById('todayInfo');
        if (todayInfoEl && window.timeUtils) {
            const today = window.timeUtils.nowUTC();
            const todayFormatted = window.timeUtils.formatDateUTC(today);
            todayInfoEl.textContent = todayFormatted;
        }
        
        // 3. Версия приложения - асинхронно
        const versionInfoEl = document.getElementById('versionInfo');
        if (versionInfoEl) {
            versionInfoEl.textContent = 'Загрузка...';
            
            this.getVersion()
                .then(version => {
                    versionInfoEl.textContent = version || 'неизвестно';
                })
                .catch(error => {
                    console.error('Ошибка загрузки версии:', error);
                    versionInfoEl.textContent = 'неизвестно';
                });
        }
    }
    
    async getVersion() {
        try {
            const response = await fetch('version.txt');
            if (response.ok) {
                const text = await response.text();
                return text.trim();
            }
            return '(файл не найден)';
        } catch (error) {
            console.error('Ошибка загрузки версии:', error);
            return '(ошибка загрузки)';
        }
    }
    
    getBrowserInfo() {
        const ua = navigator.userAgent;
        if (ua.includes("Chrome") && !ua.includes("Edg")) return "Google Chrome";
        if (ua.includes("Firefox")) return "Mozilla Firefox";
        if (ua.includes("Safari") && !ua.includes("Chrome")) return "Apple Safari";
        if (ua.includes("Edg")) return "Microsoft Edge";
        if (ua.includes("Opera") || ua.includes("OPR")) return "Opera";
        return "Неизвестный браузер";
    }
    
    updateCSSVariables() {
        if (window.appState && window.appState.config) {
            document.documentElement.style.setProperty('--gsx', window.appState.config.gridSquaresX);
            document.documentElement.style.setProperty('--gw', window.appState.graphWidth + 'px');
            console.log('CSS переменные обновлены');
        }
    }
    
    setupEventListeners() {
        console.log('AppCore: настройка обработчиков событий...');
        
        // Обработчик для кнопки "прочесть притчу"
        const readParableBtn = document.getElementById('readParableBtn');
        if (readParableBtn) {
            readParableBtn.addEventListener('click', () => {
                this.showParableModal();
            });
        }
        
        // Обработчик для кнопки закрытия притчи
        const closeParableBtn = document.getElementById('closeParableBtn');
        if (closeParableBtn) {
            closeParableBtn.addEventListener('click', () => {
                this.hideParableModal();
            });
        }
        
        // Обработчик для кнопки "Согласиться и продолжить"
        const acceptWarningBtn = document.getElementById('acceptWarning');
        if (acceptWarningBtn) {
            acceptWarningBtn.addEventListener('click', () => {
                const warningOverlay = document.getElementById('warningOverlay');
                if (warningOverlay) {
                    warningOverlay.classList.add('hidden');
                    document.body.style.overflow = 'auto';
                    console.log('Пользователь принял предупреждение');
                }
            });
        }
        
        // Глобальный обработчик клавиатуры
        document.addEventListener('keydown', (e) => {
            this.handleGlobalKeydown(e);
        });
        
        // Обработчик закрытия притчи по клику вне модального окна
        document.addEventListener('click', (e) => {
            const parableModal = document.getElementById('parableModal');
            if (parableModal && 
                !parableModal.classList.contains('hidden') && 
                e.target === parableModal) {
                this.hideParableModal();
            }
        });
        
        console.log('Обработчики событий настроены');
    }
    
    handleGlobalKeydown(e) {
        // Закрыть модальное окно притчи при нажатии ESC
        if (e.key === 'Escape') {
            const parableModal = document.getElementById('parableModal');
            if (parableModal && !parableModal.classList.contains('hidden')) {
                this.hideParableModal();
                e.preventDefault();
            }
        }
        
        // Навигация по дням стрелками (только если нет открытых модальных окон)
        if (!document.getElementById('parableModal')?.classList.contains('hidden')) {
            return; // Не обрабатываем навигацию, если открыта притча
        }
        
        if (!document.getElementById('warningOverlay')?.classList.contains('hidden')) {
            return; // Не обрабатываем навигацию, если открыто предупреждение
        }
        
        if (window.dates) {
            switch(e.key) {
                case 'ArrowLeft':
                    window.dates.navigateDay(-1);
                    e.preventDefault();
                    break;
                case 'ArrowRight':
                    window.dates.navigateDay(1);
                    e.preventDefault();
                    break;
                case 'Home':
                    window.dates.goToToday();
                    e.preventDefault();
                    break;
                case 'End':
                    window.dates.goToNow();
                    e.preventDefault();
                    break;
            }
        }
    }
    
    // ================ МЕТОДЫ ДЛЯ РАБОТЫ С ПРИТЧЕЙ ================
    
    loadParableText() {
        const parableContent = this.elements.parableContent;
        if (!parableContent) return;
        
        // Берем текст притчи из начала страницы (блок .aaa-blockquote)
        const parableBlock = document.querySelector('.aaa-blockquote');
        if (parableBlock) {
            parableContent.innerHTML = parableBlock.innerHTML;
            console.log('Текст притчи загружен из .aaa-blockquote');
        } else {
            // Если блок не найден, используем запасной текст
            parableContent.innerHTML = `
                <p>Говорят, когда-то одну девушку обвинили в ведовстве. В качестве наказания её отвезли на островок на озере – клочок каменистой почвы, где не было ни еды, ни укрытий. Её приговорили к мучительной медленной смерти от холода и голода.</p>
                <p>Вот только не знали в городе, что один юноша, увидев её глаза, прекрасные и сверкающие, подобно луне в летнюю ночь, поклялся ей в вечной любви. Когда ей вынесли приговор – по его мнению, несправедливый – он дал обет уберечь её от гибели. Выжидая удобного дня для совместного побега, он каждую ночь втайне переплывал озеро на лодке с едой и тёплой одеждой. А она каждую ночь вставала у воды и зажигала свечу, чтобы указать ему путь.</p>
                <p>Как-то раз, в поразительно ясную ночь, когда на небе не было ни облачка, юноша, как всегда, отчалил от берега. Он внимательно вглядывался в темноту, выискивая огонёк, который приведёт его к любимой. Однако в ту ночь луна светила до того ярко, что затмила бы собой любую свечу. Отражение луны в воде сбило юношу с пути. Он грёб, грёб и грёб к свету, всё надеясь, что вот-вот доплывёт. Иллюзорный отсвет луны до того заворожил его, что он не замечал ни ноющих рук, ни сбившегося дыхания... Когда лодка перевернулась, он был уже так измотан греблей, так ослабли его руки, что до берега он не добрался. Он упокоился в озере.</p>
                <p>Оставшись одна, девушка всё же не теряла надежды. Каждую ночь она выходила к воде и зажигала свечу. Говорят, и по сей день те, кто ищут истинную любовь, видят на озере свечу Светоносной девы, что надеется указать дорогу любимому.</p>
            `;
            console.log('Текст притчи загружен из резервного источника');
        }
    }
    
    showParableModal() {
        const parableModal = this.elements.parableModal;
        if (parableModal) {
            parableModal.classList.remove('hidden');
            // Блокируем прокрутку основного содержимого
            document.body.style.overflow = 'hidden';
            console.log('Модальное окно притчи открыто');
        }
    }
    
    hideParableModal() {
        const parableModal = this.elements.parableModal;
        if (parableModal) {
            parableModal.classList.add('hidden');
            // Восстанавливаем прокрутку
            const warningOverlay = document.getElementById('warningOverlay');
            if (!warningOverlay || warningOverlay.classList.contains('hidden')) {
                document.body.style.overflow = 'auto';
            }
            console.log('Модальное окно притчи закрыто');
        }
    }
    
    // ================ МЕТОДЫ ДЛЯ ОТЛАДКИ ================
    
    showInitializationError(error) {
        console.error('Критическая ошибка инициализации:', error);
        
        // Показываем сообщение об ошибке пользователю
        const errorMessage = `
            <div style="
                position: fixed;
                top: 0;
                left: 0;
                right: 0;
                bottom: 0;
                background: rgba(0,0,0,0.8);
                color: white;
                display: flex;
                flex-direction: column;
                align-items: center;
                justify-content: center;
                z-index: 99999;
                padding: 20px;
                text-align: center;
                font-family: sans-serif;
            ">
                <h1 style="color: #ff4444; margin-bottom: 20px;">Ошибка загрузки приложения</h1>
                <p style="margin-bottom: 20px; max-width: 600px;">
                    Не удалось загрузить приложение. Возможно, некоторые файлы повреждены или отсутствуют.
                </p>
                <p style="margin-bottom: 30px; font-family: monospace; background: rgba(255,255,255,0.1); padding: 10px; border-radius: 5px;">
                    ${error.message || 'Неизвестная ошибка'}
                </p>
                <button onclick="location.reload()" style="
                    padding: 10px 20px;
                    background: #4CAF50;
                    color: white;
                    border: none;
                    border-radius: 5px;
                    cursor: pointer;
                    font-size: 16px;
                ">
                    Перезагрузить страницу
                </button>
                <p style="margin-top: 30px; font-size: 12px; opacity: 0.7;">
                    Если ошибка повторяется, попробуйте очистить кэш браузера (Ctrl+Shift+Del)
                </p>
            </div>
        `;
        
        document.body.insertAdjacentHTML('beforeend', errorMessage);
    }
    
    // ================ УТИЛИТЫ ================
    
    /**
     * Пересоздает все визуальные элементы
     * Используется при серьезных изменениях состояния
     */
    recreateVisualElements() {
        console.log('AppCore: пересоздание визуальных элементов...');
        
        if (window.grid && window.grid.createGrid) {
            window.grid.createGrid();
        }
        
        if (window.waves) {
            // Удаляем старые элементы волн
            document.querySelectorAll('.wave-container').forEach(c => c.remove());
            if (window.waves.waveContainers) {
                window.waves.waveContainers = {};
            }
            if (window.waves.wavePaths) {
                window.waves.wavePaths = {};
            }
            
            // Создаем заново
            if (window.waves.createVisibleWaveElements) {
                window.waves.createVisibleWaveElements();
            }
            
            if (window.waves.updatePosition) {
                window.waves.updatePosition();
            }
        }
        
        if (window.grid && window.grid.updateCenterDate) {
            window.grid.updateCenterDate();
        }
        
        console.log('Визуальные элементы пересозданы');
    }
    
    /**
     * Принудительное сохранение состояния
     */
    forceSave() {
        if (window.appState && window.appState.save) {
            window.appState.save();
            console.log('Состояние принудительно сохранено');
        }
    }
    
    /**
     * Сброс приложения к начальному состоянию
     * Используется для отладки
     */
    debugReset() {
        if (!confirm('ВНИМАНИЕ: Это сбросит все настройки к начальным значениям. Продолжить?')) {
            return;
        }
        
        if (window.appState && window.appState.reset) {
            window.appState.reset();
            console.log('Приложение сброшено к начальному состоянию');
            
            // Перезагружаем страницу
            setTimeout(() => {
                location.reload();
            }, 1000);
        }
    }
}

// Глобальные дебаг функции
window.debugAppCore = function() {
    console.log('=== ДЕБАГ AppCore ===');
    console.log('Состояние инициализации:', window.appCore?.isInitialized);
    console.log('Текущая дата (UTC):', window.appState?.currentDate?.toISOString());
    console.log('Текущий день:', window.appState?.currentDay);
    console.log('Base date (UTC):', new Date(window.appState?.baseDate || 0).toISOString());
    console.log('Активная дата ID:', window.appState?.activeDateId);
    
    // Проверка модулей
    const modules = ['dates', 'waves', 'grid', 'uiManager', 'dataManager', 'unifiedListManager'];
    modules.forEach(module => {
        console.log(`${module}:`, window[module] ? '✓ Загружен' : '✗ Отсутствует');
    });
    
    // Проверка контейнеров
    const containers = ['graphElement', 'dateListForDates', 'wavesList', 'notesList'];
    containers.forEach(id => {
        const el = document.getElementById(id);
        console.log(`${id}:`, el ? '✓ Найден' : '✗ Не найден');
    });
    
    console.log('=== КОНЕЦ ДЕБАГА ===');
};

window.reinitializeApp = function() {
    console.log('Принудительная реинициализация приложения...');
    
    if (window.appCore && window.appCore.recreateVisualElements) {
        window.appCore.recreateVisualElements();
    } else {
        console.warn('AppCore не доступен для реинициализации');
    }
};

// Создаем экземпляр AppCore
window.appCore = new AppCore();

// Автоматический запуск инициализации при загрузке страницы
document.addEventListener('DOMContentLoaded', () => {
    console.log('DOM загружен, запускаем инициализацию AppCore...');
    
    // Небольшая задержка для гарантии загрузки всех зависимостей
    setTimeout(() => {
        if (window.appCore && window.appCore.init) {
            window.appCore.init()
                .then(() => {
                    console.log('AppCore успешно инициализирован');
                })
                .catch((error) => {
                    console.error('Не удалось инициализировать AppCore:', error);
                });
        } else {
            console.error('AppCore не найден или не имеет метода init');
        }
    }, 100);
});