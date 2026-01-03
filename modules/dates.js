// modules/dates.js - ПОЛНОСТЬЮ ПЕРЕРАБОТАННЫЙ С UTC
class DatesManager {
    constructor() {
        this.elements = {};
        this.cacheElements();
        this.setupEventListeners();
        this.lastUpdateTime = 0;
        this.updateThrottle = 100; // Защита от слишком частых обновлений
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
    
    setupEventListeners() {
        // Кнопка "Сегодня"
        const btnToday = document.getElementById('btnToday');
        if (btnToday) {
            btnToday.addEventListener('click', () => {
                this.goToToday();
            });
        }
        
        // Кнопка "Сейчас"
        const btnNow = document.getElementById('btnNow');
        if (btnNow) {
            btnNow.addEventListener('click', () => {
                this.goToNow();
            });
        }
        
        // Кнопка установки даты из инпута
        const btnSetDate = document.getElementById('btnSetDate');
        if (btnSetDate) {
            btnSetDate.addEventListener('click', () => {
                this.setDateFromInput();
            });
        }
        
        // Enter в основном инпуте даты
        const mainDateInput = document.getElementById('mainDateInput');
        if (mainDateInput) {
            mainDateInput.addEventListener('keydown', (e) => {
                if (e.key === 'Enter') {
                    this.setDateFromInput();
                }
            });
        }
        
        // Кнопки навигации
        const btnPrevDay = document.getElementById('btnPrevDay');
        if (btnPrevDay) {
            btnPrevDay.addEventListener('click', () => {
                this.navigateDay(-1);
            });
        }
        
        const btnNextDay = document.getElementById('btnNextDay');
        if (btnNextDay) {
            btnNextDay.addEventListener('click', () => {
                this.navigateDay(1);
            });
        }
        
        // Добавление даты
        const btnAddDate = document.getElementById('btnAddDate');
        if (btnAddDate) {
            btnAddDate.addEventListener('click', () => {
                this.addDateFromForm();
            });
        }
    }
    
    // ================ ОСНОВНЫЕ МЕТОДЫ ================
    
    /**
     * Проверяет, находится ли текущая дата на визоре
     * Сравнивает только даты (год, месяц, день) в UTC
     * @returns {boolean} true если сегодня на визоре
     */
    isCurrentDateOnVizor() {
        if (!window.appState || !window.timeUtils) return false;
        
        const today = window.timeUtils.nowUTC();
        const vizorDate = window.appState.currentDate;
        
        // Сравниваем только даты в UTC
        const todayStart = window.timeUtils.getStartOfDayUTC(today);
        const vizorStart = window.timeUtils.getStartOfDayUTC(vizorDate);
        
        return todayStart.getTime() === vizorStart.getTime();
    }
    
    /**
     * Обновляет состояние кнопки "Сегодня"
     */
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
    
    /**
     * Добавляет новую дату
     * @param {string|Date|number} dateValue - Дата в любом формате
     * @param {string} name - Название даты
     * @returns {Object} Созданный объект даты
     */
    addDate(dateValue, name) {
        if (!window.appState || !window.timeUtils) return null;
        
        let timestamp;
        
        if (typeof dateValue === 'string') {
            // Используем строгий парсинг UTC
            const utcDate = window.timeUtils.parseStringStrict(dateValue);
            timestamp = utcDate.getTime();
        } else if (typeof dateValue === 'number') {
            timestamp = dateValue;
        } else if (dateValue instanceof Date) {
            timestamp = dateValue.getTime();
        } else {
            timestamp = window.timeUtils.nowTimestamp();
        }
        
        const newDate = {
            id: window.appState.generateId(),
            date: timestamp, // UTC timestamp
            name: name || 'Новая дата'
        };
        
        window.appState.data.dates.push(newDate);
        window.appState.save();
        
        // Очищаем форму
        if (this.elements.dateNameInput) {
            this.elements.dateNameInput.value = '';
        }
        
        // Устанавливаем как активную
        this.setActiveDate(newDate.id, true);
        
        // Обновляем список
        if (window.dataManager && window.dataManager.updateDateList) {
            window.dataManager.updateDateList();
        }
        
        console.log('Добавлена новая дата:', {
            id: newDate.id,
            name: newDate.name,
            date: new Date(newDate.date).toISOString(),
            timestamp: newDate.date
        });
        
        return newDate;
    }
    
    /**
     * Добавляет дату из формы
     */
    addDateFromForm() {
        const dateValue = document.getElementById('dateInput')?.value;
        const name = document.getElementById('dateNameInput')?.value || 'Новая дата';
        
        if (!dateValue) {
            alert('Пожалуйста, выберите дату');
            return;
        }
        
        this.addDate(dateValue, name);
        
        // Очищаем поля
        if (this.elements.dateNameInput) {
            this.elements.dateNameInput.value = '';
        }
    }
    
    /**
     * Удаляет дату
     * @param {string|number} dateId - ID даты
     */
    deleteDate(dateId) {
        if (!confirm('Уничтожить эту дату?')) return;
        
        if (!window.appState) return;
        
        const dateIdStr = String(dateId);
        const dateIndex = window.appState.data.dates.findIndex(d => String(d.id) === dateIdStr);
        if (dateIndex === -1) return;
        
        window.appState.data.dates.splice(dateIndex, 1);
        
        // Сбрасываем редактирование, если это та же дата
        if (String(window.appState.editingDateId) === dateIdStr) {
            window.appState.editingDateId = null;
        }
        
        // Если удаляем активную дату, выбираем другую
        if (String(window.appState.activeDateId) === dateIdStr) {
            if (window.appState.data.dates.length > 0) {
                // Выбираем первую дату из списка
                this.setActiveDate(window.appState.data.dates[0].id, true);
            } else {
                // Нет дат - сбрасываем на текущее время
                window.appState.activeDateId = null;
                window.appState.baseDate = window.timeUtils.nowTimestamp();
                this.recalculateCurrentDay(true);
                this.updateCurrentDayElement();
                window.grid.updateCenterDate();
                window.waves.updatePosition();
            }
        }
        
        window.appState.save();
        
        // Обновляем UI
        if (window.dataManager && window.dataManager.updateDateList) {
            window.dataManager.updateDateList();
        }
    }
    
    /**
     * Обновляет дату
     * @param {string|number} dateId - ID даты
     * @param {Object} updates - Обновления
     */
    updateDate(dateId, updates) {
        if (!window.appState) return;
        
        const dateIdStr = String(dateId);
        const date = window.appState.data.dates.find(d => String(d.id) === dateIdStr);
        if (!date) return;
        
        // Обновляем поля
        Object.keys(updates).forEach(key => {
            if (key === 'date' && typeof updates.date !== 'number') {
                // Конвертируем в UTC timestamp
                const utcDate = window.timeUtils.parseStringStrict(updates.date);
                date.date = utcDate.getTime();
            } else {
                date[key] = updates[key];
            }
        });
        
        window.appState.save();
        
        // Если это активная дата, пересчитываем
        if (String(window.appState.activeDateId) === dateIdStr) {
            this.recalculateCurrentDay(true);
        }
    }
    
    /**
     * Устанавливает активную дату
     * @param {string|number} dateId - ID даты
     * @param {boolean} useExactTime - Использовать точное время даты
     */
    setActiveDate(dateId, useExactTime = true) {
        console.log('=== setActiveDate(' + dateId + ', useExactTime=' + useExactTime + ') ===');
        
        if (!window.appState || !window.timeUtils) return;
        
        const oldActiveId = window.appState.activeDateId;
        window.appState.activeDateId = dateId;
        
        const dateIdStr = String(dateId);
        const dateObj = window.appState.data.dates.find(d => String(d.id) === dateIdStr);
        
        if (!dateObj) {
            console.warn('DatesManager: дата не найдена, устанавливаем базовую дату на сейчас (UTC)');
            window.appState.baseDate = window.timeUtils.nowTimestamp();
        } else {
            try {
                // Устанавливаем базовую дату как UTC timestamp
                window.appState.baseDate = dateObj.date;
                
                console.log('DatesManager: установка базовой даты (UTC):', {
                    timestamp: dateObj.date,
                    utcDate: new Date(dateObj.date).toISOString(),
                    utcHours: new Date(dateObj.date).getUTCHours(),
                    utcMinutes: new Date(dateObj.date).getUTCMinutes(),
                    utcSeconds: new Date(dateObj.date).getUTCSeconds()
                });
                
            } catch (error) {
                console.error('DatesManager: ошибка установки активной даты:', error);
                window.appState.baseDate = window.timeUtils.nowTimestamp();
            }
        }
        
        // Пересчитываем текущий день
        this.recalculateCurrentDay(useExactTime);
        
        // Обновляем UI
        this.updateCurrentDayElement();
        this.updateTodayButton();
        
        if (window.dataManager && window.dataManager.updateDateList) {
            window.dataManager.updateDateList();
        }
        
        // Если изменилась активная дата, пересоздаем элементы
        if (oldActiveId !== dateId) {
            console.log('Активная дата изменилась, обновляем элементы...');
            
            // Обновляем визуализацию
            if (window.waves) {
                window.waves.updatePosition();
            }
            
            if (window.grid) {
                if (window.grid.createGrid) {
                    window.grid.createGrid();
                }
                if (window.grid.updateCenterDate) {
                    window.grid.updateCenterDate();
                }
                if (window.grid.updateGridNotesHighlight) {
                    window.grid.updateGridNotesHighlight();
                }
            }
        }
        
        // Сохраняем состояние
        window.appState.save();
        
        // Обновляем сводную информацию
        if (window.summaryManager && window.summaryManager.updateSummary) {
            setTimeout(() => {
                window.summaryManager.updateSummary();
            }, 50);
        }
        
        console.log('=== setActiveDate() завершен ===');
    }
    
    /**
     * Пересчитывает currentDay
     * @param {boolean} useExactTime - Использовать точное время (дробные дни)
     * @returns {number} Значение currentDay
     */
    recalculateCurrentDay(useExactTime = false) {
        console.log('=== recalculateCurrentDay(' + useExactTime + ') ===');
        
        if (!window.appState || !window.timeUtils) return 0;
        
        // Получаем даты в UTC
        const currentDateUTC = window.timeUtils.toUTC(window.appState.currentDate);
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
        
        console.log('Исходные данные:');
        console.log('  baseDateUTC:', baseDateUTC.toISOString());
        console.log('  currentDateUTC:', currentDateUTC.toISOString());
        
        let daysDiff;
        
        if (useExactTime) {
            // Точный расчет с дробной частью
            daysDiff = window.timeUtils.getDaysBetweenExactUTC(baseDateUTC, currentDateUTC);
            console.log('Точный расчет (дробный):', daysDiff);
        } else {
            // Целочисленный расчет (только даты)
            daysDiff = window.timeUtils.getDaysBetweenUTC(baseDateUTC, currentDateUTC);
            console.log('Целочисленный расчет:', daysDiff);
        }
        
        // Обновляем состояние
        window.appState.currentDay = daysDiff;
        window.appState.virtualPosition = daysDiff * window.appState.config.squareSize;
        
        console.log('Результат:');
        console.log('  currentDay:', window.appState.currentDay);
        console.log('  virtualPosition:', window.appState.virtualPosition);
        
        if (typeof window.appState.currentDay !== 'number' || isNaN(window.appState.currentDay)) {
            console.error('ERROR: currentDay вычислен некорректно! Устанавливаем 0');
            window.appState.currentDay = 0;
        }
        
        // Обновляем элемент отображения
        this.updateCurrentDayElement();
        
        // Обновляем главный инпут даты
        this.updateMainDateInput();
        
        return window.appState.currentDay;
    }
    
    /**
     * Обновляет элемент отображения currentDay
     */
    updateCurrentDayElement() {
        const currentDayElement = document.getElementById('currentDay');
        if (!currentDayElement) return;
        
        const currentDayValue = window.appState.currentDay || 0;
        
        // Форматируем с указанием UTC
        const formatted = window.timeUtils.formatCurrentDayWithSecondsUTC(currentDayValue);
        currentDayElement.textContent = formatted;
        
        console.log('DatesManager: обновлен currentDay элемент:', formatted);
    }
    
    /**
     * Обновляет главный инпут даты
     */
    updateMainDateInput() {
        const mainDateInput = document.getElementById('mainDateInput');
        if (!mainDateInput || !window.timeUtils) return;
        
        // Форматируем текущую дату для инпута (в UTC)
        const formatted = window.timeUtils.formatForDateTimeInputUTC(
            window.appState.currentDate.getTime()
        );
        
        mainDateInput.value = formatted;
        mainDateInput.placeholder = formatted;
        
        console.log('DatesManager: обновлен mainDateInput:', formatted);
    }
    
    // ================ НАВИГАЦИЯ ================
    
    /**
     * Навигация по дням
     * @param {number} delta - Смещение в днях (может быть дробным)
     */
navigateDay(delta) {
    console.log('=== navigateDay(' + delta + ') ===');
    
    if (!window.appState || !window.timeUtils) return;
    
    const now = Date.now();
    if (now - this.lastUpdateTime < this.updateThrottle) {
        console.log('Пропускаем навигацию (троттлинг)');
        return;
    }
    this.lastUpdateTime = now;
    
    console.log('До навигации:');
    console.log('  currentDate (UTC):', window.appState.currentDate.toISOString());
    console.log('  currentDay:', window.appState.currentDay);
    
    // Создаем новую дату (не мутируем существующую)
    const newDate = new Date(window.appState.currentDate);
    
    // ВАЖНО: используем UTC методы для добавления дней
    newDate.setUTCDate(newDate.getUTCDate() + Math.floor(delta));
    
    // Добавляем дробную часть (если delta дробное)
    const fractionalPart = delta - Math.floor(delta);
    if (fractionalPart !== 0) {
        newDate.setUTCMilliseconds(newDate.getUTCMilliseconds() + 
            fractionalPart * 24 * 60 * 60 * 1000);
    }
    
    // Сохраняем как UTC дату
    window.appState.currentDate = newDate;
    
    console.log('После навигации:');
    console.log('  newDate (UTC):', window.appState.currentDate.toISOString());
    console.log('  UTC Часы:', window.appState.currentDate.getUTCHours());
    console.log('  UTC Минуты:', window.appState.currentDate.getUTCMinutes());
    console.log('  UTC Секунды:', window.appState.currentDate.getUTCSeconds());
    
    // Пересчитываем с учетом точного времени
    this.recalculateCurrentDay(true);
    
    // Обновляем визуализацию
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
        if (window.grid.updateGridNotesHighlight) {
            window.grid.updateGridNotesHighlight();
        }
    }
    
    // Обновляем кнопку "Сегодня"
    this.updateTodayButton();
    
    // Обновляем сводную информацию
    if (window.summaryManager && window.summaryManager.updateSummary) {
        setTimeout(() => {
            window.summaryManager.updateSummary();
        }, 50);
    }
    
    // Сохраняем состояние
    window.appState.save();
    
    console.log('=== navigateDay завершен ===');
}

recalculateCurrentDay(useExactTime = false) {
    console.log('=== recalculateCurrentDay(' + useExactTime + ') ===');
    
    if (!window.appState || !window.timeUtils) return 0;
    
    // Получаем даты в UTC
    const currentDateUTC = window.timeUtils.toUTC(window.appState.currentDate);
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
    
    console.log('Исходные данные (UTC):');
    console.log('  baseDateUTC:', baseDateUTC.toISOString());
    console.log('  currentDateUTC:', currentDateUTC.toISOString());
    
    let daysDiff;
    
    if (useExactTime) {
        // Точный расчет с дробной частью (ВСЕГДА UTC)
        const timeDiff = currentDateUTC.getTime() - baseDateUTC.getTime();
        daysDiff = timeDiff / (1000 * 60 * 60 * 24);
        console.log('Точный расчет (дробный, UTC):', daysDiff);
    } else {
        // Целочисленный расчет (только даты в UTC)
        const startOfCurrentDay = window.timeUtils.getStartOfDayUTC(currentDateUTC);
        const startOfBaseDay = window.timeUtils.getStartOfDayUTC(baseDateUTC);
        const timeDiff = startOfCurrentDay.getTime() - startOfBaseDay.getTime();
        daysDiff = Math.floor(timeDiff / (1000 * 60 * 60 * 24));
        console.log('Целочисленный расчет (UTC):', daysDiff);
    }
    
    // Обновляем состояние
    window.appState.currentDay = daysDiff;
    window.appState.virtualPosition = daysDiff * window.appState.config.squareSize;
    
    console.log('Результат:');
    console.log('  currentDay:', window.appState.currentDay);
    console.log('  virtualPosition:', window.appState.virtualPosition);
    
    if (typeof window.appState.currentDay !== 'number' || isNaN(window.appState.currentDay)) {
        console.error('ERROR: currentDay вычислен некорректно! Устанавливаем 0');
        window.appState.currentDay = 0;
    }
    
    // Обновляем элемент отображения
    this.updateCurrentDayElement();
    
    // Обновляем главный инпут даты
    this.updateMainDateInput();
    
    return window.appState.currentDay;
}

goToToday() {
    console.log('=== goToToday() ===');
    
    if (!window.appState || !window.timeUtils) return;
    
    console.log('До перехода:');
    console.log('  currentDate (UTC):', window.appState.currentDate.toISOString());
    
    // Получаем начало текущего дня в UTC
    const todayStartUTC = window.timeUtils.getStartOfDayUTC(window.timeUtils.nowUTC());
    
    window.appState.currentDate = todayStartUTC;
    
    console.log('После перехода:');
    console.log('  currentDate (начало дня UTC):', window.appState.currentDate.toISOString());
    
    // Пересчитываем как целый день
    this.recalculateCurrentDay(false);
    
    // Обновляем визуализацию
    if (window.grid && window.grid.createGrid) {
        window.grid.createGrid();
    }
    
    if (window.grid && window.grid.updateCenterDate) {
        window.grid.updateCenterDate();
    }
    
    if (window.waves && window.waves.updatePosition) {
        window.waves.updatePosition();
    }
    
    // Обновляем UI
    this.updateTodayButton();
    
    // Сохраняем состояние
    window.appState.save();
    
    console.log('=== goToToday завершен ===');
}

goToNow() {
    console.log('=== goToNow() ===');
    
    if (!window.appState || !window.timeUtils) return;
    
    console.log('До перехода:');
    console.log('  currentDate (UTC):', window.appState.currentDate.toISOString());
    
    // Получаем текущее точное время в UTC
    window.appState.currentDate = window.timeUtils.nowUTC();
    
    console.log('После перехода:');
    console.log('  currentDate (точное время UTC):', window.appState.currentDate.toISOString());
    console.log('  UTC Часы:', window.appState.currentDate.getUTCHours());
    console.log('  UTC Минуты:', window.appState.currentDate.getUTCMinutes());
    console.log('  UTC Секунды:', window.appState.currentDate.getUTCSeconds());
    
    // Пересчитываем с дробной частью
    this.recalculateCurrentDay(true);
    
    // Обновляем визуализацию
    if (window.grid && window.grid.createGrid) {
        window.grid.createGrid();
    }
    
    if (window.grid && window.grid.updateCenterDate) {
        window.grid.updateCenterDate();
    }
    
    if (window.waves && window.waves.updatePosition) {
        window.waves.updatePosition();
    }
    
    // Обновляем UI
    this.updateTodayButton();
    
    // Сохраняем состояние
    window.appState.save();
    
    console.log('=== goToNow завершен ===');
}

setDateFromInput() {
    const mainDateInput = document.getElementById('mainDateInput');
    if (!mainDateInput || !mainDateInput.value) {
        alert('Пожалуйста, введите дату и время');
        return;
    }
    
    if (!window.timeUtils) return;
    
    console.log('=== setDateFromInput() ===');
    console.log('Ввод пользователя:', mainDateInput.value);
    
    // Убираем (UTC) из строки если есть
    const inputValue = mainDateInput.value.replace(' (UTC)', '').trim();
    
    // Парсим ввод как UTC
    const timestamp = window.timeUtils.parseFromDateTimeInput(inputValue);
    window.appState.currentDate = new Date(timestamp);
    
    console.log('Парсинг результата:');
    console.log('  timestamp:', timestamp);
    console.log('  currentDate (UTC):', window.appState.currentDate.toISOString());
    
    // Проверяем, является ли время началом дня в UTC
    const hours = window.appState.currentDate.getUTCHours();
    const minutes = window.appState.currentDate.getUTCMinutes();
    const seconds = window.appState.currentDate.getUTCSeconds();
    const milliseconds = window.appState.currentDate.getUTCMilliseconds();
    
    const isStartOfDay = hours === 0 && minutes === 0 && seconds === 0 && milliseconds === 0;
    
    console.log('Анализ времени (UTC):');
    console.log('  Часы UTC:', hours);
    console.log('  Минуты UTC:', minutes);
    console.log('  Секунды UTC:', seconds);
    console.log('  Мс UTC:', milliseconds);
    console.log('  Начало дня?:', isStartOfDay);
    
    // Пересчитываем (целый день если начало дня, иначе дробный)
    this.recalculateCurrentDay(!isStartOfDay);
    
    // Обновляем визуализацию
    if (window.grid && window.grid.createGrid) {
        window.grid.createGrid();
    }
    
    if (window.grid && window.grid.updateCenterDate) {
        window.grid.updateCenterDate();
    }
    
    if (window.waves && window.waves.updatePosition) {
        window.waves.updatePosition();
    }
    
    // Обновляем UI
    this.updateTodayButton();
    
    // Сохраняем состояние
    window.appState.save();
    
    console.log('Текущий день после установки:', window.appState.currentDay);
    console.log('=== setDateFromInput завершен ===');
}
    
