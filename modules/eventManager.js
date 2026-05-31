/**
 * @file eventManager.js
 * Глобальные обработчики кликов, DnD списков, видимость волн и чекбоксы персон.
 */
(function initSunPerfLog() {
    if (typeof window.sunPerfLog === 'function') return;
    window.sunPerfLog = function sunPerfLog(scope, action, detail) {
        if (window.__SUN_PERF_LOG === false) return;
        const row = {
            scope,
            action,
            tMs: typeof performance !== 'undefined' ? Number(performance.now().toFixed(2)) : null
        };
        if (detail != null && typeof detail === 'object' && !Array.isArray(detail)) {
            Object.assign(row, detail);
        } else if (detail !== undefined) {
            row.data = detail;
        }
        console.log('[SunPerf]', row);
    };
})();

class EventManager {
    constructor() {
        this.askedGroups = new Set();
        /** @type {{ type: 'wave'|'date', id: *, index: number, groupId: *, source?: string }|null} */
        this.nestedItemDragPayload = null;
        this._dragOverListItemEl = null;
        this._nestedDragOverItemEl = null;
        this._nestedChildrenDropEl = null;
        this._wavesUiRefreshScheduled = null;
        this._groupOrderDomRefreshScheduled = null;
        this._wavesOrderDomRefreshScheduled = null;
        this._wavesOrderDomQueue = [];
        this._personGroupOrderDomRefreshScheduled = null;
        this._datesOrderDomRefreshScheduled = null;
        this._datesOrderDomQueue = [];
        this._datesUiRefreshScheduled = null;
        this.$ = window.jQuery;
        this.setupGlobalHandlers();
        this.setupDateChangeObservers();
        this.setupIntersectionHandlers();
        this.setupDateSelectionHandlers();
    }
    
    /** jQuery-делегирование: клики, DnD групп и вложенных строк. */
    setupGlobalHandlers() {
        $(document).on('click', (e) => {
            this.handleClick(e);
        });

        $(document)
            .on('dragstart', '.sun-listItemGroup[data-type="group"]:not(.sun-listItemEditing) > .sun-listItemDragHandle', this.handleDragStart.bind(this))
            .on('dragover', '.sun-listItemGroup[data-type="group"]', this.handleDragOver.bind(this))
            .on('dragleave', '.sun-listItemGroup[data-type="group"]', this.handleDragLeave.bind(this))
            .on('drop', '.sun-listItemGroup[data-type="group"]', this.handleDrop.bind(this))
            .on('dragend', '.sun-listItemGroup[data-type="group"]:not(.sun-listItemEditing) > .sun-listItemDragHandle', this.handleDragEnd.bind(this));

        $(document)
            .on('dragstart', '.sun-listItemPersonGroup[data-type="personGroup"]:not(.sun-listItemEditing) > .sun-listItemDragHandle', this.handleDragStart.bind(this))
            .on('dragover', '.sun-listItemPersonGroup[data-type="personGroup"]', this.handleDragOver.bind(this))
            .on('dragleave', '.sun-listItemPersonGroup[data-type="personGroup"]', this.handleDragLeave.bind(this))
            .on('drop', '.sun-listItemPersonGroup[data-type="personGroup"]', this.handleDrop.bind(this))
            .on('dragend', '.sun-listItemPersonGroup[data-type="personGroup"]:not(.sun-listItemEditing) > .sun-listItemDragHandle', this.handleDragEnd.bind(this));
            
        const nd = window.SunNestedListDnD;
        const nestedContainers = nd.NESTED_CONTAINERS;
        $(document)
            .on('dragover', nestedContainers, (e) => nd.nestedContainersDragOver(this, e))
            .on('dragleave', nestedContainers, (e) => nd.nestedContainersDragLeave(this, e))
            .on('drop', nestedContainers, (e) => nd.nestedContainersDrop(this, e));

        $(document)
            .on(
                'dragstart',
                '.sun-wavesList .sun-waveInGroup:not(.sun-listItemEditing) > .sun-listItemDragHandle.sun-waveDragHandle',
                (e) => nd.dragStart(this, e, 'wave')
            )
            .on(
                'dragstart',
                '.sun-dateListForDates .sun-dateInPersonGroup:not(.sun-listItemEditing) > .sun-listItemDragHandle.sun-dateDragHandle',
                (e) => nd.dragStart(this, e, 'date')
            )
            .on(
                'dragover',
                '.sun-wavesList .sun-waveInGroup, .sun-dateListForDates .sun-dateInPersonGroup',
                (e) => nd.nestedChildRowsDragOver(this, e)
            )
            .on(
                'dragleave',
                '.sun-wavesList .sun-waveInGroup, .sun-dateListForDates .sun-dateInPersonGroup',
                (e) => nd.nestedChildRowsDragLeave(this, e)
            )
            .on(
                'drop',
                '.sun-wavesList .sun-waveInGroup, .sun-dateListForDates .sun-dateInPersonGroup',
                (e) => nd.nestedChildRowsDrop(this, e)
            )
            .on(
                'dragend',
                '.sun-wavesList .sun-waveInGroup:not(.sun-listItemEditing) > .sun-listItemDragHandle.sun-waveDragHandle',
                (e) => nd.dragEnd(this, e, 'wave')
            )
            .on(
                'dragend',
                '.sun-dateListForDates .sun-dateInPersonGroup:not(.sun-listItemEditing) > .sun-listItemDragHandle.sun-dateDragHandle',
                (e) => nd.dragEnd(this, e, 'date')
            );

		const disableGroupWaveLayers = (groupId, mode) => {
			const group = window.appState.data.groups.find((g) => String(g.id) === String(groupId));
			if (!group || !group.waves) return;
			group.waves.forEach((waveId) => {
				const waveIdStr = String(waveId);
				if (mode === 'all' || mode === 'a') {
					window.appState.waveVisibility[waveIdStr] = false;
				}
				if (mode === 'all' || mode === 'b') {
					window.appState.waveBold[waveIdStr] = false;
				}
			});
			window.appState.save();
			if (window.unifiedListManager && typeof window.unifiedListManager.syncWavesListVisibilityFromAppState === 'function') {
				window.unifiedListManager.syncWavesListVisibilityFromAppState();
			}
			if (window.extremumTimeManager && window.extremumTimeManager.updateExtremums) {
				window.extremumTimeManager.updateExtremums();
			}
			if (window.waves) window.waves.updatePosition();
			if (window.summaryManager) window.summaryManager.updateSummary();
		};

		$(document).on('click', '.sun-groupStatTotal', (e) => {
			e.preventDefault();
			e.stopPropagation();
			window.sunPerfLog('eventManager', 'click.groupStat', { target: 'total' });
			const $groupItem = $(e.target).closest('.sun-listItemGroup');
			if (!$groupItem.length) return;
			const groupId = $groupItem.data('id');
			if (!groupId) return;
			disableGroupWaveLayers(groupId, 'all');
		});

		$(document).on('click', '.sun-groupStatA', (e) => {
			e.preventDefault();
			e.stopPropagation();
			window.sunPerfLog('eventManager', 'click.groupStat', { target: 'layerA' });
			const $groupItem = $(e.target).closest('.sun-listItemGroup');
			if (!$groupItem.length) return;
			const groupId = $groupItem.data('id');
			if (!groupId) return;
			disableGroupWaveLayers(groupId, 'a');
		});

		$(document).on('click', '.sun-groupStatB', (e) => {
			e.preventDefault();
			e.stopPropagation();
			window.sunPerfLog('eventManager', 'click.groupStat', { target: 'layerB' });
			const $groupItem = $(e.target).closest('.sun-listItemGroup');
			if (!$groupItem.length) return;
			const groupId = $groupItem.data('id');
			if (!groupId) return;
			disableGroupWaveLayers(groupId, 'b');
		});

    }
    
    /** Сбрасывает CSS-классы drag-over у вложенного DnD. */
    clearNestedDnDVisualState() {
        if (window.SunNestedListDnD) {
            window.SunNestedListDnD.clearNestedDnDVisuals(this);
        }
    }

    /**
     * Перестроение списка групп/волн и сохранение после изменения только порядка.
     * Сводку не трогаем: она сортирует сигналы по близости фазы, не по порядку в группе.
     */
    scheduleWavesListRefreshAndSave() {
        const coalesced = this._wavesUiRefreshScheduled !== null;
        if (this._wavesUiRefreshScheduled !== null) {
            cancelAnimationFrame(this._wavesUiRefreshScheduled);
        }
        window.sunPerfLog('eventManager', 'scheduleWavesListRefreshAndSave.queue', { coalesced });
        this._wavesUiRefreshScheduled = requestAnimationFrame(() => {
            this._wavesUiRefreshScheduled = null;
            const tFrame = typeof performance !== 'undefined' ? performance.now() : 0;
            let msList = 0;
            let msSelect = 0;
            let msSave = 0;
            try {
                if (window.unifiedListManager && window.unifiedListManager.updateWavesList) {
                    const t0 = typeof performance !== 'undefined' ? performance.now() : 0;
                    window.unifiedListManager.updateWavesList();
                    msList = typeof performance !== 'undefined' ? Number((performance.now() - t0).toFixed(2)) : 0;
                }
                if (window.summaryManager && typeof window.summaryManager.populateGroupSelect === 'function') {
                    const t0 = typeof performance !== 'undefined' ? performance.now() : 0;
                    const prev = window.summaryManager.currentGroup;
                    window.summaryManager.populateGroupSelect();
                    const sel = window.summaryManager.elements.summaryGroupSelect;
                    if (sel && prev != null && [...sel.options].some(o => String(o.value) === String(prev))) {
                        sel.value = String(prev);
                    }
                    msSelect = typeof performance !== 'undefined' ? Number((performance.now() - t0).toFixed(2)) : 0;
                }
            } finally {
                if (window.appState && typeof window.appState.save === 'function') {
                    const t0 = typeof performance !== 'undefined' ? performance.now() : 0;
                    window.appState.save();
                    msSave = typeof performance !== 'undefined' ? Number((performance.now() - t0).toFixed(2)) : 0;
                }
            }
            const total = typeof performance !== 'undefined' ? Number((performance.now() - tFrame).toFixed(2)) : 0;
            window.sunPerfLog('eventManager', 'scheduleWavesListRefreshAndSave.done', {
                msUpdateWavesList: msList,
                msPopulateGroupSelect: msSelect,
                msSave: msSave,
                msTotalRaf: total
            });
        });
    }

