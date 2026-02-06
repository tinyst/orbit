export type FieldPath = string | number | symbol;
export declare function getObjectValue(src: Record<FieldPath, any> | undefined, path: FieldPath): any;
export declare function setObjectValue(src: Record<FieldPath, any> | undefined, path: FieldPath, value: any): void;
export declare function isObject(value: any): value is object;
export declare function stringifyValue(value: any): string;
/** @description always return object */
export declare function parseServerSideProps(value: any): any;