    /**
     * Переход к сегодняшней дате (начало дня в UTC)
     */
    goToToday() {
        console.log('=== goToToday() ===');
        
        if (!window.appState || !window.timeUtils) return;
        
        console.log('До перехода:');
        console.log('  currentDate:', window.appState.currentDate.toISOString());
        console.log('  currentDay:', window.appState.currentDay);
        
        // Получаем начало текущего дня в UTC
        const todayStartUTC = window.timeUtils.getStartOfDayUTC(window.timeUtils.nowUTC());
        
        window.appState.currentDate = todayStartUTC;
        
        console.log('После перехода:');
        console.log('  currentDate (начало дня UTC):', window.appState.currentDate.toISOString());
        
        // Пересчитываем как целый день
        this.recalculateCurrentDay(false);
        
        // Обновляем визуализацию
        if (window.grid && window.grid.createGrid) {
            window.grid.createGrid();
        }
        
        if (window.grid && window.grid.updateCenterDate) {
            window.grid.updateCenterDate();
        }
        
        if (window.waves && window.waves.updatePosition) {
            window.waves.updatePosition();
        }
        
        // Обновляем UI
        this.updateTodayButton();
        
        // Обновляем сводную информацию
        if (window.summaryManager && window.summaryManager.updateSummary) {
            setTimeout(() => {
                window.summaryManager.updateSummary();
            }, 50);
        }
        
        // Сохраняем состояние
        window.appState.save();
        
        console.log('=== goToToday завершен ===');
    }
    
