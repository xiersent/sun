// modules/cursorTooltip.js — подсказка над курсором по центру вместо нативного title
class CursorTooltip {
    constructor() {
        this.tipEl = null;
        this.activeTarget = null;
        this.gapAbove = 10;
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

        const rect = this.tipEl.getBoundingClientRect();
        const margin = 8;
        const gap = this.gapAbove;
        const vw = window.innerWidth;
        const vh = window.innerHeight;

        let x = e.clientX - rect.width / 2;
        let y = e.clientY - rect.height - gap;

        if (x < margin) {
            x = margin;
        }
        if (x + rect.width > vw - margin) {
            x = vw - margin - rect.width;
        }
        if (y < margin) {
            y = e.clientY + gap;
        }
        if (y + rect.height > vh - margin) {
            y = vh - margin - rect.height;
        }

        this.tipEl.style.left = `${Math.round(x)}px`;
        this.tipEl.style.top = `${Math.round(y)}px`;
    }
}

window.CursorTooltip = CursorTooltip;
