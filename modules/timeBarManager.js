/**
 * @file timeBarManager.js
 * Временная шкала под графиком: часы, индикатор «сейчас», строки состояний.
 */
class TimeBarManager {
    constructor() {
        this.container = null;
        this.timeScale = null;
        this.timeIndicator = null;
        this.timeNowVline = null;
        this.timeLabels = null;
        this.indicatorLabel = null;
        this._tickRaf = null;
        this._lastIndicatorSecond = -1;
        this.isInitialized = false;
        this.currentDate = null;
        this.controlsPanel = null;
        this._controlsSig = '';
        this._stateRowStorageKey = 'timeBarStateRowHidden';
        this._timeBarGroupVisibleKey = 'timeBarGroupVisible';
        this._controlsOpenStorageKey = 'timeBarControlsOpen';
        this._segmentLabelModeKey = 'timeBarSegmentLabelMode';
        this._controlsChangeBound = false;
        this._controlsToggleBound = false;
        this.controlsToggle = null;
    }
    
    /** Создаёт шкалу, панель управления и запускает тики. */
    init() {
        if (this.isInitialized) return;
        
        this.createTimeBar();
        this.buildControlsPanel();
        this.createHourMarkers();
        this.setupUpdates();
        this.updateTimeIndicator();
        
        this.isInitialized = true;
    }
    
    /** DOM временной шкалы под graph-section. */
    createTimeBar() {
        if (window.dom.byKey('timeBarContainer')) {
            this.container = window.dom.byKey('timeBarContainer');
            this.ensureStackedTimeBarLayout();
            this.ensureWrapper();
            this.timeScale = window.dom.byKey('timeScale');
            this.timeLabels = window.dom.byKey('timeLabels');
            this._bindNowIndicatorElements();
            this.buildStateStackRows();
            return;
        }

        const timeBarHTML = `
            <div class="sun-timeBar sun-timeBarStacked">
                <div class="sun-timeBarStateRow sun-timeBarHoursRow">
                    <div class="sun-timeBarStateSide sun-timeBarStateSideHours" aria-hidden="true"></div>
                    <div class="sun-timeBarHoursTrack">
                        <div class="sun-timeScale sun-timeScaleInHoursTrack" id="timeScale"></div>
                        <div class="sun-timeLabels" id="timeLabels"></div>
                    </div>
                </div>
                <div class="sun-timeBarStateStack" id="timeBarStateStack"></div>
                ${this._getNowRowHTML()}
            </div>
        `;
        
        const container = document.createElement('div');
        container.id = 'timeBarContainer';
        container.className = 'sun-timeBarContainer sun-timeBarContainerInWrap';
        container.innerHTML = timeBarHTML;
        
        const graphSection = document.querySelector('.sun-graphSection');
        const graphViewport = document.querySelector('.sun-graphViewport');
        const graphContainer = document.querySelector('.sun-graphContainer');
        const insertBeforeEl = graphViewport || graphContainer;
        
        if (insertBeforeEl && graphSection) {
            graphSection.insertBefore(container, insertBeforeEl);
            
            this.container = container;
            this.timeScale = window.dom.byKey('timeScale');
            this.timeLabels = window.dom.byKey('timeLabels');
            this._bindNowIndicatorElements();
            this.ensureWrapper();
            this.buildStateStackRows();
        }
    }

    /** Создаёт обёртку sun-timeBarWrap при необходимости. */
    ensureWrapper() {
        const wrap = window.dom.byKey('timeBarWrap');
        if (wrap) {
            this._ensureControlsChrome();
            return;
        }
        if (!this.container || !this.container.parentNode) return;
        const wrapper = document.createElement('div');
        wrapper.className = 'sun-timeBarWrap';
        wrapper.id = 'timeBarWrap';
        const parent = this.container.parentNode;
        parent.insertBefore(wrapper, this.container);
        wrapper.appendChild(this.container);
        this._ensureControlsChrome();
    }

    /** Читает раскрытие панели controls из localStorage. */
    _loadControlsPanelOpen() {
        try {
            return localStorage.getItem(this._controlsOpenStorageKey) === '1';
        } catch {
            return false;
        }
    }

