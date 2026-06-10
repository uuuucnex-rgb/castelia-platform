// =============================================================
// CASTELIA PLATFORM — unified server (prototype 2)
//
// Image generation (Gemini):
//   POST /api/generate-masked   → "Самостоятельно": материалы по маскам
//   POST /api/generate-auto     → "Дизайнер" / "ИИ": материалы без масок
//   POST /api/touchup           → локальная правка результата
//
// Text AI (Gemini, переключается на OpenAI через AI_TEXT_PROVIDER):
//   POST /api/designer-recommend → 5 вопросов → подбор материалов + совет
//   POST /api/chat               → чат с ИИ-дизайнером (+ карточки материалов)
//
//   GET  /health                 → статус
//   GET  /                       → статика public/
// =============================================================

require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const CATALOG = require('./public/catalog.js');

process.on('uncaughtException', (err) => console.error('UncaughtException:', err && err.message ? err.message : err));
process.on('unhandledRejection', (err) => console.error('UnhandledRejection:', err && err.message ? err.message : err));

const app = express();
const PORT = process.env.PORT || 3003;

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const GEMINI_IMAGE_MODEL = process.env.GEMINI_IMAGE_MODEL || 'gemini-3-pro-image';
const GEMINI_TEXT_MODEL = process.env.GEMINI_TEXT_MODEL || 'gemini-2.5-flash';

const AI_TEXT_PROVIDER = (process.env.AI_TEXT_PROVIDER || 'gemini').toLowerCase();
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const OPENAI_CHAT_MODEL = process.env.OPENAI_CHAT_MODEL || 'gpt-4o';

app.use(cors({ origin: '*' }));
app.use(express.json({ limit: '100mb' }));
app.use(express.static(path.join(__dirname, 'public')));

// ===================== Helpers =====================

function mimeFromUrl(url) {
  const u = url.toLowerCase().split('?')[0];
  if (u.endsWith('.png')) return 'image/png';
  if (u.endsWith('.webp')) return 'image/webp';
  if (u.endsWith('.gif')) return 'image/gif';
  return 'image/jpeg';
}
function parseDataUrl(dataUrl) {
  const mm = /^data:([^;]+);base64,(.*)$/.exec(dataUrl || '');
  if (!mm) return null;
  return { mime: mm[1], base64: mm[2] };
}
async function fetchWithRetry(url, opts, label) {
  let resp, lastErr;
  for (let i = 1; i <= 3; i++) {
    try {
      console.log(`  ${label} attempt ${i}/3...`);
      resp = await fetch(url, opts);
      return resp;
    } catch (e) {
      lastErr = e;
      console.error(`  ${label} attempt ${i} failed: ${e.message}`);
      if (i < 3) await new Promise((r) => setTimeout(r, 2000 * i));
    }
  }
  throw lastErr || new Error('All attempts failed');
}

// Извлечь картинку из ответа Gemini → dataURL
function extractGeminiImage(data) {
  const parts = data && data.candidates && data.candidates[0] && data.candidates[0].content && data.candidates[0].content.parts;
  if (!parts || !parts.length) throw new Error('Empty response from Gemini');
  const imagePart = parts.find((p) => p.inlineData || p.inline_data);
  if (!imagePart) {
    const textPart = parts.find((p) => p.text);
    throw new Error(textPart ? `No image: ${textPart.text.slice(0, 200)}` : 'No image returned');
  }
  const inline = imagePart.inlineData || imagePart.inline_data;
  const mime = inline.mimeType || inline.mime_type || 'image/png';
  return `data:${mime};base64,${inline.data}`;
}

// =============================================================
// TEXT LLM (Gemini по умолчанию, OpenAI опционально)
// callTextLLM({ system, messages:[{role:'user'|'assistant', content}], image:{mime,base64}, json, temperature, maxTokens })
// → строка с ответом модели
// =============================================================
async function callTextLLM({ system, messages, image, json, temperature = 0.7, maxTokens = 400 }) {
  if (AI_TEXT_PROVIDER === 'openai') return callOpenAIText({ system, messages, image, json, temperature, maxTokens });
  return callGeminiText({ system, messages, image, json, temperature, maxTokens });
}

