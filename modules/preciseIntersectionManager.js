// modules/preciseIntersectionManager.js
class PreciseIntersectionManager {
    constructor() {
        this.EPSILON = 1e-15; // Машинная точность
        this.MAX_ITERATIONS = 50; // Увеличиваем для бинарного поиска
        this.SECONDS_PER_DAY = 86400;
        this.MILLISECONDS_PER_DAY = 86400000;
    }
    
    /**
     * Точный поиск пересечений двух волн за день
     */
    findIntersectionsForDay(wave1, wave2, date) {
        const intersections = [];
        const dayStart = new Date(date);
        dayStart.setHours(0, 0, 0, 0, 0);
        const dayEnd = new Date(dayStart);
        dayEnd.setHours(23, 59, 59, 999);
        
        // Получаем уравнения волн
        const eq1 = this.getWaveEquation(wave1);
        const eq2 = this.getWaveEquation(wave2);
        
        // Находим все потенциальные точки пересечения
        const potentialPoints = this.findPotentialIntersectionTimes(wave1, wave2, dayStart);
        
        // Уточняем каждую потенциальную точку
        for (const time of potentialPoints) {
            const preciseTime = this.refineIntersection(
                eq1, eq2, 
                time, 
                dayStart, dayEnd
            );
            
            if (preciseTime && 
                preciseTime >= dayStart && 
                preciseTime <= dayEnd) {
                
                // Проверяем, что это действительно пересечение
                const y1 = this.calculateY(eq1, preciseTime);
                const y2 = this.calculateY(eq2, preciseTime);
                
                if (Math.abs(y1 - y2) < 1e-8) {
                    intersections.push({
                        time: preciseTime,
                        wave1: wave1,
                        wave2: wave2,
                        y: (y1 + y2) / 2,
                        isExact: Math.abs(y1 - y2) < 1e-12
                    });
                }
            }
        }
        
        return intersections.sort((a, b) => a.time - b.time);
    }
    
    /**
     * Аналитическое решение уравнения пересечения синусоид
     */
    findPotentialIntersectionTimes(wave1, wave2, dayStart) {
        const potentialTimes = [];
        const period1 = wave1.period;
        const period2 = wave2.period;
        
        // Фазы в начале дня
        const phase1 = this.getPhaseAtTime(wave1, dayStart);
        const phase2 = this.getPhaseAtTime(wave2, dayStart);
        
        // Разница частот
        const omega1 = 2 * Math.PI / period1;
        const omega2 = 2 * Math.PI / period2;
        
        // Уравнение: sin(omega1*t + phi1) = sin(omega2*t + phi2)
        // Решения:
        // 1) omega1*t + phi1 = omega2*t + phi2 + 2πk
        // 2) omega1*t + phi1 = π - (omega2*t + phi2) + 2πk
        
        // Первый случай: фазы совпадают с точностью до 2πk
        if (Math.abs(omega1 - omega2) > this.EPSILON) {
            const kValues = this.calculateKValues(dayStart, omega1, omega2, period1, period2);
            
            for (const k of kValues) {
                // Решение уравнения 1
                const t1 = (phase2 - phase1 + 2 * Math.PI * k) / (omega1 - omega2);
                const time1 = new Date(dayStart.getTime() + t1 * this.MILLISECONDS_PER_DAY);
                
                if (this.isWithinDay(time1, dayStart)) {
                    potentialTimes.push(time1);
                }
                
                // Решение уравнения 2
                const t2 = (Math.PI - phase1 - phase2 + 2 * Math.PI * k) / (omega1 + omega2);
                const time2 = new Date(dayStart.getTime() + t2 * this.MILLISECONDS_PER_DAY);
                
                if (this.isWithinDay(time2, dayStart)) {
                    potentialTimes.push(time2);
                }
            }
        } else {
            // Случай равных частот (совпадающие периоды)
            if (Math.abs(phase1 - phase2) < this.EPSILON) {
                // Волны всегда совпадают
                for (let hours = 0; hours < 24; hours++) {
                    const time = new Date(dayStart);
                    time.setHours(hours, 0, 0, 0);
                    potentialTimes.push(time);
                }
            }
            // Если фазы отличаются на π - волны всегда противоположны
        }
        
        return potentialTimes;
    }
    