    /**
     * Переход к текущему точному времени в UTC
     */
    goToNow() {
        console.log('=== goToNow() ===');
        
        if (!window.appState || !window.timeUtils) return;
        
        console.log('До перехода:');
        console.log('  currentDate:', window.appState.currentDate.toISOString());
        console.log('  currentDay:', window.appState.currentDay);
        
        // Получаем текущее точное время в UTC
        window.appState.currentDate = window.timeUtils.nowUTC();
        
        console.log('После перехода:');
        console.log('  currentDate (точное время UTC):', window.appState.currentDate.toISOString());
        console.log('  UTC Часы:', window.appState.currentDate.getUTCHours());
        console.log('  UTC Минуты:', window.appState.currentDate.getUTCMinutes());
        console.log('  UTC Секунды:', window.appState.currentDate.getUTCSeconds());
        
        // Пересчитываем с дробной частью
        this.recalculateCurrentDay(true);
        
        // Обновляем визуализацию
        if (window.grid && window.grid.createGrid) {
            window.grid.createGrid();
        }
        
        if (window.grid && window.grid.updateCenterDate) {
            window.grid.updateCenterDate();
        }
        
        if (window.waves && window.waves.updatePosition) {
            window.waves.updatePosition();
        }
        
        // Обновляем UI
        this.updateTodayButton();
        
        // Обновляем сводную информацию
        if (window.summaryManager && window.summaryManager.updateSummary) {
            setTimeout(() => {
                window.summaryManager.updateSummary();
            }, 50);
        }
        
        // Сохраняем состояние
        window.appState.save();
        
        console.log('=== goToNow завершен ===');
    }
    
