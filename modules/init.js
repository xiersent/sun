// modules/init.js - ИСПРАВЛЕННЫЙ (с импортом TimeBarManager)
class TimeBarManager {
    constructor() {
        this.container = null;
        this.timeScale = null;
        this.timeIndicator = null;
        this.timeLabels = null;
        this.indicatorLabel = null;
        this.updateInterval = null;
        this.isInitialized = false;
    }
    
    init() {
        if (this.isInitialized) return;
        
        console.log('TimeBarManager: инициализация временной полосы...');
        
        // Создаем структуру
        this.createTimeBar();
        
        // Создаем маркеры
        this.createHourMarkers();
        
        // Настраиваем обновление
        this.setupUpdates();
        
        // Обновляем индикатор сразу
        this.updateTimeIndicator();
        
        this.isInitialized = true;
        console.log('TimeBarManager: временная полоса инициализирована');
    }
    
    createTimeBar() {
        // Проверяем, не создана ли уже полоса
        if (document.getElementById('timeBarContainer')) {
            this.container = document.getElementById('timeBarContainer');
            this.timeScale = document.getElementById('timeScale');
            this.timeIndicator = document.getElementById('timeIndicator');
            this.timeLabels = document.getElementById('timeLabels');
            this.indicatorLabel = this.timeIndicator.querySelector('.time-indicator-label');
            return;
        }
        
        // Создаем HTML структуру
        const timeBarHTML = `
            <div class="time-bar">
                <div class="time-scale" id="timeScale"></div>
                <div class="time-indicator" id="timeIndicator">
                    <div class="time-indicator-label"></div>
                </div>
                <div class="time-labels" id="timeLabels"></div>
            </div>
        `;
        
        const container = document.createElement('div');
        container.id = 'timeBarContainer';
        container.className = 'time-bar-container';
        container.innerHTML = timeBarHTML;
        
        // Вставляем перед графиком
        const graphSection = document.querySelector('.graph-section');
        const graphContainer = document.querySelector('.graph-container');
        
        if (graphContainer && graphSection) {
            graphSection.insertBefore(container, graphContainer);
            
            this.container = container;
            this.timeScale = document.getElementById('timeScale');
            this.timeIndicator = document.getElementById('timeIndicator');
            this.timeLabels = document.getElementById('timeLabels');
            this.indicatorLabel = this.timeIndicator.querySelector('.time-indicator-label');
        }
    }
    
    createHourMarkers() {
        if (!this.timeScale) return;
        
        // Очищаем существующие маркеры
        this.timeScale.innerHTML = '';
        
        // Создаем 24 маркера (24 часа + дополнительный для полночи)
        for (let i = 0; i <= 24; i++) {
            const hour = i % 24;
            const marker = document.createElement('div');
            marker.className = 'hour-marker clickable';
            
            // Особый стиль для полночи
            if (hour === 0) {
                marker.classList.add('midnight');
            }
            
            // Добавляем метку
            const label = document.createElement('div');
            label.className = 'hour-label';
            label.textContent = hour === 0 ? '00:00' : `${hour}:00`;
            marker.appendChild(label);
            
            // Добавляем маркер половины часа (кроме первого и последнего)
            if (i < 24) {
                const halfMarker = document.createElement('div');
                halfMarker.className = 'half-hour-marker';
                halfMarker.style.left = '50%';
                marker.appendChild(halfMarker);
            }
            
            // Обработчик клика для навигации
            marker.addEventListener('click', () => {
                this.navigateToHour(hour);
            });
            
            this.timeScale.appendChild(marker);
        }
    }
    
    navigateToHour(hour) {
        console.log(`TimeBarManager: навигация к ${hour}:00`);
        
        if (window.dates && window.appState) {
            // Получаем текущую дату
            const currentDate = new Date(window.appState.currentDate);
            
            // Устанавливаем час
            currentDate.setHours(hour, 0, 0, 0);
            
            // Переходим к этому времени
            window.dates.setDate(currentDate, true);
            
            // Подсветка активного часа
            this.highlightActiveHour(hour);
        }
    }
    
    highlightActiveHour(hour) {
        // Снимаем подсветку со всех маркеров
        document.querySelectorAll('.hour-marker.active').forEach(marker => {
            marker.classList.remove('active');
        });
        
        // Добавляем подсветку к выбранному часу
        const markers = document.querySelectorAll('.hour-marker');
        if (markers[hour]) {
            markers[hour].classList.add('active');
        }
    }
    
