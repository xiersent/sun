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
    
    if (window.TimestampMigrator) {
        console.log('Проверка формата данных перед инициализацией...');
        const migrationReport = window.TimestampMigrator.showMigrationReport();
        console.log('Результат проверки:', migrationReport.message);
    }
    
    try {
        window.appState.load();
        
        console.log('AppState загружен, инициализация модулей...');
        
        if (!window.dates && typeof DatesManager !== 'undefined') {
            console.log('Создаем DatesManager...');
            window.dates = new DatesManager();
        } else if (!window.dates) {
            console.error('DatesManager не определен!');
        }
        
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
        
        if (!window.eventManager && typeof EventManager !== 'undefined') {
            console.log('Создаем EventManager...');
            window.eventManager = new EventManager();
        }

        if (!window.intersectionManager && typeof WaveIntersectionManager !== 'undefined') {
            console.log('Создаем WaveIntersectionManager...');
            window.intersectionManager = new WaveIntersectionManager();
        }
        
        if (!window.templateReminder && typeof TemplateReminder !== 'undefined') {
            console.log('Создаем TemplateReminder...');
            window.templateReminder = new TemplateReminder();
        }
        
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
        
        if (window.unifiedListManager) {
            console.log('Шаблоны загружены:', window.unifiedListManager.templatesLoaded);
            console.log('Количество загруженных шаблонов:', Object.keys(window.unifiedListManager.templateCache).length);
            
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
            
            currentDayElement.textContent = window.dom.formatCurrentDayWithSeconds(window.appState.currentDay);
            console.log('Обновили DOM элемент currentDay на:', currentDayElement.textContent);
        } else {
            console.error('DOM элемент currentDay не найден!');
        }
        
        const mainDateInput = document.getElementById('mainDateInput');
        if (mainDateInput && window.dom) {
            mainDateInput.value = window.dom.formatDateForDateTimeInputWithSeconds(window.appState.currentDate);
            console.log('Установлено значение в mainDateInput:', mainDateInput.value);
        }
        
        // Проверяем наличие контейнера для выносок
        const labelsContainer = document.querySelector('.wave-labels-container');
        if (!labelsContainer) {
            console.warn('Контейнер для выносок не найден, создаем вручную');
            const container = document.createElement('div');
            container.className = 'wave-labels-container';
            container.id = 'waveLabelsContainer';
            container.innerHTML = `
                <div class="wave-labels-side wave-labels-left"></div>
                <div class="wave-labels-side wave-labels-right"></div>
            `;
            
            const graphElement = document.getElementById('graphElement');
            if (graphElement) {
                graphElement.appendChild(container);
                console.log('Контейнер для выносок создан');
            }
        }
        
        if (window.grid && window.grid.updateCenterDate) {
            window.grid.updateCenterDate();
            console.log('Финальное обновление центральной даты выполнено');
        }
        
        if (window.dates && window.dates.updateTodayButton) {
            window.dates.updateTodayButton();
        }
        
        if (window.summaryManager && window.summaryManager.updateSummary) {
            window.summaryManager.updateSummary();
            console.log('Сводная информация обновлена');
        }
        
        console.log('🔍 Проверка на наличие инлайн шаблонов...');
        console.log('⚠️  НАПОМИНАНИЕ: Все шаблоны должны быть в папке templates/');
        console.log('⚠️  НАПОМИНАНИЕ: Никогда не создавайте инлайн шаблоны в коде!');
        
    }, 500);
    
    setTimeout(() => {
        console.log('=== ГАРАНТИРОВАННАЯ ИНИЦИАЛИЗАЦИЯ ===');
        
        // ИЗМЕНЕНО: Устанавливаем текущее точное время при инициализации
        const now = new Date();
		const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
		window.appState.currentDate = startOfDay; // Начало дня
        
		if (window.dates && window.dates.recalculateCurrentDay) {
			console.log('Принудительный пересчет currentDay (начало дня)...');
			const result = window.dates.recalculateCurrentDay(false); // ИСПРАВЛЕНО: false для целых дней
			console.log('Результат recalculateCurrentDay(false):', result);
		}
        
        if (window.appState && window.appState.activeDateId) {
            console.log('Устанавливаем активную дату с точным временем:', window.appState.activeDateId);
            if (window.dates && window.dates.setActiveDate) {
                window.dates.setActiveDate(window.appState.activeDateId, true); // ИСПРАВЛЕНО: true для точного времени
            }
        } else if (window.appState && window.appState.data.dates.length > 0) {
            console.log('Нет активной даты, выбираем первую из списка с точным временем');
            const firstDateId = window.appState.data.dates[0].id;
            window.appState.activeDateId = firstDateId;
            if (window.dates && window.dates.setActiveDate) {
                window.dates.setActiveDate(firstDateId, true); // ИСПРАВЛЕНО: true для точного времени
            }
        } else {
            console.log('Нет дат в списке, устанавливаем базовую дату с точным временем');
            window.appState.baseDate = new Date().getTime();
            if (window.dates && window.dates.recalculateCurrentDay) {
                window.dates.recalculateCurrentDay(true); // ИСПРАВЛЕНО: true для точного времени
            }
        }
        
        if (window.dataManager) {
            if (window.dataManager.updateDateList) {
                window.dataManager.updateDateList();
            }
            if (window.dataManager.updateWavesGroups) {
                window.dataManager.updateWavesGroups();
            }
        }
        
        if (window.summaryManager) {
            if (window.summaryManager.populateGroupSelect) {
                window.summaryManager.populateGroupSelect();
            }
            if (window.summaryManager.updateSummary) {
                window.summaryManager.updateSummary();
            }
        }
        
        if (window.grid && window.grid.updateCenterDate) {
            window.grid.updateCenterDate();
        }
        
        if (window.dates && window.dates.updateTodayButton) {
            window.dates.updateTodayButton();
        }
        
        // ВОССТАНОВЛЕНИЕ СОСТОЯНИЯ ТАБОВ - ВАЖНО!
        if (window.uiManager && window.uiManager.restoreTabState) {
            window.uiManager.restoreTabState();
            console.log('Состояние табов восстановлено');
        }

		const mainDateInputDate = document.getElementById('mainDateInputDate');
		const mainDateInputTime = document.getElementById('mainDateInputTime');
		
		if (mainDateInputDate && mainDateInputTime && window.timeUtils) {
			const formatted = window.timeUtils.formatForDateTimeInputs(window.appState.currentDate);
			mainDateInputDate.value = formatted.date;
			mainDateInputTime.value = formatted.time;
			console.log('Установлены значения в поля даты и времени:', formatted.date, formatted.time);
		}
        
        console.log('=== ИНИЦИАЛИЗАЦИЯ ЗАВЕРШЕНА ===');
        console.log('activeDateId:', window.appState?.activeDateId);
        console.log('currentDay:', window.appState?.currentDay);
        console.log('baseDate:', window.appState?.baseDate);
        console.log('currentDate:', window.appState?.currentDate);
        console.log('Текущее точное время установлено:', now.toLocaleTimeString());
        
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