# 🎮 Multiplayer TicTacToe

Eine moderne Multiplayer TicTacToe Website mit Echtzeit-Multiplayer-Funktionalität über WebSockets.

## Features

- ✅ Echtzeit-Multiplayer über WebSockets
- ✅ Raum-System: Spieler können Räume erstellen und beitreten
- ✅ Moderne, responsive Benutzeroberfläche
- ✅ Spieler-Namen und Turn-Management
- ✅ Gewinner-Erkennung und Unentschieden-Erkennung
- ✅ Neues Spiel starten nach Beendigung

## Installation

1. Stelle sicher, dass Node.js installiert ist (Version 14 oder höher)

2. Installiere die Abhängigkeiten:
```bash
npm install
```

## Starten

Starte den Server:
```bash
npm start
```

Für Entwicklung mit automatischem Neustart:
```bash
npm run dev
```

Der Server läuft standardmäßig auf `http://localhost:3000`

## Deployment auf Vercel

**WICHTIG:** Socket.io mit WebSockets funktioniert auf Vercel nur eingeschränkt, da Vercel Serverless Functions keine persistenten WebSocket-Verbindungen unterstützen.

Für ein vollständiges Multiplayer-Erlebnis empfehlen wir:
- **Railway** (https://railway.app) - Unterstützt WebSockets
- **Render** (https://render.com) - Unterstützt WebSockets
- **Heroku** (https://heroku.com) - Unterstützt WebSockets
- **DigitalOcean App Platform** - Unterstützt WebSockets

Falls du trotzdem auf Vercel deployen möchtest:
1. Pushe den Code zu GitHub
2. Verbinde dein Repository mit Vercel
3. Vercel erkennt automatisch die `vercel.json` und `api/index.js`
4. **Hinweis:** WebSocket-Funktionalität wird möglicherweise nicht vollständig funktionieren

## Verwendung

1. Öffne `http://localhost:3000` im Browser
2. Gib deinen Namen ein
3. Erstelle ein neues Spiel oder trete einem bestehenden Raum bei
4. Teile den Raum-Code mit deinem Gegner
5. Sobald beide Spieler beigetreten sind, startet das Spiel automatisch
6. Viel Spaß beim Spielen! 🎉

## Technologien

- **Frontend**: HTML5, CSS3, JavaScript (Vanilla)
- **Backend**: Node.js, Express
- **Real-time**: Socket.io
- **Styling**: Modern CSS mit Gradienten und Animationen

## Spielregeln

- Spieler X beginnt immer
- Die Spieler wechseln sich ab
- Gewinner ist der Spieler, der zuerst drei Symbole in einer Reihe hat (horizontal, vertikal oder diagonal)
- Bei einem vollen Spielfeld ohne Gewinner endet das Spiel unentschieden

## Lizenz

MIT

