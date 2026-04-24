// modules/waves.js - ПОЛНЫЙ ОБНОВЛЕННЫЙ ФАЙЛ
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
        this._enabledWaveIdSetForFrame = null;
    }
    
    _isWaveInEnabledGroupThisFrame(waveId) {
        if (this._enabledWaveIdSetForFrame) {
            return this._enabledWaveIdSetForFrame.has(String(waveId));
        }
        return this.isWaveGroupEnabled(waveId);
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
        container.style.left = '0';
        
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
        const centerY = window.appState.config.graphHeight / 2;
        const amplitude = window.appState.config.amplitude;
        
        const waveSvg = waveContainer.querySelector('.wave');
        if (waveSvg) {
            waveSvg.setAttribute('viewBox', `0 0 ${totalWidth} ${window.appState.config.graphHeight}`);
        }
        
        // M(0,y) по той же формуле, что и остальные точки — иначе излом при ненулевом phaseOffset.
        const y0 = centerY - amplitude * Math.sin(2 * Math.PI * (0 + phaseOffsetPixels) / periodPx);
        let pathData = `M0,${y0} `;
        
        for (let i = 1; i <= points; i++) {
            const x = i * step;
            
            const y = centerY - amplitude * Math.sin(2 * Math.PI * (x + phaseOffsetPixels) / periodPx);
            
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
    
    // ========== НОВЫЕ МЕТОДЫ ДЛЯ ПОДСВЕТКИ ЭКСТРЕМУМОВ ==========
    
    calculateWaveStateAtDay(wave, currentDay) {
        if (!wave.period || wave.period <= 0) return 0;
        
        const phase = (currentDay % wave.period);
        const normalizedPhase = (phase / wave.period) * 2 * Math.PI;
        const waveState = Math.sin(normalizedPhase) * 5;
        
        return waveState;
    }
    
    isExtremumHighlightEnabled() {
        return window.appState && window.appState.extremumWaveColorHighlight !== false;
    }
    
    setWaveStrokeColor(waveId, isExtremum) {
        const path = this.wavePaths[waveId];
        if (!path) return;
        
        const wave = window.appState.data.waves.find(w => String(w.id) === String(waveId));
        if (!wave) return;
        
        if (isExtremum) {
            path.style.stroke = '#ff0000';
        } else {
            path.style.stroke = wave.color;
        }
    }
    

    // opts.forceWaveLabels — сразу пересобрать боковые выноски (обход throttle 50 мс).
    updatePosition(opts = {}) {
        const enabledWaveIds = new Set();
        for (const group of window.appState.data.groups) {
            if (group.enabled && group.waves) {
                for (const wId of group.waves) {
                    enabledWaveIds.add(String(wId));
                }
            }
        }
        this._enabledWaveIdSetForFrame = enabledWaveIds;
        
        try {
            if (window.timeBarManager && window.timeBarManager.updateTimeIndicator) {
                window.timeBarManager.updateTimeIndicator();
            }
            
            if (window.grid && window.grid.updateGridOffset) {
                window.grid.updateGridOffset();
            }
            
            const currentDay = window.appState.currentDay || 0;
            
            window.appState.data.waves.forEach(wave => {
                const waveIdStr = String(wave.id);
                const isWaveVisible = window.appState.waveVisibility[waveIdStr] !== false;
                const shouldShow = isWaveVisible && this._isWaveInEnabledGroupThisFrame(wave.id);
                
                let isExtremum = false;
                if (shouldShow) {
                    const state = this.calculateWaveStateAtDay(wave, currentDay);
                    const atExtremum = (state >= 4 || state <= -4);
                    isExtremum = this.isExtremumHighlightEnabled() && atExtremum;
                    this.setWaveStrokeColor(wave.id, isExtremum);
                    this.updateWaveLabelsColor(wave.id, isExtremum);
                } else {
                    this.setWaveStrokeColor(wave.id, false);
                }
                
                const wavePeriodPixels = window.appState.periods[wave.id] || 
                                    (wave.period * window.appState.config.squareSize);
                
                if (!wavePeriodPixels || wavePeriodPixels <= 0) {
                    return;
                }
                
                let currentPositionPx = (currentDay * window.appState.config.squareSize) % wavePeriodPixels;
                if (currentPositionPx < 0) {
                    currentPositionPx = wavePeriodPixels + currentPositionPx;
                }
                
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
            
            this.updateAllWaveLabels(opts);
            this.updateVerticalWaveLabelsTime();
            this.renderWaveIntersectionPoints();
        } finally {
            this._enabledWaveIdSetForFrame = null;
        }
    }


    updateWaveLabelsColor(waveId, isExtremum) {
        const waveIdStr = String(waveId);
        const wave = window.appState.data.waves.find(w => String(w.id) === waveIdStr);
        if (!wave) return;
        
        const color = isExtremum ? '#ff0000' : wave.color;
        const textColor = this.getContrastTextColor(color);
        
        // Обновляем горизонтальные выноски (левые и правые)
        const leftLabel = document.getElementById(`waveLabel${waveIdStr}-left`);
        const rightLabel = document.getElementById(`waveLabel${waveIdStr}-right`);
        
        if (leftLabel) {
            leftLabel.style.backgroundColor = color;
            leftLabel.style.color = textColor;
            const arrow = leftLabel.querySelector('.wave-label-arrow');
            if (arrow) {
                if (leftLabel.classList.contains('left') || leftLabel.dataset.side === 'left') {
                    arrow.style.borderColor = `transparent transparent transparent ${color}`;
                }
            }
        }
        
        if (rightLabel) {
            rightLabel.style.backgroundColor = color;
            rightLabel.style.color = textColor;
            const arrow = rightLabel.querySelector('.wave-label-arrow');
            if (arrow) {
                if (rightLabel.classList.contains('right') || rightLabel.dataset.side === 'right') {
                    arrow.style.borderColor = `transparent ${color} transparent transparent`;
                }
            }
        }
        
        // Обновляем вертикальные выноски (все экземпляры по волне)
        document.querySelectorAll(`.wave-label.vertical[data-wave-id="${waveIdStr}"]`).forEach(label => {
            label.style.backgroundColor = color;
            label.style.color = textColor;
            const arrow = label.querySelector('.wave-label-arrow');
            if (!arrow) return;
            const pos = label.dataset.position;
            if (pos === 'top') {
                arrow.style.borderColor = `${color} transparent transparent transparent`;
            } else if (pos === 'bottom') {
                arrow.style.borderColor = `transparent transparent ${color} transparent`;
            }
        });
    }
    
    
    updateAllWaveLabels(opts = {}) {
        this.updateHorizontalWaveLabels(opts);
        this.updateVerticalWaveLabels();
        this.updateAxisXIntersectionPoints();
    }
    
    updateHorizontalWaveLabels(opts = {}) {
        const now = Date.now();
        
        if (!opts.forceWaveLabels && now - this.lastUpdateTime < this.updateInterval) {
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
            const shouldShow = isWaveVisible && this._isWaveInEnabledGroupThisFrame(wave.id);
            
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
            const shouldShow = isWaveVisible && this._isWaveInEnabledGroupThisFrame(wave.id);
            
            if (!shouldShow) return;
            
            const topXs = this.findAllExtremumXs(wave, 'top');
            topXs.forEach((topX, idx) => {
                this.createVerticalWaveLabel(wave, topX, 'top', topContainer, idx);
            });
            
            const bottomXs = this.findAllExtremumXs(wave, 'bottom');
            bottomXs.forEach((bottomX, idx) => {
                this.createVerticalWaveLabel(wave, bottomX, 'bottom', bottomContainer, idx);
            });
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
            const shouldShow = isWaveVisible && this._isWaveInEnabledGroupThisFrame(wave.id);
            
            if (!shouldShow) return;
            
            const intersectionPoints = this.findAxisXIntersectionPoints(wave);
            
            intersectionPoints.forEach(x => {
                this.createAxisXPoint(wave, x, axisXPointsContainer);
            });
        });
    }
    
    findAxisXIntersectionPoints(wave) {
        const wavePeriodPixels = window.appState.periods[wave.id] ||
            (wave.period * window.appState.config.squareSize);
        
        if (!wavePeriodPixels) return [];
        
        const currentDay = window.appState.currentDay || 0;
        let currentOffsetPx = (currentDay * window.appState.config.squareSize) % wavePeriodPixels;
        if (currentOffsetPx < 0) currentOffsetPx = wavePeriodPixels + currentOffsetPx;
        
        const phaseOffsetPixels = window.appState.config.phaseOffsetDays * window.appState.config.squareSize;
        const graphW = window.appState.graphWidth;
        
        // y = centerY ⟺ sin(2π(relX+ph)/P) = 0 ⟺ (relX+ph)/P = k/2, k ∈ ℤ
        // relX = x + currentOffsetPx
        const halfPeriod = wavePeriodPixels / 2;
        const base = -phaseOffsetPixels - currentOffsetPx;
        
        const kMin = Math.floor((0 - base) / halfPeriod) - 1;
        const kMax = Math.ceil((graphW - base) / halfPeriod) + 1;
        
        const points = [];
        for (let k = kMin; k <= kMax; k++) {
            const x = k * halfPeriod + base;
            if (x >= -1e-6 && x <= graphW + 1e-6) {
                points.push(Math.min(graphW, Math.max(0, x)));
            }
        }
        
        points.sort((a, b) => a - b);
        const uniq = [];
        for (const px of points) {
            if (uniq.length && Math.abs(px - uniq[uniq.length - 1]) < 2) {
                continue;
            }
            uniq.push(px);
        }
        return uniq;
    }
    
    createAxisXPoint(wave, x, container) {
        const centerY = window.appState.config.graphHeight / 2;
        const waveColor = wave.color || '#666666';
        const textColor = this.getContrastTextColor(waveColor);
        
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
        point.style.backgroundColor = waveColor;
        point.style.border = `1px solid ${textColor}`;
        point.style.cursor = 'pointer';
        point.style.pointerEvents = 'auto';
        point.style.zIndex = '9';
        point.style.transition = 'all 0.2s';
        
        point.title = `${wave.name} - пересечение с осью`;
        
        point.addEventListener('click', (e) => {
            e.stopPropagation();
            this.navigateToAxisXIntersection(wave, x);
        });
        
        point.addEventListener('mouseenter', () => {
            point.style.transform = 'translate(-50%, -50%) scale(1.3)';
            point.style.zIndex = '10';
        });
        
        point.addEventListener('mouseleave', () => {
            point.style.transform = 'translate(-50%, -50%)';
            point.style.zIndex = '9';
        });
        
        container.appendChild(point);
    }
    
    navigateToAxisXIntersection(wave, x) {
        // Время календаря в столбце x текущего визора; совпадает с фазой точки эквилибриума по этой x
        // (старая логика через phaseInPeriod и «первое» пересечение от leftDate ломалась при нескольких нулях на экране)
        const intersectionTime = this.calculateTimeFromXCoordinate(wave, x);
        if (window.dates && window.dates.setDate) {
            window.dates.setDate(intersectionTime, true);
        }
    }
    
    calculateTimeFromXCoordinate(wave, x) {
        const squaresLeft = Math.floor(window.appState.config.gridSquaresX / 2);
        const currentDay = window.appState.currentDay || 0;
        
        const daysFromCenter = (x - (window.appState.graphWidth / 2)) / window.appState.config.squareSize;
        
        const targetDay = currentDay + daysFromCenter;
        
        const baseDate = window.appState.baseDate instanceof Date ? 
            window.appState.baseDate : 
            new Date(window.appState.baseDate);
        
        const pointTime = new Date(baseDate.getTime() + (targetDay * 24 * 3600 * 1000));
        
        return pointTime;
    }
    
    getPhaseAtTime(wave, time) {
        const daysFromBase = window.timeUtils.getDaysBetween(window.appState.baseDate, time);
        
        const phase = (daysFromBase % wave.period) / wave.period;
        
        return phase < 0 ? phase + 1 : phase;
    }
    
    getContrastTextColor(backgroundColor) {
        if (!backgroundColor) return '#000000';
        
        let r, g, b;
        
        if (backgroundColor.startsWith('#')) {
            const hex = backgroundColor.slice(1);
            if (hex.length === 3) {
                r = parseInt(hex[0] + hex[0], 16);
                g = parseInt(hex[1] + hex[1], 16);
                b = parseInt(hex[2] + hex[2], 16);
            } else if (hex.length === 6) {
                r = parseInt(hex.slice(0, 2), 16);
                g = parseInt(hex.slice(2, 4), 16);
                b = parseInt(hex.slice(4, 6), 16);
            } else {
                return '#000000';
            }
        } else {
            return '#000000';
        }
        
        const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
        return luminance > 0.5 ? '#000000' : '#ffffff';
    }
    

    
    createHorizontalWaveLabel(wave, y, side, container) {
        const labelId = `${wave.id}-${side}`;
        const currentDay = window.appState.currentDay || 0;
        const state = this.calculateWaveStateAtDay(wave, currentDay);
        const atExtremum = (state >= 4 || state <= -4);
        const isExtremum = this.isExtremumHighlightEnabled() && atExtremum;
        
        // Выбираем цвет: красный для экстремума, иначе цвет волны
        const waveColor = isExtremum ? '#ff0000' : (wave.color || '#666666');
        const textColor = this.getContrastTextColor(waveColor);
        
        const labelElement = document.createElement('div');
        labelElement.className = `wave-label horizontal ${side}`;
        labelElement.id = `waveLabel${labelId}`;
        labelElement.dataset.waveId = wave.id;
        labelElement.dataset.side = side;
        labelElement.dataset.labelType = 'horizontal';
        
        labelElement.style.position = 'absolute';
        labelElement.style.top = `${y}px`;
        labelElement.style.width = 'auto';
        labelElement.style.backgroundColor = waveColor;
        labelElement.style.color = textColor;
        labelElement.style.opacity = '0.7';
        labelElement.style.zIndex = '1';
        labelElement.style.padding = '2px 6px';
        labelElement.style.borderRadius = '3px';
        labelElement.style.fontSize = '11px';
        labelElement.style.transform = 'translateY(-50%)';
        labelElement.style.cursor = 'pointer';
        labelElement.style.fontWeight = '500';
        labelElement.style.whiteSpace = 'nowrap';
        
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
            labelElement.style.opacity = '0.7';
            labelElement.style.zIndex = '1';
        });
        
        return labelElement;
    }


    createVerticalWaveLabel(wave, x, position, container, index = 0) {
        const labelId = `${wave.id}-${position}-${index}`;
        const currentDay = window.appState.currentDay || 0;
        const state = this.calculateWaveStateAtDay(wave, currentDay);
        const atExtremum = (state >= 4 || state <= -4);
        const isExtremum = this.isExtremumHighlightEnabled() && atExtremum;
        
        // Выбираем цвет: красный для экстремума, иначе цвет волны
        const waveColor = isExtremum ? '#ff0000' : (wave.color || '#666666');
        const textColor = this.getContrastTextColor(waveColor);
        
        const extremumTime = this.calculateTimeFromXCoordinate(wave, x);
        const timeString = this.formatExtremumTime(extremumTime);
        
        const labelElement = document.createElement('div');
        labelElement.className = `wave-label vertical ${position}`;
        labelElement.id = `waveLabel${labelId}`;
        labelElement.dataset.waveId = wave.id;
        labelElement.dataset.position = position;
        labelElement.dataset.labelType = 'vertical';
        labelElement.dataset.refX = String(x);
        labelElement.dataset.extremumTime = extremumTime.getTime();
        
        labelElement.style.position = 'absolute';
        labelElement.style.left = `${x}px`;
        labelElement.style.width = 'auto';
        labelElement.style.backgroundColor = waveColor;
        labelElement.style.color = textColor;
        labelElement.style.opacity = '0.7';
        labelElement.style.zIndex = '1';
        labelElement.style.padding = '2px 6px';
        labelElement.style.borderRadius = '3px';
        labelElement.style.fontSize = '11px';
        labelElement.style.transform = 'translateX(-50%)';
        labelElement.style.cursor = 'pointer';
        labelElement.style.fontFamily = 'monospace';
        labelElement.style.letterSpacing = '0.5px';
        labelElement.style.fontWeight = '500';
        labelElement.style.whiteSpace = 'nowrap';
        
        const text = document.createElement('div');
        text.className = 'wave-label-text';
        text.textContent = timeString;
        text.style.textAlign = 'center';
        
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
            labelElement.style.opacity = '0.7';
            labelElement.style.zIndex = '1';
        });
        
        return labelElement;
    }

    
    onHorizontalWaveLabelClick(waveId) {
        const waveIdStr = String(waveId);
        const isCurrentlyVisible = window.appState.waveVisibility[waveIdStr] !== false;
        
        window.appState.waveVisibility[waveIdStr] = !isCurrentlyVisible;
        
        this.updatePosition({ forceWaveLabels: true });
        window.appState.saveDebounced();
        
        requestAnimationFrame(() => {
            if (window.unifiedListManager && window.unifiedListManager.updateWavesList) {
                window.unifiedListManager.updateWavesList();
            }
        });
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
            const refX = label.dataset.refX;
            
            const wave = window.appState.data.waves.find(w => String(w.id) === waveId);
            if (!wave) return;
            
            const extremumTime = refX !== undefined && refX !== ''
                ? this.calculateTimeFromXCoordinate(wave, parseFloat(refX, 10))
                : this.calculateExtremumTime(wave, label.dataset.position);
            const timeString = this.formatExtremumTime(extremumTime);
            
            const textElement = label.querySelector('.wave-label-text');
            if (textElement) {
                textElement.textContent = timeString;
            }
            label.dataset.extremumTime = String(extremumTime.getTime());
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
    
    /**
     * Все горизонтальные координаты экстремумов (верх/низ синусоиды) в пределах видимой ширины графа.
     * Раньше использовался один X ближе к центру — при малом периоде остальные пики не получали выносок.
     */
    findAllExtremumXs(wave, position) {
        const wavePeriodPixels = window.appState.periods[wave.id] ||
            (wave.period * window.appState.config.squareSize);
        
        if (!wavePeriodPixels || wavePeriodPixels <= 0) {
            return [];
        }
        
        const amplitude = window.appState.config.amplitude;
        if (amplitude <= 0) {
            return [];
        }
        
        const currentDay = window.appState.currentDay || 0;
        let currentOffsetPx = (currentDay * window.appState.config.squareSize) % wavePeriodPixels;
        if (currentOffsetPx < 0) {
            currentOffsetPx = wavePeriodPixels + currentOffsetPx;
        }
        
        const phaseOffsetPixels = window.appState.config.phaseOffsetDays * window.appState.config.squareSize;
        const graphW = window.appState.graphWidth;
        
        // Вершина: sin=1 → фаза 1/4 цикла; впадина: sin=-1 → 3/4 цикла (как в calculateExtremumTime)
        const quarter = position === 'top' ? 0.25 : 0.75;
        const base = quarter * wavePeriodPixels - phaseOffsetPixels - currentOffsetPx;
        
        const mMin = Math.floor((0 - base) / wavePeriodPixels) - 1;
        const mMax = Math.ceil((graphW - base) / wavePeriodPixels) + 1;
        
        const points = [];
        for (let m = mMin; m <= mMax; m++) {
            const x = base + m * wavePeriodPixels;
            if (x >= -1e-6 && x <= graphW + 1e-6) {
                points.push(Math.min(graphW, Math.max(0, x)));
            }
        }
        
        points.sort((a, b) => a - b);
        const uniq = [];
        for (const px of points) {
            if (uniq.length && Math.abs(px - uniq[uniq.length - 1]) < 2) {
                continue;
            }
            uniq.push(px);
        }
        return uniq;
    }
    
    /** Одна точка пересечения волны с горизонталью targetY, ближайшая к центру графа (для совместимости). */
    findWaveXAtY(wave, targetY) {
        const all = this.findAllWaveXAtY(wave, targetY);
        if (!all.length) return null;
        const cx = window.appState.graphWidth / 2;
        return all.reduce((best, x) =>
            (Math.abs(x - cx) < Math.abs(best - cx) ? x : best), all[0]);
    }
    
    findAllWaveXAtY(wave, targetY) {
        const wavePeriodPixels = window.appState.periods[wave.id] ||
            (wave.period * window.appState.config.squareSize);
        
        if (!wavePeriodPixels || wavePeriodPixels <= 0) {
            return [];
        }
        
        const centerY = window.appState.config.graphHeight / 2;
        const amplitude = window.appState.config.amplitude;
        
        if (Math.abs(targetY - centerY) > amplitude + 1e-9) {
            return [];
        }
        
        const sinValue = (centerY - targetY) / amplitude;
        
        if (Math.abs(sinValue) > 1 + 1e-9) {
            return [];
        }
        
        const theta = Math.asin(Math.max(-1, Math.min(1, sinValue)));
        
        const solutions = [theta, Math.PI - theta];
        
        const currentDay = window.appState.currentDay || 0;
        let currentOffsetPx = (currentDay * window.appState.config.squareSize) % wavePeriodPixels;
        
        if (currentOffsetPx < 0) {
            currentOffsetPx = wavePeriodPixels + currentOffsetPx;
        }
        
        const phaseOffsetPixels = window.appState.config.phaseOffsetDays * window.appState.config.squareSize;
        const graphW = window.appState.graphWidth;
        
        const points = [];
        solutions.forEach(solution => {
            for (let n = -20; n <= 20; n++) {
                const x = ((solution / (2 * Math.PI) + n) * wavePeriodPixels - phaseOffsetPixels - currentOffsetPx);
                const normalizedX = ((x % wavePeriodPixels) + wavePeriodPixels) % wavePeriodPixels;
                
                if (normalizedX >= 0 && normalizedX <= graphW) {
                    const dup = points.some(existing => Math.abs(existing - normalizedX) < 2);
                    if (!dup) {
                        points.push(normalizedX);
                    }
                }
            }
        });
        
        return points.sort((a, b) => a - b);
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
            alert('Пожалуйста, введите название и период сигнала');
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
        if (!confirm('Уничтожить этот сигнал?')) return;
        
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
        delete window.appState.periods[waveIdStr];
        
        const waveContainer = this.waveContainers[waveIdStr];
        if (waveContainer) {
            waveContainer.remove();
            delete this.waveContainers[waveIdStr];
            delete this.wavePaths[waveIdStr];
        }
        
        const leftLabel = document.getElementById(`waveLabel${waveIdStr}-left`);
        const rightLabel = document.getElementById(`waveLabel${waveIdStr}-right`);
        
        if (leftLabel) leftLabel.remove();
        if (rightLabel) rightLabel.remove();
        
        document.querySelectorAll(`.wave-label.vertical[data-wave-id="${waveIdStr}"]`).forEach(el => el.remove());
        
        delete this.waveLabelElements[`${waveIdStr}-left`];
        delete this.waveLabelElements[`${waveIdStr}-right`];
        Object.keys(this.waveLabelElements).forEach(key => {
            if (key.startsWith(`${waveIdStr}-top`) || key.startsWith(`${waveIdStr}-bottom`)) {
                delete this.waveLabelElements[key];
            }
        });
        
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

        window.dispatchEvent(new CustomEvent('zaraza:waveCornerSelectionChanged'));
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
    
    findWaveIntersectionPoints(wave1, wave2) {
        const points = [];
        
        const periodPx1 = wave1.period * window.appState.config.squareSize;
        const periodPx2 = wave2.period * window.appState.config.squareSize;
        
        const eq1 = {
            amplitude: window.appState.config.amplitude,
            omega: 2 * Math.PI / periodPx1,
            phi: this.getPixelPhase(wave1)
        };
        
        const eq2 = {
            amplitude: window.appState.config.amplitude,
            omega: 2 * Math.PI / periodPx2,
            phi: this.getPixelPhase(wave2)
        };
        
        for (let k = -10; k <= 10; k++) {
            if (Math.abs(eq1.omega - eq2.omega) > 1e-12) {
                const x1 = (eq2.phi - eq1.phi + 2 * Math.PI * k) / (eq1.omega - eq2.omega);
                if (x1 >= 0 && x1 <= window.appState.graphWidth) {
                    points.push(this.createIntersectionPoint(x1, wave1, wave2));
                }
            }
            
            const x2 = (Math.PI - eq1.phi - eq2.phi + 2 * Math.PI * k) / (eq1.omega + eq2.omega);
            if (x2 >= 0 && x2 <= window.appState.graphWidth) {
                points.push(this.createIntersectionPoint(x2, wave1, wave2));
            }
        }
        
        return points.filter(p => p !== null);
    }
    
    navigateToPreciseTime(preciseTime) {
        const targetDate = new Date(preciseTime);
        
        window.appState.currentDate = targetDate;
        window.appState.currentDay = window.timeUtils.getDaysBetween(
            window.appState.baseDate, 
            targetDate
        );
        
        window.grid.createGrid();
        window.waves.updatePosition();
        window.appState.save();
        
        const milliseconds = targetDate.getMilliseconds();
        document.getElementById('currentDay').textContent = 
            window.appState.currentDay.toFixed(5) + 
            ` (${milliseconds}ms)`;
    }
    
    getPixelPhase(wave) {
        const currentDay = window.appState.currentDay || 0;
        const periodPx = wave.period * window.appState.config.squareSize;
        const phaseOffsetPixels = window.appState.config.phaseOffsetDays * window.appState.config.squareSize;
        
        const currentOffsetPx = (currentDay * window.appState.config.squareSize) % periodPx;
        const normalizedOffset = currentOffsetPx < 0 ? periodPx + currentOffsetPx : currentOffsetPx;
        
        return 2 * Math.PI * (phaseOffsetPixels + normalizedOffset) / periodPx;
    }
    
    createIntersectionPoint(x, wave1, wave2) {
        const centerY = window.appState.config.graphHeight / 2;
        const amplitude = window.appState.config.amplitude;
        const periodPx1 = wave1.period * window.appState.config.squareSize;
        const periodPx2 = wave2.period * window.appState.config.squareSize;
        const phaseOffsetPixels = window.appState.config.phaseOffsetDays * window.appState.config.squareSize;
        
        const currentDay = window.appState.currentDay || 0;
        const offset1 = (currentDay * window.appState.config.squareSize) % periodPx1;
        const offset2 = (currentDay * window.appState.config.squareSize) % periodPx2;
        
        const y1 = centerY - amplitude * Math.sin(2 * Math.PI * (x + offset1 + phaseOffsetPixels) / periodPx1);
        const y2 = centerY - amplitude * Math.sin(2 * Math.PI * (x + offset2 + phaseOffsetPixels) / periodPx2);
        
        if (Math.abs(y1 - y2) > 0.01) return null;
        
        return {
            x: x,
            y: (y1 + y2) / 2,
            wave1: wave1,
            wave2: wave2,
            time: this.calculateTimeFromXCoordinate(wave1, x)
        };
    }
    
    refineIntersectionPoint(wave1, wave2, x1, x2, offset1, offset2, periodPx1, periodPx2) {
        const maxIterations = 10;
        const tolerance = 0.01;
        
        let left = x1;
        let right = x2;
        
        for (let i = 0; i < maxIterations; i++) {
            const mid = (left + right) / 2;
            
            const y1 = window.appState.config.graphHeight / 2 - 
                    window.appState.config.amplitude * 
                    Math.sin(2 * Math.PI * (mid + offset1) / periodPx1);
            
            const y2 = window.appState.config.graphHeight / 2 - 
                    window.appState.config.amplitude * 
                    Math.sin(2 * Math.PI * (mid + offset2) / periodPx2);
            
            const diff = y1 - y2;
            
            if (Math.abs(diff) < tolerance) {
                return {
                    x: mid,
                    y: (y1 + y2) / 2,
                    wave1: wave1,
                    wave2: wave2
                };
            }
            
            const y1Left = window.appState.config.graphHeight / 2 - 
                        window.appState.config.amplitude * 
                        Math.sin(2 * Math.PI * (left + offset1) / periodPx1);
            
            const y2Left = window.appState.config.graphHeight / 2 - 
                        window.appState.config.amplitude * 
                        Math.sin(2 * Math.PI * (left + offset2) / periodPx2);
            
            const diffLeft = y1Left - y2Left;
            
            if (diffLeft * diff < 0) {
                right = mid;
            } else {
                left = mid;
            }
        }
        
        return null;
    }
    
    calculateAllWaveIntersections() {
        const visibleWaves = this.getActiveWaves();
        const allIntersections = [];
        
        if (visibleWaves.length < 2) return allIntersections;
        
        for (let i = 0; i < visibleWaves.length; i++) {
            for (let j = i + 1; j < visibleWaves.length; j++) {
                const points = this.findWaveIntersectionPoints(
                    visibleWaves[i], 
                    visibleWaves[j]
                );
                
                const filteredPoints = this.filterClosePoints(points, 5);
                
                filteredPoints.forEach(point => {
                    if (point) {
                        const intersectionTime = this.calculateTimeFromXCoordinate(visibleWaves[i], point.x);
                        
                        allIntersections.push({
                            ...point,
                            time: intersectionTime,
                            wavePair: `${visibleWaves[i].name} × ${visibleWaves[j].name}`
                        });
                    }
                });
            }
        }
        
        return allIntersections;
    }
    
    filterClosePoints(points, minDistance) {
        if (points.length === 0) return [];
        
        const sortedPoints = points.sort((a, b) => a.x - b.x);
        const filteredPoints = [sortedPoints[0]];
        
        for (let i = 1; i < sortedPoints.length; i++) {
            const lastPoint = filteredPoints[filteredPoints.length - 1];
            
            if (Math.abs(sortedPoints[i].x - lastPoint.x) >= minDistance) {
                filteredPoints.push(sortedPoints[i]);
            }
        }
        
        return filteredPoints;
    }
    
    renderWaveIntersectionPoints() {
        if (window.appState && window.appState.waveIntersectionsVisible === false) {
            this.removeWaveIntersectionPoints();
            return;
        }
        
        this.removeWaveIntersectionPoints();
        
        const intersections = this.calculateAllWaveIntersections();
        
        const maxPointsToShow = 50;
        const pointsToShow = intersections.slice(0, maxPointsToShow);
        
        const container = document.createElement('div');
        container.className = 'wave-intersection-points';
        container.style.position = 'absolute';
        container.style.width = '100%';
        container.style.height = '100%';
        container.style.pointerEvents = 'none';
        container.style.zIndex = '9';
        container.style.top = '0';
        container.style.left = '0';
        
        pointsToShow.forEach(point => {
            const pointElement = document.createElement('div');
            pointElement.className = 'wave-intersection-point';
            pointElement.dataset.time = point.time.toISOString();
            pointElement.dataset.wavePair = point.wavePair;
            
            const timeStr = this.formatExtremumTime(point.time);
            
            const timeBefore = new Date(point.time.getTime() - 2.5 * 60 * 1000);
            const timeAfter = new Date(point.time.getTime() + 2.5 * 60 * 1000);
            
            const timeBeforeStr = this.formatExtremumTime(timeBefore);
            const timeAfterStr = this.formatExtremumTime(timeAfter);
            
            let titleText = `${point.wavePair}\n${timeStr}`;
            titleText += `\n---`;
            titleText += `\n${timeBeforeStr} (началось)`;
            titleText += `\n${timeAfterStr} (закончилось)`;
            
            pointElement.title = titleText;
            
            pointElement.style.position = 'absolute';
            pointElement.style.left = `${point.x}px`;
            pointElement.style.top = `${point.y}px`;
            pointElement.style.width = '8px';
            pointElement.style.height = '8px';
            pointElement.style.borderRadius = '50%';
            pointElement.style.backgroundColor = '#ff0000';
            pointElement.style.border = '2px solid #fff';
            pointElement.style.cursor = 'pointer';
            pointElement.style.pointerEvents = 'auto';
            pointElement.style.zIndex = '10';
            pointElement.style.opacity = '0.9';
            pointElement.style.transform = 'translate(-50%, -50%)';
            
            pointElement.addEventListener('mouseenter', (e) => {
                e.target.style.transform = 'translate(-50%, -50%) scale(1.5)';
                e.target.style.zIndex = '15';
            });
            
            pointElement.addEventListener('mouseleave', (e) => {
                e.target.style.transform = 'translate(-50%, -50%)';
                e.target.style.zIndex = '10';
            });
            
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
        element.title = `${point.wave1.name} × ${point.wave2.name}\n${this.formatExtremumTime(point.time)}`;
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