    /**
     * Устанавливает дату из главного инпута
     */
    setDateFromInput() {
        const mainDateInput = document.getElementById('mainDateInput');
        if (!mainDateInput || !mainDateInput.value) {
            alert('Пожалуйста, введите дату и время');
            return;
        }
        
        if (!window.timeUtils) return;
        
        console.log('=== setDateFromInput() ===');
        console.log('Ввод пользователя:', mainDateInput.value);
        
        // Парсим ввод как UTC
        const timestamp = window.timeUtils.parseFromDateTimeInput(mainDateInput.value);
        window.appState.currentDate = new Date(timestamp);
        
        console.log('Парсинг результата:');
        console.log('  timestamp:', timestamp);
        console.log('  currentDate (UTC):', window.appState.currentDate.toISOString());
        
        // Проверяем, является ли время началом дня
        const hours = window.appState.currentDate.getUTCHours();
        const minutes = window.appState.currentDate.getUTCMinutes();
        const seconds = window.appState.currentDate.getUTCSeconds();
        const milliseconds = window.appState.currentDate.getUTCMilliseconds();
        
        const isStartOfDay = hours === 0 && minutes === 0 && seconds === 0 && milliseconds === 0;
        
        console.log('Анализ времени:');
        console.log('  Часы UTC:', hours);
        console.log('  Минуты UTC:', minutes);
        console.log('  Секунды UTC:', seconds);
        console.log('  Мс UTC:', milliseconds);
        console.log('  Начало дня?:', isStartOfDay);
        
        // Пересчитываем (целый день если начало дня, иначе дробный)
        this.recalculateCurrentDay(!isStartOfDay);
        
        // Обновляем визуализацию
        if (window.grid && window.grid.createGrid) {
            window.grid.createGrid();
        }
        
        if (window.grid && window.grid.updateCenterDate) {
            window.grid.updateCenterDate();
        }
        
        if (window.waves && window.waves.updatePosition) {
            window.waves.updatePosition();
        }
        
        // Обновляем UI
        this.updateTodayButton();
        
        // Обновляем сводную информацию
        if (window.summaryManager && window.summaryManager.updateSummary) {
            setTimeout(() => {
                window.summaryManager.updateSummary();
            }, 50);
        }
        
        // Сохраняем состояние
        window.appState.save();
        
        console.log('Текущий день после установки:', window.appState.currentDay);
        console.log('=== setDateFromInput завершен ===');
    }
    
