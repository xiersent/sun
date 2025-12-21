const templates = {
    dateItem: (date) => {
        const template = date.editing ? 
            templates.dateEditForm(date) : 
            templates.dateView(date);
        
        return `
        <div class="date-item ${date.active ? 'active' : ''} ${date.editing ? 'editing' : ''}" 
             data-id="${date.id}" draggable="${!date.editing}">
            ${template}
        </div>`;
    },
    
    dateView: (date) => `
        <div class="date-normal-view flex items-center justify-between">
            <div class="date-header flex items-center gap-sm">
                <div class="drag-handle">⋮⋮</div>
                <div class="date-name-container flex items-center gap-xs">
                    <div class="date-name">${date.name}</div>
                    <span class="date-star">★</span>
                </div>
            </div>
            <div class="date-info-actions flex items-center gap-sm">
                <div class="date-value">
                    ${date.formattedDate}
                    ${date.yearsFromCurrent > 0 ? `[${date.yearsFromCurrent}]` : ''}
                </div>
                <div class="date-actions flex gap-xs">
                    <button class="btn edit-btn" data-id="${date.id}">Изменить</button>
                    <button class="btn delete-date-btn" data-id="${date.id}">Удалить</button>
                </div>
            </div>
        </div>
    `,
    
    dateEditForm: (date) => `
        <div class="edit-date-form flex items-center justify-between gap-sm">
            <input type="text" class="form-input date-name-edit" value="${date.name}" placeholder="Название">
            <div class="date-info-actions flex items-center gap-xs">
                <input type="date" class="form-input" value="${date.dateForInput}">
                <div class="date-actions flex gap-xs">
                    <button class="btn save-btn" data-id="${date.id}">Сохранить</button>
                    <button class="btn cancel-btn" data-id="${date.id}">Отмена</button>
                </div>
            </div>
        </div>
    `,
    
    waveGroup: (group, waves, editingWaveId) => {
        const waveItems = waves.map(wave => 
            templates.waveItem(wave, editingWaveId)
        ).join('');
        
        return `
        <div class="wave-group ${group.expanded ? '' : 'collapsed'}" data-group-id="${group.id}">
            <div class="wave-group-header flex items-center justify-between">
                <div class="wave-group-left flex items-center gap-sm">
                    <div class="drag-handle">⋮⋮</div>
                    <label class="flex items-center gap-xs">
                        <input type="checkbox" class="wave-group-toggle" ${group.enabled ? 'checked' : ''} 
                               data-group-id="${group.id}"> Вкл
                    </label>
                    <div class="wave-group-title">${group.name}</div>
                </div>
                <div class="wave-group-right">
                    <button class="btn delete-group-btn" data-group-id="${group.id}">Удалить</button>
                </div>
            </div>
            <div class="wave-group-waves" style="display: ${group.expanded ? 'block' : 'none'}">
                ${waveItems}
            </div>
        </div>`;
    },
    
    waveItem: (wave, editingWaveId) => {
        const template = editingWaveId === wave.id ? 
            templates.waveEditForm(wave) : 
            templates.waveView(wave);
        
        return `
        <div class="date-item wave-item" data-wave-id="${wave.id}">
            ${template}
        </div>`;
    },
    
    waveView: (wave) => `
        <div class="flex items-center justify-between gap-sm w-full">
            <div class="flex items-center gap-sm">
                <input type="checkbox" class="wave-visibility" ${wave.visible ? 'checked' : ''} 
                       data-wave-id="${wave.id}" title="Видимость">
                <div class="wave-color-preview" style="background: ${wave.color}" 
                     data-wave-id="${wave.id}"></div>
                <div class="wave-info">
                    <div class="wave-name">${wave.name}</div>
                    <div class="wave-description">${wave.period} дней</div>
                </div>
            </div>
            <div class="wave-actions flex gap-xs">
                <button class="btn edit-wave-btn" data-wave-id="${wave.id}">Изменить</button>
                <button class="btn delete-wave-btn" data-wave-id="${wave.id}">Удалить</button>
            </div>
        </div>
    `,
    
    waveEditForm: (wave) => `
        <div class="edit-wave-form">
            <div class="form-row">
                <label>Название:</label>
                <input type="text" class="form-input" value="${wave.name}" data-field="name">
            </div>
            <div class="form-row">
                <label>Период:</label>
                <input type="number" class="form-input" value="${wave.period}" data-field="period" step="0.1" min="0.1">
            </div>
            <div class="form-row">
                <label>Цвет:</label>
                <input type="color" class="color-input" value="${wave.color}" data-field="color">
            </div>
            <div class="form-actions flex gap-sm">
                <button class="btn save-wave-btn" data-wave-id="${wave.id}">Сохранить</button>
                <button class="btn cancel-edit-btn" data-wave-id="${wave.id}">Отмена</button>
            </div>
        </div>
    `,
    
    dateList: (dates) => dates.map(date => templates.dateItem(date)).join(''),
    
    intersectionResult: (result) => `
        <div class="intersection-item ${result.isExact ? 'exact-match' : 'close-match'}">
            <div class="intersection-info">
                <div class="intersection-period">
                    Период: ${result.period.toFixed(2)} дней | Амплитуда: ${result.amplitude.toFixed(2)}
                </div>
                <div class="intersection-match-type">
                    Качество: ${(result.matchQuality * 100).toFixed(1)}% | Значение: ${result.value.toFixed(3)}
                </div>
            </div>
            <button class="btn add-intersection-btn" 
                    data-period="${result.period}" 
                    data-amplitude="${result.amplitude}">
                Добавить
            </button>
        </div>
    `
};

window.templates = templates;