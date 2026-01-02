// modules/dates.js
class DatesManager {
    constructor() {
        this.elements = {};
        this.cacheElements();
    }
    
    cacheElements() {
        const ids = [
            'dateInput', 'dateNameInput', 'btnAddDate', 'dateListForDates',
            'mainDateInput', 'btnSetDate', 'currentDay', 'btnPrevDay',
            'btnNextDay', 'btnToday', 'btnNow', 'noteInput', 'btnAddNote',
            'notesList', 'customWaveName', 'customWavePeriod', 'customWaveType',
            'customWaveColor', 'btnAddCustomWave', 'newGroupName', 'btnAddGroup',
            'dateList', 'intersectionBasePeriod', 'intersectionBaseAmplitude',
            'intersectionPrecision', 'intersectionResults', 'intersectionStats'
        ];
        
        ids.forEach(id => {
            const el = document.getElementById(id);
            if (el) this.elements[id] = el;
        });
    }
    
    isCurrentDateOnVizor() {
        const today = new Date();
        const vizorDate = window.appState.currentDate;
        
        return today.toDateString() === vizorDate.toDateString();
    }
    
    updateTodayButton() {
        const btnToday = document.getElementById('btnToday');
        if (!btnToday) return;
        
        const isCurrent = this.isCurrentDateOnVizor();
        
        if (isCurrent) {
            btnToday.classList.remove('today-inactive');
            btnToday.classList.add('today-active');
        } else {
            btnToday.classList.remove('today-active');
            btnToday.classList.add('today-inactive');
        }
    }
    
    addDate(dateValue, name) {
        let timestamp;
        
        if (typeof dateValue === 'string') {
            const date = new Date(dateValue);
            timestamp = date.getTime();
        } else if (typeof dateValue === 'number') {
            timestamp = dateValue;
        } else {
            timestamp = Date.now();
        }
        
        const newDate = {
            id: window.appState.generateId(),
            date: timestamp,
            name: name || 'Новая дата'
        };
        
        window.appState.data.dates.push(newDate);
        window.appState.save();
        
        if (this.elements.dateNameInput) {
            this.elements.dateNameInput.value = '';
        }
        
        this.setActiveDate(newDate.id);
        
        return newDate;
    }
    
    deleteDate(dateId) {
        if (!confirm('Уничтожить эту дату?')) return;
        
        const dateIdStr = String(dateId);
        const dateIndex = window.appState.data.dates.findIndex(d => String(d.id) === dateIdStr);
        if (dateIndex === -1) return;
        
        window.appState.data.dates.splice(dateIndex, 1);
        
        if (String(window.appState.editingDateId) === dateIdStr) {
            window.appState.editingDateId = null;
        }
        
        if (String(window.appState.activeDateId) === dateIdStr) {
            if (window.appState.data.dates.length > 0) {
                this.setActiveDate(window.appState.data.dates[0].id);
            } else {
                window.appState.activeDateId = null;
                window.appState.baseDate = new Date();
                this.recalculateCurrentDay();
                this.updateCurrentDayElement();
                window.grid.updateCenterDate();
                window.waves.updatePosition();
            }
        }
        
        window.appState.save();
        window.dataManager.updateDateList();
    }
    
    updateDate(dateId, updates) {
        const dateIdStr = String(dateId);
        const date = window.appState.data.dates.find(d => String(d.id) === dateIdStr);
        if (date) {
            // Если обновляем дату, преобразуем в timestamp
            if (updates.date && typeof updates.date !== 'number') {
                const dateObj = new Date(updates.date);
                if (!isNaN(dateObj.getTime())) {
                    updates.date = dateObj.getTime();
                }
            }
            Object.assign(date, updates);
            window.appState.save();
        }
    }
    
