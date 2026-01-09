// modules/extremumTimeManager.js - ПЕРЕЧИСЛЕНИЕ КОЛОСКОВ В ВЫНОСКАХ
class ExtremumTimeManager {
    constructor() {
        this.markers = [];
        this.labels = [];
        this.timeBarContainer = null;
        this.groupTolerance = 1 * 60 * 1000; // 1 минута в мс для группировки
    }

    init() {
        this.timeBarContainer = document.querySelector('.time-scale');
        if (!this.timeBarContainer) {
            setTimeout(() => this.init(), 100);
            return;
        }
        
        this.updateExtremums();
        this.setupDateChangeObserver();
    }

    calculateExtremumsForDay(date) {
        if (!window.appState?.data?.waves) return [];
        
        const dayStart = new Date(date);
        dayStart.setHours(0, 0, 0, 0);
        const dayEnd = new Date(date);
        dayEnd.setHours(23, 59, 59, 999);
        
        const extremums = [];
        const allWaves = window.appState.data.waves;
        
        allWaves.forEach(wave => {
            if (!wave.period || wave.period <= 0) return;
            
            const baseDate = window.appState.baseDate instanceof Date ? 
                window.appState.baseDate : 
                new Date(window.appState.baseDate);
            
            const daysFromBaseToStart = window.timeUtils.getDaysBetween(baseDate, dayStart);
            const phaseAtStart = ((daysFromBaseToStart % wave.period) / wave.period);
            const normalizedPhaseAtStart = phaseAtStart < 0 ? phaseAtStart + 1 : phaseAtStart;
            
            const extremumPhases = [
                { phase: 0.25, position: 'top' },
                { phase: 0.75, position: 'bottom' }
            ];
            
            extremumPhases.forEach(({ phase, position }) => {
                let phaseDiff = phase - normalizedPhaseAtStart;
                if (phaseDiff < 0) phaseDiff += 1;
                
                const firstExtremumDays = phaseDiff * wave.period;
                let firstExtremumTime = new Date(
                    dayStart.getTime() + (firstExtremumDays * 24 * 3600 * 1000)
                );
                
                if (firstExtremumTime < dayStart) {
                    firstExtremumTime = new Date(
                        firstExtremumTime.getTime() + (wave.period * 24 * 3600 * 1000)
                    );
                }
                
                let currentTime = firstExtremumTime;
                while (currentTime <= dayEnd) {
                    if (currentTime >= dayStart && currentTime <= dayEnd) {
                        extremums.push({
                            time: new Date(currentTime),
                            wave: wave,
                            position: position,
                            color: wave.color || '#666666'
                        });
                    }
                    
                    currentTime = new Date(
                        currentTime.getTime() + (wave.period * 24 * 3600 * 1000)
                    );
                }
            });
        });
        
        return extremums.sort((a, b) => a.time.getTime() - b.time.getTime());
    }

    groupExtremumsByTime(extremums) {
        const groups = [];
        
        // Сначала группируем по позиции (верх/низ)
        const topExtremums = extremums.filter(e => e.position === 'top');
        const bottomExtremums = extremums.filter(e => e.position === 'bottom');
        
        // Группируем верхние экстремумы
        this.groupByTimeThreshold(topExtremums, 'top').forEach(group => {
            groups.push(group);
        });
        
        // Группируем нижние экстремумы
        this.groupByTimeThreshold(bottomExtremums, 'bottom').forEach(group => {
            groups.push(group);
        });
        
        return groups;
    }

    groupByTimeThreshold(extremums, position) {
        if (extremums.length === 0) return [];
        
        const groups = [];
        let currentGroup = {
            time: extremums[0].time,
            waves: [extremums[0].wave],
            colors: [extremums[0].color],
            position: position
        };
        
        for (let i = 1; i < extremums.length; i++) {
            const currentExtremum = extremums[i];
            const timeDiff = Math.abs(currentExtremum.time.getTime() - currentGroup.time.getTime());
            
            if (timeDiff <= this.groupTolerance) {
                // Добавляем в текущую группу
                currentGroup.waves.push(currentExtremum.wave);
                currentGroup.colors.push(currentExtremum.color);
            } else {
                // Сохраняем текущую группу и начинаем новую
                groups.push({ ...currentGroup });
                currentGroup = {
                    time: currentExtremum.time,
                    waves: [currentExtremum.wave],
                    colors: [currentExtremum.color],
                    position: position
                };
            }
        }
        
        // Добавляем последнюю группу
        groups.push(currentGroup);
        
        return groups;
    }

