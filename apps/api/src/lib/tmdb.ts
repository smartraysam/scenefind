import { config } from "../config.js";

type TmdbSearchResponse = {
  results?: Array<{ id?: number }>;
};

type TmdbProvider = {
  provider_name: string;
  provider_id: number;
};

type TmdbMovieResponse = {
  id: number;
  title: string;
  release_date?: string;
  poster_path?: string;
  vote_average?: number;
  credits?: {
    cast?: Array<{ name: string }>;
  };
  "watch/providers"?: {
    results?: {
      US?: {
        flatrate?: TmdbProvider[];
      };
    };
  };
};

type EnrichInput = {
  tmdbId?: number;
  title?: string;
  year?: string;
};

type EnrichOutput = {
  tmdb_id: number;
  title: string;
  year?: string;
  poster_url: string | null;
  rating?: number;
  cast: string[];
  providers: Array<{ platform: string; color: string; tmdb_provider_id: number }>;
};

async function tmdbFetch<T>(path: string): Promise<T | null> {
  if (!config.tmdbKey) {
    return null;
  }

  const base = "https://api.themoviedb.org/3";
  const url = `${base}${path}${path.includes("?") ? "&" : "?"}api_key=${config.tmdbKey}`;
  const res = await fetch(url);
  if (!res.ok) {
    return null;
  }
  return (await res.json()) as T;
}

export async function enrichWithTmdb({ tmdbId, title, year }: EnrichInput): Promise<EnrichOutput | null> {
  let id = tmdbId;

  if (!id && title) {
    const search = await tmdbFetch<TmdbSearchResponse>(
      `/search/movie?query=${encodeURIComponent(title)}${year ? `&year=${encodeURIComponent(year)}` : ""}`
    );
    id = search?.results?.[0]?.id;
  }

  if (!id) {
    return null;
  }

  const movie = await tmdbFetch<TmdbMovieResponse>(`/movie/${id}?append_to_response=watch/providers,credits`);
  if (!movie) {
    return null;
  }

  const providers = movie["watch/providers"]?.results?.US?.flatrate || [];

  return {
    tmdb_id: movie.id,
    title: movie.title,
    year: movie.release_date?.slice(0, 4),
    poster_url: movie.poster_path ? `https://image.tmdb.org/t/p/w500${movie.poster_path}` : null,
    rating: movie.vote_average,
    cast: (movie.credits?.cast || []).slice(0, 6).map((person) => person.name),
    providers: providers.map((provider) => ({
      platform: provider.provider_name,
      color: "#0A84FF",
      tmdb_provider_id: provider.provider_id
    }))
  };
}