    /** Сохраняет состояние панели controls. */
    _saveControlsPanelOpen(open) {
        try {
            localStorage.setItem(this._controlsOpenStorageKey, open ? '1' : '0');
        } catch {
            /* ignore */
        }
    }

    /** CSS/aria для свёрнутой/развёрнутой панели. */
    _applyControlsPanelOpen(open) {
        if (!this.controlsPanel || !this.controlsToggle) {
            return;
        }
        if (open) {
            this.controlsPanel.classList.remove('sun-timeBarControlsCollapsed');
            this.controlsToggle.setAttribute('aria-expanded', 'true');
            this.controlsToggle.textContent = 'Скрыть';
            this.controlsToggle.classList.add('sun-active');
        } else {
            this.controlsPanel.classList.add('sun-timeBarControlsCollapsed');
            this.controlsToggle.setAttribute('aria-expanded', 'false');
            const L = window.SUN_ACTION_LABELS;
            const editLabel = L && L.editTitle ? L.editTitle : 'Редактировать';
            this.controlsToggle.textContent = editLabel;
            this.controlsToggle.title = editLabel;
            this.controlsToggle.setAttribute('aria-label', editLabel);
            this.controlsToggle.classList.remove('sun-active');
        }
    }

    /** Переключает видимость панели controls. */
    _toggleControlsPanel() {
        const open = this.controlsPanel.classList.contains('sun-timeBarControlsCollapsed');
        this._applyControlsPanelOpen(open);
        this._saveControlsPanelOpen(open);
    }

    /** Кнопка toggle и шапка панели controls. */
    _ensureControlsChrome() {
        const wrap = window.dom.byKey('timeBarWrap');
        if (!wrap) {
            return;
        }

        wrap.querySelector('.sun-timeBarControls-head')?.remove();

        let section = window.dom.byKey('timeBarControlsSection');
        if (!section) {
            section = document.createElement('div');
            section.className = 'sun-panelSection sun-timeBarControlsSection sun-timeBarControlsSectionLayout';
            section.id = 'timeBarControlsSection';
        }
        if (section.parentElement !== wrap) {
            wrap.insertBefore(section, wrap.firstChild);
        } else if (wrap.firstElementChild !== section) {
            wrap.insertBefore(section, wrap.firstChild);
        }

        let tabContainer = section.querySelector('.sun-tabContainer');
        if (!tabContainer) {
            tabContainer = document.createElement('div');
            tabContainer.className = 'sun-tabContainer';
            section.appendChild(tabContainer);
        }

        let tabButtons = tabContainer.querySelector('.sun-tabButtons.sun-tabButtonsFramed');
        if (!tabButtons) {
            tabButtons = document.createElement('div');
            tabButtons.className = 'sun-tabButtons sun-tabButtonsFramed';
            tabButtons.setAttribute('role', 'tablist');
            tabButtons.setAttribute('aria-label', 'Настройки полосы времени');
            tabContainer.appendChild(tabButtons);
        }

        let panel = window.dom.byKey('timeBarControls');

        if (!panel) {
            panel = document.createElement('div');
            panel.className = 'sun-timeBarControls sun-timeBarControlsCollapsed sun-timeBarControlsInSection';
            panel.id = 'timeBarControls';
            panel.setAttribute('aria-label', 'Видимость полос и групп');
        }
        if (panel.parentElement !== section) {
            section.appendChild(panel);
        } else if (panel.previousElementSibling !== tabContainer) {
            section.insertBefore(panel, tabContainer.nextElementSibling);
        }

        let btn = window.dom.byKey('timeBarControlsToggle');
        if (!btn) {
            btn = document.createElement('button');
            btn.type = 'button';
            btn.className = 'sun-tabButton';
            btn.id = 'timeBarControlsToggle';
            const L = window.SUN_ACTION_LABELS;
            const editLabel = L && L.editTitle ? L.editTitle : 'Редактировать';
            btn.textContent = editLabel;
            btn.title = editLabel;
            btn.setAttribute('aria-label', editLabel);
            btn.setAttribute('aria-expanded', 'false');
            btn.setAttribute('aria-controls', 'timeBarControls');
            tabButtons.appendChild(btn);
        } else {
            btn.classList.remove('sun-uiBtn');
            if (btn.parentElement !== tabButtons) {
                tabButtons.appendChild(btn);
            }
        }

        this.controlsPanel = panel;
        this.controlsToggle = btn;

        if (!this._controlsToggleBound && this.controlsToggle) {
            this._controlsToggleBound = true;
            this.controlsToggle.addEventListener('click', () => this._toggleControlsPanel());
        }

        this._applyControlsPanelOpen(this._loadControlsPanelOpen());
    }

