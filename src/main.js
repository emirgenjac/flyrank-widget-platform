import { createPool } from "./data/db.js";
import { migrate } from "./data/migrate.js";
import { createApp } from "./http/app.js";
import { startJobs } from "./jobs/runner.js";

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  console.error("DATABASE_URL is required.");
  process.exit(1);
}

const port = Number(process.env.PORT || 3000);
const pool = createPool(databaseUrl);

await migrate(pool);
const jobs = startJobs();
const server = createApp({ db: pool }).listen(port, () => {
  console.log(`api listening on ${port}`);
});

function shutdown() {
  jobs.stop();
  server.close(() => {
    pool.end();
  });
}

process.on("SIGTERM", shutdown);
process.on("SIGINT", shutdown);
