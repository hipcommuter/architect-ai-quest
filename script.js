/* ============================================================
   THE ARCHITECT'S AI QUEST — interactions
   - Scroll-triggered "in-view" reveals for level nodes & quests
   - Optional level-up chime (muted by default)
   - Tiny "press any key" listener to scroll past Title screen
   ============================================================ */

(function () {
  'use strict';

  /* ---------- 1. IntersectionObserver: reveal on scroll ---------- */
  if ('IntersectionObserver' in window) {
    const reveal = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add('in-view');
            reveal.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.15, rootMargin: '0px 0px -10% 0px' }
    );

    document
      .querySelectorAll('.level-node, .fade-in, .class-card, .boss-card, .starter-lane')
      .forEach((el) => reveal.observe(el));
  } else {
    // Fallback: just show everything
    document
      .querySelectorAll('.level-node, .fade-in')
      .forEach((el) => el.classList.add('in-view'));
  }

  /* ---------- 2. Press any key on title screen → scroll to next ---------- */
  let titleScrolled = false;
  function handleStart() {
    if (titleScrolled) return;
    const tutorial = document.getElementById('tutorial');
    if (tutorial) {
      tutorial.scrollIntoView({ behavior: 'smooth' });
      titleScrolled = true;
    }
  }
  // Trigger on Enter/Space if user is at the top
  window.addEventListener('keydown', (e) => {
    if (window.scrollY < 50 && (e.key === 'Enter' || e.key === ' ')) {
      e.preventDefault();
      handleStart();
    }
  });

  /* ---------- 3. Click on Title's "PRESS START" cue ---------- */
  document.querySelectorAll('#title-screen .press-start').forEach((el) => {
    el.style.cursor = 'pointer';
    el.addEventListener('click', handleStart);
  });

  /* ---------- 4. Click on Credits' "SCROLL UP" cue → top ---------- */
  document.querySelectorAll('#credits .press-start').forEach((el) => {
    el.style.cursor = 'pointer';
    el.addEventListener('click', () => {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    });
  });

  /* ---------- 5. Level-up chime (8-bit ping on level reveal) ---------- */
  // Browsers block AudioContext until first user gesture.
  // We init lazily on first scroll/click so unwanted autoplay is avoided.
  let audioCtx = null;
  let audioReady = false;
  function ensureAudio() {
    if (audioCtx) return;
    try {
      audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      audioReady = true;
    } catch (e) { audioReady = false; }
  }
  function chime(freq, duration) {
    if (!audioReady || !audioCtx) return;
    try {
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.type = 'square';
      osc.frequency.value = freq;
      gain.gain.setValueAtTime(0.05, audioCtx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + (duration || 0.12));
      osc.connect(gain).connect(audioCtx.destination);
      osc.start();
      osc.stop(audioCtx.currentTime + (duration || 0.12));
    } catch (e) { }
  }
  // Lazy-init audio on first user gesture
  ['click', 'keydown', 'scroll'].forEach((evt) => {
    window.addEventListener(evt, ensureAudio, { once: true, passive: true });
  });
  // Chime ladder — pitch climbs as user reaches higher levels
  document.querySelectorAll('.level-node').forEach((node, i) => {
    const seenObs = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting && audioReady) {
            chime(330 + i * 55, 0.1);
            seenObs.unobserve(node);
          }
        });
      },
      { threshold: 0.5 }
    );
    seenObs.observe(node);
  });

  /* ---------- 6. Party member selection ---------- */
  const HERO_KEY = 'architect-quest-hero';
  const VALID_HEROES = ['drafter', 'designer', 'communicator', 'researcher'];
  const HERO_NAMES = {
    drafter: 'DRAFTER',
    designer: 'DESIGNER',
    communicator: 'COMMUNICATOR',
    researcher: 'RESEARCHER',
  };

  function readSavedHero() {
    try {
      const v = localStorage.getItem(HERO_KEY);
      return VALID_HEROES.includes(v) ? v : null;
    } catch (e) { return null; }
  }
  function writeSavedHero(id) {
    try { localStorage.setItem(HERO_KEY, id); } catch (e) {}
  }

  const swappableUses = document.querySelectorAll('.swappable-hero');
  const partyOtherSlots = Array.from(document.querySelectorAll('.party-other'))
    .sort((a, b) => Number(a.dataset.otherSlot) - Number(b.dataset.otherSlot));
  const partyButtons = document.querySelectorAll('.class-card[data-hero]');
  const rosterCurrent = document.querySelector('.roster-current');

  function setHero(id) {
    if (!VALID_HEROES.includes(id)) return;
    const href = '#spr-hero-' + id;
    swappableUses.forEach((u) => u.setAttribute('href', href));
    // Boss-battle party: fill the other 3 slots with the remaining classes
    // so we never render the same character twice on the field.
    const others = VALID_HEROES.filter((h) => h !== id);
    partyOtherSlots.forEach((el, i) => {
      if (others[i]) el.setAttribute('href', '#spr-hero-' + others[i]);
    });
    partyButtons.forEach((btn) => {
      btn.classList.toggle('is-recruited', btn.dataset.hero === id);
    });
    if (rosterCurrent) rosterCurrent.textContent = HERO_NAMES[id];
    writeSavedHero(id);
    // tiny chime on swap (if audio is ready)
    if (typeof chime === 'function' && audioReady) chime(660, 0.06);
  }

  // Initialize from saved choice (default = drafter)
  setHero(readSavedHero() || 'drafter');

  partyButtons.forEach((btn) => {
    btn.addEventListener('click', () => setHero(btn.dataset.hero));
  });

  /* ---------- 7a. Locked level reveal + compact tier-up popup ---------- */
  const tierPopup = document.getElementById('tier-popup');
  const tpBurst = document.getElementById('tp-burst');
  const tpTier = tierPopup?.querySelector('.tp-tier');
  const reachedLevels = new Set();
  let userHasScrolled = false;
  let tierUnlockQueue = [];
  let tierUnlockPlaying = false;
  let lastUnlockedTier = null;
  let pageLoadedAt = Date.now();

  // Tier copy — fires once per tier transition. Skill-list summarizes what the tier unlocks.
  const TIER_COPY = {
    novice: {
      headline: 'NOVICE',
      sub:      'YOUR JOURNEY BEGINS · LV.1+',
      summary:  'Ask AI questions · Summarize docs · Provide context for better answers',
    },
    apprentice: {
      headline: 'APPRENTICE',
      sub:      'TIER UNLOCKED · LV.25+',
      summary:  'Image generation · Saved personas / custom prompts · Multi-step chains',
    },
    adept: {
      headline: 'ADEPT',
      sub:      'TIER UNLOCKED · LV.75+',
      summary:  'Long-context multi-doc analysis · Custom Projects · Custom rules + AI persona',
    },
    expert: {
      headline: 'EXPERT',
      sub:      'TIER UNLOCKED · LV.250+',
      summary:  'AI agents in your IDE · API integration / function calling · MCP servers',
    },
    master: {
      headline: 'MASTER',
      sub:      'FINAL TIER UNLOCKED · LV.700+',
      summary:  'Multi-agent worktrees · Long-running scheduled pipelines · Full agent orchestration',
    },
  };

  // First scroll flag — used to suppress overlay on initial page load
  window.addEventListener('scroll', () => { userHasScrolled = true; }, { once: true, passive: true });

  function reachLevel(node, animated) {
    const lvl = parseInt(node.dataset.level, 10);
    if (reachedLevels.has(lvl)) return;
    reachedLevels.add(lvl);
    node.classList.add('is-reached');
    if (animated) {
      node.classList.add('just-reached');
      setTimeout(() => node.classList.remove('just-reached'), 800);
      // Only fire overlay on TIER transitions, not every level
      const tier = TIER_FOR_LEVEL[lvl] || 'novice';
      if (tier !== lastUnlockedTier) {
        lastUnlockedTier = tier;
        tierUnlockQueue.push(tier);
        processTierUnlockQueue();
      }
    }
  }

  function processTierUnlockQueue() {
    if (tierUnlockPlaying || tierUnlockQueue.length === 0 || !tierPopup) return;
    // Suppress popups during the first 1500ms of page load (defense-in-depth — also gated by userHasScrolled)
    if (Date.now() - pageLoadedAt < 1500) {
      tierUnlockQueue = [];
      return;
    }
    const tierKey = tierUnlockQueue.shift();
    const copy = TIER_COPY[tierKey];
    if (!copy) return;
    tierUnlockPlaying = true;
    if (tpTier) tpTier.textContent = copy.headline;
    // Restart popup animation
    tierPopup.classList.remove('is-active');
    if (tpBurst) tpBurst.classList.remove('is-active');
    void tierPopup.offsetWidth;
    tierPopup.classList.add('is-active');
    if (tpBurst) tpBurst.classList.add('is-active');
    // Tier-up chime — pitch climbs per tier (kept; sound is short)
    if (typeof chime === 'function' && audioReady) {
      const tierFreq = { novice: 330, apprentice: 440, adept: 550, expert: 660, master: 880 };
      const f = tierFreq[tierKey] || 440;
      chime(f, 0.18);
      setTimeout(() => chime(f * 1.5, 0.14), 180);
    }
    setTimeout(() => {
      tierPopup.classList.remove('is-active');
      if (tpBurst) tpBurst.classList.remove('is-active');
      tierUnlockPlaying = false;
      processTierUnlockQueue();
    }, 1700);
  }

  // Initial pass: mark already-visible nodes as reached without animation
  function syncInitialReachState() {
    const triggerY = window.innerHeight * 0.55;
    document.querySelectorAll('.level-node[data-level]').forEach((node) => {
      const r = node.getBoundingClientRect();
      if (r.top < triggerY) reachLevel(node, false);
    });
  }
  // Run after the page has had a chance to layout
  setTimeout(syncInitialReachState, 50);

  // Scroll-based reveal: when a node's top crosses the trigger line, reach it
  function checkLevelReach() {
    const triggerY = window.innerHeight * 0.45;
    document.querySelectorAll('.level-node[data-level]').forEach((node) => {
      if (reachedLevels.has(parseInt(node.dataset.level, 10))) return;
      const r = node.getBoundingClientRect();
      if (r.top < triggerY) reachLevel(node, userHasScrolled);
    });
  }
  // Tied to existing throttled scroll handler below

  /* ---------- 7. Hero transformation by scroll position ---------- */
  const TIER_FOR_LEVEL = {
    1: 'novice', 5: 'novice', 10: 'novice',
    25: 'apprentice', 35: 'apprentice', 50: 'apprentice',
    75: 'adept', 100: 'adept', 150: 'adept',
    250: 'expert', 350: 'expert', 500: 'expert',
    700: 'master', 850: 'master', 999: 'master'
  };
  const TIER_LABEL = {
    novice: 'NOVICE',
    apprentice: 'APPRENTICE',
    adept: 'ADEPT',
    expert: 'EXPERT',
    master: 'MASTER',
  };

  const levelHero = document.querySelector('.level-hero');
  const levelHeroWrap = document.querySelector('.level-hero-wrap');
  const tierLabelEl = document.querySelector('.tier-label');
  const allLevelNodes = Array.from(document.querySelectorAll('.level-node'));

  function computeCurrentTier() {
    if (!allLevelNodes.length) return 'novice';
    const triggerY = window.innerHeight * 0.45;
    let currentLevel = 1;
    for (const node of allLevelNodes) {
      const rect = node.getBoundingClientRect();
      if (rect.top < triggerY) {
        currentLevel = parseInt(node.dataset.level, 10) || currentLevel;
      }
    }
    return TIER_FOR_LEVEL[currentLevel] || 'novice';
  }

  let lastTier = 'novice';
  function updateHeroTier() {
    if (!levelHero) return;
    const next = computeCurrentTier();
    if (next === lastTier) return;
    lastTier = next;
    levelHero.dataset.tier = next;
    if (tierLabelEl) tierLabelEl.textContent = TIER_LABEL[next];
    if (levelHeroWrap) levelHeroWrap.dataset.showLabel = 'true';
    // Trigger flash animation
    levelHero.classList.remove('tier-up');
    void levelHero.offsetWidth; // restart animation
    levelHero.classList.add('tier-up');
    // Tier-up chime ladder
    if (typeof chime === 'function' && audioReady) {
      const tierFreq = { novice: 330, apprentice: 440, adept: 550, expert: 660, master: 880 };
      chime(tierFreq[next], 0.18);
    }
    // Hide label after a moment if not master tier
    clearTimeout(updateHeroTier._t);
    if (next !== 'master') {
      updateHeroTier._t = setTimeout(() => {
        if (levelHeroWrap) levelHeroWrap.dataset.showLabel = 'false';
      }, 2200);
    }
  }

  // Throttled scroll handler
  let scrollPending = false;
  function onScroll() {
    if (scrollPending) return;
    scrollPending = true;
    requestAnimationFrame(() => {
      updateHeroTier();
      checkLevelReach();
      scrollPending = false;
    });
  }
  window.addEventListener('scroll', onScroll, { passive: true });
  // Initial sync
  updateHeroTier();
  checkLevelReach();

  /* ---------- 8. "Open Project in VS Code" launcher per quest ---------- */
  // Path map is loaded from quest-paths.local.json (gitignored, local-only).
  // Public site visitors won't have this file, so the launcher buttons stay hidden for them.
  // The author can edit the JSON to map quest-id → local path on their disk.
  let QUEST_PATHS = {};

  function launcherTemplate(path) {
    // Encode the path safely for vscode://file URL
    const encoded = encodeURI(path).replace(/#/g, '%23');
    const cmd = `cd "${path.replace(/\//g, '\\\\')}" && claude`;
    return `
      <div class="quest-launch">
        <a class="quest-launch-btn" href="vscode://file/${encoded}" title="Open this project's folder in VS Code"><span class="launch-icon">▶</span> OPEN IN VS CODE</a>
        <button class="quest-launch-btn quest-copy-btn" type="button" data-cmd='${cmd}' title="Copy 'cd path && claude' to clipboard"><span class="launch-icon">📋</span> COPY CMD</button>
      </div>
    `;
  }

  // Async-load the local path map, then inject launchers
  async function loadQuestPaths() {
    try {
      const resp = await fetch('quest-paths.local.json', { cache: 'no-store' });
      if (!resp.ok) return;
      QUEST_PATHS = await resp.json();
    } catch (e) {
      // No local config (public site) — silently skip launchers
      return;
    }
    document.querySelectorAll('.quest-card[data-quest-id]').forEach((card) => {
      const id = card.getAttribute('data-quest-id');
      const path = QUEST_PATHS[id];
      if (!path) return;
      const header = card.querySelector('.quest-header');
      if (!header) return;
      header.insertAdjacentHTML('beforeend', launcherTemplate(path));
    });
    // Wire copy buttons after they're injected
    document.querySelectorAll('.quest-copy-btn').forEach(wireCopyButton);
  }
  loadQuestPaths();

  function wireCopyButton(btn) {
    btn.addEventListener('click', async (e) => {
      e.preventDefault();
      const cmd = btn.dataset.cmd;
      try {
        await navigator.clipboard.writeText(cmd);
        const orig = btn.innerHTML;
        btn.innerHTML = '<span class="launch-icon">✓</span> COPIED!';
        btn.classList.add('is-copied');
        setTimeout(() => {
          btn.innerHTML = orig;
          btn.classList.remove('is-copied');
        }, 1500);
      } catch (err) {
        const ta = document.createElement('textarea');
        ta.value = cmd;
        document.body.appendChild(ta);
        ta.select();
        try { document.execCommand('copy'); } catch (e2) {}
        document.body.removeChild(ta);
      }
    });
  }

  /* ---------- 9. Konami-style easter egg (optional fun) ---------- */
  const konami = ['ArrowUp','ArrowUp','ArrowDown','ArrowDown','ArrowLeft','ArrowRight','ArrowLeft','ArrowRight','b','a'];
  let pos = 0;
  window.addEventListener('keydown', (e) => {
    if (e.key === konami[pos]) {
      pos++;
      if (pos === konami.length) {
        document.body.style.filter = 'hue-rotate(180deg)';
        pos = 0;
      }
    } else {
      pos = 0;
    }
  });

})();
