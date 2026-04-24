// modules/stateIntersectionManager.js - ИСПРАВЛЕННАЯ ВЕРСИЯ С СОРТИРОВКОЙ
// Показывает пересечения ВЫБРАННОГО сигнала со всеми остальными

class StateIntersectionManager {
    constructor() {
        this.elements = {};
        this.cacheElements();
        
        this.selectedWaveId = null;
        this.isUpdating = false;
        this.updateDebounceDelay = 100;
        this.updateTimeout = null;
        this.currentSortMode = 'period-desc'; // 'period-desc' или 'time-asc'
        
        this.init();
    }
    
    cacheElements() {
        const ids = [
            'intersectionPanel',
            'intersectionGroupSelect',
            'intersectionSortSelect',  // ДОБАВЛЕНО
            'intersectionResults',
            'intersectionSelectedInfo',
            'intersectionStats'
        ];
        
        ids.forEach(id => {
            const el = document.getElementById(id);
            if (el) this.elements[id] = el;
        });
    }
    
    init() {
        this.setupEventListeners();
        this.populateGroupSelect();
        this.restoreGroupSelection();
        this.restoreSortSelection();  // ДОБАВЛЕНО
        this.setupWaveSelectionObserver();
        this.setupDateObservers();
        this.updateIntersections();
    }
    
    setupEventListeners() {
        const groupSelect = this.elements.intersectionGroupSelect;
        
        if (groupSelect) {
            groupSelect.addEventListener('change', () => {
                this.saveGroupSelection();
                this.updateIntersections();
            });
        }
        
        // ДОБАВЛЕНО: Обработчик для селекта сортировки
        const sortSelect = this.elements.intersectionSortSelect;
        if (sortSelect) {
            sortSelect.addEventListener('change', (e) => {
                this.currentSortMode = e.target.value;
                this.saveSortSelection();
                this.displayResults(this.lastIntersections, this.lastSelectedWave, this.lastCurrentDate);
            });
        }
        
        const clearBtn = document.getElementById('btnClearWaveSelection');
        if (clearBtn) {
            clearBtn.addEventListener('click', () => {
                this.clearSelection();
            });
        }
    }
    
    setupWaveSelectionObserver() {
        // Наблюдаем за изменениями выбранного сигнала (через "Окрасить края")
        const checkInterval = setInterval(() => {
            const currentSelectedId = this.getSelectedWaveId();
            if (currentSelectedId !== this.selectedWaveId) {
                this.selectedWaveId = currentSelectedId;
                this.updateIntersections();
            }
        }, 500);
        
        window.addEventListener('beforeunload', () => {
            clearInterval(checkInterval);
        });
    }
    
    getSelectedWaveId() {
        if (!window.appState || !window.appState.waveCornerColor) return null;
        
        for (const [waveId, isSelected] of Object.entries(window.appState.waveCornerColor)) {
            if (isSelected) return waveId;
        }
        return null;
    }
    
    setupDateObservers() {
        const originalCurrentDate = window.appState.currentDate;
        Object.defineProperty(window.appState, 'currentDate', {
            get() { return this._currentDate; },
            set(value) {
                this._currentDate = value;
                if (window.stateIntersectionManager && !this.isProgrammaticDateChange) {
                    window.stateIntersectionManager.debouncedUpdate();
                }
            }
        });
        window.appState._currentDate = originalCurrentDate;
        
        const originalCurrentDay = window.appState.currentDay;
        Object.defineProperty(window.appState, 'currentDay', {
            get() { return this._currentDay; },
            set(value) {
                const prev = this._currentDay;
                this._currentDay = value;
                if (Math.abs(value - (prev ?? 0)) > 0.001) {
                    if (window.stateIntersectionManager && !this.isProgrammaticDateChange) {
                        window.stateIntersectionManager.debouncedUpdate();
                    }
                }
            }
        });
        window.appState._currentDay = originalCurrentDay;
    }
    
