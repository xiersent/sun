/**
 * @file dom.js
 * Форматирование дат, пол персон, подписи кнопок визора и утилиты DOM.
 */
class DOM {
    constructor() {
        this.elements = {};
        this.cacheElements();
    }

    /** Форматирует timestamp как DD.MM.YYYY. */
    formatDate(timestamp) {
        return window.timeUtils.formatDate(timestamp);
    }

    static PERSON_GENDER_ICONS = { unset: '⚥', male: '♂', female: '♀' };

    /** Приводит пол персоны к male/female/unset. */
    normalizePersonGender(value) {
        if (value === 'male' || value === 'female') {
            return value;
        }
        return 'unset';
    }

    /** Unicode-иконка пола персоны. */
    getPersonGenderIcon(gender) {
        const g = this.normalizePersonGender(gender);
        return DOM.PERSON_GENDER_ICONS[g] || DOM.PERSON_GENDER_ICONS.unset;
    }

    /** Русская подпись пола персоны. */
    getPersonGenderLabel(gender) {
        const g = this.normalizePersonGender(gender);
        if (g === 'male') {
            return 'Мужской';
        }
        if (g === 'female') {
            return 'Женский';
        }
        return 'Не указан';
    }

    /** Тултип строки персоны: имя, дата, пол (если указан), заметка (через «-» на отдельных строках). */
    formatPersonDateHoverTitle(name, formattedDate, description, gender) {
        const n = String(name == null ? '' : name);
        const d = String(formattedDate == null ? '' : formattedDate);
        const desc = typeof description === 'string' ? description.trim() : '';
        const g = this.normalizePersonGender(gender);
        const parts = [n, '-', d];
        if (g !== 'unset') {
            parts.push('-', this.getPersonGenderLabel(g));
        }
        if (desc) {
            parts.push('-', desc);
        }
        return parts.join('\n');
    }
    
    /** Дата и время с секундами. */
    formatDateTimeFull(timestamp) {
        return window.timeUtils.formatDateTime(timestamp);
    }
    
    /** Текст currentDay для #currentDay. */
    formatCurrentDayWithSeconds(currentDay, currentDate = null) {
        return window.timeUtils.formatCurrentDayWithSeconds(currentDay, currentDate);
    }
    
    /** Строка для input datetime-local. */
    formatDateForDateTimeInputWithSeconds(timestamp) {
        return window.timeUtils.formatForDateTimeInput(timestamp);
    }
    
    /** Разница в днях между двумя датами. */
    getDaysBetweenDates(date1, date2) {
        return window.timeUtils.getDaysBetween(date1, date2);
    }
    
	getWeekday(date) {
		return window.timeUtils ? window.timeUtils.getWeekday(date) : new Date(date).getDay();
	}

	getWeekdayName(date, full = false) {
		if (window.timeUtils) {
			return window.timeUtils.getWeekdayName(date, full);
		}
		
		const d = new Date(date);
		const weekdays = full ? 
			['Воскресенье', 'Понедельник', 'Вторник', 'Среда', 'Четверг', 'Пятница', 'Суббота'] :
			['Вс', 'Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб'];
		return weekdays[d.getDay()];
	}

	getDaysBetweenExact(date1, date2) {
		return this.getDaysBetweenDates(date1, date2);
	}
    
    /** Кэширует все элементы с атрибутом id. */
    cacheElements() {
        document.querySelectorAll('[id]').forEach(el => {
            this.elements[el.id] = el;
        });
    }
    
    /** Возвращает закэшированный элемент по id. */
    get(id) {
        return this.elements[id];
    }
    
    $(selector) {
        return document.querySelector(selector);
    }
    
    $$(selector) {
        return document.querySelectorAll(selector);
    }
    
    /** Парсит строку даты-времени в timestamp. */
    stringFromDateTimeStringToTimestamp(dateTimeString) {
        if (window.timeUtils) {
            const date = window.timeUtils.parseStringToLocal(dateTimeString);
            return date.getTime();
        }
        
        try {
            if (!dateTimeString) return Date.now();
            
            let normalized = dateTimeString.trim();
            if (normalized.includes('T')) {
                normalized = normalized.replace('T', ' ');
            }
            
            const parts = normalized.split(' ');
            const datePart = parts[0];
            
            let timePart = '00:00:00';
            if (parts.length > 1) {
                timePart = parts[1];
                if (timePart.split(':').length === 2) {
                    timePart += ':00';
                }
            }
            
            const [year, month, day] = datePart.split('-').map(Number);
            const [hours, minutes, seconds] = timePart.split(':').map(Number);
            
            const date = new Date(year, month - 1, day, hours, minutes, seconds, 0);
            
            if (isNaN(date.getTime())) {
                return Date.now();
            }
            return date.getTime();
        } catch (error) {
            return Date.now();
        }
    }
    
