'use strict';
// UI, persistence and routing. Game state lives in localStorage; nothing leaves the browser.
(() => {
  const R = RULES;
  const STORE_KEY = 'simscience.v2.games';
  const $ = (sel, root = document) => root.querySelector(sel);
  const esc = (s) => String(s).replace(/[&<>"']/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));
  const money = (n) => (n < 0 ? '-$' : '$') + Math.abs(n).toLocaleString('en-GB');
  const pct = (p) => `${Math.round(p * 100)}%`;

  // ---- storage -------------------------------------------------------------
  function loadAll() {
    try { return JSON.parse(localStorage.getItem(STORE_KEY) || '{}') || {}; } catch { return {}; }
  }
  function saveGame(g) {
    try { const all = loadAll(); all[g.id] = g; localStorage.setItem(STORE_KEY, JSON.stringify(all)); } catch { /* private mode etc. */ }
  }
  function deleteGame(id) {
    try { const all = loadAll(); delete all[id]; localStorage.setItem(STORE_KEY, JSON.stringify(all)); } catch { /* ignore */ }
  }
  const b64 = {
    enc: (s) => btoa(unescape(encodeURIComponent(s))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, ''),
    dec: (s) => decodeURIComponent(escape(atob(s.replace(/-/g, '+').replace(/_/g, '/')))),
  };

  // ---- state ---------------------------------------------------------------
  let game = null;
  let lab = null;
  let activeTab = 'wip';

  const views = { menu: $('#menu'), game: $('#game') };
  const dlg = $('#dlg');

  function show(name) {
    for (const [k, el] of Object.entries(views)) el.hidden = k !== name;
  }

  // ---- menu ----------------------------------------------------------------
  function renderMenu() {
    const all = Object.values(loadAll()).sort((a, b) => b.updated - a.updated);
    const list = $('#saved');
    list.innerHTML = all.length ? all.map((g) => `
      <li>
        <a href="#g=${g.id}" class="saved-link"><strong>${esc(g.name)}</strong>
          <span class="muted">turn ${g.turn}, ${money(g.player.cash)}, authority ${g.player.authority}</span></a>
        <button class="link danger" data-del="${g.id}" title="Delete this game">delete</button>
      </li>`).join('') : '<li class="muted">No saved games in this browser yet.</li>';
    show('menu');
    document.title = 'SimScience';
  }

  $('#new-game').addEventListener('submit', (ev) => {
    ev.preventDefault();
    const name = $('#player-name').value.trim();
    if (!name) return;
    const g = R.newGame(name);
    g.log.push({ turn: 1, text: `${name} takes over the lab with ${money(R.PLAYER_START_CASH)} and no reputation to speak of.` });
    saveGame(g);
    $('#player-name').value = '';
    location.hash = `g=${g.id}`;
  });

  $('#saved').addEventListener('click', (ev) => {
    const id = ev.target.getAttribute('data-del');
    if (!id) return;
    const g = loadAll()[id];
    if (g && confirm(`Delete "${g.name}" (turn ${g.turn})? This cannot be undone.`)) { deleteGame(id); renderMenu(); }
  });

  // ---- game screen ---------------------------------------------------------
  function openGame(g) {
    game = g;
    if (!lab) lab = Lab.create($('#lab'), $('#lab-tip'));
    show('game');
    render();
  }

  function commit() { game.updated = Date.now(); saveGame(game); render(); }

  function render() {
    const g = game, p = g.player;
    document.title = `SimScience: ${g.name}`;
    $('#stat-turn').textContent = g.turn;
    $('#stat-cash').textContent = money(p.cash);
    $('#stat-cash').classList.toggle('neg', p.cash < 0);
    $('#stat-auth').textContent = p.authority;
    $('#lab-title').textContent = `${g.name}'s lab`;
    lab.update(g);

    const over = !!g.over;
    const acted = p.actionTaken || over;
    document.body.classList.toggle('acted', acted);
    for (const b of document.querySelectorAll('button.action')) {
      b.disabled = acted;
      b.title = over ? 'The game is over.' : acted ? 'One action per turn. End the turn to continue.' : '';
    }
    $('#end-turn').disabled = over;
    $('#action-note').hidden = over || !p.actionTaken;
    const banner = $('#over-banner');
    banner.hidden = !over;
    if (over) {
      const pubs = g.research.filter((r) => r.published).length;
      banner.innerHTML = `<h3>Game over</h3><p>The lab is paperclips. So is everything else. You lasted <b>${g.turn}</b> turns,
        published <b>${pubs}</b> paper${pubs === 1 ? '' : 's'} and reached authority <b>${p.authority}</b>, which no longer means anything.</p>
        <p><a href="#" class="btn">Main menu</a></p>`;
    }

    const li = (items, empty) => (items.length ? items.map((x) => `<li>${x}</li>`).join('') : `<li class="muted">${empty}</li>`);
    $('#funding-list').innerHTML = li(R.fundingOffers(g).map((o) => esc(o.name)),
      R.isFundingSeason(g) ? 'Nothing you qualify for.' : `Next round on turn ${R.nextFundingTurn(g)}.`);
    $('#conf-list').innerHTML = li(R.conferences(g).map((c) => esc(c.name)),
      R.isConferenceSeason(g) ? 'Nothing you qualify for.' : `Next season on turn ${R.nextConferenceTurn(g)}.`);
    $('#topics-list').innerHTML = li(R.potentialTopics(g).map((t) => esc(t.name)), 'Nothing. Buy equipment or finish prerequisites.');

    const all = R.scientists(g);
    const wip = [], done = [], pub = [];
    for (const s of all) {
      for (const r of R.currentResearch(g, s.id)) {
        const t = R.T[r.topic];
        const pc = Math.min(100, Math.round((100 * r.workDone) / t.requiredWork));
        wip.push(`<li><b>${esc(t.name)}</b> <span class="muted">(${esc(s.name)})</span>
          <span class="bar"><span style="width:${pc}%"></span></span>
          <span class="muted">${r.workDone}/${t.requiredWork} hours${r.usedEquipment ? `, on the ${R.E[r.usedEquipment].name}` : ''}</span></li>`);
      }
      for (const r of R.finishedResearch(g, s.id)) {
        done.push(`<li><b>${esc(R.T[r.topic].name)}</b> <span class="muted">(${esc(s.name)})</span>
          <button class="action small" data-act="publish" data-id="${r.id}">Publish…</button></li>`);
      }
      for (const r of R.publishedResearch(g, s.id)) {
        pub.push(`<li>${esc(s.name)}${s.id !== 'player' ? `, ${esc(g.name)}` : ''}, <i>${esc(R.T[r.topic].name)}</i>, in <b>${esc(R.J[r.journal].name)}</b></li>`);
      }
    }
    $('#tab-wip').innerHTML = li(wip, 'Nobody is working on anything.');
    $('#tab-done').innerHTML = li(done, 'Nothing finished and unpublished.');
    $('#tab-pub').innerHTML = li(pub.reverse(), 'No publications yet.');
    $('#count-wip').textContent = wip.length;
    $('#count-done').textContent = done.length;
    $('#count-pub').textContent = pub.length;
    setTab(activeTab);

    $('#staff-list').innerHTML = li(g.staff.map((s) => `${esc(s.name)} <span class="muted">(${R.S[s.type].name}, ${R.currentResearch(g, s.id).length} active${s.conference ? ', at a conference' : ''})</span>`), 'Just you so far.');
    $('#equipment-list').innerHTML = li(R.EQUIPMENT.filter((e) => R.equipmentOwned(g, e.id).owned)
      .map((e) => { const s = R.equipmentOwned(g, e.id); return `${s.owned} × ${e.name} <span class="muted">(${s.used} in use)</span>`; }), 'Bare benches.');

    $('#log-list').innerHTML = g.log.slice(-40).reverse().map((e) => `<li><span class="muted">T${e.turn}</span> ${esc(e.text)}</li>`).join('');
  }

  function setTab(name) {
    activeTab = name;
    for (const b of document.querySelectorAll('#tabs [role=tab]')) {
      const on = b.dataset.tab === name;
      b.setAttribute('aria-selected', on);
      $(`#tab-${b.dataset.tab}`).hidden = !on;
    }
  }
  $('#tabs').addEventListener('click', (ev) => { const b = ev.target.closest('[role=tab]'); if (b) setTab(b.dataset.tab); });

  // ---- dialogs -------------------------------------------------------------
  function openDialog(title, html) {
    $('#dlg-title').textContent = title;
    $('#dlg-body').innerHTML = html;
    if (!dlg.open) dlg.showModal();
  }
  function closeDialog() { if (dlg.open) dlg.close(); }
  $('#dlg-close').addEventListener('click', closeDialog);
  dlg.addEventListener('click', (ev) => { if (ev.target === dlg) closeDialog(); });

  const table = (head, rows) => `<table><thead><tr>${head.map((h) => `<th>${h}</th>`).join('')}</tr></thead>
    <tbody>${rows.map((r) => `<tr>${r.map((c) => `<td>${c}</td>`).join('')}</tr>`).join('')}</tbody></table>`;
  const back = (label = "I'll be back…") => `<p><button class="btn" data-do="close">${label}</button></p>`;
  const whoTable = (g, verb, mk, people = R.scientists(g)) => table(['Name', 'Work per turn (hours)', 'Current projects', ''],
    people.map((s) => [s.id === 'player' ? 'Yourself' : esc(s.name), R.S[s.type].workPerTurn,
      R.currentResearch(g, s.id).length, `<button class="btn" ${mk(s)}>${verb}</button>`]));

  function run(fn) {
    try { fn(); commit(); return true; } catch (e) { openDialog('Hmm', `<p>${esc(e.message)}</p>${back('OK')}`); return false; }
  }

  const flows = {
    research() {
      const topics = R.potentialTopics(game);
      openDialog('Start new research', topics.length ? table(['Description', 'Required work (hours)', 'Base authority value (*)', ''],
        topics.map((t) => [esc(t.name), t.requiredWork, t.baseAuthority,
          `<button class="btn" data-do="research-pick" data-topic="${t.id}">Start research</button>`]))
        + '<p class="muted">(*) Base authority is later modified by the authority multiplier of the publishing journal, to give the total authority gain from publishing results on this topic.</p>'
        : `<p>No topics are open to you right now. Finish what you have, or buy the equipment the harder topics need.</p>${back()}`);
    },
    'research-pick'(d) {
      if (!game.staff.length) return run(() => R.startResearch(game, d.topic, 'player')) && closeDialog();
      openDialog('Assign the new research', whoTable(game, 'Assign', (s) => `data-do="research-go" data-topic="${d.topic}" data-who="${s.id}"`));
    },
    'research-go'(d) { if (run(() => R.startResearch(game, d.topic, d.who))) closeDialog(); },

    publish(d) {
      const r = game.research.find((x) => x.id === d.id);
      const js = R.journalsFor(game, r);
      openDialog(`Publish: ${R.T[r.topic].name}`, js.length ? table(['Journal', 'Publication cost ($)', 'Authority multiplier', ''],
        js.map((j) => [esc(j.name), j.cost.toLocaleString(), j.multiplier.toFixed(1),
          `<button class="btn" data-do="publish-go" data-id="${r.id}" data-journal="${j.id}">Publish</button>`]))
        + '<p class="muted"><a href="https://www.youtube.com/watch?v=sLRw9ac0e20" target="_blank" rel="noopener">It gets better.</a></p>'
        : `<h3>You don't have enough money to publish! Go apply for some funding.</h3>${back()}`);
    },
    'publish-go'(d) { if (run(() => R.publish(game, d.id, d.journal))) closeDialog(); },

    funding() {
      if (!R.isFundingSeason(game)) {
        return openDialog('Apply for funding', `<p>Unfortunately, you have arrived out of funding season.<br>Funding bodies make their offers on turn 1, and subsequently on turns 5, 10, 15 etc.</p>
          <p>The next funding offers will be made on turn ${R.nextFundingTurn(game)}. See you then!</p>${back()}`);
      }
      const offers = R.fundingOffers(game);
      openDialog('Apply for funding', table(['Name', 'Cash award ($)', 'Authority gain/loss', 'Probability of success', ''],
        offers.map((o) => [esc(o.name), o.cash.toLocaleString(), o.authority, pct(o.probability),
          `<button class="btn" data-do="funding-go" data-offer="${o.id}">Apply</button>`])));
    },
    'funding-go'(d) {
      let res;
      if (!run(() => { res = R.applyFunding(game, d.offer); })) return;
      const o = res.offer;
      openDialog('Funding decision', res.success
        ? `<p>Congratulations! Your application has been successful.<br>You have been awarded ${money(o.cash)}.<br>
            ${o.authority >= 0 ? `Your authority has increased by ${o.authority}.` : `However, your authority has decreased by ${-o.authority}.`}</p>
            ${back('Hooray! Now back to the game…')}`
        : `<p>I regret to inform you that your funding application has not been successful.<br>We are sorry to send you this disappointing news.<br>
            The decision is final. We are not able to enter into further correspondence about the decision.</p>${back('Better luck next time…')}`);
    },

    conference() {
      if (!R.isConferenceSeason(game)) {
        return openDialog('Go to a conference', `<p>Unfortunately, you have arrived out of conference season.<br>Conferences take place on turns 3, 6, 9 etc.</p>
          <p>The next conferences will be held on turn ${R.nextConferenceTurn(game)}. See you then!</p>${back()}`);
      }
      const cs = R.conferences(game);
      openDialog('Go to a conference', table(['Name', 'Attend ($)', 'Present ($)', 'Authority (attend)', 'Authority (present)', 'Chance to present', '', ''],
        cs.map((c) => [esc(c.name), c.costAttend.toLocaleString(), c.costPresent.toLocaleString(), c.authorityAttend, c.authorityPresent, pct(c.probabilityPresent),
          `<button class="btn" data-do="conf-pick" data-conf="${c.id}" data-present="0">Attend</button>`,
          `<button class="btn" data-do="conf-pick" data-conf="${c.id}" data-present="1">Present</button>`])));
    },
    'conf-pick'(d) {
      if (!game.staff.length) return flows['conf-go']({ ...d, who: 'player' });
      const bodies = R.scientists(game).filter((s) => !R.S[s.type].ai);
      const bots = game.staff.filter((s) => R.S[s.type].ai);
      openDialog('Choose who to send', whoTable(game, 'Send', (s) => `data-do="conf-go" data-conf="${d.conf}" data-present="${d.present}" data-who="${s.id}"`, bodies)
        + (bots.length ? `<p class="muted">${bots.map((s) => esc(s.name)).join(', ')} cannot go: no body, and the committee has an AI-authorship policy.</p>` : ''));
    },
    'conf-go'(d) {
      let res;
      if (!run(() => { res = R.goToConference(game, d.conf, d.present === '1', d.who); })) return;
      const { conference: c, scientist: s } = res;
      const who = s.id === 'player' ? 'You' : esc(s.name);
      let html;
      if (!res.present) {
        html = `<p>${who} will attend ${esc(c.name)}, increasing your authority by ${c.authorityAttend}.<br>Of course, there will be no lab work done this turn…</p>${back('OK. Now back to the game…')}`;
      } else if (res.success) {
        html = `<p>Congratulations! Your submission has been accepted.<br>${who} will present a paper at ${esc(c.name)}, increasing your authority by ${c.authorityPresent}!<br>Of course, there will be no lab work done this turn…</p>${back('Hooray! Now back to the game…')}`;
      } else {
        html = `<p>Thank you for your submission to the conference "${esc(c.name)}".<br>
          The selection committee received an unusually large number of strong proposals, indeed far more than expected.
          I regret to inform you that yours was not among the very small number of papers selected for presentation at the conference.
          Please understand that this decision reflects the extremely limited space available on the program rather than any lack of enthusiasm for your submission.
          We wish we had space to accept more of the submitted papers, and we truly appreciate having had the opportunity to consider your work.</p>${back('Better luck next time…')}`;
      }
      openDialog('Conference', html);
    },

    equipment() {
      const ok = R.affordableEquipment(game), no = R.unaffordableEquipment(game);
      const row = (e, buy) => [esc(e.name), `<a href="${e.link}" target="_blank" rel="noopener">what is it?</a>`, e.cost.toLocaleString(), e.authority,
        buy ? `<button class="btn" data-do="equipment-go" data-eq="${e.id}">Buy</button>` : ''];
      openDialog('Buy equipment',
        (ok.length ? `<h3>Affordable equipment</h3>${table(['Name', 'Info', 'Cost ($)', 'Authority gain', ''], ok.map((e) => row(e, true)))}` : '')
        + (no.length ? `<h3>Unaffordable equipment</h3><p class="muted">Apply for funding to buy these amazing machines!</p>${table(['Name', 'Info', 'Cost ($)', 'Authority gain', ''], no.map((e) => row(e, false)))}` : '')
        + (ok.length ? '' : back()));
    },
    'equipment-go'(d) { if (run(() => R.buyEquipment(game, d.eq))) closeDialog(); },

    hire() {
      const types = R.hireableTypes(game);
      openDialog('Hire a scientist', table(['Type', 'Work per turn (hours)', 'Salary per turn ($)', ''],
        types.map((t) => [`${esc(t.name)}${t.note ? `<br><span class="muted small">${esc(t.note)}</span>` : ''}`, t.workPerTurn, t.salary,
          `<button class="btn" data-do="hire-pick" data-type="${t.id}">Hire</button>`])));
    },
    'hire-pick'(d) {
      const t = R.S[d.type];
      openDialog(`Hire ${t.ai ? 'an' : 'a'} ${t.name}`, `<form id="hire-form" data-type="${d.type}">
        <label>${t.ai ? 'Choose a name for your new agent' : 'Choose a name for your new staff member'}<br>
        <input name="name" maxlength="100" required autocomplete="off" value="${esc(t.defaultName || '')}"></label>
        <p><button class="btn" type="submit">OK</button></p></form>`);
      const inp = $('#hire-form input'); inp.focus(); inp.select();
    },
  };

  $('#game').addEventListener('click', (ev) => {
    const b = ev.target.closest('button.action');
    if (!b || b.disabled) return;
    flows[b.dataset.act](b.dataset);
  });
  $('#dlg-body').addEventListener('click', (ev) => {
    const b = ev.target.closest('button[data-do]');
    if (!b) return;
    if (b.dataset.do === 'close') return closeDialog();
    flows[b.dataset.do](b.dataset);
  });
  $('#dlg-body').addEventListener('submit', (ev) => {
    const f = ev.target.closest('#hire-form');
    if (!f) return;
    ev.preventDefault();
    if (run(() => R.hire(game, f.dataset.type, f.name.value))) closeDialog();
  });

  $('#end-turn').addEventListener('click', () => {
    if (!run(() => R.endTurn(game))) return;
    if (game.over) {
      const agents = game.staff.filter((s) => R.S[s.type].ai).map((s) => esc(s.name));
      openDialog('Paperclips', `<p>${agents.join(' and ')} completed the research programme.</p>
        <p>Also the lab, the building, and most of Cambridgeshire. Everything is paperclips now.</p>
        <p class="muted">In fairness, you were warned about the stationery cupboard.</p>${back('I see.')}`);
    }
    $('#end-turn').classList.remove('pulse'); void $('#end-turn').offsetWidth; $('#end-turn').classList.add('pulse');
  });

  $('#share').addEventListener('click', async () => {
    const url = `${location.origin}${location.pathname}#s=${b64.enc(JSON.stringify(game))}`;
    try { await navigator.clipboard.writeText(url); toast('Snapshot link copied. Anyone opening it gets their own copy of this game.'); } catch { prompt('Copy this link:', url); }
  });

  let toastTimer = 0;
  function toast(msg) {
    const el = $('#toast'); el.textContent = msg; el.hidden = false;
    clearTimeout(toastTimer); toastTimer = setTimeout(() => { el.hidden = true; }, 3500);
  }

  // ---- routing -------------------------------------------------------------
  function route() {
    const h = new URLSearchParams(location.hash.slice(1));
    if (h.get('s')) {
      try {
        const g = JSON.parse(b64.dec(h.get('s')));
        if (g && g.v === 2 && g.player) {
          g.id = R.uid(); g.updated = Date.now();
          g.log.push({ turn: g.turn, text: 'Game imported from a shared snapshot.' });
          saveGame(g);
          location.replace(`#g=${g.id}`);
          return;
        }
      } catch { /* fall through to menu */ }
    }
    const id = h.get('g');
    const g = id && loadAll()[id];
    if (g) openGame(g); else { if (id) location.replace('#'); renderMenu(); }
  }
  window.addEventListener('hashchange', route);
  route();
})();