    debouncedUpdate() {
        if (this.updateTimeout) {
            clearTimeout(this.updateTimeout);
        }
        
        this.updateTimeout = setTimeout(() => {
            this.updateIntersections();
        }, this.updateDebounceDelay);
    }
    
    populateGroupSelect() {
        const select = this.elements.intersectionGroupSelect;
        if (!select || !window.appState || !window.appState.data) return;
        
        select.innerHTML = '<option value="all">Все группы (включая отключенные)</option>';
        
        window.appState.data.groups.forEach(group => {
            if (group.waves && group.waves.length > 0 && !group.hidden) {
                const option = document.createElement('option');
                option.value = group.id;
                option.textContent = `${group.name} ${group.enabled ? '✓' : '(выкл)'}`;
                select.appendChild(option);
            }
        });
    }
    
    restoreGroupSelection() {
        const savedGroup = localStorage.getItem('intersectionSelectedGroup');
        if (savedGroup && this.elements.intersectionGroupSelect) {
            this.elements.intersectionGroupSelect.value = savedGroup;
        }
    }
    
    saveGroupSelection() {
        if (this.elements.intersectionGroupSelect) {
            localStorage.setItem('intersectionSelectedGroup', this.elements.intersectionGroupSelect.value);
        }
    }
    
    // ДОБАВЛЕНО: Сохранение/восстановление выбранной сортировки
    restoreSortSelection() {
        const savedSort = localStorage.getItem('intersectionSelectedSort');
        if (savedSort && this.elements.intersectionSortSelect) {
            this.currentSortMode = savedSort;
            this.elements.intersectionSortSelect.value = savedSort;
        }
    }
    
    saveSortSelection() {
        if (this.elements.intersectionSortSelect) {
            localStorage.setItem('intersectionSelectedSort', this.currentSortMode);
        }
    }
    
    getAllWavesFromSelectedGroup() {
        if (!window.appState || !window.appState.data) return [];
        
        const groupId = this.elements.intersectionGroupSelect?.value;
        
        if (!groupId || groupId === 'all') {
            return window.appState.data.waves;
        }
        
        const group = window.appState.data.groups.find(g => g.id === groupId);
        if (!group || !group.waves) return [];
        
        const waves = [];
        group.waves.forEach(waveId => {
            const wave = window.appState.data.waves.find(w => String(w.id) === String(waveId));
            if (wave) waves.push(wave);
        });
        
        return waves;
    }
    
