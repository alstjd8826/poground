import { serveJob } from "../_shared/runner.ts";
import { runCollectVideos } from "./logic.ts";

serveJob("collect-videos", runCollectVideos);
