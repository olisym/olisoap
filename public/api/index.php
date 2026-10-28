<?php
// olisoap Sync-API. Speichert nur verschlüsselte Datensätze: Der Server sieht weder Rezepte noch Bestände.
//
// Konfiguration liegt außerhalb des Web-Verzeichnisses (siehe docs/olisoap-config.sample.php):
//   <Domain-Verzeichnis>/olisoap-config.php  (eine Ebene über httpdocs)
// oder in der Umgebungsvariable OLISOAP_CONFIG.
//
// Endpunkte (POST, JSON), Parameter ?a=…:
//   register  { user, auth, code }     → { token }   nur mit dem Registrierungscode aus der Konfiguration
//   login     { user, auth }           → { token }
//   pull      { since }                → { records: [...], seq }
//   push      { records: [...] }       → { seq }
//   logout    {}

declare(strict_types=1);

header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store');
header('X-Content-Type-Options: nosniff');

function fail(int $code, string $message): never
{
    http_response_code($code);
    echo json_encode(['error' => $message]);
    exit;
}

$configFile = getenv('OLISOAP_CONFIG') ?: dirname(__DIR__, 2) . '/olisoap-config.php';
if (!is_file($configFile)) fail(500, 'Konfiguration fehlt');
$config = require $configFile;

// CORS nur für ausdrücklich erlaubte Herkünfte (z. B. die GitHub-Pages-Version).
$origin = $_SERVER['HTTP_ORIGIN'] ?? '';
if ($origin && in_array($origin, $config['allowed_origins'] ?? [], true)) {
    header("Access-Control-Allow-Origin: $origin");
    header('Access-Control-Allow-Headers: Content-Type, Authorization');
    header('Access-Control-Allow-Methods: POST, OPTIONS');
    header('Vary: Origin');
}
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') exit;
if ($_SERVER['REQUEST_METHOD'] !== 'POST') fail(405, 'Nur POST');

$p = preg_replace('/[^a-z0-9_]/i', '', $config['prefix'] ?? 'olisoap_');
try {
    $db = new PDO($config['dsn'], $config['user'] ?? null, $config['password'] ?? null, [
        PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
        PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
    ]);
} catch (PDOException) {
    fail(500, 'Datenbank nicht erreichbar');
}
$mysql = $db->getAttribute(PDO::ATTR_DRIVER_NAME) === 'mysql';

// Tabellen beim ersten Aufruf anlegen. Alle mit eigenem Präfix, damit andere Apps in derselben Datenbank unberührt bleiben.
$text = $mysql ? 'MEDIUMTEXT' : 'TEXT';
$auto = $mysql ? 'INT AUTO_INCREMENT PRIMARY KEY' : 'INTEGER PRIMARY KEY AUTOINCREMENT';
$db->exec("CREATE TABLE IF NOT EXISTS {$p}users (id $auto, name VARCHAR(100) NOT NULL UNIQUE, auth_hash VARCHAR(255) NOT NULL, created_at BIGINT NOT NULL)");
$db->exec("CREATE TABLE IF NOT EXISTS {$p}sessions (token_hash CHAR(64) PRIMARY KEY, user_id INT NOT NULL, expires_at BIGINT NOT NULL)");
$db->exec("CREATE TABLE IF NOT EXISTS {$p}records (user_id INT NOT NULL, tbl VARCHAR(40) NOT NULL, rid VARCHAR(100) NOT NULL, seq BIGINT NOT NULL, deleted SMALLINT NOT NULL DEFAULT 0, data $text, PRIMARY KEY (user_id, tbl, rid))");
$db->exec("CREATE TABLE IF NOT EXISTS {$p}counter (id INT PRIMARY KEY, v BIGINT NOT NULL)");
try {
    $db->exec("CREATE INDEX {$p}records_seq ON {$p}records (user_id, seq)");
} catch (PDOException) {
    // Index existiert bereits.
}

$body = json_decode(file_get_contents('php://input') ?: '{}', true);
if (!is_array($body)) fail(400, 'Ungültiges JSON');
$action = $_GET['a'] ?? '';
$now = (int) (microtime(true) * 1000);
const SESSION_DAYS = 90;

function newSession(PDO $db, string $p, int $userId, int $now): string
{
    $token = bin2hex(random_bytes(32));
    $db->prepare("INSERT INTO {$p}sessions (token_hash, user_id, expires_at) VALUES (?, ?, ?)")
        ->execute([hash('sha256', $token), $userId, $now + SESSION_DAYS * 86400000]);
    $db->prepare("DELETE FROM {$p}sessions WHERE expires_at < ?")->execute([$now]);
    return $token;
}

function credentials(array $body): array
{
    $user = trim((string) ($body['user'] ?? ''));
    $auth = (string) ($body['auth'] ?? '');
    // auth ist ein im Browser aus der Passphrase abgeleiteter Wert (64 Hex-Zeichen), nicht die Passphrase selbst.
    if ($user === '' || strlen($user) > 100 || !preg_match('/^[0-9a-f]{64}$/', $auth)) fail(400, 'Benutzer oder Schlüssel ungültig');
    return [$user, $auth];
}

