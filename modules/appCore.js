// modules/appCore.js - ИСПРАВЛЕННАЯ ВЕРСИЯ
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
    }
    
    cacheElements() {
        const ids = [
            'warningOverlay', 'acceptWarning', 'browserInfo', 'versionInfo', 'todayInfo',
            'graphContainer', 'graphElement', 'centerDateLabel',
            'dateListForDates', 'wavesList',
            'dbImportTextarea', 'dbImportProgress', 'dbImportProgressBar',
            'dbImportStatus', 'intersectionResults', 'intersectionStats',
            'warningBox', 'currentDay', 'summaryPanel', 'summaryGroupSelect',
            'summaryStateSelect', 'summaryResults',
            'colorPickerBtn', 'hiddenColorPicker',
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

        const __lp = typeof window !== 'undefined' ? window.__loadPerf : null;
        __lp && __lp.mark('appCore_init_enter');

        try {
            this.setupEventListeners();
            this.updateCSSVariables();

            if (window.appState && window.appState.graphHidden) {
                document.body.classList.add('graph-hidden');
            }

            const isMobile = this.isMobileDevice();

            if (isMobile) {
                __lp && __lp.mark('appCore_init_mobile_early_exit');
                this._listsHydratedOnInit = false;
                document.body.classList.add('mobile-device');
                this.showMobileWarning();
                return;
            }

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
    
    // Сохраняет цвет квадратиков в localStorage
    saveCornerColor(color) {
        localStorage.setItem('corner_square_color', color);
        this.hasSelectedColor = true;
    }
    
    // Восстанавливает цвет квадратиков из localStorage
    restoreCornerColor() {
        const savedColor = localStorage.getItem('corner_square_color');
        if (savedColor && savedColor !== this.defaultCornerColor) {
            document.querySelectorAll('.corner-square').forEach(square => {
                square.style.backgroundColor = savedColor;
            });
            this.hasSelectedColor = true;
        } else {
            this.hasSelectedColor = false;
        }
    }
    
    // Сбрасывает цвет квадратиков в красный
    resetCornerColor() {
        document.querySelectorAll('.corner-square').forEach(square => {
            square.style.backgroundColor = this.defaultCornerColor;
        });
        localStorage.removeItem('corner_square_color');
        this.hasSelectedColor = false;
    }
    
    // Закрывает предупреждение
    closeWarning() {
        const warningOverlay = document.getElementById('warningOverlay');
        const warningBox = document.querySelector('.warning-box');
        if (warningOverlay && warningBox) {
            warningOverlay.classList.remove('desktop-warning', 'mobile-warning-overlay');
            warningOverlay.classList.add('hidden');
            warningBox.classList.add('hidden');
            document.body.style.overflow = 'auto';
            document.body.classList.remove('ui-hidden');
        }
    }
    
    updateGraphBackground() {
        const graphContainer = document.getElementById('graphContainer');
        if (graphContainer) {
            graphContainer.classList.remove('dark-mode');
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
        
        // Всегда показываем предупреждение
        warningOverlay.classList.remove('hidden');
        warningOverlay.classList.add('desktop-warning');
        document.body.style.overflow = 'hidden';
        
        // Показываем плашку
        warningBox.classList.remove('hidden');
        
        // Заполняем информацию
        this.fillWarningInfo(warningBox);
    }
    
    showMobileWarning() {
        const warningOverlay = document.getElementById('warningOverlay');
        const warningBox = document.querySelector('.warning-box');
        
        if (!warningOverlay || !warningBox) return;
        
        document.querySelectorAll('.interface-container, .corner-square').forEach(el => {
            el.style.display = 'none';
        });
        
        warningOverlay.classList.add('mobile-warning-overlay');
        document.body.style.overflow = 'hidden';
        
        warningBox.classList.remove('hidden');
        warningBox.classList.add('mobile-warning-box');
        
        this.updateMobileWarningContent(warningBox);
        
        const acceptButtons = warningBox.querySelectorAll('[data-action="acceptWarning"]');
        acceptButtons.forEach(btn => {
            btn.style.display = 'none';
        });
        
        const colorPickerBtn = document.getElementById('colorPickerBtn');
        if (colorPickerBtn) {
            colorPickerBtn.style.display = 'none';
        }
    }
    
    getLastVersions() {
        try {
            const saved = localStorage.getItem(this.versionStorageKey);
            return saved ? JSON.parse(saved) : {};
        } catch (error) {
            return {};
        }
    }
    
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
    
    async fillWarningInfo(warningBox) {
        const browserInfoEl = warningBox.querySelector('#browserInfo');
        if (browserInfoEl) {
            browserInfoEl.textContent = this.getBrowserInfo();
        }

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

        const archInfo = this.getArchitecture();
        let archEl = null;
        if (archInfo) {
            archEl = document.createElement('div');
            archEl.className = 'warning-info-item';
            archEl.id = 'archInfoItem';
            
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

        const todayInfoEl = warningBox.querySelector('#todayInfo');
        if (todayInfoEl) {
            const today = new Date();
            todayInfoEl.textContent = window.timeUtils.formatDateTime(today);
        }

        const versions = await this.loadVersions();
        
        const container = warningBox.querySelector('#dynamicVersionContainer');
        if (!container) return;

        const items = container.querySelectorAll('.warning-info-item');
        const todayItem = items[items.length - 1];
        const browserItem = items[0];
        
        for (let i = items.length - 1; i >= 0; i--) {
            if (items[i] !== todayItem && items[i] !== browserItem) {
                items[i].remove();
            }
        }

        if (browserItem && browserItem.parentNode === container) {
            if (!document.getElementById('osInfoItem')) {
                container.insertBefore(osInfoEl, browserItem.nextSibling);
            }
        } else if (!browserItem) {
            if (!document.getElementById('osInfoItem')) {
                container.insertBefore(osInfoEl, container.firstChild);
            }
        }

        if (archEl && !document.getElementById('archInfoItem')) {
            const osItem = document.getElementById('osInfoItem');
            if (osItem && osItem.parentNode === container) {
                container.insertBefore(archEl, osItem.nextSibling);
            } else if (browserItem && browserItem.parentNode === container) {
                container.insertBefore(archEl, browserItem.nextSibling);
            }
        }

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
            
            if (todayItem && todayItem.parentNode === container) {
                container.insertBefore(item, todayItem);
            } else {
                container.appendChild(item);
            }
        });

        this.saveCurrentVersions(versions);
    }

    updateMobileWarningContent(warningBox) {
        const warningTitle = warningBox.querySelector('.warning-title');
        if (warningTitle) {
            warningTitle.textContent = 'НЕДОСТУПНО НА МОБИЛЬНЫХ УСТРОЙСТВАХ';
        }
        
        const browserInfoEl = warningBox.querySelector('#browserInfo');
        if (browserInfoEl) {
            browserInfoEl.textContent = `Мобильное устройство (${this.getMobileDeviceType()})`;
        }
        
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
        
        const todayInfoEl = warningBox.querySelector('#todayInfo');
        if (todayInfoEl) {
            const today = new Date();
            todayInfoEl.textContent = window.timeUtils.formatDateTime(today);
        }
        
        const warningInfo = warningBox.querySelector('.warning-info');
        if (warningInfo) {
            warningInfo.style.display = 'flex';
            
            const browserItem = warningBox.querySelector('#browserInfo')?.closest('.warning-info-item');
            if (browserItem) {
                browserItem.parentNode.insertBefore(osInfoEl, browserItem.nextSibling);
            }
        }
        
        this.loadVersions().then(versions => {
            const container = warningBox.querySelector('#dynamicVersionContainer');
            if (!container) return;
            
            const items = container.querySelectorAll('.warning-info-item');
            const todayItem = items[items.length - 1];
            const browserItem = items[0];
            
            for (let i = items.length - 1; i >= 0; i--) {
                if (items[i] !== todayItem && items[i] !== browserItem) {
                    items[i].remove();
                }
            }
            
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

    isAppleSilicon() {
        const ua = navigator.userAgent.toLowerCase();
        return ua.includes('macintosh; arm');
    }

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
        // Обработчик для кнопки "Программа"
        const colorPickerBtn = document.getElementById('colorPickerBtn');
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
                    const hiddenColorPicker = document.getElementById('hiddenColorPicker');
                    if (hiddenColorPicker) {
                        hiddenColorPicker.click();
                    }
                }
            });
        }
        
        // Обработчик для скрытого выбора цвета
        const hiddenColorPicker = document.getElementById('hiddenColorPicker');
        if (hiddenColorPicker) {
            const newPicker = hiddenColorPicker.cloneNode(true);
            hiddenColorPicker.parentNode.replaceChild(newPicker, hiddenColorPicker);
            
            newPicker.addEventListener('change', (e) => {
                const selectedColor = e.target.value;
                
                // Окрашиваем все угловые квадратики в выбранный цвет
                document.querySelectorAll('.corner-square').forEach(square => {
                    square.style.backgroundColor = selectedColor;
                });
                
                // Сохраняем цвет
                this.saveCornerColor(selectedColor);
                
                // Закрываем предупреждение
                this.closeWarning();
                
                console.log(`Квадратики окрашены в цвет: ${selectedColor}`);
            });
        }
        
        // Обработчик для кнопок "Согласиться и продолжить"
        document.addEventListener('click', (e) => {
            const target = e.target;
            if (target.matches('[data-action="acceptWarning"]')) {
                this.closeWarning();
                e.preventDefault();
                e.stopPropagation();
            }
        });
        
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
                const warningOverlay = document.getElementById('warningOverlay');
                const warningBox = document.querySelector('.warning-box');
                if (warningOverlay && warningBox) {
                    warningOverlay.classList.remove('hidden');
                    warningOverlay.classList.add('desktop-warning');
                    warningBox.classList.remove('hidden');
                    document.body.style.overflow = 'hidden';
                }
            });
        }
        
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
                const descEl = document.getElementById('dateDescriptionInput');
                const description = descEl ? String(descEl.value) : '';
                const genderEl = document.getElementById('dateGenderSelect');
                const gender = genderEl ? genderEl.value : 'unset';
                
                if (dateValue) {
                    if (window.dates && window.dates.addDate) {
                        window.dates.addDate(dateValue, name, description, gender);
                    }
                    
                    if (window.dataManager && window.dataManager.updateDateList) {
                        window.dataManager.updateDateList();
                    }
                }
            });
        }

        const btnAddPersonGroup = document.getElementById('btnAddPersonGroup');
        if (btnAddPersonGroup) {
            btnAddPersonGroup.addEventListener('click', () => {
                const input = document.getElementById('newPersonGroupName');
                const name = input ? input.value : '';
                if (window.dates && window.dates.addPersonGroup) {
                    const g = window.dates.addPersonGroup(name || '');
                    if (g && input) {
                        input.value = '';
                    }
                }
                if (window.dataManager && window.dataManager.updateDateList) {
                    window.dataManager.updateDateList();
                }
            });
        }
        
        const importAllFile = document.getElementById('importAllFile');
        
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