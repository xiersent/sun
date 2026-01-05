// modules/eventManager.js - ВЕРСИЯ С JQUERY
class EventManager {
    constructor() {
        console.log('EventManager: инициализация с jQuery...');
        this.askedGroups = new Set();
        this.$ = window.jQuery; // Сохраняем ссылку на jQuery
        this.setupGlobalHandlers();
        this.setupDateChangeObservers();
        this.setupIntersectionHandlers();
    }
    
    setupGlobalHandlers() {
        console.log('EventManager: настройка глобальных обработчиков с jQuery...');
        
        // Используем делегирование событий через jQuery
        $(document).on('click', (e) => {
            this.handleClick(e);
        });
        
        // Drag & Drop с jQuery - ДОБАВЛЕН dragleave
        $(document)
            .on('dragstart', '.list-item--date[data-type="date"]:not(.list-item--editing)', this.handleDragStart.bind(this))
            .on('dragover', '.list-item--date[data-type="date"]', this.handleDragOver.bind(this))
            .on('dragleave', '.list-item--date[data-type="date"]', this.handleDragLeave.bind(this)) // ДОБАВЛЕНО
            .on('drop', '.list-item--date[data-type="date"]', this.handleDrop.bind(this))
            .on('dragend', '.list-item--date[data-type="date"]', this.handleDragEnd.bind(this));
    }
    
