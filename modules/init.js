// optimized3/modules/init.js
document.addEventListener('DOMContentLoaded', async () => {
    const graphElement = document.getElementById('graphElement');
    if (!graphElement) {
        console.error('graphElement не найден в DOM');
        return;
    }
    
    if (!window.appState) {
        console.error('appState не загружен');
        alert('Ошибка: appState не загружен. Проверьте загрузку state.js');
        return;
    }
    
    try {
        window.appState.load();
        
        if (window.appState.showStars) {
            document.body.classList.add('stars-mode');
            document.body.classList.remove('names-mode');
        } else {
            document.body.classList.remove('stars-mode');
            document.body.classList.add('names-mode');
        }
        
        // Инициализируем основные модули
        if (!window.appCore) window.appCore = new AppCore();
        if (!window.dates) window.dates = new DatesManager();
        if (!window.waves) window.waves = new WavesManager();
        if (!window.grid) window.grid = new GridManager();
        if (!window.uiManager) window.uiManager = new UIManager();
        if (!window.dataManager) window.dataManager = new DataManager();
        if (!window.unifiedListManager) window.unifiedListManager = new UnifiedListManager();
        if (!window.importExport) window.importExport = new ImportExportManager();
        if (!window.intersectionManager) window.intersectionManager = new IntersectionManager();
        
        // EventManager создаем вручную
        if (!window.eventManager && typeof EventManager !== 'undefined') {
            window.eventManager = new EventManager();
        }
        
        // Даем время на загрузку всех модулей
        setTimeout(() => {
            if (window.appCore && window.appCore.init) {
                window.appCore.init();
            }
        }, 150);
        
    } catch (error) {
        console.error('ОШИБКА при инициализации:', error);
        alert(`Ошибка при инициализации приложения: ${error.message}\n\nПроверьте консоль для подробностей.`);
    }
});

// Глобальные функции для onclick обработчиков
if (!window.app) {
    window.app = {
        toggleSpoiler: function(button) {
            if (window.uiManager && window.uiManager.toggleSpoiler) {
                window.uiManager.toggleSpoiler(button);
            }
        },
        addIntersectionWave: function(period, amplitude) {
            if (window.intersectionManager && window.intersectionManager.addIntersectionWave) {
                window.intersectionManager.addIntersectionWave(period, amplitude);
            }
        },
        scrollToDBImport: function() {
            if (window.uiManager && window.uiManager.scrollToDBImport) {
                window.uiManager.scrollToDBImport();
            }
        }
    };
}