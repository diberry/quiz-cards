# Study Cards

A mobile-first study card web app — create decks of cards, flip through them, and quiz yourself.

## Features

- **Decks & Cards** — Create and manage decks of term/definition cards
- **Study Mode** — Flip through cards with smooth animations
- **Quiz Mode** — Test yourself and track your score
- **Import** — Bulk-import cards from CSV or JSON
- **History** — Review past study sessions and quiz scores
- **Auth** — Sign in with your Microsoft account (Entra ID / MSAL)

## Quick Start

### 1. Clone and install

```bash
git clone https://github.com/diberry/quiz-cards
cd quiz-cards
npm install
```

### 2. Configure environment

```bash
cp .env.example .env
```

Edit `.env` with your Entra app registration values:

| Variable | Description |
|---|---|
| `ENTRA_CLIENT_ID` | Application (client) ID from Azure portal |
| `ENTRA_TENANT_ID` | Directory (tenant) ID from Azure portal |
| `ENTRA_REDIRECT_URI` | Redirect URI (default: `http://localhost:3000`) |

### 3. Run

```bash
npm start
```

Open [http://localhost:3000](http://localhost:3000).

## Entra App Registration

1. Go to [Azure Portal → App registrations](https://portal.azure.com/#view/Microsoft_AAD_RegisteredApps)
2. New registration → name it, choose your tenant type
3. Add redirect URI: `http://localhost:3000` (type: Single-page application)
4. Copy **Application (client) ID** and **Directory (tenant) ID** into `.env`
5. Under **API permissions**, add `User.Read` (Microsoft Graph, delegated)

## Import Formats

**CSV** — one card per row, header row optional:
```csv
term,definition
Photosynthesis,The process by which plants convert sunlight to energy
Mitosis,Cell division producing two identical daughter cells
```

**JSON** — array of objects:
```json
[
  { "term": "Photosynthesis", "definition": "The process by which plants convert sunlight to energy" },
  { "term": "Mitosis", "definition": "Cell division producing two identical daughter cells" }
]
```

## Docker

```bash
# Build and run locally
docker-compose up --build

# Production build only
docker build -t quiz-cards .
docker run -p 3000:3000 -v $(pwd)/data:/app/data --env-file .env quiz-cards
```

## Deploy to Azure Container Apps

```bash
az acr build --registry <your-acr> --image quiz-cards:latest .

az containerapp create \
  --name quiz-cards \
  --resource-group <rg> \
  --environment <env> \
  --image <your-acr>.azurecr.io/quiz-cards:latest \
  --target-port 3000 \
  --ingress external \
  --env-vars ENTRA_CLIENT_ID=<id> ENTRA_TENANT_ID=<id> ENTRA_REDIRECT_URI=https://<your-app-url>
```

## Project Structure

```
├── server/         Express API + SQLite
│   ├── index.js    Entry point
│   ├── db.js       Schema & migrations
│   ├── routes/     decks, cards, quiz, import, history
│   └── middleware/ JWT auth
├── public/         Vanilla HTML/CSS/JS frontend
│   ├── index.html
│   ├── css/
│   └── js/
└── data/           SQLite database (gitignored)
```
