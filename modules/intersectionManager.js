class WaveIntersectionManager {
    constructor() {
        this.elements = window.appCore ? window.appCore.elements : {};
        this.onlyActive = true;
        this.currentDay = null;
        this.intersectionsCache = new Map();
        this.isCalculating = false;
        
        this.TIME_TOLERANCE = 1;
        this.MAX_INTERSECTIONS_PER_PAIR = 50;
        this.DAY_SECONDS = 86400;
    }
    
    calculateDailyIntersections(targetDate) {
        if (this.isCalculating) {
            return [];
        }
        
        this.isCalculating = true;
        
        try {
            const dayKey = targetDate.toDateString();
            
            if (this.intersectionsCache.has(dayKey)) {
                return this.intersectionsCache.get(dayKey);
            }
            
            const dayStart = new Date(targetDate);
            dayStart.setHours(0, 0, 0, 0);
            
            const waves = this.onlyActive ? 
                this.getActiveWaves() : 
                window.appState.data.waves;
            
            if (waves.length < 2) {
                const emptyResult = [];
                this.intersectionsCache.set(dayKey, emptyResult);
                return emptyResult;
            }
            
            const allIntersections = [];
            const totalPairs = waves.length * (waves.length - 1) / 2;
            let processedPairs = 0;
            
            for (let i = 0; i < waves.length; i++) {
                for (let j = i + 1; j < waves.length; j++) {
                    processedPairs++;
                    
                    const intersectionTimes = this.findIntersectionTimesForPair(
                        waves[i], 
                        waves[j], 
                        dayStart
                    );
                    
                    intersectionTimes.forEach(time => {
                        const secondsFromMidnight = this.getSecondsFromMidnight(time);
                        
                        allIntersections.push({
                            timestamp: time.getTime(),
                            timeStr: this.formatTime(time),
                            wave1: waves[i],
                            wave2: waves[j],
                            secondsFromMidnight: secondsFromMidnight,
                            day: dayKey,
                            wave1Name: waves[i].name,
                            wave2Name: waves[j].name,
                            wave1Period: waves[i].period,
                            wave2Period: waves[j].period,
                            wave1Color: waves[i].color,
                            wave2Color: waves[j].color
                        });
                    });
                }
            }
            
            allIntersections.sort((a, b) => a.secondsFromMidnight - b.secondsFromMidnight);
            
            this.intersectionsCache.set(dayKey, allIntersections);
            
            this.cleanCache();
            
            return allIntersections;
            
        } catch (error) {
            return [];
        } finally {
            this.isCalculating = false;
        }
    }
    
    findIntersectionTimesForPair(wave1, wave2, dayStart) {
        const intersections = [];
        
        try {
            const period1 = wave1.period * this.DAY_SECONDS;
            const period2 = wave2.period * this.DAY_SECONDS;
            
            const phase1 = this.getPhaseAtTime(wave1, dayStart);
            const phase2 = this.getPhaseAtTime(wave2, dayStart);
            
            const diff = (1/period1 - 1/period2);
            
            if (Math.abs(diff) > 1e-12) {
                let k = Math.floor((phase2 - phase1 - diff * this.DAY_SECONDS) / diff);
                
                for (let n = 0; n < this.MAX_INTERSECTIONS_PER_PAIR; n++) {
                    const t = ((phase2 - phase1) + k) / diff;
                    
                    if (t < 0) {
                        k++;
                        continue;
                    }
                    
                    if (t > this.DAY_SECONDS) break;
                    
                    const roundedSeconds = Math.round(t);
                    
                    const intersectionTime = new Date(dayStart);
                    intersectionTime.setSeconds(roundedSeconds);
                    
                    if (this.isValidIntersection(wave1, wave2, intersectionTime)) {
                        const isDuplicate = intersections.some(existing => 
                            Math.abs(existing.getTime() - intersectionTime.getTime()) < 1000
                        );
                        
                        if (!isDuplicate) {
                            intersections.push(intersectionTime);
                        }
                    }
                    
                    k++;
                }
            }
            
            const sum = (1/period1 + 1/period2);
            let k2 = Math.floor((0.5 - phase1 - phase2 - sum * this.DAY_SECONDS) / sum);
            
            for (let n = 0; n < this.MAX_INTERSECTIONS_PER_PAIR; n++) {
                const t = ((0.5 - phase1 - phase2) + k2) / sum;
                
                if (t < 0) {
                    k2++;
                    continue;
                }
                
                if (t > this.DAY_SECONDS) break;
                
                const roundedSeconds = Math.round(t);
                const intersectionTime = new Date(dayStart);
                intersectionTime.setSeconds(roundedSeconds);
                
                if (this.isValidIntersection(wave1, wave2, intersectionTime)) {
                    const isDuplicate = intersections.some(existing => 
                        Math.abs(existing.getTime() - intersectionTime.getTime()) < 1000
                    );
                    
                    if (!isDuplicate) {
                        intersections.push(intersectionTime);
                    }
                }
                
                k2++;
            }
            
        } catch (error) {
        }
        
        intersections.sort((a, b) => a.getTime() - b.getTime());
        
        return intersections;
    }
    
    isValidIntersection(wave1, wave2, time) {
        try {
            const y1 = this.calculateYAtTime(wave1, time);
            const y2 = this.calculateYAtTime(wave2, time);
            
            const diff = Math.abs(y1 - y2);
            return diff < 1.0;
            
        } catch (error) {
            return false;
        }
    }
    
    calculateYAtTime(wave, time) {
        const daysFromBase = this.getDaysFromBase(time);
        
        const phase = (daysFromBase % wave.period) / wave.period;
        
        const centerY = window.appState.config.graphHeight / 2;
        const amplitude = window.appState.config.amplitude;
        
        return centerY - amplitude * Math.sin(2 * Math.PI * phase);
    }
    
    getPhaseAtTime(wave, time) {
        const daysFromBase = this.getDaysFromBase(time);
        return (daysFromBase % wave.period) / wave.period;
    }
    
	getDaysFromBase(date) {
		if (window.timeUtils && window.timeUtils.getDaysBetween) {
			return window.timeUtils.getDaysBetween(window.appState.baseDate, date);
		}
		
		const baseDate = window.appState.baseDate instanceof Date ? 
			window.appState.baseDate : 
			new Date(window.appState.baseDate);
		
		const diffMs = date.getTime() - baseDate.getTime();
		return diffMs / (1000 * 60 * 60 * 24);
	}
    
    getSecondsFromMidnight(date) {
        return date.getHours() * 3600 + 
               date.getMinutes() * 60 + 
               date.getSeconds();
    }
    
    formatTime(date) {
        const hours = date.getHours().toString().padStart(2, '0');
        const minutes = date.getMinutes().toString().padStart(2, '0');
        const seconds = date.getSeconds().toString().padStart(2, '0');
        return `${hours}:${minutes}:${seconds}`;
    }
    
    getActiveWaves() {
        if (!window.appState || !window.appState.data || !window.appState.data.waves) {
            return [];
        }
        
        return window.appState.data.waves.filter(wave => {
            const waveIdStr = String(wave.id);
            
            const isVisible = window.appState.waveVisibility[waveIdStr] !== false;
            
            let isGroupEnabled = false;
            if (window.waves && window.waves.isWaveGroupEnabled) {
                isGroupEnabled = window.waves.isWaveGroupEnabled(wave.id);
            } else {
                isGroupEnabled = this.isWaveInEnabledGroup(wave.id);
            }
            
            return isVisible && isGroupEnabled;
        });
    }
    
    isWaveInEnabledGroup(waveId) {
        if (!window.appState || !window.appState.data || !window.appState.data.groups) {
            return false;
        }
        
        const waveIdStr = String(waveId);
        
        for (const group of window.appState.data.groups) {
            if (group.enabled && group.waves) {
                const waveInGroup = group.waves.some(groupWaveId => {
                    const groupWaveIdStr = String(groupWaveId);
                    return groupWaveIdStr === waveIdStr;
                });
                
                if (waveInGroup) {
                    return true;
                }
            }
        }
        
        return false;
    }
    
    displayResults(intersections, targetDate) {
        const container = this.elements.intersectionResults;
        const stats = this.elements.intersectionStats;
        
        if (!container || !stats) {
            return;
        }
        
        container.innerHTML = '';
        stats.innerHTML = '';
        
        if (!intersections || intersections.length === 0) {
            container.innerHTML = '<div class="list-empty">Нет пересечений за выбранный день</div>';
            stats.style.display = 'none';
            return;
        }
        
        const dateStr = targetDate.toLocaleDateString('ru-RU');
        const wavesCount = this.onlyActive ? 
            this.getActiveWaves().length : 
            window.appState.data.waves.length;
        
        stats.innerHTML = `
            <strong>Статистика пересечений:</strong><br>
            Дата: ${dateStr}<br>
            Всего пересечений: ${intersections.length}<br>
            Анализировано колосков: ${wavesCount}<br>
            Режим: ${this.onlyActive ? 'только активные' : 'все доступные'}
        `;
        stats.style.display = 'block';
        
        intersections.forEach((intersection, index) => {
            const item = document.createElement('div');
            item.className = 'intersection-item';
            item.dataset.timestamp = intersection.timestamp;
            item.dataset.index = index;
            
            item.innerHTML = `
                <div class="intersection-header">
                    <span class="intersection-time">${intersection.timeStr}</span>
                    <span class="intersection-index">${index + 1}</span>
                </div>
                
                <div class="intersection-pair">
                    <span class="wave-name" style="color: ${intersection.wave1Color}">
                        ${intersection.wave1Name}
                    </span>
                    <span class="intersection-symbol">×</span>
                    <span class="wave-name" style="color: ${intersection.wave2Color}">
                        ${intersection.wave2Name}
                    </span>
                </div>
                
                <div class="intersection-details">
                    Периоды: ${intersection.wave1Period}д × ${intersection.wave2Period}д
                </div>
            `;
            
            item.addEventListener('click', () => {
                this.onIntersectionClick(intersection);
            });
            
            container.appendChild(item);
        });
    }
    
    onIntersectionClick(intersection) {
    }
    
    clearCache() {
        this.intersectionsCache.clear();
    }
    
    cleanCache() {
        const maxCacheSize = 7;
        
        if (this.intersectionsCache.size > maxCacheSize) {
            const keys = Array.from(this.intersectionsCache.keys());
            const keysToDelete = keys.slice(0, this.intersectionsCache.size - maxCacheSize);
            
            keysToDelete.forEach(key => {
                this.intersectionsCache.delete(key);
            });
        }
    }
    
    updateForCurrentDate() {
        const currentDate = window.appState.currentDate;
        if (!currentDate) return;
        
        const results = this.calculateDailyIntersections(currentDate);
        this.displayResults(results, currentDate);
    }
    
    toggleOnlyActive(value) {
        this.onlyActive = value;
        this.clearCache();
    }
}

window.intersectionManager = new WaveIntersectionManager();

window.debugIntersections = function() {
    const testDate = new Date();
    const results = window.intersectionManager.calculateDailyIntersections(testDate);
    
    return results;
};

window.clearIntersectionCache = function() {
    window.intersectionManager.clearCache();
};

window.debugIntersections = function() {
    return window.intersectionManager.calculateDailyIntersections(new Date());
};

window.clearIntersectionCache = function() {
    window.intersectionManager.clearCache();
};