    /** Внутренний метод loadStateRowHidden. */
    _loadStateRowHidden() {
        try {
            const raw = localStorage.getItem(this._stateRowStorageKey);
            if (!raw) return {};
            const o = JSON.parse(raw);
            return o && typeof o === 'object' ? o : {};
        } catch {
            return {};
        }
    }

    /** Внутренний метод saveStateRowHidden. */
    _saveStateRowHidden(map) {
        try {
            localStorage.setItem(this._stateRowStorageKey, JSON.stringify(map));
        } catch {
            /* ignore */
        }
    }

    /** Внутренний метод loadTimeBarGroupVisible. */
    _loadTimeBarGroupVisible() {
        try {
            const raw = localStorage.getItem(this._timeBarGroupVisibleKey);
            if (!raw) return {};
            const o = JSON.parse(raw);
            return o && typeof o === 'object' ? o : {};
        } catch {
            return {};
        }
    }

    /** Внутренний метод saveTimeBarGroupVisible. */
    _saveTimeBarGroupVisible(map) {
        try {
            localStorage.setItem(this._timeBarGroupVisibleKey, JSON.stringify(map));
        } catch {
            /* ignore */
        }
    }

    /** Режим подписей колосков timeBar: period | name. */
    getSegmentLabelMode() {
        try {
            const raw = localStorage.getItem(this._segmentLabelModeKey);
            return raw === 'name' ? 'name' : 'period';
        } catch {
            return 'period';
        }
    }

    /** Внутренний метод saveSegmentLabelMode. */
    _saveSegmentLabelMode(mode) {
        try {
            localStorage.setItem(this._segmentLabelModeKey, mode === 'name' ? 'name' : 'period');
        } catch {
            /* ignore */
        }
    }

    /** Видимость группы только на шкале sun-timeBar (не связана с group.enabled). */
    isTimeBarGroupVisible(groupId) {
        const map = this._loadTimeBarGroupVisible();
        const key = String(groupId);
        return map[key] !== false;
    }

    /** Видна ли группа волны на временной шкале. */
    isTimeBarGroupVisibleForWave(waveId) {
        if (!window.appState || !window.appState.data) return true;
        const waveIdStr = String(waveId);
        const groups = window.appState.data.groups || [];
        for (let i = 0; i < groups.length; i++) {
            const g = groups[i];
            const waveIds = g.waves || [];
            for (let j = 0; j < waveIds.length; j++) {
                if (String(waveIds[j]) === waveIdStr) {
                    return this.isTimeBarGroupVisible(g.id);
                }
            }
        }
        return true;
    }

    _syncTimeBarStackLayout() {
        const stack = window.dom.byKey('timeBarStateStack');
        const nowRow = document.querySelector('.sun-timeBarNowRow');
        if (!stack) {
            return;
        }
        stack.querySelectorAll('.sun-timeBarStateRow').forEach((row) => {
            row.classList.remove('sun-timeBarStateRowLastVisible');
        });
        const visible = Array.from(
            stack.querySelectorAll('.sun-timeBarStateRow:not(.sun-timeBarStateRowHidden)')
        );
        if (visible.length > 0) {
            visible[visible.length - 1].classList.add('sun-timeBarStateRowLastVisible');
        }
        if (nowRow) {
            nowRow.classList.toggle('sun-timeBarNowRowWhenStackEmpty', visible.length === 0);
        }
    }

    /** Внутренний метод setStateRowVisible. */
    _setStateRowVisible(state, visible) {
        const row = document.querySelector(`.sun-timeBarStateRow[data-state="${state}"]`);
        if (!row) return;
        if (visible) {
            row.classList.remove('sun-timeBarStateRowHidden');
        } else {
            row.classList.add('sun-timeBarStateRowHidden');
        }
        const cb = document.querySelector(`.sun-timeBarStateCheck[data-state="${state}"]`);
        if (cb) cb.checked = visible;
        this._syncTimeBarStackLayout();
    }