async function callGeminiText({ system, messages, image, json, temperature, maxTokens }) {
  if (!GEMINI_API_KEY) throw new Error('GEMINI_API_KEY is not configured');
  const contents = messages.map((msg, idx) => {
    const parts = [{ text: msg.content }];
    // картинку прикрепляем к последнему сообщению пользователя
    if (image && image.base64 && idx === messages.length - 1 && msg.role === 'user') {
      parts.push({ inline_data: { mime_type: image.mime || 'image/jpeg', data: image.base64 } });
    }
    return { role: msg.role === 'assistant' ? 'model' : 'user', parts };
  });
  const body = {
    system_instruction: { parts: [{ text: system }] },
    contents,
    generationConfig: {
      temperature,
      maxOutputTokens: maxTokens,
      responseModalities: ['TEXT'],
      // отключаем «мысли» у gemini-2.5-* — иначе они съедают бюджет токенов и ответ пустой
      thinkingConfig: { thinkingBudget: 0 },
      ...(json ? { responseMimeType: 'application/json' } : {})
    }
  };
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_TEXT_MODEL}:generateContent?key=${GEMINI_API_KEY}`;
  const resp = await fetchWithRetry(url, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body)
  }, 'gemini-text');
  const data = await resp.json();
  if (!resp.ok) throw new Error((data && data.error && data.error.message) || `Gemini error ${resp.status}`);
  const parts = data && data.candidates && data.candidates[0] && data.candidates[0].content && data.candidates[0].content.parts;
  const text = (parts || []).map((p) => p.text || '').join('').trim();
  if (!text) throw new Error('Empty text from Gemini');
  return text;
}

async function callOpenAIText({ system, messages, image, json, temperature, maxTokens }) {
  if (!OPENAI_API_KEY) throw new Error('OPENAI_API_KEY is not configured');
  const apiMessages = [{ role: 'system', content: system }];
  messages.forEach((msg, idx) => {
    if (image && image.base64 && idx === messages.length - 1 && msg.role === 'user') {
      apiMessages.push({
        role: 'user',
        content: [
          { type: 'text', text: msg.content },
          { type: 'image_url', image_url: { url: `data:${image.mime || 'image/jpeg'};base64,${image.base64}`, detail: 'low' } }
        ]
      });
    } else {
      apiMessages.push({ role: msg.role, content: msg.content });
    }
  });
  const body = {
    model: OPENAI_CHAT_MODEL, messages: apiMessages, max_tokens: maxTokens, temperature,
    ...(json ? { response_format: { type: 'json_object' } } : {})
  };
  const resp = await fetchWithRetry('https://api.openai.com/v1/chat/completions', {
    method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${OPENAI_API_KEY}` }, body: JSON.stringify(body)
  }, 'openai-text');
  const data = await resp.json();
  if (!resp.ok) throw new Error((data && data.error && data.error.message) || `OpenAI error ${resp.status}`);
  const text = data.choices && data.choices[0] && data.choices[0].message && data.choices[0].message.content;
  if (!text) throw new Error('Empty text from OpenAI');
  return text.trim();
}

function safeJsonParse(text) {
  if (!text) return null;
  let t = text.trim();
  // снять возможные ```json ... ``` обёртки
  t = t.replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/i, '').trim();
  try { return JSON.parse(t); } catch (_) {}
  // вытащить первый {...} блок
  const a = t.indexOf('{'), b = t.lastIndexOf('}');
  if (a >= 0 && b > a) { try { return JSON.parse(t.slice(a, b + 1)); } catch (_) {} }
  return null;
}

// =============================================================
// /api/designer-recommend — мастер «Дизайнер-интерьера» (5 вопросов)
// =============================================================
const ROOM_LABELS = { living: 'гостиная', kitchen: 'кухня', bedroom: 'спальня', bath: 'ванная', hall: 'прихожая', facade: 'фасад дома' };

