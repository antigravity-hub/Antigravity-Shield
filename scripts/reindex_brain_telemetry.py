import glob
import json
import os
import re
import shutil
import sqlite3
import datetime

CHAR_TO_TOKEN_RATIO = 3.8

def extract_model_from_blob(data):
    if not data:
        return None
    # 1. Protobuf Tag 19 (0x9a 0x01) - Google Antigravity standard model field
    pos = data.rfind(b'\x9a\x01')
    if pos != -1 and pos + 2 < len(data):
        l = data[pos+2]
        if pos + 3 + l <= len(data):
            cand = data[pos+3:pos+3+l].decode('utf-8', errors='ignore')
            if len(cand) >= 3 and all(c.isalnum() or c in '-._' for c in cand):
                return cand
    # 2. Dynamic regex: matches any vendor prefix + model identifier (future-proof)
    matches = re.findall(rb'(?:gemini|claude|gpt|o1|o3|o4|deepseek|llama|qwen|mistral|codestral)-[a-zA-Z0-9\.\-]+', data)
    if matches:
        return matches[-1].decode('utf-8', errors='ignore')
    return None

def extract_conversation_models(db_path):
    """Extract model mapping per step_index or overall conversation model."""
    step_models = {}
    default_model = "gemini-auto"
    platform = "Antigravity IDE"

    try:
        conn = sqlite3.connect(db_path)
        cur = conn.cursor()

        # Check executor_metadata for platform
        try:
            cur.execute("SELECT data FROM executor_metadata LIMIT 1")
            ex_row = cur.fetchone()
            if ex_row and ex_row[0]:
                if b'As IDE feedback' in ex_row[0] or b'antigravity-ide' in ex_row[0]:
                    platform = "Antigravity IDE"
                elif b'antigravity-cli' in ex_row[0]:
                    platform = "Antigravity CLI"
                else:
                    platform = "Antigravity Platform"
        except Exception:
            pass

        # Check gen_metadata for models
        try:
            cur.execute("SELECT idx, data FROM gen_metadata ORDER BY idx ASC")
            for idx, data in cur.fetchall():
                m = extract_model_from_blob(data)
                if m:
                    default_model = m
                    step_m = re.findall(rb'last_step_index[^\d]*(\d+)', data)
                    if step_m:
                        step_idx = int(step_m[0].decode())
                        step_models[step_idx] = m
        except Exception:
            pass

        conn.close()
    except Exception:
        pass

    return default_model, step_models, platform

