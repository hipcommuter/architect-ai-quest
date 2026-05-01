# The Architect's AI Quest — Lv.1 → Lv.999

A pixel-art / JRPG-style single-page guide showing why AI is a real timesaver for architects, and how to level up your skills from novice to master.

Built to share with friends and college classmates at varied AI skill levels.

## Quick start

```bash
# From this folder, run a tiny local server (any of these work):

# Python 3
python -m http.server 8000

# Node (if you have npx)
npx serve .

# Then open
http://localhost:8000
```

A static server is needed (not `file://`) so Press Start 2P and NES.css load correctly from CDN.

## Structure

```
architect-ai-quest/
├── index.html          One-page site, 7 sections
├── style.css           JRPG palette + layout + animations
├── script.js           Scroll reveals, keyboard shortcuts, easter egg
├── assets/
│   ├── sprites/        (empty — drop pixel art here later)
│   └── fonts/          (empty — using Google Fonts CDN for now)
├── quests/             (reserved for per-quest markdown if extracted)
└── README.md
```

## Sections

1. **Title Screen** — hook + press-start cue
2. **Tutorial** — why this game? + four classes (Designer / Drafter / Communicator / Researcher) — clickable to recruit your party hero
3. **Level Map** — the spine: 9 milestones from Lv.1 to Lv.999, each grounded in a real project + a `TRY TODAY:` hook
4. **Quest Comics** — 12 main quests + 4 side quests, each a 4-panel pixel comic with a unique pixel-art scene + a "▶ OPEN IN VS CODE" launcher
5. **Boss Battles** — Final-Fantasy-style party-vs-monsters arena + three archetypal architect bosses
6. **Starter Pack** — three lanes of "what to try today" for Lv.1, Lv.50, Lv.500
7. **End Credits** — tools, links, share prompt

## Main quests (sourced from real Claude Code projects)

| # | Title | Lv | Class | Source folder |
|---|---|---|---|---|
| 1 | The Apprentice's First Spell  | 1   | Researcher    | (generic — your first prompt) |
| 2 | The Meeting Note Distiller    | 5   | Communicator  | Project Meeting Records |
| 3 | The TCA Data Alchemist        | 10  | Researcher    | `Construction-Data` |
| 4 | The TOR Translation Scroll    | 15  | Researcher    | Gemini Workspace TOR translation |
| 5 | The Concept Finder Grimoire   | 25  | Researcher    | `APP-Concept-Finder` |
| 6 | The Quotation Fortress Boss   | 50  | Communicator  | `APP-Quatation-Organize` |
| 7 | The Punch List Protocol       | 50  | Drafter       | `APP-Punch-List` |
| 8 | The Tree Survey Oracle        | 100 | Designer      | `APP-Tree-Mpping` |
| 9 | The Sprinkler System Architect| 100 | Designer      | `Irrigation` |
| 10 | The Vision Tools Spell       | 250 | Designer      | NVIDIA Build CLI wrapper |
| 11 | The LINE Bot Alchemist       | 250 | Communicator  | `APP-Line-Client-request` |
| 12 | The Method Library Codex ★  | 500 | Drafter       | Project Repair Method Library |

## Side quests (for friends outside architecture)

| Quest | Lv | For friends in… | Source project |
|---|---|---|---|
| The Trader's Pattern Compass | 14 | Finance | `Portfolio-BTC-ANALYSIS` (Wyckoff method) |
| The Vocabulary Grimoire      | 18 | Language students | NotebookLM `HSK 1 Chinese-Thai Vocabulary` |
| The Forensic Analyst         | 35 | Researchers / journalists | NotebookLM `Titan Submersible Implosion` |
| The Daily Report Robot       | 75 | Anyone with morning routines | `Portfolio-MARKET-DAILY-REPORT--CRYPTO` |

## Tech notes

- **No build step.** Everything is static HTML/CSS/JS, served as-is.
- **NES.css** loaded from `unpkg.com/nes.css@2.3.0` for retro UI components (containers, balloons, lists, badges).
- **Press Start 2P** + **VT323** loaded from Google Fonts.
- **Animations** use `IntersectionObserver` for scroll-triggered fade-ins — no library.
- **Mobile responsive** at 720px and 600px breakpoints.

## Easter eggs

- Press **Enter** or **Space** while at the top to skip past the Title Screen.
- Click **PRESS START** to do the same.
- Type the Konami code (↑↑↓↓←→←→ B A) to flip the palette.

## To customize

- Replace emoji "panel art" in quest cards with real pixel-art PNGs in `assets/sprites/` (just swap the `<div class="panel-art">…</div>` content for `<img>` tags).
- Swap the JRPG palette by editing the `:root` variables at the top of `style.css`.
- Add your name to **End Credits** (`#credits` section in `index.html`).
- Optional level-up chime: uncomment the audio block in `script.js`.

## Sister project

The first AI-explainer site is at `E:\AI\ai-for-friends` — a Reveal.js deck about AI for general roles. This site (architect-ai-quest) is the sequel, focused on architects.
