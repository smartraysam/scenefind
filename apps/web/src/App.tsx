import { useMemo, useState } from "react";
import { AFFILIATE_DISCLOSURE, SUPPORTED_MEDIA_TYPES } from "@scenefind/shared";
import { extractVideoFrame, toBase64 } from "./lib/media";
import { getClientUsage, incrementClientUsage } from "./lib/usage";

type StreamingItem = {
  platform: string;
  color?: string;
  affiliate_url?: string;
};

type DetectionResult = {
  found: boolean;
  title?: string;
  year?: string;
  genre?: string;
  director?: string;
  confidence?: string;
  description?: string;
  streaming?: StreamingItem[];
  imdb_url?: string;
  tmdb_id?: number;
  poster_url?: string | null;
  cast?: string[];
  affiliate_disclosure?: string;
};

const acceptedMime = SUPPORTED_MEDIA_TYPES.join(",");
const initialUsage = getClientUsage(3);

export default function App() {
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState("");
  const [result, setResult] = useState<DetectionResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [checkoutPlan, setCheckoutPlan] = useState<"pro" | "api" | null>(null);
  const [error, setError] = useState("");
  const [checkoutEmail, setCheckoutEmail] = useState("");
  const [checkoutMessage, setCheckoutMessage] = useState("");
  const [usage, setUsage] = useState(initialUsage);

  const isVideo = useMemo(() => file?.type?.startsWith("video/"), [file]);

  function clearMedia() {
    setFile(null);
    setPreviewUrl("");
    setResult(null);
    setError("");
  }

  function onFileChange(nextFile?: File | null) {
    if (!nextFile) {
      return;
    }

    if (!SUPPORTED_MEDIA_TYPES.includes(nextFile.type)) {
      setError("Unsupported media type. Use JPG, PNG, WEBP, MP4, or MOV.");
      return;
    }

    setError("");
    setFile(nextFile);
    setResult(null);
    setPreviewUrl(URL.createObjectURL(nextFile));
  }

  async function handleSubmit() {
    if (!file) {
      setError("Please choose an image or video first.");
      return;
    }

    if (usage.remaining <= 0) {
      setError("Client-side free limit reached today. Upgrade for more searches.");
      return;
    }

    try {
      setLoading(true);
      setError("");

      let base64Image: string;
      let mediaType = file.type;

      if (isVideo) {
        base64Image = await extractVideoFrame(previewUrl);
        mediaType = "image/jpeg";
      } else {
        base64Image = await toBase64(file);
      }

      const res = await fetch("/api/detect", {
        method: "POST",
        headers: {
          "content-type": "application/json"
        },
        body: JSON.stringify({ base64Image, mediaType })
      });

      const data = (await res.json()) as DetectionResult & { error?: string };
      if (!res.ok) {
        throw new Error(data.error || "Detection failed");
      }

      setResult(data);
      setUsage(incrementClientUsage(3));
    } catch (err) {
      const message = err instanceof Error ? err.message : "Something went wrong.";
      setError(message);
    } finally {
      setLoading(false);
    }
  }

  async function handleUpgrade(plan: "pro" | "api") {
    if (!checkoutEmail || !checkoutEmail.includes("@")) {
      setError("Enter a valid email to continue checkout.");
      return;
    }

    try {
      setError("");
      setCheckoutMessage("");
      setCheckoutPlan(plan);

      const res = await fetch("/api/checkout", {
        method: "POST",
        headers: {
          "content-type": "application/json"
        },
        body: JSON.stringify({
          email: checkoutEmail,
          plan
        })
      });

      const data = (await res.json()) as { error?: string; provider?: string; country?: string; url?: string };
      if (!res.ok) {
        throw new Error(data.error || "Unable to start checkout");
      }

      if (data.url) {
        window.location.href = data.url;
        return;
      }

      setCheckoutMessage("Checkout initialized.");
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unable to start checkout";
      setError(message);
    } finally {
      setCheckoutPlan(null);
    }
  }

  return (
    <div className="page">
      <header className="hero">
        <p className="chip">AI Movie Detector</p>
        <h1>SceneFind</h1>
        <p className="subtitle">Upload a still or short clip and instantly identify the movie or show.</p>
        <div className="usage-banner">
          <span>{usage.remaining} free searches remaining today</span>
          <a href="#pricing">Upgrade</a>
        </div>
      </header>

      <section className="panel uploader">
        <label
          className="dropzone"
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => {
            e.preventDefault();
            onFileChange(e.dataTransfer.files?.[0]);
          }}
        >
          <input type="file" accept={acceptedMime} onChange={(e) => onFileChange(e.target.files?.[0])} />
          <div>
            <strong>Drag and drop</strong> or click to browse
          </div>
          <small>Accepted: JPG, PNG, WEBP, MP4, MOV</small>
        </label>

        {previewUrl ? (
          <div className="preview">
            {isVideo ? <video src={previewUrl} controls /> : <img src={previewUrl} alt="Preview" />}
            <button type="button" className="ghost" onClick={clearMedia}>
              Remove
            </button>
          </div>
        ) : null}

        <button className="cta" type="button" onClick={handleSubmit} disabled={loading}>
          {loading ? "Analyzing scene with AI..." : "Detect Movie"}
        </button>

        {error ? <p className="error">{error}</p> : null}
      </section>

      {result ? (
        <section className="panel result-card">
          {result.found ? (
            <>
              <div className="headline-row">
                <h2>
                  {result.title} <span>({result.year || "N/A"})</span>
                </h2>
                <span className="badge">Confidence: {result.confidence || "Medium"}</span>
              </div>

              <p>{result.description || "No description available."}</p>

              <div className="meta-grid">
                <p>
                  <strong>Genre:</strong> {result.genre || "Unknown"}
                </p>
                <p>
                  <strong>Director:</strong> {result.director || "Unknown"}
                </p>
                <p>
                  <strong>IMDb:</strong>{" "}
                  {result.imdb_url ? (
                    <a href={result.imdb_url} target="_blank" rel="noreferrer">
                      Open link
                    </a>
                  ) : (
                    "Unavailable"
                  )}
                </p>
                <p>
                  <strong>TMDB ID:</strong> {result.tmdb_id || "N/A"}
                </p>
              </div>

              {result.poster_url ? <img className="poster" src={result.poster_url} alt={result.title} /> : null}

              {result.cast?.length ? (
                <p>
                  <strong>Cast:</strong> {result.cast.join(", ")}
                </p>
              ) : null}

              <h3>Where to watch</h3>
              <div className="streaming-grid">
                {(result.streaming || []).map((item) => (
                  <a
                    key={`${item.platform}-${item.affiliate_url || "none"}`}
                    className="stream-pill"
                    href={item.affiliate_url || "#"}
                    style={{ borderColor: item.color || "#111" }}
                    target="_blank"
                    rel="noreferrer"
                  >
                    {item.platform}
                  </a>
                ))}
              </div>
              <small className="disclosure">{result.affiliate_disclosure || AFFILIATE_DISCLOSURE}</small>
            </>
          ) : (
            <p>Scene could not be confidently identified. Try a clearer frame.</p>
          )}
        </section>
      ) : null}

      <section id="pricing" className="pricing">
        <div className="billing-input-row">
          <input
            type="email"
            placeholder="you@example.com"
            value={checkoutEmail}
            onChange={(e) => setCheckoutEmail(e.target.value)}
          />
          <small>Nigeria users are routed to Paystack automatically. Global users use Stripe.</small>
          {checkoutMessage ? <small className="checkout-message">{checkoutMessage}</small> : null}
        </div>

        <article className="price-card">
          <h4>Free</h4>
          <p className="price">$0/mo</p>
          <p>Images only, basic results</p>
        </article>
        <article className="price-card featured">
          <h4>Pro</h4>
          <p className="price">$5/mo</p>
          <p>Unlimited searches, images + video, cast + history</p>
          <button className="ghost checkout-btn" onClick={() => handleUpgrade("pro")} disabled={checkoutPlan === "pro"}>
            {checkoutPlan === "pro" ? "Opening checkout..." : "Upgrade to Pro"}
          </button>
        </article>
        <article className="price-card">
          <h4>API</h4>
          <p className="price">$20/mo</p>
          <p>1,000 req/day, webhook-ready REST API</p>
          <button className="ghost checkout-btn" onClick={() => handleUpgrade("api")} disabled={checkoutPlan === "api"}>
            {checkoutPlan === "api" ? "Opening checkout..." : "Upgrade to API"}
          </button>
        </article>
      </section>
    </div>
  );
}
