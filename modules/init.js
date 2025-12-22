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
        
        console.log('AppState загружен, инициализация модулей...');
        
        // ВАЖНОЕ ИСПРАВЛЕНИЕ: Инициализируем модули в правильном порядке
        // 1. Сначала DatesManager (он нужен для расчета currentDay)
        if (!window.dates && typeof DatesManager !== 'undefined') {
            console.log('Создаем DatesManager...');
            window.dates = new DatesManager();
        } else if (!window.dates) {
            console.error('DatesManager не определен!');
        }
        
        // 2. Потом другие модули
        if (!window.appCore && typeof AppCore !== 'undefined') {
            console.log('Создаем AppCore...');
            window.appCore = new AppCore();
        }
        
        if (!window.waves && typeof WavesManager !== 'undefined') {
            console.log('Создаем WavesManager...');
            window.waves = new WavesManager();
        }
        
        if (!window.grid && typeof GridManager !== 'undefined') {
            console.log('Создаем GridManager...');
            window.grid = new GridManager();
        }
        
        if (!window.uiManager && typeof UIManager !== 'undefined') {
            console.log('Создаем UIManager...');
            window.uiManager = new UIManager();
        }
        
        if (!window.dataManager && typeof DataManager !== 'undefined') {
            console.log('Создаем DataManager...');
            window.dataManager = new DataManager();
        }
        
        if (!window.unifiedListManager && typeof UnifiedListManager !== 'undefined') {
            console.log('Создаем UnifiedListManager...');
            window.unifiedListManager = new UnifiedListManager();
        }
        
        if (!window.importExport && typeof ImportExportManager !== 'undefined') {
            console.log('Создаем ImportExportManager...');
            window.importExport = new ImportExportManager();
        }
        
        if (!window.intersectionManager && typeof IntersectionManager !== 'undefined') {
            console.log('Создаем IntersectionManager...');
            window.intersectionManager = new IntersectionManager();
        }
        
        // 3. EventManager создаем вручную
        if (!window.eventManager && typeof EventManager !== 'undefined') {
            console.log('Создаем EventManager...');
            window.eventManager = new EventManager();
        }
        
        // 4. Немедленно запускаем инициализацию приложения
        if (window.appCore && window.appCore.init) {
            console.log('Запускаем AppCore.init()...');
            window.appCore.init();
        } else {
            console.error('AppCore не инициализирован!');
        }
        
    } catch (error) {
        console.error('ОШИБКА при инициализации:', error);
        alert(`Ошибка при инициализации приложения: ${error.message}\n\nПроверьте консоль для подробностей.`);
    }
    
    // ГАРАНТИЯ: Финальная проверка через 500мс
    setTimeout(() => {
        console.log('=== ФИНАЛЬНАЯ ПРОВЕРКА ===');
        console.log('appState.activeDateId:', window.appState?.activeDateId);
        console.log('appState.currentDay:', window.appState?.currentDay);
        console.log('appState.baseDate:', window.appState?.baseDate);
        console.log('appState.currentDate:', window.appState?.currentDate);
        
        // Если currentDay не установлен, устанавливаем вручную
        if (window.appState && (window.appState.currentDay === undefined || 
            window.appState.currentDay === null || 
            isNaN(window.appState.currentDay))) {
            
            console.log('WARNING: currentDay не установлен, устанавливаем вручную');
            window.appState.currentDay = 0;
            
            if (window.dates && window.dates.updateCurrentDayElement) {
                window.dates.updateCurrentDayElement();
            }
            
            window.appState.save();
        }
        
        // Проверяем элемент currentDay в DOM
        const currentDayElement = document.getElementById('currentDay');
        if (currentDayElement) {
            console.log('DOM элемент currentDay найден, значение:', currentDayElement.textContent);
            
            // Если в DOM 0, а в appState есть значение, обновляем DOM
            if (currentDayElement.textContent === '0' && 
                window.appState && 
                window.appState.currentDay !== 0) {
                
                currentDayElement.textContent = window.appState.currentDay;
                console.log('Обновили DOM элемент currentDay на:', window.appState.currentDay);
            }
        } else {
            console.error('DOM элемент currentDay не найден!');
        }
        
        // Принудительно вызываем forceUpdateCurrentDay если currentDay все еще 0
        if (window.appState && window.appState.currentDay === 0) {
            console.log('currentDay все еще 0, вызываем forceUpdateCurrentDay...');
            if (window.forceUpdateCurrentDay) {
                setTimeout(() => {
                    window.forceUpdateCurrentDay();
                }, 200);
            }
        }
    }, 500);
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