// modules/uiManager.js - ОБНОВЛЕННЫЙ
class UIManager {
    constructor() {
        this.elements = window.appCore ? window.appCore.elements : {};
        this.setupDateTimeInputs();
        this.activeTab = null;
    }
    
    setupDateTimeInputs() {
        const dateInput = document.getElementById('mainDateInputDate');
        const timeInput = document.getElementById('mainDateInputTime');
        
        if (!dateInput || !timeInput) return;
        
        dateInput.addEventListener('focus', () => {
            if (!dateInput.value) {
                const now = new Date();
                dateInput.value = window.timeUtils.formatForDateInput(now);
            }
        });
        
        timeInput.addEventListener('focus', () => {
            if (!timeInput.value) {
                const now = new Date();
                timeInput.value = window.timeUtils.formatForTimeInput(now);
            }
        });
        
        const handleEnter = (e) => {
            if (e.key === 'Enter') {
                if (window.dates && window.dates.setDateFromInputs) {
                    window.dates.setDateFromInputs();
                }
            }
        };
        
        dateInput.addEventListener('keydown', handleEnter);
        timeInput.addEventListener('keydown', handleEnter);
        
        timeInput.addEventListener('blur', () => {
            let value = timeInput.value.trim();
            if (value && value.split(':').length === 2) {
                timeInput.value = value + ':00';
            }
        });
        
        timeInput.addEventListener('input', (e) => {
            let value = e.target.value.replace(/[^\d:]/g, '');
            
            if (value.length === 2 && !value.includes(':')) {
                value = value + ':';
            } else if (value.length === 5 && value.split(':').length < 3) {
                value = value + ':';
            }
            
            e.target.value = value;
        });
    }
    
    handleAction(action, element) {
        const actions = {
            prevDay: () => window.dates.navigateDay(-1),
            nextDay: () => window.dates.navigateDay(1),
            today: () => window.dates.goToToday(),
            now: () => window.dates.goToNow(),
            setDate: () => window.dates.setDateFromInputs(),
            
            flipH: () => this.flipHorizontal(),
            flipV: () => this.flipVertical(),
            rotateL: () => this.rotate(-90),
            rotateR: () => this.rotate(90),
            resetTransform: () => this.resetTransform(),
            
            toggleUI: () => this.toggleUI(),
            toggleGraph: () => this.toggleGraph(),
            toggleWaveLabels: () => this.toggleWaveLabels(),
            toggleExtremes: () => this.toggleExtremes(),
            toggleEquilibrium: () => this.toggleEquilibrium(),
            toggleBg: () => this.toggleBackground(),
            toggleSquares: () => this.toggleSquares(),
            toggleGrayMode: () => this.toggleGrayMode(),
            toggleGraphGrayMode: () => this.toggleGraphGrayMode(),
            toggleStars: () => this.toggleStars(),
            
            toggleCorners: () => this.toggleCornerSquares('corners'),
            toggleAxial: () => this.toggleCornerSquares('axial'),
            toggleVertical: () => this.toggleCornerSquares('vertical'),
            toggleSides: () => this.toggleCornerSquares('sides'),
            toggleMiddle: () => this.toggleCornerSquares('middle'),
            toggleLeft: () => this.toggleCornerSquares('left'),
            toggleRight: () => this.toggleCornerSquares('right'),
            toggleTop: () => this.toggleCornerSquares('top'),
            toggleBottom: () => this.toggleCornerSquares('bottom'),
            toggleAllSquares: () => this.toggleAllSquares(),
            resetCorners: () => this.resetCorners(),
            
            exportAll: () => window.importExport.exportAll(),
            exportDates: () => window.importExport.exportDates(),
            exportWaves: () => window.importExport.exportWaves(),
            importAll: () => document.getElementById('importAllFile').click(),
            importDB: () => document.getElementById('importDBFile').click(),
            resetAll: () => this.resetAll()
        };
        
        if (actions[action]) {
            actions[action]();
        }
    }
    
