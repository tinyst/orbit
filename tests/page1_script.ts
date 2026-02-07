import { getOrbit } from "../src/core";
import { Counter, CounterScope } from "./page1_counter";

const orbit = getOrbit();

orbit.register(CounterScope, Counter);
orbit.start();
