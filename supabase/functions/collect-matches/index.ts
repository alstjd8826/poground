import { serveJob } from "../_shared/runner.ts";
import { runCollectMatches } from "./logic.ts";

serveJob("collect-matches", runCollectMatches);