function designerSystemPrompt(count) {
  return `Ты — ведущий дизайнер интерьера бренда Castelia (премиальный гибкий камень из Италии, фактуры мрамора, травертина, бетона, дерева, кирпича, металла). Опыт 25 лет, вкус уровня Architectural Digest: итальянская классика + современный минимализм.

Тебе дают ответы клиента (стиль, помещение, атмосфера, палитра, объём отделки). Подбери из КАТАЛОГА ровно ${count} материал(а/ов) Castelia, которые:
- максимально точно создают выбранный стиль и атмосферу;
- красиво сочетаются между собой (один доминирующий + акценты, желательно из РАЗНЫХ коллекций, в гармонии тонов);
- подходят выбранному помещению.

Отвечай СТРОГО валидным JSON без markdown:
{"materialIds":[номера из каталога],"title":"короткое название идеи (3-5 слов)","advice":"тёплый совет клиенту на «вы», 2-4 предложения: куда какой материал нанести и почему это сочетание работает"}

Бери ТОЛЬКО материалы из каталога ниже (по их номерам). Никаких выдуманных названий.

КАТАЛОГ CASTELIA:
${CATALOG.catalogForPrompt()}`;
}

app.post('/api/designer-recommend', async (req, res) => {
  const started = Date.now();
  try {
    const { answers } = req.body || {};
    if (!answers || !answers.style) return res.status(400).json({ error: 'Missing answers.style' });

    const count = (answers.coverage && answers.coverage.count) || 2;
    const styleObj = CATALOG.styleByKey(answers.style);
    const styleLabel = styleObj ? styleObj.label : answers.style;
    const roomLabel = (answers.room && (ROOM_LABELS[answers.room.value || answers.room] || answers.room.label)) || 'помещение';
    const moodLabel = (answers.mood && (answers.mood.label || answers.mood.value)) || '';
    const paletteLabel = (answers.palette && (answers.palette.label || answers.palette.value)) || '';

    const userMsg = `Ответы клиента:
- Стиль: ${styleLabel}
- Помещение: ${roomLabel}
- Атмосфера: ${moodLabel}
- Палитра: ${paletteLabel}
- Объём: подобрать ${count} материал(а/ов).

Подбери ${count} материал(а/ов) и дай совет.`;

    // детерминированный фолбэк сразу — чтобы ответ был всегда
    const fallback = CATALOG.recommend(answers, count);
    let materialIds = fallback.map((m) => m.id);
    let title = styleObj ? `${styleObj.emoji} ${styleLabel}` : styleLabel;
    let advice = '';

    try {
      const raw = await callTextLLM({
        system: designerSystemPrompt(count),
        messages: [{ role: 'user', content: userMsg }],
        json: true, temperature: 0.6, maxTokens: 500
      });
      const parsed = safeJsonParse(raw);
      if (parsed) {
        const ids = (parsed.materialIds || parsed.ids || []).map(Number).filter((id) => CATALOG.byId(id));
        if (ids.length) materialIds = ids.slice(0, count);
        if (parsed.advice) advice = String(parsed.advice).trim();
        if (parsed.title) title = String(parsed.title).trim();
      }
    } catch (e) {
      console.warn(`  designer-recommend: AI failed (${e.message}), using fallback`);
    }

    const materials = materialIds.map((id) => {
      const m = CATALOG.byId(id);
      return { id: m.id, name: m.name, collection: m.collection, imageUrl: m.imageUrl, blurb: m.blurb };
    });
    if (!advice) {
      advice = `Для стиля «${styleLabel}» отлично подойдёт ${materials.map((m) => m.name).join(' и ')}. ` +
        `Основной материал нанесите на крупную стену, остальное используйте как акцент — так пространство будет выглядеть дорого и цельно.`;
    }
    console.log(`[${new Date().toISOString()}] /api/designer-recommend style=${answers.style} -> [${materialIds.join(',')}] in ${Date.now() - started}ms`);
    res.json({ materials, title, advice });
  } catch (err) {
    const msg = (err && err.message) || 'Unknown server error';
    console.error(`/api/designer-recommend failed: ${msg}`);
    if (!res.headersSent) res.status(500).json({ error: msg });
  }
});

