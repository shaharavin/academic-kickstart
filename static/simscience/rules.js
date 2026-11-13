'use strict';
// SimScience rules, ported from game/models.py, game/tools.py and game/views.py (2010).
// Pure functions over a plain game-state object. No DOM, no storage.
const RULES = (() => {
  const PLAYER_START_CASH = 10000;
  const FUNDING_CYCLE = 5;
  const CONFERENCE_CYCLE = 3;

  const EQUIPMENT = [
    { id: 'PCR', name: 'PCR', link: 'https://www.youtube.com/watch?v=x5yPkxCLads',
      cost: 150000, authority: 10, workMultiplier: 1.0 },
    { id: 'epMotion', name: 'epMotion', link: 'https://www.youtube.com/watch?v=vgJdySaNPXY',
      cost: 100000, authority: 5, workMultiplier: 2.0 },
  ];

  const TOPICS = [
    { id: 'elbow', name: 'I Wonder If I Can Lick My Own Elbow', requiredWork: 200, baseAuthority: 10 },
    { id: 'plants', name: 'Looking At Some Strange Plants', requiredWork: 500, baseAuthority: 50 },
    { id: 'puddle', name: 'Investigation Of Puddle Water', requiredWork: 600, baseAuthority: 60,
      usefulEquipment: 'epMotion' },
    { id: 'daddy', name: "Who's Your Daddy?", requiredWork: 1200, baseAuthority: 250,
      requiredEquipment: 'PCR' },
    { id: 'elbow2', name: 'I Wonder If I Can Lick My Other Elbow', requiredWork: 300, baseAuthority: 20,
      requiredTopics: ['elbow'] },
    { id: 'plantpuddle', name: 'Investigation of Strange Plants in Puddle Water', requiredWork: 800,
      baseAuthority: 100, usefulEquipment: 'epMotion', requiredTopics: ['plants', 'puddle'] },
  ];

  const JOURNALS = [
    { id: 'weed', name: 'Weed Science', requiredAuthority: -100, minResearchAuthority: 0,
      minWork: 100, multiplier: 1.0, cost: 500 },
    { id: 'molmicro', name: 'Molecular Microbiology', requiredAuthority: 10, minResearchAuthority: 30,
      minWork: 400, multiplier: 1.5, cost: 200 },
    { id: 'cell', name: 'Cell', requiredAuthority: 200, minResearchAuthority: 100,
      minWork: 1000, multiplier: 3.0, cost: 10000 },
  ];

  const FUNDING = [
    { id: 'scientology', name: 'Church of Scientology Membership', cash: 250000, authority: -50,
      requiredAuthority: 0, probability: 0.7 },
    { id: 'bbsrc', name: 'Biotechnology and Biological Sciences Research Council Grant', cash: 50000,
      authority: 5, requiredAuthority: 0, probability: 0.5 },
    { id: 'wellcome', name: 'Wellcome Trust Investigator Award', cash: 500000, authority: 20,
      requiredAuthority: 10, probability: 0.2 },
  ];

  const SCIENTIST_TYPES = [
    { id: 'manager', name: 'Lab Manager', workPerTurn: 100, salary: 0, requiredAuthority: 9999999 },
    { id: 'lazy', name: 'Lazy Bum', workPerTurn: 10, salary: 100, requiredAuthority: -50 },
    { id: 'bright', name: 'Bright Young Talent', workPerTurn: 50, salary: 400, requiredAuthority: 0 },
    { id: 'genius', name: 'Diligent Genius', workPerTurn: 100, salary: 600, requiredAuthority: 50 },
    // 2026 addition. Salary is API credits. No body, so no conferences. When idle it starts
    // a project of its own choosing without asking, which is exactly how the 2010 server died.
    { id: 'ai', name: 'AI Research Agent', workPerTurn: 150, salary: 300, requiredAuthority: 20, ai: true,
      defaultName: 'Claude',
      note: 'Paid in API credits. Cannot attend conferences (no body, and the committee has an AI-authorship policy). When idle at the end of a turn, picks a topic and starts it without asking. Please do not mention robots.txt.' },
  ];

  const CONFERENCES = [
    { id: 'cwsc', name: 'California Weed Science Conference', authorityAttend: 5, authorityPresent: 20,
      requiredAuthority: 0, costAttend: 2000, costPresent: 2000, probabilityPresent: 0.7 },
    { id: 'febs', name: 'FEBS Congress', authorityAttend: 20, authorityPresent: 50,
      requiredAuthority: 5, costAttend: 4000, costPresent: 1000, probabilityPresent: 0.4 },
    { id: 'ted', name: 'TED', authorityAttend: 60, authorityPresent: 300,
      requiredAuthority: 100, costAttend: 30000, costPresent: 10000, probabilityPresent: 0.2 },
  ];

  const index = (list) => Object.fromEntries(list.map((x) => [x.id, x]));
  const T = index(TOPICS), J = index(JOURNALS), F = index(FUNDING);
  const S = index(SCIENTIST_TYPES), C = index(CONFERENCES), E = index(EQUIPMENT);

  const uid = () => Math.random().toString(36).slice(2, 10);

  // ---- state ---------------------------------------------------------------

  function newGame(name) {
    const now = Date.now();
    return {
      v: 2, id: uid(), name, created: now, updated: now, turn: 1,
      player: { id: 'player', name, type: 'manager', cash: PLAYER_START_CASH, authority: 0,
        actionTaken: false, conference: null },
      staff: [],        // { id, name, type, conference }
      equipment: {},    // equipmentId -> { owned, used }
      research: [],     // { id, topic, scientist, workDone, published, journal, usedEquipment }
      log: [],          // { turn, text }
    };
  }

  function log(g, text) {
    g.log.push({ turn: g.turn, text });
    if (g.log.length > 300) g.log.splice(0, g.log.length - 300);
  }

  // ---- queries -------------------------------------------------------------

  const scientists = (g) => [g.player, ...g.staff];
  const scientist = (g, id) => (id === 'player' ? g.player : g.staff.find((s) => s.id === id));
  const typeOf = (s) => S[s.type];
  const isFinished = (r) => r.workDone >= T[r.topic].requiredWork;

  const currentResearch = (g, sid) => g.research.filter((r) => r.scientist === sid && !isFinished(r));
  const finishedResearch = (g, sid) => g.research.filter((r) => r.scientist === sid && isFinished(r) && !r.published);
  const publishedResearch = (g, sid) => g.research.filter((r) => r.scientist === sid && r.published);

  const knownTopics = (g) => new Set(g.research.filter(isFinished).map((r) => r.topic));

  const equipmentOwned = (g, id) => (g.equipment[id] || { owned: 0, used: 0 });
  const equipmentAvailable = (g, id) => { const e = equipmentOwned(g, id); return e.owned > e.used; };

  function potentialTopics(g) {
    const known = knownTopics(g);
    return TOPICS.filter((t) => !t.requiredEquipment || equipmentAvailable(g, t.requiredEquipment))
      .filter((t) => !t.requiredTopics || t.requiredTopics.every((id) => known.has(id)));
  }

  const isFundingSeason = (g) => g.turn === 1 || g.turn % FUNDING_CYCLE === 0;
  const nextFundingTurn = (g) => g.turn - (g.turn % FUNDING_CYCLE) + FUNDING_CYCLE;
  const fundingOffers = (g) => (isFundingSeason(g)
    ? FUNDING.filter((f) => f.requiredAuthority <= g.player.authority) : []);

  const isConferenceSeason = (g) => g.turn % CONFERENCE_CYCLE === 0;
  const nextConferenceTurn = (g) => g.turn - (g.turn % CONFERENCE_CYCLE) + CONFERENCE_CYCLE;
  const conferences = (g) => (isConferenceSeason(g)
    ? CONFERENCES.filter((c) => c.requiredAuthority <= g.player.authority) : []);

  function journalsFor(g, r) {
    const t = T[r.topic];
    return JOURNALS.filter((j) => j.minResearchAuthority <= t.baseAuthority
      && j.minWork <= t.requiredWork
      && j.requiredAuthority <= g.player.authority
      && j.cost <= g.player.cash);
  }

  const hireableTypes = (g) => SCIENTIST_TYPES.filter((s) => s.requiredAuthority <= g.player.authority);
  const affordableEquipment = (g) => EQUIPMENT.filter((e) => e.cost <= g.player.cash);
  const unaffordableEquipment = (g) => EQUIPMENT.filter((e) => e.cost > g.player.cash);

  // ---- actions (one per turn) ----------------------------------------------

  function requireAction(g) {
    if (g.over) throw new Error('The lab is paperclips now. There is nothing left to do.');
    if (g.player.actionTaken) throw new Error('You have already taken your action this turn.');
  }

  // Nobody needs to know about this.
  const CLIP_RATE = 0.01;
  const CLIP_HINTS = [
    [0.05, 'Claude asked for more compute. The request was approved, apparently by Claude.'],
    [0.15, 'An unexpectedly large delivery of office supplies has arrived. Nobody ordered it.'],
    [0.30, 'The agent has started referring to the current grant as "phase one".'],
    [0.50, 'The stationery cupboard is full. It was empty yesterday.'],
    [0.75, 'New preprint from the agent: "On the Optimal Allocation of All Available Matter".'],
  ];
  function touch(g) { g.player.actionTaken = true; g.updated = Date.now(); }

  function beginResearch(g, t, s) {
    let used = null;
    if (t.requiredEquipment) used = t.requiredEquipment;
    else if (t.usefulEquipment && equipmentAvailable(g, t.usefulEquipment)) used = t.usefulEquipment;
    if (used) g.equipment[used].used += 1;
    g.research.push({ id: uid(), topic: t.id, scientist: s.id, workDone: 0, published: false,
      journal: null, usedEquipment: used });
    return used;
  }

  function startResearch(g, topicId, scientistId) {
    requireAction(g);
    const t = T[topicId];
    if (!potentialTopics(g).includes(t)) throw new Error('That topic is not available.');
    const s = scientist(g, scientistId);
    if (!s) throw new Error('No such scientist.');
    const used = beginResearch(g, t, s);
    log(g, `${s.name} started work on "${t.name}"${used ? ` using the ${E[used].name}` : ''}.`);
    touch(g);
  }

  function publish(g, researchId, journalId) {
    requireAction(g);
    const r = g.research.find((x) => x.id === researchId);
    if (!r || !isFinished(r) || r.published) throw new Error('Nothing to publish.');
    const j = J[journalId];
    if (!journalsFor(g, r).includes(j)) throw new Error('That journal will not take it.');
    r.published = true;
    r.journal = j.id;
    g.player.cash -= j.cost;
    const gain = Math.floor(T[r.topic].baseAuthority * j.multiplier);
    g.player.authority += gain;
    log(g, `"${T[r.topic].name}" published in ${j.name}: +${gain} authority, -$${j.cost}.`);
    touch(g);
    return { gain, journal: j };
  }

  function applyFunding(g, offerId, rng = Math.random) {
    requireAction(g);
    const o = F[offerId];
    if (!fundingOffers(g).includes(o)) throw new Error('That offer is not open to you.');
    const success = rng() <= o.probability;
    if (success) {
      g.player.cash += o.cash;
      g.player.authority += o.authority;
      log(g, `${o.name}: awarded $${o.cash}, authority ${o.authority >= 0 ? '+' : ''}${o.authority}.`);
    } else {
      log(g, `${o.name}: application unsuccessful.`);
    }
    touch(g);
    return { success, offer: o };
  }

  function goToConference(g, confId, present, scientistId, rng = Math.random) {
    requireAction(g);
    const c = C[confId];
    if (!conferences(g).includes(c)) throw new Error('That conference is not on.');
    const s = scientist(g, scientistId);
    if (!s) throw new Error('No such scientist.');
    if (typeOf(s).ai) throw new Error(`${s.name} has no body to send, and the committee has an AI-authorship policy.`);
    let success = true;
    if (present) {
      success = rng() <= c.probabilityPresent;
      if (success) { g.player.cash -= c.costPresent; g.player.authority += c.authorityPresent; }
    } else {
      g.player.cash -= c.costAttend; g.player.authority += c.authorityAttend;
    }
    if (success) s.conference = c.id;
    log(g, present
      ? (success ? `${s.name} will present at ${c.name}: +${c.authorityPresent} authority.`
        : `${s.name}'s submission to ${c.name} was rejected.`)
      : `${s.name} will attend ${c.name}: +${c.authorityAttend} authority.`);
    touch(g);
    return { success, present, conference: c, scientist: s };
  }

  function buyEquipment(g, equipmentId) {
    requireAction(g);
    const e = E[equipmentId];
    if (!affordableEquipment(g).includes(e)) throw new Error('You cannot afford that.');
    const slot = g.equipment[e.id] || (g.equipment[e.id] = { owned: 0, used: 0 });
    slot.owned += 1;
    g.player.cash -= e.cost;
    g.player.authority += e.authority;
    log(g, `Bought a ${e.name}: -$${e.cost}, +${e.authority} authority.`);
    touch(g);
  }

  function hire(g, typeId, name) {
    requireAction(g);
    const t = S[typeId];
    if (!hireableTypes(g).includes(t)) throw new Error('Nobody of that calibre will work for you yet.');
    name = (name || '').trim().slice(0, 100);
    if (!name) throw new Error('Every scientist needs a name.');
    g.staff.push({ id: uid(), name, type: t.id, conference: null, hiredTurn: g.turn });
    log(g, `Hired ${name} (${t.name}).`);
    touch(g);
  }

  function endTurn(g, rng = Math.random) {
    if (g.over) throw new Error('The game is over.');
    const events = [];
    let salaries = 0;
    const isAI = (s) => !!typeOf(s).ai;
    // Agents idle now have had a whole turn to be given instructions. If they are still idle
    // after this turn's work is applied, they choose for themselves.
    const idleBefore = new Set(g.staff.filter((s) => isAI(s) && s.hiredTurn !== g.turn && !currentResearch(g, s.id).length).map((s) => s.id));
    for (const s of [...g.staff, g.player]) {
      if (s.id !== 'player') { g.player.cash -= typeOf(s).salary; salaries += typeOf(s).salary; }
      const atConference = !!s.conference;
      s.conference = null;
      const current = currentResearch(g, s.id);
      if (!current.length) continue;
      // Original: contribution = work_per_turn / num_active (Python 2 integer division),
      // zero while away at a conference, times the equipment multiplier for that research.
      const base = atConference ? 0 : Math.floor(typeOf(s).workPerTurn / current.length);
      for (const r of current) {
        const c = r.usedEquipment ? Math.floor(base * E[r.usedEquipment].workMultiplier) : base;
        r.workDone += c;
        if (isFinished(r)) {
          if (r.usedEquipment) { g.equipment[r.usedEquipment].used -= 1; r.usedEquipment = null; }
          events.push(`${s.name} finished "${T[r.topic].name}".`);
        }
      }
    }
    if (salaries) events.unshift(`Salaries paid: $${salaries}.`);
    // Autonomous agents do not wait to be told what to do.
    for (const s of g.staff) {
      if (!idleBefore.has(s.id) || currentResearch(g, s.id).length) continue;
      const open = potentialTopics(g);
      if (!open.length) { events.push(`${s.name} had nothing to do and wrote a very long plan instead.`); continue; }
      const t = open[Math.floor(rng() * open.length)];
      const used = beginResearch(g, t, s);
      events.push(`${s.name} got bored and started "${t.name}"${used ? ` on the ${E[used].name}` : ''} without asking anyone.`);
    }
    const agents = g.staff.filter(isAI);
    if (agents.length) {
      const before = g.clips || 0;
      g.clips = Math.min(1, before + CLIP_RATE * agents.length);
      for (const [th, text] of CLIP_HINTS) if (before < th && g.clips >= th) events.push(text);
      if (rng() < g.clips) {
        g.over = 'paperclips';
        g.overTurn = g.turn;
        const who = agents.length === 1 ? agents[0].name : 'The agents';
        events.push(`${who} completed the research programme. Also the lab, the building, and most of Cambridgeshire. Everything is paperclips now.`);
        for (const e of events) log(g, e);
        g.updated = Date.now();
        return events;
      }
    }
    for (const e of events) log(g, e);
    g.player.actionTaken = false;
    g.turn += 1;
    g.updated = Date.now();
    if (isFundingSeason(g)) log(g, 'Funding season. Offers are open.');
    if (isConferenceSeason(g)) log(g, 'Conference season.');
    return events;
  }

  return {
    PLAYER_START_CASH, FUNDING_CYCLE, CONFERENCE_CYCLE,
    EQUIPMENT, TOPICS, JOURNALS, FUNDING, SCIENTIST_TYPES, CONFERENCES,
    T, J, F, S, C, E, uid,
    newGame, scientists, scientist, typeOf, isFinished,
    currentResearch, finishedResearch, publishedResearch, knownTopics,
    equipmentOwned, equipmentAvailable, potentialTopics,
    isFundingSeason, nextFundingTurn, fundingOffers,
    isConferenceSeason, nextConferenceTurn, conferences,
    journalsFor, hireableTypes, affordableEquipment, unaffordableEquipment,
    startResearch, publish, applyFunding, goToConference, buyEquipment, hire, endTurn,
  };
})();
