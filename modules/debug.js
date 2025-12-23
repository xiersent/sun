// optimized3/modules/debug.js
class WavesDebugger {
    constructor() {
        this.debugInfo = {};
    }
    
    logWaveInfo(wave) {
        if (!window.waves) return;
        
        const periodPx = wave.period * window.appState.config.squareSize;
        const totalPeriods = window.waves.calculateRequiredPeriods(periodPx);
        const containerWidth = periodPx * totalPeriods;
        
        console.group(`🔍 Отладка волны: ${wave.name} (${wave.period} дней)`);
        console.log(`📏 Период в пикселях: ${periodPx}px`);
        console.log(`📈 Необходимо периодов: ${totalPeriods}`);
        console.log(`📐 Ширина контейнера: ${containerWidth}px`);
        console.log(`🎯 Видимая ширина (визор): ${window.appState.graphWidth}px`);
        console.log(`⚙️  Минимально периодов: ${window.appState.config.minVisiblePeriods}`);
        
        // Проверяем, достаточно ли периодов
        const visiblePeriods = window.appState.graphWidth / periodPx;
        console.log(`👁️  Периодов в видимой области: ${visiblePeriods.toFixed(2)}`);
        
        if (visiblePeriods < 3) {
            console.warn(`⚠️  Внимание: видно менее 3 периодов! Нужно ${totalPeriods}`);
        }
        
        console.groupEnd();
        
        // Сохраняем для визуальной отладки
        this.debugInfo[wave.id] = {
            period: wave.period,
            periodPx,
            totalPeriods,
            containerWidth,
            visiblePeriods
        };
    }
    
    showAllWavesInfo() {
        console.group('📊 Информация о всех волнах');
        
        window.appState.data.waves.forEach(wave => {
            const waveIdStr = String(wave.id);
            const isWaveVisible = window.appState.waveVisibility[waveIdStr] !== false;
            const isGroupEnabled = window.waves.isWaveGroupEnabled(wave.id);
            
            if (isWaveVisible && isGroupEnabled) {
                this.logWaveInfo(wave);
            }
        });
        
        console.groupEnd();
    }
    
    // Визуальная отладка - показывать границы периодов
    addPeriodMarkers(waveContainer) {
        if (!waveContainer || !waveContainer.dataset.periodPx) return;
        
        const periodPx = parseFloat(waveContainer.dataset.periodPx);
        const totalPeriods = parseInt(waveContainer.dataset.totalPeriods) || 3;
        
        for (let i = 0; i <= totalPeriods; i++) {
            const marker = document.createElement('div');
            marker.className = 'period-marker';
            marker.style.position = 'absolute';
            marker.style.left = `${i * periodPx}px`;
            marker.style.top = '0';
            marker.style.width = '1px';
            marker.style.height = '100%';
            marker.style.backgroundColor = i === 0 || i === totalPeriods ? 'red' : 'rgba(255,0,0,0.3)';
            marker.style.zIndex = '1000';
            marker.style.pointerEvents = 'none';
            marker.title = `Период ${i}`;
            
            waveContainer.appendChild(marker);
        }
    }
    
    removePeriodMarkers() {
        document.querySelectorAll('.period-marker').forEach(marker => marker.remove());
    }
}

window.wavesDebugger = new WavesDebugger();

// Команды для консоли
window.debugWaves = function() {
    window.wavesDebugger.showAllWavesInfo();
};

window.showPeriodMarkers = function() {
    document.querySelectorAll('.wave-container').forEach(container => {
        window.wavesDebugger.addPeriodMarkers(container);
    });
};

window.hidePeriodMarkers = function() {
    window.wavesDebugger.removePeriodMarkers();
};