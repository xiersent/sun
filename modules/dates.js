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
            'btnNextDay', 'btnToday', 'noteInput', 'btnAddNote',
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
    
    // НОВАЯ ФУНКЦИЯ: Проверка, отображается ли текущая дата на визоре
    isCurrentDateOnVizor() {
        const today = new Date();
        const vizorDate = window.appState.currentDate;
        
        // Сравниваем только даты (без времени)
        return today.toDateString() === vizorDate.toDateString();
    }
    
    // НОВАЯ ФУНКЦИЯ: Обновление вида кнопки "Сегодня"
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
        const date = new Date(dateValue);
        const newDate = {
            id: window.appState.generateId(),
            date: date.toISOString(),
            name: name || 'Новая дата'
        };
        
        window.appState.data.dates.push(newDate);
        window.appState.save();
        
        // Очищаем поле ввода названия даты
        if (this.elements.dateNameInput) {
            this.elements.dateNameInput.value = '';
        }
        
        this.setActiveDate(newDate.id);
        
        return newDate;
    }
    
    deleteDate(dateId) {
        if (!confirm('Уничтожить эту дату?')) return;
        
        // Приводим dateId к строке для поиска
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
            Object.assign(date, updates);
            window.appState.save();
        }
    }
    
    setActiveDate(dateId) {
        console.log('DatesManager: установка активной даты:', dateId);
        
        // Приводим dateId к строке для поиска
        const dateIdStr = String(dateId);
        const dateObj = window.appState.data.dates.find(d => String(d.id) === dateIdStr);
        if (!dateObj) {
            console.error('DatesManager: дата не найдена:', dateId);
            return;
        }
        
        window.appState.activeDateId = dateId;
        
        try {
            const date = new Date(dateObj.date);
            if (isNaN(date.getTime())) {
                throw new Error('Некорректная дата в объекте');
            }
        
            window.appState.baseDate = new Date(date);
            
            console.log('DatesManager: установлена базовая дата:', dateObj.date,
                        'текущая дата визора осталась:', window.appState.currentDate);
            
            // ВАЖНО: Пересчитываем текущий день
            this.recalculateCurrentDay();
            console.log('DatesManager: currentDay после recalculate:', window.appState.currentDay);
            
            // ВАЖНО: Обновляем DOM элемент currentDay
            this.updateCurrentDayElement();
            
            // ВАЖНО: Удалить старые контейнеры волн
            document.querySelectorAll('.wave-container').forEach(c => c.remove());
            if (window.waves) {
                window.waves.waveContainers = {};
                window.waves.wavePaths = {};
            }
            
            // ВАЖНО: Создать элементы волн заново
            if (window.waves && window.waves.createVisibleWaveElements) {
                window.waves.createVisibleWaveElements();
            }
            
            if (window.waves && window.waves.updatePosition) {
                window.waves.updatePosition();
            }
            
            if (window.waves && window.waves.updateCornerSquareColors) {
                window.waves.updateCornerSquareColors();
            }
            
            // Пересоздаем grid
            if (window.grid && window.grid.createGrid) {
                window.grid.createGrid();
            }
            
            if (window.grid && window.grid.updateCenterDate) {
                window.grid.updateCenterDate();
                window.grid.updateGridNotesHighlight();
            }
            
            window.appState.save();
            
            console.log('DatesManager: активная дата установлена, графики пересчитаны');
            
        } catch (error) {
            console.error('Error setting active date:', error);
            window.appState.baseDate = new Date();
            window.appState.currentDate = new Date();
            this.recalculateCurrentDay();
            this.updateCurrentDayElement();
            window.appState.save();
        } finally {
            // ВАЖНО: Обновить UI списка дат ПОСЛЕ установки активной даты
            if (window.dataManager && window.dataManager.updateDateList) {
                window.dataManager.updateDateList();
            }
        }
    }
    
    recalculateCurrentDay() {
        console.log('DatesManager: пересчет currentDay...');
        console.log('baseDate:', window.appState.baseDate);
        console.log('currentDate:', window.appState.currentDate);
        console.log('activeDateId:', window.appState.activeDateId);
        
        // Гарантия: оба объекта должны быть Date
        const baseDate = window.appState.baseDate instanceof Date ? 
            new Date(window.appState.baseDate) : new Date();
        
        const currentDate = window.appState.currentDate instanceof Date ? 
            new Date(window.appState.currentDate) : new Date();
        
        // Расчет разницы в днях
        const utc1 = Date.UTC(baseDate.getFullYear(), baseDate.getMonth(), baseDate.getDate());
        const utc2 = Date.UTC(currentDate.getFullYear(), currentDate.getMonth(), currentDate.getDate());
        const daysDiff = Math.floor((utc2 - utc1) / (1000 * 60 * 60 * 24));
        
        window.appState.currentDay = daysDiff;
        window.appState.virtualPosition = daysDiff * window.appState.config.squareSize;
        
        console.log('currentDay рассчитан:', window.appState.currentDay, 'дней');
        console.log('virtualPosition:', window.appState.virtualPosition, 'px');
        
        // ВАЖНО: Обновляем DOM элемент currentDay сразу после расчета
        this.updateCurrentDayElement();
        
        // Гарантия: сохраняем состояние
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
            date: new Date(window.appState.currentDate),
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
        return window.appState.data.notes.filter(note => {
            const noteDate = new Date(note.date);
            const targetDate = new Date(date);
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
        window.appState.currentDate.setDate(window.appState.currentDate.getDate() + delta);
        this.recalculateCurrentDay();
        window.waves.updatePosition();
        window.grid.createGrid();
        window.grid.updateCenterDate();
        window.grid.updateGridNotesHighlight();
        window.appState.save();
        
        // ОБНОВЛЯЕМ КНОПКУ "СЕГОДНЯ"
        this.updateTodayButton();
    }
    
    goToToday() {
        const today = new Date();
        window.appState.currentDate = new Date(today);
        this.recalculateCurrentDay();
        window.grid.createGrid();
        window.grid.updateCenterDate();
        window.waves.updatePosition();
        window.appState.save();
        
        // ОБНОВЛЯЕМ КНОПКУ "СЕГОДНЯ" (после перехода на сегодня)
        this.updateTodayButton();
    }
    
    setDateFromInput() {
        const dateValue = this.elements.mainDateInput.value;
        if (dateValue) {
            const newDate = new Date(dateValue);
            window.appState.currentDate = new Date(newDate);
            this.recalculateCurrentDay();
            window.grid.createGrid();
            window.grid.updateCenterDate();
            window.waves.updatePosition();
            window.appState.save();
            
            // ОБНОВЛЯЕМ КНОПКУ "СЕГОДНЯ"
            this.updateTodayButton();
        }
    }
    
    setDate(newDate) {
        window.appState.isProgrammaticDateChange = true;
        window.appState.currentDate = new Date(newDate);
        this.recalculateCurrentDay();
        window.waves.updatePosition();
        window.grid.updateCenterDate();
        window.grid.updateGridNotesHighlight();
        window.appState.save();
        
        // ОБНОВЛЯЕМ КНОПКУ "СЕГОДНЯ"
        this.updateTodayButton();
        
        setTimeout(() => {
            window.appState.isProgrammaticDateChange = false;
        }, 100);
    }
    
    getCurrentDate() {
        return new Date();
    }
    
    getWeekday(date) {
        if (!(date instanceof Date)) {
            date = new Date(date);
        }
        return date.getDay();
    }
    
    getWeekdayName(date, full = false) {
        if (!(date instanceof Date)) {
            date = new Date(date);
        }
        const weekday = this.getWeekday(date);
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
    
    // НОВЫЙ МЕТОД: Обновление DOM элемента currentDay
    updateCurrentDayElement() {
        const currentDayElement = document.getElementById('currentDay');
        if (currentDayElement) {
            const currentDayValue = window.appState.currentDay || 0;
            currentDayElement.textContent = currentDayValue;
            console.log('DatesManager: DOM элемент currentDay обновлен:', currentDayValue);
        } else {
            console.warn('DatesManager: элемент currentDay не найден в DOM');
        }
    }
}

window.dates = new DatesManager();