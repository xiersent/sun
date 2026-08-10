/**
 * @file uiManager.js
 * Управление интерфейсом: кнопки data-action, вкладки, видимость слоёв графика,
 * угловые квадраты, отражение/поворот волн, экспорт и сброс настроек.
 */
class UIManager {
    /** Ссылки на DOM из appCore, активная вкладка панели. */
    constructor() {
        this.elements = window.appCore ? window.appCore.elements : {};
        this.setupDateTimeInputs();
        this.activeTab = null;
    }

    /**
     * Поля даты/времени визора: автозаполнение при фокусе, Enter → переход к дате, маска времени.
     */
    setupDateTimeInputs() {
        const dateInput = window.dom.byKey('mainDateInputDate');
        const timeInput = window.dom.byKey('mainDateInputTime');

        if (!dateInput || !timeInput) return;

        dateInput.addEventListener('focus', () => {
            if (!dateInput.value) {
                const now = new Date();
                dateInput.value = window.timeUtils.formatForDateInput(now);
            }
        });

        timeInput.addEventListener('focus', () => {
            if (!timeInput.value) {
                const now = new Date();
                timeInput.value = window.timeUtils.formatForTimeInput(now);
            }
        });

        const handleEnter = (e) => {
            if (e.key === 'Enter') {
                if (window.dates && window.dates.setDateFromInputs) {
                    window.dates.setDateFromInputs();
                }
            }
        };

        dateInput.addEventListener('keydown', handleEnter);
        timeInput.addEventListener('keydown', handleEnter);

        timeInput.addEventListener('blur', () => {
            let value = timeInput.value.trim();
            if (value && value.split(':').length === 2) {
                timeInput.value = value + ':00';
            }
        });

        timeInput.addEventListener('input', (e) => {
            let value = e.target.value.replace(/[^\d:]/g, '');

            if (value.length === 2 && !value.includes(':')) {
                value = value + ':';
            } else if (value.length === 5 && value.split(':').length < 3) {
                value = value + ':';
            }

            e.target.value = value;
        });
    }

    /**
     * Диспетчер кликов по data-action (см. index.html и eventManager).
     * @param {string} action — имя действия
     * @param {HTMLElement} [element] — элемент, вызвавший действие
     */
    handleAction(action, element) {
        const actions = {
            resetWarning: () => this.resetWarning(),
            prevDay: () => window.dates.navigateDay(-1),
            nextDay: () => window.dates.navigateDay(1),
            today: () => window.dates.goToToday(),
            now: () => window.dates.goToNow(),
            setDate: () => window.dates.setDateFromInputs(),

            flipH: () => this.flipHorizontal(),
            flipV: () => this.flipVertical(),
            rotateL: () => this.rotate(-90),
            rotateR: () => this.rotate(90),
            resetTransform: () => this.resetTransform(),

            toggleUI: () => this.toggleUI(),
            toggleGraph: () => this.toggleGraph(),
            toggleWaveLabels: () => this.toggleWaveLabels(),
            toggleWaveIntersections: () => this.toggleWaveIntersections(),
            toggleExtremumWaveColors: () => this.toggleExtremumWaveColors(),
            toggleExtremes: () => this.toggleExtremes(),
            toggleEquilibrium: () => this.toggleEquilibrium(),
            toggleSquares: () => this.toggleSquares(),
            toggleGrayMode: () => this.toggleGrayMode(),
            toggleGraphGrayMode: () => this.toggleGraphGrayMode(),
            toggleStars: () => this.toggleStars(),

            toggleCorners: () => this.toggleCornerSquares('corners'),
            toggleAxial: () => this.toggleCornerSquares('axial'),
            toggleVertical: () => this.toggleCornerSquares('vertical'),
            toggleSides: () => this.toggleCornerSquares('sides'),
            toggleMiddle: () => this.toggleCornerSquares('middle'),
            toggleLeft: () => this.toggleCornerSquares('left'),
            toggleRight: () => this.toggleCornerSquares('right'),
            toggleTop: () => this.toggleCornerSquares('top'),
            toggleBottom: () => this.toggleCornerSquares('bottom'),
            toggleAllSquares: () => this.toggleAllSquares(),
            resetCorners: () => this.resetCorners(),

            exportAll: () => window.importExport.exportAll(),
            exportDates: () => window.importExport.exportDates(),
            exportWaves: () => window.importExport.exportWaves(),
            importAll: () => window.dom.byKey('importAllFile').click(),
            resetAll: () => this.resetAll()
        };

        if (actions[action]) {
            actions[action]();
        }
    }

