export function getObjectValue(src, path) {
    if (!src) {
        return undefined;
    }
    if (typeof path !== "string") {
        return src[path];
    }
    const parts = path.split(".");
    let current = src;
    for (let i = 0; i < parts.length && isObject(current); i++) {
        const part = parts[i];
        if (part) {
            current = current[part];
        }
    }
    return current;
}
export function setObjectValue(src, path, value) {
    if (!src) {
        return;
    }
    if (typeof path !== "string") {
        src[path] = value;
        return;
    }
    const parts = path.split(".");
    if (!parts.length) {
        return;
    }
    let current = src;
    for (let i = 0; i < parts.length - 1 && isObject(current); i++) {
        const part = parts[i];
        if (part) {
            current = current[part];
        }
    }
    const last = parts[parts.length - 1];
    if (last && isObject(current)) {
        current[last] = value;
    }
}
export function isObject(value) {
    return value && typeof value === "object";
}
export function stringifyValue(value) {
    if (value === null || value === undefined) {
        return "";
    }
    if (typeof value === "object") {
        return JSON.stringify(value);
    }
    return String(value);
}
/** @description always return object */
export function parseServerSideProps(value) {
    if (typeof value === "undefined" || value === null) {
        return {};
    }
    try {
        const result = JSON.parse(value);
        if (isObject(result) && !Array.isArray(result)) {
            return result;
        }
    }
    catch {
        //
    }
    return {};
}
