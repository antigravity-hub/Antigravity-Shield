use rusqlite::{params, Connection};
use serde::{Deserialize, Serialize};
use std::path::PathBuf;

/// Aggregated token statistics
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TokenStatsAggregated {
    pub period: String, // e.g., "2024-01-15 14:00" for hourly, "2024-01-15" for daily
    pub total_input_tokens: u64,
    pub total_output_tokens: u64,
    pub total_cached_tokens: u64,
    pub total_tokens: u64,
    pub request_count: u64,
}

/// Per-account token statistics
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AccountTokenStats {
    pub account_email: String,
    pub total_input_tokens: u64,
    pub total_output_tokens: u64,
    pub total_cached_tokens: u64,
    pub total_tokens: u64,
    pub request_count: u64,
}

/// Summary statistics
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TokenStatsSummary {
    pub total_input_tokens: u64,
    pub total_output_tokens: u64,
    pub total_cached_tokens: u64,
    pub total_tokens: u64,
    pub total_requests: u64,
    pub unique_accounts: u64,
}

/// Per-model token statistics
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ModelTokenStats {
    pub model: String,
    pub total_input_tokens: u64,
    pub total_output_tokens: u64,
    pub total_cached_tokens: u64,
    pub total_tokens: u64,
    pub request_count: u64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ModelTrendPoint {
    pub period: String,
    pub model_data: std::collections::HashMap<String, u64>,
}

/// Account trend data point (for stacked area chart)
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AccountTrendPoint {
    pub period: String,
    pub account_data: std::collections::HashMap<String, u64>,
}

/// Normalize raw model identifiers (including thinking degrees, experimental variants, preview tags)
/// into standard canonical model families for clean dashboard display and analytics.
pub fn normalize_model_family(raw: &str) -> String {
    let lower = raw.trim().to_lowercase();
    if lower.is_empty() || lower == "unknown" {
        return "Unknown".to_string();
    }

    // Gemini 3.8 Flash
    if lower.contains("3.8-flash") || lower.contains("3p8-flash") {
        return "Gemini 3.8 Flash".to_string();
    }
    // Gemini 3.7 Flash
    if lower.contains("3.7-flash") || lower.contains("3p7-flash") {
        return "Gemini 3.7 Flash".to_string();
    }
    // Gemini 3.6 Flash
    if lower.contains("3.6-flash") || lower.contains("3p6-flash") {
        return "Gemini 3.6 Flash".to_string();
    }
    // Gemini 3.5 Flash
    if lower.contains("3.5-flash") || lower.contains("3p5-flash") {
        return "Gemini 3.5 Flash".to_string();
    }
    // Gemini 3.1 Pro
    if lower.contains("3.1-pro") || lower.contains("3p1-pro") {
        return "Gemini 3.1 Pro".to_string();
    }
    // Gemini 3.1 Flash
    if lower.contains("3.1-flash") || lower.contains("3p1-flash") {
        return "Gemini 3.1 Flash".to_string();
    }
    // Gemini 2.5 Pro
    if lower.contains("2.5-pro") || lower.contains("2p5-pro") {
        return "Gemini 2.5 Pro".to_string();
    }
    // Gemini 2.5 Flash
    if lower.contains("2.5-flash") || lower.contains("2p5-flash") {
        return "Gemini 2.5 Flash".to_string();
    }
    // Gemini Pro Generic
    if lower == "gemini-pro" || lower == "gemini-pro-agent" || lower.contains("gemini-1.5-pro") {
        return "Gemini Pro".to_string();
    }
    // Gemini Flash Generic
    if lower == "gemini-flash" || lower == "gemini-3-flash" || lower.contains("flash-agent") {
        return "Gemini Flash".to_string();
    }
    // Claude 3.7 / 4 Sonnet
    if lower.contains("sonnet-4") || lower.contains("claude-sonnet") || lower.contains("claude-3-7-sonnet") {
        return "Claude 3.7 Sonnet".to_string();
    }
    // Claude 3.5 / 4 Opus
    if lower.contains("opus-4") || lower.contains("claude-opus") || lower.contains("claude-3-opus") {
        return "Claude 3.7 Opus".to_string();
    }
    // Claude 3.5 Haiku
    if lower.contains("haiku") {
        return "Claude 3.5 Haiku".to_string();
    }
    // GPT-4o / GPT-OSS
    if lower.contains("gpt-oss") || lower == "gpt-oss" {
        return "GPT-OSS Series".to_string();
    }
    if lower.contains("gpt-4o") {
        return "GPT-4o".to_string();
    }
    if lower.contains("o3") {
        return "OpenAI o3".to_string();
    }
    if lower.contains("o1") {
        return "OpenAI o1".to_string();
    }
    // DeepSeek
    if lower.contains("deepseek-r1") || lower.contains("deepseek-reasoner") {
        return "DeepSeek R1".to_string();
    }
    if lower.contains("deepseek-v3") || lower.contains("deepseek-chat") {
        return "DeepSeek V3".to_string();
    }
    // GLM / Z-AI
    if lower.contains("glm-5") || lower.contains("z-ai") {
        return "GLM-5 Flash".to_string();
    }
    // Antigravity Internal Auto
    if lower == "gemini-auto" || lower == "gemini-default" || lower == "g-auto" || lower == "g-default" {
        return "Gemini Auto (Smart Router)".to_string();
    }
    if lower == "antigravity ide" || lower == "gemini-cli" || lower.contains("guide.md") {
        return "Antigravity Assistant".to_string();
    }

    // Default formatting: Capitalize words
    raw.split('-')
        .map(|s| {
            let mut c = s.chars();
            match c.next() {
                None => String::new(),
                Some(f) => f.to_uppercase().collect::<String>() + c.as_str(),
            }
        })
        .collect::<Vec<String>>()
        .join(" ")
}

pub(crate) fn get_db_path() -> Result<PathBuf, String> {
    let data_dir = crate::modules::account::get_data_dir()?;
    Ok(data_dir.join("token_stats.db"))
}

fn connect_db() -> Result<Connection, String> {
    let db_path = get_db_path()?;
    let conn = Connection::open(db_path).map_err(|e| e.to_string())?;

    // Enable WAL mode for better concurrency
    conn.pragma_update(None, "journal_mode", "WAL")
        .map_err(|e| e.to_string())?;
    conn.pragma_update(None, "busy_timeout", 5000)
        .map_err(|e| e.to_string())?;
    conn.pragma_update(None, "synchronous", "NORMAL")
        .map_err(|e| e.to_string())?;

    Ok(conn)
}

fn add_column_if_missing(conn: &Connection, table: &str, column_def: &str) -> Result<(), String> {
    let sql = format!("ALTER TABLE {} ADD COLUMN {}", table, column_def);
    match conn.execute(&sql, []) {
        Ok(_) => Ok(()),
        Err(e) if e.to_string().contains("duplicate column name") => Ok(()),
        Err(e) => Err(e.to_string()),
    }
}

/// Initialize the token stats database
pub fn init_db() -> Result<(), String> {
    let conn = connect_db()?;

    // Create main usage table
    conn.execute(
        "CREATE TABLE IF NOT EXISTS token_usage (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            timestamp INTEGER NOT NULL,
            account_email TEXT NOT NULL,
            model TEXT NOT NULL,
            input_tokens INTEGER NOT NULL DEFAULT 0,
            output_tokens INTEGER NOT NULL DEFAULT 0,
            cached_tokens INTEGER NOT NULL DEFAULT 0,
            total_tokens INTEGER NOT NULL DEFAULT 0
        )",
        [],
    )
    .map_err(|e| e.to_string())?;

    // Create indexes for efficient queries
    conn.execute(
        "CREATE INDEX IF NOT EXISTS idx_token_timestamp ON token_usage (timestamp DESC)",
        [],
    )
    .map_err(|e| e.to_string())?;

    conn.execute(
        "CREATE INDEX IF NOT EXISTS idx_token_account ON token_usage (account_email)",
        [],
    )
    .map_err(|e| e.to_string())?;

    // Create hourly aggregation table for fast queries
    conn.execute(
        "CREATE TABLE IF NOT EXISTS token_stats_hourly (
            hour_bucket TEXT NOT NULL,
            account_email TEXT NOT NULL,
            total_input_tokens INTEGER NOT NULL DEFAULT 0,
            total_output_tokens INTEGER NOT NULL DEFAULT 0,
            total_cached_tokens INTEGER NOT NULL DEFAULT 0,
            total_tokens INTEGER NOT NULL DEFAULT 0,
            request_count INTEGER NOT NULL DEFAULT 0,
            PRIMARY KEY (hour_bucket, account_email)
        )",
        [],
    )
    .map_err(|e| e.to_string())?;

    add_column_if_missing(
        &conn,
        "token_usage",
        "cached_tokens INTEGER NOT NULL DEFAULT 0",
    )?;
    add_column_if_missing(
        &conn,
        "token_stats_hourly",
        "total_cached_tokens INTEGER NOT NULL DEFAULT 0",
    )?;
    add_column_if_missing(
        &conn,
        "token_usage",
        "source TEXT NOT NULL DEFAULT 'Antigravity IDE'",
    )?;

    Ok(())
}

