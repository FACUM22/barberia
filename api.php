<?php
// API JSON de la barbería. Requiere PHP 7.4+ con pdo_pgsql (Postgres / Supabase).
require __DIR__ . '/config.php';
session_start(); header('Content-Type: application/json; charset=utf-8');
try {
  $pdo = new PDO('pgsql:host=' . DB_HOST . ';port=' . DB_PORT . ';dbname=' . DB_NAME . ';sslmode=require', DB_USER, DB_PASS, [PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION]);
} catch (Throwable $e) { http_response_code(500); echo json_encode(['error' => 'No se pudo conectar a la base de datos']); exit; }
$pdo->exec('CREATE TABLE IF NOT EXISTS users(id SERIAL PRIMARY KEY, email VARCHAR(190) NOT NULL UNIQUE, hash VARCHAR(255) NOT NULL, admin SMALLINT NOT NULL DEFAULT 0)');
$pdo->exec('CREATE TABLE IF NOT EXISTS docs(path VARCHAR(190) PRIMARY KEY, col VARCHAR(190) NOT NULL, data TEXT NOT NULL)');
$pdo->exec('CREATE INDEX IF NOT EXISTS docs_col ON docs(col)');
// Supabase expone el esquema public por su API REST: con RLS activo y sin políticas, esas tablas quedan cerradas al público.
$pdo->exec('ALTER TABLE users ENABLE ROW LEVEL SECURITY'); $pdo->exec('ALTER TABLE docs ENABLE ROW LEVEL SECURITY');
$in = json_decode(file_get_contents('php://input'), true) ?: [];
$uid = $_SESSION['uid'] ?? null; $admin = !empty($_SESSION['admin']);
function out($d, $c = 200) { http_response_code($c); echo json_encode($d); exit; }
function getdoc($pdo, $p) { $s = $pdo->prepare('SELECT data FROM docs WHERE path=?'); $s->execute([$p]); $r = $s->fetchColumn(); return $r === false ? null : json_decode($r, true); }
function okPath($p) { return preg_match('#^[A-Za-z0-9_\-]+(/[A-Za-z0-9_\-]+)*$#', $p) === 1; }
function canRead($col, $uid, $admin) {
  $t = explode('/', $col)[0];
  if ($t === 'orders') return $admin;
  if ($t === 'data') return $uid && strpos($col . '/', "data/users/$uid/") === 0;
  return in_array($t, ['cuts', 'products', 'blocked', 'slots']);
}
function canWrite($pdo, $p, $d, $uid, $admin) {
  $t = explode('/', $p)[0];
  if (in_array($t, ['cuts', 'products', 'blocked'])) return $admin;
  if (!$uid) return false;
  if ($t === 'orders') return $p === "orders/$uid";
  if ($t === 'data') return strpos($p, "data/users/$uid/") === 0;
  if ($t === 'slots') {
    $cur = getdoc($pdo, $p);
    if ($admin) return true;
    if ($cur && $cur['status'] === 'active' && $cur['uid'] != $uid) return false;
    if ($d && isset($d['date']) && getdoc($pdo, 'blocked/' . $d['date'])) return false;
    return !$d || !isset($d['uid']) || $d['uid'] == $uid;
  }
  return false;
}
$a = $in['a'] ?? '';
try {
  if ($a === 'me') out(['id' => $uid, 'admin' => $admin]);
  if ($a === 'logout') { session_destroy(); out(['ok' => 1]); }
  if ($a === 'register' || $a === 'login') {
    $email = strtolower(trim($in['email'] ?? '')); $pass = $in['pass'] ?? '';
    if (!filter_var($email, FILTER_VALIDATE_EMAIL) || strlen($pass) < 6) out(['error' => 'Email o contraseña inválidos (mín. 6 caracteres).'], 400);
    if ($a === 'register') {
      $isAdmin = (($in['code'] ?? '') !== '' && hash_equals(ADMIN_CODE, $in['code'])) ? 1 : 0;
      try { $pdo->prepare('INSERT INTO users(email,hash,admin) VALUES(?,?,?)')->execute([$email, password_hash($pass, PASSWORD_DEFAULT), $isAdmin]); }
      catch (PDOException $e) { if ($e->getCode() == '23505') out(['error' => 'Ese email ya está registrado.'], 400); throw $e; }
    }
    $s = $pdo->prepare('SELECT * FROM users WHERE email=?'); $s->execute([$email]); $u = $s->fetch(PDO::FETCH_ASSOC);
    if (!$u || !password_verify($pass, $u['hash'])) out(['error' => 'Datos incorrectos.'], 401);
    session_regenerate_id(true); $_SESSION['uid'] = (int)$u['id']; $_SESSION['admin'] = (bool)$u['admin']; out(['ok' => 1]);
  }
  if ($a === 'list') {
    $c = $in['col'] ?? ''; if (!okPath($c) || !canRead($c, $uid, $admin)) out(['error' => 'Sin permiso'], 403);
    $s = $pdo->prepare('SELECT path,data FROM docs WHERE col=?'); $s->execute([$c]); $docs = [];
    foreach ($s->fetchAll(PDO::FETCH_ASSOC) as $r) $docs[] = ['id' => basename($r['path']), 'data' => json_decode($r['data'], true)];
    out(['docs' => $docs]);
  }
  $p = $in['path'] ?? ''; if (!okPath($p)) out(['error' => 'Ruta inválida'], 400);
  $col = dirname($p);
  if ($a === 'get') { if (!canRead($col, $uid, $admin) && !canRead($p, $uid, $admin)) out(['error' => 'Sin permiso'], 403); out(['data' => getdoc($pdo, $p)]); }
  if ($a === 'set' || $a === 'del') {
    $d = $in['data'] ?? null; if ($a === 'set' && !is_array($d)) out(['error' => 'Datos inválidos'], 400);
    if (!canWrite($pdo, $p, $d, $uid, $admin)) out(['error' => 'Sin permiso o horario no disponible'], 403);
    if ($a === 'del') $pdo->prepare('DELETE FROM docs WHERE path=?')->execute([$p]);
    else {
      if (!empty($in['merge'])) $d = array_merge(getdoc($pdo, $p) ?: [], $d);
      $pdo->prepare('INSERT INTO docs(path,col,data) VALUES(?,?,?) ON CONFLICT (path) DO UPDATE SET col=EXCLUDED.col, data=EXCLUDED.data')->execute([$p, $col, json_encode($d)]);
    }
    out(['ok' => 1]);
  }
  out(['error' => 'Acción desconocida'], 400);
} catch (Throwable $e) { out(['error' => 'Error del servidor'], 500); }
