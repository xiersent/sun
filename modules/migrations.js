// modules/migrations.js
// Централизованный файл для всех миграций данных

class MigrationsManager {
    constructor(appState) {
        this.appState = appState;
        this.migrationLog = [];
    }

    /**
     * Запуск всех миграций
     */
    runAllMigrations() {
        this.log('=== ЗАПУСК МИГРАЦИЙ ===');
        
        this.migration1_rename31Group();
        this.migration2_disableClassicGroup();
        this.migration3_add120Waves();
        this.migration4_add31Waves();
        this.migration5_add1000Roads();
        this.migration6_rename1000RootsToRoads();
        this.migration7_addAstronomicalYears();
        this.migration8_remove25Blackness();
        this.migration9_update1000RoadsCategory();
        this.migration10_fixStandardWaveColors();
        this.migration11_renameRoadsToThreeDigits();
        
        this.log(`=== МИГРАЦИИ ЗАВЕРШЕНЫ (${this.migrationLog.length} операций) ===`);
        
        // Сохраняем результат миграций
        if (this.migrationLog.length > 0) {
            this.appState.save();
        }
        
        return this.migrationLog;
    }

    log(message) {
        console.log(`[Migration] ${message}`);
        this.migrationLog.push(message);
    }

    // ===== МИГРАЦИЯ 1: переименование группы "31 колосок" в "31 прутик" =====
    migration1_rename31Group() {
        if (!this.appState.data.groups) return;
        
        const old31Group = this.appState.data.groups.find(g => g.id === '31-waves-group' && g.name === '31 колосок');
        if (old31Group) {
            old31Group.name = '31 прутик';
            this.log('Группа "31 колосок" переименована в "31 прутик"');
        }
    }

    // ===== МИГРАЦИЯ 2: отключаем и скрываем классическую группу =====
    migration2_disableClassicGroup() {
        if (!this.appState.data.groups) return;
        
        const classicGroup = this.appState.data.groups.find(g => g.id === 'classic-group');
        if (classicGroup) {
            classicGroup.enabled = false;
            classicGroup.hidden = true;
            classicGroup.expanded = false;
            
            if (classicGroup.waves && Array.isArray(classicGroup.waves)) {
                classicGroup.waves.forEach(waveId => {
                    const waveIdStr = String(waveId);
                    if (this.appState.data.uiSettings && this.appState.data.uiSettings.waveVisibility) {
                        this.appState.data.uiSettings.waveVisibility[waveIdStr] = false;
                    }
                });
            }
            
            this.log('Классическая группа отключена и скрыта');
        }
    }

    // ===== МИГРАЦИЯ 3: добавление 120 колосков =====
    migration3_add120Waves() {
        const has120Waves = this.appState.data.waves.some(w => {
            const waveIdStr = String(w.id);
            return waveIdStr.startsWith('wave-120-');
        });
        
        if (!has120Waves && this.appState.waves120) {
            this.appState.data.waves = this.appState.data.waves.concat(this.appState.waves120);
            
            if (!this.appState.data.groups.some(g => g.id === '120-waves-group')) {
                this.appState.data.groups.push({
                    id: '120-waves-group',
                    name: '120 колосков',
                    enabled: true,
                    waves: this.appState.waves120Ids,
                    styleEnabled: true,
                    styleBold: false,
                    styleColor: '#666666',
                    styleColorEnabled: false,
                    styleType: 'dashed',
                    expanded: false
                });
            }
            
            this.log('Добавлена группа "120 колосков"');
        }
    }

