// modules/waves.js - ОБНОВЛЕННЫЙ (с точками пересечения с осью X)
class WavesManager {
    constructor() {
        this.elements = {};
        this.waveContainers = {};
        this.wavePaths = {};
        this.initialized = false;
        this.waveLabels = {};
        this.waveLabelElements = {};
        this.lastUpdateTime = 0;
        this.updateInterval = 50;
    }
    
	init() {
		if (this.initialized) {
			console.log('WavesManager: уже инициализирован');
			return;
		}
		
		console.log('=== WavesManager: инициализация (локальное время) ===');
		console.log('currentDay при инициализации:', window.appState.currentDay);
		
		// ЛОГИРОВАНИЕ В ЛОКАЛЬНОМ ВРЕМЕНИ
		if (window.appState.currentDate) {
			console.log('currentDate (локальное):', window.appState.currentDate.toLocaleString());
		}
		
		if (window.appState.baseDate instanceof Date) {
			console.log('baseDate (локальное):', window.appState.baseDate.toLocaleString());
		} else if (typeof window.appState.baseDate === 'number') {
			const baseDateLocal = window.timeUtils ? 
				window.timeUtils.toLocalDate(window.appState.baseDate) : 
				new Date(window.appState.baseDate);
			console.log('baseDate (локальное):', baseDateLocal.toLocaleString());
		}
		
		this.createVisibleWaveElements();
		this.updatePosition();
		this.initialized = true;
		
		console.log('WavesManager: инициализация завершена (локальное время)');
	}
    
    /**
     * Рассчитывает необходимое количество периодов для бесконечного эффекта
     * @param {number} periodPx - Период в пикселях
     * @returns {number} Количество периодов для рендеринга
     */
    calculateRequiredPeriods(periodPx) {
        const viewportWidth = window.appState.graphWidth;
        
        // Для маленьких периодов рендерим больше периодов
        if (periodPx < 250) {
            return 30;
        }
        
        if (periodPx < 500) {
            return 20;
        }
        
        if (periodPx < 1000) {
            return 15;
        }
        
        if (periodPx < 1500) {
            return 10;
        }
        
        // Для больших периодов рендерим минимум 3 периода
        const periodsToCoverViewport = Math.ceil(viewportWidth / periodPx);
        const safetyMargin = 3;
        
        return Math.max(3, periodsToCoverViewport + safetyMargin);
    }
    
    /**
     * Проверяет, включена ли группа, содержащая волну
     * @param {string|number} waveId - ID волны
     * @returns {boolean} true если группа включена
     */
    isWaveGroupEnabled(waveId) {
        const waveIdStr = String(waveId);
        
        for (const group of window.appState.data.groups) {
            if (group.waves && group.waves.some(wId => String(wId) === waveIdStr)) {
                if (group.enabled) {
                    return true;
                }
            }
        }
        
        return false;
    }
    
    /**
     * Создает элементы всех видимых волн
     */
    createVisibleWaveElements() {
        console.log('WavesManager: создание видимых элементов волн...');
        
        // Очищаем старые элементы
        document.querySelectorAll('.wave-container').forEach(c => c.remove());
        document.querySelectorAll('.wave-label').forEach(l => l.remove());
        
        // НОВОЕ: Очищаем точки на оси X
        const axisXPointsContainer = document.querySelector('.wave-axis-x-points');
        if (axisXPointsContainer) {
            axisXPointsContainer.innerHTML = '';
        }
        
        this.waveContainers = {};
        this.wavePaths = {};
        this.waveLabelElements = {};
        
        let createdCount = 0;
        
        // Проверяем, есть ли активная дата
        const hasActiveDate = window.appState.activeDateId && 
                             window.appState.data.dates.some(d => d.id === window.appState.activeDateId);
        
        if (!hasActiveDate) {
            console.log('WavesManager: нет активной дата, волны не будут созданы');
            return;
        }
        
        // Создаем элементы для всех видимых волн с включенными группами
        window.appState.data.waves.forEach(wave => {
            const waveIdStr = String(wave.id);
            const isWaveVisible = window.appState.waveVisibility[waveIdStr] !== false;
            
            if (isWaveVisible && this.isWaveGroupEnabled(wave.id)) {
                console.log(`Создаем волну: ${wave.id} "${wave.name}"`);
                this.createWaveElement(wave);
                createdCount++;
            }
        });
        
        console.log(`WavesManager: создано ${createdCount} элементов волн`);
    }
    
    /**
     * Создает элемент волны
     * @param {Object} wave - Объект волны
     */
    createWaveElement(wave) {
        const container = document.createElement('div');
        container.className = 'wave-container';
        container.id = `waveContainer${wave.id}`;
        
        // Период в пикселях
        const periodPx = wave.period * window.appState.config.squareSize;
        
        // Сколько периодов рендерить для бесконечного эффекта
        const totalPeriods = this.calculateRequiredPeriods(periodPx);
        const containerWidth = periodPx * totalPeriods;
        
        // Настройка контейнера
        container.style.width = `${containerWidth}px`;
        container.style.height = '100%';
        container.style.position = 'absolute';
        container.style.top = '0';
        container.style.left = `-${containerWidth / 2}px`;
        
        // Сохраняем данные для расчетов
        container.dataset.totalPeriods = totalPeriods;
        container.dataset.periodPx = periodPx;
        container.dataset.wavePeriod = wave.period;
        container.dataset.waveId = wave.id;
        
        // Создаем SVG для волны
        const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        svg.classList.add('wave');
        svg.setAttribute('preserveAspectRatio', 'none');
        svg.setAttribute('viewBox', `0 0 ${containerWidth} ${window.appState.config.graphHeight}`);
        svg.style.width = '100%';
        svg.style.height = '100%';
        
        // Создаем путь волны
        const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
        path.classList.add('wave-path');
        path.id = `wavePath${wave.id}`;
        path.style.stroke = wave.color;
        
        // Определяем стиль линии (из группы или из волны)
        let waveType = wave.type;
        
        // Проверяем, есть ли у волны стиль от группы
        for (const group of window.appState.data.groups) {
            if (group.waves && Array.isArray(group.waves)) {
                const waveInGroup = group.waves.some(waveId => {
                    const waveIdStr = String(waveId);
                    const currentWaveIdStr = String(wave.id);
                    return waveIdStr === currentWaveIdStr;
                });
                
                if (waveInGroup && group.styleEnabled && group.styleType) {
                    waveType = group.styleType;
                    break;
                }
            }
        }
        
        // Применяем стиль линии
        if (waveType && waveType !== 'solid') {
            path.classList.add(window.dom.getWaveStyle(waveType));
        }
        
        // Применяем жирность
        const waveIdStr = String(wave.id);
        if (window.appState.waveBold[waveIdStr]) {
            path.classList.add('bold');
        }
        
        // Генерируем форму волны
        this.generateSineWave(periodPx, path, container, totalPeriods);
        
        // Добавляем элементы
        svg.appendChild(path);
        container.appendChild(svg);
        
        // Добавляем в DOM
        const graphElement = document.getElementById('graphElement');
        if (graphElement) {
            graphElement.appendChild(container);
        }
        
        // Сохраняем ссылки
        this.waveContainers[wave.id] = container;
        this.wavePaths[wave.id] = path;
        window.appState.periods[wave.id] = periodPx;
        
        console.log(`Создана волна: "${wave.name}" (${wave.period} дней)`);
        console.log(`  periodPx: ${periodPx}px, totalPeriods: ${totalPeriods}, containerWidth: ${containerWidth}px`);
    }
    
