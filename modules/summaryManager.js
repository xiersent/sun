// modules/summaryManager.js
class SummaryManager {
    constructor() {
        this.elements = {};
        this.cacheElements();
        this.currentGroup = 'all';
        this.currentState = -5;
        this.tolerance = 0.5; // Допустимая погрешность для "близкого" состояния
        
        // Устанавливаем флаг для отслеживания изменений
        this.isUpdating = false;
        this.lastUpdateTime = 0;
        this.updateDebounceDelay = 100; // Задержка для дебаунса
        this.updateTimeout = null;
        
        this.init();
    }
    
    cacheElements() {
        const ids = [
            'summaryPanel',
            'summaryGroupSelect',
            'summaryStateSelect',
            'summaryStats',
            'summaryResults'
        ];
        
        ids.forEach(id => {
            const el = document.getElementById(id);
            if (el) this.elements[id] = el;
        });
    }
    
    init() {
        this.setupEventListeners();
        this.populateGroupSelect();
        this.updateSummary();
        this.setupStateObservers();
    }
    
    setupEventListeners() {
        const groupSelect = this.elements.summaryGroupSelect;
        const stateSelect = this.elements.summaryStateSelect;
        
        if (groupSelect) {
            groupSelect.addEventListener('change', (e) => {
                this.currentGroup = e.target.value;
                this.updateSummary();
            });
        }
        
        if (stateSelect) {
            stateSelect.addEventListener('change', (e) => {
                this.currentState = parseFloat(e.target.value);
                this.updateSummary();
            });
        }
    }
    
    setupStateObservers() {
        // Наблюдаем за изменениями currentDate в appState
        const originalCurrentDate = window.appState.currentDate;
        Object.defineProperty(window.appState, 'currentDate', {
            get() {
                return this._currentDate;
            },
            set(value) {
                const oldValue = this._currentDate;
                this._currentDate = value;
                
                // Если сводная информация инициализирована, обновляем ее
                if (window.summaryManager && !this.isProgrammaticDateChange) {
                    window.summaryManager.debouncedUpdate();
                }
            }
        });
        
        // Инициализируем значение
        window.appState._currentDate = originalCurrentDate;
        
        // Также наблюдаем за currentDay
        this.setupGlobalDateObserver();
    }
    
    setupGlobalDateObserver() {
        // Перехватываем все изменения currentDay
        const originalCurrentDay = window.appState.currentDay;
        Object.defineProperty(window.appState, 'currentDay', {
            get() {
                return this._currentDay;
            },
            set(value) {
                const oldValue = this._currentDay;
                this._currentDay = value;
                
                // Если значение изменилось значительно (более 0.001 дня ≈ 1.4 минуты)
                if (Math.abs(value - oldValue) > 0.001) {
                    // Запускаем обновление сводки с задержкой
                    if (window.summaryManager && !this.isProgrammaticDateChange) {
                        window.summaryManager.debouncedUpdate();
                    }
                }
            }
        });
        
        // Инициализируем значение
        window.appState._currentDay = originalCurrentDay;
    }
    
    debouncedUpdate() {
        const now = Date.now();
        
        // Сбрасываем предыдущий таймер
        if (this.updateTimeout) {
            clearTimeout(this.updateTimeout);
        }
        
        // Если с последнего обновления прошло меньше задержки, ждем
        if (now - this.lastUpdateTime < this.updateDebounceDelay) {
            this.updateTimeout = setTimeout(() => {
                this.updateSummary();
                this.lastUpdateTime = Date.now();
            }, this.updateDebounceDelay);
        } else {
            // Обновляем сразу
            this.updateSummary();
            this.lastUpdateTime = now;
        }
    }
    
    populateGroupSelect() {
        const select = this.elements.summaryGroupSelect;
        if (!select || !window.appState || !window.appState.data) return;
        
        // Очищаем все опции кроме первой
        while (select.options.length > 1) {
            select.remove(1);
        }
        
        // Добавляем группы, которые содержат колоски
        window.appState.data.groups.forEach(group => {
            if (group.waves && group.waves.length > 0) {
                const option = document.createElement('option');
                option.value = group.id;
                option.textContent = group.name;
                select.appendChild(option);
            }
        });
    }
    
    updateSummary() {
        // Защита от рекурсивных вызовов
        if (this.isUpdating) return;
        
        try {
            this.isUpdating = true;
            
            const waves = this.getWavesForSelectedGroup();
            const stateWaves = this.filterWavesByState(waves);
            
            this.updateStats(stateWaves, waves.length);
            this.updateResults(stateWaves);
            
        } catch (error) {
            console.error('Ошибка при обновлении сводной информации:', error);
        } finally {
            this.isUpdating = false;
        }
    }
    
