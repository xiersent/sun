// modules/timeUtils.js - АДАПТИРОВАННЫЙ ДЛЯ СИСТЕМЫ
class TimeUtils {
    constructor() {
        console.log('TimeUtils: режим UTC (внутренне) с совместимым интерфейсом');
        this.DAY_MS = 24 * 60 * 60 * 1000;
        this._isConverting = false;
    }
    
    // ================ ОБЩИЙ ИНТЕРФЕЙС ДЛЯ СИСТЕМЫ ================
    
    /**
     * Текущее время (локализованное для пользователя)
     */
    now() {
        return new Date(); // Возвращает Date в локальном времени браузера
    }
    
    nowTimestamp() {
        return Date.now(); // UTC timestamp
    }
    
    /**
     * Преобразует значение в Date (локальное для системы)
     */
    toLocalDate(value) {
        if (this._isConverting) {
            console.warn('TimeUtils: предотвращена рекурсия в toLocalDate');
            return new Date();
        }
        
        this._isConverting = true;
        
        try {
            if (!value) return new Date();
            
            if (value instanceof Date) {
                return value;
            }
            
            if (typeof value === 'number') {
                return new Date(value);
            }
            
            if (typeof value === 'string') {
                return this.parseStringToLocal(value);
            }
            
            return new Date();
        } finally {
            this._isConverting = false;
        }
    }
    
    /**
     * Парсит строку в локальное время (браузерное)
     */
    parseStringToLocal(dateTimeString) {
        if (!dateTimeString) return new Date();
        
        try {
            let normalized = dateTimeString.trim();
            
            // Формат "YYYY-MM-DD HH:MM:SS" (локальное время браузера)
            if (normalized.includes(' ') && !normalized.includes('T')) {
                const [datePart, timePart] = normalized.split(' ');
                const [year, month, day] = datePart.split('-').map(Number);
                
                let hours = 0, minutes = 0, seconds = 0, milliseconds = 0;
                if (timePart) {
                    const timeParts = timePart.split(':').map(Number);
                    hours = timeParts[0] || 0;
                    minutes = timeParts[1] || 0;
                    seconds = timeParts[2] || 0;
                    milliseconds = timeParts[3] || 0;
                }
                
                // Создаём Date из локального времени браузера
                return new Date(year, month - 1, day, hours, minutes, seconds, milliseconds);
            }
            
            // ISO и другие форматы
            return new Date(normalized);
            
        } catch (error) {
            console.error('TimeUtils: ошибка парсинга строки:', error.message);
            return new Date();
        }
    }
    
    /**
     * Парсит из раздельных полей даты и времени
     */
    parseFromDateAndTimeInputs(dateStr, timeStr) {
        if (!dateStr) {
            return new Date();
        }
        
        try {
            const [year, month, day] = dateStr.split('-').map(Number);
            
            let hours = 0, minutes = 0, seconds = 0, milliseconds = 0;
            if (timeStr) {
                const [h, m, s, ms] = timeStr.split(':').map(Number);
                hours = h || 0;
                minutes = m || 0;
                seconds = s || 0;
                milliseconds = ms || 0;
            }
            
            return new Date(year, month - 1, day, hours, minutes, seconds, milliseconds);
            
        } catch (error) {
            console.error('TimeUtils: ошибка парсинга полей:', error.message);
            return new Date();
        }
    }
    
    /**
     * Начало дня (00:00:00 локального времени)
     */
    getStartOfDay(date) {
        const localDate = this.toLocalDate(date);
        
        // Начало дня в ЛОКАЛЬНОМ времени
        const start = new Date(
            localDate.getFullYear(),
            localDate.getMonth(),
            localDate.getDate(),
            0, 0, 0, 0
        );
        
        return start;
    }
    
	// modules/timeUtils.js - ИСПРАВЛЕННЫЙ метод getDaysBetween
	getDaysBetween(date1, date2) {
		const d1 = this.toLocalDate(date1);
		const d2 = this.toLocalDate(date2);
		
		// Используем UTC компоненты для точного расчета дней без влияния перехода на летнее время
		const utc1 = Date.UTC(d1.getFullYear(), d1.getMonth(), d1.getDate());
		const utc2 = Date.UTC(d2.getFullYear(), d2.getMonth(), d2.getDate());
		
		const diffMs = utc2 - utc1;
		return diffMs / this.DAY_MS;
	}
    
    /**
     * Разница в днях с высокой точностью
     */
    getDaysBetweenExact(date1, date2) {
        return this.getDaysBetween(date1, date2);
    }
    
