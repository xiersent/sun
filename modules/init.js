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
        
        // Даем время на загрузку всех модулей
        setTimeout(() => {
            // Проверяем, что все необходимые модули загружены
            if (!window.appCore) {
                console.error('appCore не загружен, создаем...');
                window.appCore = new AppCore();
            }
            
            if (!window.waves) {
                console.error('waves не загружен, создаем...');
                if (typeof WavesManager !== 'undefined') {
                    window.waves = new WavesManager();
                } else {
                    console.error('WavesManager класс не определен!');
                    return;
                }
            }
            
            if (!window.dates) {
                console.error('dates не загружен, создаем...');
                if (typeof DatesManager !== 'undefined') {
                    window.dates = new DatesManager();
                } else {
                    console.error('DatesManager класс не определен!');
                    return;
                }
            }
            
            if (!window.grid) {
                console.error('grid не загружен, создаем...');
                if (typeof GridManager !== 'undefined') {
                    window.grid = new GridManager();
                } else {
                    console.error('GridManager класс не определен!');
                    return;
                }
            }
            
            if (!window.uiManager) {
                console.error('uiManager не загружен, создаем...');
                if (typeof UIManager !== 'undefined') {
                    window.uiManager = new UIManager();
                } else {
                    console.error('UIManager класс не определен!');
                    return;
                }
            }
            
            if (!window.dataManager) {
                console.error('dataManager не загружен, создаем...');
                if (typeof DataManager !== 'undefined') {
                    window.dataManager = new DataManager();
                } else {
                    console.error('DataManager класс не определен!');
                    return;
                }
            }
            
            if (!window.unifiedListManager) {
                console.error('unifiedListManager не загружен, создаем...');
                if (typeof UnifiedListManager !== 'undefined') {
                    window.unifiedListManager = new UnifiedListManager();
                } else {
                    console.error('UnifiedListManager класс не определен!');
                    return;
                }
            }
            
            if (!window.importExport) {
                console.error('importExport не загружен, создаем...');
                if (typeof ImportExportManager !== 'undefined') {
                    window.importExport = new ImportExportManager();
                } else {
                    console.error('ImportExportManager класс не определен!');
                    return;
                }
            }
            
            // Создаем EventManager вручную если он не создан
            if (!window.eventManager) {
                console.log('Создаем EventManager...');
                if (typeof EventManager !== 'undefined') {
                    window.eventManager = new EventManager();
                } else {
                    console.error('EventManager класс не определен!');
                }
            }
            
            if (!window.intersectionManager) {
                console.log('Создаем IntersectionManager...');
                if (typeof IntersectionManager !== 'undefined') {
                    window.intersectionManager = new IntersectionManager();
                } else {
                    console.error('IntersectionManager класс не определен!');
                }
            }
            
            // Инициализируем appCore
            if (window.appCore && window.appCore.init) {
                window.appCore.init();
            } else {
                console.error('appCore.init не доступен');
            }
            
        }, 150); // Увеличиваем задержку для загрузки всех модулей
        
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