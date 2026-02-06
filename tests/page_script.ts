import { getOrbit } from "../src/core";
import { Counter, CounterScope } from "./page_counter";

const orbit = getOrbit();

orbit.register(CounterScope, Counter);
orbit.start();