function currentUser(PDO $db, string $p, int $now): int
{
    $h = $_SERVER['HTTP_AUTHORIZATION'] ?? $_SERVER['REDIRECT_HTTP_AUTHORIZATION'] ?? '';
    if (!preg_match('/^Bearer ([0-9a-f]{64})$/', $h, $m)) fail(401, 'Nicht angemeldet');
    $st = $db->prepare("SELECT user_id FROM {$p}sessions WHERE token_hash = ? AND expires_at > ?");
    $st->execute([hash('sha256', $m[1]), $now]);
    $id = $st->fetchColumn();
    if ($id === false) fail(401, 'Sitzung abgelaufen');
    return (int) $id;
}

function nextSeq(PDO $db, string $p, bool $mysql): int
{
    if ($mysql) {
        $db->exec("INSERT INTO {$p}counter (id, v) VALUES (1, LAST_INSERT_ID(1)) ON DUPLICATE KEY UPDATE v = LAST_INSERT_ID(v + 1)");
        return (int) $db->lastInsertId();
    }
    $db->exec("INSERT INTO {$p}counter (id, v) VALUES (1, 1) ON CONFLICT(id) DO UPDATE SET v = v + 1");
    return (int) $db->query("SELECT v FROM {$p}counter WHERE id = 1")->fetchColumn();
}

switch ($action) {
    case 'register': {
        [$user, $auth] = credentials($body);
        // Registrierung nur mit dem Code aus der Konfigurationsdatei, damit niemand sonst ein Konto anlegt.
        $code = (string) ($config['register_code'] ?? '');
        if ($code === '' || !hash_equals($code, (string) ($body['code'] ?? ''))) {
            sleep(1);
            fail(403, 'Registrierungscode falsch oder Registrierung geschlossen');
        }
        try {
            $db->prepare("INSERT INTO {$p}users (name, auth_hash, created_at) VALUES (?, ?, ?)")
                ->execute([$user, password_hash($auth, PASSWORD_DEFAULT), $now]);
        } catch (PDOException) {
            fail(409, 'Benutzer existiert bereits');
        }
        echo json_encode(['token' => newSession($db, $p, (int) $db->lastInsertId(), $now)]);
        break;
    }
    case 'login': {
        [$user, $auth] = credentials($body);
        $st = $db->prepare("SELECT id, auth_hash FROM {$p}users WHERE name = ?");
        $st->execute([$user]);
        $row = $st->fetch();
        if (!$row || !password_verify($auth, $row['auth_hash'])) {
            sleep(1); // bremst Rateversuche
            fail(401, 'Benutzer oder Passphrase falsch');
        }
        echo json_encode(['token' => newSession($db, $p, (int) $row['id'], $now)]);
        break;
    }
    case 'logout': {
        $uid = currentUser($db, $p, $now);
        $h = $_SERVER['HTTP_AUTHORIZATION'] ?? $_SERVER['REDIRECT_HTTP_AUTHORIZATION'] ?? '';
        $db->prepare("DELETE FROM {$p}sessions WHERE token_hash = ? AND user_id = ?")->execute([hash('sha256', substr($h, 7)), $uid]);
        echo json_encode(['ok' => true]);
        break;
    }
    case 'pull': {
        $uid = currentUser($db, $p, $now);
        $since = (int) ($body['since'] ?? 0);
        $limit = 500;
        $st = $db->prepare("SELECT tbl, rid, seq, deleted, data FROM {$p}records WHERE user_id = ? AND seq > ? ORDER BY seq LIMIT $limit");
        $st->execute([$uid, $since]);
        $rows = $st->fetchAll();
        echo json_encode([
            'records' => array_map(fn ($r) => ['tbl' => $r['tbl'], 'id' => $r['rid'], 'seq' => (int) $r['seq'], 'deleted' => (bool) $r['deleted'], 'data' => $r['data']], $rows),
            'more' => count($rows) === $limit,
        ]);
        break;
    }
    case 'push': {
        $uid = currentUser($db, $p, $now);
        $records = $body['records'] ?? [];
        if (!is_array($records) || count($records) > 500) fail(400, 'Höchstens 500 Datensätze pro Aufruf');
        $upsert = $mysql
            ? "INSERT INTO {$p}records (user_id, tbl, rid, seq, deleted, data) VALUES (?, ?, ?, ?, ?, ?) ON DUPLICATE KEY UPDATE seq = VALUES(seq), deleted = VALUES(deleted), data = VALUES(data)"
            : "INSERT INTO {$p}records (user_id, tbl, rid, seq, deleted, data) VALUES (?, ?, ?, ?, ?, ?) ON CONFLICT(user_id, tbl, rid) DO UPDATE SET seq = excluded.seq, deleted = excluded.deleted, data = excluded.data";
        $st = $db->prepare($upsert);
        $seqs = [];
        $db->beginTransaction();
        foreach ($records as $r) {
            $tbl = (string) ($r['tbl'] ?? '');
            $id = (string) ($r['id'] ?? '');
            $deleted = !empty($r['deleted']);
            $data = $deleted ? null : (string) ($r['data'] ?? '');
            if (!preg_match('/^[a-zA-Z]{1,40}$/', $tbl) || $id === '' || strlen($id) > 100 || (!$deleted && strlen($data) > 4_000_000)) {
                $db->rollBack();
                fail(400, 'Ungültiger Datensatz');
            }
            $seq = nextSeq($db, $p, $mysql);
            $st->execute([$uid, $tbl, $id, $seq, $deleted ? 1 : 0, $data]);
            $seqs[] = $seq;
        }
        $db->commit();
        echo json_encode(['seqs' => $seqs]);
        break;
    }
    default:
        fail(404, 'Unbekannte Aktion');
}
