/**
 * Утилиты для отладки дат и часовых поясов
 */
class DateDebug {
    static logAllDates() {
        console.log('=== DEBUG: ВСЕ ДАТЫ В ЛОКАЛЬНОМ ВРЕМЕНИ ===');
        
        if (!window.appState) {
            console.log('appState не загружен');
            return;
        }
        
        // Текущая дата
        if (window.appState.currentDate) {
            console.log('currentDate (локальное):', window.appState.currentDate.toLocaleString());
            console.log('currentDate (ISO):', window.appState.currentDate.toISOString());
            console.log('currentDate (timestamp):', window.appState.currentDate.getTime());
            console.log('currentDate (часы):', window.appState.currentDate.getHours());
        }
        
        // Base date
        if (window.appState.baseDate) {
            if (window.appState.baseDate instanceof Date) {
                console.log('baseDate (локальное):', window.appState.baseDate.toLocaleString());
                console.log('baseDate (часы):', window.appState.baseDate.getHours());
            }
            console.log('baseDate (timestamp):', 
                window.appState.baseDate.getTime ? 
                window.appState.baseDate.getTime() : 
                window.appState.baseDate);
        }
        
        // Current day
        console.log('currentDay:', window.appState.currentDay);
        
        // Active date
        if (window.appState.activeDateId) {
            const activeDate = window.appState.data.dates.find(d => d.id === window.appState.activeDateId);
            if (activeDate) {
                const dateLocal = window.timeUtils ? 
                    window.timeUtils.toLocalDate(activeDate.date) : 
                    new Date(activeDate.date);
                console.log('activeDate (локальное):', dateLocal.toLocaleString());
                console.log('activeDate (timestamp):', activeDate.date);
            }
        }
        
        console.log('==================================');
    }
    
    static compareDates(date1, date2, label = 'Сравнение') {
        console.log(`=== ${label} ===`);
        
        const d1 = window.timeUtils ? window.timeUtils.toLocalDate(date1) : new Date(date1);
        const d2 = window.timeUtils ? window.timeUtils.toLocalDate(date2) : new Date(date2);
        
        console.log('Дата 1 (локальное):', d1.toLocaleString());
        console.log('Дата 1 (ISO):', d1.toISOString());
        console.log('Дата 1 (timestamp):', d1.getTime());
        
        console.log('Дата 2 (локальное):', d2.toLocaleString());
        console.log('Дата 2 (ISO):', d2.toISOString());
        console.log('Дата 2 (timestamp):', d2.getTime());
        
        const diffMs = Math.abs(d2.getTime() - d1.getTime());
        const diffDays = diffMs / (1000 * 60 * 60 * 24);
        
        console.log(`Разница: ${diffDays.toFixed(5)} дней (${diffMs} мс)`);
        console.log('====================');
        
        return diffDays;
    }
}

// Глобальные команды для отладки
window.debugDates = function() {
    DateDebug.logAllDates();
};

window.compareDates = function(date1, date2) {
    return DateDebug.compareDates(date1, date2, 'Сравнение дат');
};

window.debugTimeZone = function() {
    console.log('=== DEBUG: ИНФОРМАЦИЯ О ЧАСОВОМ ПОЯСЕ ===');
    console.log('Часовой пояс браузера:', Intl.DateTimeFormat().resolvedOptions().timeZone);
    console.log('Смещение (минуты):', new Date().getTimezoneOffset());
    console.log('Локальное время сейчас:', new Date().toLocaleString());
    console.log('UTC время сейчас:', new Date().toUTCString());
    console.log('========================================');
};