    // ===== МИГРАЦИЯ 4: добавление 31 прутика =====
    migration4_add31Waves() {
        const has31Waves = this.appState.data.waves.some(w => {
            const waveIdStr = String(w.id);
            return waveIdStr.startsWith('wave-31-');
        });
        
        if (!has31Waves && this.appState.waves31) {
            this.appState.data.waves = this.appState.data.waves.concat(this.appState.waves31);
            
            if (!this.appState.data.groups.some(g => g.id === '31-waves-group')) {
                this.appState.data.groups.push({
                    id: '31-waves-group',
                    name: '31 прутик',
                    enabled: true,
                    waves: this.appState.waves31Ids,
                    styleEnabled: true,
                    styleBold: false,
                    styleColor: '#666666',
                    styleColorEnabled: false,
                    styleType: 'dotted',
                    expanded: false
                });
            }
            
            this.log('Добавлена группа "31 прутик"');
        }
        
        // Переименовываем волны 31 прутика (если нужно)
        this.appState.data.waves.forEach(wave => {
            const waveIdStr = String(wave.id);
            if (waveIdStr.startsWith('wave-31-')) {
                const match = waveIdStr.match(/wave-31-(\d+)/);
                if (match && wave.name !== `Прутик ${match[1]}`) {
                    const num = parseInt(match[1]);
                    wave.name = `Прутик ${num}`;
                    wave.description = `Период ${num} дней`;
                }
            }
        });
    }

    // ===== МИГРАЦИЯ 5: добавление 1000 дорог =====
    migration5_add1000Roads() {
        const has1000Waves = this.appState.data.waves.some(w => {
            const waveIdStr = String(w.id);
            return waveIdStr.startsWith('wave-1000-');
        });
        
        if (!has1000Waves && this.appState.waves1000) {
            this.appState.data.waves = this.appState.data.waves.concat(this.appState.waves1000);
            
            if (!this.appState.data.groups.some(g => g.id === '1000-roads-group')) {
                this.appState.data.groups.push({
                    id: '1000-roads-group',
                    name: '1000 дорог',
                    enabled: false,
                    waves: this.appState.waves1000Ids,
                    styleEnabled: true,
                    styleBold: false,
                    styleColor: '#C0C0C0',
                    styleColorEnabled: true,
                    styleType: 'long-dash',
                    expanded: false
                });
            }
            
            this.log('Добавлена группа "1000 дорог"');
        }
    }

    // ===== МИГРАЦИЯ 6: переименование "1000 корешков" в "1000 дорог" =====
    migration6_rename1000RootsToRoads() {
        // Переименовываем группу
        const rootsGroup = this.appState.data.groups.find(g => g.id === '1000-roots-group');
        if (rootsGroup && rootsGroup.name === '1000 корешков') {
            rootsGroup.id = '1000-roads-group';
            rootsGroup.name = '1000 дорог';
            this.log('Группа "1000 корешков" переименована в "1000 дорог"');
        }
        
        // Обновляем ID группы в списке групп (если есть другие ссылки)
        const groupIndex = this.appState.data.groups.findIndex(g => g.id === '1000-roots-group');
        if (groupIndex !== -1 && this.appState.data.groups[groupIndex].id === '1000-roots-group') {
            this.appState.data.groups[groupIndex].id = '1000-roads-group';
        }
        
        // Переименовываем волны с "Корешок" на "Дорога"
        let renamedCount = 0;
        this.appState.data.waves.forEach(wave => {
            if (wave.name && wave.name.startsWith('Корешок')) {
                const match = wave.name.match(/\d+/);
                if (match) {
                    const num = match[0];
                    wave.name = `Дорога ${num}`;
                    renamedCount++;
                }
            }
        });
        
        if (renamedCount > 0) {
            this.log(`Переименовано ${renamedCount} волн из "Корешок" в "Дорога"`);
        }
    }

    // ===== МИГРАЦИЯ 7: добавление астрономических годов =====
    migration7_addAstronomicalYears() {
        const experimentalGroup = this.appState.data.groups.find(g => g.id === 'experimental-group');
        if (!experimentalGroup) return;
        
        const requiredYears = [
            { id: 3652422, name: 'Тропический год', description: 'Астрономический (весеннее равноденствие)', period: 365.2422, color: '#FF6B35', type: 'dashed' },
            { id: 3652425, name: 'Григорианский год', description: 'Календарный (средний за 400 лет)', period: 365.2425, color: '#4CAF50', type: 'dashed' },
            { id: 36525636, name: 'Сидерический год', description: 'Относительно звёзд', period: 365.25636, color: '#9C27B0', type: 'dashed' },
            { id: 36525964, name: 'Аномалистический год', description: 'От перигелия до перигелия', period: 365.25964, color: '#FF9800', type: 'dashed' },
            { id: 36524167, name: 'Драконический год', description: 'Относительно узлов Луны', period: 365.24167, color: '#E91E63', type: 'dashed' }
        ];
        
        let addedCount = 0;
        
        requiredYears.forEach(yearConfig => {
            const yearExists = this.appState.data.waves.some(w => w.id === yearConfig.id);
            if (!yearExists) {
                this.appState.data.waves.push({
                    ...yearConfig,
                    category: 'experimental',
                    visible: false,
                    bold: false,
                    cornerColor: false
                });
                addedCount++;
            }
        });
        
        // Добавляем ID годов в группу, если их нет
        if (addedCount > 0) {
            if (!experimentalGroup.waves) {
                experimentalGroup.waves = [];
            }
            requiredYears.forEach(yearConfig => {
                if (!experimentalGroup.waves.includes(yearConfig.id)) {
                    experimentalGroup.waves.push(yearConfig.id);
                }
            });
            this.log(`Добавлено ${addedCount} астрономических годов`);
        }
    }

