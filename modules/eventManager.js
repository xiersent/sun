class EventManager {
    constructor() {
        this.askedGroups = new Set();
        this.$ = window.jQuery;
        this.setupGlobalHandlers();
        this.setupDateChangeObservers();
        this.setupIntersectionHandlers();
    }
    
    setupGlobalHandlers() {
        $(document).on('click', (e) => {
            this.handleClick(e);
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
    }
    
    setupDateChangeObservers() {
        $(document).on('click', '.list-item--date[data-type="date"]', (e) => {
            const $target = $(e.target);
            const $item = $target.closest('.list-item--date');
            
            if ($target.is('button, input, textarea, select, .list-item__drag-handle, .delete-date-btn, .edit-btn')) {
                return;
            }
            
            if ($item.length && !$item.hasClass('list-item--editing')) {
                e.preventDefault();
                e.stopPropagation();
                
                const dateId = $item.data('id');
                
                if (dateId && window.dates) {
                    window.dates.setActiveDate(dateId, true);
                    
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