    /**
     * Генерирует синусоидальный путь волны
     * @param {number} periodPx - Период в пикселях
     * @param {SVGPathElement} wavePath - SVG path элемент
     * @param {HTMLElement} waveContainer - Контейнер волны
     * @param {number} totalPeriods - Количество периодов для рендеринга
     */
    generateSineWave(periodPx, wavePath, waveContainer, totalPeriods = 3) {
        const totalWidth = periodPx * totalPeriods;
        const points = 1500; // Количество точек для сглаживания
        const step = totalWidth / points;
        
        // Фазовая поправка (для смещения графика)
        const phaseOffsetPixels = window.appState.config.phaseOffsetDays * window.appState.config.squareSize;
        
        // Обновляем viewBox SVG
        const waveSvg = waveContainer.querySelector('.wave');
        if (waveSvg) {
            waveSvg.setAttribute('viewBox', `0 0 ${totalWidth} ${window.appState.config.graphHeight}`);
        }
        
        // Генерируем путь волны
        let pathData = `M0,${window.appState.config.graphHeight / 2} `;
        
        for (let i = 1; i <= points; i++) {
            const x = i * step;
            
            // Синусоидальная функция
            // y = centerY - amplitude * sin(2π * (x + phaseOffset) / period)
            const y = window.appState.config.graphHeight / 2 - 
                     window.appState.config.amplitude * 
                     Math.sin(2 * Math.PI * (x + phaseOffsetPixels) / periodPx);
            
            pathData += `L${x},${y} `;
        }
        
        if (wavePath) {
            wavePath.setAttribute('d', pathData);
        }
        
        // Сохраняем период для быстрого доступа
        const waveId = waveContainer.dataset.waveId;
        if (waveId) {
            window.appState.periods[waveId] = periodPx;
        }
    }
    
    /**
     * Обновляет контейнер волны (при изменении периода)
     * @param {string} waveId - ID волны
     * @param {number} periodPx - Период в пикселях
     */
    updateWaveContainer(waveId, periodPx) {
        const container = this.waveContainers[waveId];
        if (container) {
            const totalPeriods = this.calculateRequiredPeriods(periodPx);
            const containerWidth = periodPx * totalPeriods;
            
            container.style.width = `${containerWidth}px`;
            container.dataset.totalPeriods = totalPeriods;
            container.dataset.periodPx = periodPx;
            
            const waveSvg = container.querySelector('.wave');
            if (waveSvg) {
                waveSvg.setAttribute('viewBox', `0 0 ${containerWidth} ${window.appState.config.graphHeight}`);
            }
            
            const wavePath = this.wavePaths[waveId];
            if (wavePath) {
                this.generateSineWave(periodPx, wavePath, container, totalPeriods);
            }
        }
    }
    
    /**
     * Получает активные волны (видимые и с включенной группой)
     * @returns {Array} Массив активных волн
     */
    getActiveWaves() {
        return window.appState.data.waves.filter(wave => {
            const waveIdStr = String(wave.id);
            const isVisible = window.appState.waveVisibility[waveIdStr] !== false;
            const isGroupEnabled = this.isWaveGroupEnabled(wave.id);
            return isVisible && isGroupEnabled;
        });
    }
    
    /**
     * Позиционирует ВСЕ волны на графике
     * ВЫЗЫВАЕТСЯ при каждом изменении currentDay
     */
    updatePosition() {
		console.log('WavesManager: updatePosition вызван');
		console.log('  currentDay:', window.appState.currentDay);
		console.log('  fractional часть:', (window.appState.currentDay || 0) - Math.floor(window.appState.currentDay || 0));
		
		// ОБНОВЛЯЕМ СМЕЩЕНИЕ СЕТКИ
		if (window.grid && window.grid.updateGridOffset) {
			window.grid.updateGridOffset();
		}
		
		// ОБНОВЛЯЕМ ВРЕМЕННУЮ ПОЛОСУ
		if (window.timeBarManager && window.timeBarManager.updateTimeIndicator) {
			window.timeBarManager.updateTimeIndicator();
		}
        
        // ОБНОВЛЯЕМ СМЕЩЕНИЕ СЕТКИ
        if (window.grid && window.grid.updateGridOffset) {
            window.grid.updateGridOffset();
        }
        
        // Проверяем currentDay
        if (window.appState.currentDay === undefined || 
            window.appState.currentDay === null ||
            isNaN(window.appState.currentDay)) {
            
            console.warn('WavesManager: currentDay некорректен, исправляем на 0');
            window.appState.currentDay = 0;
        }
        
        const currentDay = window.appState.currentDay || 0;
        
        // Позиционируем каждую волну
        window.appState.data.waves.forEach(wave => {
            const wavePeriodPixels = window.appState.periods[wave.id] || 
                                   (wave.period * window.appState.config.squareSize);
            
            // Если период нулевой или отрицательный - пропускаем
            if (!wavePeriodPixels || wavePeriodPixels <= 0) {
                return;
            }
            
            // ВАЖНО: используем currentDay целиком (с дробной частью)
            // Это дает точное позиционирование с учетом времени суток
            
            // Текущая позиция в пикселях от начала периода
            let currentPositionPx = (currentDay * window.appState.config.squareSize) % wavePeriodPixels;
            
            // Корректируем для отрицательных значениях
            if (currentPositionPx < 0) {
                currentPositionPx = wavePeriodPixels + currentPositionPx;
            }
            
            const waveIdStr = String(wave.id);
            const isWaveVisible = window.appState.waveVisibility[waveIdStr] !== false;
            const shouldShow = isWaveVisible && this.isWaveGroupEnabled(wave.id);
            
            const container = this.waveContainers[wave.id];
            if (container) {
                // Применяем позиционирование
                container.style.transition = 'none';
                container.style.transform = `translateX(${-currentPositionPx}px)`;
                container.style.display = shouldShow ? 'block' : 'none';
                
                // Обновляем жирность
                const path = this.wavePaths[wave.id];
                if (path) {
                    path.classList.toggle('bold', window.appState.waveBold[waveIdStr]);
                }
            }
        });
        
        // Обновляем ВСЕ выноски (горизонтальные и вертикальные)
        this.updateAllWaveLabels();
        
        // Обновляем время в вертикальных метках
        this.updateVerticalWaveLabelsTime();
        
        console.log('WavesManager: позиционирование завершено');
    }
    
