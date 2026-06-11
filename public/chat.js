/* ============================================================
   CASTELIA — режим «Профессиональный ИИ» (чат-дизайнер)
   Живой диалог: ИИ задаёт вопросы / отвечает на стиль, показывает
   карточки материалов прямо в чате, по ним собирается подборка
   и визуализируется на фото комнаты (/api/generate-auto).
   ============================================================ */
(function () {
  'use strict';

  const C = window.CST_CATALOG;
  const CST = window.CST;
  const $ = (id) => document.getElementById(id);

  const chatLog = $('chatLog');
  const chatTray = $('chatTray');
  const chatText = $('chatText');
  const chatSendBtn = $('chatSendBtn');
  const chatAttachBtn = $('chatAttachBtn');
  const chatFile = $('chatFile');
  const chatPhotoHint = $('chatPhotoHint');

  const GREETING = 'Здравствуйте! Я Кастелия, ваш ИИ-дизайнер 🤍 Помогу и с интерьером, и с фасадом дома. Расскажите, что задумали — например «лофт в гостиной» или «современный фасад загородного дома». Можно приложить фото комнаты или фасада 📎, и я покажу материалы прямо на ваших стенах.';

  const st = {
    history: [],        // [{role:'user'|'assistant', content}]
    image: null,        // {dataUrl,w,h}
    imageDirty: false,  // нужно ли отправить фото в ИИ в следующем запросе
    selected: [],       // [material]
    busy: false,
    started: false
  };

  CST.enterChat = function () {
    CST.show('chat');
    if (!st.started) { st.started = true; bootstrap(); }
    setTimeout(() => chatText.focus(), 50);
  };

  function bootstrap() {
    st.history = []; st.image = null; st.imageDirty = false; st.selected = []; st.busy = false;
    chatLog.innerHTML = '';
    chatTray.hidden = true; chatPhotoHint.hidden = true; chatAttachBtn.classList.remove('ms_has');
    addAI(GREETING);
    st.history.push({ role: 'assistant', content: GREETING });

    chatSendBtn.onclick = send;
    chatText.onkeydown = (e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); } };
    chatAttachBtn.onclick = () => chatFile.click();
    chatFile.onchange = (e) => { const f = e.target.files && e.target.files[0]; if (f) attachPhoto(f); chatFile.value = ''; };
  }

  // ---------- рендер сообщений ----------
  function scrollDown() { chatLog.scrollTop = chatLog.scrollHeight; }
  function addUser(text) { const el = document.createElement('div'); el.className = 'ms_msg ms_msg_user'; el.textContent = text; chatLog.appendChild(el); scrollDown(); }
  function addAI(text) { const el = document.createElement('div'); el.className = 'ms_msg ms_msg_ai'; el.textContent = text; chatLog.appendChild(el); scrollDown(); return el; }
  function addUserImage(dataUrl) { const el = document.createElement('div'); el.className = 'ms_msg_img'; el.innerHTML = `<img src="${dataUrl}" alt="фото объекта">`; chatLog.appendChild(el); scrollDown(); }
  function showTyping() { const el = document.createElement('div'); el.className = 'ms_msg_typing'; el.id = 'chatTyping'; el.innerHTML = '<span class="ms_typing_dot"></span><span class="ms_typing_dot"></span><span class="ms_typing_dot"></span>'; chatLog.appendChild(el); scrollDown(); }
  function hideTyping() { const el = $('chatTyping'); if (el) el.remove(); }

  function addMaterialCards(materials) {
    if (!materials || !materials.length) return;
    const wrap = document.createElement('div'); wrap.className = 'ms_chat_mats';
    materials.forEach((m) => {
      const sel = st.selected.some((x) => x.id === m.id);
      const card = document.createElement('div');
      card.className = 'ms_chat_mat' + (sel ? ' ms_sel' : '');
      card.dataset.id = m.id;
      card.innerHTML = `<div class="ms_chat_mat_check">✓</div><img src="${m.imageUrl}" alt="${m.name}" loading="lazy"><div class="ms_chat_mat_name">${m.name}</div>`;
      card.addEventListener('click', () => toggleSelect(m, card));
      wrap.appendChild(card);
    });
    chatLog.appendChild(wrap); scrollDown();
  }

  function toggleSelect(m, card) {
    const i = st.selected.findIndex((x) => x.id === m.id);
    if (i >= 0) { st.selected.splice(i, 1); card.classList.remove('ms_sel'); }
    else {
      if (st.selected.length >= 3) { CST.showError('Можно выбрать до 3 материалов'); return; }
      st.selected.push(m); card.classList.add('ms_sel');
    }
    // синхронизируем галочки на одинаковых карточках в разных сообщениях
    document.querySelectorAll('.ms_chat_mat[data-id="' + m.id + '"]').forEach((el) => el.classList.toggle('ms_sel', st.selected.some((x) => x.id === m.id)));
    renderTray();
  }

  function renderTray() {
    if (!st.selected.length) { chatTray.hidden = true; return; }
    chatTray.hidden = false;
    chatTray.innerHTML = '';
    const label = document.createElement('div'); label.className = 'ms_chat_tray_label'; label.textContent = `Выбрано: ${st.selected.length}`;
    const thumbs = document.createElement('div'); thumbs.className = 'ms_chat_tray_thumbs';
    st.selected.forEach((m) => { const im = document.createElement('img'); im.src = m.imageUrl; im.title = m.name; thumbs.appendChild(im); });
    const btn = document.createElement('button'); btn.className = 'ms_btn ms_btn_gold';
    btn.innerHTML = st.image ? '<span>✨ Показать на фото</span>' : '<span>📷 Приложить фото</span>';
    btn.addEventListener('click', () => { if (st.image) visualize(); else chatFile.click(); });
    chatTray.appendChild(label); chatTray.appendChild(thumbs); chatTray.appendChild(btn);
  }

  // ---------- фото ----------
  async function attachPhoto(file) {
    try {
      st.image = await CST.fileToImage(file);
      st.imageDirty = true;
      chatAttachBtn.classList.add('ms_has');
      chatPhotoHint.hidden = false;
      addUserImage(st.image.dataUrl);
      renderTray();
      // авто-реплика, чтобы ИИ отреагировал на фото
      sendText('Вот моё фото, помогите с дизайном.');
    } catch (e) { CST.showError(e.message); }
  }

  // ---------- отправка ----------
  function send() {
    const text = chatText.value.trim();
    if (!text) return;
    chatText.value = '';
    sendText(text);
  }

  function sendText(text) {
    if (st.busy) return;
    addUser(text);
    st.history.push({ role: 'user', content: text });
    st.busy = true; chatSendBtn.disabled = true; showTyping();

    const payload = { messages: st.history.slice(-12) };
    if (st.image && st.imageDirty) payload.image = CST.splitDataUrl(st.image.dataUrl);

    CST.api('/api/chat', payload, 60000)
      .then((d) => {
        hideTyping(); st.busy = false; chatSendBtn.disabled = false;
        st.imageDirty = false;
        const reply = d.reply || 'Расскажите чуть подробнее, какой стиль вам нравится?';
        addAI(reply);
        st.history.push({ role: 'assistant', content: reply });
        if (d.materials && d.materials.length) addMaterialCards(d.materials);
      })
      .catch((err) => {
        hideTyping(); st.busy = false; chatSendBtn.disabled = false;
        addAI('Извините, не получилось ответить. Попробуйте ещё раз 🙏');
        CST.showError(err.message || 'Сеть недоступна');
      });
  }

  // ---------- визуализация ----------
  function visualize() {
    if (!st.image) { CST.showError('Сначала приложите фото комнаты или фасада'); return; }
    if (!st.selected.length) { CST.showError('Выберите материалы из предложенных'); return; }
    const mats = st.selected.slice(0, 3).map((m) => ({ materialUrl: m.imageUrl, materialName: m.name }));
    CST.showLoading();
    CST.api('/api/generate-auto', {
      baseImage: st.image.dataUrl, baseWidth: st.image.w, baseHeight: st.image.h,
      materials: mats, hint: 'Materials chosen by the client in chat: ' + st.selected.map((m) => m.name).join(', ')
    }).then((d) => {
      if (!d.resultDataUrl) throw new Error('Пустой ответ');
      CST.showResult(d.resultDataUrl, {
        eyebrow: '💬 Подбор из чата',
        sub: 'Применили: ' + st.selected.map((m) => m.name).join(', ') + '. Не то? Вернитесь в чат и попросите другие.',
        againLabel: '← Вернуться в чат',
        onAgain: () => CST.enterChat(),
        backTo: 'home'
      });
    }).catch((err) => { CST.stopLoading(); CST.showError(err.message || 'Сеть недоступна'); CST.show('chat'); });
  }
})();
