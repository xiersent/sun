// optimized3/modules/unifiedListManager.js
// optimized3/modules/unifiedListManager.js
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
        this.initTemplates();
    }
    
    async initTemplates() {
        try {
            const templateIds = ['date-item-template', 'wave-item-template', 'group-item-template'];
            
            for (const templateId of templateIds) {
                const templateElement = document.getElementById(templateId);
                if (templateElement && templateElement.text) {
                    this.templateCache[templateId] = templateElement.text;
                    console.log(`Загружен inline шаблон: ${templateId}`);
                } else {
                    // Загружаем из файла
                    const url = `templates/${templateId.replace('-template', '')}.ejs`;
                    const response = await fetch(url);
                    if (response.ok) {
                        const templateText = await response.text();
                        this.templateCache[templateId] = templateText;
                        console.log(`Загружен файловый шаблон: ${templateId} из ${url}`);
                    } else {
                        console.error(`Не удалось загрузить шаблон ${templateId} из ${url}: ${response.status}`);
                    }
                }
            }
            
            this.templatesLoaded = true;
            console.log('Все шаблоны загружены');
            
        } catch (error) {
            console.error('Ошибка загрузки шаблонов:', error);
            this.templatesLoaded = true;
            // Без fallback - просто оставляем шаблоны пустыми
        }
    }
    
    getTemplate(templateId) {
        if (this.templateCache[templateId]) {
            return this.templateCache[templateId];
        }
        
        console.warn(`Шаблон ${templateId} не загружен, возвращаю пустой`);
        return '<div class="list-error">Шаблон не загружен</div>';
    }
    
    log(...args) {
        if (this.debug) {
            console.log('[UnifiedListManager]', ...args);
        }
    }
    
    prepareDateData(dateObj, index) {
        const dateObjDate = new Date(dateObj.date);
        const yearsFromCurrent = window.dom.getYearsBetweenDates(dateObjDate, window.appState.currentDate);
        
        return {
            id: dateObj.id,
            name: dateObj.name,
            type: 'date',
            formattedDate: window.dom.formatDate(dateObjDate),
            dateForInput: window.dom.formatDateForInput(dateObjDate),
            yearsFromCurrent: yearsFromCurrent,
            active: dateObj.id === window.appState.activeDateId,
            editing: window.appState.editingDateId === dateObj.id,
            index: index
        };
    }
    
    prepareWaveData(wave, index) {
        const waveIdStr = String(wave.id);
        
        return {
            id: wave.id,
            name: wave.name,
            type: 'wave',
            period: wave.period,
            color: wave.color,
            typeValue: wave.type,
            description: window.dom.getWaveDescription(wave.type),
            visible: window.appState.waveVisibility[waveIdStr] !== false,
            bold: window.appState.waveBold[waveIdStr] || false,
            editing: window.appState.editingWaveId === wave.id,
            index: index
        };
    }
    
    prepareGroupData(groupData, index) {
        const originalGroup = window.appState.data.groups.find(g => g.id === groupData.id);
        
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
            originalGroup.waves.forEach((waveId, i) => {
                const waveIdStr = String(waveId);
                const wave = window.appState.data.waves.find(w => {
                    const wIdStr = String(w.id);
                    return wIdStr === waveIdStr;
                });
                
                if (wave) {
                    existingWaves.push(wave);
                    // Проверяем, включен ли колосок
                    const waveIdStrForCheck = String(wave.id);
                    if (window.appState.waveVisibility[waveIdStrForCheck] !== false) {
                        enabledCount++;
                    }
                }
            });
        }
        
        const waveCount = existingWaves.length;
        const childrenData = existingWaves.map((wave, waveIndex) => {
            return this.prepareWaveData(wave, waveIndex);
        });
        
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
            editing: window.appState.editingGroupId === originalGroup.id
        };
    }
    
    renderList(containerId, items, itemType) {
        const container = document.getElementById(containerId);
        if (!container) {
            console.error('UnifiedListManager: контейнер не найден:', containerId);
            return;
        }
        
        if (!this.templatesLoaded) {
            container.innerHTML = '<div class="list-empty">Загрузка шаблонов...</div>';
            
            setTimeout(() => {
                if (this.templatesLoaded) {
                    this.renderList(containerId, items, itemType);
                }
            }, 100);
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
            default: templateId = 'date-item-template';
        }
        
        const templateText = this.getTemplate(templateId);
        if (!templateText || templateText.includes('Шаблон не загружен')) {
            container.innerHTML = '<div class="list-error">Ошибка: шаблон не загружен</div>';
            return;
        }
        
        if (itemType === 'group') {
            items.forEach((groupData, index) => {
                try {
                    const renderedGroup = ejs.render(templateText, { data: groupData });
                    
                    const tempDiv = document.createElement('div');
                    tempDiv.innerHTML = renderedGroup;
                    const groupElement = tempDiv.firstElementChild;
                    
                    const childrenContainer = groupElement.querySelector('.group-children');
                    
                    if (childrenContainer && groupData.children && groupData.children.length > 0 && groupData.expanded) {
                        childrenContainer.innerHTML = '';
                        
                        groupData.children.forEach((childData, childIndex) => {
                            try {
                                childData.type = 'wave';
                                const waveTemplateText = this.getTemplate('wave-item-template');
                                const renderedChild = ejs.render(waveTemplateText, { data: childData });
                                
                                const childTempDiv = document.createElement('div');
                                childTempDiv.innerHTML = renderedChild;
                                const childElement = childTempDiv.firstElementChild;
                                
                                childrenContainer.appendChild(childElement);
                            } catch (error) {
                                const errorDiv = document.createElement('div');
                                errorDiv.className = 'list-error';
                                errorDiv.textContent = `Ошибка рендеринга: ${error.message}`;
                                childrenContainer.appendChild(errorDiv);
                            }
                        });
                    }
                    
                    container.appendChild(groupElement);
                    
                } catch (error) {
                    const errorDiv = document.createElement('div');
                    errorDiv.className = 'list-error';
                    errorDiv.textContent = `Ошибка рендеринга группы: ${error.message}`;
                    container.appendChild(errorDiv);
                }
            });
        } else {
            const renderedItems = [];
            items.forEach((item, index) => {
                try {
                    const data = this.templates[itemType] ? this.templates[itemType](item, index) : item;
                    data.type = data.type || itemType;
                    
                    const rendered = ejs.render(templateText, { data });
                    renderedItems.push(rendered);
                } catch (error) {
                    renderedItems.push(`<div class="list-error">Ошибка рендеринга элемента: ${error.message}</div>`);
                }
            });
            
            container.innerHTML = renderedItems.join('');
        }
        
        console.log('UnifiedListManager: список отрендерен в контейнере:', containerId, 'элементов:', items.length);
    }
    
    getEmptyMessage(type) {
        const messages = {
            date: 'Нет сохраненных дат',
            wave: 'Нет колосков',
            group: 'Нет групп колосков',
            note: 'Нет сохраненных записей',
            intersection: 'Нет совпадений'
        };
        return messages[type] || 'Список пуст';
    }
    
    handleEditClick(id, type, containerId) {
        console.log('UnifiedListManager: обработка клика редактирования:', type, id);
        
        if (type === 'date') {
            window.appState.data.dates.forEach(date => {
                if (date.id === id) {
                    window.appState.editingDateId = window.appState.editingDateId === id ? null : id;
                }
            });
            this.updateDatesList();
        } else if (type === 'wave') {
            window.appState.data.waves.forEach(wave => {
                if (wave.id === id) {
                    window.appState.editingWaveId = window.appState.editingWaveId === id ? null : id;
                }
            });
            this.updateWavesList();
        } else if (type === 'group') {
            window.appState.editingGroupId = window.appState.editingGroupId === id ? null : id;
            console.log('Режим редактирования группы установлен:', id, window.appState.editingGroupId);
            window.appState.save();
            this.updateWavesList();
        }
    }
    
    handleDeleteClick(id, type) {
        console.log('UnifiedListManager: обработка клика удаления:', type, id);
        
        if (type === 'date') {
            window.dates.deleteDate(id);
            this.updateDatesList();
        } else if (type === 'wave') {
            window.waves.deleteWave(id);
            this.updateWavesList();
        } else if (type === 'group') {
            window.dates.deleteGroup(id);
            this.updateWavesList();
        }
    }
    
    handleSaveClick(id, type, containerId) {
        console.log('UnifiedListManager: обработка клика сохранения:', type, id);
        
        if (type === 'date') {
            this.saveDateChanges(id);
        } else if (type === 'wave') {
            this.saveWaveChanges(id);
        } else if (type === 'group') {
            this.saveGroupChanges(id);
        }
    }
    
    handleCancelClick(id, type, containerId) {
        console.log('UnifiedListManager: обработка клика отмены:', type, id);
        
        if (type === 'date') {
            window.appState.editingDateId = null;
            this.updateDatesList();
        } else if (type === 'wave') {
            window.appState.editingWaveId = null;
            this.updateWavesList();
        } else if (type === 'group') {
            window.appState.editingGroupId = null;
            this.updateWavesList();
        }
    }
    
    saveDateChanges(dateId) {
        console.log('UnifiedListManager: сохранение изменений даты:', dateId);
        
        const dateObj = window.appState.data.dates.find(d => d.id === dateId);
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
            dateObj.date = newDate.toISOString();
            window.appState.editingDateId = null;
            
            if (window.appState.activeDateId === dateId) {
                window.appState.baseDate = new Date(newDate);
                window.dates.recalculateCurrentDay();
                window.waves.updatePosition();
                window.grid.updateCenterDate();
                window.grid.createGrid();
                window.grid.updateGridNotesHighlight();
            }
            
            this.updateDatesList();
            window.appState.save();
        } catch (error) {
            alert(`Ошибка при сохранении даты: ${error.message}`);
        }
    }
    
    saveWaveChanges(waveId) {
        console.log('UnifiedListManager: сохранение изменений волны:', waveId);
        
        const wave = window.appState.data.waves.find(w => w.id === waveId);
        if (!wave) {
            window.appState.editingWaveId = null;
            this.updateWavesList();
            return;
        }
        
        const newName = document.getElementById(`editWaveName${waveId}`).value.trim();
        const newPeriod = parseFloat(document.getElementById(`editWavePeriod${waveId}`).value);
        const newType = document.getElementById(`editWaveType${waveId}`).value;
        const newColor = document.getElementById(`editWaveColor${waveId}`).value;
        
        if (!newName) {
            alert('Пожалуйста, введите название колоска');
            return;
        }
        if (!newPeriod || newPeriod < 0.1) {
            alert('Пожалуйста, введите корректный период (больше 0.1)');
            return;
        }
        
        wave.name = newName;
        wave.period = newPeriod;
        wave.type = newType;
        wave.color = newColor;
        
        if (window.waves.wavePaths && window.waves.wavePaths[waveId]) {
            window.waves.wavePaths[waveId].style.stroke = newColor;
            
            const path = window.waves.wavePaths[waveId];
            path.classList.remove('solid', 'dashed', 'dotted', 'zigzag', 'dash-dot', 'long-dash');
            if (newType !== 'solid') {
                path.classList.add(newType);
            }
            
            path.classList.toggle('bold', window.appState.waveBold[waveId]);
        }
        
        if (window.waves.waveContainers && window.waves.waveContainers[waveId]) {
            window.waves.waveContainers[waveId].remove();
        }
        
        window.waves.createWaveElement(wave);
        window.appState.editingWaveId = null;
        this.updateWavesList();
        window.waves.updatePosition();
        window.appState.save();
    }
    
    saveGroupChanges(groupId) {
        console.log('UnifiedListManager: сохранение изменений группы:', groupId);
        
        const group = window.appState.data.groups.find(g => g.id === groupId);
        if (!group) {
            window.appState.editingGroupId = null;
            this.updateWavesList();
            return;
        }
        
        const newName = document.getElementById(`editGroupName${groupId}`)?.value.trim();
        
        if (!newName) {
            alert('Пожалуйста, введите название группы');
            return;
        }
        
        group.name = newName;
        window.appState.editingGroupId = null;
        
        this.updateWavesList();
        window.appState.save();
        
        console.log('Группа сохранена:', groupId, newName);
    }
    
    changeWaveColor(wave) {
        console.log('UnifiedListManager: изменение цвета волны:', wave.id);
        
        const colorInput = document.createElement('input');
        colorInput.type = 'color';
        colorInput.value = wave.color;
        colorInput.addEventListener('change', (e) => {
            wave.color = e.target.value;
            
            if (window.waves.wavePaths && window.waves.wavePaths[wave.id]) {
                window.waves.wavePaths[wave.id].style.stroke = wave.color;
            }
            
            window.waves.updateCornerSquareColors();
            
            // ДОБАВИТЬ СОХРАНЕНИЕ
            window.appState.save();
            
            this.updateWavesList();
        });
        colorInput.click();
    }
    
    updateDatesList() {
        console.log('UnifiedListManager: обновление списка дат...');
        this.renderList('dateListForDates', window.appState.data.dates, 'date');
    }
    
    updateWavesList() {
        console.log('UnifiedListManager: обновление списка волн...');
        
        const container = document.getElementById('wavesList');
        if (!container) {
            console.error('UnifiedListManager: контейнер wavesList не найден');
            return;
        }
        
        const sortedGroups = [...window.appState.data.groups].sort((a, b) => {
            if (a.id === 'default-group') return -1;
            if (b.id === 'default-group') return 1;
            if (a.id === 'classic-group') return -1;
            if (b.id === 'classic-group') return 1;
            if (a.id === 'experimental-group') return -1;
            if (b.id === 'experimental-group') return 1;
            if (a.id === '120-waves-group') return -1;
            if (b.id === '120-waves-group') return 1;
            if (a.id === '31-waves-group') return -1;
            if (b.id === '31-waves-group') return 1;
            return 0;
        });
        
        const allGroups = sortedGroups.map((group, index) => {
            const groupData = this.prepareGroupData(group, index);
            return groupData;
        });
        
        this.renderList('wavesList', allGroups, 'group');
    }
    
    // НОВЫЕ МЕТОДЫ ДЛЯ ОБНОВЛЕНИЯ СТАТИСТИКИ ГРУПП
    
    updateGroupStats(groupId) {
        console.log('UnifiedListManager: обновление статистики группы:', groupId);
        
        const group = window.appState.data.groups.find(g => g.id === groupId);
        if (!group) {
            console.warn('Группа не найдена:', groupId);
            return;
        }
        
        const groupElement = document.querySelector(`.list-item--group[data-id="${groupId}"]`);
        if (!groupElement) {
            console.warn('Элемент группы не найден в DOM:', groupId);
            return;
        }
        
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
        
        console.log('Статистика обновлена:', groupId, 'включено:', enabledCount, 'всего:', waveCount);
    }
}

window.unifiedListManager = new UnifiedListManager();