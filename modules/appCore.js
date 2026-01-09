class AppCore {
    constructor() {
        this.elements = {};
        this.cacheElements();
        this.isInitializing = false;
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
            
            const isMobile = this.isMobileDevice();
            if (isMobile) {
                this.showWarning();
                document.body.classList.add('mobile-device');
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
            
            await this.initializeAppComponents();
            
            this.showWarning();
            
        } catch (error) {
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
    
    async getVersion() {
        try {
            const response = await fetch('version.txt');
            if (response.ok) {
                return (await response.text()).trim();
            }
            return '(файл не найден)';
        } catch (error) {
            return '(ошибка загрузки)';
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
    
    showWarning() {
        const warningOverlay = document.getElementById('warningOverlay') || this.elements.warningOverlay;
        if (!warningOverlay) return;
        
        const isMobile = this.isMobileDevice();
        
        if (isMobile) {
            this.showMobileWarning(warningOverlay);
            return;
        }
        
        this.showDesktopWarning(warningOverlay);
    }
    
    showDesktopWarning(warningOverlay) {
        warningOverlay.classList.remove('hidden');
        warningOverlay.classList.add('desktop-warning');
        document.body.style.overflow = 'hidden';
        
        const browserInfoEl = document.getElementById('browserInfo');
        if (browserInfoEl) {
            browserInfoEl.textContent = this.getBrowserInfo();
        }
        
        const todayInfoEl = document.getElementById('todayInfo');
        if (todayInfoEl) {
            const today = new Date();
            const todayFormatted = `${today.getDate().toString().padStart(2, '0')}.${(today.getMonth() + 1).toString().padStart(2, '0')}.${today.getFullYear()}`;
            todayInfoEl.textContent = todayFormatted;
        }
        
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
        document.querySelectorAll('.interface-container, .corner-square').forEach(el => {
            el.style.display = 'none';
        });
        
        warningOverlay.classList.remove('hidden');
        warningOverlay.classList.add('mobile-warning-overlay');
        
        const acceptButton = document.getElementById('acceptWarning');
        if (acceptButton) {
            acceptButton.style.display = 'none';
        }
        
        const parableButton = document.getElementById('readParableBtn');
        if (parableButton) {
            parableButton.style.display = 'none';
        }
        
        const warningBox = warningOverlay.querySelector('.warning-box');
        if (warningBox) {
            warningBox.classList.add('mobile-warning-box');
            
            const warningTitle = warningBox.querySelector('.warning-title');
            if (warningTitle) {
                warningTitle.textContent = 'НЕДОСТУПНО НА МОБИЛЬНЫХ УСТРОЙСТВАХ';
                warningTitle.style.color = '#ff0000';
            }
            
            const warningText = warningBox.querySelector('.warning-text');
            if (warningText) {
                warningText.innerHTML = ``;
            }
            
            const browserInfoEl = document.getElementById('browserInfo');
            if (browserInfoEl) {
                browserInfoEl.textContent = `Мобильное устройство (${this.getMobileDeviceType()})`;
            }
            
            const todayInfoEl = document.getElementById('todayInfo');
            if (todayInfoEl) {
                const today = new Date();
                const todayFormatted = `${today.getDate().toString().padStart(2, '0')}.${(today.getMonth() + 1).toString().padStart(2, '0')}.${today.getFullYear()}`;
                todayInfoEl.textContent = todayFormatted;
            }
            
            const versionInfoEl = document.getElementById('versionInfo');
            if (versionInfoEl) {
                versionInfoEl.textContent = 'Только для ПК';
            }
            
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
				if (warningOverlay) {
					warningOverlay.classList.add('hidden');
					document.body.style.overflow = 'auto';
				}
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
}

window.appCore = new AppCore();