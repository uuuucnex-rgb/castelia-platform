/* ============================================================
   CASTELIA — режим «Дизайнер интерьера» (5 вопросов)
   Фото → 5 вопросов карточками → ИИ-подбор материалов + совет
   → визуализация на фото (/api/generate-auto).
   ============================================================ */
(function () {
  'use strict';

  const C = window.CST_CATALOG;
  const CST = window.CST;
  const $ = (id) => document.getElementById(id);

  const dzTitle = $('dzTitle');
  const dzSub = $('dzSub');
  const dzProgress = $('dzProgress');
  const dzStage = $('dzStage');

  const QUESTIONS = C.QUESTIONS;

  const st = {
    phase: 'photo',     // 'photo' | 'questions' | 'reco'
    qIndex: 0,
    answers: {},        // { style, room, mood, palette, coverage }
    baseImage: null,    // {dataUrl,w,h}
    reco: null          // { materials, advice, title }
  };

  CST.enterDesigner = function () {
    st.phase = 'photo'; st.qIndex = 0; st.answers = {}; st.baseImage = null; st.reco = null;
    CST.show('designer');
    render();
  };

  function setHead(title, sub) { dzTitle.textContent = title; dzSub.textContent = sub; }

  function renderProgress() {
    dzProgress.innerHTML = '';
    if (st.phase === 'photo') { dzProgress.style.visibility = 'hidden'; return; }
    dzProgress.style.visibility = 'visible';
    const total = QUESTIONS.length;
    const cur = st.phase === 'reco' ? total : st.qIndex;
    for (let i = 0; i < total; i++) {
      const d = document.createElement('div');
      d.className = 'ms_dz_dot' + (i < cur ? ' ms_done' : '') + (i === cur && st.phase === 'questions' ? ' ms_cur' : '');
      dzProgress.appendChild(d);
    }
  }

  function render() {
    renderProgress();
    if (st.phase === 'photo') return renderPhoto();
    if (st.phase === 'questions') return renderQuestion();
    if (st.phase === 'reco') return renderReco();
  }

  // ---------- ШАГ: фото ----------
  function renderPhoto() {
    setHead('Покажите комнату или фасад', 'Загрузите фото комнаты или фасада дома — на нём ИИ-дизайнер и покажет результат. Дальше всего 5 простых вопросов.');
    dzStage.innerHTML = '';
    const drop = document.createElement('div');
    drop.className = 'ms_drop'; drop.style.maxWidth = '560px'; drop.style.margin = '0 auto';
    drop.innerHTML =
      '<div class="ms_drop_icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M12 16V4M12 4l-5 5M12 4l5 5"/><path d="M4 17v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2"/></svg></div>' +
      '<div class="ms_drop_title">Загрузите фото комнаты или фасада</div>' +
      '<div class="ms_drop_sub">Перетащите файл сюда или нажмите для выбора</div>' +
      '<div class="ms_drop_actions">' +
        '<button class="ms_btn ms_btn_gold" id="dzPick">Выбрать файл</button>' +
        '<button class="ms_btn ms_btn_ghost" id="dzCam">📷 Камера</button>' +
      '</div>' +
      '<div class="ms_drop_hint">JPG · PNG · HEIC · до 15 МБ</div>' +
      '<input type="file" id="dzFile" accept="image/*,.heic,.heif" style="display:none">' +
      '<input type="file" id="dzCamFile" accept="image/*,.heic,.heif" capture="environment" style="display:none">';
    dzStage.appendChild(drop);

    const fileInput = $('dzFile'), camInput = $('dzCamFile');
    $('dzPick').addEventListener('click', (e) => { e.stopPropagation(); fileInput.click(); });
    $('dzCam').addEventListener('click', (e) => { e.stopPropagation(); camInput.click(); });
    drop.addEventListener('click', (e) => { if (e.target.closest('button')) return; fileInput.click(); });
    const onFile = async (f) => { try { st.baseImage = await CST.fileToImage(f); st.phase = 'questions'; st.qIndex = 0; render(); } catch (e) { CST.showError(e.message); } };
    fileInput.addEventListener('change', (e) => { const f = e.target.files && e.target.files[0]; if (f) onFile(f); });
    camInput.addEventListener('change', (e) => { const f = e.target.files && e.target.files[0]; if (f) onFile(f); });
    drop.addEventListener('dragover', (e) => { e.preventDefault(); drop.classList.add('ms_hover'); });
    drop.addEventListener('dragleave', () => drop.classList.remove('ms_hover'));
    drop.addEventListener('drop', (e) => { e.preventDefault(); drop.classList.remove('ms_hover'); const f = e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files[0]; if (f) onFile(f); });
  }

  // ---------- ШАГ: вопрос ----------
  function renderQuestion() {
    const q = QUESTIONS[st.qIndex];
    setHead('Несколько простых вопросов', `Вопрос ${st.qIndex + 1} из ${QUESTIONS.length} · нажмите на карточку`);
    dzStage.innerHTML = '';
    const step = document.createElement('div'); step.className = 'ms_dz_step';
    const qhead = document.createElement('div'); qhead.className = 'ms_dz_q';
    qhead.innerHTML = `<h3 class="ms_dz_q_title">${q.title}</h3><p class="ms_dz_q_sub">${q.sub}</p>`;
    step.appendChild(qhead);

    if (q.kind === 'styles') step.appendChild(renderStyleCards());
    else step.appendChild(renderOptionCards(q));

    // навигация
    const nav = document.createElement('div'); nav.className = 'ms_dz_nav';
    const back = document.createElement('button'); back.className = 'ms_btn ms_btn_ghost';
    back.textContent = st.qIndex === 0 ? '← Сменить фото' : '← Назад';
    back.addEventListener('click', () => { if (st.qIndex === 0) { st.phase = 'photo'; } else { st.qIndex--; } render(); });
    const spacer = document.createElement('div');
    nav.appendChild(back); nav.appendChild(spacer);
    step.appendChild(nav);
    dzStage.appendChild(step);
  }

  function renderStyleCards() {
    const grid = document.createElement('div'); grid.className = 'ms_dz_styles';
    C.STYLES.forEach((s) => {
      const sample = C.byId(s.sample);
      const card = document.createElement('div');
      card.className = 'ms_dz_style' + (st.answers.style === s.key ? ' ms_sel' : '');
      card.innerHTML =
        `<img class="ms_dz_style_img" src="${sample ? sample.imageUrl : ''}" alt="${s.label}" loading="lazy">` +
        `<div class="ms_dz_style_body"><div class="ms_dz_style_name">${s.emoji} ${s.label}</div><div class="ms_dz_style_desc">${s.desc}</div></div>`;
      card.addEventListener('click', () => { st.answers.style = s.key; advance(); });
      grid.appendChild(card);
    });
    return grid;
  }

  function renderOptionCards(q) {
    const grid = document.createElement('div');
    grid.className = 'ms_dz_options' + (q.options.length <= 4 ? ' ms_cols2' : '');
    q.options.forEach((opt) => {
      const cur = st.answers[q.id];
      const isSel = cur && (cur.value === opt.value);
      const card = document.createElement('div');
      card.className = 'ms_dz_opt' + (isSel ? ' ms_sel' : '');
      card.innerHTML = `<div class="ms_dz_opt_emoji">${opt.emoji || ''}</div><div class="ms_dz_opt_label">${opt.label}</div>` +
        (opt.desc ? `<div class="ms_dz_opt_desc">${opt.desc}</div>` : '');
      card.addEventListener('click', () => { st.answers[q.id] = opt; advance(); });
      grid.appendChild(card);
    });
    return grid;
  }

  function advance() {
    if (st.qIndex < QUESTIONS.length - 1) { st.qIndex++; render(); }
    else { st.phase = 'reco'; fetchReco(); }
  }

  // ---------- ШАГ: рекомендация ----------
  function renderRecoLoading() {
    setHead('Подбираем материалы…', 'ИИ-дизайнер анализирует ваши ответы');
    dzStage.innerHTML =
      '<div class="ms_dz_reco"><div class="ms_dz_reco_card" style="text-align:center">' +
      '<div class="ms_loader_orb" style="width:70px;height:70px;margin:6px auto 16px"></div>' +
      '<div class="ms_dz_reco_advice">Изучаю стиль и палитру, подбираю гибкий камень Castelia под ваш интерьер или фасад…</div>' +
      '</div></div>';
  }

  async function fetchReco() {
    renderProgress();
    renderRecoLoading();
    try {
      const data = await CST.api('/api/designer-recommend', { answers: st.answers }, 60000);
      st.reco = data;
      renderReco();
    } catch (e) {
      // запасной локальный подбор, чтобы пользователь не застрял
      const count = (st.answers.coverage && st.answers.coverage.count) || 2;
      const mats = C.recommend(st.answers, count).map((m) => ({ id: m.id, name: m.name, imageUrl: m.imageUrl, blurb: m.blurb, collection: m.collection }));
      const styleObj = C.styleByKey(st.answers.style);
      st.reco = { materials: mats, title: styleObj ? (styleObj.emoji + ' ' + styleObj.label) : 'Ваш стиль', advice: 'Подобрали материалы под ваш выбор. Нажмите, чтобы увидеть их на вашем фото.' };
      renderReco();
    }
  }

  function renderReco() {
    renderProgress();
    const r = st.reco || { materials: [], advice: '', title: '' };
    setHead('Готово — вот ваша идея', 'Можно сразу примерить на фото или изменить ответы');
    dzStage.innerHTML = '';
    const wrap = document.createElement('div'); wrap.className = 'ms_dz_reco';

    const card = document.createElement('div'); card.className = 'ms_dz_reco_card';
    card.innerHTML = `<div class="ms_dz_reco_title">${r.title || 'Ваш стиль'}</div><div class="ms_dz_reco_advice">${escapeHtml(r.advice || '')}</div>`;
    const mats = document.createElement('div'); mats.className = 'ms_dz_reco_mats';
    (r.materials || []).forEach((m) => {
      const el = document.createElement('div'); el.className = 'ms_dz_mat';
      el.innerHTML = `<img src="${m.imageUrl}" alt="${m.name}" loading="lazy"><div class="ms_dz_mat_name">${m.name}</div>`;
      mats.appendChild(el);
    });
    card.appendChild(mats);
    wrap.appendChild(card);

    const nav = document.createElement('div'); nav.className = 'ms_dz_nav';
    const back = document.createElement('button'); back.className = 'ms_btn ms_btn_ghost'; back.textContent = '← Изменить ответы';
    back.addEventListener('click', () => { st.phase = 'questions'; st.qIndex = QUESTIONS.length - 1; render(); });
    const go = document.createElement('button'); go.className = 'ms_btn ms_btn_gold'; go.innerHTML = '<span>✨ Показать на моём фото</span>';
    go.addEventListener('click', generate);
    nav.appendChild(back); nav.appendChild(go);
    wrap.appendChild(nav);
    dzStage.appendChild(wrap);
  }

  // ---------- визуализация ----------
  function buildHint() {
    const a = st.answers;
    const styleObj = C.styleByKey(a.style);
    const parts = [];
    if (styleObj) parts.push(`Style: ${styleObj.label}`);
    if (a.room) parts.push(`Room: ${a.room.label || a.room.value}`);
    if (a.mood) parts.push(`Mood: ${a.mood.label || a.mood.value}`);
    if (a.palette) parts.push(`Palette: ${a.palette.label || a.palette.value}`);
    return parts.join('. ');
  }

  function generate() {
    if (!st.baseImage) { CST.showError('Сначала загрузите фото'); st.phase = 'photo'; render(); return; }
    const mats = (st.reco && st.reco.materials || []).slice(0, 3).map((m) => ({ materialUrl: m.imageUrl, materialName: m.name }));
    if (!mats.length) { CST.showError('Не удалось подобрать материалы'); return; }
    CST.showLoading();
    CST.api('/api/generate-auto', {
      baseImage: st.baseImage.dataUrl, baseWidth: st.baseImage.w, baseHeight: st.baseImage.h,
      materials: mats, hint: buildHint()
    }).then((d) => {
      if (!d.resultDataUrl) throw new Error('Пустой ответ');
      CST.showResult(d.resultDataUrl, {
        eyebrow: '✨ ' + ((st.reco && st.reco.title) || 'Ваш дизайн'),
        sub: (st.reco && st.reco.advice) || 'Так это смотрится на ваших стенах.',
        againLabel: '↻ Ещё вариант',
        onAgain: generate,        // новая вариация
        backTo: 'home'
      });
    }).catch((err) => { CST.stopLoading(); CST.showError(err.message || 'Сеть недоступна'); st.phase = 'reco'; CST.show('designer'); renderReco(); });
  }

  function escapeHtml(s) { return String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c])); }
})();