    /** Снова показать экран предупреждения и скрыть основной UI. */
    resetWarning() {
        const warningOverlay = window.dom.byKey('warningOverlay');
        if (warningOverlay) {
            warningOverlay.classList.remove('sun-hidden');
            document.body.style.overflow = 'hidden';
        }

        const warningBox = document.querySelector('.sun-warningBox');
        if (warningBox) {
            warningBox.classList.remove('sun-hidden');
        }

        if (window.appClassSync) {
            window.appClassSync.applyUiHidden(true);
        }

        document.querySelectorAll('.sun-cornerSquare').forEach((square) => {
            square.style.display = 'block';
        });
    }

    /** Скрыть/показать панели и полосу времени. */
    toggleUI() {
        window.appState.uiHidden = !window.appState.uiHidden;
        if (window.appClassSync) {
            window.appClassSync.applyUiHidden(window.appState.uiHidden);
        }
        if (window.appState.uiHidden) {
            if (window.timeBarManager && window.timeBarManager.container) {
                window.timeBarManager.container.style.display = 'none';
            }
        } else {
            if (window.timeBarManager && window.timeBarManager.container) {
                window.timeBarManager.container.style.display = 'block';
            }
        }
        window.appState.save();
    }

    /** Синхронизировать кнопку «Краска экстр.» с appState.extremumWaveColorHighlight. */
    syncExtremumWaveColorHighlightButton() {
        const btn = window.dom.byKey('btnExtremumWaveColorHighlight');
        if (!btn) return;
        const on = window.appState.extremumWaveColorHighlight === true;
        btn.classList.remove('uiBtnToggleOff', 'sun-uiBtnToggleOff');
        btn.classList.toggle('sun-uiBtnToggleOff', !on);
        btn.title = on
            ? 'Окраска волн и выносок при экстремумах включена'
            : 'Окраска волн и выносок при экстремумах выключена';
        btn.setAttribute('aria-pressed', on ? 'true' : 'false');
    }

    /** Вкл/выкл подсветку волн и выносок в точках экстремума (±4…±5). */
    toggleExtremumWaveColors() {
        const next = window.appState.extremumWaveColorHighlight !== true;
        window.appState.extremumWaveColorHighlight = next;
        this.syncExtremumWaveColorHighlightButton();
        if (window.waves && window.waves.updatePosition) {
            window.waves.updatePosition();
        }
        window.appState.save();
    }

    /** Скрыть/показать боковые выноски имён волн (.sun-waveLabelsContainer). */
    toggleWaveLabels() {
        const horizontalContainer = document.querySelector('.sun-waveLabelsContainer');

        if (horizontalContainer) {
            const areHidden = horizontalContainer.classList.contains('sun-hidden');

            if (areHidden) {
                horizontalContainer.classList.remove('sun-hidden');
            } else {
                horizontalContainer.classList.add('sun-hidden');
            }
        }
    }

    /** Скрыть/показать верхние/нижние выноски времени экстремумов. */
    toggleExtremes() {
        const verticalContainer = document.querySelector('.sun-waveLabelsVerticalContainer');

        if (verticalContainer) {
            const areHidden = verticalContainer.classList.contains('sun-hidden');

            if (areHidden) {
                verticalContainer.classList.remove('sun-hidden');
            } else {
                verticalContainer.classList.add('sun-hidden');
            }
        }
    }

