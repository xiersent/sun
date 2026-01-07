// modules/timeUtils.js - ИСПРАВЛЕННАЯ ВЕРСИЯ
class TimeUtils {
    constructor() {
        console.log('TimeUtils: режим ЛОКАЛЬНОЕ время пользователя');
        this.DAY_MS = 24 * 60 * 60 * 1000;
        this._isConverting = false; // Флаг для предотвращения рекурсии
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
        if (this._isConverting) {
            console.warn('TimeUtils: предотвращена рекурсия в toLocalDate');
            return this.now();
        }
        
        this._isConverting = true;
        
        try {
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
        } finally {
            this._isConverting = false;
        }
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
            // НЕ используем this.toLocalDate() чтобы избежать рекурсии!
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
     * Парсит значения из раздельных полей даты и времени
     * @param {string} dateStr - Строка даты из input[type="date"] (YYYY-MM-DD)
     * @param {string} timeStr - Строка времени из input[type="time"] (HH:MM:SS)
     * @returns {Date} Date в локальном времени
     */
    parseFromDateAndTimeInputs(dateStr, timeStr) {
        if (!dateStr) {
            return this.now();
        }
        
        try {
            const [year, month, day] = dateStr.split('-').map(Number);
            
            let hours = 0, minutes = 0, seconds = 0;
            if (timeStr) {
                const [h, m, s] = timeStr.split(':').map(Number);
                hours = h || 0;
                minutes = m || 0;
                seconds = s || 0;
            }
            
            // Создаем Date в ЛОКАЛЬНОМ времени
            const date = new Date(year, month - 1, day, hours, minutes, seconds, 0);
            
            if (isNaN(date.getTime())) {
                throw new Error(`Некорректная дата-время: "${dateStr} ${timeStr}"`);
            }
            
            return date;
        } catch (error) {
            console.error('TimeUtils: ошибка парсинга даты и времени:', error.message);
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
    
    /**
     * Форматирует время для поля input[type="time"]
     * @param {Date|number} date - Дата
     * @returns {string} "HH:MM:SS"
     */
    formatForTimeInput(date) {
        const d = this.toLocalDate(date);
        const hours = String(d.getHours()).padStart(2, '0');
        const minutes = String(d.getMinutes()).padStart(2, '0');
        const seconds = String(d.getSeconds()).padStart(2, '0');
        return `${hours}:${minutes}:${seconds}`;
    }
    
    /**
     * Форматирует дату и время для раздельных полей ввода
     * @param {Date|number} date - Дата
     * @returns {Object} {date: "YYYY-MM-DD", time: "HH:MM:SS"}
     */
    formatForDateTimeInputs(date) {
        const d = this.toLocalDate(date);
        return {
            date: this.formatForDateInput(d),
            time: this.formatForTimeInput(d)
        };
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
     * Форматирует текущий день с секундами
     * @param {number} currentDay - Текущий день (дробное число)
     * @param {Date} [currentDate] - Текущая дата
     * @returns {string} Отформатированная строка
     */
    formatCurrentDayWithSeconds(currentDay, currentDate = null) {
        try {
            // Просто возвращаем число с 5 знаками после запятой
            return currentDay.toFixed(5);
        } catch (error) {
            console.error('TimeUtils: ошибка форматирования дня с секундами:', error);
            return currentDay.toFixed(5);
        }
    }
    
    /**
     * Получает начало дня (00:00:00) для указанной даты в ЛОКАЛЬНОМ времени
     * @param {Date|number|string} date - Дата
     * @returns {Date} Начало дня в локальном времени
     */
    getStartOfDay(date) {
        const d = this.toLocalDate(date);
        return new Date(
            d.getFullYear(),
            d.getMonth(),
            d.getDate(),
            0, 0, 0, 0
        );
    }

    /**
     * Безопасное логирование дат в локальном времени
     * @param {string} label - Метка для лога
     * @param {Date|number|string} date - Дата
     * @returns {string} Форматированная строка для лога
     */
    safeLogDate(label, date) {
        try {
            const d = this.toLocalDate(date);
            return `${label}: ${d.toLocaleString()}`;
        } catch (error) {
            return `${label}: ошибка форматирования`;
        }
    }

    /**
     * Безопасное логирование временных меток
     * @param {string} label - Метка для лога
     * @param {number} timestamp - timestamp
     * @returns {string} Форматированная строка для лога
     */
    safeLogTimestamp(label, timestamp) {
        try {
            const d = this.toLocalDate(timestamp);
            return `${label}: ${d.toLocaleString()} (${timestamp})`;
        } catch (error) {
            return `${label}: ошибка (${timestamp})`;
        }
    }
    
    /**
     * Количество дней между двумя датами (локальное время)
     * @param {Date|number|string} date1 - Первая дата
     * @param {Date|number|string} date2 - Вторая дата
     * @returns {number} Дней между датами
     */
    getDaysBetween(date1, date2) {
        const d1 = this.toLocalDate(date1);
        const d2 = this.toLocalDate(date2);
        
        const timeDiff = d2.getTime() - d1.getTime();
        return timeDiff / (1000 * 60 * 60 * 24);
    }
    
    /**
     * Количество лет между двумя датами (локальное время)
     * @param {Date|number|string} date1 - Первая дата
     * @param {Date|number|string} date2 - Вторая дата
     * @returns {number} Лет между датами
     */
    getYearsBetween(date1, date2) {
        const days = this.getDaysBetween(date1, date2);
        return Math.floor(days / 365.25);
    }
    
    /**
     * Получает день недели (0-6, где 0 - воскресенье)
     * @param {Date|number|string} date - Дата
     * @returns {number} День недели
     */
    getWeekday(date) {
        const d = this.toLocalDate(date);
        return d.getDay();
    }
    
    /**
     * Получает название дня недели
     * @param {Date|number|string} date - Дата
     * @param {boolean} full - Полное название?
     * @returns {string} Название дня недели
     */
    getWeekdayName(date, full = false) {
        const weekday = this.getWeekday(date);
        const weekdays = full ? 
            window.appState?.config?.weekdaysFull || ['Воскресенье', 'Понедельник', 'Вторник', 'Среда', 'Четверг', 'Пятница', 'Суббота'] :
            window.appState?.config?.weekdays || ['Вс', 'Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб'];
        
        return weekdays[weekday];
    }

	isTimestamp(value) {
		// Проверяем, является ли значение timestamp (числом)
		return typeof value === 'number' && !isNaN(value) && value > 0;
	}

}

window.timeUtils = new TimeUtils();