    /**
     * После DnD только порядка групп: перестановка DOM без полного EJS; при несовпадении — полный refresh.
     */
    scheduleGroupOrderDomSyncAndSave() {
        const coalesced = this._groupOrderDomRefreshScheduled !== null;
        if (this._groupOrderDomRefreshScheduled !== null) {
            cancelAnimationFrame(this._groupOrderDomRefreshScheduled);
        }
        window.sunPerfLog('eventManager', 'scheduleGroupOrderDomSyncAndSave.queue', { coalesced });
        this._groupOrderDomRefreshScheduled = requestAnimationFrame(() => {
            this._groupOrderDomRefreshScheduled = null;
            const tFrame = typeof performance !== 'undefined' ? performance.now() : 0;
            let msDom = 0;
            let msList = 0;
            let msSelect = 0;
            let msSave = 0;
            try {
                let domOk = false;
                if (window.unifiedListManager && typeof window.unifiedListManager.reorderGroupsInWavesListDom === 'function') {
                    const t0 = typeof performance !== 'undefined' ? performance.now() : 0;
                    domOk = window.unifiedListManager.reorderGroupsInWavesListDom();
                    msDom = typeof performance !== 'undefined' ? Number((performance.now() - t0).toFixed(2)) : 0;
                }
                if (!domOk && window.unifiedListManager && window.unifiedListManager.updateWavesList) {
                    const t0 = typeof performance !== 'undefined' ? performance.now() : 0;
                    window.unifiedListManager.updateWavesList();
                    msList = typeof performance !== 'undefined' ? Number((performance.now() - t0).toFixed(2)) : 0;
                }
                if (window.summaryManager && typeof window.summaryManager.populateGroupSelect === 'function') {
                    const t0 = typeof performance !== 'undefined' ? performance.now() : 0;
                    const prev = window.summaryManager.currentGroup;
                    window.summaryManager.populateGroupSelect();
                    const sel = window.summaryManager.elements.summaryGroupSelect;
                    if (sel && prev != null && [...sel.options].some(o => String(o.value) === String(prev))) {
                        sel.value = String(prev);
                    }
                    msSelect = typeof performance !== 'undefined' ? Number((performance.now() - t0).toFixed(2)) : 0;
                }
            } finally {
                if (window.appState && typeof window.appState.saveDebounced === 'function') {
                    const t0 = typeof performance !== 'undefined' ? performance.now() : 0;
                    window.appState.saveDebounced();
                    msSave = typeof performance !== 'undefined' ? Number((performance.now() - t0).toFixed(2)) : 0;
                }
            }
            const total = typeof performance !== 'undefined' ? Number((performance.now() - tFrame).toFixed(2)) : 0;
            window.sunPerfLog('eventManager', 'scheduleGroupOrderDomSyncAndSave.done', {
                msReorderGroupsDom: msDom,
                msUpdateWavesListFallback: msList,
                msPopulateGroupSelect: msSelect,
                msSaveDebounced: msSave,
                msTotalRaf: total
            });
        });
    }

    /**
     * После DnD порядка колосков: синхронизация .sun-groupChildren затронутых групп без полного EJS.
     * Аргументы — порядок вызова syncOne (например целевая группа, затем исходная при переносе).
     */
    scheduleWavesOrderDomSyncAndSave(...orderedGroupIds) {
        this._wavesOrderDomQueue.push(...orderedGroupIds.map(String));
        const coalesced = this._wavesOrderDomRefreshScheduled !== null;
        if (this._wavesOrderDomRefreshScheduled !== null) {
            cancelAnimationFrame(this._wavesOrderDomRefreshScheduled);
        }
        window.sunPerfLog('eventManager', 'scheduleWavesOrderDomSyncAndSave.queue', {
            coalesced,
            queueLen: this._wavesOrderDomQueue.length
        });
        this._wavesOrderDomRefreshScheduled = requestAnimationFrame(() => {
            this._wavesOrderDomRefreshScheduled = null;
            const tFrame = typeof performance !== 'undefined' ? performance.now() : 0;
            const queue = this._wavesOrderDomQueue.splice(0);
            let msSync = 0;
            let msList = 0;
            let msSelect = 0;
            let msSave = 0;
            let domOk = true;
            try {
                const t0 = typeof performance !== 'undefined' ? performance.now() : 0;
                if (window.unifiedListManager && typeof window.unifiedListManager.syncOneSignalGroupChildrenDom === 'function') {
                    for (let i = 0; i < queue.length; i++) {
                        if (!window.unifiedListManager.syncOneSignalGroupChildrenDom(queue[i])) {
                            domOk = false;
                            break;
                        }
                    }
                } else {
                    domOk = false;
                }
                msSync = typeof performance !== 'undefined' ? Number((performance.now() - t0).toFixed(2)) : 0;
                if (!domOk && window.unifiedListManager && window.unifiedListManager.updateWavesList) {
                    const t1 = typeof performance !== 'undefined' ? performance.now() : 0;
                    window.unifiedListManager.updateWavesList();
                    msList = typeof performance !== 'undefined' ? Number((performance.now() - t1).toFixed(2)) : 0;
                }
                if (window.summaryManager && typeof window.summaryManager.populateGroupSelect === 'function') {
                    const t2 = typeof performance !== 'undefined' ? performance.now() : 0;
                    const prev = window.summaryManager.currentGroup;
                    window.summaryManager.populateGroupSelect();
                    const sel = window.summaryManager.elements.summaryGroupSelect;
                    if (sel && prev != null && [...sel.options].some(o => String(o.value) === String(prev))) {
                        sel.value = String(prev);
                    }
                    msSelect = typeof performance !== 'undefined' ? Number((performance.now() - t2).toFixed(2)) : 0;
                }
            } finally {
                if (window.appState && typeof window.appState.saveDebounced === 'function') {
                    const t3 = typeof performance !== 'undefined' ? performance.now() : 0;
                    window.appState.saveDebounced();
                    msSave = typeof performance !== 'undefined' ? Number((performance.now() - t3).toFixed(2)) : 0;
                }
            }
            const total = typeof performance !== 'undefined' ? Number((performance.now() - tFrame).toFixed(2)) : 0;
            window.sunPerfLog('eventManager', 'scheduleWavesOrderDomSyncAndSave.done', {
                queueLen: queue.length,
                msSyncOneGroups: msSync,
                msUpdateWavesListFallback: msList,
                msPopulateGroupSelect: msSelect,
                msSaveDebounced: msSave,
                msTotalRaf: total
            });
        });
    }

    /** DnD порядка групп персон: только перестановка DOM + раскладка + saveDebounced. */
    schedulePersonGroupOrderDomSyncAndSave() {
        const coalesced = this._personGroupOrderDomRefreshScheduled !== null;
        if (this._personGroupOrderDomRefreshScheduled !== null) {
            cancelAnimationFrame(this._personGroupOrderDomRefreshScheduled);
        }
        window.sunPerfLog('eventManager', 'schedulePersonGroupOrderDomSyncAndSave.queue', { coalesced });
        this._personGroupOrderDomRefreshScheduled = requestAnimationFrame(() => {
            this._personGroupOrderDomRefreshScheduled = null;
            const tFrame = typeof performance !== 'undefined' ? performance.now() : 0;
            let msDom = 0;
            let msList = 0;
            let msSave = 0;
            try {
                let domOk = false;
                const t0 = typeof performance !== 'undefined' ? performance.now() : 0;
                if (window.unifiedListManager && typeof window.unifiedListManager.reorderPersonGroupsInDateListDom === 'function') {
                    domOk = window.unifiedListManager.reorderPersonGroupsInDateListDom();
                }
                msDom = typeof performance !== 'undefined' ? Number((performance.now() - t0).toFixed(2)) : 0;
                if (!domOk && window.dataManager && window.dataManager.updateDateList) {
                    const t1 = typeof performance !== 'undefined' ? performance.now() : 0;
                    window.dataManager.updateDateList();
                    msList = typeof performance !== 'undefined' ? Number((performance.now() - t1).toFixed(2)) : 0;
                } else if (domOk && window.dates && typeof window.dates.syncPersonGroupsLayout === 'function') {
                    window.dates.syncPersonGroupsLayout();
                }
            } finally {
                if (window.appState && typeof window.appState.saveDebounced === 'function') {
                    const t2 = typeof performance !== 'undefined' ? performance.now() : 0;
                    window.appState.saveDebounced();
                    msSave = typeof performance !== 'undefined' ? Number((performance.now() - t2).toFixed(2)) : 0;
                }
            }
            const total = typeof performance !== 'undefined' ? Number((performance.now() - tFrame).toFixed(2)) : 0;
            window.sunPerfLog('eventManager', 'schedulePersonGroupOrderDomSyncAndSave.done', {
                msReorderPersonGroupsDom: msDom,
                msUpdateDateListFallback: msList,
                msSaveDebounced: msSave,
                msTotalRaf: total
            });
        });
    }