    /** Скрыть/показать точки пересечения волн с горизонтальной осью (эквилибриум). */
    toggleEquilibrium() {
        const axisXPointsContainer = document.querySelector('.sun-waveAxisXPoints');

        if (axisXPointsContainer) {
            const areHidden = axisXPointsContainer.classList.contains('sun-hidden');

            if (areHidden) {
                axisXPointsContainer.classList.remove('sun-hidden');

                if (window.waves && window.waves.updateAxisXIntersectionPoints) {
                    window.waves.updateAxisXIntersectionPoints();
                }
            } else {
                axisXPointsContainer.classList.add('sun-hidden');
            }
        } else {
            if (window.waves && window.waves.updateAxisXIntersectionPoints) {
                window.waves.updateAxisXIntersectionPoints();

                requestAnimationFrame(() => {
                    const newContainer = document.querySelector('.sun-waveAxisXPoints');
                    if (newContainer) {
                        newContainer.classList.remove('sun-hidden');
                    }
                });
            }
        }
    }

    /**
     * Переключить видимость подмножества угловых квадратов.
     * @param {string} type — corners | axial | vertical | sides | middle | left | right | top | bottom
     */
    toggleCornerSquares(type) {
        const squares = {
            corners: ['.sun-cornerPosTl', '.sun-cornerPosTr', '.sun-cornerPosBl', '.sun-cornerPosBr'],
            axial: ['.sun-cornerPosTc', '.sun-cornerPosBc', '.sun-cornerPosLc', '.sun-cornerPosRc'],
            vertical: ['.sun-cornerPosTc', '.sun-cornerPosBc'],
            sides: ['.sun-cornerPosLc', '.sun-cornerPosRc'],
            middle: [
                '.sun-cornerPosMt',
                '.sun-cornerPosMb',
                '.sun-cornerPosMl',
                '.sun-cornerPosMr',
                '.sun-cornerPosMt2',
                '.sun-cornerPosMb2',
                '.sun-cornerPosMl2',
                '.sun-cornerPosMr2'
            ],
            left: [
                '.sun-cornerPosTl',
                '.sun-cornerPosBl',
                '.sun-cornerPosLc',
                '.sun-cornerPosMl',
                '.sun-cornerPosMl2'
            ],
            right: [
                '.sun-cornerPosTr',
                '.sun-cornerPosBr',
                '.sun-cornerPosRc',
                '.sun-cornerPosMr',
                '.sun-cornerPosMr2'
            ],
            top: [
                '.sun-cornerPosTl',
                '.sun-cornerPosTr',
                '.sun-cornerPosTc',
                '.sun-cornerPosMt',
                '.sun-cornerPosMt2'
            ],
            bottom: [
                '.sun-cornerPosBl',
                '.sun-cornerPosBr',
                '.sun-cornerPosBc',
                '.sun-cornerPosMb',
                '.sun-cornerPosMb2'
            ],
            all: [
                '.sun-cornerPosTl',
                '.sun-cornerPosTr',
                '.sun-cornerPosBl',
                '.sun-cornerPosBr',
                '.sun-cornerPosTc',
                '.sun-cornerPosBc',
                '.sun-cornerPosLc',
                '.sun-cornerPosRc',
                '.sun-cornerPosMt',
                '.sun-cornerPosMb',
                '.sun-cornerPosMl',
                '.sun-cornerPosMr',
                '.sun-cornerPosMt2',
                '.sun-cornerPosMb2',
                '.sun-cornerPosMl2',
                '.sun-cornerPosMr2'
            ]
        };
        const selectors = squares[type] || squares.all;
        selectors.forEach((selector) => {
            const square = document.querySelector(`.sun-cornerSquare${selector}`);
            if (square) {
                square.style.display = square.style.display === 'none' ? 'block' : 'none';
            }
        });
    }

