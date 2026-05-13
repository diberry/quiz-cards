# Study Cards

A mobile-first study card web app — create decks of cards, flip through them, and quiz yourself.

## Features

- **Decks & Cards** — Create and manage decks of term/definition cards
- **Study Mode** — Flip through cards with smooth animations
- **Quiz Mode** — Test yourself and track your score
- **Import** — Bulk-import cards from CSV or JSON
- **History** — Review past study sessions and quiz scores
- **Auth** — Sign in with Microsoft Entra ID, Google, or GitHub (Passport.js multi-provider)

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

Edit `.env` with your auth provider values:

| Variable               | Description                                                         |
| ---------------------- | ------------------------------------------------------------------- |
| `ENTRA_CLIENT_ID`      | Application (client) ID from Azure portal                           |
| `ENTRA_TENANT_ID`      | Directory (tenant) ID from Azure portal                             |
| `ENTRA_CLIENT_SECRET`  | Client secret from Azure portal                                     |
| `ENTRA_REDIRECT_URI`   | Redirect URI (default: `http://localhost:3000/auth/entra/callback`) |
| `SESSION_SECRET`       | Random string for session encryption                                |
| `GOOGLE_CLIENT_ID`     | (Optional) Google OAuth client ID                                   |
| `GOOGLE_CLIENT_SECRET` | (Optional) Google OAuth client secret                               |
| `GITHUB_CLIENT_ID`     | (Optional) GitHub OAuth app client ID                               |
| `GITHUB_CLIENT_SECRET` | (Optional) GitHub OAuth app client secret                           |

### 3. Run

```bash
npm start
```

Open [http://localhost:3000](http://localhost:3000).

## Authentication

This app uses **Passport.js** with server-side OAuth redirects and session cookies (replacing the previous client-side MSAL popup flow). Supported providers:

- **Microsoft Entra ID** (primary) — requires `ENTRA_CLIENT_ID`, `ENTRA_TENANT_ID`, `ENTRA_CLIENT_SECRET`
- **Google** (optional) — requires `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`
- **GitHub** (optional) — requires `GITHUB_CLIENT_ID`, `GITHUB_CLIENT_SECRET`

Sessions are stored in SQLite via `connect-sqlite3` so they survive server restarts.

## Entra App Registration

1. Go to [Azure Portal → App registrations](https://portal.azure.com/#view/Microsoft_AAD_RegisteredApps)
2. New registration → name it, choose your tenant type
3. Add redirect URI: `http://localhost:3000/auth/entra/callback` (type: Web)
4. Under **Certificates & secrets**, create a new client secret and copy it to `ENTRA_CLIENT_SECRET`
5. Copy **Application (client) ID** and **Directory (tenant) ID** into `.env`
6. Under **API permissions**, add `User.Read` (Microsoft Graph, delegated)

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
  {
    "term": "Photosynthesis",
    "definition": "The process by which plants convert sunlight to energy"
  },
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

## Deploy to Azure (azd)

The fastest way to deploy is with the [Azure Developer CLI](https://learn.microsoft.com/azure/developer/azure-developer-cli/):

### Prerequisites

- Azure subscription
- [Azure Developer CLI (azd)](https://learn.microsoft.com/azure/developer/azure-developer-cli/install-azd)
- [Docker](https://docs.docker.com/get-docker/)

### Deploy

```bash
# Initialize the environment (first time only)
azd init

# Set required environment variables
azd env set ENTRA_CLIENT_ID <your-client-id>
azd env set ENTRA_TENANT_ID <your-tenant-id>
azd env set REDIRECT_URI https://<your-app-url>

# Provision infrastructure + build + deploy
azd up
```

### What gets deployed

- **Azure Container Apps** — runs the quiz-cards container (0.5 CPU, 1Gi, 1–3 replicas)
- **Azure Container Registry** — stores the Docker image
- **Azure Files** — persistent storage for SQLite at `/app/data`
- **Log Analytics** — container logs and diagnostics
- **Managed Identity** — secure registry pull (no passwords)

### Tear down

```bash
azd down
```

### Manual deployment (alternative)

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

## CI/CD

This project uses GitHub Actions for continuous integration and deployment.

### Build & Test (`.github/workflows/build-test.yml`)

Runs on every push and PR to `main`. Executes TypeScript build, ESLint, Prettier format check, and Vitest tests.

### Deploy to Azure (`.github/workflows/deploy-to-azure.yml`)

Runs on push to `main` (after build) and manual trigger. Builds a Docker image, pushes it to Azure Container Registry, and deploys to Azure Container Apps. Uses OIDC (workload identity federation) for passwordless Azure authentication.

**Required GitHub Secrets:** `AZURE_CLIENT_ID`, `AZURE_TENANT_ID`, `AZURE_SUBSCRIPTION_ID`, `ACR_NAME`, `CONTAINER_APP_NAME`, `RESOURCE_GROUP`

**Infrastructure:** Defined in `infra/` using Bicep (Container Apps, ACR, Azure Files, Log Analytics, Managed Identity). Deploy with `azd up` or let the workflow handle it.

## Project Structure

```
├── server/         Express API + SQLite
│   ├── index.js    Entry point
│   ├── db.js       Schema & migrations
│   ├── routes/     decks, cards, quiz, import, history
│   └── middleware/ Passport session auth
├── public/         Vanilla HTML/CSS/JS frontend
│   ├── index.html
│   ├── css/
│   └── js/
└── data/           SQLite database (gitignored)
```