    /** DnD персон внутри / между группами персон: .sun-personGroupChildren без полного EJS. */
    scheduleDatesOrderDomSyncAndSave(...orderedPersonGroupIds) {
        this._datesOrderDomQueue.push(...orderedPersonGroupIds.map(String));
        const coalesced = this._datesOrderDomRefreshScheduled !== null;
        if (this._datesOrderDomRefreshScheduled !== null) {
            cancelAnimationFrame(this._datesOrderDomRefreshScheduled);
        }
        window.sunPerfLog('eventManager', 'scheduleDatesOrderDomSyncAndSave.queue', {
            coalesced,
            queueLen: this._datesOrderDomQueue.length
        });
        this._datesOrderDomRefreshScheduled = requestAnimationFrame(() => {
            this._datesOrderDomRefreshScheduled = null;
            const tFrame = typeof performance !== 'undefined' ? performance.now() : 0;
            const queue = this._datesOrderDomQueue.splice(0);
            let msSync = 0;
            let msList = 0;
            let msSave = 0;
            let domOk = true;
            try {
                const t0 = typeof performance !== 'undefined' ? performance.now() : 0;
                if (window.unifiedListManager && typeof window.unifiedListManager.syncOnePersonGroupChildrenDom === 'function') {
                    for (let i = 0; i < queue.length; i++) {
                        if (!window.unifiedListManager.syncOnePersonGroupChildrenDom(queue[i])) {
                            domOk = false;
                            break;
                        }
                    }
                } else {
                    domOk = false;
                }
                msSync = typeof performance !== 'undefined' ? Number((performance.now() - t0).toFixed(2)) : 0;
                if (domOk && window.unifiedListManager && typeof window.unifiedListManager.syncAllPersonGroupDateCountsFromModel === 'function') {
                    window.unifiedListManager.syncAllPersonGroupDateCountsFromModel();
                }
                if (domOk && window.dates && typeof window.dates.syncPersonGroupsLayout === 'function') {
                    window.dates.syncPersonGroupsLayout();
                }
                if (!domOk && window.dataManager && window.dataManager.updateDateList) {
                    const t1 = typeof performance !== 'undefined' ? performance.now() : 0;
                    window.dataManager.updateDateList();
                    msList = typeof performance !== 'undefined' ? Number((performance.now() - t1).toFixed(2)) : 0;
                }
            } finally {
                if (window.appState && typeof window.appState.saveDebounced === 'function') {
                    const t2 = typeof performance !== 'undefined' ? performance.now() : 0;
                    window.appState.saveDebounced();
                    msSave = typeof performance !== 'undefined' ? Number((performance.now() - t2).toFixed(2)) : 0;
                }
            }
            const total = typeof performance !== 'undefined' ? Number((performance.now() - tFrame).toFixed(2)) : 0;
            window.sunPerfLog('eventManager', 'scheduleDatesOrderDomSyncAndSave.done', {
                queueLen: queue.length,
                msSyncPersonGroups: msSync,
                msUpdateDateListFallback: msList,
                msSaveDebounced: msSave,
                msTotalRaf: total
            });
        });
    }

    /** RAF: перерисовка списка дат и save после DnD. */
    scheduleDateListRefreshAndSave() {
        const coalesced = this._datesUiRefreshScheduled !== null;
        if (this._datesUiRefreshScheduled !== null) {
            cancelAnimationFrame(this._datesUiRefreshScheduled);
        }
        window.sunPerfLog('eventManager', 'scheduleDateListRefreshAndSave.queue', { coalesced });
        this._datesUiRefreshScheduled = requestAnimationFrame(() => {
            this._datesUiRefreshScheduled = null;
            const tFrame = typeof performance !== 'undefined' ? performance.now() : 0;
            let msList = 0;
            let msSave = 0;
            try {
                if (window.dataManager && window.dataManager.updateDateList) {
                    const t0 = typeof performance !== 'undefined' ? performance.now() : 0;
                    window.dataManager.updateDateList();
                    msList = typeof performance !== 'undefined' ? Number((performance.now() - t0).toFixed(2)) : 0;
                }
            } finally {
                if (window.appState && typeof window.appState.save === 'function') {
                    const t0 = typeof performance !== 'undefined' ? performance.now() : 0;
                    window.appState.save();
                    msSave = typeof performance !== 'undefined' ? Number((performance.now() - t0).toFixed(2)) : 0;
                }
            }
            const total = typeof performance !== 'undefined' ? Number((performance.now() - tFrame).toFixed(2)) : 0;
            window.sunPerfLog('eventManager', 'scheduleDateListRefreshAndSave.done', {
                msUpdateDateList: msList,
                msSave,
                msTotalRaf: total
            });
        });
    }
    
    /** Меняет порядок волны внутри одной группы. */
    reorderWaveInGroup(groupId, sourceIndex, targetIndex, insertBefore) {
        const group = window.appState.data.groups.find(g => String(g.id) === String(groupId));
        
        if (!group || !group.waves || !Array.isArray(group.waves)) {
            return;
        }
        
        const waves = [...group.waves];
        const waveId = waves[sourceIndex];
        if (waveId === undefined) return;
        
        waves.splice(sourceIndex, 1);
        let newIndex = this.calculateNewIndex(sourceIndex, targetIndex, insertBefore);
        waves.splice(newIndex, 0, waveId);
        group.waves = waves;

        window.sunPerfLog('eventManager', 'reorderWaveInGroup', {
            groupId,
            sourceIndex,
            targetIndex,
            insertBefore,
            newIndex
        });
        this.scheduleWavesOrderDomSyncAndSave(groupId);
    }

    /**
     * Переставляет волну внутри группы или переносит в другую группу.
     * @param {object} [opts]
     * @param {boolean} [opts.emptyOrGapDrop] — сброс на пустую область .sun-groupChildren (в конец списка цели)
     * @param {*} [opts.sourceItemId] — id волны в payload DnD: пересчитать индекс в группе-источнике (индекс из dragstart часто устаревает)
     */
    moveWaveBetweenGroups(sourceGroupId, targetGroupId, sourceIndex, targetIndex, insertBefore, opts = {}) {
        const { emptyOrGapDrop = false, sourceItemId } = opts;
        const sourceGroup = window.appState.data.groups.find(g => String(g.id) === String(sourceGroupId));
        const targetGroup = window.appState.data.groups.find(g => String(g.id) === String(targetGroupId));

        if (!sourceGroup || !targetGroup ||
            !Array.isArray(sourceGroup.waves) || !Array.isArray(targetGroup.waves)) {
            return;
        }

        let srcIdx = parseInt(sourceIndex, 10);
        if (!Number.isFinite(srcIdx) || srcIdx < 0) {
            srcIdx = 0;
        }
        if (sourceItemId != null && sourceItemId !== '') {
            const byId = sourceGroup.waves.findIndex((w) => String(w) === String(sourceItemId));
            if (byId >= 0) {
                srcIdx = byId;
            }
        }

        const sourceWaves = [...sourceGroup.waves];
        const waveId = sourceWaves[srcIdx];
        if (waveId === undefined) {
            window.sunPerfLog('eventManager', 'moveWaveBetweenGroups.aborted', {
                sourceGroupId,
                sourceIndex,
                srcIdx,
                sourceItemId
            });
            return;
        }

        const sameGroup = String(sourceGroupId) === String(targetGroupId);

        if (sameGroup) {
            this.reorderWaveInGroup(sourceGroupId, srcIdx, targetIndex, insertBefore);
            return;
        }

        sourceWaves.splice(srcIdx, 1);
        sourceGroup.waves = sourceWaves;

        const targetWaves = [...targetGroup.waves];
        let insertAt;
        if (emptyOrGapDrop || targetWaves.length === 0) {
            insertAt = targetWaves.length;
        } else {
            insertAt = insertBefore ? targetIndex : targetIndex + 1;
            if (insertAt < 0) insertAt = 0;
            if (insertAt > targetWaves.length) insertAt = targetWaves.length;
        }
        targetWaves.splice(insertAt, 0, waveId);
        targetGroup.waves = targetWaves;

        window.sunPerfLog('eventManager', 'moveWaveBetweenGroups.crossGroup', {
            from: sourceGroupId,
            to: targetGroupId,
            insertAt,
            emptyOrGapDrop: opts.emptyOrGapDrop
        });
        this.scheduleWavesOrderDomSyncAndSave(targetGroupId, sourceGroupId);
    }
    
    /** Индекс вставки при DnD с учётом insertBefore. */
    calculateNewIndex(sourceIndex, targetIndex, insertBefore) {
        if (sourceIndex < targetIndex) {
            if (insertBefore) {
                return targetIndex - 1;
            } else {
                return targetIndex;
            }
        } else {
            if (insertBefore) {
                return targetIndex;
            } else {
                return targetIndex + 1;
            }
        }
    }
    
    /** Начало перетаскивания группы сигналов или группы персон. */
    handleDragStart(e) {
        try {
            const data = e.originalEvent.dataTransfer.getData('text/plain');
            if (data) {
                const dragData = JSON.parse(data);
                if (dragData && (dragData.type === 'wave' || dragData.type === 'date')) {
                    e.preventDefault();
                    return;
                }
            }
        } catch (error) {}
        
        const $item = $(e.currentTarget).closest('.sun-listItemGroup, .sun-listItemPersonGroup');
        if (!$item.length) {
            e.preventDefault();
            return;
        }
        const type = $item.data('type');
        const id = $item.data('id');
        const index = parseInt($item.data('index') || 0, 10);
        
        if (id == null || id === '' || index < 0) {
            e.preventDefault();
            return;
        }

        if (type === 'group' || type === 'personGroup') {
            this.nestedItemDragPayload = null;
        }

        const payload = {
            type: type,
            id: id,
            index: index
        };
        e.originalEvent.dataTransfer.setData('text/plain', JSON.stringify(payload));
        
        $item.addClass('sun-listItemDragging');
        window.sunPerfLog('eventManager', 'dragstart', { type, id, index });
    }
    
