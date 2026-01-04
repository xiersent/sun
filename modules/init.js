// modules/init.js - ПОЛНАЯ ВЕРСИЯ
document.addEventListener('DOMContentLoaded', async () => {
    console.log('=== НАЧАЛО ИНИЦИАЛИЗАЦИИ ПРИЛОЖЕНИЯ ===');
    
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
    
    // Проверка формата данных
    if (window.TimestampMigrator) {
        console.log('Проверка формата данных перед инициализацией...');
        const migrationReport = window.TimestampMigrator.showMigrationReport();
        console.log('Результат проверки:', migrationReport.message);
    }
    
    try {
        // 1. Загружаем состояние
        window.appState.load();
        console.log('AppState загружен');
        
        // 2. Создаем утилиты
        window.timeUtils = window.timeUtils || new TimeUtils();
        window.dom = window.dom || new DOM();
        
        // 3. Создаем менеджеры в правильном порядке
        const managers = [
            { name: 'dates', class: DatesManager },
            { name: 'appCore', class: AppCore },
            { name: 'waves', class: WavesManager },
            { name: 'grid', class: GridManager },
            { name: 'uiManager', class: UIManager },
            { name: 'dataManager', class: DataManager },
            { name: 'unifiedListManager', class: UnifiedListManager },
            { name: 'importExport', class: ImportExportManager },
            { name: 'intersectionManager', class: WaveIntersectionManager },
            { name: 'summaryManager', class: SummaryManager },
            { name: 'eventManager', class: EventManager }
        ];
        
        for (const manager of managers) {
            if (!window[manager.name] && manager.class) {
                console.log(`Создаем ${manager.name}...`);
                window[manager.name] = new manager.class();
            }
        }
        
        // 4. Предварительная загрузка шаблонов
        if (window.unifiedListManager && window.unifiedListManager.initTemplates) {
            console.log('Начинаем предварительную загрузку шаблонов...');
            window.unifiedListManager.initTemplates().catch(err => {
                console.error('Предварительная загрузка шаблонов не удалась:', err);
            });
        }
        
        // 5. Инициализируем AppCore
        if (window.appCore && window.appCore.init) {
            console.log('Запускаем AppCore.init()...');
            await window.appCore.init();
        } else {
            console.error('AppCore не инициализирован!');
        }
        
        // 6. Финальные проверки и гарантии
        await this.finalizeInitialization();
        
        console.log('=== ИНИЦИАЛИЗАЦИЯ ПРИЛОЖЕНИЯ УСПЕШНО ЗАВЕРШЕНА ===');
        
    } catch (error) {
        console.error('КРИТИЧЕСКАЯ ОШИБКА при инициализации:', error);
        alert(`Ошибка при инициализации приложения: ${error.message}\n\nПроверьте консоль для подробностей.`);
    }
});

// Финальная настройка после инициализации
async function finalizeInitialization() {
    console.log('=== ФИНАЛЬНАЯ НАСТРОЙКА ===');
    
    // 1. Гарантируем сброс состояний редактирования
    console.log('Гарантия сброса состояний редактирования...');
    if (window.appState) {
        window.appState.editingDateId = null;
        window.appState.editingWaveId = null;
        window.appState.editingGroupId = null;
        console.log('Состояния редактирования сброшены');
    }
    
    // 2. Устанавливаем дату
    console.log('Установка начальной даты...');
    const now = new Date();
    const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
    
    if (!window.appState.currentDate || window.appState.currentDate instanceof Date === false) {
        window.appState.currentDate = startOfDay;
    }
    
    // 3. Если есть активная дата - устанавливаем её
    if (window.appState.activeDateId) {
        console.log('Устанавливаем активную дату:', window.appState.activeDateId);
        if (window.dates && window.dates.setActiveDate) {
            window.dates.setActiveDate(window.appState.activeDateId, true);
        }
    } else if (window.appState.data.dates.length > 0) {
        console.log('Нет активной даты, выбираем первую из списка');
        const firstDateId = window.appState.data.dates[0].id;
        window.appState.activeDateId = firstDateId;
        if (window.dates && window.dates.setActiveDate) {
            window.dates.setActiveDate(firstDateId, true);
        }
    } else {
        console.log('Нет дат в списке, устанавливаем базовую дату');
        window.appState.baseDate = startOfDay.getTime();
        if (window.dates && window.dates.recalculateCurrentDay) {
            window.dates.recalculateCurrentDay(true);
        }
    }
    
    // 4. Обновляем UI
    console.log('Обновление UI...');
    if (window.dataManager) {
        await window.dataManager.updateDateList();
        await window.dataManager.updateWavesGroups();
        if (window.dataManager.updateNotesList) {
            window.dataManager.updateNotesList();
        }
    }
    
    // 5. Обновляем график
    console.log('Обновление графика...');
    if (window.grid) {
        if (window.grid.updateCenterDate) {
            window.grid.updateCenterDate();
        }
        if (window.grid.updateGridNotesHighlight) {
            window.grid.updateGridNotesHighlight();
        }
    }
    
    // 6. Обновляем сводную информацию
    console.log('Обновление сводной информации...');
    if (window.summaryManager) {
        if (window.summaryManager.populateGroupSelect) {
            window.summaryManager.populateGroupSelect();
        }
        if (window.summaryManager.updateSummary) {
            window.summaryManager.updateSummary();
        }
    }
    
    // 7. Обновляем поля даты/времени
    console.log('Обновление полей ввода...');
    const mainDateInputDate = document.getElementById('mainDateInputDate');
    const mainDateInputTime = document.getElementById('mainDateInputTime');
    
    if (mainDateInputDate && mainDateInputTime && window.timeUtils) {
        const formatted = window.timeUtils.formatForDateTimeInputs(window.appState.currentDate);
        mainDateInputDate.value = formatted.date;
        mainDateInputTime.value = formatted.time;
        console.log('Установлены значения в поля:', formatted.date, formatted.time);
    }
    
    // 8. Обновляем кнопку "Сегодня"
    if (window.dates && window.dates.updateTodayButton) {
        window.dates.updateTodayButton();
    }
    
    // 9. Восстанавливаем состояние табов
    if (window.uiManager && window.uiManager.restoreTabState) {
        window.uiManager.restoreTabState();
        console.log('Состояние табов восстановлено');
    }
    
    // 10. Проверка шаблонов
    console.log('=== ПРОВЕРКА ШАБЛОНОВ ===');
    console.log('⚠️ ЗАПРЕЩЕНО создавать инлайн шаблоны в коде!');
    console.log('✅ Все шаблоны должны быть в папке templates/');
    
    if (window.unifiedListManager) {
        console.log('Шаблоны загружены:', window.unifiedListManager.templatesLoaded);
        const requiredTemplates = ['date-item-template', 'wave-item-template', 'group-item-template'];
        requiredTemplates.forEach(templateId => {
            if (window.unifiedListManager.templateCache[templateId]) {
                console.log(`✓ Шаблон ${templateId} загружен`);
            } else {
                console.error(`✗ Шаблон ${templateId} НЕ ЗАГРУЖЕН!`);
            }
        });
    }
    
    console.log('=== ФИНАЛЬНАЯ НАСТРОЙКА ЗАВЕРШЕНА ===');
    console.log('activeDateId:', window.appState?.activeDateId);
    console.log('currentDay:', window.appState?.currentDay);
    console.log('currentDate:', window.appState?.currentDate?.toLocaleString());
}

// Экспортируем для использования
window.finalizeInitialization = finalizeInitialization;