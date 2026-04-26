// modules/migrations.js - исправленная версия с корректной обработкой 404
class MigrationsManager {
    constructor(appState) {
        this.appState = appState;
        this.migrationLog = [];
        this.migrations = [];
    }

    /**
     * Автоматическая загрузка всех файлов миграций из папки migrations/
     */
    async loadMigrationsFromFolder() {
        this.log('Поиск миграций в папке migrations/...');
        
        const migrationFiles = [];
        let index = 1;
        
        while (true) {
            const paddedIndex = index.toString().padStart(3, '0');
            const url = `migrations/${paddedIndex}.js`;
            
            this.log(`Проверка ${url}...`);
            
            try {
                // Сначала проверяем существование файла через fetch
                const response = await fetch(url, { method: 'HEAD' });
                
                if (response.ok) {
                    // Файл существует - загружаем
                    await this.loadScript(url);
                    migrationFiles.push(paddedIndex);
                    this.log(`Загружена миграция ${paddedIndex}`, 'success');
                    index++;
                } else {
                    // Файл не найден - прекращаем поиск
                    this.log(`Миграции закончились на ${paddedIndex-1}`, 'info');
                    break;
                }
                
            } catch (error) {
                // Ошибка сети или файл не найден
                this.log(`Миграции закончились на ${paddedIndex-1}`, 'info');
                break;
            }
        }
        
        this.log(`Загружено миграций: ${migrationFiles.length}`);
        return migrationFiles.length > 0;
    }

    /**
     * Динамическая загрузка скрипта
     */
    loadScript(url) {
        return new Promise((resolve, reject) => {
            const script = document.createElement('script');
            script.src = url;
            script.onload = () => {
                queueMicrotask(resolve);
            };
            script.onerror = () => {
                reject(new Error(`Failed to load script: ${url}`));
            };
            document.head.appendChild(script);
        });
    }

    /**
     * Поиск всех загруженных классов миграций
     */
    discoverLoadedMigrations() {
        const migrations = [];
        
        for (const key in window) {
            // Исключаем сам менеджер и другие служебные классы
            if (key.startsWith('Migration') && 
                key !== 'MigrationsManager' && 
                typeof window[key] === 'function') {
                const id = key.replace('Migration', '');
                migrations.push({
                    id: id,
                    name: key,
                    class: window[key]
                });
            }
        }
        
        // Сортируем по ID
        migrations.sort((a, b) => {
            return parseInt(a.id) - parseInt(b.id);
        });
        
        this.migrations = migrations;
        return migrations;
    }

    /**
     * Запуск всех обнаруженных миграций
     */
    async runAllMigrations() {
        this.log('=== ЗАПУСК МЕНЕДЖЕРА МИГРАЦИЙ ===');
        
        // Шаг 1: Автоматически загружаем все файлы миграций
        this.log('Шаг 1: Автоматическая загрузка файлов миграций...');
        const loaded = await this.loadMigrationsFromFolder();
        
        if (!loaded) {
            this.log('Миграции не найдены', 'warning');
            return [];
        }
        
        // Шаг 2: Поиск загруженных классов миграций
        this.log('Шаг 2: Поиск загруженных классов миграций...');
        const discovered = this.discoverLoadedMigrations();
        
        if (discovered.length === 0) {
            this.log('Классы миграций не найдены', 'warning');
            return [];
        }
        
        this.log(`Найдено классов миграций: ${discovered.length}`);
        discovered.forEach(m => {
            this.log(`  - ${m.name}`);
        });
        
        // Шаг 3: Запуск миграций
        this.log('Шаг 3: Запуск миграций...');
        
        let anyMigrationApplied = false;
        for (const migration of discovered) {
            try {
                const instance = new migration.class(this.appState);
                
                if (instance.shouldApply && instance.shouldApply()) {
                    this.log(`Применение ${migration.name}...`, 'info');
                    const startTime = Date.now();
                    
                    if (instance.up) {
                        await instance.up();
                        anyMigrationApplied = true;
                        const duration = Date.now() - startTime;
                        this.log(`${migration.name} применена за ${duration}ms`, 'success');
                        this.migrationLog.push(`${migration.name}: применена (${duration}ms)`);
                    } else {
                        this.log(`${migration.name}: метод up() не найден`, 'warning');
                    }
                } else {
                    this.log(`${migration.name}: не требуется`, 'info');
                    this.migrationLog.push(`${migration.name}: пропущена`);
                }
                
            } catch (error) {
                this.log(`${migration.name}: ОШИБКА - ${error.message}`, 'error');
                console.error(error);
                this.migrationLog.push(`${migration.name}: ОШИБКА - ${error.message}`);
            }
        }
        
        this.log(`=== МИГРАЦИИ ЗАВЕРШЕНЫ (${this.migrationLog.length} операций) ===`);
        
        // Не вызывать save() здесь: поля AppState ещё не восстановлены из JSON — получится
        // перезапись localStorage дефолтами из конструктора. Сохранение — в конце load().
        if (anyMigrationApplied) {
            this.appState._migrateNeedsSaveAfterLoadHydrate = true;
        }
        
        return this.migrationLog;
    }

    log(message, type = 'info') {
        const prefix = '[Migrations]';
        
        switch(type) {
            case 'success':
                console.log(`%c${prefix} ${message}`, 'color: #4CAF50; font-weight: bold');
                break;
            case 'error':
                console.log(`%c${prefix} ${message}`, 'color: #f44336; font-weight: bold');
                break;
            case 'warning':
                console.log(`%c${prefix} ${message}`, 'color: #FF9800; font-weight: bold');
                break;
            default:
                console.log(`${prefix} ${message}`);
        }
    }
}

window.MigrationsManager = MigrationsManager;