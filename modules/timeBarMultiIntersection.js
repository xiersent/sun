/**
 * @file timeBarMultiIntersection.js
 * Вкладка «Множественная полоса пересечений»: один А + несколько Б.
 * Расширяет TimeBarManager (подключать после timeBarManager.js).
 */
(function () {
    if (typeof TimeBarManager === 'undefined') return;
    const proto = TimeBarManager.prototype;

    proto._loadMultiIntersectionPrimaryId = function () {
        try {
            const raw = localStorage.getItem(this._multiIntersectionPrimaryKey);
            if (raw != null && String(raw) !== '') return String(raw);
        } catch {
            /* ignore */
        }
        const ds = (window.appState && window.appState.dateSelections) || {};
        if (ds.typeA != null && String(ds.typeA) !== '') return String(ds.typeA);
        if (window.appState && window.appState.activeDateId != null) {
            return String(window.appState.activeDateId);
        }
        const dates = (window.appState && window.appState.data && window.appState.data.dates) || [];
        return dates[0] ? String(dates[0].id) : '';
    };

    proto._saveMultiIntersectionPrimaryId = function (id) {
        try {
            localStorage.setItem(this._multiIntersectionPrimaryKey, id == null ? '' : String(id));
        } catch {
            /* ignore */
        }
    };

    proto._loadMultiIntersectionSecondaryIds = function () {
        try {
            const raw = localStorage.getItem(this._multiIntersectionSecondaryKey);
            if (raw == null || raw === '') {
                return this._defaultMultiIntersectionSecondaryIds();
            }
            const arr = JSON.parse(raw);
            if (!Array.isArray(arr)) return this._defaultMultiIntersectionSecondaryIds();
            return arr.map((id) => String(id)).filter((id) => id !== '');
        } catch {
            return this._defaultMultiIntersectionSecondaryIds();
        }
    };

    proto._defaultMultiIntersectionSecondaryIds = function () {
        const primary = this._loadMultiIntersectionPrimaryId();
        const ds = (window.appState && window.appState.dateSelections) || {};
        if (ds.typeB != null && String(ds.typeB) !== '' && String(ds.typeB) !== String(primary)) {
            return [String(ds.typeB)];
        }
        const dates = (window.appState && window.appState.data && window.appState.data.dates) || [];
        for (let i = 0; i < dates.length; i++) {
            if (String(dates[i].id) !== String(primary)) {
                return [String(dates[i].id)];
            }
        }
        return [];
    };

    proto._saveMultiIntersectionSecondaryIds = function (ids) {
        try {
            const list = (ids || []).map((id) => String(id)).filter((id) => id !== '');
            localStorage.setItem(this._multiIntersectionSecondaryKey, JSON.stringify(list));
        } catch {
            /* ignore */
        }
    };

    /** Видимость полос B×A / A×B по id персоны Б: { [id]: { ab, ba } }. */
    proto._loadMultiIntersectionStripVisible = function () {
        try {
            const raw = localStorage.getItem(this._multiIntersectionStripVisibleKey);
            if (!raw) return {};
            const o = JSON.parse(raw);
            return o && typeof o === 'object' && !Array.isArray(o) ? o : {};
        } catch {
            return {};
        }
    };

    proto._saveMultiIntersectionStripVisible = function (map) {
        try {
            localStorage.setItem(this._multiIntersectionStripVisibleKey, JSON.stringify(map || {}));
        } catch {
            /* ignore */
        }
    };

    proto.isMultiIntersectionStripVisible = function (secondaryId, orientation) {
        if (secondaryId == null || String(secondaryId) === '') return true;
        const map = this._loadMultiIntersectionStripVisible();
        const entry = map[String(secondaryId)];
        if (!entry || typeof entry !== 'object') return true;
        if (orientation === 'ba') return entry.ba !== false;
        return entry.ab !== false;
    };

    proto._setMultiIntersectionStripVisible = function (secondaryId, orientation, visible) {
        if (secondaryId == null || String(secondaryId) === '') return;
        const id = String(secondaryId);
        const map = this._loadMultiIntersectionStripVisible();
        const entry =
            map[id] && typeof map[id] === 'object'
                ? { ab: map[id].ab !== false, ba: map[id].ba !== false }
                : { ab: true, ba: true };
        if (orientation === 'ba') {
            entry.ba = !!visible;
        } else {
            entry.ab = !!visible;
        }
        map[id] = entry;
        this._saveMultiIntersectionStripVisible(map);
    };

    proto._applyMultiIntersectionStripVisibility = function () {
        document.querySelectorAll('.sun-timeBarMultiIntersectionRow').forEach((row) => {
            const sid = row.dataset.secondaryId;
            const orientation = row.dataset.orientation === 'ba' ? 'ba' : 'ab';
            const visible = this.isMultiIntersectionStripVisible(sid, orientation);
            row.classList.toggle('sun-timeBarIntersectionRowHidden', !visible);
        });
    };

    proto.getMultiIntersectionPrimaryId = function () {
        return this._loadMultiIntersectionPrimaryId();
    };

    proto.getMultiIntersectionSecondaryIds = function () {
        const primary = this._loadMultiIntersectionPrimaryId();
        return this._loadMultiIntersectionSecondaryIds().filter((id) => String(id) !== String(primary));
    };

    proto._loadMultiIntersectionGroupVisible = function () {
        try {
            const raw = localStorage.getItem(this._multiIntersectionGroupVisibleKey);
            if (raw == null || raw === '' || raw === '{}') {
                return this._defaultIntersectionGroupVisibleMap();
            }
            const o = JSON.parse(raw);
            return o && typeof o === 'object' ? o : this._defaultIntersectionGroupVisibleMap();
        } catch {
            return this._defaultIntersectionGroupVisibleMap();
        }
    };

    proto._saveMultiIntersectionGroupVisible = function (map) {
        try {
            localStorage.setItem(this._multiIntersectionGroupVisibleKey, JSON.stringify(map));
        } catch {
            /* ignore */
        }
    };

    proto.isMultiIntersectionGroupVisible = function (groupId) {
        const map = this._loadMultiIntersectionGroupVisible();
        return map[String(groupId)] !== false;
    };

    proto.isMultiIntersectionGroupVisibleForWave = function (waveId) {
        if (!window.appState || !window.appState.data) return true;
        const waveIdStr = String(waveId);
        const groups = window.appState.data.groups || [];
        for (let i = 0; i < groups.length; i++) {
            const g = groups[i];
            const waveIds = g.waves || [];
            for (let j = 0; j < waveIds.length; j++) {
                if (String(waveIds[j]) === waveIdStr) {
                    return this.isMultiIntersectionGroupVisible(g.id);
                }
            }
        }
        return true;
    };

    proto.getMultiIntersectionSegmentLabelMode = function () {
        try {
            const raw = localStorage.getItem(this._multiIntersectionSegmentLabelModeKey);
            return raw === 'name' ? 'name' : 'period';
        } catch {
            return 'period';
        }
    };

    proto._saveMultiIntersectionSegmentLabelMode = function (mode) {
        try {
            localStorage.setItem(
                this._multiIntersectionSegmentLabelModeKey,
                mode === 'name' ? 'name' : 'period'
            );
        } catch {
            /* ignore */
        }
    };

    proto._loadMultiIntersectionControlsPanelOpen = function () {
        try {
            return localStorage.getItem(this._multiIntersectionControlsOpenStorageKey) === '1';
        } catch {
            return false;
        }
    };

    proto._saveMultiIntersectionControlsPanelOpen = function (open) {
        try {
            localStorage.setItem(this._multiIntersectionControlsOpenStorageKey, open ? '1' : '0');
        } catch {
            /* ignore */
        }
    };

    proto._applyMultiIntersectionControlsPanelOpen = function (open) {
        const panel =
            this.multiIntersectionControlsPanel ||
            window.dom.byKey('timeBarMultiIntersectionControls');
        const btn =
            this.multiIntersectionControlsToggle ||
            window.dom.byKey('timeBarMultiIntersectionControlsToggle');
        if (panel) {
            panel.classList.toggle('sun-timeBarControlsCollapsed', !open);
        }
        if (btn) {
            btn.setAttribute('aria-expanded', open ? 'true' : 'false');
        }
    };

    proto._toggleMultiIntersectionControlsPanel = function () {
        const open = !this._loadMultiIntersectionControlsPanelOpen();
        this._saveMultiIntersectionControlsPanelOpen(open);
        this._applyMultiIntersectionControlsPanelOpen(open);
    };

    proto._fillPersonSelectOptions = function (sel, selectedId) {
        if (
            window.dateComparisonManager &&
            typeof window.dateComparisonManager._fillCompareSelectOptions === 'function'
        ) {
            window.dateComparisonManager._fillCompareSelectOptions(sel, false);
        } else {
            sel.innerHTML = '';
            const empty = document.createElement('option');
            empty.value = '';
            empty.textContent = '— выберите —';
            sel.appendChild(empty);
            const dates = (window.appState && window.appState.data && window.appState.data.dates) || [];
            dates.forEach((d) => {
                const opt = document.createElement('option');
                opt.value = d.id;
                opt.textContent = d.name || 'Без названия';
                sel.appendChild(opt);
            });
        }
        const want = selectedId != null ? String(selectedId) : '';
        if (want && Array.from(sel.options).some((o) => String(o.value) === want)) {
            sel.value = want;
        } else {
            sel.value = '';
        }
    };

    proto.getPersonDisplayName = function (dateId, options) {
        const dates = (window.appState && window.appState.data && window.appState.data.dates) || [];
        const person = dates.find((d) => String(d.id) === String(dateId));
        if (!person) return '—';
        const name = person.name || 'Без названия';
        if (options && options.full) return name;
        return name.length > 18 ? name.slice(0, 16) + '…' : name;
    };

    proto._ensureMultiIntersectionControlsChrome = function () {
        let wrap = window.dom.byKey('timeBarMultiIntersectionWrap');
        if (!wrap) {
            const panel = document.querySelector(
                '.sun-tabContent[data-tab-panel="multiIntersectionBar"]'
            );
            if (!panel) return;
            wrap = document.createElement('div');
            wrap.className = 'sun-timeBarMultiIntersectionWrap sun-tabPanelInner';
            wrap.id = 'timeBarMultiIntersectionWrap';
            panel.appendChild(wrap);
        }

        this._ensureMultiIntersectionTimeBar();

        let block = wrap.querySelector('.sun-timeBarMultiIntersectionBlock');
        if (!block) {
            block = document.createElement('div');
            block.className = 'sun-timeBarMultiIntersectionBlock sun-timeBarIntersectionBlock';
            wrap.appendChild(block);
        }

        let section =
            block.querySelector('.sun-timeBarMultiIntersectionControlsSection') ||
            window.dom.byKey('timeBarMultiIntersectionControlsSection');
        if (!section) {
            section = document.createElement('div');
            section.className =
                'sun-panelSection sun-timeBarControlsSection sun-timeBarControlsSectionLayout sun-timeBarMultiIntersectionControlsSection';
        }
        if (section.parentElement !== block) {
            block.insertBefore(section, block.firstChild);
        }

        let tabContainer = section.querySelector('.sun-tabContainer');
        if (!tabContainer) {
            tabContainer = document.createElement('div');
            tabContainer.className =
                'sun-tabContainer sun-tabContainerTimeBarControls sun-tabContainerWithFramedButtons';
            section.appendChild(tabContainer);
        }

        let tabButtons = tabContainer.querySelector('.sun-tabButtons.sun-tabButtonsFramed');
        if (!tabButtons) {
            tabButtons = document.createElement('div');
            tabButtons.className = 'sun-tabButtons sun-tabButtonsFramed sun-tabButtonsTimeBarControls';
            tabButtons.setAttribute('role', 'tablist');
            tabButtons.setAttribute('aria-label', 'Настройки множественной полосы пересечений');
            tabContainer.appendChild(tabButtons);
        }

        let panel = window.dom.byKey('timeBarMultiIntersectionControls');
        if (!panel) {
            panel = document.createElement('div');
            panel.className =
                'sun-timeBarControls sun-timeBarControlsCollapsed sun-timeBarControlsInSection';
            panel.id = 'timeBarMultiIntersectionControls';
            panel.setAttribute('aria-label', 'Настройки множественной полосы пересечений');
        }
        if (panel.parentElement !== section) {
            section.appendChild(panel);
        }

        let btn =
            window.dom.byKey('timeBarMultiIntersectionControlsToggle') ||
            section.querySelector('.sun-timeBarMultiIntersectionControlsToggle');
        if (!btn) {
            btn = document.createElement('button');
            btn.type = 'button';
            btn.className = 'sun-tabButton sun-timeBarMultiIntersectionControlsToggle';
            btn.id = 'timeBarMultiIntersectionControlsToggle';
            const L = window.SUN_ACTION_LABELS;
            const editLabel = L && L.editTitle ? L.editTitle : 'Редактировать';
            btn.textContent = editLabel;
            btn.title = editLabel;
            btn.setAttribute('aria-label', editLabel);
            btn.setAttribute('aria-expanded', 'false');
            btn.setAttribute('aria-controls', 'timeBarMultiIntersectionControls');
            tabButtons.appendChild(btn);
        } else if (btn.parentElement !== tabButtons) {
            tabButtons.appendChild(btn);
        }

        this.multiIntersectionControlsPanel = panel;
        this.multiIntersectionControlsToggle = btn;

        if (!this._multiIntersectionControlsToggleBound && this.multiIntersectionControlsToggle) {
            this._multiIntersectionControlsToggleBound = true;
            this.multiIntersectionControlsToggle.addEventListener('click', () =>
                this._toggleMultiIntersectionControlsPanel()
            );
        }

        this._applyMultiIntersectionControlsPanelOpen(this._loadMultiIntersectionControlsPanelOpen());
    };

    proto._ensureMultiIntersectionTimeBar = function () {
        const wrap = window.dom.byKey('timeBarMultiIntersectionWrap');
        if (!wrap) return;

        let block = wrap.querySelector('.sun-timeBarMultiIntersectionBlock');
        if (!block) {
            block = document.createElement('div');
            block.className = 'sun-timeBarMultiIntersectionBlock sun-timeBarIntersectionBlock';
            wrap.appendChild(block);
        }

        let bar = block.querySelector('.sun-timeBarMultiIntersection');
        if (!bar) {
            bar = document.createElement('div');
            bar.className =
                'sun-timeBar sun-timeBarStacked sun-timeBarIntersection sun-timeBarMultiIntersection';
            bar.setAttribute('aria-label', 'Пересечения основной персоны с несколькими');
            block.appendChild(bar);
        }

        let hoursRow = bar.querySelector('.sun-timeBarHoursRow');
        if (!hoursRow) {
            hoursRow = document.createElement('div');
            hoursRow.className = 'sun-timeBarStateRow sun-timeBarHoursRow';
            hoursRow.innerHTML =
                '<div class="sun-timeBarStateSide sun-timeBarStateSideHours" aria-hidden="true"></div>' +
                '<div class="sun-timeBarHoursTrack">' +
                '<div class="sun-timeScale sun-timeScaleInHoursTrack" id="timeBarMultiIntersectionScale"></div>' +
                '<div class="sun-timeLabels sun-timeLabelsInHoursTrack" id="timeBarMultiIntersectionLabels"></div>' +
                '</div>';
            bar.insertBefore(hoursRow, bar.firstChild);
        } else if (bar.firstChild !== hoursRow) {
            bar.insertBefore(hoursRow, bar.firstChild);
        }

        let rows = bar.querySelector('#timeBarMultiIntersectionRows');
        if (!rows) {
            rows = document.createElement('div');
            rows.className = 'sun-timeBarMultiIntersectionRows';
            rows.id = 'timeBarMultiIntersectionRows';
            const nowRow = bar.querySelector('.sun-timeBarNowRow');
            const vline = bar.querySelector('.sun-timeBarNowVline');
            const before = vline || nowRow;
            if (before) bar.insertBefore(rows, before);
            else bar.appendChild(rows);
        }

        this._rebuildMultiIntersectionRows();
        this._ensureMultiIntersectionNowRowLayout(bar);
        this._bindMultiIntersectionNowIndicatorElements();
    };

    proto._rebuildMultiIntersectionRows = function () {
        const rows =
            window.dom.byKey('timeBarMultiIntersectionRows') ||
            document.getElementById('timeBarMultiIntersectionRows');
        if (!rows) return;

        const secondaryIds = this.getMultiIntersectionSecondaryIds();
        const orientations = ['ba', 'ab'];
        const rowKey = (id, orientation) => `${id}|${orientation}`;

        const existing = new Map();
        rows.querySelectorAll('.sun-timeBarMultiIntersectionRow').forEach((row) => {
            const id = String(row.dataset.secondaryId || '');
            const orientation = row.dataset.orientation === 'ba' ? 'ba' : 'ab';
            if (id) existing.set(rowKey(id, orientation), row);
        });

        const keep = new Set();
        secondaryIds.forEach((sid) => {
            orientations.forEach((orientation) => keep.add(rowKey(String(sid), orientation)));
        });
        existing.forEach((row, key) => {
            if (!keep.has(key)) row.remove();
        });

        const ensureRow = (id, orientation) => {
            const key = rowKey(id, orientation);
            let row = existing.get(key);
            const isBA = orientation === 'ba';
            if (!row) {
                row = document.createElement('div');
                row.className =
                    'sun-timeBarStateRow sun-timeBarIntersectionRow sun-timeBarMultiIntersectionRow' +
                    (isBA ? ' sun-timeBarIntersectionRowBA' : '');
                row.dataset.secondaryId = id;
                row.dataset.orientation = orientation;
                const side = document.createElement('div');
                side.className = 'sun-timeBarStateSide';
                const lab = document.createElement('span');
                lab.className = 'sun-timeBarStateLabel';
                side.appendChild(lab);
                const track = document.createElement('div');
                track.className =
                    'sun-timeBarStateTrack sun-timeBarIntersectionTrack sun-timeBarMultiIntersectionTrack';
                track.id = `timeBarMultiIntersectionTrack-${id}-${orientation}`;
                track.dataset.secondaryId = id;
                track.dataset.orientation = orientation;
                row.appendChild(side);
                row.appendChild(track);
                rows.appendChild(row);
                existing.set(key, row);
            } else if (row.parentElement !== rows) {
                rows.appendChild(row);
            }
            const lab = row.querySelector('.sun-timeBarStateLabel');
            if (lab) {
                const primaryId = this.getMultiIntersectionPrimaryId();
                const nameB = this.getPersonDisplayName(id);
                const nameA = this.getPersonDisplayName(primaryId);
                const fullB = this.getPersonDisplayName(id, { full: true });
                const fullA = this.getPersonDisplayName(primaryId, { full: true });
                if (isBA) {
                    lab.textContent = `${nameB} B×A ${nameA}`;
                    lab.title = `${fullB} B×A ${fullA}`;
                } else {
                    lab.textContent = `${nameA} A×B ${nameB}`;
                    lab.title = `${fullA} A×B ${fullB}`;
                }
            }
            return row;
        };

        /* На каждую Б: сверху B×A, снизу A×B (как на обычной полосе). */
        secondaryIds.forEach((sid) => {
            const id = String(sid);
            orientations.forEach((orientation) => {
                const row = ensureRow(id, orientation);
                if (row) rows.appendChild(row);
            });
        });
        this._applyMultiIntersectionStripVisibility();
    };

    proto._ensureMultiIntersectionNowRowLayout = function (bar) {
        if (!bar) return;
        let nowRow = bar.querySelector('.sun-timeBarNowRow');
        if (!nowRow) {
            nowRow = document.createElement('div');
            nowRow.className = 'sun-timeBarNowRow';
            nowRow.innerHTML =
                '<div class="sun-timeBarStateSide sun-timeBarStateSideNow" aria-hidden="true"></div>' +
                '<div class="sun-timeBarNowTrack">' +
                '<div class="sun-timeIndicator sun-timeBarNowMarker" id="timeBarMultiIntersectionNowMarker" title="">' +
                '<div class="sun-timeIndicatorLabel sun-timeBarNowLabel"></div></div></div>';
            bar.appendChild(nowRow);
        } else if (bar.lastElementChild !== nowRow) {
            bar.appendChild(nowRow);
        }

        let vline =
            bar.querySelector('#timeBarMultiIntersectionNowVline') ||
            bar.querySelector('.sun-timeBarNowVline');
        if (!vline) {
            vline = document.createElement('div');
            vline.id = 'timeBarMultiIntersectionNowVline';
            vline.className = 'sun-timeBarNowVline';
            vline.setAttribute('aria-hidden', 'true');
            bar.insertBefore(vline, nowRow);
        } else {
            vline.id = 'timeBarMultiIntersectionNowVline';
            if (vline.nextElementSibling !== nowRow) {
                bar.insertBefore(vline, nowRow);
            }
        }
    };

    proto._bindMultiIntersectionNowIndicatorElements = function () {
        this.multiIntersectionTimeIndicator =
            window.dom.byKey('timeBarMultiIntersectionNowMarker') ||
            document.getElementById('timeBarMultiIntersectionNowMarker');
        this.multiIntersectionTimeNowVline =
            window.dom.byKey('timeBarMultiIntersectionNowVline') ||
            document.getElementById('timeBarMultiIntersectionNowVline');
        this.multiIntersectionIndicatorLabel = this.multiIntersectionTimeIndicator
            ? this.multiIntersectionTimeIndicator.querySelector(
                  '.sun-timeIndicatorLabel, .sun-timeBarNowLabel'
              )
            : null;
    };

    proto.buildMultiIntersectionControlsPanel = function () {
        this._ensureMultiIntersectionControlsChrome();
        const panel =
            this.multiIntersectionControlsPanel ||
            window.dom.byKey('timeBarMultiIntersectionControls');
        if (!panel) return;

        const groups = (window.appState && window.appState.data && window.appState.data.groups) || [];
        const primaryId = this._loadMultiIntersectionPrimaryId();
        const secondaryIds = this._loadMultiIntersectionSecondaryIds();
        const labelMode = this.getMultiIntersectionSegmentLabelMode();
        const groupVis = this._loadMultiIntersectionGroupVisible();
        const sig = [
            labelMode,
            primaryId,
            secondaryIds.join(','),
            groups
                .map((g) => `${g.id}:${groupVis[String(g.id)] === false ? 0 : 1}:${g.name || ''}`)
                .join('|')
        ].join(';');
        if (sig === this._multiIntersectionControlsSig && panel.children.length > 0) {
            this._rebuildMultiIntersectionRows();
            this._applyMultiIntersectionStripVisibility();
            return;
        }
        this._multiIntersectionControlsSig = sig;
        panel.innerHTML = '';

        const labelModeRow = document.createElement('div');
        labelModeRow.className = 'sun-timeBarControlsRow sun-timeBarControlsLabelMode';
        const labelModeSelect = document.createElement('select');
        labelModeSelect.className =
            'sun-timeBarSegmentLabelModeSelect sun-timeBarMultiIntersectionSegmentLabelModeSelect';
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

        const primaryRow = document.createElement('div');
        primaryRow.className = 'sun-timeBarControlsRow sun-timeBarMultiIntersectionPrimaryRow';
        const primaryWrap = document.createElement('div');
        primaryWrap.className = 'sun-intersectionSelectGroup';
        const primaryLab = document.createElement('label');
        primaryLab.className = 'sun-intersectionFormLabel';
        primaryLab.textContent = 'Основная персона (А)';
        const primarySel = document.createElement('select');
        primarySel.className =
            'sun-summarySelect sun-timeBarMultiIntersectionPrimarySelect';
        primarySel.setAttribute('aria-label', 'Основная персона А');
        this._fillPersonSelectOptions(primarySel, primaryId);
        primaryWrap.appendChild(primaryLab);
        primaryWrap.appendChild(primarySel);
        primaryRow.appendChild(primaryWrap);
        panel.appendChild(primaryRow);

        const secondaryBlock = document.createElement('div');
        secondaryBlock.className = 'sun-timeBarMultiIntersectionSecondaryList';
        secondaryBlock.setAttribute('aria-label', 'Вторые персоны (Б)');

        const list = secondaryIds.length > 0 ? secondaryIds : [''];
        list.forEach((sid, index) => {
            secondaryBlock.appendChild(this._createMultiSecondaryRow(sid, index));
        });
        panel.appendChild(secondaryBlock);

        const addRow = document.createElement('div');
        addRow.className = 'sun-timeBarControlsRow sun-timeBarMultiIntersectionAddRow';
        const addBtn = document.createElement('button');
        addBtn.type = 'button';
        addBtn.className = 'sun-uiBtn sun-timeBarMultiIntersectionAddBtn';
        addBtn.textContent = 'Добавить персону Б';
        addBtn.addEventListener('click', () => {
            const listEl = panel.querySelector('.sun-timeBarMultiIntersectionSecondaryList');
            if (!listEl) return;
            listEl.appendChild(this._createMultiSecondaryRow('', listEl.children.length));
            this._renumberMultiSecondaryRows(listEl);
        });
        addRow.appendChild(addBtn);
        panel.appendChild(addRow);

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
                cb.className = 'sun-timeBarMultiIntersectionGroupCheck';
                cb.dataset.groupId = String(group.id);
                cb.checked = this.isMultiIntersectionGroupVisible(group.id);
                cb.autocomplete = 'off';
                label.appendChild(text);
                label.appendChild(cb);
                groupsRow.appendChild(label);
            });
        }
        panel.appendChild(groupsRow);

        if (!this._multiIntersectionControlsChangeBound || this._multiIntersectionControlsChangePanel !== panel) {
            if (this._multiIntersectionControlsChangePanel && this._multiIntersectionControlsChangeHandler) {
                this._multiIntersectionControlsChangePanel.removeEventListener(
                    'change',
                    this._multiIntersectionControlsChangeHandler
                );
            }
            this._multiIntersectionControlsChangeHandler = (e) =>
                this._onMultiIntersectionControlsChange(e);
            panel.addEventListener('change', this._multiIntersectionControlsChangeHandler);
            this._multiIntersectionControlsChangePanel = panel;
            this._multiIntersectionControlsChangeBound = true;
        }

        this._rebuildMultiIntersectionRows();
    };

    proto._createMultiSecondaryRow = function (selectedId, index) {
        const row = document.createElement('div');
        row.className = 'sun-timeBarMultiIntersectionSecondaryRow';
        row.dataset.index = String(index);
        if (selectedId) row.dataset.secondaryId = String(selectedId);

        const wrap = document.createElement('div');
        wrap.className = 'sun-intersectionSelectGroup';
        const lab = document.createElement('label');
        lab.className = 'sun-intersectionFormLabel';
        lab.textContent = `Персона Б${index + 1}`;
        const sel = document.createElement('select');
        sel.className = 'sun-summarySelect sun-timeBarMultiIntersectionSecondarySelect';
        sel.setAttribute('aria-label', `Персона Б${index + 1}`);
        this._fillPersonSelectOptions(sel, selectedId);
        wrap.appendChild(lab);
        wrap.appendChild(sel);

        const stripsRow = document.createElement('div');
        stripsRow.className =
            'sun-timeBarControlsRow sun-timeBarControlsStates sun-timeBarMultiIntersectionStripChecks';
        [
            { key: 'ba', text: 'B×A' },
            { key: 'ab', text: 'A×B' }
        ].forEach(({ key, text }) => {
            const label = document.createElement('label');
            label.className = 'sun-timeBarControlCheck';
            const span = document.createElement('span');
            span.className = 'sun-timeBarControlLabel';
            span.textContent = text;
            const cb = document.createElement('input');
            cb.type = 'checkbox';
            cb.className = 'sun-timeBarMultiIntersectionStripCheck';
            cb.dataset.orientation = key;
            if (selectedId) cb.dataset.secondaryId = String(selectedId);
            cb.checked = this.isMultiIntersectionStripVisible(selectedId, key);
            cb.disabled = !selectedId;
            cb.autocomplete = 'off';
            label.appendChild(span);
            label.appendChild(cb);
            stripsRow.appendChild(label);
        });

        const removeBtn = document.createElement('button');
        removeBtn.type = 'button';
        removeBtn.className = 'sun-uiBtn sun-timeBarMultiIntersectionRemoveBtn';
        removeBtn.title = 'Удалить';
        removeBtn.setAttribute('aria-label', 'Удалить персону Б');
        removeBtn.textContent = '⨯';
        removeBtn.addEventListener('click', () => {
            const listEl = row.parentElement;
            if (!listEl) return;
            const selects = listEl.querySelectorAll('.sun-timeBarMultiIntersectionSecondarySelect');
            if (selects.length <= 1) {
                sel.value = '';
                row.dataset.secondaryId = '';
                row.querySelectorAll('.sun-timeBarMultiIntersectionStripCheck').forEach((cb) => {
                    cb.dataset.secondaryId = '';
                    cb.disabled = true;
                    cb.checked = true;
                });
                this._collectAndSaveMultiSecondaries(listEl);
                this._rebuildMultiIntersectionRows();
                if (window.extremumTimeManager && window.extremumTimeManager.updateExtremums) {
                    window.extremumTimeManager.updateExtremums();
                }
                return;
            }
            row.remove();
            this._renumberMultiSecondaryRows(listEl);
            this._collectAndSaveMultiSecondaries(listEl);
            this._rebuildMultiIntersectionRows();
            if (window.extremumTimeManager && window.extremumTimeManager.updateExtremums) {
                window.extremumTimeManager.updateExtremums();
            }
        });

        row.appendChild(wrap);
        row.appendChild(stripsRow);
        row.appendChild(removeBtn);
        return row;
    };

    proto._renumberMultiSecondaryRows = function (listEl) {
        if (!listEl) return;
        Array.from(listEl.querySelectorAll('.sun-timeBarMultiIntersectionSecondaryRow')).forEach(
            (row, i) => {
                row.dataset.index = String(i);
                const lab = row.querySelector('.sun-intersectionFormLabel');
                if (lab) lab.textContent = `Персона Б${i + 1}`;
                const sel = row.querySelector('.sun-timeBarMultiIntersectionSecondarySelect');
                if (sel) sel.setAttribute('aria-label', `Персона Б${i + 1}`);
            }
        );
    };

    proto._collectAndSaveMultiSecondaries = function (listEl) {
        if (!listEl) {
            listEl = document.querySelector('.sun-timeBarMultiIntersectionSecondaryList');
        }
        if (!listEl) return;
        const primary = this._loadMultiIntersectionPrimaryId();
        const ids = [];
        listEl.querySelectorAll('.sun-timeBarMultiIntersectionSecondarySelect').forEach((sel) => {
            const v = String(sel.value || '');
            if (v && v !== String(primary) && ids.indexOf(v) === -1) {
                ids.push(v);
            }
        });
        this._saveMultiIntersectionSecondaryIds(ids);
    };

    proto._onMultiIntersectionControlsChange = function (e) {
        const t = e.target;
        if (!t) return;

        if (
            t.tagName === 'SELECT' &&
            t.classList.contains('sun-timeBarMultiIntersectionSegmentLabelModeSelect')
        ) {
            this._saveMultiIntersectionSegmentLabelMode(t.value);
            if (window.extremumTimeManager && window.extremumTimeManager.updateExtremums) {
                window.extremumTimeManager.updateExtremums();
            }
            return;
        }

        if (
            t.tagName === 'SELECT' &&
            t.classList.contains('sun-timeBarMultiIntersectionPrimarySelect')
        ) {
            this._saveMultiIntersectionPrimaryId(t.value);
            this._collectAndSaveMultiSecondaries();
            this._multiIntersectionControlsSig = '';
            this.buildMultiIntersectionControlsPanel();
            if (window.extremumTimeManager && window.extremumTimeManager.updateExtremums) {
                window.extremumTimeManager.updateExtremums();
            }
            return;
        }

        if (
            t.tagName === 'SELECT' &&
            t.classList.contains('sun-timeBarMultiIntersectionSecondarySelect')
        ) {
            const listEl = t.closest('.sun-timeBarMultiIntersectionSecondaryList');
            const row = t.closest('.sun-timeBarMultiIntersectionSecondaryRow');
            const newId = String(t.value || '');
            if (row) {
                row.dataset.secondaryId = newId;
                row.querySelectorAll('.sun-timeBarMultiIntersectionStripCheck').forEach((cb) => {
                    cb.dataset.secondaryId = newId;
                    cb.disabled = !newId;
                    const orientation = cb.dataset.orientation === 'ba' ? 'ba' : 'ab';
                    cb.checked = this.isMultiIntersectionStripVisible(newId, orientation);
                });
            }
            this._collectAndSaveMultiSecondaries(listEl);
            this._rebuildMultiIntersectionRows();
            if (window.extremumTimeManager && window.extremumTimeManager.updateExtremums) {
                window.extremumTimeManager.updateExtremums();
            }
            return;
        }

        if (t.tagName !== 'INPUT') return;

        if (t.classList.contains('sun-timeBarMultiIntersectionStripCheck')) {
            const orientation = t.dataset.orientation === 'ba' ? 'ba' : 'ab';
            const row = t.closest('.sun-timeBarMultiIntersectionSecondaryRow');
            const sel = row && row.querySelector('.sun-timeBarMultiIntersectionSecondarySelect');
            const secondaryId =
                (t.dataset.secondaryId && String(t.dataset.secondaryId)) ||
                (sel && String(sel.value || '')) ||
                (row && row.dataset.secondaryId) ||
                '';
            if (!secondaryId) return;
            this._setMultiIntersectionStripVisible(secondaryId, orientation, !!t.checked);
            this._applyMultiIntersectionStripVisibility();
            if (window.extremumTimeManager && window.extremumTimeManager.updateExtremums) {
                window.extremumTimeManager.updateExtremums();
            }
            return;
        }

        if (t.classList.contains('sun-timeBarMultiIntersectionGroupCheck')) {
            const groupId = t.dataset.groupId;
            if (!groupId) return;
            const visible = this._loadMultiIntersectionGroupVisible();
            if (t.checked) {
                delete visible[String(groupId)];
            } else {
                visible[String(groupId)] = false;
            }
            this._saveMultiIntersectionGroupVisible(visible);
            if (window.extremumTimeManager && window.extremumTimeManager.updateExtremums) {
                window.extremumTimeManager.updateExtremums();
            }
        }
    };
})();
