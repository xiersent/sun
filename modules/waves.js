// optimized3/modules/waves.js
class WavesManager {
    constructor() {
        this.elements = {};
        this.waveContainers = {};
        this.wavePaths = {};
    }
    
    init() {
        this.createVisibleWaveElements();
        this.updatePosition();
    }
    
    // НОВЫЙ МЕТОД: Проверка, включена ли хоть одна группа с этой волной
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
        
        // Удаляем старые контейнеры
        document.querySelectorAll('.wave-container').forEach(c => c.remove());
        
        // Сбрасываем кэши
        this.waveContainers = {};
        this.wavePaths = {};
        
        let createdCount = 0;
        
        // ВАЖНО: Проверяем, есть ли активная дата
        const hasActiveDate = window.appState.activeDateId && 
                             window.appState.data.dates.some(d => d.id === window.appState.activeDateId);
        
        if (!hasActiveDate) {
            console.log('WavesManager: нет активной даты, волны не будут созданы');
            return;
        }
        
        // ВАЖНО: Проверяем, что currentDay установлен
        if (window.appState.currentDay === undefined || window.appState.currentDay === null) {
            console.warn('WavesManager: currentDay не установлен, пытаемся пересчитать...');
            if (window.dates && window.dates.recalculateCurrentDay) {
                window.dates.recalculateCurrentDay();
            } else {
                // Fallback: ручной расчет
                window.appState.currentDay = this.calculateDaysBetweenDates(
                    window.appState.baseDate,
                    window.appState.currentDate
                );
                console.log('WavesManager: currentDay рассчитан вручную:', window.appState.currentDay);
            }
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
    }
    
    createWaveElement(wave) {
        const container = document.createElement('div');
        container.className = 'wave-container';
        container.id = `waveContainer${wave.id}`;
        
        const periodPx = wave.period * window.appState.config.squareSize;
        container.style.width = `${periodPx * 3}px`;
        container.style.left = `-${periodPx}px`;
        
        const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        svg.classList.add('wave');
        svg.setAttribute('preserveAspectRatio', 'none');
        svg.setAttribute('viewBox', `0 0 ${periodPx * 3} ${window.appState.config.graphHeight}`);
        
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
        
        this.generateSineWave(periodPx, path, container);
        
        svg.appendChild(path);
        container.appendChild(svg);
        document.getElementById('graphElement').appendChild(container);
        
        this.waveContainers[wave.id] = container;
        this.wavePaths[wave.id] = path;
        
        const waveIdStrForTooltip = String(wave.id);
        if (!waveIdStrForTooltip.startsWith('wave-120-') && !waveIdStrForTooltip.startsWith('wave-31-')) {
            const tooltip = document.createElement('div');
            tooltip.className = 'wave-tooltip';
            tooltip.textContent = wave.name;
            container.appendChild(tooltip);
            
            container.addEventListener('mouseenter', (e) => {
                if (!window.appState.showTooltips) return;
                const rect = container.getBoundingClientRect();
                tooltip.style.left = (e.clientX - rect.left + 10) + 'px';
                tooltip.style.top = (e.clientY - rect.top - 30) + 'px';
                tooltip.style.zIndex = window.appState.tooltipZIndex++;
                tooltip.style.display = 'block';
            });
            
            container.addEventListener('mousemove', (e) => {
                if (!window.appState.showTooltips) return;
                const rect = container.getBoundingClientRect();
                tooltip.style.left = (e.clientX - rect.left + 10) + 'px';
                tooltip.style.top = (e.clientY - rect.top - 30) + 'px';
            });
            
            container.addEventListener('mouseleave', () => {
                tooltip.style.display = 'none';
            });
        }
    }
    
