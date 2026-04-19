
// Полная начальная миграция с объединением всех данных
class Migration001 {
    constructor(appState) {
        this.appState = appState;
        this.description = 'Полное начальное заполнение данными';
    }

    shouldApply() {
        const hasDates = this.appState.data.dates && this.appState.data.dates.length > 0;
        const hasWaves = this.appState.data.waves && this.appState.data.waves.length > 0;
        const hasGroups = this.appState.data.groups && this.appState.data.groups.length > 0;
        
        return !hasDates && !hasWaves && !hasGroups;
    }

    async up() {
        console.log('[Migration 001] Полное начальное заполнение данными...');
        
        // Создаём все волны
        const allWaves = this.createAllWaves();
        const allGroups = this.createAllGroups();
        const initialDate = this.createInitialDate();
        
        // Заполняем данные
        this.appState.data.waves = allWaves;
        this.appState.data.groups = allGroups;
        this.appState.data.dates = [initialDate];
        this.appState.data.notes = [];
        
        // Настройки видимости для всех волн
        allWaves.forEach(wave => {
            const waveIdStr = String(wave.id);
            this.appState.waveVisibility[waveIdStr] = wave.visible !== false;
            this.appState.waveBold[waveIdStr] = false;
            this.appState.waveCornerColor[waveIdStr] = false;
        });
        
        this.appState.activeDateId = initialDate.id;
        this.appState.baseDate = new Date(initialDate.date);
        this.appState.save();
        
        console.log('[Migration 001] Начальные данные созданы');
        return true;
    }

    createAllWaves() {
        // Базовые волны
        const basicWaves = [
            { id: 24, name: '24 красность', description: 'Физический ритм', period: 24, color: '#FF0000', type: 'solid', category: 'classic', visible: false },
            { id: 28, name: '28 зеленость', description: 'Эмоциональный ритм', period: 28, color: '#008000', type: 'solid', category: 'classic', visible: false },
            { id: 33, name: '33 синесть', description: 'Интеллектуальный ритм', period: 33, color: '#0000FF', type: 'solid', category: 'classic', visible: false },
            { id: 38, name: '38 фиолетовость', description: 'Интуитивный ритм', period: 38, color: '#800080', type: 'solid', category: 'classic', visible: false },
            { id: 25, name: '25 черность', description: 'Экспериментальный ритм', period: 25, color: '#000000', type: 'solid', category: 'classic', visible: false }
        ];
        
        // Астрономические годы
        const astronomicalYears = [
            { id: 365, name: 'Юлианский год', description: 'Юлианский год (365.25 дней)', period: 365.25, color: '#FFA500', type: 'solid', category: 'experimental', visible: false },
            { id: 3652422, name: 'Тропический год', description: 'Астрономический (весеннее равноденствие)', period: 365.2422, color: '#FFA500', type: 'solid', category: 'experimental', visible: false },
            { id: 3652425, name: 'Григорианский год', description: 'Календарный (средний за 400 лет)', period: 365.2425, color: '#FFA500', type: 'solid', category: 'experimental', visible: false },
            { id: 36525636, name: 'Сидерический год', description: 'Относительно звёзд', period: 365.25636, color: '#FFA500', type: 'solid', category: 'experimental', visible: false },
            { id: 36525964, name: 'Аномалистический год', description: 'От перигелия до перигелия', period: 365.25964, color: '#FFA500', type: 'solid', category: 'experimental', visible: false },
            { id: 36524167, name: 'Драконический год', description: 'Относительно узлов Луны', period: 365.24167, color: '#FFA500', type: 'solid', category: 'experimental', visible: false }
        ];
        
        // 120 колосков (волны с 1 до 120)
        const waves120 = [];
        for (let i = 1; i <= 120; i++) {
            waves120.push({
                id: `wave-120-${i}`,
                name: `Колосок ${i}`,
                description: `Период ${i} дней`,
                period: i,
                color: '#C0C0C0',
                type: 'dashed',
                category: '120-waves',
                visible: false,
                isDefaultColor: true
            });
        }
        
        // 31 прутик (волны с 1 до 31)
        const waves31 = [];
        for (let i = 1; i <= 31; i++) {
            waves31.push({
                id: `wave-31-${i}`,
                name: `Прутик ${i.toString().padStart(2, '0')}`,
                description: `Период ${i} дней`,
                period: i,
                color: '#C0C0C0',
                type: 'dotted',
                category: '31-waves',
                visible: false,
                isDefaultColor: true
            });
        }
        
        // 1000 дорог (волны с 1 до 1000, трёхзначный формат)
        const waves1000 = [];
        for (let i = 1; i <= 1000; i++) {
            waves1000.push({
                id: `wave-1000-${i}`,
                name: `Дорога ${i.toString().padStart(3, '0')}`,
                description: `Период ${i} дней`,
                period: i,
                color: '#C0C0C0',
                type: 'long-dash',
                category: '1000-roads',
                visible: false,
                isDefaultColor: true
            });
        }
        
        return [...basicWaves, ...astronomicalYears, ...waves120, ...waves31, ...waves1000];
    }