    /**
     * Обновляет ВСЕ выноски (горизонтальные и вертикальные)
     */
    updateAllWaveLabels() {
        this.updateHorizontalWaveLabels();
        this.updateVerticalWaveLabels();
        // ОБНОВЛЕНО: всегда обновляем точки на оси X
        this.updateAxisXIntersectionPoints();
    }
    
    /**
     * Обновляет горизонтальные выноски (слева и справа)
     */
    updateHorizontalWaveLabels() {
        const now = Date.now();
        
        // Защита от слишком частых обновлений
        if (now - this.lastUpdateTime < this.updateInterval) {
            return;
        }
        
        this.lastUpdateTime = now;
        
        const leftContainer = document.querySelector('.wave-labels-left');
        const rightContainer = document.querySelector('.wave-labels-right');
        
        if (!leftContainer || !rightContainer) {
            console.warn('WavesManager: контейнеры горизонтальных выносок не найдены');
            return;
        }
        
        // Очищаем старые выноски
        leftContainer.innerHTML = '';
        rightContainer.innerHTML = '';
        
        // Создаем выноски для активных волн
        window.appState.data.waves.forEach(wave => {
            const waveIdStr = String(wave.id);
            const isWaveVisible = window.appState.waveVisibility[waveIdStr] !== false;
            const shouldShow = isWaveVisible && this.isWaveGroupEnabled(wave.id);
            
            if (!shouldShow) return;
            
            // Рассчитываем Y-координаты на левом и правом краях
            const leftY = this.calculateWaveYAtX(wave, 0); // X = 0 (левый край)
            const rightY = this.calculateWaveYAtX(wave, window.appState.graphWidth); // X = ширина (правый край)
            
            // Создаем выноски, если волна пересекает край
            if (leftY >= 0 && leftY <= window.appState.config.graphHeight) {
                this.createHorizontalWaveLabel(wave, leftY, 'left', leftContainer);
            }
            
            if (rightY >= 0 && rightY <= window.appState.config.graphHeight) {
                this.createHorizontalWaveLabel(wave, rightY, 'right', rightContainer);
            }
        });
    }
    
    /**
     * Обновляет вертикальные выноски сверху и снизу
     */
    updateVerticalWaveLabels() {
        const topContainer = document.querySelector('.wave-labels-top');
        const bottomContainer = document.querySelector('.wave-labels-bottom');
        
        if (!topContainer || !bottomContainer) {
            console.warn('WavesManager: контейнеры вертикальных выносок не найдены');
            return;
        }
        
        // Очищаем старые выноски
        topContainer.innerHTML = '';
        bottomContainer.innerHTML = '';
        
        // Создаем выноски для активных волн
        window.appState.data.waves.forEach(wave => {
            const waveIdStr = String(wave.id);
            const isWaveVisible = window.appState.waveVisibility[waveIdStr] !== false;
            const shouldShow = isWaveVisible && this.isWaveGroupEnabled(wave.id);
            
            if (!shouldShow) return;
            
            // Рассчитываем X-координаты на верхней и нижней границах
            const topX = this.findWaveXAtY(wave, 0); // Y = 0 (верхняя граница)
            const bottomX = this.findWaveXAtY(wave, window.appState.config.graphHeight); // Y = высота (нижняя граница)
            
            // Создаем выноски, если волна пересекает границу
            if (topX !== null && topX >= 0 && topX <= window.appState.graphWidth) {
                this.createVerticalWaveLabel(wave, topX, 'top', topContainer);
            }
            
            if (bottomX !== null && bottomX >= 0 && bottomX <= window.appState.graphWidth) {
                this.createVerticalWaveLabel(wave, bottomX, 'bottom', bottomContainer);
            }
        });
    }
    
    /**
     * Обновляет точки пересечения с осью X
     */
    updateAxisXIntersectionPoints() {
        // Контейнер для точек на оси X
        let axisXPointsContainer = document.querySelector('.wave-axis-x-points');
        if (!axisXPointsContainer) {
            axisXPointsContainer = document.createElement('div');
            axisXPointsContainer.className = 'wave-axis-x-points';
            axisXPointsContainer.style.position = 'absolute';
            axisXPointsContainer.style.width = '100%';
            axisXPointsContainer.style.height = '100%';
            axisXPointsContainer.style.pointerEvents = 'none';
            axisXPointsContainer.style.zIndex = '8';
            axisXPointsContainer.style.top = '0';
            axisXPointsContainer.style.left = '0';
            
            const graphElement = document.getElementById('graphElement');
            if (graphElement) {
                graphElement.appendChild(axisXPointsContainer);
            }
        }
        
        // Проверяем, должен ли контейнер быть скрыт
        if (axisXPointsContainer.classList.contains('hidden')) {
            // Если скрыт, просто очищаем старые точки и выходим
            axisXPointsContainer.innerHTML = '';
            return;
        }
        
        // Очищаем старые точки
        axisXPointsContainer.innerHTML = '';
        
        // Создаем точки для активных волн
        window.appState.data.waves.forEach(wave => {
            const waveIdStr = String(wave.id);
            const isWaveVisible = window.appState.waveVisibility[waveIdStr] !== false;
            const shouldShow = isWaveVisible && this.isWaveGroupEnabled(wave.id);
            
            if (!shouldShow) return;
            
            // Находим точки пересечения с осью X в видимой области
            const intersectionPoints = this.findAxisXIntersectionPoints(wave);
            
            // Создаем точки
            intersectionPoints.forEach(x => {
                this.createAxisXPoint(wave, x, axisXPointsContainer);
            });
        });
    }
    
    /**
     * Находит точки пересечения волны с осью X в видимой области
     * @param {Object} wave - Объект волны
     * @returns {Array} Массив X-координат точек пересечения
     */
	findAxisXIntersectionPoints(wave) {
		const points = [];
		const wavePeriodPixels = window.appState.periods[wave.id] || 
							(wave.period * window.appState.config.squareSize);
		
		if (!wavePeriodPixels) return points;
		
		// Текущее смещение волны (целые дни + дробная часть)
		const currentDay = window.appState.currentDay || 0;
		let currentOffsetPx = (currentDay * window.appState.config.squareSize) % wavePeriodPixels;
		if (currentOffsetPx < 0) currentOffsetPx = wavePeriodPixels + currentOffsetPx;
		
		const phaseOffsetPixels = window.appState.config.phaseOffsetDays * window.appState.config.squareSize;
		
		// Точки пересечения с осью X: фазы 0.0 и 0.5
		const intersectionPhases = [0.0, 0.5];
		
		// Проверяем несколько периодов
		for (let n = -3; n <= 3; n++) {
			intersectionPhases.forEach(phase => {
				// Формула: x = (phase + n) * period - phaseOffset - currentOffset
				const x = ((phase + n) * wavePeriodPixels - phaseOffsetPixels - currentOffsetPx);
				
				// Нормализуем в диапазон [0, wavePeriodPixels)
				const normalizedX = ((x % wavePeriodPixels) + wavePeriodPixels) % wavePeriodPixels;
				
				// Проверяем, находится ли в видимой области
				if (normalizedX >= 0 && normalizedX <= window.appState.graphWidth) {
					// Проверяем на дубликаты (близкие точки)
					const isDuplicate = points.some(existing => 
						Math.abs(existing - normalizedX) < 2
					);
					
					if (!isDuplicate) {
						points.push(normalizedX);
					}
				}
			});
		}
		
		return points.sort((a, b) => a - b);
	}
    
