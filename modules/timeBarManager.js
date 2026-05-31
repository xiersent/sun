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
        if (document.getElementById('timeBarContainer')) {
            this.container = document.getElementById('timeBarContainer');
            this.ensureStackedTimeBarLayout();
            this.ensureWrapper();
            this.timeScale = document.getElementById('timeScale');
            this.timeLabels = document.getElementById('timeLabels');
            this._bindNowIndicatorElements();
            this.buildStateStackRows();
            return;
        }

        const timeBarHTML = `
            <div class="time-bar time-bar--stacked">
                <div class="time-bar-state-row time-bar-hours-row">
                    <div class="time-bar-state-side time-bar-state-side--hours" aria-hidden="true"></div>
                    <div class="time-bar-hours-track">
                        <div class="time-scale" id="timeScale"></div>
                        <div class="time-labels" id="timeLabels"></div>
                    </div>
                </div>
                <div class="time-bar-state-stack" id="timeBarStateStack"></div>
                ${this._getNowRowHTML()}
            </div>
        `;
        
        const container = document.createElement('div');
        container.id = 'timeBarContainer';
        container.className = 'time-bar-container';
        container.innerHTML = timeBarHTML;
        
        const graphSection = document.querySelector('.graph-section');
        const graphViewport = document.querySelector('.graph-viewport');
        const graphContainer = document.querySelector('.graph-container');
        const insertBeforeEl = graphViewport || graphContainer;
        
        if (insertBeforeEl && graphSection) {
            graphSection.insertBefore(container, insertBeforeEl);
            
            this.container = container;
            this.timeScale = document.getElementById('timeScale');
            this.timeLabels = document.getElementById('timeLabels');
            this._bindNowIndicatorElements();
            this.ensureWrapper();
            this.buildStateStackRows();
        }
    }

    /** Создаёт обёртку time-bar-wrap при необходимости. */
    ensureWrapper() {
        const wrap = document.getElementById('timeBarWrap');
        if (wrap) {
            this._ensureControlsChrome();
            return;
        }
        if (!this.container || !this.container.parentNode) return;
        const wrapper = document.createElement('div');
        wrapper.className = 'time-bar-wrap';
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
            this.controlsPanel.classList.remove('time-bar-controls--collapsed');
            this.controlsToggle.setAttribute('aria-expanded', 'true');
            this.controlsToggle.textContent = 'Скрыть';
            this.controlsToggle.classList.add('active');
        } else {
            this.controlsPanel.classList.add('time-bar-controls--collapsed');
            this.controlsToggle.setAttribute('aria-expanded', 'false');
            const L = window.SUN_ACTION_LABELS;
            const editLabel = L && L.editTitle ? L.editTitle : 'Редактировать';
            this.controlsToggle.textContent = editLabel;
            this.controlsToggle.title = editLabel;
            this.controlsToggle.setAttribute('aria-label', editLabel);
            this.controlsToggle.classList.remove('active');
        }
    }

    /** Переключает видимость панели controls. */
    _toggleControlsPanel() {
        const open = this.controlsPanel.classList.contains('time-bar-controls--collapsed');
        this._applyControlsPanelOpen(open);
        this._saveControlsPanelOpen(open);
    }

    /** Кнопка toggle и шапка панели controls. */
    _ensureControlsChrome() {
        const wrap = document.getElementById('timeBarWrap');
        if (!wrap) {
            return;
        }

        wrap.querySelector('.time-bar-controls-head')?.remove();

        let section = document.getElementById('timeBarControlsSection');
        if (!section) {
            section = document.createElement('div');
            section.className = 'panel-section time-bar-controls-section';
            section.id = 'timeBarControlsSection';
        }
        if (section.parentElement !== wrap) {
            wrap.insertBefore(section, wrap.firstChild);
        } else if (wrap.firstElementChild !== section) {
            wrap.insertBefore(section, wrap.firstChild);
        }

        let tabContainer = section.querySelector('.tab-container');
        if (!tabContainer) {
            tabContainer = document.createElement('div');
            tabContainer.className = 'tab-container';
            section.appendChild(tabContainer);
        }

        let tabButtons = tabContainer.querySelector('.tab-buttons.tab-buttons--framed');
        if (!tabButtons) {
            tabButtons = document.createElement('div');
            tabButtons.className = 'tab-buttons tab-buttons--framed';
            tabButtons.setAttribute('role', 'tablist');
            tabButtons.setAttribute('aria-label', 'Настройки полосы времени');
            tabContainer.appendChild(tabButtons);
        }

        let panel = document.getElementById('timeBarControls');

        if (!panel) {
            panel = document.createElement('div');
            panel.className = 'time-bar-controls time-bar-controls--collapsed';
            panel.id = 'timeBarControls';
            panel.setAttribute('aria-label', 'Видимость полос и групп');
        }
        if (panel.parentElement !== section) {
            section.appendChild(panel);
        } else if (panel.previousElementSibling !== tabContainer) {
            section.insertBefore(panel, tabContainer.nextElementSibling);
        }

        let btn = document.getElementById('timeBarControlsToggle');
        if (!btn) {
            btn = document.createElement('button');
            btn.type = 'button';
            btn.className = 'tab-button time-bar-controls-toggle';
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
            btn.classList.remove('ui-btn');
            btn.classList.add('tab-button', 'time-bar-controls-toggle');
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

    /** Видимость группы только на шкале time-bar (не связана с group.enabled). */
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

    /** Внутренний метод setStateRowVisible. */
    _setStateRowVisible(state, visible) {
        const row = document.querySelector(`.time-bar-state-row[data-state="${state}"]`);
        if (!row) return;
        if (visible) {
            row.classList.remove('time-bar-state-row--hidden');
        } else {
            row.classList.add('time-bar-state-row--hidden');
        }
        const cb = document.querySelector(`.time-bar-state-check[data-state="${state}"]`);
        if (cb) cb.checked = visible;
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
        const panel = this.controlsPanel || document.getElementById('timeBarControls');
        if (!panel) return;

        const groups = (window.appState && window.appState.data && window.appState.data.groups) || [];
        const groupVisible = this._loadTimeBarGroupVisible();
        const sig = groups.map((g) => `${g.id}:${groupVisible[String(g.id)] === false ? 0 : 1}:${g.name || ''}`).join('|');
        if (sig === this._controlsSig && panel.children.length > 0) {
            return;
        }
        this._controlsSig = sig;

        const hidden = this._loadStateRowHidden();
        panel.innerHTML = '';

        const statesRow = document.createElement('div');
        statesRow.className = 'time-bar-controls-row time-bar-controls-states';

        for (let s = -5; s <= 5; s++) {
            const label = document.createElement('label');
            label.className = 'time-bar-control-check';
            const text = document.createElement('span');
            text.className = 'time-bar-control-label';
            text.textContent = s > 0 ? `+${s}` : String(s);
            const cb = document.createElement('input');
            cb.type = 'checkbox';
            cb.className = 'time-bar-state-check';
            cb.dataset.state = String(s);
            cb.checked = hidden[String(s)] !== true;
            cb.autocomplete = 'off';
            label.appendChild(text);
            label.appendChild(cb);
            statesRow.appendChild(label);
        }

        const groupsRow = document.createElement('div');
        groupsRow.className = 'time-bar-controls-row time-bar-controls-groups';

        if (groups.length === 0) {
            const empty = document.createElement('span');
            empty.className = 'time-bar-controls-empty';
            empty.textContent = '—';
            groupsRow.appendChild(empty);
        } else {
            groups.forEach((group) => {
                const label = document.createElement('label');
                label.className = 'time-bar-control-check';
                const text = document.createElement('span');
                text.className = 'time-bar-control-label';
                text.textContent = group.name || `Группа ${group.id}`;
                const cb = document.createElement('input');
                cb.type = 'checkbox';
                cb.className = 'time-bar-group-check';
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
        if (!t || t.tagName !== 'INPUT') return;

        if (t.classList.contains('time-bar-state-check')) {
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

        if (t.classList.contains('time-bar-group-check')) {
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
        const bar = this.container && this.container.querySelector('.time-bar');
        if (!bar) return;

        bar.classList.add('time-bar--stacked');

        if (bar.querySelector('.time-bar-ruler-row')) {
            const scale = document.getElementById('timeScale');
            const labels = document.getElementById('timeLabels');
            bar.querySelector('.time-bar-ruler-row')?.remove();
            this._insertHoursRow(bar, scale, labels);
        }

        if (!bar.querySelector('#timeBarStateStack')) {
            bar.innerHTML = `
                <div class="time-bar-state-row time-bar-hours-row">
                    <div class="time-bar-state-side time-bar-state-side--hours" aria-hidden="true"></div>
                    <div class="time-bar-hours-track">
                        <div class="time-scale" id="timeScale"></div>
                        <div class="time-labels" id="timeLabels"></div>
                    </div>
                </div>
                <div class="time-bar-state-stack" id="timeBarStateStack"></div>
                ${this._getNowRowHTML()}
            `;
        } else {
            this._ensureNowRowLayout(bar);
        }

        if (!bar.querySelector('.time-bar-hours-row')) {
            const scale = document.getElementById('timeScale');
            const labels = document.getElementById('timeLabels');
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
                <div class="time-bar-now-vline" id="timeNowVline" aria-hidden="true"></div>
                <div class="time-bar-now-row">
                    <div class="time-bar-state-side time-bar-state-side--now" aria-hidden="true"></div>
                    <div class="time-bar-now-track">
                        <div class="time-indicator time-bar-now-marker" id="timeIndicator" title="">
                            <div class="time-indicator-label time-bar-now-label"></div>
                        </div>
                    </div>
                </div>`;
    }

    /** Внутренний метод ensureNowRowLayout. */
    _ensureNowRowLayout(bar) {
        if (!bar) return;

        let nowRow = bar.querySelector('.time-bar-now-row');
        let indicator = bar.querySelector('#timeIndicator');

        if (!nowRow) {
            nowRow = document.createElement('div');
            nowRow.className = 'time-bar-now-row';
            const side = document.createElement('div');
            side.className = 'time-bar-state-side time-bar-state-side--now';
            side.setAttribute('aria-hidden', 'true');
            const track = document.createElement('div');
            track.className = 'time-bar-now-track';
            nowRow.appendChild(side);
            nowRow.appendChild(track);

            if (indicator && indicator.parentElement !== track) {
                indicator.classList.remove('time-bar-now-line');
                indicator.classList.add('time-bar-now-marker');
                track.appendChild(indicator);
            } else if (!indicator) {
                indicator = document.createElement('div');
                indicator.id = 'timeIndicator';
                indicator.className = 'time-indicator time-bar-now-marker';
                indicator.title = '';
                const lab = document.createElement('div');
                lab.className = 'time-indicator-label time-bar-now-label';
                indicator.appendChild(lab);
                track.appendChild(indicator);
            }

            bar.appendChild(nowRow);
        } else {
            const track = nowRow.querySelector('.time-bar-now-track');
            if (indicator && track && !track.contains(indicator)) {
                indicator.classList.remove('time-bar-now-line');
                indicator.classList.add('time-bar-now-marker');
                track.appendChild(indicator);
            }
        }

        let vline = bar.querySelector('#timeNowVline');
        if (!vline) {
            vline = document.createElement('div');
            vline.id = 'timeNowVline';
            vline.className = 'time-bar-now-vline';
            vline.setAttribute('aria-hidden', 'true');
            bar.insertBefore(vline, nowRow);
        } else if (vline.nextElementSibling !== nowRow) {
            bar.insertBefore(vline, nowRow);
        }

        if (indicator) {
            indicator.classList.remove('time-bar-now-line');
            indicator.classList.add('time-bar-now-marker');
        }
    }

    /** Ссылки на индикатор «сейчас» и вертикальную линию. */
    _bindNowIndicatorElements() {
        const bar = this.container && this.container.querySelector('.time-bar');
        if (bar) {
            this._ensureNowRowLayout(bar);
        }
        this.timeIndicator = document.getElementById('timeIndicator');
        this.timeNowVline = document.getElementById('timeNowVline');
        this.indicatorLabel = this.timeIndicator
            ? this.timeIndicator.querySelector('.time-indicator-label, .time-bar-now-label')
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
        const nowRow = this.container && this.container.querySelector('.time-bar-now-row');
        if (nowRow) {
            nowRow.style.display = '';
        }
    }

    /** Внутренний метод applyNowIndicatorPosition. */
    _applyNowIndicatorPosition(frac) {
        const sideW = 'var(--time-bar-side-w, 72px)';
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
        hoursRow.className = 'time-bar-state-row time-bar-hours-row';
        const side = document.createElement('div');
        side.className = 'time-bar-state-side time-bar-state-side--hours';
        side.setAttribute('aria-hidden', 'true');
        const track = document.createElement('div');
        track.className = 'time-bar-hours-track';
        if (scale) track.appendChild(scale);
        if (labels) track.appendChild(labels);
        hoursRow.appendChild(side);
        hoursRow.appendChild(track);
        const stack = bar.querySelector('#timeBarStateStack');
        if (stack) bar.insertBefore(hoursRow, stack);
        else bar.insertBefore(hoursRow, bar.firstChild);
    }

    /** Строки состояний +5…−5 под шкалой часов. */
    buildStateStackRows() {
        const stack = document.getElementById('timeBarStateStack');
        if (!stack || stack.children.length > 0) return;

        const hidden = this._loadStateRowHidden();

        for (let s = 5; s >= -5; s--) {
            const row = document.createElement('div');
            row.className = 'time-bar-state-row';
            row.dataset.state = String(s);

            const side = document.createElement('div');
            side.className = 'time-bar-state-side';

            const lab = document.createElement('span');
            lab.className = 'time-bar-state-label';
            lab.textContent = s > 0 ? `+${s}` : String(s);

            if (hidden[String(s)] === true) {
                row.classList.add('time-bar-state-row--hidden');
            }

            side.appendChild(lab);

            const track = document.createElement('div');
            track.className = 'time-bar-state-track';
            track.dataset.state = String(s);

            row.appendChild(side);
            row.appendChild(track);
            stack.appendChild(row);
        }
    }

    /** Метки часов 0–23 на шкале. */
    createHourMarkers() {
        if (!this.timeScale) return;
        
        this.timeScale.innerHTML = '';
        
        for (let i = 0; i <= 24; i++) {
            const hour = i % 24;
            const marker = document.createElement('div');
            marker.className = 'hour-marker clickable';
            
            if (hour === 0) {
                marker.classList.add('midnight');
            }
            
            const label = document.createElement('div');
            label.className = 'hour-label';
            label.textContent = hour === 0 ? '00:00' : `${hour}:00`;
            marker.appendChild(label);
            
            if (i < 24) {
                const halfMarker = document.createElement('div');
                halfMarker.className = 'half-hour-marker';
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
    
    /** Подсветка текущего часа на timeScale. */
    highlightActiveHour(hour) {
        document.querySelectorAll('.hour-marker.active').forEach(marker => {
            marker.classList.remove('active');
        });
        
        const markers = document.querySelectorAll('.hour-marker');
        if (markers[hour]) {
            markers[hour].classList.add('active');
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
        
        this.highlightActiveHour(currentHour);
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
        
        const graphContainer = document.querySelector('.graph-container');
        
        if (graphContainer) {
            this.container.style.backgroundColor = '#fff';
            
            if (graphContainer.classList.contains('graph-gray-mode')) {
                this.container.style.filter = 'grayscale(1)';
            } else {
                this.container.style.filter = 'none';
            }
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
        const graphContainer = document.querySelector('.graph-container');
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
        const stack = document.getElementById('timeBarStateStack');
        if (!stack) {
            return;
        }
        const flipY = window.wavesTransformLayer && window.wavesTransformLayer.isScaleYFlipped();
        stack.style.flexDirection = flipY ? 'column-reverse' : 'column';
    }
}

window.timeBarManager = new TimeBarManager();