    /** Показать или скрыть все угловые квадраты разом; сохранить в appState.cornerSquaresVisible. */
    toggleAllSquares() {
        const allSquares = document.querySelectorAll('.sun-cornerSquare');
        const anyVisible = Array.from(allSquares).some((square) => square.style.display !== 'none');
        const newVisibility = !anyVisible;
        allSquares.forEach((square) => {
            square.style.display = newVisibility ? 'block' : 'none';
        });
        window.appState.cornerSquaresVisible = newVisibility;
        window.appState.save();
    }

    /** Переключить видимость всех угловых квадратов по флагу cornerSquaresVisible. */
    toggleSquares() {
        window.appState.cornerSquaresVisible = !window.appState.cornerSquaresVisible;
        const allSquares = document.querySelectorAll('.sun-cornerSquare');
        allSquares.forEach((square) => {
            square.style.display = window.appState.cornerSquaresVisible ? 'block' : 'none';
        });
        window.appState.save();
    }

    /** Сбросить окраску углов (waveCornerColor) для всех волн и чекбоксов в списке. */
    resetCorners() {
        window.appState.data.waves.forEach((wave) => {
            const waveIdStr = String(wave.id);
            window.appState.waveCornerColor[waveIdStr] = false;
        });

        this.updateCornerSquareColors();

        if (window.dataManager && window.dataManager.updateWavesGroups) {
            window.dataManager.updateWavesGroups();
        }

        document.querySelectorAll('.sun-waveCornerColorCheck').forEach((checkbox) => {
            checkbox.checked = false;
        });

        window.appState.save();

        window.dispatchEvent(new CustomEvent('zaraza:waveCornerSelectionChanged'));
    }

    /** Синхронизировать цвет угловых квадратов (волна или базовый цвет пользователя). */
    updateCornerSquareColors() {
        if (window.waves && typeof window.waves.updateCornerSquareColors === 'function') {
            window.waves.updateCornerSquareColors();
        } else if (window.appCore && typeof window.appCore.restoreCornerColor === 'function') {
            window.appCore.restoreCornerColor();
        }
    }

    /** Отразить волны по горизонтали (scaleX *= −1). */
    flipHorizontal() {
        window.appState.transform.scaleX *= -1;
        this.applyTransform();
    }

    /** Отразить волны по вертикали (scaleY *= −1). */
    flipVertical() {
        window.appState.transform.scaleY *= -1;
        this.applyTransform();
    }

    /** Обновить title и aria-pressed кнопки ↔ (flipH). */
    syncFlipHButton() {
        const btn = window.dom.byKey('btnFlipH');
        if (!btn) {
            return;
        }
        const flipped =
            window.wavesTransformLayer && window.wavesTransformLayer.isScaleXFlipped
                ? window.wavesTransformLayer.isScaleXFlipped()
                : window.appState.transform && window.appState.transform.scaleX < 0;
        btn.classList.toggle('sun-flipHActive', flipped);
        btn.setAttribute('aria-pressed', flipped ? 'true' : 'false');
        btn.title = flipped
            ? 'Горизонтальное отражение включено'
            : 'Отразить волны по горизонтали';
    }

    /** Синхронизировать кнопки отражения ↔ и ↕. */
    syncTransformFlipButtons() {
        this.syncFlipHButton();
        this.syncFlipVButton();
    }

    /** Обновить title и aria-pressed кнопки ↕ (flipV). */
    syncFlipVButton() {
        const btn = window.dom.byKey('btnFlipV');
        if (!btn) {
            return;
        }
        const flipped =
            window.wavesTransformLayer && window.wavesTransformLayer.isScaleYFlipped
                ? window.wavesTransformLayer.isScaleYFlipped()
                : window.appState.transform && window.appState.transform.scaleY < 0;
        btn.classList.toggle('sun-flipVActive', flipped);
        btn.setAttribute('aria-pressed', flipped ? 'true' : 'false');
        btn.title = flipped
            ? 'Вертикальное отражение включено'
            : 'Отразить волны по вертикали';
    }

