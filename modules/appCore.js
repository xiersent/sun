/**
 * @file appCore.js
 * Ядро приложения: инициализация, предупреждения, DOM-кэш, обработчики UI.
 */
class AppCore {
    constructor() {
        this.elements = {};
        this.cacheElements();
        this.isInitializing = false;
        this.versionStorageKey = 'zaraza_last_versions';
        this.defaultCornerColor = '#ff0000'; // Красный по умолчанию
        this.hasSelectedColor = false; // Флаг, был ли выбран цвет
        /** true после initializeAppComponents (десктоп); для init.js — не дублировать списки в finalize */
        this._listsHydratedOnInit = false;
        /** Один in-flight запрос versions.json на сессию */
        this._loadVersionsPromise = null;
    }
    
    /** Кэширует основные DOM-элементы приложения по id. */
    cacheElements() {
        const ids = [
            'warningOverlay', 'browserInfo', 'versionInfo', 'todayInfo',
            'graphContainer', 'graphElement', 'wavesTransformLayer', 'wavesMount', 'centerDateLabel',
            'dateListForDates', 'wavesList',
            'dbImportTextarea', 'dbImportProgress', 'dbImportProgressBar',
            'dbImportStatus', 'intersectionResults', 'intersectionStats',
            'warningBox', 'currentDay', 'summaryPanel', 'summaryGroupSelect',
            'summaryStateSelect', 'summaryResults',
            'colorPickerBtn', 'hiddenColorPicker',
            'dynamicVersionContainer'
        ];
        
        ids.forEach(id => {
            const el = window.dom.byKey(id);
            if (el) this.elements[id] = el;
        });
    }
    
    /** Главная инициализация: мобильная проверка, компоненты, предупреждение. */
    async init() {
        if (this.isInitializing) return;
        this.isInitializing = true;

        const __lp = typeof window !== 'undefined' ? window.__loadPerf : null;
        __lp && __lp.mark('appCore_init_enter');

        try {
            this.setupEventListeners();
            this.updateCSSVariables();

            if (window.appState && window.appState.graphHidden && window.appClassSync) {
                window.appClassSync.applyGraphHidden(true);
            }

            const isMobile = this.isMobileDevice();

            if (isMobile) {
                __lp && __lp.mark('appCore_init_mobile_early_exit');
                this._listsHydratedOnInit = false;
                if (window.appClassSync) {
                    window.appClassSync.applyMobileDevice(true);
                }
                this.showMobileWarning();
                return;
            }

            if (window.appClassSync) {
                window.appClassSync.syncFromAppState();
            }

            const now = new Date();
            const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
            window.appState.currentDate = startOfDay;

            __lp && __lp.phaseStart('appCore_initializeAppComponents');
            await this.initializeAppComponents();
            __lp && __lp.phaseEnd('appCore_initializeAppComponents');
            this._listsHydratedOnInit = true;

            // Показываем предупреждение при загрузке
            this.showDesktopWarning();
            __lp && __lp.mark('appCore_init_done');
        } catch (error) {
            __lp && __lp.mark('appCore_init_error', { message: error && error.message });
            console.error('AppCore init error:', error);
            throw error;
        } finally {
            this.isInitializing = false;
        }
    }
    
    /** Последовательно инициализирует волны, сетку, списки и сводку. */
    async initializeAppComponents() {
        const __lp = typeof window !== 'undefined' ? window.__loadPerf : null;

        if (window.unifiedListManager && window.unifiedListManager.initTemplates) {
            __lp && __lp.phaseStart('appCore_initTemplates');
            try {
                await window.unifiedListManager.initTemplates();
            } catch (error) {}
            __lp && __lp.phaseEnd('appCore_initTemplates');
        }

        if (window.waves && window.waves.init) {
            __lp && __lp.phaseStart('appCore_waves_init');
            await window.waves.init();
            __lp && __lp.phaseEnd('appCore_waves_init');
        }

        if (window.wavesTransformLayer && window.wavesTransformLayer.applyFromAppState) {
            window.wavesTransformLayer.applyFromAppState();
        }

        if (window.grid && window.grid.createGrid) {
            __lp && __lp.phaseStart('appCore_createGrid');
            window.grid.createGrid();
            __lp && __lp.phaseEnd('appCore_createGrid');
        }

        if (window.summaryManager && window.summaryManager.init) {
            __lp && __lp.phaseStart('appCore_summaryManager_init');
            window.summaryManager.init();
            __lp && __lp.phaseEnd('appCore_summaryManager_init');
        }

        if (window.dataManager) {
            if (window.dataManager.updateDateList) {
                __lp && __lp.phaseStart('appCore_dataManager_updateDateList');
                await window.dataManager.updateDateList();
                __lp && __lp.phaseEnd('appCore_dataManager_updateDateList');
            }

            if (window.dataManager.updateWavesGroups) {
                __lp && __lp.phaseStart('appCore_dataManager_updateWavesGroups');
                await window.dataManager.updateWavesGroups();
                __lp && __lp.phaseEnd('appCore_dataManager_updateWavesGroups');
            }
        }

        this.updateGraphBackground();
        this.setDateTimeInputs();

        if (window.dates && window.dates.updateTodayButton) {
            window.dates.updateTodayButton();
        }

        // Восстанавливаем сохраненный цвет квадратиков
        this.restoreCornerColor();

        queueMicrotask(async () => {
            try {
                const versions = await this.loadVersions();
                this.saveCurrentVersions(versions);
            } catch (error) {}
        });
    }
    
