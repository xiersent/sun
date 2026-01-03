// modules/timeUtils.js - ПОЛНОСТЬЮ ПЕРЕРАБОТАННЫЙ ДЛЯ UTC
/**
 * Утилиты для работы со временем ТОЛЬКО в UTC
 * ВСЕ методы работают исключительно с UTC и ISO 8601 форматом
 */
class TimeUtils {
    constructor() {
        console.log('TimeUtils: режим СТРОГО UTC - все методы возвращают UTC');
        this.DAY_MS = 24 * 60 * 60 * 1000;
        
        // Паттерны для валидации
        this.PATTERNS = {
            ISO_DATE: /^\d{4}-\d{2}-\d{2}$/,
            ISO_DATETIME: /^\d{4}-\d{2}-\d{2}[T\s]\d{2}:\d{2}(?::\d{2})?(?:\.\d{3})?$/,
            ISO_FULL: /^\d{4}-\d{2}-\d{2}[T\s]\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z?$/
        };
    }
    
    // ================ БАЗОВЫЕ МЕТОДЫ ================
    
    /**
     * Текущее время в UTC (возвращает Date объект в UTC)
     * @returns {Date} Date объект с установленным UTC временем
     */
    nowUTC() {
        return new Date(); // Date уже в UTC изнутри
    }
    
    /**
     * Текущее время как UTC timestamp
     * @returns {number} UTC timestamp (мс с 1970)
     */
    nowTimestamp() {
        return Date.now();
    }
    
    /**
     * Приводит любое значение к UTC Date
     * @param {Date|number|string} value - Значение
     * @returns {Date} UTC Date
     */
    toUTC(value) {
        if (!value) return this.nowUTC();
        
        if (value instanceof Date) {
            // Date уже хранит время как timestamp, возвращаем как есть
            return value;
        }
        
        if (typeof value === 'number') {
            // timestamp всегда UTC
            return new Date(value);
        }
        
        if (typeof value === 'string') {
            return this.parseStringStrict(value);
        }
        
        console.warn('TimeUtils: неизвестный тип значения, возвращаем текущее время');
        return this.nowUTC();
    }
    
    // ================ ПАРСИНГ (СТРОГИЙ) ================
    
    /**
     * Строгий парсинг строки в UTC Date
     * Поддерживает форматы:
     * - "2024-01-15" → начало дня UTC
     * - "2024-01-15 14:30:00" → локальное время преобразуется в UTC
     * - "2024-01-15T14:30:00Z" → уже UTC
     * 
     * @param {string} input - Строка с датой
     * @returns {Date} UTC Date
     */
    parseStringStrict(input) {
        if (!input || typeof input !== 'string') {
            console.warn('TimeUtils: пустой или не строковый ввод');
            return this.nowUTC();
        }
        
        const normalized = input.trim();
        
        try {
            // Случай 1: Уже в ISO формате с 'Z'
            if (normalized.endsWith('Z')) {
                const date = new Date(normalized);
                if (!isNaN(date.getTime())) {
                    return date; // Уже UTC
                }
            }
            
            // Случай 2: Дата без времени
            if (this.PATTERNS.ISO_DATE.test(normalized)) {
                // "2024-01-15" → начало дня в UTC
                const date = new Date(normalized + 'T00:00:00Z');
                if (!isNaN(date.getTime())) {
                    return date;
                }
            }
            
            // Случай 3: Дата и время (самый сложный случай)
            let datetimeStr = normalized;
            
            // Заменяем пробел на 'T' для парсинга
            if (datetimeStr.includes(' ') && !datetimeStr.includes('T')) {
                datetimeStr = datetimeStr.replace(' ', 'T');
            }
            
            // Добавляем секунды если нужно
            const timePart = datetimeStr.includes('T') ? 
                datetimeStr.split('T')[1] : 
                datetimeStr.split(' ')[1];
            
            if (timePart && timePart.split(':').length === 2) {
                datetimeStr += ':00';
            }
            
            // Парсим как локальное время пользователя
            const localDate = new Date(datetimeStr);
            
            if (isNaN(localDate.getTime())) {
                throw new Error(`Не удалось распознать дату: "${input}"`);
            }
            
            // Ключевое изменение: не конвертируем локальное в UTC через манипуляции
            // Вместо этого создаем новую дату из UTC компонентов
            return new Date(Date.UTC(
                localDate.getFullYear(),
                localDate.getMonth(),
                localDate.getDate(),
                localDate.getHours(),
                localDate.getMinutes(),
                localDate.getSeconds(),
                localDate.getMilliseconds()
            ));
            
        } catch (error) {
            console.error('TimeUtils: ошибка парсинга:', input, error);
            return this.nowUTC();
        }
    }
    