    /** Подсветка зоны drop для строки группы. */
    handleDragOver(e) {
        const nd = window.SunNestedListDnD;
        const nested = this.nestedItemDragPayload;
        if (nested && (nested.type === 'wave' || nested.type === 'date')) {
            const overOwnNested =
                (nested.type === 'wave' && $(e.target).closest(nd.WAVE_NESTED_CHILDREN).length) ||
                (nested.type === 'date' && $(e.target).closest(nd.DATE_NESTED_CHILDREN).length);
            if (overOwnNested) {
                return;
            }
            e.preventDefault();
            e.originalEvent.dataTransfer.dropEffect = 'none';
            return;
        }
        try {
            const data = e.originalEvent.dataTransfer.getData('text/plain');
            if (data) {
                const dragData = JSON.parse(data);
                if (dragData && (dragData.type === 'wave' || dragData.type === 'date')) {
                    return;
                }
            }
        } catch (error) {}
        
        e.preventDefault();
        e.originalEvent.dataTransfer.dropEffect = 'move';
        
        const $item = $(e.currentTarget);
        const el = $item[0];
        const rect = el.getBoundingClientRect();
        const y = e.clientY;

        const insertPosition = y - rect.top < rect.height / 2 ? 'before' : 'after';
        
        if (this._dragOverListItemEl && this._dragOverListItemEl !== el) {
            this._dragOverListItemEl.classList.remove(
                'sun-listItemDragOverTop',
                'sun-listItemDragOverBottom'
            );
        }
        this._dragOverListItemEl = el;
    
        if (insertPosition === 'before') {
            $item.addClass('sun-listItemDragOverTop');
            $item.removeClass('sun-listItemDragOverBottom');
        } else {
            $item.addClass('sun-listItemDragOverBottom');
            $item.removeClass('sun-listItemDragOverTop');
        }
    }
    
    /** Drop группы: перестановка в массиве groups/personGroups. */
    handleDrop(e) {
        const nested = this.nestedItemDragPayload;
        if (nested && (nested.type === 'wave' || nested.type === 'date')) {
            e.preventDefault();
            return;
        }

        try {
            const textData = e.originalEvent.dataTransfer.getData('text');
            if (textData === 'WAVE_DRAG') {
                return;
            }
        } catch (error) {}
        
        const $item = $(e.currentTarget);
        e.preventDefault();
        
        $('.sun-listItem').removeClass('sun-listItemDragOverTop sun-listItemDragOverBottom');
        
        try {
            const dragData = JSON.parse(e.originalEvent.dataTransfer.getData('text/plain'));
            
            if (dragData && (dragData.type === 'wave' || dragData.type === 'date' || dragData.isWaveDrag)) {
                return;
            }
            
            const targetType = $item.data('type');

            if (dragData.type !== targetType) {
                return;
            }
            
            const targetIndex = parseInt($item.data('index') || 0, 10);
            const targetId = $item.data('id');
            
            const rect = $item[0].getBoundingClientRect();
            const y = e.clientY;
            const insertBefore = y - rect.top < rect.height / 2;
            
            if (dragData.type === 'group' && String(dragData.id) === String(targetId)) {
                return;
            }
            if (dragData.type === 'personGroup' && String(dragData.id) === String(targetId)) {
                return;
            }
            if (dragData.type === 'group') {
                window.sunPerfLog('eventManager', 'drop.group', {
                    fromId: dragData.id,
                    targetId,
                    fromIndex: dragData.index,
                    targetIndex,
                    insertBefore
                });
                this.handleGroupDrop(dragData, targetIndex, insertBefore, targetId);
            } else if (dragData.type === 'personGroup') {
                window.sunPerfLog('eventManager', 'drop.personGroup', {
                    fromId: dragData.id,
                    targetId,
                    fromIndex: dragData.index,
                    targetIndex,
                    insertBefore
                });
                this.handlePersonGroupDrop(dragData, targetIndex, insertBefore, targetId);
            }
            
        } catch (error) {
        }
    }

    /** Id группы персон, содержащей дату. */
    findPersonGroupIdForDate(dateId) {
        const idStr = String(dateId);
        const groups = window.appState.data.personGroups || [];
        for (const g of groups) {
            if (!g.dates) continue;
            if (g.dates.some(did => String(did) === idStr)) {
                return g.id;
            }
        }
        const def = groups.find(gr => String(gr.id) === 'default-person-group');
        return def ? def.id : (groups[0] && groups[0].id);
    }

    /** Перенос или перестановка персоны между группами personGroups. */
    moveDateBetweenPersonGroups(sourceGroupId, targetGroupId, sourceIndex, targetIndex, insertBefore, opts = {}) {
        const { emptyOrGapDrop = false, sourceItemId } = opts;
        const groups = window.appState.data.personGroups || [];
        const sourceGroup = groups.find(g => String(g.id) === String(sourceGroupId));
        const targetGroup = groups.find(g => String(g.id) === String(targetGroupId));
        if (!sourceGroup || !targetGroup ||
            !Array.isArray(sourceGroup.dates) || !Array.isArray(targetGroup.dates)) {
            return;
        }
        let srcIdx = parseInt(sourceIndex, 10);
        if (!Number.isFinite(srcIdx) || srcIdx < 0) {
            srcIdx = 0;
        }
        if (sourceItemId != null && sourceItemId !== '') {
            const byId = sourceGroup.dates.findIndex((d) => String(d) === String(sourceItemId));
            if (byId >= 0) {
                srcIdx = byId;
            }
        }
        const sourceDates = [...sourceGroup.dates];
        const dateId = sourceDates[srcIdx];
        if (dateId === undefined) {
            window.sunPerfLog('eventManager', 'moveDateBetweenPersonGroups.aborted', {
                sourceGroupId,
                sourceIndex,
                srcIdx,
                sourceItemId
            });
            return;
        }
        const sameGroup = String(sourceGroupId) === String(targetGroupId);
        if (sameGroup) {
            this.reorderDateInPersonGroup(sourceGroupId, srcIdx, targetIndex, insertBefore);
            return;
        }
        sourceDates.splice(srcIdx, 1);
        sourceGroup.dates = sourceDates;
        const targetDates = [...targetGroup.dates];
        let insertAt;
        if (emptyOrGapDrop || targetDates.length === 0) {
            insertAt = targetDates.length;
        } else {
            insertAt = insertBefore ? targetIndex : targetIndex + 1;
            if (insertAt < 0) insertAt = 0;
            if (insertAt > targetDates.length) insertAt = targetDates.length;
        }
        targetDates.splice(insertAt, 0, dateId);
        targetGroup.dates = targetDates;
        this.scheduleDatesOrderDomSyncAndSave(targetGroupId, sourceGroupId);
    }

    /** Перестановка персоны внутри одной personGroup. */
    reorderDateInPersonGroup(groupId, sourceIndex, targetIndex, insertBefore) {
        const group = (window.appState.data.personGroups || []).find(g => String(g.id) === String(groupId));
        if (!group || !Array.isArray(group.dates)) return;
        const dates = [...group.dates];
        const dateId = dates[sourceIndex];
        if (dateId === undefined) return;
        dates.splice(sourceIndex, 1);
        const newIndex = this.calculateNewIndex(sourceIndex, targetIndex, insertBefore);
        dates.splice(newIndex, 0, dateId);
        group.dates = dates;
        this.scheduleDatesOrderDomSyncAndSave(groupId);
    }

    /** Применяет перестановку групп сигналов после drop. */
    handleGroupDrop(dragData, targetIndex, insertBefore, targetId) {
        const groups = window.appState.data.groups;
        let fromIdx = Number(dragData.index);
        if (!Number.isInteger(fromIdx) || fromIdx < 0 || fromIdx >= groups.length ||
            String(groups[fromIdx].id) !== String(dragData.id)) {
            fromIdx = groups.findIndex(g => String(g.id) === String(dragData.id));
        }
        if (fromIdx < 0) return;

        let toIdx = Number(targetIndex);
        if (!Number.isInteger(toIdx) || toIdx < 0 || toIdx >= groups.length ||
            String(groups[toIdx].id) !== String(targetId)) {
            toIdx = groups.findIndex(g => String(g.id) === String(targetId));
        }
        if (toIdx < 0) return;

        const [movedItem] = groups.splice(fromIdx, 1);
        let newIndex = this.calculateNewIndex(fromIdx, toIdx, insertBefore);
        groups.splice(newIndex, 0, movedItem);
        window.sunPerfLog('eventManager', 'handleGroupDrop.applied', {
            fromIdx,
            toIdx,
            newIndex,
            groupId: movedItem && movedItem.id
        });
        this.scheduleGroupOrderDomSyncAndSave();
    }

    /** Применяет перестановку групп персон после drop. */
    handlePersonGroupDrop(dragData, targetIndex, insertBefore, targetId) {
        const groups = window.appState.data.personGroups || [];
        let fromIdx = Number(dragData.index);
        if (!Number.isInteger(fromIdx) || fromIdx < 0 || fromIdx >= groups.length ||
            String(groups[fromIdx].id) !== String(dragData.id)) {
            fromIdx = groups.findIndex(g => String(g.id) === String(dragData.id));
        }
        if (fromIdx < 0) return;
        let toIdx = Number(targetIndex);
        if (!Number.isInteger(toIdx) || toIdx < 0 || toIdx >= groups.length ||
            String(groups[toIdx].id) !== String(targetId)) {
            toIdx = groups.findIndex(g => String(g.id) === String(targetId));
        }
        if (toIdx < 0) return;
        const [movedItem] = groups.splice(fromIdx, 1);
        let newIndex = this.calculateNewIndex(fromIdx, toIdx, insertBefore);
        groups.splice(newIndex, 0, movedItem);
        this.schedulePersonGroupOrderDomSyncAndSave();
    }
    
    /** Убирает подсветку drag-over при уходе курсора. */
    handleDragLeave(e) {
        const $item = $(e.currentTarget);
        const el = $item[0];
        
        if (e.originalEvent.relatedTarget && 
            !el.contains(e.originalEvent.relatedTarget)) {
            
            $item.removeClass('sun-listItemDragOverTop sun-listItemDragOverBottom');
            if (this._dragOverListItemEl === el) {
                this._dragOverListItemEl = null;
            }
        }
    }
    
