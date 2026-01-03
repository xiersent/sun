// modules/grid.js - ПОЛНОСТЬЮ ИСПРАВЛЕННЫЙ
class GridManager {
    constructor() {
        this.gridElements = [];
        this.gridContainer = null;
    }
    
    /**
     * ПРАВИЛЬНЫЙ расчет позиции элемента сетки
     * @param {number} offset - Смещение в целых днях от текущего момента
     * @returns {number} Позиция в пикселях относительно центра
     */
    calculateGridPosition(offset) {
        // ПРОСТАЯ ФОРМУЛА:
        // offset - количество целых дней от текущего момента
        // Каждый день = squareSize пикселей
        
        const pixelPosition = offset * window.appState.config.squareSize;
        
        console.log(`Grid: позиция для offset=${offset}: ${pixelPosition}px`);
        
        return {
            actualOffset: offset,
            pixelPosition: pixelPosition
        };
    }
    
    createGrid() {
        console.log('=== СОЗДАНИЕ СЕТКИ ===');
        console.log('currentDay:', window.appState.currentDay);
        console.log('currentDate (UTC):', window.appState.currentDate.toUTCString());
        console.log('baseDate (UTC):', new Date(window.appState.baseDate).toUTCString());
        
        this.clearGrid();
        
        const centerX = window.appState.graphWidth / 2;
        const halfSquaresX = Math.floor(window.appState.config.gridSquaresX / 2);
        
        // 1. ВЫЧИСЛЯЕМ СМЕЩЕНИЕ ОТ ДРОБНОЙ ЧАСТИ ВРЕМЕНИ
        const currentDay = window.appState.currentDay || 0;
        const fractionalOffset = currentDay - Math.floor(currentDay);
        const timeOffsetPx = fractionalOffset * window.appState.config.squareSize;
        
        console.log(`Смещение от дробной части времени:`);
        console.log(`  currentDay: ${currentDay}`);
        console.log(`  fractionalOffset: ${fractionalOffset.toFixed(5)}`);
        console.log(`  timeOffsetPx: ${timeOffsetPx.toFixed(2)}px`);
        
        // 2. СОЗДАЕМ КОНТЕЙНЕР ДЛЯ ВСЕЙ СЕТКИ
        this.gridContainer = document.createElement('div');
        this.gridContainer.className = 'grid-absolute-container';
        this.gridContainer.style.position = 'absolute';
        this.gridContainer.style.width = '100%';
        this.gridContainer.style.height = '100%';
        this.gridContainer.style.top = '0';
        this.gridContainer.style.left = '0';
        
        // 3. ПРИМЕНЯЕМ СМЕЩЕНИЕ КО ВСЕЙ СЕТКЕ
        this.gridContainer.style.transform = `translateX(${timeOffsetPx}px)`;
        this.gridContainer.style.transition = 'none';
        
        // 4. СОЗДАЕМ ЛИНИИ СЕТКИ И МЕТКИ
        for (let i = -halfSquaresX; i <= halfSquaresX + 1; i++) {
            this.createGridLine(i);
            this.createDateLabel(i);
        }
        
        // 5. ДОБАВЛЯЕМ КОНТЕЙНЕР В ГРАФИК
        const graphElement = document.getElementById('graphElement');
        if (graphElement) {
            graphElement.appendChild(this.gridContainer);
        }
        
        // 6. СОЗДАЕМ ГОРИЗОНТАЛЬНЫЕ ЛИНИИ И ОСИ Y
        this.createHorizontalGridLines();
        this.createYAxisLabels();
        
        // 7. ПОДСВЕТКА ЗАМЕТОК
        this.updateGridNotesHighlight();
        
        console.log('=== СЕТКА СОЗДАНА ===');
    }
    