    /**
     * Создает точку пересечения с осью X
     * @param {Object} wave - Объект волны
     * @param {number} x - X-координата точки
     * @param {HTMLElement} container - Контейнер для точки
     */
    createAxisXPoint(wave, x, container) {
        const centerY = window.appState.config.graphHeight / 2;
        
        const point = document.createElement('div');
        point.className = 'wave-axis-x-point';
        point.dataset.waveId = wave.id;
        point.dataset.x = x;
        
        point.style.position = 'absolute';
        point.style.left = `${x}px`;
        point.style.top = `${centerY}px`;
        point.style.transform = 'translate(-50%, -50%)';
        point.style.width = '6px';
        point.style.height = '6px';
        point.style.borderRadius = '50%';
        point.style.backgroundColor = wave.color;
        point.style.border = '1px solid #fff';
        point.style.cursor = 'pointer';
        point.style.pointerEvents = 'auto';
        point.style.zIndex = '9';
        point.style.boxShadow = '0 0 2px rgba(0,0,0,0.3)';
        point.style.transition = 'all 0.2s';
        
        point.title = `${wave.name} - пересечение с осью`;
        
        // Обработчик клика - навигация к точке
        point.addEventListener('click', (e) => {
            e.stopPropagation();
            this.navigateToAxisXIntersection(wave, x);
        });
        
        point.addEventListener('mouseenter', () => {
            point.style.transform = 'translate(-50%, -50%) scale(1.3)';
            point.style.zIndex = '10';
            point.style.boxShadow = '0 0 4px rgba(0,0,0,0.5)';
        });
        
        point.addEventListener('mouseleave', () => {
            point.style.transform = 'translate(-50%, -50%)';
            point.style.zIndex = '9';
            point.style.boxShadow = '0 0 2px rgba(0,0,0,0.3)';
        });
        
        container.appendChild(point);
    }
    
    /**
     * Навигация к точке пересечения с осью X
     * @param {Object} wave - Объект волны
     * @param {number} x - X-координата точки
     */
	navigateToAxisXIntersection(wave, x) {
		console.log('Навигация к точке пересечения с осью X:');
		console.log('  Волна:', wave.name, 'Период:', wave.period);
		console.log('  Координата X:', x, 'px');
		
		// 1. Находим левую границу визора (как в вертикальных выносках)
		const squaresLeft = Math.floor(window.appState.config.gridSquaresX / 2);
		const currentDate = new Date(window.appState.currentDate);
		const leftDate = new Date(currentDate);
		leftDate.setDate(leftDate.getDate() - squaresLeft);
		leftDate.setHours(0, 0, 0, 0); // ОБНУЛЯЕМ время суток!
		
		// 2. Рассчитываем фазу пересечения с осью X в этой точке
		const wavePeriodPixels = window.appState.periods[wave.id] || 
							(wave.period * window.appState.config.squareSize);
		
		const currentDay = window.appState.currentDay || 0;
		let currentOffsetPx = (currentDay * window.appState.config.squareSize) % wavePeriodPixels;
		if (currentOffsetPx < 0) currentOffsetPx = wavePeriodPixels + currentOffsetPx;
		
		const phaseOffsetPixels = window.appState.config.phaseOffsetDays * window.appState.config.squareSize;
		
		// 3. Находим фазу пересечения с осью X в точке x
		// x + currentOffset - это позиция от начала периода волны
		const relativePosition = x + currentOffsetPx + phaseOffsetPixels;
		
		// 4. Определяем, какое это пересечение: фаза 0.0 (восходящее) или 0.5 (нисходящее)
		const phaseInPeriod = (relativePosition % wavePeriodPixels) / wavePeriodPixels;
		
		// Находим ближайшую фазу пересечения (0.0 или 0.5)
		let targetPhase;
		const distanceToZero = Math.min(
			Math.abs(phaseInPeriod - 0.0),
			Math.abs(phaseInPeriod - 1.0) // учитываем переход через границу периода
		);
		const distanceToHalf = Math.abs(phaseInPeriod - 0.5);
		
		if (distanceToZero < distanceToHalf) {
			targetPhase = 0.0; // Восходящее пересечение
		} else {
			targetPhase = 0.5; // Нисходящее пересечение
		}
		
		// 5. Рассчитываем время пересечения (как в вертикальных выносках)
		const phaseAtLeft = this.getPhaseAtTime(wave, leftDate); // Фаза на левой границе
		
		// Находим ближайшее пересечение ВПЕРЕД от левой границы
		let phaseDiff = targetPhase - phaseAtLeft;
		if (phaseDiff < 0) {
			phaseDiff += 1.0; // Берем следующее пересечение в будущем
		}
		
		const daysToIntersection = phaseDiff * wave.period;
		
		// 6. Абсолютное время пересечения
		const intersectionTime = new Date(leftDate.getTime() + (daysToIntersection * 24 * 3600 * 1000));
		
		console.log('  Левая граница:', leftDate.toLocaleDateString('ru-RU'));
		console.log('  Фаза на левой границе:', phaseAtLeft.toFixed(4));
		console.log('  Фаза в точке X:', phaseInPeriod.toFixed(4));
		console.log('  Целевая фаза:', targetPhase);
		console.log('  Дней до пересечения:', daysToIntersection.toFixed(2));
		console.log('  Время пересечения:', intersectionTime.toLocaleString('ru-RU'));
		
		// 7. Переводим визор на это время
		if (window.dates && window.dates.setDate) {
			window.dates.setDate(intersectionTime, true);
		}
	}

	/**
	 * Получает фазу волны (0-1) в заданный момент времени
	 * @param {Object} wave - Объект волны
	 * @param {Date} time - Время
	 * @returns {number} Фаза (0-1)
	 */
	getPhaseAtTime(wave, time) {
		// Дней от базовой даты
		const daysFromBase = window.timeUtils.getDaysBetween(window.appState.baseDate, time);
		
		// Фаза в пределах периода (0-1)
		const phase = (daysFromBase % wave.period) / wave.period;
		
		// Нормализуем к диапазону 0-1
		return phase < 0 ? phase + 1 : phase;
	}
    
