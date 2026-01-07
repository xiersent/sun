// modules/intersectionManager.js - ПОЛНАЯ ЗАМЕНА
class WaveIntersectionManager {
    constructor() {
        this.elements = window.appCore ? window.appCore.elements : {};
        this.onlyActive = true; // По умолчанию только активные колоски
        this.currentDay = null;
        this.intersectionsCache = new Map(); // Кэш по датам: дата → пересечения
        this.isCalculating = false;
        
        // Параметры расчета
        this.TIME_TOLERANCE = 1; // 1 секунда точности
        this.MAX_INTERSECTIONS_PER_PAIR = 50; // Лимит на пару
        this.DAY_SECONDS = 86400; // Секунд в дне
    }
    
    // Основной метод: расчет всех пересечений за день
    calculateDailyIntersections(targetDate) {
        if (this.isCalculating) {
            console.warn('Расчет уже выполняется');
            return [];
        }
        
        this.isCalculating = true;
        
        try {
            const dayKey = targetDate.toDateString();
            
            // Проверка кэша
            if (this.intersectionsCache.has(dayKey)) {
                console.log('Используем кэшированные результаты для', dayKey);
                return this.intersectionsCache.get(dayKey);
            }
            
            console.log('Начинаем расчет пересечений для', dayKey);
            
            // Начало дня (00:00:00)
            const dayStart = new Date(targetDate);
            dayStart.setHours(0, 0, 0, 0);
            
            // Получить колоски для анализа
            const waves = this.onlyActive ? 
                this.getActiveWaves() : 
                window.appState.data.waves;
            
            console.log('Анализируем колосков:', waves.length, 
                       this.onlyActive ? '(только активные)' : '(все)');
            
            // Если колосков меньше 2 - нет пересечений
            if (waves.length < 2) {
                const emptyResult = [];
                this.intersectionsCache.set(dayKey, emptyResult);
                return emptyResult;
            }
            
            const allIntersections = [];
            const totalPairs = waves.length * (waves.length - 1) / 2;
            let processedPairs = 0;
            
            // Для каждой пары колосков
            for (let i = 0; i < waves.length; i++) {
                for (let j = i + 1; j < waves.length; j++) {
                    processedPairs++;
                    
                    // Лог прогресса для больших расчетов
                    if (totalPairs > 100 && processedPairs % 100 === 0) {
                        console.log(`Прогресс: ${processedPairs}/${totalPairs} пар`);
                    }
                    
                    const intersectionTimes = this.findIntersectionTimesForPair(
                        waves[i], 
                        waves[j], 
                        dayStart
                    );
                    
                    // Добавить каждое пересечение в результаты
                    intersectionTimes.forEach(time => {
                        const secondsFromMidnight = this.getSecondsFromMidnight(time);
                        
                        allIntersections.push({
                            timestamp: time.getTime(),
                            timeStr: this.formatTime(time),
                            wave1: waves[i],
                            wave2: waves[j],
                            secondsFromMidnight: secondsFromMidnight,
                            day: dayKey,
                            // Для сортировки и фильтрации
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
            
            // Сортировка по времени (от 00:00:00 до 23:59:59)
            allIntersections.sort((a, b) => a.secondsFromMidnight - b.secondsFromMidnight);
            
            console.log(`Найдено пересечений: ${allIntersections.length} за ${dayKey}`);
            
            // Кэширование результатов
            this.intersectionsCache.set(dayKey, allIntersections);
            
            // Очистка старого кэша (оставляем последние 7 дней)
            this.cleanCache();
            
            return allIntersections;
            
        } catch (error) {
            console.error('Ошибка расчета пересечений:', error);
            return [];
        } finally {
            this.isCalculating = false;
        }
    }
    
    // Математический поиск моментов пересечения для пары колосков
    findIntersectionTimesForPair(wave1, wave2, dayStart) {
        const intersections = [];
        
        try {
            // Преобразуем периоды в секунды
            const period1 = wave1.period * this.DAY_SECONDS; // период в секундах
            const period2 = wave2.period * this.DAY_SECONDS;
            
            // Вычисляем фазы на начало дня
            const phase1 = this.getPhaseAtTime(wave1, dayStart); // 0-1
            const phase2 = this.getPhaseAtTime(wave2, dayStart);
            
            // СЛУЧАЙ 1: Прямое равенство sin(θ1) = sin(θ2)
            // Решение: t*(1/П1 - 1/П2) = (φ2 - φ1) + k
            const diff = (1/period1 - 1/period2);
            
            if (Math.abs(diff) > 1e-12) { // Избегаем деления на 0
                // Начальное значение k
                let k = Math.floor((phase2 - phase1 - diff * this.DAY_SECONDS) / diff);
                
                for (let n = 0; n < this.MAX_INTERSECTIONS_PER_PAIR; n++) {
                    const t = ((phase2 - phase1) + k) / diff;
                    
                    // Проверка в пределах дня
                    if (t < 0) {
                        k++;
                        continue;
                    }
                    
                    if (t > this.DAY_SECONDS) break;
                    
                    // Округляем до секунды
                    const roundedSeconds = Math.round(t);
                    
                    // Создаем объект времени
                    const intersectionTime = new Date(dayStart);
                    intersectionTime.setSeconds(roundedSeconds);
                    
                    // Проверяем точность пересечения
                    if (this.isValidIntersection(wave1, wave2, intersectionTime)) {
                        // Проверяем на дубликат (уже есть пересечение в ту же секунду)
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
            
            // СЛУЧАЙ 2: Дополняющее равенство sin(θ1) = sin(π - θ2)
            // Решение: t*(1/П1 + 1/П2) = (0.5 - φ1 - φ2) + k
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
            console.error(`Ошибка поиска пересечений для пары ${wave1.name}-${wave2.name}:`, error);
        }
        
        // Сортируем по времени
        intersections.sort((a, b) => a.getTime() - b.getTime());
        
        return intersections;
    }
    
    // Проверка, что это действительно пересечение (дополнительная верификация)
    isValidIntersection(wave1, wave2, time) {
        try {
            // Вычисляем Y-координаты в момент времени
            const y1 = this.calculateYAtTime(wave1, time);
            const y2 = this.calculateYAtTime(wave2, time);
            
            // Разница должна быть меньше 1 пикселя (для точности)
            const diff = Math.abs(y1 - y2);
            return diff < 1.0;
            
        } catch (error) {
            console.error('Ошибка проверки пересечения:', error);
            return false;
        }
    }
    
    // Расчет Y-координаты колоска в момент времени
    calculateYAtTime(wave, time) {
        // Дней от базовой даты
        const daysFromBase = this.getDaysFromBase(time);
        
        // Фаза в пределах периода
        const phase = (daysFromBase % wave.period) / wave.period;
        
        // Y-координата на графике
        const centerY = window.appState.config.graphHeight / 2;
        const amplitude = window.appState.config.amplitude;
        
        return centerY - amplitude * Math.sin(2 * Math.PI * phase);
    }
    
    // Фаза колоска в момент времени (0-1)
    getPhaseAtTime(wave, time) {
        const daysFromBase = this.getDaysFromBase(time);
        return (daysFromBase % wave.period) / wave.period;
    }
    
    // Количество дней от базовой даты
	getDaysFromBase(date) {
		// Всегда используем TimeUtils для консистентности
		if (window.timeUtils && window.timeUtils.getDaysBetween) {
			return window.timeUtils.getDaysBetween(window.appState.baseDate, date);
		}
		
		// Fallback
		const baseDate = window.appState.baseDate instanceof Date ? 
			window.appState.baseDate : 
			new Date(window.appState.baseDate);
		
		const diffMs = date.getTime() - baseDate.getTime();
		return diffMs / (1000 * 60 * 60 * 24);
	}
    
    // Секунд от начала дня
    getSecondsFromMidnight(date) {
        return date.getHours() * 3600 + 
               date.getMinutes() * 60 + 
               date.getSeconds();
    }
    
    // Форматирование времени HH:MM:SS
    formatTime(date) {
        const hours = date.getHours().toString().padStart(2, '0');
        const minutes = date.getMinutes().toString().padStart(2, '0');
        const seconds = date.getSeconds().toString().padStart(2, '0');
        return `${hours}:${minutes}:${seconds}`;
    }
    
    // Получить активные колоски
    getActiveWaves() {
        if (!window.appState || !window.appState.data || !window.appState.data.waves) {
            return [];
        }
        
        return window.appState.data.waves.filter(wave => {
            const waveIdStr = String(wave.id);
            
            // Проверка видимости
            const isVisible = window.appState.waveVisibility[waveIdStr] !== false;
            
            // Проверка включенности группы
            let isGroupEnabled = false;
            if (window.waves && window.waves.isWaveGroupEnabled) {
                isGroupEnabled = window.waves.isWaveGroupEnabled(wave.id);
            } else {
                // Fallback: проверяем группы напрямую
                isGroupEnabled = this.isWaveInEnabledGroup(wave.id);
            }
            
            return isVisible && isGroupEnabled;
        });
    }
    
    // Fallback: проверка включенности группы
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
    
    // Отображение результатов
    displayResults(intersections, targetDate) {
        const container = this.elements.intersectionResults;
        const stats = this.elements.intersectionStats;
        
        if (!container || !stats) {
            console.error('Контейнеры для отображения не найдены');
            return;
        }
        
        // Очищаем контейнеры
        container.innerHTML = '';
        stats.innerHTML = '';
        
        if (!intersections || intersections.length === 0) {
            container.innerHTML = '<div class="list-empty">Нет пересечений за выбранный день</div>';
            stats.style.display = 'none';
            return;
        }
        
        // Статистика
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
        
        // Отображаем пересечения
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
            
            // Добавляем обработчик клика
            item.addEventListener('click', () => {
                this.onIntersectionClick(intersection);
            });
            
            container.appendChild(item);
        });
    }
    
    // Обработчик клика по пересечению
    onIntersectionClick(intersection) {
        console.log('Клик по пересечению:', intersection);
        
        // Можно добавить функциональность:
        // 1. Установить время визора на момент пересечения
        // 2. Выделить соответствующие колоски
        // 3. Показать дополнительную информацию
        
        // Пока просто выводим в консоль
        console.log(`Пересечение в ${intersection.timeStr}:`);
        console.log(`  ${intersection.wave1Name} (${intersection.wave1Period}д)`);
        console.log(`  ${intersection.wave2Name} (${intersection.wave2Period}д)`);
    }
    
    // Очистка кэша
    clearCache() {
        this.intersectionsCache.clear();
        console.log('Кэш пересечений очищен');
    }
    
    // Очистка старых записей из кэша
    cleanCache() {
        const maxCacheSize = 7; // Храним 7 дней
        
        if (this.intersectionsCache.size > maxCacheSize) {
            const keys = Array.from(this.intersectionsCache.keys());
            const keysToDelete = keys.slice(0, this.intersectionsCache.size - maxCacheSize);
            
            keysToDelete.forEach(key => {
                this.intersectionsCache.delete(key);
            });
            
            console.log(`Очищен кэш: удалено ${keysToDelete.length} старых записей`);
        }
    }
    
    // Обновить для текущей даты на визоре
    updateForCurrentDate() {
        const currentDate = window.appState.currentDate;
        if (!currentDate) return;
        
        console.log('Обновление пересечений для текущей даты:', currentDate);
        
        const results = this.calculateDailyIntersections(currentDate);
        this.displayResults(results, currentDate);
    }
    
    // Переключение режима (активные/все)
    toggleOnlyActive(value) {
        this.onlyActive = value;
        this.clearCache(); // Очищаем кэш при смене режима
        console.log('Режим изменен:', this.onlyActive ? 'только активные' : 'все колоски');
    }
}

window.intersectionManager = new WaveIntersectionManager();

// Глобальные функции для отладки
window.debugIntersections = function() {
    console.log('=== ДЕБАГ ПЕРЕСЕЧЕНИЙ ===');
    console.log('Текущая дата визора:', window.appState.currentDate);
    console.log('Активных колосков:', window.intersectionManager.getActiveWaves().length);
    console.log('Всего колосков:', window.appState.data.waves.length);
    console.log('Режим расчета:', window.intersectionManager.onlyActive ? 'активные' : 'все');
    console.log('Размер кэша:', window.intersectionManager.intersectionsCache.size);
    
    // Быстрый тест
    const testDate = new Date();
    const results = window.intersectionManager.calculateDailyIntersections(testDate);
    console.log('Тестовый расчет:', results.length, 'пересечений');
    
    return results;
};

window.clearIntersectionCache = function() {
    window.intersectionManager.clearCache();
    console.log('Кэш пересечений очищен вручную');
};