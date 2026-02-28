-- Server groups
CREATE TABLE IF NOT EXISTS server_groups (
    id          TEXT PRIMARY KEY,
    name        TEXT NOT NULL,
    color       TEXT,
    sort_order  INTEGER NOT NULL DEFAULT 0,
    created_at  TEXT NOT NULL,
    updated_at  TEXT NOT NULL
);

-- SSH keypairs
CREATE TABLE IF NOT EXISTS keypairs (
    id               TEXT PRIMARY KEY,
    label            TEXT NOT NULL,
    private_key_path TEXT NOT NULL,
    public_key_path  TEXT,
    created_at       TEXT NOT NULL,
    updated_at       TEXT NOT NULL
);
-- passphrase stored in keyring, not in database

-- Servers
CREATE TABLE IF NOT EXISTS servers (
    id                TEXT PRIMARY KEY,
    group_id          TEXT REFERENCES server_groups(id) ON DELETE SET NULL,
    label             TEXT NOT NULL,
    host              TEXT NOT NULL,
    port              INTEGER NOT NULL DEFAULT 22,
    username          TEXT NOT NULL,
    auth_type         TEXT NOT NULL CHECK(auth_type IN ('key','password')),
    key_id            TEXT REFERENCES keypairs(id) ON DELETE SET NULL,
    proxy_jump        TEXT,
    startup_cmd       TEXT,
    notes             TEXT,
    color             TEXT,
    sort_order        INTEGER NOT NULL DEFAULT 0,
    last_connected_at TEXT,
    created_at        TEXT NOT NULL,
    updated_at        TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_servers_group ON servers(group_id);

-- Command logs
CREATE TABLE IF NOT EXISTS command_logs (
    id             TEXT PRIMARY KEY,
    server_id      TEXT NOT NULL REFERENCES servers(id) ON DELETE CASCADE,
    session_id     TEXT NOT NULL,
    command        TEXT NOT NULL,
    output_summary TEXT,
    risk_level     TEXT CHECK(risk_level IN ('low','medium','high')),
    source         TEXT NOT NULL CHECK(source IN ('manual','ai')),
    executed_at    TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_command_logs_server ON command_logs(server_id, executed_at DESC);

-- Settings (key-value store)
CREATE TABLE IF NOT EXISTS settings (
    key   TEXT PRIMARY KEY,
    value TEXT NOT NULL
);

-- Default settings
INSERT OR IGNORE INTO settings (key, value) VALUES
    ('model', 'claude-sonnet-4-20250514'),
    ('terminal_font', 'Monaco'),
    ('terminal_size', '14'),
    ('theme', 'dark'),
    ('output_buffer', '1000'),
    ('context_lines', '50'),
    ('max_chat_rounds', '10');