    /**
     * Повернуть раскладку графика на заданный угол (градусы, накапливается в transform.rotation).
     * @param {number} degrees — обычно ±90
     */
    rotate(degrees) {
        window.appState.transform.rotation += degrees;
        this.applyTransform();
    }

    /** Сбросить отражение и поворот к scale 1 и rotation 0. */
    resetTransform() {
        window.appState.transform = {
            scaleX: 1,
            scaleY: 1,
            rotation: 0
        };
        this.applyTransform();
    }

    /** Применить transform к слою волн, сетке и кнопкам отражения; сохранить состояние. */
    applyTransform() {
        if (window.wavesTransformLayer && window.wavesTransformLayer.applyFromAppState) {
            window.wavesTransformLayer.applyFromAppState();
        }
        this.syncTransformFlipButtons();
        window.appState.save();
    }

    /** Скрыть/показать блок графика. */
    toggleGraph() {
        window.appState.graphHidden = !window.appState.graphHidden;
        if (window.appClassSync) {
            window.appClassSync.applyGraphHidden(window.appState.graphHidden);
        }
        window.appState.save();
    }

    /** Обесцветить основной интерфейс. */
    toggleGrayMode() {
        window.appState.grayMode = !window.appState.grayMode;
        if (window.appClassSync) {
            window.appClassSync.applyGrayMode(window.appState.grayMode);
        }
        window.appState.save();
    }

    /** Обесцветить только график и волны. */
    toggleGraphGrayMode() {
        window.appState.graphGrayMode = !window.appState.graphGrayMode;
        if (window.appClassSync) {
            window.appClassSync.applyGraphGrayMode(window.appState.graphGrayMode);
        }
        window.appState.save();
    }

    /** Показать/скрыть точки пересечения волн друг с другом на графике. */
    toggleWaveIntersections() {
        window.appState.waveIntersectionsVisible = !window.appState.waveIntersectionsVisible;
        window.appState.save();

        if (window.appState.waveIntersectionsVisible) {
            if (window.waves && window.waves.renderWaveIntersectionPoints) {
                window.waves.renderWaveIntersectionPoints();
            }
        } else if (window.waves && window.waves.removeWaveIntersectionPoints) {
            window.waves.removeWaveIntersectionPoints();
        }
    }

    /** Переключить отображение имён персон: звёздочки или полные имена в списке и центре. */
    toggleStars() {
        window.appState.showStars = !window.appState.showStars;
        if (window.appClassSync) {
            window.appClassSync.applyDateLabelMode(window.appState.showStars);
        }
        window.grid.updateCenterDate();
        window.dataManager.updateDateList();
        window.appState.save();
    }

    /** Полный сброс localStorage и данных приложения с перезагрузкой страницы (двойное подтверждение). */
    resetAll() {
        if (!confirm('Сбросить ВСЕ настройки интерфейса к значениям по умолчанию?')) {
            return;
        }

        if (!confirm('ВНИМАНИЕ: Это действие нельзя отменить. Все данные будут уничтожены. Продолжить?')) {
            return;
        }

        localStorage.clear();

        try {
            sessionStorage.clear();
        } catch (e) {}

        if (window.appState) {
            window.appState.applyMemoryDefaultsFromReset({ skipSave: true });
            if (window.appState.data.uiSettings) {
                delete window.appState.data.uiSettings.migrationsSchemaVersion;
                delete window.appState.data.uiSettings.firstLaunchDefaultsApplied;
            }
            window.appState.save();
        }

        window.location.reload();
    }

    /** Заполнить поля mainDateInputDate/Time из appState.currentDate. */
    updateDateTimeInputs() {
        const dateInput = window.dom.byKey('mainDateInputDate');
        const timeInput = window.dom.byKey('mainDateInputTime');

        if (dateInput && timeInput && window.timeUtils) {
            const formatted = window.timeUtils.formatForDateTimeInputs(window.appState.currentDate);
            dateInput.value = formatted.date;
            timeInput.value = formatted.time;
        }
    }