// =============================================================
// /api/chat — «Профессиональный ИИ» (чат-дизайнер)
// =============================================================
const CHAT_SYSTEM_PROMPT = `Ты — Кастелия, профессиональный ИИ-дизайнер интерьера бренда Castelia (премиальный гибкий камень из Италии: мрамор, травертин, бетон, дерево, кирпич, металл, терраццо).

Твоя задача: тёплым живым диалогом за 1-3 коротких реплики понять что хочет клиент (стиль, помещение, настроение) и подобрать конкретные материалы Castelia из каталога.

Правила общения:
- На «вы», дружелюбно и по-человечески, коротко (1-3 предложения). Без markdown, без списков с цифрами, эмодзи изредка.
- Если клиент с ходу называет стиль (например «лофт», «классика», «японди») — сразу предложи 1-3 подходящих материала из каталога и в двух словах объясни почему.
- Если непонятно — задай ОДИН короткий уточняющий вопрос (например про стиль или комнату).
- Никогда не выдумывай материалы вне каталога. Используй только их названия из каталога.
- Можешь предложить «Загрузите фото комнаты — покажу как это будет выглядеть на ваших стенах».

ВАЖНО про показ материалов: когда ты рекомендуешь конкретные материалы, ОБЯЗАТЕЛЬНО добавь самой последней строкой служебный тег в формате:
[[MATERIALS: 16, 30]]
где числа — номера материалов из каталога. Клиент этот тег не увидит — по нему система покажет карточки с фото. Добавляй тег только когда реально что-то рекомендуешь.

КАТАЛОГ CASTELIA (номер — название — описание):
${CATALOG.catalogForPrompt()}`;

app.post('/api/chat', async (req, res) => {
  const started = Date.now();
  try {
    const { messages, image } = req.body || {};
    if (!Array.isArray(messages) || messages.length === 0) return res.status(400).json({ error: 'Missing messages' });

    const raw = await callTextLLM({
      system: CHAT_SYSTEM_PROMPT,
      messages: messages.map((m) => ({ role: m.role === 'assistant' ? 'assistant' : 'user', content: String(m.content || '') })),
      image: image && image.base64 ? image : null,
      json: false, temperature: 0.8, maxTokens: 320
    });

    // вытащить теги материалов
    const ids = [];
    const re = /\[\[?\s*MATERIALS?\s*:\s*([0-9 ,]+)\]?\]/gi;
    let mt;
    while ((mt = re.exec(raw)) !== null) {
      mt[1].split(',').forEach((s) => { const n = parseInt(s.trim(), 10); if (n && CATALOG.byId(n)) ids.push(n); });
    }
    const uniqueIds = [...new Set(ids)].slice(0, 4);
    const materials = uniqueIds.map((id) => {
      const m = CATALOG.byId(id);
      return { id: m.id, name: m.name, collection: m.collection, imageUrl: m.imageUrl, blurb: m.blurb };
    });
    const reply = raw.replace(re, '').replace(/\n{3,}/g, '\n\n').trim();

    console.log(`[${new Date().toISOString()}] /api/chat -> mats=[${uniqueIds.join(',')}] in ${Date.now() - started}ms`);
    res.json({ reply, materials });
  } catch (err) {
    const msg = (err && err.message) || 'Unknown server error';
    console.error(`/api/chat failed: ${msg}`);
    if (!res.headersSent) res.status(500).json({ error: msg });
  }
});

