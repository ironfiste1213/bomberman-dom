import { diff } from './dom-diff.js';
import { applyPatches } from './renderer.js';
import { resetHookIndex, runEffects } from './hooks.js';

let currentVdom = null;
let mainComponent = null;

export function setCurrentVdom(vdom) {
    currentVdom = vdom;
}

export function getCurrentVdom() {
    return currentVdom;
}

export function setMainComponent(component) {
    mainComponent = component;
}

export function update(newVdom) {
    if (newVdom === undefined) {
        if (!mainComponent) return;
        resetHookIndex();
        newVdom = mainComponent();
    }

    const oldVdom = getCurrentVdom();

    const patches = diff(oldVdom, newVdom);

    applyPatches(patches);

    setCurrentVdom(newVdom);

    setTimeout(runEffects, 0);
}