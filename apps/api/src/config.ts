import dotenv from "dotenv";

dotenv.config();

export type AppConfig = {
  port: number;
  openAiKey?: string;
  tmdbKey?: string;
  stripeSecretKey?: string;
  stripeWebhookSecret?: string;
  stripePricePro?: string;
  stripePriceApi?: string;
  paystackSecretKey?: string;
  paystackPublicKey?: string;
  paystackPlanPro?: string;
  paystackPlanApi?: string;
  paystackAmountProKobo?: string;
  paystackAmountApiKobo?: string;
  appBaseUrl: string;
  dashboardUrl: string;
  databaseUrl?: string;
  redisUrl?: string;
};

export const config: AppConfig = {
  port: Number(process.env.PORT || 8787),
  openAiKey: process.env.OPENAI_API_KEY,
  tmdbKey: process.env.TMDB_API_KEY,
  stripeSecretKey: process.env.STRIPE_SECRET_KEY,
  stripeWebhookSecret: process.env.STRIPE_WEBHOOK_SECRET,
  stripePricePro: process.env.STRIPE_PRICE_PRO,
  stripePriceApi: process.env.STRIPE_PRICE_API,
  paystackSecretKey: process.env.PAYSTACK_SECRET_KEY,
  paystackPublicKey: process.env.PAYSTACK_PUBLIC_KEY,
  paystackPlanPro: process.env.PAYSTACK_PLAN_PRO,
  paystackPlanApi: process.env.PAYSTACK_PLAN_API,
  paystackAmountProKobo: process.env.PAYSTACK_AMOUNT_PRO_KOBO,
  paystackAmountApiKobo: process.env.PAYSTACK_AMOUNT_API_KOBO,
  appBaseUrl: process.env.APP_BASE_URL || "http://localhost:5173",
  dashboardUrl: process.env.DASHBOARD_URL || "http://localhost:5174",
  databaseUrl: process.env.DATABASE_URL,
  redisUrl: process.env.REDIS_URL
};
