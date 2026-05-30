class GridManager {
    constructor() {
        this.gridElements = [];
        this.gridContainer = null;
        this.staticElementsContainer = null;
        /** Сигнатура раскладки; при смене — нужен полный createGrid */
        this._lastGridLayoutSignature = null;
    }
    
    calculateGridPosition(offset) {
        let displayOffset = offset;
        if (window.wavesTransformLayer && window.wavesTransformLayer.mapGridDayOffset) {
            displayOffset = window.wavesTransformLayer.mapGridDayOffset(offset);
        }
        const pixelPosition = displayOffset * window.appState.config.squareSize;

        return {
            actualOffset: offset,
            pixelPosition: pixelPosition
        };
    }

    calculateGridYPosition(level) {
        let displayLevel = Number(level);
        if (Number.isNaN(displayLevel)) {
            displayLevel = 0;
        }
        if (window.wavesTransformLayer && window.wavesTransformLayer.mapGridYLevel) {
            displayLevel = window.wavesTransformLayer.mapGridYLevel(level);
        }
        const sq = window.appState.config.squareSize;
        return {
            actualLevel: level,
            displayLevel,
            labelTop: `calc(50% - ${displayLevel * sq}px)`,
            lineBottom: `calc(50% + ${displayLevel * sq}px)`
        };
    }

    /** flipH → даты, flipV → Y-метки и горизонтальные линии. */
    applyFlipState() {
        if (!window.appState.hasActivePerson()) {
            return;
        }
        this._ensureGridContainerRefs();
        if (this.staticElementsContainer && !this.staticElementsContainer.querySelector('[data-y-level]')) {
            this.staticElementsContainer
                .querySelectorAll('.grid-line.x, .labels.y-labels')
                .forEach((el) => el.remove());
            this.createHorizontalGridLines();
            this.createYAxisLabels();
        }
        this._applyGridHorizontalMirrorPositions();
        this._applyGridVerticalMirrorPositions();
    }

    _applyGridVerticalMirrorPositions() {
        this._ensureGridContainerRefs();
        if (!this.staticElementsContainer) {
            return;
        }
        this.staticElementsContainer.querySelectorAll('[data-y-level]').forEach((el) => {
            const level = parseInt(el.getAttribute('data-y-level'), 10);
            if (Number.isNaN(level)) {
                return;
            }
            const pos = this.calculateGridYPosition(level);
            if (el.classList.contains('y-labels')) {
                el.style.top = pos.labelTop;
                el.style.bottom = '';
                el.style.transform = 'translateY(-50%)';
            } else if (el.classList.contains('grid-line')) {
                el.style.bottom = pos.lineBottom;
            }
        });
    }

    _ensureGridContainerRefs() {
        if (!this.gridContainer || !this.gridContainer.isConnected) {
            this.gridContainer = document.querySelector('.grid-absolute-container');
        }
        if (!this.staticElementsContainer || !this.staticElementsContainer.isConnected) {
            this.staticElementsContainer = document.querySelector('.grid-static-container');
        }
    }

    _applyGridHorizontalMirrorPositions() {
        this._ensureGridContainerRefs();
        if (!this.gridContainer) {
            return;
        }
        const applyOffset = (el, offset) => {
            const positionData = this.calculateGridPosition(offset);
            el.style.left = `calc(50% + ${positionData.pixelPosition}px)`;
        };
        this.gridContainer.querySelectorAll('[data-day-offset]').forEach((el) => {
            const offset = parseInt(el.getAttribute('data-day-offset'), 10);
            if (!Number.isNaN(offset)) {
                applyOffset(el, offset);
            }
        });
        this.gridContainer.querySelectorAll('.grid-wrapper[data-day-offset]').forEach((wrapper) => {
            const offset = parseInt(wrapper.getAttribute('data-day-offset'), 10);
            if (!Number.isNaN(offset)) {
                applyOffset(wrapper, offset);
            }
        });
    }

    /** Подписи дат по краям видимой сетки: −12…+13 при 24 клетках (край справа при конце дня). */
    _getDayLabelOffsetRange() {
        const half = Math.floor(window.appState.config.gridSquaresX / 2);
        return { min: -half, max: half + 1 };
    }

    /** Вертикальные линии сетки — без крайних (они сливаются с outline графика). */
    _getDayGridLineOffsetRange() {
        const half = Math.floor(window.appState.config.gridSquaresX / 2);
        return { min: -half + 1, max: half };
    }
    
	createGrid() {
		this.clearGrid();
		
		if (!window.appState.hasActivePerson()) {
			this.updateCenterDate();
			return;
		}
		
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
		this.staticElementsContainer.style.zIndex = '9';
		
		const labelRange = this._getDayLabelOffsetRange();
		const lineRange = this._getDayGridLineOffsetRange();
		for (let i = labelRange.min; i <= labelRange.max; i++) {
			this.createDateLabel(i);
		}
		for (let i = lineRange.min; i <= lineRange.max; i++) {
			this.createGridLine(i);
		}

		this.createHorizontalGridLines();
		this.createYAxisLabels();
		
		const graphElement = document.getElementById('graphElement');
		if (graphElement) {
			graphElement.appendChild(this.staticElementsContainer);
			graphElement.appendChild(this.gridContainer);
		}
		
		this.updateGridNotesHighlight();
        this._lastGridLayoutSignature = this._getGridLayoutSignature();
        this.applyFlipState();
	}

    _getGridLayoutSignature() {
        const c = window.appState.config;
        return [c.gridSquaresX, c.squareSize, window.appState.graphWidth, window.appState.graphHeight].join('|');
    }

    /**
     * Быстрое обновление при смене currentDay / currentDate на визоре без сноса DOM сетки.
     * Если сетки нет или изменилась геометрия — вызывает createGrid().
     * @param {{ light?: boolean }} [opts] light: без подсветки заметок (откладывается до settle)
     */
    refreshForCurrentDay(opts = {}) {
        const light = opts.light === true;
        if (!window.appState.hasActivePerson()) {
            this.clearGrid();
            this.updateCenterDate();
            return;
        }
        const sig = this._getGridLayoutSignature();
        if (!this.gridContainer || !this.staticElementsContainer || this._lastGridLayoutSignature !== sig) {
            this.createGrid();
            return;
        }
        this.updateGridOffset();
        this.updateDateLabels();
        if (!light) {
            this.updateGridNotesHighlight();
        }
        this._syncGridLineActivesForVizor();
        this.applyFlipState();
    }

    _syncGridLineActivesForVizor() {
        const currentDay = window.appState.currentDay || 0;
        const integerPart = Math.floor(currentDay);
        const fractionalPart = currentDay - integerPart;
        this.gridElements.forEach((wrapper) => {
            const line = wrapper.querySelector('.grid-line-inner');
            if (!line) return;
            const offset = parseInt(wrapper.getAttribute('data-day-offset'), 10);
            if (Number.isNaN(offset)) return;
            const isExactlyOnLine = Math.abs(fractionalPart) < 0.001 && offset === integerPart;
            line.classList.toggle('active', isExactlyOnLine);
            if (line.classList.contains('has-notes')) {
                return;
            }
            if (isExactlyOnLine) {
                line.style.backgroundColor = '#666';
            } else {
                line.style.backgroundColor = '';
            }
        });
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
                window.summaryManager.updateSummary();
            }
        });
    }
    
    createDateLabel(offset) {
        if (!this.gridContainer) return;
        
        const currentDay = window.appState.currentDay || 0;
        const date = new Date(window.appState.baseDate);
        date.setDate(date.getDate() + Math.floor(currentDay) + offset);
        
        const positionData = this.calculateGridPosition(offset);
        
        const label = document.createElement('div');
        label.className = 'labels date-labels';
        label.style.position = 'absolute';
        label.style.left = `calc(50% + ${positionData.pixelPosition}px)`;
        label.style.transform = 'translateX(-50%)';
        label.style.bottom = '30px';
        label.setAttribute('data-day-offset', String(offset));
        label.textContent = date.getDate();
        
        const weekday = document.createElement('div');
        weekday.className = 'labels x-labels weekday-label';
        weekday.style.position = 'absolute';
        weekday.style.left = `calc(50% + ${positionData.pixelPosition}px)`;
        weekday.style.transform = 'translateX(-50%)';
        weekday.style.bottom = '10px';
        weekday.setAttribute('data-day-offset', String(offset));
        weekday.textContent = window.dom.getWeekdayName(date);
        
        this.gridContainer.appendChild(label);
        this.gridContainer.appendChild(weekday);
    }
    
	createHorizontalGridLines() {
		if (!this.staticElementsContainer) return;

		const halfSquaresY = Math.floor(
			window.appState.config.graphHeight / window.appState.config.squareSize / 2
		);
		for (let i = 1; i < halfSquaresY; i++) {
			[i, -i].forEach((level) => {
				const pos = this.calculateGridYPosition(level);
				const line = document.createElement('div');
				line.className = 'grid-line x';
				line.style.position = 'absolute';
				line.style.width = '100%';
				line.style.height = '1px';
				line.style.left = '0';
				line.style.bottom = pos.lineBottom;
				line.setAttribute('data-y-level', String(level));
				this.staticElementsContainer.appendChild(line);
			});
		}
	}
    
	createYAxisLabels() {
		if (!this.staticElementsContainer) return;

		const add = (level) => {
			const pos = this.calculateGridYPosition(level);
			const el = document.createElement('div');
			el.className = 'labels y-labels';
			el.style.position = 'absolute';
			el.style.left = '10px';
			el.style.top = pos.labelTop;
			el.style.transform = 'translateY(-50%)';
			el.setAttribute('data-y-level', String(level));
			el.textContent = String(level);
			this.staticElementsContainer.appendChild(el);
		};

		add(0);
		for (let i = 1; i <= 5; i++) {
			add(i);
			add(-i);
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
        this._lastGridLayoutSignature = null;

        document.querySelectorAll('.labels:not(.center-date-label), .grid-line, .grid-line-inner, .grid-wrapper').forEach(el => {
            el.remove();
        });
    }
    
    updateCenterDate() {
        const element = document.getElementById('centerDateLabel');
        if (!element) return;
        
        if (!window.appState.hasActivePerson()) {
            element.innerHTML = `
                <div class="center-date-main">
                    <div class="center-date-datetime" style="opacity:0.85">Нет выбранной персоны</div>
                    <div class="center-name-container">
                        <div class="center-date-name">Выберите персону в списке дат</div>
                    </div>
                </div>
                <div class="center-date-weekday">График и расчёты недоступны</div>
            `;
            return;
        }
        
        const date = window.appState.currentDate || new Date();
        
        const day = String(date.getDate()).padStart(2, '0');
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const year = date.getFullYear();
        const hours = String(date.getHours()).padStart(2, '0');
        const minutes = String(date.getMinutes()).padStart(2, '0');
        const seconds = String(date.getSeconds()).padStart(2, '0');
        
        const dateTimeStr = `${day}.${month}.${year} ${hours}:${minutes}:${seconds}`;
        const weekday = window.dom.getWeekdayName(date, true);
        
        const activeDate = window.appState.data.dates.find(
            (d) => String(d.id) === String(window.appState.activeDateId)
        );
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

        const dateLabels = this.gridContainer.querySelectorAll('.date-labels[data-day-offset]');
        if (dateLabels.length > 0) {
            const currentDay = window.appState.currentDay || 0;
            const integerDays = Math.floor(currentDay);
            dateLabels.forEach((label) => {
                const offset = parseInt(label.getAttribute('data-day-offset'), 10);
                if (Number.isNaN(offset)) {
                    return;
                }
                const date = new Date(window.appState.baseDate);
                date.setDate(date.getDate() + integerDays + offset);
                label.textContent = date.getDate();
                const weekday = this.gridContainer.querySelector(
                    `.weekday-label[data-day-offset="${offset}"]`
                );
                if (weekday) {
                    weekday.textContent = window.dom.getWeekdayName(date);
                }
            });
            return;
        }

        this.gridContainer.querySelectorAll('.date-labels, .weekday-label').forEach((el) => el.remove());

        const { min: minOffset, max: maxOffset } = this._getDayLabelOffsetRange();
        for (let i = minOffset; i <= maxOffset; i++) {
            this.createDateLabel(i);
        }
    }
}

window.grid = new GridManager();