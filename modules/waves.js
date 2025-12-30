// modules/waves.js
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
            console.log('WavesManager: уже инициализирован, пропускаем');
            return;
        }
        
        console.log('WavesManager: инициализация...');
        console.log('currentDay при инициализации волн:', window.appState.currentDay);
        console.log('baseDate при инициализации:', window.appState.baseDate);
        console.log('currentDate при инициализации:', window.appState.currentDate);
        
        this.createVisibleWaveElements();
        this.updatePosition();
        this.initialized = true;
        
        console.log('WavesManager: инициализация завершена, currentDay:', window.appState.currentDay);
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
        
        return Math.max(6, periodsToCoverViewport + safetyMargin);
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
        console.log('WavesManager: создание видимых элементов волн...');
        console.log('currentDay при создании волн:', window.appState.currentDay);
        
        document.querySelectorAll('.wave-container').forEach(c => c.remove());
        document.querySelectorAll('.wave-label').forEach(l => l.remove());
        
        this.waveContainers = {};
        this.wavePaths = {};
        this.waveLabelElements = {};
        
        let createdCount = 0;
        
        const hasActiveDate = window.appState.activeDateId && 
                             window.appState.data.dates.some(d => d.id === window.appState.activeDateId);
        
        if (!hasActiveDate) {
            console.log('WavesManager: нет активной даты, волны не будут созданы');
            return;
        }
        
        window.appState.data.waves.forEach(wave => {
            const waveIdStr = String(wave.id);
            const isWaveVisible = window.appState.waveVisibility[waveIdStr] !== false;
            
            if (isWaveVisible && this.isWaveGroupEnabled(wave.id)) {
                console.log('Создаем волну:', wave.id, wave.name);
                this.createWaveElement(wave);
                createdCount++;
            }
        });
        
        console.log('WavesManager: создано элементов волн:', createdCount);
        
        this.updateWaveLabels();
    }
    
    createWaveElement(wave) {
        const container = document.createElement('div');
        container.className = 'wave-container';
        container.id = `waveContainer${wave.id}`;
        
        const periodPx = wave.period * window.appState.config.squareSize;
        
        const totalPeriods = this.calculateRequiredPeriods(periodPx);
        const containerWidth = periodPx * totalPeriods;
        
        container.style.width = `${containerWidth}px`;
        container.style.left = `-${periodPx}px`;
        
        container.dataset.totalPeriods = totalPeriods;
        container.dataset.periodPx = periodPx;
        container.dataset.wavePeriod = wave.period;
        
        const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        svg.classList.add('wave');
        svg.setAttribute('preserveAspectRatio', 'none');
        svg.setAttribute('viewBox', `0 0 ${containerWidth} ${window.appState.config.graphHeight}`);
        
        const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
        path.classList.add('wave-path');
        
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
        
        path.id = `wavePath${wave.id}`;
        path.style.stroke = wave.color;
        
        const waveIdStr = String(wave.id);
        if (window.appState.waveBold[waveIdStr]) {
            path.classList.add('bold');
        }
        
        this.generateSineWave(periodPx, path, container, totalPeriods);
        
        svg.appendChild(path);
        container.appendChild(svg);
        document.getElementById('graphElement').appendChild(container);
        
        this.waveContainers[wave.id] = container;
        this.wavePaths[wave.id] = path;
        
        window.appState.periods[wave.id] = periodPx;
        
        console.log(`Создана волна: ${wave.name} (${wave.period} дней)`);
        console.log(`  periodPx: ${periodPx}px, totalPeriods: ${totalPeriods}, containerWidth: ${containerWidth}px`);
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
            const y = window.appState.config.graphHeight / 2 - window.appState.config.amplitude * Math.sin(2 * Math.PI * (x + phaseOffsetPixels) / periodPx);
            pathData += `L${x},${y} `;
        }
        
        if (wavePath) {
            wavePath.setAttribute('d', pathData);
        }
        
        window.appState.periods[waveContainer.id.replace('waveContainer', '')] = periodPx;
    }
    
    updateWaveContainer(waveId, periodPx) {
        const container = this.waveContainers[waveId];
        if (container) {
            const totalPeriods = this.calculateRequiredPeriods(periodPx);
            const containerWidth = periodPx * totalPeriods;
            
            container.style.width = `${containerWidth}px`;
            container.style.left = `-${periodPx}px`;
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
    
    updatePosition() {
        console.log('WavesManager: updatePosition вызван');
        console.log('  currentDay:', window.appState.currentDay);
        
        if (window.appState.currentDay === undefined || window.appState.currentDay === null) {
            console.warn('WavesManager: currentDay не установлен, вызываем dates.recalculateCurrentDay()');
            if (window.dates && window.dates.recalculateCurrentDay) {
                window.dates.recalculateCurrentDay(false);
            }
        }
        
        if (typeof window.appState.currentDay !== 'number' || isNaN(window.appState.currentDay)) {
            console.error('WavesManager: currentDay некорректен! Исправляем на 0');
            window.appState.currentDay = 0;
        }
        
        console.log('WavesManager: updatePosition, currentDay:', window.appState.currentDay);
        
        window.appState.data.waves.forEach(wave => {
            const wavePeriodPixels = window.appState.periods[wave.id] || (wave.period * window.appState.config.squareSize);
            
            let actualPosition = window.appState.currentDay * window.appState.config.squareSize % wavePeriodPixels;
            
            if (actualPosition < 0) {
                actualPosition = wavePeriodPixels + actualPosition;
            }
            
            const waveIdStr = String(wave.id);
            const isWaveVisible = window.appState.waveVisibility[waveIdStr] !== false;
            
            const shouldShow = isWaveVisible && this.isWaveGroupEnabled(wave.id);
            
            if (this.waveContainers[wave.id]) {
                this.waveContainers[wave.id].style.transition = 'none';
                this.waveContainers[wave.id].style.transform = `translateX(${-actualPosition}px)`;
                this.waveContainers[wave.id].style.display = shouldShow ? 'block' : 'none';
                
                if (this.wavePaths[wave.id]) {
                    this.wavePaths[wave.id].classList.toggle('bold', window.appState.waveBold[waveIdStr]);
                }
            }
        });
        
        this.updateWaveLabels();
    }
    
    updateWaveLabels() {
        const now = Date.now();
        
        if (now - this.lastUpdateTime < this.updateInterval) {
            return;
        }
        this.lastUpdateTime = now;
        
        const leftContainer = document.querySelector('.wave-labels-left');
        const rightContainer = document.querySelector('.wave-labels-right');
        
        if (!leftContainer || !rightContainer) return;
        
        leftContainer.innerHTML = '';
        rightContainer.innerHTML = '';
        
        this.waveLabelElements = {};
        
        window.appState.data.waves.forEach(wave => {
            const waveIdStr = String(wave.id);
            const isWaveVisible = window.appState.waveVisibility[waveIdStr] !== false;
            const shouldShow = isWaveVisible && this.isWaveGroupEnabled(wave.id);
            
            if (!shouldShow) return;
            
            const leftY = this.calculateWaveYAtX(wave, 0);
            const rightY = this.calculateWaveYAtX(wave, window.appState.graphWidth);
            
            if (leftY >= 0 && leftY <= window.appState.config.graphHeight) {
                this.createWaveLabel(wave, leftY, 'left', leftContainer);
            }
            
            if (rightY >= 0 && rightY <= window.appState.config.graphHeight) {
                this.createWaveLabel(wave, rightY, 'right', rightContainer);
            }
        });
    }
    
    calculateWaveYAtX(wave, x) {
        const wavePeriodPixels = window.appState.periods[wave.id] || (wave.period * window.appState.config.squareSize);
        
        if (!wavePeriodPixels || wavePeriodPixels <= 0) {
            return window.appState.config.graphHeight / 2;
        }
        
        let translateX = window.appState.currentDay * window.appState.config.squareSize % wavePeriodPixels;
        if (translateX < 0) {
            translateX = wavePeriodPixels + translateX;
        }
        
        const relativeX = x + translateX;
        const phaseOffsetPixels = window.appState.config.phaseOffsetDays * window.appState.config.squareSize;
        const centerY = window.appState.config.graphHeight / 2;
        const amplitude = window.appState.config.amplitude;
        
        const y = centerY - amplitude * Math.sin(
            2 * Math.PI * (relativeX + phaseOffsetPixels) / wavePeriodPixels
        );
        
        return y;
    }
    
	createWaveLabel(wave, y, side, container) {
		const labelId = `${wave.id}-${side}`;
		
		const waveColor = wave.color || '#666666';
		
		const labelElement = document.createElement('div');
		labelElement.className = 'wave-label';
		labelElement.id = `waveLabel${labelId}`;
		labelElement.dataset.waveId = wave.id;
		labelElement.dataset.side = side;
		
		labelElement.style.top = `${y}px`;
		labelElement.style.backgroundColor = waveColor;
		labelElement.style.color = '#fff';
		labelElement.style.opacity = '0.5'; // По умолчанию
		labelElement.style.zIndex = '1'; // По умолчанию
		
		// Создаем стрелку как отдельный элемент
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
			// Для левых выносок: стрелка справа
			arrow.style.right = '-6px';
			arrow.style.borderWidth = '4px 0 4px 6px';
			arrow.style.borderColor = `transparent transparent transparent ${waveColor}`;
			labelElement.style.flexDirection = 'row-reverse';
			labelElement.style.right = '0'; // Прижимаем к правому краю родителя
			labelElement.style.marginRight = '10px'; // Отступ от правого края
		} else {
			// Для правых выносок: стрелка слева
			arrow.style.left = '-6px';
			arrow.style.borderWidth = '4px 6px 4px 0';
			arrow.style.borderColor = `transparent ${waveColor} transparent transparent`;
			labelElement.style.flexDirection = 'row';
			labelElement.style.left = '0'; // Прижимаем к левому краю родителя
			labelElement.style.marginLeft = '10px'; // Отступ от левого края
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
		
		// Обработчики для hover
		labelElement.addEventListener('mouseenter', () => {
			labelElement.style.opacity = '1';
			labelElement.style.zIndex = '10';
		});
		
		labelElement.addEventListener('mouseleave', () => {
			labelElement.style.opacity = '0.5';
			labelElement.style.zIndex = '1';
		});
		
		labelElement.addEventListener('click', (e) => {
			e.stopPropagation();
			this.onWaveLabelClick(wave.id);
		});
		
		return labelElement;
	}
    
    onWaveLabelClick(waveId) {
        const waveIdStr = String(waveId);
        const isCurrentlyVisible = window.appState.waveVisibility[waveIdStr] !== false;
        
        window.appState.waveVisibility[waveIdStr] = !isCurrentlyVisible;
        window.appState.save();
        
        if (window.unifiedListManager && window.unifiedListManager.updateWavesList) {
            window.unifiedListManager.updateWavesList();
        }
        
        this.updatePosition();
        
        console.log(`Видимость волны ${waveId} изменена: ${!isCurrentlyVisible ? 'включена' : 'выключена'}`);
    }
    
    createVisibleWaveElementsForActiveDate() {
        console.log('WavesManager: гарантированное создание элементов волн для активной даты');
        
        window.appState.data.waves.forEach(wave => {
            const waveIdStr = String(wave.id);
            const isWaveVisible = window.appState.waveVisibility[waveIdStr] !== false;
            const isGroupEnabled = this.isWaveGroupEnabled(wave.id);
            const shouldShow = isWaveVisible && isGroupEnabled;
            
            if (shouldShow && !this.waveContainers[wave.id]) {
                console.log('WavesManager: создаем отсутствующий элемент волны:', wave.id, wave.name);
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
        
        const affectedGroups = [];
        window.appState.data.groups.forEach(group => {
            if (group.waves && group.waves.some(w => String(w) === waveIdStr)) {
                affectedGroups.push(group.id);
            }
        });
        
        const wave = window.appState.data.waves.find(w => String(w.id) === waveIdStr);
        
        if (wave) {
            window.appState.data.groups.forEach(group => {
                if (group.waves) {
                    group.waves = group.waves.filter(w => {
                        const wStr = String(w);
                        return wStr !== waveIdStr;
                    });
                }
            });
        }
        
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
        
        if (leftLabel) leftLabel.remove();
        if (rightLabel) rightLabel.remove();
        
        delete this.waveLabelElements[`${waveId}-left`];
        delete this.waveLabelElements[`${waveId}-right`];
        
        this.updatePosition();
        window.grid.updateGridNotesHighlight();
        this.updateCornerSquareColors();
        window.appState.save();
        
        affectedGroups.forEach(groupId => {
            if (window.unifiedListManager && window.unifiedListManager.updateGroupStats) {
                window.unifiedListManager.updateGroupStats(groupId);
            }
        });
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
        
        console.log(`Окраска краев для волны ${waveId}: ${enabled ? 'включена' : 'выключена'}`);
    }
    
    calculateIntersections(basePeriod, baseAmplitude, precision) {
        const daysFromBase = window.dom ? window.dom.getDaysBetweenDates(window.appState.baseDate, window.appState.currentDate) : 0;
        const basePhase = (daysFromBase / basePeriod) * 2 * Math.PI;
        const baseValue = Math.sin(basePhase) * baseAmplitude;
        
        window.appState.intersectionResults = [];
        
        const allWaves = this.generateIntersectionWaves();
        let exactMatches = 0;
        let closeMatches = 0;
        
        allWaves.forEach(wave => {
            const wavePhase = (daysFromBase / wave.period) * 2 * Math.PI;
            const waveValue = Math.sin(wavePhase) * wave.amplitude;
            const difference = Math.abs(baseValue - waveValue);
            const matchQuality = 1 - (difference / (baseAmplitude + wave.amplitude));
            
            if (matchQuality >= precision) {
                const isExact = matchQuality >= 0.99;
                if (isExact) exactMatches++;
                else closeMatches++;
                
                window.appState.intersectionResults.push({
                    period: wave.period,
                    amplitude: wave.amplitude,
                    value: waveValue,
                    matchQuality: matchQuality,
                    isExact: isExact,
                    difference: difference
                });
            }
        });
        
        window.appState.intersectionResults.sort((a, b) => b.matchQuality - a.matchQuality);
        return {
            results: window.appState.intersectionResults,
            exactMatches,
            closeMatches,
            totalWaves: allWaves.length
        };
    }
    
    generateIntersectionWaves() {
        const waves = [];
        
        for (let i = 1; i <= 1000; i++) {
            const period = 0.1 + (i * 0.1);
            const amplitude = 0.5 + (Math.sin(i * 0.1) * 0.5);
            waves.push({ period, amplitude });
        }
        
        for (let i = 1; i <= 500; i++) {
            const period = 10 + (i * 0.5);
            const amplitude = 0.8 + (Math.cos(i * 0.05) * 0.2);
            waves.push({ period, amplitude });
        }
        
        for (let i = 1; i <= 200; i++) {
            const period = 100 + (i * 2);
            const amplitude = 1.0 + (Math.sin(i * 0.02) * 0.3);
            waves.push({ period, amplitude });
        }
        
        return waves;
    }
    
    addIntersectionWave(period, amplitude) {
        const newWave = {
            id: window.appState.generateId(),
            name: `Совпадение ${period.toFixed(1)}д`,
            period: period,
            color: '#FF6B6B',
            type: 'dashed',
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
        if (!date1 || !date2) return 0;
        
        try {
            const d1 = new Date(date1);
            const d2 = new Date(date2);
            
            if (isNaN(d1.getTime()) || isNaN(d2.getTime())) {
                return 0;
            }
            
            const utc1 = Date.UTC(d1.getFullYear(), d1.getMonth(), d1.getDate());
            const utc2 = Date.UTC(d2.getFullYear(), d2.getMonth(), d2.getDate());
            return Math.floor((utc2 - utc1) / (1000 * 60 * 60 * 24));
        } catch (error) {
            console.error('Ошибка расчета дней между датами:', error);
            return 0;
        }
    }
}

window.waves = new WavesManager();