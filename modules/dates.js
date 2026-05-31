/**
 * @file dates.js
 * Персоны (даты), визор: currentDay, навигация, baseDate, сравнение A/B, группы персон.
 */
class DatesManager {
    constructor() {
        this.elements = {};
        /** Какой режим использовался в последнем recalculateCurrentDay (для согласованности с панелями). */
        this.lastRecalculateUsedExactTime = true;
        /** Таймер «полного» обновления после паузы в навигации. */
        this._navDaySettleTimer = null;
        this._navDaySettleMs = 180;
        this.cacheElements();
        this.bindGenderSelectTitles();
    }

    /** Подсказки title для select пола персоны при смене значения. */
    bindGenderSelectTitles() {
        if (this._genderSelectTitlesBound) {
            return;
        }
        this._genderSelectTitlesBound = true;
        document.addEventListener('change', (e) => {
            const sel = e.target;
            if (!sel || !sel.classList || !sel.matches('.sun-dateGenderSelect, .sun-dateGenderSelect')) {
                return;
            }
            if (window.dom && typeof window.dom.getPersonGenderLabel === 'function') {
                sel.title = window.dom.getPersonGenderLabel(sel.value);
            }
        });
    }
    
    /** Кэширует ссылки на DOM-элементы панели дат и навигации. */
    cacheElements() {
        const ids = [
            'dateInput', 'dateNameInput', 'dateGenderSelect', 'dateDescriptionInput', 'btnAddDate', 'dateListForDates',
            'mainDateInputDate', 'mainDateInputTime', 'btnSetDate', 'currentDay', 'btnPrevDay',
            'btnNextDay', 'btnToday', 'btnNow',
            'customWaveName', 'customWavePeriod', 'customWaveType',
            'customWaveColor', 'btnAddCustomWave', 'newGroupName', 'btnAddGroup',
            'newPersonGroupName', 'btnAddPersonGroup'
        ];
        
        ids.forEach(id => {
            const el = window.dom.byKey(id);
            if (el) this.elements[id] = el;
        });
    }
    
    /** Проверяет, совпадает ли дата на визоре с сегодняшним днём. */
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
    
    /** Обновляет стиль кнопки «Сегодня» (активна / неактивна). */
    updateTodayButton() {
        const btnToday = window.dom.byKey('btnToday');
        if (!btnToday) return;
        
        const isCurrent = this.isCurrentDateOnVizor();
        
        if (isCurrent) {
            btnToday.classList.remove('sun-todayInactive');
            btnToday.classList.add('sun-todayActive');
        } else {
            btnToday.classList.remove('sun-todayActive');
            btnToday.classList.add('sun-todayInactive');
        }
        btnToday.removeAttribute('title');
    }
    
    /** Гарантирует наличие массива personGroups в data. */
    ensurePersonGroupsShape() {
        const data = window.appState.data;
        if (!Array.isArray(data.personGroups)) {
            data.personGroups = [];
        }
    }

    /**
     * Разворачивает группу персон, в которой находится дата с данным id (чтобы активная персона была видна в списке).
     */
    ensurePersonGroupExpandedForDateId(dateId) {
        if (dateId == null || String(dateId) === '') {
            return false;
        }
        this.ensurePersonGroupsShape();
        const idStr = String(dateId);
        const groups = window.appState.data.personGroups || [];
        let changed = false;
        for (let i = 0; i < groups.length; i++) {
            const g = groups[i];
            if (!g.dates || !Array.isArray(g.dates)) {
                continue;
            }
            if (g.dates.some((did) => String(did) === idStr)) {
                if (g.expanded !== true) {
                    g.expanded = true;
                    changed = true;
                }
                break;
            }
        }
        return changed;
    }

    /**
     * Синхронизация: каждая дата в ровно одной группе; лишние id в группах убираются; «осиротевшие» даты — в группу по умолчанию.
     */
    syncPersonGroupsLayout() {
        this.ensurePersonGroupsShape();
        const data = window.appState.data;
        const dates = data.dates || [];
        if (dates.length === 0) {
            data.personGroups = [];
            return;
        }
        if (data.personGroups.length === 0) {
            data.personGroups = [{
                id: 'default-person-group',
                name: 'По умолчанию',
                dates: dates.map(d => d.id),
                expanded: true
            }];
            return;
        }
        let defaultG = data.personGroups.find(g => String(g.id) === 'default-person-group');
        if (!defaultG) {
            defaultG = data.personGroups[0];
        }
        const validDateIds = new Set(dates.map(d => String(d.id)));
        data.personGroups.forEach(g => {
            g.dates = (g.dates || []).filter(id => validDateIds.has(String(id)));
        });
        const assigned = new Set();
        data.personGroups.forEach(g => {
            (g.dates || []).forEach(id => assigned.add(String(id)));
        });
        dates.forEach(d => {
            const idStr = String(d.id);
            if (!assigned.has(idStr)) {
                if (!defaultG.dates) defaultG.dates = [];
                defaultG.dates.push(d.id);
                assigned.add(idStr);
            }
        });
    }

