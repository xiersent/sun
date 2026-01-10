// modules/unifiedListManager.js
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
        
        this.templatesLoadPromise = null;
    }
    
    initTemplates() {
        if (this.templatesLoaded) {
            return Promise.resolve();
        }
        
        if (this.templatesLoadPromise) {
            return this.templatesLoadPromise;
        }
        
        this.templatesLoadPromise = new Promise(async (resolve, reject) => {
            try {
                const templateIds = ['date-item-template', 'wave-item-template', 'group-item-template', 'intersection-item-template'];
                let loadedCount = 0;
                
                const loadPromises = templateIds.map(async (templateId) => {
                    try {
                        const url = `templates/${templateId.replace('-template', '')}.ejs`;
                        
                        const response = await fetch(url);
                        
                        if (response.ok) {
                            const templateText = await response.text();
                            this.templateCache[templateId] = templateText;
                            loadedCount++;
                        }
                    } catch (error) {
                    }
                });
                
                await Promise.allSettled(loadPromises);
                
                this.templatesLoaded = true;
                resolve();
                
            } catch (error) {
                this.templatesLoaded = true;
                resolve();
            }
        });
        
        return this.templatesLoadPromise;
    }
    
    createEmergencyFallbackTemplates() {
        this.templateCache['date-item-template'] = `
<div class="list-item list-item--date" style="background:#ffe6e6;border:2px solid red;">
    <div class="list-item__content">
        <div style="color:red;padding:10px;">
            ❌ ОШИБКА: Шаблон не загружен!<br>
            Проверьте файл templates/date-item.ejs
        </div>
    </div>
</div>`;
        
        this.templateCache['wave-item-template'] = `
<div class="list-item list-item--wave" style="background:#ffe6e6;border:2px solid red;">
    <div class="list-item__content">
        <div style="color:red;padding:10px;">
            ❌ ОШИБКА: Шаблон не загружен!<br>
            Проверьте файл templates/wave-item.ejs
        </div>
    </div>
</div>`;
        
        this.templateCache['group-item-template'] = `
<div class="list-item list-item--group" style="background:#ffe6e6;border:2px solid red;">
    <div class="list-item__content">
        <div style="color:red;padding:10px;">
            ❌ ОШИБКА: Шаблон не загружен!<br>
            Проверьте файл templates/group-item.ejs
        </div>
    </div>
</div>`;
        
        this.templateCache['intersection-item-template'] = `
<div class="intersection-item" style="background:#ffe6e6;border:2px solid red;">
    <div style="color:red;padding:10px;">
        ❌ ОШИБКА: Шаблон пересечений не загружен!
    </div>
</div>`;
    }
    
    async renderListWithWait(containerId, items, itemType) {
        if (!this.templatesLoaded) {
            try {
                await this.initTemplates();
            } catch (error) {
            }
        }
        
        return this.renderList(containerId, items, itemType);
    }
    
    getTemplate(templateId) {
        if (this.templateCache[templateId]) {
            return this.templateCache[templateId];
        }
        
        return '<div class="list-item">Элемент списка</div>';
    }
    
    log(...args) {
        if (this.debug) {
            console.log('[UnifiedListManager]', ...args);
        }
    }
    
    prepareDateData(dateObj, index) {
        const dateObjDate = new Date(dateObj.date);
        
        const currentTimestamp = window.appState.currentDate instanceof Date ? 
            window.appState.currentDate.getTime() : 
            window.appState.currentDate;
        
        const yearsFromCurrent = window.dom.getYearsBetweenDates(dateObj.date, currentTimestamp);
        const activeDateIdStr = window.appState.activeDateId ? String(window.appState.activeDateId) : null;
        const editingDateIdStr = window.appState.editingDateId ? String(window.appState.editingDateId) : null;
        const dateObjIdStr = String(dateObj.id);
        
        return {
            id: dateObj.id,
            name: dateObj.name,
            type: 'date',
            formattedDate: window.dom.formatDate(dateObj.date),
            dateForInput: window.dom.formatDateForInput(dateObj.date),
            yearsFromCurrent: yearsFromCurrent,
            active: activeDateIdStr === dateObjIdStr,
            editing: editingDateIdStr === dateObjIdStr,
            index: index
        };
    }
    
	// В unifiedListManager.js - в методе prepareGroupData ДОБАВИТЬ
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
			originalGroup.waves.forEach((waveId, waveIndex) => {
				const waveIdStr = String(waveId);
				const wave = window.appState.data.waves.find(w => {
					const wIdStr = String(w.id);
					return wIdStr === waveIdStr;
				});
				
				if (wave) {
					existingWaves.push(wave);
					const waveIdStrForCheck = String(wave.id);
					if (window.appState.waveVisibility[waveIdStrForCheck] !== false) {
						enabledCount++;
					}
				}
			});
		}
		
		const waveCount = existingWaves.length;
		const childrenData = existingWaves.map((wave, waveIndex) => {
			// ДОБАВЛЕНО: передаем parentGroupId в данные волны
			const waveData = this.prepareWaveData(wave, waveIndex);
			waveData.parentGroupId = originalGroup.id; // Ключевое добавление
			return waveData;
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

	// В методе prepareWaveData - ДОБАВИТЬ в возвращаемый объект
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
			cornerColor: window.appState.waveCornerColor[waveIdStr] || false,
			editing: editingWaveIdStr === waveIdStr,
			index: index,
			// parentGroupId будет добавлен в prepareGroupData
		};
	}
    
    prepareIntersectionData(intersectionData, index) {
        return {
            ...intersectionData,
            type: 'intersection',
            index: index,
            timeStr: intersectionData.timeStr || this.formatIntersectionTime(intersectionData.timestamp),
            wave1Name: intersectionData.wave1?.name || 'Неизвестно',
            wave2Name: intersectionData.wave2?.name || 'Неизвестно',
            wave1Period: intersectionData.wave1?.period || 0,
            wave2Period: intersectionData.wave2?.period || 0,
            wave1Color: intersectionData.wave1?.color || '#666666',
            wave2Color: intersectionData.wave2?.color || '#666666'
        };
    }
    
    formatIntersectionTime(timestamp) {
        if (!timestamp) return '00:00:00';
        try {
            const date = new Date(timestamp);
            const hours = date.getHours().toString().padStart(2, '0');
            const minutes = date.getMinutes().toString().padStart(2, '0');
            const seconds = date.getSeconds().toString().padStart(2, '0');
            return `${hours}:${minutes}:${seconds}`;
        } catch (error) {
            return '00:00:00';
        }
    }
    
    renderList(containerId, items, itemType) {
        const container = document.getElementById(containerId);
        if (!container) {
            return;
        }
        
        if (!this.templatesLoaded) {
            container.innerHTML = '<div class="list-empty">Загрузка шаблонов...</div>';
            
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
            case 'intersection': templateId = 'intersection-item-template'; break;
            default: templateId = 'date-item-template';
        }
        
        const templateText = this.getTemplate(templateId);
        if (!templateText) {
            container.innerHTML = '<div class="list-error">Ошибка: шаблон не загружен</div>';
            return;
        }
        
        if (typeof ejs === 'undefined') {
            container.innerHTML = '<div class="list-error">Ошибка: EJS не загружен</div>';
            return;
        }
        
        if (itemType === 'group') {
            items.forEach((groupData, index) => {
                try {
                    if (groupData.waveCount === undefined) {
                        groupData.waveCount = groupData.waves ? groupData.waves.length : 0;
                    }
                    if (groupData.enabledCount === undefined) {
                        groupData.enabledCount = 0;
                    }
                    
                    const renderedGroup = ejs.render(templateText, { data: groupData });
                    
                    const tempDiv = document.createElement('div');
                    tempDiv.innerHTML = renderedGroup;
                    const groupElement = tempDiv.firstElementChild;
                    
                    const childrenContainer = groupElement.querySelector('.group-children');
                    
                    if (childrenContainer && groupData.children && groupData.children.length > 0) {
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
                        
                        if (groupData.expanded) {
                            childrenContainer.style.display = 'block';
                            groupElement.classList.add('list-item--expanded');
                        } else {
                            childrenContainer.style.display = 'none';
                            groupElement.classList.remove('list-item--expanded');
                        }
                    }
                    
                    container.appendChild(groupElement);
                    
                } catch (error) {
                    const errorDiv = document.createElement('div');
                    errorDiv.className = 'list-error';
                    errorDiv.textContent = `Ошибка рендеринга группы: ${error.message}`;
                    container.appendChild(errorDiv);
                }
            });
        } else if (itemType === 'intersection') {
            const renderedItems = [];
            items.forEach((item, index) => {
                try {
                    const data = this.prepareIntersectionData(item, index);
                    const rendered = ejs.render(templateText, { data });
                    renderedItems.push(rendered);
                } catch (error) {
                    renderedItems.push(`<div class="list-error">Ошибка рендеринга пересечения</div>`);
                }
            });
            
            container.innerHTML = renderedItems.join('');
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
            this.updateWavesList();
        }
    }
    
    handleDeleteClick(id, type, containerId) {
        if (type === 'date') {
            window.dates.deleteDate(String(id));
            this.updateDatesList();
        } else if (type === 'wave') {
            window.waves.deleteWave(String(id));
            this.updateWavesList();
        } else if (type === 'group') {
            window.dates.deleteGroup(id);
            this.updateWavesList();
        }
    }
    
    handleSaveClick(id, type, containerId) {
        if (type === 'date') {
            this.saveDateChanges(id);
        } else if (type === 'wave') {
            this.saveWaveChanges(String(id));
        } else if (type === 'group') {
            this.saveGroupChanges(id);
        }
    }
    
    handleCancelClick(id, type, containerId) {
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
            dateObj.date = newDate.getTime();
            
            window.appState.editingDateId = null;
            
            if (String(window.appState.activeDateId) === String(dateId)) {
                window.appState.baseDate = newDate.getTime();
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
    }
    
    changeWaveColor(wave) {
        const colorInput = document.createElement('input');
        colorInput.type = 'color';
        colorInput.value = wave.color;
        colorInput.addEventListener('change', (e) => {
            wave.color = e.target.value;
            
            if (window.waves.wavePaths && window.waves.wavePaths[wave.id]) {
                window.waves.wavePaths[wave.id].style.stroke = wave.color;
            }
            
            window.waves.updateCornerSquareColors();
            
            window.appState.save();
            
            this.updateWavesList();
        });
        colorInput.click();
    }
    
    updateDatesList() {
        this.renderList('dateListForDates', window.appState.data.dates, 'date');
    }
    
    updateWavesList() {
        const container = document.getElementById('wavesList');
        if (!container) {
            return;
        }
        
        const allGroups = window.appState.data.groups.map((group, index) => {
            const groupData = this.prepareGroupData(group, index);
            return groupData;
        });
        
        this.renderList('wavesList', allGroups, 'group');
    }
    
    updateIntersectionResults(intersections) {
        this.renderList('intersectionResults', intersections, 'intersection');
    }
    
    updateGroupStats(groupId) {
        const group = window.appState.data.groups.find(g => String(g.id) === String(groupId));
        if (!group) {
            return;
        }
        
        const groupElement = document.querySelector(`.list-item--group[data-id="${groupId}"]`);
        if (!groupElement) {
            return;
        }
        
        let enabledCount = 0;
        const waveCount = group.waves ? group.waves.length : 0;
        
        if (group.waves && Array.isArray(group.waves)) {
            group.waves.forEach(waveId => {
                const waveIdStr = String(waveId);
                if (window.appState.waveVisibility[waveIdStr] !== false) {
                    enabledCount++;
                }
            });
        }
        
        const statsElement = groupElement.querySelector('.list-item__value .group-stats');
        if (statsElement) {
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
    
    async reloadTemplates() {
        this.templatesLoaded = false;
        this.templatesLoadPromise = null;
        await this.initTemplates();
    }
}

window.unifiedListManager = new UnifiedListManager();