    /**
     * Разница в годах
     */
    getYearsBetween(date1, date2) {
        const days = this.getDaysBetween(date1, date2);
        return Math.floor(days / 365.25);
    }
    
    /**
     * Добавляет дни к дате
     */
    addDays(date, days) {
        const localDate = this.toLocalDate(date);
        const result = new Date(localDate.getTime() + (days * this.DAY_MS));
        return result;
    }
    
    /**
     * День недели (0-6, 0=воскресенье)
     */
    getWeekday(date) {
        const localDate = this.toLocalDate(date);
        return localDate.getDay();
    }
    
    /**
     * Название дня недели
     */
    getWeekdayName(date, full = false) {
        const localDate = this.toLocalDate(date);
        const weekday = localDate.getDay();
        
        const weekdays = full ? 
            ['Воскресенье', 'Понедельник', 'Вторник', 'Среда', 'Четверг', 'Пятница', 'Суббота'] :
            ['Вс', 'Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб'];
        
        return weekdays[weekday];
    }
    
    // ================ ФОРМАТИРОВАНИЕ ================
    
    /**
     * Форматирует дату для input[type="date"]
     */
    formatForDateInput(timestamp) {
        const date = new Date(timestamp);
        if (isNaN(date.getTime())) return '';
        
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
    }
    
    /**
     * Форматирует время для input[type="time"]
     */
    formatForTimeInput(timestamp) {
        const date = new Date(timestamp);
        if (isNaN(date.getTime())) return '';
        
        const hours = String(date.getHours()).padStart(2, '0');
        const minutes = String(date.getMinutes()).padStart(2, '0');
        const seconds = String(date.getSeconds()).padStart(2, '0');
        return `${hours}:${minutes}:${seconds}`;
    }
    
    /**
     * Форматирует для раздельных полей ввода
     */
    formatForDateTimeInputs(timestamp) {
        return {
            date: this.formatForDateInput(timestamp),
            time: this.formatForTimeInput(timestamp)
        };
    }
    
    /**
     * Форматирует для единого поля datetime-local
     */
    formatForDateTimeInput(timestamp) {
        const date = new Date(timestamp);
        if (isNaN(date.getTime())) return '';
        
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        const hours = String(date.getHours()).padStart(2, '0');
        const minutes = String(date.getMinutes()).padStart(2, '0');
        const seconds = String(date.getSeconds()).padStart(2, '0');
        
        return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
    }
    
    /**
     * Форматирует дату "DD.MM.YYYY"
     */
    formatDate(timestamp) {
        const date = new Date(timestamp);
        if (isNaN(date.getTime())) return '';
        
        const day = String(date.getDate()).padStart(2, '0');
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const year = date.getFullYear();
        return `${day}.${month}.${year}`;
    }
    
    /**
     * Форматирует дату и время "DD.MM.YYYY HH:MM:SS"
     */
    formatDateTime(timestamp) {
        const date = new Date(timestamp);
        if (isNaN(date.getTime())) return '';
        
        const day = String(date.getDate()).padStart(2, '0');
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const year = date.getFullYear();
        const hours = String(date.getHours()).padStart(2, '0');
        const minutes = String(date.getMinutes()).padStart(2, '0');
        const seconds = String(date.getSeconds()).padStart(2, '0');
        return `${day}.${month}.${year} ${hours}:${minutes}:${seconds}`;
    }
    
    /**
     * Форматирует текущий день с секундами
     */
    formatCurrentDayWithSeconds(currentDay, currentDate = null) {
        try {
            return currentDay.toFixed(5);
        } catch (error) {
            return currentDay.toFixed(5);
        }
    }
    
    // ================ ВНУТРЕННИЕ UTC МЕТОДЫ ================
    
    /**
     * Конвертирует в UTC timestamp (внутреннее использование)
     */
    _toUTCTimestamp(value) {
        const date = this.toLocalDate(value);
        return date.getTime(); // Возвращает UTC timestamp
    }
    
    /**
     * Начало дня в UTC (внутреннее использование)
     */
    _getStartOfDayUTC(date) {
        const utcDate = new Date(this._toUTCTimestamp(date));
        
        // Создаём новую дату с UTC компонентами
        const year = utcDate.getUTCFullYear();
        const month = utcDate.getUTCMonth();
        const day = utcDate.getUTCDate();
        
        return Date.UTC(year, month, day, 0, 0, 0, 0);
    }
    
