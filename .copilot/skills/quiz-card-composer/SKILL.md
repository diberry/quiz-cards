# Skill: quiz-card-composer

**Version:** 1.0.0  
**Created:** 2026-05-13T09:47:47-07:00  
**Owner:** Pops (project-dina PM)  
**Repo:** diberry/quiz-cards

---

## Purpose

Transform raw study content — in any format — into a JSON array of `{term, definition}` objects ready to POST to the quiz-cards import endpoint (`POST /api/import/:deckId`).

---

## Trigger Phrases

Invoke this skill when the user says things like:

- "make quiz cards from this"
- "turn this into flash cards"
- "compose cards from my notes"
- "convert this to quiz-card JSON"
- "import-ready cards"
- "generate flash cards"
- "build a deck from this content"
- "quiz-card-composer"

---

## Data Model

The import endpoint (`server/routes/import.ts`) accepts:

```
POST /api/import/:deckId
Content-Type: application/json
Body: { "data": "<JSON string>" }
```

Or as a file upload (`.json` or `.csv`).

Each card requires exactly two fields:

| Field        | Type   | Notes                              |
|--------------|--------|------------------------------------|
| `term`       | string | The question, word, or concept     |
| `definition` | string | The answer, meaning, or explanation|

The server strips whitespace from both fields and filters out any entry missing either field.

**Output shape:**

```json
[
  { "term": "...", "definition": "..." },
  { "term": "...", "definition": "..." }
]
```

---

## Transformation Instructions

When given raw content, apply these rules in order:

### 1. Detect the input style

| Style | Signals |
|-------|---------|
| **Q&A** | Lines starting with `Q:` / `A:`, or `Question:` / `Answer:` |
| **Term — Definition** | Lines with ` — `, ` - `, ` : `, or `::` as a separator |
| **Bullet pairs** | Alternating bullet lines where odd = term, even = definition |
| **Vocabulary list** | `word (part of speech) — meaning` or `word: meaning` |
| **Paragraph/prose** | Free text; extract named concepts and their explanations |
| **Table/CSV** | Rows with two columns; first = term, second = definition |
| **Numbered list** | `1. term` followed by indented or next-line definition |

### 2. Extraction rules

- **term** — the thing being learned: a word, concept, question, command, formula, name
- **definition** — the explanation, answer, or description
- Keep both fields concise but complete; do not truncate meaning
- Remove markdown formatting characters (`**`, `_`, `#`) from field values
- Normalize whitespace; no leading/trailing spaces
- Skip any item that cannot produce both a term and a definition
- Do not invent content; only use what is present in the input

### 3. Output

Emit **only** the JSON array. No prose, no markdown fences, no extra keys.

```json
[
  { "term": "...", "definition": "..." }
]
```

If the input is ambiguous, make a best-effort parse and note any items skipped at the end (after the JSON block).

---

## Examples

### Example 1 — Q&A format

**Input:**
```
Q: What is photosynthesis?
A: The process by which plants convert light into glucose.

Q: What organelle performs photosynthesis?
A: The chloroplast.
```

**Output:**
```json
[
  { "term": "What is photosynthesis?", "definition": "The process by which plants convert light into glucose." },
  { "term": "What organelle performs photosynthesis?", "definition": "The chloroplast." }
]
```

---

### Example 2 — Term — Definition pairs

**Input:**
```
Mitosis — Cell division producing two genetically identical daughter cells
Meiosis — Cell division producing four genetically unique gametes
Apoptosis — Programmed cell death
```

**Output:**
```json
[
  { "term": "Mitosis", "definition": "Cell division producing two genetically identical daughter cells" },
  { "term": "Meiosis", "definition": "Cell division producing four genetically unique gametes" },
  { "term": "Apoptosis", "definition": "Programmed cell death" }
]
```

---

### Example 3 — Bullet point vocabulary

**Input:**
```
- Polymorphism
  - The ability of different objects to respond to the same interface in different ways
- Encapsulation
  - Bundling data and methods that operate on that data within a single unit
- Inheritance
  - A mechanism where a class acquires properties and behaviors of a parent class
```

**Output:**
```json
[
  { "term": "Polymorphism", "definition": "The ability of different objects to respond to the same interface in different ways" },
  { "term": "Encapsulation", "definition": "Bundling data and methods that operate on that data within a single unit" },
  { "term": "Inheritance", "definition": "A mechanism where a class acquires properties and behaviors of a parent class" }
]
```

---

### Example 4 — Prose / paragraph notes

**Input:**
```
The TCP handshake is a three-step process used to establish a connection. 
First, the client sends a SYN packet. The server responds with SYN-ACK. 
Finally, the client sends ACK to confirm.

HTTP is stateless, meaning each request is independent and the server 
retains no session information between requests.
```

**Output:**
```json
[
  { "term": "TCP handshake", "definition": "A three-step process (SYN, SYN-ACK, ACK) used to establish a network connection." },
  { "term": "HTTP stateless", "definition": "Each request is independent; the server retains no session information between requests." }
]
```

---

### Example 5 — Mixed / messy notes

**Input:**
```
**OSI Model** has 7 layers

Layer 1 = Physical (cables, signals)
Layer 2 = Data Link (MAC addresses)
Layer 3 = Network (IP routing)
Layer 4 = Transport (TCP/UDP)
Layer 5 = Session
Layer 6 = Presentation
Layer 7 = Application
```

**Output:**
```json
[
  { "term": "OSI Layer 1 — Physical", "definition": "Handles cables and electrical signals" },
  { "term": "OSI Layer 2 — Data Link", "definition": "Handles MAC addresses" },
  { "term": "OSI Layer 3 — Network", "definition": "Handles IP routing" },
  { "term": "OSI Layer 4 — Transport", "definition": "Handles TCP/UDP" },
  { "term": "OSI Layer 5 — Session", "definition": "Manages sessions between applications" },
  { "term": "OSI Layer 6 — Presentation", "definition": "Handles data format translation and encryption" },
  { "term": "OSI Layer 7 — Application", "definition": "Closest to the end user; handles network services" }
]
```

---

## Using the Output

Once you have the JSON array, import it via:

```bash
# As a JSON file upload
curl -X POST https://<your-host>/api/import/<deckId> \
  -H "Cookie: <session>" \
  -F "file=@cards.json;type=application/json"

# As a form data field
curl -X POST https://<your-host>/api/import/<deckId> \
  -H "Cookie: <session>" \
  -d "data=$(cat cards.json)"
```

The endpoint returns `{ "imported": <count> }` on success.

---

## Error Cases

| Problem | What to do |
|---------|-----------|
| Content has terms but no definitions | Ask the user to provide the definitions, or flag the terms as incomplete |
| Ambiguous separator (colon could be part of the term) | Prefer the first colon as the separator only if the left side is ≤ 5 words |
| Single-column list with no definitions | Cannot compose — tell the user definitions are needed |
| Input is already valid JSON `[{term, definition}]` | Return it as-is after normalizing whitespace |