    /** Внутренний метод applyStateRowHiddenToRows. */
    _applyStateRowHiddenToRows(hidden) {
        for (let s = 5; s >= -5; s--) {
            this._setStateRowVisible(String(s), hidden[String(s)] !== true);
        }
    }

    /** Чекбоксы видимости групп на временной шкале. */
    buildControlsPanel() {
        this.ensureWrapper();
        const panel = this.controlsPanel || window.dom.byKey('timeBarControls');
        if (!panel) return;

        const groups = (window.appState && window.appState.data && window.appState.data.groups) || [];
        const groupVisible = this._loadTimeBarGroupVisible();
        const labelMode = this.getSegmentLabelMode();
        const sig = `${labelMode}|${groups.map((g) => `${g.id}:${groupVisible[String(g.id)] === false ? 0 : 1}:${g.name || ''}`).join('|')}`;
        if (sig === this._controlsSig && panel.children.length > 0) {
            return;
        }
        this._controlsSig = sig;

        const hidden = this._loadStateRowHidden();
        panel.innerHTML = '';

        const labelModeRow = document.createElement('div');
        labelModeRow.className = 'sun-timeBarControlsRow sun-timeBarControlsLabelMode';

        const labelModeSelect = document.createElement('select');
        labelModeSelect.className = 'sun-timeBarSegmentLabelModeSelect';
        labelModeSelect.setAttribute('aria-label', 'Режим отображения колосков');
        labelModeSelect.autocomplete = 'off';

        const optPeriod = document.createElement('option');
        optPeriod.value = 'period';
        optPeriod.textContent = 'Показывать периоды';
        const optName = document.createElement('option');
        optName.value = 'name';
        optName.textContent = 'Показывать названия';
        labelModeSelect.appendChild(optPeriod);
        labelModeSelect.appendChild(optName);
        labelModeSelect.value = labelMode;

        labelModeRow.appendChild(labelModeSelect);
        panel.appendChild(labelModeRow);

        const statesRow = document.createElement('div');
        statesRow.className = 'sun-timeBarControlsRow sun-timeBarControlsStates';

        for (let s = -5; s <= 5; s++) {
            const label = document.createElement('label');
            label.className = 'sun-timeBarControlCheck';
            const text = document.createElement('span');
            text.className = 'sun-timeBarControlLabel';
            text.textContent = s > 0 ? `+${s}` : String(s);
            const cb = document.createElement('input');
            cb.type = 'checkbox';
            cb.className = 'sun-timeBarStateCheck';
            cb.dataset.state = String(s);
            cb.checked = hidden[String(s)] !== true;
            cb.autocomplete = 'off';
            label.appendChild(text);
            label.appendChild(cb);
            statesRow.appendChild(label);
        }

        const groupsRow = document.createElement('div');
        groupsRow.className = 'sun-timeBarControlsRow sun-timeBarControlsGroups';

        if (groups.length === 0) {
            const empty = document.createElement('span');
            empty.className = 'sun-timeBarControlsEmpty';
            empty.textContent = '—';
            groupsRow.appendChild(empty);
        } else {
            groups.forEach((group) => {
                const label = document.createElement('label');
                label.className = 'sun-timeBarControlCheck';
                const text = document.createElement('span');
                text.className = 'sun-timeBarControlLabel sun-timeBarControlLabelInGroups';
                text.textContent = group.name || `Группа ${group.id}`;
                const cb = document.createElement('input');
                cb.type = 'checkbox';
                cb.className = 'sun-timeBarGroupCheck';
                cb.dataset.groupId = String(group.id);
                cb.checked = this.isTimeBarGroupVisible(group.id);
                cb.autocomplete = 'off';
                label.appendChild(text);
                label.appendChild(cb);
                groupsRow.appendChild(label);
            });
        }

        panel.appendChild(statesRow);
        panel.appendChild(groupsRow);

        if (!this._controlsChangeBound) {
            this._controlsChangeBound = true;
            panel.addEventListener('change', (e) => this._onControlsChange(e));
        }

        this._applyStateRowHiddenToRows(hidden);
    }

    /** Перестраивает панель чекбоксов групп на шкале. */
    refreshControlsPanel() {
        this._controlsSig = '';
        this.buildControlsPanel();
    }

