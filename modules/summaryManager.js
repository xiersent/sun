/**
 * @file summaryManager.js
 * Вкладка «Сводка»: фильтр по группе и состоянию, список близких сигналов.
 */
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
    
    /** Кэширует элементы панели сводки. */
    cacheElements() {
        const ids = [
            'summaryPanel',
            'summaryGroupSelect',
            'summaryStateSelect',
            'summaryResults'
        ];
        
        ids.forEach(id => {
            const el = window.dom.byKey(id);
            if (el) this.elements[id] = el;
        });
    }
    
    /** Инициализация сводки: слушатели, селекты, первое обновление. */
    init() {
        this.setupEventListeners();
        this.populateGroupSelect();
        this.setupStateSelect();
        this.restoreSelections();
        this.updateSummary(); // ВЫЗЫВАЕМ ОБНОВЛЕНИЕ ПРИ ИНИЦИАЛИЗАЦИИ
        this.setupStateObservers();
    }
    
    /** change на группе, состоянии и «прошлые волны». */
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
        
        const includePastCheckbox = window.dom.byKey('includePastWaves');
        if (includePastCheckbox) {
            // УСТАНАВЛИВАЕМ ОБРАБОТЧИК СОБЫТИЯ
            includePastCheckbox.addEventListener('change', (e) => {
                this.includePastWaves = e.target.checked;
                this.saveSelections(); // СОХРАНЯЕМ СОСТОЯНИЕ
                this.updateSummary(); // НЕМЕДЛЕННО ОБНОВЛЯЕМ
            });
        }
    }
    
    /** Заполняет select состояний от +5 до −5. */
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
    
    /** Восстанавливает фильтры сводки из localStorage. */
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
            const includePastCheckbox = window.dom.byKey('includePastWaves');
            if (includePastCheckbox) {
                includePastCheckbox.checked = this.includePastWaves;
            }
        }
    }
    
    /** Сохраняет фильтры сводки в localStorage. */
    saveSelections() {
        localStorage.setItem('summarySelectedGroup', this.currentGroup);
        localStorage.setItem('summarySelectedState', this.currentState.toString());
        localStorage.setItem('summaryIncludePastWaves', this.includePastWaves.toString());
    }
    
    /** Setter currentDate для debouncedUpdate сводки и пересечений. */
    setupStateObservers() {
        const originalCurrentDate = window.appState.currentDate;
        Object.defineProperty(window.appState, 'currentDate', {
            get() {
                return this._currentDate;
            },
            set(value) {
                this._currentDate = value;

                if (!this.isProgrammaticDateChange) {
                    if (window.summaryManager && window.summaryManager.debouncedUpdate) {
                        window.summaryManager.debouncedUpdate();
                    }
                    if (
                        window.stateIntersectionManager &&
                        window.stateIntersectionManager.debouncedUpdate
                    ) {
                        window.stateIntersectionManager.debouncedUpdate();
                    }
                }
            }
        });

        window.appState._currentDate = originalCurrentDate;

        this.setupGlobalDateObserver();
    }

    /** Устанавливает p global date observer. */
    setupGlobalDateObserver() {
        const originalCurrentDay = window.appState.currentDay;
        Object.defineProperty(window.appState, 'currentDay', {
            get() {
                return this._currentDay;
            },
            set(value) {
                const oldValue = this._currentDay;
                this._currentDay = value;

                if (Math.abs(value - oldValue) > 0.001 && !this.isProgrammaticDateChange) {
                    if (window.summaryManager && window.summaryManager.debouncedUpdate) {
                        window.summaryManager.debouncedUpdate();
                    }
                    if (
                        window.stateIntersectionManager &&
                        window.stateIntersectionManager.debouncedUpdate
                    ) {
                        window.stateIntersectionManager.debouncedUpdate();
                    }
                }
            }
        });

        window.appState._currentDay = originalCurrentDay;
    }
    
    /** RAF-отложенный updateSummary. */
    debouncedUpdate() {
        if (this._summaryUpdateRaf != null) {
            cancelAnimationFrame(this._summaryUpdateRaf);
        }
        this._summaryUpdateRaf = requestAnimationFrame(() => {
            this._summaryUpdateRaf = null;
            this.updateSummary();
        });
    }
    
    /** Опции select групп сигналов (+ «все»). */
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
			
			if (!window.appState.hasActivePerson()) {
				const resultsElement = this.elements.summaryResults;
				if (resultsElement) {
					resultsElement.innerHTML =
						'<div class="sun-summaryEmpty">Выберите персону в списке дат — сводка по состояниям сигналов строится от выбранной даты рождения.</div>';
				}
				return;
			}
			
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
			
			const phase =
				window.waves && typeof window.waves._wavePhaseInPeriod === 'function'
					? window.waves._wavePhaseInPeriod(wave, currentDay)
					: (currentDay % wave.period);
			const normalizedPhase = ((phase / wave.period) * 2 * Math.PI);
			const waveState = (Math.sin(normalizedPhase) * 5);
			const difference = Math.abs(waveState - this.currentState);
			const dir =
				window.waves && typeof window.waves.calculateWaveDirectionAtDay === 'function'
					? window.waves.calculateWaveDirectionAtDay(wave, currentDay)
					: 0;
			
			if (difference <= this.tolerance) {
				const isPresentOrFuture = this.isWaveInPresentOrFuture(wave, normalizedPhase);
				const isPastWave = !isPresentOrFuture;
				
				if (this.includePastWaves || !isPastWave) {
					results.push({
						wave: wave,
						phase: phase,
						state: waveState,
						dir,
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
    
    /** Возвращает waves for selected group. */
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
    
    
    /** Проверяет: is wave in present or future. */
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
    
    /** Возвращает closeness level. */
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
			resultsElement.innerHTML = '<div class="sun-summaryEmpty">Нет сигналов в выбранном состоянии</div>';
			return;
		}

		const body = stateWaves
			.map((item) => {
				const closenessClass = this.getClosenessClass(item.difference);
				const stateValue = item.state.toFixed(2);
				const dirLabel =
					window.waves && typeof window.waves.formatWaveDirectionLabel === 'function'
						? window.waves.formatWaveDirectionLabel(item.dir)
						: '—';
				const dirTitle =
					window.waves && typeof window.waves.formatWaveDirectionTitle === 'function'
						? window.waves.formatWaveDirectionTitle(item.dir)
						: '';
				const pastWaveMarker = item.isPastWave
					? ' <span class="sun-pastWaveMarker">(прошедшая)</span>'
					: '';
				const name = `${this._escapeHtml(item.wave.name || '')} <span class="sun-dateComparisonPeriod">(${item.wave.period} дн.)</span>${pastWaveMarker}`;
				const vizorLabel =
					window.dom && typeof window.dom.getWaveVizorToggleButtonLabel === 'function'
						? window.dom.getWaveVizorToggleButtonLabel(item.wave.id)
						: 'Показать волну';

				return `<tr class="sun-dateComparisonTableRow" data-wave-id="${item.wave.id}">
					<td class="sun-dateComparisonTableCell sun-dateComparisonName">
						<span class="sun-dateComparisonColor" style="background-color:${item.wave.color || '#666'}"></span>
						${name}
					</td>
					<td class="sun-dateComparisonTableCell sun-dateComparisonState">${stateValue}</td>
					<td class="sun-dateComparisonTableCell" title="${this._escapeHtml(dirTitle)}">${dirLabel}</td>
					<td class="sun-dateComparisonTableCell sun-dateComparisonState">${item.difference.toFixed(2)}</td>
					<td class="sun-dateComparisonTableCell"><span class="sun-intersectionResultCloseness ${closenessClass}">${this._escapeHtml(item.closeness)}</span></td>
					<td class="sun-dateComparisonTableCell sun-dateComparisonActions">
						<button type="button" class="sun-uiBtn sun-dateComparisonActionsBtn sun-showOnVizorBtn" data-wave-id="${item.wave.id}">${this._escapeHtml(vizorLabel)}</button>
					</td>
				</tr>`;
			})
			.join('');

		resultsElement.innerHTML = `
			<table class="sun-dateComparisonTable sun-stateSearchTable">
				<thead>
					<tr class="sun-dateComparisonTableRow">
						<th class="sun-dateComparisonTableHeadCell">Сигнал</th>
						<th class="sun-dateComparisonTableHeadCell sun-dateComparisonState">Состояние</th>
						<th class="sun-dateComparisonTableHeadCell">Напр.</th>
						<th class="sun-dateComparisonTableHeadCell sun-dateComparisonState">Разница</th>
						<th class="sun-dateComparisonTableHeadCell">Близость</th>
						<th class="sun-dateComparisonTableHeadCell sun-dateComparisonActions">График</th>
					</tr>
				</thead>
				<tbody>${body}</tbody>
			</table>
		`;

		this._bindShowOnVizorButtons(resultsElement);
	}

	/** Кнопки «Показать/Скрыть волну» в таблице результатов. */
	_bindShowOnVizorButtons(container) {
		if (!container) return;

		queueMicrotask(() => {
			container.querySelectorAll('.sun-showOnVizorBtn:not(.sun-dateCompareVizorBtn)').forEach((btn) => {
				btn.replaceWith(btn.cloneNode(true));
			});

			container.querySelectorAll('.sun-showOnVizorBtn:not(.sun-dateCompareVizorBtn)').forEach((btn) => {
				btn.addEventListener('click', (e) => {
					e.preventDefault();
					e.stopPropagation();

					const waveId = btn.dataset.waveId;
					if (!waveId) return;

					const checkbox = document.querySelector(`.sun-waveVisibilityCheck[data-id="${waveId}"]`);

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
					} else if (window.appState && window.appState.waveVisibility) {
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
					if (window.dom && window.dom.refreshShowOnVizorButtonLabels) {
						window.dom.refreshShowOnVizorButtonLabels();
					}
				});
			});
		});
	}

	_escapeHtml(s) {
		return String(s)
			.replace(/&/g, '&amp;')
			.replace(/</g, '&lt;')
			.replace(/>/g, '&gt;')
			.replace(/"/g, '&quot;');
	}


    
    /** Возвращает closeness class. */
    getClosenessClass(difference) {
        if (difference < 0.001) return 'sun-intersectionItemExact';
        if (difference < 0.1) return 'sun-intersectionItemVeryClose';
        if (difference < 0.3) return 'sun-intersectionItemClose';
        if (difference < 0.5) return 'sun-intersectionItemFairlyClose';
        return 'sun-intersectionItemNearby';
    }
    
    /** populateGroupSelect + updateSummary. */
    refresh() {
        this.populateGroupSelect();
        this.updateSummary();
    }
}

window.summaryManager = new SummaryManager();