    generateSineWave(periodPx, wavePath, waveContainer) {
        const totalWidth = periodPx * 3;
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
            container.style.width = `${periodPx * 3}px`;
            container.style.left = `-${periodPx}px`;
            
            const waveSvg = container.querySelector('.wave');
            if (waveSvg) {
                waveSvg.setAttribute('viewBox', `0 0 ${periodPx * 3} ${window.appState.config.graphHeight}`);
            }
        }
    }
    
    updatePosition() {
        // ВАЖНО: Проверяем, что currentDay установлен
        if (window.appState.currentDay === undefined || window.appState.currentDay === null) {
            console.warn('WavesManager: currentDay не установлен, пытаемся пересчитать...');
            if (window.dates && window.dates.recalculateCurrentDay) {
                window.dates.recalculateCurrentDay();
            } else {
                // Fallback: ручной расчет
                window.appState.currentDay = this.calculateDaysBetweenDates(
                    window.appState.baseDate,
                    window.appState.currentDate
                );
                console.log('WavesManager: currentDay рассчитан вручную:', window.appState.currentDay);
            }
        }
        
        console.log('WavesManager: updatePosition, currentDay:', window.appState.currentDay);
        
        // currentDay содержит разницу в днях между базовой датой и текущей датой визора
        window.appState.data.waves.forEach(wave => {
            const wavePeriodPixels = window.appState.periods[wave.id] || (wave.period * window.appState.config.squareSize);
            
            // currentDay содержит разницу в днях между базовой датой и текущей датой визора
            let actualPosition = window.appState.currentDay * window.appState.config.squareSize % wavePeriodPixels;
            
            if (actualPosition < 0) {
                actualPosition = wavePeriodPixels + actualPosition;
            }
            
            const waveIdStr = String(wave.id);
            const isWaveVisible = window.appState.waveVisibility[waveIdStr] !== false;
            
            // УПРОЩЕННАЯ ЛОГИКА: Показывать волну если она видима И её группа включена
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
        
        // Обновляем DOM элемент currentDay
        const currentDayElement = document.getElementById('currentDay');
        if (currentDayElement) {
            currentDayElement.textContent = window.appState.currentDay;
            console.log('WavesManager: DOM элемент currentDay обновлен:', window.appState.currentDay);
        }
    }
    
    // НОВЫЙ МЕТОД: Гарантированное создание элементов волн при активации даты
    createVisibleWaveElementsForActiveDate() {
        console.log('WavesManager: гарантированное создание элементов волн для активной даты');
        
        // Убедимся, что все видимые волны из включенных групп созданы
        window.appState.data.waves.forEach(wave => {
            const waveIdStr = String(wave.id);
            const isWaveVisible = window.appState.waveVisibility[waveIdStr] !== false;
            const isGroupEnabled = this.isWaveGroupEnabled(wave.id);
            const shouldShow = isWaveVisible && isGroupEnabled;
            
            // Если волна должна показываться, но её контейнер ещё не создан
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
        
        // Создаем элемент волны, если её группа включена
        if (this.isWaveGroupEnabled(newWave.id)) {
            this.createWaveElement(newWave);
        }
        this.updatePosition();
        window.appState.save();
        
        return newWave;
    }
    
    deleteWave(waveId) {
        if (!confirm('Уничтожить этот колосок?')) return;
        
        // Приводим waveId к строке для сравнения
        const waveIdStr = String(waveId);
        
        // Перед удалением запомним группы, в которых была эта волна
        const affectedGroups = [];
        window.appState.data.groups.forEach(group => {
            if (group.waves && group.waves.some(w => String(w) === waveIdStr)) {
                affectedGroups.push(group.id);
            }
        });
        
        // Ищем волну с приведением типов
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
        
        // Удаляем саму волну с приведением типов
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
        
        this.updatePosition();
        window.grid.updateGridNotesHighlight();
        this.updateCornerSquareColors();
        window.appState.save();
        
        // После удаления обновляем статистику групп
        affectedGroups.forEach(groupId => {
            if (window.unifiedListManager && window.unifiedListManager.updateGroupStats) {
                window.unifiedListManager.updateGroupStats(groupId);
            }
        });
    }
    
    updateCornerSquareColors() {
        let activeColor = 'red';
        window.appState.data.waves.forEach(wave => {
            const waveIdStr = String(wave.id);
            if (window.appState.waveCornerColor[waveIdStr]) {
                activeColor = wave.color;
            }
        });
        document.querySelectorAll('.corner-square').forEach(square => {
            square.style.backgroundColor = activeColor;
        });
    }
    
    calculateIntersections(basePeriod, baseAmplitude, precision) {
        const daysFromBase = window.dates.getDaysBetweenDates(window.appState.baseDate, window.appState.currentDate);
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
        
        // Создаем элемент волны, если её группа включена
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
    
    // НОВЫЙ МЕТОД: Расчет дней между датами (для fallback)
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

// Глобальная функция для принудительного обновления currentDay
window.forceUpdateCurrentDay = function() {
    console.log('=== FORCE UPDATE CURRENTDAY ===');
    
    if (!window.dates || !window.appState) return;
    
    // Принудительно устанавливаем дефолтную дату
    const defaultDateId = 's25';
    const defaultDate = window.appState.data.dates.find(d => d.id === defaultDateId);
    
    if (defaultDate) {
        try {
            const date = new Date(defaultDate.date);
            window.appState.baseDate = new Date(date);
            window.appState.activeDateId = defaultDateId;
            
            // Пересчитываем
            window.dates.recalculateCurrentDay();
            
            // Обновляем все
            if (window.waves) {
                // Очищаем старые волны
                document.querySelectorAll('.wave-container').forEach(c => c.remove());
                window.waves.waveContainers = {};
                window.waves.wavePaths = {};
                
                // Создаем новые
                window.appState.data.waves.forEach(wave => {
                    const waveIdStr = String(wave.id);
                    const isWaveVisible = window.appState.waveVisibility[waveIdStr] !== false;
                    const isGroupEnabled = window.waves.isWaveGroupEnabled(wave.id);
                    const shouldShow = isWaveVisible && isGroupEnabled;
                    
                    if (shouldShow) {
                        window.waves.createWaveElement(wave);
                    }
                });
                
                window.waves.updatePosition();
            }
            
            if (window.grid && window.grid.createGrid) {
                window.grid.createGrid();
                window.grid.updateCenterDate();
            }
            
            if (window.dataManager && window.dataManager.updateDateList) {
                window.dataManager.updateDateList();
            }
            
            console.log('Принудительно обновлен currentDay:', window.appState.currentDay);
            
        } catch (error) {
            console.error('Ошибка принудительного обновления:', error);
        }
    }
};

// Автоматически вызывать при загрузке
if (window.appState && window.appState.currentDay === 0) {
    setTimeout(() => {
        window.forceUpdateCurrentDay();
    }, 1000);
}

window.waves = new WavesManager();