    /** Внутренний метод onControlsChange. */
    _onControlsChange(e) {
        const t = e.target;
        if (!t) return;

        if (t.tagName === 'SELECT' && t.classList.contains('sun-timeBarSegmentLabelModeSelect')) {
            this._saveSegmentLabelMode(t.value);
            if (window.extremumTimeManager && window.extremumTimeManager.updateExtremums) {
                window.extremumTimeManager.updateExtremums();
            }
            return;
        }

        if (t.tagName !== 'INPUT') return;

        if (t.classList.contains('sun-timeBarStateCheck')) {
            const st = t.dataset.state;
            if (st == null) return;
            const hidden = this._loadStateRowHidden();
            if (t.checked) {
                delete hidden[st];
            } else {
                hidden[st] = true;
            }
            this._saveStateRowHidden(hidden);
            this._setStateRowVisible(st, t.checked);
            if (t.checked && window.extremumTimeManager && window.extremumTimeManager.updateExtremums) {
                window.extremumTimeManager.updateExtremums();
            }
            return;
        }

        if (t.classList.contains('sun-timeBarGroupCheck')) {
            const groupId = t.dataset.groupId;
            if (!groupId) return;

            const visible = this._loadTimeBarGroupVisible();
            if (t.checked) {
                delete visible[String(groupId)];
            } else {
                visible[String(groupId)] = false;
            }
            this._saveTimeBarGroupVisible(visible);

            if (window.extremumTimeManager && window.extremumTimeManager.updateExtremums) {
                window.extremumTimeManager.updateExtremums();
            }
        }
    }

    /**
     * Миграция старой вёрстки (одна шкала без полос состояний).
     */
    ensureStackedTimeBarLayout() {
        const bar = this.container && this.container.querySelector('.sun-timeBar');
        if (!bar) return;

        bar.classList.add('sun-timeBarStacked');

        if (bar.querySelector('.sun-timeBarRulerRow')) {
            const scale = window.dom.byKey('timeScale');
            const labels = window.dom.byKey('timeLabels');
            bar.querySelector('.sun-timeBarRulerRow')?.remove();
            this._insertHoursRow(bar, scale, labels);
        }

        if (!bar.querySelector('.sun-timeBarStateStack')) {
            bar.innerHTML = `
                <div class="sun-timeBarStateRow sun-timeBarHoursRow">
                    <div class="sun-timeBarStateSide sun-timeBarStateSideHours" aria-hidden="true"></div>
                    <div class="sun-timeBarHoursTrack">
                        <div class="sun-timeScale sun-timeScaleInHoursTrack" id="timeScale"></div>
                        <div class="sun-timeLabels" id="timeLabels"></div>
                    </div>
                </div>
                <div class="sun-timeBarStateStack" id="timeBarStateStack"></div>
                ${this._getNowRowHTML()}
            `;
        } else {
            this._ensureNowRowLayout(bar);
        }

        if (!bar.querySelector('.sun-timeBarHoursRow')) {
            const scale = window.dom.byKey('timeScale');
            const labels = window.dom.byKey('timeLabels');
            if (scale) {
                scale.remove();
                labels?.remove();
                this._insertHoursRow(bar, scale, labels);
            }
        }

        this._ensureNowRowLayout(bar);
    }

    /** HTML строки индикатора текущего времени. */
    _getNowRowHTML() {
        return `
                <div class="sun-timeBarNowVline" id="timeNowVline" aria-hidden="true"></div>
                <div class="sun-timeBarNowRow">
                    <div class="sun-timeBarStateSide sun-timeBarStateSideNow" aria-hidden="true"></div>
                    <div class="sun-timeBarNowTrack">
                        <div class="sun-timeIndicator sun-timeBarNowMarker" id="timeIndicator" title="">
                            <div class="sun-timeIndicatorLabel sun-timeBarNowLabel"></div>
                        </div>
                    </div>
                </div>`;
    }

