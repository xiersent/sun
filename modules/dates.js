// modules/dates.js - ПОЛНОСТЬЮ ОБНОВЛЕННЫЙ с использованием TimeUtils
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
            'customWaveColor', 'btnAddCustomWave', 'newGroupName', 'btnAddGroup'
        ];
        
        ids.forEach(id => {
            const el = document.getElementById(id);
            if (el) this.elements[id] = el;
        });
    }
    
	isCurrentDateOnVizor() {
		const today = window.timeUtils.nowUTC();
		const vizorDate = window.appState.currentDate;
		
		// Сравниваем даты в UTC (только год, месяц, день)
		const todayStart = new Date(Date.UTC(
			today.getUTCFullYear(),
			today.getUTCMonth(),
			today.getUTCDate()
		));
		const vizorStart = new Date(Date.UTC(
			vizorDate.getUTCFullYear(),
			vizorDate.getUTCMonth(),
			vizorDate.getUTCDate()
		));
		
		return todayStart.getTime() === vizorStart.getTime();
	}
    
    updateTodayButton() {
        const btnToday = document.getElementById('btnToday');
        if (!btnToday) return;
        
        const isCurrent = this.isCurrentDateOnVizor();
        
        if (isCurrent) {
            btnToday.classList.remove('today-inactive');
            btnToday.classList.add('today-active');
            btnToday.title = 'Текущая дата уже на визоре';
        } else {
            btnToday.classList.remove('today-active');
            btnToday.classList.add('today-inactive');
            btnToday.title = 'Перейти к сегодняшней дате';
        }
    }
    
    addDate(dateValue, name) {
        let timestamp;
        
        if (typeof dateValue === 'string') {
            // Используем TimeUtils для парсинга в UTC
            const utcDate = window.timeUtils.parseStringToUTC(dateValue);
            timestamp = utcDate.getTime();
        } else if (typeof dateValue === 'number') {
            timestamp = dateValue;
        } else {
            timestamp = window.timeUtils.nowTimestamp();
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
                window.appState.baseDate = window.timeUtils.nowTimestamp();
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
            // Если обновляем дату, преобразуем в timestamp с использованием TimeUtils
            if (updates.date && typeof updates.date !== 'number') {
                const utcDate = window.timeUtils.parseStringToUTC(updates.date);
                updates.date = utcDate.getTime();
            }
            Object.assign(date, updates);
            window.appState.save();
        }
    }
    
    setActiveDate(dateId, useExactTime = true) {
        console.log('=== setActiveDate(' + dateId + ', useExactTime=' + useExactTime + ') ===');
        
        const oldActiveId = window.appState.activeDateId;
        window.appState.activeDateId = dateId;
        
        const dateIdStr = String(dateId);
        const dateObj = window.appState.data.dates.find(d => String(d.id) === dateIdStr);
        
        if (!dateObj) {
            console.warn('DatesManager: дата не найдена, устанавливаем базовую дату на сейчас (UTC)');
            window.appState.baseDate = window.timeUtils.nowTimestamp();
        } else {
            try {
                // dateObj.date уже должен быть UTC timestamp
                if (typeof dateObj.date !== 'number' || isNaN(dateObj.date)) {
                    throw new Error('Некорректный timestamp в объекте даты');
                }
                
                // Устанавливаем базовую дату как есть (уже UTC timestamp)
                window.appState.baseDate = dateObj.date;
                
                console.log('DatesManager: установка базовой даты (UTC):', {
                    timestamp: dateObj.date,
                    utcDate: new Date(dateObj.date).toUTCString(),
                    utcHours: new Date(dateObj.date).getUTCHours(),
                    utcMinutes: new Date(dateObj.date).getUTCMinutes(),
                    utcSeconds: new Date(dateObj.date).getUTCSeconds()
                });
                
                console.log('DatesManager: установлена базовая дата (timestamp):', dateObj.date);
            } catch (error) {
                console.error('Error setting active date:', error);
                window.appState.baseDate = window.timeUtils.nowTimestamp();
            }
        }
        
        this.recalculateCurrentDay(useExactTime);
        
        console.log('currentDay после recalculate:', window.appState.currentDay);
        
        this.updateCurrentDayElement();
        
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
        
        if (window.summaryManager && window.summaryManager.updateSummary) {
            setTimeout(() => {
                window.summaryManager.updateSummary();
            }, 50);
        }
        
        console.log('=== setActiveDate() завершен ===');
    }
    
    recalculateCurrentDay(useExactTime = false) {
        console.log('=== ПЕРЕСЧЕТ CURRENTDAY (UTC) ===');
        console.log('useExactTime:', useExactTime);
        
        // Получаем текущую дату визора в UTC
        const currentDateUTC = window.timeUtils.toUTC(window.appState.currentDate);
        
        // Получаем базовую дату в UTC
        let baseDateUTC;
        if (typeof window.appState.baseDate === 'number') {
            baseDateUTC = new Date(window.appState.baseDate);
        } else if (window.appState.baseDate instanceof Date) {
            baseDateUTC = window.appState.baseDate;
        } else {
            console.warn('baseDate некорректен! Устанавливаем на сейчас (UTC)');
            window.appState.baseDate = window.timeUtils.nowTimestamp();
            baseDateUTC = window.timeUtils.nowUTC();
        }
        
        console.log('ДЕБАГ recalculateCurrentDay (UTC):');
        console.log('  baseDateUTC:', baseDateUTC.toUTCString());
        console.log('  currentDateUTC:', currentDateUTC.toUTCString());
        console.log('  baseDate (timestamp):', window.appState.baseDate);
        console.log('  currentDate (timestamp):', currentDateUTC.getTime());
        
        let daysDiff;
        
        if (useExactTime) {
            // ТОЧНЫЙ расчет разницы в днях в UTC (с дробной частью)
            const baseStartOfDayUTC = window.timeUtils.getStartOfDayUTC(baseDateUTC);
            const timeDiffMs = currentDateUTC.getTime() - baseStartOfDayUTC.getTime();
            daysDiff = timeDiffMs / (1000 * 60 * 60 * 24); // Дробное значение
            
            console.log('Расчет с точным временем (UTC дробный):', daysDiff);
        } else {
            // ЦЕЛЫЙ расчет разницы в днях в UTC (только даты)
            daysDiff = window.timeUtils.getDaysBetweenUTC(baseDateUTC, currentDateUTC);
            console.log('Расчет без времени (UTC целый):', daysDiff);
        }
        
        window.appState.currentDay = daysDiff;
        window.appState.virtualPosition = daysDiff * window.appState.config.squareSize;
        
        console.log('Результат (UTC):');
        console.log('  currentDay:', window.appState.currentDay);
        
        if (typeof window.appState.currentDay !== 'number' || isNaN(window.appState.currentDay)) {
            console.error('ERROR: currentDay вычислен некорректно! Устанавливаем 0');
            window.appState.currentDay = 0;
        }
        
        this.updateCurrentDayElement();
        window.appState.save();
        
        return window.appState.currentDay;
    }
    
    addNote(content) {
        if (!content.trim()) {
            alert('Пожалуйста, введите текст записи');
            return null;
        }
        
        const note = {
            id: window.appState.generateId(),
            date: window.appState.currentDate.getTime(), // Сохраняем как UTC timestamp
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
            targetTimestamp = window.timeUtils.parseStringToUTC(date).getTime();
        }
        
        // Используем TimeUtils для сравнения дат в UTC
        const targetStart = window.timeUtils.getStartOfDayUTC(targetTimestamp);
        const targetEnd = new Date(targetStart.getTime() + 24 * 60 * 60 * 1000);
        
        return window.appState.data.notes.filter(note => {
            const noteTime = note.date;
            return noteTime >= targetStart.getTime() && noteTime < targetEnd.getTime();
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
        console.log('=== navigateDay(' + delta + ') вызван (UTC) ===');
        console.log('До: currentDate:', window.appState.currentDate.toUTCString());
        console.log('До: currentDay:', window.appState.currentDay);
        
        // Создаем новую дату (не мутируем существующую)
        const newDate = new Date(window.appState.currentDate);
        newDate.setUTCDate(newDate.getUTCDate() + delta);
        
        window.appState.currentDate = window.timeUtils.toUTC(newDate);
        
        this.recalculateCurrentDay(false); // Навигация по дням использует целые числа
        window.waves.updatePosition();
        window.grid.createGrid();
        window.grid.updateCenterDate();
        window.grid.updateGridNotesHighlight();
        window.appState.save();
        
        console.log('После: currentDate:', window.appState.currentDate.toUTCString());
        console.log('После: currentDay:', window.appState.currentDay);
        
        this.updateTodayButton();
        
        if (window.summaryManager && window.summaryManager.updateSummary) {
            setTimeout(() => {
                window.summaryManager.updateSummary();
            }, 50);
        }
        
        console.log('=== navigateDay() завершен ===');
    }
    
    goToToday() {
        console.log('=== goToToday() вызван (UTC) ===');
        console.log('До: currentDate:', window.appState.currentDate.toUTCString());
        console.log('До: baseDate:', window.appState.baseDate);
        console.log('До: currentDay:', window.appState.currentDay);
        
        // Получаем начало текущего дня в UTC
        const todayStartUTC = window.timeUtils.getStartOfDayUTC(window.timeUtils.nowUTC());
        
        window.appState.currentDate = new Date(todayStartUTC);
        
        console.log('После установки currentDate (UTC начало дня):', window.appState.currentDate.toUTCString());
        
        // Пересчитываем с целыми числами (без учета времени)
        this.recalculateCurrentDay(false);
        
        console.log('После recalculateCurrentDay (UTC):');
        console.log('  currentDay (целое число):', window.appState.currentDay);
        console.log('  currentDate (UTC):', window.appState.currentDate.toUTCString());
        
        if (window.grid && window.grid.createGrid) {
            window.grid.createGrid();
        }
        
        window.grid.updateCenterDate();
        window.waves.updatePosition();
        window.appState.save();
        
        this.updateTodayButton();
        
        if (window.summaryManager && window.summaryManager.updateSummary) {
            setTimeout(() => {
                window.summaryManager.updateSummary();
            }, 50);
        }
        
        console.log('=== goToToday() завершен ===');
    }
    
    goToNow() {
        console.log('=== goToNow() вызван (UTC) ===');
        console.log('До: currentDate:', window.appState.currentDate.toUTCString());
        console.log('До: baseDate:', window.appState.baseDate);
        console.log('До: currentDay:', window.appState.currentDay);
        
        // Получаем текущее точное время в UTC
        window.appState.currentDate = window.timeUtils.nowUTC();
        
        console.log('После установки currentDate (UTC точное время):', window.appState.currentDate.toUTCString());
        console.log('UTC Часы:', window.appState.currentDate.getUTCHours(), 
                   'Минуты:', window.appState.currentDate.getUTCMinutes(), 
                   'Секунды:', window.appState.currentDate.getUTCSeconds());
        
        // Пересчитываем с дробными числами (с учетом времени)
        this.recalculateCurrentDay(true);
        
        console.log('После recalculateCurrentDay (UTC):');
        console.log('  currentDay (с точностью до секунд):', window.appState.currentDay);
        console.log('  currentDate (UTC):', window.appState.currentDate.toUTCString());
        
        window.grid.createGrid();
        window.grid.updateCenterDate();
        window.waves.updatePosition();
        window.appState.save();
        
        this.updateTodayButton();
        
        if (window.summaryManager && window.summaryManager.updateSummary) {
            setTimeout(() => {
                window.summaryManager.updateSummary();
            }, 50);
        }
        
        console.log('=== goToNow() завершен ===');
    }
    
    setDateFromInput() {
        const dateValue = this.elements.mainDateInput.value;
        if (dateValue) {
            // Используем TimeUtils для парсинга в UTC
            const timestamp = window.timeUtils.parseFromDateTimeInput(dateValue);
            window.appState.currentDate = new Date(timestamp);
            
            // Проверяем, является ли время началом дня в UTC
            const hours = window.appState.currentDate.getUTCHours();
            const minutes = window.appState.currentDate.getUTCMinutes();
            const seconds = window.appState.currentDate.getUTCSeconds();
            const milliseconds = window.appState.currentDate.getUTCMilliseconds();
            
            const isStartOfDay = hours === 0 && minutes === 0 && seconds === 0 && milliseconds === 0;
            
            console.log('Время в инпуте (UTC):', 
                `Часы: ${hours}, Минуты: ${minutes}, Секунды: ${seconds}, Мс: ${milliseconds}`);
            console.log('Начало дня в UTC?:', isStartOfDay);
            
            // Пересчитываем с учетом времени
            this.recalculateCurrentDay(!isStartOfDay);
            
            window.grid.createGrid();
            window.grid.updateCenterDate();
            window.waves.updatePosition();
            window.appState.save();
            
            this.updateTodayButton();
            
            if (window.summaryManager && window.summaryManager.updateSummary) {
                setTimeout(() => {
                    window.summaryManager.updateSummary();
                }, 50);
            }
            
            console.log('Текущий день после установки:', window.appState.currentDay);
            console.log('Форматированный:', window.dom.formatCurrentDayWithSeconds(
                window.appState.currentDay, 
                window.appState.currentDate
            ));
        }
    }
    
    setDate(newDate) {
        window.appState.isProgrammaticDateChange = true;
        
        if (newDate instanceof Date) {
            window.appState.currentDate = window.timeUtils.toUTC(newDate);
        } else if (typeof newDate === 'number') {
            window.appState.currentDate = new Date(newDate);
        } else {
            window.appState.currentDate = window.timeUtils.parseStringToUTC(newDate);
        }
        
        // По умолчанию используем целые числа при установке даты
        this.recalculateCurrentDay(false);
        window.waves.updatePosition();
        window.grid.updateCenterDate();
        window.grid.updateGridNotesHighlight();
        window.appState.save();
        
        this.updateTodayButton();
        
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
        // Возвращаем в UTC
        return window.timeUtils.nowUTC();
    }
    
    getWeekday(date) {
        // Используем TimeUtils
        return window.timeUtils.getWeekdayUTC(date);
    }
    
    getWeekdayName(date, full = false) {
        // Используем TimeUtils
        return window.timeUtils.getWeekdayNameUTC(date, full);
    }
    
    cleanupEditingHandlers() {
        document.querySelectorAll('.date-item.editing').forEach(item => {
            if (item._clickOutsideHandler) {
                document.removeEventListener('click', item._clickOutsideHandler);
                delete item._clickOutsideHandler;
            }
        });
    }
    
    updateCurrentDayElement() {
        const currentDayElement = document.getElementById('currentDay');
        if (currentDayElement) {
            const currentDayValue = window.appState.currentDay || 0;
            // Используем TimeUtils для форматирования
            currentDayElement.textContent = window.timeUtils.formatCurrentDayWithSecondsUTC(
                currentDayValue, 
                window.appState.currentDate
            );
            console.log('DatesManager: DOM элемент currentDay обновлен:', currentDayElement.textContent);
        } else {
            console.warn('DatesManager: элемент currentDay не найден в DOM');
        }
    }
    
    forceInitialize() {
        console.log('=== FORCE INITIALIZE (UTC) ===');
        
        // Устанавливаем ТОЧНОЕ время в UTC
        window.appState.currentDate = window.timeUtils.nowUTC();
        
        this.recalculateCurrentDay(true); // При инициализации используем ДРОБНЫЕ числа (учитываем время)
        
        if (window.appState.activeDateId) {
            console.log('Принудительная установка активной даты (UTC):', window.appState.activeDateId);
            this.setActiveDate(window.appState.activeDateId, true);
        } else if (window.appState.data.dates.length > 0) {
            console.log('Нет активной даты, выбираем первую из списка (UTC)');
            const firstDateId = window.appState.data.dates[0].id;
            window.appState.activeDateId = firstDateId;
            this.setActiveDate(firstDateId, true);
        } else {
            console.log('Нет дат в списке, устанавливаем базовую дату (UTC)');
            window.appState.baseDate = window.timeUtils.nowTimestamp();
            this.recalculateCurrentDay(true);
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
        
        console.log('=== FORCE INITIALIZE завершен (UTC) ===');
        console.log('activeDateId:', window.appState?.activeDateId);
        console.log('currentDay:', window.appState?.currentDay);
        console.log('currentDate (UTC):', window.appState?.currentDate?.toUTCString());
    }
}

window.dates = new DatesManager();