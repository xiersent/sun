// modules/timeUtils.js - ПОЛНОСТЬЮ В ЛОКАЛЬНОМ ВРЕМЕНИ
/**
 * Утилиты для работы со временем в ЛОКАЛЬНОМ часовом поясе пользователя
 * Все методы работают с локальным временем пользователя
 * НЕТ UTC преобразований, НЕТ часовых поясов
 */
class TimeUtils {
    constructor() {
        console.log('TimeUtils: режим ЛОКАЛЬНОЕ время пользователя');
        this.DAY_MS = 24 * 60 * 60 * 1000;
    }
    
    // ================ БАЗОВЫЕ МЕТОДЫ ================
    
    /**
     * Текущее время в локальном часовом поясе
     * @returns {Date} Date объект в локальном времени
     */
    now() {
        return new Date();
    }
    
    /**
     * Текущее время как timestamp
     * @returns {number} timestamp (всегда локальное время)
     */
    nowTimestamp() {
        return Date.now();
    }
    
    /**
     * Приводит любое значение к Date в локальном времени
     * @param {Date|number|string} value - Значение времени
     * @returns {Date} Date в локальном времени
     */
    toLocalDate(value) {
        if (!value) return this.now();
        
        if (value instanceof Date) {
            return new Date(value.getTime());
        }
        
        if (typeof value === 'number') {
            return new Date(value);
        }
        
        if (typeof value === 'string') {
            return this.parseStringToLocal(value);
        }
        
        return this.now();
    }
    
    // ================ ПАРСИНГ И ФОРМАТИРОВАНИЕ ================
    
    /**
     * Парсит строку в локальное время
     * Форматы:
     * - "2024-01-15 14:30:00" (как локальное время)
     * - "2024-01-15" (00:00:00 локальное)
     * - "2024-01-15T14:30:00" (ISO, но интерпретируется как локальное)
     * 
     * @param {string} dateTimeString - Строка с датой
     * @returns {Date} Date в локальном времени
     */
    parseStringToLocal(dateTimeString) {
        if (!dateTimeString) return this.now();
        
        try {
            let normalized = dateTimeString.trim();
            
            // Если строка уже в формате "YYYY-MM-DD HH:MM:SS"
            if (normalized.includes(' ') && !normalized.includes('T')) {
                const [datePart, timePart] = normalized.split(' ');
                const [year, month, day] = datePart.split('-').map(Number);
                
                let hours = 0, minutes = 0, seconds = 0;
                if (timePart) {
                    const timeParts = timePart.split(':').map(Number);
                    hours = timeParts[0] || 0;
                    minutes = timeParts[1] || 0;
                    seconds = timeParts[2] || 0;
                }
                
                // Создаем Date в ЛОКАЛЬНОМ времени
                const date = new Date(year, month - 1, day, hours, minutes, seconds, 0);
                
                if (isNaN(date.getTime())) {
                    throw new Error(`Некорректная дата: "${dateTimeString}"`);
                }
                
                return date;
            }
            
            // Для других форматов (ISO и т.д.)
            const date = new Date(normalized);
            
            if (isNaN(date.getTime())) {
                throw new Error(`Некорректная дата: "${dateTimeString}"`);
            }
            
            return date;
            
        } catch (error) {
            console.error('TimeUtils: ошибка парсинга даты:', error.message);
            return this.now();
        }
    }
    
    /**
     * Парсит строку из input[type="datetime-local"]
     * Формат: "YYYY-MM-DD HH:MM:SS" (локальное время)
     * 
     * @param {string} inputString - Строка из инпута
     * @returns {number} timestamp
     */
    parseFromDateTimeInput(inputString) {
        if (!inputString) return this.nowTimestamp();
        
        try {
            const [datePart, timePart] = inputString.split(' ');
            
            if (!datePart) {
                throw new Error('Отсутствует дата');
            }
            
            const [year, month, day] = datePart.split('-').map(Number);
            
            let hours = 0, minutes = 0, seconds = 0;
            if (timePart) {
                const [h, m, s] = timePart.split(':').map(Number);
                hours = h || 0;
                minutes = m || 0;
                seconds = s || 0;
            }
            
            // Создаем Date в ЛОКАЛЬНОМ времени
            const date = new Date(year, month - 1, day, hours, minutes, seconds, 0);
            
            if (isNaN(date.getTime())) {
                throw new Error('Некорректная дата-время');
            }
            
            return date.getTime();
            
        } catch (error) {
            console.error('TimeUtils: ошибка парсинга input:', error);
            return this.nowTimestamp();
        }
    }
    
