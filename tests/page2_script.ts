import { getOrbit } from "../src/core";
import { Counter, CounterScope } from "./page2_counter";

const orbit = getOrbit();

orbit.register(CounterScope, Counter);
orbit.start();
