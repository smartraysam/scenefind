import pg from "pg";
import { config } from "../config.js";

const { Pool } = pg;

type DetectionEvent = {
  userId: string;
  plan: string;
  mediaType: string;
  found: boolean;
  title: string | null;
  confidence: string | null;
};

export const pgPool = config.databaseUrl ? new Pool({ connectionString: config.databaseUrl }) : null;

export async function logDetectionEvent(event: DetectionEvent): Promise<void> {
  if (!pgPool) {
    return;
  }

  await pgPool.query(
    `
    INSERT INTO detection_logs
      (user_id, plan, media_type, found, title, confidence, created_at)
    VALUES
      ($1, $2, $3, $4, $5, $6, NOW())
    `,
    [event.userId, event.plan, event.mediaType, event.found, event.title, event.confidence]
  );
}
