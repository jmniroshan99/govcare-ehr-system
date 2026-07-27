import "dotenv/config";
import cors from "cors";
import express from "express";
import helmet from "helmet";
import { authRouter } from "./routes/auth.js";
import { patientsRouter } from "./routes/patients.js";
import { searchRouter } from "./routes/search.js";
import { selfRegistrationRouter } from "./routes/selfRegistration.js";
import { usersRouter } from "./routes/users.js";
import { loginActivitiesRouter } from "./routes/loginActivities.js";
import { closePool, testConnection } from "./db.js";

const app = express();
const port = Number(process.env.PORT ?? 4001);
const configuredOrigins = (process.env.CORS_ORIGIN ?? "http://127.0.0.1:5173,http://localhost:5173")
  .split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);
const localDevOrigin = /^https?:\/\/(127\.0\.0\.1|localhost):(3\d{3}|4\d{3}|5\d{3})$/;

app.use(helmet());
app.use(cors({
  origin(origin, callback) {
    if (!origin || configuredOrigins.includes(origin) || localDevOrigin.test(origin)) {
      callback(null, true);
      return;
    }
    callback(new Error(`CORS blocked origin: ${origin}`));
  },
  credentials: true,
}));
app.use(express.json({ limit: "2mb" }));

app.get("/health", async (_request, response) => {
  const db = await testConnection();
  response.status(db.ok ? 200 : 503).json({
    ok: db.ok,
    service: "govcare-ehr-api",
    database: "postgresql",
    databaseTime: db.ok ? db.now : undefined,
    databaseError: db.ok ? undefined : db.error,
  });
});

app.use("/api/auth", authRouter);
app.use("/api/patients", patientsRouter);
app.use("/api/search", searchRouter);
app.use("/api/self-registration", selfRegistrationRouter);
app.use("/api/users", usersRouter);
app.use("/api/login-activities", loginActivitiesRouter);

app.use((error: unknown, _request: express.Request, response: express.Response, _next: express.NextFunction) => {
  console.error(error);
  response.status(500).json({ message: "Internal server error." });
});

async function start() {
  const db = await testConnection();
  if (!db.ok) {
    console.error("--------------------------------------------------------------------------");
    console.error("GovCare EHR API could not connect to PostgreSQL.");
    console.error(`DATABASE_URL = ${process.env.DATABASE_URL ? process.env.DATABASE_URL.replace(/:[^:@]*@/, ":****@") : "(not set)"}`);
    console.error(`Reason: ${db.error}`);
    console.error("Fix server/.env, make sure PostgreSQL is running, then restart this server.");
    console.error("--------------------------------------------------------------------------");
  } else {
    console.log(`[db] Connected to PostgreSQL. Server time: ${db.now.toISOString()}`);
  }

  const server = app.listen(port, () => {
    console.log(`GovCare EHR PostgreSQL API running on http://127.0.0.1:${port}`);
  });

  async function shutdown(signal: string) {
    console.log(`\n${signal} received. Closing HTTP server and PostgreSQL pool...`);
    server.close(async () => {
      await closePool();
      process.exit(0);
    });
  }

  process.on("SIGINT", () => shutdown("SIGINT"));
  process.on("SIGTERM", () => shutdown("SIGTERM"));
}

start();