    /** Значение для input type=date. */
    formatDateForInput(timestamp) {
        if (window.timeUtils && window.timeUtils.formatForDateInput) {
            return window.timeUtils.formatForDateInput(timestamp);
        }
        
        if (!timestamp) return '';
        const date = new Date(timestamp);
        if (isNaN(date.getTime())) return '';
        return date.toISOString().split('T')[0];
    }
    
    /** Полных лет между двумя timestamp. */
    getYearsBetweenDates(timestamp1, timestamp2) {
        if (window.timeUtils && window.timeUtils.getYearsBetween) {
            return window.timeUtils.getYearsBetween(timestamp1, timestamp2);
        }
        
        if (!timestamp1 || !timestamp2) return 0;
        try {
            const date1 = new Date(timestamp1);
            const date2 = new Date(timestamp2);
            
            if (isNaN(date1.getTime()) || isNaN(date2.getTime())) return 0;
            const diffMs = Math.abs(date2.getTime() - date1.getTime());
            const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
            const diffYears = Math.floor(diffDays / 365.25);
            return diffYears;
        } catch (e) {
            return 0;
        }
    }
    
    /** Возвращает тип линии волны (solid/dashed/…). */
    getWaveStyle(type) {
        return type;
    }
    
    /** Человекочитаемое описание типа линии волны. */
    getWaveDescription(type) {
        const descriptions = {
            'solid': 'сплошная линия',
            'dashed': 'пунктирная линия',
            'dotted': 'точечная линия',
            'zigzag': 'зигзагообразная линия',
            'dash-dot': 'штрих-линия',
            'long-dash': 'длинный штрих'
        };
        return descriptions[type] || 'неизвестный тип';
    }
    
    /** Текущая дата как new Date(). */
    getCurrentDate() {
        return new Date();
    }
    
    /** Парсит строку даты в миллисекунды. */
    stringToTimestamp(dateString) {
        if (window.timeUtils) {
            const date = window.timeUtils.parseStringToLocal(dateString);
            return date.getTime();
        }
        
        try {
            const date = new Date(dateString);
            if (isNaN(date.getTime())) {
                return Date.now();
            }
            return date.getTime();
        } catch (error) {
            return Date.now();
        }
    }
    
    /** Проверка, что значение — корректный timestamp. */
    isTimestamp(value) {
        return window.timeUtils ? window.timeUtils.isTimestamp(value) : 
            (typeof value === 'number' && !isNaN(value) && value > 0);
    }
    
    /** Начало локального дня для timestamp. */
    getStartOfDayLocal(timestamp) {
        if (window.timeUtils && window.timeUtils.getStartOfDay) {
            return window.timeUtils.getStartOfDay(timestamp);
        }
        
        const date = new Date(timestamp);
        return new Date(date.getFullYear(), date.getMonth(), date.getDate(), 0, 0, 0, 0);
    }

    /** Волна рисуется на визоре: видимость включена и группа сигнала активна */
    isWaveShownOnVizor(waveId) {
        if (!window.appState || !window.appState.waveVisibility) return false;
        const waveIdStr = String(waveId);
        const isWaveVisible = window.appState.waveVisibility[waveIdStr] !== false;
        if (!isWaveVisible) return false;
        if (window.waves && typeof window.waves.isWaveGroupEnabled === 'function') {
            return window.waves.isWaveGroupEnabled(waveId);
        }
        return isWaveVisible;
    }

    /** Текст кнопки «Показать/Скрыть волну». */
    getWaveVizorToggleButtonLabel(waveId) {
        return this.isWaveShownOnVizor(waveId) ? 'Скрыть волну' : 'Показать волну';
    }

