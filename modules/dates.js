// optimized3/modules/dates.js
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
    
	setActiveDate(dateId) {
		console.log('=== setActiveDate(' + dateId + ') ===');
		
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
				window.appState.baseDate = dateObj.date; // Устанавливаем timestamp
				console.log('DatesManager: установлена базовая дата (timestamp):', dateObj.date);
			} catch (error) {
				console.error('Error setting active date:', error);
				window.appState.baseDate = Date.now();
			}
		}
		
		this.recalculateCurrentDay();
		console.log('currentDay после recalculate:', window.appState.currentDay);
		
		this.updateCurrentDayElement();
		
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
		
		if (window.dataManager && window.dataManager.updateDateList) {
			window.dataManager.updateDateList();
		}
		
		this.updateTodayButton();
		
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
        
        let daysDiff;
        
        if (useExactTime) {
            // ТОЧНЫЙ расчет разницы в днях (с дробной частью для учета времени)
            const timeDiffMs = currentDateObj.getTime() - baseDateObj.getTime();
            daysDiff = timeDiffMs / (1000 * 60 * 60 * 24); // Дробное значение
            console.log('Расчет с точным временем (дробный):', daysDiff);
        } else {
            // ЦЕЛЫЙ расчет разницы в днях (только даты, без времени)
            const utc1 = Date.UTC(
                baseDateObj.getFullYear(), 
                baseDateObj.getMonth(), 
                baseDateObj.getDate()
            );
            const utc2 = Date.UTC(
                currentDateObj.getFullYear(), 
                currentDateObj.getMonth(), 
                currentDateObj.getDate()
            );
            
            daysDiff = Math.floor((utc2 - utc1) / (1000 * 60 * 60 * 24));
            console.log('Расчет без времени (целый):', daysDiff);
        }
        
        window.appState.currentDay = daysDiff;
        window.appState.virtualPosition = daysDiff * window.appState.config.squareSize;
        
        console.log('Результат:');
        console.log('  baseDate (timestamp):', window.appState.baseDate);
        console.log('  baseDate (объект):', baseDateObj.toISOString());
        console.log('  currentDate:', currentDateObj.toISOString());
        console.log('  currentDay:', window.appState.currentDay);
        console.log('  virtualPosition:', window.appState.virtualPosition);
        
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
        
        console.log('=== goToNow() завершен ===');
    }
    
    setDateFromInput() {
        const dateValue = this.elements.mainDateInput.value;
        if (dateValue) {
            const newDate = new Date(dateValue);
            // Устанавливаем на начало дня для даты из инпута
            newDate.setHours(0, 0, 0, 0);
            window.appState.currentDate = new Date(newDate);
            this.recalculateCurrentDay(false); // Целые числа для дат из инпута
            window.grid.createGrid();
            window.grid.updateCenterDate();
            window.waves.updatePosition();
            window.appState.save();
            
            this.updateTodayButton();
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
    
    updateCurrentDayElement() {
        const currentDayElement = document.getElementById('currentDay');
        if (currentDayElement) {
            const currentDayValue = window.appState.currentDay || 0;
            // Для дробных чисел отображаем с точностью до 3 знаков, для целых - без
            if (Math.floor(currentDayValue) === currentDayValue) {
                currentDayElement.textContent = currentDayValue;
            } else {
                currentDayElement.textContent = currentDayValue.toFixed(3);
            }
            console.log('DatesManager: DOM элемент currentDay обновлен:', currentDayElement.textContent);
        } else {
            console.warn('DatesManager: элемент currentDay не найден в DOM');
        }
    }
    
    forceInitialize() {
        console.log('=== FORCE INITIALIZE ===');
        
        this.recalculateCurrentDay(false); // При инициализации используем целые числа
        
        if (window.appState.activeDateId) {
            console.log('Принудительная установка активной даты:', window.appState.activeDateId);
            this.setActiveDate(window.appState.activeDateId);
        } else if (window.appState.data.dates.length > 0) {
            console.log('Нет активной даты, выбираем первую из списка');
            const firstDateId = window.appState.data.dates[0].id;
            window.appState.activeDateId = firstDateId;
            this.setActiveDate(firstDateId);
        } else {
            console.log('Нет дат в списке, устанавливаем базовую дату');
            window.appState.baseDate = new Date().getTime();
            this.recalculateCurrentDay(false);
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