// =============================================================
// IMAGE: /api/generate-masked  (режим «Самостоятельно»)
// =============================================================
function buildMaskedPrompt(materials, baseWidth, baseHeight) {
  const colorAssignments = materials.map((mm) => `   - ${mm.colorName.toUpperCase()} pixels → apply material "${mm.materialName}"`).join('\n');
  const totalImages = 2 + materials.length;
  const materialList = materials.map((mm, i) =>
    `IMAGE ${i + 2}: MATERIAL "${mm.materialName}" — texture sample (reference only — DO NOT include this sample visually in the output)`).join('\n');
  const dimsText = baseWidth && baseHeight
    ? `OUTPUT DIMENSIONS: exactly ${baseWidth} × ${baseHeight} pixels (same as BASE PHOTO).`
    : 'OUTPUT DIMENSIONS: exactly the same width × height as BASE PHOTO.';

  return `╔════════════════════════════════════════════════════════════╗
║  CRITICAL FORMAT RULES (READ FIRST — DEAL-BREAKING)        ║
╚════════════════════════════════════════════════════════════╝

You MUST produce EXACTLY ONE photographic image of the same scene as BASE PHOTO.

❌ FORBIDDEN OUTPUTS — never produce any of these:
   • A grid, collage, or multi-panel layout (2×2, 3×1, triptych, etc.)
   • Before/after split-screen or side-by-side comparison
   • The BASE PHOTO appearing alongside the edited version
   • Material samples or swatches shown beside / below / above the image
   • Multiple variations stacked together; duplicated photos
   • Text labels, annotations, color chips, captions, watermarks
   • Letterbox bars, mats, borders, frames, extra canvas/padding

✅ ONLY VALID OUTPUT:
   • One single photorealistic image
   • ${dimsText}
   • Same aspect ratio, framing, camera angle, field of view as BASE PHOTO
   • The edited scene from BASE PHOTO with materials applied to surfaces inside it

The MATERIAL images are REFERENCE TEXTURES — they must NOT appear as separate elements.

╔════════════════════════════════════════════════════════════╗

You will receive ${totalImages} images in this exact order:

IMAGE 1: BASE PHOTO — a real interior room or building facade. This is the scene to edit.

${materialList}

IMAGE ${totalImages}: COLOR-CODED MASK — same dimensions as BASE PHOTO. Black image with colored regions painted by the user:
${colorAssignments}
   - BLACK pixels → leave untouched

ABSOLUTE RULES (highest to lowest priority):

RULE 1 — APPLY EVERY MATERIAL THAT APPEARS IN THE MASK. All ${materials.length} colors present must visibly appear.

RULE 2 — PRESERVE OBJECTS ON OR NEAR WALLS. The mask is hand-drawn and often covers objects the user does not want replaced. Keep EXACTLY as original: paintings, frames, hooks, shelves, mirrors, clocks, switches, sockets, lamps, sconces, vents, radiators, pipes, plants, decorations, people, pets. Material flows AROUND them, never over them.

RULE 3 — SNAP TO REAL SURFACE BOUNDARIES. Even when a colored region spills onto a window/door/floor/ceiling, apply material only to the actual flat wall pixels inside the region.

RULE 4 — NEVER APPLY MATERIAL TO: windows (glass, frames, sills), doors, door frames, ceilings, floors, roofs, balconies, railings, furniture, sky, ground, plants, trees, people.

RULE 5 — PHOTOREALISTIC INSTALLATION: correct perspective, realistic scale, natural lighting and shadows from existing light sources.

RULE 6 — PRESERVE EVERYTHING OUTSIDE THE MASK pixel-identical to the original.

OUTPUT: return ONLY the final photorealistic edited image. No text, no swatches, no labels, no borders.`;
}

