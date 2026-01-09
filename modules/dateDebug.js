class DateDebug {
    static logAllDates() {
        if (!window.appState) {
            return;
        }
        
        if (window.appState.currentDate) {
        }
        
        if (window.appState.baseDate) {
        }
    }
    
    static compareDates(date1, date2, label = 'Сравнение') {
        const d1 = window.timeUtils ? window.timeUtils.toLocalDate(date1) : new Date(date1);
        const d2 = window.timeUtils ? window.timeUtils.toLocalDate(date2) : new Date(date2);
        
        const diffMs = Math.abs(d2.getTime() - d1.getTime());
        const diffDays = diffMs / (1000 * 60 * 60 * 24);
        
        return diffDays;
    }
}

window.debugDates = function() {
    DateDebug.logAllDates();
};

window.compareDates = function(date1, date2) {
    return DateDebug.compareDates(date1, date2, 'Сравнение дат');
};

window.debugTimeZone = function() {
};