    findIntersectionsWithSelectedWave(selectedWave, otherWaves, date) {
        const allIntersections = [];
        
        const dayStart = new Date(date);
        dayStart.setHours(0, 0, 0, 0);
        const dayEnd = new Date(dayStart);
        dayEnd.setHours(23, 59, 59, 999);
        
        const baseDate = window.appState.baseDate instanceof Date ? 
            window.appState.baseDate : 
            new Date(window.appState.baseDate);
        
        const getWaveValue = (wave, timeMs) => {
            const daysFromBase = (timeMs - baseDate.getTime()) / (1000 * 60 * 60 * 24);
            const phase = (daysFromBase % wave.period) / wave.period;
            const angle = phase * 2 * Math.PI;
            return Math.sin(angle);
        };
        
        for (const otherWave of otherWaves) {
            if (String(otherWave.id) === String(selectedWave.id)) continue;
            
            const T1 = selectedWave.period;
            const T2 = otherWave.period;
            
            const daysToStart = (dayStart.getTime() - baseDate.getTime()) / (1000 * 60 * 60 * 24);
            const phase1 = (daysToStart % T1) / T1;
            const phase2 = (daysToStart % T2) / T2;
            
            const phi1 = phase1 * 2 * Math.PI;
            const phi2 = phase2 * 2 * Math.PI;
            
            const omega1 = 2 * Math.PI / T1;
            const omega2 = 2 * Math.PI / T2;
            
            // Первое семейство решений
            if (Math.abs(omega1 - omega2) > 1e-10) {
                for (let k = -10; k <= 10; k++) {
                    const t = (phi2 - phi1 + 2 * Math.PI * k) / (omega1 - omega2);
                    const timeMs = dayStart.getTime() + t * 24 * 60 * 60 * 1000;
                    
                    if (timeMs >= dayStart.getTime() && timeMs <= dayEnd.getTime()) {
                        const y1 = getWaveValue(selectedWave, timeMs);
                        const y2 = getWaveValue(otherWave, timeMs);
                        
                        if (Math.abs(y1 - y2) < 1e-8) {
                            allIntersections.push({
                                time: new Date(timeMs),
                                wave1: selectedWave,
                                wave2: otherWave,
                                value: y1
                            });
                        }
                    }
                }
            }
            
            // Второе семейство решений
            for (let k = -10; k <= 10; k++) {
                const t = (Math.PI - phi1 - phi2 + 2 * Math.PI * k) / (omega1 + omega2);
                const timeMs = dayStart.getTime() + t * 24 * 60 * 60 * 1000;
                
                if (timeMs >= dayStart.getTime() && timeMs <= dayEnd.getTime()) {
                    const y1 = getWaveValue(selectedWave, timeMs);
                    const y2 = getWaveValue(otherWave, timeMs);
                    
                    if (Math.abs(y1 - y2) < 1e-8) {
                        allIntersections.push({
                            time: new Date(timeMs),
                            wave1: selectedWave,
                            wave2: otherWave,
                            value: y1
                        });
                    }
                }
            }
        }
        
        // Убираем дубликаты
        const uniqueIntersections = [];
        for (const inter of allIntersections) {
            let isDuplicate = false;
            for (const existing of uniqueIntersections) {
                if (Math.abs(existing.time.getTime() - inter.time.getTime()) < 1000 &&
                    String(existing.wave1.id) === String(inter.wave1.id) &&
                    String(existing.wave2.id) === String(inter.wave2.id)) {
                    isDuplicate = true;
                    break;
                }
            }
            if (!isDuplicate) {
                uniqueIntersections.push(inter);
            }
        }
        
        return uniqueIntersections.sort((a, b) => a.time - b.time);
    }
    
    updateIntersections() {
        if (this.isUpdating) return;
        
        try {
            this.isUpdating = true;
            
            if (!this.selectedWaveId) {
                this.showNoWaveSelectedMessage();
                return;
            }
            
            const selectedWave = this.findWaveById(this.selectedWaveId);
            if (!selectedWave) {
                this.showNoWaveSelectedMessage();
                return;
            }
            
            const allWaves = this.getAllWavesFromSelectedGroup();
            
            if (allWaves.length < 2) {
                this.showNoIntersectionsMessage('Недостаточно сигналов для поиска пересечений');
                return;
            }
            
            const currentDate = window.appState.currentDate || new Date();
            
            const intersections = this.findIntersectionsWithSelectedWave(
                selectedWave, 
                allWaves, 
                currentDate
            );
            
            // Сохраняем для использования при смене сортировки
            this.lastIntersections = intersections;
            this.lastSelectedWave = selectedWave;
            this.lastCurrentDate = currentDate;
            
            this.displayResults(intersections, selectedWave, currentDate);
            
        } catch (error) {
            console.error('Error updating intersections:', error);
            this.showNoIntersectionsMessage('Ошибка при расчете пересечений');
        } finally {
            this.isUpdating = false;
        }
    }
    
    findWaveById(waveId) {
        if (!window.appState || !window.appState.data) return null;
        return window.appState.data.waves.find(w => String(w.id) === String(waveId));
    }
    
    // ОБНОВЛЕНО: Сортировка результатов по выбранному режиму
    sortIntersections(intersections) {
        if (this.currentSortMode === 'time-asc') {
            // Сортировка по времени от наименьшего к наибольшему
            return [...intersections].sort((a, b) => a.time.getTime() - b.time.getTime());
        } else {
            // Сортировка по периоду от большего к меньшему (по умолчанию)
            return [...intersections].sort((a, b) => {
                const periodA = a.wave2.period;
                const periodB = b.wave2.period;
                return periodB - periodA;
            });
        }
    }
    
