class GridManager {
    constructor() {
        this.gridElements = [];
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
        wrapper.style.left = `calc(50% + ${offset * window.appState.config.squareSize - window.appState.config.squareSize / 2}px)`;
        wrapper.style.width = `${window.appState.config.squareSize}px`;
        wrapper.setAttribute('data-day-offset', offset);
        
        const line = document.createElement('div');
        line.className = 'grid-line-inner';
        if (offset === 0) line.classList.add('active');
        
        wrapper.appendChild(line);
        document.getElementById('graphElement').appendChild(wrapper);
        
        this.gridElements.push(wrapper);
        
        // Обработчик клика - только выделение, без переключения даты
        wrapper.addEventListener('click', (e) => {
            if (window.appState.isProgrammaticDateChange) return;
            
            const gridLines = document.querySelectorAll('.grid-line-inner');
            gridLines.forEach(line => {
                line.classList.remove('active');
            });
            
            if (parseInt(wrapper.getAttribute('data-day-offset')) !== 0) {
                line.classList.add('active');
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
            topLine.style.backgroundColor = window.appState.graphBgWhite ? '#eee' : '#444';
            topLine.style.zIndex = '1';
            
            const bottomLine = document.createElement('div');
            bottomLine.className = 'grid-line x';
            bottomLine.style.width = '100%';
            bottomLine.style.height = '1px';
            bottomLine.style.position = 'absolute';
            bottomLine.style.bottom = `calc(50% - ${i * window.appState.config.squareSize}px)`;
            bottomLine.style.left = '0';
            bottomLine.style.backgroundColor = window.appState.graphBgWhite ? '#eee' : '#444';
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
        label.style.left = `calc(50% + ${offset * window.appState.config.squareSize}px)`;
        label.textContent = date.getDate();
        
        const weekday = document.createElement('div');
        weekday.className = 'labels x-labels weekday-label';
        weekday.style.left = `calc(50% + ${offset * window.appState.config.squareSize}px)`;
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
                labelTop.textContent = i;
                
                const labelBottom = document.createElement('div');
                labelBottom.className = 'labels y-labels';
                labelBottom.style.top = `calc(50% - ${i * window.appState.config.squareSize}px)`;
                labelBottom.textContent = -i;
                
                document.getElementById('graphElement').appendChild(labelTop);
                document.getElementById('graphElement').appendChild(labelBottom);
            }
        }
        
        const zeroLabel = document.createElement('div');
        zeroLabel.className = 'labels y-labels';
        zeroLabel.style.top = '50%';
        zeroLabel.textContent = '0';
        document.getElementById('graphElement').appendChild(zeroLabel);
    }
    
    clearGrid() {
        this.gridElements.forEach(el => el.remove());
        this.gridElements = [];
        
        document.querySelectorAll('.labels:not(.center-date-label), .grid-line, .grid-line-inner, .grid-wrapper').forEach(el => el.remove());
    }
    
    updateCenterDate() {
        const element = document.getElementById('centerDateLabel');
        if (!element) return;
        
        const date = window.appState.currentDate;
        const dateStr = window.dom.formatDate(date);
        const weekday = window.dom.getWeekdayName(date, true);
        
        const activeDate = window.appState.data.dates.find(d => d.id === window.appState.activeDateId);
        const name = activeDate?.name || 'Новая дата';
        
        element.innerHTML = `
            <div class="center-date-date">${dateStr}</div>
            <div class="center-name-container">
                <div class="center-date-name">${name}</div>
                <div class="center-date-star">★</div>
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