    /** Очистка состояния DnD групп после завершения перетаскивания. */
    handleDragEnd(e) {
        const t = e.target;
        if (!t || !t.closest) return;
        if (t.closest('.sun-listItemWave')) {
            return;
        }
        if (t.closest('.sun-dateListForDates .sun-dateDragHandle')) {
            return;
        }
        const $row = $(t).closest('.sun-listItemGroup[data-type="group"], .sun-listItemPersonGroup[data-type="personGroup"]');
        if (!$row.length) {
            return;
        }
        this.nestedItemDragPayload = null;
        this.clearNestedDnDVisualState();
        if (this._dragOverListItemEl) {
            this._dragOverListItemEl.classList.remove(
                'sun-listItemDragOverTop',
                'sun-listItemDragOverBottom'
            );
            this._dragOverListItemEl = null;
        }
        $('.sun-listItem').removeClass('sun-listItemDragging sun-listItemDragOverTop sun-listItemDragOverBottom');
        window.sunPerfLog('eventManager', 'dragend.groupOrPersonGroup', { targetTag: t.tagName });
    }
    
    /** Клик по строке персоны активирует setActiveDate. */
    setupDateChangeObservers() {
        $(document).on('click', '.sun-listItemDate[data-type="date"]', (e) => {
            const $target = $(e.target);
            const $item = $target.closest('.sun-listItemDate');
            
            if ($target.is('.sun-dateCheckbox') || $target.closest('.sun-dateCheckbox').length) {
                return;
            }
            
            if ($target.is('button, input, textarea, select, .sun-listItemDragHandle, .sun-dateDragHandle, .sun-deleteDateBtn, .sun-editBtn')) {
                return;
            }
            
            if ($item.hasClass('sun-listItemEditing')) {
                return;
            }
            
            if ($item.length) {
                e.preventDefault();
                e.stopPropagation();
                
                const dateId = $item.data('id');
                
                if (dateId && window.dates) {
                    if (!window.appState.dateSelections) {
                        window.appState.dateSelections = {
                            typeA: null,
                            typeB: null
                        };
                    }
                    window.dates.setActiveDate(dateId, true);
                }
            }
        });
    }

    /** Обработка чекбоксов типа A/B у персон. */
    setupDateSelectionHandlers() {
        $(document).on('click', '.sun-dateCheckbox', async (e) => {
            e.preventDefault();
            e.stopPropagation();
            
            // У input есть DOM-свойство type === "checkbox"; jQuery .data('type') может вернуть его
            // вместо атрибута data-type="a"|"b" — чекбоксы A/B перестают обрабатываться.
            const el = e.currentTarget;
            const dateId = el.getAttribute('data-id');
            const checkboxType = el.getAttribute('data-type');
            window.sunDateListLog && window.sunDateListLog('checkbox:click dom', {
                dateId,
                checkboxType,
                nativeChecked: el.checked,
                dateSelectionsBefore: window.appState.dateSelections
                    ? { ...window.appState.dateSelections }
                    : null
            });
            
            await this.handleDateCheckboxClick(dateId, checkboxType, el);
        });
    }

    /**
     * После асинхронного updateDateList ещё раз выставить :checked (Firefox + preventDefault на click).
     */
    _pinClickedDateCheckboxVisual(checkboxEl, dateId, checkboxType) {
        const settle = () => {
            if (window.unifiedListManager && window.unifiedListManager.syncDateListSelectionVisuals) {
                window.unifiedListManager.syncDateListSelectionVisuals();
            }
            if (!checkboxEl || !checkboxEl.isConnected || !window.appState.dateSelections) {
                return;
            }
            const idStr = String(dateId);
            const ds = window.appState.dateSelections;
            if (checkboxType === 'a') {
                checkboxEl.checked = ds.typeA != null && String(ds.typeA) === idStr;
            } else if (checkboxType === 'b') {
                checkboxEl.checked = ds.typeB != null && String(ds.typeB) === idStr;
            }
        };
        settle();
        requestAnimationFrame(() => {
            settle();
        });
    }

    /**
     * Завершение клика по чекбоксу A/B: без повторного updateDateList после setActiveDate.
     * @param {{ activeDateChanged?: boolean, changedType?: 'a'|'b'|'both' }} opts
     */
    _finishDateCheckboxChange(clickedEl, dateId, checkboxType, opts = {}) {
        const activeDateChanged = opts.activeDateChanged === true;
        const changedType = opts.changedType || checkboxType;

        if (!activeDateChanged) {
            if (window.dataManager && window.dataManager.applyDateSelectionChange) {
                window.dataManager.applyDateSelectionChange(changedType);
            } else if (window.dataManager && window.dataManager.updateDateList) {
                window.dataManager.updateDateList();
            } else if (window.unifiedListManager && window.unifiedListManager.updateDatesList) {
                window.unifiedListManager.updateDatesList();
            }
        }

        this._pinClickedDateCheckboxVisual(clickedEl, dateId, checkboxType);
    }

    /** Логика выбора персон A и B с разрешением конфликтов. */
    async handleDateCheckboxClick(dateId, checkboxType, clickedEl) {
        window.sunDateListLog && window.sunDateListLog('handleDateCheckboxClick:enter', { dateId, checkboxType });
        if (checkboxType !== 'a' && checkboxType !== 'b') {
            window.sunDateListLog && window.sunDateListLog('handleDateCheckboxClick:skip bad type');
            return;
        }
        if (!window.appState.dateSelections) {
            window.appState.dateSelections = {
                typeA: null,
                typeB: null
            };
        }
        
        const selections = window.appState.dateSelections;
        const dateIdStr = String(dateId);
        const targetKey = checkboxType === 'a' ? 'typeA' : 'typeB';
        
        const currentTargetStr = selections[targetKey] ? String(selections[targetKey]) : null;
        
        if (checkboxType === 'b' && selections.typeA && String(selections.typeA) === dateIdStr) {
            const allDates = window.appState.data.dates || [];
            const newTypeADate = allDates.find(date => String(date.id) !== dateIdStr);
            
            if (newTypeADate) {
                selections.typeA = newTypeADate.id;
                let activeDateChanged = false;

                if (window.appState.activeDateId && String(window.appState.activeDateId) === dateIdStr) {
                    if (window.dates) {
                        window.dates.setActiveDate(newTypeADate.id, true);
                        activeDateChanged = true;
                    }
                }
                
                selections.typeB = dateId;
                if (window.appState.saveDebounced) {
                    window.appState.saveDebounced();
                } else {
                    window.appState.save();
                }
                this._finishDateCheckboxChange(clickedEl, dateId, checkboxType, {
                    activeDateChanged,
                    changedType: 'both'
                });
                return;
            } else {
                window.sunDateListLog && window.sunDateListLog('handleDateCheckboxClick:B conflict no other date for A');
                return;
            }
        }

        if (checkboxType === 'a' && selections.typeB && String(selections.typeB) === dateIdStr) {
            const allDatesAonB = window.appState.data.dates || [];
            const newTypeBDate = allDatesAonB.find((date) => String(date.id) !== dateIdStr);
            if (newTypeBDate) {
                selections.typeA = dateId;
                selections.typeB = newTypeBDate.id;
                if (window.dates) {
                    window.dates.setActiveDate(dateId, true);
                }
                this._finishDateCheckboxChange(clickedEl, dateId, checkboxType, {
                    activeDateChanged: true,
                    changedType: 'both'
                });
                return;
            }
            window.sunDateListLog && window.sunDateListLog('handleDateCheckboxClick:A conflict no other date for B');
            return;
        }
        
        if (checkboxType === 'a') {
            if (currentTargetStr === dateIdStr) {
                window.sunDateListLog && window.sunDateListLog('handleDateCheckboxClick:early return A already selected');
                if (clickedEl) {
                    clickedEl.checked = true;
                }
                if (window.unifiedListManager && window.unifiedListManager.syncDateListSelectionVisuals) {
                    window.unifiedListManager.syncDateListSelectionVisuals();
                }
                this._pinClickedDateCheckboxVisual(clickedEl, dateId, checkboxType);
                return;
            } else {
                selections.typeA = dateId;
                
                if (window.dates) {
                    window.sunDateListLog && window.sunDateListLog('handleDateCheckboxClick:call setActiveDate', {
                        dateId,
                        dateSelections: { ...selections }
                    });
                    window.dates.setActiveDate(dateId, true);
                    this._finishDateCheckboxChange(clickedEl, dateId, checkboxType, {
                        activeDateChanged: true
                    });
                    return;
                }
            }
        } else if (checkboxType === 'b') {
            if (currentTargetStr === dateIdStr) {
                selections.typeB = null;
            } else {
                selections.typeB = dateId;
            }
        }
        
        window.appState.save();
        window.sunDateListLog && window.sunDateListLog('handleDateCheckboxClick:after mutate', {
            dateSelections: { ...window.appState.dateSelections },
            activeDateId: window.appState.activeDateId
        });
        this._finishDateCheckboxChange(clickedEl, dateId, checkboxType, { activeDateChanged: false });
        window.sunDateListLog && window.sunDateListLog('handleDateCheckboxClick:done');
    }
    