def main():
    db_path = r'C:\Users\ersha\.antigravity_tools\token_stats.db'
    if not os.path.exists(db_path):
        print(f"Error: Database not found at {db_path}")
        return

    # Backup DB
    bak_path = db_path + '.bak'
    shutil.copy2(db_path, bak_path)
    print(f"Backup created at {bak_path}")

    gemini_root = r'C:\Users\ersha\.gemini'
    
    # 1. Scan all conversation metadata
    conv_metadata = {}
    for env_dir in glob.glob(os.path.join(gemini_root, "antigravity*")):
        c_dir = os.path.join(env_dir, "conversations")
        if not os.path.isdir(c_dir):
            continue
        for db_file in glob.glob(os.path.join(c_dir, "*.db")):
            cid = os.path.splitext(os.path.basename(db_file))[0]
            def_model, step_models, platform = extract_conversation_models(db_file)
            conv_metadata[cid] = {
                "default_model": def_model,
                "step_models": step_models,
                "platform": platform,
                "env_dir": env_dir
            }

    print(f"Discovered {len(conv_metadata)} conversation databases.")

    # 2. Locate all brain transcripts (prefer transcript_full.jsonl)
    transcript_files = {}
    for env_dir in glob.glob(os.path.join(gemini_root, "antigravity*")):
        b_dir = os.path.join(env_dir, "brain")
        if not os.path.isdir(b_dir):
            continue
        for c_entry in os.listdir(b_dir):
            full_logs = os.path.join(b_dir, c_entry, ".system_generated", "logs")
            if not os.path.isdir(full_logs):
                continue
            tf_full = os.path.join(full_logs, "transcript_full.jsonl")
            tf_std = os.path.join(full_logs, "transcript.jsonl")
            if os.path.exists(tf_full):
                transcript_files[c_entry] = tf_full
            elif os.path.exists(tf_std):
                transcript_files[c_entry] = tf_std

    print(f"Found {len(transcript_files)} conversation transcripts.")

    # 3. Connect to DB and clean corrupted data
    conn = sqlite3.connect(db_path)
    cur = conn.cursor()

    cur.execute("PRAGMA foreign_keys = OFF")
    cur.execute("PRAGMA journal_mode = WAL")
    cur.execute("PRAGMA synchronous = NORMAL")

    print("Cleaning obsolete hardcoded records from token_usage and token_stats_hourly...")
    cur.execute("DELETE FROM token_usage WHERE model IN ('gemini-2.5-pro', 'user-prompt', 'Antigravity IDE')")
    cur.execute("DELETE FROM brain_scan_progress")
    cur.execute("DELETE FROM token_stats_hourly")

    # 4. Process all conversations
    token_usage_batch = []
    hourly_agg = {} # (hour_bucket, account_email) -> {'in':, 'out':, 'cached':, 'tot':, 'reqs':}
    scan_progress = []

    account_email = "ershad.zolfi@gmail.com"
    total_in = 0
    total_out = 0
    total_lines = 0

    for cid, t_path in transcript_files.items():
        meta = conv_metadata.get(cid, {
            "default_model": "gemini-auto",
            "step_models": {},
            "platform": "Antigravity IDE" if "ide" in t_path else "Antigravity Platform"
        })

        def_model = meta["default_model"]
        step_models = meta["step_models"]
        platform = meta["platform"]

        line_count = 0
        conv_tokens = 0

        # Maintain pending user input tokens to attribute to the subsequent model response
        pending_in_tokens = 0
        pending_in_timestamp = None

        with open(t_path, "r", encoding="utf-8", errors="ignore") as f:
            for line in f:
                line_count += 1
                line = line.strip()
                if not line:
                    continue
                try:
                    d = json.loads(line)
                    ts_str = d.get("created_at")
                    if not ts_str:
                        continue
                    ts_clean = ts_str.replace("Z", "+00:00")
                    dt = datetime.datetime.fromisoformat(ts_clean)
                    unix_ts = int(dt.timestamp())
                    hour_bucket = dt.strftime("%Y-%m-%d %H:00")

                    stype = d.get("type")
                    source = d.get("source")
                    step_idx = d.get("step_index", line_count)

                    in_t = 0
                    out_t = 0
                    cached_t = 0

                    if "usage" in d and isinstance(d["usage"], dict):
                        in_t = d["usage"].get("input_tokens", 0)
                        out_t = d["usage"].get("output_tokens", 0)
                        cached_t = d["usage"].get("cached_tokens", 0)

                    if stype in ("USER_INPUT", "USER_EXPLICIT") or source == "USER":
                        if in_t == 0:
                            content = d.get("content") or ""
                            in_t = max(1, int(len(content) / CHAR_TO_TOKEN_RATIO))
                        pending_in_tokens += in_t
                        pending_in_timestamp = unix_ts

                    elif stype == "GENERIC":
                        # Tool output returned to model
                        content = d.get("content") or ""
                        tool_in = max(1, int(len(content) / CHAR_TO_TOKEN_RATIO))
                        pending_in_tokens += tool_in

                    elif stype == "PLANNER_RESPONSE" or source == "MODEL":
                        if out_t == 0:
                            c_len = len(d.get("content") or "")
                            th_len = len(d.get("thinking") or "")
                            tc_len = sum(len(json.dumps(tc)) for tc in d.get("tool_calls", []))
                            out_t = max(1, int((c_len + th_len + tc_len) / CHAR_TO_TOKEN_RATIO))

                        # Determine model for this turn
                        turn_model = step_models.get(step_idx, def_model)

                        # Pair with accumulated input tokens for this turn
                        turn_in_t = pending_in_tokens
                        pending_in_tokens = 0
                        turn_ts = unix_ts

                        tot = turn_in_t + out_t
                        if tot > 0:
                            token_usage_batch.append((
                                turn_ts,
                                account_email,
                                turn_model,
                                turn_in_t,
                                out_t,
                                cached_t,
                                tot,
                                platform
                            ))

                            total_in += turn_in_t
                            total_out += out_t
                            conv_tokens += tot

                            # Accumulate hourly
                            h_key = (hour_bucket, account_email)
                            if h_key not in hourly_agg:
                                hourly_agg[h_key] = {"in": 0, "out": 0, "cached": 0, "tot": 0, "reqs": 0}
                            hourly_agg[h_key]["in"] += turn_in_t
                            hourly_agg[h_key]["out"] += out_t
                            hourly_agg[h_key]["cached"] += cached_t
                            hourly_agg[h_key]["tot"] += tot
                            hourly_agg[h_key]["reqs"] += 1

                except Exception:
                    pass

        # If any pending input remains (e.g. final user prompt without model response yet)
        if pending_in_tokens > 0:
            tot = pending_in_tokens
            turn_ts = pending_in_timestamp or int(datetime.datetime.now().timestamp())
            token_usage_batch.append((
                turn_ts,
                account_email,
                def_model,
                pending_in_tokens,
                0,
                0,
                tot,
                platform
            ))
            total_in += pending_in_tokens
            conv_tokens += tot

        total_lines += line_count
        scan_progress.append((
            cid,
            line_count,
            int(datetime.datetime.now().timestamp()),
            conv_tokens
        ))

    print(f"Parsed {len(token_usage_batch)} turns across {len(transcript_files)} conversations.")
    print(f"Total Input Tokens: {total_in:,} | Total Output Tokens: {total_out:,} | Total: {total_in+total_out:,}")

    # Bulk insert token_usage
    print("Writing to token_usage...")
    cur.executemany("""
        INSERT INTO token_usage (timestamp, account_email, model, input_tokens, output_tokens, cached_tokens, total_tokens, source)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    """, token_usage_batch)

    # Bulk insert hourly_agg
    print(f"Populating {len(hourly_agg)} hourly buckets into token_stats_hourly...")
    hourly_rows = [
        (k[0], k[1], v["in"], v["out"], v["cached"], v["tot"], v["reqs"])
        for k, v in hourly_agg.items()
    ]
    cur.executemany("""
        INSERT INTO token_stats_hourly (hour_bucket, account_email, total_input_tokens, total_output_tokens, total_cached_tokens, total_tokens, request_count)
        VALUES (?, ?, ?, ?, ?, ?, ?)
    """, hourly_rows)

    # Bulk insert brain_scan_progress
    print("Updating brain_scan_progress...")
    cur.executemany("""
        INSERT INTO brain_scan_progress (conversation_id, last_line_offset, last_scan_timestamp, total_tokens_found)
        VALUES (?, ?, ?, ?)
    """, scan_progress)

    conn.commit()
    conn.close()
    print("Telemetry re-indexing completed successfully!")

if __name__ == "__main__":
    main()
