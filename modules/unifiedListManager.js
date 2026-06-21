/**
 * @file unifiedListManager.js
 * EJS-списки персон и волн: рендер, редактирование, DnD-синхронизация DOM.
 */
class UnifiedListManager {
    constructor() {
        this.templates = {
            date: this.prepareDateData.bind(this),
            wave: this.prepareWaveData.bind(this),
            group: this.prepareGroupData.bind(this)
        };
        this.debug = false;
        this.templateCache = {};
        this.templatesLoaded = false;
        /** Кэш ejs.compile — ускоряет повторные renderList */
        this._ejsRenderers = {};
        
        this.templatesLoadPromise = null;
        /** Подпись структуры списка дат; при совпадении — только патч выделения без EJS */
        this._datesListStructureSig = null;
    }

    /** Сбрасывает кэш скомпилированных EJS-шаблонов. */
    invalidateEjsRenderers() {
        this._ejsRenderers = {};
        this._datesListStructureSig = null;
        if (window.dateComparisonManager && window.dateComparisonManager.invalidateDateListSignatureCache) {
            window.dateComparisonManager.invalidateDateListSignatureCache();
        }
    }

    /** Сбрасывает подпись структуры списка дат. */
    invalidateDatesListStructureCache() {
        this._datesListStructureSig = null;
        if (window.dateComparisonManager && window.dateComparisonManager.invalidateDateListSignatureCache) {
            window.dateComparisonManager.invalidateDateListSignatureCache();
        }
    }

    /** Внутренний метод computeDatesListStructureSignature. */
    _computeDatesListStructureSignature() {
        const pg = window.appState.data.personGroups || [];
        const dates = window.appState.data.dates || [];
        let dpart = '';
        for (let i = 0; i < dates.length; i++) {
            const d = dates[i];
            dpart += `${String(d.id)}\t${String(d.name || '')}\t${d.date};`;
        }
        let s = `${pg.length}|${dpart}|`;
        for (let i = 0; i < pg.length; i++) {
            const g = pg[i];
            const ids = (g.dates || []).map(String).join(',');
            s += `${String(g.id)}\t${String(g.name || '')}\t${g.expanded !== false ? '1' : '0'}\t${ids}|`;
        }
        return s;
    }

    /** Внутренний метод canPatchDateListDom. */
    _canPatchDateListDom() {
        if (window.appState.editingDateId != null || window.appState.editingPersonGroupId != null) {
            return false;
        }
        const root = window.dom.byKey('dateListForDates');
        if (!root) {
            return false;
        }
        if (root.querySelector('.sun-listEmpty') && root.textContent && root.textContent.indexOf('Загрузка') !== -1) {
            return false;
        }
        const dateRows = root.querySelectorAll('.sun-listItemDate[data-type="date"]');
        const n = dateRows.length;
        const dataDates = window.appState.data.dates || [];
        if (n !== dataDates.length) {
            return false;
        }
        if (n > 0) {
            const idSet = new Set();
            for (let d = 0; d < dataDates.length; d++) {
                idSet.add(String(dataDates[d].id));
            }
            for (let i = 0; i < dateRows.length; i++) {
                const id = dateRows[i].getAttribute('data-id');
                if (!id || !idSet.has(String(id))) {
                    return false;
                }
            }
        }
        const groupRows = root.querySelectorAll('.sun-listItemPersonGroup');
        const pg = window.appState.data.personGroups || [];
        if (groupRows.length !== pg.length) {
            return false;
        }
        return true;
    }

    static LIST_ITEM_SAVE_FLASH = {
        date: { rootId: 'dateListForDates', rowClass: 'sun-listItemDate', dataType: 'date' },
        wave: { rootId: 'wavesList', rowClass: 'sun-listItemWave', dataType: 'wave' },
        group: { rootId: 'wavesList', rowClass: 'sun-listItemGroup', dataType: 'group' },
        personGroup: {
            rootId: 'dateListForDates',
            rowClass: 'sun-listItemPersonGroup',
            dataType: 'personGroup'
        }
    };

