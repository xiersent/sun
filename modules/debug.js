class WavesDebugger {
    constructor() {
        this.debugInfo = {};
    }
    
    logWaveInfo(wave) {
        if (!window.waves) return;
        
        const periodPx = wave.period * window.appState.config.squareSize;
        const totalPeriods = window.waves.calculateRequiredPeriods(periodPx);
        const containerWidth = periodPx * totalPeriods;
    }
    
    showAllWavesInfo() {
        window.appState.data.waves.forEach(wave => {
            const waveIdStr = String(wave.id);
            const isWaveVisible = window.appState.waveVisibility[waveIdStr] !== false;
            const isGroupEnabled = window.waves.isWaveGroupEnabled(wave.id);
            
            if (isWaveVisible && isGroupEnabled) {
                this.logWaveInfo(wave);
            }
        });
    }
    
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