// modules/uiManager.js
class UIManager {
    constructor() {
        this.elements = window.appCore ? window.appCore.elements : {};
        this.setupDateTimeInput();
    }
    
    setupDateTimeInput() {
        const dateInput = document.getElementById('mainDateInput');
        if (!dateInput) return;
        
        // Автодополнение даты
        dateInput.addEventListener('input', (e) => {
            let value = e.target.value.replace(/[^\d\s\-:]/g, '');
            
            // Автоматическое добавление разделителей
            if (value.length === 4 && !value.includes('-')) {
                value = value + '-';
            } else if (value.length === 7 && value.split('-').length < 3) {
                value = value + '-';
            } else if (value.length === 10 && !value.includes(' ')) {
                value = value + ' ';
            } else if (value.length === 13 && value.split(':').length < 2) {
                value = value + ':';
            } else if (value.length === 16 && value.split(':').length < 3) {
                value = value + ':';
            }
            
            e.target.value = value;
        });
        
        // Подсказка при фокусе
        dateInput.addEventListener('focus', () => {
            if (!dateInput.value) {
                const now = new Date();
                const example = window.dom.formatDateForDateTimeInputWithSeconds(now);
                dateInput.placeholder = example;
            }
        });
        
        // Возвращаем стандартный placeholder при потере фокуса
        dateInput.addEventListener('blur', () => {
            dateInput.placeholder = "YYYY-MM-DD HH:MM:SS";
        });
        
        // Обработка клавиши Enter
        dateInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                if (window.dates && window.dates.setDateFromInput) {
                    window.dates.setDateFromInput();
                }
            }
        });
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
            toggleWaveLabels: () => this.toggleWaveLabels(), // НОВЫЙ МЕТОД
            toggleBg: () => this.toggleBackground(),
            toggleSquares: () => this.toggleSquares(),
            toggleGrayMode: () => this.toggleGrayMode(),
            toggleGraphGrayMode: () => this.toggleGraphGrayMode(),
            toggleStars: () => this.toggleStars(),
            
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
    
    // НОВЫЙ МЕТОД: Переключение видимости выносок
    toggleWaveLabels() {
        console.log('Переключение видимости выносок');
        const labelsContainer = document.querySelector('.wave-labels-container');
        if (labelsContainer) {
            if (labelsContainer.classList.contains('hidden')) {
                labelsContainer.classList.remove('hidden');
                console.log('Выноски показаны');
            } else {
                labelsContainer.classList.add('hidden');
                console.log('Выноски скрыты');
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
        // Сбросить все флаги окраски углов
        window.appState.data.waves.forEach(wave => {
            const waveIdStr = String(wave.id);
            window.appState.waveCornerColor[waveIdStr] = false;
        });
        
        // Вернуть стандартный цвет углов
        this.updateCornerSquareColors();
        
        // Обновить UI
        if (window.dataManager && window.dataManager.updateWavesGroups) {
            window.dataManager.updateWavesGroups();
        }
        
        // Обновить чекбоксы в DOM
        document.querySelectorAll('.wave-corner-color-check').forEach(checkbox => {
            checkbox.checked = false;
        });
        
        window.appState.save();
        
        console.log('Цвет краев сброшен к стандартному');
    }
    
    // Вспомогательный метод для обновления цвета углов
    updateCornerSquareColors() {
        document.querySelectorAll('.corner-square').forEach(square => {
            square.style.backgroundColor = 'red'; // стандартный цвет
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
        console.log('Переключение фона через CSS-класс');
        const graphContainer = document.getElementById('graphContainer');
        if (graphContainer) {
            // ТОЛЬКО ПЕРЕКЛЮЧЕНИЕ CSS-КЛАССА
            graphContainer.classList.toggle('dark-mode');
            
            // Сохраняем состояние: true = светлый (нет класса), false = темный (есть класс)
            window.appState.graphBgWhite = !graphContainer.classList.contains('dark-mode');
            window.appState.save();
            
            console.log('Состояние фона:', window.appState.graphBgWhite ? 'светлый' : 'темный');
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
    
    resetAll() {
        if (!confirm('Сбросить ВСЕ настройки интерфейса к значениям по умолчанию?')) {
            return;
        }
        
        if (!confirm('ВНИМАНИЕ: Это действие нельзя отменить. Все данные будут удалены. Продолжить?')) {
            return;
        }
        
        // ПРОСТОЕ РЕШЕНИЕ: очистить localStorage и перезагрузить
        localStorage.clear();
        
        // Перезагрузка страницы
        window.location.reload();
        
        // ВСЁ! Никакой дополнительной логики не нужно
    }
    
    updateUI() {
        window.dataManager.updateDateList();
        window.dataManager.updateWavesGroups();
        window.dataManager.updateNotesList();
        
        // ИЗМЕНЕНО: Используем новый метод форматирования с секундами
        if (document.getElementById('mainDateInput') && window.dom) {
            document.getElementById('mainDateInput').value = window.dom.formatDateForDateTimeInputWithSeconds(window.appState.currentDate);
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