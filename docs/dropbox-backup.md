# Wöchentliches Datenbank-Backup

Die laufende App prüft beim Start und danach stündlich, ob das letzte erfolgreiche
Dropbox-Backup mindestens sieben Tage zurückliegt. Ohne gespeicherten erfolgreichen
Lauf wird beim Start sofort ein Backup erstellt. Nach längerer Ausfallzeit wird ein
fälliges Backup beim nächsten Start nachgeholt.

SQLite erstellt eine konsistente Sicherung unter `data/backups` beziehungsweise
`DB_DIR/backups`. Anschließend lädt `rclone copyto` diese Datei nach Dropbox hoch.
Der manuelle Backup-Button benutzt denselben Ablauf und zeigt getrennt an, ob auch
der Dropbox-Upload erfolgreich war. Fehlgeschlagene Uploads werden stündlich mit
derselben lokalen Datei wiederholt. Bestehende Backups werden nicht gelöscht.

## Einrichtung auf dem Server

`rclone` muss installiert sein. Der Benutzer, unter dem die App läuft, muss Zugriff
auf den bereits dokumentierten Dropbox-Zugang `dropbox_nicole` haben. Eine Einrichtung
mit `rclone config` muss unter diesem Benutzer erfolgen, falls der Zugang fehlt.

Standardziel: `dropbox_nicole:verleihapp-backups`.
Optional können die folgenden Einstellungen in der `.env` der App stehen:

```dotenv
DROPBOX_BACKUP_REMOTE=dropbox_nicole:verleihapp-backups
RCLONE_BIN=rclone
```

`RCLONE_BIN` kann auch ein absoluter Pfad zur ausführbaren Datei sein.
Für eine abweichende rclone-Konfigurationsdatei kann `RCLONE_CONFIG` gesetzt werden.
Nach Einrichtung den Server neu starten und einmal den Backup-Button betätigen.
Die Erfolgsmeldung muss ausdrücklich den Dropbox-Upload bestätigen.

Der Zeitpunkt des letzten erfolgreichen Uploads und ein gegebenenfalls ausstehender
Upload werden in `backups/.weekly-backup.json` im Datenverzeichnis gespeichert.
Dieses Verzeichnis muss bei einem Deployment erhalten bleiben. Während die App
gestoppt ist, werden keine Backups erstellt.

Die Sicherungen enthalten die SQLite-Datenbank. Hochgeladene Bilder sind darin
nicht enthalten.

Prüfung: `node --test tests/backup-service.test.js`.
Sie simuliert den Upload und verbindet sich nicht mit Dropbox.

Referenz: https://rclone.org/commands/rclone_copyto/