    // ===== МИГРАЦИЯ 8: удаление "25 черность" из экспериментальной группы =====
    migration8_remove25Blackness() {
        const experimentalGroup = this.appState.data.groups.find(g => g.id === 'experimental-group');
        if (experimentalGroup && experimentalGroup.waves) {
            const index25 = experimentalGroup.waves.indexOf(25);
            if (index25 !== -1) {
                experimentalGroup.waves.splice(index25, 1);
                this.log('"25 черность" удалена из экспериментальной группы');
            }
        }
    }

    // ===== МИГРАЦИЯ 9: обновление категории для 1000 дорог =====
    migration9_update1000RoadsCategory() {
        let updatedCount = 0;
        
        this.appState.data.waves.forEach(wave => {
            const waveIdStr = String(wave.id);
            if (waveIdStr.startsWith('wave-1000-')) {
                if (wave.category === '1000-roots') {
                    wave.category = '1000-roads';
                    updatedCount++;
                }
                // Также обновляем название, если вдруг осталось "Корешок"
                if (wave.name && wave.name.startsWith('Корешок')) {
                    const match = wave.name.match(/\d+/);
                    if (match) {
                        wave.name = `Дорога ${match[0]}`;
                        updatedCount++;
                    }
                }
            }
        });
        
        if (updatedCount > 0) {
            this.log(`Обновлено ${updatedCount} волн категории 1000 дорог`);
        }
    }

    // ===== МИГРАЦИЯ 10: исправление цветов стандартных волн =====
    migration10_fixStandardWaveColors() {
        const standardColor = '#C0C0C0';
        let fixedCount = 0;
        
        this.appState.data.waves.forEach(wave => {
            const waveIdStr = String(wave.id);
            const isStandardWave = waveIdStr.startsWith('wave-120-') || 
                                   waveIdStr.startsWith('wave-31-') || 
                                   waveIdStr.startsWith('wave-1000-');
            
            if (isStandardWave) {
                if (wave.isDefaultColor === undefined) {
                    wave.isDefaultColor = true;
                    fixedCount++;
                }
                if (wave.isDefaultColor === true && wave.color !== standardColor) {
                    wave.color = standardColor;
                    fixedCount++;
                }
            }
        });
        
        if (fixedCount > 0) {
            this.log(`Исправлено ${fixedCount} стандартных цветов волн`);
        }
    }

    // ===== МИГРАЦИЯ 11: переименование дорог в трёхзначный формат (1 → 001) =====
    migration11_renameRoadsToThreeDigits() {
        let renamedCount = 0;
        
        this.appState.data.waves.forEach(wave => {
            const waveIdStr = String(wave.id);
            if (waveIdStr.startsWith('wave-1000-')) {
                const match = waveIdStr.match(/wave-1000-(\d+)/);
                if (match) {
                    const num = parseInt(match[1]);
                    const threeDigitNum = num.toString().padStart(3, '0');
                    const expectedName = `Дорога ${threeDigitNum}`;
                    
                    if (wave.name !== expectedName) {
                        wave.name = expectedName;
                        renamedCount++;
                    }
                }
            }
        });
        
        if (renamedCount > 0) {
            this.log(`Переименовано ${renamedCount} дорог в трёхзначный формат (001-1000)`);
        }
    }
}

// Создаем глобальный экземпляр
window.MigrationsManager = MigrationsManager;