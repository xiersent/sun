// modules/timeUtils.js - ПОЛНОСТЬЮ ИСПРАВЛЕННЫЙ И УПРОЩЕННЫЙ
/**
 * Утилиты для работы со временем ТОЛЬКО в UTC
 * ВСЕ методы возвращают UTC timestamp или UTC Date
 * НЕТ часовых поясов, НЕТ локального времени
 */
class TimeUtils {
    constructor() {
        console.log('TimeUtils: режим UTC - все даты в UTC, все вычисления в UTC');
        this.DAY_MS = 24 * 60 * 60 * 1000; // Миллисекунд в дне
    }
    
    // ================ БАЗОВЫЕ МЕТОДЫ ================
    
    /**
     * Текущее время в UTC
     * @returns {Date} Date объект в UTC
     */
    nowUTC() {
        return new Date(Date.now());
    }
    
    /**
     * Текущее время как UTC timestamp
     * @returns {number} UTC timestamp
     */
    nowTimestamp() {
        return Date.now();
    }
    
    /**
     * Приводит ЛЮБОЕ значение к UTC Date
     * @param {Date|number|string} date - Дата в любом формате
     * @returns {Date} UTC Date
     */
    toUTC(date) {
        if (!date) return this.nowUTC();
        
        if (date instanceof Date) {
            return new Date(date.getTime());
        }
        
        if (typeof date === 'number') {
            return new Date(date);
        }
        
        if (typeof date === 'string') {
            return this.parseStringToUTC(date);
        }
        
        return this.nowUTC();
    }
    
    // ================ ПАРСИНГ И ФОРМАТИРОВАНИЕ ================
    
    /**
     * Парсит строку в UTC Date
     * Форматы: 
     * - "2024-01-15 14:30:00" (локальное время пользователя)
     * - "2024-01-15T14:30:00Z" (уже UTC)
     * - "2024-01-15" (без времени = 00:00:00)
     * 
     * @param {string} dateTimeString - Строка с датой и временем
     * @returns {Date} UTC Date
     */
    parseStringToUTC(dateTimeString) {
        if (!dateTimeString) return this.nowUTC();
        
        try {
            // Нормализуем строку
            let normalized = dateTimeString.trim();
            
            // Если есть пробел, заменяем на 'T'
            if (normalized.includes(' ') && !normalized.includes('T')) {
                normalized = normalized.replace(' ', 'T');
            }
            
            // Если нет часового пояса, добавляем 'Z' (UTC)
            if (!normalized.endsWith('Z') && !normalized.includes('+')) {
                normalized += 'Z';
            }
            
            const date = new Date(normalized);
            
            if (isNaN(date.getTime())) {
                throw new Error(`Некорректная дата: "${dateTimeString}"`);
            }
            
            return date;
            
        } catch (error) {
            console.error('Ошибка парсинга даты:', dateTimeString, error);
            return this.nowUTC();
        }
    }
    
    /**
     * Парсит строку из input[type="datetime-local"]
     * Пользователь вводит в ЛОКАЛЬНОМ времени
     * Мы конвертируем в UTC
     * 
     * @param {string} inputString - "YYYY-MM-DD HH:MM:SS"
     * @returns {number} UTC timestamp
     */
    parseFromDateTimeInput(inputString) {
        if (!inputString) return this.nowTimestamp();
        
        try {
            // Пользователь вводит в локальном времени
            // Пример: "2024-01-15 14:30:00"
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
            
            // ВАЖНО: Создаем Date в UTC из локальных значений
            // Date.UTC() автоматически конвертирует в UTC
            return Date.UTC(year, month - 1, day, hours, minutes, seconds);
            
        } catch (error) {
            console.error('Ошибка парсинга input:', inputString, error);
            return this.nowTimestamp();
        }
    }
    
