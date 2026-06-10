/* ============================================================
   CASTELIA — материалы (гибкий камень) + карта стилей
   Универсальный модуль: работает в браузере (window.CST_CATALOG)
   и в Node (module.exports) — чтобы и фронт, и сервер видели
   один и тот же каталог и одну логику подбора.
   ============================================================ */
(function (root, factory) {
  const api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (typeof window !== 'undefined') window.CST_CATALOG = api;
})(this, function () {
  'use strict';

  const BASE = 'https://raw.githubusercontent.com/uuuucnex-rgb/casteliaCATALOG/refs/heads/main/';
  const url = (file) => BASE + encodeURIComponent(file);

  // m(id, file, name, collection, family, tone, styles[], blurb)
  //   tone:   'warm' | 'cool' | 'neutral' | 'dark'
  //   family: marble|travertine|concrete|wood|brick|metal|stone|terrazzo|rust
  //   styles: loft|industrial|classic|minimalism|scandi|japandi|luxury|modern|mediterranean|eco
  const m = (id, file, name, collection, family, tone, styles, blurb) => ({
    id, file, name, collection, family, tone, styles, blurb, imageUrl: url(file)
  });

  const MATERIALS = [
    // ---- Marble (мрамор) — лакшери, классика, статус ----
    m(1,  'Marble_Bianco_Carara.png',     'Marble Bianco Carrara',  'Marble', 'marble', 'neutral', ['luxury','classic','minimalism','modern','mediterranean'], 'Белый мрамор с мягкими серыми прожилками. Классика и лакшери, парадные интерьеры.'),
    m(2,  'Marble_Nero_Marqiua.png',      'Marble Nero Marquina',   'Marble', 'marble', 'dark',    ['luxury','modern','loft','classic'], 'Глубокий чёрный мрамор с белыми венами. Драматичный акцент, статус.'),
    m(3,  'Marble_Armany_dark_grey.jpg',  'Marble Armani Dark Grey','Marble', 'marble', 'dark',    ['luxury','modern','loft'], 'Тёмно-серый мрамор Armani. Строгий премиальный акцент.'),
    m(4,  'Marble_Bulgari.webp',          'Marble Bulgari',         'Marble', 'marble', 'neutral', ['luxury','classic','modern'], 'Выразительный мрамор Bulgari. Дорогой выразительный рисунок.'),
    m(5,  'Marble_Golden_silk_biege.jpg', 'Marble Golden Silk Beige','Marble','marble', 'warm',    ['luxury','classic','mediterranean','modern'], 'Бежевый мрамор с золотистым шёлковым рисунком. Тёплый люкс.'),
    m(6,  'Marble_New_victoria.jpg',      'Marble New Victoria',    'Marble', 'marble', 'neutral', ['luxury','classic','modern'], 'Светлый мрамор с изящными прожилками. Спокойная классика.'),
    m(7,  'Marble_Pondora.jpg',           'Marble Pandora',         'Marble', 'marble', 'neutral', ['luxury','modern','classic'], 'Мрамор Pandora — мягкий природный рисунок, универсальный люкс.'),
    m(8,  'Marble_Top_pandora.jpg',       'Marble Top Pandora',     'Marble', 'marble', 'neutral', ['luxury','modern'], 'Премиальная вариация Pandora с выразительной структурой.'),

    // ---- Italian Travertine (травертин) — средиземноморье, классика, минимализм ----
    m(9,  'Italian Travertine_White.jpg',        'Italian Travertine White',       'Italian Travertine', 'travertine', 'neutral', ['minimalism','mediterranean','scandi','classic'], 'Белый травертин. Светлый средиземноморский минимализм.'),
    m(10, 'Italian Travertine_Light_grey.webp',  'Italian Travertine Light Grey',  'Italian Travertine', 'travertine', 'cool',    ['minimalism','scandi','modern','mediterranean'], 'Светло-серый травертин. Спокойная нейтральная база.'),
    m(11, 'Italian Travertine_Grey.jpg',         'Italian Travertine Grey',        'Italian Travertine', 'travertine', 'neutral', ['minimalism','modern','mediterranean'], 'Серый травертин. Современная сдержанность.'),
    m(12, 'Italian Travertine_Grey_Milano.webp', 'Italian Travertine Grey Milano', 'Italian Travertine', 'travertine', 'neutral', ['minimalism','modern','mediterranean'], 'Серый травертин Milano. Городской минимализм.'),
    m(13, 'Italian Travertine_Light_brown.jpg',  'Italian Travertine Light Brown', 'Italian Travertine', 'travertine', 'warm',    ['mediterranean','classic','scandi','eco'], 'Светло-коричневый травертин. Тёплое средиземноморье.'),
    m(14, 'Italian Travertine_Brown.jpg',        'Italian Travertine Brown',       'Italian Travertine', 'travertine', 'warm',    ['mediterranean','classic','eco'], 'Коричневый травертин. Тёплая природная классика.'),
    m(15, 'Italian Travertine_Yellow.jpg',       'Italian Travertine Yellow',      'Italian Travertine', 'travertine', 'warm',    ['mediterranean','classic','eco'], 'Золотисто-жёлтый травертин. Солнечный южный характер.'),

    // ---- Roman Pillar (римская колонна / кирпич) — лофт, классика ----
    m(16, 'Roman_pillar_milan_red.jpg',    'Roman Pillar Milan Red',   'Roman Pillar', 'brick',   'warm',    ['loft','industrial','mediterranean'], 'Насыщенный кирпично-красный. Лофт и индустриальные акцентные стены.'),
    m(17, 'Roman_pillar_cement_grey.jpg',  'Roman Pillar Cement Grey', 'Roman Pillar', 'concrete','cool',    ['loft','industrial','minimalism','modern'], 'Серый цемент. Брутальная городская база.'),
    m(18, 'Roman_pillar_milan_grey.jpg',   'Roman Pillar Milan Grey',  'Roman Pillar', 'brick',   'neutral', ['loft','classic','modern'], 'Серый кирпич Milan. Сдержанный лофт.'),
    m(19, 'Roman_pillar_millan_white.jpg', 'Roman Pillar Milan White', 'Roman Pillar', 'brick',   'neutral', ['classic','scandi','minimalism','mediterranean'], 'Белый кирпич. Светлый скандинавский лофт.'),
    m(20, 'Roman_pillar_limon_yellow.jpg', 'Roman Pillar Limon Yellow','Roman Pillar', 'brick',   'warm',    ['mediterranean','classic','eco'], 'Лимонно-жёлтый кирпич. Тёплый южный акцент.'),

    // ---- Aerolite — тёплый нейтральный универсал ----
    m(21, 'Aerolite_COFFEE_grey.jpg',   'Aerolite Coffee Grey',  'Aerolite', 'stone',    'neutral', ['minimalism','scandi','modern','japandi'], 'Тёплый серо-кофейный нейтральный универсал. Современная классика и минимализм.'),
    m(22, 'Aerolite_earthy_brown.jpg',  'Aerolite Earthy Brown', 'Aerolite', 'stone',    'warm',    ['eco','japandi','scandi','mediterranean'], 'Землисто-коричневый. Тёплая природная палитра.'),

    // ---- Ando & Zen Cement (бетон) — минимализм, японди, лофт ----
    m(23, 'Ando & zen cement_CEMENT_GREY.jpg', 'Ando & Zen Cement Grey',  'Ando & Zen Cement', 'concrete', 'cool',    ['minimalism','loft','japandi','modern','industrial'], 'Серый бетон. Дзен-минимализм и микроцемент.'),
    m(24, 'Ando & zen cement_WARM_GREY.jpg',   'Ando & Zen Warm Grey',    'Ando & Zen Cement', 'concrete', 'warm',    ['japandi','minimalism','scandi','modern'], 'Тёплый серый бетон. Мягкий японди.'),
    m(25, 'Ando & zen cement_TAUPE.jpg',       'Ando & Zen Taupe',        'Ando & Zen Cement', 'concrete', 'warm',    ['japandi','minimalism','modern','eco'], 'Бетон тон тауп. Спокойный тёплый нейтрал.'),

    // ---- Crude Wood (дерево) — скандинавский, эко, японди ----
    m(26, 'Crude wood_LIGHT_BROWN.jpg',  'Crude Wood Light Brown',  'Crude Wood', 'wood', 'warm', ['scandi','eco','japandi','mediterranean'], 'Светлое дерево. Скандинавский уют и тепло.'),
    m(27, 'Crude woodPLIGHT_YELLOW.jpg', 'Crude Wood Light Yellow', 'Crude Wood', 'wood', 'warm', ['scandi','eco','mediterranean'], 'Светлое дерево с золотистым тоном. Солнечный скандинав.'),
    m(28, 'Crude wood_YELOOW.jpg',       'Crude Wood Yellow',       'Crude Wood', 'wood', 'warm', ['scandi','eco','mediterranean'], 'Медовое дерево. Тёплый эко-характер.'),
    m(29, 'Crude wood_DARK_BROWN.jpg',   'Crude Wood Dark Brown',   'Crude Wood', 'wood', 'dark', ['eco','loft','japandi','modern'], 'Тёмное дерево. Глубокий природный акцент.'),

    // ---- Rust Board (кортен / ржавчина) — лофт, индастриал ----
    m(30, 'Rust Board_BUSH_HUMMERED.jpg', 'Rust Board Bush-Hammered', 'Rust Board', 'rust', 'warm', ['loft','industrial','modern'], 'Эффект кортеновской стали. Брутальный индустриальный акцент.'),
    m(31, 'Rust Board_MEDIUN_PLAID.jpg',  'Rust Board Medium Plaid',  'Rust Board', 'rust', 'warm', ['loft','industrial','modern'], 'Ржавый кортен с фактурой. Сильный лофт-акцент.'),

    // ---- Foamed Aluminium (металл) — хайтек, лофт, акцент ----
    m(32, 'Foamed Aluminium_SILVER.jpg', 'Foamed Aluminium Silver', 'Foamed Aluminium', 'metal', 'cool', ['modern','loft','industrial','minimalism'], 'Вспененный алюминий, серебро. Технологичный металлический акцент.'),
    m(33, 'Foamed Aluminium_GOLDEN.jpg', 'Foamed Aluminium Golden', 'Foamed Aluminium', 'metal', 'warm', ['luxury','modern','loft'], 'Вспененный алюминий, золото. Дорогой металлический блеск.'),

    // ---- Golden Sunset — металлик / камень-акцент ----
    m(34, 'Golden sunset_GOLDEN.jpg',       'Golden Sunset Golden',      'Golden Sunset', 'metal', 'warm',    ['luxury','modern','mediterranean'], 'Золотой закат. Тёплое сияние премиум-акцента.'),
    m(35, 'Golden sunset_SILVER_GREY.jpg',  'Golden Sunset Silver Grey', 'Golden Sunset', 'metal', 'cool',    ['modern','minimalism','loft'], 'Серебристо-серый. Холодный современный металлик.'),
    m(36, 'Golden sunset_DARK_GREY.jpg',    'Golden Sunset Dark Grey',   'Golden Sunset', 'stone', 'dark',    ['loft','industrial','modern'], 'Тёмно-серый закат. Глубокий брутальный тон.'),
    m(37, 'Golden sunset_DARK_CLAYBAMK.jpg','Golden Sunset Dark Claybank','Golden Sunset','stone', 'warm',    ['loft','eco','mediterranean'], 'Тёмная глина. Тёплый землистый акцент.'),

    // ---- Natural (натуральный камень) — эко, средиземноморье, минимализм ----
    m(38, 'Natural_light_beigne.jpg', 'Natural Light Beige', 'Natural', 'stone', 'neutral', ['scandi','minimalism','mediterranean','eco'], 'Светло-бежевый натуральный камень. Лёгкая природная база.'),
    m(39, 'Natural_beigne.jpg',       'Natural Beige',       'Natural', 'stone', 'warm',    ['eco','mediterranean','scandi','minimalism'], 'Бежевый натуральный камень. Тёплая природа.'),
    m(40, 'Natural_brown.jpg',        'Natural Brown',       'Natural', 'stone', 'warm',    ['eco','mediterranean','loft'], 'Коричневый натуральный камень. Земля и тепло.'),
    m(41, 'Natural_black.jpg',        'Natural Black',       'Natural', 'stone', 'dark',    ['loft','modern','minimalism'], 'Чёрный натуральный камень. Графичный тёмный акцент.'),

    // ---- Dacite (вулканический камень) — минимализм, японди ----
    m(42, 'Dacite_BEIGNE.jpg',    'Dacite Beige',     'Dacite', 'stone', 'warm', ['minimalism','japandi','eco','modern'], 'Бежевый дацит. Мягкий вулканический минимализм.'),
    m(43, 'Dacite_DARK_GREY.jpg', 'Dacite Dark Grey', 'Dacite', 'stone', 'dark', ['minimalism','loft','modern','industrial'], 'Тёмно-серый дацит. Строгий вулканический камень.'),

    // ---- Line Stone Board (линейный камень) — минимализм, модерн ----
    m(44, 'line stone board_BEIGNE.jpg',    'Line Stone Board Beige',     'Line Stone Board', 'stone', 'neutral', ['minimalism','scandi','modern','mediterranean'], 'Бежевый линейный камень. Спокойный ритм поверхности.'),
    m(45, 'Line stone board_DARK_GREY.jpg', 'Line Stone Board Dark Grey', 'Line Stone Board', 'stone', 'dark',    ['minimalism','loft','modern','industrial'], 'Тёмно-серый линейный камень. Графичный модерн.'),

    // ---- Terrazzo Rough (терраццо) — модерн, скандинавский ----
    m(46, 'Terrazzo rough_LIGHT_GREY.jpg', 'Terrazzo Rough Light Grey', 'Terrazzo Rough', 'terrazzo', 'neutral', ['modern','scandi','minimalism'], 'Светлое терраццо. Лёгкий игривый модерн.'),
    m(47, 'Terrazzo rough_GREY.jpg',       'Terrazzo Rough Grey',       'Terrazzo Rough', 'terrazzo', 'neutral', ['modern','minimalism','scandi'], 'Серое терраццо. Современная крошка-фактура.'),
    m(48, 'Terrazzo rough_DARK_GREY.jpg',  'Terrazzo Rough Dark Grey',  'Terrazzo Rough', 'terrazzo', 'dark',    ['modern','loft','minimalism'], 'Тёмное терраццо. Контрастный графичный пол/стена.'),
    m(49, 'Terrazzo rough_YELLOW.jpg',     'Terrazzo Rough Yellow',     'Terrazzo Rough', 'terrazzo', 'warm',    ['modern','scandi','mediterranean','eco'], 'Жёлтое терраццо. Солнечный игривый акцент.'),

    // ---- New Rock Cut Stone (грубо тёсаный камень) — эко, средиземноморье ----
    m(50, 'new_rock_cut stone_BEIGE.jpg',    'New Rock Cut Stone Beige',     'New Rock Cut Stone', 'stone', 'warm', ['eco','mediterranean','classic','modern'], 'Бежевый тёсаный камень. Природный рельеф, тепло.'),
    m(51, 'new_rock_cut stone_DARKGREY.jpg', 'New Rock Cut Stone Dark Grey', 'New Rock Cut Stone', 'stone', 'dark', ['loft','modern','industrial','eco'], 'Тёмно-серый тёсаный камень. Брутальный природный рельеф.'),

    // ---- Round Line Stone (округлый камень) — эко, средиземноморье ----
    m(52, 'round_Line stone_beige052.jpg',     'Round Line Stone Beige',     'Round Line Stone', 'stone', 'warm', ['eco','mediterranean','scandi','modern'], 'Округлый бежевый камень. Мягкий природный рисунок.'),
    m(53, 'round_line stonedark_grey043.jpg',  'Round Line Stone Dark Grey', 'Round Line Stone', 'stone', 'dark', ['loft','modern','industrial'], 'Округлый тёмно-серый камень. Глубокий природный акцент.')
  ];

  const byId = (id) => MATERIALS.find((x) => x.id === id) || null;

  // ---- Стили для мастера «Дизайнер-интерьера» (5 вопросов) ----
  // sample — id материала-обложки для превью карточки стиля
  const STYLES = [
    { key: 'loft',          label: 'Лофт',            emoji: '🧱', sample: 16, desc: 'Кирпич, бетон, ржавый металл — брутально и по-городскому' },
    { key: 'classic',       label: 'Классика',        emoji: '🏛️', sample: 1,  desc: 'Мрамор и травертин, светлые тёплые тона, статус' },
    { key: 'minimalism',    label: 'Минимализм',      emoji: '⬜', sample: 23, desc: 'Бетон и ровные поверхности, тишина и порядок' },
    { key: 'scandi',        label: 'Скандинавский',   emoji: '🌿', sample: 26, desc: 'Светлое дерево и бежевый, уют и много света' },
    { key: 'japandi',       label: 'Японди',          emoji: '🍵', sample: 24, desc: 'Тёплый бетон и дерево, дзен-спокойствие' },
    { key: 'luxury',        label: 'Лакшери',         emoji: '💎', sample: 2,  desc: 'Чёрный и белый мрамор, золото — премиум и статус' },
    { key: 'mediterranean', label: 'Средиземноморье', emoji: '🏺', sample: 13, desc: 'Травертин и тёплый камень, южное тепло' },
    { key: 'eco',           label: 'Эко / Природный', emoji: '🪵', sample: 50, desc: 'Натуральный камень и дерево, живая природа' }
  ];
  const styleByKey = (k) => STYLES.find((s) => s.key === k) || null;

  // ---- 5 вопросов мастера. Каждый ответ несёт подсказки для подбора ----
  const QUESTIONS = [
    {
      id: 'style', title: 'Какой стиль вам ближе?',
      sub: 'Выберите настроение — остальное подберём сами',
      kind: 'styles' // особый рендер: карточки стилей с превью
    },
    {
      id: 'room', title: 'Что оформляем?',
      sub: 'Это поможет ИИ правильно разместить материалы',
      options: [
        { value: 'living',  label: 'Гостиная',     emoji: '🛋️' },
        { value: 'kitchen', label: 'Кухня',        emoji: '🍳' },
        { value: 'bedroom', label: 'Спальня',      emoji: '🛏️' },
        { value: 'bath',    label: 'Ванная',       emoji: '🛁' },
        { value: 'hall',    label: 'Прихожая',     emoji: '🚪' },
        { value: 'facade',  label: 'Фасад дома',   emoji: '🏠' }
      ]
    },
    {
      id: 'mood', title: 'Какая атмосфера нужна?',
      sub: 'Тон материалов подстроим под настроение',
      options: [
        { value: 'warm',    label: 'Тёплая, уютная',      emoji: '🔥', tone: 'warm' },
        { value: 'light',   label: 'Светлая, воздушная',  emoji: '☀️', tone: 'neutral' },
        { value: 'status',  label: 'Строгая, статусная',  emoji: '🖤', tone: 'neutral' },
        { value: 'bold',    label: 'Тёмная, брутальная',  emoji: '⚫', tone: 'dark' }
      ]
    },
    {
      id: 'palette', title: 'Любимая палитра?',
      sub: 'Подскажет какие оттенки вам по душе',
      options: [
        { value: 'light',   label: 'Светлые тона',        emoji: '🤍', tone: 'neutral' },
        { value: 'warmwood',label: 'Тёплый беж и дерево', emoji: '🟤', tone: 'warm' },
        { value: 'concrete',label: 'Серый бетон',         emoji: '⬜', tone: 'cool' },
        { value: 'dark',    label: 'Тёмный контраст',     emoji: '⬛', tone: 'dark' }
      ]
    },
    {
      id: 'coverage', title: 'Сколько материала?',
      sub: 'От этого зависит, сколько фактур подберём',
      options: [
        { value: 'accent', label: 'Одна акцентная стена',    emoji: '🎯', count: 1 },
        { value: 'full',   label: 'Вся комната в одном',      emoji: '🧱', count: 1 },
        { value: 'mix',    label: 'Сочетание 2–3 материалов', emoji: '🎨', count: 3 }
      ]
    }
  ];

  // ---- Подбор материалов по ответам (детерминированный — для мгновенного
  //      превью на фронте и как запасной вариант на сервере, если ИИ молчит) ----
  function recommend(answers, limit) {
    answers = answers || {};
    const styleKey = answers.style || 'minimalism';
    // желаемый тон из настроения/палитры
    const wantTones = [];
    if (answers.mood && answers.mood.tone) wantTones.push(answers.mood.tone);
    if (answers.palette && answers.palette.tone) wantTones.push(answers.palette.tone);
    const count = limit || (answers.coverage && answers.coverage.count) || 2;

    const scored = MATERIALS.map((mat) => {
      let score = 0;
      if (mat.styles.includes(styleKey)) score += 10;
      wantTones.forEach((t) => { if (mat.tone === t) score += 4; });
      // мягкие соседние тона
      wantTones.forEach((t) => {
        if ((t === 'warm' && mat.tone === 'neutral') || (t === 'neutral' && mat.tone === 'warm')) score += 1;
        if ((t === 'cool' && mat.tone === 'neutral') || (t === 'neutral' && mat.tone === 'cool')) score += 1;
      });
      return { mat, score };
    }).filter((x) => x.score > 0)
      .sort((a, b) => b.score - a.score);

    // разнообразие: не берём 3 материала из одной коллекции
    const out = [];
    const seenCollections = {};
    for (const x of scored) {
      const c = x.mat.collection;
      const used = seenCollections[c] || 0;
      if (used >= 1 && out.length >= 1) continue; // максимум 1 из коллекции пока есть выбор
      out.push(x.mat);
      seenCollections[c] = used + 1;
      if (out.length >= count) break;
    }
    // добор, если фильтр по коллекциям не дал нужного числа
    if (out.length < count) {
      for (const x of scored) {
        if (out.includes(x.mat)) continue;
        out.push(x.mat);
        if (out.length >= count) break;
      }
    }
    return out.slice(0, count);
  }

  // короткий компактный список для системного промпта ИИ
  function catalogForPrompt() {
    return MATERIALS.map((x) =>
      `#${x.id} ${x.name} [${x.collection}; ${x.tone}; ${x.styles.join('/')}] — ${x.blurb}`
    ).join('\n');
  }

  return { MATERIALS, STYLES, QUESTIONS, byId, styleByKey, recommend, catalogForPrompt };
});