    toggleUI() {
        window.appState.uiHidden = !window.appState.uiHidden;
        if (window.appState.uiHidden) {
            document.body.classList.add('ui-hidden');
            if (window.timeBarManager && window.timeBarManager.container) {
                window.timeBarManager.container.style.display = 'none';
            }
        } else {
            document.body.classList.remove('ui-hidden');
            if (window.timeBarManager && window.timeBarManager.container) {
                window.timeBarManager.container.style.display = 'block';
            }
        }
        window.appState.save();
    }
    
    toggleWaveLabels() {
        const horizontalContainer = document.querySelector('.wave-labels-container');
        
        if (horizontalContainer) {
            const areHidden = horizontalContainer.classList.contains('hidden');
            
            if (areHidden) {
                horizontalContainer.classList.remove('hidden');
            } else {
                horizontalContainer.classList.add('hidden');
            }
        }
    }
    
    toggleExtremes() {
        const verticalContainer = document.querySelector('.wave-labels-vertical-container');
        
        if (verticalContainer) {
            const areHidden = verticalContainer.classList.contains('hidden');
            
            if (areHidden) {
                verticalContainer.classList.remove('hidden');
            } else {
                verticalContainer.classList.add('hidden');
            }
        }
    }
    
    toggleEquilibrium() {
        const axisXPointsContainer = document.querySelector('.wave-axis-x-points');
        
        if (axisXPointsContainer) {
            const areHidden = axisXPointsContainer.classList.contains('hidden');
            
            if (areHidden) {
                axisXPointsContainer.classList.remove('hidden');
                
                if (window.waves && window.waves.updateAxisXIntersectionPoints) {
                    window.waves.updateAxisXIntersectionPoints();
                }
            } else {
                axisXPointsContainer.classList.add('hidden');
            }
        } else {
            if (window.waves && window.waves.updateAxisXIntersectionPoints) {
                window.waves.updateAxisXIntersectionPoints();
                
                setTimeout(() => {
                    const newContainer = document.querySelector('.wave-axis-x-points');
                    if (newContainer) {
                        newContainer.classList.remove('hidden');
                    }
                }, 100);
            }
        }
    }
    
    toggleCornerSquares(type) {
        const squares = {
            'corners': ['.tl', '.tr', '.bl', '.br'],
            'axial': ['.tc', '.bc', '.lc', '.rc'],
            'vertical': ['.tc', '.bc'],
            'sides': ['.lc', '.rc'],
            'middle': ['.mt', '.mb', '.ml', '.mr', '.mt2', '.mb2', '.ml2', '.mr2'],
            'left': ['.tl', '.bl', '.lc', '.ml', '.ml2'],
            'right': ['.tr', '.br', '.rc', '.mr', '.mr2'],
            'top': ['.tl', '.tr', '.tc', '.mt', '.mt2'],
            'bottom': ['.bl', '.br', '.bc', '.mb', '.mb2'],
            'all': ['.tl', '.tr', '.bl', '.br', '.tc', '.bc', '.lc', '.rc', '.mt', '.mb', '.ml', '.mr', '.mt2', '.mb2', '.ml2', '.mr2']
        };
        const selectors = squares[type] || squares.all;
        selectors.forEach(selector => {
            const square = document.querySelector(`.corner-square${selector}`);
            if (square) {
                square.style.display = square.style.display === 'none' ? 'block' : 'none';
            }
        });
    }
    
    toggleAllSquares() {
        const allSquares = document.querySelectorAll('.corner-square');
        const anyVisible = Array.from(allSquares).some(square => square.style.display !== 'none');
        const newVisibility = !anyVisible;
        allSquares.forEach(square => {
            square.style.display = newVisibility ? 'block' : 'none';
        });
        window.appState.cornerSquaresVisible = newVisibility;
        window.appState.save();
    }
    
    toggleSquares() {
        window.appState.cornerSquaresVisible = !window.appState.cornerSquaresVisible;
        const allSquares = document.querySelectorAll('.corner-square');
        allSquares.forEach(square => {
            square.style.display = window.appState.cornerSquaresVisible ? 'block' : 'none';
        });
        window.appState.save();
    }
    
