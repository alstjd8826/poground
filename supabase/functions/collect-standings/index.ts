import { serveJob } from "../_shared/runner.ts";
import { runCollectStandings } from "./logic.ts";

serveJob("collect-standings", runCollectStandings);