    // ОБНОВЛЕННЫЙ МЕТОД: Добавлен параметр useExactTime (по умолчанию true)
    setActiveDate(dateId, useExactTime = true) {
        console.log('=== setActiveDate(' + dateId + ', useExactTime=' + useExactTime + ') ===');
        
        const oldActiveId = window.appState.activeDateId;
        window.appState.activeDateId = dateId;
        
        const dateIdStr = String(dateId);
        const dateObj = window.appState.data.dates.find(d => String(d.id) === dateIdStr);
        
        if (!dateObj) {
            console.warn('DatesManager: дата не найдена, устанавливаем базовую дату на сегодня');
            window.appState.baseDate = Date.now(); // timestamp
        } else {
            try {
                // dateObj.date уже timestamp
                if (typeof dateObj.date !== 'number' || isNaN(dateObj.date)) {
                    throw new Error('Некорректный timestamp в объекте даты');
                }
                
                // Устанавливаем базовую дату как есть
                window.appState.baseDate = dateObj.date;
                
                // ДЕБАГ: выводим для проверки
                const dateFromTimestamp = new Date(dateObj.date);
                console.log('DatesManager: установка базовой даты:', {
                    timestamp: dateObj.date,
                    localDate: dateFromTimestamp.toString(),
                    utcDate: dateFromTimestamp.toUTCString(),
                    hours: dateFromTimestamp.getHours(),
                    minutes: dateFromTimestamp.getMinutes()
                });
                
                console.log('DatesManager: установлена базовая дата (timestamp):', dateObj.date);
            } catch (error) {
                console.error('Error setting active date:', error);
                window.appState.baseDate = Date.now();
            }
        }
        
        // ИЗМЕНЕНО: Используем переданный параметр useExactTime
        this.recalculateCurrentDay(useExactTime);
        
        console.log('currentDay после recalculate:', window.appState.currentDay);
        
        this.updateCurrentDayElement();
        
        // ВАЖНОЕ ИСПРАВЛЕНИЕ: Обновляем список дат ДО пересоздания элементов
        if (window.dataManager && window.dataManager.updateDateList) {
            window.dataManager.updateDateList();
        }
        
        if (oldActiveId !== dateId) {
            console.log('Активная дата изменилась, пересоздаем элементы...');
            
            document.querySelectorAll('.wave-container').forEach(c => c.remove());
            if (window.waves) {
                window.waves.waveContainers = {};
                window.waves.wavePaths = {};
            }
            
            if (window.waves && window.waves.createVisibleWaveElements) {
                window.waves.createVisibleWaveElements();
            }
        }
        
        if (window.waves) {
            window.waves.updatePosition();
            window.waves.updateCornerSquareColors();
        }
        
        if (window.grid) {
            if (window.grid.createGrid) {
                window.grid.createGrid();
            }
            if (window.grid.updateCenterDate) {
                window.grid.updateCenterDate();
                window.grid.updateGridNotesHighlight();
            }
        }
        
        window.appState.save();
        
        this.updateTodayButton();
        
        // Обновляем сводную информацию
        if (window.summaryManager && window.summaryManager.updateSummary) {
            setTimeout(() => {
                window.summaryManager.updateSummary();
            }, 50);
        }
        
        console.log('=== setActiveDate() завершен ===');
    }
    
