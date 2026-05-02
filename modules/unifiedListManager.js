// modules/unifiedListManager.js
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

    invalidateEjsRenderers() {
        this._ejsRenderers = {};
        this._datesListStructureSig = null;
        if (window.dateComparisonManager && window.dateComparisonManager.invalidateDateListSignatureCache) {
            window.dateComparisonManager.invalidateDateListSignatureCache();
        }
    }

    invalidateDatesListStructureCache() {
        this._datesListStructureSig = null;
        if (window.dateComparisonManager && window.dateComparisonManager.invalidateDateListSignatureCache) {
            window.dateComparisonManager.invalidateDateListSignatureCache();
        }
    }

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

    _canPatchDateListDom() {
        if (window.appState.editingDateId != null || window.appState.editingPersonGroupId != null) {
            return false;
        }
        const root = document.getElementById('dateListForDates');
        if (!root) {
            return false;
        }
        if (root.querySelector('.list-empty') && root.textContent && root.textContent.indexOf('Загрузка') !== -1) {
            return false;
        }
        const dateRows = root.querySelectorAll('.list-item--date[data-type="date"]');
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
        const groupRows = root.querySelectorAll('.list-item--person-group');
        const pg = window.appState.data.personGroups || [];
        if (groupRows.length !== pg.length) {
            return false;
        }
        return true;
    }

    /**
     * Только активная дата и чекбоксы A/B — без перерисовки списка (скролл не сбрасывается).
     * Подсветка A/B на строке — через CSS :has(:checked), классы на строке не ставим.
     * Чекбоксы — по всем input.date-checkbox в контейнере (надёжнее, чем поиск от строки).
     */
    syncDateListSelectionVisuals() {
        const root = document.getElementById('dateListForDates');
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

        const rows = root.querySelectorAll('.list-item--date[data-type="date"]');
        window.sunDateListLog && window.sunDateListLog('syncDateListSelectionVisuals:start', {
            rowCount: rows.length,
            activeIdStr,
            typeAStr,
            typeBStr,
            dateSelections: { ...ds }
        });

        rows.forEach((row) => {
            const id = row.getAttribute('data-id');
            if (!id) {
                return;
            }
            const idStr = String(id);
            const isEditing = editingDateIdStr !== '' && idStr === editingDateIdStr;
            row.classList.toggle('list-item--editing', isEditing);
            row.classList.toggle('active', idStr === activeIdStr);

            const dhandle = row.querySelector('.date-drag-handle');
            if (dhandle) {
                dhandle.setAttribute('draggable', isEditing ? 'false' : 'true');
            }
        });

        root.querySelectorAll('input.date-checkbox').forEach((inp) => {
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

        const snap = [];
        root.querySelectorAll('input.date-checkbox').forEach((inp) => {
            const idStr = String(inp.getAttribute('data-id') || '');
            const t = inp.getAttribute('data-type');
            const wantA = t === 'a' && typeAStr !== '' && idStr === typeAStr;
            const wantB = t === 'b' && typeBStr !== '' && idStr === typeBStr;
            if (
                wantA ||
                wantB ||
                idStr === activeIdStr ||
                inp.checked
            ) {
                snap.push({
                    id: idStr,
                    t,
                    want: t === 'a' ? wantA : wantB,
                    chk: inp.checked
                });
            }
        });
        window.sunDateListLog && window.sunDateListLog('syncDateListSelectionVisuals:applied', { snap });
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
    
    initTemplates() {
        if (this.templatesLoaded) {
            return Promise.resolve();
        }
        
        if (this.templatesLoadPromise) {
            return this.templatesLoadPromise;
        }
        
        this.templatesLoadPromise = new Promise(async (resolve, reject) => {
            try {
                const templateIds = ['date-item-template', 'wave-item-template', 'group-item-template', 'person-group-item-template', 'intersection-item-template'];
                let loadedCount = 0;
                
                const loadPromises = templateIds.map(async (templateId) => {
                    try {
                        const url = `templates/${templateId.replace('-template', '')}.ejs`;
                        
                        const response = await fetch(url);
                        
                        if (response.ok) {
                            const templateText = await response.text();
                            this.templateCache[templateId] = templateText;
                            loadedCount++;
                        }
                    } catch (error) {
                    }
                });
                
                await Promise.allSettled(loadPromises);
                
                this.templatesLoaded = true;
                resolve();
                
            } catch (error) {
                this.templatesLoaded = true;
                resolve();
            }
        });
        
        return this.templatesLoadPromise;
    }
    
    createEmergencyFallbackTemplates() {
        this.templateCache['date-item-template'] = `
<div class="list-item list-item--date" style="background:#ffe6e6;border:2px solid red;">
    <div class="list-item__content">
        <div style="color:red;padding:10px;">
            ❌ ОШИБКА: Шаблон не загружен!<br>
            Проверьте файл templates/date-item.ejs
        </div>
    </div>
</div>`;
        
        this.templateCache['wave-item-template'] = `
<div class="list-item list-item--wave" style="background:#ffe6e6;border:2px solid red;">
    <div class="list-item__content">
        <div style="color:red;padding:10px;">
            ❌ ОШИБКА: Шаблон не загружен!<br>
            Проверьте файл templates/wave-item.ejs
        </div>
    </div>
</div>`;
        
        this.templateCache['group-item-template'] = `
<div class="list-item list-item--group" style="background:#ffe6e6;border:2px solid red;">
    <div class="list-item__content">
        <div style="color:red;padding:10px;">
            ❌ ОШИБКА: Шаблон не загружен!<br>
            Проверьте файл templates/group-item.ejs
        </div>
    </div>
</div>`;
        
        this.templateCache['person-group-item-template'] = `
<div class="list-item list-item--person-group" style="background:#ffe6e6;border:2px solid red;">
    <div class="list-item__content"><div style="color:red;padding:10px;">Шаблон person-group-item.ejs не загружен</div></div>
</div>`;
        
        this.templateCache['intersection-item-template'] = `
<div class="intersection-item" style="background:#ffe6e6;border:2px solid red;">
    <div style="color:red;padding:10px;">
        ❌ ОШИБКА: Шаблон пересечений не загружен!
    </div>
</div>`;
    }
    
    async renderListWithWait(containerId, items, itemType) {
        if (!this.templatesLoaded) {
            try {
                await this.initTemplates();
            } catch (error) {
            }
        }
        
        return this.renderList(containerId, items, itemType);
    }
    
    getTemplate(templateId) {
        if (this.templateCache[templateId]) {
            return this.templateCache[templateId];
        }
        
        return '<div class="list-item">Элемент списка</div>';
    }
    
    log(...args) {
        if (this.debug) {
            console.log('[UnifiedListManager]', ...args);
        }
    }
    


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
        
        return {
            id: dateObj.id,
            name: dateObj.name,
            type: 'date',
            personGroupId: personGroupId != null ? personGroupId : null,
            formattedDate: window.dom.formatDate(dateObj.date),
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
                children: [],
                expanded: false,
                enabled: false,
                editing: false
            };
        }
        
        const existingWaves = [];
        let enabledCount = 0;
        
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
                        enabledCount++;
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
            enabledCount: enabledCount,
            enabled: originalGroup.enabled !== undefined ? originalGroup.enabled : false,
            expanded: originalGroup.expanded !== undefined ? originalGroup.expanded : false,
            children: childrenData,
            index: index,
            editing: editingGroupIdStr === groupIdStr
        };
    }

    // В методе prepareWaveData - ДОБАВИТЬ в возвращаемый объект
    prepareWaveData(wave, index) {
        const waveIdStr = String(wave.id);
        const editingWaveIdStr = window.appState.editingWaveId ? String(window.appState.editingWaveId) : null;
        
        return {
            id: wave.id,
            name: wave.name,
            type: 'wave',
            period: wave.period,
            color: wave.color,
            typeValue: wave.type,
            description: window.dom.getWaveDescription(wave.type),
            visible: window.appState.waveVisibility[waveIdStr] !== false,
            // UI: вторая персона B; ключ в состоянии по истории — waveBold
            bold: window.appState.waveBold[waveIdStr] || false,
            cornerColor: window.appState.waveCornerColor[waveIdStr] || false,
            editing: editingWaveIdStr === waveIdStr,
            index: index,
            // parentGroupId будет добавлен в prepareGroupData
        };
    }
    
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
    
    renderList(containerId, items, itemType) {
        const __perfT0 = typeof performance !== 'undefined' ? performance.now() : 0;
        try {
        const container = document.getElementById(containerId);
        if (!container) {
            return;
        }
        
        if (!this.templatesLoaded) {
            container.innerHTML = '<div class="list-empty">Загрузка шаблонов...</div>';

            void this.initTemplates().then(() => {
                this.renderList(containerId, items, itemType);
            });
            return;
        }
        
        container.innerHTML = '';
        
        if (!items || items.length === 0) {
            const emptyMessage = document.createElement('div');
            emptyMessage.className = 'list-empty';
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
                                ? groupElement.querySelector('.group-children')
                                : null;
                            if (childrenContainer) {
                                childrenContainer.innerHTML = wavesHtml;
                                if (groupData.expanded) {
                                    childrenContainer.style.display = 'block';
                                    groupElement.classList.add('list-item--expanded');
                                } else {
                                    childrenContainer.style.display = 'none';
                                    groupElement.classList.remove('list-item--expanded');
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
                    const childrenContainer = groupElement.querySelector('.person-group-children');
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
                            groupElement.classList.add('list-item--expanded');
                        } else {
                            childrenContainer.style.display = 'none';
                            groupElement.classList.remove('list-item--expanded');
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
     * Режим редактирования волны: класс list-item--editing и поля формы уже в разметке —
     * переключаем без полного EJS updateWavesList() (сотни мс на больших списках).
     */
    syncWaveListEditingVisuals() {
        const editingId = window.appState.editingWaveId != null ? String(window.appState.editingWaveId) : null;
        const root = document.getElementById('wavesList');
        if (!root) return;

        root.querySelectorAll('.list-item--wave').forEach((row) => {
            const idStr = row.dataset.waveId != null ? String(row.dataset.waveId) : String(row.dataset.id);
            const isEditing = Boolean(editingId && idStr === editingId);
            row.classList.toggle('list-item--editing', isEditing);
            const handle = row.querySelector('.wave-drag-handle');
            if (handle) {
                handle.setAttribute('draggable', isEditing ? 'false' : 'true');
            }
        });

        if (!editingId) return;

        const wave = window.appState.data.waves.find((w) => String(w.id) === editingId);
        if (!wave) return;

        const nameInput = document.getElementById(`editWaveName${editingId}`);
        const periodInput = document.getElementById(`editWavePeriod${editingId}`);
        const typeInput = document.getElementById(`editWaveType${editingId}`);
        const colorInput = document.getElementById(`editWaveColor${editingId}`);
        if (nameInput) nameInput.value = wave.name;
        if (periodInput) periodInput.value = wave.period;
        if (typeInput) typeInput.value = wave.type;
        if (colorInput) colorInput.value = wave.color || '#666666';
    }

    /** Строка списка после сохранения формы: название, период, описание типа, превью цвета. */
    syncWaveListRowNormalViewFromModel(wave) {
        const idStr = String(wave.id);
        const root = document.getElementById('wavesList');
        if (!root) return;

        let row = null;
        root.querySelectorAll('.list-item--wave').forEach((el) => {
            const rid = el.dataset.waveId != null ? String(el.dataset.waveId) : String(el.dataset.id);
            if (rid === idStr) row = el;
        });
        if (!row) return;

        const titleEl = row.querySelector('.list-item__title');
        const badge = titleEl && titleEl.querySelector('.wave-period-badge');
        if (titleEl && badge) {
            while (titleEl.firstChild && titleEl.firstChild !== badge) {
                titleEl.removeChild(titleEl.firstChild);
            }
            titleEl.insertBefore(document.createTextNode(wave.name), badge);
            badge.textContent = `${wave.period} дней`;
        }

        const valueEl = row.querySelector('.list-item__value');
        if (valueEl && window.dom && typeof window.dom.getWaveDescription === 'function') {
            valueEl.textContent = window.dom.getWaveDescription(wave.type);
        }

        const preview = row.querySelector('.wave-color-preview-small');
        if (preview) {
            preview.style.backgroundColor = wave.color || '#666666';
        }
    }

    /** Режим редактирования группы сигналов — без полного updateWavesList(). */
    syncGroupListEditingVisuals() {
        const editingId = window.appState.editingGroupId != null ? String(window.appState.editingGroupId) : null;
        const root = document.getElementById('wavesList');
        if (!root) return;

        root.querySelectorAll('.list-item--group').forEach((row) => {
            const idStr = String(row.dataset.id);
            const isEditing = Boolean(editingId && idStr === editingId);
            row.classList.toggle('list-item--editing', isEditing);
            const handle = row.querySelector(':scope > .list-item__drag-handle');
            if (handle) {
                handle.setAttribute('draggable', isEditing ? 'false' : 'true');
            }
            const editBtn = row.querySelector('.edit-btn[data-type="group"]');
            if (editBtn) {
                editBtn.textContent = isEditing ? 'Редактирование...' : 'Изменить';
            }
        });

        if (!editingId) return;

        const group = window.appState.data.groups.find((g) => String(g.id) === editingId);
        if (!group) return;

        const nameInput = document.getElementById(`editGroupName${editingId}`);
        if (nameInput) nameInput.value = group.name;
    }

    /** Заголовок группы в списке после сохранения имени. */
    syncGroupListRowNormalViewFromModel(group) {
        const idStr = String(group.id);
        const root = document.getElementById('wavesList');
        if (!root) return;

        let row = null;
        root.querySelectorAll('.list-item--group').forEach((el) => {
            if (String(el.dataset.id) === idStr) row = el;
        });
        if (!row) return;

        const titleEl = row.querySelector('.list-item__normal-view .list-item__title');
        if (titleEl) {
            titleEl.textContent = group.name;
        }
    }
    
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
    
    saveDateChanges(dateId) {
        const dateObj = window.appState.data.dates.find(d => String(d.id) === String(dateId));
        if (!dateObj) {
            window.appState.editingDateId = null;
            this.updateDatesList();
            return;
        }
        
        const nameInput = document.getElementById(`editDateName${dateId}`);
        const dateInput = document.getElementById(`editDateValue${dateId}`);
        
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
            const newDate = new Date(newDateValue);
            if (isNaN(newDate.getTime())) {
                throw new Error('Некорректная дата');
            }
            
            dateObj.name = newName;
            dateObj.date = newDate.getTime();
            
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
        } catch (error) {
            alert(`Ошибка при сохранении даты: ${error.message}`);
        }
    }
    
    saveWaveChanges(waveId) {
        const wave = window.appState.data.waves.find(w => String(w.id) === String(waveId));
        if (!wave) {
            window.appState.editingWaveId = null;
            this.syncWaveListEditingVisuals();
            return;
        }
        
        const newName = document.getElementById(`editWaveName${waveId}`).value.trim();
        const newPeriod = parseFloat(document.getElementById(`editWavePeriod${waveId}`).value);
        const newType = document.getElementById(`editWaveType${waveId}`).value;
        const newColor = document.getElementById(`editWaveColor${waveId}`).value;
        
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
            path.classList.remove('solid', 'dashed', 'dotted', 'zigzag', 'dash-dot', 'long-dash');
            if (newType !== 'solid') {
                path.classList.add(newType);
            }

            const boldOn =
                typeof window.waves.isBoldStrokeVisualEnabled === 'function' &&
                window.waves.isBoldStrokeVisualEnabled() &&
                window.appState.waveBold[waveId];
            path.classList.toggle('bold', !!boldOn);
        }
        if (window.waves.waveBPaths && window.waves.waveBPaths[waveId]) {
            const pathB = window.waves.waveBPaths[waveId];
            pathB.style.stroke = newColor;
            pathB.classList.remove('solid', 'dashed', 'dotted', 'zigzag', 'dash-dot', 'long-dash');
            if (newType !== 'solid') {
                pathB.classList.add(newType);
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
    }
    
    saveGroupChanges(groupId) {
        const group = window.appState.data.groups.find(g => String(g.id) === String(groupId));
        if (!group) {
            window.appState.editingGroupId = null;
            this.syncGroupListEditingVisuals();
            return;
        }
        
        const newName = document.getElementById(`editGroupName${groupId}`)?.value.trim();
        
        if (!newName) {
            alert('Пожалуйста, введите название группы');
            return;
        }
        
        group.name = newName;
        
        window.appState.editingGroupId = null;
        this.syncGroupListEditingVisuals();
        this.syncGroupListRowNormalViewFromModel(group);
        window.appState.saveDebounced();
    }

    savePersonGroupChanges(groupId) {
        const group = window.appState.data.personGroups.find(g => String(g.id) === String(groupId));
        if (!group) {
            window.appState.editingPersonGroupId = null;
            this.syncPersonGroupListEditingVisuals();
            return;
        }
        const el = document.getElementById(`editPersonGroupName${groupId}`);
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
    }
    
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
            document.querySelectorAll(`.wave-color-preview-small`).forEach(preview => {
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
            
            // Обновляем список волн
            this.updateWavesList();
            
            // Показываем уведомление об изменении цвета
            console.log(`Цвет сигнала "${wave.name}" изменен с ${oldColor} на ${newColor}`);
        });
        
        colorInput.click();
    }

    /**
     * Сохраняет скролл списка дат и вложенных .person-group-children до полной перерисовки EJS.
     */
    _captureDateListScrollState() {
        const root = document.getElementById('dateListForDates');
        if (!root) {
            return null;
        }
        const nested = [];
        root.querySelectorAll('.list-item--person-group').forEach((row) => {
            const gid = row.getAttribute('data-id');
            if (!gid) {
                return;
            }
            const ch = row.querySelector('.person-group-children');
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
        const root = document.getElementById('dateListForDates');
        if (!root) {
            return;
        }
        const apply = () => {
            const maxRoot = Math.max(0, root.scrollHeight - root.clientHeight);
            root.scrollTop = Math.min(state.rootTop, maxRoot);
            root.scrollLeft = state.rootLeft;
            const rows = root.querySelectorAll('.list-item--person-group');
            for (let n = 0; n < state.nested.length; n++) {
                const { groupId, top } = state.nested[n];
                for (let i = 0; i < rows.length; i++) {
                    const row = rows[i];
                    if (row.getAttribute('data-id') === groupId) {
                        const ch = row.querySelector('.person-group-children');
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

        const rootProbe = document.getElementById('dateListForDates');
        const dateRowCount = rootProbe
            ? rootProbe.querySelectorAll('.list-item--date[data-type="date"]').length
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

            const root = document.getElementById('dateListForDates');
            if (
                root &&
                (root.querySelector('.list-item--person-group') ||
                    (allGroups.length === 0 && root.querySelector('.list-empty')))
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
    }


    updateWavesList() {
        const wrd = window.__waveRenderDebug;
        const end = wrd && wrd.isEnabled && wrd.isEnabled() ? wrd.t('unifiedListManager.updateWavesList', {}) : null;
        let endDetail = { skipped: true };
        try {
            const container = document.getElementById('wavesList');
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
     * Чекбоксы «группа вкл» и «видимость сигнала» из appState без полного EJS.
     * Используется при переключении шаблонов отображения (порядок десятков мс вместо сотен на длинных списках).
     * @returns {boolean} false, если контейнера списка нет
     */
    syncWavesListVisibilityFromAppState() {
        const root = document.getElementById('wavesList');
        if (!root) {
            return false;
        }

        root.querySelectorAll('.list-item--group[data-type="group"]').forEach((row) => {
            const gid = String(row.dataset.id);
            const group = (window.appState.data.groups || []).find((g) => String(g.id) === gid);
            if (!group) return;
            const toggle = row.querySelector('.wave-group-toggle');
            if (toggle) {
                toggle.checked = !!group.enabled;
            }
        });

        root.querySelectorAll('.wave-visibility-check').forEach((cb) => {
            const wid = String(cb.dataset.id);
            if (!wid) return;
            cb.checked = window.appState.waveVisibility[wid] !== false;
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
        const container = document.getElementById('wavesList');
        if (!container) return false;

        const visibleGroups = window.appState.data.groups.filter((g) => !g.hidden);
        const rows = Array.from(container.children).filter(
            (el) => el.classList && el.classList.contains('list-item--group')
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

        container.querySelectorAll(':scope > .list-item--group').forEach((el) => {
            const idStr = String(el.dataset.id);
            const fullIdx = window.appState.data.groups.findIndex((g) => String(g.id) === idStr);
            if (fullIdx >= 0) {
                el.setAttribute('data-index', String(fullIdx));
            }
        });

        return true;
    }

    _findSignalGroupRow(wavesRoot, groupId) {
        const idStr = String(groupId);
        let found = null;
        wavesRoot.querySelectorAll('.list-item--group').forEach((el) => {
            if (String(el.dataset.type) !== 'group') return;
            if (String(el.dataset.id) === idStr) found = el;
        });
        return found;
    }

    _findWaveRowInWavesList(wavesRoot, waveId) {
        const w = String(waveId);
        let found = null;
        wavesRoot.querySelectorAll('.list-item--wave').forEach((el) => {
            const id = String(el.dataset.waveId != null ? el.dataset.waveId : el.dataset.id);
            if (id === w) found = el;
        });
        return found;
    }

    _ensureEmptySignalGroupChildrenMessage(container) {
        if (container.querySelector('.no-waves-message')) return;
        const div = document.createElement('div');
        div.className = 'no-waves-message';
        div.innerHTML =
            '<span style="color: #999; font-style: italic; font-size: 11px; padding: 10px;">Нет сигналов в этой группе</span>';
        container.appendChild(div);
    }

    _removeEmptyPlaceholders(container) {
        container.querySelectorAll(':scope > .no-waves-message').forEach((n) => n.remove());
    }

    /**
     * Синхронизировать .group-children одной группы сигналов с appState (перестановка / перенос колоска без EJS).
     * Сначала обычно вызывают для целевой группы, затем для исходной (перенос между группами).
     */
    syncOneSignalGroupChildrenDom(groupId) {
        const wavesRoot = document.getElementById('wavesList');
        if (!wavesRoot) return false;

        const group = window.appState.data.groups.find((g) => String(g.id) === String(groupId));
        if (!group || !Array.isArray(group.waves)) return false;

        const groupEl = this._findSignalGroupRow(wavesRoot, groupId);
        if (!groupEl) return false;

        const container = groupEl.querySelector('.group-children');
        if (!container) return false;

        const desired = group.waves.map(String);
        const byId = new Map();

        for (const wid of desired) {
            let row = null;
            Array.from(container.querySelectorAll(':scope > .list-item--wave')).forEach((el) => {
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

        Array.from(container.querySelectorAll(':scope > .list-item--wave')).forEach((row, i) => {
            row.setAttribute('data-index', String(i));
        });

        return true;
    }

    _findPersonGroupRow(dateRoot, personGroupId) {
        const idStr = String(personGroupId);
        let found = null;
        dateRoot.querySelectorAll('.list-item--person-group').forEach((el) => {
            if (String(el.dataset.id) === idStr) found = el;
        });
        return found;
    }

    _findDateRowInDateList(dateRoot, dateId) {
        const d = String(dateId);
        let found = null;
        dateRoot.querySelectorAll('.list-item--date').forEach((el) => {
            if (String(el.dataset.id) === d) found = el;
        });
        return found;
    }

    _ensureEmptyPersonGroupChildrenMessage(container) {
        if (container.querySelector('.no-waves-message')) return;
        const div = document.createElement('div');
        div.className = 'no-waves-message';
        div.innerHTML =
            '<span style="color: #999; font-style: italic; font-size: 11px; padding: 10px;">Нет персон в этой группе</span>';
        container.appendChild(div);
    }

    /**
     * Порядок групп персон в #dateListForDates по appState.data.personGroups (без EJS).
     */
    reorderPersonGroupsInDateListDom() {
        const container = document.getElementById('dateListForDates');
        if (!container) return false;

        const pg = window.appState.data.personGroups || [];
        const rows = Array.from(container.children).filter(
            (el) => el.classList && el.classList.contains('list-item--person-group')
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

        container.querySelectorAll(':scope > .list-item--person-group').forEach((el) => {
            const idStr = String(el.dataset.id);
            const fullIdx = pg.findIndex((g) => String(g.id) === idStr);
            if (fullIdx >= 0) {
                el.setAttribute('data-index', String(fullIdx));
            }
        });

        return true;
    }

    syncOnePersonGroupChildrenDom(personGroupId) {
        const dateRoot = document.getElementById('dateListForDates');
        if (!dateRoot) return false;

        const pg = (window.appState.data.personGroups || []).find((g) => String(g.id) === String(personGroupId));
        if (!pg || !Array.isArray(pg.dates)) return false;

        const groupEl = this._findPersonGroupRow(dateRoot, personGroupId);
        if (!groupEl) return false;

        const container = groupEl.querySelector('.person-group-children');
        if (!container) return false;

        const desired = pg.dates.map(String);
        const byId = new Map();

        for (const did of desired) {
            let row = null;
            Array.from(container.querySelectorAll(':scope > .list-item--date')).forEach((el) => {
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
            frag.appendChild(row);
        });
        container.appendChild(frag);

        if (desired.length === 0) {
            this._ensureEmptyPersonGroupChildrenMessage(container);
        }

        Array.from(container.querySelectorAll(':scope > .list-item--date')).forEach((row, i) => {
            row.setAttribute('data-index', String(i));
        });

        return true;
    }

    /** Режим редактирования группы персон — без полного updateDatesList(). */
    syncPersonGroupListEditingVisuals() {
        const editingId =
            window.appState.editingPersonGroupId != null ? String(window.appState.editingPersonGroupId) : null;
        const root = document.getElementById('dateListForDates');
        if (!root) return;

        root.querySelectorAll('.list-item--person-group').forEach((row) => {
            const idStr = String(row.dataset.id);
            const isEditing = Boolean(editingId && idStr === editingId);
            row.classList.toggle('list-item--editing', isEditing);
            const handle = row.querySelector(':scope > .list-item__drag-handle');
            if (handle) {
                handle.setAttribute('draggable', isEditing ? 'false' : 'true');
            }
            const editBtn = row.querySelector('.edit-btn[data-type="personGroup"]');
            if (editBtn) {
                editBtn.textContent = isEditing ? 'Редактирование...' : 'Изменить';
            }
        });

        if (!editingId) return;

        const group = (window.appState.data.personGroups || []).find((g) => String(g.id) === editingId);
        if (!group) return;

        const nameInput = document.getElementById(`editPersonGroupName${editingId}`);
        if (nameInput) nameInput.value = group.name;
    }

    syncPersonGroupRowNormalViewFromModel(group) {
        const idStr = String(group.id);
        const root = document.getElementById('dateListForDates');
        if (!root) return;

        let row = null;
        root.querySelectorAll('.list-item--person-group').forEach((el) => {
            if (String(el.dataset.id) === idStr) row = el;
        });
        if (!row) return;

        const titleEl = row.querySelector('.list-item__normal-view .list-item__title');
        if (titleEl) {
            titleEl.textContent = group.name;
        }

        const countEl = row.querySelector('.list-item__value .group-total-count');
        if (countEl && Array.isArray(group.dates)) {
            countEl.textContent = `Персон: ${group.dates.length}`;
        }
    }

    /** Обновить счётчики «Персон: N» у всех групп персон (после DnD без полного рендера). */
    syncAllPersonGroupDateCountsFromModel() {
        const root = document.getElementById('dateListForDates');
        if (!root) return;
        const pg = window.appState.data.personGroups || [];
        for (let i = 0; i < pg.length; i++) {
            const g = pg[i];
            const row = this._findPersonGroupRow(root, g.id);
            if (!row) continue;
            const countEl = row.querySelector('.list-item__value .group-total-count');
            if (countEl && Array.isArray(g.dates)) {
                countEl.textContent = `Персон: ${g.dates.length}`;
            }
        }
    }
    
    updateIntersectionResults(intersections) {
        this.renderList('intersectionResults', intersections, 'intersection');
    }
    
    updateGroupStats(groupId) {
        const group = window.appState.data.groups.find(g => String(g.id) === String(groupId));
        if (!group) {
            return;
        }
        
        const groupElement = document.querySelector(`.list-item--group[data-id="${groupId}"]`);
        if (!groupElement) {
            return;
        }
        
        let enabledCount = 0;
        const waveCount = group.waves ? group.waves.length : 0;
        
        if (group.waves && Array.isArray(group.waves)) {
            group.waves.forEach(waveId => {
                const waveIdStr = String(waveId);
                if (window.appState.waveVisibility[waveIdStr] !== false) {
                    enabledCount++;
                }
            });
        }
        
        const statsElement = groupElement.querySelector('.list-item__value .group-stats');
        if (statsElement) {
            if (enabledCount > 0) {
                statsElement.innerHTML = `
                    <span class="group-enabled-count" title="Включено сигналов">
                        Включено: ${enabledCount}
                    </span>
                    <span class="group-total-count" title="Всего сигналов">
                        Сигналов: ${waveCount}
                    </span>
                `;
            } else {
                statsElement.innerHTML = `
                    <span class="group-total-count">
                        Сигналов: ${waveCount}
                    </span>
                `;
            }
        }
    }
    
    async reloadTemplates() {
        this.invalidateEjsRenderers();
        this.templatesLoaded = false;
        this.templatesLoadPromise = null;
        await this.initTemplates();
    }
}

window.unifiedListManager = new UnifiedListManager();