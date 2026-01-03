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
    
	// modules/timeUtils.js - ПОЛНЫЙ МЕТОД parseStringToLocal
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

	/**
	 * Форматирует текущий день с секундами
	 * @param {number} currentDay - Текущий день (дробное число)
	 * @param {Date} [currentDate] - Текущая дата
	 * @returns {string} Отформатированная строка
	 */
	formatCurrentDayWithSeconds(currentDay, currentDate = null) {
		try {
			// Просто возвращаем число с 5 знаками после запятой
			// УБРАЛИ добавление времени в скобках
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
    
}
window.timeUtils = new TimeUtils();