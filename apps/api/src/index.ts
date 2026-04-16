import express from "express";
import cors from "cors";
import detectRouter from "./routes/detect.js";
import stripeRouter from "./routes/stripe.js";
import adminRouter from "./routes/admin.js";
import { config } from "./config.js";

const app = express();

app.use(cors());
app.use("/api/webhooks/stripe", express.raw({ type: "application/json" }));
app.use(express.json({ limit: "20mb" }));

app.get("/api/health", (_req, res) => {
  res.json({ ok: true, service: "scenefind-api" });
});

app.use("/api/detect", detectRouter);
app.use("/api", stripeRouter);
app.use("/api/admin", adminRouter);

app.listen(config.port, () => {
  console.log(`SceneFind API listening on http://localhost:${config.port}`);
});
