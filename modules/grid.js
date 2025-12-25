// modules/grid.js
class GridManager {
    constructor() {
        this.gridElements = [];
    }
    
    // НОВЫЙ МЕТОД: единая функция расчета позиции
    calculateGridPosition(offset) {
        const currentDayFractional = window.appState.currentDay || 0;
        const fractionalOffset = currentDayFractional - Math.floor(currentDayFractional);
        
        // НОВАЯ ФОРМУЛА: корректное смещение для дробных дней
        const actualOffset = offset - fractionalOffset;
        
        return {
            actualOffset,
            pixelPosition: actualOffset * window.appState.config.squareSize
        };
    }
    
    createGrid() {
        this.clearGrid();
        
        const centerX = window.appState.graphWidth / 2;
        const halfSquaresX = Math.floor(window.appState.config.gridSquaresX / 2);
        
        for (let i = -halfSquaresX; i <= halfSquaresX + 1; i++) {
            this.createGridLine(i);
            this.createDateLabel(i);
        }
        
        this.createHorizontalGridLines();
        this.createYAxisLabels();
        this.updateGridNotesHighlight();
    }
    
    createGridLine(offset) {
        const wrapper = document.createElement('div');
        wrapper.className = 'grid-wrapper';
        
        // ИСПРАВЛЕННЫЙ РАСЧЕТ: используем единую функцию
        const positionData = this.calculateGridPosition(offset);
        
        // ВАЖНО: Все линии позиционируются одинаково
        // Центральная линия будет на calc(50% + 0px)
        wrapper.style.left = `calc(50% + ${positionData.pixelPosition}px)`;
        wrapper.style.width = `${window.appState.config.squareSize}px`;
        wrapper.setAttribute('data-day-offset', offset);
        
        // КЛЮЧЕВОЕ ИСПРАВЛЕНИЕ: Вместо transform используем margin для центрирования
        wrapper.style.marginLeft = `-${window.appState.config.squareSize / 2}px`;
        
        const line = document.createElement('div');
        line.className = 'grid-line-inner';
        if (offset === 0) line.classList.add('active');
        
        wrapper.appendChild(line);
        document.getElementById('graphElement').appendChild(wrapper);
        
        this.gridElements.push(wrapper);
        
        // Обработчик клика
        wrapper.addEventListener('click', (e) => {
            if (window.appState.isProgrammaticDateChange) return;
            
            e.stopPropagation(); // Важно: останавливаем всплытие
            
            const gridLines = document.querySelectorAll('.grid-line-inner');
            gridLines.forEach(line => {
                line.classList.remove('active');
            });
            
            // ВАЖНО: Клик на центральную линию тоже должен работать
            // Если нажали на центральную линию, она уже активна
            // Если нажали на другую - активируем ее
            line.classList.add('active');
        });
    }
    
    createHorizontalGridLines() {
        for (let i = 1; i <= 5; i++) {
            const topLine = document.createElement('div');
            topLine.className = 'grid-line x';
            topLine.style.width = '100%';
            topLine.style.height = '1px';
            topLine.style.position = 'absolute';
            topLine.style.bottom = `calc(50% + ${i * window.appState.config.squareSize}px)`;
            topLine.style.left = '0';
            topLine.style.zIndex = '1';
            
            const bottomLine = document.createElement('div');
            bottomLine.className = 'grid-line x';
            bottomLine.style.width = '100%';
            bottomLine.style.height = '1px';
            bottomLine.style.position = 'absolute';
            bottomLine.style.bottom = `calc(50% - ${i * window.appState.config.squareSize}px)`;
            bottomLine.style.left = '0';
            bottomLine.style.zIndex = '1';
            
            document.getElementById('graphElement').appendChild(topLine);
            document.getElementById('graphElement').appendChild(bottomLine);
        }
    }
    
    createDateLabel(offset) {
        const date = new Date(window.appState.currentDate);
        date.setDate(date.getDate() + offset);
        
        const label = document.createElement('div');
        label.className = 'labels date-labels';
        
        // ТАКОЕ ЖЕ ИСПРАВЛЕНИЕ КАК ДЛЯ ЛИНИЙ: используем единую функцию
        const positionData = this.calculateGridPosition(offset);
        
        // ВАЖНО: Такое же позиционирование как у линий
        label.style.left = `calc(50% + ${positionData.pixelPosition}px)`;
        label.style.transform = 'translateX(-50%)';
        label.style.bottom = '30px';
        label.textContent = date.getDate();
        
        const weekday = document.createElement('div');
        weekday.className = 'labels x-labels weekday-label';
        weekday.style.left = `calc(50% + ${positionData.pixelPosition}px)`;
        weekday.style.transform = 'translateX(-50%)';
        weekday.style.bottom = '10px';
        weekday.textContent = window.dom.getWeekdayName(date);
        
        const graph = document.getElementById('graphElement');
        graph.appendChild(label);
        graph.appendChild(weekday);
    }
    
