// migrations/002.js — группы персон (порядок и вложенность, без лишней логики как у волн)
class Migration002 {
    constructor(appState) {
        this.appState = appState;
        this.description = 'Группы персон: перенос плоского списка дат в группы';
    }

    log(message, type = 'info') {
        const logEntry = `[Migration 002] ${message}`;
        console.log(logEntry);
        if (type === 'success') {
            console.log(`%c${logEntry}`, 'color: green; font-weight: bold');
        }
    }

    shouldApply() {
        const data = this.appState.data;
        const pg = data.personGroups;
        const hasDates = data.dates && data.dates.length > 0;
        const needs = hasDates && (!Array.isArray(pg) || pg.length === 0);
        if (needs) {
            this.log('Нужны группы персон для существующих дат', 'warning');
        }
        return needs;
    }

    async up() {
        this.log('Создание групп персон из текущего порядка дат', 'success');
        const data = this.appState.data;
        if (!data.dates || data.dates.length === 0) {
            data.personGroups = [];
            return;
        }
        const orderIds = data.dates.map(d => d.id);
        data.personGroups = [
            {
                id: 'default-person-group',
                name: 'По умолчанию',
                dates: orderIds.slice(),
                expanded: true
            }
        ];
        this.log(`Группа по умолчанию: персон ${orderIds.length}`);
    }

    async down() {
        this.appState.data.personGroups = [];
    }
}

window.Migration002 = Migration002;
