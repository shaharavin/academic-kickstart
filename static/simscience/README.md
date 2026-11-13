# SimScience v2

A static rebuild of SimScience (2010, Google App Engine / Python 2.7 / Django) as a single
page with no backend. Game state lives in the browser's localStorage. Open `index.html`
directly or serve the folder from any static host.

Files

- `index.html`, `style.css`: layout, light and dark themes, phone-width friendly.
- `rules.js`: the game rules and all constants, ported from `../game/models.py`,
  `../game/tools.py` and `../game/views.py`. Pure functions over a plain state object.
- `lab.js`: the isometric lab view, drawn procedurally on a canvas. Desks and staff,
  equipment along the back wall (LED on when in use), framed publications on the left
  wall, a whiteboard with the turn, authority and research-tree progress, an empty chair
  and sticky note when someone is away at a conference. The floor grows with headcount
  and equipment.
- `app.js`: UI, dialogs, saving, routing. `#g=<id>` opens a saved game;
  `#s=<base64 state>` imports a shared snapshot as a new game.

Rules kept exactly as in 2010

- Start with $10,000 and 0 authority. One action per turn. Funding on turn 1 and every
  5th turn; conferences every 3rd turn. Salaries charged at end of turn, including while
  the scientist is away. Cash may go negative; there is no game over.
- Work per turn is divided (integer division) between a scientist's active projects, zero
  while at a conference, multiplied by the equipment the project reserved when it began.
  Equipment is reserved for the whole project and freed when it finishes.
- Topics, journals, funders, conferences, scientist types and equipment: same names and
  numbers, including the Church of Scientology membership and the TED keynote.
- Original texts for funding rejections and the conference committee letter.

Deliberate changes

- Original `end_turn` reassigned the per-project contribution inside the loop, so a
  project with equipment inflated the contribution of the projects iterated after it.
  v2 applies each project's multiplier to the base share only.
- "Wellcome to SimScience" on the menu is now "Welcome"; the Wellcome Trust keeps its name.
- The load screen lists only games saved in this browser (the original listed every
  anonymous game on the server, which is how web crawlers filled the database).
- Added: progress bars, a lab notebook (event log), a share-snapshot link, the lab view.
- Added a fifth hireable type, the AI Research Agent (150 hours per turn, $300 in API
  credits, needs authority 20, default name Claude). It cannot be sent to conferences,
  and when idle at the end of a turn it starts a random available topic without asking.
  Drawn as a server tower at the desk with blinking LEDs and a terminal typing to itself.
  It waits one full turn for instructions after being hired or finishing a project; if it
  is still idle at the next end of turn, it chooses for itself.
- Hidden mechanic: every AI agent adds 1 percentage point per turn to an accumulator that
  starts at zero. Each end of turn rolls against it. When the roll passes, the lab fills
  with paperclips and the game ends. Cryptic hints appear in the lab notebook at 5, 15,
  30, 50 and 75 percent. Nothing about this is shown in the interface.
- epMotion video link updated (the 2010 one is dead).
