/* ============================================================
   CASTELIA PLATFORM — ядро (app.js)
   - общий каркас: роутер экранов, загрузка фото, лоадер,
     экран результата, каталог-пикер, помощник fetch
   - режим «Самостоятельно» (редактор масок)
   designer.js и chat.js используют window.CST.*
   ============================================================ */
(function () {
  'use strict';

  const C = window.CST_CATALOG;
  const SERVER_URL = window.CASTELIA_SERVER || '';
  const $ = (id) => document.getElementById(id);

  // ----- слои масок -----
  const LAYER_COLORS = ['rgba(91,217,255,0.35)', 'rgba(255,107,181,0.35)', 'rgba(255,211,74,0.35)'];
  const LAYER_LABELS = ['СЛОЙ 01', 'СЛОЙ 02', 'СЛОЙ 03'];
  const MASK_COLORS_RGB = [[255, 0, 0], [0, 255, 0], [0, 0, 255]];
  const MASK_COLOR_NAMES = ['red', 'green', 'blue'];

  // ===================== общий объект CST =====================
  const CST = window.CST = {
    catalog: C,
    serverUrl: SERVER_URL,
    currentScreen: 'home'
  };

  // ----- ошибки / тост -----
  const errorToast = $('errorToast');
  CST.showError = function (msg) {
    errorToast.textContent = msg;
    errorToast.hidden = false;
    clearTimeout(CST._toastT);
    CST._toastT = setTimeout(() => { errorToast.hidden = true; }, 4500);
  };

  // ----- fetch helper -----
  CST.api = async function (path, payload, timeoutMs) {
    const controller = new AbortController();
    const t = setTimeout(() => controller.abort(), timeoutMs || 600000);
    try {
      const r = await fetch((SERVER_URL || '') + path, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload), signal: controller.signal
      });
      const data = await r.json().catch(() => ({}));
      if (!r.ok || (data && data.error)) throw new Error((data && data.error) || `Ошибка сервера (${r.status})`);
      return data;
    } finally { clearTimeout(t); }
  };

  // ----- фото → dataURL + размеры (ресайз до 1280) -----
  CST.fileToImage = function (file) {
    return new Promise((resolve, reject) => {
      if (!/^image\//i.test(file.type) && !/\.(heic|heif)$/i.test(file.name || '')) {
        reject(new Error('Поддерживаются только изображения')); return;
      }
      const reader = new FileReader();
      reader.onload = () => {
        const img = new Image();
        img.onload = () => {
          const maxDim = 1280;
          let w = img.naturalWidth, h = img.naturalHeight;
          if (w > maxDim || h > maxDim) { const r = Math.min(maxDim / w, maxDim / h); w = Math.round(w * r); h = Math.round(h * r); }
          const c = document.createElement('canvas'); c.width = w; c.height = h;
          c.getContext('2d').drawImage(img, 0, 0, w, h);
          resolve({ dataUrl: c.toDataURL('image/jpeg', 0.9), w, h });
        };
        img.onerror = () => reject(new Error('Не удалось прочитать изображение'));
        img.src = reader.result;
      };
      reader.onerror = () => reject(new Error('Ошибка чтения файла'));
      reader.readAsDataURL(file);
    });
  };
  // dataURL → {mime, base64} (для чата)
  CST.splitDataUrl = function (dataUrl) {
    const m = /^data:([^;]+);base64,(.*)$/.exec(dataUrl || '');
    return m ? { mime: m[1], base64: m[2] } : null;
  };

  // ===================== роутер экранов =====================
  const SCREENS = ['home', 'self', 'designer', 'chat', 'result'];
  const backBtn = $('backBtn');
  let backTarget = 'home';

  CST.show = function (name, opts) {
    opts = opts || {};
    CST.currentScreen = name;
    SCREENS.forEach((s) => { const el = $('screen-' + s); if (el) el.hidden = (s !== name); });
    backBtn.hidden = (name === 'home');
    backTarget = opts.backTo || 'home';
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };
  backBtn.addEventListener('click', () => {
    if (backTarget === 'home') CST.goHome();
    else CST.show(backTarget);
  });
  $('logoHome').addEventListener('click', () => CST.goHome());

  CST.goHome = function () { CST.show('home'); };

  // ===================== лоадер (общий) =====================
  const loadingOverlay = $('loadingOverlay');
  const progressBar = $('progressBar');
  const loaderStage = $('loaderStage');
  const loaderTipText = $('loaderTipText');
  const TIPS = [
    'Сервис анализирует геометрию помещения и понимает где реально есть стены',
    'Гибкий камень в 5 раз тоньше плитки и в 3 раза легче',
    'Тёплые тона визуально расширяют пространство, холодные — успокаивают',
    'Мрамор Bianco Carrara использовали ещё в Древнем Риме',
    'Бежевый + тёплый дуб — классическая итальянская гамма',
    'Тёплый красный кирпич идеален для индустриального лофта',
    'Один материал при разном свете воспринимается на 30–40% иначе',
    'У Castelia 15 коллекций: мрамор, травертин, бетон, дерево, кирпич, металл…',
    'Получается отлично — материал уже ложится на стены…',
    'Финализируем тени и свет для реалистичной картины',
    'Контрастные материалы создают акценты — не более трёх на зону'
  ];
  const STAGES = ['Анализ фото', 'Распознавание границ', 'Применение материалов', 'Финальная обработка'];
  let loaderTimers = [], loaderTipInterval = null;

  CST.showLoading = function () {
    loadingOverlay.hidden = false;
    progressBar.style.width = '0%';
    const steps = [
      { at: 0, pct: 8, text: STAGES[0] }, { at: 4000, pct: 30, text: STAGES[1] },
      { at: 10000, pct: 60, text: STAGES[2] }, { at: 25000, pct: 85, text: STAGES[3] }
    ];
    CST.stopLoading(true);
    steps.forEach((s) => loaderTimers.push(setTimeout(() => { progressBar.style.width = s.pct + '%'; loaderStage.textContent = s.text; }, s.at)));
    let i = Math.floor(Math.random() * TIPS.length);
    loaderTipText.textContent = TIPS[i];
    loaderTipInterval = setInterval(() => {
      loaderTipText.style.opacity = '0';
      setTimeout(() => { i = (i + 1) % TIPS.length; loaderTipText.textContent = TIPS[i]; loaderTipText.style.opacity = '1'; }, 300);
    }, 6000);
  };
  CST.stopLoading = function (keepVisible) {
    loaderTimers.forEach(clearTimeout); loaderTimers = [];
    if (loaderTipInterval) { clearInterval(loaderTipInterval); loaderTipInterval = null; }
    if (!keepVisible) loadingOverlay.hidden = true;
  };

  // ===================== экран результата (общий) =====================
  const resultImage = $('resultImage');
  const resultEyebrow = $('resultEyebrow');
  const resultSub = $('resultSub');
  const touchupBtn = $('touchupBtn');
  const resultAgainBtn = $('resultAgainBtn');
  const downloadBtn = $('downloadBtn');
  let resultHandlers = {};

  // showResult(url, { eyebrow, sub, againLabel, onAgain, allowTouchup, onTouchup })
  CST.showResult = function (url, o) {
    o = o || {};
    CST.stopLoading();
    resultImage.src = url;
    resultEyebrow.textContent = o.eyebrow || '✦ Готово';
    resultSub.textContent = o.sub || 'Так гибкий камень Castelia смотрится на ваших стенах.';
    resultAgainBtn.querySelector ? null : null;
    resultAgainBtn.textContent = o.againLabel || '↻ Другой вариант';
    touchupBtn.hidden = !o.allowTouchup;
    resultHandlers = o;
    CST.show('result', { backTo: o.backTo || 'home' });
  };
  resultAgainBtn.addEventListener('click', () => { if (resultHandlers.onAgain) resultHandlers.onAgain(); else CST.goHome(); });
  touchupBtn.addEventListener('click', () => { if (resultHandlers.onTouchup) resultHandlers.onTouchup(); });
  downloadBtn.addEventListener('click', () => {
    const a = document.createElement('a'); a.href = resultImage.src; a.download = 'castelia-design.png';
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
  });

  // ===================== каталог-пикер (общий) =====================
  const picker = $('materialPicker');
  const pickerEyebrow = $('pickerEyebrow');
  const pickerTitle = $('pickerTitle');
  const pickerGrid = $('pickerGrid');
  const pickerFilters = $('pickerFilters');
  let pickerState = null;

  const COLLECTIONS = [...new Set(C.MATERIALS.map((m) => m.collection))];
  // флагманская коллекция, которая открыта по умолчанию (крупная — 8 материалов)
  const DEFAULT_COLLECTION = COLLECTIONS.includes('Marble') ? 'Marble' : COLLECTIONS[0];

  // openPicker({ title, eyebrow, disabledIds:{id:badge}, selectedIds:[], onPick(material) })
  CST.openPicker = function (cfg) {
    pickerState = Object.assign({ filter: DEFAULT_COLLECTION, disabledIds: {}, selectedIds: [] }, cfg);
    pickerEyebrow.textContent = cfg.eyebrow || 'КАТАЛОГ CASTELIA';
    pickerTitle.textContent = cfg.title || 'Выберите материал';
    renderPickerFilters();
    renderPickerGrid();
    picker.hidden = false;
  };
  CST.closePicker = function () { picker.hidden = true; pickerState = null; };

  function renderPickerFilters() {
    pickerFilters.innerHTML = '';
    const mk = (key, label) => {
      const b = document.createElement('button');
      b.className = 'ms_chip' + (pickerState.filter === key ? ' ms_on' : '');
      b.textContent = label;
      b.addEventListener('click', () => { pickerState.filter = key; renderPickerFilters(); renderPickerGrid(); pickerGrid.scrollTop = 0; });
      pickerFilters.appendChild(b);
    };
    // только коллекции — листаешь чипы, материалы коллекции показываются крупными квадратами
    COLLECTIONS.forEach((c) => mk(c, c));
  }
  function renderPickerGrid() {
    pickerGrid.innerHTML = '';
    const list = C.MATERIALS.filter((m) => m.collection === pickerState.filter);
    list.forEach((m) => {
      const disabledBadge = pickerState.disabledIds[m.id];
      const isSel = pickerState.selectedIds.indexOf(m.id) >= 0;
      const card = document.createElement('div');
      card.className = 'ms_picker_card' + (disabledBadge ? ' ms_disabled' : '') + (isSel ? ' ms_assigned' : '');
      const img = document.createElement('img'); img.src = m.imageUrl; img.alt = m.name; img.loading = 'lazy';
      card.appendChild(img);
      const name = document.createElement('div'); name.className = 'ms_picker_card_name'; name.textContent = m.name;
      card.appendChild(name);
      if (disabledBadge) { const b = document.createElement('div'); b.className = 'ms_picker_card_badge'; b.textContent = disabledBadge; card.appendChild(b); }
      card.addEventListener('click', () => {
        if (disabledBadge) { CST.showError(`Уже выбран (${disabledBadge})`); return; }
        if (pickerState.onPick) pickerState.onPick(m);
      });
      pickerGrid.appendChild(card);
    });
  }
  $('pickerClose').addEventListener('click', CST.closePicker);
  picker.addEventListener('click', (e) => { if (e.target === picker) CST.closePicker(); });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && !picker.hidden) CST.closePicker(); });

  // ============================================================
  //  РЕЖИМ «САМОСТОЯТЕЛЬНО» — редактор масок
  // ============================================================
  const self = {
    sub: $('selfSub'),
    dropZone: $('dropZone'), fileInput: $('fileInput'), camInput: $('camInput'),
    pickFileBtn: $('pickFileBtn'), pickCamBtn: $('pickCamBtn'),
    canvasStack: $('canvasStack'), baseCanvas: $('baseCanvas'),
    maskCanvases: [$('maskCanvas1'), $('maskCanvas2'), $('maskCanvas3')],
    slotsRow: $('slotsRow'), toolsRow: $('toolsRow'),
    brushSize: $('brushSize'), brushPreview: $('brushPreview'),
    toolBrush: $('toolBrush'), toolEraser: $('toolEraser'), toolUndo: $('toolUndo'), toolClear: $('toolClear'),
    autoBtn: $('selfAutoBtn'), generateBtn: $('generateBtn')
  };

  const sstate = {
    sub: 'empty', // 'empty' | 'editor'
    baseImage: null,
    layers: [{ material: null, hasPaint: false }, { material: null, hasPaint: false }, { material: null, hasPaint: false }],
    activeLayer: 0, brushSize: 35, tool: 'brush',
    masks: [null, null, null], history: [[], [], []], historyIndex: [-1, -1, -1],
    touchupMode: false, lastResultUrl: null
  };
  let cachedBaseImg = null, canvasBound = false, baseObserver = null;

  CST.enterSelf = function () {
    selfReset();
    CST.show('self');
    requestAnimationFrame(() => { if (sstate.sub === 'editor') positionMasks(); });
  };

  function setSelfSub() {
    if (sstate.sub === 'empty') self.sub.textContent = 'Загрузите фото, выберите до 3 материалов и закрасьте на фото нужные зоны.';
    else self.sub.textContent = 'Кликните слот → выберите материал. Затем кистью отметьте на фото, где он должен быть.';
  }

  function setSelfMode(sub) {
    sstate.sub = sub;
    self.dropZone.hidden = (sub !== 'empty');
    self.canvasStack.hidden = (sub !== 'editor');
    const enabled = (sub === 'editor');
    self.brushSize.disabled = !enabled; self.toolBrush.disabled = !enabled; self.toolEraser.disabled = !enabled;
    self.toolUndo.disabled = !enabled; self.toolClear.disabled = !enabled;
    if (enabled) updateGenerateBtn(); else { self.generateBtn.disabled = true; self.autoBtn.disabled = true; }
    setSelfSub();
    renderSlots();
  }

  // ----- слоты -----
  function renderSlots() {
    self.slotsRow.innerHTML = '';
    const locked = (sstate.sub === 'empty');
    sstate.layers.forEach((layer, idx) => {
      const div = document.createElement('div');
      div.className = 'ms_slot' + (locked ? ' ms_locked' : '') + (!locked && idx === sstate.activeLayer ? ' ms_active' : '');
      div.addEventListener('click', (e) => {
        if (e.target.closest('.ms_slot_remove')) return;
        if (locked) { CST.showError('Сначала загрузите фото'); return; }
        if (layer.material) setActiveLayer(idx); else openSlotPicker(idx);
      });
      const colorBar = document.createElement('span'); colorBar.className = 'ms_slot_color'; colorBar.style.background = LAYER_COLORS[idx];
      div.appendChild(colorBar);
      let visual;
      if (locked) { visual = document.createElement('div'); visual.className = 'ms_slot_visual ms_slot_lock'; visual.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>'; }
      else if (layer.material) { visual = document.createElement('img'); visual.className = 'ms_slot_thumb'; visual.src = layer.material.imageUrl; visual.alt = layer.material.name; }
      else { visual = document.createElement('div'); visual.className = 'ms_slot_visual ms_slot_placeholder'; visual.textContent = '+'; }
      div.appendChild(visual);
      const meta = document.createElement('div'); meta.className = 'ms_slot_meta';
      const nameTxt = locked ? 'Заблокировано' : (layer.material ? layer.material.name : 'Выбрать материал');
      const statusHtml = locked ? '<div class="ms_slot_status ms_off">загрузите фото</div>'
        : (layer.material ? `<div class="ms_slot_status ${layer.hasPaint ? '' : 'ms_off'}">${layer.hasPaint ? '● закрашено' : '○ не закрашено'}</div>`
          : '<div class="ms_slot_status ms_off">кликните чтобы выбрать</div>');
      meta.innerHTML = `<div class="ms_slot_label">${LAYER_LABELS[idx]}</div>` +
        `<div class="ms_slot_name ${(!layer.material || locked) ? 'ms_dim' : ''}">${nameTxt}</div>` + statusHtml;
      div.appendChild(meta);
      if (!locked && layer.material) {
        const remove = document.createElement('button'); remove.className = 'ms_slot_remove'; remove.textContent = '×'; remove.title = 'Убрать материал';
        remove.addEventListener('click', (e) => { e.stopPropagation(); layer.material = null; clearLayer(idx); renderSlots(); updateGenerateBtn(); });
        div.appendChild(remove);
      }
      self.slotsRow.appendChild(div);
    });
  }
  function setActiveLayer(idx) {
    sstate.activeLayer = idx;
    self.maskCanvases.forEach((c, i) => c.classList.toggle('ms_active', i === idx));
    renderSlots(); updateGenerateBtn(); requestAnimationFrame(positionMasks);
  }
  function assignedLayerOf(id) { for (let i = 0; i < sstate.layers.length; i++) if (sstate.layers[i].material && sstate.layers[i].material.id === id) return i; return -1; }
  function openSlotPicker(layerIdx) {
    const disabled = {};
    sstate.layers.forEach((l, i) => { if (l.material && i !== layerIdx) disabled[l.material.id] = `Слой ${i + 1}`; });
    CST.openPicker({
      eyebrow: LAYER_LABELS[layerIdx], title: 'Выберите материал',
      disabledIds: disabled,
      selectedIds: sstate.layers[layerIdx].material ? [sstate.layers[layerIdx].material.id] : [],
      onPick: (m) => { sstate.layers[layerIdx].material = m; CST.closePicker(); setActiveLayer(layerIdx); updateGenerateBtn(); }
    });
  }

  // ----- загрузка фото -----
  function setupUpload() {
    self.pickFileBtn.addEventListener('click', (e) => { e.stopPropagation(); self.fileInput.click(); });
    self.pickCamBtn.addEventListener('click', (e) => { e.stopPropagation(); self.camInput.click(); });
    self.dropZone.addEventListener('click', (e) => { if (e.target.closest('button')) return; self.fileInput.click(); });
    self.fileInput.addEventListener('change', (e) => { const f = e.target.files && e.target.files[0]; if (f) handleSelfFile(f); });
    self.camInput.addEventListener('change', (e) => { const f = e.target.files && e.target.files[0]; if (f) handleSelfFile(f); });
    self.dropZone.addEventListener('dragover', (e) => { e.preventDefault(); self.dropZone.classList.add('ms_hover'); });
    self.dropZone.addEventListener('dragleave', () => self.dropZone.classList.remove('ms_hover'));
    self.dropZone.addEventListener('drop', (e) => { e.preventDefault(); self.dropZone.classList.remove('ms_hover'); const f = e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files[0]; if (f) handleSelfFile(f); });
  }
  async function handleSelfFile(file) {
    try { const img = await CST.fileToImage(file); sstate.baseImage = img; cachedBaseImg = null; enterEditor(); }
    catch (e) { CST.showError(e.message || 'Не удалось загрузить фото'); }
  }

  // ----- редактор -----
  function enterEditor() { setSelfMode('editor'); setupCanvas(); updateBrushPreview(); setActiveLayer(0); }

  function setupCanvas() {
    const { w, h, dataUrl } = sstate.baseImage;
    self.baseCanvas.width = w; self.baseCanvas.height = h;
    self.maskCanvases.forEach((c) => { c.width = w; c.height = h; });
    sstate.masks = self.maskCanvases;
    sstate.masks.forEach((c, i) => { c.getContext('2d').clearRect(0, 0, w, h); sstate.history[i] = []; sstate.historyIndex[i] = -1; });
    if (cachedBaseImg && cachedBaseImg.src === dataUrl && cachedBaseImg.complete && cachedBaseImg.naturalWidth > 0) drawBaseAndPosition();
    else { cachedBaseImg = new Image(); cachedBaseImg.onload = drawBaseAndPosition; cachedBaseImg.onerror = () => CST.showError('Не удалось отобразить фото'); cachedBaseImg.src = dataUrl; }
    bindCanvasDrawing(); observeBaseCanvas();
  }
  function drawBaseAndPosition() {
    if (!sstate.baseImage || !cachedBaseImg) return;
    const { w, h } = sstate.baseImage;
    self.baseCanvas.getContext('2d').drawImage(cachedBaseImg, 0, 0, w, h);
    requestAnimationFrame(positionMasks);
  }
  function positionMasks() {
    const rect = self.baseCanvas.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) return;
    self.maskCanvases.forEach((c) => { c.style.width = rect.width + 'px'; c.style.height = rect.height + 'px'; });
  }
  window.addEventListener('resize', () => { if (CST.currentScreen === 'self' && sstate.sub === 'editor') positionMasks(); });
  function observeBaseCanvas() {
    if (baseObserver || typeof ResizeObserver === 'undefined') return;
    baseObserver = new ResizeObserver(() => positionMasks()); baseObserver.observe(self.baseCanvas);
  }

  function bindCanvasDrawing() {
    if (canvasBound) return; canvasBound = true;
    let drawing = false, lastX = 0, lastY = 0;
    const toCanvas = (canvas, e) => { const rect = canvas.getBoundingClientRect(); const p = (e.touches && e.touches[0]) || e; return { x: (p.clientX - rect.left) / rect.width * canvas.width, y: (p.clientY - rect.top) / rect.height * canvas.height }; };
    const activeCanvas = () => sstate.masks[sstate.activeLayer];
    function start(e) {
      if (sstate.sub !== 'editor') return;
      if (!sstate.layers[sstate.activeLayer].material) { CST.showError('Сначала выберите материал для этого слоя'); return; }
      e.preventDefault(); drawing = true; const p = toCanvas(activeCanvas(), e); lastX = p.x; lastY = p.y; drawDot(activeCanvas(), p.x, p.y);
    }
    function move(e) { if (!drawing) return; e.preventDefault(); const p = toCanvas(activeCanvas(), e); drawLine(activeCanvas(), lastX, lastY, p.x, p.y); lastX = p.x; lastY = p.y; }
    function end() { if (!drawing) return; drawing = false; saveHistory(sstate.activeLayer); sstate.layers[sstate.activeLayer].hasPaint = layerHasContent(sstate.activeLayer); renderSlots(); updateGenerateBtn(); }
    self.maskCanvases.forEach((c) => { c.addEventListener('mousedown', start); c.addEventListener('touchstart', start, { passive: false }); });
    window.addEventListener('mousemove', move); window.addEventListener('touchmove', move, { passive: false });
    window.addEventListener('mouseup', end); window.addEventListener('touchend', end);
  }
  function drawDot(canvas, x, y) {
    const ctx = canvas.getContext('2d'); const r = sstate.brushSize / 2;
    if (sstate.tool === 'eraser') { ctx.save(); ctx.globalCompositeOperation = 'destination-out'; ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill(); ctx.restore(); }
    else { ctx.fillStyle = LAYER_COLORS[sstate.activeLayer]; ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill(); }
  }
  function drawLine(canvas, x1, y1, x2, y2) {
    const ctx = canvas.getContext('2d'); ctx.lineWidth = sstate.brushSize; ctx.lineCap = 'round';
    if (sstate.tool === 'eraser') { ctx.save(); ctx.globalCompositeOperation = 'destination-out'; ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke(); ctx.restore(); }
    else { ctx.strokeStyle = LAYER_COLORS[sstate.activeLayer]; ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke(); }
  }
  function layerHasContent(idx) { const c = sstate.masks[idx]; if (!c) return false; const d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data; for (let i = 3; i < d.length; i += 4) if (d[i] > 0) return true; return false; }
  function saveHistory(idx) { const c = sstate.masks[idx]; if (!c) return; const snap = c.getContext('2d').getImageData(0, 0, c.width, c.height); const stack = sstate.history[idx]; stack.splice(sstate.historyIndex[idx] + 1); stack.push(snap); if (stack.length > 20) stack.shift(); sstate.historyIndex[idx] = stack.length - 1; }
  function undoLayer(idx) {
    const stack = sstate.history[idx]; if (sstate.historyIndex[idx] < 0) return;
    sstate.historyIndex[idx]--; const ctx = sstate.masks[idx].getContext('2d');
    if (sstate.historyIndex[idx] < 0) ctx.clearRect(0, 0, sstate.masks[idx].width, sstate.masks[idx].height);
    else ctx.putImageData(stack[sstate.historyIndex[idx]], 0, 0);
    sstate.layers[idx].hasPaint = layerHasContent(idx); renderSlots(); updateGenerateBtn();
  }
  function clearLayer(idx) { const c = sstate.masks[idx]; if (!c) return; c.getContext('2d').clearRect(0, 0, c.width, c.height); saveHistory(idx); sstate.layers[idx].hasPaint = false; }

  // ----- тулбар -----
  function setupToolbar() {
    self.brushSize.addEventListener('input', (e) => { sstate.brushSize = parseInt(e.target.value, 10); updateBrushPreview(); });
    self.toolBrush.addEventListener('click', () => setTool('brush'));
    self.toolEraser.addEventListener('click', () => setTool('eraser'));
    self.toolUndo.addEventListener('click', () => undoLayer(sstate.activeLayer));
    self.toolClear.addEventListener('click', () => { if (sstate.layers[sstate.activeLayer].hasPaint && confirm('Очистить текущий слой?')) { clearLayer(sstate.activeLayer); renderSlots(); updateGenerateBtn(); } });
  }
  function setTool(t) { sstate.tool = t; self.toolBrush.setAttribute('data-active', t === 'brush'); self.toolEraser.setAttribute('data-active', t === 'eraser'); }
  function updateBrushPreview() { const s = Math.max(6, Math.min(28, sstate.brushSize / 3)); self.brushPreview.style.width = s + 'px'; self.brushPreview.style.height = s + 'px'; }
  function updateGenerateBtn() {
    if (sstate.sub !== 'editor') { self.generateBtn.disabled = true; self.autoBtn.disabled = true; return; }
    self.generateBtn.disabled = !sstate.layers.some((l) => l.material && l.hasPaint);
    self.autoBtn.disabled = !sstate.layers.some((l) => l.material);
  }

  // ----- combined mask -----
  function buildCombinedMask(specs) {
    const w = sstate.baseImage.w, h = sstate.baseImage.h;
    const out = document.createElement('canvas'); out.width = w; out.height = h;
    const ctx = out.getContext('2d'); ctx.fillStyle = '#000000'; ctx.fillRect(0, 0, w, h);
    const outImg = ctx.getImageData(0, 0, w, h); const od = outImg.data;
    specs.forEach((spec) => {
      const sd = sstate.masks[spec.layerIdx].getContext('2d').getImageData(0, 0, w, h).data;
      const [r, g, b] = MASK_COLORS_RGB[spec.materialOrder];
      for (let i = 0; i < sd.length; i += 4) { if (sd[i + 3] > 16) { od[i] = r; od[i + 1] = g; od[i + 2] = b; od[i + 3] = 255; } }
    });
    ctx.putImageData(outImg, 0, 0); return out.toDataURL('image/png');
  }

  // ----- генерация по маскам -----
  function startGeneration() {
    const active = sstate.layers.map((l, i) => ({ layer: l, idx: i })).filter((x) => x.layer.material && x.layer.hasPaint);
    if (active.length === 0) { CST.showError('Нужен хотя бы один материал с закрашенной областью'); return; }
    if (sstate.touchupMode) { startTouchup(active[0]); return; }
    CST.showLoading();
    const specs = active.map((x, n) => ({ layerIdx: x.idx, materialOrder: n, colorName: MASK_COLOR_NAMES[n], materialUrl: x.layer.material.imageUrl, materialName: x.layer.material.name }));
    const payload = {
      baseImage: sstate.baseImage.dataUrl, baseWidth: sstate.baseImage.w, baseHeight: sstate.baseImage.h,
      combinedMaskImage: buildCombinedMask(specs),
      materials: specs.map((s) => ({ materialUrl: s.materialUrl, materialName: s.materialName, colorName: s.colorName }))
    };
    CST.api('/api/generate-masked', payload)
      .then((d) => { if (!d.resultDataUrl) throw new Error('Пустой ответ'); selfShowResult(d.resultDataUrl); })
      .catch((err) => { CST.stopLoading(); CST.showError(err.message || 'Сеть недоступна'); CST.show('self'); requestAnimationFrame(positionMasks); });
  }

  // ----- «дизайнер сам разместит» (без масок) -----
  function startAuto() {
    const mats = sstate.layers.filter((l) => l.material).map((l) => ({ materialUrl: l.material.imageUrl, materialName: l.material.name }));
    if (mats.length === 0) { CST.showError('Выберите хотя бы один материал'); return; }
    CST.showLoading();
    CST.api('/api/generate-auto', { baseImage: sstate.baseImage.dataUrl, baseWidth: sstate.baseImage.w, baseHeight: sstate.baseImage.h, materials: mats })
      .then((d) => { if (!d.resultDataUrl) throw new Error('Пустой ответ'); selfShowResult(d.resultDataUrl); })
      .catch((err) => { CST.stopLoading(); CST.showError(err.message || 'Сеть недоступна'); CST.show('self'); requestAnimationFrame(positionMasks); });
  }

  // ----- touchup -----
  function startTouchup(activeSpec) {
    if (!activeSpec) { CST.showError('Выберите материал и закрасьте зону правки'); return; }
    CST.showLoading();
    const w = sstate.baseImage.w, h = sstate.baseImage.h;
    const out = document.createElement('canvas'); out.width = w; out.height = h;
    const ctx = out.getContext('2d'); ctx.fillStyle = '#000000'; ctx.fillRect(0, 0, w, h);
    const src = sstate.masks[activeSpec.idx].getContext('2d').getImageData(0, 0, w, h).data;
    const outImg = ctx.getImageData(0, 0, w, h); const od = outImg.data;
    for (let i = 0; i < src.length; i += 4) if (src[i + 3] > 16) { od[i] = 255; od[i + 1] = 255; od[i + 2] = 255; od[i + 3] = 255; }
    ctx.putImageData(outImg, 0, 0);
    CST.api('/api/touchup', {
      baseImage: sstate.baseImage.dataUrl, baseWidth: w, baseHeight: h,
      materialUrl: activeSpec.layer.material.imageUrl, materialName: activeSpec.layer.material.name, maskImage: out.toDataURL('image/png')
    }).then((d) => {
      if (!d.resultDataUrl) throw new Error('Пустой ответ');
      sstate.touchupMode = false; const span = self.generateBtn.querySelector('span'); if (span) span.textContent = '✦ Сгенерировать';
      selfShowResult(d.resultDataUrl);
    }).catch((err) => { CST.stopLoading(); CST.showError(err.message || 'Сеть недоступна'); CST.show('self'); requestAnimationFrame(positionMasks); });
  }

  // ----- результат self -----
  function selfShowResult(url) {
    sstate.lastResultUrl = url;
    CST.showResult(url, {
      eyebrow: '✦ Готово', sub: 'Перетащите фото в редактор, чтобы доработать, или скачайте результат.',
      againLabel: '↻ Другие материалы', allowTouchup: true,
      onAgain: () => { // вернуться в редактор с тем же фото, сбросив маски
        sstate.touchupMode = false; const span = self.generateBtn.querySelector('span'); if (span) span.textContent = '✦ Сгенерировать';
        sstate.layers.forEach((l) => { l.hasPaint = false; }); sstate.history = [[], [], []]; sstate.historyIndex = [-1, -1, -1];
        CST.show('self'); setSelfMode('editor'); setupCanvas(); setActiveLayer(0);
      },
      onTouchup: enterTouchup
    });
  }
  function enterTouchup() {
    if (!sstate.lastResultUrl) { CST.showError('Нет результата для правки'); return; }
    const img = new Image();
    img.onload = () => {
      sstate.baseImage = { dataUrl: sstate.lastResultUrl, w: img.naturalWidth, h: img.naturalHeight };
      cachedBaseImg = img;
      sstate.layers.forEach((l) => { l.material = null; l.hasPaint = false; });
      sstate.history = [[], [], []]; sstate.historyIndex = [-1, -1, -1]; sstate.activeLayer = 0; sstate.touchupMode = true;
      CST.show('self'); setSelfMode('editor'); setupCanvas(); updateBrushPreview(); setActiveLayer(0);
      const span = self.generateBtn.querySelector('span'); if (span) span.textContent = '✦ Применить правку';
      CST.showError('Режим правки: выберите материал и закрасьте только проблемную зону');
    };
    img.onerror = () => CST.showError('Не удалось загрузить результат для правки');
    img.src = sstate.lastResultUrl;
  }

  function selfReset() {
    sstate.baseImage = null;
    sstate.layers.forEach((l) => { l.material = null; l.hasPaint = false; });
    sstate.activeLayer = 0; sstate.history = [[], [], []]; sstate.historyIndex = [-1, -1, -1];
    sstate.touchupMode = false; sstate.lastResultUrl = null; cachedBaseImg = null;
    if (sstate.masks[0]) sstate.masks.forEach((c) => c.getContext && c.getContext('2d').clearRect(0, 0, c.width, c.height));
    const span = self.generateBtn.querySelector('span'); if (span) span.textContent = '✦ Сгенерировать';
    setSelfMode('empty');
  }

  // ============================================================
  //  ПОКАЗ «БЫЛО → СТАЛО» (слайдер на главной)
  // ============================================================
  function setupShowcase() {
    const frame = $('baFrame'), handle = $('baHandle'), after = $('baAfter'), styles = $('baStyles');
    if (!frame || !after) return;
    let dragging = false, demoRAF = null;
    const setPos = (pct) => { pct = Math.max(2, Math.min(98, pct)); frame.style.setProperty('--pos', pct + '%'); };
    const fromEvent = (e) => { const r = frame.getBoundingClientRect(); const x = ((e.touches && e.touches[0]) || e).clientX; return (x - r.left) / r.width * 100; };
    const demoCancel = () => { if (demoRAF) { cancelAnimationFrame(demoRAF); demoRAF = null; } };
    const start = (e) => { dragging = true; demoCancel(); setPos(fromEvent(e)); e.preventDefault(); };
    const move = (e) => { if (!dragging) return; setPos(fromEvent(e)); };
    const end = () => { dragging = false; };
    frame.addEventListener('mousedown', start); window.addEventListener('mousemove', move); window.addEventListener('mouseup', end);
    frame.addEventListener('touchstart', start, { passive: false }); window.addEventListener('touchmove', move, { passive: false }); window.addEventListener('touchend', end);
    if (handle) handle.addEventListener('mousedown', start);

    styles && styles.querySelectorAll('.ms_ba_chip').forEach((ch) => ch.addEventListener('click', () => {
      styles.querySelectorAll('.ms_ba_chip').forEach((c) => c.classList.remove('ms_on')); ch.classList.add('ms_on');
      after.src = ch.getAttribute('data-after');
    }));

    // авто-демо: ползунок сам один раз проезжает, приглашая взаимодействовать
    function runDemo() {
      const seq = [[50, 78], [78, 28], [28, 55]]; let i = 0;
      const step = (pair, t0) => {
        const k = Math.min(1, (performance.now() - t0) / 850);
        const ease = k < 0.5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2;
        setPos(pair[0] + (pair[1] - pair[0]) * ease);
        if (k < 1) demoRAF = requestAnimationFrame(() => step(pair, t0));
        else if (i < seq.length - 1) { i++; demoRAF = requestAnimationFrame(() => step(seq[i], performance.now())); }
      };
      demoRAF = requestAnimationFrame(() => step(seq[0], performance.now()));
    }
    if (after.complete && after.naturalWidth) setTimeout(runDemo, 600);
    else after.addEventListener('load', () => setTimeout(runDemo, 600), { once: true });
  }

  // ============================================================
  //  HOME + INIT
  // ============================================================
  function init() {
    // плитки выбора режима
    document.querySelectorAll('.ms_mode_card').forEach((card) => {
      card.addEventListener('click', () => {
        const mode = card.getAttribute('data-mode');
        if (mode === 'self') CST.enterSelf();
        else if (mode === 'designer' && CST.enterDesigner) CST.enterDesigner();
        else if (mode === 'chat' && CST.enterChat) CST.enterChat();
      });
    });
    setupShowcase();
    // self wiring
    setupUpload(); setupToolbar();
    self.generateBtn.addEventListener('click', startGeneration);
    self.autoBtn.addEventListener('click', startAuto);
    setSelfMode('empty');
    CST.show('home');
  }
  document.addEventListener('DOMContentLoaded', init);
})();
