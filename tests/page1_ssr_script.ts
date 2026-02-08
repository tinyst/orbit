import { getOrbit } from "../src/core";
import { Counter, CounterScope } from "./page1_ssr_counter";

const orbit = getOrbit();

orbit.register(CounterScope, Counter);
orbit.start();