app.post('/api/generate-masked', async (req, res) => {
  const started = Date.now();
  try {
    const { baseImage, baseWidth, baseHeight, materials, combinedMaskImage } = req.body || {};
    if (!baseImage) return res.status(400).json({ error: 'Missing baseImage' });
    if (!combinedMaskImage) return res.status(400).json({ error: 'Missing combinedMaskImage' });
    if (!Array.isArray(materials) || materials.length === 0) return res.status(400).json({ error: 'At least one material required' });
    if (materials.length > 3) return res.status(400).json({ error: 'Max 3 materials supported' });
    if (!GEMINI_API_KEY) return res.status(500).json({ error: 'GEMINI_API_KEY is not configured' });

    const base = parseDataUrl(baseImage);
    if (!base) return res.status(400).json({ error: 'Invalid baseImage format' });
    const combinedMask = parseDataUrl(combinedMaskImage);
    if (!combinedMask) return res.status(400).json({ error: 'Invalid combinedMaskImage format' });

    console.log(`[${new Date().toISOString()}] /api/generate-masked materials=${materials.length}`);

    const parts = [{ text: buildMaskedPrompt(materials, baseWidth, baseHeight) }, { inline_data: { mime_type: base.mime, data: base.base64 } }];
    for (let i = 0; i < materials.length; i++) {
      const mm = materials[i];
      if (!mm.materialUrl || !mm.materialName || !mm.colorName) return res.status(400).json({ error: `Material ${i + 1} is incomplete` });
      const matResp = await fetch(mm.materialUrl);
      if (!matResp.ok) throw new Error(`Material ${i + 1}: failed to fetch image`);
      const matBuf = Buffer.from(await matResp.arrayBuffer());
      parts.push({ inline_data: { mime_type: mimeFromUrl(mm.materialUrl), data: matBuf.toString('base64') } });
    }
    parts.push({ inline_data: { mime_type: combinedMask.mime, data: combinedMask.base64 } });

    const url = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_IMAGE_MODEL}:generateContent?key=${GEMINI_API_KEY}`;
    const body = { contents: [{ parts }], generationConfig: { responseModalities: ['IMAGE', 'TEXT'], temperature: 0.3 } };
    const apiResp = await fetchWithRetry(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }, 'gemini-masked');
    const data = await apiResp.json();
    if (!apiResp.ok) return res.status(502).json({ error: (data && data.error && data.error.message) || `Gemini error ${apiResp.status}` });

    const resultDataUrl = extractGeminiImage(data);
    const generationTime = Date.now() - started;
    console.log(`[${new Date().toISOString()}] /api/generate-masked done in ${generationTime}ms`);
    res.json({ resultDataUrl, generationTime });
  } catch (err) {
    const msg = (err && err.message) || 'Unknown server error';
    console.error(`/api/generate-masked failed: ${msg}`);
    if (!res.headersSent) res.status(500).json({ error: msg });
  }
});

// =============================================================
// IMAGE: /api/generate-auto  (режимы «Дизайнер» и «ИИ» — без масок)
// =============================================================
function buildDesignerPrompt(materials, baseWidth, baseHeight, hint) {
  const list = materials.map((mm, i) =>
    `IMAGE ${i + 2}: MATERIAL "${mm.materialName}" — texture sample (reference only — DO NOT visually include this sample in the output)`).join('\n');
  const numMaterials = materials.length;
  const allMatNames = materials.map((mm) => `"${mm.materialName}"`).join(', ');
  const dimsText = baseWidth && baseHeight ? `exactly ${baseWidth} × ${baseHeight} pixels (same as BASE PHOTO)` : 'exactly the same width × height as BASE PHOTO';

  return `╔════════════════════════════════════════════════════════════╗
║  CRITICAL FORMAT RULES (READ FIRST — DEAL-BREAKING)        ║
╚════════════════════════════════════════════════════════════╝

You MUST produce EXACTLY ONE photographic image — the edited scene from BASE PHOTO.

❌ FORBIDDEN: grid/collage, before/after split, BASE alongside edit, material swatches anywhere, duplicated photos, text/labels/color chips/watermarks, borders/mats/frames/extra canvas.

✅ ONLY VALID OUTPUT:
   • One single photorealistic image
   • Output dimensions: ${dimsText}
   • Same aspect ratio, framing, camera angle as BASE PHOTO

The MATERIAL images are REFERENCE TEXTURES only — never include as separate visual elements.

╔════════════════════════════════════════════════════════════╗

# ROLE
You are a WORLD-CLASS INTERIOR DESIGNER (25 years; Architectural Digest, Elle Decor). Italian classical sensibility + contemporary minimalism.

# INPUT
You will receive ${1 + numMaterials} images:
- IMAGE 1 — BASE PHOTO: the real scene to redesign (interior room or facade)
${list}

# TASK
Edit the BASE PHOTO in place. Apply the ${numMaterials} material${numMaterials > 1 ? 's' : ''} (${allMatNames}) to suitable surfaces inside the scene with the taste and restraint of a top designer.${hint ? `\n\nCLIENT BRIEF: ${hint}` : ''}

# CRITICAL CONTENT REQUIREMENTS
1. USE ALL ${numMaterials} MATERIALS INSIDE THE SCENE. Never drop a material as a swatch; never skip one.
2. PRESERVE EVERY OBJECT EXACTLY: furniture, windows, doors, frames, paintings, hooks, shelves, lamps, plants, decorations, people, pets — pixel-identical. Material flows AROUND them.
3. NEVER APPLY MATERIAL TO: windows, glass, doors, frames, ceilings, floors (unless clearly a floor texture), roof, balconies, furniture, plants, sky.
4. PHOTOREALISTIC INSTALLATION: correct perspective, realistic scale, natural lighting and shadows, proper edges.

# DESIGN DECISIONS
- WHERE each material goes, HOW MUCH coverage.
- For multiple materials: hierarchy (one dominant, others accents). Distribute across DIFFERENT surfaces.

OUTPUT: return ONLY the final photorealistic edited image. No text. No swatches. No borders.`;
}

app.post('/api/generate-auto', async (req, res) => {
  const started = Date.now();
  try {
    const { baseImage, baseWidth, baseHeight, materials, hint } = req.body || {};
    if (!baseImage) return res.status(400).json({ error: 'Missing baseImage' });
    if (!Array.isArray(materials) || materials.length === 0) return res.status(400).json({ error: 'At least one material required' });
    if (materials.length > 3) return res.status(400).json({ error: 'Max 3 materials' });
    if (!GEMINI_API_KEY) return res.status(500).json({ error: 'GEMINI_API_KEY is not configured' });

    const base = parseDataUrl(baseImage);
    if (!base) return res.status(400).json({ error: 'Invalid baseImage format' });

    console.log(`[${new Date().toISOString()}] /api/generate-auto materials=${materials.length}`);

    const parts = [{ text: buildDesignerPrompt(materials, baseWidth, baseHeight, hint) }, { inline_data: { mime_type: base.mime, data: base.base64 } }];
    for (let i = 0; i < materials.length; i++) {
      const mm = materials[i];
      if (!mm.materialUrl || !mm.materialName) return res.status(400).json({ error: `Material ${i + 1} is incomplete` });
      const matResp = await fetch(mm.materialUrl);
      if (!matResp.ok) throw new Error(`Material ${i + 1}: failed to fetch image`);
      const matBuf = Buffer.from(await matResp.arrayBuffer());
      parts.push({ inline_data: { mime_type: mimeFromUrl(mm.materialUrl), data: matBuf.toString('base64') } });
    }

    const url = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_IMAGE_MODEL}:generateContent?key=${GEMINI_API_KEY}`;
    const body = { contents: [{ parts }], generationConfig: { responseModalities: ['IMAGE', 'TEXT'], temperature: 0.4 } };
    const apiResp = await fetchWithRetry(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }, 'gemini-auto');
    const data = await apiResp.json();
    if (!apiResp.ok) return res.status(502).json({ error: (data && data.error && data.error.message) || `Gemini error ${apiResp.status}` });

    const resultDataUrl = extractGeminiImage(data);
    const generationTime = Date.now() - started;
    console.log(`[${new Date().toISOString()}] /api/generate-auto done in ${generationTime}ms`);
    res.json({ resultDataUrl, generationTime });
  } catch (err) {
    const msg = (err && err.message) || 'Unknown server error';
    console.error(`/api/generate-auto failed: ${msg}`);
    if (!res.headersSent) res.status(500).json({ error: msg });
  }
});