    getWavesForSelectedGroup() {
        if (!window.appState || !window.appState.data) return [];
        
        if (this.currentGroup === 'all') {
            // Все колоски из всех групп
            return window.appState.data.waves;
        }
        
        // Колоски из выбранной группы
        const group = window.appState.data.groups.find(g => g.id === this.currentGroup);
        if (!group || !group.waves) return [];
        
        const waves = [];
        group.waves.forEach(waveId => {
            const wave = window.appState.data.waves.find(w => {
                const waveIdStr = String(w.id);
                const targetIdStr = String(waveId);
                return waveIdStr === targetIdStr;
            });
            if (wave) {
                waves.push(wave);
            }
        });
        
        return waves;
    }
    
    filterWavesByState(waves) {
        if (!waves.length) return [];
        
        const results = [];
        const currentDay = window.appState.currentDay || 0;
        
        waves.forEach(wave => {
            if (!wave.period || wave.period <= 0) return;
            
            // Рассчитываем текущую фазу волны (в днях от начала периода)
            const phase = (currentDay % wave.period);
            
            // Нормализуем фазу к диапазону [-П, П] или другому удобному
            // Для синусоиды состояние = sin(2π * фаза/период)
            const normalizedPhase = ((phase / wave.period) * 2 * Math.PI);
            
            // Переводим в состояние от -5 до 5
            const waveState = (Math.sin(normalizedPhase) * 5);
            
            // Разница с целевым состоянием
            const difference = Math.abs(waveState - this.currentState);
            
            if (difference <= this.tolerance) {
                results.push({
                    wave: wave,
                    phase: phase,
                    state: waveState,
                    difference: difference,
                    closeness: this.getClosenessLevel(difference)
                });
            }
        });
        
        // Сортируем по близости к целевому состоянию
        results.sort((a, b) => a.difference - b.difference);
        
        return results;
    }
    
    getClosenessLevel(difference) {
        if (difference < 0.1) return 'очень близко';
        if (difference < 0.3) return 'близко';
        if (difference < 0.5) return 'довольно близко';
        return 'рядом';
    }
    
    updateStats(stateWaves, totalWaves) {
        const statsElement = this.elements.summaryStats;
        if (!statsElement) return;
        
        statsElement.innerHTML = `
            <strong>Статистика:</strong><br>
            Всего колосков в группе: ${totalWaves}<br>
            Найдено в состоянии ${this.currentState} (±${this.tolerance}): ${stateWaves.length}<br>
            Процент соответствия: ${totalWaves > 0 ? ((stateWaves.length / totalWaves) * 100).toFixed(1) : 0}%
        `;
    }
    
    updateResults(stateWaves) {
        const resultsElement = this.elements.summaryResults;
        if (!resultsElement) return;
        
        if (stateWaves.length === 0) {
            resultsElement.innerHTML = '<div class="summary-empty">Нет колосков в выбранном состоянии</div>';
            return;
        }
        
        const resultsHTML = stateWaves.map((item, index) => {
            const closenessClass = this.getClosenessClass(item.difference);
            const stateValue = item.state.toFixed(2);
            
            return `
                <div class="summary-item ${closenessClass}">
                    <div class="summary-item-info">
                        <div class="summary-item-name">
                            <span class="summary-item-index">${index + 1}.</span>
                            ${item.wave.name} (${item.wave.period} дней)
                        </div>
                        <div class="summary-item-details">
                            <span class="summary-item-state">Состояние: ${stateValue}</span>
                            <span class="summary-item-difference">Разница: ${item.difference.toFixed(2)}</span>
                            <span class="summary-item-closeness">${item.closeness}</span>
                        </div>
                    </div>
                    <div class="summary-item-color" style="background-color: ${item.wave.color || '#666666'}"></div>
                </div>
            `;
        }).join('');
        
        resultsElement.innerHTML = resultsHTML;
    }
    
    getClosenessClass(difference) {
        if (difference < 0.1) return 'summary-item-very-close';
        if (difference < 0.3) return 'summary-item-close';
        if (difference < 0.5) return 'summary-item-fairly-close';
        return 'summary-item-nearby';
    }
    
    // Метод для обновления при изменении данных
    refresh() {
        this.populateGroupSelect();
        this.updateSummary();
    }
}

window.summaryManager = new SummaryManager();