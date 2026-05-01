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
  const partyButtons = document.querySelectorAll('.class-card[data-hero]');
  const rosterCurrent = document.querySelector('.roster-current');

  function setHero(id) {
    if (!VALID_HEROES.includes(id)) return;
    const href = '#spr-hero-' + id;
    swappableUses.forEach((u) => u.setAttribute('href', href));
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

  /* ---------- 7. Hero transformation by scroll position ---------- */
  const TIER_FOR_LEVEL = {
    1: 'novice', 5: 'novice', 10: 'novice',
    25: 'apprentice', 50: 'apprentice',
    100: 'adept',
    250: 'expert', 500: 'expert',
    999: 'master'
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
      scrollPending = false;
    });
  }
  window.addEventListener('scroll', onScroll, { passive: true });
  // Initial sync
  updateHeroTier();

  /* ---------- 8. Konami-style easter egg (optional fun) ---------- */
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