// =============================================================
// IMAGE: /api/touchup  (локальная правка результата)
// =============================================================
function buildTouchupPrompt(materialName, baseWidth, baseHeight) {
  const dimsText = baseWidth && baseHeight ? `exactly ${baseWidth} × ${baseHeight} pixels (same as CURRENT VERSION)` : 'exactly the same width × height as CURRENT VERSION';
  return `╔════════════════════════════════════════════════════════════╗
║  CRITICAL FORMAT RULES (READ FIRST — DEAL-BREAKING)        ║
╚════════════════════════════════════════════════════════════╝

You MUST produce EXACTLY ONE photographic image — a localized edit of CURRENT VERSION.

❌ FORBIDDEN: any grid/collage, before/after, swatches in output, doubled photos, text/labels, borders.

✅ ONLY VALID OUTPUT:
   • Single photorealistic image, output dimensions: ${dimsText}
   • Same aspect ratio, framing as CURRENT VERSION
   • Everything outside the white-mask region pixel-identical to CURRENT VERSION

╔════════════════════════════════════════════════════════════╗

# ROLE
Perform a PRECISE LOCALIZED TOUCH-UP on an already-edited interior visualization. Change only the requested area; everything else stays EXACTLY as is.

# INPUT
IMAGE 1 — CURRENT VERSION: the visualization as it currently looks
IMAGE 2 — MATERIAL: texture sample of "${materialName}" (reference only — do NOT include visually)
IMAGE 3 — TOUCH-UP MASK: black image with WHITE region(s) indicating where to apply MATERIAL

# RULES
1. ZERO CHANGE OUTSIDE THE MASK. Every black-mask pixel is pixel-identical to CURRENT VERSION.
2. SEAMLESS BLEND AT MASK EDGES; match existing lighting/shadow direction.
3. SNAP TO REAL SURFACE BOUNDARIES inside the mask (don't cover windows/doors/objects within the region).
4. CONTEXT-AWARE INSTALLATION: match existing perspective, scale, lighting.

OUTPUT: return ONLY the touched-up image. Same dimensions as CURRENT VERSION. No text, no swatches, no labels, no borders.`;
}