    /** Центральный роутер кликов: вкладки, кнопки, волны, expand. */
    handleClick(e) {
        const $target = $(e.target);
        
        if ($target.is('.sun-btnPrevDay, .sun-btnNextDay, .sun-btnToday, .sun-btnNow, .sun-btnSetDate') ||
            $target.closest('.sun-btnPrevDay, .sun-btnNextDay, .sun-btnToday, .sun-btnNow, .sun-btnSetDate').length) {
            e.preventDefault();
        }

        const $actionBtn = $target.closest('[data-action]');
        if ($actionBtn.length) {
            e.preventDefault();
            e.stopPropagation();
            const action = $actionBtn.data('action');
            
            if (action === 'toggleExtremes') {
                if (window.uiManager && window.uiManager.toggleExtremes) {
                    window.uiManager.toggleExtremes();
                    return;
                }
            }
            
            if (action === 'toggleEquilibrium') {
                if (window.uiManager && window.uiManager.toggleEquilibrium) {
                    window.uiManager.toggleEquilibrium();
                    return;
                }
            }
            
            if (window.uiManager && action) {
                window.uiManager.handleAction(action, $actionBtn[0]);
                return;
            }
        }
        
        // Только верхние вкладки панели ([data-tab]); не подвкладки сравнения дат (.dateComparisonViewTab).
        if ($target.hasClass('sun-tabButton') && $target.is('[data-tab]')) {
            e.preventDefault();
            e.stopPropagation();
            if (window.uiManager) {
                window.uiManager.handleTabClick($target[0]);
            }
            return;
        }
        
        const $expandBtn = $target.closest('.sun-expandCollapseBtn');
        if ($expandBtn.length) {
            e.preventDefault();
            e.stopPropagation();
            const id = $expandBtn.data('id');
            const btnType = $expandBtn.data('type');
            
            if (id && window.unifiedListManager) {
                if (btnType === 'personGroup') {
                    const group = (window.appState.data.personGroups || []).find(g => String(g.id) === String(id));
                    if (group) {
                        group.expanded = !group.expanded;
                        window.appState.save();
                        const groupElement = document.querySelector(`.sun-listItemPersonGroup[data-id="${id}"]`);
                        if (groupElement) {
                            groupElement.classList.toggle('sun-listItemExpanded');
                            const childrenContainer = groupElement.querySelector('.sun-personGroupChildren');
                            if (childrenContainer) {
                                childrenContainer.style.display = group.expanded ? 'block' : 'none';
                                childrenContainer.classList.toggle('sun-groupChildrenOpen', group.expanded);
                            }
                            const expandBtn = groupElement.querySelector('.sun-expandCollapseBtn');
                            if (expandBtn) {
                                if (window.SUN_ACTION_LABELS && window.SUN_ACTION_LABELS.applyExpandButton) {
                                    window.SUN_ACTION_LABELS.applyExpandButton(expandBtn, group.expanded);
                                }
                            }
                        }
                    }
                } else {
                    const group = window.appState.data.groups.find(g => g.id === id);
                    if (group) {
                        group.expanded = !group.expanded;
                        window.appState.save();
                        
                        const groupElement = document.querySelector(`.sun-listItemGroup[data-id="${id}"]`);
                        if (groupElement) {
                            groupElement.classList.toggle('sun-listItemExpanded');
                            
                            const childrenContainer = groupElement.querySelector('.sun-groupChildren');
                            if (childrenContainer) {
                                childrenContainer.style.display = group.expanded ? 'block' : 'none';
                                childrenContainer.classList.toggle('sun-groupChildrenOpen', group.expanded);
                            }
                            
                            const expandBtn = groupElement.querySelector('.sun-expandCollapseBtn');
                            if (expandBtn) {
                                if (window.SUN_ACTION_LABELS && window.SUN_ACTION_LABELS.applyExpandButton) {
                                    window.SUN_ACTION_LABELS.applyExpandButton(expandBtn, group.expanded);
                                }
                            }
                        }
                    }
                }
            }
            return;
        }
        
        const $groupDeleteBtn = $target.closest('.sun-deleteDateBtn[data-type="group"]');
        if ($groupDeleteBtn.length) {
            e.preventDefault();
            e.stopPropagation();
            const id = $groupDeleteBtn.data('id');
            
            if (id && window.unifiedListManager) {
                window.unifiedListManager.handleDeleteClick(id, 'group');
            }
            return;
        }
        
        const $editBtn = $target.closest('.sun-editBtn');
        if ($editBtn.length) {
            e.preventDefault();
            e.stopPropagation();
            const id = $editBtn.data('id');
            const type = $editBtn.data('type') || 'date';
            
            if (window.unifiedListManager) {
                const containerId = this.getContainerId($target[0]);
                window.unifiedListManager.handleEditClick(id, type, containerId);
            }
            return;
        }
        
        const $deleteBtn = $target.closest('.sun-deleteDateBtn, .sun-deleteBtn');
        if ($deleteBtn.length && 
            !$target.closest('.sun-listItemNote').length && 
            $deleteBtn.data('type') !== 'group') {
            e.preventDefault();
            e.stopPropagation();
            const id = $deleteBtn.data('id');
            const type = $deleteBtn.data('type') || 'date';
            if (window.unifiedListManager) {
                window.unifiedListManager.handleDeleteClick(id, type);
            }
            return;
        }
        
        const $saveBtn = $target.closest('.sun-saveBtn');
        if ($saveBtn.length) {
            e.preventDefault();
            e.stopPropagation();
            const id = $saveBtn.data('id');
            const type = $saveBtn.data('type') || 'date';
            if (window.unifiedListManager) {
                const containerId = this.getContainerId($target[0]);
                window.unifiedListManager.handleSaveClick(id, type, containerId);
            }
            return;
        }
        
        const $cancelBtn = $target.closest('.sun-cancelBtn');
        if ($cancelBtn.length) {
            e.preventDefault();
            e.stopPropagation();
            const id = $cancelBtn.data('id');
            const type = $cancelBtn.data('type') || 'date';
            if (window.unifiedListManager) {
                const containerId = this.getContainerId($target[0]);
                window.unifiedListManager.handleCancelClick(id, type, containerId);
            }
            return;
        }
        
        if ($target.hasClass('sun-waveVisibilityCheck')) {
            e.stopPropagation();
            const waveId = $target.data('id');
            const isChecked = $target.prop('checked');
            
            this.handleWaveVisibilityChange(waveId, isChecked, $target);
            return;
        }
        
        if ($target.hasClass('sun-waveBVisibilityCheck')) {
            e.stopPropagation();
            const waveId = $target.data('id');
            const isChecked = $target.prop('checked');
            this.handleWavePersonBVisibilityChange(waveId, isChecked, $target);
            return;
        }

        if ($target.hasClass('sun-waveColorPreviewSmall')) {
            e.stopPropagation();
            const waveId = $target.data('id');
            
            if (waveId && window.unifiedListManager) {
                const wave = window.appState.data.waves.find(w => String(w.id) === String(waveId));
                if (wave) {
                    window.unifiedListManager.changeWaveColor(wave);

                    if (window.summaryManager && window.summaryManager.updateSummary) {
                        window.summaryManager.updateSummary();
                    }
                }
            }
            return;
        }

        if ($target.hasClass('sun-waveCornerColorCheck')) {
            e.stopPropagation();
            const waveId = $target.data('id');
            
            if (waveId && window.waves) {
                window.waves.setWaveCornerColor(waveId, $target.prop('checked'));

                if (window.summaryManager && window.summaryManager.updateSummary) {
                    window.summaryManager.updateSummary();
                }
            }
            return;
        }

        if ($target.hasClass('sun-waveGroupToggle')) {
            e.stopPropagation();
            const groupId = $target.data('groupId');
            const isChecked = $target.prop('checked');
            
            this.handleGroupToggle(groupId, isChecked);
            return;
        }

        if (
            $target.hasClass('sun-showOnVizorBtn') &&
            !$target.hasClass('sun-dateCompareVizorBtn') &&
            !$target.hasClass('sun-intersectionVizorBBtn')
        ) {
            e.preventDefault();
            e.stopPropagation();
            
            const waveId = $target.data('wave-id');
            
            const checkbox = $(`.sun-waveVisibilityCheck[data-id="${waveId}"]`);
            if (checkbox.length) {
                const isChecked = !checkbox.prop('checked');
                checkbox.prop('checked', isChecked);
                
                this.handleWaveVisibilityChange(waveId, isChecked, checkbox);
            }
            
            return;
        }

        if ($target.hasClass('sun-dateCompareVizorBtn')) {
            e.preventDefault();
            e.stopPropagation();
            const waveId = $target.data('wave-id');
            if (waveId) {
                this.handleDateCompareBothLayersToggle(waveId);
            }
            return;
        }
        
        this.handleButtonClicks($target, e);
    }