    resetCorners() {
        window.appState.data.waves.forEach(wave => {
            const waveIdStr = String(wave.id);
            window.appState.waveCornerColor[waveIdStr] = false;
        });
        
        this.updateCornerSquareColors();
        
        if (window.dataManager && window.dataManager.updateWavesGroups) {
            window.dataManager.updateWavesGroups();
        }
        
        document.querySelectorAll('.wave-corner-color-check').forEach(checkbox => {
            checkbox.checked = false;
        });
        
        window.appState.save();
    }
    
    updateCornerSquareColors() {
        document.querySelectorAll('.corner-square').forEach(square => {
            square.style.backgroundColor = 'red';
        });
    }
    
    flipHorizontal() {
        window.appState.transform.scaleX *= -1;
        this.applyTransform();
    }
    
    flipVertical() {
        window.appState.transform.scaleY *= -1;
        this.applyTransform();
    }
    
    rotate(degrees) {
        window.appState.transform.rotation += degrees;
        this.applyTransform();
    }
    
    resetTransform() {
        window.appState.transform = {
            scaleX: 1,
            scaleY: 1,
            rotation: 0
        };
        this.applyTransform();
    }
    
    applyTransform() {
        let transform = '';
        if (window.appState.transform.rotation !== 0) {
            transform += `rotate(${window.appState.transform.rotation}deg) `;
        }
        transform += `scaleX(${window.appState.transform.scaleX}) scaleY(${window.appState.transform.scaleY})`;
        
        const graphElement = document.getElementById('graphElement');
        if (graphElement) {
            graphElement.style.transform = transform;
        }
        
        window.appState.save();
    }
    
    toggleGraph() {
        window.appState.graphHidden = !window.appState.graphHidden;
        if (window.appState.graphHidden) {
            document.body.classList.add('graph-hidden');
        } else {
            document.body.classList.remove('graph-hidden');
        }
        window.appState.save();
    }
    
    toggleBackground() {
        const graphContainer = document.getElementById('graphContainer');
        if (graphContainer) {
            graphContainer.classList.toggle('dark-mode');
            
            window.appState.graphBgWhite = !graphContainer.classList.contains('dark-mode');
            window.appState.save();
        }
    }
    
    toggleGrayMode() {
        window.appState.grayMode = !window.appState.grayMode;
        if (window.appState.grayMode) {
            document.body.classList.add('gray-mode');
        } else {
            document.body.classList.remove('gray-mode');
        }
        window.appState.save();
    }
    
    toggleGraphGrayMode() {
        window.appState.graphGrayMode = !window.appState.graphGrayMode;
        
        const graphContainer = document.getElementById('graphContainer');
        if (graphContainer) {
            if (window.appState.graphGrayMode) {
                graphContainer.classList.add('graph-gray-mode');
            } else {
                graphContainer.classList.remove('graph-gray-mode');
            }
        }
        
        window.appState.save();
    }
    
    toggleStars() {
        window.appState.showStars = !window.appState.showStars;
        if (window.appState.showStars) {
            document.body.classList.add('stars-mode');
            document.body.classList.remove('names-mode');
        } else {
            document.body.classList.remove('stars-mode');
            document.body.classList.add('names-mode');
        }
        window.grid.updateCenterDate();
        window.dataManager.updateDateList();
        window.appState.save();
    }
    
    resetAll() {
        if (!confirm('Сбросить ВСЕ настройки интерфейса к значениям по умолчанию?')) {
            return;
        }
        
        if (!confirm('ВНИМАНИЕ: Это действие нельзя отменить. Все данные будут удалены. Продолжить?')) {
            return;
        }
        
        localStorage.clear();
        window.location.reload();
    }
    
    updateDateTimeInputs() {
        const dateInput = document.getElementById('mainDateInputDate');
        const timeInput = document.getElementById('mainDateInputTime');
        
        if (dateInput && timeInput && window.timeUtils) {
            const formatted = window.timeUtils.formatForDateTimeInputs(window.appState.currentDate);
            dateInput.value = formatted.date;
            timeInput.value = formatted.time;
        }
    }
    
