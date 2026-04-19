// migrations/001.js - ПОЛНАЯ ВЕРСИЯ С ЛОГИРОВАНИЕМ
class Migration001 {
    constructor(appState) {
        this.appState = appState;
        this.description = 'Полное начальное заполнение данными';
        this.logs = [];
    }

    log(message, type = 'info') {
        const logEntry = `[Migration 001] ${message}`;
        console.log(logEntry);
        this.logs.push(logEntry);
        
        // Также выводим в консоль с цветом для важных сообщений
        if (type === 'success') {
            console.log(`%c${logEntry}`, 'color: green; font-weight: bold');
        } else if (type === 'error') {
            console.log(`%c${logEntry}`, 'color: red; font-weight: bold');
        } else if (type === 'warning') {
            console.log(`%c${logEntry}`, 'color: orange; font-weight: bold');
        }
    }

    shouldApply() {
        this.log('Проверка необходимости применения миграции...');
        
        const hasDates = this.appState.data.dates && this.appState.data.dates.length > 0;
        const hasWaves = this.appState.data.waves && this.appState.data.waves.length > 0;
        const hasGroups = this.appState.data.groups && this.appState.data.groups.length > 0;
        
        const expectedGroupCount = 6;
        const currentGroupCount = this.appState.data.groups?.length || 0;
        
        this.log(`Текущее состояние: дат=${hasDates ? this.appState.data.dates.length : 0}, ` +
                `волн=${hasWaves ? this.appState.data.waves.length : 0}, ` +
                `групп=${currentGroupCount} (нужно ${expectedGroupCount})`);
        
        const needsMigration = !hasDates || !hasWaves || !hasGroups || currentGroupCount < expectedGroupCount;
        
        if (needsMigration) {
            this.log('Миграция необходима', 'warning');
        } else {
            this.log('Миграция не требуется', 'success');
        }
        
        return needsMigration;
    }

    async up() {
        this.log('========== НАЧАЛО МИГРАЦИИ ==========', 'success');
        this.log('Полное начальное заполнение данными...');
        
        try {
            // Шаг 1: Создание волн
            this.log('Шаг 1/5: Создание массива всех волн...');
            const allWaves = this.createAllWaves();
            this.log(`Создано волн: ${allWaves.length}`);
            this.log(`  - Базовые волны: 5`);
            this.log(`  - Астрономические годы: 6`);
            this.log(`  - 120 колосков: 120`);
            this.log(`  - 31 прутик: 31`);
            this.log(`  - 1000 дорог: 1000`);
            this.log(`  - ИТОГО: ${allWaves.length} волн`);
            
            // Шаг 2: Создание групп
            this.log('Шаг 2/5: Создание массива всех групп...');
            const allGroups = this.createAllGroups();
            this.log(`Создано групп: ${allGroups.length}`);
            allGroups.forEach((group, idx) => {
                const waveCount = group.waves ? group.waves.length : 0;
                this.log(`  ${idx + 1}. "${group.name}" - ${waveCount} волн`);
            });
            
            // Шаг 3: Создание начальной даты
            this.log('Шаг 3/5: Создание начальной даты...');
            const initialDate = this.createInitialDate();
            this.log(`Создана дата: id=${initialDate.id}, name=${initialDate.name}, date=${new Date(initialDate.date).toLocaleString()}`);
            
            // Шаг 4: Очистка существующих данных
            this.log('Шаг 4/5: Очистка существующих данных...');
            const oldWavesCount = this.appState.data.waves.length;
            const oldGroupsCount = this.appState.data.groups.length;
            const oldDatesCount = this.appState.data.dates.length;
            
            this.appState.data.waves = [];
            this.appState.data.groups = [];
            this.appState.data.dates = [];
            this.appState.data.notes = [];
            
            this.log(`Очищено: волн=${oldWavesCount}, групп=${oldGroupsCount}, дат=${oldDatesCount}`);
            
            // Шаг 5: Заполнение новыми данными
            this.log('Шаг 5/5: Заполнение новыми данными...');
            this.appState.data.waves = allWaves;
            this.appState.data.groups = allGroups;
            this.appState.data.dates = [initialDate];
            this.appState.data.notes = [];
            
            this.log(`Заполнено: волн=${this.appState.data.waves.length}, групп=${this.appState.data.groups.length}, дат=${this.appState.data.dates.length}`);
            
            // Настройка видимости волн
            this.log('Настройка видимости волн...');
            this.appState.waveVisibility = {};
            this.appState.waveBold = {};
            this.appState.waveCornerColor = {};
            
            let visibleCount = 0;
            allWaves.forEach(wave => {
                const waveIdStr = String(wave.id);
                const isVisible = wave.visible !== false;
                this.appState.waveVisibility[waveIdStr] = isVisible;
                this.appState.waveBold[waveIdStr] = false;
                this.appState.waveCornerColor[waveIdStr] = false;
                if (isVisible) visibleCount++;
            });
            this.log(`Настроена видимость: ${visibleCount} волн видимы, ${allWaves.length - visibleCount} скрыты`);
            
            // Установка активной даты
            this.log(`Установка активной даты: ${initialDate.id}`);
            this.appState.activeDateId = initialDate.id;
            this.appState.baseDate = new Date(initialDate.date);
            
            // Сохранение UI настроек
            if (!this.appState.data.uiSettings) {
                this.appState.data.uiSettings = {};
            }
            this.appState.data.uiSettings.waveVisibility = this.appState.waveVisibility;
            this.appState.data.uiSettings.waveBold = this.appState.waveBold;
            this.appState.data.uiSettings.waveCornerColor = this.appState.waveCornerColor;
            this.appState.data.uiSettings.activeDateId = initialDate.id;
            
            // Финальное сохранение
            this.log('Сохранение состояния...');
            this.appState.save();
            
            this.log('========== МИГРАЦИЯ УСПЕШНО ЗАВЕРШЕНА ==========', 'success');
            this.log(`Итог: ${allWaves.length} волн, ${allGroups.length} групп, 1 дата`);
            
            return true;
            
        } catch (error) {
            this.log(`ОШИБКА ВО ВРЕМЯ МИГРАЦИИ: ${error.message}`, 'error');
            console.error(error);
            return false;
        }
    }