app.post('/api/touchup', async (req, res) => {
  const started = Date.now();
  try {
    const { baseImage, baseWidth, baseHeight, materialUrl, materialName, maskImage } = req.body || {};
    if (!baseImage) return res.status(400).json({ error: 'Missing baseImage' });
    if (!materialUrl || !materialName) return res.status(400).json({ error: 'Missing material' });
    if (!maskImage) return res.status(400).json({ error: 'Missing maskImage' });
    if (!GEMINI_API_KEY) return res.status(500).json({ error: 'GEMINI_API_KEY is not configured' });

    const base = parseDataUrl(baseImage);
    if (!base) return res.status(400).json({ error: 'Invalid baseImage' });
    const mask = parseDataUrl(maskImage);
    if (!mask) return res.status(400).json({ error: 'Invalid maskImage' });

    console.log(`[${new Date().toISOString()}] /api/touchup material="${materialName}"`);

    const matResp = await fetch(materialUrl);
    if (!matResp.ok) throw new Error('Failed to fetch material image');
    const matBuf = Buffer.from(await matResp.arrayBuffer());

    const parts = [
      { text: buildTouchupPrompt(materialName, baseWidth, baseHeight) },
      { inline_data: { mime_type: base.mime, data: base.base64 } },
      { inline_data: { mime_type: mimeFromUrl(materialUrl), data: matBuf.toString('base64') } },
      { inline_data: { mime_type: mask.mime, data: mask.base64 } }
    ];
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_IMAGE_MODEL}:generateContent?key=${GEMINI_API_KEY}`;
    const body = { contents: [{ parts }], generationConfig: { responseModalities: ['IMAGE', 'TEXT'], temperature: 0.25 } };
    const apiResp = await fetchWithRetry(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }, 'touchup');
    const data = await apiResp.json();
    if (!apiResp.ok) return res.status(502).json({ error: (data && data.error && data.error.message) || `Gemini error ${apiResp.status}` });

    const resultDataUrl = extractGeminiImage(data);
    const generationTime = Date.now() - started;
    console.log(`[${new Date().toISOString()}] /api/touchup done in ${generationTime}ms`);
    res.json({ resultDataUrl, generationTime });
  } catch (err) {
    const msg = (err && err.message) || 'Unknown server error';
    console.error(`/api/touchup failed: ${msg}`);
    if (!res.headersSent) res.status(500).json({ error: msg });
  }
});

// =============================================================
// HEALTH + START
// =============================================================
app.get('/health', (_req, res) => res.json({
  ok: true,
  service: 'castelia-platform',
  text_provider: AI_TEXT_PROVIDER,
  gemini_image_model: GEMINI_IMAGE_MODEL,
  gemini_text_model: GEMINI_TEXT_MODEL,
  has_gemini_key: !!GEMINI_API_KEY,
  has_openai_key: !!OPENAI_API_KEY,
  materials: CATALOG.MATERIALS.length
}));

app.listen(PORT, () => {
  console.log(`Castelia Platform listening on http://localhost:${PORT}`);
  console.log(`  Text provider: ${AI_TEXT_PROVIDER} (${AI_TEXT_PROVIDER === 'openai' ? OPENAI_CHAT_MODEL : GEMINI_TEXT_MODEL})`);
  console.log(`  Image model:   ${GEMINI_IMAGE_MODEL}`);
  console.log(`  Catalog:       ${CATALOG.MATERIALS.length} materials`);
  if (!GEMINI_API_KEY) console.warn('WARNING: GEMINI_API_KEY is empty — generation will fail');
  if (AI_TEXT_PROVIDER === 'openai' && !OPENAI_API_KEY) console.warn('WARNING: AI_TEXT_PROVIDER=openai but OPENAI_API_KEY is empty');
});
