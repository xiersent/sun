/**
 * @file nestedListDnD.js
 * Общая логика drag-and-drop вложенных строк (волны и персоны в группах).
 */
(function (global) {
    const SPECS = {
        wave: {
            payloadType: 'wave',
            itemSelector: '.sun-listItemWave',
            parentSelector: '.sun-listItemGroup[data-type="group"]',
            childRowSelector: '.sun-listItemWave',
            move(manager, sourceG, targetG, fromIdx, toIdx, insertBefore, opts) {
                return manager.moveWaveBetweenGroups(
                    sourceG,
                    targetG,
                    fromIdx,
                    toIdx,
                    insertBefore,
                    opts
                );
            },
            targetListLength(targetGroupId) {
                const g = window.appState.data.groups.find((x) => String(x.id) === String(targetGroupId));
                return g && Array.isArray(g.waves) ? g.waves.length : 0;
            },
            logEmpty(scope, detail) {
                window.sunPerfLog(scope, 'nestedDnD.wave.drop.emptyZone', detail);
            },
            logRow(scope, detail) {
                window.sunPerfLog(scope, 'nestedDnD.wave.drop.onRow', detail);
            },
            logSkip(scope, detail) {
                window.sunPerfLog(scope, 'nestedDnD.wave.drop.skipNoop', detail);
            },
            logDragStart(scope, detail) {
                window.sunPerfLog(scope, 'nestedDnD.wave.dragstart', detail);
            },
            logDragEnd(scope, detail) {
                window.sunPerfLog(scope, 'nestedDnD.wave.dragend', detail);
            }
        },
        date: {
            payloadType: 'date',
            itemSelector: '.sun-listItemDate[data-type="date"]',
            parentSelector: '.sun-listItemPersonGroup[data-type="personGroup"]',
            childRowSelector: '.sun-listItemDate[data-type="date"]',
            move(manager, sourceG, targetG, fromIdx, toIdx, insertBefore, opts) {
                return manager.moveDateBetweenPersonGroups(
                    sourceG,
                    targetG,
                    fromIdx,
                    toIdx,
                    insertBefore,
                    opts
                );
            },
            targetListLength(targetGroupId) {
                const g = (window.appState.data.personGroups || []).find(
                    (x) => String(x.id) === String(targetGroupId)
                );
                return g && Array.isArray(g.dates) ? g.dates.length : 0;
            },
            logEmpty(scope, detail) {
                window.sunPerfLog(scope, 'nestedDnD.date.drop.emptyZone', detail);
            },
            logRow(scope, detail) {
                window.sunPerfLog(scope, 'nestedDnD.date.drop.onRow', detail);
            },
            logSkip(scope, detail) {
                window.sunPerfLog(scope, 'nestedDnD.date.drop.skipNoop', detail);
            },
            logDragStart(scope, detail) {
                window.sunPerfLog(scope, 'nestedDnD.date.dragstart', detail);
            },
            logDragEnd(scope, detail) {
                window.sunPerfLog(scope, 'nestedDnD.date.dragend', detail);
            }
        }
    };

    /** Возвращает SPECS.wave или SPECS.date по типу payload. */
    function specForPayload(payload) {
        if (!payload || (payload.type !== 'wave' && payload.type !== 'date')) return null;
        return SPECS[payload.type === 'wave' ? 'wave' : 'date'];
    }

    /** Читает nestedItemDragPayload из eventManager. */
    function resolvePayload(manager, e) {
        if (manager.nestedItemDragPayload) {
            const s = specForPayload(manager.nestedItemDragPayload);
            if (s) return manager.nestedItemDragPayload;
        }
        try {
            const raw = e.originalEvent.dataTransfer.getData('text/plain');
            if (raw) {
                const parsed = JSON.parse(raw);
                if (parsed && (parsed.type === 'wave' || parsed.type === 'date')) return parsed;
            }
        } catch (_) {}
        return null;
    }

    /** Сбрасывает классы подсветки nested DnD. */
    function clearNestedDnDVisuals(manager) {
        if (manager._nestedDragOverItemEl) {
            manager._nestedDragOverItemEl.classList.remove(
                'sun-listItemDragOverTop',
                'sun-listItemDragOverBottom'
            );
            manager._nestedDragOverItemEl = null;
        }
        if (manager._nestedChildrenDropEl) {
            manager._nestedChildrenDropEl.classList.remove('sun-groupChildrenDragOver');
            manager._nestedChildrenDropEl = null;
        }
    }

    /** Начало DnD вложенной строки (волна или персона). */
    function dragStart(manager, e, kind) {
        const spec = SPECS[kind];
        const $ = manager.$;
        const $item = $(e.currentTarget).closest(spec.itemSelector);
        const $parent = $item.closest(spec.parentSelector);
        const id = $item.data('id');
        const index = parseInt($item.data('index') || 0, 10);
        const groupId = $parent.data('id');

        if (id == null || id === '' || index < 0 || groupId == null || groupId === '') {
            e.preventDefault();
            return;
        }

        clearNestedDnDVisuals(manager);
        manager.nestedItemDragPayload = {
            type: spec.payloadType,
            id,
            index,
            groupId,
            source: `${kind}-nested-drag`
        };

        e.originalEvent.dataTransfer.effectAllowed = 'move';
        e.originalEvent.dataTransfer.setData('text/plain', JSON.stringify(manager.nestedItemDragPayload));

        $item.addClass('sun-listItemDragging');
        spec.logDragStart('eventManager', {
            kind,
            id,
            groupId,
            index
        });
    }

    /** dragover по строке волны/персоны внутри группы. */
    function dragOverOnChildRow(manager, e, kind) {
        const spec = SPECS[kind];
        if (!manager.nestedItemDragPayload || manager.nestedItemDragPayload.type !== spec.payloadType) {
            return;
        }
        const dragData = manager.nestedItemDragPayload;
        const $ = manager.$;

        e.preventDefault();
        e.stopPropagation();

        const $item = $(e.currentTarget);
        const itemEl = $item[0];
        const $group = $item.closest(spec.parentSelector);
        const targetGroupId = $group.data('id');

        if (manager._nestedChildrenDropEl) {
            manager._nestedChildrenDropEl.classList.remove('sun-groupChildrenDragOver');
            manager._nestedChildrenDropEl = null;
        }

        if (
            String(dragData.groupId) === String(targetGroupId) &&
            String(dragData.id) === String($item.data('id'))
        ) {
            e.originalEvent.dataTransfer.dropEffect = 'move';
            if (manager._nestedDragOverItemEl && manager._nestedDragOverItemEl !== itemEl) {
                manager._nestedDragOverItemEl.classList.remove(
                    'sun-listItemDragOverTop',
                    'sun-listItemDragOverBottom'
                );
                manager._nestedDragOverItemEl = null;
            }
            return;
        }

        e.originalEvent.dataTransfer.dropEffect = 'move';

        const rect = itemEl.getBoundingClientRect();
        const y = e.clientY;
        const insertPosition = y - rect.top < rect.height / 2 ? 'before' : 'after';

        if (manager._nestedDragOverItemEl && manager._nestedDragOverItemEl !== itemEl) {
            manager._nestedDragOverItemEl.classList.remove(
                'sun-listItemDragOverTop',
                'sun-listItemDragOverBottom'
            );
        }
        manager._nestedDragOverItemEl = itemEl;

        if (insertPosition === 'before') {
            $item.addClass('sun-listItemDragOverTop');
            $item.removeClass('sun-listItemDragOverBottom');
        } else {
            $item.addClass('sun-listItemDragOverBottom');
            $item.removeClass('sun-listItemDragOverTop');
        }
    }

    /** dragover по пустой зоне .sun-groupChildren. */
    function childrenContainerDragOver(manager, e, kind) {
        const spec = SPECS[kind];
        if (!manager.nestedItemDragPayload || manager.nestedItemDragPayload.type !== spec.payloadType) {
            return;
        }
        const $ = manager.$;
        if ($(e.target).closest(spec.childRowSelector).length) {
            e.preventDefault();
            e.originalEvent.dataTransfer.dropEffect = 'move';
            return;
        }

        e.preventDefault();
        e.stopPropagation();

        if (manager._nestedDragOverItemEl) {
            manager._nestedDragOverItemEl.classList.remove(
                'sun-listItemDragOverTop',
                'sun-listItemDragOverBottom'
            );
            manager._nestedDragOverItemEl = null;
        }

        const gc = e.currentTarget;
        if (manager._nestedChildrenDropEl && manager._nestedChildrenDropEl !== gc) {
            manager._nestedChildrenDropEl.classList.remove('sun-groupChildrenDragOver');
        }
        manager._nestedChildrenDropEl = gc;
        gc.classList.add('sun-groupChildrenDragOver');
        e.originalEvent.dataTransfer.dropEffect = 'move';
    }

    /** dragleave с контейнера дочерних элементов. */
    function childrenContainerDragLeave(manager, e) {
        const $gc = manager.$(e.currentTarget);
        const related = e.originalEvent.relatedTarget;
        if (related && $gc[0].contains(related)) {
            return;
        }
        $gc.removeClass('sun-groupChildrenDragOver');
    }

    /** drop в пустую область списка дочерних строк. */
    function dropOnEmptyChildrenZone(manager, e, kind) {
        const spec = SPECS[kind];
        if (!manager.nestedItemDragPayload || manager.nestedItemDragPayload.type !== spec.payloadType) {
            return;
        }
        const $ = manager.$;
        if ($(e.target).closest(spec.childRowSelector).length) {
            return;
        }

        const dragData = resolvePayload(manager, e);
        if (!dragData || dragData.type !== spec.payloadType) {
            return;
        }

        e.preventDefault();
        e.stopPropagation();

        clearNestedDnDVisuals(manager);

        const $gc = $(e.currentTarget);
        const $group = $gc.closest(spec.parentSelector);
        const targetGroupId = $group.data('id');
        if (!targetGroupId) {
            return;
        }

        const insertAtEnd = spec.targetListLength(targetGroupId);
        spec.logEmpty('eventManager', {
            fromGroup: dragData.groupId,
            toGroup: targetGroupId,
            fromIndex: dragData.index
        });
        spec.move(manager, dragData.groupId, targetGroupId, dragData.index, insertAtEnd, false, {
            emptyOrGapDrop: true,
            sourceItemId: dragData.id
        });
    }

    /** drop на строку: перестановка или перенос между группами. */
    function dropOnChildRow(manager, e, kind) {
        const spec = SPECS[kind];
        if (!manager.nestedItemDragPayload || manager.nestedItemDragPayload.type !== spec.payloadType) {
            return;
        }

        const $item = manager.$(e.currentTarget);
        e.preventDefault();
        e.stopPropagation();

        clearNestedDnDVisuals(manager);

        const dragData = resolvePayload(manager, e);
        if (!dragData || dragData.type !== spec.payloadType) {
            return;
        }

        const $group = $item.closest(spec.parentSelector);
        const targetGroupId = $group.data('id');
        const targetIndex = parseInt($item.data('index') || 0, 10);

        const rect = $item[0].getBoundingClientRect();
        const y = e.clientY;
        const insertBefore = y - rect.top < rect.height / 2;

        if (
            String(dragData.groupId) === String(targetGroupId) &&
            String(dragData.id) === String($item.data('id'))
        ) {
            spec.logSkip('eventManager', { targetGroupId, targetIndex, itemId: dragData.id });
            return;
        }

        spec.logRow('eventManager', {
            fromGroup: dragData.groupId,
            toGroup: targetGroupId,
            fromIndex: dragData.index,
            targetIndex,
            insertBefore
        });
        spec.move(manager, dragData.groupId, targetGroupId, dragData.index, targetIndex, insertBefore, {
            emptyOrGapDrop: false,
            sourceItemId: dragData.id
        });
    }

    /** dragleave со строки вложенного элемента. */
    function dragLeaveChildRow(manager, e, kind) {
        const spec = SPECS[kind];
        if (!manager.nestedItemDragPayload || manager.nestedItemDragPayload.type !== spec.payloadType) {
            return;
        }
        const $item = manager.$(e.currentTarget);
        const el = $item[0];
        if (
            e.originalEvent.relatedTarget &&
            !el.contains(e.originalEvent.relatedTarget)
        ) {
            $item.removeClass('sun-listItemDragOverTop sun-listItemDragOverBottom');
            if (manager._nestedDragOverItemEl === el) {
                manager._nestedDragOverItemEl = null;
            }
        }
    }

    /** Завершение DnD: очистка payload и CSS. */
    function dragEnd(manager, e, kind) {
        const spec = SPECS[kind];
        spec.logDragEnd('eventManager', { kind });
        manager.nestedItemDragPayload = null;
        clearNestedDnDVisuals(manager);
        const src =
            e.target && e.target.closest ? e.target.closest(spec.itemSelector) : null;
        if (src) {
            src.classList.remove('sun-listItemDragging');
        }
    }

    /** Контейнеры вложенного списка: только своя панель (без пересечения с .sun-groupChildren групп волн). */
    const WAVE_NESTED_CHILDREN = '.sun-wavesList .sun-listItemGroup[data-type="group"] .sun-groupChildren';
    const DATE_NESTED_CHILDREN = '.sun-dateListForDates .sun-personGroupChildren';
    const NESTED_CONTAINERS = `${WAVE_NESTED_CHILDREN}, ${DATE_NESTED_CHILDREN}`;

    /** dragover по .sun-groupChildren / .sun-personGroupChildren. */
    function nestedContainersDragOver(manager, e) {
        const $t = manager.$(e.target);
        if ($t.closest('.sun-wavesList').length) {
            childrenContainerDragOver(manager, e, 'wave');
        } else if ($t.closest('.sun-dateListForDates').length) {
            childrenContainerDragOver(manager, e, 'date');
        }
    }

    /** dragleave вложенного контейнера группы. */
    function nestedContainersDragLeave(manager, e) {
        childrenContainerDragLeave(manager, e);
    }

    /** drop на пустую зону списка дочерних элементов. */
    function nestedContainersDrop(manager, e) {
        const $t = manager.$(e.target);
        if ($t.closest('.sun-wavesList').length) {
            dropOnEmptyChildrenZone(manager, e, 'wave');
        } else if ($t.closest('.sun-dateListForDates').length) {
            dropOnEmptyChildrenZone(manager, e, 'date');
        }
    }

    /** dragover по строке волны/персоны внутри группы. */
    function nestedChildRowsDragOver(manager, e) {
        if (manager.$(e.currentTarget).is('.sun-listItemWave')) {
            dragOverOnChildRow(manager, e, 'wave');
        } else {
            dragOverOnChildRow(manager, e, 'date');
        }
    }

    /** drop на строку: перестановка или перенос между группами. */
    function nestedChildRowsDrop(manager, e) {
        if (manager.$(e.currentTarget).is('.sun-listItemWave')) {
            dropOnChildRow(manager, e, 'wave');
        } else {
            dropOnChildRow(manager, e, 'date');
        }
    }

    /** dragleave со строки вложенного элемента. */
    function nestedChildRowsDragLeave(manager, e) {
        if (manager.$(e.currentTarget).is('.sun-listItemWave')) {
            dragLeaveChildRow(manager, e, 'wave');
        } else {
            dragLeaveChildRow(manager, e, 'date');
        }
    }

    global.SunNestedListDnD = {
        SPECS,
        specForPayload,
        resolvePayload,
        clearNestedDnDVisuals,
        dragStart,
        dragOverOnChildRow,
        childrenContainerDragOver,
        childrenContainerDragLeave,
        dropOnEmptyChildrenZone,
        dropOnChildRow,
        dragLeaveChildRow,
        dragEnd,
        NESTED_CONTAINERS,
        WAVE_NESTED_CHILDREN,
        DATE_NESTED_CHILDREN,
        nestedContainersDragOver,
        nestedContainersDragLeave,
        nestedContainersDrop,
        nestedChildRowsDragOver,
        nestedChildRowsDrop,
        nestedChildRowsDragLeave
    };
})(typeof window !== 'undefined' ? window : this);