    /**
     * Разница в днях в UTC (внутреннее использование)
     */
    _getDaysBetweenUTC(date1, date2) {
        const timestamp1 = this._toUTCTimestamp(date1);
        const timestamp2 = this._toUTCTimestamp(date2);
        
        return (timestamp2 - timestamp1) / this.DAY_MS;
    }
    
    // ================ УТИЛИТЫ И ПРОВЕРКИ ================
    
    /**
     * Проверяет, является ли значение timestamp
     */
    isTimestamp(value) {
        return typeof value === 'number' && 
               !isNaN(value) && 
               value > 0 && 
               value < Number.MAX_SAFE_INTEGER;
    }
    
    /**
     * Преобразует строку даты-времени в timestamp
     */
    stringFromDateTimeStringToTimestamp(dateTimeString) {
        const date = this.parseStringToLocal(dateTimeString);
        return date.getTime();
    }
    
    /**
     * Безопасное логирование
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
     * Парсит из input[type="datetime-local"]
     */
    parseFromDateTimeInput(inputString) {
        return this.parseStringToLocal(inputString);
    }
    
    /**
     * Конвертирует локальное время в timestamp
     */
    userLocalToUTC(year, month, day, hours = 0, minutes = 0, seconds = 0, milliseconds = 0) {
        const localDate = new Date(year, month - 1, day, hours, minutes, seconds, milliseconds);
        return localDate.getTime();
    }
    
    /**
     * Получает часовой пояс пользователя
     */
    getUserTimezoneOffset() {
        return new Date().getTimezoneOffset();
    }
    
    // ================ ДЛЯ ОБРАТНОЙ СОВМЕСТИМОСТИ ================
    
    /**
     * Псевдонимы для старого кода
     */
    getStartOfDayLocal(timestamp) {
        return this.getStartOfDay(timestamp);
    }
    
    stringToTimestamp(dateString) {
        return this.stringFromDateTimeStringToTimestamp(dateString);
    }
    
    getCurrentDate() {
        return this.now();
    }
    
    // ================ ДЛЯ МОДУЛЕЙ, КОТОРЫЕ ХОТЯТ UTC ================
    
    /**
     * Явный вызов UTC методов (только для модулей, которые понимают UTC)
     */
    getStartOfDayUTC(date) {
        const timestamp = this._getStartOfDayUTC(date);
        return new Date(timestamp); // Возвращаем как Date для совместимости
    }
    
    getDaysBetweenUTC(date1, date2) {
        return this._getDaysBetweenUTC(date1, date2);
    }
    
    parseStringToUTC(dateTimeString) {
        console.warn('TimeUtils.parseStringToUTC(): используйте toLocalDate() для совместимости');
        const timestamp = this._parseStringToUTCInternal(dateTimeString);
        return new Date(timestamp);
    }
    
    _parseStringToUTCInternal(dateTimeString) {
        try {
            if (!dateTimeString) return Date.now();
            
            let normalized = dateTimeString.trim();
            
            if (normalized.includes(' ') && !normalized.includes('T')) {
                const [datePart, timePart] = normalized.split(' ');
                const [year, month, day] = datePart.split('-').map(Number);
                
                let hours = 0, minutes = 0, seconds = 0, milliseconds = 0;
                if (timePart) {
                    const timeParts = timePart.split(':').map(Number);
                    hours = timeParts[0] || 0;
                    minutes = timeParts[1] || 0;
                    seconds = timeParts[2] || 0;
                    milliseconds = timeParts[3] || 0;
                }
                
                // Создаём Date и возвращаем timestamp
                const localDate = new Date(year, month - 1, day, hours, minutes, seconds, milliseconds);
                return localDate.getTime();
            }
            
            return new Date(normalized).getTime();
            
        } catch (error) {
            console.error('Ошибка парсинга UTC:', error);
            return Date.now();
        }
    }

	/**
	 * Разница в целых днях (без учета времени суток и переходов на летнее время)
	 */
	getWholeDaysBetween(date1, date2) {
		const d1 = this.toLocalDate(date1);
		const d2 = this.toLocalDate(date2);
		
		// Используем только год, месяц, день для расчета целых дней
		const utc1 = Date.UTC(d1.getFullYear(), d1.getMonth(), d1.getDate());
		const utc2 = Date.UTC(d2.getFullYear(), d2.getMonth(), d2.getDate());
		
		return Math.round((utc2 - utc1) / this.DAY_MS);
	}

}

window.timeUtils = new TimeUtils();