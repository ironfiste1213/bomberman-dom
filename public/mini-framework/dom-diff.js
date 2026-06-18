/**
 * DOM-DIFF.JS
 * 
 * Compares old and new virtual DOM trees to generate patches (minimal changes).
 * Returns a Map where keys are paths and values are arrays of patches.
 * 
 * Patch types:
 * - CREATE: New element added
 * - REMOVE: Element removed
 * - REPLACE: Element type completely different
 * - UPDATE_PROPS: Attributes/properties changed
 * - UPDATE_TEXT: Text content changed
 */

const PATCH_TYPES = {
    CREATE: 'CREATE',
    REMOVE: 'REMOVE',
    REPLACE: 'REPLACE',
    UPDATE_PROPS: 'UPDATE_PROPS',
    UPDATE_TEXT: 'UPDATE_TEXT'
};

export function diff(oldVdom, newVdom, path = '') {
    const patches = new Map();

    // Treat undefined and null the same
    const oldIsNullish = oldVdom == null;
    const newIsNullish = newVdom == null;

    // Nothing on either side
    if (oldIsNullish && newIsNullish) {
        return patches;
    }

    // Create
    if (oldIsNullish && !newIsNullish) {
        patches.set(path, [{ type: PATCH_TYPES.CREATE, vdom: newVdom }]);
        return patches;
    }

    // Remove
    if (!oldIsNullish && newIsNullish) {
        patches.set(path, [{ type: PATCH_TYPES.REMOVE, vdom: oldVdom }]);
        return patches;
    }

    // Text node
    const oldIsText = typeof oldVdom === 'string' || typeof oldVdom === 'number';
    const newIsText = typeof newVdom === 'string' || typeof newVdom === 'number';

    if (oldIsText && newIsText) {
        const oldText = oldVdom.toString();
        const newText = newVdom.toString();
        if (oldText !== newText) {
            patches.set(path, [{ type: PATCH_TYPES.UPDATE_TEXT, text: newText }]);
        }
        return patches;
    }

    // Node type changed (text <-> element)
    if (oldIsText !== newIsText) {
        patches.set(path, [{ type: PATCH_TYPES.REPLACE, vdom: newVdom }]);
        return patches;
    }

    // Different keys (Force replace)
    const oldKey = oldVdom.props ? oldVdom.props.key : undefined;
    const newKey = newVdom.props ? newVdom.props.key : undefined;
    if (oldKey !== newKey) {
        patches.set(path, [{ type: PATCH_TYPES.REPLACE, vdom: newVdom }]);
        return patches;
    }

    // Different tags
    if (oldVdom.tag !== newVdom.tag) {
        patches.set(path, [{ type: PATCH_TYPES.REPLACE, vdom: newVdom }]);
        return patches;
    }

    // Same tag: compare props and children
    // Compare props
    const propPatches = diffProps(oldVdom.props || {}, newVdom.props || {});
    if (propPatches.length > 0) {
        const list = patches.get(path) || [];
        patches.set(path, [...list, ...propPatches]);
    }

    // Compare children
    const oldChildren = oldVdom.children || [];
    const newChildren = newVdom.children || [];
    const maxLen = Math.max(oldChildren.length, newChildren.length);

    for (let i = 0; i < maxLen; i++) {
        const childPath = path === '' ? `${i}` : `${path},${i}`;
        const childPatches = diff(oldChildren[i], newChildren[i], childPath);

        // Merge child patches into main patches
        childPatches.forEach((patchList, key) => {
            const existing = patches.get(key) || [];
            patches.set(key, [...existing, ...patchList]);
        });
    }

    return patches;
}

// Helper: Compare props → return array of prop patches
function diffProps(oldProps = {}, newProps = {}) {
    const patches = [];
    const allKeys = new Set([...Object.keys(oldProps), ...Object.keys(newProps)]);

    allKeys.forEach(key => {
        const oldVal = oldProps[key];
        const newVal = newProps[key];

        // be careful Ousama when rendering, if the prop is removed, newVal will be undefined, so the condition will be met and a patch will be created ; that's why u should check if the value is undefined and handle it accordingly
        // Always patch 'checked' and 'value' because DOM state might have changed (user interaction)
        // even if VDOM props look the same (e.g. index-based diffing reusing dirty elements)
        if (oldVal !== newVal || key === 'checked' || key === 'value') {
            patches.push({
                type: PATCH_TYPES.UPDATE_PROPS,
                key: key,
                value: newVal  // undefined value means remove the prop
            });
        }
    });

    return patches;
}
