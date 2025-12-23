// optimized3/modules/eventManager.js
class EventManager {
    constructor() {
        console.log('EventManager: инициализация...');
        this.setupGlobalHandlers();
    }
    
    setupGlobalHandlers() {
        console.log('EventManager: настройка глобальных обработчиков...');
        
        document.addEventListener('click', (e) => {
            this.handleClick(e);
        });
        
        document.addEventListener('dragstart', (e) => this.handleDragStart(e));
        document.addEventListener('dragover', (e) => this.handleDragOver(e));
        document.addEventListener('drop', (e) => this.handleDrop(e));
        document.addEventListener('dragend', (e) => this.handleDragEnd(e));
    }
    
    handleClick(e) {
        const target = e.target;
        
        const actionBtn = target.closest('[data-action]');
        if (actionBtn) {
            e.preventDefault();
            e.stopPropagation();
            const action = actionBtn.dataset.action;
            console.log('EventManager: клик по action-кнопке:', action);
            if (window.uiManager && action) {
                window.uiManager.handleAction(action, actionBtn);
                return;
            }
        }
        
        const expandCollapseBtn = target.closest('.expand-collapse-btn');
        if (expandCollapseBtn) {
            e.preventDefault();
            e.stopPropagation();
            const id = expandCollapseBtn.dataset.id;
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
        
        const groupDeleteBtn = target.closest('.delete-date-btn[data-type="group"]');
        if (groupDeleteBtn) {
            e.preventDefault();
            e.stopPropagation();
            const id = groupDeleteBtn.dataset.id;
            console.log('EventManager: удаление группы:', id);
            
            if (id && window.unifiedListManager) {
                window.unifiedListManager.handleDeleteClick(id, 'group');
            }
            return;
        }
        
        // ИСПРАВЛЕНО: проверяем ВСЕ edit-btn без фильтрации по data-type
        const editBtn = target.closest('.edit-btn');
        if (editBtn) {
            e.preventDefault();
            e.stopPropagation();
            const id = editBtn.dataset.id;
            const type = editBtn.dataset.type || 'date';
            
            console.log('EventManager: клик по кнопке редактирования:', type, id);
            
            if (window.unifiedListManager) {
                const containerId = this.getContainerId(target);
                window.unifiedListManager.handleEditClick(id, type, containerId);
            }
            return;
        }
        
        const deleteBtn = target.closest('.delete-date-btn, .delete-btn');
        if (deleteBtn && !deleteBtn.closest('.list-item--note') && deleteBtn.dataset.type !== 'group') {
            e.preventDefault();
            e.stopPropagation();
            const id = deleteBtn.dataset.id;
            const type = deleteBtn.dataset.type || 'date';
            console.log('EventManager: клик по кнопке удаления:', type, id);
            if (window.unifiedListManager) {
                window.unifiedListManager.handleDeleteClick(id, type);
            }
            return;
        }
        
        const saveBtn = target.closest('.save-btn');
        if (saveBtn) {
            e.preventDefault();
            e.stopPropagation();
            const id = saveBtn.dataset.id;
            const type = saveBtn.dataset.type || 'date';
            console.log('EventManager: клик по кнопке сохранения:', type, id);
            if (window.unifiedListManager) {
                const containerId = this.getContainerId(target);
                window.unifiedListManager.handleSaveClick(id, type, containerId);
            }
            return;
        }
        
        const cancelBtn = target.closest('.cancel-btn');
        if (cancelBtn) {
            e.preventDefault();
            e.stopPropagation();
            const id = cancelBtn.dataset.id;
            const type = cancelBtn.dataset.type || 'date';
            console.log('EventManager: клик по кнопки отмены:', type, id);
            if (window.unifiedListManager) {
                const containerId = this.getContainerId(target);
                window.unifiedListManager.handleCancelClick(id, type, containerId);
            }
            return;
        }
        
        if (target.classList.contains('wave-visibility-check')) {
            e.stopPropagation();
            const waveId = target.dataset.id;
            console.log('EventManager: изменение видимости волны:', waveId, target.checked);
            
            if (waveId && window.appState) {
                // УПРОЩЕННАЯ ЛОГИКА: Всегда разрешаем переключение состояния
                const waveIdStr = String(waveId);
                window.appState.waveVisibility[waveIdStr] = target.checked;
                window.appState.save();
                
                // НАЙДЕМ ВОЛНУ В ДАННЫХ
                const wave = window.appState.data.waves.find(w => String(w.id) === waveIdStr);
                
                // ПРОВЕРЯЕМ, ВКЛЮЧЕНА ЛИ ГРУППА С ЭТОЙ ВОЛНОЙ
                const isGroupEnabled = window.waves.isWaveGroupEnabled(waveId);
                const shouldShow = target.checked && isGroupEnabled;
                
                // КРИТИЧЕСКОЕ ИСПРАВЛЕНИЕ: СОЗДАЕМ КОНТЕЙНЕР, ЕСЛИ ЕГО НЕТ
                if (shouldShow) {
                    // Если контейнера нет и волна существует — создаем его
                    if (!window.waves.waveContainers[waveId] && wave) {
                        console.log('EventManager: создаем отсутствующий контейнер волны:', waveId);
                        window.waves.createWaveElement(wave);
                    }
                    // Показываем контейнер
                    if (window.waves.waveContainers[waveId]) {
                        window.waves.waveContainers[waveId].style.display = 'block';
                    }
                } else {
                    // Скрываем контейнер, если есть
                    if (window.waves.waveContainers[waveId]) {
                        window.waves.waveContainers[waveId].style.display = 'none';
                    }
                }
                
                // ВАЖНО: Обновить позиции волн после изменения видимости
                if (window.waves && window.waves.updatePosition) {
                    window.waves.updatePosition();
                }
                
                // Обновить статистику группы
                this.updateGroupStatsForWave(waveId, target.checked);
            }
            return;
        }
        
        if (target.classList.contains('wave-bold-check')) {
            e.stopPropagation();
            const waveId = target.dataset.id;
            console.log('EventManager: изменение жирности волны:', waveId, target.checked);
            
            if (waveId && window.appState) {
                window.appState.waveBold[waveId] = target.checked;
                window.appState.save();
                if (window.waves) window.waves.updatePosition();
            }
            return;
        }
        
        if (target.classList.contains('wave-color-preview-small')) {
            e.stopPropagation();
            const waveId = target.dataset.id;
            console.log('EventManager: клик по превью цвета волны:', waveId);
            if (waveId && window.unifiedListManager) {
                const wave = window.appState.data.waves.find(w => w.id === waveId);
                if (wave) {
                    window.unifiedListManager.changeWaveColor(wave);
                }
            }
            return;
        }
        
        // ДОБАВЛЕНО: обработчик чекбокса окраски краев
        if (target.classList.contains('wave-corner-color-check')) {
            e.stopPropagation();
            const waveId = target.dataset.id;
            console.log('EventManager: изменение окраски краев волной:', waveId, target.checked);
            
            if (waveId && window.waves) {
                window.waves.setWaveCornerColor(waveId, target.checked);
            }
            return;
        }
        
        if (target.classList.contains('wave-group-toggle')) {
            e.stopPropagation();
            const groupId = target.dataset.groupId;
            console.log('EventManager: переключение группы:', groupId, target.checked);
            
            if (groupId && window.appState) {
                const group = window.appState.data.groups.find(g => g.id === groupId);
                if (group) {
                    group.enabled = target.checked;
                    window.appState.save();
                    
                    // ГАРАНТИЯ: Полностью пересоздать элементы волн
                    setTimeout(() => {
                        // Удалить старые контейнеры
                        document.querySelectorAll('.wave-container').forEach(c => c.remove());
                        if (window.waves) {
                            window.waves.waveContainers = {};
                            window.waves.wavePaths = {};
                        }
                        
                        // Создать ВСЕ видимые волны заново
                        window.appState.data.waves.forEach(wave => {
                            const waveIdStr = String(wave.id);
                            const isWaveVisible = window.appState.waveVisibility[waveIdStr] !== false;
                            const isGroupEnabled = window.waves.isWaveGroupEnabled(wave.id);
                            const shouldShow = isWaveVisible && isGroupEnabled;
                            
                            if (shouldShow) {
                                window.waves.createWaveElement(wave);
                            }
                        });
                        
                        // Обновить позиции
                        if (window.waves.updatePosition) {
                            window.waves.updatePosition();
                        }
                        
                        // Обновить список
                        window.unifiedListManager.updateWavesList();
                        
                        console.log('Волны полностью пересозданы после переключения группы');
                    }, 100);
                }
            }
            return;
        }
        
        if (target.classList.contains('tab-button')) {
            e.preventDefault();
            e.stopPropagation();
            console.log('EventManager: клик по табу:', target.dataset.tab);
            if (window.uiManager) {
                window.uiManager.handleTabClick(target);
            }
            return;
        }
        
        if ((target.id === 'btnAddNote' || target.closest('#btnAddNote')) && !e.defaultPrevented) {
            e.preventDefault();
            e.stopPropagation();
            console.log('EventManager: клик по кнопке добавления заметки');
            const content = document.getElementById('noteInput')?.value;
            if (content && window.dates) {
                window.dates.addNote(content);
                if (window.dataManager) window.dataManager.updateNotesList();
                document.getElementById('noteInput').value = '';
            }
            return;
        }
        
        if (target.id === 'btnAddCustomWave' || target.closest('#btnAddCustomWave')) {
            e.preventDefault();
            e.stopPropagation();
            console.log('EventManager: добавление волны');
            
            const name = document.getElementById('customWaveName')?.value;
            const period = document.getElementById('customWavePeriod')?.value;
            const type = document.getElementById('customWaveType')?.value;
            const color = document.getElementById('customWaveColor')?.value;
            
            if (name && period) {
                const newWave = window.waves.addCustomWave(name, period, type, color);
                if (newWave && window.unifiedListManager) {
                    window.unifiedListManager.updateWavesList();
                    
                    document.getElementById('customWaveName').value = '';
                    document.getElementById('customWavePeriod').value = '';
                    document.getElementById('customWaveColor').value = '#666666';
                    
                    // НОВОЕ: Обновить статистику группы по умолчанию
                    const defaultGroup = window.appState.data.groups.find(g => g.id === 'default-group');
                    if (defaultGroup && window.unifiedListManager.updateGroupStats) {
                        window.unifiedListManager.updateGroupStats('default-group');
                    }
                }
            }
            return;
        }
        
        if (target.id === 'btnPrevDay' || target.closest('#btnPrevDay')) {
            e.preventDefault();
            console.log('EventManager: предыдущий день');
            if (window.dates) window.dates.navigateDay(-1);
            return;
        }
        
        if (target.id === 'btnNextDay' || target.closest('#btnNextDay')) {
            e.preventDefault();
            console.log('EventManager: следующий день');
            if (window.dates) window.dates.navigateDay(1);
            return;
        }
        
        if (target.id === 'btnToday' || target.closest('#btnToday')) {
            e.preventDefault();
            console.log('EventManager: сегодня');
            if (window.dates) window.dates.goToToday();
            return;
        }
        
        if (target.id === 'btnSetDate' || target.closest('#btnSetDate')) {
            e.preventDefault();
            console.log('EventManager: установка даты из инпута');
            if (window.dates) window.dates.setDateFromInput();
            return;
        }
        
        const dateListItem = target.closest('.list-item--date[data-type="date"]');
        if (dateListItem && !dateListItem.classList.contains('list-item--editing')) {
            if (!target.closest('button') && 
                !target.closest('input') && 
                !target.closest('textarea') && 
                !target.closest('select') &&
                !target.classList.contains('list-item__drag-handle') &&
                !target.classList.contains('delete-date-btn') &&
                !target.classList.contains('edit-btn') &&
                target.tagName !== 'BUTTON' &&
                target.tagName !== 'INPUT' &&
                target.tagName !== 'TEXTAREA' &&
                target.tagName !== 'SELECT') {
                
                e.preventDefault();
                e.stopPropagation();
                const dateId = dateListItem.dataset.id;
                console.log('EventManager: выбор даты из списка:', dateId);
                
                if (dateId && window.dates) {
                    // Устанавливаем активную дату - это пересчитает currentDay
                    // и перестроит графики относительно новой базовой даты
                    window.dates.setActiveDate(dateId);
                }
                return;
            }
        }
        
        const noteItem = target.closest('.list-item--note');
        if (noteItem && !target.closest('.delete-btn')) {
            const noteDate = noteItem.dataset.date;
            console.log('EventManager: клик по заметке, дата:', noteDate);
            if (noteDate && window.dates) {
                const newDate = new Date(noteDate);
                window.dates.setDate(newDate);
            }
            return;
        }
        
        if (target.id === 'btnAnalyzeDB' || target.closest('#btnAnalyzeDB')) {
            e.preventDefault();
            console.log('EventManager: анализ DB');
            return;
        }
        
        if (target.id === 'btnMigrateToNotes' || target.closest('#btnMigrateToNotes')) {
            e.preventDefault();
            console.log('EventManager: миграция DB в заметки');
            return;
        }
        
        if (target.id === 'btnClearImportResults' || target.closest('#btnClearImportResults')) {
            e.preventDefault();
            console.log('EventManager: очистка результатов импорта');
            if (window.importExport) {
                window.importExport.clearImportResults();
            }
            return;
        }
        
        if (target.id === 'btnCalculateIntersections' || target.closest('#btnCalculateIntersections')) {
            e.preventDefault();
            console.log('EventManager: расчет пересечений');
            if (window.waves) {
                const basePeriod = parseFloat(document.getElementById('intersectionBasePeriod')?.value);
                const baseAmplitude = parseFloat(document.getElementById('intersectionBaseAmplitude')?.value);
                const precision = parseFloat(document.getElementById('intersectionPrecision')?.value);
                
                if (basePeriod && baseAmplitude) {
                    const results = window.waves.calculateIntersections(basePeriod, baseAmplitude, precision);
                    if (window.intersectionManager) {
                        window.intersectionManager.displayIntersectionResults(results);
                    }
                }
            }
            return;
        }
        
        if (target.id === 'btnClearIntersections' || target.closest('#btnClearIntersections')) {
            e.preventDefault();
            console.log('EventManager: очистка пересечений');
            if (window.appState && window.appCore && window.appCore.elements) {
                window.appState.intersectionResults = [];
                window.appCore.elements.intersectionResults.innerHTML = '';
                window.appCore.elements.intersectionStats.style.display = 'none';
                
                const emptyMessage = document.createElement('div');
                emptyMessage.className = 'list-empty';
                emptyMessage.textContent = 'Результаты очищены';
                window.appCore.elements.intersectionResults.appendChild(emptyMessage);
            }
            return;
        }
        
        if (target.id === 'btnAddGroup' || target.closest('#btnAddGroup')) {
            e.preventDefault();
            console.log('EventManager: добавление группы');
            const groupName = document.getElementById('newGroupName')?.value;
            if (groupName && window.dates) {
                window.dates.addGroup(groupName);
                if (window.dataManager) window.dataManager.updateWavesGroups();
                document.getElementById('newGroupName').value = '';
            }
            return;
        }
        
        if (target.dataset.action === 'importAll') {
            e.preventDefault();
            console.log('EventManager: клик по импорту всех данных');
            document.getElementById('importAllFile').click();
            return;
        }
        
        if (target.dataset.action === 'importDB') {
            e.preventDefault();
            console.log('EventManager: клик по импорту DB');
            document.getElementById('importDBFile').click();
            return;
        }
        
        if (target.classList.contains('spoiler-toggle')) {
            e.preventDefault();
            e.stopPropagation();
            console.log('EventManager: переключение спойлера');
            if (window.uiManager && window.uiManager.toggleSpoiler) {
                window.uiManager.toggleSpoiler(target);
            }
            return;
        }
        
        const addIntersectionBtn = target.closest('[onclick*="addIntersectionWave"]');
        if (addIntersectionBtn) {
            e.preventDefault();
            e.stopPropagation();
            const onclick = addIntersectionBtn.getAttribute('onclick');
            const match = onclick.match(/addIntersectionWave\(([^,]+),\s*([^)]+)\)/);
            if (match) {
                const period = parseFloat(match[1]);
                const amplitude = parseFloat(match[2]);
                console.log('EventManager: добавление волны пересечения:', period, amplitude);
                if (window.intersectionManager && window.intersectionManager.addIntersectionWave) {
                    window.intersectionManager.addIntersectionWave(period, amplitude);
                }
            }
            return;
        }
    }
    