    /** Сохраняет цвет угловых квадратиков в localStorage. */
    saveCornerColor(color) {
        localStorage.setItem('corner_square_color', color);
        this.hasSelectedColor = true;
    }

    /** Базовый цвет углов: выбранный при первом запуске или красный по умолчанию. */
    getBaseCornerColor() {
        try {
            const saved = localStorage.getItem('corner_square_color');
            if (saved) {
                return saved;
            }
        } catch {
            /* ignore */
        }
        return this.defaultCornerColor;
    }

    /** Пользователь уже выбирал цвет на первом запуске (ключ в localStorage). */
    hasUserSelectedCornerColor() {
        try {
            return localStorage.getItem('corner_square_color') != null;
        } catch {
            return false;
        }
    }

    /** Применяет цвет ко всем угловым квадратикам. */
    applyCornerSquareColor(color) {
        document.querySelectorAll('.sun-cornerSquare').forEach((square) => {
            square.style.backgroundColor = color;
        });
    }

    /** Восстанавливает сохранённый цвет угловых квадратиков. */
    restoreCornerColor() {
        this.applyCornerSquareColor(this.getBaseCornerColor());
        this.hasSelectedColor = this.hasUserSelectedCornerColor();
    }
    
    // Сбрасывает цвет квадратиков в красный
    /** Сбрасывает цвет угловых квадратиков на красный по умолчанию. */
    resetCornerColor() {
        this.applyCornerSquareColor(this.defaultCornerColor);
        localStorage.removeItem('corner_square_color');
        this.hasSelectedColor = false;
    }
    
    // Закрывает предупреждение
    /** Закрывает оверлей предупреждения при старте. */
    closeWarning() {
        const warningOverlay = window.dom.byKey('warningOverlay');
        const warningBox = document.querySelector('.sun-warningBox');
        if (warningOverlay && warningBox) {
            warningOverlay.classList.remove('sun-mobileWarningOverlay');
            warningBox.classList.remove('sun-mobileWarningBox');
            warningOverlay.classList.add('sun-hidden');
            warningBox.classList.add('sun-hidden');
            document.body.style.overflow = 'auto';
            if (window.appClassSync) {
                window.appClassSync.applyUiHidden(false);
            }
        }
    }
    
    /** Применяет классы фона graphContainer (серый режим). */
    updateGraphBackground() {
        if (window.appClassSync && window.appState) {
            window.appClassSync.applyGraphGrayMode(!!window.appState.graphGrayMode);
        }
    }
    
    /** Заполняет поля mainDateInputDate/Time из appState.currentDate. */
    setDateTimeInputs() {
        const mainDateInputDate = window.dom.byKey('mainDateInputDate');
        const mainDateInputTime = window.dom.byKey('mainDateInputTime');
        
        if (mainDateInputDate && mainDateInputTime && window.timeUtils) {
            const formatted = window.timeUtils.formatForDateTimeInputs(window.appState.currentDate);
            mainDateInputDate.value = formatted.date;
            mainDateInputTime.value = formatted.time;
        }
    }

    /** Загружает versions.json для блока информации в предупреждении. */
    async loadVersions() {
        if (this._loadVersionsPromise) {
            return this._loadVersionsPromise;
        }
        this._loadVersionsPromise = (async () => {
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
        })();
        return this._loadVersionsPromise;
    }

    /** Показывает десктопное предупреждение с данными окружения. */
    showDesktopWarning() {
        const warningOverlay = window.dom.byKey('warningOverlay');
        const warningBox = document.querySelector('.sun-warningBox');
        
        if (!warningOverlay || !warningBox) return;
        
        // Всегда показываем предупреждение
        warningOverlay.classList.remove('sun-hidden');
        document.body.style.overflow = 'hidden';
        
        warningBox.classList.remove('sun-hidden');
        
        const desktopNotice = warningBox.querySelector('.sun-desktopNotice');
        if (desktopNotice) {
            const isDesktopApp = !!(window.__TAURI_INTERNALS__ || window.__TAURI__);
            desktopNotice.classList.toggle('sun-hidden', isDesktopApp);
        }
        
        // Заполняем информацию
        this.fillWarningInfo(warningBox);
    }
    
    /** Блокирует UI на мобильных и показывает предупреждение. */
    showMobileWarning() {
        const warningOverlay = window.dom.byKey('warningOverlay');
        const warningBox = document.querySelector('.sun-warningBox');
        
        if (!warningOverlay || !warningBox) return;
        
        document.querySelectorAll('.sun-interfaceContainer, .sun-cornerSquare').forEach(el => {
            el.style.display = 'none';
        });
        
        warningOverlay.classList.add('sun-mobileWarningOverlay');
        document.body.style.overflow = 'hidden';
        
        warningBox.classList.remove('sun-hidden');
        warningBox.classList.add('sun-mobileWarningBox');
        
        this.updateMobileWarningContent(warningBox);
        
        const colorPickerBtn = window.dom.byKey('colorPickerBtn');
        if (colorPickerBtn) {
            colorPickerBtn.style.display = 'none';
        }
    }
    
