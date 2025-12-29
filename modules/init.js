// modules/init.js
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
    
    // Запускаем миграцию данных если нужно
    if (window.TimestampMigrator) {
        console.log('Проверка формата данных перед инициализацией...');
        const migrationReport = window.TimestampMigrator.showMigrationReport();
        console.log('Результат проверки:', migrationReport.message);
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
            window.uiManager = new UIManager(); // Автоматически настраивает инпут
        }
        
        if (!window.dataManager && typeof DataManager !== 'undefined') {
            console.log('Создаем DataManager...');
            window.dataManager = new DataManager();
        }
        
        // 3. UnifiedListManager создаем ПОСЛЕ DataManager
        if (!window.unifiedListManager && typeof UnifiedListManager !== 'undefined') {
            console.log('Создаем UnifiedListManager...');
            window.unifiedListManager = new UnifiedListManager();
            
            console.log('Начинаем предварительную загрузку шаблонов...');
            window.unifiedListManager.initTemplates().catch(err => {
                console.error('Предварительная загрузка шаблонов не удалась:', err);
            });
        }
        
        if (!window.importExport && typeof ImportExportManager !== 'undefined') {
            console.log('Создаем ImportExportManager...');
            window.importExport = new ImportExportManager();
        }
        
        if (!window.intersectionManager && typeof IntersectionManager !== 'undefined') {
            console.log('Создаем IntersectionManager...');
            window.intersectionManager = new IntersectionManager();
        }
        
        if (!window.summaryManager && typeof SummaryManager !== 'undefined') {
            console.log('Создаем SummaryManager...');
            window.summaryManager = new SummaryManager();
        }
        
        // 4. EventManager создаем вручную
        if (!window.eventManager && typeof EventManager !== 'undefined') {
            console.log('Создаем EventManager...');
            window.eventManager = new EventManager();
        }
        
        // 5. TemplateReminder - напоминание про шаблоны
        if (!window.templateReminder && typeof TemplateReminder !== 'undefined') {
            console.log('Создаем TemplateReminder...');
            window.templateReminder = new TemplateReminder();
        }
        
        // 6. Немедленно запускаем асинхронную инициализацию приложения
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
    
    setTimeout(() => {
        console.log('=== ФИНАЛЬНАЯ ПРОВЕРКА ===');
        console.log('appState.activeDateId:', window.appState?.activeDateId);
        console.log('appState.currentDay:', window.appState?.currentDay);
        console.log('appState.baseDate:', window.appState?.baseDate);
        console.log('appState.currentDate:', window.appState?.currentDate);
        
        // Проверяем состояние шаблонов
        if (window.unifiedListManager) {
            console.log('Шаблоны загружены:', window.unifiedListManager.templatesLoaded);
            console.log('Количество загруженных шаблонов:', Object.keys(window.unifiedListManager.templateCache).length);
            
            // Проверяем каждый необходимый шаблон
            const requiredTemplates = ['date-item-template', 'wave-item-template', 'group-item-template'];
            requiredTemplates.forEach(templateId => {
                if (window.unifiedListManager.templateCache[templateId]) {
                    console.log(`✓ Шаблон ${templateId} загружен`);
                } else {
                    console.error(`✗ Шаблон ${templateId} НЕ ЗАГРУЖЕН!`);
                    console.error(`Убедитесь, что файл существует: templates/${templateId.replace('-template', '')}.ejs`);
                }
            });
        }
        
        const currentDayValue = window.appState?.currentDay;
        console.log('Тип currentDay:', typeof currentDayValue);
        console.log('Значение currentDay:', currentDayValue);
        
        if (currentDayValue === undefined || 
            currentDayValue === null || 
            typeof currentDayValue !== 'number' ||
            isNaN(currentDayValue)) {
            
            console.log('WARNING: currentDay некорректен, устанавливаем вручную');
            window.appState.currentDay = 0;
            
            if (window.dates && window.dates.updateCurrentDayElement) {
                window.dates.updateCurrentDayElement();
            }
            
            window.appState.save();
        } else {
            console.log('currentDay корректен:', currentDayValue);
        }
        
        const currentDayElement = document.getElementById('currentDay');
        if (currentDayElement) {
            console.log('DOM элемент currentDay найден, значение:', currentDayElement.textContent);
            
            // Обновляем значение в DOM
            currentDayElement.textContent = window.dom.formatCurrentDayWithSeconds(window.appState.currentDay);
            console.log('Обновили DOM элемент currentDay на:', currentDayElement.textContent);
        } else {
            console.error('DOM элемент currentDay не найден!');
        }
        
        // НОВОЕ: Устанавливаем значение в mainDateInput при загрузке
        const mainDateInput = document.getElementById('mainDateInput');
        if (mainDateInput && window.dom) {
            mainDateInput.value = window.dom.formatDateForDateTimeInputWithSeconds(window.appState.currentDate);
            console.log('Установлено значение в mainDateInput:', mainDateInput.value);
        }
        
        if (window.grid && window.grid.updateCenterDate) {
            window.grid.updateCenterDate();
            console.log('Финальное обновление центральной даты выполнено');
        }
        
        if (window.dates && window.dates.updateTodayButton) {
            window.dates.updateTodayButton();
        }
        
        // НОВОЕ: Обновляем сводную информацию
        if (window.summaryManager && window.summaryManager.updateSummary) {
            window.summaryManager.updateSummary();
            console.log('Сводная информация обновлена');
        }
        
        // НОВОЕ: Проверка на инлайн шаблоны
        console.log('🔍 Проверка на наличие инлайн шаблонов...');
        console.log('⚠️  НАПОМИНАНИЕ: Все шаблоны должны быть в папке templates/');
        console.log('⚠️  НАПОМИНАНИЕ: Никогда не создавайте инлайн шаблоны в коде!');
        
    }, 500);
    
    setTimeout(() => {
        console.log('=== ГАРАНТИРОВАННАЯ ИНИЦИАЛИЗАЦИЯ ===');
        
        // 1. Всегда пересчитываем currentDay
        if (window.dates && window.dates.recalculateCurrentDay) {
            console.log('Принудительный пересчет currentDay...');
            const result = window.dates.recalculateCurrentDay();
            console.log('Результат recalculateCurrentDay():', result);
        }
        
        // 2. Всегда устанавливаем активную дату (даже если она уже активна)
        if (window.appState && window.appState.activeDateId) {
            console.log('Устанавливаем активную дату:', window.appState.activeDateId);
            if (window.dates && window.dates.setActiveDate) {
                window.dates.setActiveDate(window.appState.activeDateId);
            }
        } else if (window.appState && window.appState.data.dates.length > 0) {
            console.log('Нет активной даты, выбираем первую из списка');
            const firstDateId = window.appState.data.dates[0].id;
            window.appState.activeDateId = firstDateId;
            if (window.dates && window.dates.setActiveDate) {
                window.dates.setActiveDate(firstDateId);
            }
        } else {
            console.log('Нет дат в списке, устанавливаем базовую');
            window.appState.baseDate = new Date().getTime();
            if (window.dates && window.dates.recalculateCurrentDay) {
                window.dates.recalculateCurrentDay();
            }
        }
        
        // 3. Гарантированное обновление UI
        if (window.dataManager) {
            if (window.dataManager.updateDateList) {
                window.dataManager.updateDateList();
            }
            if (window.dataManager.updateWavesGroups) {
                window.dataManager.updateWavesGroups();
            }
        }
        
        // 4. Обновление сводной информации
        if (window.summaryManager) {
            if (window.summaryManager.populateGroupSelect) {
                window.summaryManager.populateGroupSelect();
            }
            if (window.summaryManager.updateSummary) {
                window.summaryManager.updateSummary();
            }
        }
        
        // 5. Финишное обновление
        if (window.grid && window.grid.updateCenterDate) {
            window.grid.updateCenterDate();
        }
        
        if (window.dates && window.dates.updateTodayButton) {
            window.dates.updateTodayButton();
        }
        
        console.log('=== ИНИЦИАЛИЗАЦИЯ ЗАВЕРШЕНА ===');
        console.log('activeDateId:', window.appState?.activeDateId);
        console.log('currentDay:', window.appState?.currentDay);
        console.log('baseDate:', window.appState?.baseDate);
        console.log('currentDate:', window.appState?.currentDate);
        
        // НОВОЕ: Итоговая проверка шаблонов
        console.log('=== ПРОВЕРКА ШАБЛОНОВ ===');
        console.log('⚠️  ЗАПРЕЩЕНО создавать инлайн шаблоны в коде JavaScript!');
        console.log('✅ Все шаблоны должны быть в папке templates/');
    }, 1000);
});

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