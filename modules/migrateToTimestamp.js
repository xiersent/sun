// modules/migrateToTimestamp.js
class TimestampMigrator {
    static migrateAllData() {
        const saved = localStorage.getItem('appData');
        if (!saved) {
            console.log('Нет сохраненных данных для миграции');
            return false;
        }
        
        try {
            const data = JSON.parse(saved);
            let migrated = false;
            let migratedCount = 0;
            
            console.log('Начинаем миграцию данных в timestamp формат...');
            
            // Мигрировать dates
            if (data.dates && Array.isArray(data.dates)) {
                data.dates.forEach(date => {
                    if (date.date && typeof date.date === 'string') {
                        const dateObj = new Date(date.date);
                        if (!isNaN(dateObj.getTime())) {
                            date.date = dateObj.getTime();
                            migrated = true;
                            migratedCount++;
                            console.log('Мигрирована дата:', date.name, date.date);
                        }
                    }
                });
            }
            
            // Мигрировать notes
            if (data.notes && Array.isArray(data.notes)) {
                data.notes.forEach(note => {
                    if (note.date && typeof note.date === 'string') {
                        const dateObj = new Date(note.date);
                        if (!isNaN(dateObj.getTime())) {
                            note.date = dateObj.getTime();
                            migrated = true;
                            migratedCount++;
                            console.log('Мигрирована заметка:', note.date);
                        }
                    }
                });
            }
            
            // Мигрировать uiSettings
            if (data.uiSettings) {
                ['currentDate', 'baseDate'].forEach(key => {
                    if (data.uiSettings[key] && typeof data.uiSettings[key] === 'string') {
                        const dateObj = new Date(data.uiSettings[key]);
                        if (!isNaN(dateObj.getTime())) {
                            data.uiSettings[key] = dateObj.getTime();
                            migrated = true;
                            migratedCount++;
                            console.log(`Мигрирован ${key}:`, data.uiSettings[key]);
                        }
                    }
                });
            }
            
            if (migrated) {
                localStorage.setItem('appData', JSON.stringify(data));
                console.log(`Миграция завершена успешно! Конвертировано ${migratedCount} значений в timestamp формат.`);
                
                // Добавляем метку о миграции
                if (!data.migrationInfo) {
                    data.migrationInfo = {};
                }
                data.migrationInfo.timestampMigration = {
                    migratedAt: new Date().getTime(),
                    migratedCount: migratedCount,
                    version: '1.0'
                };
                
                localStorage.setItem('appData', JSON.stringify(data));
                
                return true;
            } else {
                console.log('Миграция не требуется - данные уже в timestamp формате');
                return false;
            }
        } catch (e) {
            console.error('Ошибка миграции в timestamp:', e);
            return false;
        }
    }
    
    static isTimestamp(value) {
        return typeof value === 'number' && !isNaN(value) && value > 0;
    }
    
    static checkDataFormat() {
        const saved = localStorage.getItem('appData');
        if (!saved) return 'no_data';
        
        try {
            const data = JSON.parse(saved);
            let timestampCount = 0;
            let stringCount = 0;
            
            // Проверяем dates
            if (data.dates) {
                data.dates.forEach(date => {
                    if (date.date) {
                        if (this.isTimestamp(date.date)) {
                            timestampCount++;
                        } else if (typeof date.date === 'string') {
                            stringCount++;
                        }
                    }
                });
            }
            
            // Проверяем notes
            if (data.notes) {
                data.notes.forEach(note => {
                    if (note.date) {
                        if (this.isTimestamp(note.date)) {
                            timestampCount++;
                        } else if (typeof note.date === 'string') {
                            stringCount++;
                        }
                    }
                });
            }
            
            if (timestampCount > 0 && stringCount === 0) {
                return 'timestamp_only';
            } else if (stringCount > 0 && timestampCount === 0) {
                return 'string_only';
            } else if (timestampCount > 0 && stringCount > 0) {
                return 'mixed';
            } else {
                return 'unknown';
            }
        } catch (e) {
            return 'error';
        }
    }
    
    static showMigrationReport() {
        const format = this.checkDataFormat();
        let message = '';
        
        switch(format) {
            case 'timestamp_only':
                message = '✓ Данные уже в timestamp формате';
                break;
            case 'string_only':
                message = '⚠ Данные в строковом формате, требуется миграция';
                break;
            case 'mixed':
                message = '⚠ Данные в смешанном формате, требуется миграция';
                break;
            case 'no_data':
                message = 'ℹ Нет сохраненных данных';
                break;
            case 'error':
                message = '✗ Ошибка проверки формата данных';
                break;
            default:
                message = '? Неизвестный формат данных';
        }
        
        console.log('Проверка формата данных:', message);
        return { format, message };
    }
}

window.TimestampMigrator = TimestampMigrator;

// Автоматический запуск миграции при загрузке страницы
document.addEventListener('DOMContentLoaded', () => {
    console.log('TimestampMigrator: проверка и миграция данных...');
    const report = TimestampMigrator.showMigrationReport();
    
    if (report.format === 'string_only' || report.format === 'mixed') {
        console.log('Обнаружены данные для миграции...');
        const migrated = TimestampMigrator.migrateAllData();
        if (migrated) {
            console.log('Миграция выполнена успешно!');
        }
    }
});