    /** Читает последние сохранённые версии компонентов из localStorage. */
    getLastVersions() {
        try {
            const saved = localStorage.getItem(this.versionStorageKey);
            return saved ? JSON.parse(saved) : {};
        } catch (error) {
            return {};
        }
    }
    
    /** Сохраняет снимок versions.json и сведения о браузере/ОС. */
    saveCurrentVersions(versions) {
        try {
            const versionsObj = {
                timestamp: new Date().getTime(),
                browser: this.getBrowserInfo(),
                os: this.getOSInfo()
            };
            
            versions.forEach(entry => {
                versionsObj[entry.id] = entry.content;
            });
            
            localStorage.setItem(this.versionStorageKey, JSON.stringify(versionsObj));
        } catch (error) {}
    }
    
    /** Запись «версия от» из versions.json. */
    _getVersionFromEntry(versions) {
        if (!Array.isArray(versions)) {
            return null;
        }
        return versions.find((entry) => entry && String(entry.id) === 'version') || null;
    }

    /**
     * Дата из content versions.json → sun[DD.MM.YY].exe в корне сайта (рядом с index.html).
     * @param {string} content
     * @returns {string|null}
     */
    _buildDesktopExeHrefFromVersionContent(content) {
        const m = String(content || '').trim().match(/^(\d{2})\.(\d{2})\.(\d{4}|\d{2})/);
        if (!m) {
            return null;
        }
        const yearShort = m[3].length === 4 ? m[3].slice(-2) : m[3];
        return `sun[${m[1]}.${m[2]}.${yearShort}].exe`;
    }

    /** Ссылка «Скачать» в шапке предупреждения — из той же даты, что и «Обновления от:». */
    _syncDesktopDownloadLink(versions) {
        const link = document.querySelector('.sun-desktopDownloadLink');
        if (!link) {
            return;
        }
        const entry = this._getVersionFromEntry(versions);
        if (!entry) {
            return;
        }
        const href = this._buildDesktopExeHrefFromVersionContent(entry.content);
        if (href) {
            link.href = href;
        }
    }

    _createWarningInfoItem(title, content) {
        const item = document.createElement('div');
        item.className = 'sun-warningInfoItem';

        const titleSpan = document.createElement('strong');
        titleSpan.textContent = title;

        const separatorSpan = document.createElement('span');
        separatorSpan.className = 'sun-warningInfoStretch';

        const valueSpan = document.createElement('span');
        valueSpan.className = 'sun-versionInfoValue';
        if (content && String(content).includes('\n')) {
            valueSpan.innerHTML = String(content).replace(/\n/g, '<br>');
            valueSpan.style.whiteSpace = 'pre-wrap';
            valueSpan.style.textAlign = 'left';
        } else {
            valueSpan.textContent = content || 'неизвестно';
        }

        item.appendChild(titleSpan);
        item.appendChild(separatorSpan);
        item.appendChild(valueSpan);
        return item;
    }

    /** Показывает в блоке предупреждения только строку «версия от». */
    _fillVersionFromContainer(container, versions) {
        if (!container) {
            return;
        }
        container.classList.remove('sun-hidden');
        container.innerHTML = '';

        const entry = this._getVersionFromEntry(versions);
        if (!entry) {
            return;
        }

        const item = this._createWarningInfoItem(entry.title, entry.content);
        item.dataset.versionId = entry.id;
        container.appendChild(item);
        this._syncDesktopDownloadLink(versions);
    }

    /** Заполняет блок версий в предупреждении. */
    async fillWarningInfo(warningBox) {
        const container = warningBox.querySelector('.sun-dynamicVersionContainer');
        if (!container) {
            return;
        }

        const versions = await this.loadVersions();
        this._fillVersionFromContainer(container, versions);
        this.saveCurrentVersions(versions);
    }

    /** Контент предупреждения для мобильного устройства. */
    updateMobileWarningContent(warningBox) {
        const warningTitle = warningBox.querySelector('.sun-warningTitle');
        if (warningTitle) {
            warningTitle.textContent = 'НЕДОСТУПНО НА МОБИЛЬНЫХ УСТРОЙСТВАХ';
        }

        this.loadVersions().then((versions) => {
            const container = warningBox.querySelector('.sun-dynamicVersionContainer');
            this._fillVersionFromContainer(container, versions);
        });

        this.addMobileRetryButton(warningBox);
    }
    
