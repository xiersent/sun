// migrations/003.js — поле description у каждой персоны (даты)
class Migration003 {
    constructor(appState) {
        this.appState = appState;
        this.description = 'Описание персоны: поле description в dates[]';
    }

    log(message, type = 'info') {
        const logEntry = `[Migration 003] ${message}`;
        console.log(logEntry);
        if (type === 'success') {
            console.log(`%c${logEntry}`, 'color: green; font-weight: bold');
        }
    }

    shouldApply() {
        const dates = this.appState.data.dates;
        if (!Array.isArray(dates) || dates.length === 0) {
            return false;
        }
        const needs = dates.some((d) => typeof d.description !== 'string');
        if (needs) {
            this.log('У части персон нет поля description', 'warning');
        }
        return needs;
    }

    async up() {
        this.log('Добавление description персонам', 'success');
        const dates = this.appState.data.dates || [];
        let n = 0;
        dates.forEach((d) => {
            if (typeof d.description !== 'string') {
                d.description = '';
                n++;
            }
        });
        this.log(`Обновлено персон: ${n}`);
    }

    async down() {
        const dates = this.appState.data.dates || [];
        dates.forEach((d) => {
            delete d.description;
        });
    }
}

window.Migration003 = Migration003;