    /**
     * Преобразует координату X на графике во время
     * @param {Object} wave - Объект волны
     * @param {number} x - X-координата
     * @returns {Date} Время точки
     */
	calculateTimeFromXCoordinate(wave, x) {
		// ВЕРНОЕ РЕШЕНИЕ: Используем ту же логику, что и в вертикальных выносках
		
		// 1. Находим левую границу визора (самую раннюю дату)
		const squaresLeft = Math.floor(window.appState.config.gridSquaresX / 2);
		const currentDate = new Date(window.appState.currentDate);
		const leftDate = new Date(currentDate);
		leftDate.setDate(leftDate.getDate() - squaresLeft);
		leftDate.setHours(0, 0, 0, 0); // ОБНУЛЯЕМ время суток!
		
		// 2. Рассчитываем дни от левой границы до точки
		// x - это координата от левого края графика (0..ширина)
		const daysFromLeft = (x / window.appState.config.squareSize);
		
		// 3. Абсолютное время точки
		// Добавляем ЦЕЛОЕ количество дней к левой границе
		const pointTime = new Date(leftDate.getTime() + (daysFromLeft * 24 * 3600 * 1000));
		
		console.log('Точка на оси X:');
		console.log('  Левая граница:', leftDate.toLocaleDateString('ru-RU'));
		console.log('  Координата X:', x, 'px');
		console.log('  Дней от левой границы:', daysFromLeft.toFixed(5));
		console.log('  Время точки:', pointTime.toLocaleString('ru-RU'));
		
		return pointTime;
	}
    
    /**
     * Создает ГОРИЗОНТАЛЬНУЮ выноску для волны
     * @param {Object} wave - Объект волны
     * @param {number} y - Y-координата
     * @param {string} side - 'left' или 'right'
     * @param {HTMLElement} container - Контейнер для выноски
     */
    createHorizontalWaveLabel(wave, y, side, container) {
        const labelId = `${wave.id}-${side}`;
        const waveColor = wave.color || '#666666';
        
        const labelElement = document.createElement('div');
        labelElement.className = 'wave-label horizontal';
        labelElement.id = `waveLabel${labelId}`;
        labelElement.dataset.waveId = wave.id;
        labelElement.dataset.side = side;
        labelElement.dataset.labelType = 'horizontal'; // Добавляем тип
        
        labelElement.style.position = 'absolute';
        labelElement.style.top = `${y}px`;
        labelElement.style.backgroundColor = waveColor;
        labelElement.style.color = '#fff';
        labelElement.style.opacity = '0.5';
        labelElement.style.zIndex = '1';
        labelElement.style.padding = '2px 6px';
        labelElement.style.borderRadius = '3px';
        labelElement.style.fontSize = '11px';
        labelElement.style.transform = 'translateY(-50%)';
        labelElement.style.cursor = 'pointer';
        
        // Стрелка
        const arrow = document.createElement('div');
        arrow.className = 'wave-label-arrow';
        arrow.style.position = 'absolute';
        arrow.style.top = '50%';
        arrow.style.transform = 'translateY(-50%)';
        arrow.style.width = '0';
        arrow.style.height = '0';
        arrow.style.borderStyle = 'solid';
        arrow.style.zIndex = '1';
        
        if (side === 'left') {
            arrow.style.right = '-6px';
            arrow.style.borderWidth = '4px 0 4px 6px';
            arrow.style.borderColor = `transparent transparent transparent ${waveColor}`;
            labelElement.style.right = '0';
            labelElement.style.marginRight = '10px';
        } else {
            arrow.style.left = '-6px';
            arrow.style.borderWidth = '4px 6px 4px 0';
            arrow.style.borderColor = `transparent ${waveColor} transparent transparent`;
            labelElement.style.left = '0';
            labelElement.style.marginLeft = '10px';
        }
        
        // Текст
        const text = document.createElement('div');
        text.className = 'wave-label-text';
        text.textContent = wave.name;
        text.title = `${wave.name} (${wave.period} дней)`;
        text.style.position = 'relative';
        text.style.zIndex = '2';
        
        labelElement.appendChild(text);
        labelElement.appendChild(arrow);
        container.appendChild(labelElement);
        
        this.waveLabelElements[labelId] = labelElement;
        
        // Обработчик для ГОРИЗОНТАЛЬНЫХ выносок (с подтверждением)
        labelElement.addEventListener('click', (e) => {
            e.stopPropagation();
            this.onHorizontalWaveLabelClick(wave.id);
        });
        
        labelElement.addEventListener('mouseenter', () => {
            labelElement.style.opacity = '1';
            labelElement.style.zIndex = '10';
        });
        
        labelElement.addEventListener('mouseleave', () => {
            labelElement.style.opacity = '0.5';
            labelElement.style.zIndex = '1';
        });
        
        return labelElement;
    }
    
    /**
     * Создает ВЕРТИКАЛЬНУЮ выноску для волны
     * @param {Object} wave - Объект волны
     * @param {number} x - X-координата
     * @param {string} position - 'top' или 'bottom'
     * @param {HTMLElement} container - Контейнер для выноски
     */
    createVerticalWaveLabel(wave, x, position, container) {
        const labelId = `${wave.id}-${position}`;
        const waveColor = wave.color || '#666666';
        
        // Вычисляем время экстремума
        const extremumTime = this.calculateExtremumTime(wave, position);
        
        // Форматируем как ЧЧ:ММ:СС
        const timeString = this.formatExtremumTime(extremumTime);
        
        const labelElement = document.createElement('div');
        labelElement.className = 'wave-label vertical';
        labelElement.id = `waveLabel${labelId}`;
        labelElement.dataset.waveId = wave.id;
        labelElement.dataset.position = position;
        labelElement.dataset.labelType = 'vertical'; // Добавляем тип
        labelElement.dataset.extremumTime = extremumTime.getTime(); // Сохраняем timestamp
        
        labelElement.style.position = 'absolute';
        labelElement.style.left = `${x}px`;
        labelElement.style.backgroundColor = waveColor;
        labelElement.style.color = '#fff';
        labelElement.style.opacity = '0.5';
        labelElement.style.zIndex = '1';
        labelElement.style.padding = '2px 6px';
        labelElement.style.borderRadius = '3px';
        labelElement.style.fontSize = '11px';
        labelElement.style.transform = 'translateX(-50%)';
        labelElement.style.cursor = 'pointer';
        labelElement.style.fontFamily = 'monospace';
        labelElement.style.letterSpacing = '0.5px';
        
        // Текст метки - ТОЛЬКО время xx:xx:xx
        const text = document.createElement('div');
        text.className = 'wave-label-text';
        text.textContent = timeString;
        
        // Стрелка
        const arrow = document.createElement('div');
        arrow.className = 'wave-label-arrow';
        arrow.style.position = 'absolute';
        arrow.style.width = '0';
        arrow.style.height = '0';
        arrow.style.borderStyle = 'solid';
        arrow.style.zIndex = '1';
        
        if (position === 'top') {
            arrow.style.bottom = '-6px';
            arrow.style.left = '50%';
            arrow.style.transform = 'translateX(-50%)';
            arrow.style.borderWidth = '6px 4px 0 4px';
            arrow.style.borderColor = `${waveColor} transparent transparent transparent`;
            labelElement.style.top = '0';
            labelElement.style.marginTop = '5px';
        } else {
            arrow.style.top = '-6px';
            arrow.style.left = '50%';
            arrow.style.transform = 'translateX(-50%)';
            arrow.style.borderWidth = '0 4px 6px 4px';
            arrow.style.borderColor = `transparent transparent ${waveColor} transparent`;
            labelElement.style.bottom = '0';
            labelElement.style.marginBottom = '5px';
        }
        
        labelElement.appendChild(text);
        labelElement.appendChild(arrow);
        container.appendChild(labelElement);
        
        // Обработчик для ВЕРТИКАЛЬНЫХ выносок (навигация по времени)
        labelElement.addEventListener('click', (e) => {
            e.stopPropagation();
            this.onVerticalWaveLabelClick(labelElement);
        });
        
        labelElement.addEventListener('mouseenter', () => {
            labelElement.style.opacity = '1';
            labelElement.style.zIndex = '10';
        });
        
        labelElement.addEventListener('mouseleave', () => {
            labelElement.style.opacity = '0.5';
            labelElement.style.zIndex = '1';
        });
        
        return labelElement;
    }
    
