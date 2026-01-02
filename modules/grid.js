// modules/grid.js
class GridManager {
    constructor() {
        this.gridElements = [];
    }
    
calculateGridPosition(offset) {
    const currentDayFractional = window.appState.currentDay || 0;
    const fractionalOffset = currentDayFractional - Math.floor(currentDayFractional);
    
    // ПРАВИЛЬНАЯ ФОРМУЛА:
    // offset - это количество полных дней от ТЕКУЩЕГО МОМЕНТА
    // Линия "сегодня" (offset = 0) должна быть на текущем времени
    // Линии смещаются на целые дни от текущего времени
    
    // Для времени 12:00 (0.5 дня):
    // offset = 0: actualOffset = -0.5 (смещаем на 0.5 влево)
    // offset = 1: actualOffset = 0.5 (смещаем на 0.5 вправо - это завтра 12:00)
    // offset = -1: actualOffset = -1.5 (смещаем на 1.5 влево - это вчера 12:00)
    
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
    
	// modules/grid.js
	createGridLine(offset) {
		const wrapper = document.createElement('div');
		wrapper.className = 'grid-wrapper';
		
		// ИСПРАВЛЕННЫЙ РАСЧЕТ: используем единую функцию
		const positionData = this.calculateGridPosition(offset);
		
		// ВАЖНО: Правильное позиционирование с учетом дробной части времени
		// Если fractionalOffset = 0.564 (13:33), линия смещается вправо на 0.564 дня
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
		
		// Клик по линии сетки НЕ ДОЛЖЕН менять дату визора!
		wrapper.addEventListener('click', (e) => {
			if (window.appState.isProgrammaticDateChange) return;
			
			e.stopPropagation(); // Важно: останавливаем всплытие
			
			const gridLines = document.querySelectorAll('.grid-line-inner');
			gridLines.forEach(line => {
				line.classList.remove('active');
			});
			
			// ВАЖНО: ТОЛЬКО визуальная подсветка выбранной линии!
			// НЕ изменяем текущую дату визора!
			line.classList.add('active');
			
			// При клике на линии сетки обновляем сводную информацию,
			// так как пользователь может смотреть на конкретную дату
			if (window.summaryManager && window.summaryManager.updateSummary) {
				setTimeout(() => {
					window.summaryManager.updateSummary();
				}, 50);
			}
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
    // offset - это смещение в днях от текущего момента
    // Чтобы показать правильную дату на линии, нужно прибавить смещение
    // к целой части currentDay
    
    const currentDay = window.appState.currentDay || 0;
    const dayOffset = Math.floor(currentDay) + offset;
    
    // Создаем дату от базовой даты
    const date = new Date(window.appState.baseDate);
    date.setDate(date.getDate() + dayOffset);
    
    const label = document.createElement('div');
    label.className = 'labels date-labels';
    
    const positionData = this.calculateGridPosition(offset);
    
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
                    <div class="center-date-star">☼</div>
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
            
            const targetDate = new Date(window.appState.currentDate);
            targetDate.setDate(targetDate.getDate() + offset);
            
            const notesForDate = window.appState.data.notes.filter(note => {
                const noteDate = new Date(note.date);
                return noteDate.toDateString() === targetDate.toDateString();
            });
            
            if (notesForDate.length > 0) {
                line.classList.add('has-notes');
            }
        });
    }
}

window.grid = new GridManager();