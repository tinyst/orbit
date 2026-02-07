import { expect, test } from "bun:test";
import { concatPath, extractPath, getObjectValue, parseServerSideProps, setObjectValue, stringifyValue } from "./helper";

// test simple functions first
test("should extract path", () => {
  expect(extractPath("")).toEqual([]);
  expect(extractPath("nested")).toEqual(["nested"]);
  expect(extractPath("parent.nested")).toEqual(["parent", "nested"]);
  expect(extractPath("parent[1]")).toEqual(["parent", "1"]);
  expect(extractPath("parent[1].nested")).toEqual(["parent", "1", "nested"]);
  expect(extractPath("parent[-1]")).toEqual(["parent", "-1"]);
  expect(extractPath("parent[-1].nested")).toEqual(["parent", "-1", "nested"]);
  expect(extractPath("parent[-1].nested[0]")).toEqual(["parent", "-1", "nested", "0"]);
});

test("should concat path", () => {
  expect(concatPath("", "nested")).toEqual("nested");
  expect(concatPath("parent", "nested")).toEqual("parent.nested");
  expect(concatPath("parent", "1")).toEqual("parent[1]");
  expect(concatPath("parent[1]", "1")).toEqual("parent[1][1]");
  expect(concatPath("parent[1]", "nested")).toEqual("parent[1].nested");
  expect(concatPath("parent", "-1")).toEqual("parent[-1]");
  expect(concatPath("parent[-1]", "1")).toEqual("parent[-1][1]");
  expect(concatPath("parent[-1]", "nested")).toEqual("parent[-1].nested");
  expect(concatPath("parent[-1]", "nested[1]")).toEqual("parent[-1][nested[1]]"); // should not happen in orbit
});

//////////////////////////////////////////
const KEY = Symbol.for("KEY");

type MyObject = {
  a: boolean;
  b: number;
  c: string;
  d: boolean[];
  e: {
    nested: string;
  };
  f: Array<{
    nested: boolean;
  }>;
  g: {
    array: Array<{
      value: number;
    }>;
  };

  [KEY]: string;
};

test("should get correct field", () => {
  const o: MyObject = {
    a: true,
    b: 10,
    c: "hello",
    d: [true, false],
    e: {
      nested: "world",
    },
    f: [
      {
        nested: true,
      },
      {
        nested: false,
      },
    ],
    g: {
      array: [
        {
          value: 1,
        },
        {
          value: 2,
        },
      ],
    },

    [KEY]: "value",
  };

  expect(getObjectValue(o, "a")).toEqual(true);
  expect(getObjectValue(o, "b")).toEqual(10);
  expect(getObjectValue(o, "c")).toEqual("hello");
  expect(getObjectValue(o, "d.0")).toEqual(true);
  expect(getObjectValue(o, "d.1")).toEqual(false);
  expect(getObjectValue(o, "e")).toEqual({ nested: "world" });
  expect(getObjectValue(o, "e.nested")).toEqual("world");
  expect(getObjectValue(o, "f[-1].nested")).toEqual(undefined);
  expect(getObjectValue(o, "f.-1.nested")).toEqual(undefined);
  expect(getObjectValue(o, "f[0].nested")).toEqual(true);
  expect(getObjectValue(o, "f.0.nested")).toEqual(true);
  expect(getObjectValue(o, "f[1].nested")).toEqual(false);
  expect(getObjectValue(o, "f.1.nested")).toEqual(false);
  expect(getObjectValue(o, "f.9999.nested")).toEqual(undefined);
  expect(getObjectValue(o, "g.array")).toEqual([{ value: 1 }, { value: 2 }]);
  expect(getObjectValue(o, "g.array.0")).toEqual({ value: 1 });
  expect(getObjectValue(o, "g.array.0.value")).toEqual(1);
  expect(getObjectValue(o, "z")).toEqual(undefined);
  expect(getObjectValue(o, "z.y")).toEqual(undefined);
  expect(getObjectValue(o, KEY)).toEqual("value");

  const arr = [
    "this",
    "is",
    "an",
    "array",
    "of",
    "strings"
  ];

  expect(getObjectValue(arr, 0)).toEqual("this");
  expect(getObjectValue(arr, 1)).toEqual("is");
  expect(getObjectValue(arr, "2")).toEqual("an");
  expect(getObjectValue(arr, "3")).toEqual("array");
  expect(getObjectValue(arr, "4")).toEqual("of");
  expect(getObjectValue(arr, "5")).toEqual("strings");
});

