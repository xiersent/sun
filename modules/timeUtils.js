// modules/timeUtils.js - ПОЛНОСТЬЮ ПЕРЕПИСАННЫЙ
/**
 * Утилиты для работы со временем в UTC
 * ВСЕ методы возвращают UTC timestamp или UTC Date
 */
class TimeUtils {
    constructor() {
        // НЕ используем авто-коррекцию часового пояса
        // Всегда работаем с чистым UTC
        this.autoCorrectionEnabled = false;
        console.log('TimeUtils: режим UTC без коррекции часовых поясов');
    }
    
    /**
     * ТЕПЕРЬ ПРОСТО И ЯСНО:
     * 1. Всегда работаем с UTC
     * 2. Не пытаемся "корректировать" часовые пояса
     * 3. Парсим строки как UTC
     */
    
    /**
     * Получает текущее время в UTC
     * @returns {Date} Date объект в UTC
     */
    nowUTC() {
        const now = new Date();
        return new Date(Date.UTC(
            now.getUTCFullYear(),
            now.getUTCMonth(),
            now.getUTCDate(),
            now.getUTCHours(),
            now.getUTCMinutes(),
            now.getUTCSeconds(),
            now.getUTCMilliseconds()
        ));
    }

	/**
	 * Получает начало дня (00:00:00) в UTC для указанной даты
	 * @param {Date|number} date - Дата
	 * @returns {Date} Начало дня в UTC
	 */
	getStartOfDayUTC(date) {
		const d = date instanceof Date ? date : new Date(date);
		return new Date(Date.UTC(
			d.getUTCFullYear(),
			d.getUTCMonth(),
			d.getUTCDate(),
			0, 0, 0, 0
		));
	}

	/**
	 * Вычисляет разницу в днях между двумя датами (целые дни)
	 * @param {Date|number} date1 - Первая дата
	 * @param {Date|number} date2 - Вторая дата
	 * @returns {number} Разница в днях (целое число)
	 */
	getDaysBetweenUTC(date1, date2) {
		const d1 = date1 instanceof Date ? date1 : new Date(date1);
		const d2 = date2 instanceof Date ? date2 : new Date(date2);
		
		// Приводим к началу дня в UTC
		const utc1 = Date.UTC(d1.getUTCFullYear(), d1.getUTCMonth(), d1.getUTCDate());
		const utc2 = Date.UTC(d2.getUTCFullYear(), d2.getUTCMonth(), d2.getUTCDate());
		
		return Math.floor((utc2 - utc1) / (1000 * 60 * 60 * 24));
	}

	/**
	 * Форматирует текущий день с дробной частью (для секунд) в UTC
	 * @param {number} currentDay - Текущий день
	 * @param {Date} currentDate - Текущая дата (для расчета дробной части)
	 * @returns {string} Отформатированный день
	 */
	formatCurrentDayWithSecondsUTC(currentDay, currentDate) {
		if (currentDay === undefined || currentDay === null || isNaN(currentDay)) {
			return '0.00000';
		}
		
		// Если передана currentDate, пересчитываем дробную часть из UTC времени
		if (currentDate) {
			const d = currentDate instanceof Date ? currentDate : new Date(currentDate);
			const utcHours = d.getUTCHours();
			const utcMinutes = d.getUTCMinutes();
			const utcSeconds = d.getUTCSeconds();
			const utcMilliseconds = d.getUTCMilliseconds();
			
			// Дробная часть дня из UTC времени
			const fractionalDay = (utcHours * 3600 + utcMinutes * 60 + utcSeconds + utcMilliseconds / 1000) / 86400;
			const totalDay = Math.floor(currentDay) + fractionalDay;
			
			return totalDay.toFixed(5);
		}
		
		return currentDay.toFixed(5);
	}

	/**
	 * Получает день недели в UTC (0-воскресенье, 6-суббота)
	 * @param {Date|number} date - Дата
	 * @returns {number} День недели (0-6)
	 */
	getWeekdayUTC(date) {
		const d = date instanceof Date ? date : new Date(date);
		return d.getUTCDay();
	}

	/**
	 * Получает название дня недели в UTC
	 * @param {Date|number} date - Дата
	 * @param {boolean} full - Полное название (true) или сокращенное (false)
	 * @returns {string} Название дня недели
	 */
	getWeekdayNameUTC(date, full = false) {
		const weekday = this.getWeekdayUTC(date);
		const weekdays = full ? 
			['Воскресенье', 'Понедельник', 'Вторник', 'Среда', 'Четверг', 'Пятница', 'Суббота'] :
			['Вс', 'Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб'];
		return weekdays[weekday];
	}
    
    /**
     * Получает текущее время как UTC timestamp
     * @returns {number} UTC timestamp
     */
    nowTimestamp() {
        return this.nowUTC().getTime();
    }
    