    /**
     * Форматирует timestamp для input[type="datetime-local"]
     * Формат: "YYYY-MM-DD HH:MM:SS" (локальное время)
     * 
     * @param {number} timestamp - timestamp
     * @returns {string} "YYYY-MM-DD HH:MM:SS"
     */
    formatForDateTimeInput(timestamp) {
        if (!timestamp) return '';
        
        const date = new Date(timestamp);
        
        if (isNaN(date.getTime())) {
            return '';
        }
        
        // Локальное время
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        const hours = String(date.getHours()).padStart(2, '0');
        const minutes = String(date.getMinutes()).padStart(2, '0');
        const seconds = String(date.getSeconds()).padStart(2, '0');
        
        return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
    }
    
    /**
     * Форматирует дату для отображения
     * @param {Date|number} date - Дата
     * @returns {string} "DD.MM.YYYY" (локальная дата)
     */
    formatDate(date) {
        const d = this.toLocalDate(date);
        const day = String(d.getDate()).padStart(2, '0');
        const month = String(d.getMonth() + 1).padStart(2, '0');
        const year = d.getFullYear();
        return `${day}.${month}.${year}`;
    }
    
    /**
     * Форматирует дату и время
     * @param {Date|number} date - Дата
     * @returns {string} "DD.MM.YYYY HH:MM:SS" (локальное время)
     */
    formatDateTime(date) {
        const d = this.toLocalDate(date);
        const day = String(d.getDate()).padStart(2, '0');
        const month = String(d.getMonth() + 1).padStart(2, '0');
        const year = d.getFullYear();
        const hours = String(d.getHours()).padStart(2, '0');
        const minutes = String(d.getMinutes()).padStart(2, '0');
        const seconds = String(d.getSeconds()).padStart(2, '0');
        return `${day}.${month}.${year} ${hours}:${minutes}:${seconds}`;
    }
    