    recalculateCurrentDay(useExactTime = false) {
        console.log('=== ПЕРЕСЧЕТ CURRENTDAY (гарантированный) ===');
        console.log('useExactTime:', useExactTime);
        
        // Проверяем baseDate - если это timestamp, преобразуем в Date
        let baseDateObj;
        if (typeof window.appState.baseDate === 'number') {
            baseDateObj = new Date(window.appState.baseDate);
        } else if (window.appState.baseDate instanceof Date) {
            baseDateObj = window.appState.baseDate;
        } else {
            console.warn('baseDate некорректен! Устанавливаем на сегодня');
            window.appState.baseDate = new Date().getTime();
            baseDateObj = new Date();
        }
        
        // Проверяем currentDate
        let currentDateObj;
        if (window.appState.currentDate instanceof Date) {
            currentDateObj = window.appState.currentDate;
        } else {
            console.warn('currentDate некорректен! Устанавливаем на сегодня');
            window.appState.currentDate = new Date();
            currentDateObj = window.appState.currentDate;
        }
        
        console.log('ДЕБАГ recalculateCurrentDay:');
        console.log('  baseDateObj (локальное):', baseDateObj.toString());
        console.log('  currentDateObj (локальное):', currentDateObj.toString());
        
        let daysDiff;
        
        if (useExactTime) {
            // ТОЧНЫЙ расчет разницы в днях (с дробной частью для учета времени)
            const baseLocalStartOfDay = new Date(
                baseDateObj.getFullYear(),
                baseDateObj.getMonth(),
                baseDateObj.getDate(),
                0, 0, 0, 0
            );
            
            const timeDiffMs = currentDateObj.getTime() - baseLocalStartOfDay.getTime();
            daysDiff = timeDiffMs / (1000 * 60 * 60 * 24); // Дробное значение
            
            console.log('Расчет с точным временем (дробный):', daysDiff);
        } else {
            // ЦЕЛЫЙ расчет разницы в днях (только даты, без времени)
            // ВАЖНО: Используем специальную функцию для расчета целых дней
            
            daysDiff = this.calculateWholeDaysBetween(baseDateObj, currentDateObj);
            console.log('Расчет без времени (целый):', daysDiff);
        }
        
        window.appState.currentDay = daysDiff;
        window.appState.virtualPosition = daysDiff * window.appState.config.squareSize;
        
        console.log('Результат:');
        console.log('  currentDay:', window.appState.currentDay);
        
        if (typeof window.appState.currentDay !== 'number' || isNaN(window.appState.currentDay)) {
            console.error('ERROR: currentDay вычислен некоррекктно! Устанавливаем 0');
            window.appState.currentDay = 0;
        }
        
        this.updateCurrentDayElement();
        window.appState.save();
        
        return window.appState.currentDay;
    }

    // НОВЫЙ МЕТОД: Расчет целых дней между двумя датами
    calculateWholeDaysBetween(date1, date2) {
        // Приводим обе даты к локальному началу дня
        const d1 = new Date(date1.getFullYear(), date1.getMonth(), date1.getDate());
        const d2 = new Date(date2.getFullYear(), date2.getMonth(), date2.getDate());
        
        // Вычисляем разницу в миллисекундах
        const timeDiff = d2.getTime() - d1.getTime();
        
        // Конвертируем в дни и округляем
        const daysDiff = Math.round(timeDiff / (1000 * 60 * 60 * 24));
        
        // Дополнительная проверка: используем математику с датами
        // Это более надежный способ для целых дней
        const yearDiff = d2.getFullYear() - d1.getFullYear();
        const monthDiff = d2.getMonth() - d1.getMonth();
        const dateDiff = d2.getDate() - d1.getDate();
        
        const calculatedDays = yearDiff * 365 + monthDiff * 30 + dateDiff;
        
        console.log('calculateWholeDaysBetween:');
        console.log('  d1:', d1.toString());
        console.log('  d2:', d2.toString());
        console.log('  timeDiff способ:', daysDiff);
        console.log('  математический способ:', calculatedDays);
        
        // Возвращаем результат через timeDiff, так как он более точен
        return daysDiff;
    }
    
    addNote(content) {
        if (!content.trim()) {
            alert('Пожалуйста, введите текст записи');
            return null;
        }
        
        const note = {
            id: window.appState.generateId(),
            date: window.appState.currentDate.getTime(), // Сохраняем как timestamp
            content: content.trim()
        };
        
        window.appState.data.notes.push(note);
        window.appState.save();
        return note;
    }
    
    deleteNote(noteId) {
        const noteIdStr = String(noteId);
        window.appState.data.notes = window.appState.data.notes.filter(n => String(n.id) !== noteIdStr);
        window.appState.save();
    }
    