    /**
     * Обработчик клика по ГОРИЗОНТАЛЬНОЙ выноске
     * @param {string|number} waveId - ID волны
     */
    onHorizontalWaveLabelClick(waveId) {
        const confirmHide = confirm('Скрыть колосок?');
        
        if (!confirmHide) {
            return;
        }
        
        const waveIdStr = String(waveId);
        const isCurrentlyVisible = window.appState.waveVisibility[waveIdStr] !== false;
        
        // Переключаем видимость
        window.appState.waveVisibility[waveIdStr] = !isCurrentlyVisible;
        window.appState.save();
        
        // Обновляем UI
        if (window.unifiedListManager && window.unifiedListManager.updateWavesList) {
            window.unifiedListManager.updateWavesList();
        }
        
        // Пересоздаем элементы волн
        this.updatePosition();
        
        console.log(`Видимость волны ${waveId} изменена: ${!isCurrentlyVisible ? 'включена' : 'выключена'}`);
    }
    
    /**
     * Обработчик клика по ВЕРТИКАЛЬНОЙ выноске
     * @param {HTMLElement} labelElement - Элемент выноски
     */
    onVerticalWaveLabelClick(labelElement) {
        const waveId = labelElement.dataset.waveId;
        const extremumTime = parseInt(labelElement.dataset.extremumTime);
        const position = labelElement.dataset.position;
        
        console.log(`Нажата вертикальная выноска: волна ${waveId}, позиция ${position}, время ${new Date(extremumTime).toLocaleString()}`);
        
        // Переводим визор на это время
        this.navigateToExtremumTime(extremumTime);
    }
    
    /**
     * Переводит визор на время экстремума
     * @param {number} timestamp - timestamp времени экстремума
     */
	navigateToExtremumTime(timestamp) {
		const extremumDate = new Date(timestamp);
		console.log('Навигация к экстремуму:', extremumDate.toLocaleString());
		
		// Переводим визор на это время с точным временем
		if (window.dates && window.dates.setDate) {
			// Вызываем setDate с флагом useExactTime = true
			window.dates.setDate(extremumDate, true);
			
			console.log('Визор переведен на время экстремума');
		}
	}
    
    /**
     * Вычисляет абсолютное время экстремума на временной ленте
     * @param {Object} wave - объект волны
     * @param {string} position - 'top' или 'bottom'
     * @returns {Date} время экстремума (абсолютное)
     */
	calculateExtremumTime(wave, position) {
		console.log(`calculateExtremumTime: ${wave.name}, position: ${position}`);
		
		// 1. Период в пикселях
		const periodPx = window.appState.periods[wave.id] || 
						(wave.period * window.appState.config.squareSize);
		
		if (!periodPx) {
			console.log('  periodPx not found');
			return new Date();
		}
		
		// 2. Определяем, какой это экстремум (верхний или нижний)
		const extremumPhaseFraction = position === 'top' ? 0.25 : 0.75;
		
		// 3. БАЗОВАЯ ДАТА колоска (начало отсчета) - локальное время
		const baseDate = window.appState.baseDate;
		
		// 4. Находим левую границу визора (самую раннюю дату)
		// ВАЖНО: используем ТОЛЬКО ЦЕЛЫЕ ДНИ, без времени суток!
		const squaresLeft = Math.floor(window.appState.config.gridSquaresX / 2);
		
		// Получаем currentDate как Date объект
		const currentDate = new Date(window.appState.currentDate);
		
		// Создаем leftDate как НАЧАЛО ДНЯ (00:00:00) от currentDate минус squaresLeft
		const leftDate = new Date(currentDate);
		leftDate.setDate(leftDate.getDate() - squaresLeft);
		// ОБНУЛЯЕМ время суток (только целые дни!)
		leftDate.setHours(0, 0, 0, 0);
		
		// 5. Рассчитываем фазу на левой границе визора
		// Используем getDaysBetween для получения разницы в днях
		// Но baseDate уже должна быть с обнуленным временем (00:00:00)
		
		// Обеспечиваем, что baseDate тоже имеет время 00:00:00
		const normalizedBaseDate = new Date(baseDate);
		normalizedBaseDate.setHours(0, 0, 0, 0);
		
		// Рассчитываем разницу в днях (целые дни)
		const daysFromBaseToLeft = window.timeUtils.getDaysBetween(normalizedBaseDate, leftDate);
		
		// ОКРУГЛЯЕМ до целого числа дней (игнорируем дробную часть времени суток)
		const wholeDaysFromBaseToLeft = Math.floor(daysFromBaseToLeft);
		
		// Рассчитываем фазу от ЦЕЛЫХ дней
		const phaseAtLeft = (wholeDaysFromBaseToLeft % wave.period) / wave.period;
		
		// Нормализуем фазу (0..1)
		const normalizedPhaseAtLeft = phaseAtLeft < 0 ? phaseAtLeft + 1 : phaseAtLeft;
		
		console.log(`  Левая граница визора: ${leftDate.toLocaleDateString('ru-RU')}`);
		console.log(`  Дней от базовой даты (целые): ${wholeDaysFromBaseToLeft}`);
		console.log(`  Фаза на левой границе: ${normalizedPhaseAtLeft.toFixed(4)} (${(normalizedPhaseAtLeft * wave.period).toFixed(2)} дней)`);
		
		// 6. Находим ближайший экстремум ВПЕРЕД от левой границы
		let phaseDiff = extremumPhaseFraction - normalizedPhaseAtLeft;
		if (phaseDiff < 0) {
			phaseDiff += 1.0; // Берем следующий экстремум в будущем
		}
		
		const daysToExtremumFromLeft = phaseDiff * wave.period;
		
		console.log(`  Разница фаз до экстремума: ${phaseDiff.toFixed(4)}`);
		console.log(`  Дней до экстремума: ${daysToExtremumFromLeft.toFixed(2)}`);
		
		// 7. Абсолютное время экстремума на ленте
		// Начинаем от leftDate (уже 00:00:00) и прибавляем ЦЕЛОЕ количество дней
		const extremumTime = new Date(leftDate.getTime() + (daysToExtremumFromLeft * 24 * 3600 * 1000));
		
		// 8. Проверяем, что экстремум попадает в видимую область
		const rightDate = new Date(leftDate);
		rightDate.setDate(rightDate.getDate() + window.appState.config.gridSquaresX);
		
		if (extremumTime >= leftDate && extremumTime <= rightDate) {
			console.log(`  ✓ Экстремум в видимой области: ${extremumTime.toLocaleDateString('ru-RU')} ${extremumTime.toLocaleTimeString('ru-RU')}`);
			console.log(`  Время суток: ${extremumTime.getHours().toString().padStart(2, '0')}:${extremumTime.getMinutes().toString().padStart(2, '0')}:${extremumTime.getSeconds().toString().padStart(2, '0')}`);
			return extremumTime;
		}
		
		// Если не попал, ищем следующий
		console.log(`  ✗ Экстремум вне видимой области, ищем следующий`);
		const nextExtremumTime = new Date(extremumTime.getTime() + (wave.period * 24 * 3600 * 1000));
		console.log(`  Следующий экстремум: ${nextExtremumTime.toLocaleDateString('ru-RU')} ${nextExtremumTime.toLocaleTimeString('ru-RU')}`);
		return nextExtremumTime;
	}
    
