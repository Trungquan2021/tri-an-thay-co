/* ═══════════════════════════════════════════════════════════════
   BỨC TƯỜNG LỜI TRI ÂN – 20/11
   Client Logic: Classroom Whiteboard & Aesthetic Random Scatter
   ═══════════════════════════════════════════════════════════════ */

(function () {
  'use strict';

  // ─── State Management ───────────────────────────────────────
  let wishes = [];
  let totalSends = 0;
  let isSubmitting = false;
  let socket = null;
  let currentView = 'write'; // 'write' or 'wall'

  const STORAGE_KEY = 'tri_an_2011_submitted_wish';

  // ─── DOM References ─────────────────────────────────────────
  const viewWrite = document.getElementById('view-write');
  const viewWall = document.getElementById('view-wall');
  const btnNavWrite = document.getElementById('btn-nav-write');
  const btnNavWall = document.getElementById('btn-nav-wall');
  const brandHome = document.getElementById('brand-home');

  const globalTotalCount = document.getElementById('global-total-count');
  const wallTotalCount = document.getElementById('wall-total-count');

  const wishInput = document.getElementById('wish-input');
  const charCount = document.getElementById('char-count');
  const btnSubmit = document.getElementById('btn-submit');
  const submitAlert = document.getElementById('submit-alert');

  const formContainer = document.getElementById('form-container');
  const alreadySubmittedView = document.getElementById('already-submitted-view');
  const userSubmittedContent = document.getElementById('user-submitted-content');
  const btnGotoWall = document.getElementById('btn-goto-wall');
  const btnRewrite = document.getElementById('btn-rewrite');
  const btnLinkToWall = document.getElementById('btn-link-to-wall');
  const btnBackToWrite = document.getElementById('btn-back-to-write');

  const boardScatterStage = document.getElementById('board-scatter-stage');
  const boardEmptyState = document.getElementById('board-empty-state');
  const btnEmptyWrite = document.getElementById('btn-empty-write');
  const transitionCurtain = document.getElementById('transition-curtain');

  // ─── Entry Point ───────────────────────────────────────────
  function init() {
    setupViewNavigation();
    setupInputEvents();
    checkExistingSubmission();
    setupSocket();
    fetchInitialData();
    initAmbientCanvas();
  }

  // ─── View Switching (Two-stage Experience) ─────────────────
  function switchView(targetView, withCurtain = false) {
    if (targetView === currentView && !withCurtain) return;

    if (withCurtain) {
      transitionCurtain.classList.add('active');
      setTimeout(() => {
        applyViewChange(targetView);
        setTimeout(() => {
          transitionCurtain.classList.remove('active');
          if (targetView === 'wall') {
            const board = document.getElementById('tribute-board');
            if (board) board.scrollTop = 0;
          }
        }, 300);
      }, 350);
    } else {
      applyViewChange(targetView);
    }
  }

  function applyViewChange(targetView) {
    currentView = targetView;

    if (targetView === 'write') {
      viewWall.classList.remove('active-view');
      viewWall.style.display = 'none';

      viewWrite.style.display = 'block';
      setTimeout(() => viewWrite.classList.add('active-view'), 20);

      btnNavWrite.classList.add('active');
      btnNavWall.classList.remove('active');
    } else {
      viewWrite.classList.remove('active-view');
      viewWrite.style.display = 'none';

      viewWall.style.display = 'block';
      setTimeout(() => viewWall.classList.add('active-view'), 20);

      btnNavWall.classList.add('active');
      btnNavWrite.classList.remove('active');
    }
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function setupViewNavigation() {
    btnNavWrite.addEventListener('click', () => switchView('write'));
    btnNavWall.addEventListener('click', () => switchView('wall'));

    if (brandHome) {
      brandHome.addEventListener('click', () => switchView('write'));
    }

    if (btnLinkToWall) {
      btnLinkToWall.addEventListener('click', () => switchView('wall', true));
    }

    if (btnBackToWrite) {
      btnBackToWrite.addEventListener('click', () => switchView('write'));
    }

    if (btnGotoWall) {
      btnGotoWall.addEventListener('click', () => switchView('wall', true));
    }

    if (btnEmptyWrite) {
      btnEmptyWrite.addEventListener('click', () => switchView('write'));
    }

    if (btnRewrite) {
      btnRewrite.addEventListener('click', () => {
        localStorage.removeItem(STORAGE_KEY);
        formContainer.style.display = 'block';
        alreadySubmittedView.style.display = 'none';
        wishInput.value = '';
        charCount.textContent = '0';
        wishInput.focus();
      });
    }
  }

  // ─── LocalStorage: One Wish Per Person ──────────────────────
  function checkExistingSubmission() {
    const savedWish = localStorage.getItem(STORAGE_KEY);
    if (savedWish && savedWish.trim()) {
      formContainer.style.display = 'none';
      alreadySubmittedView.style.display = 'block';
      userSubmittedContent.textContent = `“${savedWish.trim()}”`;
    } else {
      formContainer.style.display = 'block';
      alreadySubmittedView.style.display = 'none';
    }
  }

  // ─── Input & Submission ─────────────────────────────────────
  function setupInputEvents() {
    wishInput.addEventListener('input', () => {
      const len = wishInput.value.length;
      charCount.textContent = len;
      if (len > 450) {
        charCount.style.color = 'var(--color-burgundy)';
      } else {
        charCount.style.color = '';
      }
    });

    btnSubmit.addEventListener('click', handleSubmit);

    wishInput.addEventListener('keydown', (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
        e.preventDefault();
        handleSubmit();
      }
    });
  }

  async function handleSubmit() {
    if (isSubmitting) return;

    const content = wishInput.value.trim();

    if (!content) {
      showAlert('Vui lòng viết lời chúc hoặc tâm tư bạn muốn trao gửi tới thầy cô.', 'error');
      wishInput.focus();
      return;
    }

    if (content.length < 2) {
      showAlert('Lời tri ân cần ít nhất 2 ký tự.', 'error');
      return;
    }

    if (content.length > 500) {
      showAlert('Lời tri ân tối đa 500 ký tự.', 'error');
      return;
    }

    setSubmitting(true);

    try {
      const response = await fetch('/api/wishes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content })
      });

      const data = await response.json();

      if (data.success) {
        // Save to localStorage
        localStorage.setItem(STORAGE_KEY, content);

        showAlert(data.message || 'Lời yêu thương của bạn đã được trao gửi thành công!', 'success');

        // Update local submission view
        userSubmittedContent.textContent = `“${content}”`;

        // Smooth transition to Whiteboard Wall
        setTimeout(() => {
          formContainer.style.display = 'none';
          alreadySubmittedView.style.display = 'block';
          submitAlert.style.display = 'none';
          switchView('wall', true);
        }, 1200);

      } else {
        showAlert(data.error || 'Có lỗi xảy ra, vui lòng thử lại.', 'error');
      }
    } catch (err) {
      console.error('Submit error:', err);
      showAlert('Không thể gửi lời chúc. Vui lòng kiểm tra lại kết nối mạng.', 'error');
    } finally {
      setSubmitting(false);
    }
  }

  function setSubmitting(loading) {
    isSubmitting = loading;
    btnSubmit.disabled = loading;
    const caption = btnSubmit.querySelector('.btn-caption');
    if (caption) {
      caption.textContent = loading ? 'ĐANG TRAO GỬI...' : 'GỬI LỜI YÊU THƯƠNG';
    }
  }

  function showAlert(msg, type) {
    submitAlert.textContent = msg;
    submitAlert.className = `status-alert ${type}`;
    submitAlert.style.display = 'block';

    clearTimeout(showAlert._timer);
    showAlert._timer = setTimeout(() => {
      submitAlert.style.display = 'none';
    }, 6000);
  }

  // ─── Socket.IO Real-time Synchronization ────────────────────
  function setupSocket() {
    try {
      socket = io({
        transports: ['websocket', 'polling'],
        reconnection: true,
        reconnectionDelay: 1000
      });

      socket.on('connect', () => {
        console.log('✨ Connected to Classroom Whiteboard');
      });

      socket.on('wish:new', (data) => {
        handleRealtimeNew(data.wish, data.stats);
      });

      socket.on('wish:updated', (data) => {
        handleRealtimeUpdated(data.wish, data.stats);
      });

    } catch (err) {
      console.warn('Socket initialize error:', err);
    }
  }

  function handleRealtimeNew(wish, stats) {
    wishes.push(wish);
    if (stats && typeof stats.totalSends === 'number') {
      updateTotalCount(stats.totalSends);
    }
    renderWhiteboardWishes();
  }

  function handleRealtimeUpdated(wish, stats) {
    const idx = wishes.findIndex(w => w.id === wish.id);
    if (idx >= 0) {
      wishes[idx] = wish;
    } else {
      wishes.push(wish);
    }

    if (stats && typeof stats.totalSends === 'number') {
      updateTotalCount(stats.totalSends);
    }

    // Direct DOM element update with marker write pulse
    const itemEl = document.querySelector(`[data-wish-id="${wish.id}"]`);
    if (itemEl) {
      const newTier = getTierClass(wish.count);
      itemEl.className = itemEl.className.replace(/tier-\d/, newTier);
      itemEl.dataset.count = wish.count;

      itemEl.classList.remove('marker-pulse');
      void itemEl.offsetWidth; // Trigger reflow
      itemEl.classList.add('marker-pulse');
    } else {
      renderWhiteboardWishes();
    }
  }

  // ─── Fetch Initial Data ─────────────────────────────────────
  async function fetchInitialData() {
    try {
      const res = await fetch('/api/wishes');
      const data = await res.json();

      if (data.success) {
        wishes = data.wishes || [];
        const sends = data.stats ? data.stats.totalSends : wishes.reduce((s, w) => s + w.count, 0);
        updateTotalCount(sends);
        renderWhiteboardWishes();
      }
    } catch (err) {
      console.error('Fetch wishes error:', err);
    }
  }

  // ─── Render Whiteboard Wishes (Aesthetic Random Scatter) ─────
  function renderWhiteboardWishes() {
    if (!boardScatterStage) return;

    if (!wishes || wishes.length === 0) {
      boardScatterStage.innerHTML = '';
      boardScatterStage.appendChild(boardEmptyState);
      boardEmptyState.style.display = 'block';
      return;
    }

    boardEmptyState.style.display = 'none';

    // Sort strategically:
    // Top wishes (high count) appear prominently, intermingled naturally with other wishes
    const sorted = [...wishes].sort((a, b) => {
      if (b.count !== a.count) return b.count - a.count;
      return new Date(b.updated_at) - new Date(a.updated_at);
    });

    const userWishContent = (localStorage.getItem(STORAGE_KEY) || '').trim().toLowerCase();

    boardScatterStage.innerHTML = '';

    const MARKER_COLORS = [
      'marker-blue',
      'marker-black',
      'marker-red',
      'marker-green',
      'marker-purple',
      'marker-amber'
    ];

    // Aesthetic jitter angles (degrees)
    const JITTER_ANGLES = [-2.8, 1.6, -1.2, 2.4, -0.8, 2.9, -2.1, 1.2, -3.2, 0.9];
    const WISH_ICONS = ['🌻', '🌸', '🪶', '📖', '🎓', '🕊️', '🌿', '💐', '🕯️', '📜'];

    sorted.forEach((w, index) => {
      const el = document.createElement('div');
      const hash = hashString(w.content + w.id);

      const tierClass = getTierClass(w.count);
      const markerColor = MARKER_COLORS[hash % MARKER_COLORS.length];
      const angle = JITTER_ANGLES[hash % JITTER_ANGLES.length];
      const icon = WISH_ICONS[hash % WISH_ICONS.length];

      el.className = `wb-wish-card ${tierClass} ${markerColor}`;
      el.dataset.wishId = w.id;
      el.dataset.count = w.count;

      // Apply organic rotation for real handwritten whiteboard feel
      if (window.innerWidth > 768) {
        el.style.transform = `rotate(${angle}deg)`;
      }

      // Decorative frame, icon, leaf, and text
      el.innerHTML = `
        <div class="card-inner-frame">
          <div class="card-deco-bar">
            <span class="card-icon" title="20/11">${icon}</span>
            <span class="card-leaf" aria-hidden="true">🌿</span>
          </div>
          <div class="card-content-text">${escapeHTML(w.content)}</div>
          <span class="card-floral-stamp" aria-hidden="true">❦</span>
        </div>
      `;

      // Highlight if current user's submission
      if (userWishContent && w.normalized === userWishContent) {
        el.classList.add('user-authored');
      }

      boardScatterStage.appendChild(el);
    });
  }

  function escapeHTML(str) {
    return String(str).replace(/[&<>'"]/g, 
      tag => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[tag] || tag)
    );
  }

  /*
   * Tier Scaling based on counts:
   * Tier 1: 1 count (~17px)
   * Tier 2: 2 - 3 counts (~21px)
   * Tier 3: 4 - 6 counts (~26px)
   * Tier 4: 7 - 12 counts (~33px)
   * Tier 5: 13+ counts (~40-44px, grand presence)
   */
  function getTierClass(count) {
    if (count <= 1) return 'tier-1';
    if (count <= 3) return 'tier-2';
    if (count <= 6) return 'tier-3';
    if (count <= 12) return 'tier-4';
    return 'tier-5';
  }

  function hashString(str) {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      hash = ((hash << 5) - hash) + str.charCodeAt(i);
      hash |= 0;
    }
    return Math.abs(hash);
  }

  // ─── Single Unified Total Counter Animation ─────────────────
  function updateTotalCount(newTotal) {
    totalSends = newTotal;
    animateCounter(globalTotalCount, newTotal);
    animateCounter(wallTotalCount, newTotal);
  }

  function animateCounter(el, target) {
    if (!el) return;
    const current = parseInt(el.textContent.replace(/[^0-9]/g, '')) || 0;
    if (current === target) {
      el.textContent = target.toLocaleString('vi-VN');
      return;
    }

    const duration = 500;
    const startTime = performance.now();

    function step(now) {
      const elapsed = now - startTime;
      const progress = Math.min(elapsed / duration, 1);
      const ease = 1 - Math.pow(1 - progress, 3);
      const currentVal = Math.round(current + (target - current) * ease);
      el.textContent = currentVal.toLocaleString('vi-VN');

      if (progress < 1) {
        requestAnimationFrame(step);
      }
    }

    requestAnimationFrame(step);
  }

  // ─── Ambient Canvas Particles (Gentle Warm Golden Dust) ──────
  function initAmbientCanvas() {
    const canvas = document.getElementById('ambient-canvas');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');

    let width = (canvas.width = window.innerWidth);
    let height = (canvas.height = window.innerHeight);

    window.addEventListener('resize', () => {
      width = canvas.width = window.innerWidth;
      height = canvas.height = window.innerHeight;
    });

    const particles = [];
    const count = Math.min(Math.floor(width / 35), 45);

    for (let i = 0; i < count; i++) {
      particles.push({
        x: Math.random() * width,
        y: Math.random() * height,
        radius: Math.random() * 2 + 0.8,
        alpha: Math.random() * 0.45 + 0.1,
        speedY: -(Math.random() * 0.35 + 0.1),
        speedX: (Math.random() - 0.5) * 0.2
      });
    }

    function render() {
      ctx.clearRect(0, 0, width, height);

      particles.forEach((p) => {
        p.y += p.speedY;
        p.x += p.speedX;

        if (p.y < -10) {
          p.y = height + 10;
          p.x = Math.random() * width;
        }
        if (p.x < -10) p.x = width + 10;
        if (p.x > width + 10) p.x = -10;

        ctx.beginPath();
        ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(197, 160, 89, ${p.alpha})`;
        ctx.fill();
      });

      requestAnimationFrame(render);
    }

    render();
  }

  // ─── Initialize ─────────────────────────────────────────────
  document.addEventListener('DOMContentLoaded', init);

})();