test("should set correct field", () => {
  const o: MyObject = {
    a: true,
    b: 10,
    c: "hello",
    d: [true, false],
    e: {
      nested: "world",
    },
    f: [
      {
        nested: true,
      },
      {
        nested: false,
      },
    ],
    g: {
      array: [
        {
          value: 1,
        },
        {
          value: 2,
        },
      ],
    },

    [KEY]: "value",
  };

  setObjectValue(o, "a", false);
  expect(o.a).toEqual(false);

  setObjectValue(o, "b", 20);
  expect(o.b).toEqual(20);

  setObjectValue(o, "c", "world");
  expect(o.c).toEqual("world");

  setObjectValue(o, "d.0", false);
  expect(o.d[0]).toEqual(false);

  setObjectValue(o, "d.1", true);
  expect(o.d[1]).toEqual(true);

  setObjectValue(o, "e.nested", "hello");
  expect(o.e.nested).toEqual("hello");

  setObjectValue(o, "f.0.nested", false);
  expect(o.f[0]?.nested).toEqual(false);

  setObjectValue(o, "f.1.nested", true);
  expect(o.f[1]?.nested).toEqual(true);

  setObjectValue(o, "g.array.0.value", 2);
  expect(o.g.array[0]?.value).toEqual(2);

  setObjectValue(o, "g.array[0].value", 6);
  expect(o.g.array[0]?.value).toEqual(6);

  setObjectValue(o, "g.array.1.value", 3);
  expect(o.g.array[1]?.value).toEqual(3);

  setObjectValue(o, "g.array", [{ value: 4 }]);
  expect(o.g.array[0]?.value).toEqual(4);
  expect(o.g.array).toEqual([{ value: 4 }]);

  setObjectValue(o, "z.y", "ok");
  expect(getObjectValue(o, "z.y")).toEqual(undefined);

  setObjectValue(o, "z", "ok");
  expect(getObjectValue(o, "z")).toEqual("ok");

  setObjectValue(o, "z.x", "ok");
  expect(getObjectValue(o, "z.x")).toEqual("ok");

  setObjectValue(o, KEY, "updated");
  expect(o[KEY]).toEqual("updated");
});

test("should stringify values", () => {
  const o = {
    a: true,
    b: 10,
    c: "hello",
    d: [true, false],
    e: {
      nested: "world",
    },
    f: [
      {
        nested: true,
      },
      {
        nested: false,
      },
    ],
    g: {
      array: [
        {
          value: 1,
        },
        {
          value: 2,
        },
      ],
    },

    [KEY]: "value",
  };

  expect(stringifyValue(undefined)).toEqual("");
  expect(stringifyValue(null)).toEqual("");
  expect(stringifyValue(o.a)).toEqual("true");
  expect(stringifyValue(o.b)).toEqual("10");
  expect(stringifyValue(o.c)).toEqual("hello");
  expect(stringifyValue(o.d)).toEqual("[true,false]");
  expect(stringifyValue(o.e)).toEqual(`{"nested":"world"}`);
  expect(stringifyValue(o.f)).toEqual(`[{"nested":true},{"nested":false}]`);
  expect(stringifyValue(o.g)).toEqual(`{"array":[{"value":1},{"value":2}]}`);
  expect(stringifyValue(o[KEY])).toEqual("value");
  expect(stringifyValue(KEY)).toEqual("Symbol(KEY)");
});

test("should parse server side props", () => {
  expect(parseServerSideProps(null)).toEqual({});
  expect(parseServerSideProps(undefined)).toEqual({});
  expect(parseServerSideProps("")).toEqual({});
  expect(parseServerSideProps("null")).toEqual({});
  expect(parseServerSideProps("undefined")).toEqual({});
  expect(parseServerSideProps("true")).toEqual({});
  expect(parseServerSideProps("false")).toEqual({});
  expect(parseServerSideProps("10")).toEqual({});
  expect(parseServerSideProps("hello")).toEqual({});
  expect(parseServerSideProps("[true,false]")).toEqual({});
  expect(parseServerSideProps(`{"nested":"world"}`)).toEqual({ nested: "world" });
  expect(parseServerSideProps(`[{"nested":true},{"nested":false}]`)).toEqual({});
  expect(parseServerSideProps(`{"array":[{"value":1},{"value":2}]}`)).toEqual({ array: [{ value: 1 }, { value: 2 }] });
});
