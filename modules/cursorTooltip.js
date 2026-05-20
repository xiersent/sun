// modules/cursorTooltip.js — подсказка под курсором вместо нативного title
class CursorTooltip {
    constructor() {
        this.tipEl = null;
        this.activeTarget = null;
        this.offsetX = 12;
        this.offsetY = 14;
        this._inited = false;
    }

    init() {
        if (this._inited) {
            return;
        }
        this._inited = true;

        this.tipEl = document.createElement('div');
        this.tipEl.className = 'cursor-tooltip';
        this.tipEl.setAttribute('role', 'tooltip');
        this.tipEl.hidden = true;
        document.body.appendChild(this.tipEl);

        document.addEventListener('mouseover', (e) => this._onMouseOver(e), true);
        document.addEventListener('mouseout', (e) => this._onMouseOut(e), true);
        document.addEventListener('mousemove', (e) => this._onMouseMove(e), true);
        document.addEventListener('mousedown', () => this._deactivate(), true);
        document.addEventListener('scroll', () => this._deactivate(), true);
        window.addEventListener('blur', () => this._deactivate());
    }

    _getTipText(el) {
        if (!el || el.nodeType !== 1) {
            return null;
        }
        if (el.hasAttribute('data-cursor-tip')) {
            const data = el.getAttribute('data-cursor-tip');
            if (data != null && String(data).trim() !== '') {
                return data;
            }
        }
        if (el.hasAttribute('title')) {
            const title = el.getAttribute('title');
            if (title != null && String(title).trim() !== '') {
                return title;
            }
        }
        return null;
    }

    _findTarget(from) {
        let node = from;
        while (node && node.nodeType === 1 && node !== document.documentElement) {
            const text = this._getTipText(node);
            if (text) {
                return { el: node, text };
            }
            node = node.parentElement;
        }
        return null;
    }

    _onMouseOver(e) {
        const hit = this._findTarget(e.target);
        if (!hit) {
            return;
        }
        if (this.activeTarget === hit.el) {
            this._position(e);
            return;
        }
        this._activate(hit.el, hit.text, e);
    }

    _onMouseOut(e) {
        if (!this.activeTarget) {
            return;
        }
        const rel = e.relatedTarget;
        if (!rel || !this.activeTarget.contains(rel)) {
            this._deactivate();
        }
    }

    _onMouseMove(e) {
        if (!this.activeTarget) {
            return;
        }
        this._position(e);
    }

    _activate(el, text, e) {
        this._deactivate();
        this.activeTarget = el;

        if (el.hasAttribute('title')) {
            el.dataset.cursorTooltipTitle = el.getAttribute('title');
            el.removeAttribute('title');
        }

        this.tipEl.textContent = text;
        this.tipEl.hidden = false;
        this._position(e);
    }

    _deactivate() {
        if (!this.activeTarget) {
            this.tipEl.hidden = true;
            return;
        }

        const el = this.activeTarget;
        if (el.dataset.cursorTooltipTitle != null) {
            el.setAttribute('title', el.dataset.cursorTooltipTitle);
            delete el.dataset.cursorTooltipTitle;
        }

        this.activeTarget = null;
        this.tipEl.hidden = true;
        this.tipEl.textContent = '';
    }

    _position(e) {
        if (!this.tipEl || this.tipEl.hidden) {
            return;
        }

        const padX = this.offsetX;
        const padY = this.offsetY;
        let x = e.clientX + padX;
        let y = e.clientY + padY;

        const rect = this.tipEl.getBoundingClientRect();
        const margin = 8;
        const vw = window.innerWidth;
        const vh = window.innerHeight;

        if (x + rect.width > vw - margin) {
            x = e.clientX - rect.width - padX;
        }
        if (y + rect.height > vh - margin) {
            y = e.clientY - rect.height - padY;
        }
        if (x < margin) {
            x = margin;
        }
        if (y < margin) {
            y = margin;
        }

        this.tipEl.style.left = `${x}px`;
        this.tipEl.style.top = `${y}px`;
    }
}

window.CursorTooltip = CursorTooltip;
