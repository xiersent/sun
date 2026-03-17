// modules/appCore.js
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

    // Загрузка всех версий из одного JSON файла
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
    
    // Сохранение версий
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
        } catch (error) {
            // Игнорируем ошибки сохранения
        }
    }
    
    // Заполнение информации в предупреждении - БЕЗ ПОДСВЕТКИ
    async fillWarningInfo(warningBox) {
        // Информация о браузере
        const browserInfoEl = warningBox.querySelector('#browserInfo');
        if (browserInfoEl) {
            browserInfoEl.textContent = this.getBrowserInfo();
        }

        // Информация об ОС
        const osInfoEl = document.createElement('div');
        osInfoEl.className = 'warning-info-item';
        osInfoEl.id = 'osInfoItem';
        
        const osTitleSpan = document.createElement('strong');
        osTitleSpan.textContent = 'Операционная система:';
        
        const osSeparatorSpan = document.createElement('span');
        osSeparatorSpan.style.flex = '1';
        osSeparatorSpan.style.borderBottom = '1px dotted';
        osSeparatorSpan.style.alignSelf = 'stretch';
        
        const osValueSpan = document.createElement('span');
        osValueSpan.id = 'osInfo';
        osValueSpan.textContent = this.getOSInfo();
        
        osInfoEl.appendChild(osTitleSpan);
        osInfoEl.appendChild(osSeparatorSpan);
        osInfoEl.appendChild(osValueSpan);

        // Информация об архитектуре
        const archInfo = this.getArchitecture();
        if (archInfo) {
            const archEl = document.createElement('div');
            archEl.className = 'warning-info-item';
            
            const archTitleSpan = document.createElement('strong');
            archTitleSpan.textContent = 'Архитектура:';
            
            const archSeparatorSpan = document.createElement('span');
            archSeparatorSpan.style.flex = '1';
            archSeparatorSpan.style.borderBottom = '1px dotted';
            archSeparatorSpan.style.alignSelf = 'stretch';
            
            const archValueSpan = document.createElement('span');
            archValueSpan.textContent = archInfo;
            
            archEl.appendChild(archTitleSpan);
            archEl.appendChild(archSeparatorSpan);
            archEl.appendChild(archValueSpan);
        }

        // Текущее время
        const todayInfoEl = warningBox.querySelector('#todayInfo');
        if (todayInfoEl) {
            const today = new Date();
            todayInfoEl.textContent = window.timeUtils.formatDateTime(today);
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

        // Вставляем информацию об ОС после браузера
        if (browserItem) {
            container.insertBefore(osInfoEl, browserItem.nextSibling);
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
            
            item.appendChild(titleSpan);
            item.appendChild(separatorSpan);
            item.appendChild(valueSpan);
            
            // Вставляем перед элементом "Сейчас"
            container.insertBefore(item, todayItem);
        });

        // Сохраняем версии для будущих проверок
        this.saveCurrentVersions(versions);
    }

    // Мобильная версия - БЕЗ ПОДСВЕТКИ
    updateMobileWarningContent(warningBox) {
        const warningTitle = warningBox.querySelector('.warning-title');
        if (warningTitle) {
            warningTitle.textContent = 'НЕДОСТУПНО НА МОБИЛЬНЫХ УСТРОЙСТВАХ';
        }
        
        // Заполняем информацию
        const browserInfoEl = warningBox.querySelector('#browserInfo');
        if (browserInfoEl) {
            browserInfoEl.textContent = `Мобильное устройство (${this.getMobileDeviceType()})`;
        }
        
        // Информация об ОС для мобильных
        const osInfoEl = document.createElement('div');
        osInfoEl.className = 'warning-info-item';
        
        const osTitleSpan = document.createElement('strong');
        osTitleSpan.textContent = 'Операционная система:';
        
        const osSeparatorSpan = document.createElement('span');
        osSeparatorSpan.style.flex = '1';
        osSeparatorSpan.style.borderBottom = '1px dotted';
        osSeparatorSpan.style.alignSelf = 'stretch';
        
        const osValueSpan = document.createElement('span');
        osValueSpan.textContent = this.getOSInfo();
        
        osInfoEl.appendChild(osTitleSpan);
        osInfoEl.appendChild(osSeparatorSpan);
        osInfoEl.appendChild(osValueSpan);
        
        // Текущее время
        const todayInfoEl = warningBox.querySelector('#todayInfo');
        if (todayInfoEl) {
            const today = new Date();
            todayInfoEl.textContent = window.timeUtils.formatDateTime(today);
        }
        
        // Показываем информацию о системе
        const warningInfo = warningBox.querySelector('.warning-info');
        if (warningInfo) {
            warningInfo.style.display = 'flex';
            
            // Вставляем ОС после браузера
            const browserItem = warningBox.querySelector('#browserInfo')?.closest('.warning-info-item');
            if (browserItem) {
                browserItem.parentNode.insertBefore(osInfoEl, browserItem.nextSibling);
            }
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

    // Детальное определение ОС
    getOSInfo() {
        const ua = navigator.userAgent.toLowerCase();
        const platform = navigator.platform?.toLowerCase() || '';
        
        // === WINDOWS ===
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
        
        // === macOS ===
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
        
        // === LINUX ===
        if (ua.includes('linux')) {
            return this.getLinuxDistro(ua, platform);
        }
        
        // === iOS ===
        if (ua.includes('iphone') || ua.includes('ipad') || ua.includes('ipod')) {
            return this.getIOsVersion(ua);
        }
        
        // === Android ===
        if (ua.includes('android')) {
            return this.getAndroidVersion(ua);
        }
        
        // === Chrome OS ===
        if (ua.includes('cros') || ua.includes('chrome os')) {
            const match = ua.match(/chrome\/([\d.]+)/);
            if (match) {
                return `Chrome OS (версия ${match[1]})`;
            }
            return 'Chrome OS';
        }
        
        return 'Неизвестная ОС';
    }

    // Определение редакции Windows
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

    // Детальная версия macOS
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

    // Проверка Apple Silicon
    isAppleSilicon() {
        const ua = navigator.userAgent.toLowerCase();
        return ua.includes('macintosh; arm');
    }

    // Детектор Linux дистрибутивов
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
        
        // Определяем архитектуру
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

    // Детальная версия iOS
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

    // Определение устройства iOS
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

    // Детальная версия Android
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

    // Определение устройства Android
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

    // Определение архитектуры
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
        
        // Вставляем кнопку выбора цвета на слово "любимому"
        parableContent.innerHTML = `
            <p>Говорят, когда-то одну девушку обвинили в ведовстве. В качестве наказания её отвезли на островок на озере – клочок каменистой почвы, где не было ни еды, ни укрытий. Её приговорили к мучительной медленной смерти от холода и голода.</p>
            <p>Вот только не знали в городе, что один юноша, увидев её глаза, прекрасные и сверкающие, подобно луне в летнюю ночь, поклялся ей в вечной любви. Когда ей вынесли приговор – по его мнению, несправедливый – он дал обет уберечь её от гибели. Выжидая удобного дня для совместного побега, он каждую ночь втайне переплывал озеро на лодке с едой и тёплой одеждой. А она каждую ночь вставала у воды и зажигала свечу, чтобы указать ему путь.</p>
            <p>Как-то раз, в поразительно ясную ночь, когда на небе не было ни облачка, юноша, как всегда, отчалил от берега. Он внимательно вглядывался в темноту, выискивая огонёк, который приведёт его к любимой. Однако в ту ночь луна светила до того ярко, что затмила бы собой любую свечу. Отражение луны в воде сбило юношу с пути. Он грёб, грёб и грёб к свету, всё надеясь, что вот-вот доплывёт. Иллюзорный отсвет луны до того заворожил его, что он не замечал ни ноющих рук, ни сбившегося дыхания... Когда лодка перевернулась, он был уже так измотан греблей, так ослабли его руки, что до берега он не добрался. Он упокоился в озере.</p>
            <p>Оставшись одна, девушка всё же не теряла надежды. Каждую ночь она выходила к воде и зажигала свечу. Говорят, и по сей день те, кто ищут истинную любовь, видят на озере свечу Светоносной девы, что надеется указать дорогу <span class="color-picker-trigger" style="cursor: pointer; position: relative; display: inline-block; border-bottom: none;">любимому<input type="color" class="hidden-color-picker" value="#ff0000" style="position: absolute; opacity: 0; width: 100%; height: 100%; left: 0; top: 0; cursor: pointer;"></span>.</p>
        `;
        
        // Добавляем обработчик для выбора цвета
        setTimeout(() => {
            const colorPicker = document.querySelector('.color-picker-trigger input[type="color"]');
            if (colorPicker) {
                colorPicker.addEventListener('change', (e) => {
                    e.stopPropagation();
                    const selectedColor = e.target.value;
                    
                    // Окрашиваем все угловые квадратики в выбранный цвет
                    document.querySelectorAll('.corner-square').forEach(square => {
                        square.style.backgroundColor = selectedColor;
                    });
                    
                    // Закрываем модальное окно притчи
                    this.hideParableModal();
                    
                    // Закрываем плашку предупреждения
                    const warningOverlay = document.getElementById('warningOverlay');
                    const warningBox = document.querySelector('.warning-box');
                    if (warningOverlay && warningBox) {
                        warningOverlay.classList.add('hidden');
                        warningBox.classList.add('hidden');
                        document.body.style.overflow = 'auto';
                        document.body.classList.remove('ui-hidden');
                    }
                    
                    console.log(`Квадратики окрашены в цвет: ${selectedColor}`);
                });
                
                // Предотвращаем всплытие клика на родительский span
                colorPicker.addEventListener('click', (e) => {
                    e.stopPropagation();
                });
            }
        }, 100);
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