    createAllGroups() {
        return [
            {
                id: 'default-group',
                name: 'Стандартная',
                enabled: false,
                waves: [],
                styleEnabled: false,
                styleBold: false,
                styleColor: '#666666',
                styleColorEnabled: false,
                styleType: 'solid',
                expanded: true,
                hidden: false
            },
            {
                id: 'classic-group',
                name: 'Классическая',
                enabled: false,
                waves: [24, 28, 33, 38],
                styleEnabled: false,
                styleBold: false,
                styleColor: '#666666',
                styleColorEnabled: false,
                styleType: 'solid',
                expanded: false,
                hidden: false  // Группа видна
            },
            {
                id: 'experimental-group',
                name: 'Экспериментальная',
                enabled: false,
                waves: [25, 365, 3652422, 3652425, 36525636, 36525964, 36524167],
                styleEnabled: true,
                styleBold: false,
                styleColor: '#FFA500',  // Оранжевый цвет для всех волн группы
                styleColorEnabled: true,
                styleType: 'solid',  // Сплошная линия для всех волн группы
                expanded: false,
                hidden: false
            },
            {
                id: '120-waves-group',
                name: '120 колосков',
                enabled: false,
                waves: this.getWaveIdsByPrefix('wave-120-', 120),
                styleEnabled: true,
                styleBold: false,
                styleColor: '#666666',
                styleColorEnabled: false,
                styleType: 'dashed',
                expanded: false,
                hidden: false
            },
            {
                id: '31-waves-group',
                name: '31 прутик',
                enabled: false,
                waves: this.getWaveIdsByPrefix('wave-31-', 31),
                styleEnabled: true,
                styleBold: false,
                styleColor: '#666666',
                styleColorEnabled: false,
                styleType: 'dotted',
                expanded: false,
                hidden: false
            },
            {
                id: '1000-roads-group',
                name: '1000 дорог',
                enabled: false,
                waves: this.getWaveIdsByPrefix('wave-1000-', 1000),
                styleEnabled: true,
                styleBold: false,
                styleColor: '#C0C0C0',
                styleColorEnabled: true,
                styleType: 'long-dash',
                expanded: false,
                hidden: false
            }
        ];
    }

    // Вспомогательный метод для получения массива ID волн по префиксу
    getWaveIdsByPrefix(prefix, count) {
        const ids = [];
        for (let i = 1; i <= count; i++) {
            ids.push(`${prefix}${i}`);
        }
        return ids;
    }

    createInitialDate() {
        const s25Date = new Date(1990, 0, 25, 0, 0, 0, 0);
        return {
            id: 's25',
            date: s25Date.getTime(),
            name: 's25'
        };
    }

    async down() {
        this.appState.data.waves = [];
        this.appState.data.groups = [];
        this.appState.data.dates = [];
        this.appState.data.notes = [];
        this.appState.activeDateId = null;
        this.appState.waveVisibility = {};
        this.appState.waveBold = {};
        this.appState.waveCornerColor = {};
        console.log('[Migration 001] Откат выполнен');
        return true;
    }
}

window.Migration001 = Migration001;