use protocol::{
    DO_MEMORY_GB, FREE_DO_DURATION_GBS, FREE_DO_REQUESTS, FREE_ROWS_READ, FREE_ROWS_WRITTEN,
    FREE_WORKER_REQUESTS, UsageMetric, UsageResponse,
};
use serde_json::{Value, json};
use worker::*;

use crate::RoomInit;
use crate::metering::{self, Counts};
use crate::util::today_utc;

const GRAPHQL: &str = "https://api.cloudflare.com/client/v4/graphql";

/// One metric = one GraphQL query, so an unknown field fails only that metric.
struct Query {
    id: &'static str,
    limit: f64,
    dataset: &'static str,
    filter: &'static str,
    field: &'static str,
    /// Converts the raw GraphQL value to the metric's unit.
    scale: f64,
}

const QUERIES: [Query; 5] = [
    Query {
        id: "worker_requests",
        limit: FREE_WORKER_REQUESTS,
        dataset: "workersInvocationsAdaptive",
        filter: "datetime_geq: $since",
        field: "requests",
        scale: 1.0,
    },
    Query {
        id: "do_requests",
        limit: FREE_DO_REQUESTS,
        dataset: "durableObjectsInvocationsAdaptiveGroups",
        filter: "date_geq: $day",
        field: "requests",
        scale: 1.0,
    },
    Query {
        id: "do_duration",
        limit: FREE_DO_DURATION_GBS,
        dataset: "durableObjectsPeriodicGroups",
        filter: "date_geq: $day",
        field: "activeTime",
        // activeTime is in microseconds; billed memory is fixed at 128 MB.
        scale: DO_MEMORY_GB / 1_000_000.0,
    },
    Query {
        id: "rows_read",
        limit: FREE_ROWS_READ,
        dataset: "durableObjectsPeriodicGroups",
        filter: "date_geq: $day",
        field: "rowsRead",
        scale: 1.0,
    },
    Query {
        id: "rows_written",
        limit: FREE_ROWS_WRITTEN,
        dataset: "durableObjectsPeriodicGroups",
        filter: "date_geq: $day",
        field: "rowsWritten",
        scale: 1.0,
    },
];

async fn run(account: &str, token: &str, q: &Query, day: &str) -> std::result::Result<f64, String> {
    let query = format!(
        "query($account: String!, $day: Date!, $since: Time!) {{ viewer {{ accounts(filter: {{accountTag: $account}}) {{ {}(limit: 10000, filter: {{{}}}) {{ sum {{ {} }} }} }} }} }}",
        q.dataset, q.filter, q.field
    );
    let body = json!({
        "query": query,
        "variables": { "account": account, "day": day, "since": format!("{day}T00:00:00Z") },
    });
    let headers = Headers::new();
    headers
        .set("Authorization", &format!("Bearer {token}"))
        .map_err(|e| e.to_string())?;
    headers
        .set("Content-Type", "application/json")
        .map_err(|e| e.to_string())?;
    let mut init = RequestInit::new();
    init.with_method(Method::Post)
        .with_headers(headers)
        .with_body(Some(body.to_string().into()));
    let req = Request::new_with_init(GRAPHQL, &init).map_err(|e| e.to_string())?;
    let mut resp = Fetch::Request(req)
        .send()
        .await
        .map_err(|e| e.to_string())?;
    let v: Value = resp.json().await.map_err(|e| e.to_string())?;
    if let Some(errs) = v
        .get("errors")
        .and_then(Value::as_array)
        .filter(|e| !e.is_empty())
    {
        let msg = errs
            .iter()
            .filter_map(|e| e.get("message").and_then(Value::as_str))
            .collect::<Vec<_>>()
            .join("; ");
        return Err(format!("{}: {msg}", q.id));
    }
    let rows = v
        .pointer(&format!("/data/viewer/accounts/0/{}", q.dataset))
        .and_then(Value::as_array)
        .ok_or_else(|| format!("{}: unexpected response", q.id))?;
    Ok(rows
        .iter()
        .filter_map(|r| {
            r.pointer(&format!("/sum/{}", q.field))
                .and_then(Value::as_f64)
        })
        .sum::<f64>()
        * q.scale)
}

/// Sums the dev-only counters kept by the registry and every room.
async fn local_counts(env: &Env) -> Result<Counts> {
    let registry = env.durable_object("REGISTRY")?.get_by_name("registry")?;
    let mut total: Counts = registry
        .fetch_with_str("https://registry/usage")
        .await?
        .json()
        .await?;
    let rooms: Vec<RoomInit> = registry
        .fetch_with_str("https://registry/list")
        .await?
        .json()
        .await?;
    let ns = env.durable_object("ROOMS")?;
    for r in rooms {
        let mut resp = ns
            .get_by_name(&r.room)?
            .fetch_with_str("https://room/usage")
            .await?;
        if resp.status_code() == 200 {
            total.add(resp.json().await?);
        }
    }
    Ok(total)
}

pub async fn usage(env: &Env) -> Result<Response> {
    let day = today_utc();
    let creds = env
        .secret("CF_ACCOUNT_ID")
        .ok()
        .zip(env.secret("CF_API_TOKEN").ok())
        .map(|(a, t)| (a.to_string(), t.to_string()))
        .filter(|(a, t)| !a.trim().is_empty() && !t.trim().is_empty());
    let mut metrics = Vec::new();
    let mut errors = Vec::new();
    let source = if let Some((account, token)) = &creds {
        for q in &QUERIES {
            let used = match run(account, token, q, &day).await {
                Ok(n) => Some(n),
                Err(e) => {
                    errors.push(e);
                    None
                }
            };
            metrics.push(UsageMetric {
                id: q.id.into(),
                used,
                limit: q.limit,
            });
        }
        "cloudflare"
    } else if metering::enabled(env) {
        let c = local_counts(env).await?;
        let local = [
            c.worker_requests,
            c.requests,
            c.active_secs * DO_MEMORY_GB,
            c.rows_read,
            c.rows_written,
        ];
        for (q, used) in QUERIES.iter().zip(local) {
            metrics.push(UsageMetric {
                id: q.id.into(),
                used: Some((used * 100.0).round() / 100.0),
                limit: q.limit,
            });
        }
        "local"
    } else {
        "none"
    };
    crate::util::json_response(
        &UsageResponse {
            source: source.into(),
            day,
            metrics,
            errors,
        },
        200,
    )
}