    /** Переносит id персоны в указанную группу (убирая из других). */
    addDateIdToPersonGroup(groupId, dateId) {
        this.ensurePersonGroupsShape();
        const data = window.appState.data;
        let g = data.personGroups.find(gr => String(gr.id) === String(groupId));
        if (!g) {
            g = data.personGroups.find(gr => String(gr.id) === 'default-person-group') || data.personGroups[0];
        }
        if (!g) return;
        if (!g.dates) g.dates = [];
        const idStr = String(dateId);
        data.personGroups.forEach(gr => {
            if (!gr.dates) return;
            gr.dates = gr.dates.filter(id => String(id) !== idStr);
        });
        g.dates.push(dateId);
    }

    /** Добавляет персону, синхронизирует группы и делает её активной. */
    addDate(dateValue, name, description, gender) {
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
            name: name || 'Новая дата',
            description: typeof description === 'string' ? description : '',
            gender:
                window.dom && typeof window.dom.normalizePersonGender === 'function'
                    ? window.dom.normalizePersonGender(gender)
                    : gender === 'male' || gender === 'female'
                      ? gender
                      : 'unset'
        };
        
        window.appState.data.dates.push(newDate);
        this.syncPersonGroupsLayout();
        window.appState.save();
        
        if (this.elements.dateNameInput) {
            this.elements.dateNameInput.value = '';
        }
        if (this.elements.dateDescriptionInput) {
            this.elements.dateDescriptionInput.value = '';
        }
        if (this.elements.dateGenderSelect) {
            this.elements.dateGenderSelect.value = 'unset';
            if (window.dom && typeof window.dom.getPersonGenderLabel === 'function') {
                this.elements.dateGenderSelect.title = window.dom.getPersonGenderLabel('unset');
            }
        }
        
        this.setActiveDate(newDate.id);
        