    /** Внутренний метод ensureNowRowLayout. */
    _ensureNowRowLayout(bar) {
        if (!bar) return;

        let nowRow = bar.querySelector('.sun-timeBarNowRow');
        let indicator = bar.querySelector('.sun-timeBarNowMarker');

        if (!nowRow) {
            nowRow = document.createElement('div');
            nowRow.className = 'sun-timeBarNowRow';
            const side = document.createElement('div');
            side.className = 'sun-timeBarStateSide sun-timeBarStateSideNow';
            side.setAttribute('aria-hidden', 'true');
            const track = document.createElement('div');
            track.className = 'sun-timeBarNowTrack';
            nowRow.appendChild(side);
            nowRow.appendChild(track);

            if (indicator && indicator.parentElement !== track) {
                indicator.classList.remove('sun-timeBarNowMarker');
                indicator.classList.add('sun-timeBarNowMarker');
                track.appendChild(indicator);
            } else if (!indicator) {
                indicator = document.createElement('div');
                indicator.id = 'timeIndicator';
                indicator.className = 'sun-timeIndicator sun-timeBarNowMarker';
                indicator.title = '';
                const lab = document.createElement('div');
                lab.className = 'sun-timeIndicatorLabel sun-timeBarNowLabel';
                indicator.appendChild(lab);
                track.appendChild(indicator);
            }

            bar.appendChild(nowRow);
        } else {
            const track = nowRow.querySelector('.sun-timeBarNowTrack');
            if (indicator && track && !track.contains(indicator)) {
                indicator.classList.remove('sun-timeBarNowMarker');
                indicator.classList.add('sun-timeBarNowMarker');
                track.appendChild(indicator);
            }
        }

        let vline = bar.querySelector('.sun-timeBarNowVline');
        if (!vline) {
            vline = document.createElement('div');
            vline.id = 'timeNowVline';
            vline.className = 'sun-timeBarNowVline';
            vline.setAttribute('aria-hidden', 'true');
            bar.insertBefore(vline, nowRow);
        } else if (vline.nextElementSibling !== nowRow) {
            bar.insertBefore(vline, nowRow);
        }

        if (indicator) {
            indicator.classList.remove('sun-timeBarNowMarker');
            indicator.classList.add('sun-timeBarNowMarker');
        }
    }

    /** Ссылки на индикатор «сейчас» и вертикальную линию. */
    _bindNowIndicatorElements() {
        const bar = this.container && this.container.querySelector('.sun-timeBar');
        if (bar) {
            this._ensureNowRowLayout(bar);
        }
        this.timeIndicator = window.dom.byKey('timeIndicator');
        this.timeNowVline = window.dom.byKey('timeNowVline');
        this.indicatorLabel = this.timeIndicator
            ? this.timeIndicator.querySelector('.sun-timeIndicatorLabel, .sun-timeBarNowLabel')
            : null;
    }

    /** Внутренний метод setNowIndicatorVisible. */
    _setNowIndicatorVisible(visible) {
        const display = visible ? '' : 'none';
        if (this.timeIndicator) {
            this.timeIndicator.style.display = display;
        }
        if (this.timeNowVline) {
            this.timeNowVline.style.display = display;
        }
        const nowRow = this.container && this.container.querySelector('.sun-timeBarNowRow');
        if (nowRow) {
            nowRow.style.display = '';
        }
    }

    /** Внутренний метод applyNowIndicatorPosition. */
    _applyNowIndicatorPosition(frac) {
        const sideW = '72px';
        const vlineLeft = `calc(${sideW} + (100% - ${sideW}) * ${frac})`;
        if (this.timeNowVline) {
            this.timeNowVline.style.left = vlineLeft;
        }
        if (this.timeIndicator) {
            this.timeIndicator.style.left = `${frac * 100}%`;
        }
    }

    /** Внутренний метод clearNowIndicatorPosition. */
    _clearNowIndicatorPosition() {
        if (this.container) {
            this.container.style.removeProperty('--time-now-frac');
            this.container.style.removeProperty('--time-row-frac');
        }
        if (this.timeNowVline) {
            this.timeNowVline.style.left = '';
        }
        if (this.timeIndicator) {
            this.timeIndicator.style.left = '';
        }
    }

    /** Внутренний метод insertHoursRow. */
    _insertHoursRow(bar, scale, labels) {
        const hoursRow = document.createElement('div');
        hoursRow.className = 'sun-timeBarStateRow sun-timeBarHoursRow';
        const side = document.createElement('div');
        side.className = 'sun-timeBarStateSide sun-timeBarStateSideHours';
        side.setAttribute('aria-hidden', 'true');
        const track = document.createElement('div');
        track.className = 'sun-timeBarHoursTrack';
        if (scale) track.appendChild(scale);
        if (labels) track.appendChild(labels);
        hoursRow.appendChild(side);
        hoursRow.appendChild(track);
        const stack = bar.querySelector('.sun-timeBarStateStack');
        if (stack) bar.insertBefore(hoursRow, stack);
        else bar.insertBefore(hoursRow, bar.firstChild);
    }