    /**
     * Создает вертикальную линию сетки
     * @param {number} offset - Смещение в днях от текущего момента
     */
    createGridLine(offset) {
        if (!this.gridContainer) return;
        
        const wrapper = document.createElement('div');
        wrapper.className = 'grid-wrapper';
        
        // Позиция относительно центра (без учета дробного смещения)
        const positionData = this.calculateGridPosition(offset);
        
        // Важно: left считается от ЛЕВОГО КРАЯ КОНТЕЙНЕРА СЕТКИ
        // Контейнер уже смещен на timeOffsetPx
        wrapper.style.position = 'absolute';
        wrapper.style.left = `calc(50% + ${positionData.pixelPosition}px)`;
        wrapper.style.width = `${window.appState.config.squareSize}px`;
        wrapper.style.height = '100%';
        wrapper.style.marginLeft = `-${window.appState.config.squareSize / 2}px`;
        wrapper.setAttribute('data-day-offset', offset);
        
        const line = document.createElement('div');
        line.className = 'grid-line-inner';
        
        // Линия "сегодня" (offset = 0)
        if (offset === 0) {
            line.classList.add('active');
            line.style.backgroundColor = '#666'; // Основной цвет
        }
        
        wrapper.appendChild(line);
        this.gridContainer.appendChild(wrapper);
        
        this.gridElements.push(wrapper);
        
        // ОБРАБОТЧИК КЛИКА ПО ЛИНИИ
        wrapper.addEventListener('click', (e) => {
            if (window.appState.isProgrammaticDateChange) return;
            
            e.stopPropagation();
            
            // Убираем активность со всех линий
            document.querySelectorAll('.grid-line-inner').forEach(line => {
                line.classList.remove('active');
            });
            
            // Подсвечиваем выбранную линию (только визуально)
            line.classList.add('active');
            
            // ОБНОВЛЯЕМ СВОДНУЮ ИНФОРМАЦИЮ
            if (window.summaryManager && window.summaryManager.updateSummary) {
                setTimeout(() => {
                    window.summaryManager.updateSummary();
                }, 50);
            }
            
            console.log(`Клик по линии сетки: offset=${offset}`);
        });
    }
    

    
    createHorizontalGridLines() {
        if (!this.gridContainer) return;
        
        for (let i = 1; i <= 5; i++) {
            const topLine = document.createElement('div');
            topLine.className = 'grid-line x';
            topLine.style.position = 'absolute';
            topLine.style.width = '100%';
            topLine.style.height = '1px';
            topLine.style.bottom = `calc(50% + ${i * window.appState.config.squareSize}px)`;
            topLine.style.left = '0';
            topLine.style.zIndex = '1';
            
            const bottomLine = document.createElement('div');
            bottomLine.className = 'grid-line x';
            bottomLine.style.position = 'absolute';
            bottomLine.style.width = '100%';
            bottomLine.style.height = '1px';
            bottomLine.style.bottom = `calc(50% - ${i * window.appState.config.squareSize}px)`;
            bottomLine.style.left = '0';
            bottomLine.style.zIndex = '1';
            
            this.gridContainer.appendChild(topLine);
            this.gridContainer.appendChild(bottomLine);
        }
    }
    
    createYAxisLabels() {
        if (!this.gridContainer) return;
        
        // Нулевая метка
        const zeroLabel = document.createElement('div');
        zeroLabel.className = 'labels y-labels';
        zeroLabel.style.position = 'absolute';
        zeroLabel.style.top = '50%';
        zeroLabel.style.transform = 'translateY(-50%)';
        zeroLabel.style.left = '10px';
        zeroLabel.textContent = '0';
        this.gridContainer.appendChild(zeroLabel);
        
        // Положительные и отрицательные метки
        for (let i = 1; i <= 5; i++) {
            // Положительные (верх)
            const labelTop = document.createElement('div');
            labelTop.className = 'labels y-labels';
            labelTop.style.position = 'absolute';
            labelTop.style.top = `calc(50% + ${i * window.appState.config.squareSize}px)`;
            labelTop.style.transform = 'translateY(-50%)';
            labelTop.style.left = '10px';
            labelTop.textContent = i;
            this.gridContainer.appendChild(labelTop);
            
            // Отрицательные (низ)
            const labelBottom = document.createElement('div');
            labelBottom.className = 'labels y-labels';
            labelBottom.style.position = 'absolute';
            labelBottom.style.top = `calc(50% - ${i * window.appState.config.squareSize}px)`;
            labelBottom.style.transform = 'translateY(-50%)';
            labelBottom.style.left = '10px';
            labelBottom.textContent = -i;
            this.gridContainer.appendChild(labelBottom);
        }
    }
    
