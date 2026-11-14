<?php
// En Render estos valores se cargan como variables de entorno (no los escribas acá).
define('DB_HOST', getenv('DB_HOST') ?: 'localhost');
define('DB_PORT', getenv('DB_PORT') ?: '5432');
define('DB_NAME', getenv('DB_NAME') ?: 'postgres');
define('DB_USER', getenv('DB_USER') ?: 'postgres');
define('DB_PASS', getenv('DB_PASS') ?: '');
// Clave que el barbero escribe al registrarse para obtener el panel admin.
define('ADMIN_CODE', getenv('ADMIN_CODE') ?: 'cambiar-este-codigo');