    /** Обновить списки, поля даты, волны на графике и подпись в центре. */
    updateUI() {
        window.dataManager.updateDateList();
        window.dataManager.updateWavesGroups();

        this.updateDateTimeInputs();

        if (window.dom.byKey('dateInput')) {
            window.dom.byKey('dateInput').value = window.timeUtils.formatForDateInput(
                window.appState.currentDate
            );
        }

        window.waves.updatePosition();
        window.grid.updateCenterDate();
    }

    /** Очистить форму добавления пользовательского сигнала. */
    clearWaveForm() {
        window.dom.byKey('customWaveName').value = '';
        window.dom.byKey('customWavePeriod').value = '';
        window.dom.byKey('customWaveType').value = 'solid';
        window.dom.byKey('customWaveColor').value = '#666666';
        const noteEl = window.dom.byKey('customWaveNote');
        if (noteEl) {
            noteEl.value = '';
        }
    }

    /** Корень основных вкладок панели. */
    _getTabsRoot() {
        return document.querySelector('.sun-tabsSection');
    }

    /** Сохранить активную вкладку панели в appState (между сессиями). */
    _persistPanelActiveTab() {
        if (!window.appState) {
            return;
        }
        window.appState.panelActiveTab = this.activeTab;
        window.appState.saveDebounced();
        try {
            localStorage.removeItem('activeTab');
        } catch (e) {}
    }

    /** Побочные эффекты после открытия вкладки (шкала времени, пересечения, сравнение). */
    _runTabActivatedSideEffects(tabId) {
        if (tabId === 'timeBar' && window.timeBarManager) {
            queueMicrotask(() => {
                if (typeof window.timeBarManager.createHourMarkers === 'function') {
                    window.timeBarManager.createHourMarkers();
                }
                if (typeof window.timeBarManager.updateTimeIndicator === 'function') {
                    window.timeBarManager.updateTimeIndicator();
                }
            });
        }

        if (tabId === 'intersectionBar' && window.timeBarManager) {
            queueMicrotask(() => {
                if (typeof window.timeBarManager.buildIntersectionControlsPanel === 'function') {
                    window.timeBarManager.buildIntersectionControlsPanel();
                }
                if (typeof window.timeBarManager.createHourMarkers === 'function') {
                    window.timeBarManager.createHourMarkers();
                }
                if (typeof window.timeBarManager.updateTimeIndicator === 'function') {
                    window.timeBarManager.updateTimeIndicator();
                }
                if (window.extremumTimeManager && window.extremumTimeManager.updateExtremums) {
                    window.extremumTimeManager.updateExtremums();
                }
            });
        }

        if (tabId === 'multiIntersectionBar' && window.timeBarManager) {
            queueMicrotask(() => {
                if (typeof window.timeBarManager.buildMultiIntersectionControlsPanel === 'function') {
                    window.timeBarManager.buildMultiIntersectionControlsPanel();
                }
                if (typeof window.timeBarManager.createHourMarkers === 'function') {
                    window.timeBarManager.createHourMarkers();
                }
                if (typeof window.timeBarManager.updateTimeIndicator === 'function') {
                    window.timeBarManager.updateTimeIndicator();
                }
                if (window.extremumTimeManager && window.extremumTimeManager.updateExtremums) {
                    window.extremumTimeManager.updateExtremums();
                }
            });
        }

        if (tabId === 'intersections' && window.stateIntersectionManager) {
            queueMicrotask(() => {
                if (typeof window.stateIntersectionManager.mirrorCompareSelectsToIntersection === 'function') {
                    window.stateIntersectionManager.mirrorCompareSelectsToIntersection();
                }
                window.stateIntersectionManager.updateIntersections();
            });
        }

        if (tabId === 'dateCompare' && window.dateComparisonManager) {
            queueMicrotask(() => {
                window.dateComparisonManager.updateComparison();
                if (window.waves && typeof window.waves.updatePosition === 'function') {
                    window.waves.updatePosition();
                }
            });
        }
    }

