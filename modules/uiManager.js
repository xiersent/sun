// optimized3/modules/uiManager.js
class UIManager {
    constructor() {
        this.elements = window.appCore ? window.appCore.elements : {};
    }
    
    handleAction(action, element) {
        console.log('Обработка действия:', action);
        
        const actions = {
            // Навигация
            prevDay: () => window.dates.navigateDay(-1),
            nextDay: () => window.dates.navigateDay(1),
            today: () => window.dates.goToToday(),
            setDate: () => window.dates.setDateFromInput(),
            
            // Трансформации
            flipH: () => this.flipHorizontal(),
            flipV: () => this.flipVertical(),
            rotateL: () => this.rotate(-90),
            rotateR: () => this.rotate(90),
            resetTransform: () => this.resetTransform(),
            
            // Переключение UI
            toggleUI: () => this.toggleUI(),
            toggleGraph: () => this.toggleGraph(),
            toggleBg: () => this.toggleBackground(),
            toggleSquares: () => this.toggleSquares(),
            toggleGrayMode: () => this.toggleGrayMode(),
            toggleGraphGrayMode: () => this.toggleGraphGrayMode(), // НОВОЕ
            toggleStars: () => this.toggleStars(),
            toggleTooltips: () => this.toggleTooltips(),
            
            // Управление углами
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
            
            // Экспорт/Импорт
            exportAll: () => window.importExport.exportAll(),
            exportDates: () => window.importExport.exportDates(),
            exportWaves: () => window.importExport.exportWaves(),
            importAll: () => document.getElementById('importAllFile').click(),
            importDB: () => document.getElementById('importDBFile').click(),
            resetAll: () => this.resetAll()
        };
        
        if (actions[action]) {
            actions[action]();
        } else {
            console.warn('Неизвестное действие:', action);
        }
    }
    