        return newDate;
    }
    
    /** Удаляет персону после подтверждения; пересчитывает activeDate при необходимости. */
    deleteDate(dateId) {
        if (!confirm('Уничтожить эту дату?')) return;
        
        const dateIdStr = String(dateId);
        const dateIndex = window.appState.data.dates.findIndex(d => String(d.id) === dateIdStr);
        if (dateIndex === -1) return;
        
        window.appState.data.dates.splice(dateIndex, 1);

        this.ensurePersonGroupsShape();
        window.appState.data.personGroups.forEach(g => {
            if (!g.dates) return;
            g.dates = g.dates.filter(id => String(id) !== dateIdStr);
        });
        
        if (String(window.appState.editingDateId) === dateIdStr) {
            window.appState.editingDateId = null;
        }
        
        if (String(window.appState.activeDateId) === dateIdStr) {
            if (window.appState.data.dates.length > 0) {
                this.setActiveDate(window.appState.data.dates[0].id);
            } else {
                window.appState.activeDateId = null;
                window.appState.baseDate = window.timeUtils.nowTimestamp();
                this.recalculateCurrentDay(false, { skipSave: true });
                this.updateCurrentDayElement();
                if (window.waves && window.waves.createVisibleWaveElements) {
                    window.waves.createVisibleWaveElements();
                }
                if (window.grid && window.grid.refreshForCurrentDay) {
                    window.grid.refreshForCurrentDay();
                } else if (window.grid && window.grid.updateCenterDate) {
                    window.grid.updateCenterDate();
                }
                if (window.waves && window.waves.updatePosition) {
                    window.waves.updatePosition();
                }
            }
        }
        
        window.appState.save();
        window.dataManager.updateDateList();
    }
    
    /** Обновляет поля персоны по id и сохраняет состояние. */
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
    
    /** Синхронизирует выделение в списке дат и селектах сравнения. */
    _syncDateListAfterActiveChange() {
        if (window.unifiedListManager && window.unifiedListManager.syncDateListSelectionVisuals) {
            window.unifiedListManager.syncDateListSelectionVisuals({ selectionOnly: true });
        }
        if (
            window.dateComparisonManager &&
            window.dateComparisonManager.ensureSelectsSyncedWithDateList
        ) {
            window.dateComparisonManager.ensureSelectsSyncedWithDateList();
        }
    }

    /** Активирует персону: baseDate, typeA, пересчёт currentDay и обновление UI. */
    setActiveDate(dateId, useExactTime = false) {
        const oldActiveId = window.appState.activeDateId;
        const wasProgrammatic = window.appState.isProgrammaticDateChange;
        window.appState.isProgrammaticDateChange = true;

        window.appState.activeDateId = dateId;
        this.ensurePersonGroupExpandedForDateId(dateId);
        
        // СИНХРОНИЗАЦИЯ: При активации даты выделяем ее как тип A
        if (!window.appState.dateSelections) {
            window.appState.dateSelections = {
                typeA: null,
                typeB: null
            };
        }
        
        // Устанавливаем эту дату как тип A; если B был на этой же дате — переносим B на другую (как при конфликте чекбоксов)
        window.appState.dateSelections.typeA = dateId;
        const bSel = window.appState.dateSelections.typeB;
        if (bSel != null && String(bSel) === String(dateId)) {
            const allD = window.appState.data.dates || [];
            const altB = allD.find((d) => String(d.id) !== String(dateId));
            window.appState.dateSelections.typeB = altB ? altB.id : null;
        }
        
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
        
        this.recalculateCurrentDay(useExactTime, { skipSave: true });
        
        this.updateCurrentDayElement();
        
        if (oldActiveId !== dateId && window.waves) {
            const hasWaveDom =
                Object.keys(window.waves.waveContainers || {}).length > 0 ||
                !!document.querySelector('.sun-waveContainer');
            if (!hasWaveDom && window.waves.createVisibleWaveElements) {
                const wrd = window.__waveRenderDebug;
                const end =
                    wrd && wrd.isEnabled && wrd.isEnabled()
                        ? wrd.t('dates.setActiveDate.createVisibleWaveElements', { dateId })
                        : null;
                try {
                    window.waves.createVisibleWaveElements();
                } finally {
                    end && end({});
                }
            }
        }

        if (window.waves) {
            const wrd = window.__waveRenderDebug;
            const endPos =
                wrd && wrd.isEnabled && wrd.isEnabled()
                    ? wrd.t('dates.setActiveDate.wavesUpdatePosition', { dateId })
                    : null;
            try {
                window.waves.updatePosition();
                if (window.waves.updateCornerSquareColors) {
                    window.waves.updateCornerSquareColors();
                }
            } finally {
                endPos && endPos({});
            }
        }

        if (window.extremumTimeManager && window.extremumTimeManager.updateExtremums) {
            window.extremumTimeManager.updateExtremums();
        }
        
        if (window.grid) {
            if (window.grid.refreshForCurrentDay) {
                window.grid.refreshForCurrentDay();
            }
            if (window.grid.updateCenterDate) {
                window.grid.updateCenterDate();
            }
        }
        
        if (window.appState.saveDebounced) {
            window.appState.saveDebounced();
        } else {
            window.appState.save();
        }

        this.updateTodayButton();

        if (window.summaryManager && window.summaryManager.debouncedUpdate) {
            window.summaryManager.debouncedUpdate();
        } else if (window.summaryManager && window.summaryManager.updateSummary) {
            window.summaryManager.updateSummary();
        }

        if (window.stateIntersectionManager && window.stateIntersectionManager.debouncedUpdate) {
            window.stateIntersectionManager.debouncedUpdate();
        } else if (
            window.stateIntersectionManager &&
            window.stateIntersectionManager.updateIntersections
        ) {
            window.stateIntersectionManager.updateIntersections();
        }

        this.updateDateTimeInputs();

        window.sunDateListLog &&
            window.sunDateListLog('setActiveDate:→ syncDateListSelectionVisuals', {
                dateId,
                activeDateId: window.appState.activeDateId,
                dateSelections: window.appState.dateSelections ? { ...window.appState.dateSelections } : null
            });
        this._syncDateListAfterActiveChange();

        window.appState.isProgrammaticDateChange = wasProgrammatic;
    }
    
    /** Создаёт группу сигналов (волн) с настройками стиля по умолчанию. */
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

    /** Создаёт группу персон в списке дат. */
    addPersonGroup(name) {
        if (!name || !name.trim()) {
            alert('Пожалуйста, введите название группы');
            return null;
        }
        this.ensurePersonGroupsShape();
        const group = {
            id: window.appState.generateId(),
            name: name.trim(),
            dates: [],
            expanded: true
        };
        window.appState.data.personGroups.push(group);
        window.appState.save();
        return group;
    }

    /** Удаляет группу персон; персоны переносятся в группу по умолчанию. */
    deletePersonGroup(groupId) {
        const groupIdStr = String(groupId);
        if (groupIdStr === 'default-person-group') {
            alert('Группу по умолчанию уничтожить нельзя.');
            return false;
        }
        if (!confirm('Уничтожить группу персон? Персоны будут перенесены в группу по умолчанию.')) {
            return false;
        }
        this.ensurePersonGroupsShape();
        const data = window.appState.data;
        const group = data.personGroups.find(g => String(g.id) === groupIdStr);
        if (!group) return false;
        let defaultG = data.personGroups.find(g => String(g.id) === 'default-person-group');
        if (!defaultG) {
            defaultG = data.personGroups.find(g => String(g.id) !== groupIdStr) || null;
        }
        if (defaultG && String(defaultG.id) !== groupIdStr && group.dates && group.dates.length > 0) {
            if (!defaultG.dates) defaultG.dates = [];
            group.dates.forEach(dateId => {
                const idStr = String(dateId);
                if (!defaultG.dates.some(did => String(did) === idStr)) {
                    defaultG.dates.push(dateId);
                }
            });
        }
        data.personGroups = data.personGroups.filter(g => String(g.id) !== groupIdStr);
        if (String(window.appState.editingPersonGroupId) === groupIdStr) {
            window.appState.editingPersonGroupId = null;
        }
        window.appState.save();
        return true;
    }
    
    /** Удаляет группу сигналов вместе с её волнами после двойного confirm. */
    deleteGroup(groupId) {
        const groupIdStr = String(groupId);
        const group = window.appState.data.groups.find(g => String(g.id) === groupIdStr);
        if (!group) return;

        const wavesToDelete = Array.isArray(group.waves) ? group.waves.map(String) : [];
        const wavesCount = wavesToDelete.length;

        if (!confirm('Уничтожить группу?')) return;
        if (!confirm(`Вместе с группой будет уничтожено ${wavesCount} волн. Продолжить?`)) return;

        if (wavesCount > 0) {
            const wavesToDeleteSet = new Set(wavesToDelete);
            window.appState.data.waves = window.appState.data.waves.filter(
                w => !wavesToDeleteSet.has(String(w.id))
            );
            wavesToDelete.forEach((waveIdStr) => {
                delete window.appState.waveVisibility[waveIdStr];
                delete window.appState.waveBold[waveIdStr];
                delete window.appState.waveCornerColor[waveIdStr];
                delete window.appState.periods[waveIdStr];
            });
        }

        window.appState.data.groups = window.appState.data.groups.filter(g => String(g.id) !== groupIdStr);

        if (window.waves) {
            document.querySelectorAll('.sun-waveContainer').forEach(c => c.remove());
            window.waves.clearWaveDomReferences();
            window.appState.periods = {};

            window.appState.data.waves.forEach((wave) => {
                if (
                    typeof window.waves.waveNeedsGraphContainer === 'function' &&
                    window.waves.waveNeedsGraphContainer(wave.id)
                ) {
                    window.waves.createWaveElement(wave);
                }
            });
            window.waves.updatePosition({ forceWaveLabels: true });
        }

        window.appState.save();
        
        return true;
    }
    

    /** Смещает currentDate на delta дней с лёгким обновлением графика. */
    navigateDay(delta) {
        if (window.wavesTransformLayer && window.wavesTransformLayer.mapNavigationDayDelta) {
            delta = window.wavesTransformLayer.mapNavigationDayDelta(delta);
        }
        const newDate = new Date(window.appState.currentDate);
        newDate.setDate(newDate.getDate() + delta);

        window.appState.isProgrammaticDateChange = true;
        window.appState.currentDate = window.timeUtils
            ? window.timeUtils.toLocalDate(newDate)
            : newDate;

        this.recalculateCurrentDay(false, { skipSave: true });

        if (window.grid) {
            if (window.grid.refreshForCurrentDay) {
                window.grid.refreshForCurrentDay({ light: true });
            }
            if (window.grid.updateCenterDate) {
                window.grid.updateCenterDate();
            }
        }
        if (window.waves && window.waves.updatePosition) {
            window.waves.updatePosition({ light: true });
        }

        if (window.appState && window.appState.saveDebounced) {
            window.appState.saveDebounced();
        }

        this.updateTodayButton();
        this.updateDateTimeInputs();
        this._scheduleDayNavigationSettle();
    }

    /** Откладывает полное обновление сводки после серии стрелок. */
    _scheduleDayNavigationSettle() {
        if (this._navDaySettleTimer != null) {
            clearTimeout(this._navDaySettleTimer);
        }
        this._navDaySettleTimer = setTimeout(() => {
            this._navDaySettleTimer = null;
            this._flushDayNavigationSettled();
        }, this._navDaySettleMs);
    }

    /** После паузы: заметки на сетке, сводка, вкладка «Пересечения» (без повторного updatePosition). */
    _flushDayNavigationSettled() {
        window.appState.isProgrammaticDateChange = false;

        if (window.grid && window.grid.updateGridNotesHighlight) {
            window.grid.updateGridNotesHighlight();
        }

        if (window.appState && window.appState.saveDebounced) {
            window.appState.saveDebounced();
        } else if (window.appState && window.appState.save) {
            window.appState.save();
        }

        if (window.summaryManager && window.summaryManager.debouncedUpdate) {
            window.summaryManager.debouncedUpdate();
        } else if (window.summaryManager && window.summaryManager.updateSummary) {
            window.summaryManager.updateSummary();
        }

        if (window.stateIntersectionManager && window.stateIntersectionManager.debouncedUpdate) {
            window.stateIntersectionManager.debouncedUpdate();
        } else if (
            window.stateIntersectionManager &&
            window.stateIntersectionManager.updateIntersections
        ) {
            window.stateIntersectionManager.updateIntersections();
        }
    }

    /** Устанавливает currentDate из Date/числа/строки и обновляет график. */
    setDate(newDate, useExactTime = true) {
        window.appState.isProgrammaticDateChange = true;
        
        if (newDate instanceof Date) {
            window.appState.currentDate = window.timeUtils.toLocalDate(newDate);
        } else if (typeof newDate === 'number') {
            window.appState.currentDate = new Date(newDate);
        } else {
            window.appState.currentDate = window.timeUtils.parseStringToLocal(newDate);
        }
        
        this.recalculateCurrentDay(useExactTime, { skipSave: true });
        
        window.grid.refreshForCurrentDay();
        window.grid.updateCenterDate();
        window.waves.updatePosition();
        window.appState.save();
        
        this.updateTodayButton();
        
        if (window.summaryManager && window.summaryManager.updateSummary) {
            window.summaryManager.updateSummary();
        }

        if (window.stateIntersectionManager && window.stateIntersectionManager.updateIntersections) {
            window.stateIntersectionManager.updateIntersections();
        }

        this.updateDateTimeInputs();

        queueMicrotask(() => {
            window.appState.isProgrammaticDateChange = false;
        });
    }

    
    /**
     * Смещение в днях от даты рождения (начало локального дня) до момента на визоре.
     * Та же логика, что в recalculateCurrentDay.
     */
    computeDayOffsetFromBirth(birthTimeMs, vizorDate, useExactTime) {
        const currentDate = window.timeUtils
            ? window.timeUtils.toLocalDate(vizorDate)
            : new Date(vizorDate);
        const baseDate = window.timeUtils
            ? window.timeUtils.toLocalDate(birthTimeMs)
            : new Date(birthTimeMs);

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
        const timeOfDayFraction =
            (hours * 60 * 60 * 1000 +
                minutes * 60 * 1000 +
                seconds * 1000 +
                milliseconds) /
            (24 * 60 * 60 * 1000);

        if (useExactTime) {
            return Math.floor(daysStart) + timeOfDayFraction;
        }
        return Math.round(daysStart);
    }

    /**
     * @param {boolean} useExactTime
     * @param {{ skipSave?: boolean }} [options] skipSave: не писать localStorage (вызывающий сделает save один раз в конце)
     */
    recalculateCurrentDay(useExactTime = false, options = {}) {
        const skipSave = options.skipSave === true;
        this.lastRecalculateUsedExactTime = !!useExactTime;
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
        if (!skipSave) {
            window.appState.save();
        }
        
        if (window.dateComparisonManager && window.dateComparisonManager.debouncedUpdate) {
            window.dateComparisonManager.debouncedUpdate();
        }
        
        return window.appState.currentDay;
    }
    
    /** Переходит на начало сегодняшнего дня (без времени суток). */
    goToToday() {
        const todayStart = window.timeUtils.getStartOfDay(new Date());
        
        window.appState.currentDate = new Date(todayStart);
        
        this.recalculateCurrentDay(false, { skipSave: true });
        
        if (window.grid && window.grid.refreshForCurrentDay) {
            window.grid.refreshForCurrentDay();
        }
        
        window.grid.updateCenterDate();
        window.waves.updatePosition();
        window.appState.save();
        
        this.updateTodayButton();

        if (window.summaryManager && window.summaryManager.updateSummary) {
            window.summaryManager.updateSummary();
        }

        if (window.stateIntersectionManager && window.stateIntersectionManager.updateIntersections) {
            window.stateIntersectionManager.updateIntersections();
        }

        this.updateDateTimeInputs();
    }

    /** Переходит на текущий момент с точным временем. */
    goToNow() {
        window.appState.currentDate = new Date();
        
        this.recalculateCurrentDay(true, { skipSave: true });
        
        window.grid.refreshForCurrentDay();
        window.grid.updateCenterDate();
        window.waves.updatePosition();
        window.appState.save();
        
        this.updateTodayButton();
        
        if (window.summaryManager && window.summaryManager.updateSummary) {
            window.summaryManager.updateSummary();
        }

        if (window.stateIntersectionManager && window.stateIntersectionManager.updateIntersections) {
            window.stateIntersectionManager.updateIntersections();
        }

        this.updateDateTimeInputs();
    }

    /** Читает mainDateInputDate/Time и обновляет визор. */
    setDateFromInputs() {
        const dateValue = this.elements.mainDateInputDate?.value;
        const timeValue = this.elements.mainDateInputTime?.value;
        
        if (dateValue) {
            const newDate = window.timeUtils.parseFromDateAndTimeInputs(dateValue, timeValue);
            
            window.appState.currentDate = newDate;
            
            this.recalculateCurrentDay(true, { skipSave: true });
            
            window.grid.refreshForCurrentDay();
            window.grid.updateCenterDate();
            window.waves.updatePosition();
            window.appState.save();
            
            this.updateTodayButton();

            if (window.summaryManager && window.summaryManager.updateSummary) {
                window.summaryManager.updateSummary();
            }

            if (window.stateIntersectionManager && window.stateIntersectionManager.updateIntersections) {
                window.stateIntersectionManager.updateIntersections();
            }
        }
    }

    /** Алиас setDateFromInputs для совместимости. */
    setDateFromInput() {
        this.setDateFromInputs();
    }
    
    /** Делегирует обновление полей даты/времени uiManager. */
    updateDateTimeInputs() {
        if (window.uiManager && window.uiManager.updateDateTimeInputs) {
            window.uiManager.updateDateTimeInputs();
        }
    }
    
    /** Возвращает текущий момент через timeUtils.now(). */
    getCurrentDate() {
        return window.timeUtils.now();
    }
    
    /** День недели (0–6) для даты. */
    getWeekday(date) {
        return window.timeUtils.getWeekday(date);
    }
    
    /** Название дня недели (краткое или полное). */
    getWeekdayName(date, full = false) {
        return window.timeUtils.getWeekdayName(date, full);
    }
    
    /** Снимает обработчики click-outside у строк в режиме редактирования. */
    cleanupEditingHandlers() {
        document.querySelectorAll('.sun-listItemDate.sun-listItemEditing').forEach(item => {
            if (item._clickOutsideHandler) {
                document.removeEventListener('click', item._clickOutsideHandler);
                delete item._clickOutsideHandler;
            }
        });
    }
    
    /** Обновляет текст #currentDay с учётом дробной части дня. */
    updateCurrentDayElement() {
        const currentDayElement = window.dom.byKey('currentDay');
        if (currentDayElement) {
            const currentDayValue = window.appState.currentDay || 0;
            currentDayElement.textContent = window.timeUtils.formatCurrentDayWithSeconds(
                currentDayValue, 
                window.appState.currentDate
            );
        }
    }
    
    /** Принудительная инициализация даты визора после load(). */
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
            if (window.grid.refreshForCurrentDay) {
                window.grid.refreshForCurrentDay();
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