// implementation of our React.createElement-like function
export function createElement(tag, props, ...children) {
    const normalizedProps = props || {};
    const flattenedChildren = flattenChildren(children);

    return {
        tag,
        props: normalizedProps,
        children: flattenedChildren
    }
}

// Invalid children that should be filtered out (conditional rendering or similar)
const INVALID_CHILDREN = [null, undefined, false, true];

// Helper: Flatten arrays and filter out invalid children
function flattenChildren(children) {
    const result = [];
    
    for (const child of children) {
        // Skip invalid children
        if (INVALID_CHILDREN.includes(child)) {
            continue;
        }
        
        // Flatten arrays recursively
        if (Array.isArray(child)) {
            result.push(...flattenChildren(child));
        } else {
            // Keep: strings, numbers, vdom objects
            result.push(child);
        }
    }
    
    return result;
}