	/**
	 * Общая логика .sun-waveVisibilityCheck (слой A) и .sun-waveBVisibilityCheck (слой B): одно правило для выключенной группы.
	 * @param {'a'|'b'} layer — 'a' → waveVisibility; 'b' → waveBold (ключ в данных исторический).
	 */
	handleWaveLayerToggle(waveId, isChecked, $checkbox, layer) {
		const wrd = window.__waveRenderDebug;
		const layerA = layer === 'a';
		if (wrd && wrd.isEnabled && wrd.isEnabled()) {
			wrd.log('eventManager.handleWaveLayerToggle', { waveId, isChecked, layer });
		}

		if (isChecked && window.waves && window.appState) {
			const isGroupEnabled = window.waves.isWaveGroupEnabled(waveId);
			if (!isGroupEnabled) {
				const groupId = this.findGroupForWave(waveId);
				if (groupId) {
					const group = window.appState.data.groups.find((g) => g.id === groupId);
					const groupName = group ? group.name : 'Неизвестная группа';
					const shouldEnableGroup = confirm(
						`Группа "${groupName}" отключена. Включить её для отображения сигнала?`
					);
					if (shouldEnableGroup) {
						if (group) {
							group.enabled = true;
							const waveIdStr = String(waveId);
							if (layerA) {
								window.appState.waveVisibility[waveIdStr] = true;
							} else {
								window.appState.waveBold[waveIdStr] = true;
							}
							window.appState.saveDebounced();
							if (this.askedGroups.has(groupId)) {
								this.askedGroups.delete(groupId);
							}
							requestAnimationFrame(() => {
								if (
									window.unifiedListManager &&
									typeof window.unifiedListManager.updateGroupStats === 'function'
								) {
									window.unifiedListManager.updateGroupStats(groupId);
								} else if (window.unifiedListManager && window.unifiedListManager.updateWavesList) {
									window.unifiedListManager.updateWavesList();
								}

								document.querySelectorAll('.sun-waveGroupToggle').forEach((el) => {
									if (String(el.getAttribute('data-group-id')) === String(groupId)) {
										el.checked = true;
									}
								});

								this.recreateAllWaveElements();

								this.updateGroupStatsForWave(waveId, true);

								if (window.summaryManager && window.summaryManager.debouncedUpdate) {
									window.summaryManager.debouncedUpdate();
								}

								$checkbox.prop('checked', true);
								if (window.dom && window.dom.refreshShowOnVizorButtonLabels) {
									window.dom.refreshShowOnVizorButtonLabels();
								}
								if (window.extremumTimeManager && window.extremumTimeManager.updateExtremums) {
									window.extremumTimeManager.updateExtremums();
								}
							});
						}
						if (window.dom && window.dom.refreshShowOnVizorButtonLabels) {
							window.dom.refreshShowOnVizorButtonLabels();
						}
						if (window.extremumTimeManager && window.extremumTimeManager.updateExtremums) {
							window.extremumTimeManager.updateExtremums();
						}
						return;
					}
					$checkbox.prop('checked', false);
					if (window.dom && window.dom.refreshShowOnVizorButtonLabels) {
						window.dom.refreshShowOnVizorButtonLabels();
					}
					return;
				}
			}
		}

		if (waveId && window.appState) {
			const waveIdStr = String(waveId);
			if (layerA) {
				const endVis =
					wrd && wrd.isEnabled && wrd.isEnabled()
						? wrd.t('eventManager.handleWaveVisibilityChange.apply', { waveId, isChecked })
						: null;
				window.appState.waveVisibility[waveIdStr] = isChecked;
				window.appState.saveDebounced();

				const wave = window.appState.data.waves.find((w) => String(w.id) === waveIdStr);
				const isGroupEnabled = window.waves.isWaveGroupEnabled(waveId);
				const shouldShow = isChecked && isGroupEnabled;

				if (
					wave &&
					typeof window.waves.waveNeedsGraphContainer === 'function' &&
					window.waves.waveNeedsGraphContainer(waveId) &&
					!window.waves.waveContainers[waveId]
				) {
					window.waves.createWaveElement(wave);
				}

				if (window.waves && window.waves.updatePosition) {
					window.waves.updatePosition({ forceWaveLabels: true });
				}

				this.updateGroupStatsForWave(waveId, isChecked);

				if (window.summaryManager && window.summaryManager.debouncedUpdate) {
					window.summaryManager.debouncedUpdate();
				}

				if (window.dom && window.dom.refreshShowOnVizorButtonLabels) {
					window.dom.refreshShowOnVizorButtonLabels();
				}
				if (window.extremumTimeManager && window.extremumTimeManager.updateExtremums) {
					window.extremumTimeManager.updateExtremums();
				}
				endVis && endVis({ shouldShow });
			} else {
				window.appState.waveBold[waveIdStr] = isChecked;
				window.appState.saveDebounced();
				if (window.waves) {
					if (typeof window.waves.reconcileVisibleWaveElements === 'function') {
						window.waves.reconcileVisibleWaveElements();
					} else if (window.waves.updatePosition) {
						window.waves.updatePosition({ forceWaveLabels: true });
					}
				}
				this.updateGroupStatsForWave(waveId, isChecked);
				if (window.summaryManager && window.summaryManager.debouncedUpdate) {
					window.summaryManager.debouncedUpdate();
				}
				if (window.dom && window.dom.refreshShowOnVizorButtonLabels) {
					window.dom.refreshShowOnVizorButtonLabels();
				}
				if (window.extremumTimeManager && window.extremumTimeManager.updateExtremums) {
					window.extremumTimeManager.updateExtremums();
				}
			}
		}
	}

	handleWaveVisibilityChange(waveId, isChecked, $checkbox) {
		this.handleWaveLayerToggle(waveId, isChecked, $checkbox, 'a');
	}

	/** Есть ли выбранная персона B (чекбокс типа B в списке дат). */
	_isPersonBDateSelected() {
		const root = window.dom.byKey('dateListForDates');
		if (root) {
			const bChecked = root.querySelector('input.sun-dateCheckbox[data-type="b"]:checked');
			if (bChecked) {
				return true;
			}
		}
		const ds = window.appState && window.appState.dateSelections;
		return !!(ds && ds.typeB != null && String(ds.typeB) !== '');
	}

	/** Пара handleWaveVisibilityChange: слой B, чекбокс .sun-waveBVisibilityCheck. */
	handleWavePersonBVisibilityChange(waveId, isChecked, $checkbox) {
		if (isChecked && !this._isPersonBDateSelected()) {
			alert('Волна не появится, пока не будет включена персона B.');
		}
		this.handleWaveLayerToggle(waveId, isChecked, $checkbox, 'b');
	}

	/**
	 * Фактическое состояние чекбоксов A/B у волны: приоритет DOM (как видит пользователь),
	 * иначе как в unifiedListManager.syncWavesListVisibilityFromAppState.
	 */
	_readWaveLayerCheckboxStates(wid) {
		const idStr = String(wid);
		const matchId = (cb) => String(cb.getAttribute('data-id') || '') === idStr;
		const root = window.dom.byKey('wavesList');
		let elA = root
			? Array.from(root.querySelectorAll('.sun-waveVisibilityCheck')).find(matchId)
			: null;
		let elB = root
			? Array.from(root.querySelectorAll('.sun-waveBVisibilityCheck')).find(matchId)
			: null;
		if (!elA) {
			elA = Array.from(document.querySelectorAll('.sun-waveVisibilityCheck')).find(matchId) || null;
		}
		if (!elB) {
			elB = Array.from(document.querySelectorAll('.sun-waveBVisibilityCheck')).find(matchId) || null;
		}
		const aChecked = elA
			? elA.checked
			: window.appState.waveVisibility[idStr] !== false;
		const bChecked = elB
			? elB.checked
			: window.appState.waveBold[idStr] === true;
		return { aChecked, bChecked };
	}

	/**
	 * Выставить оба чекбокса волны в DOM без селектора [data-id="…"] (спецсимволы в id ломают querySelector).
	 */
	_syncWaveABCheckboxesDom(wid, checked) {
		const idStr = String(wid);
		const match = (cb) => String(cb.getAttribute('data-id') || '') === idStr;
		document.querySelectorAll('.sun-waveVisibilityCheck').forEach((cb) => {
			if (match(cb)) {
				cb.checked = checked;
			}
		});
		document.querySelectorAll('.sun-waveBVisibilityCheck').forEach((cb) => {
			if (match(cb)) {
				cb.checked = checked;
			}
		});
	}

	/**
	 * Таблица «Сравнение дат»: синхронно включить или выключить оба чекбокса волны (A и B),
	 * без смены активной даты / селектов сравнения — только waveVisibility и waveBold.
	 */
	handleDateCompareBothLayersToggle(waveId) {
		const wid = String(waveId);
		if (!window.appState || !window.waves) {
			return;
		}

		const groupEnabled =
			typeof window.waves.isWaveGroupEnabled === 'function'
				? window.waves.isWaveGroupEnabled(waveId)
				: true;
		const { aChecked, bChecked } = this._readWaveLayerCheckboxStates(wid);
		let wantOn;
		if (!groupEnabled) {
			/* Группа выключена — всегда шаг «включить оба» (после confirm группы). */
			wantOn = true;
		} else {
			/* Группа включена: оба чекбокса уже включены → выключаем оба; иначе включаем оба (синхронизация). */
			wantOn = !(aChecked && bChecked);
		}

		const afterGraphUpdate = () => {
			if (
				window.unifiedListManager &&
				typeof window.unifiedListManager.syncWavesListVisibilityFromAppState === 'function' &&
				window.unifiedListManager.syncWavesListVisibilityFromAppState()
			) {
				/* чекбоксы A/B всех волн из appState */
			} else {
				this._syncWaveABCheckboxesDom(wid, wantOn);
			}
			this.updateGroupStatsForWave(waveId, wantOn);
			if (window.summaryManager && window.summaryManager.debouncedUpdate) {
				window.summaryManager.debouncedUpdate();
			}
			if (window.dom && window.dom.refreshShowOnVizorButtonLabels) {
				window.dom.refreshShowOnVizorButtonLabels();
			}
			if (window.extremumTimeManager && window.extremumTimeManager.updateExtremums) {
				window.extremumTimeManager.updateExtremums();
			}
		};

		if (wantOn && !groupEnabled) {
			const groupId = this.findGroupForWave(waveId);
			if (!groupId) {
				return;
			}
			const group = window.appState.data.groups.find((g) => g.id === groupId);
			const groupName = group ? group.name : 'Неизвестная группа';
			const shouldEnable = confirm(
				`Группа "${groupName}" отключена. Включить её для отображения сигнала?`
			);
			if (!shouldEnable || !group) {
				return;
			}
			group.enabled = true;
			window.appState.waveVisibility[wid] = true;
			window.appState.waveBold[wid] = true;
			window.appState.saveDebounced();
			if (this.askedGroups.has(groupId)) {
				this.askedGroups.delete(groupId);
			}
			requestAnimationFrame(() => {
				if (
					window.unifiedListManager &&
					typeof window.unifiedListManager.updateGroupStats === 'function'
				) {
					window.unifiedListManager.updateGroupStats(groupId);
				} else if (window.unifiedListManager && window.unifiedListManager.updateWavesList) {
					window.unifiedListManager.updateWavesList();
				}
				document.querySelectorAll('.sun-waveGroupToggle').forEach((el) => {
					if (String(el.getAttribute('data-group-id')) === String(groupId)) {
						el.checked = true;
					}
				});
				this.recreateAllWaveElements();
				this.updateGroupStatsForWave(waveId, true);
				afterGraphUpdate();
			});
			if (window.dom && window.dom.refreshShowOnVizorButtonLabels) {
				window.dom.refreshShowOnVizorButtonLabels();
			}
			return;
		}

		if (wantOn) {
			window.appState.waveVisibility[wid] = true;
			window.appState.waveBold[wid] = true;
			window.appState.saveDebounced();
		} else {
			window.appState.waveVisibility[wid] = false;
			window.appState.waveBold[wid] = false;
			window.appState.saveDebounced();
		}

		const wave = window.appState.data.waves.find((w) => String(w.id) === wid);
		const noContainerYet =
			wave &&
			!window.waves.waveContainers[wave.id] &&
			!window.waves.waveContainers[waveId] &&
			!window.waves.waveContainers[wid];
		if (
			wantOn &&
			wave &&
			typeof window.waves.waveNeedsGraphContainer === 'function' &&
			window.waves.waveNeedsGraphContainer(waveId) &&
			noContainerYet
		) {
			window.waves.createWaveElement(wave);
		}

		if (typeof window.waves.reconcileVisibleWaveElements === 'function') {
			window.waves.reconcileVisibleWaveElements();
		} else if (window.waves.updatePosition) {
			window.waves.updatePosition({ forceWaveLabels: true });
		}

		afterGraphUpdate();
	}

