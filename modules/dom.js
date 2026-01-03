// modules/dom.js - ОБНОВЛЕННЫЙ с использованием timeUtils
class DOM {
    constructor() {
        this.elements = {};
        this.cacheElements();
    }
    
    cacheElements() {
        document.querySelectorAll('[id]').forEach(el => {
            this.elements[el.id] = el;
        });
    }
    
    get(id) {
        return this.elements[id];
    }
    
    $(selector) {
        return document.querySelector(selector);
    }
    
    $$(selector) {
        return document.querySelectorAll(selector);
    }
    
    formatDate(timestamp) {
        // ЗАМЕНА: Используем timeUtils вместо локальных методов
        if (window.timeUtils && window.timeUtils.formatDateUTC) {
            return window.timeUtils.formatDateUTC(timestamp);
        }
        
        // Fallback для обратной совместимости
        if (!timestamp) return 'Неизвестно';
        try {
            let date;
            if (typeof timestamp === 'number') {
                date = new Date(timestamp);
            } else {
                date = new Date(timestamp);
            }
            
            if (isNaN(date.getTime())) {
                return 'Некорректная дата';
            }
            const day = String(date.getDate()).padStart(2, '0');
            const month = String(date.getMonth() + 1).padStart(2, '0');
            const year = date.getFullYear();
            return `${day}.${month}.${year}`;
        } catch (e) {
            console.error('Format date error:', e);
            return 'Ошибка даты';
        }
    }
    
    // НОВАЯ ФУНКЦИЯ: Полное форматирование даты и времени в одну строку - ОБНОВЛЕНА
    formatDateTimeFull(timestamp) {
        // ЗАМЕНА: Используем timeUtils
        if (window.timeUtils && window.timeUtils.formatDateTimeUTC) {
            return window.timeUtils.formatDateTimeUTC(timestamp);
        }
        
        // Fallback
        if (!timestamp) return 'Неизвестно';
        try {
            let date;
            if (typeof timestamp === 'number') {
                date = new Date(timestamp);
            } else {
                date = new Date(timestamp);
            }
            
            if (isNaN(date.getTime())) {
                return 'Некорректная дата';
            }
            const day = String(date.getDate()).padStart(2, '0');
            const month = String(date.getMonth() + 1).padStart(2, '0');
            const year = date.getFullYear();
            const hours = String(date.getHours()).padStart(2, '0');
            const minutes = String(date.getMinutes()).padStart(2, '0');
            const seconds = String(date.getSeconds()).padStart(2, '0');
            return `${day}.${month}.${year} ${hours}:${minutes}:${seconds}`;
        } catch (e) {
            console.error('Format datetime error:', e);
            return 'Ошибка даты';
        }
    }
    
    // НОВАЯ ФУНКЦИЯ: Форматирование currentDay для отображения секунд (5 знаков после запятой)
    formatCurrentDayWithSeconds(currentDay, currentDate = null) {
        // ЗАМЕНА: Используем timeUtils
        if (window.timeUtils && window.timeUtils.formatCurrentDayWithSecondsUTC) {
            return window.timeUtils.formatCurrentDayWithSecondsUTC(currentDay, currentDate);
        }
        
        // Fallback
        if (currentDay === undefined || currentDay === null || isNaN(currentDay)) {
            return '0.00000';
        }
        return currentDay.toFixed(5);
    }
    
    // ОБНОВЛЕНА: Используем timeUtils
    formatDateForDateTimeInputWithSeconds(timestamp) {
        if (window.timeUtils && window.timeUtils.formatForDateTimeInputUTC) {
            return window.timeUtils.formatForDateTimeInputUTC(timestamp);
        }
        
        // Fallback
        if (!timestamp) return '';
        
        let date;
        if (typeof timestamp === 'number') {
            date = new Date(timestamp);
        } else {
            date = new Date(timestamp);
        }
        
        if (isNaN(date.getTime())) {
            return '';
        }
        
        // ВАЖНО: Используем локальное время (fallback)
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        const hours = String(date.getHours()).padStart(2, '0');
        const minutes = String(date.getMinutes()).padStart(2, '0');
        const seconds = String(date.getSeconds()).padStart(2, '0');
        
        console.log('DOM: Форматирование даты для инпута (fallback):', {
            timestamp,
            localTime: date.toString(),
            result: `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`
        });
        
        return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
    }
    
