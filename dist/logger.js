export const logw = typeof __ORBIT_LOG_WARN__ !== "undefined" && __ORBIT_LOG_WARN__ ? console.warn : undefined;
export const logi = typeof __ORBIT_LOG_INFO__ !== "undefined" && __ORBIT_LOG_INFO__ ? console.info : undefined;
export const logd = typeof __ORBIT_LOG_DEBUG__ !== "undefined" && __ORBIT_LOG_DEBUG__ ? console.debug : undefined;