    /** Кнопка «Проверить снова» на мобильном предупреждении. */
    addMobileRetryButton(warningBox) {
        const oldButton = warningBox.querySelector('.sun-mobileRetryBtn');
        if (oldButton) {
            oldButton.remove();
        }
        
        const retryButton = document.createElement('button');
        retryButton.className = 'sun-uiBtn sun-mobileRetryBtn';
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
    
    /** Эвристика определения мобильного/планшетного устройства. */
    isMobileDevice() {
        const userAgent = navigator.userAgent.toLowerCase();
        
        const isMobileUserAgent = /mobile|android|iphone|ipad|ipod|windows phone/i.test(userAgent);
        const isTouchDevice = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
        const hasMobileViewport = window.innerWidth <= 768 || 
                                 (window.innerHeight > window.innerWidth && window.innerWidth < 1024);
        const isTablet = /(ipad|tablet|(android(?!.*mobile))|(windows(?!.*phone)(.*touch)))/i.test(userAgent);
        
        return isMobileUserAgent || isTouchDevice || hasMobileViewport || isTablet;
    }
    
    /** Человекочитаемый тип мобильного устройства из userAgent. */
    getMobileDeviceType() {
        const ua = navigator.userAgent.toLowerCase();
        if (ua.includes('iphone')) return 'iPhone';
        if (ua.includes('ipad')) return 'iPad';
        if (ua.includes('android')) return 'Android';
        if (ua.includes('windows phone')) return 'Windows Phone';
        return 'Мобильное устройство';
    }
    
    /** Строка с названием и версией браузера. */
    getBrowserInfo() {
        const ua = navigator.userAgent;
        
        if (ua.includes("Chrome") && !ua.includes("Edg")) {
            const match = ua.match(/Chrome\/([\d.]+)/);
            return match ? `Google Chrome ${match[1]}` : "Google Chrome";
        }
        
        if (ua.includes("Edg")) {
            const match = ua.match(/Edg\/([\d.]+)/);
            return match ? `Microsoft Edge ${match[1]}` : "Microsoft Edge";
        }
        
        if (ua.includes("Firefox")) {
            const match = ua.match(/Firefox\/([\d.]+)/);
            return match ? `Mozilla Firefox ${match[1]}` : "Mozilla Firefox";
        }
        
        if (ua.includes("Safari") && !ua.includes("Chrome")) {
            const match = ua.match(/Version\/([\d.]+)/);
            return match ? `Apple Safari ${match[1]}` : "Apple Safari";
        }
        
        if (ua.includes("Opera") || ua.includes("OPR")) {
            const match = ua.match(/(?:Opera|OPR)\/([\d.]+)/);
            return match ? `Opera ${match[1]}` : "Opera";
        }
        
        if (ua.includes("MSIE") || ua.includes("Trident")) {
            const match = ua.match(/(?:MSIE |Trident\/.*rv:)([\d.]+)/);
            return match ? `Internet Explorer ${match[1]}` : "Internet Explorer";
        }
        
        if (ua.includes("Brave")) {
            const match = ua.match(/Chrome\/([\d.]+)/);
            return match ? `Brave ${match[1]}` : "Brave";
        }
        
        return "Неизвестный браузер";
    }

    /** Строка с операционной системой пользователя. */
    getOSInfo() {
        const ua = navigator.userAgent.toLowerCase();
        const platform = navigator.platform?.toLowerCase() || '';
        
        if (ua.includes('windows nt')) {
            const versionMap = {
                '11.0': 'Windows 11',
                '10.0': 'Windows 10',
                '6.3': 'Windows 8.1',
                '6.2': 'Windows 8',
                '6.1': 'Windows 7',
                '6.0': 'Windows Vista',
                '5.2': 'Windows Server 2003/XP x64',
                '5.1': 'Windows XP',
                '5.0': 'Windows 2000'
            };
            
            const match = ua.match(/windows nt ([\d.]+)/);
            if (match) {
                const version = match[1];
                const edition = this.getWindowsEdition(ua);
                return versionMap[version] 
                    ? `${versionMap[version]} ${edition}` 
                    : `Windows ${version} ${edition}`;
            }
            
            if (ua.includes('wow64') || ua.includes('win64')) {
                return `Windows (${ua.includes('arm') ? 'ARM' : 'x64'})`;
            }
            return 'Windows';
        }
        
        if (ua.includes('mac os x') || ua.includes('macintosh')) {
            const match = ua.match(/mac os x ([\d_]+)/);
            if (match) {
                const version = match[1].replace(/_/g, '.');
                return this.getMacOSVersion(version);
            }
            
            if (ua.includes('macintosh; arm')) {
                return 'macOS (Apple Silicon)';
            }
            return 'macOS';
        }
        
        if (ua.includes('linux')) {
            return this.getLinuxDistro(ua, platform);
        }
        
        if (ua.includes('iphone') || ua.includes('ipad') || ua.includes('ipod')) {
            return this.getIOsVersion(ua);
        }
        
        if (ua.includes('android')) {
            return this.getAndroidVersion(ua);
        }
        
        if (ua.includes('cros') || ua.includes('chrome os')) {
            const match = ua.match(/chrome\/([\d.]+)/);
            if (match) {
                return `Chrome OS (версия ${match[1]})`;
            }
            return 'Chrome OS';
        }
        
        return 'Неизвестная ОС';
    }

    /** Разрядность Windows из userAgent. */
    getWindowsEdition(ua) {
        if (ua.includes('wow64') || ua.includes('win64')) {
            return '(64-bit)';
        }
        if (ua.includes('win32') || ua.includes('wow32')) {
            return '(32-bit)';
        }
        if (ua.includes('arm')) {
            return '(ARM)';
        }
        return '';
    }

    /** Название версии macOS по номеру. */
    getMacOSVersion(version) {
        const [major, minor] = version.split('.').map(Number);
        
        const macVersions = {
            '15.0': 'macOS Sequoia 15.0',
            '14.0': 'macOS Sonoma 14.0',
            '13.0': 'macOS Ventura 13.0',
            '12.0': 'macOS Monterey 12.0',
            '11.0': 'macOS Big Sur 11.0',
            '10.15': 'macOS Catalina 10.15',
            '10.14': 'macOS Mojave 10.14',
            '10.13': 'macOS High Sierra 10.13',
            '10.12': 'macOS Sierra 10.12',
            '10.11': 'OS X El Capitan 10.11',
            '10.10': 'OS X Yosemite 10.10',
            '10.9': 'OS X Mavericks 10.9',
            '10.8': 'OS X Mountain Lion 10.8',
            '10.7': 'OS X Lion 10.7',
            '10.6': 'Mac OS X Snow Leopard 10.6'
        };
        
        for (const [ver, name] of Object.entries(macVersions)) {
            if (version.startsWith(ver)) {
                return name;
            }
        }
        
        const arch = this.isAppleSilicon() ? 'Apple Silicon' : 'Intel';
        return `macOS ${version} (${arch})`;
    }

    /** Проверка Apple Silicon по userAgent. */
    isAppleSilicon() {
        const ua = navigator.userAgent.toLowerCase();
        return ua.includes('macintosh; arm');
    }

    /** Определение дистрибутива Linux из userAgent. */
    getLinuxDistro(ua, platform) {
        const distros = [
            { pattern: 'ubuntu', name: 'Ubuntu' },
            { pattern: 'debian', name: 'Debian' },
            { pattern: 'fedora', name: 'Fedora' },
            { pattern: 'centos', name: 'CentOS' },
            { pattern: 'red hat', name: 'Red Hat' },
            { pattern: 'arch', name: 'Arch Linux' },
            { pattern: 'manjaro', name: 'Manjaro' },
            { pattern: 'opensuse', name: 'openSUSE' },
            { pattern: 'mint', name: 'Linux Mint' },
            { pattern: 'kali', name: 'Kali Linux' },
            { pattern: 'alpine', name: 'Alpine Linux' },
            { pattern: 'gentoo', name: 'Gentoo' },
            { pattern: 'slackware', name: 'Slackware' },
            { pattern: 'mx linux', name: 'MX Linux' },
            { pattern: 'elementary', name: 'elementary OS' },
            { pattern: 'zorin', name: 'Zorin OS' },
            { pattern: 'pop!_os', name: 'Pop!_OS' },
            { pattern: 'raspbian', name: 'Raspbian' }
        ];
        
        for (const distro of distros) {
            if (ua.includes(distro.pattern)) {
                return distro.name;
            }
        }
        
        if (platform.includes('x86_64') || platform.includes('x64')) {
            return 'Linux (64-bit)';
        }
        if (platform.includes('i686') || platform.includes('i386')) {
            return 'Linux (32-bit)';
        }
        if (platform.includes('arm')) {
            return 'Linux (ARM)';
        }
        
        return 'Linux (неизвестный дистрибутив)';
    }

    /** Версия iOS и тип устройства. */
    getIOsVersion(ua) {
        const match = ua.match(/os ([\d_]+) like mac os x/);
        const device = this.getIOsDevice(ua);
        
        if (match) {
            const version = match[1].replace(/_/g, '.');
            const [major, minor] = version.split('.').map(Number);
            
            if (major === 17) return `iOS 17.${minor || 0} (${device})`;
            if (major === 16) return `iOS 16.${minor || 0} (${device})`;
            if (major === 15) return `iOS 15.${minor || 0} (${device})`;
            if (major === 14) return `iOS 14.${minor || 0} (${device})`;
            if (major === 13) return `iOS 13.${minor || 0} (${device})`;
            if (major === 12) return `iOS 12.${minor || 0} (${device})`;
            
            return `iOS ${version} (${device})`;
        }
        return `iOS (${device})`;
    }

    /** Тип iOS-устройства (iPhone/iPad/…). */
    getIOsDevice(ua) {
        if (ua.includes('iphone')) return 'iPhone';
        if (ua.includes('ipad')) {
            if (ua.includes('ipad pro')) return 'iPad Pro';
            if (ua.includes('ipad air')) return 'iPad Air';
            if (ua.includes('ipad mini')) return 'iPad mini';
            return 'iPad';
        }
        if (ua.includes('ipod')) return 'iPod touch';
        return 'iOS устройство';
    }

    /** Версия Android с кодовым именем. */
    getAndroidVersion(ua) {
        const match = ua.match(/android ([\d.]+)/);
        if (match) {
            const version = match[1];
            const [major, minor] = version.split('.').map(Number);
            
            const androidNames = {
                '15': 'Android 15 (Vanilla Ice Cream)',
                '14': 'Android 14 (Upside Down Cake)',
                '13': 'Android 13 (Tiramisu)',
                '12': 'Android 12 (Snow Cone)',
                '11': 'Android 11 (Red Velvet Cake)',
                '10': 'Android 10 (Queen Cake)',
                '9': 'Android 9 Pie',
                '8': 'Android 8 Oreo',
                '7': 'Android 7 Nougat',
                '6': 'Android 6 Marshmallow',
                '5': 'Android 5 Lollipop'
            };
            
            const device = this.getAndroidDevice(ua);
            const versionName = androidNames[major] || `Android ${major}`;
            
            return `${versionName}.${minor || 0} (${device})`;
        }
        return `Android (${this.getAndroidDevice(ua)})`;
    }

    /** Производитель Android-устройства из userAgent. */
    getAndroidDevice(ua) {
        if (ua.includes('samsung') || ua.includes('sm-')) return 'Samsung';
        if (ua.includes('xiaomi') || ua.includes('mi ')) return 'Xiaomi';
        if (ua.includes('huawei')) return 'Huawei';
        if (ua.includes('honor')) return 'Honor';
        if (ua.includes('oppo')) return 'OPPO';
        if (ua.includes('vivo')) return 'vivo';
        if (ua.includes('oneplus')) return 'OnePlus';
        if (ua.includes('google') || ua.includes('pixel')) return 'Google Pixel';
        if (ua.includes('sony')) return 'Sony';
        if (ua.includes('lg')) return 'LG';
        if (ua.includes('motorola') || ua.includes('moto')) return 'Motorola';
        if (ua.includes('nokia')) return 'Nokia';
        if (ua.includes('asus')) return 'ASUS';
        if (ua.includes('lenovo')) return 'Lenovo';
        if (ua.includes('htc')) return 'HTC';
        
        return 'Android устройство';
    }

    /** Архитектура CPU (x64, ARM, …). */
    getArchitecture() {
        const ua = navigator.userAgent.toLowerCase();
        if (ua.includes('x64') || ua.includes('x86_64') || ua.includes('win64')) {
            return '64-bit (x64)';
        }
        if (ua.includes('arm64') || ua.includes('aarch64')) {
            return '64-bit (ARM)';
        }
        if (ua.includes('arm')) {
            return 'ARM';
        }
        if (ua.includes('wow64')) {
            return '32-bit on 64-bit (WoW64)';
        }
        if (ua.includes('i686') || ua.includes('i386')) {
            return '32-bit (x86)';
        }
        return 'Неизвестно';
    }
    
    /** Размеры графа/таймбара через #sun-runtime-layout (без CSS-переменных на DOM). */
    updateCSSVariables() {
        if (!window.dom || !window.dom.applySunRuntimeLayoutCss) {
            return;
        }
        const lw = window.appState.graphWidth;
        const lh = window.appState.config.graphHeight;
        const wtl = window.wavesTransformLayer;
        const dgw =
            wtl && wtl.getDisplayGraphWidth ? wtl.getDisplayGraphWidth() : lw;
        const dgh =
            wtl && wtl.getDisplayGraphHeight ? wtl.getDisplayGraphHeight() : lh;
        window.dom.applySunRuntimeLayoutCss({
            gw: `${lw}px`,
            gh: `${lh}px`,
            dgw: `${dgw}px`,
            dgh: `${dgh}px`,
            sq: `${window.appState.config.squareSize}px`
        });
    }
    
    /** Сворачиваемая панель секретной схемы и её toggle. */
    setupSecretSchemePanel() {
        const toggle = window.dom.byKey('secretSchemeToggle');
        const panel = window.dom.byKey('secretSchemePanel');
        if (!toggle || !panel) {
            return;
        }
        const title =
            'Секретная схема того, как ты думаешь через меня перебирая циферки онлайна';
        const applyOpen = (open) => {
            panel.classList.toggle('sun-secretSchemePanelCollapsed', !open);
            toggle.setAttribute('aria-expanded', open ? 'true' : 'false');
            if (open) {
                toggle.textContent = 'Скрыть';
                toggle.classList.add('sun-active');
            } else {
                toggle.textContent = title;
                toggle.classList.remove('sun-active');
            }
        };
        toggle.addEventListener('click', () => {
            const willOpen = panel.classList.contains('sun-secretSchemePanelCollapsed');
            applyOpen(willOpen);
            if (willOpen && window.SecretScheme && typeof window.SecretScheme.init === 'function') {
                window.SecretScheme.init();
            }
        });
        applyOpen(false);
        if (window.SecretScheme && typeof window.SecretScheme.init === 'function') {
            window.SecretScheme.init();
        }
    }

    /** Сворачиваемые формы «Добавить группу» / «Добавить персону» (взаимоисключающие). */
    setupDatesPanelAddForms() {
        const groupToggle = window.dom.byKey('btnToggleAddPersonGroup');
        const groupFields = window.dom.byKey('addPersonGroupFormFields');
        const groupInput = window.dom.byKey('newPersonGroupName');
        const btnAddGroup = window.dom.byKey('btnAddPersonGroup');

        const dateToggle = window.dom.byKey('btnToggleAddDate');
        const dateFields = window.dom.byKey('dateAddFormFields');
        const dateInput = window.dom.byKey('dateInput');
        const nameInput = window.dom.byKey('dateNameInput');
        const descEl = window.dom.byKey('dateDescriptionInput');
        const genderEl = window.dom.byKey('dateGenderSelect');
        const btnAddDate = window.dom.byKey('btnAddDate');

        if (!groupToggle || !groupFields || !dateToggle || !dateFields) {
            return;
        }

        const setOpenPanel = (panel) => {
            const openGroup = panel === 'group';
            const openDate = panel === 'date';

            groupFields.classList.toggle('sun-addGroupFormFieldsCollapsed', !openGroup);
            groupToggle.setAttribute('aria-expanded', openGroup ? 'true' : 'false');

            dateFields.classList.toggle('sun-addGroupFormFieldsCollapsed', !openDate);
            dateToggle.setAttribute('aria-expanded', openDate ? 'true' : 'false');

            if (openGroup && groupInput) {
                groupInput.focus();
            } else if (openDate && dateInput) {
                dateInput.focus();
            }
        };

        groupToggle.addEventListener('click', () => {
            const willOpen = groupFields.classList.contains('sun-addGroupFormFieldsCollapsed');
            setOpenPanel(willOpen ? 'group' : null);
        });

        dateToggle.addEventListener('click', () => {
            const willOpen = dateFields.classList.contains('sun-addGroupFormFieldsCollapsed');
            setOpenPanel(willOpen ? 'date' : null);
        });

        const submitPersonGroup = () => {
            const name = groupInput ? groupInput.value : '';
            if (window.dates && window.dates.addPersonGroup) {
                const g = window.dates.addPersonGroup(name || '');
                if (g && groupInput) {
                    groupInput.value = '';
                    setOpenPanel(null);
                }
            }
            if (window.dataManager && window.dataManager.updateDateList) {
                window.dataManager.updateDateList();
            }
        };

        if (btnAddGroup) {
            btnAddGroup.addEventListener('click', submitPersonGroup);
        }
        if (groupInput) {
            groupInput.addEventListener('keydown', (e) => {
                if (e.key === 'Enter') {
                    e.preventDefault();
                    submitPersonGroup();
                }
            });
        }

        const clearDateForm = () => {
            if (dateInput) {
                dateInput.value = '';
            }
            if (nameInput) {
                nameInput.value = '';
            }
            if (descEl) {
                descEl.value = '';
            }
            if (genderEl) {
                genderEl.value = 'unset';
            }
        };

        const submitDate = () => {
            const dateValue = dateInput ? dateInput.value : '';
            const name = nameInput ? (nameInput.value || 'Новая дата') : 'Новая дата';
            const description = descEl ? String(descEl.value) : '';
            const gender = genderEl ? genderEl.value : 'unset';
            if (!dateValue) {
                return;
            }
            if (window.dates && window.dates.addDate) {
                window.dates.addDate(dateValue, name, description, gender);
            }
            if (window.dataManager && window.dataManager.updateDateList) {
                window.dataManager.updateDateList();
            }
            clearDateForm();
            setOpenPanel(null);
        };

        if (btnAddDate) {
            btnAddDate.addEventListener('click', submitDate);
        }

        setOpenPanel(null);
    }

    /** Сворачиваемые формы «Добавить группу» / «Добавить сигнал» (взаимоисключающие). */
    setupWavesPanelAddForms() {
        const groupToggle = window.dom.byKey('btnToggleAddWaveGroup');
        const groupFields = window.dom.byKey('addWaveGroupFormFields');
        const groupInput = window.dom.byKey('newGroupName');
        const btnAddGroup = window.dom.byKey('btnAddGroup');

        const waveToggle = window.dom.byKey('btnToggleAddWave');
        const waveFields = window.dom.byKey('addWaveFormFields');
        const waveNameInput = window.dom.byKey('customWaveName');
        const wavePeriodInput = window.dom.byKey('customWavePeriod');
        const waveTypeInput = window.dom.byKey('customWaveType');
        const waveColorInput = window.dom.byKey('customWaveColor');
        const waveNoteInput = window.dom.byKey('customWaveNote');
        const btnAddWave = window.dom.byKey('btnAddCustomWave');

        if (!groupToggle || !groupFields || !waveToggle || !waveFields) {
            return;
        }

        const setOpenPanel = (panel) => {
            const openGroup = panel === 'group';
            const openWave = panel === 'wave';

            groupFields.classList.toggle('sun-addGroupFormFieldsCollapsed', !openGroup);
            groupToggle.setAttribute('aria-expanded', openGroup ? 'true' : 'false');

            waveFields.classList.toggle('sun-addGroupFormFieldsCollapsed', !openWave);
            waveToggle.setAttribute('aria-expanded', openWave ? 'true' : 'false');

            if (openGroup && groupInput) {
                groupInput.focus();
            } else if (openWave && waveNameInput) {
                waveNameInput.focus();
            }
        };

        groupToggle.addEventListener('click', () => {
            const willOpen = groupFields.classList.contains('sun-addGroupFormFieldsCollapsed');
            setOpenPanel(willOpen ? 'group' : null);
        });

        waveToggle.addEventListener('click', () => {
            const willOpen = waveFields.classList.contains('sun-addGroupFormFieldsCollapsed');
            setOpenPanel(willOpen ? 'wave' : null);
        });

        const submitWaveGroup = () => {
            const groupName = groupInput ? groupInput.value.trim() : '';
            if (!groupName || !window.dates) {
                return;
            }
            const newGroup = window.dates.addGroup(groupName);
            if (!newGroup) {
                return;
            }
            if (window.displayViewTemplatesManager) {
                window.displayViewTemplatesManager.onNewGroupAdded(newGroup);
            }
            if (window.dataManager) {
                window.dataManager.updateWavesGroups();
            }
            if (window.summaryManager && window.summaryManager.updateSummary) {
                window.summaryManager.updateSummary();
            }
            if (groupInput) {
                groupInput.value = '';
            }
            setOpenPanel(null);
        };

        if (btnAddGroup) {
            btnAddGroup.addEventListener('click', submitWaveGroup);
        }
        if (groupInput) {
            groupInput.addEventListener('keydown', (e) => {
                if (e.key === 'Enter') {
                    e.preventDefault();
                    submitWaveGroup();
                }
            });
        }

        const clearWaveForm = () => {
            if (waveNameInput) {
                waveNameInput.value = '';
            }
            if (wavePeriodInput) {
                wavePeriodInput.value = '';
            }
            if (waveColorInput) {
                waveColorInput.value = '#666666';
            }
            if (waveNoteInput) {
                waveNoteInput.value = '';
            }
        };

        const submitWave = () => {
            const name = waveNameInput ? waveNameInput.value.trim() : '';
            const period = wavePeriodInput ? wavePeriodInput.value : '';
            const type = waveTypeInput ? waveTypeInput.value : 'solid';
            const color = waveColorInput ? waveColorInput.value : '#666666';
            const note = waveNoteInput ? String(waveNoteInput.value) : '';
            if (!name || !period || !window.waves) {
                return;
            }
            const newWave = window.waves.addCustomWave(name, period, type, color, note);
            if (!newWave) {
                return;
            }
            if (window.unifiedListManager) {
                window.unifiedListManager.updateWavesList();
            }
            const defaultGroup = window.appState.data.groups.find((g) => g.id === 'default-group');
            if (defaultGroup && window.unifiedListManager && window.unifiedListManager.updateGroupStats) {
                window.unifiedListManager.updateGroupStats('default-group');
            }
            if (window.summaryManager && window.summaryManager.updateSummary) {
                window.summaryManager.updateSummary();
            }
            clearWaveForm();
            setOpenPanel(null);
        };

        if (btnAddWave) {
            btnAddWave.addEventListener('click', submitWave);
        }

        setOpenPanel(null);
    }

    /** Глобальные слушатели: цвет, даты, импорт, стрелки. */
    setupEventListeners() {
        this.setupSecretSchemePanel();
        this.setupDatesPanelAddForms();
        this.setupWavesPanelAddForms();

        // Обработчик для кнопки "Программа"
        const colorPickerBtn = window.dom.byKey('colorPickerBtn');
        if (colorPickerBtn) {
            const newBtn = colorPickerBtn.cloneNode(true);
            colorPickerBtn.parentNode.replaceChild(newBtn, colorPickerBtn);
            
            newBtn.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                
                // Если цвет уже был выбран (не красный по умолчанию) - просто закрываем предупреждение
                if (this.hasSelectedColor) {
                    this.closeWarning();
                } else {
                    // Если цвет не выбран - открываем выбор цвета
                    const hiddenColorPicker = window.dom.byKey('hiddenColorPicker');
                    if (hiddenColorPicker) {
                        hiddenColorPicker.click();
                    }
                }
            });
        }
        