    /**
     * Форматирует время экстремума как ЧЧ:ММ:СС
     * @param {Date} date - время экстремума
     * @returns {string} "ЧЧ:ММ:СС"
     */
    formatExtremumTime(date) {
        const hours = date.getHours().toString().padStart(2, '0');
        const minutes = date.getMinutes().toString().padStart(2, '0');
        const seconds = date.getSeconds().toString().padStart(2, '0');
        
        return `${hours}:${minutes}:${seconds}`;
    }
    
    /**
     * Обновляет время в вертикальных метках при изменении даты
     */
    updateVerticalWaveLabelsTime() {
        document.querySelectorAll('.wave-label.vertical').forEach(label => {
            const waveId = label.dataset.waveId;
            const position = label.dataset.position;
            
            const wave = window.appState.data.waves.find(w => String(w.id) === waveId);
            if (!wave) return;
            
            const extremumTime = this.calculateExtremumTime(wave, position);
            const timeString = this.formatExtremumTime(extremumTime);
            
            const textElement = label.querySelector('.wave-label-text');
            if (textElement) {
                textElement.textContent = timeString;
            }
        });
    }
    
    /**
     * Рассчитывает Y-координату волны в заданной точке X
     * @param {Object} wave - Объект волны
     * @param {number} x - X-координата на графике (0..ширина)
     * @returns {number} Y-координата
     */
    calculateWaveYAtX(wave, x) {
        const wavePeriodPixels = window.appState.periods[wave.id] || 
                               (wave.period * window.appState.config.squareSize);
        
        if (!wavePeriodPixels || wavePeriodPixels <= 0) {
            return window.appState.config.graphHeight / 2;
        }
        
        const currentDay = window.appState.currentDay || 0;
        
        // Текущее смещение волны (с учетом дробной части времени)
        let currentOffsetPx = (currentDay * window.appState.config.squareSize) % wavePeriodPixels;
        
        // Корректируем для отрицательных значений
        if (currentOffsetPx < 0) {
            currentOffsetPx = wavePeriodPixels + currentOffsetPx;
        }
        
        // Относительная X-координата внутри периода волны
        const relativeX = x + currentOffsetPx;
        
        // Фазовая поправка
        const phaseOffsetPixels = window.appState.config.phaseOffsetDays * window.appState.config.squareSize;
        const centerY = window.appState.config.graphHeight / 2;
        const amplitude = window.appState.config.amplitude;
        
        // Синусоидальная функция
        const y = centerY - amplitude * Math.sin(
            2 * Math.PI * (relativeX + phaseOffsetPixels) / wavePeriodPixels
        );
        
        return y;
    }
    
    /**
     * Находит X-координату волны при заданном Y (для вертикальных выносок)
     * @param {Object} wave - Объект волны
     * @param {number} targetY - Целевая Y-координата
     * @returns {number|null} X-координата или null если нет пересечения
     */
    findWaveXAtY(wave, targetY) {
        const wavePeriodPixels = window.appState.periods[wave.id] || 
                               (wave.period * window.appState.config.squareSize);
        
        if (!wavePeriodPixels || wavePeriodPixels <= 0) {
            return null;
        }
        
        const centerY = window.appState.config.graphHeight / 2;
        const amplitude = window.appState.config.amplitude;
        
        // Проверяем, достижима ли targetY для этой амплитуды
        if (Math.abs(targetY - centerY) > amplitude) {
            return null; // Точка вне диапазона волны
        }
        
        // Вычисляем фазу для заданного Y: sin(θ) = (centerY - targetY) / amplitude
        const sinValue = (centerY - targetY) / amplitude;
        
        // Проверяем диапазон синуса
        if (Math.abs(sinValue) > 1) {
            return null;
        }
        
        const theta = Math.asin(sinValue); // Основное решение
        
        // В синусоиде есть два решения на период: θ и π-θ
        const solutions = [theta, Math.PI - theta];
        
        const currentDay = window.appState.currentDay || 0;
        let currentOffsetPx = (currentDay * window.appState.config.squareSize) % wavePeriodPixels;
        
        // Корректируем для отрицательных значений
        if (currentOffsetPx < 0) {
            currentOffsetPx = wavePeriodPixels + currentOffsetPx;
        }
        
        const phaseOffsetPixels = window.appState.config.phaseOffsetDays * window.appState.config.squareSize;
        
        // Ищем ближайшее решение в пределах видимой области
        let bestX = null;
        let minDistance = Infinity;
        
        solutions.forEach(solution => {
            // Проверяем несколько периодов вперед и назад
            for (let n = -2; n <= 2; n++) {
                // x = (θ/(2π) + n) * period - phaseOffset - currentOffset
                const x = ((solution / (2 * Math.PI) + n) * wavePeriodPixels - phaseOffsetPixels - currentOffsetPx);
                
                // Корректируем x в диапазон [0, wavePeriodPixels)
                const normalizedX = ((x % wavePeriodPixels) + wavePeriodPixels) % wavePeriodPixels;
                
                // Проверяем, находится ли в видимой области
                if (normalizedX >= 0 && normalizedX <= window.appState.graphWidth) {
                    const distance = Math.abs(normalizedX - window.appState.graphWidth / 2);
                    if (distance < minDistance) {
                        minDistance = distance;
                        bestX = normalizedX;
                    }
                }
            }
        });
        
        return bestX;
    }
    
