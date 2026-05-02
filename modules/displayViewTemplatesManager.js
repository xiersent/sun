/**
 * Шаблоны отображения: сохранённые комбинации включения групп и видимости волн.
 * Стандартный шаблон (неудаляемый) хранит снимок как и остальные; при первом запуске заполняется из текущего состояния.
 */
(function () {
    const STANDARD_ID = '__display_standard__';

    /** Шаблоны до поля waveBold: не трогаем appState.waveBold при apply и не создаём пустой снимок до миграции. */
    function templateHasWaveBoldSnapshot(tpl) {
        return tpl && Object.prototype.hasOwnProperty.call(tpl, 'waveBold');
    }

    function seedTemplateWaveBoldFromAppState(tpl) {
        const next = {};
        (window.appState.data.waves || []).forEach((w) => {
            const wid = String(w.id);
            next[wid] = window.appState.waveBold[wid] === true;
        });
        tpl.waveBold = next;
    }

    class DisplayViewTemplatesManager {
        constructor() {
            this._controlsBound = false;
        }

        getUi() {
            return window.appState.data.uiSettings;
        }

        captureSnapshotFromAppState() {
            const groupEnabled = {};
            const waveVisibility = {};
            const waveBold = {};
            (window.appState.data.groups || []).forEach((g) => {
                groupEnabled[String(g.id)] = !!g.enabled;
            });
            (window.appState.data.waves || []).forEach((w) => {
                const wid = String(w.id);
                waveVisibility[wid] = window.appState.waveVisibility[wid] !== false;
                waveBold[wid] = window.appState.waveBold[wid] === true;
            });
            return { groupEnabled, waveVisibility, waveBold };
        }

        captureIntoTemplate(tpl) {
            if (!tpl) return;
            const snap = this.captureSnapshotFromAppState();
            tpl.groupEnabled = { ...snap.groupEnabled };
            tpl.waveVisibility = { ...snap.waveVisibility };
            tpl.waveBold = { ...snap.waveBold };
        }

        applySnapshotToAppState(tpl) {
            const ge = tpl.groupEnabled || {};
            const wv = tpl.waveVisibility || {};
            const applyWaveBold =
                templateHasWaveBoldSnapshot(tpl) && tpl.waveBold && typeof tpl.waveBold === 'object';
            const wb = applyWaveBold ? tpl.waveBold : null;
            (window.appState.data.groups || []).forEach((g) => {
                const gid = String(g.id);
                g.enabled = ge[gid] !== false;
            });
            (window.appState.data.waves || []).forEach((w) => {
                const wid = String(w.id);
                window.appState.waveVisibility[wid] = wv[wid] !== false;
                if (applyWaveBold) {
                    window.appState.waveBold[wid] = wb[wid] === true;
                }
            });
        }

        ensureShape() {
            const ui = this.getUi();
            if (!Array.isArray(ui.displayViewTemplates)) {
                ui.displayViewTemplates = [];
            }
            if (!ui.activeDisplayViewTemplateId) {
                ui.activeDisplayViewTemplateId = STANDARD_ID;
            }

            const list = ui.displayViewTemplates;
            let std = list.find((t) => t.id === STANDARD_ID) || list.find((t) => t.builtIn);
            let createdStd = false;
            if (!std) {
                std = {
                    id: STANDARD_ID,
                    name: 'Стандартный',
                    builtIn: true,
                    description: '',
                    groupEnabled: {},
                    waveVisibility: {},
                    waveBold: {}
                };
                list.unshift(std);
                createdStd = true;
            } else {
                std.id = STANDARD_ID;
                std.builtIn = true;
                std.name = 'Стандартный';
                if (!std.groupEnabled || typeof std.groupEnabled !== 'object') {
                    std.groupEnabled = {};
                }
                if (!std.waveVisibility || typeof std.waveVisibility !== 'object') {
                    std.waveVisibility = {};
                }
                /* Уже сохранённый стандартный шаблон без waveBold не дополняем {} — иначе сломаем миграцию и сбросим B при apply. */
            }

            const hasData =
                (window.appState.data.groups && window.appState.data.groups.length > 0) ||
                (window.appState.data.waves && window.appState.data.waves.length > 0);
            const stdEmpty =
                Object.keys(std.groupEnabled).length === 0 &&
                Object.keys(std.waveVisibility).length === 0 &&
                (!templateHasWaveBoldSnapshot(std) ||
                    Object.keys(std.waveBold).length === 0);
            if (hasData && stdEmpty && (createdStd || list.length === 1)) {
                this.captureIntoTemplate(std);
            }

            if (!list.some((t) => String(t.id) === String(ui.activeDisplayViewTemplateId))) {
                ui.activeDisplayViewTemplateId = STANDARD_ID;
            }

            list.forEach((tpl) => {
                if (typeof tpl.description !== 'string') {
                    tpl.description = '';
                }
            });
        }

        pruneStaleIds() {
            const ui = this.getUi();
            if (!Array.isArray(ui.displayViewTemplates)) return;
            const gids = new Set((window.appState.data.groups || []).map((g) => String(g.id)));
            const wids = new Set((window.appState.data.waves || []).map((w) => String(w.id)));
            ui.displayViewTemplates.forEach((tpl) => {
                const ge = tpl.groupEnabled || {};
                const wv = tpl.waveVisibility || {};
                const nextG = {};
                Object.keys(ge).forEach((k) => {
                    const ks = String(k);
                    if (gids.has(ks)) nextG[ks] = !!ge[k];
                });
                const nextW = {};
                Object.keys(wv).forEach((k) => {
                    const ks = String(k);
                    if (wids.has(ks)) nextW[ks] = !!wv[k];
                });
                tpl.groupEnabled = nextG;
                tpl.waveVisibility = nextW;
                if (templateHasWaveBoldSnapshot(tpl)) {
                    const wb = tpl.waveBold || {};
                    const nextB = {};
                    Object.keys(wb).forEach((k) => {
                        const ks = String(k);
                        if (wids.has(ks)) nextB[ks] = !!wb[k];
                    });
                    tpl.waveBold = nextB;
                }
            });
        }

        mergeMissingEntitiesIntoSnapshots() {
            const ui = this.getUi();
            if (!Array.isArray(ui.displayViewTemplates)) return;
            const activeId = this.getActiveTemplateId();
            ui.displayViewTemplates.forEach((tpl) => {
                if (!tpl.groupEnabled) tpl.groupEnabled = {};
                if (!tpl.waveVisibility) tpl.waveVisibility = {};
                (window.appState.data.groups || []).forEach((g) => {
                    const gid = String(g.id);
                    if (tpl.groupEnabled[gid] === undefined) {
                        tpl.groupEnabled[gid] = true;
                    }
                });
                (window.appState.data.waves || []).forEach((w) => {
                    const wid = String(w.id);
                    if (tpl.waveVisibility[wid] === undefined) {
                        tpl.waveVisibility[wid] = true;
                    }
                });
                if (!templateHasWaveBoldSnapshot(tpl)) {
                    /* Старые шаблоны: копируем текущий appState.waveBold во все снимки, чтобы переключение шаблона не обнуляло B после первого save. */
                    seedTemplateWaveBoldFromAppState(tpl);
                } else {
                    if (!tpl.waveBold || typeof tpl.waveBold !== 'object') tpl.waveBold = {};
                    (window.appState.data.waves || []).forEach((w) => {
                        const wid = String(w.id);
                        if (tpl.waveBold[wid] === undefined) {
                            tpl.waveBold[wid] =
                                String(tpl.id) === String(activeId)
                                    ? window.appState.waveBold[wid] === true
                                    : false;
                        }
                    });
                }
            });
        }

        getActiveTemplateId() {
            const id = this.getUi().activeDisplayViewTemplateId;
            return id || STANDARD_ID;
        }

        getTemplateById(id) {
            return this.getUi().displayViewTemplates.find((t) => String(t.id) === String(id));
        }

        persistDescriptionToTemplate(tplId) {
            const tpl = this.getTemplateById(tplId);
            const ta = document.getElementById('displayViewTemplateDescription');
            if (!tpl || !ta) return;
            tpl.description = ta.value;
        }

        syncDescriptionFieldFromActive() {
            const tpl = this.getTemplateById(this.getActiveTemplateId());
            const ta = document.getElementById('displayViewTemplateDescription');
            if (!ta) return;
            ta.value = tpl && typeof tpl.description === 'string' ? tpl.description : '';
        }

        refreshGraphAndList() {
            if (window.waves && typeof window.waves.reconcileVisibleWaveElements === 'function') {
                window.waves.reconcileVisibleWaveElements();
            } else if (window.eventManager && window.eventManager.recreateAllWaveElements) {
                window.eventManager.recreateAllWaveElements();
            } else if (window.waves) {
                document.querySelectorAll('.wave-container').forEach((c) => c.remove());
                window.waves.clearWaveDomReferences();
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
            if (window.unifiedListManager) {
                const syncFn = window.unifiedListManager.syncWavesListVisibilityFromAppState;
                const synced = typeof syncFn === 'function' && syncFn.call(window.unifiedListManager);
                if (!synced && window.unifiedListManager.updateWavesList) {
                    window.unifiedListManager.updateWavesList();
                }
            }

            const runSecondary = () => {
                if (window.grid && window.grid.updateGridNotesHighlight) {
                    window.grid.updateGridNotesHighlight();
                }
                if (window.summaryManager && window.summaryManager.debouncedUpdate) {
                    window.summaryManager.debouncedUpdate();
                }
                if (window.dom && window.dom.refreshShowOnVizorButtonLabels) {
                    window.dom.refreshShowOnVizorButtonLabels();
                }
            };
            if (typeof requestAnimationFrame === 'function') {
                requestAnimationFrame(runSecondary);
            } else {
                runSecondary();
            }
        }

        switchToTemplate(newId) {
            const ui = this.getUi();
            const oldId = this.getActiveTemplateId();
            if (String(oldId) === String(newId)) {
                this.refreshSelect();
                this.syncDescriptionFieldFromActive();
                return;
            }
            this.persistDescriptionToTemplate(oldId);
            const oldTpl = this.getTemplateById(oldId);
            if (oldTpl) {
                this.captureIntoTemplate(oldTpl);
            }
            const newTpl = this.getTemplateById(newId);
            if (!newTpl) {
                this.refreshSelect();
                return;
            }
            ui.activeDisplayViewTemplateId = newId;
            this.applySnapshotToAppState(newTpl);
            window.appState.saveDebounced();
            this.refreshGraphAndList();
            this.refreshSelect();
        }

        addTemplateFromCurrent(name) {
            const n = (name || '').trim();
            if (!n) {
                alert('Введите название шаблона');
                return;
            }
            const ui = this.getUi();
            const curId = this.getActiveTemplateId();
            this.persistDescriptionToTemplate(curId);
            const currentTpl = this.getTemplateById(curId);
            if (currentTpl) {
                this.captureIntoTemplate(currentTpl);
            }
            const id = window.appState.generateId();
            const snap = this.captureSnapshotFromAppState();
            ui.displayViewTemplates.push({
                id,
                name: n,
                builtIn: false,
                description: '',
                groupEnabled: { ...snap.groupEnabled },
                waveVisibility: { ...snap.waveVisibility },
                waveBold: { ...snap.waveBold }
            });
            ui.activeDisplayViewTemplateId = id;
            window.appState.save();
            this.refreshSelect();
        }

        deleteSelectedTemplate() {
            const ui = this.getUi();
            const id = this.getActiveTemplateId();
            this.persistDescriptionToTemplate(id);
            const tpl = this.getTemplateById(id);
            if (!tpl || tpl.builtIn) {
                alert('Стандартный шаблон нельзя удалить');
                return;
            }
            const idx = ui.displayViewTemplates.findIndex((t) => String(t.id) === String(id));
            if (idx < 0) return;
            ui.displayViewTemplates.splice(idx, 1);

            const fallback = this.getTemplateById(STANDARD_ID) || ui.displayViewTemplates[0] || null;
            ui.activeDisplayViewTemplateId = fallback ? fallback.id : STANDARD_ID;
            if (fallback) {
                this.applySnapshotToAppState(fallback);
            }
            window.appState.save();
            this.refreshGraphAndList();
            this.refreshSelect();
        }

        onNewGroupAdded(group) {
            if (!group) return;
            const ui = this.getUi();
            this.ensureShape();
            const gid = String(group.id);
            const activeId = this.getActiveTemplateId();
            ui.displayViewTemplates.forEach((tpl) => {
                if (!tpl.groupEnabled) tpl.groupEnabled = {};
                if (String(tpl.id) === String(activeId)) {
                    tpl.groupEnabled[gid] = !!group.enabled;
                } else if (tpl.groupEnabled[gid] === undefined) {
                    tpl.groupEnabled[gid] = true;
                }
            });
            window.appState.saveDebounced();
        }

        onNewWaveAdded(wave) {
            if (!wave) return;
            const ui = this.getUi();
            this.ensureShape();
            const wid = String(wave.id);
            const activeId = this.getActiveTemplateId();
            const vis = window.appState.waveVisibility[wid] !== false;
            const bold = window.appState.waveBold[wid] === true;
            ui.displayViewTemplates.forEach((tpl) => {
                if (!tpl.waveVisibility) tpl.waveVisibility = {};
                if (!templateHasWaveBoldSnapshot(tpl)) {
                    if (String(tpl.id) === String(activeId)) {
                        tpl.waveVisibility[wid] = vis;
                    } else if (tpl.waveVisibility[wid] === undefined) {
                        tpl.waveVisibility[wid] = true;
                    }
                    seedTemplateWaveBoldFromAppState(tpl);
                    return;
                }
                if (!tpl.waveBold || typeof tpl.waveBold !== 'object') tpl.waveBold = {};
                if (String(tpl.id) === String(activeId)) {
                    tpl.waveVisibility[wid] = vis;
                    tpl.waveBold[wid] = bold;
                } else {
                    if (tpl.waveVisibility[wid] === undefined) {
                        tpl.waveVisibility[wid] = true;
                    }
                    if (tpl.waveBold[wid] === undefined) {
                        tpl.waveBold[wid] = false;
                    }
                }
            });
            window.appState.saveDebounced();
        }

        onWavesStructureChanged() {
            if (!window.appState) return;
            this.ensureShape();
            this.pruneStaleIds();
            this.mergeMissingEntitiesIntoSnapshots();
            window.appState.saveDebounced();
        }

        bindControls() {
            if (this._controlsBound) return;
            this._controlsBound = true;
            const $ = window.jQuery;
            if (!$) return;
            $(document).on('change', '#displayViewTemplateSelect', (e) => {
                const val = $(e.target).val();
                if (val) this.switchToTemplate(val);
            });
            $(document).on('click', '#btnAddDisplayViewTemplate', (e) => {
                e.preventDefault();
                const name = $('#newDisplayViewTemplateName').val();
                this.addTemplateFromCurrent(name);
                $('#newDisplayViewTemplateName').val('');
            });
            $(document).on('click', '#btnDeleteDisplayViewTemplate', (e) => {
                e.preventDefault();
                this.deleteSelectedTemplate();
            });
            $(document).on('blur', '#displayViewTemplateDescription', () => {
                this.persistDescriptionToTemplate(this.getActiveTemplateId());
                window.appState.saveDebounced();
            });
        }

        refreshSelect() {
            const sel = document.getElementById('displayViewTemplateSelect');
            if (!sel) return;
            const ui = this.getUi();
            const active = this.getActiveTemplateId();
            sel.innerHTML = '';
            (ui.displayViewTemplates || []).forEach((tpl) => {
                const opt = document.createElement('option');
                opt.value = tpl.id;
                opt.textContent = tpl.name || tpl.id;
                if (String(tpl.id) === String(active)) opt.selected = true;
                sel.appendChild(opt);
            });
            const delBtn = document.getElementById('btnDeleteDisplayViewTemplate');
            if (delBtn) {
                const cur = this.getTemplateById(active);
                delBtn.disabled = !!(cur && cur.builtIn);
            }
            this.syncDescriptionFieldFromActive();
        }

        init() {
            if (!window.appState) return;
            this.ensureShape();
            this.pruneStaleIds();
            this.mergeMissingEntitiesIntoSnapshots();
            this.bindControls();
            this.refreshSelect();
        }
    }

    window.displayViewTemplatesManager = new DisplayViewTemplatesManager();
})();
