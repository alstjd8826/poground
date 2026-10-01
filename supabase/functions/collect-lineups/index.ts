import { serveJob } from "../_shared/runner.ts";
import { runCollectLineups } from "./logic.ts";

serveJob("collect-lineups", runCollectLineups);