    displayResults(intersections, selectedWave, currentDate) {
        const container = this.elements.intersectionResults;
        const stats = this.elements.intersectionStats;
        const selectedInfo = this.elements.intersectionSelectedInfo;
        
        if (!container) return;
        
        // Обновляем информацию о выбранном сигнале
        if (selectedInfo) {
            const dateStr = currentDate.toLocaleDateString('ru-RU');
            selectedInfo.innerHTML = `
                <div class="selected-wave-info">
                    <div class="selected-wave-header">
                        <span class="selected-wave-icon">🎯</span>
                        <span class="selected-wave-name" style="color: ${selectedWave.color || '#666'}">
                            ${this.escapeHtml(selectedWave.name)}
                        </span>
                        <span class="wave-period-badge">${selectedWave.period} дней</span>
                    </div>
                    <div class="selected-wave-details">
                        <div class="selected-wave-detail">
                            <span class="detail-label">Дата анализа:</span>
                            <span class="detail-value">${dateStr}</span>
                        </div>
                        <div class="selected-wave-detail">
                            <span class="detail-label">Найдено пересечений:</span>
                            <span class="detail-value">${intersections.length}</span>
                        </div>
                        <div class="selected-wave-detail">
                            <span class="detail-label">Сортировка:</span>
                            <span class="detail-value">${this.currentSortMode === 'time-asc' ? 'по времени ↑' : 'по периоду ↓'}</span>
                        </div>
                    </div>
                </div>
            `;
        }
        
        if (intersections.length === 0) {
            container.innerHTML = `
                <div class="list-empty">
                    <div style="text-align: center; padding: 20px;">
                        <div style="font-size: 32px; margin-bottom: 10px;">📊</div>
                        <div>Нет пересечений сигнала <strong>${this.escapeHtml(selectedWave.name)}</strong> в выбранный день</div>
                    </div>
                </div>
            `;
            if (stats) stats.style.display = 'none';
            return;
        }
        
        if (stats) {
            stats.style.display = 'none';
        }
        
        // ПРИМЕНЯЕМ СОРТИРОВКУ
        const sortedIntersections = this.sortIntersections(intersections);
        
        const resultsHTML = sortedIntersections.map((inter, index) => {
            const wave = inter.wave2;
            const timeStr = this.formatTime(inter.time);
            
            return `
                <div class="summary-item">
                    <div class="summary-item-info">
                        <div class="summary-item-name">
                            <span class="summary-item-index">${index + 1}.</span>
                            <span style="color: ${wave.color || '#666'}">
                                ${this.escapeHtml(wave.name)}
                            </span>
                            <span class="wave-period-badge">${wave.period} дней</span>
                        </div>
                        <div class="summary-item-details">
                            <span class="summary-item-state">🕐 ${timeStr}</span>
                            <span class="summary-item-difference">Значение: ${inter.value.toFixed(3)}</span>
                        </div>
                    </div>
                    <div class="summary-item-color" style="background-color: ${wave.color || '#666'}"></div>
                    <div class="summary-item-actions">
                        <button class="ui-btn show-on-vizor-btn" data-wave-id="${wave.id}">
                            Показать на визоре
                        </button>
                    </div>
                </div>
            `;
        }).join('');
        
        container.innerHTML = resultsHTML;
        
        // Добавляем обработчики для кнопок
        setTimeout(() => {
            container.querySelectorAll('.show-on-vizor-btn').forEach(btn => {
                btn.replaceWith(btn.cloneNode(true));
            });
            
            document.querySelectorAll('.show-on-vizor-btn').forEach(btn => {
                btn.addEventListener('click', (e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    
                    const waveId = btn.dataset.waveId;
                    if (!waveId) return;
                    
                    let checkbox = null;
                    checkbox = document.querySelector(`.wave-visibility-check[data-id="${waveId}"]`);
                    
                    if (!checkbox) {
                        checkbox = document.querySelector(`.group-children .wave-visibility-check[data-id="${waveId}"]`);
                    }
                    
                    if (checkbox) {
                        const isChecked = checkbox.checked;
                        checkbox.checked = !isChecked;
                        
                        const changeEvent = new Event('change', {
                            bubbles: true,
                            cancelable: true
                        });
                        checkbox.dispatchEvent(changeEvent);
                        
                        if (window.eventManager && window.eventManager.handleWaveVisibilityChange) {
                            const $checkbox = $(checkbox);
                            window.eventManager.handleWaveVisibilityChange(waveId, !isChecked, $checkbox);
                        }
                    } else {
                        if (window.appState && window.appState.waveVisibility) {
                            const waveIdStr = String(waveId);
                            const currentState = window.appState.waveVisibility[waveIdStr];
                            window.appState.waveVisibility[waveIdStr] = currentState === false;
                            window.appState.save();
                            
                            if (window.waves && window.waves.updatePosition) {
                                setTimeout(() => {
                                    window.waves.updatePosition();
                                }, 100);
                            }
                            
                            if (window.unifiedListManager && window.unifiedListManager.updateWavesList) {
                                setTimeout(() => {
                                    window.unifiedListManager.updateWavesList();
                                }, 100);
                            }
                        }
                    }
                });
            });
        }, 100);
    }
    