    // ОБНОВЛЕНА: Используем timeUtils
    stringFromDateTimeStringToTimestamp(dateTimeString) {
        if (window.timeUtils && window.timeUtils.parseStringToUTC) {
            const utcDate = window.timeUtils.parseStringToUTC(dateTimeString);
            return utcDate.getTime();
        }
        
        // Fallback
        try {
            if (!dateTimeString) return Date.now();
            
            let normalizedString = dateTimeString.trim();
            
            if (normalizedString.includes('T')) {
                normalizedString = normalizedString.replace('T', ' ');
            }
            
            const parts = normalizedString.split(' ');
            const datePart = parts[0];
            
            let timePart = '00:00:00';
            if (parts.length > 1) {
                timePart = parts[1];
                if (timePart.split(':').length === 2) {
                    timePart += ':00';
                }
            }
            
            const [year, month, day] = datePart.split('-').map(Number);
            const [hours, minutes, seconds] = timePart.split(':').map(Number);
            
            // Создаем Date в локальном часовом поясе (fallback)
            const date = new Date(year, month - 1, day, hours, minutes, seconds, 0);
            
            console.log('DOM: Конвертация строки в дату (fallback):', {
                input: dateTimeString,
                localDate: date.toString(),
                timestamp: date.getTime()
            });
            
            if (isNaN(date.getTime())) {
                throw new Error('Некорректная дата-время');
            }
            return date.getTime();
        } catch (error) {
            console.error('Ошибка преобразования строки в timestamp:', error);
            return Date.now();
        }
    }
    
    // Старый метод для обратной совместимости
    formatDateForDateTimeInput(timestamp) {
        return this.formatDateForDateTimeInputWithSeconds(timestamp);
    }
    
    // ОБНОВЛЕНА: Используем timeUtils
    formatDateForInput(timestamp) {
        if (window.timeUtils && window.timeUtils.formatForDateInputUTC) {
            return window.timeUtils.formatForDateInputUTC(timestamp);
        }
        
        // Fallback
        if (!timestamp) return '';
        
        let date;
        if (typeof timestamp === 'number') {
            date = new Date(timestamp);
        } else {
            date = new Date(timestamp);
        }
        
        if (isNaN(date.getTime())) {
            return '';
        }
        
        return date.toISOString().split('T')[0];
    }
    
    // ОБНОВЛЕНА: Используем timeUtils
    getYearsBetweenDates(timestamp1, timestamp2) {
        if (window.timeUtils && window.timeUtils.getYearsBetweenUTC) {
            return window.timeUtils.getYearsBetweenUTC(timestamp1, timestamp2);
        }
        
        // Fallback
        if (!timestamp1 || !timestamp2) return 0;
        
        let date1, date2;
        
        try {
            date1 = typeof timestamp1 === 'number' ? new Date(timestamp1) : new Date(timestamp1);
            date2 = typeof timestamp2 === 'number' ? new Date(timestamp2) : new Date(timestamp2);
            
            if (isNaN(date1.getTime()) || isNaN(date2.getTime())) {
                return 0;
            }
            const diffMs = Math.abs(date2.getTime() - date1.getTime());
            const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
            const diffYears = Math.floor(diffDays / 365.25);
            return diffYears;
        } catch (e) {
            console.error('Error parsing dates:', e);
            return 0;
        }
    }
    
    // ОБНОВЛЕНА: Используем timeUtils
    getWeekday(date) {
        if (window.timeUtils && window.timeUtils.getWeekdayUTC) {
            return window.timeUtils.getWeekdayUTC(date);
        }
        
        // Fallback
        let dateObj;
        if (typeof date === 'number') {
            dateObj = new Date(date);
        } else if (date instanceof Date) {
            dateObj = date;
        } else {
            dateObj = new Date(date);
        }
        return dateObj.getDay();
    }
    
    // ОБНОВЛЕНА: Используем timeUtils
    getWeekdayName(date, full = false) {
        if (window.timeUtils && window.timeUtils.getWeekdayNameUTC) {
            return window.timeUtils.getWeekdayNameUTC(date, full);
        }
        
        // Fallback
        let dateObj;
        if (typeof date === 'number') {
            dateObj = new Date(date);
        } else if (date instanceof Date) {
            dateObj = date;
        } else {
            dateObj = new Date(date);
        }
        const weekday = this.getWeekday(dateObj);
        return full ? window.appState.config.weekdaysFull[weekday] : window.appState.config.weekdays[weekday];
    }
    
