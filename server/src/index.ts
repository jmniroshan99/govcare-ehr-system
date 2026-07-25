import "dotenv/config";
import cors from "cors";
import express from "express";
import helmet from "helmet";
import { patientsRouter } from "./routes/patients.js";
import { searchRouter } from "./routes/search.js";
import { selfRegistrationRouter } from "./routes/selfRegistration.js";

const app = express();
const port = Number(process.env.PORT ?? 4001);
const allowedOrigins = (process.env.CORS_ORIGIN ?? "http://127.0.0.1:5173").split(",");

app.use(helmet());
app.use(cors({ origin: allowedOrigins, credentials: true }));
app.use(express.json({ limit: "2mb" }));

app.get("/health", (_request, response) => {
  response.json({ ok: true, service: "govcare-ehr-api", database: "postgresql" });
});

app.use("/api/patients", patientsRouter);
app.use("/api/search", searchRouter);
app.use("/api/self-registration", selfRegistrationRouter);

app.use((error: unknown, _request: express.Request, response: express.Response, _next: express.NextFunction) => {
  console.error(error);
  response.status(500).json({ message: "Internal server error." });
});

app.listen(port, () => {
  console.log(`GovCare EHR PostgreSQL API running on http://127.0.0.1:${port}`);
});
