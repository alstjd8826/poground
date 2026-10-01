import { serveJob } from "../_shared/runner.ts";
import { runCollectNews } from "./logic.ts";

serveJob("collect-news", runCollectNews);
