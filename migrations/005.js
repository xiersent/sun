// migrations/005.js — поле note у каждого сигнала (волны)
class Migration005 {
    constructor(appState) {
        this.appState = appState;
        this.description = 'Заметка к сигналу: поле note в waves[]';
    }

    log(message, type = 'info') {
        const logEntry = `[Migration 005] ${message}`;
        console.log(logEntry);
        if (type === 'success') {
            console.log(`%c${logEntry}`, 'color: green; font-weight: bold');
        }
    }

    shouldApply() {
        const waves = this.appState.data.waves;
        if (!Array.isArray(waves) || waves.length === 0) {
            return false;
        }
        const needs = waves.some((w) => typeof w.note !== 'string');
        if (needs) {
            this.log('У части сигналов нет поля note', 'warning');
        }
        return needs;
    }

    async up() {
        this.log('Добавление note сигналам', 'success');
        const waves = this.appState.data.waves || [];
        let n = 0;
        waves.forEach((w) => {
            if (typeof w.note !== 'string') {
                w.note = '';
                n++;
            }
        });
        this.log(`Обновлено сигналов: ${n}`);
    }

    async down() {
        const waves = this.appState.data.waves || [];
        waves.forEach((w) => {
            delete w.note;
        });
    }
}

window.Migration005 = Migration005;
