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
			return;
		}
		
		this.createVisibleWaveElements();
		this.updatePosition();
		this.initialized = true;
	}
    
    calculateRequiredPeriods(periodPx) {
        const viewportWidth = window.appState.graphWidth;
        
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
        
        const periodsToCoverViewport = Math.ceil(viewportWidth / periodPx);
        const safetyMargin = 3;
        
        return Math.max(3, periodsToCoverViewport + safetyMargin);
    }
    
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
    
    createVisibleWaveElements() {
        document.querySelectorAll('.wave-container').forEach(c => c.remove());
        document.querySelectorAll('.wave-label').forEach(l => l.remove());
        
        const axisXPointsContainer = document.querySelector('.wave-axis-x-points');
        if (axisXPointsContainer) {
            axisXPointsContainer.innerHTML = '';
        }
        
        this.waveContainers = {};
        this.wavePaths = {};
        this.waveLabelElements = {};
        
        let createdCount = 0;
        
        const hasActiveDate = window.appState.activeDateId && 
                             window.appState.data.dates.some(d => d.id === window.appState.activeDateId);
        
        if (!hasActiveDate) {
            return;
        }
        
        window.appState.data.waves.forEach(wave => {
            const waveIdStr = String(wave.id);
            const isWaveVisible = window.appState.waveVisibility[waveIdStr] !== false;
            
            if (isWaveVisible && this.isWaveGroupEnabled(wave.id)) {
                this.createWaveElement(wave);
                createdCount++;
            }
        });
    }
    
    createWaveElement(wave) {
        const container = document.createElement('div');
        container.className = 'wave-container';
        container.id = `waveContainer${wave.id}`;
        
        const periodPx = wave.period * window.appState.config.squareSize;
        
        const totalPeriods = this.calculateRequiredPeriods(periodPx);
        const containerWidth = periodPx * totalPeriods;
        
        container.style.width = `${containerWidth}px`;
        container.style.height = '100%';
        container.style.position = 'absolute';
        container.style.top = '0';
        container.style.left = `-${containerWidth / 2}px`;
        
        container.dataset.totalPeriods = totalPeriods;
        container.dataset.periodPx = periodPx;
        container.dataset.wavePeriod = wave.period;
        container.dataset.waveId = wave.id;
        
        const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        svg.classList.add('wave');
        svg.setAttribute('preserveAspectRatio', 'none');
        svg.setAttribute('viewBox', `0 0 ${containerWidth} ${window.appState.config.graphHeight}`);
        svg.style.width = '100%';
        svg.style.height = '100%';
        
        const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
        path.classList.add('wave-path');
        path.id = `wavePath${wave.id}`;
        path.style.stroke = wave.color;
        
        let waveType = wave.type;
        
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
        
        if (waveType && waveType !== 'solid') {
            path.classList.add(window.dom.getWaveStyle(waveType));
        }
        
        const waveIdStr = String(wave.id);
        if (window.appState.waveBold[waveIdStr]) {
            path.classList.add('bold');
        }
        
        this.generateSineWave(periodPx, path, container, totalPeriods);
        
        svg.appendChild(path);
        container.appendChild(svg);
        
        const graphElement = document.getElementById('graphElement');
        if (graphElement) {
            graphElement.appendChild(container);
        }
        
        this.waveContainers[wave.id] = container;
        this.wavePaths[wave.id] = path;
        window.appState.periods[wave.id] = periodPx;
    }
    
    generateSineWave(periodPx, wavePath, waveContainer, totalPeriods = 3) {
        const totalWidth = periodPx * totalPeriods;
        const points = 1500;
        const step = totalWidth / points;
        
        const phaseOffsetPixels = window.appState.config.phaseOffsetDays * window.appState.config.squareSize;
        
        const waveSvg = waveContainer.querySelector('.wave');
        if (waveSvg) {
            waveSvg.setAttribute('viewBox', `0 0 ${totalWidth} ${window.appState.config.graphHeight}`);
        }
        
        let pathData = `M0,${window.appState.config.graphHeight / 2} `;
        
        for (let i = 1; i <= points; i++) {
            const x = i * step;
            
            const y = window.appState.config.graphHeight / 2 - 
                     window.appState.config.amplitude * 
                     Math.sin(2 * Math.PI * (x + phaseOffsetPixels) / periodPx);
            
            pathData += `L${x},${y} `;
        }
        
        if (wavePath) {
            wavePath.setAttribute('d', pathData);
        }
        
        const waveId = waveContainer.dataset.waveId;
        if (waveId) {
            window.appState.periods[waveId] = periodPx;
        }
    }
    
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
    
    getActiveWaves() {
        return window.appState.data.waves.filter(wave => {
            const waveIdStr = String(wave.id);
            const isVisible = window.appState.waveVisibility[waveIdStr] !== false;
            const isGroupEnabled = this.isWaveGroupEnabled(wave.id);
            return isVisible && isGroupEnabled;
        });
    }
    
    updatePosition() {
        if (window.timeBarManager && window.timeBarManager.updateTimeIndicator) {
            window.timeBarManager.updateTimeIndicator();
        }
        
        if (window.grid && window.grid.updateGridOffset) {
            window.grid.updateGridOffset();
        }
        
        if (window.appState.currentDay === undefined || 
            window.appState.currentDay === null ||
            isNaN(window.appState.currentDay)) {
            window.appState.currentDay = 0;
        }
        
        const currentDay = window.appState.currentDay || 0;
        
        window.appState.data.waves.forEach(wave => {
            const wavePeriodPixels = window.appState.periods[wave.id] || 
                                   (wave.period * window.appState.config.squareSize);
            
            if (!wavePeriodPixels || wavePeriodPixels <= 0) {
                return;
            }
            
            let currentPositionPx = (currentDay * window.appState.config.squareSize) % wavePeriodPixels;
            
            if (currentPositionPx < 0) {
                currentPositionPx = wavePeriodPixels + currentPositionPx;
            }
            
            const waveIdStr = String(wave.id);
            const isWaveVisible = window.appState.waveVisibility[waveIdStr] !== false;
            const shouldShow = isWaveVisible && this.isWaveGroupEnabled(wave.id);
            
            const container = this.waveContainers[wave.id];
            if (container) {
                container.style.transition = 'none';
                container.style.transform = `translateX(${-currentPositionPx}px)`;
                container.style.display = shouldShow ? 'block' : 'none';
                
                const path = this.wavePaths[wave.id];
                if (path) {
                    path.classList.toggle('bold', window.appState.waveBold[waveIdStr]);
                }
            }
        });
        
        this.updateAllWaveLabels();
        
        this.updateVerticalWaveLabelsTime();
    }
    
    updateAllWaveLabels() {
        this.updateHorizontalWaveLabels();
        this.updateVerticalWaveLabels();
        this.updateAxisXIntersectionPoints();
		//this.renderWaveIntersectionPoints();
    }
    
    updateHorizontalWaveLabels() {
        const now = Date.now();
        
        if (now - this.lastUpdateTime < this.updateInterval) {
            return;
        }
        
        this.lastUpdateTime = now;
        
        const leftContainer = document.querySelector('.wave-labels-left');
        const rightContainer = document.querySelector('.wave-labels-right');
        
        if (!leftContainer || !rightContainer) {
            return;
        }
        
        leftContainer.innerHTML = '';
        rightContainer.innerHTML = '';
        
        window.appState.data.waves.forEach(wave => {
            const waveIdStr = String(wave.id);
            const isWaveVisible = window.appState.waveVisibility[waveIdStr] !== false;
            const shouldShow = isWaveVisible && this.isWaveGroupEnabled(wave.id);
            
            if (!shouldShow) return;
            
            const leftY = this.calculateWaveYAtX(wave, 0);
            const rightY = this.calculateWaveYAtX(wave, window.appState.graphWidth);
            
            if (leftY >= 0 && leftY <= window.appState.config.graphHeight) {
                this.createHorizontalWaveLabel(wave, leftY, 'left', leftContainer);
            }
            
            if (rightY >= 0 && rightY <= window.appState.config.graphHeight) {
                this.createHorizontalWaveLabel(wave, rightY, 'right', rightContainer);
            }
        });
    }
    
    updateVerticalWaveLabels() {
        const topContainer = document.querySelector('.wave-labels-top');
        const bottomContainer = document.querySelector('.wave-labels-bottom');
        
        if (!topContainer || !bottomContainer) {
            return;
        }
        
        topContainer.innerHTML = '';
        bottomContainer.innerHTML = '';
        
        window.appState.data.waves.forEach(wave => {
            const waveIdStr = String(wave.id);
            const isWaveVisible = window.appState.waveVisibility[waveIdStr] !== false;
            const shouldShow = isWaveVisible && this.isWaveGroupEnabled(wave.id);
            
            if (!shouldShow) return;
            
            const topX = this.findWaveXAtY(wave, 0);
            const bottomX = this.findWaveXAtY(wave, window.appState.config.graphHeight);
            
            if (topX !== null && topX >= 0 && topX <= window.appState.graphWidth) {
                this.createVerticalWaveLabel(wave, topX, 'top', topContainer);
            }
            
            if (bottomX !== null && bottomX >= 0 && bottomX <= window.appState.graphWidth) {
                this.createVerticalWaveLabel(wave, bottomX, 'bottom', bottomContainer);
            }
        });
    }
    
    updateAxisXIntersectionPoints() {
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
        
        if (axisXPointsContainer.classList.contains('hidden')) {
            axisXPointsContainer.innerHTML = '';
            return;
        }
        
        axisXPointsContainer.innerHTML = '';
        
        window.appState.data.waves.forEach(wave => {
            const waveIdStr = String(wave.id);
            const isWaveVisible = window.appState.waveVisibility[waveIdStr] !== false;
            const shouldShow = isWaveVisible && this.isWaveGroupEnabled(wave.id);
            
            if (!shouldShow) return;
            
            const intersectionPoints = this.findAxisXIntersectionPoints(wave);
            
            intersectionPoints.forEach(x => {
                this.createAxisXPoint(wave, x, axisXPointsContainer);
            });
        });
    }
    
	findAxisXIntersectionPoints(wave) {
		const points = [];
		const wavePeriodPixels = window.appState.periods[wave.id] || 
							(wave.period * window.appState.config.squareSize);
		
		if (!wavePeriodPixels) return points;
		
		const currentDay = window.appState.currentDay || 0;
		let currentOffsetPx = (currentDay * window.appState.config.squareSize) % wavePeriodPixels;
		if (currentOffsetPx < 0) currentOffsetPx = wavePeriodPixels + currentOffsetPx;
		
		const phaseOffsetPixels = window.appState.config.phaseOffsetDays * window.appState.config.squareSize;
		
		const intersectionPhases = [0.0, 0.5];
		
		for (let n = -3; n <= 3; n++) {
			intersectionPhases.forEach(phase => {
				const x = ((phase + n) * wavePeriodPixels - phaseOffsetPixels - currentOffsetPx);
				
				const normalizedX = ((x % wavePeriodPixels) + wavePeriodPixels) % wavePeriodPixels;
				
				if (normalizedX >= 0 && normalizedX <= window.appState.graphWidth) {
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
    
	navigateToAxisXIntersection(wave, x) {
		const squaresLeft = Math.floor(window.appState.config.gridSquaresX / 2);
		const currentDate = new Date(window.appState.currentDate);
		const leftDate = new Date(currentDate);
		leftDate.setDate(leftDate.getDate() - squaresLeft);
		leftDate.setHours(0, 0, 0, 0);
		
		const wavePeriodPixels = window.appState.periods[wave.id] || 
							(wave.period * window.appState.config.squareSize);
		
		const currentDay = window.appState.currentDay || 0;
		let currentOffsetPx = (currentDay * window.appState.config.squareSize) % wavePeriodPixels;
		if (currentOffsetPx < 0) currentOffsetPx = wavePeriodPixels + currentOffsetPx;
		
		const phaseOffsetPixels = window.appState.config.phaseOffsetDays * window.appState.config.squareSize;
		
		const relativePosition = x + currentOffsetPx + phaseOffsetPixels;
		
		const phaseInPeriod = (relativePosition % wavePeriodPixels) / wavePeriodPixels;
		
		let targetPhase;
		const distanceToZero = Math.min(
			Math.abs(phaseInPeriod - 0.0),
			Math.abs(phaseInPeriod - 1.0)
		);
		const distanceToHalf = Math.abs(phaseInPeriod - 0.5);
		
		if (distanceToZero < distanceToHalf) {
			targetPhase = 0.0;
		} else {
			targetPhase = 0.5;
		}
		
		const phaseAtLeft = this.getPhaseAtTime(wave, leftDate);
		
		let phaseDiff = targetPhase - phaseAtLeft;
		if (phaseDiff < 0) {
			phaseDiff += 1.0;
		}
		
		const daysToIntersection = phaseDiff * wave.period;
		
		const intersectionTime = new Date(leftDate.getTime() + (daysToIntersection * 24 * 3600 * 1000));
		
		if (window.dates && window.dates.setDate) {
			window.dates.setDate(intersectionTime, true);
		}
	}

	calculateTimeFromIntersection(point) {
		// Аналогично методу navigateToAxisXIntersection
		
		const squaresLeft = Math.floor(window.appState.config.gridSquaresX / 2);
		const currentDate = new Date(window.appState.currentDate);
		const leftDate = new Date(currentDate);
		leftDate.setDate(leftDate.getDate() - squaresLeft);
		leftDate.setHours(0, 0, 0, 0);
		
		// X координата в пикселях от левого края
		const pixelPosition = point.x;
		
		// Дни от левого края
		const daysFromLeft = pixelPosition / window.appState.config.squareSize;
		
		// Время пересечения
		const intersectionTime = new Date(leftDate.getTime() + (daysFromLeft * 24 * 3600 * 1000));
		
		return intersectionTime;
	}

	getPhaseAtTime(wave, time) {
		const daysFromBase = window.timeUtils.getDaysBetween(window.appState.baseDate, time);
		
		const phase = (daysFromBase % wave.period) / wave.period;
		
		return phase < 0 ? phase + 1 : phase;
	}
    
	calculateTimeFromXCoordinate(wave, x) {
		const squaresLeft = Math.floor(window.appState.config.gridSquaresX / 2);
		const currentDate = new Date(window.appState.currentDate);
		const leftDate = new Date(currentDate);
		leftDate.setDate(leftDate.getDate() - squaresLeft);
		leftDate.setHours(0, 0, 0, 0);
		
		const daysFromLeft = (x / window.appState.config.squareSize);
		
		const pointTime = new Date(leftDate.getTime() + (daysFromLeft * 24 * 3600 * 1000));
		
		return pointTime;
	}
    
    createHorizontalWaveLabel(wave, y, side, container) {
        const labelId = `${wave.id}-${side}`;
        const waveColor = wave.color || '#666666';
        
        const labelElement = document.createElement('div');
        labelElement.className = 'wave-label horizontal';
        labelElement.id = `waveLabel${labelId}`;
        labelElement.dataset.waveId = wave.id;
        labelElement.dataset.side = side;
        labelElement.dataset.labelType = 'horizontal';
        
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
    
    createVerticalWaveLabel(wave, x, position, container) {
        const labelId = `${wave.id}-${position}`;
        const waveColor = wave.color || '#666666';
        
        const extremumTime = this.calculateExtremumTime(wave, position);
        
        const timeString = this.formatExtremumTime(extremumTime);
        
        const labelElement = document.createElement('div');
        labelElement.className = 'wave-label vertical';
        labelElement.id = `waveLabel${labelId}`;
        labelElement.dataset.waveId = wave.id;
        labelElement.dataset.position = position;
        labelElement.dataset.labelType = 'vertical';
        labelElement.dataset.extremumTime = extremumTime.getTime();
        
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
        
        const text = document.createElement('div');
        text.className = 'wave-label-text';
        text.textContent = timeString;
        
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
    
    onHorizontalWaveLabelClick(waveId) {
        const confirmHide = confirm('Скрыть колосок?');
        
        if (!confirmHide) {
            return;
        }
        
        const waveIdStr = String(waveId);
        const isCurrentlyVisible = window.appState.waveVisibility[waveIdStr] !== false;
        
        window.appState.waveVisibility[waveIdStr] = !isCurrentlyVisible;
        window.appState.save();
        
        if (window.unifiedListManager && window.unifiedListManager.updateWavesList) {
            window.unifiedListManager.updateWavesList();
        }
        
        this.updatePosition();
    }
    
    onVerticalWaveLabelClick(labelElement) {
        const waveId = labelElement.dataset.waveId;
        const extremumTime = parseInt(labelElement.dataset.extremumTime);
        const position = labelElement.dataset.position;
        
        this.navigateToExtremumTime(extremumTime);
    }
    
	navigateToExtremumTime(timestamp) {
		const extremumDate = new Date(timestamp);
		
		if (window.dates && window.dates.setDate) {
			window.dates.setDate(extremumDate, true);
		}
	}
    
	calculateExtremumTime(wave, position) {
		const periodPx = window.appState.periods[wave.id] || 
						(wave.period * window.appState.config.squareSize);
		
		if (!periodPx) {
			return new Date();
		}
		
		const extremumPhaseFraction = position === 'top' ? 0.25 : 0.75;
		
		const baseDate = window.appState.baseDate;
		
		const squaresLeft = Math.floor(window.appState.config.gridSquaresX / 2);
		
		const currentDate = new Date(window.appState.currentDate);
		
		const leftDate = new Date(currentDate);
		leftDate.setDate(leftDate.getDate() - squaresLeft);
		leftDate.setHours(0, 0, 0, 0);
		
		const normalizedBaseDate = new Date(baseDate);
		normalizedBaseDate.setHours(0, 0, 0, 0);
		
		const daysFromBaseToLeft = window.timeUtils.getDaysBetween(normalizedBaseDate, leftDate);
		
		const wholeDaysFromBaseToLeft = Math.floor(daysFromBaseToLeft);
		
		const phaseAtLeft = (wholeDaysFromBaseToLeft % wave.period) / wave.period;
		
		const normalizedPhaseAtLeft = phaseAtLeft < 0 ? phaseAtLeft + 1 : phaseAtLeft;
		
		let phaseDiff = extremumPhaseFraction - normalizedPhaseAtLeft;
		if (phaseDiff < 0) {
			phaseDiff += 1.0;
		}
		
		const daysToExtremumFromLeft = phaseDiff * wave.period;
		
		const extremumTime = new Date(leftDate.getTime() + (daysToExtremumFromLeft * 24 * 3600 * 1000));
		
		const rightDate = new Date(leftDate);
		rightDate.setDate(rightDate.getDate() + window.appState.config.gridSquaresX);
		
		if (extremumTime >= leftDate && extremumTime <= rightDate) {
			return extremumTime;
		}
		
		const nextExtremumTime = new Date(extremumTime.getTime() + (wave.period * 24 * 3600 * 1000));
		return nextExtremumTime;
	}
    
    formatExtremumTime(date) {
        const hours = date.getHours().toString().padStart(2, '0');
        const minutes = date.getMinutes().toString().padStart(2, '0');
        const seconds = date.getSeconds().toString().padStart(2, '0');
        
        return `${hours}:${minutes}:${seconds}`;
    }
    
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
    
    calculateWaveYAtX(wave, x) {
        const wavePeriodPixels = window.appState.periods[wave.id] || 
                               (wave.period * window.appState.config.squareSize);
        
        if (!wavePeriodPixels || wavePeriodPixels <= 0) {
            return window.appState.config.graphHeight / 2;
        }
        
        const currentDay = window.appState.currentDay || 0;
        
        let currentOffsetPx = (currentDay * window.appState.config.squareSize) % wavePeriodPixels;
        
        if (currentOffsetPx < 0) {
            currentOffsetPx = wavePeriodPixels + currentOffsetPx;
        }
        
        const relativeX = x + currentOffsetPx;
        
        const phaseOffsetPixels = window.appState.config.phaseOffsetDays * window.appState.config.squareSize;
        const centerY = window.appState.config.graphHeight / 2;
        const amplitude = window.appState.config.amplitude;
        
        const y = centerY - amplitude * Math.sin(
            2 * Math.PI * (relativeX + phaseOffsetPixels) / wavePeriodPixels
        );
        
        return y;
    }
    
    findWaveXAtY(wave, targetY) {
        const wavePeriodPixels = window.appState.periods[wave.id] || 
                               (wave.period * window.appState.config.squareSize);
        
        if (!wavePeriodPixels || wavePeriodPixels <= 0) {
            return null;
        }
        
        const centerY = window.appState.config.graphHeight / 2;
        const amplitude = window.appState.config.amplitude;
        
        if (Math.abs(targetY - centerY) > amplitude) {
            return null;
        }
        
        const sinValue = (centerY - targetY) / amplitude;
        
        if (Math.abs(sinValue) > 1) {
            return null;
        }
        
        const theta = Math.asin(sinValue);
        
        const solutions = [theta, Math.PI - theta];
        
        const currentDay = window.appState.currentDay || 0;
        let currentOffsetPx = (currentDay * window.appState.config.squareSize) % wavePeriodPixels;
        
        if (currentOffsetPx < 0) {
            currentOffsetPx = wavePeriodPixels + currentOffsetPx;
        }
        
        const phaseOffsetPixels = window.appState.config.phaseOffsetDays * window.appState.config.squareSize;
        
        let bestX = null;
        let minDistance = Infinity;
        
        solutions.forEach(solution => {
            for (let n = -2; n <= 2; n++) {
                const x = ((solution / (2 * Math.PI) + n) * wavePeriodPixels - phaseOffsetPixels - currentOffsetPx);
                
                const normalizedX = ((x % wavePeriodPixels) + wavePeriodPixels) % wavePeriodPixels;
                
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
    
    createVisibleWaveElementsForActiveDate() {
        window.appState.data.waves.forEach(wave => {
            const waveIdStr = String(wave.id);
            const isWaveVisible = window.appState.waveVisibility[waveIdStr] !== false;
            const isGroupEnabled = this.isWaveGroupEnabled(wave.id);
            const shouldShow = isWaveVisible && isGroupEnabled;
            
            if (shouldShow && !this.waveContainers[wave.id]) {
                this.createWaveElement(wave);
            }
        });
    }
    
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
        
        window.appState.data.waves.push(newWave);
        window.appState.waveVisibility[newWave.id] = true;
        window.appState.waveBold[newWave.id] = false;
        window.appState.waveCornerColor[newWave.id] = false;
        
        const defaultGroup = window.appState.data.groups.find(g => g.id === 'default-group');
        if (defaultGroup) {
            defaultGroup.waves.unshift(newWave.id);
            defaultGroup.expanded = true;
        }
        
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
        
        window.appState.data.groups.forEach(group => {
            if (group.waves) {
                group.waves = group.waves.filter(w => {
                    const wStr = String(w);
                    return wStr !== waveIdStr;
                });
            }
        });
        
        window.appState.data.waves = window.appState.data.waves.filter(wave => {
            return String(wave.id) !== waveIdStr;
        });
        
        delete window.appState.waveVisibility[waveIdStr];
        delete window.appState.waveBold[waveIdStr];
        delete window.appState.waveCornerColor[waveIdStr];
        delete window.appState.waveOriginalColors[waveIdStr];
        delete window.appState.periods[waveIdStr];
        
        const waveContainer = this.waveContainers[waveIdStr];
        if (waveContainer) {
            waveContainer.remove();
            delete this.waveContainers[waveIdStr];
            delete this.wavePaths[waveIdStr];
        }
        
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
        
        window.appState.data.waves.forEach(wave => {
            const waveIdStr = String(wave.id);
            if (window.appState.waveCornerColor[waveIdStr]) {
                activeColor = wave.color;
                hasActiveWave = true;
            }
        });
        
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
        
        document.querySelectorAll('.wave-corner-color-check').forEach(checkbox => {
            const checkboxWaveIdStr = String(checkbox.dataset.id);
            if (checkboxWaveIdStr === waveIdStr) {
                checkbox.checked = enabled;
            } else {
                checkbox.checked = false;
            }
        });
        
        window.appState.save();
        
        if (window.unifiedListManager && window.unifiedListManager.updateWavesList) {
            window.unifiedListManager.updateWavesList();
        }
    }
    
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
    
    calculateDaysBetweenDates(date1, date2) {
        if (!window.timeUtils || !window.timeUtils.getDaysBetweenExact) {
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

	// В modules/waves.js добавить:
	findWaveIntersectionPoints(wave1, wave2) {
		const points = [];
		
		const periodPx1 = wave1.period * window.appState.config.squareSize;
		const periodPx2 = wave2.period * window.appState.config.squareSize;
		
		// Смещения для обеих волн
		const currentDay = window.appState.currentDay || 0;
		const phaseOffsetPixels = window.appState.config.phaseOffsetDays * window.appState.config.squareSize;
		
		let offset1 = (currentDay * window.appState.config.squareSize) % periodPx1;
		let offset2 = (currentDay * window.appState.config.squareSize) % periodPx2;
		if (offset1 < 0) offset1 = periodPx1 + offset1;
		if (offset2 < 0) offset2 = periodPx2 + offset2;
		
		offset1 += phaseOffsetPixels;
		offset2 += phaseOffsetPixels;
		
		// Дискретный поиск с учетом обеих волн
		const searchPoints = 2000;
		const graphWidth = window.appState.graphWidth;
		
		for (let i = 0; i <= searchPoints; i++) {
			const x = (i / searchPoints) * graphWidth;
			
			// Y с учетом смещений
			const y1 = window.appState.config.graphHeight / 2 - 
					window.appState.config.amplitude * 
					Math.sin(2 * Math.PI * (x + offset1) / periodPx1);
			
			const y2 = window.appState.config.graphHeight / 2 - 
					window.appState.config.amplitude * 
					Math.sin(2 * Math.PI * (x + offset2) / periodPx2);
			
			if (Math.abs(y1 - y2) < 2) {
				const isDuplicate = points.some(p => Math.abs(p.x - x) < 5);
				if (!isDuplicate) {
					points.push({
						x: x,
						y: (y1 + y2) / 2,
						wave1: wave1,
						wave2: wave2,
						offset1: offset1,
						offset2: offset2,
						periodPx1: periodPx1,
						periodPx2: periodPx2
					});
				}
			}
		}
		
		return points;
	}

	calculateAllWaveIntersections() {
		const visibleWaves = this.getActiveWaves();
		const allIntersections = [];
		
		if (visibleWaves.length < 2) return allIntersections;
		
		// Проверяем каждую пару волн
		for (let i = 0; i < visibleWaves.length; i++) {
			for (let j = i + 1; j < visibleWaves.length; j++) {
				const points = this.findWaveIntersectionPoints(
					visibleWaves[i], 
					visibleWaves[j]
				);
				
				points.forEach(point => {
					allIntersections.push({
						...point,
						time: this.calculateTimeFromXCoordinate(visibleWaves[i], point.x),
						wavePair: `${visibleWaves[i].name} × ${visibleWaves[j].name}`
					});
				});
			}
		}
		
		return allIntersections;
	}

	renderWaveIntersectionPoints() {
		// Удаляем старые точки
		this.removeWaveIntersectionPoints();
		
		const intersections = this.calculateAllWaveIntersections();
		
		const container = document.createElement('div');
		container.className = 'wave-intersection-points';
		container.style.position = 'absolute';
		container.style.width = '100%';
		container.style.height = '100%';
		container.style.pointerEvents = 'none';
		container.style.zIndex = '9';
		container.style.top = '0';
		container.style.left = '0';
		
		intersections.forEach(point => {
			const pointElement = document.createElement('div');
			pointElement.className = 'wave-intersection-point';
			pointElement.dataset.time = point.time.toISOString();
			pointElement.dataset.wavePair = point.wavePair;
			pointElement.title = `${point.wavePair}\n${this.formatExtremumTime(point.time)}`;
			
			// Стиль точки
			pointElement.style.position = 'absolute';
			pointElement.style.left = `${point.x}px`;
			pointElement.style.top = `${point.y}px`;
			pointElement.style.width = '6px';
			pointElement.style.height = '6px';
			pointElement.style.borderRadius = '50%';
			pointElement.style.backgroundColor = '#ff0000'; // Красный для отличия от эквилибриумов
			pointElement.style.border = '2px solid #fff';
			pointElement.style.cursor = 'pointer';
			pointElement.style.pointerEvents = 'auto';
			pointElement.style.zIndex = '10';
			pointElement.style.boxShadow = '0 0 3px rgba(0,0,0,0.5)';
			
			// При наведении
			pointElement.addEventListener('mouseenter', (e) => {
				this.showIntersectionTooltip(e.target, point);
			});
			
			pointElement.addEventListener('mouseleave', () => {
				this.hideIntersectionTooltip();
			});
			
			// Клик для навигации
			pointElement.addEventListener('click', (e) => {
				e.stopPropagation();
				this.navigateToIntersectionTime(point.time);
			});
			
			container.appendChild(pointElement);
		});
		
		const graphElement = document.getElementById('graphElement');
		if (graphElement) {
			graphElement.appendChild(container);
		}
		
		return container;
	}

	removeWaveIntersectionPoints() {
		document.querySelectorAll('.wave-intersection-points').forEach(el => el.remove());
	}

	showIntersectionTooltip(element, point) {
		// Показываем просто title атрибут без сложного позиционирования
		element.title = `${point.wave1.name} × ${point.wave2.name}\n${this.formatExtremumTime(point.time)}`;
		
		// Или вообще убрать тултип, использовать только title
	}

	hideIntersectionTooltip() {
		document.querySelectorAll('.intersection-tooltip').forEach(el => el.remove());
	}

	navigateToIntersectionTime(time) {
		if (window.dates && window.dates.setDate) {
			window.dates.setDate(time, true);
		}
	}
}

window.waves = new WavesManager();