/**
 * Next runs this once per server start, before the first request is served.
 *
 * That timing is the whole point: when the web service is cold, the host shows
 * its own "starting up" page while this process boots. Kicking the API awake
 * from here means its cold start overlaps that page instead of beginning after
 * it, so the two services come up together rather than one after the other.
 *
 * Living here rather than in a custom start script also means it runs however
 * the server was launched — `next start`, `next dev`, or a platform's own
 * command — instead of depending on one specific start command being wired up.
 */
export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  if (!process.env.API_PROXY_TARGET?.trim()) return;

  const { wakeApi, keepApiWarm } = await import("./lib/api-wakeup.mjs");

  const log = (event: string, fields: Record<string, unknown> = {}) =>
    console.info(JSON.stringify({ event, ...fields }));

  void (async () => {
    try {
      const first = await wakeApi();
      if (first.status === "ready") {
        log("api_wakeup_ready", { attempts: first.attempts });
      } else if (first.status === "timed-out") {
        console.warn(
          JSON.stringify({
            event: "api_wakeup_timed_out",
            attempts: first.attempts,
          })
        );
      }

      // Quiet in the steady state: a warm API answers on the first attempt, so
      // anything logged from here means it had actually gone away again.
      await keepApiWarm({
        onResult: cycle => {
          if (cycle.status === "timed-out") {
            console.warn(
              JSON.stringify({
                event: "api_keepalive_timed_out",
                attempts: cycle.attempts,
              })
            );
          } else if (cycle.status === "ready" && cycle.attempts > 1) {
            log("api_keepalive_rewoke", { attempts: cycle.attempts });
          }
        },
      });
    } catch (error) {
      console.error(
        JSON.stringify({
          event: "api_wakeup_failed",
          error: error instanceof Error ? error.message : String(error),
        })
      );
    }
  })();
}