    /**
     * Устанавливает дату напрямую
     * @param {Date|number|string} newDate - Новая дата
     */
    setDate(newDate) {
        if (!window.appState || !window.timeUtils) return;
        
        console.log('=== setDate() ===');
        
        window.appState.isProgrammaticDateChange = true;
        
        let dateObj;
        
        if (newDate instanceof Date) {
            dateObj = window.timeUtils.toUTC(newDate);
        } else if (typeof newDate === 'number') {
            dateObj = new Date(newDate);
        } else if (typeof newDate === 'string') {
            dateObj = window.timeUtils.parseStringStrict(newDate);
        } else {
            console.warn('DatesManager: неизвестный формат даты');
            dateObj = window.timeUtils.nowUTC();
        }
        
        window.appState.currentDate = dateObj;
        
        console.log('Установлена новая дата:', dateObj.toISOString());
        
        // По умолчанию используем целые числа
        this.recalculateCurrentDay(false);
        
        // Обновляем визуализацию
        if (window.waves && window.waves.updatePosition) {
            window.waves.updatePosition();
        }
        
        if (window.grid && window.grid.updateCenterDate) {
            window.grid.updateCenterDate();
        }
        
        if (window.grid && window.grid.updateGridNotesHighlight) {
            window.grid.updateGridNotesHighlight();
        }
        
        // Обновляем UI
        this.updateTodayButton();
        
        // Обновляем сводную информацию
        if (window.summaryManager && window.summaryManager.updateSummary) {
            setTimeout(() => {
                window.summaryManager.updateSummary();
            }, 50);
        }
        
        // Сохраняем состояние
        window.appState.save();
        
        // Сбрасываем флаг
        setTimeout(() => {
            window.appState.isProgrammaticDateChange = false;
        }, 100);
        
        console.log('=== setDate завершен ===');
    }
    
