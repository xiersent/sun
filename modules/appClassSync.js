/**
 * Синхронизация плоских layout-классов вместо селекторов .sun-app .sun-child.
 */
(function () {
    const GRAY_FILTER_SELECTOR =
        '.sun-interfaceContainer, .sun-graphSection, .sun-timeBarWrap, .sun-warningOverlay';
    const GRAPH_GRAY_SELECTOR =
        '.sun-graphContainer, .sun-waveLabelsContainer, .sun-waveLabelsVerticalContainer, .sun-timeBarContainer';
    const UI_HIDE_SELECTOR = '.sun-interfaceContainer, .sun-graphSection';
    const MOBILE_HIDE_SELECTOR = '.sun-interfaceContainer, .sun-graphSection';

    function forEach(sel, fn) {
        document.querySelectorAll(sel).forEach(fn);
    }

    function applyDateLabelMode(showStars) {
        const showNames = !showStars;
        forEach('.sun-dateName, .sun-centerDateName', (el) => {
            el.classList.toggle('sun-dateLabelVisible', showNames);
        });
        forEach('.sun-dateStar, .sun-centerDateStar', (el) => {
            el.classList.toggle('sun-dateLabelVisible', showStars);
        });
    }

    function applyUiHidden(hidden) {
        forEach(UI_HIDE_SELECTOR, (el) => {
            el.classList.toggle('sun-layoutHidden', hidden);
        });
        forEach('.sun-cornerSquare', (el) => {
            el.classList.toggle('sun-layoutVisibleWhenUiHidden', hidden);
        });
    }

    function applyGraphHidden(hidden) {
        forEach('.sun-graphSection', (el) => {
            el.classList.toggle('sun-layoutHidden', hidden);
        });
    }

    function applyGrayMode(enabled) {
        forEach(GRAY_FILTER_SELECTOR, (el) => {
            el.classList.toggle('sun-grayFiltered', enabled);
        });
    }

    function applyGraphGrayMode(enabled) {
        forEach(GRAPH_GRAY_SELECTOR, (el) => {
            el.classList.toggle('sun-graphGrayMode', enabled);
        });
        forEach('.sun-waveLabel, .sun-extremumLabel, .sun-waveAxisXPoint', (el) => {
            el.classList.toggle('sun-graphGrayElement', enabled);
        });
    }

    function applyMobileDevice(enabled) {
        document.body.classList.toggle('sun-mobileDeviceRoot', enabled);
        forEach(MOBILE_HIDE_SELECTOR, (el) => {
            el.classList.toggle('sun-layoutHidden', enabled);
        });
        forEach('.sun-cornerSquare', (el) => {
            el.classList.toggle('sun-layoutVisibleWhenUiHidden', enabled);
        });
        const warningOverlay = document.querySelector('.sun-warningOverlay');
        if (warningOverlay) {
            warningOverlay.classList.toggle('sun-layoutMobileWarning', enabled);
        }
    }

    function ensureTopControlsItems() {
        document.querySelectorAll('.sun-topControls').forEach((el) => {
            Array.from(el.children).forEach((child) => {
                child.classList.add('sun-topControlsItem');
            });
        });
    }

    function syncFromAppState() {
        const s = window.appState;
        if (!s) return;
        ensureTopControlsItems();
        applyDateLabelMode(s.showStars !== false);
        applyUiHidden(!!s.uiHidden);
        applyGraphHidden(!!s.graphHidden);
        applyGrayMode(!!s.grayMode);
        applyGraphGrayMode(!!s.graphGrayMode);
    }

    window.appClassSync = {
        applyDateLabelMode,
        applyUiHidden,
        applyGraphHidden,
        applyGrayMode,
        applyGraphGrayMode,
        applyMobileDevice,
        syncFromAppState
    };
})();
