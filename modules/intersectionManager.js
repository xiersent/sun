class IntersectionManager {
    constructor() {
        this.elements = window.appCore ? window.appCore.elements : {};
    }
    
    displayIntersectionResults(resultsData) {
        const { results, exactMatches, closeMatches, totalWaves } = resultsData;
        const container = this.elements.intersectionResults;
        const stats = this.elements.intersectionStats;
        
        if (!results || results.length === 0) {
            container.innerHTML = '<div class="intersection-item">Нет совпадений</div>';
            stats.style.display = 'none';
            return;
        }
        
        container.innerHTML = results.map(result => {
            const matchTypeBadge = result.isExact ?
                '<span class="match-type-badge match-type-exact">ТОЧНО</span>' :
                '<span class="match-type-badge match-type-close">БЛИЗКО</span>';
            
            return `
                <div class="intersection-item ${result.isExact ? 'exact-match' : 'close-match'}">
                    <div class="intersection-info">
                        <div class="intersection-period">Период: ${result.period.toFixed(2)} дней | Амплитуда: ${result.amplitude.toFixed(2)}</div>
                        <div class="intersection-match-type">${matchTypeBadge} Качество совпадения: ${(result.matchQuality * 100).toFixed(1)}% | Значение: ${result.value.toFixed(3)} | Разница: ${result.difference.toFixed(3)}</div>
                    </div>
                    <div class="intersection-controls">
                        <button class="ui-btn small-button" onclick="window.intersectionManager.addIntersectionWave(${result.period},${result.amplitude})">Добавить</button>
                    </div>
                </div>
            `;
        }).join('');
        
        stats.innerHTML = `
            <strong>Статистика совпадений:</strong><br>
            Всего проанализировано волн: ${totalWaves}<br>
            Точных совпадений: ${exactMatches}<br>
            Близких совпадений: ${closeMatches}<br>
            Общее количество совпадений: ${results.length}<br>
            Процент совпадений: ${((results.length / totalWaves) * 100).toFixed(2)}%
        `;
        stats.style.display = 'block';
    }
    
    addIntersectionWave(period, amplitude) {
        window.waves.addIntersectionWave(period, amplitude);
        window.dataManager.updateWavesGroups();
        alert(`Колосок с периодом ${period.toFixed(2)} дней добавлен в пользовательские колоски`);
    }
}

window.intersectionManager = new IntersectionManager();