/// Record token usage with source and optional explicit timestamp
pub fn record_usage_full(
    account_email: &str,
    model: &str,
    input_tokens: u32,
    output_tokens: u32,
    cached_tokens: u32,
    source: &str,
    timestamp_opt: Option<i64>,
) -> Result<(), String> {
    let conn = connect_db()?;
    let timestamp = timestamp_opt.unwrap_or_else(|| chrono::Local::now().timestamp());
    let total_tokens = input_tokens + output_tokens;

    // Insert into raw usage table with source
    conn.execute(
        "INSERT INTO token_usage (timestamp, account_email, model, input_tokens, output_tokens, cached_tokens, total_tokens, source)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)",
        params![timestamp, account_email, model, input_tokens, output_tokens, cached_tokens, total_tokens, source],
    ).map_err(|e| e.to_string())?;

    let dt = chrono::DateTime::from_timestamp(timestamp, 0)
        .unwrap_or_else(chrono::Utc::now)
        .with_timezone(&chrono::Local);
    let hour_bucket = dt.format("%Y-%m-%d %H:00").to_string();

    conn.execute(
        "INSERT INTO token_stats_hourly (hour_bucket, account_email, total_input_tokens, total_output_tokens, total_cached_tokens, total_tokens, request_count)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, 1)
         ON CONFLICT(hour_bucket, account_email) DO UPDATE SET
            total_input_tokens = total_input_tokens + ?3,
            total_output_tokens = total_output_tokens + ?4,
            total_cached_tokens = total_cached_tokens + ?5,
            total_tokens = total_tokens + ?6,
            request_count = request_count + 1",
        params![hour_bucket, account_email, input_tokens, output_tokens, cached_tokens, total_tokens],
    ).map_err(|e| e.to_string())?;

    Ok(())
}