    getWaveStyle(type) {
        return type;
    }
    
    getWaveDescription(type) {
        const descriptions = {
            'solid': 'сплошная линия',
            'dashed': 'пунктирная линия',
            'dotted': 'точечная линия',
            'zigzag': 'зигзагообразная линия',
            'dash-dot': 'штрих-линия',
            'long-dash': 'длинный штрих'
        };
        return descriptions[type] || 'неизвестный тип';
    }
    
    // ОБНОВЛЕНА: Используем timeUtils
    getDaysBetweenDates(date1, date2) {
        if (window.timeUtils && window.timeUtils.getDaysBetweenUTC) {
            return window.timeUtils.getDaysBetweenUTC(date1, date2);
        }
        
        // Fallback
        let d1, d2;
        
        if (typeof date1 === 'number') {
            d1 = new Date(date1);
        } else if (date1 instanceof Date) {
            d1 = date1;
        } else {
            d1 = new Date(date1);
        }
        
        if (typeof date2 === 'number') {
            d2 = new Date(date2);
        } else if (date2 instanceof Date) {
            d2 = date2;
        } else {
            d2 = new Date(date2);
        }
        
        const utc1 = Date.UTC(d1.getFullYear(), d1.getMonth(), d1.getDate());
        const utc2 = Date.UTC(d2.getFullYear(), d2.getMonth(), d2.getDate());
        return Math.floor((utc2 - utc1) / (1000 * 60 * 60 * 24));
    }
    
    getCurrentDate() {
        // ЗАМЕНА: Используем timeUtils для получения UTC
        if (window.timeUtils && window.timeUtils.nowUTC) {
            return window.timeUtils.nowUTC();
        }
        
        // Fallback
        return new Date();
    }
    
    // Старый метод для обратной совместимости
    stringFromDateTimeLocalToTimestamp(dateTimeString) {
        return this.stringFromDateTimeStringToTimestamp(dateTimeString);
    }
    
    stringToTimestamp(dateString) {
        // ЗАМЕНА: Используем timeUtils
        if (window.timeUtils && window.timeUtils.parseStringToUTC) {
            const utcDate = window.timeUtils.parseStringToUTC(dateString);
            return utcDate.getTime();
        }
        
        // Fallback
        try {
            const date = new Date(dateString);
            if (isNaN(date.getTime())) {
                throw new Error('Некорректная дата');
            }
            return date.getTime();
        } catch (error) {
            console.error('Ошибка преобразования строки в timestamp:', error);
            return Date.now();
        }
    }
    
    isTimestamp(value) {
        return window.timeUtils ? window.timeUtils.isTimestamp(value) : 
            (typeof value === 'number' && !isNaN(value) && value > 0);
    }
    
    // НОВЫЙ МЕТОД: Получить начало дня в UTC
    getStartOfDayUTC(timestamp) {
        if (window.timeUtils && window.timeUtils.getStartOfDayUTC) {
            return window.timeUtils.getStartOfDayUTC(timestamp);
        }
        
        // Fallback
        const date = new Date(timestamp);
        return new Date(Date.UTC(
            date.getUTCFullYear(),
            date.getUTCMonth(),
            date.getUTCDate(),
            0, 0, 0, 0
        ));
    }
    
    // НОВЫЙ МЕТОД: Получить разницу в днях с дробной частью (UTC)
    getDaysBetweenExact(date1, date2) {
        if (window.timeUtils && window.timeUtils.getDaysBetweenExactUTC) {
            return window.timeUtils.getDaysBetweenExactUTC(date1, date2);
        }
        
        // Fallback
        let d1, d2;
        
        if (typeof date1 === 'number') {
            d1 = new Date(date1);
        } else if (date1 instanceof Date) {
            d1 = date1;
        } else {
            d1 = new Date(date1);
        }
        
        if (typeof date2 === 'number') {
            d2 = new Date(date2);
        } else if (date2 instanceof Date) {
            d2 = date2;
        } else {
            d2 = new Date(date2);
        }
        
        const timeDiff = d2.getTime() - d1.getTime();
        return timeDiff / (1000 * 60 * 60 * 24);
    }
}

window.dom = new DOM();