    toggleUI() {
        console.log('Переключение UI');
        window.appState.uiHidden = !window.appState.uiHidden;
        if (window.appState.uiHidden) {
            document.body.classList.add('ui-hidden');
            console.log('UI скрыт');
        } else {
            document.body.classList.remove('ui-hidden');
            console.log('UI показан');
        }
        window.appState.save();
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
            window.appState.waveCornerColor[wave.id] = false;
        });
        window.waves.updateCornerSquareColors();
        window.dataManager.updateWavesGroups();
        window.appState.save();
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
        window.appState.graphBgWhite = !window.appState.graphBgWhite;
        
        const graphContainer = document.getElementById('graphContainer');
        if (graphContainer) {
            if (window.appState.graphBgWhite) {
                graphContainer.style.backgroundColor = '#fff';
                graphContainer.classList.remove('dark-mode');
            } else {
                graphContainer.style.backgroundColor = '#000';
                graphContainer.classList.add('dark-mode');
            }
        }
        
        window.appState.save();
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
        console.log('Серость графика:', window.appState.graphGrayMode ? 'включена' : 'выключена');
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
    
    toggleTooltips() {
        window.appState.showTooltips = !window.appState.showTooltips;
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
        window.appState.reset();
        
        document.body.classList.remove('ui-hidden', 'graph-hidden', 'gray-mode');
        document.body.classList.add('stars-mode');
        document.body.classList.remove('names-mode');
        
        const graphContainer = document.getElementById('graphContainer');
        if (graphContainer) {
            graphContainer.style.backgroundColor = '#fff';
            graphContainer.classList.remove('dark-mode', 'graph-gray-mode');
        }
        
        const allSquares = document.querySelectorAll('.corner-square');
        allSquares.forEach(square => {
            square.style.display = 'block';
        });
        
        document.querySelectorAll('.wave-container').forEach(container => {
            container.remove();
        });
        
        window.waves.waveContainers = {};
        window.waves.wavePaths = {};
        
        // ВАЖНО: Создаем элементы волн для активной даты
        window.appState.data.waves.forEach(wave => {
            const waveIdStr = String(wave.id);
            const isWaveVisible = window.appState.waveVisibility[waveIdStr] !== false;
            const isGroupEnabled = window.waves.isWaveGroupEnabled(wave.id);
            const shouldShow = isWaveVisible && isGroupEnabled;
            
            if (shouldShow) {
                window.waves.createWaveElement(wave);
            }
        });
        
        this.applyTransform();
        window.dataManager.updateDateList();
        window.dataManager.updateWavesGroups();
        window.dataManager.updateNotesList();
        window.grid.updateGridNotesHighlight();
        
        // ВАЖНОЕ ИСПРАВЛЕНИЕ: Гарантированно активируем дефолтную дату после сброса
        this.activateDefaultDate();
        
        window.grid.updateCenterDate();
        window.waves.updatePosition();
        window.waves.updateCornerSquareColors();
        window.appState.save();
        
        alert('Все настройки сброшены к значениям по умолчанию');
    }
    
    // НОВЫЙ МЕТОД: Активация дефолтной даты
    activateDefaultDate() {
        console.log('UIManager: активация дефолтной даты...');
        
        // Находим дефолтную дату (s25)
        const defaultDateId = 's25';
        const defaultDate = window.appState.data.dates.find(d => d.id === defaultDateId);
        
        if (defaultDate) {
            console.log('Найдена дефолтная дата:', defaultDateId);
            
            // Устанавливаем как активную
            window.appState.activeDateId = defaultDateId;
            
            try {
                const date = new Date(defaultDate.date);
                if (isNaN(date.getTime())) {
                    throw new Error('Некорректная дата в объекте');
                }
                
                window.appState.baseDate = new Date(date);
                console.log('Установлена базовая дата из дефолтной:', defaultDate.date);
                
                // Пересчитываем текущий день
                window.dates.recalculateCurrentDay();
                
                // ГАРАНТИЯ: Создаем элементы волн для дефолтной даты
                if (window.waves) {
                    // Очищаем старые контейнеры
                    document.querySelectorAll('.wave-container').forEach(c => c.remove());
                    window.waves.waveContainers = {};
                    window.waves.wavePaths = {};
                    
                    // Создаем элементы волн
                    window.waves.createVisibleWaveElements();
                    window.waves.updatePosition();
                    window.waves.updateCornerSquareColors();
                }
                
                // Обновляем графики
                window.grid.createGrid();
                window.grid.updateCenterDate();
                window.waves.updatePosition();
                window.grid.updateGridNotesHighlight();
                window.appState.save();
                
                // Обновляем UI списка дат
                window.dataManager.updateDateList();
                
                console.log('Дефолтная дата успешно активирована');
                
            } catch (error) {
                console.error('Ошибка активации дефолтной даты:', error);
                // Если ошибка, устанавливаем сегодняшнюю дату
                window.appState.baseDate = new Date();
                window.dates.recalculateCurrentDay();
                window.grid.createGrid();
                window.grid.updateCenterDate();
                window.waves.updatePosition();
                window.appState.save();
            }
        } else {
            console.error('Дефолтная дата не найдена в данных');
            
            // Если нет дефолтной даты, берем первую из списка
            if (window.appState.data.dates && window.appState.data.dates.length > 0) {
                const firstDate = window.appState.data.dates[0];
                console.log('Используем первую дату из списка:', firstDate.id);
                window.dates.setActiveDate(firstDate.id);
            } else {
                // Если вообще нет дат, устанавливаем сегодняшнюю
                console.log('Нет дат в списке, устанавливаем сегодняшнюю');
                window.appState.baseDate = new Date();
                window.dates.recalculateCurrentDay();
                window.grid.createGrid();
                window.grid.updateCenterDate();
                window.waves.updatePosition();
                window.appState.save();
            }
        }
    }
    
    updateUI() {
        window.dataManager.updateDateList();
        window.dataManager.updateWavesGroups();
        window.dataManager.updateNotesList();
        
        if (document.getElementById('mainDateInput')) {
            document.getElementById('mainDateInput').value = window.dom.formatDateForInput(window.appState.currentDate);
        }
        if (document.getElementById('dateInput')) {
            document.getElementById('dateInput').value = window.dom.formatDateForInput(window.appState.currentDate);
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
        const tabId = tabButton.getAttribute('data-tab');
        const container = tabButton.closest('.tab-container');
        
        container.querySelectorAll('.tab-button').forEach(btn => {
            btn.classList.remove('active');
        });
        
        container.querySelectorAll('.tab-content').forEach(content => {
            content.classList.remove('active');
        });
        
        tabButton.classList.add('active');
        
        const tabContent = container.querySelector(`#${tabId}-tab`);
        if (tabContent) {
            tabContent.classList.add('active');
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
    
    // ДОПОЛНИТЕЛЬНЫЙ МЕТОД: Тоггл группы (если используется)
    toggleGroup(groupId) {
        const group = window.appState.data.groups.find(g => g.id === groupId);
        if (group) {
            group.enabled = !group.enabled;
            window.appState.save();
            
            // Обновить видимость волн и их позиции
            if (window.waves) {
                window.waves.updatePosition(); // <- Добавить эту строку
            }
            
            window.dataManager.updateWavesGroups();
        }
    }
}

window.uiManager = new UIManager();