/// Record token usage from a request
pub fn record_usage(
    account_email: &str,
    model: &str,
    input_tokens: u32,
    output_tokens: u32,
    cached_tokens: u32,
) -> Result<(), String> {
    record_usage_full(account_email, model, input_tokens, output_tokens, cached_tokens, "Antigravity IDE", None)
}

/// Get hourly aggregated stats for a time range
pub fn get_hourly_stats(hours: i64) -> Result<Vec<TokenStatsAggregated>, String> {
    let conn = connect_db()?;
    let cutoff = chrono::Local::now() - chrono::Duration::hours(hours);
    let cutoff_bucket = cutoff.format("%Y-%m-%d %H:00").to_string();

    let mut stmt = conn
        .prepare(
            "SELECT hour_bucket, 
                SUM(total_input_tokens) as input, 
                SUM(total_output_tokens) as output,
                SUM(total_cached_tokens) as cached,
                SUM(total_tokens) as total,
                SUM(request_count) as count
         FROM token_stats_hourly 
         WHERE hour_bucket >= ?1
         GROUP BY hour_bucket
         ORDER BY hour_bucket ASC",
        )
        .map_err(|e| e.to_string())?;

    let rows = stmt
        .query_map([cutoff_bucket], |row| {
            Ok(TokenStatsAggregated {
                period: row.get(0)?,
                total_input_tokens: row.get(1)?,
                total_output_tokens: row.get(2)?,
                total_cached_tokens: row.get(3)?,
                total_tokens: row.get(4)?,
                request_count: row.get(5)?,
            })
        })
        .map_err(|e| e.to_string())?;

    let mut result = Vec::new();
    for row in rows {
        result.push(row.map_err(|e| e.to_string())?);
    }
    Ok(result)
}

