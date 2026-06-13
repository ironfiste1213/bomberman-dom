// renderer.js
import { update, setMainComponent } from "./virtual-dom.js";

let rootContainer = null;
let mainComponent = null;

export function mount(component, container) {
    mainComponent = component;

    rootContainer = typeof container === 'string'
        ? document.querySelector(container)
        : container;

    if (!rootContainer) return;

    setMainComponent(mainComponent);
    update();
}

export function applyPatches(patches) {
    if (!rootContainer) return;

    const removePatches = [];
    const otherPatches = [];

    patches.forEach((patchList, path) => {
        patchList.forEach(patch => {
            if (patch.type === 'REMOVE') {
                removePatches.push({ path, patch });
            } else {
                otherPatches.push({ path, patch });
            }
        });
    });

    // Helper to compare paths numerically
    const comparePaths = (a, b) => {
        const arrA = a.split(',').filter(s => s !== '').map(Number);
        const arrB = b.split(',').filter(s => s !== '').map(Number);
        const len = Math.min(arrA.length, arrB.length);
        for (let i = 0; i < len; i++) {
            if (arrA[i] !== arrB[i]) return arrA[i] - arrB[i];
        }
        return arrA.length - arrB.length;
    };

    // Apply strict creations/updates first (Ascending)
    otherPatches.sort((a, b) => comparePaths(a.path, b.path));
    otherPatches.forEach(({ path, patch }) => applyPatch(path, patch));

    // Apply removals last, from bottom-up / end-to-start (Descending)
    // This prevents index shifting from affecting subsequent removals
    removePatches.sort((a, b) => comparePaths(b.path, a.path));
    removePatches.forEach(({ path, patch }) => applyPatch(path, patch));
}

function applyPatch(path, patch) {
    switch (patch.type) {
        case 'CREATE':
            {
                const newElement = createRealElement(patch.vdom);

                // First render: mount root element
                if (path === '') {
                    rootContainer.innerHTML = '';
                    rootContainer.appendChild(newElement);
                    break;
                }

                // Child create: insert into parent at index
                const parts = path.split(',');
                const childIndex = Number(parts.pop());
                const parentPath = parts.join(',');
                const parentEl = parentPath === ''
                    ? rootContainer.firstChild
                    : findElementByPath(rootContainer, parentPath);

                if (!parentEl) break;

                const beforeNode = parentEl.childNodes[childIndex] ?? null;
                parentEl.insertBefore(newElement, beforeNode);
            }
            break;

        case 'REMOVE':
            {
                const element = path === '' ? rootContainer.firstChild : findElementByPath(rootContainer, path);
                if (element && element.parentNode) element.parentNode.removeChild(element);
            }
            break;

        case 'REPLACE':
            {
                const element = path === '' ? rootContainer.firstChild : findElementByPath(rootContainer, path);
                if (!element) break;
                const replacement = createRealElement(patch.vdom);
                if (element.parentNode) element.parentNode.replaceChild(replacement, element);
            }
            break;

        case 'UPDATE_PROPS':
            {
                const element = path === '' ? rootContainer.firstChild : findElementByPath(rootContainer, path);
                if (element) applySingleProp(element, patch.key, patch.value);
            }
            break;

        case 'UPDATE_TEXT':
            {
                const element = path === '' ? rootContainer.firstChild : findElementByPath(rootContainer, path);
                if (element) element.textContent = patch.text;
            }
            break;
    }
}

function findElementByPath(container, path) {
    if (path === '') return container.firstChild;

    const indices = path.split(',').map(Number);
    let current = container.firstChild;

    for (const index of indices) {
        if (!current) return null;
        current = current.childNodes[index];
    }

    return current;
}

function applySingleProp(element, key, value) {
    
    // keep vdom only metadata out of the real DOM.
    if (key === 'key') {
        return;
    }

    // Handle event listeners (add or remove)
    if (key.startsWith('on')) {
        const eventName = key.toLowerCase().substring(2);

        // Store handler references on the element to allow removal
        if (!element._eventHandlers) {
            element._eventHandlers = {};
        }

        // Remove old listener if exists
        if (element._eventHandlers[eventName]) {
            element.removeEventListener(eventName, element._eventHandlers[eventName]);
            delete element._eventHandlers[eventName];
        }

        // Add new listener and store it
        if (value) {
            element.addEventListener(eventName, value);
            element._eventHandlers[eventName] = value;
        }

        // If value is undefined, we simply removed the old one above.
        return;
    }

    // Handle attributes
    if (value === undefined) {
        element.removeAttribute(key);
        return;
    }

    if (key === 'className') {
        element.setAttribute('class', value);
        return;
    }

    if (key === 'checked' || key === 'value') {
        element[key] = value;
        return;
    }

    element.setAttribute(key, value);
}

export function createRealElement(vdom) {
    if (typeof vdom === 'string' || typeof vdom === 'number') {
        return document.createTextNode(vdom.toString());
    }

    if (!vdom) {
        return document.createTextNode('');
    }

    const element = document.createElement(vdom.tag);

    if (vdom.props) {
        Object.entries(vdom.props).forEach(([key, value]) => {
            applySingleProp(element, key, value);
        });
    }

    if (vdom.children) {
        vdom.children.forEach(child => {
            element.appendChild(createRealElement(child));
        });
    }

    return element;
}
