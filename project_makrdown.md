# SceneFind — AI Movie Detector App (OpenAI-powered)

## Project Overview
Build a web app called **SceneFind** where users upload a movie still or video clip and the AI identifies the movie, returns metadata, and provides streaming links with affiliate monetization.

---

## Tech Stack
- **Frontend**: React (react)
- **Backend**: express.js API Routes
admin dashboard react

turbo monorepos

db postgresdb, redis

allow 2 search without signup,

allow 5 search per month with signup and verify email

detech user location that use cloudflare infra

ffmpeg will be use to extract video frame if video link is use
- **AI**: OpenAI GPT-4o Vision API
- **Payments**: Stripe (Free / Pro / API tiers)
- **Movie Data**: TMDB API (posters, cast, streaming info)
- **Affiliate**: JustWatch / Amazon affiliate links

---

## Core Feature: Movie Detection

### Frontend Upload Component
- Accept `image/*` and `video/*` file types (JPG, PNG, MP4, MOV, WEBP)
- Drag-and-drop + click-to-browse
- For video files: extract a keyframe at t=1s using a canvas element, send the frame as a JPEG
- Show image/video preview with remove button before submitting
- Gate usage: 3 free searches/day (track in localStorage + verify server-side)

### API Route: `/api/detect`
Make a POST request to the OpenAI API using GPT-4o with vision:

```js
// pages/api/detect.js (or app/api/detect/route.js)
import OpenAI from "openai";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

export async function POST(req) {
  const { base64Image, mediaType } = await req.json();

  const response = await openai.chat.completions.create({
    model: "gpt-4o",
    max_tokens: 1000,
    messages: [
      {
        role: "user",
        content: [
          {
            type: "image_url",
            image_url: {
              url: `data:${mediaType};base64,${base64Image}`,
            },
          },
          {
            type: "text",
            text: `You are a movie identification expert. Analyze this image and identify the movie or TV show.
Respond ONLY with a JSON object (no markdown, no backticks):
{
  "found": true,
  "title": "Movie Title",
  "year": "2020",
  "genre": "Action, Thriller",
  "director": "Director Name",
  "confidence": "High",
  "description": "2-sentence plot summary.",
  "streaming": [
    { "platform": "Netflix", "color": "#E50914", "affiliate_url": "https://netflix.com/..." },
    { "platform": "Amazon Prime", "color": "#00A8E0", "affiliate_url": "https://amazon.com/..." }
  ],
  "imdb_url": "https://www.imdb.com/title/ttXXXXXXX",
  "tmdb_id": 12345,
  "reasoning": "Brief note on visual cues used"
}
If the movie cannot be identified, return: { "found": false }`,
          },
        ],
      },
    ],
  });

  const text = response.choices[0].message.content;
  const result = JSON.parse(text.replace(/```json|```/g, "").trim());
  return Response.json(result);
}
```

---

## Video Frame Extraction (Client-side)

```js
function extractVideoFrame(videoSrc) {
  return new Promise((resolve) => {
    const video = document.createElement("video");
    const canvas = document.createElement("canvas");
    video.src = videoSrc;
    video.muted = true;
    video.currentTime = 1;
    video.addEventListener("seeked", () => {
      canvas.width = video.videoWidth || 640;
      canvas.height = video.videoHeight || 360;
      canvas.getContext("2d").drawImage(video, 0, 0);
      resolve(canvas.toDataURL("image/jpeg", 0.8).split(",")[1]);
    }, { once: true });
  });
}
```

---

## Monetization

### Pricing Tiers
| Plan | Price | Searches | Features |
|------|-------|----------|----------|
| Free | $0/mo | 3/day | Images only, basic results |
| Pro | $5/mo | Unlimited | Images + video, cast info, history |
| API | $20/mo | 1000 req/day | Developer access, REST API, webhooks |

### Stripe Integration
- Use `stripe.checkout.session.create()` for Pro and API plan upgrades
- Webhook at `/api/webhooks/stripe` to update Supabase user plan on `checkout.session.completed`
- Gate the `/api/detect` route: check user plan from Supabase before processing

### Affiliate Links
- Register for: Amazon Associates, Apple TV affiliate, JustWatch partner program
- Replace `affiliate_url` placeholders in the API response with your real affiliate URLs
- Log each affiliate click to Supabase for revenue tracking
- Add disclosure: *"We may earn a commission at no extra cost to you"*

---

## TMDB Integration (Enrich Results)

After getting the movie title from OpenAI, call TMDB to get richer data:

```js
const tmdb = await fetch(
  `https://api.themoviedb.org/3/movie/${tmdbId}?api_key=${process.env.TMDB_API_KEY}&append_to_response=watch/providers`
);
const movie = await tmdb.json();
// Use movie.poster_path, movie.vote_average, movie["watch/providers"].results
```

---

## Environment Variables

```env
OPENAI_API_KEY=sk-...
TMDB_API_KEY=...
STRIPE_SECRET_KEY=sk_live_...
STRIPE_WEBHOOK_SECRET=whsec_...
NEXT_PUBLIC_SUPABASE_URL=https://xxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
```

---

## UI Requirements
- Upload zone with drag-and-drop (dashed border, hover state)
- Image/video preview with remove button
- Loading spinner during API call ("Analyzing scene with AI...")
- Result card showing: title, year, genre, director, confidence badge, plot summary, streaming links
- "3 free searches remaining" banner with upgrade CTA
- Pricing plans section (3 columns: Free / Pro / API), Pro card highlighted with accent border
- Affiliate disclosure text below streaming links
- Mobile responsive layout (max-width 680px centered)

---

## Roadmap (Post-MVP)
1. Browser extension — right-click any image online to identify
2. Batch upload — identify multiple scenes at once
3. Reverse scene search — find timestamp of scene within a movie
4. Social share card — shareable "I identified this movie" card
5. TV show episode detection (not just movies)