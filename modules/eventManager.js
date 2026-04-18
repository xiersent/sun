// modules/eventManager.js
class EventManager {
    constructor() {
        this.askedGroups = new Set();
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
            .on('mousedown touchstart', '.group-children .list-item--wave', function(e) {
                e.stopPropagation();
            });
        
        $(document)
            .on('dragstart', '.list-item--date[data-type="date"]:not(.list-item--editing)', this.handleDragStart.bind(this))
            .on('dragover', '.list-item--date[data-type="date"]', this.handleDragOver.bind(this))
            .on('dragleave', '.list-item--date[data-type="date"]', this.handleDragLeave.bind(this))
            .on('drop', '.list-item--date[data-type="date"]', this.handleDrop.bind(this))
            .on('dragend', '.list-item--date[data-type="date"]', this.handleDragEnd.bind(this));
        
        $(document)
            .on('dragstart', '.list-item--group[data-type="group"]:not(.list-item--editing)', this.handleDragStart.bind(this))
            .on('dragover', '.list-item--group[data-type="group"]', this.handleDragOver.bind(this))
            .on('dragleave', '.list-item--group[data-type="group"]', this.handleDragLeave.bind(this))
            .on('drop', '.list-item--group[data-type="group"]', this.handleDrop.bind(this))
            .on('dragend', '.list-item--group[data-type="group"]', this.handleDragEnd.bind(this));
            
        $(document)
            .on('dragstart', '.group-children .list-item--wave:not(.list-item--editing)', this.handleWaveDragStart.bind(this))
            .on('dragover', '.group-children .list-item--wave', this.handleWaveDragOver.bind(this))
            .on('dragleave', '.group-children .list-item--wave', this.handleWaveDragLeave.bind(this))
            .on('drop', '.group-children .list-item--wave', this.handleWaveDrop.bind(this))
            .on('dragend', '.group-children .list-item--wave', this.handleWaveDragEnd.bind(this));

		$(document).on('click', '.group-enabled-count', (e) => {
			e.preventDefault();
			e.stopPropagation();
			
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
        const $item = $(e.currentTarget);
        const $group = $item.closest('.list-item--group');
        const waveId = $item.data('id');
        const index = parseInt($item.data('index') || 0);
        const groupId = $group.data('id');
        
        if (!waveId || index < 0 || !groupId) {
            e.preventDefault();
            return;
        }
        
        e.originalEvent.dataTransfer.setData('text/plain', JSON.stringify({
            type: 'wave',
            id: waveId,
            index: index,
            groupId: groupId,
            source: 'wave-drag'
        }));
        
        $item.addClass('list-item--dragging');
    }
    
    handleWaveDragOver(e) {
        if (!this.isDraggingWave) {
            return;
        }
        
        e.preventDefault();
        e.stopPropagation();
        
        try {
            const dragData = JSON.parse(e.originalEvent.dataTransfer.getData('text/plain'));
            
            if (!dragData || dragData.type !== 'wave') {
                e.originalEvent.dataTransfer.dropEffect = 'none';
                return;
            }
            
            const $item = $(e.currentTarget);
            const $group = $item.closest('.list-item--group');
            const targetGroupId = $group.data('id');
            
            if (dragData.groupId !== targetGroupId) {
                e.originalEvent.dataTransfer.dropEffect = 'none';
                $('.group-children .list-item--wave')
                    .removeClass('list-item--drag-over-top list-item--drag-over-bottom');
                return;
            }
            
            e.originalEvent.dataTransfer.dropEffect = 'move';
            
            const rect = $item[0].getBoundingClientRect();
            const y = e.clientY;
            const insertPosition = y - rect.top < rect.height / 2 ? 'before' : 'after';
            
            $(`.group-children .list-item--wave[data-parent-group-id="${targetGroupId}"]`)
                .not($item)
                .removeClass('list-item--drag-over-top list-item--drag-over-bottom');
            
            if (insertPosition === 'before') {
                $item.addClass('list-item--drag-over-top');
                $item.removeClass('list-item--drag-over-bottom');
            } else {
                $item.addClass('list-item--drag-over-bottom');
                $item.removeClass('list-item--drag-over-top');
            }
        } catch (error) {
            e.originalEvent.dataTransfer.dropEffect = 'none';
        }
    }
    
    handleWaveDragLeave(e) {
        const $item = $(e.currentTarget);
        
        if (e.originalEvent.relatedTarget && 
            !$item[0].contains(e.originalEvent.relatedTarget)) {
            
            $item.removeClass('list-item--drag-over-top list-item--drag-over-bottom');
        }
    }
    
    handleWaveDrop(e) {
        if (!this.isDraggingWave) {
            return;
        }
        
        const $item = $(e.currentTarget);
        e.preventDefault();
        e.stopPropagation();
        
        $('.list-item--wave').removeClass('list-item--drag-over-top list-item--drag-over-bottom');
        
        try {
            const dragData = JSON.parse(e.originalEvent.dataTransfer.getData('text/plain'));
            
            if (!dragData || dragData.type !== 'wave') {
                return;
            }
            
            const $group = $item.closest('.list-item--group');
            const targetGroupId = $group.data('id');
            
            if (dragData.groupId !== targetGroupId) {
                return;
            }
            
            const targetIndex = parseInt($item.data('index') || 0);
            
            const rect = $item[0].getBoundingClientRect();
            const y = e.clientY;
            const insertBefore = y - rect.top < rect.height / 2;
            
            if (dragData.index === targetIndex) {
                return;
            }
            
            this.reorderWaveInGroup(dragData.groupId, dragData.index, targetIndex, insertBefore);
            
        } catch (error) {
        }
    }
    
    handleWaveDragEnd(e) {
        $('.list-item--wave').removeClass('list-item--dragging list-item--drag-over-top list-item--drag-over-bottom');
    }
    
    reorderWaveInGroup(groupId, sourceIndex, targetIndex, insertBefore) {
        const group = window.appState.data.groups.find(g => String(g.id) === String(groupId));
        
        if (!group || !group.waves || !Array.isArray(group.waves)) {
            return;
        }
        
        const waves = [...group.waves];
        const waveId = waves[sourceIndex];
        if (!waveId) return;
        
        waves.splice(sourceIndex, 1);
        let newIndex = this.calculateNewIndex(sourceIndex, targetIndex, insertBefore);
        waves.splice(newIndex, 0, waveId);
        group.waves = waves;
        
        window.appState.save();
        
        if (window.unifiedListManager && window.unifiedListManager.updateWavesList) {
            window.unifiedListManager.updateWavesList();
        }
        
        setTimeout(() => {
            if (window.summaryManager && window.summaryManager.updateSummary) {
                window.summaryManager.updateSummary();
            }
        }, 50);
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
        
        const $item = $(e.currentTarget);
        const type = $item.data('type');
        const id = $item.data('id');
        const index = parseInt($item.data('index') || 0);
        
        if (!id || index < 0) {
            e.preventDefault();
            return;
        }
        
        e.originalEvent.dataTransfer.setData('text/plain', JSON.stringify({
            type: type,
            id: id,
            index: index
        }));
        
        $item.addClass('list-item--dragging');
    }
    
    handleDragOver(e) {
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
        const rect = $item[0].getBoundingClientRect();
        const y = e.clientY;
        const type = $item.data('type');
        
        const insertPosition = y - rect.top < rect.height / 2 ? 'before' : 'after';
        
        $(`.list-item[data-type="${type}"]`).not($item).removeClass('list-item--drag-over-top list-item--drag-over-bottom');
    
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
            
            const targetIndex = parseInt($item.data('index') || 0);
            
            const rect = $item[0].getBoundingClientRect();
            const y = e.clientY;
            const insertBefore = y - rect.top < rect.height / 2;
            
            if (dragData.index === targetIndex) {
                return;
            }
            
            if (dragData.type === 'date') {
                this.handleDateDrop(dragData, targetIndex, insertBefore);
            } else if (dragData.type === 'group') {
                this.handleGroupDrop(dragData, targetIndex, insertBefore);
            }
            
        } catch (error) {
        }
    }

    handleDateDrop(dragData, targetIndex, insertBefore) {
        const [movedItem] = window.appState.data.dates.splice(dragData.index, 1);
        let newIndex = this.calculateNewIndex(dragData.index, targetIndex, insertBefore);
        window.appState.data.dates.splice(newIndex, 0, movedItem);
        window.appState.save();
        
        if (window.dataManager) window.dataManager.updateDateList();
        
        setTimeout(() => {
            if (window.summaryManager && window.summaryManager.updateSummary) {
                window.summaryManager.updateSummary();
            }
        }, 50);
    }
    
    handleGroupDrop(dragData, targetIndex, insertBefore) {
        const [movedItem] = window.appState.data.groups.splice(dragData.index, 1);
        let newIndex = this.calculateNewIndex(dragData.index, targetIndex, insertBefore);
        window.appState.data.groups.splice(newIndex, 0, movedItem);
        window.appState.save();
        
        if (window.unifiedListManager && window.unifiedListManager.updateWavesList) {
            window.unifiedListManager.updateWavesList();
        }
        
        setTimeout(() => {
            if (window.summaryManager && window.summaryManager.updateSummary) {
                window.summaryManager.updateSummary();
            }
        }, 50);
    }
    
    handleDragLeave(e) {
        const $item = $(e.currentTarget);
        
        if (e.originalEvent.relatedTarget && 
            !$item[0].contains(e.originalEvent.relatedTarget)) {
            
            $item.removeClass('list-item--drag-over-top list-item--drag-over-bottom');
        }
    }
    
    handleDragEnd(e) {
        $('.list-item').removeClass('list-item--dragging list-item--drag-over-top list-item--drag-over-bottom');
    }
    
    setupDateChangeObservers() {
        $(document).on('click', '.list-item--date[data-type="date"]', (e) => {
            const $target = $(e.target);
            const $item = $target.closest('.list-item--date');
            
            if ($target.is('.date-checkbox') || $target.closest('.date-checkbox').length) {
                return;
            }
            
            if ($target.is('button, input, textarea, select, .list-item__drag-handle, .delete-date-btn, .edit-btn')) {
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
            
            if (id && window.unifiedListManager) {
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
							window.appState.save();
							
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
								
								if (window.summaryManager && window.summaryManager.updateSummary) {
									window.summaryManager.updateSummary();
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
			window.appState.save();
			
			const wave = window.appState.data.waves.find(w => String(w.id) === waveIdStr);
			const isGroupEnabled = window.waves.isWaveGroupEnabled(waveId);
			const shouldShow = isChecked && isGroupEnabled;
			
			if (shouldShow) {
				if (!window.waves.waveContainers[waveId] && wave) {
					window.waves.createWaveElement(wave);
				}
				if (window.waves.waveContainers[waveId]) {
					$(window.waves.waveContainers[waveId]).show();
				}
			} else {
				if (window.waves.waveContainers[waveId]) {
					$(window.waves.waveContainers[waveId]).hide();
				}
			}
			
			if (window.waves && window.waves.updatePosition) {
				window.waves.updatePosition();
			}
			
			this.updateGroupStatsForWave(waveId, isChecked);
			
			setTimeout(() => {
				if (window.summaryManager && window.summaryManager.updateSummary) {
					window.summaryManager.updateSummary();
				}
			}, 50);
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
                        
                        setTimeout(() => {
                            if (window.summaryManager && window.summaryManager.updateSummary) {
                                window.summaryManager.updateSummary();
                            }
                        }, 50);
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