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
			marker.style.backgroundColor = dominantColor;
			
			if (group.position === 'top') {
				marker.classList.add('extremum-marker-top');
			} else {
				marker.classList.add('extremum-marker-bottom');
			}
			
			// Выноска - все стили в CSS
			const label = document.createElement('div');
			label.className = 'extremum-label';
			label.dataset.waveId = group.waves[0].id;
			label.dataset.position = group.position;
			label.dataset.time = group.time.toISOString();
			
			// Только позиционирование и цвет фона (цвет зависит от волны)
			label.style.left = `${clampedPercent}%`;
			label.style.backgroundColor = dominantColor;
			
			if (group.position === 'top') {
				label.classList.add('extremum-label-top');
			} else {
				label.classList.add('extremum-label-bottom');
			}
			
			// СОЗДАЕМ КЛИКАБЕЛЬНЫЕ ИМЕНА КОЛОСКОВ
			const waveNameMap = new Map();
			group.waves.forEach(wave => {
				waveNameMap.set(wave.name, wave.id);
			});
			
			const uniqueNames = Array.from(waveNameMap.keys());
			const waveIds = Array.from(waveNameMap.values());
			
			// Создаем HTML с кликабельными span элементами
			const labelHTML = uniqueNames.map((name, index) => {
				const waveId = waveIds[index];
				return `<span class="extremum-wave-name" data-wave-id="${waveId}">${name}</span>`;
			}).join(', ');
			
			// Создаем внутреннюю структуру выноски
			const labelTextElement = document.createElement('div');
			labelTextElement.className = 'extremum-label-text';
			labelTextElement.innerHTML = labelHTML;
			
			// Стрелочка
			const arrow = document.createElement('div');
			arrow.className = 'extremum-label-arrow';
			
			label.appendChild(labelTextElement);
			label.appendChild(arrow);
			
			// Добавляем в контейнер временной шкалы
			this.timeBarContainer.appendChild(marker);
			this.timeBarContainer.appendChild(label);
			
			this.markers.push(marker);
			this.labels.push(label);
			
			// Добавляем обработчики кликов на имена колосков
			setTimeout(() => {
				labelTextElement.querySelectorAll('.extremum-wave-name').forEach(span => {
					span.addEventListener('mouseenter', () => {
						span.style.opacity = '0.8';
					});
					
					span.addEventListener('mouseleave', () => {
						span.style.opacity = '1';
					});
					
					span.addEventListener('click', (e) => {
						e.preventDefault();
						e.stopPropagation();
						
						const waveId = span.dataset.waveId;
						if (waveId) {
							const checkbox = document.querySelector(`.wave-visibility-check[data-id="${waveId}"]`);
							if (checkbox) {
								checkbox.click();
							}
						}
					});
				});
			}, 10);
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