    renderMarkers(groupedExtremums) {
        // Очищаем старые маркеры и выноски
        this.clearAll();
        
        if (!this.timeBarContainer || !groupedExtremums.length) return;
        
        const dayMs = 24 * 60 * 60 * 1000;
        
        groupedExtremums.forEach(group => {
            const dayStart = new Date(group.time);
            dayStart.setHours(0, 0, 0, 0);
            const timeFromMidnight = group.time.getTime() - dayStart.getTime();
            const positionPercent = (timeFromMidnight / dayMs) * 100;
            const clampedPercent = Math.max(0, Math.min(100, positionPercent));
            
            // Определяем доминирующий цвет (первый в группе)
            const dominantColor = group.colors[0];
            
            // Рисочка (маркер) - одна на группу
            const marker = document.createElement('div');
            marker.className = 'extremum-marker';
            marker.style.position = 'absolute';
            marker.style.left = `${clampedPercent}%`;
            marker.style.width = '1px';
            marker.style.height = '15px';
            marker.style.opacity = '0.7';
            marker.style.zIndex = '8';
            
            if (group.position === 'top') {
                marker.style.top = '0';
            } else {
                marker.style.bottom = '0';
            }
            
            marker.style.backgroundColor = dominantColor;
            
            // Выноска с ПЕРЕЧИСЛЕНИЕМ колосков
            const label = document.createElement('div');
            label.className = 'extremum-label';
            label.dataset.waveId = group.waves[0].id;
            label.dataset.position = group.position;
            label.dataset.time = group.time.toISOString();
            
            label.style.position = 'absolute';
            label.style.left = `${clampedPercent}%`;
            label.style.transform = 'translateX(-50%)';
            label.style.zIndex = '9';
            label.style.pointerEvents = 'none';
            label.style.fontSize = '10px';
            label.style.fontFamily = 'var(--font-family)';
            label.style.whiteSpace = 'nowrap';
            label.style.padding = '2px 6px';
            label.style.borderRadius = '3px';
            label.style.backgroundColor = 'rgba(0, 0, 0, 0.8)';
            label.style.color = '#fff';
            label.style.textAlign = 'center';
            
            // Перечисляем ВСЕ колоски в группе через запятую
            const waveNames = group.waves.map(w => w.name);
            const uniqueNames = [...new Set(waveNames)];
            const labelText = uniqueNames.join(', ');
            
            // Создаем внутреннюю структуру выноски
            const labelTextElement = document.createElement('div');
            labelTextElement.className = 'extremum-label-text';
            labelTextElement.style.textAlign = 'center';
            labelTextElement.style.fontWeight = '400';
            labelTextElement.textContent = labelText;
            
            // Стрелочка
            const arrow = document.createElement('div');
            arrow.className = 'extremum-label-arrow';
            arrow.style.position = 'absolute';
            arrow.style.width = '0';
            arrow.style.height = '0';
            arrow.style.borderStyle = 'solid';
            arrow.style.zIndex = '1';
            arrow.style.left = '50%';
            arrow.style.transform = 'translateX(-50%)';
            
            // Позиционируем выноску в зависимости от положения маркера
            if (group.position === 'top') {
                // Выноска над рисочкой
                label.style.bottom = '100%';
                label.style.marginBottom = '5px';
                
                // Стрелочка вниз
                arrow.style.bottom = '-6px';
                arrow.style.borderWidth = '6px 4px 0 4px';
                arrow.style.borderColor = 'rgba(0, 0, 0, 0.8) transparent transparent transparent';
            } else {
                // Выноска под рисочкой
                label.style.top = '100%';
                label.style.marginTop = '5px';
                
                // Стрелочка вверх
                arrow.style.top = '-6px';
                arrow.style.borderWidth = '0 4px 6px 4px';
                arrow.style.borderColor = 'transparent transparent rgba(0, 0, 0, 0.8) transparent';
            }
            
            label.appendChild(labelTextElement);
            label.appendChild(arrow);
            
            // Для темного режима
            const graphContainer = document.querySelector('.graph-container');
            if (graphContainer && graphContainer.classList.contains('dark-mode')) {
                label.style.backgroundColor = 'rgba(255, 255, 255, 0.9)';
                label.style.color = '#000';
                
                if (group.position === 'top') {
                    arrow.style.borderTopColor = 'rgba(255, 255, 255, 0.9)';
                } else {
                    arrow.style.borderBottomColor = 'rgba(255, 255, 255, 0.9)';
                }
            }
            
            // Добавляем в контейнер временной шкалы
            this.timeBarContainer.appendChild(marker);
            this.timeBarContainer.appendChild(label);
            
            this.markers.push(marker);
            this.labels.push(label);
        });
    }

    clearAll() {
        // Очищаем маркеры
        this.markers.forEach(marker => {
            if (marker.parentNode) marker.parentNode.removeChild(marker);
        });
        this.markers = [];
        
        // Очищаем выноски
        this.labels.forEach(label => {
            if (label.parentNode) label.parentNode.removeChild(label);
        });
        this.labels = [];
    }

    updateExtremums() {
        if (!this.timeBarContainer) return;
        
        const currentDate = window.appState.currentDate || new Date();
        const extremums = this.calculateExtremumsForDay(currentDate);
        const groupedExtremums = this.groupExtremumsByTime(extremums);
        this.renderMarkers(groupedExtremums);
    }

    setupDateChangeObserver() {
        const originalCurrentDate = window.appState.currentDate;
        Object.defineProperty(window.appState, 'currentDate', {
            get() { return this._currentDate; },
            set(value) {
                this._currentDate = value;
                setTimeout(() => {
                    if (window.extremumTimeManager && window.extremumTimeManager.updateExtremums) {
                        window.extremumTimeManager.updateExtremums();
                    }
                }, 50);
            }
        });
        
        window.appState._currentDate = originalCurrentDate;
    }
}

// Автоматически создаем экземпляр
window.extremumTimeManager = new ExtremumTimeManager();