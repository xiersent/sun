class EventManager {
	// modules/eventManager.js - в конструкторе
	constructor() {
		this.askedGroups = new Set();
		this.$ = window.jQuery;
		this.setupGlobalHandlers();
		this.setupDateChangeObservers();
		this.setupIntersectionHandlers();
		this.setupDateSelectionHandlers(); // ДОБАВИТЬ ЭТУ СТРОЧКУ
	}
    
    setupGlobalHandlers() {
        $(document).on('click', (e) => {
            this.handleClick(e);
        });

		$(document)
		.on('mousedown touchstart', '.group-children .list-item--wave', function(e) {
			// Если клик на волне - останавливаем распространение до обработчика группы
			console.log('volnidrag');
			e.stopPropagation();
		});
        
        // Существующие обработчики drag для дат и групп
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
    }
    
    
    // НОВЫЙ метод: dragstart для волн
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
        
        // Устанавливаем данные с меткой типа и ID группы
        e.originalEvent.dataTransfer.setData('text/plain', JSON.stringify({
            type: 'wave',
            id: waveId,
            index: index,
            groupId: groupId,
            source: 'wave-drag'
        }));
        
        $item.addClass('list-item--dragging');
    }
    
    // НОВЫЙ метод: dragover для волн
    handleWaveDragOver(e) {
        // Если это НЕ волна или драг не начался с волны - игнорируем
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
            
            // Строгая проверка: группы должны совпадать
            if (dragData.groupId !== targetGroupId) {
                e.originalEvent.dataTransfer.dropEffect = 'none';
                
                // Убираем подсветку у всех волн
                $('.group-children .list-item--wave')
                    .removeClass('list-item--drag-over-top list-item--drag-over-bottom');
                    
                return;
            }
            
            e.originalEvent.dataTransfer.dropEffect = 'move';
            
            const rect = $item[0].getBoundingClientRect();
            const y = e.clientY;
            const insertPosition = y - rect.top < rect.height / 2 ? 'before' : 'after';
            
            // Подсвечиваем только волны в ЭТОЙ группе
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
    
    // НОВЫЙ метод: dragleave для волн
    handleWaveDragLeave(e) {
        const $item = $(e.currentTarget);
        
        if (e.originalEvent.relatedTarget && 
            !$item[0].contains(e.originalEvent.relatedTarget)) {
            
            $item.removeClass('list-item--drag-over-top list-item--drag-over-bottom');
        }
    }
    
    // НОВЫЙ метод: drop для волн
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
            
            // Строгая проверка групп
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
    
    // НОВЫЙ метод: dragend для волн
    handleWaveDragEnd(e) {
        $('.list-item--wave').removeClass('list-item--dragging list-item--drag-over-top list-item--drag-over-bottom');
    }
    
    // НОВЫЙ метод: перестановка волны в группе
    reorderWaveInGroup(groupId, sourceIndex, targetIndex, insertBefore) {
        const group = window.appState.data.groups.find(g => String(g.id) === String(groupId));
        
        if (!group || !group.waves || !Array.isArray(group.waves)) {
            return;
        }
        
        const waves = [...group.waves];
        
        // Находим waveId по индексу
        const waveId = waves[sourceIndex];
        if (!waveId) {
            return;
        }
        
        // Удаляем из исходной позиции
        waves.splice(sourceIndex, 1);
        
        // Рассчитываем новую позицию
        let newIndex = this.calculateNewIndex(sourceIndex, targetIndex, insertBefore);
        
        // Вставляем на новую позицию
        waves.splice(newIndex, 0, waveId);
        
        // Обновляем массив волн в группе
        group.waves = waves;
        
        // Сохраняем состояние
        window.appState.save();
        
        // Обновляем отображение
        if (window.unifiedListManager && window.unifiedListManager.updateWavesList) {
            window.unifiedListManager.updateWavesList();
        }
        
        // Обновляем сводку
        setTimeout(() => {
            if (window.summaryManager && window.summaryManager.updateSummary) {
                window.summaryManager.updateSummary();
            }
        }, 50);
    }
    
    // МОДИФИЦИРОВАННЫЙ метод: calculateNewIndex
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
    
    // МОДИФИЦИРОВАННЫЙ метод: handleDragStart - добавляем проверку на drag волн
    handleDragStart(e) {
        // Пробуем получить данные drag - если это волна, игнорируем
        try {
            const data = e.originalEvent.dataTransfer.getData('text/plain');
            if (data) {
                const dragData = JSON.parse(data);
                if (dragData && dragData.type === 'wave') {
                    e.preventDefault();
                    return;
                }
            }
        } catch (error) {
            // Продолжаем обычную обработку
        }
        
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
    
    // МОДИФИЦИРОВАННЫЙ метод: handleDragOver - добавляем проверку на drag волн
    handleDragOver(e) {
        // Пробуем получить данные drag - если это волна, игнорируем
        try {
            const data = e.originalEvent.dataTransfer.getData('text/plain');
            if (data) {
                const dragData = JSON.parse(data);
                if (dragData && dragData.type === 'wave') {
                    return; // Игнорируем drag волн в обработчиках групп/дат
                }
            }
        } catch (error) {
            // Продолжаем обычную обработку
        }
        
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
    
    // МОДИФИЦИРОВАННЫЙ метод: handleDrop - добавляем проверку на drag волн
    handleDrop(e) {
        // ПРОВЕРКА: если drag волны - игнорируем
        if (this.isDraggingWave) {
            return;
        }
        
        try {
            const textData = e.originalEvent.dataTransfer.getData('text');
            if (textData === 'WAVE_DRAG') {
                return;
            }
        } catch (error) {
            // Продолжаем
        }
        
        const $item = $(e.currentTarget);
        e.preventDefault();
        
        $('.list-item').removeClass('list-item--drag-over-top list-item--drag-over-bottom');
        
        try {
            const dragData = JSON.parse(e.originalEvent.dataTransfer.getData('text/plain'));
            
            // Проверяем что это НЕ волна
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
    

	setupDateChangeObservers() {

		$(document).on('click', '.list-item--date[data-type="date"]', (e) => {
			const $target = $(e.target);
			const $item = $target.closest('.list-item--date');
			
			// Игнорируем клики на:
			// 1. Чекбоксах (уже обработано другим обработчиком)
			if ($target.is('.date-checkbox') || $target.closest('.date-checkbox').length) {
				return;
			}
			
			// 2. Кнопках управления (Изменить, Уничтожить)
			if ($target.is('button, input, textarea, select, .list-item__drag-handle, .delete-date-btn, .edit-btn')) {
				return;
			}
			
			// 3. Если редактирование активно
			if ($item.hasClass('list-item--editing')) {
				return;
			}
			
			if ($item.length) {
				e.preventDefault();
				e.stopPropagation();
				
				const dateId = $item.data('id');
				
				if (dateId && window.dates) {
					// При клике на дату выделяем ее тип A
					if (!window.appState.dateSelections) {
						window.appState.dateSelections = {
							typeA: null,
							typeB: null
						};
					}
					
					window.appState.dateSelections.typeA = dateId;
					window.appState.dateSelections.typeB = null; // Снимаем тип B
					
					// Активируем дату
					window.dates.setActiveDate(dateId, true);
					
					// Сохраняем состояние
					window.appState.save();
					
					// Обновляем отображение
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
		
		$(document).on('click', '.list-item--note', (e) => {
			const $target = $(e.target);
			if ($target.hasClass('delete-btn') || $target.closest('.delete-btn').length) {
				return;
			}
			
			const $item = $(e.currentTarget);
			const noteDate = $item.data('date');
			
			if (noteDate && window.dates) {
				const newDate = new Date(noteDate);
				window.dates.setDate(newDate);
				
				// СИНХРОНИЗАЦИЯ: При переходе к заметке тоже выделяем тип A
				if (!window.appState.dateSelections) {
					window.appState.dateSelections = {
						typeA: null,
						typeB: null
					};
				}
				
				// Находим дату, соответствующую заметке
				const noteTimestamp = newDate.getTime();
				const correspondingDate = window.appState.data.dates.find(date => {
					const dateStart = window.timeUtils.getStartOfDay(date.date);
					const noteStart = window.timeUtils.getStartOfDay(noteTimestamp);
					return dateStart.getTime() === noteStart.getTime();
				});
				
				if (correspondingDate) {
					window.appState.dateSelections.typeA = correspondingDate.id;
					window.appState.dateSelections.typeB = null;
					window.appState.save();
					
					if (window.unifiedListManager && window.unifiedListManager.updateDatesList) {
						setTimeout(() => {
							window.unifiedListManager.updateDatesList();
						}, 100);
					}
				}
				
				setTimeout(() => {
					if (window.summaryManager && window.summaryManager.updateSummary) {
						window.summaryManager.updateSummary();
					}
				}, 100);
			}
		});
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
                const wave = window.appState.data.waves.find(w => w.id === waveId);
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
        if (isChecked && window.waves && window.appState) {
            const isGroupEnabled = window.waves.isWaveGroupEnabled(waveId);
            
            if (!isGroupEnabled) {
                const groupId = this.findGroupForWave(waveId);
                
                if (groupId && !this.askedGroups.has(groupId)) {
                    const group = window.appState.data.groups.find(g => g.id === groupId);
                    const groupName = group ? group.name : 'Неизвестная группа';
                    
                    const shouldEnableGroup = confirm(`Группа "${groupName}" отключена. Включить её для отображения колоска?`);
                    
                    if (shouldEnableGroup) {
                        if (group) {
                            group.enabled = true;
                            
                            const waveIdStr = String(waveId);
                            window.appState.waveVisibility[waveIdStr] = true;
                            window.appState.save();
                            
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
                        this.askedGroups.add(groupId);
                        
                        const waveIdStr = String(waveId);
                        window.appState.waveVisibility[waveIdStr] = true;
                        window.appState.save();
                        
                        setTimeout(() => {
                            if (window.unifiedListManager && window.unifiedListManager.updateWavesList) {
                                window.unifiedListManager.updateWavesList();
                            }
                            
                            this.updateGroupStatsForWave(waveId, true);
                            
                            if (window.summaryManager && window.summaryManager.updateSummary) {
                                window.summaryManager.updateSummary();
                            }
                        }, 50);
                        
                        return;
                    }
                } else if (groupId && this.askedGroups.has(groupId)) {
                    const waveIdStr = String(waveId);
                    window.appState.waveVisibility[waveIdStr] = true;
                    window.appState.save();
                    
                    setTimeout(() => {
                        if (window.unifiedListManager && window.unifiedListManager.updateWavesList) {
                            window.unifiedListManager.updateWavesList();
                        }
                        
                        this.updateGroupStatsForWave(waveId, true);
                        
                        if (window.summaryManager && window.summaryManager.updateSummary) {
                            window.summaryManager.updateSummary();
                        }
                    }, 50);
                    
                    return;
                }
            }
        }
        
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
        if ($target.is('#btnAddNote') || $target.closest('#btnAddNote').length) {
            e.preventDefault();
            e.stopPropagation();
            const content = $('#noteInput').val();
            if (content && window.dates) {
                window.dates.addNote(content);
                if (window.dataManager) window.dataManager.updateNotesList();
                $('#noteInput').val('');
                
                setTimeout(() => {
                    if (window.summaryManager && window.summaryManager.updateSummary) {
                        window.summaryManager.updateSummary();
                    }
                }, 50);
            }
            return;
        }
        
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
        
        if ($target.is('#btnAnalyzeDB') || $target.closest('#btnAnalyzeDB').length) {
            e.preventDefault();
            return;
        }
        
        if ($target.is('#btnMigrateToNotes') || $target.closest('#btnMigrateToNotes').length) {
            e.preventDefault();
            return;
        }
        
        if ($target.is('#btnClearImportResults') || $target.closest('#btnClearImportResults').length) {
            e.preventDefault();
            if (window.importExport) {
                window.importExport.clearImportResults();
            }
            return;
        }

		if ($target.hasClass('extremum-wave-name')) {
			e.preventDefault();
			e.stopPropagation();
			
			const waveId = $target.data('wave-id');
			
			// Найти соответствующий чекбокс видимости
			const checkbox = $(`.wave-visibility-check[data-id="${waveId}"]`);
			if (checkbox.length) {
				// Эмулируем клик - существующая логика всё обработает
				checkbox.click();
			}
			return;
		}
        
        if ($target.is('#btnCalculateIntersections') || $target.closest('#btnCalculateIntersections').length) {
            e.preventDefault();
            if (window.waves) {
                const basePeriod = parseFloat($('#intersectionBasePeriod').val());
                const baseAmplitude = parseFloat($('#intersectionBaseAmplitude').val());
                const precision = parseFloat($('#intersectionPrecision').val());
                
                if (basePeriod && baseAmplitude) {
                    const results = window.waves.calculateIntersections(basePeriod, baseAmplitude, precision);
                    if (window.intersectionManager) {
                        window.intersectionManager.displayIntersectionResults(results);
                    }
                }
            }
            return;
        }
        
        if ($target.is('#btnClearIntersections') || $target.closest('#btnClearIntersections').length) {
            e.preventDefault();
            this.clearIntersectionResults();
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
        
        if ($target.is('[data-action="importDB"]')) {
            e.preventDefault();
            $('#importDBFile').click();
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
        
        if ($target.is('[onclick*="addIntersectionWave"]')) {
            e.preventDefault();
            e.stopPropagation();
            const onclick = $target.attr('onclick');
            const match = onclick.match(/addIntersectionWave\(([^,]+),\s*([^)]+)\)/);
            if (match) {
                const period = parseFloat(match[1]);
                const amplitude = parseFloat(match[2]);
                if (window.intersectionManager && window.intersectionManager.addIntersectionWave) {
                    window.intersectionManager.addIntersectionWave(period, amplitude);
                    
                    setTimeout(() => {
                        if (window.summaryManager && window.summaryManager.updateSummary) {
                            window.summaryManager.updateSummary();
                        }
                    }, 50);
                }
            }
            return;
        }
    }
    
    handleDragStart(e) {
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
    
    handleDragLeave(e) {
        const $item = $(e.currentTarget);
        
        if (e.originalEvent.relatedTarget && 
            !$item[0].contains(e.originalEvent.relatedTarget)) {
            
            $item.removeClass('list-item--drag-over-top list-item--drag-over-bottom');
            
        }
    }
    
    handleDrop(e) {
        const $item = $(e.currentTarget);
        e.preventDefault();
        
        $('.list-item').removeClass('list-item--drag-over-top list-item--drag-over-bottom');
        
        try {
            const dragData = JSON.parse(e.originalEvent.dataTransfer.getData('text/plain'));
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
    
    handleDragEnd(e) {
        $('.list-item').removeClass('list-item--dragging list-item--drag-over-top list-item--drag-over-bottom');
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
                const hasWave = group.waves.some(wId => {
                    const wIdStr = String(wId);
                    return wIdStr === waveIdStr;
                });
                
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
                    const waveInGroup = group.waves.some(wId => {
                        const wIdStr = String(wId);
                        const currentWaveIdStr = String(waveId);
                        return wIdStr === currentWaveIdStr;
                    });
                    
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
        
        if ($target.is('#btnCalculateIntersections') || $target.closest('#btnCalculateIntersections').length) {
            e.preventDefault();
            e.stopPropagation();
            
            this.calculateIntersectionsForSelectedDay();
            return;
        }
        
        if ($target.is('#btnUpdateForCurrentDate') || $target.closest('#btnUpdateForCurrentDate').length) {
            e.preventDefault();
            e.stopPropagation();
            
            if (window.intersectionManager) {
                window.intersectionManager.updateForCurrentDate();
            }
            return;
        }
        
        if ($target.is('#btnClearIntersections') || $target.closest('#btnClearIntersections').length) {
            e.preventDefault();
            e.stopPropagation();
            
            this.clearIntersectionResults();
            return;
        }
        
        if ($target.is('#onlyActiveWaves') || $target.closest('#onlyActiveWaves').length) {
            e.stopPropagation();
            const $checkbox = $target.is('input') ? $target : $target.find('input');
            const isChecked = $checkbox.prop('checked');
            
            if (window.intersectionManager) {
                window.intersectionManager.toggleOnlyActive(isChecked);
            }
            return;
        }
        
        const $intersectionItem = $target.closest('.intersection-item');
        if ($intersectionItem.length && 
            !$target.is('button') && 
            !$target.hasClass('wave-name')) {
            
            e.preventDefault();
            e.stopPropagation();
            
            const timestamp = $intersectionItem.data('timestamp');
            const index = $intersectionItem.data('index');
            
            if (timestamp && window.dates) {
                const intersectionDate = new Date(parseInt(timestamp));
                window.dates.setDate(intersectionDate);
            }
            return;
        }
    }
    
    calculateIntersectionsForSelectedDay() {
        try {
            const dateInput = $('#intersectionDate');
            const onlyActiveCheckbox = $('#onlyActiveWaves');
            
            if (!dateInput.length || !onlyActiveCheckbox.length) {
                return;
            }
            
            const selectedDate = dateInput.val() ? new Date(dateInput.val()) : new Date();
            selectedDate.setHours(12, 0, 0, 0);
            
            const onlyActive = onlyActiveCheckbox.prop('checked');
            
            if (window.intersectionManager) {
                window.intersectionManager.onlyActive = onlyActive;
                const intersections = window.intersectionManager.calculateDailyIntersections(selectedDate);
                window.intersectionManager.displayResults(intersections, selectedDate);
            }
            
        } catch (error) {
            alert('Ошибка расчета пересечений: ' + error.message);
        }
    }

	// modules/eventManager.js - ДОБАВИТЬ в конструктор или setupGlobalHandlers
	setupDateSelectionHandlers() {
		$(document).on('click', '.date-checkbox', (e) => {
			e.preventDefault();
			e.stopPropagation();
			
			const $checkbox = $(e.currentTarget);
			const dateId = $checkbox.data('id');
			const checkboxType = $checkbox.data('type'); // 'a' или 'b'
			
			this.handleDateCheckboxClick(dateId, checkboxType);
		});
	}


	// modules/eventManager.js - handleDateCheckboxClick()
	handleDateCheckboxClick(dateId, checkboxType) {
		// Инициализация если нет
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
		
		// Приводим все к строкам для сравнения
		const currentTargetStr = selections[targetKey] ? String(selections[targetKey]) : null;
		const currentOppositeStr = selections[oppositeKey] ? String(selections[oppositeKey]) : null;
		
		// ===== ОСОБЫЙ СЛУЧАЙ: выделяем B на дату, которая уже А =====
		if (checkboxType === 'b' && selections.typeA && String(selections.typeA) === dateIdStr) {
			// Находим первую другую дату для переноса типа A
			const allDates = window.appState.data.dates || [];
			
			// Ищем первую дату, которая не совпадает с текущей
			const newTypeADate = allDates.find(date => {
				const dateStr = String(date.id);
				return dateStr !== dateIdStr;
			});
			
			if (newTypeADate) {
				// Переносим тип A на первую найденную дату
				selections.typeA = newTypeADate.id;
				
				// Обновляем активную дату (если была привязана к старой дате A)
				if (window.appState.activeDateId && String(window.appState.activeDateId) === dateIdStr) {
					window.appState.activeDateId = newTypeADate.id;
					if (window.dates) {
						window.dates.setActiveDate(newTypeADate.id, true);
					}
				}
				
				// Теперь устанавливаем тип B на выбранную дату
				selections.typeB = dateId;
				
				// Сохраняем состояние
				window.appState.save();
				
				// Обновляем отображение
				if (window.unifiedListManager && window.unifiedListManager.updateDatesList) {
					window.unifiedListManager.updateDatesList();
				}
				
				// Показываем уведомление пользователю
				console.log(`Тип A автоматически перенесен на дату: ${newTypeADate.name}`);
				return;
			} else {
				// Если нет других дат - отменяем выделение типа B
				console.log('Невозможно выделить тип B: только одна дата в списке');
				return;
			}
		}
		
		// ===== СТАНДАРТНАЯ ЛОГИКА =====
		
		// 1. Для чекбокса A - особая логика: нельзя снять, только перенести
		if (checkboxType === 'a') {
			// Если кликаем на уже выделенную дату типа A - НИЧЕГО НЕ ДЕЛАЕМ (нельзя снять)
			if (currentTargetStr === dateIdStr) {
				// Ничего не делаем - чекбокс A должен остаться отмеченным
				console.log('Чекбокс A нельзя снять. Для изменения выберите другую дату.');
				return;
			}
			// Иначе - устанавливаем новую дату типа A
			else {
				selections.typeA = dateId;
				
				// Снимаем тип B с этой даты, если он был
				if (selections.typeB && String(selections.typeB) === dateIdStr) {
					selections.typeB = null;
				}
				
				// Активируем дату
				if (window.dates) {
					window.dates.setActiveDate(dateId, true);
				}
			}
		}
		// 2. Для чекбокса B - обычная логика, но с проверкой на конфликт с A
		else if (checkboxType === 'b') {
			// Если пытаемся установить B на дату, которая уже A - обработано выше
			// Если кликаем на уже выделенную дату типа B - снимаем выделение
			if (currentTargetStr === dateIdStr) {
				selections.typeB = null;
			} 
			// Иначе - устанавливаем новую дату типа B
			else {
				selections.typeB = dateId;
			}
		}
		
		// Сохраняем состояние
		window.appState.save();

		// Обновляем отображение
		if (window.unifiedListManager && window.unifiedListManager.updateDatesList) {
			window.unifiedListManager.updateDatesList();
		}
	}

    
    clearIntersectionResults() {
        const $container = $('#intersectionResults');
        const $stats = $('#intersectionStats');
        
        if ($container.length) {
            $container.html('<div class="list-empty">Нет рассчитанных пересечений</div>');
        }
        
        if ($stats.length) {
            $stats.hide().empty();
        }
        
        if (window.intersectionManager) {
            window.intersectionManager.clearCache();
        }
    }
}

window.eventManager = new EventManager();