    /** Строки состояний +5…−5 под шкалой часов. */
    buildStateStackRows() {
        const stack = window.dom.byKey('timeBarStateStack');
        if (!stack || stack.children.length > 0) return;

        const hidden = this._loadStateRowHidden();

        for (let s = 5; s >= -5; s--) {
            const row = document.createElement('div');
            row.className = 'sun-timeBarStateRow';
            row.dataset.state = String(s);

            const side = document.createElement('div');
            side.className = 'sun-timeBarStateSide';

            const lab = document.createElement('span');
            lab.className = 'sun-timeBarStateLabel';
            lab.textContent = s > 0 ? `+${s}` : String(s);

            if (hidden[String(s)] === true) {
                row.classList.add('sun-timeBarStateRowHidden');
            }

            side.appendChild(lab);

            const track = document.createElement('div');
            track.className = 'sun-timeBarStateTrack';
            track.dataset.state = String(s);

            row.appendChild(side);
            row.appendChild(track);
            stack.appendChild(row);
        }
        this._syncTimeBarStackLayout();
    }

    /** Метки часов 0–23 на шкале. */
    createHourMarkers() {
        if (!this.timeScale) return;
        
        this.timeScale.innerHTML = '';
        
        for (let i = 0; i <= 24; i++) {
            const hour = i % 24;
            const marker = document.createElement('div');
            marker.className = 'sun-hourMarker sun-clickable sun-hourMarkerInTimeBar';
            
            if (hour === 0) {
                marker.classList.add('sun-midnight');
            }
            
            const label = document.createElement('div');
            label.className = 'sun-hourLabel sun-hourLabelInTimeBar';
            if (hour === 0) {
                label.classList.add('sun-hourLabelMidnight');
            }
            label.textContent = hour === 0 ? '00:00' : `${hour}:00`;
            marker.appendChild(label);
            
            if (i < 24) {
                const halfMarker = document.createElement('div');
                halfMarker.className = 'sun-halfHourMarker';
                halfMarker.style.left = '50%';
                marker.appendChild(halfMarker);
            }
            
            marker.addEventListener('click', () => {
                this.navigateToHour(hour);
            });
            
            this.timeScale.appendChild(marker);
        }
    }
    
	navigateToHour(hour) {
		if (window.dates && window.appState) {
			const currentVizorDate = new Date(window.appState.currentDate);
			const now = new Date();
			
			// Определяем, на какой день переходить
			let targetDate = new Date(currentVizorDate);
			
			if (hour === 0) {
				// Всегда спрашиваем для 00:00
				const tomorrow = new Date(targetDate);
				tomorrow.setDate(tomorrow.getDate() + 1);
				
				const userChoice = confirm(
					`Куда перейти?\n\n` +
					`Текущая дата на визоре: ${currentVizorDate.toLocaleDateString('ru-RU')}\n` +
					`• ОК - перейти на 00:00 следующего дня (${tomorrow.toLocaleDateString('ru-RU')})\n` +
					`• Отмена - перейти на 00:00 текущего дня`
				);
				
				if (userChoice) {
					// Следующий день
					targetDate.setDate(targetDate.getDate() + 1);
				}
				// Иначе остаемся на текущем дне
			}
			
			targetDate.setHours(hour, 0, 0, 0);
			window.dates.setDate(targetDate, true);
		}
	}
    
