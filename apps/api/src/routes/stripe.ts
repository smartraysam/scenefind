import express from "express";
import crypto from "node:crypto";
import Stripe from "stripe";
import { config } from "../config.js";

const router = express.Router();
const stripe = config.stripeSecretKey ? new Stripe(config.stripeSecretKey) : null;

type CheckoutPlan = "pro" | "api";

type PaystackInitializeResponse = {
  status: boolean;
  message?: string;
  data?: {
    authorization_url?: string;
    reference?: string;
  };
};

function detectCountry(req: express.Request): string {
  const headerCountry = req.header("x-user-country") || req.header("cf-ipcountry") || "";
  return headerCountry.trim().toUpperCase() || "US";
}

function getPaystackPlanConfig(plan: CheckoutPlan): { planCode?: string; amountKobo: number } {
  if (plan === "api") {
    return {
      planCode: config.paystackPlanApi,
      amountKobo: Number(config.paystackAmountApiKobo || 3000000)
    };
  }

  return {
    planCode: config.paystackPlanPro,
    amountKobo: Number(config.paystackAmountProKobo || 800000)
  };
}

async function createPaystackCheckout(email: string, plan: CheckoutPlan, reference: string): Promise<string> {
  if (!config.paystackSecretKey) {
    throw new Error("PAYSTACK_SECRET_KEY is not configured");
  }

  const callbackUrl = `${config.appBaseUrl}/?upgrade=success&provider=paystack`;
  const planConfig = getPaystackPlanConfig(plan);
  const payload: Record<string, string | number> = {
    email,
    currency: "NGN",
    reference,
    callback_url: callbackUrl
  };

  if (planConfig.planCode) {
    payload.plan = planConfig.planCode;
  } else {
    payload.amount = planConfig.amountKobo;
  }

  const response = await fetch("https://api.paystack.co/transaction/initialize", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${config.paystackSecretKey}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify(payload)
  });

  const data = (await response.json()) as PaystackInitializeResponse;
  if (!response.ok || !data.status || !data.data?.authorization_url) {
    throw new Error(data.message || "Paystack checkout initialization failed");
  }

  return data.data.authorization_url;
}

router.post("/checkout", async (req, res) => {
  try {
    const country = detectCountry(req);
    const { plan, email } = (req.body || {}) as { plan?: string; email?: string };
    const selectedPlan: CheckoutPlan = plan === "api" ? "api" : "pro";

    if (!email) {
      return res.status(400).json({ error: "email is required" });
    }

    if (country === "NG") {
      const paystackUrl = await createPaystackCheckout(email, selectedPlan, `scenefind_${selectedPlan}_${Date.now()}`);
      return res.json({
        provider: "paystack",
        country,
        url: paystackUrl
      });
    }

    if (!stripe) {
      return res.status(500).json({ error: "STRIPE_SECRET_KEY is not configured" });
    }

    const priceId = selectedPlan === "api" ? config.stripePriceApi : config.stripePricePro;

    if (!priceId) {
      return res.status(400).json({ error: "Missing Stripe price for selected plan" });
    }

    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      customer_email: email,
      payment_method_types: ["card"],
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: `${config.appBaseUrl}/?upgrade=success`,
      cancel_url: `${config.appBaseUrl}/?upgrade=canceled`
    });

    res.json({ provider: "stripe", country, url: session.url });
  } catch (error) {
    const detail = error instanceof Error ? error.message : "Unknown error";
    res.status(500).json({ error: "Checkout initialization failed", detail });
  }
});

router.post("/webhooks/stripe", express.raw({ type: "application/json" }), (req, res) => {
  if (!stripe || !config.stripeWebhookSecret) {
    return res.status(200).json({ received: true, configured: false });
  }

  try {
    const signature = req.headers["stripe-signature"];
    if (!signature || Array.isArray(signature)) {
      return res.status(400).send("Webhook Error: Missing stripe-signature header");
    }

    const event = stripe.webhooks.constructEvent(req.body, signature, config.stripeWebhookSecret);

    if (event.type === "checkout.session.completed") {
      // Integrate with your auth/profile table (Supabase or Postgres) here.
    }

    res.json({ received: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    res.status(400).send(`Webhook Error: ${message}`);
  }
});

router.post("/webhooks/paystack", express.raw({ type: "application/json" }), (req, res) => {
  if (!config.paystackSecretKey) {
    return res.status(200).json({ received: true, configured: false });
  }

  try {
    const signature = req.headers["x-paystack-signature"];
    if (!signature || Array.isArray(signature)) {
      return res.status(400).send("Webhook Error: Missing x-paystack-signature header");
    }

    const computedSignature = crypto
      .createHmac("sha512", config.paystackSecretKey)
      .update(req.body)
      .digest("hex");

    if (computedSignature !== signature) {
      return res.status(400).send("Webhook Error: Invalid signature");
    }

    const event = JSON.parse(Buffer.from(req.body).toString("utf8")) as { event?: string };

    if (event.event === "charge.success") {
      // Integrate with your auth/profile table (Supabase or Postgres) here.
    }

    res.json({ received: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    res.status(400).send(`Webhook Error: ${message}`);
  }
});

export default router;
