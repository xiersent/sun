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
    
    formatDate(date) {
        if (!date) return 'Неизвестно';
        try {
            if (!(date instanceof Date)) {
                date = new Date(date);
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
    
    formatDateForInput(date) {
        return new Date(date).toISOString().split('T')[0];
    }
    
    getYearsBetweenDates(date1, date2) {
        if (!date1 || !date2) return 0;
        if (!(date1 instanceof Date)) {
            try {
                date1 = new Date(date1);
            } catch (e) {
                console.error('Error parsing date1:', date1, e);
                return 0;
            }
        }
        if (!(date2 instanceof Date)) {
            try {
                date2 = new Date(date2);
            } catch (e) {
                console.error('Error parsing date2:', date2, e);
                return 0;
            }
        }
        if (isNaN(date1.getTime()) || isNaN(date2.getTime())) {
            return 0;
        }
        const diffMs = Math.abs(date2.getTime() - date1.getTime());
        const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
        const diffYears = Math.floor(diffDays / 365.25);
        return diffYears;
    }
    
    getWeekday(date) {
        if (!(date instanceof Date)) {
            date = new Date(date);
        }
        return date.getDay();
    }
    
    getWeekdayName(date, full = false) {
        if (!(date instanceof Date)) {
            date = new Date(date);
        }
        const weekday = this.getWeekday(date);
        return full ? window.appState.config.weekdaysFull[weekday] : window.appState.config.weekdays[weekday];
    }
    
    getWaveStyle(type) {
        return type; // Просто возвращаем тип, CSS сам добавит класс
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
        if (!(date1 instanceof Date)) {
            date1 = new Date(date1);
        }
        if (!(date2 instanceof Date)) {
            date2 = new Date(date2);
        }
        const utc1 = Date.UTC(date1.getFullYear(), date1.getMonth(), date1.getDate());
        const utc2 = Date.UTC(date2.getFullYear(), date2.getMonth(), date2.getDate());
        return Math.floor((utc2 - utc1) / (1000 * 60 * 60 * 24));
    }
    
    getCurrentDate() {
        return new Date();
    }
}

window.dom = new DOM();