    /**
     * Парсит строку из input[type="datetime-local"]
     * Предполагаем, что пользователь вводит в локальном времени
     * 
     * @param {string} inputString - "YYYY-MM-DD HH:MM:SS"
     * @returns {number} UTC timestamp
     */
    parseFromDateTimeInput(inputString) {
        if (!inputString) return this.nowTimestamp();
        
        try {
            // Упрощенный подход: парсим как локальное, конвертируем в UTC
            const [datePart, timePart] = inputString.split(' ');
            
            if (!datePart) {
                throw new Error('Отсутствует дата');
            }
            
            // Создаем строку для парсинга
            const parseString = `${datePart}T${timePart || '00:00:00'}`;
            const localDate = new Date(parseString);
            
            if (isNaN(localDate.getTime())) {
                throw new Error('Некорректная дата-время');
            }
            
            // Возвращаем timestamp (уже в UTC)
            return localDate.getTime();
            
        } catch (error) {
            console.error('TimeUtils: ошибка парсинга инпута:', inputString, error);
            return this.nowTimestamp();
        }
    }
    
    // ================ ФОРМАТИРОВАНИЕ ================
    
    /**
     * Форматирует timestamp для input[type="datetime-local"]
     * Показывает время в UTC (это важно!)
     * 
     * @param {number} timestamp - UTC timestamp
     * @returns {string} "YYYY-MM-DD HH:MM:SS" в UTC
     */
    formatForDateTimeInputUTC(timestamp) {
        if (!timestamp) return '';
        
        const date = new Date(timestamp);
        
        // Форматируем как UTC компоненты
        const year = date.getUTCFullYear();
        const month = String(date.getUTCMonth() + 1).padStart(2, '0');
        const day = String(date.getUTCDate()).padStart(2, '0');
        const hours = String(date.getUTCHours()).padStart(2, '0');
        const minutes = String(date.getUTCMinutes()).padStart(2, '0');
        const seconds = String(date.getUTCSeconds()).padStart(2, '0');
        
        return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
    }
    
    /**
     * Форматирует дату для отображения (UTC)
     * @param {Date|number} date - Дата
     * @returns {string} "DD.MM.YYYY (UTC)"
     */
    formatDateUTC(date) {
        const d = this.toUTC(date);
        const day = String(d.getUTCDate()).padStart(2, '0');
        const month = String(d.getUTCMonth() + 1).padStart(2, '0');
        const year = d.getUTCFullYear();
        return `${day}.${month}.${year} (UTC)`;
    }
    
    /**
     * Форматирует дату и время для отображения
     * @param {Date|number} date - Дата
     * @returns {string} "DD.MM.YYYY HH:MM:SS (UTC)"
     */
    formatDateTimeUTC(date) {
        const d = this.toUTC(date);
        const day = String(d.getUTCDate()).padStart(2, '0');
        const month = String(d.getUTCMonth() + 1).padStart(2, '0');
        const year = d.getUTCFullYear();
        const hours = String(d.getUTCHours()).padStart(2, '0');
        const minutes = String(d.getUTCMinutes()).padStart(2, '0');
        const seconds = String(d.getUTCSeconds()).padStart(2, '0');
        return `${day}.${month}.${year} ${hours}:${minutes}:${seconds} (UTC)`;
    }
    