/// Get daily aggregated stats for a time range
pub fn get_daily_stats(days: i64) -> Result<Vec<TokenStatsAggregated>, String> {
    let conn = connect_db()?;
    let cutoff = chrono::Local::now() - chrono::Duration::days(days);
    let cutoff_bucket = cutoff.format("%Y-%m-%d").to_string();

    let mut stmt = conn
        .prepare(
            "SELECT substr(hour_bucket, 1, 10) as day_bucket, 
                SUM(total_input_tokens) as input, 
                SUM(total_output_tokens) as output,
                SUM(total_cached_tokens) as cached,
                SUM(total_tokens) as total,
                SUM(request_count) as count
         FROM token_stats_hourly 
         WHERE substr(hour_bucket, 1, 10) >= ?1
         GROUP BY day_bucket
         ORDER BY day_bucket ASC",
        )
        .map_err(|e| e.to_string())?;

    let rows = stmt
        .query_map([cutoff_bucket], |row| {
            Ok(TokenStatsAggregated {
                period: row.get(0)?,
                total_input_tokens: row.get(1)?,
                total_output_tokens: row.get(2)?,
                total_cached_tokens: row.get(3)?,
                total_tokens: row.get(4)?,
                request_count: row.get(5)?,
            })
        })
        .map_err(|e| e.to_string())?;

    let mut result = Vec::new();
    for row in rows {
        result.push(row.map_err(|e| e.to_string())?);
    }
    Ok(result)
}

/// Get weekly aggregated stats
pub fn get_weekly_stats(weeks: i64) -> Result<Vec<TokenStatsAggregated>, String> {
    let conn = connect_db()?;
    let cutoff = chrono::Local::now() - chrono::Duration::weeks(weeks);
    let cutoff_timestamp = cutoff.timestamp();

    let mut stmt = conn
        .prepare(
            "SELECT strftime('%Y-W%W', datetime(timestamp, 'unixepoch', 'localtime')) as week_bucket,
                SUM(input_tokens) as input, 
                SUM(output_tokens) as output,
                SUM(cached_tokens) as cached,
                SUM(total_tokens) as total,
                COUNT(*) as count
         FROM token_usage 
         WHERE timestamp >= ?1
         GROUP BY week_bucket
         ORDER BY week_bucket ASC",
        )
        .map_err(|e| e.to_string())?;

    let rows = stmt
        .query_map([cutoff_timestamp], |row| {
            Ok(TokenStatsAggregated {
                period: row.get(0)?,
                total_input_tokens: row.get(1)?,
                total_output_tokens: row.get(2)?,
                total_cached_tokens: row.get(3)?,
                total_tokens: row.get(4)?,
                request_count: row.get(5)?,
            })
        })
        .map_err(|e| e.to_string())?;

    let mut result = Vec::new();
    for row in rows {
        result.push(row.map_err(|e| e.to_string())?);
    }
    Ok(result)
}

/// Get per-account statistics for a time range
pub fn get_account_stats(hours: i64) -> Result<Vec<AccountTokenStats>, String> {
    let conn = connect_db()?;
    let cutoff = chrono::Local::now() - chrono::Duration::hours(hours);
    let cutoff_bucket = cutoff.format("%Y-%m-%d %H:00").to_string();

    let mut stmt = conn
        .prepare(
            "SELECT account_email,
                SUM(total_input_tokens) as input, 
                SUM(total_output_tokens) as output,
                SUM(total_cached_tokens) as cached,
                SUM(total_tokens) as total,
                SUM(request_count) as count
         FROM token_stats_hourly 
         WHERE hour_bucket >= ?1
         GROUP BY account_email
         ORDER BY total DESC",
        )
        .map_err(|e| e.to_string())?;

    let rows = stmt
        .query_map([cutoff_bucket], |row| {
            Ok(AccountTokenStats {
                account_email: row.get(0)?,
                total_input_tokens: row.get(1)?,
                total_output_tokens: row.get(2)?,
                total_cached_tokens: row.get(3)?,
                total_tokens: row.get(4)?,
                request_count: row.get(5)?,
            })
        })
        .map_err(|e| e.to_string())?;

    let mut result = Vec::new();
    for row in rows {
        result.push(row.map_err(|e| e.to_string())?);
    }
    Ok(result)
}