    getNotesForDate(date) {
        let targetTimestamp;
        
        if (date instanceof Date) {
            targetTimestamp = date.getTime();
        } else if (typeof date === 'number') {
            targetTimestamp = date;
        } else {
            targetTimestamp = new Date(date).getTime();
        }
        
        return window.appState.data.notes.filter(note => {
            const noteDate = new Date(note.date);
            const targetDate = new Date(targetTimestamp);
            return noteDate.toDateString() === targetDate.toDateString();
        });
    }
    
    addGroup(name) {
        if (!name.trim()) {
            alert('Пожалуйста, введите название группы');
            return null;
        }
        
        const group = {
            id: window.appState.generateId(),
            name: name.trim(),
            enabled: false,
            waves: [],
            styleEnabled: false,
            styleBold: false,
            styleColor: '#666666',
            styleColorEnabled: false,
            styleType: 'solid',
            expanded: true
        };
        
        window.appState.data.groups.push(group);
        window.appState.save();
        return group;
    }
    
    deleteGroup(groupId) {
        if (!confirm(`Уничтожить группу? Колоски будут перемещены в группу по умолчанию.`)) return;
        
        const groupIdStr = String(groupId);
        const group = window.appState.data.groups.find(g => String(g.id) === groupIdStr);
        if (!group) return;
        
        const defaultGroup = window.appState.data.groups.find(g => g.id === 'default-group');
        if (defaultGroup && group.waves && group.waves.length > 0) {
            group.waves.forEach(waveId => {
                const waveIdStr = String(waveId);
                if (!defaultGroup.waves.some(wId => String(wId) === waveIdStr)) {
                    defaultGroup.waves.push(waveId);
                }
            });
        }
        
        window.appState.data.groups = window.appState.data.groups.filter(g => String(g.id) !== groupIdStr);
        window.appState.save();
        
        return true;
    }
    
    navigateDay(delta) {
        console.log('=== navigateDay(' + delta + ') вызван ===');
        console.log('До: currentDate:', window.appState.currentDate);
        console.log('До: currentDay:', window.appState.currentDay);
        
        window.appState.currentDate.setDate(window.appState.currentDate.getDate() + delta);
        this.recalculateCurrentDay(false); // Навигация по дням использует целые числа
        window.waves.updatePosition();
        window.grid.createGrid();
        window.grid.updateCenterDate();
        window.grid.updateGridNotesHighlight();
        window.appState.save();
        
        console.log('После: currentDate:', window.appState.currentDate);
        console.log('После: currentDay:', window.appState.currentDay);
        
        this.updateTodayButton();
        
        // Обновляем сводную информацию
        if (window.summaryManager && window.summaryManager.updateSummary) {
            setTimeout(() => {
                window.summaryManager.updateSummary();
            }, 50);
        }
        
        console.log('=== navigateDay() завершен ===');
    }
    
    goToToday() {
        console.log('=== goToToday() вызван ===');
        console.log('До: currentDate:', window.appState.currentDate);
        console.log('До: baseDate:', window.appState.baseDate);
        console.log('До: currentDay:', window.appState.currentDay);
        console.log('До: activeDateId:', window.appState.activeDateId);
        
        const today = new Date();
        // Устанавливаем на начало дня (00:00:00)
        today.setHours(0, 0, 0, 0);
        window.appState.currentDate = new Date(today);
        
        console.log('После установки currentDate (начало дня):', window.appState.currentDate);
        
        // Пересчитываем с целыми числами (без учета времени)
        this.recalculateCurrentDay(false);
        
        console.log('После recalculateCurrentDay:');
        console.log('  currentDay (целое число):', window.appState.currentDay);
        console.log('  baseDate:', window.appState.baseDate);
        console.log('  currentDate:', window.appState.currentDate);
        
        // ВАЖНО: Полностью пересоздаем сетку, чтобы линии стали на целые позиции
        if (window.grid && window.grid.createGrid) {
            window.grid.createGrid();
        }
        
        window.grid.updateCenterDate();
        window.waves.updatePosition();
        window.appState.save();
        
        this.updateTodayButton();
        
        // Обновляем сводную информацию
        if (window.summaryManager && window.summaryManager.updateSummary) {
            setTimeout(() => {
                window.summaryManager.updateSummary();
            }, 50);
        }
        
        console.log('=== goToToday() завершен ===');
    }
    