    /**
     * Конвертирует ЛЮБОЕ значение в UTC Date
     * Без коррекции часовых поясов, просто гарантия UTC
     */
    toUTC(date) {
        if (!date) return this.nowUTC();
        
        let dateObj;
        
        if (date instanceof Date) {
            dateObj = date;
        } else if (typeof date === 'number') {
            dateObj = new Date(date);
        } else if (typeof date === 'string') {
            dateObj = this.parseStringToUTC(date);
        } else {
            return this.nowUTC();
        }
        
        // Гарантируем, что это UTC Date
        return new Date(Date.UTC(
            dateObj.getUTCFullYear(),
            dateObj.getUTCMonth(),
            dateObj.getUTCDate(),
            dateObj.getUTCHours(),
            dateObj.getUTCMinutes(),
            dateObj.getUTCSeconds(),
            dateObj.getUTCMilliseconds()
        ));
    }
    
    /**
     * Парсит строку как UTC
     * Ключевое исправление: всегда парсим как UTC
     */
    parseStringToUTC(dateTimeString) {
        if (!dateTimeString) return this.nowUTC();
        
        try {
            // Нормализуем строку
            let normalized = dateTimeString.trim();
            
            // Если нет 'Z' и нет часового пояса, добавляем 'Z' для UTC
            if (!normalized.endsWith('Z') && !normalized.includes('+')) {
                // Заменяем пробел на 'T' и добавляем 'Z'
                normalized = normalized.replace(' ', 'T') + 'Z';
            }
            
            // Парсим как UTC
            const date = new Date(normalized);
            
            if (isNaN(date.getTime())) {
                throw new Error('Некорректная дата');
            }
            
            // Возвращаем как UTC Date
            return new Date(Date.UTC(
                date.getUTCFullYear(),
                date.getUTCMonth(),
                date.getUTCDate(),
                date.getUTCHours(),
                date.getUTCMinutes(),
                date.getUTCSeconds(),
                date.getUTCMilliseconds()
            ));
            
        } catch (error) {
            console.error('Ошибка парсинга даты:', dateTimeString, error);
            return this.nowUTC();
        }
    }
    
    /**
     * Форматирует timestamp для input[type="datetime-local"]
     * Возвращает строку в локальном времени (только для отображения)
     */
    formatForDateTimeInputUTC(timestamp) {
        if (!timestamp) return '';
        
        const date = new Date(timestamp);
        
        // Важно: для input используем локальное время
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        const hours = String(date.getHours()).padStart(2, '0');
        const minutes = String(date.getMinutes()).padStart(2, '0');
        const seconds = String(date.getSeconds()).padStart(2, '0');
        
        return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
    }
    
    /**
     * Парсит строку из input в UTC timestamp
     * Предполагаем, что пользователь вводит локальное время
     */
    parseFromDateTimeInput(inputString) {
        if (!inputString) return this.nowTimestamp();
        
        try {
            // Пользователь вводит в своем локальном времени
            const localDate = new Date(inputString.replace(' ', 'T'));
            
            // Конвертируем в UTC
            return Date.UTC(
                localDate.getFullYear(),
                localDate.getMonth(),
                localDate.getDate(),
                localDate.getHours(),
                localDate.getMinutes(),
                localDate.getSeconds(),
                localDate.getMilliseconds()
            );
            
        } catch (error) {
            console.error('Ошибка парсинга input:', inputString, error);
            return this.nowTimestamp();
        }
    }
    
    /**
     * Устаревшие методы - ДЛЯ УДАЛЕНИЯ
     */
    
    // УДАЛИТЬ ЭТОТ МЕТОД - он вносит путаницу
    forceUTC(date) {
        console.warn('forceUTC устарел, используйте toUTC()');
        return this.toUTC(date);
    }
    
    // УДАЛИТЬ - не нужно коррекции
    setAutoCorrection(enabled) {
        console.warn('Автокоррекция часовых поясов отключена');
        this.autoCorrectionEnabled = false;
    }
    
    /**
     * Статические методы для обратной совместимости
     */
    static nowUTC() {
        return window.timeUtils.nowUTC();
    }
    
    static toUTC(date) {
        return window.timeUtils.toUTC(date);
    }
    
    static parseStringToUTC(dateTimeString) {
        return window.timeUtils.parseStringToUTC(dateTimeString);
    }
    
    static formatForDateTimeInputUTC(timestamp) {
        return window.timeUtils.formatForDateTimeInputUTC(timestamp);
    }
    
    static parseFromDateTimeInput(inputString) {
        return window.timeUtils.parseFromDateTimeInput(inputString);
    }

}

window.timeUtils = new TimeUtils();