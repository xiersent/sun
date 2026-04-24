// modules/summaryManager.js - ОБНОВЛЕННЫЙ ВЕРСИЯ
class SummaryManager {
    constructor() {
        this.elements = {};
        this.cacheElements();
        this.currentGroup = 'all';
        this.currentState = -5;
        this.tolerance = 0.5;
        this.includePastWaves = false;
        
        this.isUpdating = false;
        this._summaryUpdateRaf = null;
        
        this.init();
    }
    
    cacheElements() {
        const ids = [
            'summaryPanel',
            'summaryGroupSelect',
            'summaryStateSelect',
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
        this.setupStateSelect();
        this.restoreSelections();
        this.updateSummary(); // ВЫЗЫВАЕМ ОБНОВЛЕНИЕ ПРИ ИНИЦИАЛИЗАЦИИ
        this.setupStateObservers();
    }
    
    setupEventListeners() {
        const groupSelect = this.elements.summaryGroupSelect;
        const stateSelect = this.elements.summaryStateSelect;
        
        if (groupSelect) {
            groupSelect.addEventListener('change', (e) => {
                this.currentGroup = e.target.value;
                this.saveSelections();
                this.updateSummary();
            });
        }
        
        if (stateSelect) {
            stateSelect.addEventListener('change', (e) => {
                this.currentState = parseFloat(e.target.value);
                this.saveSelections();
                this.updateSummary();
            });
        }
        
        const includePastCheckbox = document.getElementById('includePastWaves');
        if (includePastCheckbox) {
            // УСТАНАВЛИВАЕМ ОБРАБОТЧИК СОБЫТИЯ
            includePastCheckbox.addEventListener('change', (e) => {
                this.includePastWaves = e.target.checked;
                this.saveSelections(); // СОХРАНЯЕМ СОСТОЯНИЕ
                this.updateSummary(); // НЕМЕДЛЕННО ОБНОВЛЯЕМ
            });
        }
    }
    
    setupStateSelect() {
        const stateSelect = this.elements.summaryStateSelect;
        if (!stateSelect) return;
        
        stateSelect.innerHTML = '';
        
        for (let i = 5; i >= -5; i--) {
            const option = document.createElement('option');
            option.value = i;
            
            option.textContent = i.toString();
            
            if (i === -5) {
                option.selected = true;
            }
            stateSelect.appendChild(option);
        }
    }
    
    restoreSelections() {
        const savedGroup = localStorage.getItem('summarySelectedGroup');
        const savedState = localStorage.getItem('summarySelectedState');
        const savedIncludePast = localStorage.getItem('summaryIncludePastWaves');
        
        if (savedGroup) {
            this.currentGroup = savedGroup;
            const groupSelect = this.elements.summaryGroupSelect;
            if (groupSelect) {
                groupSelect.value = savedGroup;
            }
        }
        
        if (savedState) {
            this.currentState = parseFloat(savedState);
            const stateSelect = this.elements.summaryStateSelect;
            if (stateSelect) {
                stateSelect.value = savedState;
            }
        }
        
        // ВОССТАНАВЛИВАЕМ СОСТОЯНИЕ ЧЕКБОКСА
        if (savedIncludePast !== null) {
            this.includePastWaves = savedIncludePast === 'true';
            const includePastCheckbox = document.getElementById('includePastWaves');
            if (includePastCheckbox) {
                includePastCheckbox.checked = this.includePastWaves;
            }
        }
    }
    
    saveSelections() {
        localStorage.setItem('summarySelectedGroup', this.currentGroup);
        localStorage.setItem('summarySelectedState', this.currentState.toString());
        localStorage.setItem('summaryIncludePastWaves', this.includePastWaves.toString());
    }
    
    setupStateObservers() {
        const originalCurrentDate = window.appState.currentDate;
        Object.defineProperty(window.appState, 'currentDate', {
            get() {
                return this._currentDate;
            },
            set(value) {
                const oldValue = this._currentDate;
                this._currentDate = value;
                
                if (window.summaryManager && !this.isProgrammaticDateChange) {
                    window.summaryManager.debouncedUpdate();
                }
            }
        });
        
        window.appState._currentDate = originalCurrentDate;
        
        this.setupGlobalDateObserver();
    }
    
    setupGlobalDateObserver() {
        const originalCurrentDay = window.appState.currentDay;
        Object.defineProperty(window.appState, 'currentDay', {
            get() {
                return this._currentDay;
            },
            set(value) {
                const oldValue = this._currentDay;
                this._currentDay = value;
                
                if (Math.abs(value - oldValue) > 0.001) {
                    if (window.summaryManager && !this.isProgrammaticDateChange) {
                        window.summaryManager.debouncedUpdate();
                    }
                }
            }
        });
        
        window.appState._currentDay = originalCurrentDay;
    }
    
    debouncedUpdate() {
        if (this._summaryUpdateRaf != null) {
            cancelAnimationFrame(this._summaryUpdateRaf);
        }
        this._summaryUpdateRaf = requestAnimationFrame(() => {
            this._summaryUpdateRaf = null;
            this.updateSummary();
        });
    }
    
    populateGroupSelect() {
        const select = this.elements.summaryGroupSelect;
        if (!select || !window.appState || !window.appState.data) return;
        
        while (select.options.length > 1) {
            select.remove(1);
        }
        
        window.appState.data.groups.forEach(group => {
            if (group.waves && group.waves.length > 0) {
                const option = document.createElement('option');
                option.value = group.id;
                option.textContent = group.name;
                select.appendChild(option);
            }
        });
    }
    

	// modules/summaryManager.js - возвращаем сортировку по близости (как было)

	updateSummary() {
		if (this.isUpdating) return;
		
		try {
			this.isUpdating = true;
			
			const waves = this.getWavesForSelectedGroup();
			const stateWaves = this.filterWavesByState(waves);
			
			// НЕ ДОБАВЛЯЕМ СОРТИРОВКУ - оставляем как было (сортировка по близости уже в filterWavesByState)
			
			this.updateResults(stateWaves);
			
		} catch (error) {
			console.error('Error updating summary:', error);
		} finally {
			this.isUpdating = false;
		}
	}

	filterWavesByState(waves) {
		if (!waves.length) return [];
		
		const results = [];
		const currentDay = window.appState.currentDay || 0;
		
		waves.forEach(wave => {
			if (!wave.period || wave.period <= 0) return;
			
			const phase = (currentDay % wave.period);
			const normalizedPhase = ((phase / wave.period) * 2 * Math.PI);
			const waveState = (Math.sin(normalizedPhase) * 5);
			const difference = Math.abs(waveState - this.currentState);
			
			if (difference <= this.tolerance) {
				const isPresentOrFuture = this.isWaveInPresentOrFuture(wave, normalizedPhase);
				const isPastWave = !isPresentOrFuture;
				
				if (this.includePastWaves || !isPastWave) {
					results.push({
						wave: wave,
						phase: phase,
						state: waveState,
						difference: difference,
						closeness: this.getClosenessLevel(difference),
						isPastWave: isPastWave
					});
				}
			}
		});
		
		// ОСТАВЛЯЕМ СОРТИРОВКУ ПО БЛИЗОСТИ (как было)
		results.sort((a, b) => a.difference - b.difference);
		
		return results;
	}
    
    getWavesForSelectedGroup() {
        if (!window.appState || !window.appState.data) return [];
        
        if (this.currentGroup === 'all') {
            return window.appState.data.waves;
        }
        
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
    
    
    isWaveInPresentOrFuture(wave, normalizedPhaseRadians) {
        const phase = normalizedPhaseRadians / (2 * Math.PI);
        const state = this.currentState;
        
        if (Math.abs(state) < 0.1) {
            return phase <= 0.5;
        }
        
        if (state > 4.5) {
            return phase <= 0.25;
        }
        
        if (state < -4.5) {
            return phase <= 0.75;
        }
        
        return true;
    }
    
    getClosenessLevel(difference) {
        if (difference < 0.001) {
            if (this.currentState === 0) {
                return 'Эквилибриум';
            } else if (this.currentState === -5 || this.currentState === 5) {
                return 'Экстремум';
            }
        }
        
        if (difference < 0.1) return 'очень близко';
        if (difference < 0.3) return 'близко';
        if (difference < 0.5) return 'довольно близко';
        return 'рядом';
    }
    

	updateResults(stateWaves) {
		const resultsElement = this.elements.summaryResults;
		if (!resultsElement) return;
		
		if (stateWaves.length === 0) {
			resultsElement.innerHTML = '<div class="summary-empty">Нет сигналов в выбранном состоянии</div>';
			return;
		}
		
		const resultsHTML = stateWaves.map((item, index) => {
			const closenessClass = this.getClosenessClass(item.difference);
			const stateValue = item.state.toFixed(2);
			
			const pastWaveMarker = item.isPastWave ? '<span style="color: #666; font-style: italic;"> (прошедшая)</span>' : '';
			
			return `
				<div class="summary-item ${closenessClass}">
					<div class="summary-item-info">
						<div class="summary-item-name">
							<span class="summary-item-index">${index + 1}.</span>
							${item.wave.name} (${item.wave.period} дней)${pastWaveMarker}
						</div>
						<div class="summary-item-details">
							<span class="summary-item-state">Состояние: ${stateValue}</span>
							<span class="summary-item-difference">Разница: ${item.difference.toFixed(2)}</span>
							<span class="summary-item-closeness">${item.closeness}</span>
						</div>
					</div>
					<div class="summary-item-color" style="background-color: ${item.wave.color || '#666666'}"></div>
					<div class="summary-item-actions">
						<button class="ui-btn show-on-vizor-btn" data-wave-id="${item.wave.id}">
							${window.dom ? window.dom.getWaveVizorToggleButtonLabel(item.wave.id) : 'Показать волну'}
						</button>
					</div>
				</div>
			`;
		}).join('');
		
		resultsElement.innerHTML = resultsHTML;

		queueMicrotask(() => {
			document.querySelectorAll('.show-on-vizor-btn').forEach(btn => {
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
								window.waves.updatePosition();
							}

							if (window.unifiedListManager && window.unifiedListManager.updateWavesList) {
								window.unifiedListManager.updateWavesList();
							}
						}
					}
					if (window.dom && window.dom.refreshShowOnVizorButtonLabels) {
						window.dom.refreshShowOnVizorButtonLabels();
					}
				});
			});
		});
	}


    
    getClosenessClass(difference) {
        if (difference < 0.001) return 'summary-item-exact';
        if (difference < 0.1) return 'summary-item-very-close';
        if (difference < 0.3) return 'summary-item-close';
        if (difference < 0.5) return 'summary-item-fairly-close';
        return 'summary-item-nearby';
    }
    
    refresh() {
        this.populateGroupSelect();
        this.updateSummary();
    }
}

window.summaryManager = new SummaryManager();