    // НОВЫЙ МЕТОД: Установить текущее точное время
    goToNow() {
        console.log('=== goToNow() вызван ===');
        console.log('До: currentDate:', window.appState.currentDate);
        console.log('До: baseDate:', window.appState.baseDate);
        console.log('До: currentDay:', window.appState.currentDay);
        console.log('До: activeDateId:', window.appState.activeDateId);
        
        // Устанавливаем точное текущее время (с секундами и миллисекундами)
        const now = new Date();
        window.appState.currentDate = new Date(now);
        
        console.log('После установки currentDate (точное время):', window.appState.currentDate);
        console.log('Часы:', now.getHours(), 'Минуты:', now.getMinutes(), 'Секунды:', now.getSeconds(), 'Милисекунды:', now.getMilliseconds());
        
        // Пересчитываем с дробными числами (с учетом времени)
        this.recalculateCurrentDay(true);
        
        console.log('После recalculateCurrentDay:');
        console.log('  currentDay (с точностью до секунд):', window.appState.currentDay);
        console.log('  baseDate:', window.appState.baseDate);
        console.log('  currentDate:', window.appState.currentDate);
        
        window.grid.createGrid();
        window.grid.updateCenterDate();
        window.waves.updatePosition();
        window.appState.save();
        
        this.updateTodayButton();
        
        // Обновляем сводную информацию
        if (window.summaryManager && window.summaryManager.updateSummary) {
            setTimeout(() => {
                window.summaryManager.updateSummary();
            }, 50);
        }
        
        console.log('=== goToNow() завершен ===');
    }
    
    // ОБНОВЛЕННЫЙ МЕТОД: Установка даты из инпута с поддержкой секунд и автоматическим определением режима
    setDateFromInput() {
        const dateValue = this.elements.mainDateInput.value;
        if (dateValue) {
            // Используем новую функцию для преобразования строки с секундами в timestamp
            const newTimestamp = window.dom.stringFromDateTimeStringToTimestamp(dateValue);
            const newDate = new Date(newTimestamp);
            
            // Сохраняем полное время с секундами
            window.appState.currentDate = new Date(newDate);
            
            // АВТОМАТИЧЕСКОЕ ОПРЕДЕЛЕНИЕ: если время 00:00:00 - целые, иначе дробные
            const hours = newDate.getHours();
            const minutes = newDate.getMinutes();
            const seconds = newDate.getSeconds();
            const milliseconds = newDate.getMilliseconds();
            
            // Проверяем, является ли время началом дня (включая секунды)
            const isStartOfDay = hours === 0 && minutes === 0 && seconds === 0 && milliseconds === 0;
            
            console.log('Время в инпуте:', 
                `Часы: ${hours}, Минуты: ${minutes}, Секунды: ${seconds}, Мс: ${milliseconds}`);
            console.log('Начало дня?:', isStartOfDay);
            
            // Пересчитываем с учетом времени
            this.recalculateCurrentDay(!isStartOfDay);
            
            window.grid.createGrid();
            window.grid.updateCenterDate();
            window.waves.updatePosition();
            window.appState.save();
            
            this.updateTodayButton();
            
            // Обновляем сводную информацию
            if (window.summaryManager && window.summaryManager.updateSummary) {
                setTimeout(() => {
                    window.summaryManager.updateSummary();
                }, 50);
            }
            
            console.log('Текущий день после установки:', window.appState.currentDay);
            console.log('Форматированный:', window.dom.formatCurrentDayWithSeconds(window.appState.currentDay));
        }
    }
    
