/**
 * @file dateDebug.js
 * Отладка дат визора и сравнение двух моментов времени.
 * Глобально: debugDates(), compareDates(), debugTimeZone().
 */
class DateDebug {
    /** Заготовка: лог currentDate и baseDate (при необходимости дополнить вывод). */
    static logAllDates() {
        if (!window.appState) {
            return;
        }

        if (window.appState.currentDate) {
        }

        if (window.appState.baseDate) {
        }
    }

    /**
     * Разница двух дат в днях (абсолютное значение).
     * @param {Date|number|string} date1
     * @param {Date|number|string} date2
     * @param {string} [label] — подпись для отладки
     * @returns {number} разница в днях
     */
    static compareDates(date1, date2, label = 'Сравнение') {
        const d1 = window.timeUtils ? window.timeUtils.toLocalDate(date1) : new Date(date1);
        const d2 = window.timeUtils ? window.timeUtils.toLocalDate(date2) : new Date(date2);

        const diffMs = Math.abs(d2.getTime() - d1.getTime());
        const diffDays = diffMs / (1000 * 60 * 60 * 24);

        return diffDays;
    }
}

/** Консоль: отладочный вывод дат appState. */
window.debugDates = function () {
    DateDebug.logAllDates();
};

/**
 * Консоль: сравнить две даты, вернуть разницу в днях.
 * @param {Date|number|string} date1
 * @param {Date|number|string} date2
 */
window.compareDates = function (date1, date2) {
    return DateDebug.compareDates(date1, date2, 'Сравнение дат');
};

/** Зарезервировано под проверку часового пояса. */
window.debugTimeZone = function () {};
