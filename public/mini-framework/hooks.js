import { update } from "./virtual-dom.js"

const states = [], effectDependencies = [], effectCleanups = [], refs = []
let stateIndex = 0, effectIndex = 0, refIndex = 0
const pendingEffects = [] // Queue 

export function useState(initialValue) {
    const currentIndex = stateIndex
    if (states[currentIndex] === undefined) {
        states[currentIndex] = initialValue
    }

    const currentState = states[currentIndex]

    const setState = (newValue) => {
        const updatedValue = typeof newValue === 'function'
            ? newValue(states[currentIndex])
            : newValue
        if (states[currentIndex] !== updatedValue) {
            states[currentIndex] = updatedValue
            update() 
        }
    }

    stateIndex++
    return [currentState, setState]
}

export function useEffect(callback, dependencies) {
    const currentIndex = effectIndex
    const prevDependencies = effectDependencies[currentIndex]

    let shouldRun = false
    if (dependencies === undefined) {
        shouldRun = true 
    } else if (prevDependencies === undefined) {
        shouldRun = true 
    } else if (dependencies.length !== prevDependencies.length) {
        shouldRun = true 
    } else {
        shouldRun = dependencies.some((dep, i) => dep !== prevDependencies[i])
    }

    if (shouldRun) {
        pendingEffects.push(() => {
            if (typeof effectCleanups[currentIndex] === 'function') {
                effectCleanups[currentIndex]()
            }
            const cleanup = callback()
            effectCleanups[currentIndex] = cleanup
        })
    }

    effectDependencies[currentIndex] = dependencies
    effectIndex++
}

export function useRef(initialValue) {
    const currentIndex = refIndex
    if (refs[currentIndex] === undefined) {
        refs[currentIndex] = { current: initialValue }
    }
    refIndex++
    return refs[currentIndex]
}

export function resetHookIndex() {
    stateIndex = 0
    effectIndex = 0
    refIndex = 0
}

export function runEffects() {
    const effectsToRun = [...pendingEffects]
    pendingEffects.length = 0
    effectsToRun.forEach(effect => effect())
}

export function cleanupEffects() {
    effectCleanups.forEach(cleanup => {
        if (typeof cleanup === 'function') cleanup()
    })
    states.length = 0
    effectDependencies.length = 0
    effectCleanups.length = 0
    refs.length = 0
}