    updateUI() {
        window.dataManager.updateDateList();
        window.dataManager.updateWavesGroups();
        window.dataManager.updateNotesList();
        
        this.updateDateTimeInputs();
        
        if (document.getElementById('dateInput')) {
            document.getElementById('dateInput').value = window.timeUtils.formatForDateInput(window.appState.currentDate);
        }
        
        window.waves.updatePosition();
        window.grid.updateCenterDate();
        window.grid.updateGridNotesHighlight();
    }
    
    clearWaveForm() {
        document.getElementById('customWaveName').value = '';
        document.getElementById('customWavePeriod').value = '';
        document.getElementById('customWaveType').value = 'solid';
        document.getElementById('customWaveColor').value = '#666666';
    }
    
    handleTabClick(tabButton) {
        const tabId = tabButton.dataset.tab;
        
        if (this.activeTab === tabId) {
            this.deactivateTab(tabButton);
            this.activeTab = null;
        } else {
            if (this.activeTab) {
                const prevTabButton = document.querySelector(`[data-tab="${this.activeTab}"]`);
                if (prevTabButton) {
                    this.deactivateTab(prevTabButton);
                }
            }
            
            this.activateTab(tabButton);
            this.activeTab = tabId;
        }
        
        localStorage.setItem('activeTab', this.activeTab);
    }
    
    activateTab(tabButton) {
        const tabId = tabButton.dataset.tab;
        
        document.querySelectorAll('.tab-button').forEach(btn => {
            btn.classList.remove('active');
        });
        
        document.querySelectorAll('.tab-content').forEach(content => {
            content.classList.remove('active');
        });
        
        tabButton.classList.add('active');
        
        const tabContent = document.querySelector(`#${tabId}-tab`);
        if (tabContent) {
            tabContent.classList.add('active');
        }
        
        if (tabId === 'intersections' && window.intersectionManager) {
            window.intersectionManager.updateForCurrentDate();
        }
    }
    
    deactivateTab(tabButton) {
        const tabId = tabButton.dataset.tab;
        
        tabButton.classList.remove('active');
        const tabContent = document.querySelector(`#${tabId}-tab`);
        if (tabContent) {
            tabContent.classList.remove('active');
        }
    }
    
    restoreTabState() {
        const savedTab = localStorage.getItem('activeTab');
        if (savedTab) {
            const tabButton = document.querySelector(`[data-tab="${savedTab}"]`);
            if (tabButton) {
                this.activateTab(tabButton);
                this.activeTab = savedTab;
            }
        }
    }
    
    toggleSpoiler(button) {
        const spoilerContent = button.nextElementSibling;
        const isVisible = spoilerContent.classList.contains('show');
        
        if (isVisible) {
            spoilerContent.classList.remove('show');
            button.textContent = 'Показать метаданные';
        } else {
            spoilerContent.classList.add('show');
            button.textContent = 'Скрыть метаданные';
        }
    }
    
    randomizePanelOrder() {
        const controlPanel = document.querySelector('.control-panel');
        if (!controlPanel) return;
        
        const panels = Array.from(controlPanel.querySelectorAll('.panel-section'));
        for (let i = panels.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [panels[i], panels[j]] = [panels[j], panels[i]];
        }
        
        panels.forEach(panel => controlPanel.appendChild(panel));
    }
    
    scrollToDBImport() {
        const dbImportSection = document.querySelector('.db-import-section');
        if (dbImportSection) {
            dbImportSection.scrollIntoView({
                behavior: 'smooth'
            });
        }
    }
    
    toggleGroup(groupId) {
        const group = window.appState.data.groups.find(g => g.id === groupId);
        if (group) {
            group.enabled = !group.enabled;
            window.appState.save();
            
            if (window.waves) {
                window.waves.updatePosition();
            }
            
            window.dataManager.updateWavesGroups();
        }
    }
}

window.uiManager = new UIManager();