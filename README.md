# HSC Business Studies — Past Paper Practice

A clean, no-backend study site for HSC Business Studies past papers (2015–2025). All four question types supported: MCQ, short answer, business report, extended response. Answers save to your browser. One-click "Copy for AI marking" bundles the question, criteria, exemplar, and your answer into a perfect prompt for Claude.ai or ChatGPT.

## Getting it live (school laptop, no installs)

1. Sign in to your personal GitHub account at github.com.
2. Click **New repository**. Name it something like `hsc-business`. Set it to **Public** (required for free GitHub Pages). Tick **Add a README**. Click Create.
3. On the new repo page, click **Add file → Upload files**. Drag in: `index.html`, `styles.css`, `app.js`, `questions.json`. Commit.
4. Go to **Settings → Pages**. Under "Build and deployment", set Source to **Deploy from a branch**, Branch to **main**, folder `/ (root)`. Save.
5. Wait ~1 minute. Your site is live at `https://YOUR-USERNAME.github.io/hsc-business/`.

## Editing on the school laptop

Open the repo on github.com and press `.` (the period key). That opens VS Code in your browser — no install needed. Edit any file, then `Source Control` panel (left sidebar) → write a commit message → tick → push. Changes go live in about a minute.

## Adding a question

In `questions.json`, find the right topic and subtopic, then add a question object to its `questions` array. Every question needs a unique `id`. Use this pattern:

```json
{
  "id": "ops-strat-2023-short3",
  "year": 2023,
  "type": "short",
  "marks": 5,
  "prompt": "The question text here.",
  "stimulus": "Optional case/scenario text.",
  "suggested_words": 200,
  "criteria": [
    { "band": "4–5", "description": "..." },
    { "band": "2–3", "description": "..." },
    { "band": "1",   "description": "..." }
  ],
  "exemplar": "Model band 6 response goes here.\n\nUse \\n\\n for paragraph breaks."
}
```

For MCQs, replace `criteria` and `exemplar` with:

```json
"options": ["First", "Second", "Third", "Fourth"],
"correct": "B",
"explanation": "Why B is correct and why the others are wrong."
```

## Copyright note

NESA holds copyright over HSC past papers and marking guidelines. Transcribe questions for your **personal study** only — don't share the populated `questions.json` publicly. If you want others to use the tool, share the *empty* version and let them populate their own. Always credit NESA in any answer or exemplar that quotes their marking criteria, and link to the official source on the NESA website where possible.

## File structure

```
hsc-business/
├── index.html       ← page structure (don't normally need to edit)
├── styles.css       ← styling (tweak colours/fonts here)
├── app.js           ← app logic (don't normally need to edit)
├── questions.json   ← all your questions — this is the file you'll edit most
└── README.md
```