    // ================ ЗАМЕТКИ ================
    
    /**
     * Добавляет заметку
     * @param {string} content - Текст заметки
     * @returns {Object|null} Созданная заметка
     */
    addNote(content) {
        if (!content || !content.trim()) {
            alert('Пожалуйста, введите текст записи');
            return null;
        }
        
        if (!window.appState || !window.timeUtils) return null;
        
        const note = {
            id: window.appState.generateId(),
            date: window.appState.currentDate.getTime(), // UTC timestamp
            content: content.trim()
        };
        
        window.appState.data.notes.push(note);
        window.appState.save();
        
        console.log('Добавлена заметка:', {
            id: note.id,
            date: new Date(note.date).toISOString(),
            contentPreview: note.content.substring(0, 50) + '...'
        });
        
        return note;
    }
    
    /**
     * Удаляет заметку
     * @param {string|number} noteId - ID заметки
     */
    deleteNote(noteId) {
        if (!window.appState) return;
        
        const noteIdStr = String(noteId);
        window.appState.data.notes = window.appState.data.notes.filter(n => String(n.id) !== noteIdStr);
        window.appState.save();
        
        console.log('Удалена заметка:', noteId);
    }
    
    /**
     * Получает заметки для даты
     * @param {Date|number|string} date - Дата
     * @returns {Array} Массив заметок
     */
    getNotesForDate(date) {
        if (!window.appState || !window.timeUtils) return [];
        
        let targetTimestamp;
        
        if (date instanceof Date) {
            targetTimestamp = date.getTime();
        } else if (typeof date === 'number') {
            targetTimestamp = date;
        } else {
            const utcDate = window.timeUtils.parseStringStrict(date);
            targetTimestamp = utcDate.getTime();
        }
        
        // Получаем начало и конец дня в UTC
        const targetStart = window.timeUtils.getStartOfDayUTC(targetTimestamp);
        const targetEnd = new Date(targetStart.getTime() + 24 * 60 * 60 * 1000);
        
        return window.appState.data.notes.filter(note => {
            const noteTime = note.date;
            return noteTime >= targetStart.getTime() && noteTime < targetEnd.getTime();
        });
    }
    
