// optimized3/modules/dataManager.js
class DataManager {
    constructor() {
        this.elements = window.appCore ? window.appCore.elements : {};
    }
    
    updateDateList() {
        window.unifiedListManager.updateDatesList();
    }
    
    updateWavesGroups() {
        console.log('DataManager: обновление списка волн...');
        window.unifiedListManager.updateWavesList();
    }
    
    updateNotesList() {
        const container = document.getElementById('notesList');
        if (!container) return;
        
        container.innerHTML = '';
        
        if (window.appState.data.notes.length === 0) {
            const emptyMessage = document.createElement('div');
            emptyMessage.className = 'list-empty';
            emptyMessage.textContent = 'Нет сохраненных записей';
            container.appendChild(emptyMessage);
            return;
        }
        
        const sortedNotes = [...window.appState.data.notes].sort((a, b) => new Date(b.date) - new Date(a.date));
        
        sortedNotes.forEach(note => {
            // ИСПРАВЛЕНО: преобразуем ID в строку
            const noteId = String(note.id);
            
            const noteItem = document.createElement('div');
            noteItem.className = 'list-item list-item--note list-item--clickable';
            noteItem.setAttribute('data-date', note.date.toISOString());
            
            const noteDate = new Date(note.date);
            const timeString = `${noteDate.getHours().toString().padStart(2, '0')}:${noteDate.getMinutes().toString().padStart(2, '0')}`;
            
            let contentHTML = note.content;
            
            if (contentHTML.includes('<button class="spoiler-toggle"')) {
                // Уже есть спойлер
            } else {
                const lines = contentHTML.split('\n');
                if (lines.length > 0) {
                    const firstLine = lines[0];
                    const remainingLines = lines.slice(1).join('\n');
                    contentHTML = `<div class="note-content-wrapper">
                        <div class="note-time">${firstLine}</div>
                        ${remainingLines ? `<div class="note-text">${remainingLines}</div>` : ''}
                    </div>`;
                }
            }
            
            noteItem.innerHTML = `${contentHTML}
                <div class="list-item__actions">
                    <button class="note-btn delete-btn ui-btn" data-id="${noteId}">Уничтожить</button>
                </div>`;
            
            noteItem.addEventListener('click', (e) => {
                if (!e.target.classList.contains('delete-btn') && !e.target.classList.contains('spoiler-toggle')) {
                    const newDate = new Date(note.date);
                    window.appState.currentDate = new Date(newDate);
                    window.dates.recalculateCurrentDay();
                    window.grid.createGrid();
                    window.grid.updateCenterDate();
                    window.waves.updatePosition();
                    window.appState.save();
                }
            });
            
            container.appendChild(noteItem);
        });
        
        // Обработчики для кнопок удаления
        container.querySelectorAll('.delete-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const noteId = e.target.getAttribute('data-id');
                window.dates.deleteNote(noteId);
                this.updateNotesList();
                window.grid.updateGridNotesHighlight();
            });
        });
    }
}

window.dataManager = new DataManager();