// modules/timeUtils.js - АДАПТИРОВАННЫЙ ДЛЯ СИСТЕМЫ
class TimeUtils {
    constructor() {
        this.DAY_MS = 24 * 60 * 60 * 1000;
        this._isConverting = false;
    }
    
    now() {
        return new Date();
    }
    
    nowTimestamp() {
        return Date.now();
    }
    
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
    
    getDaysBetweenExact(date1, date2) {
        return this.getDaysBetween(date1, date2);
    }
    
    getYearsBetween(date1, date2) {
        const days = this.getDaysBetween(date1, date2);
        return Math.floor(days / 365.25);
    }
    
    addDays(date, days) {
        const localDate = this.toLocalDate(date);
        const result = new Date(localDate.getTime() + (days * this.DAY_MS));
        return result;
    }
    
    getWeekday(date) {
        const localDate = this.toLocalDate(date);
        return localDate.getDay();
    }
    
    getWeekdayName(date, full = false) {
        const localDate = this.toLocalDate(date);
        const weekday = localDate.getDay();
        
        const weekdays = full ? 
            ['Воскресенье', 'Понедельник', 'Вторник', 'Среда', 'Четверг', 'Пятница', 'Суббота'] :
            ['Вс', 'Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб'];
        
        return weekdays[weekday];
    }
    
    formatForDateInput(timestamp) {
        const date = new Date(timestamp);
        if (isNaN(date.getTime())) return '';
        
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
    }
    
    formatForTimeInput(timestamp) {
        const date = new Date(timestamp);
        if (isNaN(date.getTime())) return '';
        
        const hours = String(date.getHours()).padStart(2, '0');
        const minutes = String(date.getMinutes()).padStart(2, '0');
        const seconds = String(date.getSeconds()).padStart(2, '0');
        return `${hours}:${minutes}:${seconds}`;
    }
    
    formatForDateTimeInputs(timestamp) {
        return {
            date: this.formatForDateInput(timestamp),
            time: this.formatForTimeInput(timestamp)
        };
    }
    
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
    
    formatDate(timestamp) {
        const date = new Date(timestamp);
        if (isNaN(date.getTime())) return '';
        
        const day = String(date.getDate()).padStart(2, '0');
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const year = date.getFullYear();
        return `${day}.${month}.${year}`;
    }
    
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
    
    formatCurrentDayWithSeconds(currentDay, currentDate = null) {
        try {
            return currentDay.toFixed(5);
        } catch (error) {
            return currentDay.toFixed(5);
        }
    }
    
    _toUTCTimestamp(value) {
        const date = this.toLocalDate(value);
        return date.getTime();
    }
    
    _getStartOfDayUTC(date) {
        const utcDate = new Date(this._toUTCTimestamp(date));
        
        const year = utcDate.getUTCFullYear();
        const month = utcDate.getUTCMonth();
        const day = utcDate.getUTCDate();
        
        return Date.UTC(year, month, day, 0, 0, 0, 0);
    }
    
    _getDaysBetweenUTC(date1, date2) {
        const timestamp1 = this._toUTCTimestamp(date1);
        const timestamp2 = this._toUTCTimestamp(date2);
        
        return (timestamp2 - timestamp1) / this.DAY_MS;
    }
    
    isTimestamp(value) {
        return typeof value === 'number' && 
               !isNaN(value) && 
               value > 0 && 
               value < Number.MAX_SAFE_INTEGER;
    }
    
    stringFromDateTimeStringToTimestamp(dateTimeString) {
        const date = this.parseStringToLocal(dateTimeString);
        return date.getTime();
    }
    
    safeLogDate(label, date) {
        try {
            const d = this.toLocalDate(date);
            return `${label}: ${d.toLocaleString()}`;
        } catch (error) {
            return `${label}: ошибка форматирования`;
        }
    }
    
    parseFromDateTimeInput(inputString) {
        return this.parseStringToLocal(inputString);
    }
    
    userLocalToUTC(year, month, day, hours = 0, minutes = 0, seconds = 0, milliseconds = 0) {
        const localDate = new Date(year, month - 1, day, hours, minutes, seconds, milliseconds);
        return localDate.getTime();
    }
    
    getUserTimezoneOffset() {
        return new Date().getTimezoneOffset();
    }
    
    getStartOfDayLocal(timestamp) {
        return this.getStartOfDay(timestamp);
    }
    
    stringToTimestamp(dateString) {
        return this.stringFromDateTimeStringToTimestamp(dateString);
    }
    
    getCurrentDate() {
        return this.now();
    }
    
    getStartOfDayUTC(date) {
        const timestamp = this._getStartOfDayUTC(date);
        return new Date(timestamp);
    }
    
    getDaysBetweenUTC(date1, date2) {
        return this._getDaysBetweenUTC(date1, date2);
    }
    
    parseStringToUTC(dateTimeString) {
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