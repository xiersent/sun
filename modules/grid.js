class GridManager {
    constructor() {
        this.gridElements = [];
        this.gridContainer = null;
        this.staticElementsContainer = null;
    }
    
    calculateGridPosition(offset) {
        const pixelPosition = offset * window.appState.config.squareSize;
        
        return {
            actualOffset: offset,
            pixelPosition: pixelPosition
        };
    }
    
	createGrid() {
		this.clearGrid();
		
		const centerX = window.appState.graphWidth / 2;
		const halfSquaresX = Math.floor(window.appState.config.gridSquaresX / 2);
		
		const currentDay = window.appState.currentDay || 0;
		const fractionalOffset = currentDay - Math.floor(currentDay);
		const timeOffsetPx = fractionalOffset * window.appState.config.squareSize;
		
		this.gridContainer = document.createElement('div');
		this.gridContainer.className = 'grid-absolute-container';
		this.gridContainer.style.position = 'absolute';
		this.gridContainer.style.width = '100%';
		this.gridContainer.style.height = '100%';
		this.gridContainer.style.top = '0';
		this.gridContainer.style.left = '0';
		
		this.gridContainer.style.transform = `translateX(${-timeOffsetPx}px)`;
		this.gridContainer.style.transition = 'none';
		
		this.staticElementsContainer = document.createElement('div');
		this.staticElementsContainer.className = 'grid-static-container';
		this.staticElementsContainer.style.position = 'absolute';
		this.staticElementsContainer.style.width = '100%';
		this.staticElementsContainer.style.height = '100%';
		this.staticElementsContainer.style.top = '0';
		this.staticElementsContainer.style.left = '0';
		this.staticElementsContainer.style.pointerEvents = 'none';
		this.staticElementsContainer.style.zIndex = '5';
		
		// ИЗМЕНЕНИЕ: начинаем с -halfSquaresX + 1, а не с -halfSquaresX
		for (let i = -halfSquaresX + 1; i <= halfSquaresX; i++) {
			this.createGridLine(i);
			this.createDateLabel(i);
		}
		
		this.createHorizontalGridLines();
		this.createYAxisLabels();
		
		const graphElement = document.getElementById('graphElement');
		if (graphElement) {
			graphElement.appendChild(this.staticElementsContainer);
			graphElement.appendChild(this.gridContainer);
		}
		
		this.updateGridNotesHighlight();
	}
    
    createGridLine(offset) {
        if (!this.gridContainer) return;
        
        const wrapper = document.createElement('div');
        wrapper.className = 'grid-wrapper';
        
        const positionData = this.calculateGridPosition(offset);
        
        wrapper.style.position = 'absolute';
        wrapper.style.left = `calc(50% + ${positionData.pixelPosition}px)`;
        wrapper.style.width = `${window.appState.config.squareSize}px`;
        wrapper.style.height = '100%';
        wrapper.style.marginLeft = `-${window.appState.config.squareSize / 2}px`;
        wrapper.setAttribute('data-day-offset', offset);
        
        const line = document.createElement('div');
        line.className = 'grid-line-inner';
        
        const currentDay = window.appState.currentDay || 0;
        const integerPart = Math.floor(currentDay);
        const fractionalPart = currentDay - integerPart;
        
        const isExactlyOnLine = Math.abs(fractionalPart) < 0.001 && offset === integerPart;
        
        if (isExactlyOnLine) {
            line.classList.add('active');
            line.style.backgroundColor = '#666';
        }
        
        wrapper.appendChild(line);
        this.gridContainer.appendChild(wrapper);
        
        this.gridElements.push(wrapper);
        
        wrapper.addEventListener('click', (e) => {
            if (window.appState.isProgrammaticDateChange) return;
            
            e.stopPropagation();
            
            document.querySelectorAll('.grid-line-inner').forEach(line => {
                line.classList.remove('active');
            });
            
            line.classList.add('active');
            
            if (window.summaryManager && window.summaryManager.updateSummary) {
                setTimeout(() => {
                    window.summaryManager.updateSummary();
                }, 50);
            }
        });
    }
    
    createDateLabel(offset) {
        if (!this.gridContainer) return;
        
        const adjustedOffset = -offset;
        
        const currentDay = window.appState.currentDay || 0;
        const date = new Date(window.appState.baseDate);
        date.setDate(date.getDate() + Math.floor(currentDay) + adjustedOffset);
        
        const positionData = this.calculateGridPosition(adjustedOffset);
        
        const label = document.createElement('div');
        label.className = 'labels date-labels';
        label.style.position = 'absolute';
        label.style.left = `calc(50% + ${positionData.pixelPosition}px)`;
        label.style.transform = 'translateX(-50%)';
        label.style.bottom = '30px';
        label.textContent = date.getDate();
        
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
    
	createHorizontalGridLines() {
		if (!this.staticElementsContainer) return;
		
		for (let i = 1; i <= 4; i++) {
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
			
			this.staticElementsContainer.appendChild(topLine);
			this.staticElementsContainer.appendChild(bottomLine);
		}
	}
    
	createYAxisLabels() {
		if (!this.staticElementsContainer) return;
		
		const zeroLabel = document.createElement('div');
		zeroLabel.className = 'labels y-labels';
		zeroLabel.style.position = 'absolute';
		zeroLabel.style.top = '50%';
		zeroLabel.style.transform = 'translateY(-50%)';
		zeroLabel.style.left = '10px';
		zeroLabel.textContent = '0';
		this.staticElementsContainer.appendChild(zeroLabel);
		
		for (let i = 1; i <= 4; i++) {
			const labelTop = document.createElement('div');
			labelTop.className = 'labels y-labels';
			labelTop.style.position = 'absolute';
			labelTop.style.top = `calc(50% - ${i * window.appState.config.squareSize}px)`;
			labelTop.style.transform = 'translateY(-50%)';
			labelTop.style.left = '10px';
			labelTop.textContent = i + 1;
			this.staticElementsContainer.appendChild(labelTop);
			
			const labelBottom = document.createElement('div');
			labelBottom.className = 'labels y-labels';
			labelBottom.style.position = 'absolute';
			labelBottom.style.top = `calc(50% + ${i * window.appState.config.squareSize}px)`;
			labelBottom.style.transform = 'translateY(-50%)';
			labelBottom.style.left = '10px';
			labelBottom.textContent = -(i + 1);
			this.staticElementsContainer.appendChild(labelBottom);
		}
	}
    
    clearGrid() {
        const oldContainer = document.querySelector('.grid-absolute-container');
        if (oldContainer) {
            oldContainer.remove();
        }
        
        const oldStatic = document.querySelector('.grid-static-container');
        if (oldStatic) {
            oldStatic.remove();
        }
        
        this.gridElements = [];
        this.gridContainer = null;
        this.staticElementsContainer = null;
        
        document.querySelectorAll('.labels:not(.center-date-label), .grid-line, .grid-line-inner, .grid-wrapper').forEach(el => {
            el.remove();
        });
    }
    
    updateCenterDate() {
        const element = document.getElementById('centerDateLabel');
        if (!element) return;
        
        const date = window.appState.currentDate || new Date();
        
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
            
            const currentDay = window.appState.currentDay || 0;
            const integerDays = Math.floor(currentDay);
            
            const targetDate = new Date(window.appState.baseDate);
            targetDate.setDate(targetDate.getDate() + integerDays + offset);
            
            const notesForDate = window.appState.data.notes.filter(note => {
                const noteDate = new Date(note.date);
                return noteDate.toDateString() === targetDate.toDateString();
            });
            
            if (notesForDate.length > 0) {
                line.classList.add('has-notes');
                line.style.backgroundColor = '#ff0000';
            }
        });
    }
    
    updateGridOffset() {
        if (!this.gridContainer) return;
        
        const currentDay = window.appState.currentDay || 0;
        const fractionalOffset = currentDay - Math.floor(currentDay);
        const timeOffsetPx = fractionalOffset * window.appState.config.squareSize;
        
        const invertedTimeOffsetPx = -timeOffsetPx;
        
        this.gridContainer.style.transform = `translateX(${invertedTimeOffsetPx}px)`;
    }
    
    updateDateLabels() {
        if (!this.gridContainer) return;
        
        this.gridContainer.querySelectorAll('.date-labels, .weekday-label').forEach(el => el.remove());
        
        const halfSquaresX = Math.floor(window.appState.config.gridSquaresX / 2);
        for (let i = -halfSquaresX; i <= halfSquaresX + 1; i++) {
            this.createDateLabel(i);
        }
    }
}

window.grid = new GridManager();