    setupDateChangeObservers() {
        // Обработка кликов по датам и заметкам через делегирование jQuery
        $(document).on('click', '.list-item--date[data-type="date"]', (e) => {
            const $target = $(e.target);
            const $item = $target.closest('.list-item--date');
            
            // Проверяем, что клик не по кнопкам или полям ввода
            if ($target.is('button, input, textarea, select, .list-item__drag-handle, .delete-date-btn, .edit-btn')) {
                return;
            }
            
            if ($item.length && !$item.hasClass('list-item--editing')) {
                e.preventDefault();
                e.stopPropagation();
                
                const dateId = $item.data('id');
                console.log('EventManager: выбор даты из списка:', dateId);
                
                if (dateId && window.dates) {
                    window.dates.setActiveDate(dateId, true);
                    
                    // Обновляем сводку через setTimeout
                    setTimeout(() => {
                        if (window.summaryManager && window.summaryManager.updateSummary) {
                            window.summaryManager.updateSummary();
                        }
                    }, 100);
                }
            }
        });
        
        // Обработка кликов по заметкам
        $(document).on('click', '.list-item--note', (e) => {
            const $target = $(e.target);
            if ($target.hasClass('delete-btn') || $target.closest('.delete-btn').length) {
                return;
            }
            
            const $item = $(e.currentTarget);
            const noteDate = $item.data('date');
            console.log('EventManager: клик по заметке, дата:', noteDate);
            
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
        
        // Обработка кнопок навигации с обновлением сводки
        if ($target.is('#btnPrevDay, #btnNextDay, #btnToday, #btnNow, #btnSetDate') || 
            $target.closest('#btnPrevDay, #btnNextDay, #btnToday, #btnNow, #btnSetDate').length) {
            e.preventDefault();
            
            // После навигации обновляем сводную информацию
            setTimeout(() => {
                if (window.summaryManager && window.summaryManager.updateSummary) {
                    window.summaryManager.updateSummary();
                }
            }, 100);
        }
        
        // Обработка action-кнопок
        const $actionBtn = $target.closest('[data-action]');
        if ($actionBtn.length) {
            e.preventDefault();
            e.stopPropagation();
            const action = $actionBtn.data('action');
            console.log('EventManager: клик по action-кнопке:', action);
            if (window.uiManager && action) {
                window.uiManager.handleAction(action, $actionBtn[0]);
                return;
            }
        }
        
        // Обработка табов
        if ($target.hasClass('tab-button')) {
            e.preventDefault();
            e.stopPropagation();
            console.log('EventManager: клик по табу:', $target.data('tab'));
            if (window.uiManager) {
                window.uiManager.handleTabClick($target[0]);
            }
            return;
        }
        
        // Кнопка развернуть/свернуть группу
        const $expandBtn = $target.closest('.expand-collapse-btn');
        if ($expandBtn.length) {
            e.preventDefault();
            e.stopPropagation();
            const id = $expandBtn.data('id');
            console.log('EventManager: развернуть/свернуть группу:', id);
            
            if (id && window.unifiedListManager) {
                const group = window.appState.data.groups.find(g => g.id === id);
                if (group) {
                    group.expanded = !group.expanded;
                    window.appState.save();
                    window.unifiedListManager.updateWavesList();
                }
            }
            return;
        }
        
        // Удаление группы
        const $groupDeleteBtn = $target.closest('.delete-date-btn[data-type="group"]');
        if ($groupDeleteBtn.length) {
            e.preventDefault();
            e.stopPropagation();
            const id = $groupDeleteBtn.data('id');
            console.log('EventManager: удаление группы:', id);
            
            if (id && window.unifiedListManager) {
                window.unifiedListManager.handleDeleteClick(id, 'group');
            }
            return;
        }
        
        // Кнопки редактирования (все типы)
        const $editBtn = $target.closest('.edit-btn');
        if ($editBtn.length) {
            e.preventDefault();
            e.stopPropagation();
            const id = $editBtn.data('id');
            const type = $editBtn.data('type') || 'date';
            
            console.log('EventManager: клик по кнопке редактирования:', type, id);
            
            if (window.unifiedListManager) {
                const containerId = this.getContainerId($target[0]);
                window.unifiedListManager.handleEditClick(id, type, containerId);
            }
            return;
        }
        
        // Кнопки удаления (кроме заметок и групп)
        const $deleteBtn = $target.closest('.delete-date-btn, .delete-btn');
        if ($deleteBtn.length && 
            !$target.closest('.list-item--note').length && 
            $deleteBtn.data('type') !== 'group') {
            e.preventDefault();
            e.stopPropagation();
            const id = $deleteBtn.data('id');
            const type = $deleteBtn.data('type') || 'date';
            console.log('EventManager: клик по кнопке удаления:', type, id);
            if (window.unifiedListManager) {
                window.unifiedListManager.handleDeleteClick(id, type);
            }
            return;
        }
        
        // Кнопки сохранения
        const $saveBtn = $target.closest('.save-btn');
        if ($saveBtn.length) {
            e.preventDefault();
            e.stopPropagation();
            const id = $saveBtn.data('id');
            const type = $saveBtn.data('type') || 'date';
            console.log('EventManager: клик по кнопке сохранения:', type, id);
            if (window.unifiedListManager) {
                const containerId = this.getContainerId($target[0]);
                window.unifiedListManager.handleSaveClick(id, type, containerId);
            }
            return;
        }
        
        // Кнопки отмены
        const $cancelBtn = $target.closest('.cancel-btn');
        if ($cancelBtn.length) {
            e.preventDefault();
            e.stopPropagation();
            const id = $cancelBtn.data('id');
            const type = $cancelBtn.data('type') || 'date';
            console.log('EventManager: клик по кнопки отмены:', type, id);
            if (window.unifiedListManager) {
                const containerId = this.getContainerId($target[0]);
                window.unifiedListManager.handleCancelClick(id, type, containerId);
            }
            return;
        }
        
        // Чекбокс видимости волны
        if ($target.hasClass('wave-visibility-check')) {
            e.stopPropagation();
            const waveId = $target.data('id');
            const isChecked = $target.prop('checked');
            console.log('EventManager: изменение видимости волны:', waveId, isChecked);
            
            this.handleWaveVisibilityChange(waveId, isChecked, $target);
            return;
        }
        
        // Чекбокс жирности волны
        if ($target.hasClass('wave-bold-check')) {
            e.stopPropagation();
            const waveId = $target.data('id');
            console.log('EventManager: изменение жирности волны:', waveId, $target.prop('checked'));
            
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
        
        // Превью цвета волны
        if ($target.hasClass('wave-color-preview-small')) {
            e.stopPropagation();
            const waveId = $target.data('id');
            console.log('EventManager: клик по превью цвета волны:', waveId);
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
        
        // Чекбокс окраски краев
        if ($target.hasClass('wave-corner-color-check')) {
            e.stopPropagation();
            const waveId = $target.data('id');
            console.log('EventManager: изменение окраски краев волной:', waveId, $target.prop('checked'));
            
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
        
        // Переключение группы
        if ($target.hasClass('wave-group-toggle')) {
            e.stopPropagation();
            const groupId = $target.data('groupId');
            const isChecked = $target.prop('checked');
            console.log('EventManager: переключение группы:', groupId, isChecked);
            
            this.handleGroupToggle(groupId, isChecked);
            return;
        }
        
        // Обработка остальных кнопок по ID
        this.handleButtonClicks($target, e);
    }
    
    handleWaveVisibilityChange(waveId, isChecked, $checkbox) {
        if (isChecked && window.waves && window.appState) {
            // Проверяем, включена ли группа этой волны
            const isGroupEnabled = window.waves.isWaveGroupEnabled(waveId);
            
            if (!isGroupEnabled) {
                // Найти группу для этой волны
                const groupId = this.findGroupForWave(waveId);
                
                if (groupId && !this.askedGroups.has(groupId)) {
                    const group = window.appState.data.groups.find(g => g.id === groupId);
                    const groupName = group ? group.name : 'Неизвестная группа';
                    
                    const shouldEnableGroup = confirm(`Группа "${groupName}" отключена. Включить её для отображения колоска?`);
                    
                    if (shouldEnableGroup) {
                        // Включаем группу
                        if (group) {
                            group.enabled = true;
                            console.log('EventManager: группа включена:', groupId);
                            
                            const waveIdStr = String(waveId);
                            window.appState.waveVisibility[waveIdStr] = true;
                            window.appState.save();
                            
                            // Обновляем UI
                            setTimeout(() => {
                                if (window.unifiedListManager && window.unifiedListManager.updateWavesList) {
                                    window.unifiedListManager.updateWavesList();
                                }
                                
                                // Пересоздаем элементы волн
                                this.recreateAllWaveElements();
                                
                                // Обновляем статистику группы
                                this.updateGroupStatsForWave(waveId, true);
                                
                                // Обновляем сводную информацию
                                if (window.summaryManager && window.summaryManager.updateSummary) {
                                    window.summaryManager.updateSummary();
                                }
                                
                                // Гарантируем, что чекбокс останется отмеченным
                                $checkbox.prop('checked', true);
                            }, 100);
                        }
                        return;
                    } else {
                        // Пользователь отказался
                        this.askedGroups.add(groupId);
                        console.log('EventManager: пользователь отказался включать группу:', groupId);
                        
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
                    // Уже спрашивали
                    console.log('EventManager: уже спрашивали про группу, оставляем чекбокс:', groupId);
                    
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
        
        // Стандартная логика
        if (waveId && window.appState) {
            const waveIdStr = String(waveId);
            window.appState.waveVisibility[waveIdStr] = isChecked;
            window.appState.save();
            
            const wave = window.appState.data.waves.find(w => String(w.id) === waveIdStr);
            const isGroupEnabled = window.waves.isWaveGroupEnabled(waveId);
            const shouldShow = isChecked && isGroupEnabled;
            
            if (shouldShow) {
                if (!window.waves.waveContainers[waveId] && wave) {
                    console.log('EventManager: создаем отсутствующий контейнер волны:', waveId);
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
                    console.log('EventManager: группа включена вручную, очищаем отметку:', groupId);
                }
                
                setTimeout(() => {
                    // Удаляем старые контейнеры через jQuery
                    $('.wave-container').remove();
                    if (window.waves) {
                        window.waves.waveContainers = {};
                        window.waves.wavePaths = {};
                    }
                    
                    // Создаем ВСЕ видимые волны заново
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
                    
                    console.log('Волны полностью пересозданы после переключения группы');
                }, 100);
            }
        }
    }
    
    handleButtonClicks($target, e) {
        // Добавление заметки
        if ($target.is('#btnAddNote') || $target.closest('#btnAddNote').length) {
            e.preventDefault();
            e.stopPropagation();
            console.log('EventManager: клик по кнопке добавления заметки');
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
        
        // Добавление волны
        if ($target.is('#btnAddCustomWave') || $target.closest('#btnAddCustomWave').length) {
            e.preventDefault();
            e.stopPropagation();
            console.log('EventManager: добавление волны');
            
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
        
        // Навигация по дням
        if ($target.is('#btnPrevDay') || $target.closest('#btnPrevDay').length) {
            e.preventDefault();
            console.log('EventManager: предыдущий день');
            if (window.dates) window.dates.navigateDay(-1);
            return;
        }
        
        if ($target.is('#btnNextDay') || $target.closest('#btnNextDay').length) {
            e.preventDefault();
            console.log('EventManager: следующий день');
            if (window.dates) window.dates.navigateDay(1);
            return;
        }
        
        if ($target.is('#btnToday') || $target.closest('#btnToday').length) {
            e.preventDefault();
            console.log('EventManager: сегодня');
            if (window.dates) window.dates.goToToday();
            return;
        }
        
        if ($target.is('#btnNow') || $target.closest('#btnNow').length) {
            e.preventDefault();
            console.log('EventManager: сейчас');
            if (window.dates) window.dates.goToNow();
            return;
        }
        
        if ($target.is('#btnSetDate') || $target.closest('#btnSetDate').length) {
            e.preventDefault();
            console.log('EventManager: установка даты из инпута');
            if (window.dates) window.dates.setDateFromInput();
            return;
        }
        
        // DB операции
        if ($target.is('#btnAnalyzeDB') || $target.closest('#btnAnalyzeDB').length) {
            e.preventDefault();
            console.log('EventManager: анализ DB');
            return;
        }
        
        if ($target.is('#btnMigrateToNotes') || $target.closest('#btnMigrateToNotes').length) {
            e.preventDefault();
            console.log('EventManager: миграция DB в заметки');
            return;
        }
        
        if ($target.is('#btnClearImportResults') || $target.closest('#btnClearImportResults').length) {
            e.preventDefault();
            console.log('EventManager: очистка результатов импорта');
            if (window.importExport) {
                window.importExport.clearImportResults();
            }
            return;
        }
        
        // Пересечения
        if ($target.is('#btnCalculateIntersections') || $target.closest('#btnCalculateIntersections').length) {
            e.preventDefault();
            console.log('EventManager: расчет пересечений');
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
            console.log('EventManager: очистка пересечений');
            this.clearIntersectionResults();
            return;
        }
        
        // Добавление группы
        if ($target.is('#btnAddGroup') || $target.closest('#btnAddGroup').length) {
            e.preventDefault();
            console.log('EventManager: добавление группы');
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
        
        // Импорт файлов
        if ($target.is('[data-action="importAll"]')) {
            e.preventDefault();
            console.log('EventManager: клик по импорту всех данных');
            $('#importAllFile').click();
            return;
        }
        
        if ($target.is('[data-action="importDB"]')) {
            e.preventDefault();
            console.log('EventManager: клик по импорту DB');
            $('#importDBFile').click();
            return;
        }
        
        // Спойлеры
        if ($target.hasClass('spoiler-toggle')) {
            e.preventDefault();
            e.stopPropagation();
            console.log('EventManager: переключение спойлера');
            if (window.uiManager && window.uiManager.toggleSpoiler) {
                window.uiManager.toggleSpoiler($target[0]);
            }
            return;
        }
        
        // Добавление волны пересечения
        if ($target.is('[onclick*="addIntersectionWave"]')) {
            e.preventDefault();
            e.stopPropagation();
            const onclick = $target.attr('onclick');
            const match = onclick.match(/addIntersectionWave\(([^,]+),\s*([^)]+)\)/);
            if (match) {
                const period = parseFloat(match[1]);
                const amplitude = parseFloat(match[2]);
                console.log('EventManager: добавление волны пересечения:', period, amplitude);
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
    const id = $item.data('id');
    const index = parseInt($item.data('index') || 0);
    
    // Проверяем, что элемент существует
    if (!id || index < 0) {
        console.warn('Неверные данные для перетаскивания:', { id, index });
        e.preventDefault();
        return;
    }
    
    e.originalEvent.dataTransfer.setData('text/plain', JSON.stringify({
        type: 'date',
        id: id,
        index: index
    }));
    
    $item.addClass('list-item--dragging');
    
    
    console.log('EventManager: начало перетаскивания даты:', id, 'индекс:', index);
}
    
	handleDragOver(e) {
		e.preventDefault();
		e.originalEvent.dataTransfer.dropEffect = 'move';
		
		const $item = $(e.currentTarget);
		const rect = $item[0].getBoundingClientRect();
		const y = e.clientY;
		
		// Определяем, куда вставлять: сверху или снизу элемента
		const insertPosition = y - rect.top < rect.height / 2 ? 'before' : 'after';
		
		// Убираем подсветку у всех других элементов
		$('.list-item--date').not($item).removeClass('list-item--drag-over-top list-item--drag-over-bottom');
	
		
		// Показываем индикатор вставки
		if (insertPosition === 'before') {
			// Вставка перед элементом - индикатор сверху
			$item.addClass('list-item--drag-over-top');
			$item.removeClass('list-item--drag-over-bottom');
			
		} else {
			// Вставка после элемента - индикатор снизу
			$item.addClass('list-item--drag-over-bottom');
			$item.removeClass('list-item--drag-over-top');
			
		}
	}
    
	handleDragLeave(e) {
		const $item = $(e.currentTarget);
		
		// Проверяем, действительно ли курсор покинул элемент
		// Используем relatedTarget для более точной проверки
		if (e.originalEvent.relatedTarget && 
			!$item[0].contains(e.originalEvent.relatedTarget)) {
			
			// Убираем подсветку
			$item.removeClass('list-item--drag-over-top list-item--drag-over-bottom');
			
		}
	}
    
handleDrop(e) {
    const $item = $(e.currentTarget);
    e.preventDefault();
    
    // Убираем все подсветки и индикаторы
    $('.list-item').removeClass('list-item--drag-over-top list-item--drag-over-bottom');
    
    try {
        const dragData = JSON.parse(e.originalEvent.dataTransfer.getData('text/plain'));
        if (dragData.type === 'date') {
            const targetIndex = parseInt($item.data('index') || 0);
            
            // Определяем позицию вставки (сверху или снизу)
            const rect = $item[0].getBoundingClientRect();
            const y = e.clientY;
            const insertBefore = y - rect.top < rect.height / 2;
            
            console.log('EventManager: дроп даты с индекса', dragData.index, 'на индекс', targetIndex, 
                      insertBefore ? '(перед)' : '(после)');
            
            // Проверяем, нужно ли вообще перемещать элемент
            if (dragData.index === targetIndex) {
                // Элемент дропнут на самого себя
                console.log('Элемент дропнут на самого себя, ничего не делаем');
                return;
            }
            
            // Извлекаем перемещаемый элемент
            const [movedItem] = window.appState.data.dates.splice(dragData.index, 1);
            
            // Рассчитываем новый индекс с учетом того, что элемент уже удален из массива
            let newIndex;
            
            if (dragData.index < targetIndex) {
                // Перемещаем элемент ВНИЗ в списке
                if (insertBefore) {
                    // Вставляем ПЕРЕД целевым элементом
                    // После удаления элемента, все элементы сдвинулись вверх
                    // targetIndex уменьшился на 1
                    newIndex = targetIndex - 1;
                } else {
                    // Вставляем ПОСЛЕ целевого элемента
                    // targetIndex не изменился
                    newIndex = targetIndex;
                }
            } else {
                // Перемещаем элемент ВВЕРХ в списке
                if (insertBefore) {
                    // Вставляем ПЕРЕД целевым элементом
                    // targetIndex не изменился
                    newIndex = targetIndex;
                } else {
                    // Вставляем ПОСЛЕ целевого элемента
                    // targetIndex увеличился на 1
                    newIndex = targetIndex + 1;
                }
            }
            
            // Вставляем элемент на новую позицию
            window.appState.data.dates.splice(newIndex, 0, movedItem);
            window.appState.save();
            
            // Обновляем UI
            if (window.dataManager) window.dataManager.updateDateList();
            
            // Обновляем сводную информацию
            setTimeout(() => {
                if (window.summaryManager && window.summaryManager.updateSummary) {
                    window.summaryManager.updateSummary();
                }
            }, 50);
            
            console.log('Элемент перемещен на позицию:', newIndex);
        }
    } catch (error) {
        console.error('EventManager: ошибка при дропе:', error);
    }
}
    
    handleDragEnd(e) {
        // Гарантированно убираем все подсветки и индикаторы
        $('.list-item').removeClass('list-item--dragging list-item--drag-over-top list-item--drag-over-bottom');
        console.log('EventManager: конец перетаскивания');
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
        console.log('Обновление статистики группы для волны:', waveId, isVisible);
        
        if (window.appState && window.appState.data && window.appState.data.groups) {
            window.appState.data.groups.forEach(group => {
                if (group.waves && Array.isArray(group.waves)) {
                    const waveInGroup = group.waves.some(wId => {
                        const wIdStr = String(wId);
                        const currentWaveIdStr = String(waveId);
                        return wIdStr === currentWaveIdStr;
                    });
                    
                    if (waveInGroup) {
                        console.log('Найдена группа для обновления:', group.id, group.name);
                        
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
        // Удалить старые контейнеры через jQuery
        $('.wave-container').remove();
        if (window.waves) {
            window.waves.waveContainers = {};
            window.waves.wavePaths = {};
        }
        
        // Создать ВСЕ видимые волны заново
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
        console.log('EventManager: настройка обработчиков пересечений с jQuery...');
        
        $(document).on('click', (e) => {
            this.handleIntersectionClick(e);
        });
    }
    
    handleIntersectionClick(e) {
        const $target = $(e.target);
        
        // Кнопка "Рассчитать за день"
        if ($target.is('#btnCalculateIntersections') || $target.closest('#btnCalculateIntersections').length) {
            e.preventDefault();
            e.stopPropagation();
            console.log('EventManager: расчет пересечений за день');
            
            this.calculateIntersectionsForSelectedDay();
            return;
        }
        
        // Кнопка "Для текущей даты"
        if ($target.is('#btnUpdateForCurrentDate') || $target.closest('#btnUpdateForCurrentDate').length) {
            e.preventDefault();
            e.stopPropagation();
            console.log('EventManager: обновление для текущей даты');
            
            if (window.intersectionManager) {
                window.intersectionManager.updateForCurrentDate();
            }
            return;
        }
        
        // Кнопка "Очистить"
        if ($target.is('#btnClearIntersections') || $target.closest('#btnClearIntersections').length) {
            e.preventDefault();
            e.stopPropagation();
            console.log('EventManager: очистка результатов пересечений');
            
            this.clearIntersectionResults();
            return;
        }
        
        // Чекбокс "Только активные колоски"
        if ($target.is('#onlyActiveWaves') || $target.closest('#onlyActiveWaves').length) {
            e.stopPropagation();
            const $checkbox = $target.is('input') ? $target : $target.find('input');
            const isChecked = $checkbox.prop('checked');
            console.log('EventManager: переключение режима колосков:', isChecked ? 'только активные' : 'все');
            
            if (window.intersectionManager) {
                window.intersectionManager.toggleOnlyActive(isChecked);
            }
            return;
        }
        
        // Клик по элементу пересечения
        const $intersectionItem = $target.closest('.intersection-item');
        if ($intersectionItem.length && 
            !$target.is('button') && 
            !$target.hasClass('wave-name')) {
            
            e.preventDefault();
            e.stopPropagation();
            
            const timestamp = $intersectionItem.data('timestamp');
            const index = $intersectionItem.data('index');
            
            console.log('EventManager: клик по пересечению', index, timestamp);
            
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
                console.error('EventManager: элементы управления не найдены');
                return;
            }
            
            const selectedDate = dateInput.val() ? new Date(dateInput.val()) : new Date();
            selectedDate.setHours(12, 0, 0, 0);
            
            const onlyActive = onlyActiveCheckbox.prop('checked');
            
            console.log('Расчет пересечений для:', selectedDate.toDateString(), 
                    onlyActive ? '(только активные)' : '(все колоски)');
            
            if (window.intersectionManager) {
                window.intersectionManager.onlyActive = onlyActive;
                const intersections = window.intersectionManager.calculateDailyIntersections(selectedDate);
                window.intersectionManager.displayResults(intersections, selectedDate);
            }
            
        } catch (error) {
            console.error('EventManager: ошибка расчета:', error);
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