/// Get summary statistics for a time range
pub fn get_summary_stats(hours: i64) -> Result<TokenStatsSummary, String> {
    let conn = connect_db()?;
    let cutoff = chrono::Local::now() - chrono::Duration::hours(hours);
    let cutoff_bucket = cutoff.format("%Y-%m-%d %H:00").to_string();

    let (total_input, total_output, total_cached, total, requests): (u64, u64, u64, u64, u64) =
        conn.query_row(
            "SELECT COALESCE(SUM(total_input_tokens), 0),
                COALESCE(SUM(total_output_tokens), 0),
                COALESCE(SUM(total_cached_tokens), 0),
                COALESCE(SUM(total_tokens), 0),
                COALESCE(SUM(request_count), 0)
         FROM token_stats_hourly 
         WHERE hour_bucket >= ?1",
            [&cutoff_bucket],
            |row| {
                Ok((
                    row.get(0)?,
                    row.get(1)?,
                    row.get(2)?,
                    row.get(3)?,
                    row.get(4)?,
                ))
            },
        )
        .map_err(|e| e.to_string())?;

    let unique_accounts: u64 = conn
        .query_row(
            "SELECT COUNT(DISTINCT account_email) FROM token_stats_hourly WHERE hour_bucket >= ?1",
            [&cutoff_bucket],
            |row| row.get(0),
        )
        .map_err(|e| e.to_string())?;

    Ok(TokenStatsSummary {
        total_input_tokens: total_input,
        total_output_tokens: total_output,
        total_cached_tokens: total_cached,
        total_tokens: total,
        total_requests: requests,
        unique_accounts,
    })
}

pub fn get_model_stats(hours: i64) -> Result<Vec<ModelTokenStats>, String> {
    let conn = connect_db()?;
    let cutoff = chrono::Local::now().timestamp() - (hours * 3600);

    let mut stmt = conn
        .prepare(
            "SELECT model,
                SUM(input_tokens) as input,
                SUM(output_tokens) as output,
                SUM(cached_tokens) as cached,
                SUM(total_tokens) as total,
                COUNT(*) as count
         FROM token_usage
         WHERE timestamp >= ?1
         GROUP BY model
         ORDER BY total DESC",
        )
        .map_err(|e| e.to_string())?;

    let rows = stmt
        .query_map([cutoff], |row| {
            Ok(ModelTokenStats {
                model: row.get(0)?,
                total_input_tokens: row.get(1)?,
                total_output_tokens: row.get(2)?,
                total_cached_tokens: row.get(3)?,
                total_tokens: row.get(4)?,
                request_count: row.get(5)?,
            })
        })
        .map_err(|e| e.to_string())?;

    let mut family_map: std::collections::HashMap<String, ModelTokenStats> = std::collections::HashMap::new();
    for row in rows {
        let stat = row.map_err(|e| e.to_string())?;
        let family = normalize_model_family(&stat.model);
        let entry = family_map.entry(family.clone()).or_insert_with(|| ModelTokenStats {
            model: family,
            total_input_tokens: 0,
            total_output_tokens: 0,
            total_cached_tokens: 0,
            total_tokens: 0,
            request_count: 0,
        });
        entry.total_input_tokens += stat.total_input_tokens;
        entry.total_output_tokens += stat.total_output_tokens;
        entry.total_cached_tokens += stat.total_cached_tokens;
        entry.total_tokens += stat.total_tokens;
        entry.request_count += stat.request_count;
    }

    let mut result: Vec<ModelTokenStats> = family_map.into_values().collect();
    result.sort_by(|a, b| b.total_tokens.cmp(&a.total_tokens));
    Ok(result)
}

pub fn get_model_trend_hourly(hours: i64) -> Result<Vec<ModelTrendPoint>, String> {
    let conn = connect_db()?;
    let cutoff = chrono::Local::now().timestamp() - (hours * 3600);

    let mut stmt = conn
        .prepare(
            "SELECT strftime('%Y-%m-%d %H:00', datetime(timestamp, 'unixepoch', 'localtime')) as hour_bucket,
                model,
                SUM(total_tokens) as total
         FROM token_usage
         WHERE timestamp >= ?1
         GROUP BY hour_bucket, model
         ORDER BY hour_bucket ASC",
        )
        .map_err(|e| e.to_string())?;

    let mut trend_map: std::collections::BTreeMap<String, std::collections::HashMap<String, u64>> =
        std::collections::BTreeMap::new();

    let rows = stmt
        .query_map([cutoff], |row| {
            Ok((
                row.get::<_, String>(0)?,
                row.get::<_, String>(1)?,
                row.get::<_, u64>(2)?,
            ))
        })
        .map_err(|e| e.to_string())?;

    for row in rows {
        let (period, model, total) = row.map_err(|e| e.to_string())?;
        let family = normalize_model_family(&model);
        let period_entry = trend_map.entry(period).or_default();
        *period_entry.entry(family).or_insert(0) += total;
    }

    Ok(trend_map
        .into_iter()
        .map(|(period, model_data)| ModelTrendPoint { period, model_data })
        .collect())
}

