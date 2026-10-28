<?php
// Vorlage für die Sync-API. Als "olisoap-config.php" ablegen, und zwar
//   - eine Ebene über httpdocs, falls PHP dort lesen darf (open_basedir), sonst
//   - direkt in httpdocs (bei Plesk-Standard: open_basedir = {DOCROOT}). Im Browser bleibt die Datei leer,
//     weil PHP sie ausführt und sie nur ein Array zurückgibt.
// Diese Datei gehört nie ins Repository.
return [
    // MySQL/MariaDB bei Netcup: Host steht im Plesk unter Datenbanken (oft "localhost").
    'dsn' => 'mysql:host=localhost;dbname=DATENBANKNAME;charset=utf8mb4',
    'user' => 'BENUTZER',
    'password' => 'PASSWORT',
    // Alle Tabellen bekommen dieses Präfix, damit andere Apps in derselben Datenbank unberührt bleiben.
    'prefix' => 'olisoap_',
    // Code, der beim Anlegen eines Kontos in der App eingegeben werden muss. Leer = Registrierung geschlossen.
    // Nach dem Anlegen deines Kontos am besten wieder leeren.
    'register_code' => 'HIER-EINEN-LANGEN-ZUFÄLLIGEN-CODE',
    // Andere Adressen, von denen aus die App die API nutzen darf (gleiche Adresse braucht keinen Eintrag).
    'allowed_origins' => ['https://olisym.github.io'],
];
