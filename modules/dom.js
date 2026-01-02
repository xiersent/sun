// modules/dom.js
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
    
    // НОВАЯ ФУНКЦИЯ: Полное форматирование даты и времени в одну строку
    formatDateTimeFull(timestamp) {
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
    formatCurrentDayWithSeconds(currentDay) {
        if (currentDay === undefined || currentDay === null || isNaN(currentDay)) {
            return '0.00000';
        }
        
        // Форматируем с 5 знаками после запятой для отображения секунд
        // 1 день = 86400 секунд, 1 секунда ≈ 0.000011574 дней
        // 5 знаков после запятой ≈ точность до 0.0864 секунды
        return currentDay.toFixed(5);
    }
    
formatDateForDateTimeInputWithSeconds(timestamp) {
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
    
    // ВАЖНО: Используем локальное время, а не UTC
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    const seconds = String(date.getSeconds()).padStart(2, '0');
    
    // ДЕБАГ: Выводим для проверки
    console.log('DOM: Форматирование даты для инпута:', {
        timestamp,
        localTime: date.toString(),
        year, month, day, hours, minutes, seconds,
        result: `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`
    });
    
    return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
}
    
stringFromDateTimeStringToTimestamp(dateTimeString) {
    try {
        if (!dateTimeString) return Date.now();
        
        // Поддерживаем несколько форматов:
        // 1. YYYY-MM-DD HH:mm:ss
        // 2. YYYY-MM-DD HH:mm
        // 3. YYYY-MM-DD
        // 4. datetime-local формат (YYYY-MM-DDTHH:mm)
        
        let normalizedString = dateTimeString.trim();
        
        // Если есть T (datetime-local формат), заменяем пробелом
        if (normalizedString.includes('T')) {
            normalizedString = normalizedString.replace('T', ' ');
        }
        
        // Разбиваем на дату и время
        const parts = normalizedString.split(' ');
        const datePart = parts[0];
        
        let timePart = '00:00:00'; // По умолчанию
        if (parts.length > 1) {
            timePart = parts[1];
            // Добавляем секунды если их нет
            if (timePart.split(':').length === 2) {
                timePart += ':00';
            }
        }
        
        const [year, month, day] = datePart.split('-').map(Number);
        const [hours, minutes, seconds] = timePart.split(':').map(Number);
        
        // ВАЖНО: Создаем Date в локальном часовом поясе
        const date = new Date(year, month - 1, day, hours, minutes, seconds, 0);
        
        // ДЕБАГ: Выводим для проверки
        console.log('DOM: Конвертация строки в дату:', {
            input: dateTimeString,
            year, month, day,
            hours, minutes, seconds,
            localDate: date.toString(),
            utcDate: date.toUTCString(),
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
    
    formatDateForInput(timestamp) {
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
    
    getYearsBetweenDates(timestamp1, timestamp2) {
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
    
    getWeekday(date) {
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
    
    getWeekdayName(date, full = false) {
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
    
    getDaysBetweenDates(date1, date2) {
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
        return new Date();
    }
    
    // Старый метод для обратной совместимости
    stringFromDateTimeLocalToTimestamp(dateTimeString) {
        return this.stringFromDateTimeStringToTimestamp(dateTimeString);
    }
    
    stringToTimestamp(dateString) {
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
        return typeof value === 'number' && !isNaN(value) && value > 0;
    }
}

window.dom = new DOM();