    createAllWaves() {
        this.log('  Создание базовых волн...');
        // Базовые волны
        const basicWaves = [
            { id: 24, name: '24 красность', description: 'Физический ритм', period: 24, color: '#FF0000', type: 'solid', category: 'classic', visible: false },
            { id: 28, name: '28 зеленость', description: 'Эмоциональный ритм', period: 28, color: '#008000', type: 'solid', category: 'classic', visible: false },
            { id: 33, name: '33 синесть', description: 'Интеллектуальный ритм', period: 33, color: '#0000FF', type: 'solid', category: 'classic', visible: false },
            { id: 38, name: '38 фиолетовость', description: 'Интуитивный ритм', period: 38, color: '#800080', type: 'solid', category: 'classic', visible: false },
            { id: 25, name: '25 черность', description: 'Экспериментальный ритм', period: 25, color: '#000000', type: 'solid', category: 'classic', visible: false }
        ];
        
        this.log('  Создание астрономических годов...');
        // Астрономические годы
        const astronomicalYears = [
            { id: 365, name: 'Юлианский год', description: 'Юлианский год (365.25 дней)', period: 365.25, color: '#FFA500', type: 'solid', category: 'experimental', visible: false },
            { id: 3652422, name: 'Тропический год', description: 'Астрономический (весеннее равноденствие)', period: 365.2422, color: '#FFA500', type: 'solid', category: 'experimental', visible: false },
            { id: 3652425, name: 'Григорианский год', description: 'Календарный (средний за 400 лет)', period: 365.2425, color: '#FFA500', type: 'solid', category: 'experimental', visible: false },
            { id: 36525636, name: 'Сидерический год', description: 'Относительно звёзд', period: 365.25636, color: '#FFA500', type: 'solid', category: 'experimental', visible: false },
            { id: 36525964, name: 'Аномалистический год', description: 'От перигелия до перигелия', period: 365.25964, color: '#FFA500', type: 'solid', category: 'experimental', visible: false },
            { id: 36524167, name: 'Драконический год', description: 'Относительно узлов Луны', period: 365.24167, color: '#FFA500', type: 'solid', category: 'experimental', visible: false }
        ];
        
        this.log('  Создание 120 колосков...');
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
        
        this.log('  Создание 31 прутика...');
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
        
        this.log('  Создание 1000 дорог...');
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
        const groups = [
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
                waves: [24, 28, 33, 38, 25],
                styleEnabled: false,
                styleBold: false,
                styleColor: '#666666',
                styleColorEnabled: false,
                styleType: 'solid',
                expanded: false,
                hidden: false
            },
            {
                id: 'experimental-group',
                name: 'Экспериментальная',
                enabled: false,
                waves: [365, 3652422, 3652425, 36525636, 36525964, 36524167],
                styleEnabled: true,
                styleBold: false,
                styleColor: '#FFA500',
                styleColorEnabled: true,
                styleType: 'solid',
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
        
        // Логируем каждую группу с её волнами
        groups.forEach(group => {
            const waveCount = group.waves ? group.waves.length : 0;
            this.log(`    Группа "${group.name}": ${waveCount} волн`);
        });
        
        return groups;
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
        this.log(`  Создана дата s25: ${s25Date.toLocaleString()}`);
        return {
            id: 's25',
            date: s25Date.getTime(),
            name: 's25'
        };
    }

    async down() {
        this.log('========== НАЧАЛО ОТКАТА МИГРАЦИИ ==========', 'warning');
        
        const oldWavesCount = this.appState.data.waves.length;
        const oldGroupsCount = this.appState.data.groups.length;
        const oldDatesCount = this.appState.data.dates.length;
        
        this.log(`Очистка данных: волн=${oldWavesCount}, групп=${oldGroupsCount}, дат=${oldDatesCount}`);
        
        this.appState.data.waves = [];
        this.appState.data.groups = [];
        this.appState.data.dates = [];
        this.appState.data.notes = [];
        this.appState.activeDateId = null;
        this.appState.waveVisibility = {};
        this.appState.waveBold = {};
        this.appState.waveCornerColor = {};
        
        this.appState.save();
        
        this.log('Откат выполнен успешно', 'success');
        this.log('========== КОНЕЦ ОТКАТА ==========');
        return true;
    }
}

window.Migration001 = Migration001;