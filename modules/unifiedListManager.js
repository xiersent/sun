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
        
        // Добавляем Promise для отслеживания загрузки
        this.templatesLoadPromise = null;
    }
    
    // ЗАМЕНА: initTemplates теперь возвращает Promise
    initTemplates() {
        // Если уже загружено, возвращаем выполненный Promise
        if (this.templatesLoaded) {
            return Promise.resolve();
        }
        
        // Если загрузка уже идет, возвращаем существующий Promise
        if (this.templatesLoadPromise) {
            return this.templatesLoadPromise;
        }
        
        // Создаем новый Promise для загрузки
        this.templatesLoadPromise = new Promise(async (resolve, reject) => {
            try {
                const templateIds = ['date-item-template', 'wave-item-template', 'group-item-template'];
                let loadedCount = 0;
                
                // Параллельная загрузка всех шаблонов
                const loadPromises = templateIds.map(async (templateId) => {
                    try {
                        const templateElement = document.getElementById(templateId);
                        if (templateElement && templateElement.text) {
                            this.templateCache[templateId] = templateElement.text;
                            console.log(`Загружен inline шаблон: ${templateId}`);
                            loadedCount++;
                            return;
                        }
                        
                        // Загружаем из файла только если нет inline шаблона
                        const url = `templates/${templateId.replace('-template', '')}.ejs`;
                        console.log(`Попытка загрузки шаблона из файла: ${url}`);
                        
                        // Добавляем таймаут для предотвращения зависания
                        const timeoutPromise = new Promise((_, timeoutReject) => {
                            setTimeout(() => timeoutReject(new Error(`Таймаут загрузки шаблона: ${templateId}`)), 3000);
                        });
                        
                        const fetchPromise = fetch(url);
                        
                        const response = await Promise.race([fetchPromise, timeoutPromise]);
                        
                        if (response.ok) {
                            const templateText = await response.text();
                            this.templateCache[templateId] = templateText;
                            console.log(`Загружен файловый шаблон: ${templateId} из ${url}`);
                            loadedCount++;
                        } else {
                            console.error(`Не удалось загрузить шаблон ${templateId} из ${url}: ${response.status}`);
                            // Не прерываем всю загрузку, продолжаем с остальными
                        }
                    } catch (error) {
                        console.error(`Ошибка загрузки шаблона ${templateId}:`, error);
                        // Продолжаем загрузку других шаблонов
                    }
                });
                
                // Ждем загрузки всех шаблонов
                await Promise.allSettled(loadPromises);
                
                console.log(`Загружено шаблонов: ${loadedCount} из ${templateIds.length}`);
                
                // Даже если не все загрузились, помечаем как загруженные
                this.templatesLoaded = true;
                resolve();
                
            } catch (error) {
                console.error('Критическая ошибка загрузки шаблонов:', error);
                // Даже при ошибке помечаем как загруженные, чтобы приложение не зависло
                this.templatesLoaded = true;
                resolve(); // Разрешаем, а не отклоняем, чтобы приложение продолжало работать
            }
        });
        
        return this.templatesLoadPromise;
    }
    
    // ДОБАВЛЯЕМ: Метод для безопасного рендеринга с ожиданием загрузки
    async renderListWithWait(containerId, items, itemType) {
        // Если шаблоны еще не загружены, ждем
        if (!this.templatesLoaded) {
            console.log(`Шаблоны не загружены, ожидание загрузки для ${containerId}...`);
            try {
                await this.initTemplates();
            } catch (error) {
                console.error('Ошибка при ожидании загрузки шаблонов:', error);
            }
        }
        
        // Теперь рендерим
        return this.renderList(containerId, items, itemType);
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
        const activeDateIdStr = window.appState.activeDateId ? String(window.appState.activeDateId) : null;
        const editingDateIdStr = window.appState.editingDateId ? String(window.appState.editingDateId) : null;
        const dateObjIdStr = String(dateObj.id);
        
        return {
            id: dateObj.id,
            name: dateObj.name,
            type: 'date',
            formattedDate: window.dom.formatDate(dateObjDate),
            dateForInput: window.dom.formatDateForInput(dateObjDate),
            yearsFromCurrent: yearsFromCurrent,
            active: activeDateIdStr === dateObjIdStr,
            editing: editingDateIdStr === dateObjIdStr,
            index: index
        };
    }
    
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
            bold: window.appState.waveBold[waveIdStr] || false,
            cornerColor: window.appState.waveCornerColor[waveIdStr] || false, // ДОБАВЛЕНО
            editing: editingWaveIdStr === waveIdStr,
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
    
    renderList(containerId, items, itemType) {
        const container = document.getElementById(containerId);
        if (!container) {
            console.error('UnifiedListManager: контейнер не найден:', containerId);
            return;
        }
        
        // Если шаблоны не загружены (должно быть невозможно после renderListWithWait)
        if (!this.templatesLoaded) {
            container.innerHTML = '<div class="list-empty">Загрузка шаблонов...</div>';
            console.warn(`Шаблоны не загружены для рендеринга ${containerId}, отображаем сообщение`);
            
            // Пытаемся загрузить и перерендерить
            setTimeout(() => {
                this.initTemplates().then(() => {
                    this.renderList(containerId, items, itemType);
                });
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
            console.error(`Шаблон ${templateId} не найден в кэше`);
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
            this.updateWavesList();
        } else if (type === 'group') {
            const idStr = String(id);
            const editingGroupIdStr = window.appState.editingGroupId ? String(window.appState.editingGroupId) : null;
            
            window.appState.editingGroupId = editingGroupIdStr === idStr ? null : id;
            console.log('Режим редактирования группы установлен:', id, window.appState.editingGroupId);
            window.appState.save();
            this.updateWavesList();
        }
    }
    
    handleDeleteClick(id, type, containerId) {
        console.log('UnifiedListManager: обработка клика удаления:', type, id);
        
        if (type === 'date') {
            // Приводим id к строке для поиска
            window.dates.deleteDate(String(id));
            this.updateDatesList();
        } else if (type === 'wave') {
            // Приводим id к строке
            window.waves.deleteWave(String(id));
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
            // Передаем id как строку
            this.saveWaveChanges(String(id));
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
            dateObj.date = newDate.toISOString();
            window.appState.editingDateId = null;
            
            if (String(window.appState.activeDateId) === String(dateId)) {
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
        
        const wave = window.appState.data.waves.find(w => String(w.id) === String(waveId));
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
        
        const group = window.appState.data.groups.find(g => String(g.id) === String(groupId));
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
        
        const group = window.appState.data.groups.find(g => String(g.id) === String(groupId));
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
    
    // Добавляем метод для принудительной перезагрузки
    async reloadTemplates() {
        this.templatesLoaded = false;
        this.templatesLoadPromise = null;
        await this.initTemplates();
        console.log('Шаблоны перезагружены');
    }
}

window.unifiedListManager = new UnifiedListManager();