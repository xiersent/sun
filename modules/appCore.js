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
            'readParableBtn', 'parableModal', 'parableContent', 'closeParableBtn'
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
                // Сразу показываем мобильную версию без задержек
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
                const currentVersions = {
                    version: await this.getVersion(),
                    firmware: await this.getFirmwareDate(),
                    framework: await this.getFrameworkDate(),
                    plugin: await this.getPluginDate(),
					ear: await this.getEarDate(),
					worker: await this.getWorkerDate(),
					browser: this.getBrowserInfo(),
                    timestamp: new Date().getTime()
                };
                this.saveCurrentVersions(currentVersions);
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

	async getWorkerDate() {
		try {
			const timestamp = new Date().getTime();
			const response = await fetch(`worker.txt?t=${timestamp}`);
			if (response.ok) {
				return (await response.text()).trim();
			}
			return '(файл ненайден)';
		} catch (error) {
			return '(ошибка загрузки)';
		}
	}

    async getFirmwareDate() {
        try {
            const timestamp = new Date().getTime();
            const response = await fetch(`firmware.txt?t=${timestamp}`);
            if (response.ok) {
                return (await response.text()).trim();
            }
            return '(файл ненайден)';
        } catch (error) {
            return '(ошибка загрузки)';
        }
    }

    async getVersion() {
        try {
            const timestamp = new Date().getTime();
            const response = await fetch(`version.txt?t=${timestamp}`);
            if (response.ok) {
                return (await response.text()).trim();
            }
            return '(файл ненайден)';
        } catch (error) {
            return '(ошибка загрузки)';
        }
    }

    async getPluginDate() {
        try {
            const timestamp = new Date().getTime();
            const response = await fetch(`plugin.txt?t=${timestamp}`);
            if (response.ok) {
                return (await response.text()).trim();
            }
            return '(файл ненайден)';
        } catch (error) {
            return '(ошибка загрузки)';
        }
    }

	async getEarDate() {
		try {
			const timestamp = new Date().getTime();
			const response = await fetch(`ear.txt?t=${timestamp}`);
			if (response.ok) {
				return (await response.text()).trim();
			}
			return '(файл ненайден)';
		} catch (error) {
			return '(ошибка загрузки)';
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
		
	saveCurrentVersions(versions) {
		try {
			// Добавляем информацию о браузере
			const currentVersions = {
				...versions,
				browser: this.getBrowserInfo(),
				timestamp: new Date().getTime()
			};
			localStorage.setItem(this.versionStorageKey, JSON.stringify(currentVersions));
		} catch (error) {
			// Игнорируем ошибки сохранения
		}
	}
    
    // Проверяем, изменилась ли версия
    isVersionChanged(type, currentValue) {
        const lastVersions = this.getLastVersions();
        const lastValue = lastVersions[type];
        
        // Если нет сохраненной версии - не выделяем
        if (!lastValue) return false;
        
        // Сравниваем строки
        return currentValue !== lastValue && 
               currentValue !== '(файл ненайден)' && 
               currentValue !== '(ошибка загрузки)';
    }
    
	fillWarningInfo(warningBox) {
		// Заполняем информацию о браузере - проверяем изменения
		const browserInfoEl = warningBox.querySelector('#browserInfo');
		if (browserInfoEl) {
			const browserInfo = this.getBrowserInfo();
			browserInfoEl.textContent = browserInfo;
			
			// Проверяем, изменился ли браузер
			const lastVersions = this.getLastVersions();
			const lastBrowser = lastVersions.browser;
			
			if (lastBrowser && browserInfo !== lastBrowser) {
				browserInfoEl.style.fontWeight = '700';
				browserInfoEl.style.color = '#000000';
			}
		}
		
		// Текущее время - НЕ выделяем жирным
		const todayInfoEl = warningBox.querySelector('#todayInfo');
		if (todayInfoEl) {
			const today = new Date();
			const todayFormatted = `${today.getDate().toString().padStart(2, '0')}.${(today.getMonth() + 1).toString().padStart(2, '0')}.${today.getFullYear()}`;
			const timeFormatted = `${today.getHours().toString().padStart(2, '0')}:${today.getMinutes().toString().padStart(2, '0')}:${today.getSeconds().toString().padStart(2, '0')}`;
			todayInfoEl.textContent = `${todayFormatted} ${timeFormatted}`;
			
			// ВАЖНО: НЕ выделяем жирным и НЕ проверяем изменения
			todayInfoEl.style.fontWeight = '400'; // нормальный вес
			todayInfoEl.style.color = '#666'; // обычный цвет
		}
		
		// Загружаем остальную информацию
		this.loadVersionInfo();
		this.loadFirmwareInfo();
		this.loadPluginInfo();
		this.loadFrameworkInfo();
		this.loadWorkerInfo();
		this.loadEarInfo();
	}

	updateMobileWarningContent(warningBox) {
		const warningTitle = warningBox.querySelector('.warning-title');
		if (warningTitle) {
			warningTitle.textContent = 'НЕДОСТУПНО НА МОБИЛЬНЫХ УСТРОЙСТВАХ';
			warningTitle.style.color = '#000000';
		}
		
		// Заполняем информацию
		const browserInfoEl = warningBox.querySelector('#browserInfo');
		if (browserInfoEl) {
			browserInfoEl.textContent = `Мобильное устройство (${this.getMobileDeviceType()})`;
		}
		
		// ВАЖНОЕ ИСПРАВЛЕНИЕ: Добавляем отображение времени на мобильной версии
		const todayInfoEl = warningBox.querySelector('#todayInfo');
		if (todayInfoEl) {
			const today = new Date();
			
			// Форматируем дату
			const todayFormatted = `${today.getDate().toString().padStart(2, '0')}.${(today.getMonth() + 1).toString().padStart(2, '0')}.${today.getFullYear()}`;
			
			// Форматируем время
			const timeFormatted = `${today.getHours().toString().padStart(2, '0')}:${today.getMinutes().toString().padStart(2, '0')}:${today.getSeconds().toString().padStart(2, '0')}`;
			
			// Объединяем дату и время КАК НА ДЕСКТОПЕ
			todayInfoEl.textContent = `${todayFormatted} ${timeFormatted}`;
			
			// ===== ДОБАВЛЕНО: Выделяем так же как на десктопе =====
			// На десктопе "сегодня" всегда выделяется, так как время всегда меняется
			todayInfoEl.style.fontWeight = '700';
			todayInfoEl.style.color = '#000000';
		}
		
		// Показываем информацию о системе
		const warningInfo = warningBox.querySelector('.warning-info');
		if (warningInfo) {
			warningInfo.style.display = 'flex';
		}
		
		// ==== КЛЮЧЕВОЕ ИЗМЕНЕНИЕ: Используем те же методы загрузки ====
		// которые сами проверяют изменения и выделяют
		this.loadVersionInfo();
		this.loadFirmwareInfo();
		this.loadPluginInfo();
		this.loadFrameworkInfo();
		this.loadWorkerInfo();
		this.loadEarInfo();
		
		// Для остальных полей тоже принудительно выделяем (как на десктопе)
		const fields = ['firmwareInfo', 'frameworkInfo', 'pluginInfo', 'earInfo'];
		fields.forEach(fieldId => {
			const fieldEl = warningBox.querySelector(`#${fieldId}`);
			if (fieldEl) {
				// Даем время загрузиться, потом обновляем
				setTimeout(() => {
					if (fieldEl.textContent && 
						fieldEl.textContent !== 'Загрузка...' && 
						fieldEl.textContent !== 'неизвестно' &&
						!fieldEl.textContent.includes('ошибка') &&
						!fieldEl.textContent.includes('файл ненайден')) {
						
						// Проверяем, было ли изменение (аналогично десктопу)
						const currentValue = fieldEl.textContent;
						const lastVersions = this.getLastVersions();
						
						// Для мобильных пока просто выделяем все
						fieldEl.style.fontWeight = '700';
						fieldEl.style.color = '#000000';
					}
				}, 500);
			}
		});
		
		// Добавляем кнопку проверки
		this.addMobileRetryButton(warningBox);
	}
    
    addMobileRetryButton(warningBox) {
        // Удаляем старую кнопку, если есть
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


	loadWorkerInfo() {
		const workerInfoEl = document.getElementById('workerInfo');
		if (workerInfoEl) {
			workerInfoEl.textContent = 'Загрузка...';
			this.getWorkerDate().then(workerDate => {
				if (workerInfoEl) {
					const workerText = workerDate || 'неизвестно';
					workerInfoEl.textContent = workerText;
					
					// Проверяем изменения
					if (this.isVersionChanged('worker', workerText)) {
						workerInfoEl.style.fontWeight = '700';
						workerInfoEl.style.color = '#000000';
					}
				}
			}).catch(error => {
				if (workerInfoEl) {
					workerInfoEl.textContent = 'неизвестно';
				}
			});
		}
	}
    
    loadVersionInfo() {
        const versionInfoEl = document.getElementById('versionInfo');
        if (versionInfoEl) {
            versionInfoEl.textContent = 'Загрузка...';
            this.getVersion().then(version => {
                if (versionInfoEl) {
                    const versionText = version || 'неизвестно';
                    versionInfoEl.textContent = versionText;
                    
                    // Проверяем изменения
                    if (this.isVersionChanged('version', versionText)) {
                        versionInfoEl.style.fontWeight = '700';
                        versionInfoEl.style.color = '#000000';
                    }
                }
            }).catch(error => {
                if (versionInfoEl) {
                    versionInfoEl.textContent = 'неизвестно';
                }
            });
        }
    }
    
    loadFirmwareInfo() {
        const firmwareInfoEl = document.getElementById('firmwareInfo');
        if (firmwareInfoEl) {
            firmwareInfoEl.textContent = 'Загрузка...';
            this.getFirmwareDate().then(firmwareDate => {
                if (firmwareInfoEl) {
                    const firmwareText = firmwareDate || 'неизвестно';
                    firmwareInfoEl.textContent = firmwareText;
                    
                    // Проверяем изменения
                    if (this.isVersionChanged('firmware', firmwareText)) {
                        firmwareInfoEl.style.fontWeight = '700';
                        firmwareInfoEl.style.color = '#000000';
                    }
                }
            }).catch(error => {
                if (firmwareInfoEl) {
                    firmwareInfoEl.textContent = 'неизвестно';
                }
            });
        }
    }
    
    loadPluginInfo() {
        const pluginInfoEl = document.getElementById('pluginInfo');
        if (pluginInfoEl) {
            pluginInfoEl.textContent = 'Загрузка...';
            this.getPluginDate().then(pluginDate => {
                if (pluginInfoEl) {
                    const pluginText = pluginDate || 'неизвестно';
                    pluginInfoEl.textContent = pluginText;
                    
                    // Проверяем изменения
                    if (this.isVersionChanged('plugin', pluginText)) {
                        pluginInfoEl.style.fontWeight = '700';
                        pluginInfoEl.style.color = '#000000';
                    }
                }
            }).catch(error => {
                if (pluginInfoEl) {
                    pluginInfoEl.textContent = 'неизвестно';
                }
            });
        }
    }

	loadEarInfo() {
		const earInfoEl = document.getElementById('earInfo');
		if (earInfoEl) {
			earInfoEl.textContent = 'Загрузка...';
			this.getEarDate().then(earDate => {
				if (earInfoEl) {
					const earText = earDate || 'неизвестно';
					earInfoEl.textContent = earText;
					
					// Проверяем изменения
					if (this.isVersionChanged('ear', earText)) {
						earInfoEl.style.fontWeight = '700';
						earInfoEl.style.color = '#000000';
					}
				}
			}).catch(error => {
				if (earInfoEl) {
					earInfoEl.textContent = 'неизвестно';
				}
			});
		}
	}
    
    loadFrameworkInfo() {
        const frameworkInfoEl = document.getElementById('frameworkInfo');
        if (frameworkInfoEl) {
            frameworkInfoEl.textContent = 'Загрузка...';
            this.getFrameworkDate().then(frameworkDate => {
                if (frameworkInfoEl) {
                    const frameworkText = frameworkDate || 'неизвестно';
                    frameworkInfoEl.textContent = frameworkText;
                    
                    // Проверяем изменения
                    if (this.isVersionChanged('framework', frameworkText)) {
                        frameworkInfoEl.style.fontWeight = '700';
                        frameworkInfoEl.style.color = '#000000';
                    }
                }
            }).catch(error => {
                if (frameworkInfoEl) {
                    frameworkInfoEl.textContent = 'неизвестно';
                }
            });
        }
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
                    // Удаляем оба класса (desktop и mobile)
                    warningOverlay.classList.remove('desktop-warning', 'mobile-warning-overlay');
                    // Скрываем весь оверлей, а не только бокс
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
                        document.getElementById('dbImportTextarea').value = `❌ ОШИБКА ЗАГРРУЗКИ БАЗЫ ДАННЫХ\n\nФайл: ${file.name}\nОшибка: ${error.message}`;
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

    async getFrameworkDate() {
        try {
            const timestamp = new Date().getTime();
            const response = await fetch(`framework.txt?t=${timestamp}`);
            if (response.ok) {
                return (await response.text()).trim();
            }
            return '(файл ненайден)';
        } catch (error) {
            return '(ошибка загрузки)';
        }
    }
}

window.appCore = new AppCore();