    /** Вкл/выкл всей группы сигналов и пересоздание DOM волн. */
    handleGroupToggle(groupId, isChecked) {
        if (groupId && window.appState) {
            const group = window.appState.data.groups.find(g => g.id === groupId);
            if (group) {
                group.enabled = isChecked;
                window.appState.saveDebounced();

                if (isChecked && this.askedGroups.has(groupId)) {
                    this.askedGroups.delete(groupId);
                }

                requestAnimationFrame(() => {
                    $('.sun-waveContainer').remove();
                    if (window.waves) {
                        window.waves.clearWaveDomReferences();
                    }

                    window.appState.data.waves.forEach((wave) => {
                        if (
                            typeof window.waves.waveNeedsGraphContainer === 'function' &&
                            window.waves.waveNeedsGraphContainer(wave.id)
                        ) {
                            window.waves.createWaveElement(wave);
                        }
                    });

                    if (window.waves.updatePosition) {
                        window.waves.updatePosition();
                    }

                    if (window.unifiedListManager && typeof window.unifiedListManager.updateGroupStats === 'function') {
                        window.unifiedListManager.updateGroupStats(groupId);
                    } else if (window.unifiedListManager && window.unifiedListManager.updateWavesList) {
                        window.unifiedListManager.updateWavesList();
                    }

                    if (window.summaryManager && window.summaryManager.debouncedUpdate) {
                        window.summaryManager.debouncedUpdate();
                    } else if (window.summaryManager && window.summaryManager.updateSummary) {
                        window.summaryManager.updateSummary();
                    }

                    if (window.dom && window.dom.refreshShowOnVizorButtonLabels) {
                        window.dom.refreshShowOnVizorButtonLabels();
                    }
                    if (window.extremumTimeManager && window.extremumTimeManager.updateExtremums) {
                        window.extremumTimeManager.updateExtremums();
                    }

                });
            }
        }
    }
    
    /** Обработка кнопок навигации, добавления групп и импорта. */
    handleButtonClicks($target, e) {
        if ($target.is('.sun-btnAddCustomWave') || $target.closest('.sun-btnAddCustomWave').length) {
            e.preventDefault();
            e.stopPropagation();
            
            const name = window.dom.jq('customWaveName').val();
            const period = window.dom.jq('customWavePeriod').val();
            const type = window.dom.jq('customWaveType').val();
            const color = window.dom.jq('customWaveColor').val();
            
            if (name && period) {
                const newWave = window.waves.addCustomWave(name, period, type, color);
                if (newWave && window.unifiedListManager) {
                    window.unifiedListManager.updateWavesList();
                    
                    window.dom.jq('customWaveName').val('');
                    window.dom.jq('customWavePeriod').val('');
                    window.dom.jq('customWaveColor').val('#666666');
                    
                    const defaultGroup = window.appState.data.groups.find(g => g.id === 'default-group');
                    if (defaultGroup && window.unifiedListManager.updateGroupStats) {
                        window.unifiedListManager.updateGroupStats('default-group');
                    }
                    
                    if (window.summaryManager && window.summaryManager.updateSummary) {
                        window.summaryManager.updateSummary();
                    }
                }
            }
            return;
        }

        if ($target.is('.sun-btnPrevDay') || $target.closest('.sun-btnPrevDay').length) {
            e.preventDefault();
            if (window.dates) window.dates.navigateDay(-1);
            return;
        }
        
        if ($target.is('.sun-btnNextDay') || $target.closest('.sun-btnNextDay').length) {
            e.preventDefault();
            if (window.dates) window.dates.navigateDay(1);
            return;
        }
        
        if ($target.is('.sun-btnSetDate') || $target.closest('.sun-btnSetDate').length) {
            e.preventDefault();
            if (window.dates) window.dates.setDateFromInput();
            return;
        }
        
        if ($target.is('.sun-btnAddGroup') || $target.closest('.sun-btnAddGroup').length) {
            e.preventDefault();
            const groupName = window.dom.jq('newGroupName').val();
            if (groupName && window.dates) {
                const newGroup = window.dates.addGroup(groupName);
                if (window.displayViewTemplatesManager && newGroup) {
                    window.displayViewTemplatesManager.onNewGroupAdded(newGroup);
                }
                if (window.dataManager) window.dataManager.updateWavesGroups();
                window.dom.jq('newGroupName').val('');
                
                if (window.summaryManager && window.summaryManager.updateSummary) {
                    window.summaryManager.updateSummary();
                }
            }
            return;
        }

        if ($target.is('[data-action="importAll"]')) {
            e.preventDefault();
            window.dom.jq('importAllFile').click();
            return;
        }
        
        if ($target.hasClass('sun-spoilerToggle')) {
            e.preventDefault();
            e.stopPropagation();
            if (window.uiManager && window.uiManager.toggleSpoiler) {
                window.uiManager.toggleSpoiler($target[0]);
            }
            return;
        }
    }
    
    /** Id ближайшего .sun-listContainer для контекста редактирования. */
    getContainerId(element) {
        const $container = $(element).closest('.sun-listContainer');
        if (!$container.length) {
            return null;
        }
        if ($container.hasClass('sun-dateListForDates')) {
            return 'dateListForDates';
        }
        if ($container.hasClass('sun-wavesList')) {
            return 'wavesList';
        }
        return null;
    }
    
    /** Id группы сигналов, содержащей волну. */
    findGroupForWave(waveId) {
        if (!window.appState || !window.appState.data || !window.appState.data.groups) {
            return null;
        }
        
        const waveIdStr = String(waveId);
        
        for (const group of window.appState.data.groups) {
            if (group.waves && Array.isArray(group.waves)) {
                const hasWave = group.waves.some(wId => String(wId) === waveIdStr);
                if (hasWave) {
                    return group.id;
                }
            }
        }
        
        return null;
    }
    
    /** Обновляет счётчики A/B в заголовке группы волны. */
    updateGroupStatsForWave(waveId, isVisible) {
        if (window.appState && window.appState.data && window.appState.data.groups) {
            window.appState.data.groups.forEach(group => {
                if (group.waves && Array.isArray(group.waves)) {
                    const waveInGroup = group.waves.some(wId => String(wId) === String(waveId));
                    if (waveInGroup) {
                        if (window.unifiedListManager && window.unifiedListManager.updateGroupStats) {
                            window.unifiedListManager.updateGroupStats(group.id);
                        }
                    }
                }
            });
        }
    }
    
    /** Полное пересоздание DOM-контейнеров волн на графике. */
    recreateAllWaveElements() {
        const wrd = window.__waveRenderDebug;
        const end = wrd && wrd.isEnabled && wrd.isEnabled() ? wrd.t('eventManager.recreateAllWaveElements', {}) : null;
        let recreated = 0;
        try {
            $('.sun-waveContainer').remove();
            if (window.waves) {
                window.waves.clearWaveDomReferences();
            }

            window.appState.data.waves.forEach((wave) => {
                if (
                    typeof window.waves.waveNeedsGraphContainer === 'function' &&
                    window.waves.waveNeedsGraphContainer(wave.id)
                ) {
                    window.waves.createWaveElement(wave);
                    recreated++;
                }
            });
            
            if (window.waves.updatePosition) {
                window.waves.updatePosition({ forceWaveLabels: true });
            }
        } finally {
            end && end({ recreatedCount: recreated, totalWaves: window.appState.data.waves.length });
        }
    }
    
    /** Клики на вкладке пересечений (очистка выбора). */
    setupIntersectionHandlers() {
        $(document).on('click', (e) => {
            this.handleIntersectionClick(e);
        });
    }
    
    /** Toggle видимости волны из строки пересечения. */
    handleIntersectionClick(e) {
        const $target = $(e.target);
        
        if ($target.is('.sun-btnClearWaveSelection') || $target.closest('.sun-btnClearWaveSelection').length) {
            e.preventDefault();
            e.stopPropagation();
            
            if (window.stateIntersectionManager) {
                window.stateIntersectionManager.clearSelection();
            }
            return;
        }
        
        const $intersectionItem = $target.closest('.sun-summaryItem');
        if ($intersectionItem.length && 
            !$target.is('button') && 
            !$target.hasClass('sun-showOnVizorBtn')) {
            
            e.preventDefault();
            e.stopPropagation();
            
            const waveId = $intersectionItem.find('.sun-showOnVizorBtn').data('wave-id');
            if (waveId && window.waves) {
                const wave = window.appState.data.waves.find(w => String(w.id) === String(waveId));
                if (wave) {
                    const checkbox = $(`.sun-waveVisibilityCheck[data-id="${waveId}"]`);
                    if (checkbox.length) {
                        const isChecked = !checkbox.prop('checked');
                        checkbox.prop('checked', isChecked);
                        this.handleWaveVisibilityChange(waveId, isChecked, checkbox);
                    }
                }
            }
            return;
        }
    }
}

window.eventManager = new EventManager();