        // Обработчик для скрытого выбора цвета
        const hiddenColorPicker = window.dom.byKey('hiddenColorPicker');
        if (hiddenColorPicker) {
            const newPicker = hiddenColorPicker.cloneNode(true);
            hiddenColorPicker.parentNode.replaceChild(newPicker, hiddenColorPicker);
            
            newPicker.addEventListener('change', (e) => {
                const selectedColor = e.target.value;
                
                // Окрашиваем все угловые квадратики в выбранный цвет
                this.applyCornerSquareColor(selectedColor);
                
                // Сохраняем цвет
                this.saveCornerColor(selectedColor);
                
                // Закрываем предупреждение
                this.closeWarning();
                
                console.log(`Квадратики окрашены в цвет: ${selectedColor}`);
            });
        }
        
        // Обработчик для кнопки "Передумать" (сбрасывает цвет)
        const resetWarningBtn = document.querySelector('[data-action="resetWarning"]');
        if (resetWarningBtn) {
            const newBtn = resetWarningBtn.cloneNode(true);
            resetWarningBtn.parentNode.replaceChild(newBtn, resetWarningBtn);
            
            newBtn.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                
                // Сбрасываем цвет квадратиков в красный
                this.resetCornerColor();
                
                // Показываем предупреждение снова
                const warningOverlay = window.dom.byKey('warningOverlay');
                const warningBox = document.querySelector('.sun-warningBox');
                if (warningOverlay && warningBox) {
                    warningOverlay.classList.remove('sun-hidden');
                    warningBox.classList.remove('sun-hidden');
                    document.body.style.overflow = 'hidden';
                }
            });
        }

        const importAllFile = window.dom.byKey('importAllFile');
        
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
        
        document.addEventListener('keydown', (e) => {
            if (!window.dates) return;

            if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
                e.preventDefault();
            }
            
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
    }
}

window.appCore = new AppCore();