class DOM {
    constructor() {
        this.elements = {};
        this.cacheElements();
    }

    formatDate(timestamp) {
        return window.timeUtils.formatDate(timestamp);
    }
    
    formatDateTimeFull(timestamp) {
        return window.timeUtils.formatDateTime(timestamp);
    }
    
    formatCurrentDayWithSeconds(currentDay, currentDate = null) {
        return window.timeUtils.formatCurrentDayWithSeconds(currentDay, currentDate);
    }
    
    formatDateForDateTimeInputWithSeconds(timestamp) {
        return window.timeUtils.formatForDateTimeInput(timestamp);
    }
    
    getDaysBetweenDates(date1, date2) {
        return window.timeUtils.getDaysBetween(date1, date2);
    }
    
	getWeekday(date) {
		return window.timeUtils ? window.timeUtils.getWeekday(date) : new Date(date).getDay();
	}

	getWeekdayName(date, full = false) {
		if (window.timeUtils) {
			return window.timeUtils.getWeekdayName(date, full);
		}
		
		const d = new Date(date);
		const weekdays = full ? 
			['Воскресенье', 'Понедельник', 'Вторник', 'Среда', 'Четверг', 'Пятница', 'Суббота'] :
			['Вс', 'Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб'];
		return weekdays[d.getDay()];
	}

	getDaysBetweenExact(date1, date2) {
		return this.getDaysBetweenDates(date1, date2);
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
    
    stringFromDateTimeStringToTimestamp(dateTimeString) {
        if (window.timeUtils) {
            const date = window.timeUtils.parseStringToLocal(dateTimeString);
            return date.getTime();
        }
        
        try {
            if (!dateTimeString) return Date.now();
            
            let normalized = dateTimeString.trim();
            if (normalized.includes('T')) {
                normalized = normalized.replace('T', ' ');
            }
            
            const parts = normalized.split(' ');
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
            
            const date = new Date(year, month - 1, day, hours, minutes, seconds, 0);
            
            if (isNaN(date.getTime())) {
                return Date.now();
            }
            return date.getTime();
        } catch (error) {
            return Date.now();
        }
    }
    
    formatDateForInput(timestamp) {
        if (window.timeUtils && window.timeUtils.formatForDateInput) {
            return window.timeUtils.formatForDateInput(timestamp);
        }
        
        if (!timestamp) return '';
        const date = new Date(timestamp);
        if (isNaN(date.getTime())) return '';
        return date.toISOString().split('T')[0];
    }
    
    getYearsBetweenDates(timestamp1, timestamp2) {
        if (window.timeUtils && window.timeUtils.getYearsBetween) {
            return window.timeUtils.getYearsBetween(timestamp1, timestamp2);
        }
        
        if (!timestamp1 || !timestamp2) return 0;
        try {
            const date1 = new Date(timestamp1);
            const date2 = new Date(timestamp2);
            
            if (isNaN(date1.getTime()) || isNaN(date2.getTime())) return 0;
            const diffMs = Math.abs(date2.getTime() - date1.getTime());
            const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
            const diffYears = Math.floor(diffDays / 365.25);
            return diffYears;
        } catch (e) {
            return 0;
        }
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
    
    getCurrentDate() {
        return new Date();
    }
    
    stringToTimestamp(dateString) {
        if (window.timeUtils) {
            const date = window.timeUtils.parseStringToLocal(dateString);
            return date.getTime();
        }
        
        try {
            const date = new Date(dateString);
            if (isNaN(date.getTime())) {
                return Date.now();
            }
            return date.getTime();
        } catch (error) {
            return Date.now();
        }
    }
    
    isTimestamp(value) {
        return window.timeUtils ? window.timeUtils.isTimestamp(value) : 
            (typeof value === 'number' && !isNaN(value) && value > 0);
    }
    
    getStartOfDayLocal(timestamp) {
        if (window.timeUtils && window.timeUtils.getStartOfDay) {
            return window.timeUtils.getStartOfDay(timestamp);
        }
        
        const date = new Date(timestamp);
        return new Date(date.getFullYear(), date.getMonth(), date.getDate(), 0, 0, 0, 0);
    }
}

window.dom = new DOM();