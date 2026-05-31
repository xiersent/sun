/**
 * @file timeUtils.js
 * Парсинг и форматирование дат/времени в локальной зоне пользователя.
 */
class TimeUtils {
    constructor() {
        this.DAY_MS = 24 * 60 * 60 * 1000;
        this._isConverting = false;
    }
    
    /** Текущий момент как Date. */
    now() {
        return new Date();
    }
    
    /** Текущий момент в миллисекундах. */
    nowTimestamp() {
        return Date.now();
    }
    
    /** Приводит значение к локальному Date без рекурсии. */
    toLocalDate(value) {
        if (this._isConverting) {
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
    
    /** Парсит строку YYYY-MM-DD [HH:mm:ss] в локальный Date. */
    parseStringToLocal(dateTimeString) {
        if (!dateTimeString) return new Date();
        
        try {
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
                
                return new Date(year, month - 1, day, hours, minutes, seconds, milliseconds);
            }
            
            return new Date(normalized);
            
        } catch (error) {
            return new Date();
        }
    }
    
    /** Собирает Date из полей date и time input. */
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
            return new Date();
        }
    }
    
    /** Начало локального календарного дня. */
    getStartOfDay(date) {
        const localDate = this.toLocalDate(date);
        
        const start = new Date(
            localDate.getFullYear(),
            localDate.getMonth(),
            localDate.getDate(),
            0, 0, 0, 0
        );
        
        return start;
    }

	getDaysBetween(date1, date2) {
		const d1 = this.toLocalDate(date1);
		const d2 = this.toLocalDate(date2);
		
		const utc1 = Date.UTC(d1.getFullYear(), d1.getMonth(), d1.getDate());
		const utc2 = Date.UTC(d2.getFullYear(), d2.getMonth(), d2.getDate());
		
		const diffMs = utc2 - utc1;
		return diffMs / this.DAY_MS;
	}
    
    /** Алиас getDaysBetween. */
    getDaysBetweenExact(date1, date2) {
        return this.getDaysBetween(date1, date2);
    }
    
    /** Полных лет между датами через дни / 365.25. */
    getYearsBetween(date1, date2) {
        const days = this.getDaysBetween(date1, date2);
        return Math.floor(days / 365.25);
    }
    
    /** Смещает дату на заданное число дней. */
    addDays(date, days) {
        const localDate = this.toLocalDate(date);
        const result = new Date(localDate.getTime() + (days * this.DAY_MS));
        return result;
    }
    
    /** Индекс дня недели 0–6. */
    getWeekday(date) {
        const localDate = this.toLocalDate(date);
        return localDate.getDay();
    }
    
    /** Краткое или полное имя дня недели. */
    getWeekdayName(date, full = false) {
        const localDate = this.toLocalDate(date);
        const weekday = localDate.getDay();
        
        const weekdays = full ? 
            ['Воскресенье', 'Понедельник', 'Вторник', 'Среда', 'Четверг', 'Пятница', 'Суббота'] :
            ['Вс', 'Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб'];
        
        return weekdays[weekday];
    }
    
    /** YYYY-MM-DD для input date. */
    formatForDateInput(timestamp) {
        const date = new Date(timestamp);
        if (isNaN(date.getTime())) return '';
        
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
    }
    
    /** HH:mm:ss для input time. */
    formatForTimeInput(timestamp) {
        const date = new Date(timestamp);
        if (isNaN(date.getTime())) return '';
        
        const hours = String(date.getHours()).padStart(2, '0');
        const minutes = String(date.getMinutes()).padStart(2, '0');
        const seconds = String(date.getSeconds()).padStart(2, '0');
        return `${hours}:${minutes}:${seconds}`;
    }
    
    /** Объект { date, time } для пары input. */
    formatForDateTimeInputs(timestamp) {
        return {
            date: this.formatForDateInput(timestamp),
            time: this.formatForTimeInput(timestamp)
        };
    }
    
    /** Строка YYYY-MM-DD HH:mm:ss. */
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
    
    /** Формат DD.MM.YYYY для timestamp. */
    formatDate(timestamp) {
        const date = new Date(timestamp);
        if (isNaN(date.getTime())) return '';
        
        const day = String(date.getDate()).padStart(2, '0');
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const year = date.getFullYear();
        return `${day}.${month}.${year}`;
    }
    
    /** Формат DD.MM.YYYY HH:mm:ss для timestamp. */
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
    
    /** Число currentDay с 5 знаками после запятой. */
    formatCurrentDayWithSeconds(currentDay, currentDate = null) {
        try {
            return currentDay.toFixed(5);
        } catch (error) {
            return currentDay.toFixed(5);
        }
    }
    
    /** Timestamp даты для UTC-расчётов. */
    _toUTCTimestamp(value) {
        const date = this.toLocalDate(value);
        return date.getTime();
    }
    
    /** Полночь UTC для даты. */
    _getStartOfDayUTC(date) {
        const utcDate = new Date(this._toUTCTimestamp(date));
        
        const year = utcDate.getUTCFullYear();
        const month = utcDate.getUTCMonth();
        const day = utcDate.getUTCDate();
        
        return Date.UTC(year, month, day, 0, 0, 0, 0);
    }
    
    /** Разница дней в UTC между двумя датами. */
    _getDaysBetweenUTC(date1, date2) {
        const timestamp1 = this._toUTCTimestamp(date1);
        const timestamp2 = this._toUTCTimestamp(date2);
        
        return (timestamp2 - timestamp1) / this.DAY_MS;
    }
    
    /** Проверка корректного числового timestamp. */
    isTimestamp(value) {
        return typeof value === 'number' && 
               !isNaN(value) && 
               value > 0 && 
               value < Number.MAX_SAFE_INTEGER;
    }
    
    /** Строка → миллисекунды. */
    stringFromDateTimeStringToTimestamp(dateTimeString) {
        const date = this.parseStringToLocal(dateTimeString);
        return date.getTime();
    }
    
    /** Строка для отладочного лога даты. */
    safeLogDate(label, date) {
        try {
            const d = this.toLocalDate(date);
            return `${label}: ${d.toLocaleString()}`;
        } catch (error) {
            return `${label}: ошибка форматирования`;
        }
    }
    
    /** Алиас parseStringToLocal. */
    parseFromDateTimeInput(inputString) {
        return this.parseStringToLocal(inputString);
    }
    
    /** Локальные компоненты → timestamp. */
    userLocalToUTC(year, month, day, hours = 0, minutes = 0, seconds = 0, milliseconds = 0) {
        const localDate = new Date(year, month - 1, day, hours, minutes, seconds, milliseconds);
        return localDate.getTime();
    }
    
    /** getTimezoneOffset браузера. */
    getUserTimezoneOffset() {
        return new Date().getTimezoneOffset();
    }
    
    /** Алиас getStartOfDay. */
    getStartOfDayLocal(timestamp) {
        return this.getStartOfDay(timestamp);
    }
    
    /** Алиас stringFromDateTimeStringToTimestamp. */
    stringToTimestamp(dateString) {
        return this.stringFromDateTimeStringToTimestamp(dateString);
    }
    
    /** Алиас now(). */
    getCurrentDate() {
        return this.now();
    }
    
    /** Начало UTC-дня как Date. */
    getStartOfDayUTC(date) {
        const timestamp = this._getStartOfDayUTC(date);
        return new Date(timestamp);
    }
    
    /** Публичная обёртка _getDaysBetweenUTC. */
    getDaysBetweenUTC(date1, date2) {
        return this._getDaysBetweenUTC(date1, date2);
    }
    
    /** Парсит строку в Date через UTC-логику. */
    parseStringToUTC(dateTimeString) {
        const timestamp = this._parseStringToUTCInternal(dateTimeString);
        return new Date(timestamp);
    }
    
    /** Внутренний парсер строки в UTC timestamp. */
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
                
                const localDate = new Date(year, month - 1, day, hours, minutes, seconds, milliseconds);
                return localDate.getTime();
            }
            
            return new Date(normalized).getTime();
            
        } catch (error) {
            return Date.now();
        }
    }

	getWholeDaysBetween(date1, date2) {
		const d1 = this.toLocalDate(date1);
		const d2 = this.toLocalDate(date2);
		
		const utc1 = Date.UTC(d1.getFullYear(), d1.getMonth(), d1.getDate());
		const utc2 = Date.UTC(d2.getFullYear(), d2.getMonth(), d2.getDate());
		
		return Math.round((utc2 - utc1) / this.DAY_MS);
	}

}

window.timeUtils = new TimeUtils();