    /**
     * Уточнение пересечения методом Ньютона-Рафсона
     */
    refineIntersection(eq1, eq2, initialTime, dayStart, dayEnd) {
        let t = (initialTime - dayStart) / this.MILLISECONDS_PER_DAY; // В днях
        let iterations = 0;
        
        while (iterations < this.MAX_ITERATIONS) {
            // Значения функций и производных
            const [f1, df1] = this.calculateWaveAndDerivative(eq1, t);
            const [f2, df2] = this.calculateWaveAndDerivative(eq2, t);
            
            const f = f1 - f2;
            const df = df1 - df2;
            
            if (Math.abs(df) < this.EPSILON) {
                break; // Производная слишком мала
            }
            
            const delta = f / df;
            t -= delta;
            
            if (Math.abs(delta) < 1e-12) {
                break; // Достигнута достаточная точность
            }
            
            iterations++;
            
            // Проверяем, что остаемся в пределах дня
            const currentTime = new Date(dayStart.getTime() + t * this.MILLISECONDS_PER_DAY);
            if (currentTime < dayStart || currentTime > dayEnd) {
                return null;
            }
        }
        
        const finalTime = new Date(dayStart.getTime() + t * this.MILLISECONDS_PER_DAY);
        return finalTime;
    }
    
    /**
     * Волновая функция и её производная
     */
    calculateWaveAndDerivative(waveEq, tDays) {
        const { amplitude, omega, phi } = waveEq;
        
        const angle = omega * tDays + phi;
        const value = amplitude * Math.sin(angle);
        const derivative = amplitude * omega * Math.cos(angle);
        
        return [value, derivative];
    }
    
    /**
     * Получить уравнение волны
     */
    getWaveEquation(wave) {
        return {
            amplitude: window.appState.config.amplitude / window.appState.config.squareSize,
            omega: 2 * Math.PI / wave.period,
            phi: 2 * Math.PI * this.getPhaseAtTime(wave, new Date(window.appState.baseDate))
        };
    }
    
    /**
     * Рассчитать значения k для перебора
     */
    calculateKValues(dayStart, omega1, omega2, period1, period2) {
        const dayDuration = 1; // 1 день
        const kMin = Math.floor(-(omega1 + omega2) * dayDuration / (2 * Math.PI)) - 2;
        const kMax = Math.ceil((omega1 + omega2) * dayDuration / (2 * Math.PI)) + 2;
        
        const kValues = [];
        for (let k = kMin; k <= kMax; k++) {
            kValues.push(k);
        }
        
        return kValues;
    }
    
    /**
     * Проверка нахождения времени в пределах дня
     */
    isWithinDay(time, dayStart) {
        const nextDay = new Date(dayStart);
        nextDay.setDate(nextDay.getDate() + 1);
        
        return time >= dayStart && time < nextDay;
    }
    
    /**
     * Точная фаза волны в заданное время
     */
    getPhaseAtTime(wave, time) {
        const baseDate = window.appState.baseDate instanceof Date ? 
            window.appState.baseDate : 
            new Date(window.appState.baseDate);
        
        const daysDiff = (time - baseDate) / this.MILLISECONDS_PER_DAY;
        const phase = (daysDiff % wave.period) / wave.period;
        
        return phase < 0 ? phase + 1 : phase;
    }
    
    /**
     * Основной метод для расчета всех пересечений за день
     */
    calculateAllIntersectionsForDay(date) {
        const activeWaves = this.getActiveWaves();
        const allIntersections = [];
        
        if (activeWaves.length < 2) return [];
        
        for (let i = 0; i < activeWaves.length; i++) {
            for (let j = i + 1; j < activeWaves.length; j++) {
                const intersections = this.findIntersectionsForDay(
                    activeWaves[i], 
                    activeWaves[j], 
                    date
                );
                
                intersections.forEach(intersection => {
                    allIntersections.push({
                        ...intersection,
                        timeStr: this.formatTimeWithMilliseconds(intersection.time),
                        wave1Name: activeWaves[i].name,
                        wave2Name: activeWaves[j].name,
                        wave1Period: activeWaves[i].period,
                        wave2Period: activeWaves[j].period,
                        wave1Color: activeWaves[i].color,
                        wave2Color: activeWaves[j].color
                    });
                });
            }
        }
        
        return allIntersections.sort((a, b) => a.time - b.time);
    }
    
    /**
     * Форматирование времени с миллисекундами
     */
    formatTimeWithMilliseconds(date) {
        const hours = date.getHours().toString().padStart(2, '0');
        const minutes = date.getMinutes().toString().padStart(2, '0');
        const seconds = date.getSeconds().toString().padStart(2, '0');
        const milliseconds = date.getMilliseconds().toString().padStart(3, '0');
        
        return `${hours}:${minutes}:${seconds}.${milliseconds}`;
    }
    
    getActiveWaves() {
        return window.appState.data.waves.filter(wave => {
            const waveIdStr = String(wave.id);
            const isVisible = window.appState.waveVisibility[waveIdStr] !== false;
            const isGroupEnabled = window.waves?.isWaveGroupEnabled?.(wave.id) || true;
            return isVisible && isGroupEnabled;
        });
    }
}

// Инициализация
window.preciseIntersectionManager = new PreciseIntersectionManager();