    createYAxisLabels() {
        for (let i = 0; i <= 5; i++) {
            if (i !== 0) {
                const labelTop = document.createElement('div');
                labelTop.className = 'labels y-labels';
                labelTop.style.top = `calc(50% + ${i * window.appState.config.squareSize}px)`;
                labelTop.style.transform = 'translateY(-50%)';
                labelTop.textContent = i;
                
                const labelBottom = document.createElement('div');
                labelBottom.className = 'labels y-labels';
                labelBottom.style.top = `calc(50% - ${i * window.appState.config.squareSize}px)`;
                labelBottom.style.transform = 'translateY(-50%)';
                labelBottom.textContent = -i;
                
                document.getElementById('graphElement').appendChild(labelTop);
                document.getElementById('graphElement').appendChild(labelBottom);
            }
        }
        
        const zeroLabel = document.createElement('div');
        zeroLabel.className = 'labels y-labels';
        zeroLabel.style.top = '50%';
        zeroLabel.style.transform = 'translateY(-50%)';
        zeroLabel.textContent = '0';
        document.getElementById('graphElement').appendChild(zeroLabel);
    }
    
    clearGrid() {
        this.gridElements.forEach(el => el.remove());
        this.gridElements = [];
        
        // Удаляем ВСЕ метки, включая даты
        document.querySelectorAll('.labels:not(.center-date-label), .grid-line, .grid-line-inner, .grid-wrapper').forEach(el => el.remove());
    }
    
    updateCenterDate() {
        const element = document.getElementById('centerDateLabel');
        if (!element) return;
        
        // Гарантируем, что используем текущую дату визора
        const date = window.appState.currentDate || new Date();
        
        // ОБНОВЛЕНО: Форматируем с секундами
        const day = String(date.getDate()).padStart(2, '0');
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const year = date.getFullYear();
        const hours = String(date.getHours()).padStart(2, '0');
        const minutes = String(date.getMinutes()).padStart(2, '0');
        const seconds = String(date.getSeconds()).padStart(2, '0');
        
        const dateTimeStr = `${day}.${month}.${year} ${hours}:${minutes}:${seconds}`;
        const weekday = window.dom.getWeekdayName(date, true);
        
        const activeDate = window.appState.data.dates.find(d => d.id === window.appState.activeDateId);
        const name = activeDate?.name || 'Новая дата';
        
        // ОБНОВЛЕННЫЙ HTML с секундами
        element.innerHTML = `
            <div class="center-date-main">
                <div class="center-date-datetime">${dateTimeStr}</div>
                <div class="center-name-container">
                    <div class="center-date-name">${name}</div>
                    <div class="center-date-star">★</div>
                </div>
            </div>
            <div class="center-date-weekday">${weekday}</div>
        `;
    }
    
    updateGridNotesHighlight() {
        this.gridElements.forEach(wrapper => {
            const offset = parseInt(wrapper.dataset.dayOffset);
            const line = wrapper.querySelector('.grid-line-inner');
            line.classList.remove('has-notes');
            
            const tooltip = wrapper.querySelector('.grid-line-tooltip');
            if (tooltip) {
                tooltip.remove();
            }
            
            const targetDate = new Date(window.appState.currentDate);
            targetDate.setDate(targetDate.getDate() + offset);
            
            const notesForDate = window.appState.data.notes.filter(note => {
                const noteDate = new Date(note.date);
                return noteDate.toDateString() === targetDate.toDateString();
            });
            
            if (notesForDate.length > 0) {
                line.classList.add('has-notes');
                
                const tooltip = document.createElement('div');
                tooltip.className = 'grid-line-tooltip';
                tooltip.textContent = `${notesForDate.length} запис${notesForDate.length === 1 ? 'ь' : 'ей'}`;
                wrapper.appendChild(tooltip);
            }
        });
    }
}

window.grid = new GridManager();