# Datenbank-Migration: Von Replit zu anderem Server

## Option 1: PostgreSQL Export/Import (Empfohlen)
```bash
# 1. Daten aus Replit exportieren
pg_dump $DATABASE_URL > whispergram_backup.sql

# 2. Auf neuem Server importieren
psql $NEW_DATABASE_URL < whispergram_backup.sql
```

## Option 2: JSON Export-System (Bereits vorbereitet)
Das aktuelle System hat auch eine JSON-Backup-Funktion:
- Alle Daten können als JSON exportiert werden
- Auf neuem Server wieder importiert werden
- Funktioniert mit jeder Datenbank (PostgreSQL, MySQL, SQLite)

## Option 3: Datenbank-Anbieter wechseln
Da wir Drizzle ORM verwenden, können Sie einfach wechseln zu:
- **Neon Database** (kostenlos, PostgreSQL-kompatibel)
- **Supabase** (kostenlos, PostgreSQL-kompatibel)  
- **PlanetScale** (MySQL)
- **Railway** (PostgreSQL/MySQL)
- Oder jeder andere PostgreSQL-Server

## Environment Variables für neuen Server
```env
DATABASE_URL=postgresql://username:password@your-new-server/database
```

## Migration-Schritte
1. **Daten exportieren** von aktueller Replit-Datenbank
2. **Neue Datenbank** einrichten (z.B. bei Neon, Supabase)
3. **DATABASE_URL** auf neuen Server zeigen lassen
4. **npm run db:push** ausführen (Schema erstellen)
5. **Daten importieren** in neue Datenbank
6. **Tests** durchführen

## Wichtig
- Die Anwendung ist **portabel** - läuft überall wo Node.js läuft
- Nur die DATABASE_URL muss geändert werden
- Alle Profile und Chats bleiben erhalten