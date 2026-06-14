/**
 * @file migrations.js
 * Менеджер миграций: загрузка migrations/*.js и последовательный прогон.
 */
class MigrationsManager {
    /** Последняя версия схемы (= номер последнего migrations/NNN.js). Увеличить при добавлении 006.js */
    static SCHEMA_VERSION = 5;

    /** Известные файлы миграций (без HEAD-опроса) */
    static KNOWN_MIGRATION_IDS = ['001', '002', '003', '004', '005'];

    constructor(appState) {
        this.appState = appState;
        this.migrationLog = [];
        this.migrations = [];
    }

    /** Версия схемы, уже применённая к сохранённым данным. */
    getStoredSchemaVersion() {
        const v = this.appState?.data?.uiSettings?.migrationsSchemaVersion;
        const n = Number(v);
        return Number.isFinite(n) && n >= 0 ? n : 0;
    }

    /** Данные уже на актуальной схеме — не грузим migrations/*.js. */
    shouldSkipMigrations() {
        return this.getStoredSchemaVersion() >= MigrationsManager.SCHEMA_VERSION;
    }

    /** Записать версию схемы; save() — в конце load() после hydrate. */
    markSchemaVersionApplied() {
        if (!this.appState.data.uiSettings) {
            this.appState.data.uiSettings = {};
        }
        this.appState.data.uiSettings.migrationsSchemaVersion = MigrationsManager.SCHEMA_VERSION;
        this.appState._migrateNeedsSaveAfterLoadHydrate = true;
    }

    migrationClassName(id) {
        return `Migration${id}`;
    }

    isMigrationScriptLoaded(id) {
        return typeof window[this.migrationClassName(id)] === 'function';
    }

    /**
     * Параллельная подгрузка только отсутствующих migrations/NNN.js (без HEAD).
     */
    async ensureMigrationScriptsLoaded() {
        const ids = MigrationsManager.KNOWN_MIGRATION_IDS;
        const missing = ids.filter((id) => !this.isMigrationScriptLoaded(id));

        if (missing.length === 0) {
            this.log(`Скрипты миграций уже в памяти (${ids.length})`, 'info');
            return ids.length > 0;
        }

        this.log(`Загрузка миграций: ${missing.join(', ')}...`);
        await Promise.all(
            missing.map((id) => this.loadScript(`migrations/${id}.js`).then(() => {
                this.log(`Загружена миграция ${id}`, 'success');
            }))
        );
        return ids.length > 0;
    }

    /**
     * @deprecated Используй ensureMigrationScriptsLoaded
     */
    async loadMigrationsFromFolder() {
        return this.ensureMigrationScriptsLoaded();
    }

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

    discoverLoadedMigrations() {
        const migrations = [];

        for (const id of MigrationsManager.KNOWN_MIGRATION_IDS) {
            const name = this.migrationClassName(id);
            if (typeof window[name] === 'function') {
                migrations.push({
                    id,
                    name,
                    class: window[name]
                });
            }
        }

        this.migrations = migrations;
        return migrations;
    }

    async runAllMigrations() {
        const __lp = typeof window !== 'undefined' ? window.__loadPerf : null;

        if (this.shouldSkipMigrations()) {
            this.log(
                `Схема v${this.getStoredSchemaVersion()} актуальна (v${MigrationsManager.SCHEMA_VERSION}), миграции пропущены`,
                'success'
            );
            __lp && __lp.mark('appState_migrations_skipped', {
                reason: 'schema_version',
                stored: this.getStoredSchemaVersion(),
                latest: MigrationsManager.SCHEMA_VERSION
            });
            return [];
        }

        this.log('=== ЗАПУСК МЕНЕДЖЕРА МИГРАЦИЙ ===');

        this.log('Шаг 1: Загрузка файлов миграций...');
        const loaded = await this.ensureMigrationScriptsLoaded();

        if (!loaded) {
            this.log('Миграции не найдены', 'warning');
            return [];
        }

        this.log('Шаг 2: Поиск классов миграций...');
        const discovered = this.discoverLoadedMigrations();

        if (discovered.length === 0) {
            this.log('Классы миграций не найдены', 'warning');
            return [];
        }

        this.log(`Найдено классов миграций: ${discovered.length}`);
        discovered.forEach((m) => {
            this.log(`  - ${m.name}`);
        });

        this.log('Шаг 3: Запуск миграций...');

        let anyMigrationApplied = false;
        let hadError = false;

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
                hadError = true;
                this.log(`${migration.name}: ОШИБКА - ${error.message}`, 'error');
                console.error(error);
                this.migrationLog.push(`${migration.name}: ОШИБКА - ${error.message}`);
            }
        }

        this.log(`=== МИГРАЦИИ ЗАВЕРШЕНЫ (${this.migrationLog.length} операций) ===`);

        if (!hadError) {
            this.markSchemaVersionApplied();
        }

        if (anyMigrationApplied) {
            this.appState._migrateNeedsSaveAfterLoadHydrate = true;
        }

        return this.migrationLog;
    }

    log(message, type = 'info') {
        const prefix = '[Migrations]';

        switch (type) {
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
