// modules/timeBarManager.js
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
        
        this.createTimeBar();
        this.createHourMarkers();
        this.setupUpdates();
        this.updateTimeIndicator();
        
        this.isInitialized = true;
    }
    

	createTimeBar() {
		if (document.getElementById('timeBarContainer')) {
			this.container = document.getElementById('timeBarContainer');
			this.timeScale = document.getElementById('timeScale');
			this.timeIndicator = document.getElementById('timeIndicator');
			this.timeLabels = document.getElementById('timeLabels');
			this.indicatorLabel = this.timeIndicator.querySelector('.time-indicator-label');
			return;
		}
		
		// Убираем .time-indicator элемент, оставляем только .time-indicator-label
		const timeBarHTML = `
			<div class="time-bar">
				<div class="time-scale" id="timeScale"></div>
				<div class="time-labels" id="timeLabels"></div>
			</div>
		`;
		
		const container = document.createElement('div');
		container.id = 'timeBarContainer';
		container.className = 'time-bar-container';
		container.innerHTML = timeBarHTML;
		
		const graphSection = document.querySelector('.graph-section');
		const graphContainer = document.querySelector('.graph-container');
		
		if (graphContainer && graphSection) {
			graphSection.insertBefore(container, graphContainer);
			
			this.container = container;
			this.timeScale = document.getElementById('timeScale');
			this.timeLabels = document.getElementById('timeLabels');
			
			// Создаем индикатор отдельно
			this.timeIndicator = document.createElement('div');
			this.timeIndicator.className = 'time-indicator';
			this.timeIndicator.style.position = 'absolute';
			this.timeIndicator.style.top = '0';
			this.timeIndicator.style.width = '0'; // Нет ширины
			this.timeIndicator.style.height = '100%';
			this.timeIndicator.style.zIndex = '10';
			this.timeIndicator.style.pointerEvents = 'none';
			
			this.indicatorLabel = document.createElement('div');
			this.indicatorLabel.className = 'time-indicator-label';
			this.timeIndicator.appendChild(this.indicatorLabel);
			
			this.timeScale.appendChild(this.timeIndicator);
		}
	}
    
    createHourMarkers() {
        if (!this.timeScale) return;
        
        this.timeScale.innerHTML = '';
        
        for (let i = 0; i <= 24; i++) {
            const hour = i % 24;
            const marker = document.createElement('div');
            marker.className = 'hour-marker clickable';
            
            if (hour === 0) {
                marker.classList.add('midnight');
            }
            
            const label = document.createElement('div');
            label.className = 'hour-label';
            label.textContent = hour === 0 ? '00:00' : `${hour}:00`;
            marker.appendChild(label);
            
            if (i < 24) {
                const halfMarker = document.createElement('div');
                halfMarker.className = 'half-hour-marker';
                halfMarker.style.left = '50%';
                marker.appendChild(halfMarker);
            }
            
            marker.addEventListener('click', () => {
                this.navigateToHour(hour);
            });
            
            this.timeScale.appendChild(marker);
        }
    }
    
    navigateToHour(hour) {
        if (window.dates && window.appState) {
            const currentDate = new Date(window.appState.currentDate);
            currentDate.setHours(hour, 0, 0, 0);
            window.dates.setDate(currentDate, true);
            this.highlightActiveHour(hour);
        }
    }
    
    highlightActiveHour(hour) {
        document.querySelectorAll('.hour-marker.active').forEach(marker => {
            marker.classList.remove('active');
        });
        
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
		
		const secondsInDay = currentHour * 3600 + currentMinute * 60 + currentSecond;
		const percentOfDay = (secondsInDay / 86400) * 100;
		
		// Позиционируем только метку, без полоски
		this.timeIndicator.style.left = `${percentOfDay}%`;
		
		const timeString = `${currentHour.toString().padStart(2, '0')}:${currentMinute.toString().padStart(2, '0')}:${currentSecond.toString().padStart(2, '0')}`;
		this.indicatorLabel.textContent = timeString;
		this.timeIndicator.title = `Текущее время: ${timeString}`;
		
		this.highlightActiveHour(currentHour);
	}
    
    updateTimeBarAppearance() {
        if (!this.container) return;
        
        const graphContainer = document.querySelector('.graph-container');
        
        if (graphContainer) {
            if (graphContainer.classList.contains('dark-mode')) {
                this.container.style.backgroundColor = '#000';
            } else {
                this.container.style.backgroundColor = '#fff';
            }
            
            if (graphContainer.classList.contains('graph-gray-mode')) {
                this.container.style.filter = 'grayscale(1)';
            } else {
                this.container.style.filter = 'none';
            }
        }
    }
    
    setupUpdates() {
        this.updateInterval = setInterval(() => {
            this.updateTimeIndicator();
        }, 1000);
        
        this.setupModeObservers();
        this.setupDateChangeObserver();
    }
    
    setupModeObservers() {
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
        if (window.appState && window.appState.currentDate) {
            const originalCurrentDate = window.appState.currentDate;
            Object.defineProperty(window.appState, 'currentDate', {
                get() {
                    return this._currentDate;
                },
                set(value) {
                    this._currentDate = value;
                    
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
    }
}

window.timeBarManager = new TimeBarManager();