    /**
     * Форматирует дату для input[type="date"]
     * @param {Date|number} date - Дата
     * @returns {string} "YYYY-MM-DD" (локальная дата)
     */
    formatForDateInput(date) {
        const d = this.toLocalDate(date);
        const year = d.getFullYear();
        const month = String(d.getMonth() + 1).padStart(2, '0');
        const day = String(d.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
    }
    
    // ================ ВЫЧИСЛЕНИЯ ================
    
    /**
     * Начало дня (00:00:00.000) в локальном времени
     * @param {Date|number} date - Дата
     * @returns {Date} Начало дня в локальном времени
     */
    getStartOfDay(date) {
        const d = this.toLocalDate(date);
        return new Date(d.getFullYear(), d.getMonth(), d.getDate(), 0, 0, 0, 0);
    }
    
    /**
     * Разница в днях между двумя датами (целые дни)
     * Использует начало дня в локальном времени
     * 
     * @param {Date|number} date1 - Первая дата
     * @param {Date|number} date2 - Вторая дата
     * @returns {number} Целое количество дней
     */
    getDaysBetween(date1, date2) {
        const d1 = this.getStartOfDay(date1);
        const d2 = this.getStartOfDay(date2);
        
        const diffMs = d2.getTime() - d1.getTime();
        return Math.floor(diffMs / this.DAY_MS);
    }
    
    /**
     * ТОЧНАЯ разница в днях между двумя датами (дробная)
     * Использует точное локальное время
     * 
     * @param {Date|number} date1 - Первая дата
     * @param {Date|number} date2 - Вторая дата
     * @returns {number} Дробное количество дней
     */
    getDaysBetweenExact(date1, date2) {
        const d1 = this.toLocalDate(date1);
        const d2 = this.toLocalDate(date2);
        
        const diffMs = d2.getTime() - d1.getTime();
        return diffMs / this.DAY_MS;
    }
    
    /**
     * Форматирует текущий день с дробной частью
     * Показывает 5 знаков после запятой (точность до секунды)
     * 
     * @param {number} currentDay - Текущий день (дробный)
     * @param {Date} [currentDate] - Текущая дата для верификации
     * @returns {string} "ДД.ДДДДД"
     */
    formatCurrentDayWithSeconds(currentDay, currentDate = null) {
        if (currentDay === undefined || currentDay === null || isNaN(currentDay)) {
            return '0.00000';
        }
        
        // Проверяем согласованность
        if (currentDate && window.appState && window.appState.baseDate) {
            const calculatedDay = this.getDaysBetweenExact(
                window.appState.baseDate,
                currentDate
            );
            
            const diff = Math.abs(calculatedDay - currentDay);
            if (diff > 0.00001) {
                console.warn('TimeUtils: расхождение currentDay!', {
                    currentDay: currentDay,
                    calculated: calculatedDay,
                    diff: diff
                });
            }
        }
        
        return currentDay.toFixed(5);
    }
    
    // ================ ДНИ НЕДЕЛИ ================
    
    /**
     * День недели в локальном времени (0-воскресенье, 6-суббота)
     * @param {Date|number} date - Дата
     * @returns {number} 0-6
     */
    getWeekday(date) {
        const d = this.toLocalDate(date);
        return d.getDay();
    }
    
    /**
     * Название дня недели
     * @param {Date|number} date - Дата
     * @param {boolean} full - Полное название?
     * @returns {string} Название дня
     */
    getWeekdayName(date, full = false) {
        const weekday = this.getWeekday(date);
        const weekdays = full ? 
            ['Воскресенье', 'Понедельник', 'Вторник', 'Среда', 'Четверг', 'Пятница', 'Суббота'] :
            ['Вс', 'Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб'];
        return weekdays[weekday];
    }
    
    // ================ РАЗНИЦА В ГОДАХ ================
    
    /**
     * Разница в годах между датами
     * @param {Date|number} date1 - Первая дата
     * @param {Date|number} date2 - Вторая дата
     * @returns {number} Целое количество лет
     */
    getYearsBetween(date1, date2) {
        const d1 = this.toLocalDate(date1);
        const d2 = this.toLocalDate(date2);
        
        const diffDays = Math.abs(this.getDaysBetweenExact(d1, d2));
        return Math.floor(diffDays / 365.25);
    }
    
    // ================ ВАЛИДАЦИЯ ================
    
    /**
     * Проверяет, является ли значение timestamp
     * @param {any} value - Значение для проверки
     * @returns {boolean} true если это корректный timestamp
     */
    isTimestamp(value) {
        return typeof value === 'number' && 
               !isNaN(value) && 
               value > 0 && 
               value < Number.MAX_SAFE_INTEGER;
    }
    
    /**
     * Получает timestamp из любого значения
     * @param {any} value - Значение
     * @returns {number} timestamp
     */
    getTimestamp(value) {
        if (!value) return this.nowTimestamp();
        
        if (this.isTimestamp(value)) {
            return value;
        }
        
        if (typeof value === 'string') {
            return this.parseStringToLocal(value).getTime();
        }
        
        if (value instanceof Date) {
            return value.getTime();
        }
        
        return this.nowTimestamp();
    }
    
    /**
     * Проверяет согласованность дат в приложении
     */
    validateDateConsistency() {
        if (!window.appState) return;
        
        const { currentDate, baseDate, currentDay } = window.appState;
        
        if (!currentDate || !baseDate) return;
        
        const calculatedCurrentDay = this.getDaysBetweenExact(baseDate, currentDate);
        const diff = Math.abs(calculatedCurrentDay - (currentDay || 0));
        
        if (diff > 0.00001) {
            console.error('TimeUtils: НЕСОГЛАСОВАННОСТЬ ДАТ!', {
                baseDate: new Date(baseDate).toLocaleString(),
                currentDate: currentDate.toLocaleString(),
                storedCurrentDay: currentDay,
                calculatedCurrentDay: calculatedCurrentDay,
                diffDays: diff,
                diffSeconds: Math.round(diff * 86400)
            });
            return false;
        }
        
        console.log('TimeUtils: даты согласованы', {
            currentDay: currentDay,
            calculated: calculatedCurrentDay.toFixed(5),
            diff: diff.toFixed(8)
        });
        return true;
    }
}

window.timeUtils = new TimeUtils();