    handleDragStart(e) {
        const item = e.target.closest('.list-item--date[data-type="date"]');
        if (!item || item.classList.contains('list-item--editing')) return;
        
        const id = item.dataset.id;
        const index = parseInt(item.dataset.index || 0);
        
        e.dataTransfer.setData('text/plain', JSON.stringify({
            type: 'date',
            id: id,
            index: index
        }));
        item.classList.add('list-item--dragging');
        
        console.log('EventManager: начало перетаскивания даты:', id, index);
    }
    
    handleDragOver(e) {
        const item = e.target.closest('.list-item--date[data-type="date"]');
        if (item) {
            e.preventDefault();
            e.dataTransfer.dropEffect = 'move';
            item.classList.add('list-item--drag-over');
        }
    }
    
    handleDrop(e) {
        const item = e.target.closest('.list-item--date[data-type="date"]');
        if (!item) return;
        
        e.preventDefault();
        item.classList.remove('list-item--drag-over');
        
        try {
            const dragData = JSON.parse(e.dataTransfer.getData('text/plain'));
            if (dragData.type === 'date') {
                const targetIndex = parseInt(item.dataset.index || 0);
                console.log('EventManager: дроп даты с индекса', dragData.index, 'на индекс', targetIndex);
                
                if (dragData.index !== targetIndex) {
                    const [movedItem] = window.appState.data.dates.splice(dragData.index, 1);
                    window.appState.data.dates.splice(targetIndex, 0, movedItem);
                    window.appState.save();
                    if (window.dataManager) window.dataManager.updateDateList();
                }
            }
        } catch (error) {
            console.error('EventManager: ошибка при дропе:', error);
        }
    }
    
