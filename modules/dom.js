/**
 * @file dom.js
 * Форматирование дат, пол персон, подписи кнопок визора и утилиты DOM.
 */

/** Статическая разметка: классы sun-* (без id в стилях). Значения с # — только где id оставлен по a11y. */
window.SUN_SELECTORS = {
    warningOverlay: '.sun-warningOverlay',
    warningBox: '.sun-warningOverlay .sun-warningBox',
    browserInfo: '.sun-browserInfo',
    todayInfo: '.sun-todayInfo',
    dynamicVersionContainer: '.sun-dynamicVersionContainer',
    colorPickerBtn: '.sun-colorPickerBtn',
    hiddenColorPicker: '.sun-hiddenColorPicker',
    importAllFile: '.sun-importAllFile',
    secretSchemeWrap: '.sun-secretSchemeWrap',
    secretSchemeSection: '.sun-secretSchemeSection',
    secretSchemeToggle: '.sun-secretSchemeToggle',
    secretSchemePanel: '#secretSchemePanel',
    secretSchemeGrid: '.sun-secretSchemeGrid',
    secretSchemeGroupSelect: '#secretSchemeGroupSelect',
    secretSchemeAnchorSelect: '#secretSchemeAnchorSelect',
    secretSchemeReverseSelect: '#secretSchemeReverseSelect',
    timeBarWrap: '.sun-timeBarWrap',
    timeBarControlsSection: '.sun-timeBarControlsSection',
    timeBarControlsToggle: '.sun-timeBarControlsToggle',
    timeBarControls: '#timeBarControls',
    timeBarContainer: '.sun-timeBarContainer',
    timeScale: '.sun-timeScale',
    timeLabels: '.sun-timeLabels',
    timeBarStateStack: '.sun-timeBarStateStack',
    timeNowVline: '.sun-timeBarNowVline',
    timeIndicator: '.sun-timeBarNowMarker',
    tabsSection: '.sun-tabsSection',
    summaryPanel: '.sun-summaryPanel',
    summaryGroupSelect: '.sun-summaryGroupSelect',
    summaryStateSelect: '.sun-summaryStateSelect',
    includePastWaves: '.sun-includePastWaves',
    summaryResults: '.sun-summaryResults',
    intersectionPanel: '.sun-intersectionPanel',
    intersectionSortSelect: '#intersectionSortSelect',
    intersectionDateSelectA: '#intersectionDateSelectA',
    intersectionDateSelectB: '#intersectionDateSelectB',
    intersectionWaveSelect: '#intersectionWaveSelect',
    btnIntersectionTimeRail: '.sun-btnIntersectionTimeRail',
    btnClearWaveSelection: '.sun-btnClearWaveSelection',
    intersectionStats: '.sun-intersectionStats',
    intersectionResults: '.sun-intersectionResults',
    dateComparePanel: '.sun-dateComparePanel',
    dateCompareVizorHint: '.sun-dateCompareVizorHint',
    dateCompareSelectA: '#dateCompareSelectA',
    dateCompareSelectB: '#dateCompareSelectB',
    dateCompareResults: '.sun-dateCompareResults',
    stateSearchPanel: '.sun-stateSearchPanel',
    stateSearchConditions: '#stateSearchConditions',
    btnStateSearchAddCondition: '#btnStateSearchAddCondition',
    btnStateSearchRun: '#btnStateSearchRun',
    btnStateSearchShowWaves: '#btnStateSearchShowWaves',
    stateSearchLimitYears: '#stateSearchLimitYears',
    stateSearchResults: '#stateSearchResults',
    btnExtremumWaveColorHighlight: '.sun-btnExtremumWaveColorHighlight',
    btnFlipH: '.sun-btnFlipH',
    btnFlipV: '.sun-btnFlipV',
    btnPrevDay: '.sun-btnPrevDay',
    currentDay: '.sun-currentDay',
    btnNextDay: '.sun-btnNextDay',
    btnToday: '.sun-btnToday',
    btnNow: '.sun-btnNow',
    mainDateInputDate: '.sun-mainDateInputDate',
    mainDateInputTime: '.sun-mainDateInputTime',
    btnSetDate: '.sun-btnSetDate',
    graphContainer: '.sun-graphContainer',
    graphElement: '.sun-graph',
    centerDateLabel: '.sun-centerDateLabel',
    zoomOverlay: '.sun-zoomOverlay',
    wavesTransformLayer: '.sun-wavesTransformLayer',
    wavesMount: '.sun-wavesMount',
    waveLabelsContainer: '.sun-waveLabelsContainer',
    waveLabelsVerticalContainer: '.sun-waveLabelsVerticalContainer',
    datesPanel: '.sun-datesPanel',
    newPersonGroupName: '.sun-newPersonGroupName',
    btnToggleAddPersonGroup: '.sun-btnToggleAddPersonGroup',
    addPersonGroupFormFields: '#addPersonGroupFormFields',
    btnAddPersonGroup: '.sun-btnAddPersonGroup',
    btnToggleAddDate: '.sun-btnToggleAddDate',
    dateAddFormFields: '#dateAddFormFields',
    dateInput: '.sun-dateInputPerson',
    dateNameInput: '.sun-dateNameInput',
    dateGenderSelect: '.sun-dateGenderSelect',
    btnAddDate: '.sun-btnAddDate',
    dateDescriptionInput: '.sun-dateDescriptionInput',
    dateListForDates: '.sun-dateListForDates',
    wavesPanel: '.sun-wavesPanel',
    displayViewTemplatesBar: '.sun-displayViewTemplatesBar',
    displayViewTemplateSelect: '.sun-displayViewTemplateSelect',
    newDisplayViewTemplateName: '.sun-newDisplayViewTemplateName',
    btnAddDisplayViewTemplate: '.sun-btnAddDisplayViewTemplate',
    btnDeleteDisplayViewTemplate: '.sun-btnDeleteDisplayViewTemplate',
    displayViewTemplateDescription: '.sun-displayViewTemplateDescription',
    newGroupName: '.sun-newGroupName',
    btnToggleAddWaveGroup: '.sun-btnToggleAddWaveGroup',
    addWaveGroupFormFields: '#addWaveGroupFormFields',
    btnToggleAddWave: '.sun-btnToggleAddWave',
    addWaveFormFields: '#addWaveFormFields',
    btnAddGroup: '.sun-btnAddGroup',
    customWaveName: '.sun-customWaveName',
    customWavePeriod: '.sun-customWavePeriod',
    customWaveType: '.sun-customWaveType',
    customWaveColor: '.sun-customWaveColor',
    customWaveNote: '.sun-customWaveNote',
    btnAddCustomWave: '.sun-btnAddCustomWave',
    wavesList: '.sun-wavesList',
    dbImportTextarea: '.sun-dbImportTextarea',
    dbImportProgress: '.sun-dbImportProgress',
    dbImportProgressBar: '.sun-dbImportProgressBar',
    dbImportStatus: '.sun-dbImportStatus',
    osInfoItem: '#osInfoItem',
    archInfoItem: '#archInfoItem'
};

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

    /** Тултип строки сигнала: имя, период, заметка (через «-» на отдельных строках). */
    formatWaveHoverTitle(name, period, note) {
        const n = String(name == null ? '' : name);
        const p = period != null && period !== '' ? `${period} дней` : '';
        const desc = typeof note === 'string' ? note.trim() : '';
        const parts = [n];
        if (p) {
            parts.push('-', p);
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
    
    /** Кэширует узлы из SUN_SELECTORS (ключ → элемент). */
    cacheElements() {
        Object.keys(window.SUN_SELECTORS).forEach((key) => {
            const el = this.byKey(key);
            if (el) {
                this.elements[key] = el;
            }
        });
    }

    /**
     * Узел по ключу SUN_SELECTORS (.sun-*) или по id (динамические waveLabel*, osInfoItem и т.д.).
     * @param {string} key
     * @returns {Element|null}
     */
    byKey(key) {
        const sel = window.SUN_SELECTORS[key];
        if (sel) {
            return document.querySelector(sel);
        }
        return document.getElementById(key);
    }

    /** @deprecated Используйте byKey(key). */
    get(key) {
        return this.elements[key] || this.byKey(key);
    }
    
    $(selector) {
        return document.querySelector(selector);
    }

    /** jQuery-обёртка по ключу SUN_SELECTORS. */
    jq(key) {
        const sel = window.SUN_SELECTORS[key];
        return sel ? $(sel) : $(key);
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
        const map = {
            solid: 'sun-solid',
            dashed: 'sun-dashed',
            dotted: 'sun-dotted',
            zigzag: 'sun-zigzag',
            'dash-dot': 'sun-dashDot',
            'long-dash': 'sun-longDash'
        };
        return map[type] || (type && String(type).startsWith('sun-') ? type : `sun-${type}`);
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

    /** @deprecated Используй getDateCompareVizorToggleLabel — пересечения с иной датой Б показывают A+B. */
    getIntersectionVizorToggleLabelForWaveB(waveId) {
        return this.getDateCompareVizorToggleLabel(waveId);
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

    /** Обновляет подписи всех .sun-showOnVizorBtn. */
    refreshShowOnVizorButtonLabels() {
        document.querySelectorAll('.sun-showOnVizorBtn[data-wave-id]').forEach((btn) => {
            const id = btn.dataset.waveId;
            if (!id) return;
            if (btn.classList.contains('sun-dateCompareVizorBtn')) {
                btn.textContent = this.getDateCompareVizorToggleLabel(id);
            } else if (btn.classList.contains('sun-intersectionVizorBBtn')) {
                btn.textContent = this.getDateCompareVizorToggleLabel(id);
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

const SUN_LAYOUT_LEGACY_VAR_NAMES = [
    '--gsx',
    '--gw',
    '--gh',
    '--dgw',
    '--dgh',
    '--sun-waveLabel-fill',
    '--time-now-frac',
    '--time-row-frac',
    '--time-bar-side-w',
    '--time-bar-now-row-h',
    '--time-bar-now-line-anchor',
    '--secret-scheme-cell-bg-opacity',
    '--sun-wave-label-edge-gap',
    '--cross-bar-half',
    '--cross-window-half'
];

/** Снимает legacy custom properties с узлов разметки. */
window.dom.clearSunLayoutVarsFromMarkup = function clearSunLayoutVarsFromMarkup() {
    const nodes = [
        document.documentElement,
        document.body,
        document.querySelector('.sun-app'),
        document.querySelector('.sun-graphViewport'),
        document.querySelector('.sun-graphContainer')
    ];
    nodes.forEach((node) => {
        if (!node) {
            return;
        }
        SUN_LAYOUT_LEGACY_VAR_NAMES.forEach((name) => {
            node.style.removeProperty(name);
        });
    });
};

/** <style id="sun-runtime-layout"> — размеры графа без CSS-переменных на DOM. */
window.dom.ensureSunRuntimeLayoutStyle = function ensureSunRuntimeLayoutStyle() {
    let node = document.getElementById('sun-runtime-layout');
    if (!node) {
        node = document.createElement('style');
        node.id = 'sun-runtime-layout';
        document.head.appendChild(node);
    }
    return node;
};

/** Прямые width/height на классах (не :root, не custom properties). */
window.dom.applySunRuntimeLayoutCss = function applySunRuntimeLayoutCss(vars) {
    window.dom.clearSunLayoutVarsFromMarkup();
    const sheet = window.dom.ensureSunRuntimeLayoutStyle();
    const gw = vars.gw || '1200px';
    const gh = vars.gh || '500px';
    const dgw = vars.dgw || gw;
    const dgh = vars.dgh || gh;
    const rules = [
        `.sun-timeBarWrap,
.sun-timeBarContainer {
  width: ${gw};
}`,
        `.sun-secretSchemeWrap {
  width: ${gw};
}`,
        `.sun-graphViewport {
  width: ${dgw};
}`,
        `.sun-graphContainer {
  width: ${dgw};
  height: ${dgh};
}`
    ];
    if (vars.sq != null) {
        rules.push(`.sun-gridWrapper {
  width: ${vars.sq};
}`);
    }
    sheet.textContent = rules.join('\n');
};