    setDate(newDate) {
        window.appState.isProgrammaticDateChange = true;
        
        if (newDate instanceof Date) {
            window.appState.currentDate = new Date(newDate);
        } else if (typeof newDate === 'number') {
            window.appState.currentDate = new Date(newDate);
        } else {
            window.appState.currentDate = new Date(newDate);
        }
        
        // По умолчанию используем целые числа при установке даты
        this.recalculateCurrentDay(false);
        window.waves.updatePosition();
        window.grid.updateCenterDate();
        window.grid.updateGridNotesHighlight();
        window.appState.save();
        
        this.updateTodayButton();
        
        // Обновляем сводную информацию
        if (window.summaryManager && window.summaryManager.updateSummary) {
            setTimeout(() => {
                window.summaryManager.updateSummary();
            }, 50);
        }
        
        setTimeout(() => {
            window.appState.isProgrammaticDateChange = false;
        }, 100);
    }
    
    getCurrentDate() {
        return new Date();
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
    
    cleanupEditingHandlers() {
        document.querySelectorAll('.date-item.editing').forEach(item => {
            if (item._clickOutsideHandler) {
                document.removeEventListener('click', item._clickOutsideHandler);
                delete item._clickOutsideHandler;
            }
        });
    }
    
    // ОБНОВЛЕННЫЙ МЕТОД: Всегда отображаем с 5 знаками после запятой
    updateCurrentDayElement() {
        const currentDayElement = document.getElementById('currentDay');
        if (currentDayElement) {
            const currentDayValue = window.appState.currentDay || 0;
            // ВСЕГДА отображаем с 5 знаками после запятой (для секунд)
            currentDayElement.textContent = window.dom.formatCurrentDayWithSeconds(currentDayValue);
            console.log('DatesManager: DOM элемент currentDay обновлен:', currentDayElement.textContent);
        } else {
            console.warn('DatesManager: элемент currentDay не найден в DOM');
        }
    }
    
    forceInitialize() {
        console.log('=== FORCE INITIALIZE ===');
        
        // ИЗМЕНЕНО: При инициализации устанавливаем ТОЧНОЕ время (сейчас), а не начало дня
        const now = new Date();
        window.appState.currentDate = new Date(now);
        
        this.recalculateCurrentDay(true); // При инициализации используем ДРОБНЫЕ числа (учитываем время)
        
        if (window.appState.activeDateId) {
            console.log('Принудительная установка активной даты:', window.appState.activeDateId);
            this.setActiveDate(window.appState.activeDateId, true); // Используем точное время
        } else if (window.appState.data.dates.length > 0) {
            console.log('Нет активной даты, выбираем первую из списка');
            const firstDateId = window.appState.data.dates[0].id;
            window.appState.activeDateId = firstDateId;
            this.setActiveDate(firstDateId, true); // Используем точное время
        } else {
            console.log('Нет дат в списке, устанавливаем базовую дату');
            window.appState.baseDate = new Date().getTime();
            this.recalculateCurrentDay(true); // Используем точное время
        }
        
        if (window.waves && window.waves.updatePosition) {
            window.waves.updatePosition();
        }
        
        if (window.grid) {
            if (window.grid.createGrid) {
                window.grid.createGrid();
            }
            if (window.grid.updateCenterDate) {
                window.grid.updateCenterDate();
            }
        }
        
        if (window.dataManager) {
            if (window.dataManager.updateDateList) {
                window.dataManager.updateDateList();
            }
        }
        
        this.updateTodayButton();
        
        console.log('=== FORCE INITIALIZE завершен ===');
        console.log('activeDateId:', window.appState?.activeDateId);
        console.log('currentDay:', window.appState?.currentDay);
    }
}

window.dates = new DatesManager();