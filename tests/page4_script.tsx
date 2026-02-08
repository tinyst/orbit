/** @jsxImportSource react */

import type { ComponentType } from "react";
import { parseServerSideProps } from "../src/helper";
import { Counter, CounterScope } from "./page4_counter";
import { hydrateRoot } from "react-dom/client";

function getProps(root: Element) {
  if (root.hasAttribute("data-props")) {
    return parseServerSideProps(root.getAttribute("data-props"));
  }

  const propsId = root.getAttribute("data-props-id");
  const props = propsId ? parseServerSideProps(document.getElementById(propsId)?.textContent) : {};

  return props;
}

const ComponentMap: Record<string, ComponentType<{ props: any }>> = {
  [CounterScope]: Counter,
};

const roots = document.querySelectorAll('[data-component]');

roots.forEach(root => {
  const componentName = root.getAttribute("data-component");
  const Component = componentName ? ComponentMap[componentName] : undefined;

  if (!Component) {
    return;
  }

  const props = getProps(root);
  const element = <Component props={props} />;

  hydrateRoot(root, element);
});