    // ================ ГРУППЫ ================
    
    /**
     * Добавляет группу
     * @param {string} name - Название группы
     * @returns {Object|null} Созданная группа
     */
    addGroup(name) {
        if (!name || !name.trim()) {
            alert('Пожалуйста, введите название группы');
            return null;
        }
        
        if (!window.appState) return null;
        
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
        
        console.log('Добавлена группа:', group.name, 'ID:', group.id);
        
        return group;
    }
    
    /**
     * Удаляет группу
     * @param {string|number} groupId - ID группы
     * @returns {boolean} true если успешно
     */
    deleteGroup(groupId) {
        if (!confirm('Уничтожить группу? Колоски будут перемещены в группу по умолчанию.')) {
            return false;
        }
        
        if (!window.appState) return false;
        
        const groupIdStr = String(groupId);
        const group = window.appState.data.groups.find(g => String(g.id) === groupIdStr);
        if (!group) return false;
        
        // Перемещаем волны в группу по умолчанию
        const defaultGroup = window.appState.data.groups.find(g => g.id === 'default-group');
        if (defaultGroup && group.waves && group.waves.length > 0) {
            group.waves.forEach(waveId => {
                const waveIdStr = String(waveId);
                if (!defaultGroup.waves.some(wId => String(wId) === waveIdStr)) {
                    defaultGroup.waves.push(waveId);
                }
            });
        }
        
        // Удаляем группу
        window.appState.data.groups = window.appState.data.groups.filter(g => String(g.id) !== groupIdStr);
        window.appState.save();
        
        console.log('Удалена группа:', group.name, 'ID:', groupId);
        
        return true;
    }
    