    updateTimeIndicator() {
        if (!this.timeIndicator || !this.indicatorLabel) return;
        
        const now = new Date();
        const currentHour = now.getHours();
        const currentMinute = now.getMinutes();
        const currentSecond = now.getSeconds();
        
        // Процент прошедшего времени за сутки
        const secondsInDay = currentHour * 3600 + currentMinute * 60 + currentSecond;
        const percentOfDay = (secondsInDay / 86400) * 100;
        
        // Позиционируем индикатор
        this.timeIndicator.style.left = `${percentOfDay}%`;
        
        // Обновляем метку времени
        const timeString = `${currentHour.toString().padStart(2, '0')}:${currentMinute.toString().padStart(2, '0')}:${currentSecond.toString().padStart(2, '0')}`;
        this.indicatorLabel.textContent = timeString;
        this.timeIndicator.title = `Текущее время: ${timeString}`;
        
        // Подсвечиваем текущий час
        this.highlightActiveHour(currentHour);
    }
    
    updateTimeBarAppearance() {
        if (!this.container) return;
        
        const graphContainer = document.querySelector('.graph-container');
        
        if (graphContainer) {
            // Темный/светлый режим
            if (graphContainer.classList.contains('dark-mode')) {
                this.container.style.backgroundColor = '#000';
            } else {
                this.container.style.backgroundColor = '#fff';
            }
            
            // Графическая серая полоса
            if (graphContainer.classList.contains('graph-gray-mode')) {
                this.container.style.filter = 'grayscale(1)';
            } else {
                this.container.style.filter = 'none';
            }
        }
    }
    
    setupUpdates() {
        // Обновление индикатора каждую секунду
        this.updateInterval = setInterval(() => {
            this.updateTimeIndicator();
        }, 1000);
        
        // Синхронизация с переключениями режимов графика
        this.setupModeObservers();
        
        // Обработка изменения даты
        this.setupDateChangeObserver();
    }
    
    setupModeObservers() {
        // Наблюдаем за изменениями классов графика
        const graphContainer = document.querySelector('.graph-container');
        if (!graphContainer) return;
        
        const observer = new MutationObserver((mutations) => {
            mutations.forEach((mutation) => {
                if (mutation.type === 'attributes' && mutation.attributeName === 'class') {
                    this.updateTimeBarAppearance();
                }
            });
        });
        
        observer.observe(graphContainer, {
            attributes: true,
            attributeFilter: ['class']
        });
    }
    
    setupDateChangeObserver() {
        // Наблюдаем за изменениями currentDate
        if (window.appState && window.appState.currentDate) {
            const originalCurrentDate = window.appState.currentDate;
            Object.defineProperty(window.appState, 'currentDate', {
                get() {
                    return this._currentDate;
                },
                set(value) {
                    this._currentDate = value;
                    
                    // Обновляем временную полосу при смене даты
                    if (window.timeBarManager) {
                        setTimeout(() => {
                            window.timeBarManager.updateTimeIndicator();
                        }, 100);
                    }
                }
            });
            
            window.appState._currentDate = originalCurrentDate;
        }
    }
    
    destroy() {
        if (this.updateInterval) {
            clearInterval(this.updateInterval);
            this.updateInterval = null;
        }
        
        if (this.container && this.container.parentNode) {
            this.container.remove();
        }
        
        this.isInitialized = false;
        console.log('TimeBarManager: временная полоса уничтожена');
    }
}

// Глобальный экспорт
window.timeBarManager = new TimeBarManager();

// Основная функция инициализации приложения
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
            { name: 'eventManager', class: EventManager },
            { name: 'timeBarManager' } // Уже создан выше
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
        
        // 6. Инициализируем временную полосу
        if (window.timeBarManager && window.timeBarManager.init) {
            console.log('Инициализируем временную полосу...');
            window.timeBarManager.init();
        }
        
        // 7. Финальные проверки и гарантии
        await finalizeInitialization();
        
        console.log('=== ИНИЦИАЛИЗАЦИЯ ПРИЛОЖЕНИЯ УСПЕШНО ЗАВЕРШЕНА ===');
        
    } catch (error) {
        console.error('КРИТИЧЕСКАЯ ОШИБКА при инициализации:', error);
        alert(`Ошибка при инициализации приложения: ${error.message}\n\nПроверьте консоль для подробностей.`);
    }
});

// Функция финальной настройки
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
    
    console.log('=== ФИНАЛЬНАЯ НАСТРОЙКА ЗАВЕРШЕНА ===');
    console.log('activeDateId:', window.appState?.activeDateId);
    console.log('currentDay:', window.appState?.currentDay);
    console.log('currentDate:', window.appState?.currentDate?.toLocaleString());
}

// Экспортируем для использования
window.finalizeInitialization = finalizeInitialization;