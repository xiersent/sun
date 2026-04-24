// modules/eventManager.js
/** Профилирование UI: логи в консоль с префиксом [SunPerf]. Отключить: window.__SUN_PERF_LOG = false */
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
        this.isDraggingWave = false;
        this.waveDragPayload = null;
        this._dragOverListItemEl = null;
        this._waveDragOverItemEl = null;
        this._groupChildrenDropEl = null;
        this._wavesUiRefreshScheduled = null;
        this._datesUiRefreshScheduled = null;
        this.isDraggingPersonDate = false;
        this._personDateDragOverItemEl = null;
        this._personGroupChildrenDropEl = null;
        this.$ = window.jQuery;
        this.setupGlobalHandlers();
        this.setupDateChangeObservers();
        this.setupIntersectionHandlers();
        this.setupDateSelectionHandlers();
    }
    
    setupGlobalHandlers() {
        $(document).on('click', (e) => {
            this.handleClick(e);
        });

        $(document)
            .on('dragstart', '.list-item--date[data-type="date"]:not(.list-item--editing) > .list-item__drag-handle.date-drag-handle', this.handleDragStart.bind(this))
            .on('dragover', '.list-item--date[data-type="date"]', this.handleDragOver.bind(this))
            .on('dragleave', '.list-item--date[data-type="date"]', this.handleDragLeave.bind(this))
            .on('drop', '.list-item--date[data-type="date"]', this.handleDrop.bind(this))
            .on('dragend', '.list-item--date .date-drag-handle', this.handleDragEnd.bind(this));
        
        $(document)
            .on('dragstart', '.list-item--group[data-type="group"]:not(.list-item--editing) > .list-item__drag-handle', this.handleDragStart.bind(this))
            .on('dragover', '.list-item--group[data-type="group"]', this.handleDragOver.bind(this))
            .on('dragleave', '.list-item--group[data-type="group"]', this.handleDragLeave.bind(this))
            .on('drop', '.list-item--group[data-type="group"]', this.handleDrop.bind(this))
            .on('dragend', '.list-item--group[data-type="group"]:not(.list-item--editing) > .list-item__drag-handle', this.handleDragEnd.bind(this));

        $(document)
            .on('dragstart', '.list-item--person-group[data-type="personGroup"]:not(.list-item--editing) > .list-item__drag-handle', this.handleDragStart.bind(this))
            .on('dragover', '.list-item--person-group[data-type="personGroup"]', this.handleDragOver.bind(this))
            .on('dragleave', '.list-item--person-group[data-type="personGroup"]', this.handleDragLeave.bind(this))
            .on('drop', '.list-item--person-group[data-type="personGroup"]', this.handleDrop.bind(this))
            .on('dragend', '.list-item--person-group[data-type="personGroup"]:not(.list-item--editing) > .list-item__drag-handle', this.handleDragEnd.bind(this));
            
        $(document)
            .on('dragover', '.group-children', this.handleGroupChildrenDragOver.bind(this))
            .on('dragleave', '.group-children', this.handleGroupChildrenDragLeave.bind(this))
            .on('drop', '.group-children', this.handleGroupChildrenWaveDrop.bind(this));

        $(document)
            .on('dragstart', '.group-children .list-item--wave:not(.list-item--editing) > .list-item__drag-handle.wave-drag-handle', this.handleWaveDragStart.bind(this))
            .on('dragover', '.group-children .list-item--wave', this.handleWaveDragOver.bind(this))
            .on('dragleave', '.group-children .list-item--wave', this.handleWaveDragLeave.bind(this))
            .on('drop', '.group-children .list-item--wave', this.handleWaveDrop.bind(this))
            .on('dragend', '.group-children .list-item--wave:not(.list-item--editing) > .list-item__drag-handle.wave-drag-handle', this.handleWaveDragEnd.bind(this));

        $(document)
            .on('dragover', '.person-group-children', this.handlePersonGroupChildrenDragOver.bind(this))
            .on('dragleave', '.person-group-children', this.handlePersonGroupChildrenDragLeave.bind(this))
            .on('drop', '.person-group-children', this.handlePersonGroupChildrenDateDrop.bind(this));

		$(document).on('click', '.group-enabled-count', (e) => {
			e.preventDefault();
			e.stopPropagation();
			window.sunPerfLog('eventManager', 'click.groupEnabledCount', { target: 'group-stats' });
			
			// Находим родительскую группу
			const $groupItem = $(e.target).closest('.list-item--group');
			if (!$groupItem.length) return;
			
			const groupId = $groupItem.data('id');
			if (!groupId) return;
			
			const group = window.appState.data.groups.find(g => String(g.id) === String(groupId));
			if (!group || !group.waves) return;
			
			// Снимаем чекбоксы всех сигналов в группе
			group.waves.forEach(waveId => {
				const waveIdStr = String(waveId);
				window.appState.waveVisibility[waveIdStr] = false;
				
				// Снимаем чекбокс в интерфейсе
				const checkbox = document.querySelector(`.wave-visibility-check[data-id="${waveId}"]`);
				if (checkbox) checkbox.checked = false;
			});
			
			window.appState.save();
			
			// Обновляем статистику группы (спан "Включено" исчезнет)
			if (window.unifiedListManager) {
				window.unifiedListManager.updateGroupStats(groupId);
			}
			
			// Обновляем отображение волн
			if (window.waves) window.waves.updatePosition();
			if (window.summaryManager) window.summaryManager.updateSummary();
		});
    }
    
    handleWaveDragStart(e) {
        const $item = $(e.currentTarget).closest('.list-item--wave');
        const $group = $item.closest('.list-item--group');
        const waveId = $item.data('id');
        const index = parseInt($item.data('index') || 0, 10);
        const groupId = $group.data('id');
        
        if (waveId == null || waveId === '' || index < 0 || groupId == null || groupId === '') {
            e.preventDefault();
            return;
        }

        this.isDraggingPersonDate = false;
        this._waveDragOverItemEl = null;
        this._groupChildrenDropEl = null;
        this.isDraggingWave = true;
        this.waveDragPayload = {
            type: 'wave',
            id: waveId,
            index: index,
            groupId: groupId,
            source: 'wave-drag'
        };
        
        e.originalEvent.dataTransfer.effectAllowed = 'move';
        e.originalEvent.dataTransfer.setData('text/plain', JSON.stringify(this.waveDragPayload));
        
        $item.addClass('list-item--dragging');
        window.sunPerfLog('eventManager', 'wave.dragstart', {
            waveId: waveId,
            groupId: groupId,
            index: index
        });
    }

    getWaveDragDataFromDropEvent(e) {
        if (this.waveDragPayload && this.waveDragPayload.type === 'wave') {
            return this.waveDragPayload;
        }
        try {
            const raw = e.originalEvent.dataTransfer.getData('text/plain');
            if (raw) {
                const parsed = JSON.parse(raw);
                if (parsed && parsed.type === 'wave') return parsed;
            }
        } catch (_) {}
        return null;
    }
    
    handleWaveDragOver(e) {
        if (this.isDraggingPersonDate) {
            return;
        }
        if (!this.isDraggingWave || !this.waveDragPayload || this.waveDragPayload.type !== 'wave') {
            return;
        }

        const dragData = this.waveDragPayload;
        
        e.preventDefault();
        e.stopPropagation();
        
        const $item = $(e.currentTarget);
        const itemEl = $item[0];
        const $group = $item.closest('.list-item--group');
        const targetGroupId = $group.data('id');

        if (this._groupChildrenDropEl) {
            this._groupChildrenDropEl.classList.remove('group-children--drag-over');
            this._groupChildrenDropEl = null;
        }

        if (String(dragData.groupId) === String(targetGroupId) &&
            String(dragData.id) === String($item.data('id'))) {
            e.originalEvent.dataTransfer.dropEffect = 'move';
            if (this._waveDragOverItemEl && this._waveDragOverItemEl !== itemEl) {
                this._waveDragOverItemEl.classList.remove(
                    'list-item--drag-over-top',
                    'list-item--drag-over-bottom'
                );
                this._waveDragOverItemEl = null;
            }
            return;
        }
            
        e.originalEvent.dataTransfer.dropEffect = 'move';
        
        const rect = itemEl.getBoundingClientRect();
        const y = e.clientY;
        const insertPosition = y - rect.top < rect.height / 2 ? 'before' : 'after';
        
        if (this._waveDragOverItemEl && this._waveDragOverItemEl !== itemEl) {
            this._waveDragOverItemEl.classList.remove(
                'list-item--drag-over-top',
                'list-item--drag-over-bottom'
            );
        }
        this._waveDragOverItemEl = itemEl;
        
        if (insertPosition === 'before') {
            $item.addClass('list-item--drag-over-top');
            $item.removeClass('list-item--drag-over-bottom');
        } else {
            $item.addClass('list-item--drag-over-bottom');
            $item.removeClass('list-item--drag-over-top');
        }
    }

    handleGroupChildrenDragOver(e) {
        if (this.isDraggingPersonDate) {
            return;
        }
        if (!this.isDraggingWave || !this.waveDragPayload || this.waveDragPayload.type !== 'wave') {
            return;
        }
        if ($(e.target).closest('.list-item--wave').length) {
            return;
        }

        e.preventDefault();
        e.stopPropagation();

        if (this._waveDragOverItemEl) {
            this._waveDragOverItemEl.classList.remove(
                'list-item--drag-over-top',
                'list-item--drag-over-bottom'
            );
            this._waveDragOverItemEl = null;
        }

        const gc = e.currentTarget;
        if (this._groupChildrenDropEl && this._groupChildrenDropEl !== gc) {
            this._groupChildrenDropEl.classList.remove('group-children--drag-over');
        }
        this._groupChildrenDropEl = gc;
        gc.classList.add('group-children--drag-over');
        e.originalEvent.dataTransfer.dropEffect = 'move';
    }

    handleGroupChildrenDragLeave(e) {
        const $gc = $(e.currentTarget);
        const related = e.originalEvent.relatedTarget;
        if (related && $gc[0].contains(related)) {
            return;
        }
        $gc.removeClass('group-children--drag-over');
    }

    handleGroupChildrenWaveDrop(e) {
        if (this.isDraggingPersonDate) {
            return;
        }
        if (!this.isDraggingWave) {
            return;
        }
        if ($(e.target).closest('.list-item--wave').length) {
            return;
        }

        const dragData = this.getWaveDragDataFromDropEvent(e);
        if (!dragData || dragData.type !== 'wave') {
            return;
        }

        e.preventDefault();
        e.stopPropagation();

        this.clearWaveDnDVisualState();

        const $gc = $(e.currentTarget);
        const $group = $gc.closest('.list-item--group');
        const targetGroupId = $group.data('id');
        if (!targetGroupId) {
            return;
        }

        const targetGroup = window.appState.data.groups.find(g => String(g.id) === String(targetGroupId));
        const insertAtEnd = (targetGroup && targetGroup.waves) ? targetGroup.waves.length : 0;

        window.sunPerfLog('eventManager', 'wave.drop.emptyZone', {
            fromGroup: dragData.groupId,
            toGroup: targetGroupId,
            fromIndex: dragData.index
        });
        this.moveWaveBetweenGroups(
            dragData.groupId,
            targetGroupId,
            dragData.index,
            insertAtEnd,
            false,
            { emptyOrGapDrop: true }
        );
    }
    
    handleWaveDragLeave(e) {
        const $item = $(e.currentTarget);
        const el = $item[0];
        
        if (e.originalEvent.relatedTarget && 
            !el.contains(e.originalEvent.relatedTarget)) {
            
            $item.removeClass('list-item--drag-over-top list-item--drag-over-bottom');
            if (this._waveDragOverItemEl === el) {
                this._waveDragOverItemEl = null;
            }
        }
    }
    
    handleWaveDrop(e) {
        if (this.isDraggingPersonDate) {
            return;
        }
        if (!this.isDraggingWave) {
            return;
        }
        
        const $item = $(e.currentTarget);
        e.preventDefault();
        e.stopPropagation();
        
        this.clearWaveDnDVisualState();
        
        const dragData = this.getWaveDragDataFromDropEvent(e);
        if (!dragData || dragData.type !== 'wave') {
            return;
        }
            
        const $group = $item.closest('.list-item--group');
        const targetGroupId = $group.data('id');
        const targetIndex = parseInt($item.data('index') || 0, 10);
        
        const rect = $item[0].getBoundingClientRect();
        const y = e.clientY;
        const insertBefore = y - rect.top < rect.height / 2;
        
        if (String(dragData.groupId) === String(targetGroupId) &&
            dragData.index === targetIndex) {
            window.sunPerfLog('eventManager', 'wave.drop.skipNoop', { targetGroupId, targetIndex });
            return;
        }

        window.sunPerfLog('eventManager', 'wave.drop.onRow', {
            fromGroup: dragData.groupId,
            toGroup: targetGroupId,
            fromIndex: dragData.index,
            targetIndex,
            insertBefore
        });
        this.moveWaveBetweenGroups(
            dragData.groupId,
            targetGroupId,
            dragData.index,
            targetIndex,
            insertBefore,
            { emptyOrGapDrop: false }
        );
    }
    
    clearWaveDnDVisualState() {
        if (this._waveDragOverItemEl) {
            this._waveDragOverItemEl.classList.remove(
                'list-item--drag-over-top',
                'list-item--drag-over-bottom'
            );
            this._waveDragOverItemEl = null;
        }
        if (this._groupChildrenDropEl) {
            this._groupChildrenDropEl.classList.remove('group-children--drag-over');
            this._groupChildrenDropEl = null;
        }
    }

    clearPersonDateDnDVisualState() {
        if (this._personDateDragOverItemEl) {
            this._personDateDragOverItemEl.classList.remove(
                'list-item--drag-over-top',
                'list-item--drag-over-bottom'
            );
            this._personDateDragOverItemEl = null;
        }
        if (this._personGroupChildrenDropEl) {
            this._personGroupChildrenDropEl.classList.remove('group-children--drag-over');
            this._personGroupChildrenDropEl = null;
        }
    }

    handlePersonGroupChildrenDragOver(e) {
        if (!this.isDraggingPersonDate) {
            return;
        }
        if ($(e.target).closest('.list-item--date').length) {
            return;
        }
        e.preventDefault();
        e.stopPropagation();
        if (this._personDateDragOverItemEl) {
            this._personDateDragOverItemEl.classList.remove(
                'list-item--drag-over-top',
                'list-item--drag-over-bottom'
            );
            this._personDateDragOverItemEl = null;
        }
        const gc = e.currentTarget;
        if (this._personGroupChildrenDropEl && this._personGroupChildrenDropEl !== gc) {
            this._personGroupChildrenDropEl.classList.remove('group-children--drag-over');
        }
        this._personGroupChildrenDropEl = gc;
        gc.classList.add('group-children--drag-over');
        e.originalEvent.dataTransfer.dropEffect = 'move';
    }

    handlePersonGroupChildrenDragLeave(e) {
        const $gc = $(e.currentTarget);
        const related = e.originalEvent.relatedTarget;
        if (related && $gc[0].contains(related)) {
            return;
        }
        $gc.removeClass('group-children--drag-over');
    }

    handlePersonGroupChildrenDateDrop(e) {
        if (!this.isDraggingPersonDate) {
            return;
        }
        if ($(e.target).closest('.list-item--date').length) {
            return;
        }
        let dragData;
        try {
            dragData = JSON.parse(e.originalEvent.dataTransfer.getData('text/plain'));
        } catch (_) {
            return;
        }
        if (!dragData || dragData.type !== 'date') {
            return;
        }
        e.preventDefault();
        e.stopPropagation();
        this.clearPersonDateDnDVisualState();
        const $gc = $(e.currentTarget);
        const $group = $gc.closest('.list-item--person-group');
        const targetGroupId = $group.data('id');
        if (!targetGroupId) {
            return;
        }
        let sourceGroupId = dragData.personGroupId || this.findPersonGroupIdForDate(dragData.id);
        const targetGroup = (window.appState.data.personGroups || []).find(g => String(g.id) === String(targetGroupId));
        const insertAtEnd = (targetGroup && targetGroup.dates) ? targetGroup.dates.length : 0;
        this.moveDateBetweenPersonGroups(
            sourceGroupId,
            targetGroupId,
            dragData.index,
            insertAtEnd,
            false,
            { emptyOrGapDrop: true }
        );
    }

    handleWaveDragEnd(e) {
        window.sunPerfLog('eventManager', 'wave.dragend', {});
        this.isDraggingWave = false;
        this.waveDragPayload = null;
        this.clearWaveDnDVisualState();
        const src = e.target && e.target.closest ? e.target.closest('.list-item--wave') : null;
        if (src) {
            src.classList.remove('list-item--dragging');
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
        this.scheduleWavesListRefreshAndSave();
    }

    /**
     * Переставляет волну внутри группы или переносит в другую группу.
     * @param {object} [opts]
     * @param {boolean} [opts.emptyOrGapDrop] — сброс на пустую область .group-children (в конец списка цели)
     */
    moveWaveBetweenGroups(sourceGroupId, targetGroupId, sourceIndex, targetIndex, insertBefore, opts = {}) {
        const { emptyOrGapDrop = false } = opts;
        const sourceGroup = window.appState.data.groups.find(g => String(g.id) === String(sourceGroupId));
        const targetGroup = window.appState.data.groups.find(g => String(g.id) === String(targetGroupId));

        if (!sourceGroup || !targetGroup ||
            !Array.isArray(sourceGroup.waves) || !Array.isArray(targetGroup.waves)) {
            return;
        }

        const sourceWaves = [...sourceGroup.waves];
        const waveId = sourceWaves[sourceIndex];
        if (waveId === undefined) return;

        const sameGroup = String(sourceGroupId) === String(targetGroupId);

        if (sameGroup) {
            this.reorderWaveInGroup(sourceGroupId, sourceIndex, targetIndex, insertBefore);
            return;
        }

        sourceWaves.splice(sourceIndex, 1);
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
        this.scheduleWavesListRefreshAndSave();
    }
    
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
    
    handleDragStart(e) {
        try {
            const data = e.originalEvent.dataTransfer.getData('text/plain');
            if (data) {
                const dragData = JSON.parse(data);
                if (dragData && dragData.type === 'wave') {
                    e.preventDefault();
                    return;
                }
            }
        } catch (error) {}
        
        const $item = $(e.currentTarget).closest('.list-item--group, .list-item--date, .list-item--person-group');
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

        if (type === 'group' || type === 'date' || type === 'personGroup') {
            this.isDraggingWave = false;
            this.waveDragPayload = null;
        }

        this.isDraggingPersonDate = type === 'date';
        
        const payload = {
            type: type,
            id: id,
            index: index
        };
        if (type === 'date') {
            const pgId = $item.data('personGroupId');
            if (pgId != null && pgId !== '') {
                payload.personGroupId = pgId;
            }
        }
        e.originalEvent.dataTransfer.setData('text/plain', JSON.stringify(payload));
        
        $item.addClass('list-item--dragging');
        window.sunPerfLog('eventManager', 'dragstart', { type, id, index });
    }
    
    handleDragOver(e) {
        if (this.isDraggingWave) {
            if ($(e.target).closest('.group-children').length) {
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
                if (dragData && dragData.type === 'wave') {
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
        const type = $item.data('type');
        
        const insertPosition = y - rect.top < rect.height / 2 ? 'before' : 'after';
        
        if (this._dragOverListItemEl && this._dragOverListItemEl !== el) {
            this._dragOverListItemEl.classList.remove(
                'list-item--drag-over-top',
                'list-item--drag-over-bottom'
            );
        }
        this._dragOverListItemEl = el;
    
        if (insertPosition === 'before') {
            $item.addClass('list-item--drag-over-top');
            $item.removeClass('list-item--drag-over-bottom');
        } else {
            $item.addClass('list-item--drag-over-bottom');
            $item.removeClass('list-item--drag-over-top');
        }
    }
    
    handleDrop(e) {
        if (this.isDraggingWave) {
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
        
        $('.list-item').removeClass('list-item--drag-over-top list-item--drag-over-bottom');
        
        try {
            const dragData = JSON.parse(e.originalEvent.dataTransfer.getData('text/plain'));
            
            if (dragData && (dragData.type === 'wave' || dragData.isWaveDrag)) {
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
            if (dragData.type === 'date' && String(dragData.id) === String(targetId)) {
                return;
            }
            
            if (dragData.type === 'date') {
                window.sunPerfLog('eventManager', 'drop.date', { fromIndex: dragData.index, targetIndex, insertBefore });
                this.handleDateDrop(dragData, targetIndex, insertBefore, $item);
            } else if (dragData.type === 'group') {
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

    moveDateBetweenPersonGroups(sourceGroupId, targetGroupId, sourceIndex, targetIndex, insertBefore, opts = {}) {
        const { emptyOrGapDrop = false } = opts;
        const groups = window.appState.data.personGroups || [];
        const sourceGroup = groups.find(g => String(g.id) === String(sourceGroupId));
        const targetGroup = groups.find(g => String(g.id) === String(targetGroupId));
        if (!sourceGroup || !targetGroup ||
            !Array.isArray(sourceGroup.dates) || !Array.isArray(targetGroup.dates)) {
            return;
        }
        const sourceDates = [...sourceGroup.dates];
        const dateId = sourceDates[sourceIndex];
        if (dateId === undefined) return;
        const sameGroup = String(sourceGroupId) === String(targetGroupId);
        if (sameGroup) {
            this.reorderDateInPersonGroup(sourceGroupId, sourceIndex, targetIndex, insertBefore);
            return;
        }
        sourceDates.splice(sourceIndex, 1);
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
        this.scheduleDateListRefreshAndSave();
    }

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
        this.scheduleDateListRefreshAndSave();
    }

    handleDateDrop(dragData, targetIndex, insertBefore, $targetItem) {
        let sourceGroupId = dragData.personGroupId;
        if (!sourceGroupId) {
            sourceGroupId = this.findPersonGroupIdForDate(dragData.id);
        }
        let targetGroupId = $targetItem.data('personGroupId');
        if (!targetGroupId) {
            const $pg = $targetItem.closest('.list-item--person-group');
            if ($pg.length) {
                targetGroupId = $pg.data('id');
            }
        }
        if (!targetGroupId) {
            targetGroupId = sourceGroupId;
        }
        this.moveDateBetweenPersonGroups(
            sourceGroupId,
            targetGroupId,
            dragData.index,
            targetIndex,
            insertBefore,
            { emptyOrGapDrop: false }
        );
    }
    
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
        this.scheduleWavesListRefreshAndSave();
    }

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
        this.scheduleDateListRefreshAndSave();
    }
    
    handleDragLeave(e) {
        const $item = $(e.currentTarget);
        const el = $item[0];
        
        if (e.originalEvent.relatedTarget && 
            !el.contains(e.originalEvent.relatedTarget)) {
            
            $item.removeClass('list-item--drag-over-top list-item--drag-over-bottom');
            if (this._dragOverListItemEl === el) {
                this._dragOverListItemEl = null;
            }
        }
    }
    
    handleDragEnd(e) {
        const t = e.target;
        if (!t || !t.closest) return;
        if (t.closest('.list-item--wave')) {
            return;
        }
        const $row = $(t).closest('.list-item--group[data-type="group"], .list-item--date[data-type="date"], .list-item--person-group[data-type="personGroup"]');
        if (!$row.length) {
            return;
        }
        this.isDraggingWave = false;
        this.waveDragPayload = null;
        this.isDraggingPersonDate = false;
        this.clearPersonDateDnDVisualState();
        if (this._dragOverListItemEl) {
            this._dragOverListItemEl.classList.remove(
                'list-item--drag-over-top',
                'list-item--drag-over-bottom'
            );
            this._dragOverListItemEl = null;
        }
        this.clearWaveDnDVisualState();
        $('.list-item').removeClass('list-item--dragging list-item--drag-over-top list-item--drag-over-bottom');
        window.sunPerfLog('eventManager', 'dragend.groupOrDate', { targetTag: t.tagName });
    }
    
    setupDateChangeObservers() {
        $(document).on('click', '.list-item--date[data-type="date"]', (e) => {
            const $target = $(e.target);
            const $item = $target.closest('.list-item--date');
            
            if ($target.is('.date-checkbox') || $target.closest('.date-checkbox').length) {
                return;
            }
            
            if ($target.is('button, input, textarea, select, .list-item__drag-handle, .date-drag-handle, .delete-date-btn, .edit-btn')) {
                return;
            }
            
            if ($item.hasClass('list-item--editing')) {
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
                    
                    window.appState.dateSelections.typeA = dateId;
                    window.appState.dateSelections.typeB = null;
                    
                    window.dates.setActiveDate(dateId, true);
                    window.appState.save();
                    
                    if (window.unifiedListManager && window.unifiedListManager.updateDatesList) {
                        window.unifiedListManager.updateDatesList();
                    }
                    
                    setTimeout(() => {
                        if (window.summaryManager && window.summaryManager.updateSummary) {
                            window.summaryManager.updateSummary();
                        }
                    }, 100);
                }
            }
        });
    }

    setupDateSelectionHandlers() {
        $(document).on('click', '.date-checkbox', (e) => {
            e.preventDefault();
            e.stopPropagation();
            
            const $checkbox = $(e.currentTarget);
            const dateId = $checkbox.data('id');
            const checkboxType = $checkbox.data('type');
            
            this.handleDateCheckboxClick(dateId, checkboxType);
        });
    }

    handleDateCheckboxClick(dateId, checkboxType) {
        if (!window.appState.dateSelections) {
            window.appState.dateSelections = {
                typeA: null,
                typeB: null
            };
        }
        
        const selections = window.appState.dateSelections;
        const dateIdStr = String(dateId);
        const targetKey = checkboxType === 'a' ? 'typeA' : 'typeB';
        const oppositeKey = checkboxType === 'a' ? 'typeB' : 'typeA';
        
        const currentTargetStr = selections[targetKey] ? String(selections[targetKey]) : null;
        
        if (checkboxType === 'b' && selections.typeA && String(selections.typeA) === dateIdStr) {
            const allDates = window.appState.data.dates || [];
            const newTypeADate = allDates.find(date => String(date.id) !== dateIdStr);
            
            if (newTypeADate) {
                selections.typeA = newTypeADate.id;
                
                if (window.appState.activeDateId && String(window.appState.activeDateId) === dateIdStr) {
                    window.appState.activeDateId = newTypeADate.id;
                    if (window.dates) {
                        window.dates.setActiveDate(newTypeADate.id, true);
                    }
                }
                
                selections.typeB = dateId;
                window.appState.save();
                
                if (window.unifiedListManager && window.unifiedListManager.updateDatesList) {
                    window.unifiedListManager.updateDatesList();
                }
                return;
            } else {
                return;
            }
        }
        
        if (checkboxType === 'a') {
            if (currentTargetStr === dateIdStr) {
                return;
            } else {
                selections.typeA = dateId;
                
                if (selections.typeB && String(selections.typeB) === dateIdStr) {
                    selections.typeB = null;
                }
                
                if (window.dates) {
                    window.dates.setActiveDate(dateId, true);
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
        
        if (window.unifiedListManager && window.unifiedListManager.updateDatesList) {
            window.unifiedListManager.updateDatesList();
        }
    }
    
    handleClick(e) {
        const $target = $(e.target);
        
        if ($target.is('#btnPrevDay, #btnNextDay, #btnToday, #btnNow, #btnSetDate') || 
            $target.closest('#btnPrevDay, #btnNextDay, #btnToday, #btnNow, #btnSetDate').length) {
            e.preventDefault();
            
            setTimeout(() => {
                if (window.summaryManager && window.summaryManager.updateSummary) {
                    window.summaryManager.updateSummary();
                }
            }, 100);
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
        
        if ($target.hasClass('tab-button')) {
            e.preventDefault();
            e.stopPropagation();
            if (window.uiManager) {
                window.uiManager.handleTabClick($target[0]);
            }
            return;
        }
        
        const $expandBtn = $target.closest('.expand-collapse-btn');
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
                        const groupElement = document.querySelector(`.list-item--person-group[data-id="${id}"]`);
                        if (groupElement) {
                            groupElement.classList.toggle('list-item--expanded');
                            const childrenContainer = groupElement.querySelector('.person-group-children');
                            if (childrenContainer) {
                                childrenContainer.style.display = group.expanded ? 'block' : 'none';
                            }
                            const expandBtn = groupElement.querySelector('.expand-collapse-btn');
                            if (expandBtn) {
                                expandBtn.textContent = group.expanded ? 'Свернуть' : 'Развернуть';
                            }
                        }
                    }
                } else {
                    const group = window.appState.data.groups.find(g => g.id === id);
                    if (group) {
                        group.expanded = !group.expanded;
                        window.appState.save();
                        
                        const groupElement = document.querySelector(`.list-item--group[data-id="${id}"]`);
                        if (groupElement) {
                            groupElement.classList.toggle('list-item--expanded');
                            
                            const childrenContainer = groupElement.querySelector('.group-children');
                            if (childrenContainer) {
                                childrenContainer.style.display = group.expanded ? 'block' : 'none';
                            }
                            
                            const expandBtn = groupElement.querySelector('.expand-collapse-btn');
                            if (expandBtn) {
                                expandBtn.textContent = group.expanded ? 'Свернуть' : 'Развернуть';
                            }
                        }
                    }
                }
            }
            return;
        }
        
        const $groupDeleteBtn = $target.closest('.delete-date-btn[data-type="group"]');
        if ($groupDeleteBtn.length) {
            e.preventDefault();
            e.stopPropagation();
            const id = $groupDeleteBtn.data('id');
            
            if (id && window.unifiedListManager) {
                window.unifiedListManager.handleDeleteClick(id, 'group');
            }
            return;
        }
        
        const $editBtn = $target.closest('.edit-btn');
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
        
        const $deleteBtn = $target.closest('.delete-date-btn, .delete-btn');
        if ($deleteBtn.length && 
            !$target.closest('.list-item--note').length && 
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
        
        const $saveBtn = $target.closest('.save-btn');
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
        
        const $cancelBtn = $target.closest('.cancel-btn');
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
        
        if ($target.hasClass('wave-visibility-check')) {
            e.stopPropagation();
            const waveId = $target.data('id');
            const isChecked = $target.prop('checked');
            
            this.handleWaveVisibilityChange(waveId, isChecked, $target);
            return;
        }
        
        if ($target.hasClass('wave-bold-check')) {
            e.stopPropagation();
            const waveId = $target.data('id');
            
            if (waveId && window.appState) {
                window.appState.waveBold[waveId] = $target.prop('checked');
                window.appState.save();
                if (window.waves) window.waves.updatePosition();
                
                setTimeout(() => {
                    if (window.summaryManager && window.summaryManager.updateSummary) {
                        window.summaryManager.updateSummary();
                    }
                }, 50);
            }
            return;
        }
        
        if ($target.hasClass('wave-color-preview-small')) {
            e.stopPropagation();
            const waveId = $target.data('id');
            
            if (waveId && window.unifiedListManager) {
                const wave = window.appState.data.waves.find(w => String(w.id) === String(waveId));
                if (wave) {
                    window.unifiedListManager.changeWaveColor(wave);
                    
                    setTimeout(() => {
                        if (window.summaryManager && window.summaryManager.updateSummary) {
                            window.summaryManager.updateSummary();
                        }
                    }, 50);
                }
            }
            return;
        }
        
        if ($target.hasClass('wave-corner-color-check')) {
            e.stopPropagation();
            const waveId = $target.data('id');
            
            if (waveId && window.waves) {
                window.waves.setWaveCornerColor(waveId, $target.prop('checked'));
                
                setTimeout(() => {
                    if (window.summaryManager && window.summaryManager.updateSummary) {
                        window.summaryManager.updateSummary();
                    }
                }, 50);
            }
            return;
        }
        
        if ($target.hasClass('wave-group-toggle')) {
            e.stopPropagation();
            const groupId = $target.data('groupId');
            const isChecked = $target.prop('checked');
            
            this.handleGroupToggle(groupId, isChecked);
            return;
        }

        if ($target.hasClass('show-on-vizor-btn')) {
            e.preventDefault();
            e.stopPropagation();
            
            const waveId = $target.data('wave-id');
            
            const checkbox = $(`.wave-visibility-check[data-id="${waveId}"]`);
            if (checkbox.length) {
                const isChecked = !checkbox.prop('checked');
                checkbox.prop('checked', isChecked);
                
                this.handleWaveVisibilityChange(waveId, isChecked, checkbox);
            }
            
            return;
        }
        
        this.handleButtonClicks($target, e);
    }



	handleWaveVisibilityChange(waveId, isChecked, $checkbox) {
		// Если пытаемся включить волну
		if (isChecked && window.waves && window.appState) {
			const isGroupEnabled = window.waves.isWaveGroupEnabled(waveId);
			
			// Если группа выключена
			if (!isGroupEnabled) {
				const groupId = this.findGroupForWave(waveId);
				
				if (groupId) {
					const group = window.appState.data.groups.find(g => g.id === groupId);
					const groupName = group ? group.name : 'Неизвестная группа';
					
					// ИСПРАВЛЕНИЕ: Всегда спрашиваем, даже если ранее спрашивали
					const shouldEnableGroup = confirm(`Группа "${groupName}" отключена. Включить её для отображения сигнала?`);
					
					if (shouldEnableGroup) {
						// Включаем группу
						if (group) {
							group.enabled = true;
							
							const waveIdStr = String(waveId);
							window.appState.waveVisibility[waveIdStr] = true;
							window.appState.saveDebounced();
							
							// Убираем группу из askedGroups, если она там была
							if (this.askedGroups.has(groupId)) {
								this.askedGroups.delete(groupId);
							}
							
							setTimeout(() => {
								if (window.unifiedListManager && window.unifiedListManager.updateWavesList) {
									window.unifiedListManager.updateWavesList();
								}
								
								this.recreateAllWaveElements();
								
								this.updateGroupStatsForWave(waveId, true);
								
								if (window.summaryManager && window.summaryManager.debouncedUpdate) {
									window.summaryManager.debouncedUpdate();
								}
								
								$checkbox.prop('checked', true);
							}, 100);
						}
						return;
					} else {
						// ИСПРАВЛЕНИЕ: Не добавляем в askedGroups, чтобы при повторной попытке снова спросить
						// Просто возвращаем чекбокс в выключенное состояние
						$checkbox.prop('checked', false);
						
						// НЕ добавляем в askedGroups
						// this.askedGroups.add(groupId); // УДАЛЯЕМ ЭТУ СТРОКУ
						
						return;
					}
				}
			}
		}
		
		// Обычная логика для включения/выключения волны (когда группа включена или выключаем волну)
		if (waveId && window.appState) {
			const waveIdStr = String(waveId);
			window.appState.waveVisibility[waveIdStr] = isChecked;
			window.appState.saveDebounced();
			
			const wave = window.appState.data.waves.find(w => String(w.id) === waveIdStr);
			const isGroupEnabled = window.waves.isWaveGroupEnabled(waveId);
			const shouldShow = isChecked && isGroupEnabled;
			
			if (shouldShow) {
				if (!window.waves.waveContainers[waveId] && wave) {
					window.waves.createWaveElement(wave);
				}
			}
			
			if (window.waves && window.waves.updatePosition) {
				window.waves.updatePosition();
			}
			
			this.updateGroupStatsForWave(waveId, isChecked);
			
			if (window.summaryManager && window.summaryManager.debouncedUpdate) {
				window.summaryManager.debouncedUpdate();
			}
		}
	}




    handleGroupToggle(groupId, isChecked) {
        if (groupId && window.appState) {
            const group = window.appState.data.groups.find(g => g.id === groupId);
            if (group) {
                group.enabled = isChecked;
                window.appState.save();
                
                if (isChecked && this.askedGroups.has(groupId)) {
                    this.askedGroups.delete(groupId);
                }
                
                setTimeout(() => {
                    $('.wave-container').remove();
                    if (window.waves) {
                        window.waves.waveContainers = {};
                        window.waves.wavePaths = {};
                    }
                    
                    window.appState.data.waves.forEach(wave => {
                        const waveIdStr = String(wave.id);
                        const isWaveVisible = window.appState.waveVisibility[waveIdStr] !== false;
                        const isGroupEnabled = window.waves.isWaveGroupEnabled(wave.id);
                        const shouldShow = isWaveVisible && isGroupEnabled;
                        
                        if (shouldShow) {
                            window.waves.createWaveElement(wave);
                        }
                    });
                    
                    if (window.waves.updatePosition) {
                        window.waves.updatePosition();
                    }
                    
                    window.unifiedListManager.updateWavesList();
                    
                    if (window.summaryManager && window.summaryManager.updateSummary) {
                        window.summaryManager.updateSummary();
                    }
                }, 100);
            }
        }
    }
    
    handleButtonClicks($target, e) {
        if ($target.is('#btnAddCustomWave') || $target.closest('#btnAddCustomWave').length) {
            e.preventDefault();
            e.stopPropagation();
            
            const name = $('#customWaveName').val();
            const period = $('#customWavePeriod').val();
            const type = $('#customWaveType').val();
            const color = $('#customWaveColor').val();
            
            if (name && period) {
                const newWave = window.waves.addCustomWave(name, period, type, color);
                if (newWave && window.unifiedListManager) {
                    window.unifiedListManager.updateWavesList();
                    
                    $('#customWaveName').val('');
                    $('#customWavePeriod').val('');
                    $('#customWaveColor').val('#666666');
                    
                    const defaultGroup = window.appState.data.groups.find(g => g.id === 'default-group');
                    if (defaultGroup && window.unifiedListManager.updateGroupStats) {
                        window.unifiedListManager.updateGroupStats('default-group');
                    }
                    
                    setTimeout(() => {
                        if (window.summaryManager && window.summaryManager.updateSummary) {
                            window.summaryManager.updateSummary();
                        }
                    }, 50);
                }
            }
            return;
        }
        
        if ($target.is('#btnPrevDay') || $target.closest('#btnPrevDay').length) {
            e.preventDefault();
            if (window.dates) window.dates.navigateDay(-1);
            return;
        }
        
        if ($target.is('#btnNextDay') || $target.closest('#btnNextDay').length) {
            e.preventDefault();
            if (window.dates) window.dates.navigateDay(1);
            return;
        }
        
        if ($target.is('#btnSetDate') || $target.closest('#btnSetDate').length) {
            e.preventDefault();
            if (window.dates) window.dates.setDateFromInput();
            return;
        }
        
        if ($target.is('#btnAddGroup') || $target.closest('#btnAddGroup').length) {
            e.preventDefault();
            const groupName = $('#newGroupName').val();
            if (groupName && window.dates) {
                window.dates.addGroup(groupName);
                if (window.dataManager) window.dataManager.updateWavesGroups();
                $('#newGroupName').val('');
                
                setTimeout(() => {
                    if (window.summaryManager && window.summaryManager.updateSummary) {
                        window.summaryManager.updateSummary();
                    }
                }, 50);
            }
            return;
        }
        
        if ($target.is('[data-action="importAll"]')) {
            e.preventDefault();
            $('#importAllFile').click();
            return;
        }
        
        if ($target.hasClass('spoiler-toggle')) {
            e.preventDefault();
            e.stopPropagation();
            if (window.uiManager && window.uiManager.toggleSpoiler) {
                window.uiManager.toggleSpoiler($target[0]);
            }
            return;
        }
    }
    
    getContainerId(element) {
        const $container = $(element).closest('.list-container');
        return $container.length ? $container.attr('id') : null;
    }
    
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
    
    recreateAllWaveElements() {
        $('.wave-container').remove();
        if (window.waves) {
            window.waves.waveContainers = {};
            window.waves.wavePaths = {};
        }
        
        window.appState.data.waves.forEach(wave => {
            const waveIdStr = String(wave.id);
            const isWaveVisible = window.appState.waveVisibility[waveIdStr] !== false;
            const isGroupEnabledNow = window.waves.isWaveGroupEnabled(wave.id);
            const shouldShow = isWaveVisible && isGroupEnabledNow;
            
            if (shouldShow) {
                window.waves.createWaveElement(wave);
            }
        });
        
        if (window.waves.updatePosition) {
            window.waves.updatePosition();
        }
    }
    
    setupIntersectionHandlers() {
        $(document).on('click', (e) => {
            this.handleIntersectionClick(e);
        });
    }
    
    handleIntersectionClick(e) {
        const $target = $(e.target);
        
        if ($target.is('#btnClearWaveSelection') || $target.closest('#btnClearWaveSelection').length) {
            e.preventDefault();
            e.stopPropagation();
            
            if (window.stateIntersectionManager) {
                window.stateIntersectionManager.clearSelection();
            }
            return;
        }
        
        const $intersectionItem = $target.closest('.summary-item');
        if ($intersectionItem.length && 
            !$target.is('button') && 
            !$target.hasClass('show-on-vizor-btn')) {
            
            e.preventDefault();
            e.stopPropagation();
            
            const waveId = $intersectionItem.find('.show-on-vizor-btn').data('wave-id');
            if (waveId && window.waves) {
                const wave = window.appState.data.waves.find(w => String(w.id) === String(waveId));
                if (wave) {
                    const checkbox = $(`.wave-visibility-check[data-id="${waveId}"]`);
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