    /** Позиция индикатора по appState.currentDate. */
    updateTimeIndicator() {
        if (!this.timeIndicator || !this.indicatorLabel) return;
        
        // Проверяем, совпадает ли дата на визоре с сегодняшней
        const isToday = this.isCurrentDateToday();
        
        if (!isToday) {
            this._clearNowIndicatorPosition();
            this._setNowIndicatorVisible(false);
            return;
        }

        this._setNowIndicatorVisible(true);
        
        const now = new Date();
        const currentHour = now.getHours();
        const currentMinute = now.getMinutes();
        const currentSecond = now.getSeconds();
        const currentMillisecond = now.getMilliseconds(); // ДОБАВЛЕНО для точности
        
        // УЛУЧШЕННЫЙ РАСЧЁТ: добавляем миллисекунды для большей точности
        const secondsInDay = currentHour * 3600 + 
                            currentMinute * 60 + 
                            currentSecond +
                            currentMillisecond / 1000;
        
        const percentOfDay = (secondsInDay / 86400) * 100;
        
        const frac = percentOfDay / 100;
        this._applyNowIndicatorPosition(frac);

        const timeString = `${currentHour.toString().padStart(2, '0')}:${currentMinute.toString().padStart(2, '0')}:${currentSecond.toString().padStart(2, '0')}`;
        this.indicatorLabel.textContent = timeString;
        this.timeIndicator.title = `Текущее время: ${timeString}`;
    }
    
    /** Проверяет: is current date today. */
    isCurrentDateToday() {
        const today = new Date();
        const vizorDate = window.appState.currentDate;
        
        const todayStart = new Date(
            today.getFullYear(),
            today.getMonth(),
            today.getDate(),
            0, 0, 0, 0
        );
        
        const vizorStart = new Date(
            vizorDate.getFullYear(),
            vizorDate.getMonth(),
            vizorDate.getDate(),
            0, 0, 0, 0
        );
        
        return todayStart.getTime() === vizorStart.getTime();
    }
    
    /** Обновляет time bar appearance. */
    updateTimeBarAppearance() {
        if (!this.container) return;
        
        const graphContainer = document.querySelector('.sun-graphContainer');
        
        if (graphContainer) {
            this.container.style.backgroundColor = '#fff';
        }
    }
    
    /** Интервал/RAF обновления положения индикатора. */
    setupUpdates() {
        const tick = () => {
            if (window.appState && this.isCurrentDateToday()) {
                this.updateTimeIndicator();
            } else {
                const sec = new Date().getSeconds();
                if (sec !== this._lastIndicatorSecond) {
                    this._lastIndicatorSecond = sec;
                    this.updateTimeIndicator();
                }
            }
            this._tickRaf = requestAnimationFrame(tick);
        };
        this._tickRaf = requestAnimationFrame(tick);

        this.setupModeObservers();
        this.setupDateChangeObserver();
    }
    
    /** Устанавливает p mode observers. */
    setupModeObservers() {
        const graphContainer = document.querySelector('.sun-graphContainer');
        if (!graphContainer) return;
        
        const observer = new MutationObserver((mutations) => {
            mutations.forEach((mutation) => {
                if (mutation.type === 'attributes' && mutation.attributeName === 'class') {
                    this.updateTimeBarAppearance();
                }
            });
        });
        
        observer.observe(graphContainer, {
            attributes: true,
            attributeFilter: ['class']
        });
    }
    
    /** Устанавливает p date change observer. */
    setupDateChangeObserver() {
        if (window.appState && window.appState.currentDate) {
            const originalCurrentDate = window.appState.currentDate;
            Object.defineProperty(window.appState, 'currentDate', {
                get() {
                    return this._currentDate;
                },
                set(value) {
                    this._currentDate = value;
                    
                    if (window.timeBarManager) {
                        queueMicrotask(() => {
                            window.timeBarManager.updateTimeIndicator();
                        });
                    }
                }
            });
            
            window.appState._currentDate = originalCurrentDate;
        }
    }
    
    /** Останавливает тики и снимает слушатели. */
    destroy() {
        if (this._tickRaf != null) {
            cancelAnimationFrame(this._tickRaf);
            this._tickRaf = null;
        }
        
        if (this.container && this.container.parentNode) {
            this.container.remove();
        }
        
        this.isInitialized = false;
    }

    /** flipV: зеркало стека −5…+5 (как mapGridDayOffset / flipH для дат). */
    applyFlipState() {
        const stack = window.dom.byKey('timeBarStateStack');
        if (!stack) {
            return;
        }
        const flipY = window.wavesTransformLayer && window.wavesTransformLayer.isScaleYFlipped();
        stack.style.flexDirection = flipY ? 'column-reverse' : 'column';
    }
}

window.timeBarManager = new TimeBarManager();