    /**
     * Гарантированное создание элементов волн для активной даты
     */
    createVisibleWaveElementsForActiveDate() {
        console.log('WavesManager: гарантированное создание элементов волн');
        
        window.appState.data.waves.forEach(wave => {
            const waveIdStr = String(wave.id);
            const isWaveVisible = window.appState.waveVisibility[waveIdStr] !== false;
            const isGroupEnabled = this.isWaveGroupEnabled(wave.id);
            const shouldShow = isWaveVisible && isGroupEnabled;
            
            if (shouldShow && !this.waveContainers[wave.id]) {
                console.log('Создаем отсутствующий элемент волны:', wave.id, wave.name);
                this.createWaveElement(wave);
            }
        });
    }
    
    // ================ МЕТОДЫ ДЛЯ РАБОТЫ С ВОЛНАМИ ================
    
    addCustomWave(name, period, type, color) {
        if (!name || !period) {
            alert('Пожалуйста, введите название и период');
            return null;
        }
        
        const newWave = {
            id: window.appState.generateId(),
            name: name,
            period: parseFloat(period),
            type: type,
            color: color,
            visible: true,
            bold: false,
            cornerColor: false
        };
        
        // Добавляем волну
        window.appState.data.waves.push(newWave);
        window.appState.waveVisibility[newWave.id] = true;
        window.appState.waveBold[newWave.id] = false;
        window.appState.waveCornerColor[newWave.id] = false;
        
        // Добавляем в группу по умолчанию
        const defaultGroup = window.appState.data.groups.find(g => g.id === 'default-group');
        if (defaultGroup) {
            defaultGroup.waves.unshift(newWave.id);
            defaultGroup.expanded = true;
        }
        
        // Создаем элемент, если группа включена
        if (this.isWaveGroupEnabled(newWave.id)) {
            this.createWaveElement(newWave);
        }
        
        this.updatePosition();
        window.appState.save();
        
        return newWave;
    }
    
    deleteWave(waveId) {
        if (!confirm('Уничтожить этот колосок?')) return;
        
        const waveIdStr = String(waveId);
        
        // Удаляем из групп
        window.appState.data.groups.forEach(group => {
            if (group.waves) {
                group.waves = group.waves.filter(w => {
                    const wStr = String(w);
                    return wStr !== waveIdStr;
                });
            }
        });
        
        // Удаляем из массива волн
        window.appState.data.waves = window.appState.data.waves.filter(wave => {
            return String(wave.id) !== waveIdStr;
        });
        
        // Удаляем из состояний
        delete window.appState.waveVisibility[waveIdStr];
        delete window.appState.waveBold[waveIdStr];
        delete window.appState.waveCornerColor[waveIdStr];
        delete window.appState.waveOriginalColors[waveIdStr];
        delete window.appState.periods[waveIdStr];
        
        // Удаляем DOM элементы
        const waveContainer = this.waveContainers[waveIdStr];
        if (waveContainer) {
            waveContainer.remove();
            delete this.waveContainers[waveIdStr];
            delete this.wavePaths[waveIdStr];
        }
        
        // Удаляем выноски
        const leftLabel = document.getElementById(`waveLabel${waveId}-left`);
        const rightLabel = document.getElementById(`waveLabel${waveId}-right`);
        const topLabel = document.getElementById(`waveLabel${waveId}-top`);
        const bottomLabel = document.getElementById(`waveLabel${waveId}-bottom`);
        
        if (leftLabel) leftLabel.remove();
        if (rightLabel) rightLabel.remove();
        if (topLabel) topLabel.remove();
        if (bottomLabel) bottomLabel.remove();
        
        delete this.waveLabelElements[`${waveId}-left`];
        delete this.waveLabelElements[`${waveId}-right`];
        delete this.waveLabelElements[`${waveId}-top`];
        delete this.waveLabelElements[`${waveId}-bottom`];
        
        this.updatePosition();
        window.grid.updateGridNotesHighlight();
        this.updateCornerSquareColors();
        window.appState.save();
    }
    
    updateCornerSquareColors() {
        let activeColor = 'red';
        let hasActiveWave = false;
        
        // Ищем волну, окрашивающую края
        window.appState.data.waves.forEach(wave => {
            const waveIdStr = String(wave.id);
            if (window.appState.waveCornerColor[waveIdStr]) {
                activeColor = wave.color;
                hasActiveWave = true;
            }
        });
        
        // Обновляем цвет краев
        document.querySelectorAll('.corner-square').forEach(square => {
            if (hasActiveWave) {
                square.style.backgroundColor = activeColor;
            } else {
                square.style.backgroundColor = 'red';
            }
        });
    }
    
    setWaveCornerColor(waveId, enabled) {
        const waveIdStr = String(waveId);
        
        // Если включаем окраску для одной волны, выключаем у других
        if (enabled) {
            window.appState.data.waves.forEach(wave => {
                const otherWaveIdStr = String(wave.id);
                if (otherWaveIdStr !== waveIdStr) {
                    window.appState.waveCornerColor[otherWaveIdStr] = false;
                }
            });
        }
        
        window.appState.waveCornerColor[waveIdStr] = enabled;
        
        this.updateCornerSquareColors();
        
        // Обновляем чекбоксы в DOM
        document.querySelectorAll('.wave-corner-color-check').forEach(checkbox => {
            const checkboxWaveIdStr = String(checkbox.dataset.id);
            if (checkboxWaveIdStr === waveIdStr) {
                checkbox.checked = enabled;
            } else {
                checkbox.checked = false;
            }
        });
        
        window.appState.save();
        
        // Обновляем UI
        if (window.unifiedListManager && window.unifiedListManager.updateWavesList) {
            window.unifiedListManager.updateWavesList();
        }
        
        console.log(`Окраска краев для волны ${waveId}: ${enabled ? 'включена' : 'выключена'}`);
    }
    
    /**
     * Получает все волны в группе
     * @param {Object} group - Объект группы
     * @returns {Array} Массив волн
     */
    getAllWavesInGroup(group) {
        const waves = [];
        
        if (!group || !group.waves || !Array.isArray(group.waves)) {
            return waves;
        }
        
        group.waves.forEach(waveId => {
            const waveIdStr = String(waveId);
            const wave = window.appState.data.waves.find(w => {
                const wIdStr = String(w.id);
                return wIdStr === waveIdStr;
            });
            
            if (wave) {
                waves.push(wave);
            }
        });
        
        return waves;
    }
    
    /**
     * Для обратной совместимости
     */
    calculateDaysBetweenDates(date1, date2) {
        if (!window.timeUtils || !window.timeUtils.getDaysBetweenExact) {
            // Fallback
            const d1 = date1 instanceof Date ? date1 : new Date(date1);
            const d2 = date2 instanceof Date ? date2 : new Date(date2);
            
            if (isNaN(d1.getTime()) || isNaN(d2.getTime())) {
                return 0;
            }
            
            const timeDiff = d2.getTime() - d1.getTime();
            return timeDiff / (1000 * 60 * 60 * 24);
        }
        
        return window.timeUtils.getDaysBetweenExact(date1, date2);
    }
}

window.waves = new WavesManager();