pub fn get_model_trend_daily(days: i64) -> Result<Vec<ModelTrendPoint>, String> {
    let conn = connect_db()?;
    let cutoff = chrono::Local::now().timestamp() - (days * 24 * 3600);

    let mut stmt = conn
        .prepare(
            "SELECT strftime('%Y-%m-%d', datetime(timestamp, 'unixepoch', 'localtime')) as day_bucket,
                model,
                SUM(total_tokens) as total
         FROM token_usage
         WHERE timestamp >= ?1
         GROUP BY day_bucket, model
         ORDER BY day_bucket ASC",
        )
        .map_err(|e| e.to_string())?;

    let mut trend_map: std::collections::BTreeMap<String, std::collections::HashMap<String, u64>> =
        std::collections::BTreeMap::new();

    let rows = stmt
        .query_map([cutoff], |row| {
            Ok((
                row.get::<_, String>(0)?,
                row.get::<_, String>(1)?,
                row.get::<_, u64>(2)?,
            ))
        })
        .map_err(|e| e.to_string())?;

    for row in rows {
        let (period, model, total) = row.map_err(|e| e.to_string())?;
        let family = normalize_model_family(&model);
        let period_entry = trend_map.entry(period).or_default();
        *period_entry.entry(family).or_insert(0) += total;
    }

    Ok(trend_map
        .into_iter()
        .map(|(period, model_data)| ModelTrendPoint { period, model_data })
        .collect())
}

pub fn get_account_trend_hourly(hours: i64) -> Result<Vec<AccountTrendPoint>, String> {
    let conn = connect_db()?;
    let cutoff = chrono::Local::now().timestamp() - (hours * 3600);

    let mut stmt = conn
        .prepare(
            "SELECT strftime('%Y-%m-%d %H:00', datetime(timestamp, 'unixepoch', 'localtime')) as hour_bucket,
                account_email,
                SUM(total_tokens) as total
         FROM token_usage
         WHERE timestamp >= ?1
         GROUP BY hour_bucket, account_email
         ORDER BY hour_bucket ASC",
        )
        .map_err(|e| e.to_string())?;

    let mut trend_map: std::collections::BTreeMap<String, std::collections::HashMap<String, u64>> =
        std::collections::BTreeMap::new();

    let rows = stmt
        .query_map([cutoff], |row| {
            Ok((
                row.get::<_, String>(0)?,
                row.get::<_, String>(1)?,
                row.get::<_, u64>(2)?,
            ))
        })
        .map_err(|e| e.to_string())?;

    for row in rows {
        let (period, account, total) = row.map_err(|e| e.to_string())?;
        trend_map.entry(period).or_default().insert(account, total);
    }

    Ok(trend_map
        .into_iter()
        .map(|(period, account_data)| AccountTrendPoint {
            period,
            account_data,
        })
        .collect())
}

pub fn get_account_trend_daily(days: i64) -> Result<Vec<AccountTrendPoint>, String> {
    let conn = connect_db()?;
    let cutoff = chrono::Local::now().timestamp() - (days * 24 * 3600);

    let mut stmt = conn
        .prepare(
            "SELECT strftime('%Y-%m-%d', datetime(timestamp, 'unixepoch', 'localtime')) as day_bucket,
                account_email,
                SUM(total_tokens) as total
         FROM token_usage
         WHERE timestamp >= ?1
         GROUP BY day_bucket, account_email
         ORDER BY day_bucket ASC",
        )
        .map_err(|e| e.to_string())?;

    let mut trend_map: std::collections::BTreeMap<String, std::collections::HashMap<String, u64>> =
        std::collections::BTreeMap::new();

    let rows = stmt
        .query_map([cutoff], |row| {
            Ok((
                row.get::<_, String>(0)?,
                row.get::<_, String>(1)?,
                row.get::<_, u64>(2)?,
            ))
        })
        .map_err(|e| e.to_string())?;

    for row in rows {
        let (period, account, total) = row.map_err(|e| e.to_string())?;
        trend_map.entry(period).or_default().insert(account, total);
    }

    Ok(trend_map
        .into_iter()
        .map(|(period, account_data)| AccountTrendPoint {
            period,
            account_data,
        })
        .collect())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_record_and_query() {
        // This would need a test database setup
        // For now, just verify the module compiles
        assert!(true);
    }
}
