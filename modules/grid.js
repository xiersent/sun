class GridManager {
    constructor() {
        this.gridElements = [];
        this.gridContainer = null;
        this.staticElementsContainer = null;
        /** Сигнатура раскладки; при смене — нужен полный createGrid */
        this._lastGridLayoutSignature = null;
    }
    
    calculateGridPosition(offset) {
        const sq = window.appState.config.squareSize;
        if (window.wavesTransformLayer && window.wavesTransformLayer.mapLogicalOffsets) {
            const m = window.wavesTransformLayer.mapLogicalOffsets(offset, 0);
            return {
                actualOffset: offset,
                pixelPosition: window.wavesTransformLayer.isAxisSwapped() ? m.y : m.x,
                crossPixel: window.wavesTransformLayer.isAxisSwapped() ? m.x : m.y,
                axisSwapped: window.wavesTransformLayer.isAxisSwapped()
            };
        }
        let displayOffset = offset;
        if (window.wavesTransformLayer && window.wavesTransformLayer.mapGridDayOffset) {
            displayOffset = window.wavesTransformLayer.mapGridDayOffset(offset);
        }
        return {
            actualOffset: offset,
            pixelPosition: displayOffset * sq,
            crossPixel: 0,
            axisSwapped: false
        };
    }

    calculateGridYPosition(level) {
        let numericLevel = Number(level);
        if (Number.isNaN(numericLevel)) {
            numericLevel = 0;
        }
        if (window.wavesTransformLayer && window.wavesTransformLayer.mapLogicalOffsets) {
            const m = window.wavesTransformLayer.mapLogicalOffsets(0, numericLevel);
            const swapped = window.wavesTransformLayer.isAxisSwapped();
            if (swapped) {
                return {
                    actualLevel: numericLevel,
                    swapped: true,
                    labelLeft: `calc(50% + ${m.x}px)`,
                    lineLeft: `calc(50% + ${m.x}px)`
                };
            }
            return {
                actualLevel: numericLevel,
                swapped: false,
                labelTop: `calc(50% + ${m.y}px)`,
                lineBottom: `calc(50% + ${-m.y}px)`
            };
        }
        let displayLevel = numericLevel;
        if (window.wavesTransformLayer && window.wavesTransformLayer.mapGridYLevel) {
            displayLevel = window.wavesTransformLayer.mapGridYLevel(level);
        }
        const sq = window.appState.config.squareSize;
        return {
            actualLevel: level,
            swapped: false,
            labelTop: `calc(50% - ${displayLevel * sq}px)`,
            lineBottom: `calc(50% + ${displayLevel * sq}px)`
        };
    }

    _isAxisSwapped() {
        return !!(
            window.wavesTransformLayer &&
            window.wavesTransformLayer.isAxisSwapped &&
            window.wavesTransformLayer.isAxisSwapped()
        );
    }

    applyTransformLayout(opts = {}) {
        const sig = this._getGridLayoutSignature();
        const needsRecreate =
            opts.forceRecreate === true ||
            !this.gridContainer ||
            !this.staticElementsContainer ||
            this._lastGridLayoutSignature !== sig;

        if (needsRecreate && window.appState.hasActivePerson()) {
            this.createGrid();
            return;
        }
        this.applyFlipState();
    }

    /** flipH/V и rotate → позиции меток/линий (без CSS rotate на контейнерах). */
    applyFlipState() {
        if (!window.appState.hasActivePerson()) {
            return;
        }
        this._ensureGridContainerRefs();
        if (this.staticElementsContainer && !this.staticElementsContainer.querySelector('[data-y-level]')) {
            this.staticElementsContainer
                .querySelectorAll('.grid-line.x, .grid-line.state-v, .labels.y-labels, .labels.state-labels')
                .forEach((el) => el.remove());
            if (this._isAxisSwapped()) {
                this.createStateGridLines();
                this.createStateAxisLabels();
            } else {
                this.createHorizontalGridLines();
                this.createYAxisLabels();
            }
        }
        this._applyGridMirrorPositions();
        this.applyGridContainerTransform();
        this._syncGraphAxesVisibility();
    }

    /** При 90°/270° центральная горизонталь — .axis.x-axis (day-h offset 0 не рисуем). */
    _syncGraphAxesVisibility() {
        const graph = document.getElementById('graphElement');
        if (!graph) {
            return;
        }
        const swapped = this._isAxisSwapped();
        graph.classList.toggle('graph--axis-swapped', swapped);
        const xAxis = graph.querySelector('.axis.x-axis');
        if (xAxis && !swapped) {
            xAxis.classList.remove('active');
            xAxis.style.backgroundColor = '';
        }
    }

    /** При ↷/↶ линия offset 0 совпадает с фиксированной .axis.x-axis. */
    _isDayGridLineOnCentralAxis(offset) {
        return this._isAxisSwapped() && Number(offset) === 0;
    }

    _applyDayPosition(el, offset) {
        if (
            el.classList.contains('date-labels') ||
            el.classList.contains('weekday-label')
        ) {
            if (el.closest('.date-row')) {
                return;
            }
        }
        const pos = this.calculateGridPosition(offset);
        el.style.left = '';
        el.style.right = '';
        el.style.top = '';
        el.style.bottom = '';
        el.style.marginLeft = '';
        el.style.marginTop = '';
        if (pos.axisSwapped) {
            if (el.classList.contains('date-row')) {
                el.style.left = '10px';
                el.style.top = `calc(50% + ${pos.pixelPosition}px)`;
                el.style.transform = 'translateY(-50%)';
            } else {
                el.style.top = `calc(50% + ${pos.pixelPosition}px)`;
                el.style.transform = 'translateY(-50%)';
            }
        } else {
            el.style.left = `calc(50% + ${pos.pixelPosition}px)`;
            el.style.transform = 'translateX(-50%)';
        }
    }

    _applyStateLabelPosition(el, pos) {
        el.style.left = '';
        el.style.right = '';
        el.style.top = '';
        el.style.bottom = '';
        if (pos.swapped) {
            el.style.bottom = '10px';
            el.style.left = pos.labelLeft;
            el.style.transform = 'translateX(-50%)';
        } else {
            el.style.left = '10px';
            el.style.top = pos.labelTop;
            el.style.transform = 'translateY(-50%)';
        }
    }

    _applyGridMirrorPositions() {
        this._ensureGridContainerRefs();
        if (this.gridContainer) {
            this.gridContainer.querySelectorAll('[data-day-offset]').forEach((el) => {
                const offset = parseInt(el.getAttribute('data-day-offset'), 10);
                if (!Number.isNaN(offset)) {
                    this._applyDayPosition(el, offset);
                }
            });
            this.gridContainer.querySelectorAll('.grid-wrapper[data-day-offset]').forEach((wrapper) => {
                const offset = parseInt(wrapper.getAttribute('data-day-offset'), 10);
                if (!Number.isNaN(offset)) {
                    this._applyDayPosition(wrapper, offset);
                }
            });
        }
        if (this.staticElementsContainer) {
            this.staticElementsContainer.querySelectorAll('[data-y-level]').forEach((el) => {
                const level = parseInt(el.getAttribute('data-y-level'), 10);
                if (Number.isNaN(level)) {
                    return;
                }
                const pos = this.calculateGridYPosition(level);
                if (el.classList.contains('y-labels') || el.classList.contains('state-labels')) {
                    this._applyStateLabelPosition(el, pos);
                    el.textContent = String(level);
                } else if (el.classList.contains('grid-line')) {
                    el.style.top = '';
                    el.style.bottom = '';
                    el.style.left = '';
                    el.style.right = '';
                    if (pos.swapped) {
                        el.style.left = pos.lineLeft;
                    } else {
                        el.style.bottom = pos.lineBottom;
                    }
                }
            });
        }
    }

    applyGridContainerTransform() {
        this._ensureGridContainerRefs();
        if (!this.gridContainer) {
            return;
        }
        const currentDay = window.appState.currentDay || 0;
        const fractionalOffset = currentDay - Math.floor(currentDay);
        const wtl = window.wavesTransformLayer;
        const scrollPx =
            wtl && wtl.getDayAxisScrollPx
                ? wtl.getDayAxisScrollPx(fractionalOffset)
                : -fractionalOffset * window.appState.config.squareSize;
        if (this._isAxisSwapped()) {
            this.gridContainer.style.transform = `translateY(${scrollPx}px)`;
        } else {
            this.gridContainer.style.transform = `translateX(${scrollPx}px)`;
        }
        this.gridContainer.style.transformOrigin = '50% 50%';
        if (this.staticElementsContainer) {
            this.staticElementsContainer.style.transform = '';
            this.staticElementsContainer.style.transformOrigin = '';
        }
    }

    _applyGridVerticalMirrorPositions() {
        /* legacy alias */
        this._applyGridMirrorPositions();
    }

    _applyGridHorizontalMirrorPositions() {
        /* legacy alias */
        this._applyGridMirrorPositions();
    }

    _ensureGridContainerRefs() {
        if (!this.gridContainer || !this.gridContainer.isConnected) {
            this.gridContainer = document.querySelector('.grid-absolute-container');
        }
        if (!this.staticElementsContainer || !this.staticElementsContainer.isConnected) {
            this.staticElementsContainer = document.querySelector('.grid-static-container');
        }
    }

    /** Подписи дат по краям видимой сетки: −12…+13 при 24 клетках (край справа при конце дня). */
    _getDayLabelOffsetRange() {
        const half = Math.floor(window.appState.config.gridSquaresX / 2);
        return { min: -half, max: half + 1 };
    }

    /** Линии сетки по оси дней — без крайних (сливаются с outline графика). */
    _getDayGridLineOffsetRange() {
        const half = Math.floor(window.appState.config.gridSquaresX / 2);
        if (this._isAxisSwapped()) {
            // ↷ +90° (q=1): offset +half — нижний outline; ↶ −90° (q=3): +half — верхний
            return { min: -half + 1, max: half - 1 };
        }
        return { min: -half + 1, max: half };
    }

    /** Горизонтальная линия дня (↷/↶) на границе графика — не рисовать. */
    _isDayGridLineOnGraphOutline(offset) {
        const wtl = window.wavesTransformLayer;
        if (!wtl || !wtl.mapLogicalOffsets || !this._isAxisSwapped()) {
            return false;
        }
        const m = wtl.mapLogicalOffsets(offset, 0);
        const dh = wtl.getDisplayGraphHeight();
        const topPx = dh / 2 + m.y;
        return topPx <= 0.5 || topPx >= dh - 0.5;
    }

    /** Не рисовать вертикальную линию состояния на outline графика (↷/↶). */
    _isStateGridLineOnGraphOutline(level) {
        const wtl = window.wavesTransformLayer;
        if (!wtl || !wtl.mapLogicalOffsets || !wtl.getDisplayGraphWidth) {
            return false;
        }
        const m = wtl.mapLogicalOffsets(0, level);
        const dw = wtl.getDisplayGraphWidth();
        const leftPx = dw / 2 + m.x;
        return leftPx <= 0.5 || leftPx >= dw - 0.5;
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
		
		this.gridContainer.style.transform = '';
		this.gridContainer.style.transition = 'none';
		
		this.staticElementsContainer = document.createElement('div');
		this.staticElementsContainer.className = 'grid-static-container';
		this.staticElementsContainer.style.position = 'absolute';
		this.staticElementsContainer.style.width = '100%';
		this.staticElementsContainer.style.height = '100%';
		this.staticElementsContainer.style.top = '0';
		this.staticElementsContainer.style.left = '0';
		this.staticElementsContainer.style.pointerEvents = 'none';
		
		const labelRange = this._getDayLabelOffsetRange();
		const lineRange = this._getDayGridLineOffsetRange();
		if (this._isAxisSwapped()) {
			for (let i = labelRange.min; i <= labelRange.max; i++) {
				this.createDateLabel(i);
			}
			for (let i = lineRange.min; i <= lineRange.max; i++) {
				this.createDayGridLineSwapped(i);
			}
			this.createStateGridLines();
			this.createStateAxisLabels();
		} else {
			for (let i = labelRange.min; i <= labelRange.max; i++) {
				this.createDateLabel(i);
			}
			for (let i = lineRange.min; i <= lineRange.max; i++) {
				this.createGridLine(i);
			}
			this.createHorizontalGridLines();
			this.createYAxisLabels();
		}
		
		const graphElement = document.getElementById('graphElement');
		if (graphElement) {
			graphElement.appendChild(this.staticElementsContainer);
			graphElement.appendChild(this.gridContainer);
		}
		if (window.wavesTransformLayer && typeof window.wavesTransformLayer.ensureWavesLayerAboveGrid === 'function') {
			window.wavesTransformLayer.ensureWavesLayerAboveGrid();
		}
		
        this.updateGridNotesHighlight();
        this._lastGridLayoutSignature = this._getGridLayoutSignature();
        this.applyFlipState();
        this._syncGraphAxesVisibility();
        this._syncGridLineActivesForVizor();
	}

    _getGridLayoutSignature() {
        const c = window.appState.config;
        const q =
            window.wavesTransformLayer && window.wavesTransformLayer.getRotationQuarter
                ? window.wavesTransformLayer.getRotationQuarter()
                : 0;
        const wtl = window.wavesTransformLayer;
        const dw =
            wtl && wtl.getDisplayGraphWidth ? wtl.getDisplayGraphWidth() : window.appState.graphWidth;
        const dh =
            wtl && wtl.getDisplayGraphHeight
                ? wtl.getDisplayGraphHeight()
                : c.graphHeight;
        return [c.gridSquaresX, c.squareSize, window.appState.graphWidth, c.graphHeight, dw, dh, q].join('|');
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
        this._syncGraphAxesVisibility();
    }

    _syncGridLineActivesForVizor() {
        const currentDay = window.appState.currentDay || 0;
        const integerPart = Math.floor(currentDay);
        const fractionalPart = currentDay - integerPart;
        this.gridElements.forEach((el) => {
            let line = null;
            let offsetAttr = null;
            if (el.classList && el.classList.contains('grid-wrapper')) {
                line = el.querySelector('.grid-line-inner');
                offsetAttr = el.getAttribute('data-day-offset');
            } else if (el.classList && el.classList.contains('day-h')) {
                line = el;
                offsetAttr = el.getAttribute('data-day-offset');
            }
            if (!line || offsetAttr == null) {
                return;
            }
            const offset = parseInt(offsetAttr, 10);
            if (Number.isNaN(offset)) {
                return;
            }
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

        const graph = document.getElementById('graphElement');
        const xAxis = graph && graph.querySelector('.axis.x-axis');
        if (!xAxis) {
            return;
        }
        if (!this._isAxisSwapped()) {
            xAxis.classList.remove('active');
            xAxis.style.backgroundColor = '';
            return;
        }
        const onCentralDayLine =
            Math.abs(fractionalPart) < 0.001 && integerPart === 0;
        xAxis.classList.toggle('active', onCentralDayLine);
        xAxis.style.backgroundColor = onCentralDayLine ? '' : '';
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
        const swapped = positionData.axisSwapped;
        
        const label = document.createElement('span');
        label.className = 'labels date-labels';
        label.textContent = date.getDate();
        
        const weekday = document.createElement('span');
        weekday.className = 'labels x-labels weekday-label';
        weekday.textContent = window.dom.getWeekdayName(date);
        
        if (swapped) {
            const row = document.createElement('div');
            row.className = 'labels date-row';
            row.style.position = 'absolute';
            row.style.display = 'flex';
            row.style.flexDirection = 'row';
            row.style.alignItems = 'center';
            row.style.gap = '6px';
            row.style.left = '10px';
            row.style.top = `calc(50% + ${positionData.pixelPosition}px)`;
            row.style.transform = 'translateY(-50%)';
            row.setAttribute('data-day-offset', String(offset));
            row.appendChild(label);
            row.appendChild(weekday);
            this.gridContainer.appendChild(row);
        } else {
            label.style.position = 'absolute';
            label.setAttribute('data-day-offset', String(offset));
            weekday.style.position = 'absolute';
            weekday.setAttribute('data-day-offset', String(offset));
            label.style.left = `calc(50% + ${positionData.pixelPosition}px)`;
            label.style.transform = 'translateX(-50%)';
            label.style.bottom = '30px';
            weekday.style.left = `calc(50% + ${positionData.pixelPosition}px)`;
            weekday.style.transform = 'translateX(-50%)';
            weekday.style.bottom = '10px';
            this.gridContainer.appendChild(label);
            this.gridContainer.appendChild(weekday);
        }
    }

    createDayGridLineSwapped(offset) {
        if (!this.gridContainer) return;
        if (this._isDayGridLineOnCentralAxis(offset) || this._isDayGridLineOnGraphOutline(offset)) {
            return;
        }

        const pos = this.calculateGridPosition(offset);
        const line = document.createElement('div');
        line.className = 'grid-line day-h';
        line.style.position = 'absolute';
        line.style.width = '100%';
        line.style.height = '1px';
        line.style.left = '0';
        line.style.top = `calc(50% + ${pos.pixelPosition}px)`;
        line.setAttribute('data-day-offset', String(offset));

        const currentDay = window.appState.currentDay || 0;
        const integerPart = Math.floor(currentDay);
        const fractionalPart = currentDay - integerPart;
        const isExactlyOnLine = Math.abs(fractionalPart) < 0.001 && offset === integerPart;
        if (isExactlyOnLine) {
            line.classList.add('active');
            line.style.backgroundColor = '#666';
        }

        this.gridContainer.appendChild(line);
        this.gridElements.push(line);
    }

    createStateGridLines() {
        if (!this.staticElementsContainer) return;

        for (let i = 1; i <= 5; i++) {
            [i, -i].forEach((level) => {
                if (this._isStateGridLineOnGraphOutline(level)) {
                    return;
                }
                const pos = this.calculateGridYPosition(level);
                const line = document.createElement('div');
                line.className = 'grid-line state-v';
                line.style.position = 'absolute';
                line.style.height = '100%';
                line.style.width = '1px';
                line.style.top = '0';
                line.style.left = pos.lineLeft;
                line.setAttribute('data-y-level', String(level));
                this.staticElementsContainer.appendChild(line);
            });
        }
    }

    createStateAxisLabels() {
        if (!this.staticElementsContainer) return;

        const add = (level) => {
            const pos = this.calculateGridYPosition(level);
            const el = document.createElement('div');
            el.className = 'labels state-labels';
            el.style.position = 'absolute';
            el.setAttribute('data-y-level', String(level));
            el.textContent = String(level);
            this._applyStateLabelPosition(el, pos);
            this.staticElementsContainer.appendChild(el);
        };

        add(0);
        for (let i = 1; i <= 5; i++) {
            add(i);
            add(-i);
        }
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
        this.applyGridContainerTransform();
    }
    
    updateDateLabels() {
        if (!this.gridContainer) return;

        const dateRows = this.gridContainer.querySelectorAll('.date-row[data-day-offset]');
        if (dateRows.length > 0) {
            const currentDay = window.appState.currentDay || 0;
            const integerDays = Math.floor(currentDay);
            dateRows.forEach((row) => {
                const offset = parseInt(row.getAttribute('data-day-offset'), 10);
                if (Number.isNaN(offset)) {
                    return;
                }
                const date = new Date(window.appState.baseDate);
                date.setDate(date.getDate() + integerDays + offset);
                const label = row.querySelector('.date-labels');
                const weekday = row.querySelector('.weekday-label');
                if (label) {
                    label.textContent = date.getDate();
                }
                if (weekday) {
                    weekday.textContent = window.dom.getWeekdayName(date);
                }
            });
            return;
        }

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

        this.gridContainer.querySelectorAll('.date-row, .date-labels, .weekday-label').forEach((el) => el.remove());

        const { min: minOffset, max: maxOffset } = this._getDayLabelOffsetRange();
        for (let i = minOffset; i <= maxOffset; i++) {
            this.createDateLabel(i);
        }
    }
}

window.grid = new GridManager();