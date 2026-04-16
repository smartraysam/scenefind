import express from "express";
import { getInMemorySnapshot } from "../lib/storage.js";

const router = express.Router();

router.get("/metrics", async (_req, res) => {
  const snapshot = getInMemorySnapshot();
  const keys = Object.keys(snapshot);
  const totalSearches = Object.values(snapshot).reduce((acc, val) => acc + Number(val), 0);

  res.json({
    totalSearches,
    activeCounters: keys.length,
    counters: snapshot
  });
});

export default router;