    clearGrid() {
        // Удаляем старый контейнер сетки
        const oldContainer = document.querySelector('.grid-absolute-container');
        if (oldContainer) {
            oldContainer.remove();
        }
        
        this.gridElements = [];
        this.gridContainer = null;
        
        // Дополнительно удаляем все метки
        document.querySelectorAll('.labels:not(.center-date-label), .grid-line, .grid-line-inner, .grid-wrapper').forEach(el => {
            if (!el.closest('.grid-absolute-container')) {
                el.remove();
            }
        });
    }
    

// В grid.js обновить отображение дат:

createDateLabel(offset) {
    if (!this.gridContainer) return;
    
    // offset - смещение в целых днях от СЕЙЧАС
    const currentDay = window.appState.currentDay || 0;
    const integerDays = Math.floor(currentDay);
    
    // Дата на линии = базовое время + integerDays + offset
    const date = new Date(window.appState.baseDate);
    date.setDate(date.getDate() + integerDays + offset);
    
    // Позиция метки
    const positionData = this.calculateGridPosition(offset);
    
    // Метка числа
    const label = document.createElement('div');
    label.className = 'labels date-labels';
    label.style.position = 'absolute';
    label.style.left = `calc(50% + ${positionData.pixelPosition}px)`;
    label.style.transform = 'translateX(-50%)';
    label.style.bottom = '30px';
    label.textContent = date.getDate();
    
    // Метка дня недели
    const weekday = document.createElement('div');
    weekday.className = 'labels x-labels weekday-label';
    weekday.style.position = 'absolute';
    weekday.style.left = `calc(50% + ${positionData.pixelPosition}px)`;
    weekday.style.transform = 'translateX(-50%)';
    weekday.style.bottom = '10px';
    weekday.textContent = window.dom.getWeekdayName(date);
    
    this.gridContainer.appendChild(label);
    this.gridContainer.appendChild(weekday);
}

updateCenterDate() {
    const element = document.getElementById('centerDateLabel');
    if (!element) return;
    
    // Используем локальную дату визора
    const date = window.appState.currentDate || new Date();
    
    // Форматируем с секундами в ЛОКАЛЬНОМ времени
    const day = String(date.getDate()).padStart(2, '0');
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const year = date.getFullYear();
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    const seconds = String(date.getSeconds()).padStart(2, '0');
    
    const dateTimeStr = `${day}.${month}.${year} ${hours}:${minutes}:${seconds}`;
    const weekday = window.dom.getWeekdayName(date, true);
    
    // Находим активную дату
    const activeDate = window.appState.data.dates.find(d => d.id === window.appState.activeDateId);
    const name = activeDate?.name || 'Новая дата';
    
    // HTML с секундами
    element.innerHTML = `
        <div class="center-date-main">
            <div class="center-date-datetime">${dateTimeStr}</div>
            <div class="center-name-container">
                <div class="center-date-name">${name}</div>
                <div class="center-date-star">☼</div>
            </div>
        </div>
        <div class="center-date-weekday">${weekday}</div>
    `;
}

    
    updateGridNotesHighlight() {
        if (!this.gridContainer) return;
        
        this.gridElements.forEach(wrapper => {
            const offset = parseInt(wrapper.dataset.dayOffset);
            const line = wrapper.querySelector('.grid-line-inner');
            if (!line) return;
            
            line.classList.remove('has-notes');
            
            // Вычисляем дату для этой линии
            const currentDay = window.appState.currentDay || 0;
            const integerDays = Math.floor(currentDay);
            
            const targetDate = new Date(window.appState.baseDate);
            targetDate.setDate(targetDate.getDate() + integerDays + offset);
            
            // Ищем заметки для этой даты
            const notesForDate = window.appState.data.notes.filter(note => {
                const noteDate = new Date(note.date);
                return noteDate.toDateString() === targetDate.toDateString();
            });
            
            if (notesForDate.length > 0) {
                line.classList.add('has-notes');
                line.style.backgroundColor = '#ff0000'; // Красный для заметок
            }
        });
    }
    
    /**
     * Обновляет смещение сетки при изменении времени
     * Вызывается при каждом изменении currentDay
     */
    updateGridOffset() {
        if (!this.gridContainer) return;
        
        const currentDay = window.appState.currentDay || 0;
        const fractionalOffset = currentDay - Math.floor(currentDay);
        const timeOffsetPx = fractionalOffset * window.appState.config.squareSize;
        
        // Плавное смещение сетки
        this.gridContainer.style.transition = 'transform 0.3s ease';
        this.gridContainer.style.transform = `translateX(${timeOffsetPx}px)`;
        
        // Обновляем метки дат
        this.updateDateLabels();
        
        console.log(`Grid: обновлено смещение: ${timeOffsetPx.toFixed(2)}px`);
    }
    
    /**
     * Обновляет метки дат при изменении текущей даты
     */
    updateDateLabels() {
        if (!this.gridContainer) return;
        
        // Удаляем старые метки
        this.gridContainer.querySelectorAll('.date-labels, .weekday-label').forEach(el => el.remove());
        
        // Создаем новые метки
        const halfSquaresX = Math.floor(window.appState.config.gridSquaresX / 2);
        for (let i = -halfSquaresX; i <= halfSquaresX + 1; i++) {
            this.createDateLabel(i);
        }
    }
}

window.grid = new GridManager();