    /** Слой B (фаза даты Б на визоре), группа сигнала должна быть включена. */
    isWaveLayerBOnVizor(waveId) {
        if (!window.appState) return false;
        const wid = String(waveId);
        if (window.waves && typeof window.waves.isWaveGroupEnabled === 'function' && !window.waves.isWaveGroupEnabled(waveId)) {
            return false;
        }
        return window.appState.waveBold[wid] === true;
    }

    /** Текст кнопки слоя B на вкладке пересечений. */
    getIntersectionVizorToggleLabelForWaveB(waveId) {
        return this.isWaveLayerBOnVizor(waveId) ? 'Скрыть волну от даты Б' : 'Показать волну от даты Б';
    }

    /** Слои A и B сигнала видны на графике (группа вкл, видимость A и B). */
    isBothWaveLayersOnVizor(waveId) {
        if (!window.appState || !window.waves) return false;
        const wid = String(waveId);
        if (window.waves.isWaveGroupEnabled && !window.waves.isWaveGroupEnabled(waveId)) {
            return false;
        }
        const aOn = window.appState.waveVisibility[wid] !== false;
        const bOn = window.appState.waveBold[wid] === true;
        return aOn && bOn;
    }

    /** Текст кнопки A+B на вкладке сравнения дат. */
    getDateCompareVizorToggleLabel(waveId) {
        return this.isBothWaveLayersOnVizor(waveId) ? 'Скрыть A и B' : 'Показать A и B';
    }

    /** Обновляет подписи всех .show-on-vizor-btn. */
    refreshShowOnVizorButtonLabels() {
        document.querySelectorAll('.show-on-vizor-btn[data-wave-id]').forEach((btn) => {
            const id = btn.dataset.waveId;
            if (!id) return;
            if (btn.classList.contains('date-compare-vizor-btn')) {
                btn.textContent = this.getDateCompareVizorToggleLabel(id);
            } else if (btn.classList.contains('intersection-vizor-b-btn')) {
                btn.textContent = this.getIntersectionVizorToggleLabelForWaveB(id);
            } else {
                btn.textContent = this.getWaveVizorToggleButtonLabel(id);
            }
        });
    }
}

/** Иконки и подсказки кнопок действий в списках (на кнопке — только иконка). */
window.SUN_ACTION_LABELS = {
    edit: '✎',
    editActive: '✎',
    editTitle: 'Редактировать',
    editActiveTitle: 'Редактирование…',
    save: '💾',
    saveTitle: 'Сохранить',
    destroy: '⨯',
    destroyTitle: 'Уничтожить',
    cancel: '↩',
    cancelTitle: 'Отмена',
    expand: '▶',
    expandTitle: 'Развернуть',
    collapse: '▼',
    collapseTitle: 'Свернуть'
};

/** Подпись и aria-label кнопки действия в списке (edit/save/destroy/cancel). */
window.SUN_ACTION_LABELS.applyToButton = function applyToButton(btn, action, opts) {
    if (!btn || !action) return;
    const L = window.SUN_ACTION_LABELS;
    const editing = opts && opts.editing;
    if (action === 'edit') {
        btn.textContent = editing ? L.editActive : L.edit;
        const title = editing ? L.editActiveTitle : L.editTitle;
        btn.title = title;
        btn.setAttribute('aria-label', title);
    } else if (action === 'save') {
        btn.textContent = L.save;
        btn.title = L.saveTitle;
        btn.setAttribute('aria-label', L.saveTitle);
    } else if (action === 'destroy') {
        btn.textContent = L.destroy;
        btn.title = L.destroyTitle;
        btn.setAttribute('aria-label', L.destroyTitle);
    } else if (action === 'cancel') {
        btn.textContent = L.cancel;
        btn.title = L.cancelTitle;
        btn.setAttribute('aria-label', L.cancelTitle);
    }
};

/** Иконка и aria-expanded для кнопки разворота группы. */
window.SUN_ACTION_LABELS.applyExpandButton = function applyExpandButton(btn, expanded) {
    if (!btn) return;
    const L = window.SUN_ACTION_LABELS;
    const isOpen = !!expanded;
    btn.textContent = isOpen ? L.collapse : L.expand;
    const title = isOpen ? L.collapseTitle : L.expandTitle;
    btn.title = title;
    btn.setAttribute('aria-label', title);
    btn.setAttribute('aria-expanded', isOpen ? 'true' : 'false');
};

window.dom = new DOM();