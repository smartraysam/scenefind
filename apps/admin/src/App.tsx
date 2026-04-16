import { useEffect, useState } from "react";

type MetricsResponse = {
  totalSearches: number;
  activeCounters: number;
  counters: Record<string, number>;
  error?: string;
};

export default function App() {
  const [metrics, setMetrics] = useState<MetricsResponse | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch("/api/admin/metrics");
        const data = (await res.json()) as MetricsResponse;
        if (!res.ok) {
          throw new Error(data.error || "Could not load metrics");
        }
        setMetrics(data);
      } catch (err) {
        const message = err instanceof Error ? err.message : "Error loading metrics";
        setError(message);
      }
    }

    void load();
  }, []);

  return (
    <main className="dashboard">
      <h1>SceneFind Admin</h1>
      {error ? <p className="error">{error}</p> : null}

      {!metrics ? (
        <p>Loading metrics...</p>
      ) : (
        <>
          <section className="cards">
            <article>
              <h2>Total Searches</h2>
              <p>{metrics.totalSearches}</p>
            </article>
            <article>
              <h2>Active Counters</h2>
              <p>{metrics.activeCounters}</p>
            </article>
          </section>

          <section className="counter-list">
            <h3>Counter Snapshot</h3>
            <pre>{JSON.stringify(metrics.counters, null, 2)}</pre>
          </section>
        </>
      )}
    </main>
  );
}
