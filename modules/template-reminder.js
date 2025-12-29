/**
 * ⚠️ ВАЖНОЕ ПРЕДУПРЕЖДЕНИЕ ⚠️
 * 
 * НИКОГДА НЕ СОЗДАВАЙТЕ ИНЛАЙН ШАБЛОНЫ В КОДЕ!
 * ВСЕ ШАБЛОНЫ ДОЛЖНЫ БЫТЬ В ОТДЕЛЬНЫХ .EJS ФАЙЛАХ
 * 
 * ПРИЧИНЫ:
 * 1. Легче поддерживать и редактировать
 * 2. Лучшая производительность (кеширование)
 * 3. Чище код
 * 4. Возможность горячей замены
 * 
 * ВСЕГДА ИСПОЛЬЗУЙТЕ:
 * 1. templates/date-item.ejs
 * 2. templates/wave-item.ejs  
 * 3. templates/group-item.ejs
 * 
 * НЕ ИСПОЛЬЗУЙТЕ:
 * - createSimpleFallbackTemplates()
 * - Любые строковые шаблоны в коде
 * - Конкатенацию строк для HTML
 * 
 * КАК РАБОТАТЬ С ШАБЛОНАМИ:
 * 1. Создайте .ejs файл в папке templates/
 * 2. Загрузите его через unifiedListManager.initTemplates()
 * 3. Используйте unifiedListManager.getTemplate()
 */

// Автоматически импортируем напоминание
console.log('🔔 TEMPLATE-REMINDER: Все шаблоны должны быть в .ejs файлах!');
console.log('🔔 TEMPLATE-REMINDER: Никогда не создавайте инлайн шаблоны!');

// Глобальная проверка
window.checkForInlineTemplates = function() {
    console.log('🔍 Проверка на инлайн шаблоны...');
    
    // Проверяем модули на наличие инлайн HTML
    const modules = [
        'unifiedListManager',
        'uiManager', 
        'waves',
        'dates',
        'appCore'
    ];
    
    let foundInline = false;
    
    modules.forEach(moduleName => {
        if (window[moduleName]) {
            const moduleCode = window[moduleName].toString();
            // Ищем опасные паттерны
            const dangerousPatterns = [
                /innerHTML\s*=\s*['"`]/,
                /\.html\s*\(['"`]/,
                /createElement.*innerHTML/,
                /insertAdjacentHTML/,
                /document\.write/
            ];
            
            dangerousPatterns.forEach(pattern => {
                if (pattern.test(moduleCode)) {
                    console.warn(`⚠️  В модуле ${moduleName} найдены потенциально опасные конструкции!`);
                    foundInline = true;
                }
            });
        }
    });
    
    if (!foundInline) {
        console.log('✓ Инлайн шаблонов не обнаружено');
    }
    
    return !foundInline;
};

// Запускаем проверку при загрузке
document.addEventListener('DOMContentLoaded', () => {
    setTimeout(() => {
        window.checkForInlineTemplates();
    }, 3000);
});