    showNoWaveSelectedMessage() {
        const container = this.elements.intersectionResults;
        const stats = this.elements.intersectionStats;
        const selectedInfo = this.elements.intersectionSelectedInfo;
        
        if (selectedInfo) {
            selectedInfo.innerHTML = `
                <div class="selected-wave-info no-selection">
                    <div class="selected-wave-header">
                        <span class="selected-wave-icon">⚠️</span>
                        <span class="selected-wave-name">Сигнал не выбран</span>
                    </div>
                    <div class="selected-wave-details">
                        <div class="selected-wave-detail">
                            Отметьте чекбокс <strong>"Окрасить края"</strong> у любого сигнала в списке волн
                        </div>
                    </div>
                </div>
            `;
        }
        
        if (container) {
            container.innerHTML = `
                <div class="list-empty">
                    <div style="text-align: center; padding: 20px;">
                        <div style="font-size: 32px; margin-bottom: 10px;">🎯</div>
                        <div>Выберите сигнал для анализа пересечений</div>
                        <div style="font-size: 11px; color: #666; margin-top: 8px;">
                            Отметьте чекбокс <strong>"Окрасить края"</strong> у любого сигнала в списке волн
                        </div>
                    </div>
                </div>
            `;
        }
        
        if (stats) stats.style.display = 'none';
    }
    
    showNoIntersectionsMessage(message) {
        const container = this.elements.intersectionResults;
        
        if (container) {
            container.innerHTML = `
                <div class="list-empty">
                    <div style="text-align: center; padding: 20px;">
                        <div style="font-size: 32px; margin-bottom: 10px;">📊</div>
                        <div>${message || 'Нет пересечений'}</div>
                    </div>
                </div>
            `;
        }
    }
    
    clearSelection() {
        if (!window.appState) return;
        
        let hasSelection = false;
        Object.keys(window.appState.waveCornerColor).forEach(waveId => {
            if (window.appState.waveCornerColor[waveId]) {
                hasSelection = true;
            }
            window.appState.waveCornerColor[waveId] = false;
        });
        
        if (hasSelection) {
            window.appState.save();
            
            if (window.unifiedListManager) {
                window.unifiedListManager.updateWavesList();
            }
            
            if (window.waves) {
                window.waves.updateCornerSquareColors();
            }
        }
        
        this.selectedWaveId = null;
        this.showNoWaveSelectedMessage();
    }
    
    formatTime(date) {
        const hours = date.getHours().toString().padStart(2, '0');
        const minutes = date.getMinutes().toString().padStart(2, '0');
        const seconds = date.getSeconds().toString().padStart(2, '0');
        return `${hours}:${minutes}:${seconds}`;
    }
    
    escapeHtml(text) {
        if (!text) return '';
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
    
    refresh() {
        this.populateGroupSelect();
        this.updateIntersections();
    }
}

window.stateIntersectionManager = new StateIntersectionManager();