    /**
     * Форматирует timestamp для input[type="datetime-local"]
     * Показываем пользователю в ЛОКАЛЬНОМ времени
     * 
     * @param {number} timestamp - UTC timestamp
     * @returns {string} "YYYY-MM-DD HH:MM:SS" (локальное время)
     */
    formatForDateTimeInputUTC(timestamp) {
        if (!timestamp) return '';
        
        const date = new Date(timestamp);
        
        // Используем локальные геттеры для отображения
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
     * @returns {string} "DD.MM.YYYY" (UTC день)
     */
    formatDateUTC(date) {
        const d = this.toUTC(date);
        const day = String(d.getUTCDate()).padStart(2, '0');
        const month = String(d.getUTCMonth() + 1).padStart(2, '0');
        const year = d.getUTCFullYear();
        return `${day}.${month}.${year}`;
    }
    
    /**
     * Форматирует дату и время
     * @param {Date|number} date - Дата
     * @returns {string} "DD.MM.YYYY HH:MM:SS" (UTC время)
     */
    formatDateTimeUTC(date) {
        const d = this.toUTC(date);
        const day = String(d.getUTCDate()).padStart(2, '0');
        const month = String(d.getUTCMonth() + 1).padStart(2, '0');
        const year = d.getUTCFullYear();
        const hours = String(d.getUTCHours()).padStart(2, '0');
        const minutes = String(d.getUTCMinutes()).padStart(2, '0');
        const seconds = String(d.getUTCSeconds()).padStart(2, '0');
        return `${day}.${month}.${year} ${hours}:${minutes}:${seconds}`;
    }
    
    /**
     * Форматирует дату для input[type="date"]
     * @param {Date|number} date - Дата
     * @returns {string} "YYYY-MM-DD" (UTC день)
     */
    formatForDateInputUTC(date) {
        const d = this.toUTC(date);
        const year = d.getUTCFullYear();
        const month = String(d.getUTCMonth() + 1).padStart(2, '0');
        const day = String(d.getUTCDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
    }
    
    // ================ ВЫЧИСЛЕНИЯ ================
    
    /**
     * Начало дня (00:00:00.000) в UTC
     * @param {Date|number} date - Дата
     * @returns {Date} Начало дня в UTC
     */
    getStartOfDayUTC(date) {
        const d = this.toUTC(date);
        return new Date(Date.UTC(
            d.getUTCFullYear(),
            d.getUTCMonth(),
            d.getUTCDate(),
            0, 0, 0, 0
        ));
    }
    
    /**
     * Разница в днях между двумя датами (целые дни)
     * Использует начало дня в UTC
     * 
     * @param {Date|number} date1 - Первая дата
     * @param {Date|number} date2 - Вторая дата
     * @returns {number} Целое количество дней
     */
    getDaysBetweenUTC(date1, date2) {
        const d1 = this.getStartOfDayUTC(date1);
        const d2 = this.getStartOfDayUTC(date2);
        
        const diffMs = d2.getTime() - d1.getTime();
        return Math.floor(diffMs / this.DAY_MS);
    }
    
    /**
     * ТОЧНАЯ разница в днях между двумя датами (дробная)
     * Использует точное время
     * 
     * @param {Date|number} date1 - Первая дата
     * @param {Date|number} date2 - Вторая дата
     * @returns {number} Дробное количество дней
     */
    getDaysBetweenExactUTC(date1, date2) {
        const d1 = this.toUTC(date1);
        const d2 = this.toUTC(date2);
        
        const diffMs = d2.getTime() - d1.getTime();
        return diffMs / this.DAY_MS;
    }
    
    /**
     * Форматирует текущий день с дробной частью
     * Показывает 5 знаков после запятой (точность до секунды)
     * 
     * @param {number} currentDay - Текущий день (дробный)
     * @param {Date} [currentDate] - Текущая дата для верификации
     * @returns {string} "ДД.ДДДДД"
     */
    formatCurrentDayWithSecondsUTC(currentDay, currentDate = null) {
        if (currentDay === undefined || currentDay === null || isNaN(currentDay)) {
            return '0.00000';
        }
        
        // Проверяем согласованность с currentDate
        if (currentDate) {
            const calculatedDay = this.getDaysBetweenExactUTC(
                window.appState.baseDate,
                currentDate
            );
            
            const diff = Math.abs(calculatedDay - currentDay);
            if (diff > 0.00001) { // Расхождение более 0.86 секунды
                console.warn('TimeUtils: расхождение currentDay!', {
                    currentDay: currentDay,
                    calculated: calculatedDay,
                    diff: diff
                });
            }
        }
        
        // Форматируем с 5 знаками после запятой
        return currentDay.toFixed(5);
    }
    
    // ================ ДНИ НЕДЕЛИ ================
    
    /**
     * День недели в UTC (0-воскресенье, 6-суббота)
     * @param {Date|number} date - Дата
     * @returns {number} 0-6
     */
    getWeekdayUTC(date) {
        const d = this.toUTC(date);
        return d.getUTCDay();
    }
    
    /**
     * Название дня недели
     * @param {Date|number} date - Дата
     * @param {boolean} full - Полное название?
     * @returns {string} Название дня
     */
    getWeekdayNameUTC(date, full = false) {
        const weekday = this.getWeekdayUTC(date);
        const weekdays = full ? 
            ['Воскресенье', 'Понедельник', 'Вторник', 'Среда', 'Четверг', 'Пятница', 'Суббота'] :
            ['Вс', 'Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб'];
        return weekdays[weekday];
    }
    
    // ================ РАЗНИЦА В ГОДАХ ================
    
    /**
     * Разница в годах между датами
     * @param {Date|number} date1 - Первая дата
     * @param {Date|number} date2 - Вторая дата
     * @returns {number} Целое количество лет
     */
    getYearsBetweenUTC(date1, date2) {
        const d1 = this.toUTC(date1);
        const d2 = this.toUTC(date2);
        
        const diffDays = Math.abs(this.getDaysBetweenExactUTC(d1, d2));
        return Math.floor(diffDays / 365.25);
    }
    
    // ================ ВАЛИДАЦИЯ ================
    
    /**
     * Проверяет, является ли значение timestamp
     * @param {any} value - Значение для проверки
     * @returns {boolean} true если это корректный timestamp
     */
    isTimestamp(value) {
        return typeof value === 'number' && 
               !isNaN(value) && 
               value > 0 && 
               value < Number.MAX_SAFE_INTEGER;
    }
    
    /**
     * Проверяет согласованность дат в приложении
     * Логирует предупреждения при несоответствиях
     */
    validateDateConsistency() {
        if (!window.appState) return;
        
        const { currentDate, baseDate, currentDay } = window.appState;
        
        // Проверяем currentDay
        const calculatedCurrentDay = this.getDaysBetweenExactUTC(baseDate, currentDate);
        const diff = Math.abs(calculatedCurrentDay - (currentDay || 0));
        
        if (diff > 0.00001) { // Более 0.86 секунды
            console.error('TimeUtils: НЕСОГЛАСОВАННОСТЬ ДАТ!', {
                baseDate: new Date(baseDate).toUTCString(),
                currentDate: currentDate.toUTCString(),
                storedCurrentDay: currentDay,
                calculatedCurrentDay: calculatedCurrentDay,
                diffDays: diff,
                diffSeconds: Math.round(diff * 86400)
            });
            
            return false;
        }
        
        console.log('TimeUtils: даты согласованы', {
            currentDay: currentDay,
            calculated: calculatedCurrentDay.toFixed(5),
            diff: diff.toFixed(8)
        });
        
        return true;
    }
    
    // ================ УТИЛИТЫ ДЛЯ ПРИЛОЖЕНИЯ ================
    
    /**
     * Получает время из строки или timestamp
     * Универсальный метод для использования в приложении
     * 
     * @param {string|number|Date} value - Значение времени
     * @returns {number} UTC timestamp
     */
    getTimestamp(value) {
        if (!value) return this.nowTimestamp();
        
        if (this.isTimestamp(value)) {
            return value;
        }
        
        if (typeof value === 'string') {
            return this.parseStringToUTC(value).getTime();
        }
        
        if (value instanceof Date) {
            return value.getTime();
        }
        
        return this.nowTimestamp();
    }
    
    /**
     * Получает Date объект из любого значения
     * @param {any} value - Значение
     * @returns {Date} UTC Date
     */
    getDate(value) {
        return this.toUTC(value);
    }
}

window.timeUtils = new TimeUtils();

// ДЕМОНСТРАЦИЯ И ТЕСТЫ
window.testTimeUtils = function() {
    console.log('=== ТЕСТ TimeUtils ===');
    
    const tests = [
        {
            name: 'Текущее время',
            test: () => {
                const now = window.timeUtils.nowUTC();
                console.log('nowUTC():', now.toUTCString());
                console.log('nowTimestamp():', window.timeUtils.nowTimestamp());
                return true;
            }
        },
        {
            name: 'Парсинг строки',
            test: () => {
                const testString = '2024-01-15 14:30:00';
                const utcDate = window.timeUtils.parseStringToUTC(testString);
                console.log(`Парсинг "${testString}":`, utcDate.toUTCString());
                
                // Проверяем, что это действительно UTC
                const localDate = new Date(testString);
                console.log('Локальное время:', localDate.toString());
                console.log('Разница (часов):', (localDate.getTime() - utcDate.getTime()) / (1000 * 60 * 60));
                return true;
            }
        },
        {
            name: 'Форматирование для input',
            test: () => {
                const timestamp = Date.UTC(2024, 0, 15, 14, 30, 0); // 15.01.2024 14:30:00 UTC
                const formatted = window.timeUtils.formatForDateTimeInputUTC(timestamp);
                console.log('Форматирование timestamp:', {
                    timestamp: timestamp,
                    formatted: formatted,
                    ожидание: '2024-01-15 14:30:00 (локальное время)'
                });
                return true;
            }
        },
        {
            name: 'Разница в днях',
            test: () => {
                const date1 = new Date(Date.UTC(2024, 0, 1, 0, 0, 0));
                const date2 = new Date(Date.UTC(2024, 0, 15, 14, 30, 0));
                
                const daysExact = window.timeUtils.getDaysBetweenExactUTC(date1, date2);
                const daysWhole = window.timeUtils.getDaysBetweenUTC(date1, date2);
                
                console.log('Разница в днях:', {
                    date1: date1.toUTCString(),
                    date2: date2.toUTCString(),
                    exact: daysExact,
                    whole: daysWhole,
                    часов: Math.round((daysExact - daysWhole) * 24)
                });
                return true;
            }
        }
    ];
    
    let allPassed = true;
    tests.forEach(testCase => {
        try {
            console.log(`\n--- ${testCase.name} ---`);
            if (!testCase.test()) {
                allPassed = false;
            }
        } catch (error) {
            console.error(`Ошибка в тесте ${testCase.name}:`, error);
            allPassed = false;
        }
    });
    
    console.log(`\n=== ТЕСТ ЗАВЕРШЕН: ${allPassed ? 'ВСЁ ОК' : 'ЕСТЬ ОШИБКИ'} ===`);
    return allPassed;
};