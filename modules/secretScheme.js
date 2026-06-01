/**
 * @file secretScheme.js
 * Секретная схема 8×15 ячеек: коды квартир, группы волн, привязка к сигналам.
 */
const SecretScheme = {
    floorMin: 1,
    floorMax: 5,
    colsPerFloor: 3,
    cellsPerEntrance: 15,
    entranceMin: 1,
    entrancesPerRow: 8,
    totalCells: 120,
    defaultGroupId: 'classic-group',
    selectedGroupId: 'classic-group',
    defaultAnchorCode: 41,
    anchorCode: 41,
    reversed: false,
    emptyCellBg: '#ffffff',

    /** Число подъездов (totalCells / cellsPerEntrance). */
    entranceCount() {
        return this.totalCells / this.cellsPerEntrance;
    },

    /** Первый код ячейки подъезда. */
    entranceStart(entrance) {
        return 1 + (entrance - 1) * this.cellsPerEntrance;
    },

    /**
     * Номер ячейки: старт подъезда + (этаж − 1)·3 + (колонка 0…2).
     * Этаж 1 — нижний ряд сетки, этаж 5 — верхний.
     * Подъезд 1: 1–15 … подъезд 8: 106–120 (41 = 3п, 4 эт., яч. 2).
     */
    codeAt(entrance, floor, col) {
        return this.entranceStart(entrance) + (floor - 1) * this.colsPerFloor + col;
    },

    /** Разбор кода ячейки в { entrance, floor, col }. */
    decodeCode(code) {
        const n = Number(code);
        if (!Number.isFinite(n) || n < 1) {
            return null;
        }
        const entrance = Math.ceil(n / this.cellsPerEntrance);
        if (entrance < this.entranceMin || entrance > this.entranceCount()) {
            return null;
        }
        const local = n - this.entranceStart(entrance);
        if (local < 0 || local >= this.cellsPerEntrance) {
            return null;
        }
        const floor = Math.floor(local / this.colsPerFloor) + 1;
        const col = local % this.colsPerFloor;
        return { entrance, floor, col };
    },

    /** Массив номеров подъездов 1…N. */
    entrances() {
        const list = [];
        for (let e = this.entranceMin; e <= this.entranceCount(); e++) {
            list.push(e);
        }
        return list;
    },

    /** Подъезды с учётом reversed. */
    entrancesForDisplay() {
        const list = this.entrances();
        return this.reversed ? list.slice().reverse() : list;
    },

    /**
     * Наоборот: вид с другой стороны — подъезды 8…1, в ряду №1 внизу справа, №2 левее.
     */
    codeForVisualSlot(visualEntrance, visualFloor, visualCol) {
        if (!this.reversed) {
            return this.codeAt(visualEntrance, visualFloor, visualCol);
        }
        const col = this.colsPerFloor - 1 - visualCol;
        return this.codeAt(visualEntrance, visualFloor, col);
    },

    /** Этажи сверху вниз (5…1). */
    floorsForDisplay() {
        const list = [];
        for (let f = this.floorMax; f >= this.floorMin; f--) {
            list.push(f);
        }
        return list;
    },

    /** Колонки 0…2 с учётом reversed. */
    colsForDisplay() {
        const list = [];
        for (let c = 0; c < this.colsPerFloor; c++) {
            list.push(c);
        }
        return list;
    },

    /** Внутренний метод groups. */
    _groups() {
        return window.appState?.data?.groups || [];
    },

    /** Внутренний метод waves. */
    _waves() {
        return window.appState?.data?.waves || [];
    },

    /** Внутренний метод selectedGroup. */
    _selectedGroup() {
        const groups = this._groups();
        const found = groups.find((g) => String(g.id) === String(this.selectedGroupId));
        if (found) {
            return found;
        }
        return groups.find((g) => String(g.id) === this.defaultGroupId) || groups[0] || null;
    },

    /** Внутренний метод waveIdForCode. */
    _waveIdForCode(code, group) {
        if (!group?.waves?.length) {
            return null;
        }
        const codeStr = String(code);
        const waveIds = group.waves.map((w) => String(w));

        if (waveIds.includes(codeStr)) {
            return codeStr;
        }

        const prefixed = [
            `wave-120-${code}`,
            `wave-31-${code}`,
            `wave-1000-${code}`
        ];
        for (let i = 0; i < prefixed.length; i++) {
            if (waveIds.includes(prefixed[i])) {
                return prefixed[i];
            }
        }

        return null;
    },

    /** Внутренний метод findWave. */
    _findWave(waveId) {
        if (waveId == null) {
            return null;
        }
        const idStr = String(waveId);
        return this._waves().find((w) => String(w.id) === idStr) || null;
    },

    /** Цвет ячейки схемы по коду и группе волн. */
    colorForCode(code) {
        const group = this._selectedGroup();
        const waveId = this._waveIdForCode(code, group);
        const wave = this._findWave(waveId);
        return wave?.color || this.emptyCellBg;
    },

    /** Внутренний метод cellBgOpacity. */
    _cellBgOpacity() {
        return 0.55;
    },

    /** Внутренний метод parseHexColor. */
    _parseHexColor(hex) {
        if (!hex || typeof hex !== 'string' || hex.charAt(0) !== '#') {
            return null;
        }
        const raw = hex.slice(1);
        const full =
            raw.length === 3
                ? raw
                      .split('')
                      .map((c) => c + c)
                      .join('')
                : raw.slice(0, 6);
        const r = parseInt(full.slice(0, 2), 16);
        const g = parseInt(full.slice(2, 4), 16);
        const b = parseInt(full.slice(4, 6), 16);
        if ([r, g, b].some((v) => Number.isNaN(v))) {
            return null;
        }
        return { r, g, b };
    },

    /** Внутренний метод waveColorWithOpacity. */
    _waveColorWithOpacity(hex) {
        if (
            !hex ||
            String(hex).toLowerCase() === String(this.emptyCellBg).toLowerCase()
        ) {
            return this.emptyCellBg;
        }
        const rgb = this._parseHexColor(hex);
        if (!rgb) {
            return hex;
        }
        const a = this._cellBgOpacity();
        return `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${a})`;
    },

    /** Внутренний метод textColorForBg. */
    _textColorForBg(hex) {
        const rgb = this._parseHexColor(hex);
        if (!rgb) {
            return '#333333';
        }
        const lum =
            (0.299 * rgb.r + 0.587 * rgb.g + 0.114 * rgb.b) / 255;
        return lum > 0.62 ? '#333333' : '#ffffff';
    },

    /** Внутренний метод styleCell. */
    _styleCell(cell, code) {
        const waveColor = this.colorForCode(code);
        cell.style.backgroundColor = this._waveColorWithOpacity(waveColor);
        cell.style.color = this._textColorForBg(waveColor);
    },

    /** Применяет цвета ячеек сетки секретной схемы. */
    applyCellColors() {
        const board = window.dom.byKey('secretSchemeGrid');
        if (!board) {
            return;
        }
        board.querySelectorAll('.sun-secretSchemeCell').forEach((cell) => {
            const code = Number(cell.dataset.code);
            if (Number.isFinite(code)) {
                this._styleCell(cell, code);
            }
        });
        const group = this._selectedGroup();
        if (group) {
            board.dataset.colorGroup = String(group.id);
        }
    },

    /** Внутренний метод maxWavesPerGroup. */
    _maxWavesPerGroup() {
        return this.totalCells;
    },

    /** Внутренний метод groupsForSelect. */
    _groupsForSelect() {
        const maxWaves = this._maxWavesPerGroup();
        return this._groups().filter((g) => {
            if (g.hidden) {
                return false;
            }
            const count = Array.isArray(g.waves) ? g.waves.length : 0;
            return count <= maxWaves;
        });
    },

    /** Внутренний метод populateGroupSelect. */
    _populateGroupSelect(select) {
        select.textContent = '';
        const groups = this._groupsForSelect();
        groups.forEach((group) => {
            const opt = document.createElement('option');
            opt.value = String(group.id);
            opt.textContent = group.name || String(group.id);
            select.appendChild(opt);
        });
        const hasSelected = groups.some(
            (g) => String(g.id) === String(this.selectedGroupId)
        );
        if (!hasSelected) {
            const classic = groups.find(
                (g) => String(g.id) === this.defaultGroupId
            );
            this.selectedGroupId = classic
                ? classic.id
                : groups[0]?.id || this.defaultGroupId;
        }
        select.value = String(this.selectedGroupId);
    },

    /** Внутренний метод syncAnchorHighlight. */
    _syncAnchorHighlight() {
        const board = window.dom.byKey('secretSchemeGrid');
        if (!board) {
            return;
        }
        const anchor = Number(this.anchorCode);
        board.querySelectorAll('.sun-secretSchemeCell').forEach((cell) => {
            const code = Number(cell.dataset.code);
            cell.classList.toggle(
                'sun-secretSchemeCellAnchor',
                Number.isFinite(code) && code === anchor
            );
        });
    },

    /** Внутренний метод makeControl. */
    _makeControl(labelText, selectId, ariaLabel) {
        const item = document.createElement('div');
        const label = document.createElement('label');
        label.className = 'sun-secretSchemeControlLabel';
        label.htmlFor = selectId;
        label.append(`${labelText} `);

        const select = document.createElement('select');
        select.id = selectId;
        select.className = 'sun-secretSchemeControlSelect sun-formInput';
        select.setAttribute('aria-label', ariaLabel);

        label.append(select);
        item.appendChild(label);
        return { item, select };
    },

    /** Внутренний метод buildControls. */
    _buildControls() {
        const bar = document.createElement('div');
        bar.className = 'sun-secretSchemeControls';

        const group = this._makeControl(
            'Группа волн:',
            'secretSchemeGroupSelect',
            'Группа волн для окраски ячеек'
        );
        this._populateGroupSelect(group.select);
        group.select.addEventListener('change', () => {
            this.selectedGroupId = group.select.value;
            this.applyCellColors();
        });
        bar.appendChild(group.item);

        const anchor = this._makeControl(
            'Текущая:',
            'secretSchemeAnchorSelect',
            'Текущая ячейка схемы'
        );
        for (let n = 1; n <= this.totalCells; n++) {
            const opt = document.createElement('option');
            opt.value = String(n);
            opt.textContent = String(n);
            anchor.select.appendChild(opt);
        }
        anchor.select.value = String(this.anchorCode);
        anchor.select.addEventListener('change', () => {
            const n = Number(anchor.select.value);
            if (Number.isFinite(n) && n >= 1 && n <= this.totalCells) {
                this.anchorCode = n;
                this._syncAnchorHighlight();
            }
        });
        bar.appendChild(anchor.item);

        const reverse = this._makeControl(
            'Представление:',
            'secretSchemeReverseSelect',
            'Представление схемы дома'
        );
        const optNormal = document.createElement('option');
        optNormal.value = 'normal';
        optNormal.textContent = 'Обычно';
        const optReversed = document.createElement('option');
        optReversed.value = 'reversed';
        optReversed.textContent = 'Наоборот';
        reverse.select.append(optNormal, optReversed);
        reverse.select.value = this.reversed ? 'reversed' : 'normal';
        reverse.select.addEventListener('change', () => {
            this.reversed = reverse.select.value === 'reversed';
            this._rebuildBoardBody();
        });
        bar.appendChild(reverse.item);

        return bar;
    },

    /** Внутренний метод buildEntranceBlock. */
    _buildEntranceBlock(entrance) {
        const block = document.createElement('div');
        block.className = 'sun-secretSchemeBlock';
        block.dataset.entrance = String(entrance);

        const start = this.entranceStart(entrance);
        const end = start + this.cellsPerEntrance - 1;

        const title = document.createElement('div');
        title.className = 'sun-secretSchemeBlockTitle';
        title.textContent = `${entrance} подъезд (${start}–${end})`;
        block.appendChild(title);

        const mini = document.createElement('div');
        mini.className = 'sun-secretSchemeMiniGrid';
        mini.setAttribute('role', 'grid');
        mini.setAttribute('aria-label', `Подъезд ${entrance}, этажи 1–5`);

        const floors = this.floorsForDisplay();
        const cols = this.colsForDisplay();
        floors.forEach((floor) => {
            cols.forEach((col) => {
                const code = this.codeForVisualSlot(entrance, floor, col);
                const loc = this.decodeCode(code);
                const cell = document.createElement('div');
                cell.className = 'sun-secretSchemeCell';
                if (code === this.anchorCode) {
                    cell.classList.add('sun-secretSchemeCellAnchor');
                }
                cell.setAttribute('role', 'gridcell');
                cell.dataset.entrance = String(loc ? loc.entrance : entrance);
                cell.dataset.floor = String(loc ? loc.floor : floor);
                cell.dataset.col = String(loc ? loc.col : col);
                cell.dataset.code = String(code);
                cell.textContent = String(code);
                this._styleCell(cell, code);
                mini.appendChild(cell);
            });
        });

        block.appendChild(mini);
        return block;
    },

    /** Внутренний метод buildEntranceWrap. */
    _buildEntranceWrap(entrance) {
        const wrap = document.createElement('div');
        wrap.className = 'sun-secretSchemeEntrance';
        wrap.dataset.entrance = String(entrance);
        wrap.appendChild(this._buildEntranceBlock(entrance));
        return wrap;
    },

    /** Внутренний метод appendEntranceRow. */
    _appendEntranceRow(container, entranceNums) {
        const row = document.createElement('div');
        row.className = 'sun-secretSchemeEntrancesRow';
        entranceNums.forEach((ent, idx) => {
            if (idx > 0) {
                const divider = document.createElement('div');
                divider.className = 'sun-secretSchemeVline';
                divider.setAttribute('aria-hidden', 'true');
                row.appendChild(divider);
            }
            row.appendChild(this._buildEntranceWrap(ent));
        });
        container.appendChild(row);
    },

    /** Внутренний метод buildBoardBody. */
    _buildBoardBody() {
        const body = document.createElement('div');
        body.className = 'sun-secretSchemeBoardBody';

        const entrances = document.createElement('div');
        entrances.className = 'sun-secretSchemeEntrances';
        const displayEntrances = this.entrancesForDisplay();
        for (let i = 0; i < displayEntrances.length; i += this.entrancesPerRow) {
            this._appendEntranceRow(
                entrances,
                displayEntrances.slice(i, i + this.entrancesPerRow)
            );
        }
        body.appendChild(entrances);
        return body;
    },

    /** Внутренний метод rebuildBoardBody. */
    _rebuildBoardBody() {
        const board = window.dom.byKey('secretSchemeGrid');
        if (!board) {
            return;
        }
        const oldBody = board.querySelector('.sun-secretSchemeBoardBody');
        if (oldBody) {
            oldBody.remove();
        }
        board.appendChild(this._buildBoardBody());
        board.dataset.reversed = this.reversed ? '1' : '0';

        const reverseSelect = window.dom.byKey('secretSchemeReverseSelect');
        if (reverseSelect) {
            reverseSelect.value = this.reversed ? 'reversed' : 'normal';
        }

        this.applyCellColors();
        this._syncAnchorHighlight();
    },

    /** Привязка UI секретной схемы и первый render. */
    init() {
        const board = window.dom.byKey('secretSchemeGrid');
        if (!board) {
            return;
        }
        const all = this.entrances();
        board.textContent = '';
        board.className = 'sun-secretSchemeBoard';
        board.dataset.entrances = String(all.length);
        board.dataset.cells = String(this.totalCells);
        board.dataset.reversed = this.reversed ? '1' : '0';
        const entranceTotal = this.entranceCount();
        board.setAttribute(
            'aria-label',
            `Подъезды 1–${entranceTotal}: ${this.totalCells} ячеек (по ${this.cellsPerEntrance}: 5 этажей × 3 в ряд)`
        );

        board.appendChild(this._buildControls());
        board.appendChild(this._buildBoardBody());

        this.applyCellColors();
        this._syncAnchorHighlight();

        const built = board.querySelectorAll('.sun-secretSchemeCell').length;
        board.dataset.cellsBuilt = String(built);
        if (built !== this.totalCells) {
            console.warn(
                `[SecretScheme] ожидалось ${this.totalCells} ячеек, собрано ${built}`
            );
        }
    }
};

window.SecretScheme = SecretScheme;
