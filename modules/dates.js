// modules/dates.js - ПОЛНОСТЬЮ ОБНОВЛЕННЫЙ с использованием TimeUtils
class DatesManager {
    constructor() {
        this.elements = {};
        this.cacheElements();
    }
    
    cacheElements() {
        const ids = [
            'dateInput', 'dateNameInput', 'btnAddDate', 'dateListForDates',
            'mainDateInputDate', 'mainDateInputTime', 'btnSetDate', 'currentDay', 'btnPrevDay',
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
        const today = window.timeUtils.now();
        const vizorDate = window.appState.currentDate;
        
        // Сравниваем даты в UTC (только год, месяц, день)
        const todayStart = new Date(Date.UTC(
            today.getFullYear(),
            today.getMonth(),
            today.getDate()
        ));
        const vizorStart = new Date(Date.UTC(
            vizorDate.getFullYear(),
            vizorDate.getMonth(),
            vizorDate.getDate()
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
            const utcDate = window.timeUtils.parseStringToLocal(dateValue);
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
                const utcDate = window.timeUtils.parseStringToLocal(updates.date);
                updates.date = utcDate.getTime();
            }
            Object.assign(date, updates);
            window.appState.save();
        }
    }
    
    setActiveDate(dateId, useExactTime = false) {
        console.log('=== setActiveDate(' + dateId + ', useExactTime=' + useExactTime + ') ===');
        
        const oldActiveId = window.appState.activeDateId;
        window.appState.activeDateId = dateId;
        
        const dateIdStr = String(dateId);
        const dateObj = window.appState.data.dates.find(d => String(d.id) === dateIdStr);
        
        if (!dateObj) {
            console.warn('DatesManager: дата не найдена, устанавливаем базовую дату на сейчас');
            // Устанавливаем начало текущего дня в ЛОКАЛЬНОМ времени
            const now = new Date();
            window.appState.baseDate = new Date(
                now.getFullYear(),
                now.getMonth(),
                now.getDate(),
                0, 0, 0, 0
            ).getTime();
        } else {
            try {
                // Устанавливаем baseDate как ЛОКАЛЬНОЕ начало дня выбранной даты
                const selectedDate = new Date(dateObj.date);
                const startOfDay = new Date(
                    selectedDate.getFullYear(),
                    selectedDate.getMonth(),
                    selectedDate.getDate(),
                    0, 0, 0, 0
                );
                
                window.appState.baseDate = startOfDay.getTime();
                
                console.log('DatesManager: установлена базовая дата (локальное начало дня):', 
                    startOfDay.toLocaleString(),
                    'timestamp:', window.appState.baseDate);
            } catch (error) {
                console.error('Error setting active date:', error);
                const now = new Date();
                window.appState.baseDate = new Date(
                    now.getFullYear(),
                    now.getMonth(),
                    now.getDate(),
                    0, 0, 0, 0
                ).getTime();
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
        
        // ОБНОВЛЯЕМ ПОЛЯ ВВОДА ПОСЛЕ УСТАНОВКИ ДАТЫ
        this.updateDateTimeInputs();
        
        console.log('=== setActiveDate() завершен ===');
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
		// Приводим целевую дату к локальному времени
		const targetDate = window.timeUtils.toLocalDate(date);
		const targetStart = window.timeUtils.getStartOfDay(targetDate);
		const targetEnd = new Date(targetStart.getTime() + 24 * 60 * 60 * 1000);
		
		// Конвертируем timestamp заметок в локальные даты для сравнения
		return window.appState.data.notes.filter(note => {
			const noteDate = window.timeUtils.toLocalDate(note.date);
			return noteDate >= targetStart && noteDate < targetEnd;
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
		console.log('=== navigateDay(' + delta + ') вызван (локальное время) ===');
		console.log('До: currentDate (локальное):', window.appState.currentDate.toLocaleString());
		console.log('До: currentDay:', window.appState.currentDay);
		
		// Создаем новую дату (не мутируем существующую)
		const newDate = new Date(window.appState.currentDate);
		newDate.setDate(newDate.getDate() + delta);
		
		window.appState.currentDate = window.timeUtils ? 
			window.timeUtils.toLocalDate(newDate) : 
			newDate;
		
		this.recalculateCurrentDay(false); // Навигация по дням использует целые числа
		window.waves.updatePosition();
		window.grid.createGrid();
		window.grid.updateCenterDate();
		window.grid.updateGridNotesHighlight();
		window.appState.save();
		
		console.log('После: currentDate (локальное):', window.appState.currentDate.toLocaleString());
		console.log('После: currentDay:', window.appState.currentDay);
		
		this.updateTodayButton();
		
		if (window.summaryManager && window.summaryManager.updateSummary) {
			setTimeout(() => {
				window.summaryManager.updateSummary();
			}, 50);
		}
		
		// ОБНОВЛЯЕМ ПОЛЯ ВВОДА
		this.updateDateTimeInputs();
		
		console.log('=== navigateDay() завершен ===');
	}
    
	// modules/dates.js - ИСПРАВЛЕННЫЙ метод recalculateCurrentDay
	recalculateCurrentDay(useExactTime = false) {
		console.log('=== ДЕТАЛЬНЫЙ ДЕБАГ ДРОБНОЙ ЧАСТИ ===');
		
		// 1. Получаем currentDate
		const currentDate = window.appState.currentDate;
		console.log('1. currentDate:');
		console.log('   Локальное:', currentDate.toLocaleString());
		console.log('   Часы (локально):', currentDate.getHours());
		console.log('   Минуты (локально):', currentDate.getMinutes());
		console.log('   Секунды (локально):', currentDate.getSeconds());
		
		// 2. Получаем baseDate
		let baseDate;
		if (typeof window.appState.baseDate === 'number') {
			baseDate = new Date(window.appState.baseDate);
		} else {
			baseDate = new Date(window.appState.baseDate);
		}
		
		console.log('2. baseDate:');
		console.log('   Локальное:', baseDate.toLocaleString());
		console.log('   Часы (локально):', baseDate.getHours());
		
		// 3. Используем UTC компоненты для точного расчета дней
		const utcCurrent = Date.UTC(
			currentDate.getFullYear(),
			currentDate.getMonth(),
			currentDate.getDate()
		);
		
		const utcBase = Date.UTC(
			baseDate.getFullYear(),
			baseDate.getMonth(),
			baseDate.getDate()
		);
		
		const diffMsStart = utcCurrent - utcBase;
		const daysStart = diffMsStart / (1000 * 60 * 60 * 24);
		
		console.log('3. Разница в UTC днях:');
		console.log('   мс:', diffMsStart);
		console.log('   дней:', daysStart);
		console.log('   целых дней:', Math.floor(daysStart));
		
		// 4. Вычисляем дробную часть от времени суток (только локальное время)
		const hours = currentDate.getHours();
		const minutes = currentDate.getMinutes();
		const seconds = currentDate.getSeconds();
		const milliseconds = currentDate.getMilliseconds();
		
		const timeOfDayFraction = (
			(hours * 60 * 60 * 1000) +
			(minutes * 60 * 1000) +
			(seconds * 1000) +
			milliseconds
		) / (24 * 60 * 60 * 1000);
		
		console.log('4. Время суток (локальное):');
		console.log('   Часы:', hours, 'Минуты:', minutes, 'Секунды:', seconds);
		console.log('   Дробная часть дня:', timeOfDayFraction.toFixed(8));
		
		// 5. Вычисляем окончательный результат
		let daysDiff;
		if (useExactTime) {
			// Для "Сейчас": целые дни UTC + дробная часть времени суток
			daysDiff = Math.floor(daysStart) + timeOfDayFraction;
			console.log('Используем РЕАЛЬНОЕ время:', daysDiff);
			console.log('  Целые дни (UTC):', Math.floor(daysStart));
			console.log('  Время суток:', timeOfDayFraction.toFixed(8));
			console.log('  Общее:', daysDiff.toFixed(8));
		} else {
			// Для "Сегодня": только целые дни UTC
			daysDiff = Math.round(daysStart);
			console.log('Используем начало дня (UTC целые числа):', daysDiff);
		}
		
		window.appState.currentDay = daysDiff;
		window.appState.virtualPosition = daysDiff * window.appState.config.squareSize;
		
		console.log('Финальный currentDay:', window.appState.currentDay);
		
		this.updateCurrentDayElement();
		window.appState.save();
		
		return window.appState.currentDay;
	}
    
    goToToday() {
        console.log('=== goToToday() вызван (локальное время) ===');
        
        // Получаем начало текущего дня в локальном времени
        const todayStart = window.timeUtils.getStartOfDay(new Date());
        
        window.appState.currentDate = new Date(todayStart);
        
        console.log('После установки currentDate (локальное начало дня):', 
            window.appState.currentDate.toLocaleString());
        
        // Пересчитываем с целыми числами
        this.recalculateCurrentDay(false);
        
        console.log('После recalculateCurrentDay:');
        console.log('  currentDay (целое число):', window.appState.currentDay);
        console.log('  currentDate (локальное):', window.appState.currentDate.toLocaleString());
        
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
        
        // ОБНОВЛЯЕМ ПОЛЯ ВВОДА
        this.updateDateTimeInputs();
        
        console.log('=== goToToday() завершен ===');
    }
    
    goToNow() {
        console.log('=== goToNow() вызван (локальное время) ===');
        
        // Получаем текущее точное локальное время
        window.appState.currentDate = new Date();
        
        console.log('После установки currentDate (локальное точное время):', 
            window.appState.currentDate.toLocaleString());
        console.log('Локальное время:', 
            window.appState.currentDate.getHours(), 'часов',
            window.appState.currentDate.getMinutes(), 'минут',
            window.appState.currentDate.getSeconds(), 'секунд');
        
        // Пересчитываем с дробными числами (с учетом времени)
        this.recalculateCurrentDay(true);
        
        console.log('После recalculateCurrentDay:');
        console.log('  currentDay (с точностью до секунд):', window.appState.currentDay);
        console.log('  currentDate (локальное):', window.appState.currentDate.toLocaleString());
        
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
        
        // ОБНОВЛЯЕМ ПОЛЯ ВВОДА
        this.updateDateTimeInputs();
        
        console.log('=== goToNow() завершен ===');
    }
    
    /**
     * Устанавливает дату из раздельных полей ввода
     */
    setDateFromInputs() {
        const dateValue = this.elements.mainDateInputDate?.value;
        const timeValue = this.elements.mainDateInputTime?.value;
        
        if (dateValue) {
            // Используем TimeUtils для парсинга раздельных полей
            const newDate = window.timeUtils.parseFromDateAndTimeInputs(dateValue, timeValue);
            
            // Устанавливаем как локальное время
            window.appState.currentDate = newDate;
            
            console.log('Дата из полей ввода (локальное):', 
                `Дата: ${dateValue}, Время: ${timeValue || '00:00:00'}`);
            
            // Всегда используем ДРОБНЫЙ расчет при установке из инпута
            // потому что мы задаем конкретное время
            this.recalculateCurrentDay(true);
            
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
        }
    }
    
    /**
     * Устанавливает дату из старого единого поля (обратная совместимость)
     * @deprecated Используйте setDateFromInputs() для новых полей
     */
    setDateFromInput() {
        console.warn('setDateFromInput() устарел, используйте setDateFromInputs()');
        this.setDateFromInputs();
    }
    
    /**
     * Обновляет значения в полях ввода даты и времени
     */
    updateDateTimeInputs() {
        if (window.uiManager && window.uiManager.updateDateTimeInputs) {
            window.uiManager.updateDateTimeInputs();
        }
    }
    
    debugDateInfo() {
        console.log('=== ДЕБАГ ИНФОРМАЦИЯ О ДАТАХ ===');
        console.log('baseDate:', new Date(window.appState.baseDate).toLocaleString());
        console.log('baseDate timestamp:', window.appState.baseDate);
        console.log('baseDate часы:', new Date(window.appState.baseDate).getHours());
        
        console.log('currentDate:', window.appState.currentDate.toLocaleString());
        console.log('currentDate timestamp:', window.appState.currentDate.getTime());
        console.log('currentDate часы:', window.appState.currentDate.getHours());
        
        console.log('currentDay:', window.appState.currentDay);
        console.log('=======================');
    }
    
// modules/dates.js - метод setDate()
setDate(newDate, useExactTime = true) { // ← ДОБАВЛЯЕМ ПАРАМЕТР useExactTime
    window.appState.isProgrammaticDateChange = true;
    
    if (newDate instanceof Date) {
        window.appState.currentDate = window.timeUtils.toLocalDate(newDate);
    } else if (typeof newDate === 'number') {
        window.appState.currentDate = new Date(newDate);
    } else {
        window.appState.currentDate = window.timeUtils.parseStringToLocal(newDate);
    }
    
    // Используем переданный параметр useExactTime вместо жесткого false
    this.recalculateCurrentDay(useExactTime); // ← ВОТ ЗДЕСЬ ИСПРАВЛЕНИЕ
    
    window.waves.updatePosition();
    window.grid.createGrid(); // ← Добавляем createGrid для перерисовки сетки
    window.grid.updateCenterDate();
    window.grid.updateGridNotesHighlight();
    window.appState.save();
    
    this.updateTodayButton();
    
    if (window.summaryManager && window.summaryManager.updateSummary) {
        setTimeout(() => {
            window.summaryManager.updateSummary();
        }, 50);
    }
    
    // ОБНОВЛЯЕМ ПОЛЯ ВВОДА
    this.updateDateTimeInputs();
    
    setTimeout(() => {
        window.appState.isProgrammaticDateChange = false;
    }, 100);
}
    
    getCurrentDate() {
        // Возвращаем в UTC
        return window.timeUtils.now();
    }
    
    getWeekday(date) {
        // Используем TimeUtils
        return window.timeUtils.getWeekday(date);
    }
    
    getWeekdayName(date, full = false) {
        // Используем TimeUtils
        return window.timeUtils.getWeekdayName(date, full);
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
            currentDayElement.textContent = window.timeUtils.formatCurrentDayWithSeconds(
                currentDayValue, 
                window.appState.currentDate
            );
            console.log('DatesManager: DOM элемент currentDay обновлен:', currentDayElement.textContent);
        } else {
            console.warn('DatesManager: элемент currentDay не найден в DOM');
        }
    }
    
    forceInitialize() {
        console.log('=== FORCE INITIALIZE (ЛОКАЛЬНОЕ ВРЕМЯ) ===');
        
        // Устанавливаем ТОЧНОЕ локальное время
        window.appState.currentDate = window.timeUtils.now();
        
        this.recalculateCurrentDay(true); // При инициализации используем ДРОБНЫЕ числа
        
        // ОБНОВЛЯЕМ ПОЛЯ ВВОДА
        this.updateDateTimeInputs();
        
        if (window.appState.activeDateId) {
            console.log('Принудительная установка активной даты (локальное время):', window.appState.activeDateId);
            this.setActiveDate(window.appState.activeDateId, true);
        } else if (window.appState.data.dates.length > 0) {
            console.log('Нет активной даты, выбираем первую из списка (локальное время)');
            const firstDateId = window.appState.data.dates[0].id;
            window.appState.activeDateId = firstDateId;
            this.setActiveDate(firstDateId, true);
        } else {
            console.log('Нет дат в списке, устанавливаем базовую дату (локальное время)');
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
        
        console.log('=== FORCE INITIALIZE завершен (локальное время) ===');
        console.log('activeDateId:', window.appState?.activeDateId);
        console.log('currentDay:', window.appState?.currentDay);
        console.log('currentDate (локальное):', window.appState?.currentDate?.toLocaleString());
    }
}

window.dates = new DatesManager();