    handleDragEnd(e) {
        document.querySelectorAll('.list-item').forEach(item => {
            item.classList.remove('list-item--dragging', 'list-item--drag-over');
        });
        console.log('EventManager: конец перетаскивания');
    }
    
    getContainerId(element) {
        const container = element.closest('.list-container');
        return container ? container.id : null;
    }
    
    // НОВЫЕ МЕТОДЫ ДЛЯ ОБНОВЛЕНИЯ СТАТИСТИКИ ГРУПП
    
    updateGroupStatsForWave(waveId, isVisible) {
        console.log('Обновление статистики группы для волны:', waveId, isVisible);
        
        // Найти группу, содержащую эту волну
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
                        
                        // Обновить статистику группы через UnifiedListManager
                        if (window.unifiedListManager && window.unifiedListManager.updateGroupStats) {
                            window.unifiedListManager.updateGroupStats(group.id);
                        }
                    }
                }
            });
        }
    }
    
    updateGroupElementStats(groupElement, group) {
        const groupId = group.id;
        
        // Подсчитать включенные волны
        let enabledCount = 0;
        if (group.waves && Array.isArray(group.waves)) {
            group.waves.forEach(waveId => {
                const waveIdStr = String(waveId);
                if (window.appState.waveVisibility[waveIdStr] !== false) {
                    enabledCount++;
                }
            });
        }
        
        // Обновить текст счетчика в DOM
        const statsElement = groupElement.querySelector('.list-item__value .group-stats');
        if (statsElement) {
            const waveCount = group.waves ? group.waves.length : 0;
            
            if (enabledCount > 0) {
                statsElement.innerHTML = `
                    <span class="group-enabled-count" title="Включено колосков">
                        Включено: ${enabledCount}
                    </span>
                    <span class="group-total-count" title="Всего колосков">
                        Колосков: ${waveCount}
                    </span>
                `;
            } else {
                statsElement.innerHTML = `
                    <span class="group-total-count">
                        Колосков: ${waveCount}
                    </span>
                `;
            }
        }
    }
}

window.eventManager = new EventManager();