    /**
     * Малиновое затухание фона строки после успешного сохранения.
     * @param {'date'|'wave'|'group'|'personGroup'} type
     * @param {string|number} id
     */
    flashListItemSaved(type, id) {
        const cfg = UnifiedListManager.LIST_ITEM_SAVE_FLASH[type];
        if (!cfg || id == null) {
            return;
        }
        const root = window.dom.byKey(cfg.rootId);
        if (!root) {
            return;
        }
        const idStr = String(id);
        const escaped =
            typeof CSS !== 'undefined' && CSS.escape ? CSS.escape(idStr) : idStr.replace(/"/g, '\\"');
        const row = root.querySelector(
            `.${cfg.rowClass}[data-type="${cfg.dataType}"][data-id="${escaped}"]`
        );
        if (!row) {
            return;
        }

        const done = () => {
            row.classList.remove('sun-listItemSaveFlash');
        };

        row.classList.remove('sun-listItemSaveFlash');
        void row.offsetWidth;
        row.classList.add('sun-listItemSaveFlash');
        row.addEventListener('animationend', done, { once: true });
        window.setTimeout(() => {
            if (row.classList.contains('sun-listItemSaveFlash')) {
                row.classList.remove('sun-listItemSaveFlash');
            }
        }, 950);
    }

    /** Плоские классы режима редактирования строки (без селекторов parent > child). */
    syncListItemEditingClasses(row, isEditing) {
        if (!row) {
            return;
        }
        row.classList.toggle('sun-listItemEditing', isEditing);

        const content = row.querySelector(':scope > .sun-listItemContent');
        const normal = content ? content.querySelector(':scope > .sun-listItemNormalView') : null;
        const form = content ? content.querySelector(':scope > .sun-listItemEditForm') : null;
        const handle = row.querySelector(':scope > .sun-listItemDragHandle');
        const altHandle = row.querySelector('.sun-waveDragHandle, .sun-dateDragHandle');

        if (normal) {
            normal.classList.toggle('sun-listItemViewHidden', isEditing);
            normal.classList.toggle('sun-listItemViewForceShown', false);
        }
        if (form) {
            form.classList.toggle('sun-listItemViewShown', isEditing);
        }
        if (handle) {
            handle.classList.toggle('sun-listItemDragHandleMuted', isEditing);
        }
        if (altHandle && altHandle !== handle) {
            altHandle.classList.toggle('sun-listItemDragHandleMuted', isEditing);
        }

        if (row.classList.contains('sun-listItemGroup')) {
            row.querySelectorAll('.sun-waveInGroup').forEach((waveRow) => {
                const waveContent = waveRow.querySelector('.sun-listItemContent');
                const waveNormal = waveContent
                    ? waveContent.querySelector('.sun-listItemNormalView')
                    : null;
                const waveForm = waveContent
                    ? waveContent.querySelector('.sun-listItemEditForm')
                    : null;
                if (isEditing) {
                    if (waveNormal) {
                        waveNormal.classList.remove('sun-listItemViewHidden');
                        waveNormal.classList.add('sun-listItemViewForceShown');
                    }
                    if (waveForm) {
                        waveForm.classList.remove('sun-listItemViewShown');
                    }
                } else {
                    const waveEditing = waveRow.classList.contains('sun-listItemEditing');
                    if (waveNormal) {
                        waveNormal.classList.remove('sun-listItemViewForceShown');
                        waveNormal.classList.toggle('sun-listItemViewHidden', waveEditing);
                    }
                    if (waveForm) {
                        waveForm.classList.toggle('sun-listItemViewShown', waveEditing);
                    }
                }
            });
        }

        if (row.classList.contains('sun-listItemPersonGroup')) {
            row.querySelectorAll('.sun-dateInPersonGroup').forEach((dateRow) => {
                const dateContent = dateRow.querySelector('.sun-listItemContent');
                const dateNormal = dateContent
                    ? dateContent.querySelector('.sun-listItemNormalView')
                    : null;
                const dateForm = dateContent
                    ? dateContent.querySelector('.sun-listItemEditForm')
                    : null;
                if (isEditing) {
                    if (dateNormal) {
                        dateNormal.classList.remove('sun-listItemViewHidden');
                        dateNormal.classList.add('sun-listItemViewForceShown');
                    }
                    if (dateForm) {
                        dateForm.classList.remove('sun-listItemViewShown');
                    }
                } else {
                    const dateEditing = dateRow.classList.contains('sun-listItemEditing');
                    if (dateNormal) {
                        dateNormal.classList.remove('sun-listItemViewForceShown');
                        dateNormal.classList.toggle('sun-listItemViewHidden', dateEditing);
                    }
                    if (dateForm) {
                        dateForm.classList.toggle('sun-listItemViewShown', dateEditing);
                    }
                }
            });
        }
    }

    /** Откладывает flash list item saved в RAF. */
    scheduleFlashListItemSaved(type, id) {
        requestAnimationFrame(() => {
            requestAnimationFrame(() => {
                this.flashListItemSaved(type, id);
            });
        });
    }

    /**
     * Имя, дата, пол и годы в обычном виде строки — без полного EJS (после сохранения редактирования).
     */
    _syncDateRowDisplayFromAppState(row, dateObj) {
        if (!row || !dateObj || !window.dom) {
            return;
        }
        const currentTimestamp =
            window.appState.currentDate instanceof Date
                ? window.appState.currentDate.getTime()
                : window.appState.currentDate;
        const formatted = window.dom.formatDate(dateObj.date);
        const gender = window.dom.normalizePersonGender(dateObj.gender);
        const icon = window.dom.getPersonGenderIcon(gender);
        const genderLabel = window.dom.getPersonGenderLabel(gender);
        const yearsFromCurrent = window.dom.getYearsBetweenDates(dateObj.date, currentTimestamp);

        const nameEl = row.querySelector('.sun-dateName');
        if (nameEl) {
            nameEl.textContent = dateObj.name;
        }

        const valueEl = row.querySelector('.sun-listItemValue');
        if (valueEl) {
            valueEl.textContent = '';
            valueEl.appendChild(document.createTextNode(formatted));
            valueEl.appendChild(document.createTextNode(' '));
            const badge = document.createElement('span');
            badge.className = 'sun-dateGenderBadge';
            badge.title = genderLabel;
            badge.textContent = `[${icon}]`;
            valueEl.appendChild(badge);
            if (yearsFromCurrent > 0) {
                valueEl.appendChild(document.createTextNode(` [${yearsFromCurrent}]`));
            }
            valueEl.title =
                formatted + (yearsFromCurrent > 0 ? ` [${yearsFromCurrent}]` : '');
        }
    }

    /**
     * Только активная дата и чекбоксы A/B — без перерисовки списка (скролл не сбрасывается).
     * Подсветка A/B на строке — через CSS :has(:checked), классы на строке не ставим.
     * Чекбоксы — по всем input.sun-dateCheckbox в контейнере (надёжнее, чем поиск от строки).
     */
    syncDateListSelectionVisuals(opts = {}) {
        const selectionOnly = opts.selectionOnly === true;
        const root = window.dom.byKey('dateListForDates');
        if (!root) {
            window.sunDateListLog && window.sunDateListLog('syncDateListSelectionVisuals:no #dateListForDates');
            return;
        }
        const activeIdStr =
            window.appState.activeDateId != null ? String(window.appState.activeDateId) : '';
        const ds = window.appState.dateSelections || {};
        const typeAStr = ds.typeA != null ? String(ds.typeA) : '';
        const typeBStr = ds.typeB != null ? String(ds.typeB) : '';
        const editingDateIdStr =
            window.appState.editingDateId != null ? String(window.appState.editingDateId) : '';

        const rows = root.querySelectorAll('.sun-listItemDate[data-type="date"]');
        window.sunDateListLog && window.sunDateListLog('syncDateListSelectionVisuals:start', {
            rowCount: rows.length,
            activeIdStr,
            typeAStr,
            typeBStr,
            selectionOnly,
            dateSelections: { ...ds }
        });

        rows.forEach((row) => {
            const id = row.getAttribute('data-id');
            if (!id) {
                return;
            }
            const idStr = String(id);
            const isEditing = editingDateIdStr !== '' && idStr === editingDateIdStr;
            this.syncListItemEditingClasses(row, isEditing);
            row.classList.toggle('sun-active', idStr === activeIdStr);

            const dhandle = row.querySelector('.sun-dateDragHandle');
            if (dhandle) {
                dhandle.setAttribute('draggable', isEditing ? 'false' : 'true');
            }

            if (selectionOnly) {
                return;
            }

            const dateObj = window.appState.data.dates.find((d) => String(d.id) === idStr);
            if (dateObj && window.dom && typeof window.dom.formatPersonDateHoverTitle === 'function') {
                if (!isEditing) {
                    this._syncDateRowDisplayFromAppState(row, dateObj);
                }
                const formatted = window.dom.formatDate(dateObj.date);
                const description = typeof dateObj.description === 'string' ? dateObj.description : '';
                const gender = window.dom.normalizePersonGender(dateObj.gender);
                const hoverTitle = window.dom.formatPersonDateHoverTitle(
                    dateObj.name,
                    formatted,
                    description,
                    gender
                );
                const nameEl = row.querySelector('.sun-dateName');
                const starEl = row.querySelector('.sun-dateStar');
                if (nameEl) {
                    nameEl.setAttribute('title', hoverTitle);
                }
                if (starEl) {
                    starEl.setAttribute('title', hoverTitle);
                }
            }
        });

        root.querySelectorAll('input.sun-dateCheckbox').forEach((inp) => {
            const t = inp.getAttribute('data-type');
            const rid = inp.getAttribute('data-id');
            if (!rid || (t !== 'a' && t !== 'b')) {
                return;
            }
            const ridStr = String(rid);
            if (t === 'a') {
                inp.checked = typeAStr !== '' && ridStr === typeAStr;
            } else {
                inp.checked = typeBStr !== '' && ridStr === typeBStr;
            }
        });

        if (window.sunDateListLog) {
            const snap = [];
            root.querySelectorAll('input.sun-dateCheckbox').forEach((inp) => {
                const idStr = String(inp.getAttribute('data-id') || '');
                const t = inp.getAttribute('data-type');
                const wantA = t === 'a' && typeAStr !== '' && idStr === typeAStr;
                const wantB = t === 'b' && typeBStr !== '' && idStr === typeBStr;
                if (wantA || wantB || idStr === activeIdStr || inp.checked) {
                    snap.push({
                        id: idStr,
                        t,
                        want: t === 'a' ? wantA : wantB,
                        chk: inp.checked
                    });
                }
            });
            window.sunDateListLog('syncDateListSelectionVisuals:applied', { snap });
        }
    }

    /** O(1) доступ к волнам/группам при сборке списков с большим числом сигналов */
    buildWaveListLookups() {
        const waveById = new Map();
        for (let i = 0; i < window.appState.data.waves.length; i++) {
            const w = window.appState.data.waves[i];
            waveById.set(String(w.id), w);
        }
        const groupById = new Map();
        const groupIndexById = new Map();
        for (let i = 0; i < window.appState.data.groups.length; i++) {
            const g = window.appState.data.groups[i];
            const idStr = String(g.id);
            groupById.set(idStr, g);
            groupIndexById.set(idStr, i);
        }
        return { waveById, groupById, groupIndexById };
    }

    /**
     * Возвращает скомпилированный шаблон (быстрее, чем ejs.render со строкой на каждый вызов).
     */
    ensureEjsRenderer(templateId) {
        if (this._ejsRenderers[templateId]) {
            return this._ejsRenderers[templateId];
        }
        const text = this.getTemplate(templateId);
        if (typeof ejs === 'undefined' || !ejs.compile) {
            this._ejsRenderers[templateId] = (locals) => ejs.render(text, locals);
            return this._ejsRenderers[templateId];
        }
        try {
            this._ejsRenderers[templateId] = ejs.compile(text, {
                filename: templateId,
                strict: false
            });
        } catch (_) {
            this._ejsRenderers[templateId] = (locals) => ejs.render(text, locals);
        }
        return this._ejsRenderers[templateId];
    }
    
    /** Инициализация модуля. */
    /** Версия кэша EJS в sessionStorage — увеличить при изменении templates/*.ejs */
    static EJS_TEMPLATES_CACHE_VERSION = 1;
    static EJS_TEMPLATES_CACHE_KEY = 'sun_ejs_templates_cache';

    initTemplates() {
        if (this.templatesLoaded) {
            return Promise.resolve();
        }

        if (this.templatesLoadPromise) {
            return this.templatesLoadPromise;
        }

        this.templatesLoadPromise = new Promise(async (resolve) => {
            try {
                const templateIds = [
                    'date-item-template',
                    'wave-item-template',
                    'group-item-template',
                    'person-group-item-template',
                    'intersection-item-template'
                ];

                if (this._hydrateTemplatesFromSessionCache(templateIds)) {
                    this.templatesLoaded = true;
                    resolve();
                    return;
                }

                const loadPromises = templateIds.map(async (templateId) => {
                    try {
                        const url = `templates/${templateId.replace('-template', '')}.ejs`;
                        const response = await fetch(url);
                        if (response.ok) {
                            this.templateCache[templateId] = await response.text();
                        }
                    } catch (error) {
                        /* ignore */
                    }
                });

                await Promise.allSettled(loadPromises);
                this._persistTemplatesToSessionCache(templateIds);
                this.templatesLoaded = true;
                resolve();
            } catch (error) {
                this.templatesLoaded = true;
                resolve();
            }
        });

        return this.templatesLoadPromise;
    }

    _hydrateTemplatesFromSessionCache(templateIds) {
        try {
            const raw = sessionStorage.getItem(UnifiedListManager.EJS_TEMPLATES_CACHE_KEY);
            if (!raw) return false;
            const parsed = JSON.parse(raw);
            if (parsed.v !== UnifiedListManager.EJS_TEMPLATES_CACHE_VERSION) return false;
            const templates = parsed.templates;
            if (!templates || typeof templates !== 'object') return false;
            for (const id of templateIds) {
                if (!templates[id]) return false;
                this.templateCache[id] = templates[id];
            }
            return true;
        } catch (e) {
            return false;
        }
    }

    _persistTemplatesToSessionCache(templateIds) {
        try {
            const templates = {};
            for (const id of templateIds) {
                if (this.templateCache[id]) {
                    templates[id] = this.templateCache[id];
                }
            }
            if (Object.keys(templates).length === 0) return;
            sessionStorage.setItem(
                UnifiedListManager.EJS_TEMPLATES_CACHE_KEY,
                JSON.stringify({
                    v: UnifiedListManager.EJS_TEMPLATES_CACHE_VERSION,
                    templates
                })
            );
        } catch (e) {
            /* quota / private mode */
        }
    }
    
    /** Создаёт emergency fallback templates. */
    createEmergencyFallbackTemplates() {
        this.templateCache['date-item-template'] = `
<div class="sun-listItem sun-listItemDate" style="background:#ffe6e6;border:2px solid red;">
    <div class="sun-listItemContent">
        <div style="color:red;padding:10px;">
            ❌ ОШИБКА: Шаблон не загружен!<br>
            Проверьте файл templates/date-item.ejs
        </div>
    </div>
</div>`;
        
        this.templateCache['wave-item-template'] = `
<div class="sun-listItem sun-listItemWave" style="background:#ffe6e6;border:2px solid red;">
    <div class="sun-listItemContent">
        <div style="color:red;padding:10px;">
            ❌ ОШИБКА: Шаблон не загружен!<br>
            Проверьте файл templates/wave-item.ejs
        </div>
    </div>
</div>`;
        
        this.templateCache['group-item-template'] = `
<div class="sun-listItem sun-listItemGroup" style="background:#ffe6e6;border:2px solid red;">
    <div class="sun-listItemContent">
        <div style="color:red;padding:10px;">
            ❌ ОШИБКА: Шаблон не загружен!<br>
            Проверьте файл templates/group-item.ejs
        </div>
    </div>
</div>`;
        
        this.templateCache['person-group-item-template'] = `
<div class="sun-listItem sun-listItemPersonGroup" style="background:#ffe6e6;border:2px solid red;">
    <div class="sun-listItemContent"><div style="color:red;padding:10px;">Шаблон person-group-item.ejs не загружен</div></div>
</div>`;
        
        this.templateCache['intersection-item-template'] = `
<div class="intersection-item" style="background:#ffe6e6;border:2px solid red;">
    <div style="color:red;padding:10px;">
        ❌ ОШИБКА: Шаблон пересечений не загружен!
    </div>
</div>`;
    }
    
    /** renderList с ожиданием загрузки EJS-шаблонов. */
    async renderListWithWait(containerId, items, itemType) {
        if (!this.templatesLoaded) {
            try {
                await this.initTemplates();
            } catch (error) {
            }
        }
        
        return this.renderList(containerId, items, itemType);
    }
    
    /** Возвращает template. */
    getTemplate(templateId) {
        if (this.templateCache[templateId]) {
            return this.templateCache[templateId];
        }
        
        return '<div class="sun-listItem">Элемент списка</div>';
    }
    
    /** Отладочный лог unifiedListManager. */
    log(...args) {
        if (this.debug) {
            console.log('[UnifiedListManager]', ...args);
        }
    }
    


    /** DTO строки персоны для EJS dateItem. */
    prepareDateData(dateObj, index, personGroupId) {
        const currentTimestamp = window.appState.currentDate instanceof Date ? 
            window.appState.currentDate.getTime() : 
            window.appState.currentDate;
        
        const yearsFromCurrent = window.dom.getYearsBetweenDates(dateObj.date, currentTimestamp);
        const activeDateIdStr = window.appState.activeDateId ? String(window.appState.activeDateId) : null;
        const editingDateIdStr = window.appState.editingDateId ? String(window.appState.editingDateId) : null;
        const dateObjIdStr = String(dateObj.id);
        
        // Состояния выделения (id могут быть строкой/числом)
        const typeAStr =
            window.appState.dateSelections && window.appState.dateSelections.typeA != null
                ? String(window.appState.dateSelections.typeA)
                : '';
        const typeBStr =
            window.appState.dateSelections && window.appState.dateSelections.typeB != null
                ? String(window.appState.dateSelections.typeB)
                : '';
        const isSelectedTypeA = typeAStr !== '' && typeAStr === dateObjIdStr;
        const isSelectedTypeB = typeBStr !== '' && typeBStr === dateObjIdStr;
        
        const formattedDate = window.dom.formatDate(dateObj.date);
        const description = typeof dateObj.description === 'string' ? dateObj.description : '';
        const gender = window.dom.normalizePersonGender(dateObj.gender);

        return {
            id: dateObj.id,
            name: dateObj.name,
            description,
            gender,
            genderIcon: window.dom.getPersonGenderIcon(gender),
            hoverTitle: window.dom.formatPersonDateHoverTitle(
                dateObj.name,
                formattedDate,
                description,
                gender
            ),
            type: 'date',
            personGroupId: personGroupId != null ? personGroupId : null,
            inPersonGroup: personGroupId != null && personGroupId !== '',
            formattedDate,
            dateForInput: window.dom.formatDateForInput(dateObj.date),
            yearsFromCurrent: yearsFromCurrent,
            active: activeDateIdStr === dateObjIdStr,
            editing: editingDateIdStr === dateObjIdStr,
            index: index,
            // Состояния выделения
            selectedTypeA: isSelectedTypeA,
            selectedTypeB: isSelectedTypeB,
            selectionType: isSelectedTypeA ? 'a' : (isSelectedTypeB ? 'b' : null)
        };
    }

    /** DTO группы персон для EJS. */
    preparePersonGroupData(groupData, index) {
        const original = window.appState.data.personGroups.find(
            g => String(g.id) === String(groupData.id)
        );
        if (!original) {
            return {
                ...groupData,
                dateCount: 0,
                children: [],
                expanded: false,
                editing: false,
                index
            };
        }
        const existingDates = [];
        if (original.dates && Array.isArray(original.dates)) {
            original.dates.forEach((dateId, di) => {
                const dateIdStr = String(dateId);
                const dateObj = window.appState.data.dates.find(d => String(d.id) === dateIdStr);
                if (dateObj) {
                    existingDates.push(dateObj);
                }
            });
        }
        const childrenData = existingDates.map((dateObj, di) =>
            this.prepareDateData(dateObj, di, original.id)
        );
        const editingPersonGroupIdStr = window.appState.editingPersonGroupId
            ? String(window.appState.editingPersonGroupId)
            : null;
        const groupIdStr = String(original.id);
        return {
            id: original.id,
            name: original.name,
            type: 'personGroup',
            dateCount: childrenData.length,
            expanded: original.expanded !== undefined ? original.expanded : true,
            children: childrenData,
            index,
            editing: editingPersonGroupIdStr === groupIdStr
        };
    }
    
    // В unifiedListManager.js - в методе prepareGroupData ДОБАВИТЬ
    /** DTO группы сигналов для EJS. */
    prepareGroupData(groupData, index, lookups) {
        const idStr = String(groupData.id);
        const originalGroup =
            lookups && lookups.groupById && lookups.groupById.get(idStr)
                ? lookups.groupById.get(idStr)
                : window.appState.data.groups.find(g => String(g.id) === idStr);
        
        if (!originalGroup) {
            return {
                ...groupData,
                waveCount: 0,
                enabledCount: 0,
                enabledCountA: 0,
                enabledCountB: 0,
                children: [],
                expanded: false,
                enabled: false,
                editing: false
            };
        }
        
        const existingWaves = [];
        let enabledCountA = 0;
        let enabledCountB = 0;
        
        if (originalGroup.waves && Array.isArray(originalGroup.waves)) {
            originalGroup.waves.forEach((waveId, waveIndex) => {
                const waveIdStr = String(waveId);
                const wave =
                    lookups && lookups.waveById && lookups.waveById.get(waveIdStr)
                        ? lookups.waveById.get(waveIdStr)
                        : window.appState.data.waves.find(w => String(w.id) === waveIdStr);
                
                if (wave) {
                    existingWaves.push(wave);
                    const waveIdStrForCheck = String(wave.id);
                    if (window.appState.waveVisibility[waveIdStrForCheck] !== false) {
                        enabledCountA++;
                    }
                    if (window.appState.waveBold[waveIdStrForCheck] === true) {
                        enabledCountB++;
                    }
                }
            });
        }
        
        const waveCount = existingWaves.length;
        const childrenData = existingWaves.map((wave, waveIndex) => {
            // ДОБАВЛЕНО: передаем parentGroupId в данные волны
            const waveData = this.prepareWaveData(wave, waveIndex);
            waveData.parentGroupId = originalGroup.id; // Ключевое добавление
            return waveData;
        });
        
        const editingGroupIdStr = window.appState.editingGroupId ? String(window.appState.editingGroupId) : null;
        const groupIdStr = String(originalGroup.id);
        
        return {
            id: originalGroup.id,
            name: originalGroup.name,
            type: 'group',
            waveCount: waveCount,
            enabledCount: enabledCountA,
            enabledCountA: enabledCountA,
            enabledCountB: enabledCountB,
            enabled: originalGroup.enabled !== undefined ? originalGroup.enabled : false,
            expanded: originalGroup.expanded !== undefined ? originalGroup.expanded : false,
            children: childrenData,
            index: index,
            editing: editingGroupIdStr === groupIdStr
        };
    }

    // В методе prepareWaveData - ДОБАВИТЬ в возвращаемый объект
    /** DTO строки волны для EJS. */
    prepareWaveData(wave, index) {
        const waveIdStr = String(wave.id);
        const editingWaveIdStr = window.appState.editingWaveId ? String(window.appState.editingWaveId) : null;
        const note = typeof wave.note === 'string' ? wave.note : '';
        
        return {
            id: wave.id,
            name: wave.name,
            type: 'wave',
            period: wave.period,
            color: wave.color,
            typeValue: wave.type,
            description: window.dom.getWaveDescription(wave.type),
            note,
            hoverTitle: window.dom.formatWaveHoverTitle(wave.name, wave.period, note),
            visible: window.appState.waveVisibility[waveIdStr] !== false,
            // UI: .sun-waveBVisibilityCheck; в appState ключ waveBold (историческое имя поля)
            bold: window.appState.waveBold[waveIdStr] || false,
            cornerColor: window.appState.waveCornerColor[waveIdStr] || false,
            editing: editingWaveIdStr === waveIdStr,
            index: index,
            // parentGroupId будет добавлен в prepareGroupData
        };
    }
    
    /** DTO строки пересечения для шаблона. */
    prepareIntersectionData(intersectionData, index) {
        return {
            ...intersectionData,
            type: 'intersection',
            index: index,
            timeStr: intersectionData.timeStr || this.formatIntersectionTime(intersectionData.timestamp),
            wave1Name: intersectionData.wave1?.name || 'Неизвестно',
            wave2Name: intersectionData.wave2?.name || 'Неизвестно',
            wave1Period: intersectionData.wave1?.period || 0,
            wave2Period: intersectionData.wave2?.period || 0,
            wave1Color: intersectionData.wave1?.color || '#666666',
            wave2Color: intersectionData.wave2?.color || '#666666'
        };
    }
    
    /** Форматирует время пересечения для списка. */
    formatIntersectionTime(timestamp) {
        if (!timestamp) return '00:00:00';
        try {
            const date = new Date(timestamp);
            const hours = date.getHours().toString().padStart(2, '0');
            const minutes = date.getMinutes().toString().padStart(2, '0');
            const seconds = date.getSeconds().toString().padStart(2, '0');
            return `${hours}:${minutes}:${seconds}`;
        } catch (error) {
            return '00:00:00';
        }
    }
    
    /** Рендер списка через EJS в контейнер. */
    renderList(containerId, items, itemType) {
        const __perfT0 = typeof performance !== 'undefined' ? performance.now() : 0;
        let container = null;
        try {
        container = window.dom.byKey(containerId);
        if (!container) {
            return;
        }
        
        if (!this.templatesLoaded) {
            container.innerHTML = '<div class="sun-listEmpty">Загрузка шаблонов...</div>';

            void this.initTemplates().then(() => {
                this.renderList(containerId, items, itemType);
            });
            return;
        }
        
        container.innerHTML = '';
        
        if (!items || items.length === 0) {
            const emptyMessage = document.createElement('div');
            emptyMessage.className = 'sun-listEmpty';
            emptyMessage.textContent = this.getEmptyMessage(itemType);
            container.appendChild(emptyMessage);
            return;
        }
        
        let templateId;
        switch(itemType) {
            case 'date': templateId = 'date-item-template'; break;
            case 'wave': templateId = 'wave-item-template'; break;
            case 'group': templateId = 'group-item-template'; break;
            case 'personGroup': templateId = 'person-group-item-template'; break;
            case 'intersection': templateId = 'intersection-item-template'; break;
            default: templateId = 'date-item-template';
        }
        
        const templateText = this.getTemplate(templateId);
        if (!templateText) {
            container.innerHTML = '<div class="list-error">Ошибка: шаблон не загружен</div>';
            return;
        }
        
        if (typeof ejs === 'undefined') {
            container.innerHTML = '<div class="list-error">Ошибка: EJS не загружен</div>';
            return;
        }
        
        if (itemType === 'group') {
            const renderGroup = this.ensureEjsRenderer('group-item-template');
            const renderWave = this.ensureEjsRenderer('wave-item-template');
            const WAVE_SENTINEL = '<!--ZARAZA_WAVE_CHILDREN-->';
            const htmlChunks = [];
            items.forEach((groupData, index) => {
                try {
                    if (groupData.waveCount === undefined) {
                        groupData.waveCount = groupData.waves ? groupData.waves.length : 0;
                    }
                    if (groupData.enabledCount === undefined) {
                        groupData.enabledCount = 0;
                    }
                    if (groupData.enabledCountA === undefined) {
                        groupData.enabledCountA = groupData.enabledCount || 0;
                    }
                    if (groupData.enabledCountB === undefined) {
                        groupData.enabledCountB = 0;
                    }
                    
                    let renderedGroup = renderGroup({ data: groupData });
                    
                    if (groupData.children && groupData.children.length > 0) {
                        const waveHtmlParts = [];
                        for (let ci = 0; ci < groupData.children.length; ci++) {
                            const childData = groupData.children[ci];
                            try {
                                childData.type = 'wave';
                                waveHtmlParts.push(renderWave({ data: childData }));
                            } catch (error) {
                                const safeMsg = String(error.message).replace(/&/g, '&amp;').replace(/</g, '&lt;');
                                waveHtmlParts.push(
                                    `<div class="list-error">Ошибка рендеринга: ${safeMsg}</div>`
                                );
                            }
                        }
                        const wavesHtml = waveHtmlParts.join('');
                        if (renderedGroup.indexOf(WAVE_SENTINEL) !== -1) {
                            renderedGroup = renderedGroup.split(WAVE_SENTINEL).join(wavesHtml);
                        } else {
                            const tempDiv = document.createElement('div');
                            tempDiv.innerHTML = renderedGroup;
                            const groupElement = tempDiv.firstElementChild;
                            const childrenContainer = groupElement
                                ? groupElement.querySelector('.sun-groupChildren')
                                : null;
                            if (childrenContainer) {
                                childrenContainer.innerHTML = wavesHtml;
                                if (groupData.expanded) {
                                    childrenContainer.style.display = 'block';
                                    childrenContainer.classList.add('sun-groupChildrenOpen');
                                    groupElement.classList.add('sun-listItemExpanded');
                                } else {
                                    childrenContainer.style.display = 'none';
                                    childrenContainer.classList.remove('sun-groupChildrenOpen');
                                    groupElement.classList.remove('sun-listItemExpanded');
                                }
                            }
                            renderedGroup = tempDiv.innerHTML;
                        }
                    }
                    
                    htmlChunks.push(renderedGroup);
                } catch (error) {
                    htmlChunks.push(
                        `<div class="list-error">Ошибка рендеринга группы: ${String(error.message).replace(/</g, '&lt;')}</div>`
                    );
                }
            });
            container.innerHTML = htmlChunks.join('');
        } else if (itemType === 'personGroup') {
            const renderPersonGroup = this.ensureEjsRenderer('person-group-item-template');
            const renderDate = this.ensureEjsRenderer('date-item-template');
            const frag = document.createDocumentFragment();
            items.forEach((groupData, index) => {
                try {
                    if (groupData.dateCount === undefined) {
                        groupData.dateCount = groupData.children ? groupData.children.length : 0;
                    }
                    const renderedGroup = renderPersonGroup({ data: groupData });
                    const tempDiv = document.createElement('div');
                    tempDiv.innerHTML = renderedGroup;
                    const groupElement = tempDiv.firstElementChild;
                    const childrenContainer = groupElement.querySelector('.sun-personGroupChildren');
                    if (childrenContainer && groupData.children && groupData.children.length > 0) {
                        const parts = [];
                        for (let ci = 0; ci < groupData.children.length; ci++) {
                            const childData = groupData.children[ci];
                            try {
                                childData.type = 'date';
                                parts.push(renderDate({ data: childData }));
                            } catch (error) {
                                const safeMsg = String(error.message).replace(/&/g, '&amp;').replace(/</g, '&lt;');
                                parts.push(`<div class="list-error">Ошибка: ${safeMsg}</div>`);
                            }
                        }
                        childrenContainer.innerHTML = parts.join('');
                        if (groupData.expanded) {
                            childrenContainer.style.display = 'block';
                            childrenContainer.classList.add('sun-groupChildrenOpen');
                            groupElement.classList.add('sun-listItemExpanded');
                        } else {
                            childrenContainer.style.display = 'none';
                            childrenContainer.classList.remove('sun-groupChildrenOpen');
                            groupElement.classList.remove('sun-listItemExpanded');
                        }
                    }
                    frag.appendChild(groupElement);
                } catch (error) {
                    const errorDiv = document.createElement('div');
                    errorDiv.className = 'list-error';
                    errorDiv.textContent = `Ошибка рендеринга группы персон: ${error.message}`;
                    frag.appendChild(errorDiv);
                }
            });
            container.appendChild(frag);
        } else if (itemType === 'intersection') {
            const renderTpl = this.ensureEjsRenderer(templateId);
            const renderedItems = [];
            items.forEach((item, index) => {
                try {
                    const data = this.prepareIntersectionData(item, index);
                    const rendered = renderTpl({ data });
                    renderedItems.push(rendered);
                } catch (error) {
                    renderedItems.push(`<div class="list-error">Ошибка рендеринга пересечения</div>`);
                }
            });
            
            container.innerHTML = renderedItems.join('');
        } else {
            const renderTpl = this.ensureEjsRenderer(templateId);
            const renderedItems = [];
            items.forEach((item, index) => {
                try {
                    const data = this.templates[itemType] ? this.templates[itemType](item, index) : item;
                    data.type = data.type || itemType;
                    
                    const rendered = renderTpl({ data });
                    renderedItems.push(rendered);
                } catch (error) {
                    renderedItems.push(`<div class="list-error">Ошибка рендеринга элемента: ${error.message}</div>`);
                }
            });
            
            container.innerHTML = renderedItems.join('');
        }
        } finally {
            if (container) {
                container.querySelectorAll('input[type="checkbox"]').forEach((el) => {
                    el.setAttribute('autocomplete', 'off');
                });
            }
            if (
                window.appClassSync &&
                window.appState &&
                (itemType === 'date' || itemType === 'personGroup')
            ) {
                window.appClassSync.applyDateLabelMode(window.appState.showStars);
            }
            if (typeof window.sunPerfLog === 'function' && window.__SUN_PERF_LOG !== false) {
                window.sunPerfLog('unifiedListManager', 'renderList', {
                    containerId,
                    itemType,
                    itemCount: items ? items.length : 0,
                    durationMs: Number((performance.now() - __perfT0).toFixed(2))
                });
            }
        }
    }
    
    /** Возвращает empty message. */
    getEmptyMessage(type) {
        const messages = {
            date: 'Нет сохраненных дат',
            wave: 'Нет сигналов',
            group: 'Нет групп сигналов',
            personGroup: 'Нет групп персон',
            note: 'Нет сохраненных записей',
            intersection: 'Нет совпадений'
        };
        return messages[type] || 'Список пуст';
    }

    /**
     * Режим редактирования волны: класс sun-listItemEditing и поля формы уже в разметке —
     * переключаем без полного EJS updateWavesList() (сотни мс на больших списках).
     */
    syncWaveListEditingVisuals() {
        const editingId = window.appState.editingWaveId != null ? String(window.appState.editingWaveId) : null;
        const root = window.dom.byKey('wavesList');
        if (!root) return;

        root.querySelectorAll('.sun-listItemWave').forEach((row) => {
            const idStr = row.dataset.waveId != null ? String(row.dataset.waveId) : String(row.dataset.id);
            const isEditing = Boolean(editingId && idStr === editingId);
            this.syncListItemEditingClasses(row, isEditing);
            const handle = row.querySelector('.sun-waveDragHandle');
            if (handle) {
                handle.setAttribute('draggable', isEditing ? 'false' : 'true');
            }
        });

        if (!editingId) return;

        const wave = window.appState.data.waves.find((w) => String(w.id) === editingId);
        if (!wave) return;

        const nameInput = window.dom.byKey(`editWaveName${editingId}`);
        const periodInput = window.dom.byKey(`editWavePeriod${editingId}`);
        const typeInput = window.dom.byKey(`editWaveType${editingId}`);
        const colorInput = window.dom.byKey(`editWaveColor${editingId}`);
        const noteInput = window.dom.byKey(`editWaveNote${editingId}`);
        if (nameInput) nameInput.value = wave.name;
        if (periodInput) periodInput.value = wave.period;
        if (typeInput) typeInput.value = wave.type;
        if (colorInput) colorInput.value = wave.color || '#666666';
        if (noteInput) noteInput.value = typeof wave.note === 'string' ? wave.note : '';
    }

    /** Строка списка после сохранения формы: название, период, описание типа, превью цвета. */
    syncWaveListRowNormalViewFromModel(wave) {
        const idStr = String(wave.id);
        const root = window.dom.byKey('wavesList');
        if (!root) return;

        let row = null;
        root.querySelectorAll('.sun-listItemWave').forEach((el) => {
            const rid = el.dataset.waveId != null ? String(el.dataset.waveId) : String(el.dataset.id);
            if (rid === idStr) row = el;
        });
        if (!row) return;

        const titleEl = row.querySelector('.sun-listItemTitle');
        const badge = titleEl && titleEl.querySelector('.sun-wavePeriodBadge');
        if (titleEl && badge) {
            while (titleEl.firstChild && titleEl.firstChild !== badge) {
                titleEl.removeChild(titleEl.firstChild);
            }
            titleEl.insertBefore(document.createTextNode(wave.name), badge);
            badge.textContent = `${wave.period} дней`;
        }

        const valueEl = row.querySelector('.sun-listItemValue');
        if (valueEl && window.dom && typeof window.dom.getWaveDescription === 'function') {
            valueEl.textContent = window.dom.getWaveDescription(wave.type);
        }

        const titleElHover = titleEl;
        if (titleElHover && window.dom && typeof window.dom.formatWaveHoverTitle === 'function') {
            const note = typeof wave.note === 'string' ? wave.note : '';
            titleElHover.setAttribute(
                'title',
                window.dom.formatWaveHoverTitle(wave.name, wave.period, note)
            );
        }

        const preview = row.querySelector('.sun-waveColorPreviewSmall');
        if (preview) {
            preview.style.backgroundColor = wave.color || '#666666';
        }
    }

    /** Режим редактирования группы сигналов — без полного updateWavesList(). */
    syncGroupListEditingVisuals() {
        const editingId = window.appState.editingGroupId != null ? String(window.appState.editingGroupId) : null;
        const root = window.dom.byKey('wavesList');
        if (!root) return;

        root.querySelectorAll('.sun-listItemGroup').forEach((row) => {
            const idStr = String(row.dataset.id);
            const isEditing = Boolean(editingId && idStr === editingId);
            this.syncListItemEditingClasses(row, isEditing);
            const handle = row.querySelector(':scope > .sun-listItemDragHandle');
            if (handle) {
                handle.setAttribute('draggable', isEditing ? 'false' : 'true');
            }
            const editBtn = row.querySelector('.sun-editBtn[data-type="group"]');
            if (editBtn) {
                if (window.SUN_ACTION_LABELS && window.SUN_ACTION_LABELS.applyToButton) {
                    window.SUN_ACTION_LABELS.applyToButton(editBtn, 'edit', { editing: isEditing });
                }
            }
        });

        if (!editingId) return;

        const group = window.appState.data.groups.find((g) => String(g.id) === editingId);
        if (!group) return;

        const nameInput = window.dom.byKey(`editGroupName${editingId}`);
        if (nameInput) nameInput.value = group.name;
    }

    /** Заголовок группы в списке после сохранения имени. */
    syncGroupListRowNormalViewFromModel(group) {
        const idStr = String(group.id);
        const root = window.dom.byKey('wavesList');
        if (!root) return;

        let row = null;
        root.querySelectorAll('.sun-listItemGroup').forEach((el) => {
            if (String(el.dataset.id) === idStr) row = el;
        });
        if (!row) return;

        const titleEl = row.querySelector('.sun-listItemNormalView .sun-listItemTitle');
        if (titleEl) {
            titleEl.textContent = group.name;
        }
    }
    
    /** Обрабатывает edit click. */
    handleEditClick(id, type, containerId) {
        if (type === 'date') {
            const idStr = String(id);
            const editingDateIdStr = window.appState.editingDateId ? String(window.appState.editingDateId) : null;
            
            window.appState.data.dates.forEach(date => {
                if (String(date.id) === idStr) {
                    window.appState.editingDateId = editingDateIdStr === idStr ? null : id;
                }
            });
            this.updateDatesList();
        } else if (type === 'wave') {
            const idStr = String(id);
            const editingWaveIdStr = window.appState.editingWaveId ? String(window.appState.editingWaveId) : null;
            
            window.appState.data.waves.forEach(wave => {
                if (String(wave.id) === idStr) {
                    window.appState.editingWaveId = editingWaveIdStr === idStr ? null : id;
                }
            });
            this.syncWaveListEditingVisuals();
        } else if (type === 'group') {
            const idStr = String(id);
            const editingGroupIdStr = window.appState.editingGroupId ? String(window.appState.editingGroupId) : null;
            
            window.appState.editingGroupId = editingGroupIdStr === idStr ? null : id;
            this.syncGroupListEditingVisuals();
        } else if (type === 'personGroup') {
            const idStr = String(id);
            const cur = window.appState.editingPersonGroupId ? String(window.appState.editingPersonGroupId) : null;
            window.appState.editingPersonGroupId = cur === idStr ? null : id;
            this.syncPersonGroupListEditingVisuals();
        }
    }
    
    /** Обрабатывает delete click. */
    handleDeleteClick(id, type, containerId) {
        if (type === 'date') {
            window.dates.deleteDate(String(id));
            this.updateDatesList();
        } else if (type === 'wave') {
            window.waves.deleteWave(String(id));
            if (window.displayViewTemplatesManager && window.displayViewTemplatesManager.onWavesStructureChanged) {
                window.displayViewTemplatesManager.onWavesStructureChanged();
            }
            this.updateWavesList();
        } else if (type === 'group') {
            window.dates.deleteGroup(id);
            if (window.displayViewTemplatesManager && window.displayViewTemplatesManager.onWavesStructureChanged) {
                window.displayViewTemplatesManager.onWavesStructureChanged();
            }
            this.updateWavesList();
        } else if (type === 'personGroup') {
            if (window.dates.deletePersonGroup(id)) {
                this.updateDatesList();
            }
        }
    }
    
    /** Обрабатывает save click. */
    handleSaveClick(id, type, containerId) {
        if (type === 'date') {
            this.saveDateChanges(id);
        } else if (type === 'wave') {
            this.saveWaveChanges(String(id));
        } else if (type === 'group') {
            this.saveGroupChanges(id);
        } else if (type === 'personGroup') {
            this.savePersonGroupChanges(id);
        }
    }
    
    /** Обрабатывает cancel click. */
    handleCancelClick(id, type, containerId) {
        if (type === 'date') {
            window.appState.editingDateId = null;
            this.updateDatesList();
        } else if (type === 'wave') {
            window.appState.editingWaveId = null;
            this.syncWaveListEditingVisuals();
        } else if (type === 'group') {
            window.appState.editingGroupId = null;
            this.syncGroupListEditingVisuals();
        } else if (type === 'personGroup') {
            window.appState.editingPersonGroupId = null;
            this.syncPersonGroupListEditingVisuals();
        }
    }
    
    /** Сохраняет date changes. */
    saveDateChanges(dateId) {
        const dateObj = window.appState.data.dates.find(d => String(d.id) === String(dateId));
        if (!dateObj) {
            window.appState.editingDateId = null;
            this.updateDatesList();
            return;
        }
        
        const nameInput = window.dom.byKey(`editDateName${dateId}`);
        const dateInput = window.dom.byKey(`editDateValue${dateId}`);
        const descriptionInput = window.dom.byKey(`editDateDescription${dateId}`);
        const genderSelect = window.dom.byKey(`editDateGender${dateId}`);
        
        if (!nameInput || !dateInput) {
            window.appState.editingDateId = null;
            this.updateDatesList();
            return;
        }
        
        const newName = nameInput.value.trim();
        const newDateValue = dateInput.value;
        
        if (!newName) {
            alert('Пожалуйста, введите название');
            return;
        }
        if (!newDateValue) {
            alert('Пожалуйста, выберите дату');
            return;
        }
        
        try {
            const newDate =
                window.timeUtils && typeof window.timeUtils.parseFromDateAndTimeInputs === 'function'
                    ? window.timeUtils.parseFromDateAndTimeInputs(newDateValue, '')
                    : new Date(newDateValue);
            if (isNaN(newDate.getTime())) {
                throw new Error('Некорректная дата');
            }
            
            dateObj.name = newName;
            dateObj.date = newDate.getTime();
            dateObj.description = descriptionInput ? String(descriptionInput.value) : '';
            dateObj.gender = genderSelect
                ? window.dom.normalizePersonGender(genderSelect.value)
                : window.dom.normalizePersonGender(dateObj.gender);
            
            window.appState.editingDateId = null;
            
            if (String(window.appState.activeDateId) === String(dateId)) {
                window.appState.baseDate = newDate.getTime();
                window.dates.recalculateCurrentDay(false, { skipSave: true });
                window.grid.refreshForCurrentDay();
                window.grid.updateCenterDate();
                window.waves.updatePosition();
                window.grid.updateGridNotesHighlight();
            }
            
            this.updateDatesList();
            window.appState.save();
            this.scheduleFlashListItemSaved('date', dateId);
        } catch (error) {
            alert(`Ошибка при сохранении даты: ${error.message}`);
        }
    }
    
    /** Сохраняет wave changes. */
    saveWaveChanges(waveId) {
        const wave = window.appState.data.waves.find(w => String(w.id) === String(waveId));
        if (!wave) {
            window.appState.editingWaveId = null;
            this.syncWaveListEditingVisuals();
            return;
        }
        
        const newName = window.dom.byKey(`editWaveName${waveId}`).value.trim();
        const newPeriod = parseFloat(window.dom.byKey(`editWavePeriod${waveId}`).value);
        const newType = window.dom.byKey(`editWaveType${waveId}`).value;
        const newColor = window.dom.byKey(`editWaveColor${waveId}`).value;
        const noteInput = window.dom.byKey(`editWaveNote${waveId}`);
        
        if (!newName) {
            alert('Пожалуйста, введите название сигнала');
            return;
        }
        if (!newPeriod || newPeriod < 0.1) {
            alert('Пожалуйста, введите корректный период (больше 0.1)');
            return;
        }
        
        wave.name = newName;
        wave.period = newPeriod;
        wave.type = newType;
        wave.note = noteInput ? String(noteInput.value) : '';
        
        // Проверяем, изменился ли цвет
        if (wave.color !== newColor) {
            wave.color = newColor;
            // Если пользователь явно меняет цвет - снимаем флаг стандартного цвета
            if (wave.isDefaultColor !== undefined) {
                wave.isDefaultColor = false;
            }
        }
        
        // Обновляем отображение на графике
        if (window.waves.wavePaths && window.waves.wavePaths[waveId]) {
            window.waves.wavePaths[waveId].style.stroke = newColor;

            const path = window.waves.wavePaths[waveId];
            path.classList.remove('sun-solid', 'sun-dashed', 'sun-dotted', 'sun-zigzag', 'sun-dashDot', 'sun-longDash');
            if (newType !== 'solid') {
                path.classList.add(window.dom.getWaveStyle(newType));
            }

            const boldOn =
                typeof window.waves.isBoldStrokeVisualEnabled === 'function' &&
                window.waves.isBoldStrokeVisualEnabled() &&
                window.appState.waveBold[waveId];
            path.classList.toggle('sun-bold', !!boldOn);
        }
        if (window.waves.waveBPaths && window.waves.waveBPaths[waveId]) {
            const pathB = window.waves.waveBPaths[waveId];
            pathB.style.stroke = newColor;
            pathB.classList.remove('sun-solid', 'sun-dashed', 'sun-dotted', 'sun-zigzag', 'sun-dashDot', 'sun-longDash');
            if (newType !== 'solid') {
                pathB.classList.add(window.dom.getWaveStyle(newType));
            }
        }
        
        // Пересоздаем элемент волны
        if (window.waves.waveContainers && window.waves.waveContainers[waveId]) {
            window.waves.waveContainers[waveId].remove();
        }
        
        window.waves.createWaveElement(wave);
        
        window.appState.editingWaveId = null;
        this.syncWaveListEditingVisuals();
        this.syncWaveListRowNormalViewFromModel(wave);
        window.waves.updatePosition();
        window.appState.saveDebounced();
        if (window.SecretScheme?.applyCellColors) {
            window.SecretScheme.applyCellColors();
        }
        requestAnimationFrame(() => {
            this.flashListItemSaved('wave', waveId);
        });
    }
    
    /** Сохраняет group changes. */
    saveGroupChanges(groupId) {
        const group = window.appState.data.groups.find(g => String(g.id) === String(groupId));
        if (!group) {
            window.appState.editingGroupId = null;
            this.syncGroupListEditingVisuals();
            return;
        }
        
        const newName = window.dom.byKey(`editGroupName${groupId}`)?.value.trim();
        
        if (!newName) {
            alert('Пожалуйста, введите название группы');
            return;
        }
        
        group.name = newName;
        
        window.appState.editingGroupId = null;
        this.syncGroupListEditingVisuals();
        this.syncGroupListRowNormalViewFromModel(group);
        window.appState.saveDebounced();
        requestAnimationFrame(() => {
            this.flashListItemSaved('group', groupId);
        });
    }

    /** Сохраняет person group changes. */
    savePersonGroupChanges(groupId) {
        const group = window.appState.data.personGroups.find(g => String(g.id) === String(groupId));
        if (!group) {
            window.appState.editingPersonGroupId = null;
            this.syncPersonGroupListEditingVisuals();
            return;
        }
        const el = window.dom.byKey(`editPersonGroupName${groupId}`);
        const newName = el ? el.value.trim() : '';
        if (!newName) {
            alert('Пожалуйста, введите название группы');
            return;
        }
        group.name = newName;
        window.appState.editingPersonGroupId = null;
        this.syncPersonGroupListEditingVisuals();
        this.syncPersonGroupRowNormalViewFromModel(group);
        window.appState.saveDebounced();
        requestAnimationFrame(() => {
            this.flashListItemSaved('personGroup', groupId);
        });
    }
    
    /** Диалог смены цвета волны и save. */
    changeWaveColor(wave) {
        const colorInput = document.createElement('input');
        colorInput.type = 'color';
        colorInput.value = wave.color;
        
        colorInput.addEventListener('change', (e) => {
            const newColor = e.target.value;
            const oldColor = wave.color;
            
            // Обновляем цвет волны
            wave.color = newColor;
            
            // Если это стандартная волна - снимаем флаг стандартного цвета
            if (wave.isDefaultColor !== undefined) {
                wave.isDefaultColor = false;
            }
            
            // Обновляем отображение на графике
            if (window.waves.wavePaths && window.waves.wavePaths[wave.id]) {
                window.waves.wavePaths[wave.id].style.stroke = newColor;
            }

            // ИСПРАВЛЕНИЕ: Найти превью по разным типам ID
            const waveIdStr = String(wave.id);
            document.querySelectorAll(`.sun-waveColorPreviewSmall`).forEach(preview => {
                const previewId = preview.getAttribute('data-id');
                // Сравниваем и как строки, и как числа
                if (String(previewId) === waveIdStr || String(previewId) === String(wave.id)) {
                    preview.style.backgroundColor = newColor;
                }
            });
            
            // Обновляем угловые квадраты если нужно
            const waveIdKey = String(wave.id);
            if (window.appState.waveCornerColor[waveIdKey]) {
                window.waves.updateCornerSquareColors();
            }
            
            window.appState.save();

            if (window.SecretScheme?.applyCellColors) {
                window.SecretScheme.applyCellColors();
            }
            
            // Обновляем список волн
            this.updateWavesList();
            
            // Показываем уведомление об изменении цвета
            console.log(`Цвет сигнала "${wave.name}" изменен с ${oldColor} на ${newColor}`);
        });
        
        colorInput.click();
    }

    /**
     * Сохраняет скролл списка дат и вложенных .sun-personGroupChildren до полной перерисовки EJS.
     */
    _captureDateListScrollState() {
        const root = window.dom.byKey('dateListForDates');
        if (!root) {
            return null;
        }
        const nested = [];
        root.querySelectorAll('.sun-listItemPersonGroup').forEach((row) => {
            const gid = row.getAttribute('data-id');
            if (!gid) {
                return;
            }
            const ch = row.querySelector('.sun-personGroupChildren');
            if (ch) {
                nested.push({ groupId: gid, top: ch.scrollTop });
            }
        });
        return {
            rootTop: root.scrollTop,
            rootLeft: root.scrollLeft,
            nested
        };
    }

    /**
     * Восстанавливает скролл после renderList; два rAF — после расчёта вёрстки.
     */
    _restoreDateListScrollState(state) {
        if (!state) {
            return;
        }
        const root = window.dom.byKey('dateListForDates');
        if (!root) {
            return;
        }
        const apply = () => {
            const maxRoot = Math.max(0, root.scrollHeight - root.clientHeight);
            root.scrollTop = Math.min(state.rootTop, maxRoot);
            root.scrollLeft = state.rootLeft;
            const rows = root.querySelectorAll('.sun-listItemPersonGroup');
            for (let n = 0; n < state.nested.length; n++) {
                const { groupId, top } = state.nested[n];
                for (let i = 0; i < rows.length; i++) {
                    const row = rows[i];
                    if (row.getAttribute('data-id') === groupId) {
                        const ch = row.querySelector('.sun-personGroupChildren');
                        if (ch) {
                            const maxN = Math.max(0, ch.scrollHeight - ch.clientHeight);
                            ch.scrollTop = Math.min(top, maxN);
                        }
                        break;
                    }
                }
            }
        };
        requestAnimationFrame(() => {
            apply();
            requestAnimationFrame(apply);
        });
    }
    
    /**
     * @param {{ forceFull?: boolean }} [opts]
     */
    updateDatesList(opts) {
        if (window.dates && window.dates.syncPersonGroupsLayout) {
            window.dates.syncPersonGroupsLayout();
        }
        const sig = this._computeDatesListStructureSignature();
        const forceFull = opts && opts.forceFull === true;
        const structureUnchanged =
            this._datesListStructureSig !== null && this._datesListStructureSig === sig;

        const rootProbe = window.dom.byKey('dateListForDates');
        const dateRowCount = rootProbe
            ? rootProbe.querySelectorAll('.sun-listItemDate[data-type="date"]').length
            : 0;
        const dataDatesLen = (window.appState.data.dates || []).length;
        const canPatch = this._canPatchDateListDom();
        const usePatch = !forceFull && structureUnchanged && canPatch;
        window.sunDateListLog && window.sunDateListLog('updateDatesList', {
            path: usePatch ? 'patch' : 'full',
            forceFull,
            structureUnchanged,
            canPatch,
            dateRowCount,
            dataDatesLen,
            editingDateId: window.appState.editingDateId,
            editingPersonGroupId: window.appState.editingPersonGroupId
        });

        if (usePatch) {
            this.syncDateListSelectionVisuals();
        } else {
            const pg = window.appState.data.personGroups || [];
            const allGroups = pg.map((g, idx) => this.preparePersonGroupData(g, idx));
            const scrollState = this._captureDateListScrollState();
            this.renderList('dateListForDates', allGroups, 'personGroup');

            const root = window.dom.byKey('dateListForDates');
            if (
                root &&
                (root.querySelector('.sun-listItemPersonGroup') ||
                    (allGroups.length === 0 && root.querySelector('.sun-listEmpty')))
            ) {
                this._datesListStructureSig = sig;
            }

            this._restoreDateListScrollState(scrollState);
        }

        if (window.dateComparisonManager && window.dateComparisonManager.ensureSelectsSyncedWithDateList) {
            window.dateComparisonManager.ensureSelectsSyncedWithDateList();
        }
        if (window.dateComparisonManager && window.dateComparisonManager.updateComparison) {
            window.dateComparisonManager.updateComparison();
        }
        if (window.waves && typeof window.waves.updatePosition === 'function') {
            window.waves.updatePosition();
        }
        if (window.dataManager && typeof window.dataManager.refreshStateSearchPersonSelects === 'function') {
            window.dataManager.refreshStateSearchPersonSelects();
        }
    }


    /** Обновляет waves list. */
    updateWavesList() {
        const wrd = window.__waveRenderDebug;
        const end = wrd && wrd.isEnabled && wrd.isEnabled() ? wrd.t('unifiedListManager.updateWavesList', {}) : null;
        let endDetail = { skipped: true };
        try {
            const container = window.dom.byKey('wavesList');
            if (!container) {
                wrd && wrd.log('unifiedListManager.updateWavesList.skip', { reason: 'noContainer' });
                endDetail = { skipped: true, reason: 'noContainer' };
                return;
            }
            
            const visibleGroups = window.appState.data.groups.filter(group => !group.hidden);
            const lookups = this.buildWaveListLookups();
            
            const allGroups = visibleGroups.map((group) => {
                const idStr = String(group.id);
                const fullIndex = lookups.groupIndexById.has(idStr)
                    ? lookups.groupIndexById.get(idStr)
                    : window.appState.data.groups.findIndex(g => String(g.id) === idStr);
                const groupData = this.prepareGroupData(
                    group,
                    fullIndex !== undefined && fullIndex >= 0 ? fullIndex : 0,
                    lookups
                );
                return groupData;
            });
            
            this.renderList('wavesList', allGroups, 'group');
            endDetail = {
                skipped: false,
                groupCount: allGroups.length,
                waveCount: window.appState.data.waves.length
            };
        } catch (e) {
            endDetail = { error: String(e && e.message) };
            throw e;
        } finally {
            end && end(endDetail);
        }
    }

    /**
     * Чекбоксы «группа вкл», «видимость A» (.sun-waveVisibilityCheck) и «видимость B» (.sun-waveBVisibilityCheck) из appState без полного EJS.
     * Используется при переключении шаблонов отображения (порядок десятков мс вместо сотен на длинных списках).
     * @returns {boolean} false, если контейнера списка нет
     */
    syncWavesListVisibilityFromAppState() {
        const root = window.dom.byKey('wavesList');
        if (!root) {
            return false;
        }

        root.querySelectorAll('.sun-listItemGroup[data-type="group"]').forEach((row) => {
            const gid = String(row.dataset.id);
            const group = (window.appState.data.groups || []).find((g) => String(g.id) === gid);
            if (!group) return;
            const toggle = row.querySelector('.sun-waveGroupToggle');
            if (toggle) {
                toggle.checked = !!group.enabled;
            }
        });

        root.querySelectorAll('.sun-waveVisibilityCheck').forEach((cb) => {
            const wid = String(cb.dataset.id);
            if (!wid) return;
            cb.checked = window.appState.waveVisibility[wid] !== false;
        });

        root.querySelectorAll('.sun-waveBVisibilityCheck').forEach((cb) => {
            const wid = String(cb.dataset.id);
            if (!wid) return;
            cb.checked = window.appState.waveBold[wid] === true;
        });

        (window.appState.data.groups || []).forEach((g) => {
            if (!g.hidden) {
                this.updateGroupStats(g.id);
            }
        });

        if (window.dom && window.dom.refreshShowOnVizorButtonLabels) {
            window.dom.refreshShowOnVizorButtonLabels();
        }

        return true;
    }

    /**
     * Только порядок групп в списке: переставить существующие DOM-узлы (без EJS).
     * Возвращает false, если разметка не совпадает с ожидаемым числом видимых групп — тогда нужен updateWavesList().
     */
    reorderGroupsInWavesListDom() {
        const container = window.dom.byKey('wavesList');
        if (!container) return false;

        const visibleGroups = window.appState.data.groups.filter((g) => !g.hidden);
        const rows = Array.from(container.children).filter(
            (el) => el.classList && el.classList.contains('sun-listItemGroup')
        );

        if (visibleGroups.length === 0) {
            return rows.length === 0;
        }
        if (rows.length !== visibleGroups.length) {
            return false;
        }

        const byId = new Map();
        for (const el of rows) {
            byId.set(String(el.dataset.id), el);
        }

        for (let i = 0; i < visibleGroups.length; i++) {
            if (!byId.has(String(visibleGroups[i].id))) {
                return false;
            }
        }

        const frag = document.createDocumentFragment();
        for (let i = 0; i < visibleGroups.length; i++) {
            frag.appendChild(byId.get(String(visibleGroups[i].id)));
        }
        container.appendChild(frag);

        container.querySelectorAll(':scope > .sun-listItemGroup').forEach((el) => {
            const idStr = String(el.dataset.id);
            const fullIdx = window.appState.data.groups.findIndex((g) => String(g.id) === idStr);
            if (fullIdx >= 0) {
                el.setAttribute('data-index', String(fullIdx));
            }
        });

        return true;
    }

    /** Внутренний метод findSignalGroupRow. */
    _findSignalGroupRow(wavesRoot, groupId) {
        const idStr = String(groupId);
        let found = null;
        wavesRoot.querySelectorAll('.sun-listItemGroup').forEach((el) => {
            if (String(el.dataset.type) !== 'group') return;
            if (String(el.dataset.id) === idStr) found = el;
        });
        return found;
    }

    /** Внутренний метод findWaveRowInWavesList. */
    _findWaveRowInWavesList(wavesRoot, waveId) {
        const w = String(waveId);
        let found = null;
        wavesRoot.querySelectorAll('.sun-listItemWave').forEach((el) => {
            const id = String(el.dataset.waveId != null ? el.dataset.waveId : el.dataset.id);
            if (id === w) found = el;
        });
        return found;
    }

    /** Внутренний метод ensureEmptySignalGroupChildrenMessage. */
    _ensureEmptySignalGroupChildrenMessage(container) {
        if (container.querySelector('.sun-noWavesMessage')) return;
        const div = document.createElement('div');
        div.className = 'sun-noWavesMessage';
        div.innerHTML =
            '<span style="color: #999; font-style: italic; font-size: 11px; padding: 10px;">Нет сигналов в этой группе</span>';
        container.appendChild(div);
    }

    /** Внутренний метод removeEmptyPlaceholders. */
    _removeEmptyPlaceholders(container) {
        container.querySelectorAll(':scope > .sun-noWavesMessage').forEach((n) => n.remove());
    }

    /**
     * Синхронизировать .sun-groupChildren одной группы сигналов с appState (перестановка / перенос колоска без EJS).
     * Сначала обычно вызывают для целевой группы, затем для исходной (перенос между группами).
     */
    syncOneSignalGroupChildrenDom(groupId) {
        const wavesRoot = window.dom.byKey('wavesList');
        if (!wavesRoot) return false;

        const group = window.appState.data.groups.find((g) => String(g.id) === String(groupId));
        if (!group || !Array.isArray(group.waves)) return false;

        const groupEl = this._findSignalGroupRow(wavesRoot, groupId);
        if (!groupEl) return false;

        const container = groupEl.querySelector('.sun-groupChildren');
        if (!container) return false;

        const desired = group.waves.map(String);
        const byId = new Map();

        for (const wid of desired) {
            let row = null;
            Array.from(container.querySelectorAll(':scope > .sun-listItemWave')).forEach((el) => {
                const id = String(el.dataset.waveId != null ? el.dataset.waveId : el.dataset.id);
                if (id === wid) row = el;
            });
            if (!row) {
                row = this._findWaveRowInWavesList(wavesRoot, wid);
            }
            if (!row) return false;
            byId.set(wid, row);
        }

        this._removeEmptyPlaceholders(container);

        const frag = document.createDocumentFragment();
        desired.forEach((wid) => {
            frag.appendChild(byId.get(wid));
        });
        container.appendChild(frag);

        if (desired.length === 0) {
            this._ensureEmptySignalGroupChildrenMessage(container);
        }

        Array.from(container.querySelectorAll(':scope > .sun-listItemWave')).forEach((row, i) => {
            row.setAttribute('data-index', String(i));
        });

        return true;
    }

    /** Внутренний метод findPersonGroupRow. */
    _findPersonGroupRow(dateRoot, personGroupId) {
        const idStr = String(personGroupId);
        let found = null;
        dateRoot.querySelectorAll('.sun-listItemPersonGroup').forEach((el) => {
            if (String(el.dataset.id) === idStr) found = el;
        });
        return found;
    }

    /** Внутренний метод findDateRowInDateList. */
    _findDateRowInDateList(dateRoot, dateId) {
        const d = String(dateId);
        let found = null;
        dateRoot.querySelectorAll('.sun-listItemDate').forEach((el) => {
            if (String(el.dataset.id) === d) found = el;
        });
        return found;
    }

    /** Внутренний метод ensureEmptyPersonGroupChildrenMessage. */
    _ensureEmptyPersonGroupChildrenMessage(container) {
        if (container.querySelector('.sun-noWavesMessage')) return;
        const div = document.createElement('div');
        div.className = 'sun-noWavesMessage';
        div.innerHTML =
            '<span style="color: #999; font-style: italic; font-size: 11px; padding: 10px;">Нет персон в этой группе</span>';
        container.appendChild(div);
    }

    /**
     * Порядок групп персон в #dateListForDates по appState.data.personGroups (без EJS).
     */
    reorderPersonGroupsInDateListDom() {
        const container = window.dom.byKey('dateListForDates');
        if (!container) return false;

        const pg = window.appState.data.personGroups || [];
        const rows = Array.from(container.children).filter(
            (el) => el.classList && el.classList.contains('sun-listItemPersonGroup')
        );

        if (pg.length === 0) {
            return rows.length === 0;
        }
        if (rows.length !== pg.length) {
            return false;
        }

        const byId = new Map();
        for (const el of rows) {
            byId.set(String(el.dataset.id), el);
        }

        for (let i = 0; i < pg.length; i++) {
            if (!byId.has(String(pg[i].id))) {
                return false;
            }
        }

        const frag = document.createDocumentFragment();
        for (let i = 0; i < pg.length; i++) {
            frag.appendChild(byId.get(String(pg[i].id)));
        }
        container.appendChild(frag);

        container.querySelectorAll(':scope > .sun-listItemPersonGroup').forEach((el) => {
            const idStr = String(el.dataset.id);
            const fullIdx = pg.findIndex((g) => String(g.id) === idStr);
            if (fullIdx >= 0) {
                el.setAttribute('data-index', String(fullIdx));
            }
        });

        return true;
    }

    /** Синхронизирует one person group children dom. */
    syncOnePersonGroupChildrenDom(personGroupId) {
        const dateRoot = window.dom.byKey('dateListForDates');
        if (!dateRoot) return false;

        const pg = (window.appState.data.personGroups || []).find((g) => String(g.id) === String(personGroupId));
        if (!pg || !Array.isArray(pg.dates)) return false;

        const groupEl = this._findPersonGroupRow(dateRoot, personGroupId);
        if (!groupEl) return false;

        const container = groupEl.querySelector('.sun-personGroupChildren');
        if (!container) return false;

        const desired = pg.dates.map(String);
        const byId = new Map();

        for (const did of desired) {
            let row = null;
            Array.from(container.querySelectorAll(':scope > .sun-listItemDate')).forEach((el) => {
                if (String(el.dataset.id) === did) row = el;
            });
            if (!row) {
                row = this._findDateRowInDateList(dateRoot, did);
            }
            if (!row) return false;
            byId.set(did, row);
        }

        this._removeEmptyPlaceholders(container);

        const frag = document.createDocumentFragment();
        desired.forEach((did) => {
            const row = byId.get(did);
            row.setAttribute('data-person-group-id', String(personGroupId));
            const dateObj = window.appState.data.dates.find((d) => String(d.id) === String(did));
            if (dateObj) {
                this._syncDateRowDisplayFromAppState(row, dateObj);
            }
            frag.appendChild(row);
        });
        container.appendChild(frag);

        if (desired.length === 0) {
            this._ensureEmptyPersonGroupChildrenMessage(container);
        }

        Array.from(container.querySelectorAll(':scope > .sun-listItemDate')).forEach((row, i) => {
            row.setAttribute('data-index', String(i));
        });

        return true;
    }

    /** Режим редактирования группы персон — без полного updateDatesList(). */
    syncPersonGroupListEditingVisuals() {
        const editingId =
            window.appState.editingPersonGroupId != null ? String(window.appState.editingPersonGroupId) : null;
        const root = window.dom.byKey('dateListForDates');
        if (!root) return;

        root.querySelectorAll('.sun-listItemPersonGroup').forEach((row) => {
            const idStr = String(row.dataset.id);
            const isEditing = Boolean(editingId && idStr === editingId);
            this.syncListItemEditingClasses(row, isEditing);
            const handle = row.querySelector(':scope > .sun-listItemDragHandle');
            if (handle) {
                handle.setAttribute('draggable', isEditing ? 'false' : 'true');
            }
            const editBtn = row.querySelector('.sun-editBtn[data-type="personGroup"]');
            if (editBtn) {
                if (window.SUN_ACTION_LABELS && window.SUN_ACTION_LABELS.applyToButton) {
                    window.SUN_ACTION_LABELS.applyToButton(editBtn, 'edit', { editing: isEditing });
                }
            }
        });

        if (!editingId) return;

        const group = (window.appState.data.personGroups || []).find((g) => String(g.id) === editingId);
        if (!group) return;

        const nameInput = window.dom.byKey(`editPersonGroupName${editingId}`);
        if (nameInput) nameInput.value = group.name;
    }

    /** Синхронизирует person group row normal view from model. */
    syncPersonGroupRowNormalViewFromModel(group) {
        const idStr = String(group.id);
        const root = window.dom.byKey('dateListForDates');
        if (!root) return;

        let row = null;
        root.querySelectorAll('.sun-listItemPersonGroup').forEach((el) => {
            if (String(el.dataset.id) === idStr) row = el;
        });
        if (!row) return;

        const titleEl = row.querySelector('.sun-listItemNormalView .sun-listItemTitle');
        if (titleEl) {
            titleEl.textContent = group.name;
        }

        const countEl = row.querySelector('.sun-listItemValue .sun-groupTotalCount');
        if (countEl && Array.isArray(group.dates)) {
            countEl.textContent = `Персон: ${group.dates.length}`;
        }
    }

    /** Обновить счётчики «Персон: N» у всех групп персон (после DnD без полного рендера). */
    syncAllPersonGroupDateCountsFromModel() {
        const root = window.dom.byKey('dateListForDates');
        if (!root) return;
        const pg = window.appState.data.personGroups || [];
        for (let i = 0; i < pg.length; i++) {
            const g = pg[i];
            const row = this._findPersonGroupRow(root, g.id);
            if (!row) continue;
            const countEl = row.querySelector('.sun-listItemValue .sun-groupTotalCount');
            if (countEl && Array.isArray(g.dates)) {
                countEl.textContent = `Персон: ${g.dates.length}`;
            }
        }
    }
    
    /** Обновляет intersection results. */
    updateIntersectionResults(intersections) {
        this.renderList('intersectionResults', intersections, 'intersection');
    }
    
    /** Обновляет group stats. */
    updateGroupStats(groupId) {
        const group = window.appState.data.groups.find(g => String(g.id) === String(groupId));
        if (!group) {
            return;
        }
        
        const groupElement = document.querySelector(`.sun-listItemGroup[data-id="${groupId}"]`);
        if (!groupElement) {
            return;
        }
        
        let enabledCountA = 0;
        let enabledCountB = 0;
        const waveCount = group.waves ? group.waves.length : 0;
        
        if (group.waves && Array.isArray(group.waves)) {
            group.waves.forEach(waveId => {
                const waveIdStr = String(waveId);
                if (window.appState.waveVisibility[waveIdStr] !== false) {
                    enabledCountA++;
                }
                if (window.appState.waveBold[waveIdStr] === true) {
                    enabledCountB++;
                }
            });
        }
        
        const statsElement = groupElement.querySelector('.sun-listItemValue .sun-groupStats');
        if (statsElement) {
            const parts = [
                `<span class="sun-groupStatTotal" title="Отключить все слои (A и B) у всех сигналов группы">Всего: ${waveCount}</span>`
            ];
            if (enabledCountA > 0) {
                parts.push(
                    `<span class="sun-groupStatA" title="Отключить слой A у всех сигналов группы">Включено: ${enabledCountA}</span>`
                );
            }
            if (enabledCountB > 0) {
                parts.push(
                    `<span class="sun-groupStatB" title="Отключить слой B у всех сигналов группы">Включено: ${enabledCountB}</span>`
                );
            }
            statsElement.innerHTML = parts.join('');
        }
    }
    
    /** Перезагрузка EJS-шаблонов из templates/. */
    async reloadTemplates() {
        this.invalidateEjsRenderers();
        this.templatesLoaded = false;
        this.templatesLoadPromise = null;
        await this.initTemplates();
    }
}

window.unifiedListManager = new UnifiedListManager();