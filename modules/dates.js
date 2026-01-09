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
            if (updates.date && typeof updates.date !== 'number') {
                const utcDate = window.timeUtils.parseStringToLocal(updates.date);
                updates.date = utcDate.getTime();
            }
            Object.assign(date, updates);
            window.appState.save();
        }
    }
    
    setActiveDate(dateId, useExactTime = false) {
        const oldActiveId = window.appState.activeDateId;
        window.appState.activeDateId = dateId;
        
        const dateIdStr = String(dateId);
        const dateObj = window.appState.data.dates.find(d => String(d.id) === dateIdStr);
        
        if (!dateObj) {
            const now = new Date();
            window.appState.baseDate = new Date(
                now.getFullYear(),
                now.getMonth(),
                now.getDate(),
                0, 0, 0, 0
            ).getTime();
        } else {
            try {
                const selectedDate = new Date(dateObj.date);
                const startOfDay = new Date(
                    selectedDate.getFullYear(),
                    selectedDate.getMonth(),
                    selectedDate.getDate(),
                    0, 0, 0, 0
                );
                
                window.appState.baseDate = startOfDay.getTime();
            } catch (error) {
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
        
        this.updateCurrentDayElement();
        
        if (window.dataManager && window.dataManager.updateDateList) {
            window.dataManager.updateDateList();
        }
        
        if (oldActiveId !== dateId) {
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

		// ДОБАВИТЬ ЭТО:
		if (window.extremumTimeManager && window.extremumTimeManager.updateExtremums) {
			window.extremumTimeManager.updateExtremums();
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
        
        this.updateDateTimeInputs();
    }
    
    addNote(content) {
        if (!content.trim()) {
            alert('Пожалуйста, введите текст записи');
            return null;
        }
        
        const note = {
            id: window.appState.generateId(),
            date: window.appState.currentDate.getTime(),
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
		const targetDate = window.timeUtils.toLocalDate(date);
		const targetStart = window.timeUtils.getStartOfDay(targetDate);
		const targetEnd = new Date(targetStart.getTime() + 24 * 60 * 60 * 1000);
		
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
		const newDate = new Date(window.appState.currentDate);
		newDate.setDate(newDate.getDate() + delta);
		
		window.appState.currentDate = window.timeUtils ? 
			window.timeUtils.toLocalDate(newDate) : 
			newDate;
		
		this.recalculateCurrentDay(false);
		window.waves.updatePosition();
		window.grid.createGrid();
		window.grid.updateCenterDate();
		window.grid.updateGridNotesHighlight();
		window.appState.save();
		
		this.updateTodayButton();
		
		if (window.summaryManager && window.summaryManager.updateSummary) {
			setTimeout(() => {
				window.summaryManager.updateSummary();
			}, 50);
		}
		
		this.updateDateTimeInputs();
	}
    
	recalculateCurrentDay(useExactTime = false) {
		const currentDate = window.appState.currentDate;
		
		let baseDate;
		if (typeof window.appState.baseDate === 'number') {
			baseDate = new Date(window.appState.baseDate);
		} else {
			baseDate = new Date(window.appState.baseDate);
		}
		
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
		
		let daysDiff;
		if (useExactTime) {
			daysDiff = Math.floor(daysStart) + timeOfDayFraction;
		} else {
			daysDiff = Math.round(daysStart);
		}
		
		window.appState.currentDay = daysDiff;
		window.appState.virtualPosition = daysDiff * window.appState.config.squareSize;
		
		this.updateCurrentDayElement();
		window.appState.save();
		
		return window.appState.currentDay;
	}
    
    goToToday() {
        const todayStart = window.timeUtils.getStartOfDay(new Date());
        
        window.appState.currentDate = new Date(todayStart);
        
        this.recalculateCurrentDay(false);
        
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
        
        this.updateDateTimeInputs();
    }
    
    goToNow() {
        window.appState.currentDate = new Date();
        
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
        
        this.updateDateTimeInputs();
    }
    
    setDateFromInputs() {
        const dateValue = this.elements.mainDateInputDate?.value;
        const timeValue = this.elements.mainDateInputTime?.value;
        
        if (dateValue) {
            const newDate = window.timeUtils.parseFromDateAndTimeInputs(dateValue, timeValue);
            
            window.appState.currentDate = newDate;
            
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
        }
    }
    
    setDateFromInput() {
        this.setDateFromInputs();
    }
    
    updateDateTimeInputs() {
        if (window.uiManager && window.uiManager.updateDateTimeInputs) {
            window.uiManager.updateDateTimeInputs();
        }
    }
    
    debugDateInfo() {
    }
    
setDate(newDate, useExactTime = true) {
    window.appState.isProgrammaticDateChange = true;
    
    if (newDate instanceof Date) {
        window.appState.currentDate = window.timeUtils.toLocalDate(newDate);
    } else if (typeof newDate === 'number') {
        window.appState.currentDate = new Date(newDate);
    } else {
        window.appState.currentDate = window.timeUtils.parseStringToLocal(newDate);
    }
    
    this.recalculateCurrentDay(useExactTime);
    
    window.waves.updatePosition();
    window.grid.createGrid();
    window.grid.updateCenterDate();
    window.grid.updateGridNotesHighlight();
    window.appState.save();
    
    this.updateTodayButton();
    
    if (window.summaryManager && window.summaryManager.updateSummary) {
        setTimeout(() => {
            window.summaryManager.updateSummary();
        }, 50);
    }
    
    this.updateDateTimeInputs();
    
    setTimeout(() => {
        window.appState.isProgrammaticDateChange = false;
    }, 100);
}
    
    getCurrentDate() {
        return window.timeUtils.now();
    }
    
    getWeekday(date) {
        return window.timeUtils.getWeekday(date);
    }
    
    getWeekdayName(date, full = false) {
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
            currentDayElement.textContent = window.timeUtils.formatCurrentDayWithSeconds(
                currentDayValue, 
                window.appState.currentDate
            );
        }
    }
    
    forceInitialize() {
        window.appState.currentDate = window.timeUtils.now();
        
        this.recalculateCurrentDay(true);
        
        this.updateDateTimeInputs();
        
        if (window.appState.activeDateId) {
            this.setActiveDate(window.appState.activeDateId, true);
        } else if (window.appState.data.dates.length > 0) {
            const firstDateId = window.appState.data.dates[0].id;
            window.appState.activeDateId = firstDateId;
            this.setActiveDate(firstDateId, true);
        } else {
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
    }
}

window.dates = new DatesManager();