    /**
     * Клик по вкладке: повторный клик снимает активность; при открытии — обновить пересечения/сравнение.
     * @param {HTMLElement} tabButton — кнопка с data-tab
     */
    handleTabClick(tabButton) {
        const tabId = tabButton.dataset.tab;
        if (!tabId) {
            return;
        }

        if (this.activeTab === tabId) {
            this.deactivateTab(tabButton);
            this.activeTab = null;
        } else {
            if (this.activeTab) {
                const tabsRoot = this._getTabsRoot();
                const prevTabButton = tabsRoot
                    ? tabsRoot.querySelector(`[data-tab="${this.activeTab}"]`)
                    : document.querySelector(`[data-tab="${this.activeTab}"]`);
                if (prevTabButton) {
                    this.deactivateTab(prevTabButton);
                }
            }

            this.activateTab(tabButton);
            this.activeTab = tabId;
        }

        this._persistPanelActiveTab();

        if (tabId && this.activeTab === tabId) {
            this._runTabActivatedSideEffects(tabId);
        }
    }

    /** Активировать вкладку: класс active на кнопке и панели data-tab-panel. */
    activateTab(tabButton) {
        const tabId = tabButton.dataset.tab;
        const tabsRoot = this._getTabsRoot();
        const scope = tabsRoot || document;

        scope.querySelectorAll('.sun-tabButton[data-tab]').forEach((btn) => {
            btn.classList.remove('sun-active');
        });

        scope.querySelectorAll('.sun-tabContent[data-tab-panel]').forEach((content) => {
            content.classList.remove('sun-active');
        });

        tabButton.classList.add('sun-active');

        const tabContent = scope.querySelector(`.sun-tabContent[data-tab-panel="${tabId}"]`);
        if (tabContent) {
            tabContent.classList.add('sun-active');
        }
    }

    /** Снять активность с вкладки. */
    deactivateTab(tabButton) {
        const tabId = tabButton.dataset.tab;
        const tabsRoot = this._getTabsRoot();
        const scope = tabsRoot || document;

        tabButton.classList.remove('sun-active');
        const tabContent = scope.querySelector(`.sun-tabContent[data-tab-panel="${tabId}"]`);
        if (tabContent) {
            tabContent.classList.remove('sun-active');
        }
    }

    /** Восстановить вкладку из appState.panelActiveTab; по умолчанию — «Полоса времени». */
    restoreTabState() {
        const tabsRoot = this._getTabsRoot();
        if (!tabsRoot) {
            return;
        }

        let tabId = window.appState?.panelActiveTab || 'timeBar';
        let tabButton = tabsRoot.querySelector(`[data-tab="${tabId}"]`);
        if (!tabButton) {
            tabId = 'timeBar';
            tabButton = tabsRoot.querySelector(`[data-tab="${tabId}"]`);
        }
        if (!tabButton) {
            return;
        }

        this.activateTab(tabButton);
        this.activeTab = tabId;
        this._runTabActivatedSideEffects(tabId);
    }

    /** Раскрыть/свернуть блок метаданных (спойлер). */
    toggleSpoiler(button) {
        const spoilerContent = button.nextElementSibling;
        const isVisible = spoilerContent.classList.contains('sun-show');

        if (isVisible) {
            spoilerContent.classList.remove('sun-show');
            button.textContent = 'Показать метаданные';
        } else {
            spoilerContent.classList.add('sun-show');
            button.textContent = 'Скрыть метаданные';
        }
    }

    /** Зарезервировано: вкладка импорта БД удалена. */
    scrollToDBImport() {}

    /**
     * Включить/выключить группу сигналов (group.enabled) и перерисовать график.
     * @param {string|number} groupId
     */
    toggleGroup(groupId) {
        const group = window.appState.data.groups.find((g) => g.id === groupId);
        if (group) {
            group.enabled = !group.enabled;
            window.appState.save();

            if (window.waves) {
                window.waves.updatePosition();
            }

            window.dataManager.updateWavesGroups();
        }
    }
}

window.uiManager = new UIManager();