    // ================ ИНИЦИАЛИЗАЦИЯ ================
    
    /**
     * Принудительная инициализация
     */
    forceInitialize() {
        console.log('=== DatesManager: FORCE INITIALIZE ===');
        
        if (!window.appState || !window.timeUtils) return;
        
        // Устанавливаем ТОЧНОЕ текущее время в UTC
        window.appState.currentDate = window.timeUtils.nowUTC();
        
        console.log('Установлено текущее точное время (UTC):', 
            window.appState.currentDate.toISOString());
        
        // Пересчитываем с дробными числами (учитываем время)
        this.recalculateCurrentDay(true);
        
        // Устанавливаем активную дату, если есть
        if (window.appState.activeDateId) {
            console.log('Установка активной даты:', window.appState.activeDateId);
            this.setActiveDate(window.appState.activeDateId, true);
        } else if (window.appState.data.dates.length > 0) {
            console.log('Нет активной даты, выбираем первую');
            const firstDateId = window.appState.data.dates[0].id;
            window.appState.activeDateId = firstDateId;
            this.setActiveDate(firstDateId, true);
        } else {
            console.log('Нет дат в списке, устанавливаем базовую дату');
            window.appState.baseDate = window.timeUtils.nowTimestamp();
            this.recalculateCurrentDay(true);
        }
        
        // Обновляем визуализацию
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
        
        // Обновляем UI
        if (window.dataManager && window.dataManager.updateDateList) {
            window.dataManager.updateDateList();
        }
        
        this.updateTodayButton();
        
        console.log('=== DatesManager: инициализация завершена ===');
        console.log('activeDateId:', window.appState.activeDateId);
        console.log('currentDay:', window.appState.currentDay);
        console.log('currentDate (UTC):', window.appState.currentDate.toISOString());
        console.log('baseDate (UTC):', new Date(window.appState.baseDate).toISOString());
    }
    
    /**
     * Получает текущую дату в UTC
     * @returns {Date} Текущая дата UTC
     */
    getCurrentDate() {
        return window.timeUtils ? window.timeUtils.nowUTC() : new Date();
    }
    
    /**
     * Получает день недели
     * @param {Date|number} date - Дата
     * @returns {number} 0-воскресенье, 6-суббота
     */
    getWeekday(date) {
        return window.timeUtils ? window.timeUtils.getWeekdayUTC(date) : date.getDay();
    }
    
    /**
     * Получает название дня недели
     * @param {Date|number} date - Дата
     * @param {boolean} full - Полное название
     * @returns {string} Название дня
     */
    getWeekdayName(date, full = false) {
        return window.timeUtils ? window.timeUtils.getWeekdayNameUTC(date, full) : 
               (full ? ['Воскресенье', 'Понедельник', 'Вторник', 'Среда', 'Четверг', 'Пятница', 'Суббота'][date.getDay()] :
                       ['Вс', 'Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб'][date.getDay()]);
    }
}

window.dates = new DatesManager();

// Автоматическая инициализация при загрузке
document.addEventListener('DOMContentLoaded', () => {
    setTimeout(() => {
        if (window.dates && window.dates.forceInitialize) {
            console.log('Автоматическая инициализация DatesManager...');
            window.dates.forceInitialize();
        }
    }, 500);
});