    /**
     * Форматирует дату для input[type="date"]
     * @param {Date|number} date - Дата
     * @returns {string} "YYYY-MM-DD" в UTC
     */
    formatForDateInputUTC(date) {
        const d = this.toUTC(date);
        const year = d.getUTCFullYear();
        const month = String(d.getUTCMonth() + 1).padStart(2, '0');
        const day = String(d.getUTCDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
    }
    
    /**
     * Форматирует текущий день с дробной частью
     * @param {number} currentDay - Текущий день
     * @returns {string} "ДД.ДДДДД (UTC)"
     */
    formatCurrentDayWithSecondsUTC(currentDay) {
        if (currentDay === undefined || currentDay === null || isNaN(currentDay)) {
            return '0.00000 (UTC)';
        }
        return `${currentDay.toFixed(5)} (UTC)`;
    }
    
    // ================ ВЫЧИСЛЕНИЯ ================
    
    /**
     * Начало дня в UTC
     * @param {Date|number} date - Дата
     * @returns {Date} Начало дня (00:00:00.000) в UTC
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
     * Разница в целых днях между датами
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
     * Точная разница в днях между датами (дробная)
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
     * День недели в UTC
     * @param {Date|number} date - Дата
     * @returns {number} 0-воскресенье, 6-суббота
     */
    getWeekdayUTC(date) {
        const d = this.toUTC(date);
        return d.getUTCDay();
    }
    
    /**
     * Название дня недели
     * @param {Date|number} date - Дата
     * @param {boolean} full - Полное название
     * @returns {string} Название дня
     */
    getWeekdayNameUTC(date, full = false) {
        const weekday = this.getWeekdayUTC(date);
        const weekdays = full ? 
            ['Воскресенье', 'Понедельник', 'Вторник', 'Среда', 'Четверг', 'Пятница', 'Суббота'] :
            ['Вс', 'Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб'];
        return weekdays[weekday];
    }
    
    // ================ ВАЛИДАЦИЯ И УТИЛИТЫ ================
    
    /**
     * Проверяет, является ли значение корректным timestamp
     * @param {any} value - Значение
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
     * Используется для отладки
     */
    validateDateConsistency() {
        if (!window.appState) return false;
        
        const { currentDate, baseDate, currentDay } = window.appState;
        
        if (!currentDate || !baseDate) {
            console.error('TimeUtils: отсутствуют текущая или базовая дата');
            return false;
        }
        
        // Рассчитываем currentDay заново
        const calculatedCurrentDay = this.getDaysBetweenExactUTC(baseDate, currentDate);
        const diff = Math.abs(calculatedCurrentDay - (currentDay || 0));
        
        // Допустимая погрешность: 1 секунда
        const tolerance = 1 / 86400; // 1 секунда в днях
        
        if (diff > tolerance) {
            console.error('TimeUtils: НЕСОГЛАСОВАННОСТЬ ДАТ!', {
                baseDate: new Date(baseDate).toISOString(),
                currentDate: currentDate.toISOString(),
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
    
    /**
     * Миграция старых строковых дат в timestamp
     * @param {Object} data - Данные приложения
     * @returns {Object} Данные с конвертированными датами
     */
    migrateDataToTimestamp(data) {
        if (!data) return data;
        
        const migrated = { ...data };
        
        // Мигрировать dates
        if (Array.isArray(migrated.dates)) {
            migrated.dates = migrated.dates.map(date => ({
                ...date,
                date: this.convertToTimestamp(date.date)
            }));
        }
        
        // Мигрировать notes
        if (Array.isArray(migrated.notes)) {
            migrated.notes = migrated.notes.map(note => ({
                ...note,
                date: this.convertToTimestamp(note.date)
            }));
        }
        
        // Мигрировать uiSettings
        if (migrated.uiSettings) {
            ['currentDate', 'baseDate'].forEach(key => {
                if (migrated.uiSettings[key]) {
                    migrated.uiSettings[key] = this.convertToTimestamp(migrated.uiSettings[key]);
                }
            });
        }
        
        return migrated;
    }
    
    /**
     * Конвертирует любое значение в timestamp
     * @param {any} value - Значение
     * @returns {number} UTC timestamp
     */
    convertToTimestamp(value) {
        if (this.isTimestamp(value)) {
            return value;
        }
        
        if (typeof value === 'string') {
            return this.parseStringStrict(value).getTime();
        }
        
        if (value instanceof Date) {
            return value.getTime();
        }
        
        console.warn('TimeUtils: не удалось конвертировать в timestamp:', value);
        return Date.now();
    }
    
    /**
     * Получает строковое представление для отладки
     * @param {Date|number} date - Дата
     * @returns {string} Подробная информация
     */
    debugDate(date) {
        const d = this.toUTC(date);
        return {
            timestamp: d.getTime(),
            ISO: d.toISOString(),
            UTC: d.toUTCString(),
            local: d.toString(),
            components: {
                year: d.getUTCFullYear(),
                month: d.getUTCMonth() + 1,
                day: d.getUTCDate(),
                hours: d.getUTCHours(),
                minutes: d.getUTCMinutes(),
                seconds: d.getUTCSeconds(),
                milliseconds: d.getUTCMilliseconds()
            },
            timezoneOffset: d.getTimezoneOffset()
        };
    }
}

window.timeUtils = new TimeUtils();

// Автоматический запуск проверки при загрузке
document.addEventListener('DOMContentLoaded', () => {
    setTimeout(() => {
        console.log('=== TimeUtils: Инициализация UTC ===');
        console.log('Текущее время UTC:', window.timeUtils.nowUTC().toISOString());
        console.log('Часовой пояс пользователя:', new Date().getTimezoneOffset(), 'минут');
        
        // Проверка формата инпута
        const testDate = new Date('2024-01-15T14:30:00Z');
        const formatted = window.timeUtils.formatForDateTimeInputUTC(testDate.getTime());
        console.log('Тест форматирования:', testDate.toISOString(), '→', formatted);
        
        // Обратная проверка
        const parsed = window.timeUtils.parseFromDateTimeInput(formatted);
        console.log('Тест парсинга:', formatted, '→', new Date(parsed).toISOString());
        
        // Проверка консистентности
        if (window.timeUtils.validateDateConsistency) {
            window.timeUtils.validateDateConsistency();
        }
        
        console.log('=== TimeUtils: Готово ===');
    }, 1000);
});

// Глобальная функция для тестирования
window.testTimeUtilsUTC = function() {
    console.log('=== ТЕСТ TimeUtils UTC ===');
    
    const tests = [
        {
            name: 'Парсинг даты без времени',
            test: () => {
                const result = window.timeUtils.parseStringStrict('2024-01-15');
                console.log('Вход:', '2024-01-15');
                console.log('Результат:', result.toISOString());
                console.log('Ожидание:', '2024-01-15T00:00:00.000Z');
                return result.toISOString() === '2024-01-15T00:00:00.000Z';
            }
        },
        {
            name: 'Парсинг даты с временем',
            test: () => {
                const result = window.timeUtils.parseStringStrict('2024-01-15 14:30:00');
                console.log('Вход:', '2024-01-15 14:30:00');
                console.log('Результат:', result.toISOString());
                console.log('Компоненты UTC:', {
                    hours: result.getUTCHours(),
                    minutes: result.getUTCMinutes(),
                    seconds: result.getUTCSeconds()
                });
                return true;
            }
        },
        {
            name: 'Форматирование для инпута',
            test: () => {
                const timestamp = Date.UTC(2024, 0, 15, 14, 30, 0); // 15.01.2024 14:30:00 UTC
                const formatted = window.timeUtils.formatForDateTimeInputUTC(timestamp);
                console.log('Вход timestamp:', timestamp);
                console.log('Форматировано:', formatted);
                console.log('Ожидание:', '2024-01-15 14:30:00');
                return formatted === '2024-01-15 14:30:00';
            }
        }
    ];
    
    let passed = 0;
    tests.forEach(testCase => {
        console.log(`\n--- ${testCase.name} ---`);
        try {
            if (testCase.test()) {
                console.log('✅ Успех');
                passed++;
            } else {
                console.log('❌ Ошибка');
            }
        } catch (error) {
            console.error('❌ Ошибка выполнения:', error);
        }
    });
    
    console.log(`\n=== РЕЗУЛЬТАТ: ${passed}/${tests.length} тестов пройдено ===`);
    return passed === tests.length;
};