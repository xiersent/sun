// migrations/004.js — поле gender у каждой персоны (даты)
class Migration004 {
    constructor(appState) {
        this.appState = appState;
        this.description = 'Пол персоны: поле gender в dates[]';
    }

    log(message, type = 'info') {
        const logEntry = `[Migration 004] ${message}`;
        console.log(logEntry);
        if (type === 'success') {
            console.log(`%c${logEntry}`, 'color: green; font-weight: bold');
        }
    }

    _normalizeGender(value) {
        if (value === 'male' || value === 'female') {
            return value;
        }
        return 'unset';
    }

    shouldApply() {
        const dates = this.appState.data.dates;
        if (!Array.isArray(dates) || dates.length === 0) {
            return false;
        }
        const needs = dates.some((d) => {
            const g = d.gender;
            return g !== 'unset' && g !== 'male' && g !== 'female';
        });
        if (needs) {
            this.log('У части персон нет поля gender или оно некорректно', 'warning');
        }
        return needs;
    }

    async up() {
        this.log('Добавление gender персонам', 'success');
        const dates = this.appState.data.dates || [];
        let n = 0;
        dates.forEach((d) => {
            const normalized = this._normalizeGender(d.gender);
            if (d.gender !== normalized) {
                d.gender = normalized;
                n++;
            }
        });
        this.log(`Обновлено персон: ${n}`);
    }

    async down() {
        const dates = this.appState.data.dates || [];
        dates.forEach((d) => {
            delete d.gender;
        });
    }
}

window.Migration004 = Migration004;
