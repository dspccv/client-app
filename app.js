(function () {
  'use strict';

  /* =========================================================================
     CONSTANTS & CATALOGS (STEP 2: OPENROUTER CHAT SSE + MARKDOWN + FLEX)
     ========================================================================= */
  const DB_NAME = 'OpenRouterPWA_DB';
  const DB_VERSION = 1;
  const OPENROUTER_API_BASE = 'https://openrouter.ai/api/v1';

  const ALL_THINKING_LEVELS = [
    { id: 'none', label: 'None' },
    { id: 'minimal', label: 'Minimal' },
    { id: 'low', label: 'Low' },
    { id: 'medium', label: 'Medium' },
    { id: 'high', label: 'High' }
  ];

  // Fallback Gemini list used only before first successful GET /api/v1/models
  const FALLBACK_GEMINI_MODELS = [
    {
      id: 'google/gemini-2.5-pro',
      label: '2.5 Pro',
      fullName: 'Google: Gemini 2.5 Pro',
      supportsFlex: true,
      supportsReasoning: true,
      thinkingLevels: ['low', 'medium', 'high'],
      isFree: false,
      pricing: { prompt: 0, completion: 0 }
    },
    {
      id: 'google/gemini-2.5-flash',
      label: '2.5 Flash',
      fullName: 'Google: Gemini 2.5 Flash',
      supportsFlex: true,
      supportsReasoning: true,
      thinkingLevels: ['none', 'low', 'medium', 'high'],
      isFree: false,
      pricing: { prompt: 0, completion: 0 }
    },
    {
      id: 'google/gemini-2.5-flash-lite',
      label: '2.5 Flash-Lite',
      fullName: 'Google: Gemini 2.5 Flash-Lite',
      supportsFlex: true,
      supportsReasoning: true,
      thinkingLevels: ['none', 'low', 'medium', 'high'],
      isFree: false,
      pricing: { prompt: 0, completion: 0 }
    }
  ];

  const TTS_MODELS = [
    { id: 'google/gemini-3.8-flash-lite-tts', name: 'Gemini 3.8 Flash Lite TTS' },
    { id: 'google/gemini-3.8-flash-tts', name: 'Gemini 3.8 Flash TTS' },
    { id: 'x-ai/grok-voice-tts-1.0', name: 'Grok Voice TTS 1.0' },
    { id: 'elevenlabs/eleven-v4-turbo', name: 'Eleven v4 Turbo' },
    { id: 'elevenlabs-byok', name: 'ElevenLabs BYOK' }
  ];

  const STT_MODELS = [
    { id: 'openai/whisper-large-v3', name: 'Whisper Large v3' },
    { id: 'x-ai/grok-stt-2.0', name: 'Grok STT 2.0' },
    { id: 'google/gemini-3.5-transcribe', name: 'Gemini 3.5 Transcribe' }
  ];

  // Morph is fixed to Off at this stage
  const MORPH_MODES = [
    { id: 'off', name: 'Off' }
  ];

  const GEMINI_VOICES = [
    'Puck', 'Zephyr', 'Aoede', 'Charon',
    'Fenrir', 'Kore', 'Leda', 'Orus',
    'Perseus', 'Callirrhoe', 'Autonoe', 'Enceladus'
  ];

  const INITIAL_CHATS = [
    {
      id: 'chat-1',
      title: 'Фиксы Thinking, Tier-2 и карточки',
      date: 'Сегодня · 16:12',
      pinned: false,
      order: 0,
      messages: [
        {
          id: 'm1',
          role: 'user',
          timestamp: '16:08  •  25/11/26',
          collapsed: false,
          text: 'Поправь три момента: при раскрытии Thinking кнопка Flex не должна пропадать, а заголовок Thinking должен быть на том же тёмном фоне #15161a. Второй ряд кнопок над вводом в отжатом виде сделай цвета поля ввода, в нажатом — цвета кнопки Save. И плашку моего сообщения подними до #1e1f24.'
        },
        {
          id: 'm2',
          role: 'assistant',
          model: '4 Argon',
          timestamp: '16:09  •  25/11/26',
          collapsed: false,
          html: '<p>Все три правки применены строго по спецификации без лишних обводок и рамок:</p><ul><li><strong>Меню моделей и Thinking:</strong> ограничение высоты <code>.gemini-model-menu</code> привязано к <code>calc(100dvh - env(safe-area-inset-top) - 96px)</code>, а заголовок <code>Thinking level</code> и его опции объединены в единую тёмную капсулу <code>#15161a</code> — строка <code>Flex : On / Off</code> остаётся полностью видимой под ним при раскрытом списке.</li><li><strong>Кнопки Tier-2 и Save:</strong> отжатые пиллы используют <code>#2e3038</code> (в тон полю ввода), а нажатые — ровно цвета кнопки <code>Save</code> (<code>#cfd2da</code> / <code>#121316</code>).</li><li><strong>Карточка пользователя:</strong> фон <code>.msg-user-card</code> переведён на <code>#1e1f24</code> с плавным градиентом сворачивания в тот же оттенок.</li></ul>',
          plainText: 'Меню моделей расширено до calc(100dvh - env(safe-area-inset-top) - 96px), Thinking level и уровни объединены в единый блок #15161a с видимым Flex снизу; отжатые кнопки Tier-2 используют #2e3038, нажатые — цвета Save (#cfd2da / #121316); карточка пользователя переведена на #1e1f24.'
        },
        {
          id: 'm3',
          role: 'user',
          timestamp: '16:10  •  25/11/26',
          collapsed: false,
          text: 'Проверь сворачивание длинных сообщений, кнопку «•••» справа внизу для метаданных и блокировку всего интерфейса при записи с микрофона.'
        },
        {
          id: 'm4',
          role: 'assistant',
          model: '4 Hydrogen',
          timestamp: '16:11  •  25/11/26',
          collapsed: false,
          html: '<p>Нажмите стрелку справа под любым сообщением для сворачивания до 3 строк или <code>•••</code>, чтобы увидеть время и модель генерации без загромождения ленты. При прокрутке вверх по центру над доком появляется кнопка быстрого возврата вниз.</p><p>Тап по <code>#btn-mic</code> закрывает открытые панели, блокирует весь интерфейс кроме кнопки остановки, а после остановки включает фазу <code>mic-transcribing</code> на 1.6 сек со спиннером до вставки текста.</p>',
          plainText: 'Сворачивание до 3 строк и поповер ••• работают под каждым сообщением; кнопка возврата вниз появляется при скролле вверх; микрофон полностью блокирует интерфейс на время записи и транскрибации.'
        }
      ]
    },
    {
      id: 'chat-2',
      title: 'Разбор уровней H4 EUR/JPY',
      date: 'Вчера · 22:14',
      pinned: false,
      order: 1,
      messages: [
        {
          id: 'c2-m1',
          role: 'user',
          timestamp: '22:13  •  24/11/26',
          collapsed: false,
          text: 'Где ближайший пул ликвидности по EUR/JPY на H4 и стоит ли ждать слом на M15?'
        },
        {
          id: 'c2-m2',
          role: 'assistant',
          model: '4 Argon',
          timestamp: '22:14  •  24/11/26',
          collapsed: false,
          html: '<p>Сверху основной пул стопов лежит за <code>164.85</code>, ближайшая зона спроса на H4 — <code>162.40–162.75</code>. До чёткого слома структуры на M15 контртрендовый вход даёт лишний риск.</p>',
          plainText: 'Сверху пул стопов лежит за 164.85, зона спроса H4 — 162.40–162.75. Лучше ждать слом структуры на M15.'
        }
      ]
    },
    {
      id: 'chat-3',
      title: 'Сброс audioSession в iOS Safari',
      date: '24/11/26 · 18:05',
      pinned: false,
      order: 2,
      messages: [
        {
          id: 'c3-m1',
          role: 'user',
          timestamp: '18:04  •  24/11/26',
          collapsed: false,
          text: 'Как гарантированно вернуть вывод с разговорного динамика после MediaRecorder?'
        },
        {
          id: 'c3-m2',
          role: 'assistant',
          model: '3.8 Flash',
          timestamp: '18:05  •  24/11/26',
          collapsed: false,
          html: '<p>Сразу после остановки записи закрываем треки через <code>stream.getTracks().forEach(t =&gt; t.stop())</code> и перед стартом озвучки выставляем <code>navigator.audioSession.type = "playback"</code>.</p>',
          plainText: 'Закрываем все треки микрофона и перед запуском TTS выставляем navigator.audioSession.type = "playback".'
        }
      ]
    },
    {
      id: 'chat-4',
      title: 'Сравнение Gemini 3.8 TTS и Grok',
      date: '23/11/26 · 15:40',
      pinned: false,
      order: 3,
      messages: [
        {
          id: 'c4-m1',
          role: 'user',
          timestamp: '15:39  •  23/11/26',
          collapsed: false,
          text: 'Какая модель стабильнее держит русский темп на 1.20x без артефактов?'
        },
        {
          id: 'c4-m2',
          role: 'assistant',
          model: '4 Hydrogen',
          timestamp: '15:40  •  23/11/26',
          collapsed: false,
          html: '<p>На длинных ответах <code>gemini-3.8-flash-lite-tts</code> держит ровный уровень без клиентского DSP. Первый абзац до 600 знаков откусываем на быстрый старт.</p>',
          plainText: 'На длинных ответах gemini-3.8-flash-lite-tts держит ровный уровень без клиентского DSP.'
        }
      ]
    },
    {
      id: 'chat-5',
      title: '12V PWM охлаждение и Bluetti',
      date: '22/11/26 · 11:20',
      pinned: false,
      order: 4,
      messages: [
        {
          id: 'c5-m1',
          role: 'user',
          timestamp: '11:19  •  22/11/26',
          collapsed: false,
          text: 'Сколько тянут два Arctic P9 PST на 60% оборотов через ручной ШИМ?'
        },
        {
          id: 'c5-m2',
          role: 'assistant',
          model: '3.5 Flash-Lite',
          timestamp: '11:20  •  22/11/26',
          collapsed: false,
          html: '<p>Около <code>0.8–1.1 Вт</code> суммарно с потерями на контроллере — за ночь разряд минимальный.</p>',
          plainText: 'Около 0.8–1.1 Вт суммарно с потерями на контроллере.'
        }
      ]
    },
    {
      id: 'chat-6',
      title: 'Курица и брокколи в Instant Pot',
      date: '21/11/26 · 19:30',
      pinned: false,
      order: 5,
      messages: [
        {
          id: 'c6-m1',
          role: 'user',
          timestamp: '19:29  •  21/11/26',
          collapsed: false,
          text: 'Если закинуть замороженную брокколи сразу с голенями на 10 минут, развалится?'
        },
        {
          id: 'c6-m2',
          role: 'assistant',
          model: '2.5 Flash-Lite',
          timestamp: '19:30  •  21/11/26',
          collapsed: false,
          html: '<p>Да, превратится в пюре. Голени держи 10 минут на <code>High Pressure</code>, затем быстрый сброс пара и брокколи на 2–3 минуты на остаточном тепле.</p>',
          plainText: 'Да, превратится в пюре. Голени 10 минут на High Pressure, брокколи на 2–3 минуты под крышку после сброса пара.'
        }
      ]
    },
    {
      id: 'chat-7',
      title: 'Замена тормозного бустера Prius',
      date: '20/11/26 · 16:12',
      pinned: false,
      order: 6,
      messages: [
        {
          id: 'c7-m1',
          role: 'user',
          timestamp: '16:11  •  20/11/26',
          collapsed: false,
          text: 'Номер оригинального узла 47050-47180 точно идёт на рестайлинг 2015?'
        },
        {
          id: 'c7-m2',
          role: 'assistant',
          model: '4 Argon',
          timestamp: '16:12  •  20/11/26',
          collapsed: false,
          html: '<p>Да, <code>47050-47180</code> покрывает 2012–2015 Prius Gen 3. После установки обязательна линейная калибровка клапанов через Techstream.</p>',
          plainText: 'Да, 47050-47180 покрывает 2012–2015 Prius Gen 3. После замены нужна калибровка через Techstream.'
        }
      ]
    },
    {
      id: 'chat-8',
      title: 'Сценарий WAV патча sampleRate',
      date: '19/11/26 · 23:45',
      pinned: false,
      order: 7,
      messages: [
        {
          id: 'c8-m1',
          role: 'user',
          timestamp: '23:44  •  19/11/26',
          collapsed: false,
          text: 'Какие байты в заголовке RIFF WAV нужно переписать при сдвиге питча?'
        },
        {
          id: 'c8-m2',
          role: 'assistant',
          model: '4 Argon',
          timestamp: '23:45  •  19/11/26',
          collapsed: false,
          html: '<p>Перезаписываем <code>sampleRate</code> по смещению <code>24</code> и <code>byteRate</code> по смещению <code>28</code> (little-endian uint32), затем компенсируем <code>playbackRate = speed / pitch</code>.</p>',
          plainText: 'Перезаписываем sampleRate на смещении 24 и byteRate на смещении 28 (uint32 LE), затем playbackRate = speed / pitch.'
        }
      ]
    },
    {
      id: 'chat-9',
      title: 'Фонетика и редукция в английском',
      date: '18/11/26 · 13:08',
      pinned: false,
      order: 8,
      messages: [
        {
          id: 'c9-m1',
          role: 'user',
          timestamp: '13:07  •  18/11/26',
          collapsed: false,
          text: 'Как естественно звучит "going to have to" в беглой американской речи?'
        },
        {
          id: 'c9-m2',
          role: 'assistant',
          model: '4 Hydrogen',
          timestamp: '13:08  •  18/11/26',
          collapsed: false,
          html: '<p>В разговорном потоке связка схлопывается до <code>gonna hafta</code> с безударной швой на конце и мягким переходом без паузы.</p>',
          plainText: 'В беглой речи связка редуцируется до gonna hafta с безударной швой без паузы.'
        }
      ]
    },
    {
      id: 'chat-10',
      title: 'Морфинг голоса LPC для STT',
      date: '17/11/26 · 10:50',
      pinned: false,
      order: 9,
      messages: [
        {
          id: 'c10-m1',
          role: 'user',
          timestamp: '10:49  •  17/11/26',
          collapsed: false,
          text: 'Какой коэффициент МакАдамса не просаживает точность Whisper?'
        },
        {
          id: 'c10-m2',
          role: 'assistant',
          model: '3.8 Flash',
          timestamp: '10:50  •  17/11/26',
          collapsed: false,
          html: '<p>Рабочий коридор — <code>0.82–0.88</code> или <code>1.12–1.16</code> с рандомизацией на каждую запись: форманты разъезжаются нелинейно, а разборчивость речи сохраняется.</p>',
          plainText: 'Рабочий коридор — 0.82–0.88 или 1.12–1.16 с рандомизацией на каждую запись.'
        }
      ]
    },
    {
      id: 'chat-11',
      title: 'Сравнение USD/CHF и CAD/JPY на D1',
      date: '16/11/26 · 20:15',
      pinned: false,
      order: 10,
      messages: [
        {
          id: 'c11-m1',
          role: 'user',
          timestamp: '20:14  •  16/11/26',
          collapsed: false,
          text: 'Есть ли рассинхрон по корреляции между USD/CHF и DXY на дневке?'
        },
        {
          id: 'c11-m2',
          role: 'assistant',
          model: '4 Argon',
          timestamp: '20:15  •  16/11/26',
          collapsed: false,
          html: '<p>На D1 франк отрабатывает защитный спрос чуть быстрее индекса доллара — перед входом сверь реакцию на дневной зоне предложения.</p>',
          plainText: 'На D1 франк отрабатывает защитный спрос быстрее индекса доллара.'
        }
      ]
    },
    {
      id: 'chat-12',
      title: 'Схема IndexedDB для локальных чатов',
      date: '15/11/26 · 09:42',
      pinned: false,
      order: 11,
      messages: [
        {
          id: 'c12-m1',
          role: 'user',
          timestamp: '09:41  •  15/11/26',
          collapsed: false,
          text: 'Какие object stores заложить на старте, чтобы не переписывать миграции?'
        },
        {
          id: 'c12-m2',
          role: 'assistant',
          model: '4 Argon',
          timestamp: '09:42  •  15/11/26',
          collapsed: false,
          html: '<p>Три стора: <code>chats</code> (мета + updatedAt), <code>messages</code> (индекс по <code>chatId</code>) и <code>settings</code> (ключи, пресеты голоса, персоны, дневные траты).</p>',
          plainText: 'Три стора: chats, messages с индексом по chatId и settings.'
        }
      ]
    },
    {
      id: 'chat-13',
      title: 'Модульный органайзер в багажник',
      date: '14/11/26 · 17:28',
      pinned: false,
      order: 12,
      messages: [
        {
          id: 'c13-m1',
          role: 'user',
          timestamp: '17:27  •  14/11/26',
          collapsed: false,
          text: 'Какую толщину берёзовой фанеры брать под складную спальную полку?'
        },
        {
          id: 'c13-m2',
          role: 'assistant',
          model: '3.5 Flash-Lite',
          timestamp: '17:28  •  14/11/26',
          collapsed: false,
          html: '<p>Оптимальный баланс веса и жёсткости — <code>12 мм</code> с продольным ребром жёсткости; <code>15 мм</code> выдержит без ребра, но заметно тяжелее при сборке.</p>',
          plainText: 'Оптимально 12 мм с продольным ребром жёсткости либо 15 мм без ребра.'
        }
      ]
    },
    {
      id: 'chat-14',
      title: 'Полифенолы в оливковом масле',
      date: '12/11/26 · 12:04',
      pinned: false,
      order: 13,
      messages: [
        {
          id: 'c14-m1',
          role: 'user',
          timestamp: '12:03  •  12/11/26',
          collapsed: false,
          text: 'Почему горечь в горле считается маркером высокого олеокантала?'
        },
        {
          id: 'c14-m2',
          role: 'assistant',
          model: '4 Hydrogen',
          timestamp: '12:04  •  12/11/26',
          collapsed: false,
          html: '<p>Олеокантал напрямую активирует рецепторы <code>TRPA1</code> в задней части глотки — именно они дают характерное першение свежего раннего отжима.</p>',
          plainText: 'Олеокантал напрямую активирует рецепторы TRPA1 в глотке, давая характерное першение свежего масла.'
        }
      ]
    }
  ];

  /* =========================================================================
     INDEXEDDB STORAGE LAYER
     ========================================================================= */
  let dbPromise = null;

  function openDB() {
    if (dbPromise) return dbPromise;
    dbPromise = new Promise((resolve, reject) => {
      if (!window.indexedDB) {
        reject(new Error('IndexedDB unavailable'));
        return;
      }
      const req = indexedDB.open(DB_NAME, DB_VERSION);
      req.onupgradeneeded = (e) => {
        const db = e.target.result;
        if (!db.objectStoreNames.contains('kv')) {
          db.createObjectStore('kv', { keyPath: 'key' });
        }
        if (!db.objectStoreNames.contains('chats')) {
          db.createObjectStore('chats', { keyPath: 'id' });
        }
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error || new Error('IndexedDB open error'));
    });
    return dbPromise;
  }

  async function idbGet(storeName, key) {
    try {
      const db = await openDB();
      return await new Promise((resolve, reject) => {
        const tx = db.transaction(storeName, 'readonly');
        const req = tx.objectStore(storeName).get(key);
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
      });
    } catch (_) {
      return undefined;
    }
  }

  async function idbGetAll(storeName) {
    try {
      const db = await openDB();
      return await new Promise((resolve, reject) => {
        const tx = db.transaction(storeName, 'readonly');
        const req = tx.objectStore(storeName).getAll();
        req.onsuccess = () => resolve(req.result || []);
        req.onerror = () => reject(req.error);
      });
    } catch (_) {
      return [];
    }
  }

  async function idbPut(storeName, value) {
    try {
      const db = await openDB();
      return await new Promise((resolve, reject) => {
        const tx = db.transaction(storeName, 'readwrite');
        tx.objectStore(storeName).put(value);
        tx.oncomplete = () => resolve(true);
        tx.onerror = () => reject(tx.error);
      });
    } catch (_) {
      return false;
    }
  }

  async function idbDeleteMany(storeName, keys) {
    if (!keys || keys.length === 0) return true;
    try {
      const db = await openDB();
      return await new Promise((resolve, reject) => {
        const tx = db.transaction(storeName, 'readwrite');
        const store = tx.objectStore(storeName);
        keys.forEach((k) => store.delete(k));
        tx.oncomplete = () => resolve(true);
        tx.onerror = () => reject(tx.error);
      });
    } catch (_) {
      return false;
    }
  }

  /* =========================================================================
     APPLICATION STATE
     ========================================================================= */
  const state = {
    chats: JSON.parse(JSON.stringify(INITIAL_CHATS)),
    nextOrder: -1,
    activeChatId: 'chat-1',
    selectedChatIds: new Set(),
    renamingChatId: null,
    contextMenuChatId: null,
    provider: 'openrouter',

    apiKeys: {
      openrouter: '',
      customUrl: '',
      elevenlabs: ''
    },

    chatModels: JSON.parse(JSON.stringify(FALLBACK_GEMINI_MODELS)),
    modelsLoading: false,
    modelsLoadedFromApi: false,
    modelsError: '',

    modelId: FALLBACK_GEMINI_MODELS[0].id,
    modelLabel: FALLBACK_GEMINI_MODELS[0].label,
    modelSupportsFlex: FALLBACK_GEMINI_MODELS[0].supportsFlex,
    flexEnabled: false,

    thinking: 'high',
    modelThinkingExpanded: false,

    ttsId: 'google/gemini-3.8-flash-lite-tts',
    sttId: 'openai/whisper-large-v3',
    morphId: 'off',

    autoTts: false,
    activeBottomPanel: null,

    activeVoicePreset: 'Voice 1',
    voicePresets: {
      'Voice 1': { voice: 'Puck', speed: 1.15, pitch: 1.00 },
      'Voice 2': { voice: 'Zephyr', speed: 1.25, pitch: 0.96 },
      'Voice 3': { voice: 'Charon', speed: 1.00, pitch: 0.92 },
      'Voice 4': { voice: 'Fenrir', speed: 1.10, pitch: 0.88 }
    },
    voiceDraft: { voice: 'Puck', speed: 1.15, pitch: 1.00 },

    activePersonaIndex: 0,
    personas: [
      { name: '', instructions: '' },
      { name: '', instructions: '' },
      { name: '', instructions: '' },
      { name: '', instructions: '' }
    ],
    personaDraft: { name: '', instructions: '' },

    usageLog: [],
    rateLimitInfo: null,

    openPopover: null,
    openInfoMsgId: null,
    ttsPlayingMsgId: null,

    generatingMsgId: null,
    generatingChatId: null,
    abortController: null,
    streamRafId: null,

    isExpanded: false,

    micState: 'idle',
    recSeconds: 0,
    recInterval: null,
    transcribeTimer: null
  };

  /* =========================================================================
     STATE PERSISTENCE HELPERS (INDEXEDDB)
     ========================================================================= */
  let persistSettingsTimer = null;

  function buildSettingsSnapshot() {
    return {
      provider: state.provider,
      apiKeys: {
        openrouter: state.apiKeys.openrouter || '',
        customUrl: state.apiKeys.customUrl || '',
        elevenlabs: state.apiKeys.elevenlabs || ''
      },
      activeChatId: state.activeChatId,
      nextOrder: state.nextOrder,
      modelId: state.modelId,
      modelLabel: state.modelLabel,
      flexEnabled: Boolean(state.flexEnabled),
      thinking: state.thinking,
      ttsId: state.ttsId,
      sttId: state.sttId,
      morphId: 'off',
      autoTts: Boolean(state.autoTts),
      activeVoicePreset: state.activeVoicePreset,
      voicePresets: state.voicePresets,
      activePersonaIndex: state.activePersonaIndex,
      personas: state.personas
    };
  }

  function persistSettings(immediate = false) {
    const saveNow = () => {
      idbPut('kv', { key: 'settings', value: buildSettingsSnapshot() });
    };
    if (immediate) {
      clearTimeout(persistSettingsTimer);
      persistSettingsTimer = null;
      saveNow();
      return;
    }
    clearTimeout(persistSettingsTimer);
    persistSettingsTimer = setTimeout(() => {
      persistSettingsTimer = null;
      saveNow();
    }, 180);
  }

  function sanitizeChatForDB(chat) {
    return {
      id: chat.id,
      title: chat.title,
      date: chat.date,
      pinned: Boolean(chat.pinned),
      order: typeof chat.order === 'number' ? chat.order : 0,
      messages: (chat.messages || []).map((m) => ({
        id: m.id,
        role: m.role,
        model: m.model || undefined,
        timestamp: m.timestamp,
        collapsed: Boolean(m.collapsed),
        isError: m.isError ? true : undefined,
        text: m.text !== undefined ? m.text : undefined,
        html: m.html !== undefined ? m.html : undefined,
        plainText: m.plainText !== undefined ? m.plainText : undefined
      }))
    };
  }

  function persistChat(chat) {
    if (!chat || !chat.id) return;
    idbPut('chats', sanitizeChatForDB(chat));
  }

  function persistAllChats() {
    state.chats.forEach((c) => persistChat(c));
  }
  function pruneUsageLog24h() {
    const cutoff = Date.now() - 24 * 60 * 60 * 1000;
    state.usageLog = (state.usageLog || []).filter((e) => e && typeof e.ts === 'number' && e.ts >= cutoff);
  }

  function recordUsageEntry(entry) {
    if (!entry) return;
    pruneUsageLog24h();
    state.usageLog.push(Object.assign({ ts: Date.now() }, entry));
    idbPut('kv', { key: 'usageLog', value: state.usageLog });
  }

  function captureRateLimitHeaders(headers) {
    if (!headers || !headers.get) return;
    const limit = headers.get('x-ratelimit-limit');
    const remaining = headers.get('x-ratelimit-remaining');
    const reset = headers.get('x-ratelimit-reset');
    if (limit || remaining || reset) {
      state.rateLimitInfo = {
        limit: limit !== null ? Number(limit) : null,
        remaining: remaining !== null ? Number(remaining) : null,
        reset: reset !== null ? Number(reset) : null,
        updatedAt: Date.now()
      };
      idbPut('kv', { key: 'rateLimitInfo', value: state.rateLimitInfo });
    }
  }


  /* =========================================================================
     OPENROUTER GEMINI MODELS DISCOVERY & CAPABILITIES
     ========================================================================= */
  const EXCLUDED_MODEL_SUBSTRINGS = [
    '-tts',
    'tts-',
    '-transcribe',
    '-image',
    'image-preview',
    'imagen',
    'embedding',
    'live-',
    '-live',
    '-audio',
    'lyria',
    'veo'
  ];

  function isTextGeminiModel(raw) {
    if (!raw || typeof raw.id !== 'string') return false;
    const id = raw.id.toLowerCase();
    if (!id.startsWith('google/gemini-')) return false;
    if (EXCLUDED_MODEL_SUBSTRINGS.some((sub) => id.includes(sub))) return false;

    const arch = raw.architecture || {};
    if (Array.isArray(arch.output_modalities) && arch.output_modalities.length > 0) {
      if (!arch.output_modalities.includes('text')) return false;
    }
    return true;
  }

  function formatGeminiShortLabel(raw) {
    const id = raw.id || '';
    const isFree = id.endsWith(':free');
    const cleanId = id.replace(/^google\/gemini-/i, '').replace(/:free$/i, '');

    // Prefer clean name from OpenRouter title if concise, otherwise build from slug
    let base = '';
    if (raw.name && typeof raw.name === 'string') {
      base = raw.name
        .replace(/^Google:\s*/i, '')
        .replace(/^Gemini\s+/i, '')
        .replace(/\s*\(free\)\s*$/i, '')
        .trim();
    }
    if (!base) {
      base = cleanId
        .split('-')
        .map((part) => (/^\d/.test(part) ? part : part.charAt(0).toUpperCase() + part.slice(1)))
        .join(' ');
    }
    return isFree ? `${base} (:free)` : base;
  }

  function parseGeminiVersionScore(id) {
    const m = id.toLowerCase().match(/google\/gemini-(\d+(?:\.\d+)?)/);
    return m ? parseFloat(m[1]) : 0;
  }

  function deriveThinkingLevels(raw) {
    const id = (raw.id || '').toLowerCase();
    const params = Array.isArray(raw.supported_parameters)
      ? raw.supported_parameters.map((p) => String(p).toLowerCase())
      : [];

    const hasReasoningParam =
      params.includes('reasoning') ||
      params.includes('include_reasoning') ||
      params.includes('reasoning_effort');

    const isKnownThinkingId =
      id.includes('thinking') ||
      /gemini-(2\.5|3|4)/.test(id);

    // If API explicitly gave supported_parameters, trust it strictly
    const supportsReasoning = params.length > 0 ? hasReasoningParam : isKnownThinkingId;

    if (!supportsReasoning) {
      return { supportsReasoning: false, thinkingLevels: ['none'] };
    }

    const ver = parseGeminiVersionScore(id);

    // Gemini 2.5 Pro and dedicated *-thinking models cannot disable reasoning
    if (id.includes('thinking') || (/gemini-2\.5-pro/.test(id) && !id.includes('flash'))) {
      return { supportsReasoning: true, thinkingLevels: ['low', 'medium', 'high'] };
    }

    // Gemini 3.x / 4.x+ support minimal as well
    if (ver >= 3) {
      if (id.includes('pro') && !id.includes('flash')) {
        return { supportsReasoning: true, thinkingLevels: ['low', 'medium', 'high'] };
      }
      return { supportsReasoning: true, thinkingLevels: ['none', 'minimal', 'low', 'medium', 'high'] };
    }

    // Gemini 2.5 Flash / Flash-Lite and other toggleable reasoning models
    return { supportsReasoning: true, thinkingLevels: ['none', 'low', 'medium', 'high'] };
  }

  function deriveFlexSupport(raw) {
    const id = (raw.id || '').toLowerCase();
    if (id.endsWith(':free')) return false;
    const ver = parseGeminiVersionScore(id);
    // Paid Gemini 2.5+ / 3.x / 4.x can attempt Flex (Step 2 shows explicit chat error if model rejects it)
    return ver >= 2.5;
  }

  function normalizeOpenRouterGeminiModels(rawList) {
    const seen = new Set();
    const mapped = [];

    (rawList || []).forEach((raw) => {
      if (!isTextGeminiModel(raw)) return;
      if (seen.has(raw.id)) return;
      seen.add(raw.id);

      const id = raw.id;
      const isFree = id.endsWith(':free');
      const { supportsReasoning, thinkingLevels } = deriveThinkingLevels(raw);
      const supportsFlex = deriveFlexSupport(raw);
      const promptPrice = parseFloat(raw.pricing && raw.pricing.prompt) || 0;
      const completionPrice = parseFloat(raw.pricing && raw.pricing.completion) || 0;

      mapped.push({
        id,
        label: formatGeminiShortLabel(raw),
        fullName: raw.name || id,
        supportsFlex,
        supportsReasoning,
        thinkingLevels,
        isFree,
        contextLength: raw.context_length || 0,
        pricing: {
          prompt: promptPrice,
          completion: completionPrice
        }
      });
    });

    // Sort: newest version first, paid before :free, Pro/Flagship -> Flash -> Lite
    mapped.sort((a, b) => {
      const va = parseGeminiVersionScore(a.id);
      const vb = parseGeminiVersionScore(b.id);
      if (vb !== va) return vb - va;

      if (a.isFree !== b.isFree) return a.isFree ? 1 : -1;

      const tierRank = (m) => {
        const l = m.id.toLowerCase();
        if (l.includes('pro') || l.includes('ultra') || l.includes('argon')) return 0;
        if (l.includes('flash-lite') || l.includes('lite')) return 2;
        if (l.includes('flash')) return 1;
        return 3;
      };
      const ra = tierRank(a);
      const rb = tierRank(b);
      if (ra !== rb) return ra - rb;

      return a.label.localeCompare(b.label);
    });

    return mapped;
  }

  function getCurrentModelObj() {
    return (
      state.chatModels.find((m) => m.id === state.modelId) ||
      state.chatModels[0] ||
      FALLBACK_GEMINI_MODELS[0]
    );
  }

  function getAvailableThinkingLevels(modelObj) {
    const m = modelObj || getCurrentModelObj();
    const allowedIds = Array.isArray(m && m.thinkingLevels) && m.thinkingLevels.length > 0
      ? m.thinkingLevels
      : ['none'];
    return ALL_THINKING_LEVELS.filter((t) => allowedIds.includes(t.id));
  }

  function coerceThinkingForModel(modelObj) {
    const available = getAvailableThinkingLevels(modelObj);
    const ids = available.map((t) => t.id);
    if (ids.includes(state.thinking)) return;

    if (state.thinking !== 'none') {
      if (ids.includes('high')) state.thinking = 'high';
      else if (ids.includes('medium')) state.thinking = 'medium';
      else state.thinking = ids[ids.length - 1];
    } else {
      state.thinking = ids[0];
    }
  }

  function applySelectedModel(modelObj, shouldPersist = true) {
    const target = modelObj || getCurrentModelObj();
    if (!target) return;
    state.modelId = target.id;
    state.modelLabel = target.label;
    state.modelSupportsFlex = Boolean(target.supportsFlex);
    coerceThinkingForModel(target);
    syncHeaderUI();
    if (shouldPersist) persistSettings();
  }

  async function fetchGeminiModelsFromOpenRouter(showFeedback = false) {
    if (state.modelsLoading) return;
    state.modelsLoading = true;
    state.modelsError = '';

    if (state.openPopover === 'model') {
      renderModelDropdownContent();
    }

    try {
      const headers = { Accept: 'application/json' };
      const key = (state.apiKeys.openrouter || '').trim();
      if (key) {
        headers.Authorization = `Bearer ${key}`;
      }

      const resp = await fetch(`${OPENROUTER_API_BASE}/models`, {
        method: 'GET',
        headers
      });

      if (!resp.ok) {
        throw new Error(`HTTP ${resp.status}`);
      }

      const payload = await resp.json();
      const rawList = Array.isArray(payload && payload.data) ? payload.data : [];
      const geminiModels = normalizeOpenRouterGeminiModels(rawList);

      if (geminiModels.length > 0) {
        state.chatModels = geminiModels;
        state.modelsLoadedFromApi = true;

        // Re-bind current model if it exists in fresh list, else keep first available
        const existing = geminiModels.find((m) => m.id === state.modelId);
        applySelectedModel(existing || geminiModels[0], true);

        idbPut('kv', {
          key: 'cachedGeminiModels',
          value: {
            models: geminiModels,
            updatedAt: Date.now()
          }
        });

        if (showFeedback) {
          showToast(`Загружено моделей Gemini: ${geminiModels.length}`);
        }
      } else {
        state.modelsError = 'Нет текстовых моделей Gemini';
      }
    } catch (err) {
      state.modelsError = `Ошибка загрузки моделей (${err.message || 'сеть'})`;
      if (showFeedback) {
        showToast(state.modelsError);
      }
    } finally {
      state.modelsLoading = false;
      if (state.openPopover === 'model') {
        renderModelDropdownContent();
      }
      if (state.activeBottomPanel === 'stats') {
        renderStatsPanelContent();
      }
    }
  }

  /* =========================================================================
     SVG ICONS
     ========================================================================= */
  const ICONS = {
    copy: '<svg viewBox="0 0 24 24"><rect x="9" y="9" width="13" height="13" rx="2.5"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg>',
    check: '<svg viewBox="0 0 24 24"><polyline points="20 6 9 17 4 12"></polyline></svg>',
    trash: '<svg viewBox="0 0 24 24"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"></path><path d="M10 11v6"></path><path d="M14 11v6"></path><path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"></path></svg>',
    speaker: '<svg viewBox="0 0 24 24"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"></polygon><path d="M15.54 8.46a5 5 0 0 1 0 7.07"></path><path d="M19.07 4.93a10 10 0 0 1 0 14.14"></path></svg>',
    stopAudio: '<svg viewBox="0 0 24 24"><rect x="6" y="6" width="12" height="12" rx="2.5" fill="currentColor" stroke="none"></rect></svg>',
    moreDots: '<svg viewBox="0 0 24 24"><circle cx="5" cy="12" r="1.5" fill="currentColor" stroke="none"></circle><circle cx="12" cy="12" r="1.5" fill="currentColor" stroke="none"></circle><circle cx="19" cy="12" r="1.5" fill="currentColor" stroke="none"></circle></svg>',
    chevron: '<svg viewBox="0 0 24 24"><polyline points="6 9 12 15 18 9"></polyline></svg>',
    chevronRight: '<svg viewBox="0 0 24 24"><polyline points="9 6 15 12 9 18"></polyline></svg>',
    flexBolt: '<svg viewBox="0 0 24 24"><polygon points="13 2 4 14 12 14 11 22 20 10 12 10 13 2"></polygon></svg>',
    mddCheck: '<svg class="mdd-check" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>',
    editPencil: '<svg viewBox="0 0 24 24"><path d="M12 20h9"></path><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4 12.5-12.5z"></path></svg>',
    pushpin: '<svg viewBox="0 0 24 24"><path d="M12 17v5"></path><path d="M9 10.76a2 2 0 0 1-1.11 1.79l-1.78.9A2 2 0 0 0 5 15.24V16a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-.76a2 2 0 0 0-1.11-1.79l-1.78-.9A2 2 0 0 1 15 10.76V7a1 1 0 0 1 1-1 2 2 0 0 0 0-4H8a2 2 0 0 0 0 4 1 1 0 0 1 1 1z"></path></svg>',
    micIdle: '<rect x="9" y="2" width="6" height="12" rx="3"></rect><path d="M5 10a7 7 0 0 0 14 0"></path><line x1="12" y1="19" x2="12" y2="22"></line>',
    micStop: '<rect x="7" y="7" width="10" height="10" rx="2.4" fill="currentColor" stroke="none"></rect>',
    micSpinner: '<circle cx="12" cy="12" r="8.5" stroke="currentColor" stroke-width="2.3" stroke-opacity="0.22" fill="none"></circle><path d="M12 3.5a8.5 8.5 0 0 1 8.5 8.5" stroke="currentColor" stroke-width="2.3" stroke-linecap="round" fill="none"></path>'
  };

  /* =========================================================================
     DOM REFERENCES
     ========================================================================= */
  const appShell = document.getElementById('appShell');
  const chatFeed = document.getElementById('chatFeed');
  const dockScrim = document.getElementById('dockScrim');
  const bottomDock = document.getElementById('bottomDock');
  const tier2Row = document.getElementById('tier2Row');
  const floatingPanelsLayer = document.getElementById('floatingPanelsLayer');
  const scrollBottomBtn = document.getElementById('scrollBottomBtn');

  const composerCapsule = document.getElementById('composerCapsule');
  const composerInputWrap = document.getElementById('composerInputWrap');
  const chatInput = document.getElementById('chatInput');
  const clearInputBtn = document.getElementById('btn-clear-input');
  const sendBtn = document.getElementById('btn-send');
  const sendIconSvg = document.getElementById('sendIconSvg');
  const micBtn = document.getElementById('btn-mic');
  const micIconSvg = document.getElementById('micIconSvg');
  const micStatusBar = document.getElementById('micStatusBar');
  const recDot = document.getElementById('recDot');
  const micStatusTimer = document.getElementById('micStatusTimer');
  const micStatusHint = document.getElementById('micStatusHint');

  const modelBtnLabel = document.getElementById('modelBtnLabel');
  const thinkingBtnLabel = document.getElementById('thinkingBtnLabel');

  const statsDropdownBtn = document.getElementById('statsDropdownBtn');
  const personaDockBtn = document.getElementById('personaDockBtn');
  const personaDockLabel = document.getElementById('personaDockLabel');
  const audioDockBtn = document.getElementById('audioDockBtn');
  const autoTtsBtn = document.getElementById('autoTtsBtn');

  const statsPanel = document.getElementById('statsPanel');
  const audioPanel = document.getElementById('audioPanel');
  const saveVoicePresetBtn = document.getElementById('saveVoicePresetBtn');
  const ttsSelectLabel = document.getElementById('ttsSelectLabel');
  const voiceSelectLabel = document.getElementById('voiceSelectLabel');
  const sttSelectLabel = document.getElementById('sttSelectLabel');
  const morphSelectLabel = document.getElementById('morphSelectLabel');
  const speedSlider = document.getElementById('speedSlider');
  const pitchSlider = document.getElementById('pitchSlider');
  const speedVal = document.getElementById('speedVal');
  const pitchVal = document.getElementById('pitchVal');

  const personaPanel = document.getElementById('personaPanel');
  const savePersonaPresetBtn = document.getElementById('savePersonaPresetBtn');
  const personaNameInput = document.getElementById('personaNameInput');
  const personaTextareaWrap = document.getElementById('personaTextareaWrap');
  const personaInstructionsInput = document.getElementById('personaInstructionsInput');
  const clearPersonaBtn = document.getElementById('btn-clear-persona');

  const orKeyInput = document.getElementById('orKeyInput');
  const customUrlInput = document.getElementById('customUrlInput');
  const elevenKeyInput = document.getElementById('elevenKeyInput');

  const popoverBackdrop = document.getElementById('popoverBackdrop');
  const popoverMenu = document.getElementById('popoverMenu');

  const ctxBackdrop = document.getElementById('ctxBackdrop');
  const ctxMenu = document.getElementById('ctxMenu');

  const drawer = document.getElementById('drawer');
  const drawerBackdrop = document.getElementById('drawerBackdrop');
  const chatListEl = document.getElementById('chatList');
  const selCountBadge = document.getElementById('selCountBadge');
  const bulkDeleteBtn = document.getElementById('bulkDeleteBtn');

  const toastEl = document.getElementById('toast');
  let toastTimer = null;

  const measureCanvas = document.createElement('canvas');
  const measureCtx = measureCanvas.getContext('2d');

  /* =========================================================================
     GLOBAL iOS SELECTION & CALLOUT LOCK
     ========================================================================= */
  function clearWindowSelection() {
    try {
      const sel = window.getSelection ? window.getSelection() : null;
      if (sel && sel.rangeCount > 0) sel.removeAllRanges();
    } catch (_) {}
  }

  function isEditableTarget(el) {
    if (!el) return false;
    const node = el.nodeType === 1 ? el : el.parentElement;
    if (!node) return false;
    return node.tagName === 'INPUT' || node.tagName === 'TEXTAREA' || Boolean(node.isContentEditable);
  }

  document.addEventListener('selectstart', (e) => {
    if (isEditableTarget(e.target)) return;
    const el = e.target && e.target.nodeType === 1 ? e.target : (e.target ? e.target.parentElement : null);
    if (document.body.classList.contains('drawer-open') || !el || !el.closest('.msg-body')) {
      e.preventDefault();
      clearWindowSelection();
    }
  }, true);

  document.addEventListener('contextmenu', (e) => {
    if (isEditableTarget(e.target)) return;
    const el = e.target && e.target.nodeType === 1 ? e.target : (e.target ? e.target.parentElement : null);
    if (
      document.body.classList.contains('drawer-open') ||
      !el ||
      el.closest('.drawer, .drawer-backdrop, .chat-item, .top-header, .bottom-dock, .floating-panels-layer, .dock-scrim, .popover-menu, .popover-backdrop, .ctx-menu, .ctx-backdrop')
    ) {
      e.preventDefault();
    }
  }, true);

  document.addEventListener('selectionchange', () => {
    const active = document.activeElement;
    const activeEditable = active && (active.tagName === 'INPUT' || active.tagName === 'TEXTAREA');
    if (document.body.classList.contains('drawer-open') && !activeEditable) {
      clearWindowSelection();
    }
  });

  drawerBackdrop.addEventListener('touchstart', clearWindowSelection, { passive: true });

  /* =========================================================================
     UTILITIES
     ========================================================================= */
  function showToast(msg) {
    toastEl.textContent = msg;
    toastEl.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => {
      toastEl.classList.remove('show');
    }, 2000);
  }

  function formatCompactTimestamp(date) {
    const hh = String(date.getHours()).padStart(2, '0');
    const mm = String(date.getMinutes()).padStart(2, '0');
    const dd = String(date.getDate()).padStart(2, '0');
    const mo = String(date.getMonth() + 1).padStart(2, '0');
    const yy = String(date.getFullYear()).slice(-2);
    return `${hh}:${mm}  •  ${dd}/${mo}/${yy}`;
  }

  function formatMMSS(sec) {
    const m = Math.floor(sec / 60);
    const s = String(sec % 60).padStart(2, '0');
    return `${m}:${s}`;
  }

  function getActiveChat() {
    return state.chats.find((c) => c.id === state.activeChatId) || state.chats[0] || null;
  }

  function copyToClipboard(text) {
    try {
      const ta = document.createElement('textarea');
      ta.value = text;
      ta.setAttribute('readonly', '');
      ta.style.position = 'fixed';
      ta.style.top = '-9999px';
      ta.style.opacity = '0';
      document.body.appendChild(ta);
      ta.focus();
      ta.select();
      document.execCommand('copy');
      document.body.removeChild(ta);
    } catch (_) {}
  }

  function escapeHtml(str) {
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function pluralChats(n) {
    const mod10 = n % 10;
    const mod100 = n % 100;
    if (mod10 === 1 && mod100 !== 11) return `${n} чат`;
    if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return `${n} чата`;
    return `${n} чатов`;
  }

  function sortChatsPinnedFirst() {
    state.chats.sort((a, b) => {
      if (Boolean(a.pinned) !== Boolean(b.pinned)) {
        return a.pinned ? -1 : 1;
      }
      return a.order - b.order;
    });
  }

  function syncFloatingPanelsPosition() {
    const rect = tier2Row.getBoundingClientRect();
    if (!rect.height) return;
    const bottomOffset = Math.max(120, Math.round(window.innerHeight - rect.top + 10));
    floatingPanelsLayer.style.setProperty('--panels-bottom', `${bottomOffset}px`);
  }

  /* =========================================================================
     FULL-APP UI LOCK DURING MIC RECORDING & TRANSCRIPTION
     ========================================================================= */
  function applyAppMicLock(mode) {
    state.micState = mode;
    const isRecording = mode === 'recording';
    const isTranscribing = mode === 'transcribing';
    const isLocked = isRecording || isTranscribing;

    document.body.classList.toggle('mic-recording', isRecording);
    document.body.classList.toggle('mic-transcribing', isTranscribing);

    appShell.querySelectorAll('button, input, textarea').forEach((el) => {
      if (el === micBtn) {
        el.disabled = isTranscribing;
        if (isTranscribing) el.setAttribute('aria-disabled', 'true');
        else el.removeAttribute('aria-disabled');
        return;
      }
      el.disabled = isLocked;
      if (isLocked) el.setAttribute('aria-disabled', 'true');
      else el.removeAttribute('aria-disabled');
    });

    micBtn.classList.toggle('recording', isRecording);
    micBtn.classList.toggle('transcribing', isTranscribing);

    if (isRecording) {
      micIconSvg.classList.remove('mic-spinner-svg');
      micIconSvg.innerHTML = ICONS.micStop;
      micBtn.setAttribute('aria-label', 'Остановить запись');
      chatInput.style.display = 'none';
      micStatusBar.classList.add('active');
      recDot.classList.remove('hidden');
      micStatusTimer.style.display = 'inline';
      micStatusHint.textContent = 'Запись…';
    } else if (isTranscribing) {
      micIconSvg.classList.add('mic-spinner-svg');
      micIconSvg.innerHTML = ICONS.micSpinner;
      micBtn.setAttribute('aria-label', 'Транскрибация…');
      chatInput.style.display = 'none';
      micStatusBar.classList.add('active');
      recDot.classList.add('hidden');
      micStatusTimer.style.display = 'none';
      micStatusHint.textContent = 'Транскрибация…';
    } else {
      micIconSvg.classList.remove('mic-spinner-svg');
      micIconSvg.innerHTML = ICONS.micIdle;
      micBtn.setAttribute('aria-label', 'Микрофон');
      micStatusBar.classList.remove('active');
      chatInput.style.display = 'block';
    }

    updateComposerLayout();
    syncSendButton();
  }

  /* =========================================================================
     iOS VISUAL VIEWPORT KEYBOARD ANCHORING
     ========================================================================= */
  if (window.visualViewport) {
    const syncViewport = () => {
      const vv = window.visualViewport;
      appShell.style.height = `${vv.height}px`;
      appShell.style.top = `${vv.offsetTop}px`;
      const kbOffset = Math.max(0, window.innerHeight - vv.height - vv.offsetTop);
      bottomDock.style.bottom = `${kbOffset}px`;
      window.scrollTo(0, 0);
      syncFloatingPanelsPosition();
      updateScrollBottomBtn();
    };
    window.visualViewport.addEventListener('resize', syncViewport);
    window.visualViewport.addEventListener('scroll', syncViewport);
  }

  /* =========================================================================
     SCROLL-TO-BOTTOM FLOATING BUTTON VISIBILITY
     ========================================================================= */
  function updateScrollBottomBtn() {
    const distFromBottom = chatFeed.scrollHeight - chatFeed.scrollTop - chatFeed.clientHeight;
    const shouldShow =
      distFromBottom > 70 &&
      !state.activeBottomPanel &&
      state.micState === 'idle';
    scrollBottomBtn.classList.toggle('visible', shouldShow);
  }

  chatFeed.addEventListener('scroll', updateScrollBottomBtn, { passive: true });
  scrollBottomBtn.addEventListener('click', () => {
    if (state.micState !== 'idle') return;
    chatFeed.scrollTo({ top: chatFeed.scrollHeight, behavior: 'smooth' });
  });

  /* =========================================================================
     COMPOSER AUTO-EXPAND / AUTO-COLLAPSE + CLEAR (×) BUTTON
     ========================================================================= */
  function getAvailSingleWidth() {
    const capW = composerCapsule.clientWidth;
    if (!capW) return 112;
    return Math.max(44, capW - 22 - 150 - 24 - 28);
  }

  function measureTextSingleLine(text) {
    if (!measureCtx || !text) return 0;
    const cs = window.getComputedStyle(chatInput);
    const weight = cs.fontWeight || '400';
    const size = cs.fontSize || '18px';
    const family = cs.fontFamily || '"Google Sans", "Inter", -apple-system, BlinkMacSystemFont, sans-serif';
    measureCtx.font = `${weight} ${size} ${family}`;
    return measureCtx.measureText(text).width + 6;
  }

  function updateComposerLayout() {
    const isMicActive = state.micState !== 'idle';
    const hasAnyText = !isMicActive && chatInput.value.length > 0;
    composerInputWrap.classList.toggle('has-text', hasAnyText);

    if (!hasAnyText) {
      composerCapsule.classList.remove('is-expanded');
      state.isExpanded = false;
      chatInput.style.height = '';
      syncFloatingPanelsPosition();
      return;
    }

    const val = chatInput.value;
    const hasNewline = val.includes('\n');
    const availSingleWidth = getAvailSingleWidth();
    const measuredWidth = hasNewline ? Infinity : measureTextSingleLine(val);
    const threshold = state.isExpanded ? (availSingleWidth - 18) : (availSingleWidth - 4);

    if (!hasNewline && measuredWidth <= threshold) {
      composerCapsule.classList.remove('is-expanded');
      state.isExpanded = false;
      chatInput.style.height = '';
      syncFloatingPanelsPosition();
      return;
    }

    composerCapsule.classList.add('is-expanded');
    state.isExpanded = true;
    chatInput.style.height = 'auto';
    const targetHeight = Math.min(chatInput.scrollHeight, 156);
    chatInput.style.height = `${Math.max(25, targetHeight)}px`;
    syncFloatingPanelsPosition();
  }

  clearInputBtn.addEventListener('pointerdown', (e) => {
    if (state.micState !== 'idle') return;
    e.preventDefault();
  });

  clearInputBtn.addEventListener('click', () => {
    if (state.micState !== 'idle') return;
    chatInput.value = '';
    updateComposerLayout();
    syncSendButton();
    chatInput.focus();
  });

  window.addEventListener('resize', () => {
    updateComposerLayout();
    syncFloatingPanelsPosition();
    updateScrollBottomBtn();
  });
  if (document.fonts && document.fonts.ready) {
    document.fonts.ready.then(() => {
      updateComposerLayout();
      syncFloatingPanelsPosition();
    });
  }

  /* =========================================================================
     1. HEADER SYNC (OMITS REASONING LEVEL WHEN "None")
     ========================================================================= */
  function syncHeaderUI() {
    const curModel = getCurrentModelObj();
    modelBtnLabel.textContent = curModel ? curModel.label : state.modelLabel;

    const availableLevels = getAvailableThinkingLevels(curModel);
    if (state.thinking === 'none' || availableLevels.length <= 1 && availableLevels[0].id === 'none') {
      thinkingBtnLabel.textContent = '';
      thinkingBtnLabel.classList.add('hidden');
    } else {
      const thinkObj = availableLevels.find((t) => t.id === state.thinking) || availableLevels[availableLevels.length - 1];
      thinkingBtnLabel.textContent = thinkObj ? thinkObj.label : '';
      thinkingBtnLabel.classList.toggle('hidden', !thinkObj || thinkObj.id === 'none');
    }
  }

  /* =========================================================================
     4. DECOUPLED BOTTOM OVERLAY PANELS — SINGLE-PASS ZERO FLICKER
     ========================================================================= */
  function renderStatsPanelContent() {
    const ttsName = (TTS_MODELS.find((t) => t.id === state.ttsId) || TTS_MODELS[0]).name;
    const sttName = (STT_MODELS.find((s) => s.id === state.sttId) || STT_MODELS[0]).name;
    statsPanel.innerHTML = `
      <div class="stats-card">
        <div class="stats-top-row">
          <div>
            <div class="stats-balance-lbl">Остаток OpenRouter</div>
            <div class="stats-balance-val">$0.000</div>
          </div>
          <div style="text-align:right;">
            <div class="stats-balance-lbl">За 24ч</div>
            <div style="font-size:15px;font-weight:500;color:var(--menu-active-text);">$0.000</div>
          </div>
        </div>

        <div class="stats-quota-box">
          <span style="color:var(--text-level);">Детализация 24ч</span>
          <span style="color:var(--menu-active-text);font-weight:500;">Шаг 3</span>
        </div>

        <div class="stats-table stats-table-scroll">
          <div class="stats-row">
            <div style="min-width:0;">
              <div class="stats-row-name">Chat · ${escapeHtml(state.modelLabel)}</div>
              <div class="stats-row-sub">0 tok</div>
            </div>
            <div class="stats-row-val">$0.000</div>
          </div>
          <div class="stats-row">
            <div style="min-width:0;">
              <div class="stats-row-name">TTS · ${escapeHtml(ttsName)}</div>
              <div class="stats-row-sub">0 симв</div>
            </div>
            <div class="stats-row-val">$0.000</div>
          </div>
          <div class="stats-row">
            <div style="min-width:0;">
              <div class="stats-row-name">STT · ${escapeHtml(sttName)}</div>
              <div class="stats-row-sub">0 сек</div>
            </div>
            <div class="stats-row-val">$0.000</div>
          </div>
        </div>
      </div>`;
  }

  function setBottomPanel(nextPanel) {
    if (state.micState !== 'idle' && nextPanel !== null) return;

    if (state.openPopover) {
      closePopover();
    }

    if (nextPanel === 'stats') {
      renderStatsPanelContent();
    }

    state.activeBottomPanel = nextPanel;

    if (nextPanel !== null) {
      syncFloatingPanelsPosition();
    }

    const isStats = nextPanel === 'stats';
    const isAudio = nextPanel === 'audio';
    const isPersona = nextPanel === 'persona';

    statsPanel.classList.toggle('open', isStats);
    audioPanel.classList.toggle('open', isAudio);
    personaPanel.classList.toggle('open', isPersona);
    dockScrim.classList.toggle('visible', nextPanel !== null);

    statsDropdownBtn.classList.toggle('is-active', isStats);
    audioDockBtn.classList.toggle('is-active', isAudio);
    personaDockBtn.classList.toggle('is-active', isPersona);

    updateScrollBottomBtn();
  }

  function toggleBottomPanel(panelName) {
    if (state.micState !== 'idle') return;
    const wasOpen = state.activeBottomPanel === panelName;
    setBottomPanel(wasOpen ? null : panelName);
  }

  statsDropdownBtn.addEventListener('click', () => toggleBottomPanel('stats'));
  audioDockBtn.addEventListener('click', () => toggleBottomPanel('audio'));
  personaDockBtn.addEventListener('click', () => toggleBottomPanel('persona'));
  dockScrim.addEventListener('click', () => setBottomPanel(null));

  /* =========================================================================
     2. POPOVERS: DYNAMIC GEMINI MODELS, PER-MODEL THINKING, FLEX, AUDIO, •••
     ========================================================================= */
  function closePopover() {
    state.openPopover = null;
    state.openInfoMsgId = null;
    popoverMenu.classList.remove('open', 'drop-up', 'gemini-model-menu', 'selector-menu', 'info-popover');
    popoverBackdrop.classList.remove('visible');
    document.querySelectorAll('.gemini-model-trigger.open, .panel-select-btn.open, .msg-icon-btn.info-open').forEach((el) => {
      el.classList.remove('open', 'info-open');
    });
  }

  function positionPopover(anchorEl, opts = {}) {
    const {
      align = 'left',
      dropUp = false,
      autoFlip = false,
      matchWidth = false,
      fixedWidth = null
    } = opts;

    const shellRect = appShell.getBoundingClientRect();
    const rect = anchorEl.getBoundingClientRect();

    popoverMenu.style.top = 'auto';
    popoverMenu.style.bottom = 'auto';
    popoverMenu.style.left = 'auto';
    popoverMenu.style.right = 'auto';
    popoverMenu.style.width = fixedWidth ? `${fixedWidth}px` : (matchWidth ? `${Math.max(rect.width, 210)}px` : 'auto');

    const measuredH = popoverMenu.offsetHeight || 160;
    const measuredW = fixedWidth || popoverMenu.offsetWidth || 240;

    let shouldDropUp = dropUp;
    if (autoFlip) {
      const spaceBelow = shellRect.bottom - rect.bottom - 12;
      const spaceAbove = rect.top - shellRect.top - 12;
      if (spaceBelow < measuredH + 10 && spaceAbove > spaceBelow) {
        shouldDropUp = true;
      }
    }

    if (shouldDropUp) {
      popoverMenu.classList.add('drop-up');
      const bottomOffset = shellRect.bottom - rect.top + 8;
      popoverMenu.style.bottom = `${bottomOffset}px`;
    } else {
      popoverMenu.classList.remove('drop-up');
      popoverMenu.style.top = `${rect.bottom - shellRect.top + 8}px`;
    }

    if (align === 'center') {
      const leftOffset = Math.max(10, Math.round((shellRect.width - measuredW) / 2));
      popoverMenu.style.left = `${leftOffset}px`;
    } else if (align === 'right') {
      const rightOffset = Math.max(10, shellRect.right - rect.right);
      popoverMenu.style.right = `${rightOffset}px`;
    } else {
      let leftOffset = rect.left - shellRect.left;
      const maxLeft = shellRect.width - measuredW - 10;
      leftOffset = Math.max(10, Math.min(leftOffset, Math.max(10, maxLeft)));
      popoverMenu.style.left = `${leftOffset}px`;
    }
  }

  function renderModelDropdownContent() {
    const curModel = getCurrentModelObj();
    const availableLevels = getAvailableThinkingLevels(curModel);
    const hasThinkingControl = availableLevels.length > 1;
    const thinkObj = availableLevels.find((t) => t.id === state.thinking) || availableLevels[0];

    const flexAvailable = Boolean(curModel && curModel.supportsFlex);
    const flexOn = flexAvailable && state.flexEnabled;
    const flexClass = !flexAvailable ? 'is-disabled' : (flexOn ? 'is-on' : '');
    const flexText = !flexAvailable ? 'Flex : N/A' : (flexOn ? 'Flex : On' : 'Flex : Off');

    let statusText = '';
    if (state.modelsLoading) {
      statusText = 'Загрузка Gemini…';
    } else if (state.modelsError) {
      statusText = state.modelsError;
    } else {
      statusText = `Gemini · ${state.chatModels.length}`;
    }

    let html = '<div class="mdd-list">';

    html += `
      <div class="mdd-status-row">
        <span>${escapeHtml(statusText)}</span>
        <button class="mdd-refresh-btn" id="mddRefreshModelsBtn" type="button" ${state.modelsLoading ? 'disabled' : ''}>Обновить</button>
      </div>`;

    state.chatModels.forEach((m) => {
      const sel = state.modelId === m.id ? 'selected' : '';
      html += `
        <button class="model-opt ${sel}" data-select-model="${escapeHtml(m.id)}" title="${escapeHtml(m.id)}">
          <span>${escapeHtml(m.label)}</span>
          ${ICONS.mddCheck}
        </button>`;
    });

    /* Unified #15161a container for Thinking header AND model-specific options */
    const thinkExpanded = hasThinkingControl && state.modelThinkingExpanded;
    html += `
      <div class="mdd-thinking-group">
        <button class="mdd-thinking-btn ${thinkExpanded ? 'expanded' : ''} ${!hasThinkingControl ? 'is-disabled' : ''}" id="mddThinkingToggle" aria-expanded="${thinkExpanded}" ${!hasThinkingControl ? 'aria-disabled="true"' : ''}>
          <span class="mdd-thinking-chev">${ICONS.chevronRight}</span>
          <span>Thinking level</span>
          <span class="mdd-thinking-current">${escapeHtml(hasThinkingControl ? thinkObj.label : 'Off')}</span>
        </button>
        <div class="mdd-thinking-panel ${thinkExpanded ? 'expanded' : ''}" id="mddThinkingPanel">
          <div class="mdd-thinking-inner">
            <div class="mdd-thinking-list">`;

    availableLevels.forEach((t) => {
      const sel = state.thinking === t.id ? 'selected' : '';
      html += `
              <button class="mdd-think-opt ${sel}" data-select-think="${t.id}">
                <span>${t.label}</span>
                ${ICONS.mddCheck}
              </button>`;
    });

    html += `
            </div>
          </div>
        </div>
      </div>`;

    /* Flat Flex row directly on #1e1f24 below Thinking container */
    html += `
      <button class="mdd-flex-item ${flexClass}" id="mddFlexToggle" role="switch" aria-checked="${flexOn}" ${!flexAvailable ? 'aria-disabled="true"' : ''}>
        <span class="mdd-flex-left">
          <span class="mdd-flex-icon" aria-hidden="true">${ICONS.flexBolt}</span>
          <span>${flexText}</span>
        </span>
        ${flexOn ? ICONS.mddCheck : ''}
      </button>`;

    html += '</div>';
    popoverMenu.innerHTML = html;

    const refreshBtn = document.getElementById('mddRefreshModelsBtn');
    if (refreshBtn) {
      refreshBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        fetchGeminiModelsFromOpenRouter(true);
      });
    }

    popoverMenu.querySelectorAll('[data-select-model]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const found = state.chatModels.find((m) => m.id === btn.dataset.selectModel);
        if (!found) return;
        applySelectedModel(found, true);
        closePopover();
      });
    });

    const thinkBtn = document.getElementById('mddThinkingToggle');
    const thinkPanel = document.getElementById('mddThinkingPanel');
    if (thinkBtn && hasThinkingControl) {
      thinkBtn.addEventListener('click', () => {
        state.modelThinkingExpanded = !state.modelThinkingExpanded;
        thinkBtn.classList.toggle('expanded', state.modelThinkingExpanded);
        thinkBtn.setAttribute('aria-expanded', String(state.modelThinkingExpanded));
        thinkPanel.classList.toggle('expanded', state.modelThinkingExpanded);
      });
    }

    popoverMenu.querySelectorAll('[data-select-think]').forEach((btn) => {
      btn.addEventListener('click', () => {
        state.thinking = btn.dataset.selectThink;
        syncHeaderUI();
        persistSettings();
        renderModelDropdownContent();
      });
    });

    const flexBtn = document.getElementById('mddFlexToggle');
    if (flexBtn) {
      flexBtn.addEventListener('click', () => {
        if (!flexAvailable) return;
        state.flexEnabled = !state.flexEnabled;
        persistSettings();
        renderModelDropdownContent();
      });
    }
  }

  function openPopover(type, anchorEl, payload = null) {
    if (state.micState !== 'idle') return;

    if (type === 'info' && state.openPopover === 'info' && state.openInfoMsgId === payload.id) {
      closePopover();
      return;
    }
    if (type !== 'info' && state.openPopover === type) {
      closePopover();
      return;
    }

    if (type === 'model' || type === 'info') {
      setBottomPanel(null);
    }

    closePopover();
    state.openPopover = type;

    if (type === 'model') {
      state.modelThinkingExpanded = false;
      anchorEl.classList.add('open');
      popoverMenu.classList.add('gemini-model-menu');
      renderModelDropdownContent();
      positionPopover(anchorEl, { align: 'center', fixedWidth: 268 });
    }

    if (type === 'tts') {
      anchorEl.classList.add('open');
      popoverMenu.classList.add('selector-menu');
      let html = '<div class="mdd-list">';
      TTS_MODELS.forEach((t) => {
        const sel = state.ttsId === t.id ? 'selected' : '';
        html += `
          <button class="model-opt ${sel}" data-select-tts="${escapeHtml(t.id)}">
            <span>${escapeHtml(t.name)}</span>
            ${ICONS.mddCheck}
          </button>`;
      });
      html += '</div>';
      popoverMenu.innerHTML = html;
      positionPopover(anchorEl, { align: 'left', dropUp: true, matchWidth: true });

      popoverMenu.querySelectorAll('[data-select-tts]').forEach((btn) => {
        btn.addEventListener('click', () => {
          state.ttsId = btn.dataset.selectTts;
          syncAudioPanelUI();
          persistSettings();
          closePopover();
        });
      });
    }

    if (type === 'voice') {
      anchorEl.classList.add('open');
      popoverMenu.classList.add('selector-menu');
      const currentVoice = state.voiceDraft.voice;
      let html = '<div class="mdd-list">';
      GEMINI_VOICES.forEach((v) => {
        const sel = currentVoice === v ? 'selected' : '';
        html += `
          <button class="model-opt ${sel}" data-select-voice="${v}">
            <span>${v}</span>
            ${ICONS.mddCheck}
          </button>`;
      });
      html += '</div>';
      popoverMenu.innerHTML = html;
      positionPopover(anchorEl, { align: 'left', dropUp: true, matchWidth: true });

      popoverMenu.querySelectorAll('[data-select-voice]').forEach((btn) => {
        btn.addEventListener('click', () => {
          state.voiceDraft.voice = btn.dataset.selectVoice;
          syncAudioPanelUI();
          closePopover();
        });
      });
    }

    if (type === 'stt') {
      anchorEl.classList.add('open');
      popoverMenu.classList.add('selector-menu');
      let html = '<div class="mdd-list">';
      STT_MODELS.forEach((s) => {
        const sel = state.sttId === s.id ? 'selected' : '';
        html += `
          <button class="model-opt ${sel}" data-select-stt="${escapeHtml(s.id)}">
            <span>${escapeHtml(s.name)}</span>
            ${ICONS.mddCheck}
          </button>`;
      });
      html += '</div>';
      popoverMenu.innerHTML = html;
      positionPopover(anchorEl, { align: 'left', dropUp: true, matchWidth: true });

      popoverMenu.querySelectorAll('[data-select-stt]').forEach((btn) => {
        btn.addEventListener('click', () => {
          state.sttId = btn.dataset.selectStt;
          syncAudioPanelUI();
          persistSettings();
          closePopover();
        });
      });
    }

    if (type === 'morph') {
      anchorEl.classList.add('open');
      popoverMenu.classList.add('selector-menu');
      let html = '<div class="mdd-list">';
      MORPH_MODES.forEach((m) => {
        const sel = state.morphId === m.id ? 'selected' : '';
        html += `
          <button class="model-opt ${sel}" data-select-morph="${m.id}">
            <span>${m.name}</span>
            ${ICONS.mddCheck}
          </button>`;
      });
      html += '</div>';
      popoverMenu.innerHTML = html;
      positionPopover(anchorEl, { align: 'left', dropUp: true, matchWidth: true });

      popoverMenu.querySelectorAll('[data-select-morph]').forEach((btn) => {
        btn.addEventListener('click', () => {
          state.morphId = 'off';
          syncAudioPanelUI();
          persistSettings();
          closePopover();
        });
      });
    }

    if (type === 'info' && payload) {
      state.openInfoMsgId = payload.id;
      anchorEl.classList.add('info-open', 'active');
      popoverMenu.classList.add('info-popover');

      let html = '<div class="info-pop-stack">';
      html += `<div class="info-pop-time">${escapeHtml(payload.timestamp)}</div>`;
      if (payload.role === 'assistant') {
        const modelName = payload.model || state.modelLabel;
        html += `<div class="info-pop-model">Модель: <strong>${escapeHtml(modelName)}</strong></div>`;
      }
      html += '</div>';

      popoverMenu.innerHTML = html;
      positionPopover(anchorEl, { align: 'right', autoFlip: true });
    }

    popoverBackdrop.classList.add('visible');
    popoverMenu.classList.add('open');
  }

  document.querySelectorAll('[data-popover]').forEach((btn) => {
    btn.addEventListener('click', (e) => {
      if (state.micState !== 'idle') return;
      e.stopPropagation();
      openPopover(btn.dataset.popover, btn);
    });
  });

  popoverBackdrop.addEventListener('click', closePopover);
  document.addEventListener('keydown', (e) => {
    if (state.micState !== 'idle') return;
    if (e.key === 'Escape') {
      if (state.contextMenuChatId) {
        closeContextMenu();
      } else if (state.openPopover) {
        closePopover();
      } else if (state.activeBottomPanel) {
        setBottomPanel(null);
      } else if (!state.renamingChatId) {
        closeDrawer();
      }
    }
  });

  /* =========================================================================
     3. CHAT FEED, LIVE-ONLY THINKING & 5-ICON MESSAGE FOOTER
     ========================================================================= */
  function stopActivePlayback() {
    state.ttsPlayingMsgId = null;
    updateTtsIcons();
  }

  function togglePlayback(msgId) {
    if (state.micState !== 'idle') return;
    if (state.ttsPlayingMsgId === msgId) {
      stopActivePlayback();
      return;
    }
    state.ttsPlayingMsgId = msgId;
    updateTtsIcons();
  }

  function updateTtsIcons() {
    document.querySelectorAll('[data-tts-btn]').forEach((btn) => {
      const isPlaying = btn.dataset.ttsBtn === state.ttsPlayingMsgId;
      btn.innerHTML = isPlaying ? ICONS.stopAudio : ICONS.speaker;
      btn.classList.toggle('speaking', isPlaying);
      btn.setAttribute('aria-label', isPlaying ? 'Остановить озвучку' : 'Озвучить');
    });
  }

  /* =========================================================================
     MARKDOWN RENDERER & CODE BLOCK COPY DELEGATION
     ========================================================================= */
  function formatInlineMarkdown(raw) {
    const codeTokens = [];
    let s = escapeHtml(raw);

    // Protect inline code spans first
    s = s.replace(/`([^`\n]+)`/g, (_, inner) => {
      const idx = codeTokens.length;
      codeTokens.push(`<code>${inner}</code>`);
      return `@@INLINECODE_${idx}@@`;
    });

    // Safe http/https links: [label](url)
    s = s.replace(/\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g, (_, label, url) => {
      return `<a href="${url}" target="_blank" rel="noopener noreferrer" style="color:var(--menu-active-text);text-decoration:underline;">${label}</a>`;
    });

    // Bold **...** and __...__
    s = s.replace(/\*\*([^*]+?)\*\*/g, '<strong>$1</strong>');
    s = s.replace(/(^|[\s(>])__([^_]+?)__(?=[\s)<.,!?:;]|$)/g, '$1<strong>$2</strong>');

    // Italic *...*
    s = s.replace(/(^|[\s(>])\*([^*\n]+?)\*(?=[\s)<.,!?:;]|$)/g, '$1<em>$2</em>');

    // Strikethrough ~~...~~
    s = s.replace(/~~([^~]+?)~~/g, '<del>$1</del>');

    // Restore inline code
    s = s.replace(/@@INLINECODE_(\d+)@@/g, (_, idx) => codeTokens[Number(idx)] || '');
    return s;
  }

  function renderTextSegmentToHtml(segment) {
    const lines = segment.replace(/\r\n/g, '\n').split('\n');
    const out = [];
    let paraLines = [];
    let listItems = [];

    const flushPara = () => {
      if (paraLines.length === 0) return;
      out.push(`<p>${paraLines.map((l) => formatInlineMarkdown(l)).join('<br>')}</p>`);
      paraLines = [];
    };

    const flushList = () => {
      if (listItems.length === 0) return;
      out.push(`<ul>${listItems.map((it) => `<li>${formatInlineMarkdown(it)}</li>`).join('')}</ul>`);
      listItems = [];
    };

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const trimmed = line.trim();

      if (!trimmed) {
        flushPara();
        flushList();
        continue;
      }

      // Headings (# .. ######)
      const hMatch = trimmed.match(/^#{1,6}\s+(.+)$/);
      if (hMatch) {
        flushPara();
        flushList();
        out.push(`<p><strong>${formatInlineMarkdown(hMatch[1])}</strong></p>`);
        continue;
      }

      // Unordered or ordered list items
      const ulMatch = trimmed.match(/^(?:[-*•]|\d+\.)\s+(.+)$/);
      if (ulMatch) {
        flushPara();
        listItems.push(ulMatch[1]);
        continue;
      }

      // Blockquote
      const bqMatch = trimmed.match(/^>\s?(.*)$/);
      if (bqMatch) {
        flushPara();
        flushList();
        out.push(`<p style="padding-left:10px;opacity:0.86;">${formatInlineMarkdown(bqMatch[1])}</p>`);
        continue;
      }

      // Horizontal rule
      if (/^([-*_]){3,}$/.test(trimmed)) {
        flushPara();
        flushList();
        continue;
      }

      flushList();
      paraLines.push(line);
    }

    flushPara();
    flushList();
    return out.join('');
  }

  function buildCodeBlockHtml(lang, codeText) {
    const cleanLang = (lang || 'code').trim().slice(0, 24) || 'code';
    const trimmedCode = codeText.replace(/^\n/, '').replace(/\n$/, '');
    return (
      `<div class="code-block-wrap">` +
        `<div class="code-block-head">` +
          `<span>${escapeHtml(cleanLang)}</span>` +
          `<button class="code-copy-btn" type="button" data-code-copy>Копировать</button>` +
        `</div>` +
        `<pre><code>${escapeHtml(trimmedCode)}</code></pre>` +
      `</div>`
    );
  }

  function renderMarkdownToHtml(md, isStreaming = false) {
    if (!md) {
      return isStreaming ? '<p><span class="stream-cursor"></span></p>' : '';
    }

    const src = String(md).replace(/\r\n/g, '\n');
    const parts = [];
    const fenceRe = /```([^\n`]*)\n([\s\S]*?)```/g;
    let lastIdx = 0;
    let match;

    while ((match = fenceRe.exec(src)) !== null) {
      if (match.index > lastIdx) {
        const before = src.slice(lastIdx, match.index);
        if (before.trim()) parts.push(renderTextSegmentToHtml(before));
      }
      parts.push(buildCodeBlockHtml(match[1], match[2]));
      lastIdx = fenceRe.lastIndex;
    }

    const tail = src.slice(lastIdx);
    if (tail) {
      // Handle an unclosed fenced code block while streaming
      const openFence = tail.match(/^([\s\S]*?)```([^\n`]*)\n([\s\S]*)$/);
      if (openFence) {
        if (openFence[1].trim()) {
          parts.push(renderTextSegmentToHtml(openFence[1]));
        }
        parts.push(buildCodeBlockHtml(openFence[2], openFence[3]));
      } else if (tail.trim()) {
        parts.push(renderTextSegmentToHtml(tail));
      }
    }

    let html = parts.join('');
    if (!html) {
      html = `<p>${escapeHtml(src)}</p>`;
    }

    if (isStreaming) {
      const cursor = '<span class="stream-cursor"></span>';
      if (html.endsWith('</p>')) {
        html = html.slice(0, -4) + cursor + '</p>';
      } else if (html.endsWith('</li></ul>')) {
        html = html.slice(0, -10) + cursor + '</li></ul>';
      } else {
        html += cursor;
      }
    }

    return html;
  }

  // Event delegation for Copy buttons inside rendered markdown code blocks
  chatFeed.addEventListener('click', (e) => {
    const btn = e.target && e.target.closest ? e.target.closest('[data-code-copy]') : null;
    if (!btn || state.micState !== 'idle') return;
    e.stopPropagation();
    const wrap = btn.closest('.code-block-wrap');
    const codeEl = wrap ? wrap.querySelector('pre code') : null;
    if (!codeEl) return;
    copyToClipboard(codeEl.textContent || '');
    btn.textContent = 'Скопировано';
    setTimeout(() => {
      if (btn.isConnected) btn.textContent = 'Копировать';
    }, 1100);
  });

  function cancelActiveStreamHandle() {
    if (state.streamRafId) {
      cancelAnimationFrame(state.streamRafId);
      state.streamRafId = null;
    }
    if (state.abortController) {
      const ctrl = state.abortController;
      state.abortController = null;
      try { ctrl.abort(); } catch (_) {}
    }
  }

  function abortGeneration(notify = true, removeIfEmpty = true) {
    if (!state.generatingMsgId) return false;
    const msgId = state.generatingMsgId;
    const targetChatId = state.generatingChatId || state.activeChatId;
    state.generatingMsgId = null;
    state.generatingChatId = null;
    cancelActiveStreamHandle();

    const chat = state.chats.find((c) => c.id === targetChatId) || getActiveChat();
    if (chat) {
      const idx = chat.messages.findIndex((m) => m.id === msgId);
      if (idx !== -1) {
        const msg = chat.messages[idx];
        const hasContent = Boolean(msg.plainText && msg.plainText.trim().length > 0);
        msg.liveThinking = null;
        msg.streaming = false;
        if (hasContent) {
          msg.html = renderMarkdownToHtml(msg.plainText, false);
        } else if (removeIfEmpty) {
          chat.messages.splice(idx, 1);
        }
        persistChat(chat);
      }
    }
    syncSendButton();
    renderFeed();
    if (notify) showToast('Генерация прервана');
    return true;
  }

  function patchStreamingMessageDOM(msg) {
    if (!msg) return;
    const block = chatFeed.querySelector(`.msg-block[data-msg-id="${msg.id}"]`);
    if (!block) return;

    const isNearBottom = (chatFeed.scrollHeight - chatFeed.scrollTop - chatFeed.clientHeight) < 110;
    const footer = block.querySelector('.msg-footer');

    if (msg.liveThinking) {
      let liveRow = block.querySelector('.live-thinking-row');
      if (!liveRow) {
        const oldAi = block.querySelector('.ai-content');
        if (oldAi) oldAi.remove();
        liveRow = document.createElement('div');
        liveRow.className = 'live-thinking-row';
        liveRow.innerHTML = `
          <div class="gemini-dot-spinner" aria-hidden="true">
            <span></span><span></span><span></span>
          </div>
          <span class="live-thinking-text"></span>
        `;
        block.insertBefore(liveRow, footer || null);
      }
      const txtEl = liveRow.querySelector('.live-thinking-text');
      if (txtEl) txtEl.textContent = msg.liveThinking;
    } else {
      const liveRow = block.querySelector('.live-thinking-row');
      if (liveRow) liveRow.remove();

      let aiContent = block.querySelector('.ai-content');
      if (!aiContent) {
        aiContent = document.createElement('div');
        aiContent.className = `msg-body ai-content${msg.collapsed ? ' clamped' : ''}`;
        block.insertBefore(aiContent, footer || null);
      }
      if (msg.isError && msg.html) {
        aiContent.innerHTML = msg.html;
      } else {
        aiContent.innerHTML = renderMarkdownToHtml(msg.plainText || '', Boolean(msg.streaming));
      }
    }

    if (isNearBottom) {
      chatFeed.scrollTop = chatFeed.scrollHeight;
    }
    updateScrollBottomBtn();
  }

  function scheduleStreamDOMUpdate(msg) {
    if (state.streamRafId) return;
    state.streamRafId = requestAnimationFrame(() => {
      state.streamRafId = null;
      if (state.generatingMsgId === msg.id) {
        patchStreamingMessageDOM(msg);
      }
    });
  }

  function renderFeed(scrollToBottom = false) {
    const chat = getActiveChat();
    chatFeed.innerHTML = '';

    if (!chat || chat.messages.length === 0) {
      const empty = document.createElement('div');
      empty.className = 'chat-empty';
      empty.innerHTML = `
        <div class="chat-empty-title">Новый диалог</div>
        <div style="font-size:14px;">Напишите сообщение или запишите голос</div>
      `;
      chatFeed.appendChild(empty);
      updateScrollBottomBtn();
      return;
    }

    chat.messages.forEach((msg) => {
      const block = document.createElement('article');
      block.className = 'msg-block';
      block.dataset.msgId = msg.id;

      if (msg.role === 'user') {
        const card = document.createElement('div');
        card.className = `msg-user-card${msg.collapsed ? ' collapsed' : ''}`;

        const textEl = document.createElement('div');
        textEl.className = `msg-body${msg.collapsed ? ' clamped' : ''}`;
        textEl.textContent = msg.text;
        card.appendChild(textEl);

        if (msg.collapsed) {
          card.addEventListener('click', () => {
            if (state.micState !== 'idle') return;
            msg.collapsed = false;
            persistChat(chat);
            renderFeed();
          });
        }

        block.appendChild(card);
      } else {
        if (msg.liveThinking) {
          const liveRow = document.createElement('div');
          liveRow.className = 'live-thinking-row';
          liveRow.innerHTML = `
            <div class="gemini-dot-spinner" aria-hidden="true">
              <span></span><span></span><span></span>
            </div>
            <span class="live-thinking-text">${escapeHtml(msg.liveThinking)}</span>
          `;
          block.appendChild(liveRow);
        } else {
          const aiContent = document.createElement('div');
          aiContent.className = `msg-body ai-content${msg.collapsed ? ' clamped' : ''}`;
          if (msg.isError && msg.html) {
            aiContent.innerHTML = msg.html;
          } else if (msg.streaming) {
            aiContent.innerHTML = renderMarkdownToHtml(msg.plainText || '', true);
          } else if (msg.html) {
            aiContent.innerHTML = msg.html;
          } else {
            aiContent.innerHTML = renderMarkdownToHtml(msg.plainText || '', false);
          }
          if (msg.collapsed) {
            aiContent.style.cursor = 'pointer';
            aiContent.addEventListener('click', () => {
              if (state.micState !== 'idle') return;
              msg.collapsed = false;
              persistChat(chat);
              renderFeed();
            });
          }
          block.appendChild(aiContent);
        }
      }

      const footer = document.createElement('div');
      footer.className = 'msg-footer';

      const actions = document.createElement('div');
      actions.className = 'msg-actions';

      const copyBtn = document.createElement('button');
      copyBtn.className = 'msg-icon-btn';
      copyBtn.setAttribute('aria-label', 'Копировать');
      copyBtn.innerHTML = ICONS.copy;
      copyBtn.addEventListener('click', () => {
        if (state.micState !== 'idle') return;
        const raw = msg.role === 'user' ? msg.text : (msg.plainText || '');
        copyToClipboard(raw);
        copyBtn.innerHTML = ICONS.check;
        copyBtn.classList.add('active');
        setTimeout(() => {
          copyBtn.innerHTML = ICONS.copy;
          copyBtn.classList.remove('active');
        }, 1100);
      });

      const delBtn = document.createElement('button');
      delBtn.className = 'msg-icon-btn';
      delBtn.setAttribute('aria-label', 'Удалить');
      delBtn.innerHTML = ICONS.trash;
      delBtn.addEventListener('click', () => {
        if (state.micState !== 'idle') return;
        if (state.openInfoMsgId === msg.id) closePopover();
        let aborted = false;
        if (state.generatingMsgId === msg.id) {
          state.generatingMsgId = null;
          state.generatingChatId = null;
          cancelActiveStreamHandle();
          syncSendButton();
          aborted = true;
        }
        if (state.ttsPlayingMsgId === msg.id) {
          stopActivePlayback();
          aborted = true;
        }
        chat.messages = chat.messages.filter((m) => m.id !== msg.id);
        persistChat(chat);
        renderFeed();
        if (aborted) showToast('Процесс прерван · сообщение удалено');
      });

      const ttsBtn = document.createElement('button');
      ttsBtn.className = 'msg-icon-btn';
      ttsBtn.dataset.ttsBtn = msg.id;
      const isPlaying = state.ttsPlayingMsgId === msg.id;
      ttsBtn.innerHTML = isPlaying ? ICONS.stopAudio : ICONS.speaker;
      if (isPlaying) ttsBtn.classList.add('speaking');
      ttsBtn.setAttribute('aria-label', isPlaying ? 'Остановить озвучку' : 'Озвучить');
      ttsBtn.addEventListener('click', () => togglePlayback(msg.id));

      const infoBtn = document.createElement('button');
      infoBtn.className = 'msg-icon-btn';
      infoBtn.setAttribute('aria-label', 'Информация о сообщении');
      infoBtn.innerHTML = ICONS.moreDots;
      infoBtn.addEventListener('click', (e) => {
        if (state.micState !== 'idle') return;
        e.stopPropagation();
        openPopover('info', infoBtn, msg);
      });

      const foldBtn = document.createElement('button');
      foldBtn.className = `msg-icon-btn collapse-btn${msg.collapsed ? '' : ' is-expanded'}`;
      foldBtn.setAttribute('aria-label', msg.collapsed ? 'Развернуть' : 'Свернуть');
      foldBtn.innerHTML = ICONS.chevron;
      foldBtn.addEventListener('click', () => {
        if (state.micState !== 'idle') return;
        msg.collapsed = !msg.collapsed;
        persistChat(chat);
        renderFeed();
      });

      actions.appendChild(copyBtn);
      actions.appendChild(delBtn);
      actions.appendChild(ttsBtn);
      actions.appendChild(infoBtn);
      actions.appendChild(foldBtn);
      footer.appendChild(actions);

      block.appendChild(footer);
      chatFeed.appendChild(block);
    });

    if (state.micState !== 'idle') {
      applyAppMicLock(state.micState);
    }

    if (scrollToBottom) {
      chatFeed.scrollTop = chatFeed.scrollHeight;
    }
    requestAnimationFrame(updateScrollBottomBtn);
  }

  /* =========================================================================
     4B. AUDIO (VOICE & MIC) PANEL LOGIC
     ========================================================================= */
  function syncAudioPanelUI() {
    const d = state.voiceDraft;
    const ttsObj = TTS_MODELS.find((t) => t.id === state.ttsId) || TTS_MODELS[0];
    const sttObj = STT_MODELS.find((s) => s.id === state.sttId) || STT_MODELS[0];
    const morphObj = MORPH_MODES.find((m) => m.id === state.morphId) || MORPH_MODES[0];

    ttsSelectLabel.textContent = ttsObj.name;
    voiceSelectLabel.textContent = d.voice;
    sttSelectLabel.textContent = sttObj.name;
    morphSelectLabel.textContent = morphObj.name;

    speedSlider.value = d.speed.toFixed(2);
    pitchSlider.value = d.pitch.toFixed(2);
    speedVal.textContent = `${d.speed.toFixed(2)}x`;
    pitchVal.textContent = `${d.pitch.toFixed(2)}x`;

    document.querySelectorAll('#voicePresetGroup .panel-preset-btn').forEach((b) => {
      b.classList.toggle('active', b.dataset.voicePreset === state.activeVoicePreset);
    });

    autoTtsBtn.classList.toggle('is-active', Boolean(state.autoTts));
    autoTtsBtn.setAttribute('aria-pressed', String(Boolean(state.autoTts)));
  }

  document.querySelectorAll('#voicePresetGroup .panel-preset-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      if (state.micState !== 'idle') return;
      state.activeVoicePreset = btn.dataset.voicePreset;
      const saved = state.voicePresets[state.activeVoicePreset];
      if (saved) {
        state.voiceDraft = { voice: saved.voice, speed: saved.speed, pitch: saved.pitch };
      }
      syncAudioPanelUI();
      persistSettings();
    });
  });

  speedSlider.addEventListener('input', () => {
    state.voiceDraft.speed = parseFloat(speedSlider.value);
    syncAudioPanelUI();
  });

  pitchSlider.addEventListener('input', () => {
    state.voiceDraft.pitch = parseFloat(pitchSlider.value);
    syncAudioPanelUI();
  });

  let voiceSaveFlashTimer = null;
  saveVoicePresetBtn.addEventListener('click', () => {
    if (state.micState !== 'idle') return;
    state.voicePresets[state.activeVoicePreset] = {
      voice: state.voiceDraft.voice,
      speed: state.voiceDraft.speed,
      pitch: state.voiceDraft.pitch
    };
    persistSettings(true);
    saveVoicePresetBtn.textContent = 'Saved';
    saveVoicePresetBtn.classList.add('saved');
    clearTimeout(voiceSaveFlashTimer);
    voiceSaveFlashTimer = setTimeout(() => {
      saveVoicePresetBtn.textContent = 'Save';
      saveVoicePresetBtn.classList.remove('saved');
    }, 1200);
    showToast(`${state.activeVoicePreset}: ${state.voiceDraft.voice} · ${state.voiceDraft.speed.toFixed(2)}x`);
  });

  /* =========================================================================
     4C. AI PERSONA PANEL LOGIC
     ========================================================================= */
  function syncPersonaClearBtn() {
    personaTextareaWrap.classList.toggle('has-text', personaInstructionsInput.value.length > 0);
  }

  function syncPersonaUI() {
    const idx = state.activePersonaIndex;
    const activeSaved = state.personas[idx] || { name: '', instructions: '' };

    document.querySelectorAll('#personaPresetGroup .panel-preset-btn').forEach((btn) => {
      const i = Number(btn.dataset.personaPreset);
      const p = state.personas[i] || { name: '', instructions: '' };
      btn.textContent = p.name.trim() ? p.name.trim() : `Persona ${i + 1}`;
      btn.classList.toggle('active', i === idx);
    });

    const dockLabel = activeSaved.name.trim() ? activeSaved.name.trim() : 'AI Persona';
    personaDockLabel.textContent = dockLabel;
    personaDockLabel.dataset.label = dockLabel;

    personaNameInput.value = state.personaDraft.name;
    personaInstructionsInput.value = state.personaDraft.instructions;
    syncPersonaClearBtn();
  }

  document.querySelectorAll('#personaPresetGroup .panel-preset-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      if (state.micState !== 'idle') return;
      const idx = Number(btn.dataset.personaPreset);
      state.activePersonaIndex = idx;
      const p = state.personas[idx] || { name: '', instructions: '' };
      state.personaDraft = { name: p.name, instructions: p.instructions };
      syncPersonaUI();
      persistSettings();
    });
  });

  personaNameInput.addEventListener('input', () => {
    state.personaDraft.name = personaNameInput.value;
  });

  personaNameInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      const trimmed = personaNameInput.value.trim();
      state.personaDraft.name = trimmed;
      state.personas[state.activePersonaIndex].name = trimmed;
      syncPersonaUI();
      persistSettings(true);
      personaNameInput.blur();
    }
  });

  personaInstructionsInput.addEventListener('input', () => {
    state.personaDraft.instructions = personaInstructionsInput.value;
    syncPersonaClearBtn();
  });

  clearPersonaBtn.addEventListener('pointerdown', (e) => {
    if (state.micState !== 'idle') return;
    e.preventDefault();
  });

  clearPersonaBtn.addEventListener('click', () => {
    if (state.micState !== 'idle') return;
    personaInstructionsInput.value = '';
    state.personaDraft.instructions = '';
    syncPersonaClearBtn();
    personaInstructionsInput.focus();
  });

  let personaSaveFlashTimer = null;
  savePersonaPresetBtn.addEventListener('click', () => {
    if (state.micState !== 'idle') return;
    const idx = state.activePersonaIndex;
    const trimmedName = personaNameInput.value.trim();
    state.personaDraft.name = trimmedName;
    state.personaDraft.instructions = personaInstructionsInput.value;
    state.personas[idx] = {
      name: trimmedName,
      instructions: state.personaDraft.instructions
    };
    syncPersonaUI();
    persistSettings(true);

    savePersonaPresetBtn.textContent = 'Saved';
    savePersonaPresetBtn.classList.add('saved');
    clearTimeout(personaSaveFlashTimer);
    personaSaveFlashTimer = setTimeout(() => {
      savePersonaPresetBtn.textContent = 'Save';
      savePersonaPresetBtn.classList.remove('saved');
    }, 1200);
    showToast(`Сохранено: ${trimmedName || `Persona ${idx + 1}`}`);
  });

  autoTtsBtn.addEventListener('click', () => {
    if (state.micState !== 'idle') return;
    state.autoTts = !state.autoTts;
    autoTtsBtn.classList.toggle('is-active', state.autoTts);
    autoTtsBtn.setAttribute('aria-pressed', String(state.autoTts));
    persistSettings();
  });

  document.getElementById('attachBtn').addEventListener('click', () => {
    if (state.micState !== 'idle') return;
    showToast('Вложения: фото / файл (мок)');
  });

  /* =========================================================================
     4D. COMPOSER SEND / STOP & MIC RECORDING LOCK FLOW
     ========================================================================= */
  function syncSendButton() {
    if (state.generatingMsgId) {
      sendBtn.classList.remove('ready');
      sendBtn.classList.add('streaming');
      sendBtn.setAttribute('aria-label', 'Остановить');
      sendIconSvg.innerHTML = '<rect x="7" y="7" width="10" height="10" rx="2.2" fill="currentColor" stroke="none"></rect>';
      return;
    }
    sendBtn.classList.remove('streaming');
    const hasText = state.micState === 'idle' && chatInput.value.trim().length > 0;
    sendBtn.classList.toggle('ready', hasText);
    sendBtn.setAttribute('aria-label', 'Отправить');
    sendIconSvg.innerHTML = '<line x1="12" y1="19" x2="12" y2="5"></line><polyline points="6 11 12 5 18 11"></polyline>';
  }

  ['input', 'keyup', 'change'].forEach((evt) => {
    chatInput.addEventListener(evt, () => {
      if (state.micState !== 'idle') return;
      updateComposerLayout();
      syncSendButton();
    });
  });

  chatInput.addEventListener('paste', () => {
    if (state.micState !== 'idle') return;
    requestAnimationFrame(() => {
      updateComposerLayout();
      syncSendButton();
    });
  });

  chatInput.addEventListener('keydown', (e) => {
    if (state.micState !== 'idle') {
      e.preventDefault();
      return;
    }
    if (e.key === 'Enter' && !e.shiftKey && window.innerWidth >= 520) {
      e.preventDefault();
      handleSendOrStop();
    }
  });

  function startMicRecording() {
    closePopover();
    closeContextMenu();
    setBottomPanel(null);
    closeDrawer();
    stopActivePlayback();
    if (document.activeElement && document.activeElement.blur) {
      document.activeElement.blur();
    }

    state.recSeconds = 0;
    micStatusTimer.textContent = '0:00';
    applyAppMicLock('recording');

    clearInterval(state.recInterval);
    state.recInterval = setInterval(() => {
      state.recSeconds += 1;
      micStatusTimer.textContent = formatMMSS(state.recSeconds);
    }, 1000);
  }

  function stopMicAndTranscribe() {
    clearInterval(state.recInterval);
    state.recInterval = null;

    applyAppMicLock('transcribing');

    clearTimeout(state.transcribeTimer);
    state.transcribeTimer = setTimeout(() => {
      state.transcribeTimer = null;

      const sampleDictation = 'Проверка STT (мок до Шага 4) — интерфейс разблокирован, можно править текст.';
      const existing = chatInput.value.trim();
      chatInput.value = existing ? `${existing} ${sampleDictation}` : sampleDictation;

      applyAppMicLock('idle');
      updateComposerLayout();
      syncSendButton();
      updateScrollBottomBtn();
    }, 1400);
  }

  micBtn.addEventListener('click', () => {
    if (state.micState === 'transcribing') return;
    if (state.micState === 'recording') {
      stopMicAndTranscribe();
    } else {
      startMicRecording();
    }
  });

  /* =========================================================================
     OPENROUTER / DIRECT CHAT COMPLETIONS SSE STREAMING ENGINE
     ========================================================================= */
  function extractReasoningDelta(delta) {
    if (!delta || typeof delta !== 'object') return '';
    let out = '';
    if (typeof delta.reasoning === 'string') out += delta.reasoning;
    if (typeof delta.reasoning_content === 'string') out += delta.reasoning_content;
    if (Array.isArray(delta.reasoning_details)) {
      delta.reasoning_details.forEach((item) => {
        if (!item) return;
        if (typeof item.text === 'string') out += item.text;
        else if (typeof item.summary === 'string') out += item.summary;
      });
    }
    return out;
  }

  function formatLiveThinkingSnippet(reasoningBuf) {
    if (!reasoningBuf) return 'Размышляю…';
    const cleaned = reasoningBuf
      .replace(/```[\s\S]*?```/g, ' ')
      .replace(/[*#_`>]/g, '')
      .trim();
    if (!cleaned) return 'Размышляю…';
    const lines = cleaned.split(/\n+/).map((l) => l.trim()).filter(Boolean);
    const last = lines[lines.length - 1] || cleaned;
    if (last.length <= 86) return last;
    return '…' + last.slice(-85).trim();
  }

  function buildChatApiEndpoint() {
    if (state.provider === 'direct') {
      const base = (state.apiKeys.customUrl || '').trim().replace(/\/+$/, '');
      if (!base) {
        return { error: 'Не указан Custom Endpoint URL. Откройте меню слева → «API ключи».' };
      }
      const url = /\/chat\/completions$/i.test(base) ? base : `${base}/chat/completions`;
      return { url, apiKey: (state.apiKeys.openrouter || '').trim(), isOpenRouter: false };
    }

    const key = (state.apiKeys.openrouter || '').trim();
    if (!key) {
      return { error: 'Не задан OpenRouter Key. Откройте меню слева → «API ключи» и вставьте ключ.' };
    }
    return {
      url: `${OPENROUTER_API_BASE}/chat/completions`,
      apiKey: key,
      isOpenRouter: true
    };
  }

  function buildChatRequestMessages(chat, excludeMsgId) {
    const out = [];
    const activePersona = state.personas[state.activePersonaIndex];
    const sysInstructions = activePersona && typeof activePersona.instructions === 'string'
      ? activePersona.instructions.trim()
      : '';

    if (sysInstructions) {
      out.push({ role: 'system', content: sysInstructions });
    }

    (chat.messages || []).forEach((m) => {
      if (!m || m.id === excludeMsgId || m.isError) return;
      if (m.role === 'user') {
        const txt = (m.text || '').trim();
        if (txt) out.push({ role: 'user', content: txt });
      } else if (m.role === 'assistant') {
        const txt = (m.plainText || '').trim();
        if (txt) out.push({ role: 'assistant', content: txt });
      }
    });

    return out;
  }

  function formatApiErrorForChat(status, rawDetail, usingFlex, modelLabel) {
    const detail = String(rawDetail || '').trim();
    const lower = detail.toLowerCase();

    if (usingFlex) {
      const looksLikeFlexRejection =
        status === 400 ||
        status === 404 ||
        status === 422 ||
        lower.includes('flex') ||
        lower.includes('service_tier') ||
        lower.includes('service tier') ||
        lower.includes('tier') ||
        lower.includes('no endpoints found') ||
        lower.includes('no allowed providers') ||
        lower.includes('unsupported') ||
        lower.includes('not supported');

      if (looksLikeFlexRejection) {
        const suffix = detail ? `\n(${detail})` : '';
        return `Режим Flex недоступен для модели ${modelLabel}. Отключите Flex в меню модели и повторите запрос.${suffix}`;
      }
    }

    if (status === 401) {
      return 'Неверный API ключ (401). Проверьте OpenRouter Key в меню слева.';
    }
    if (status === 402) {
      return 'Недостаточно средств на балансе OpenRouter (402).';
    }
    if (status === 429) {
      return `Превышен лимит запросов (429).${detail ? ' ' + detail : ''}`;
    }

    return `Ошибка API${status ? ` (${status})` : ''}: ${detail || 'не удалось получить ответ.'}`;
  }

  function setAssistantError(chat, aiMsg, errorText) {
    aiMsg.liveThinking = null;
    aiMsg.streaming = false;
    aiMsg.isError = true;
    aiMsg.plainText = errorText;
    aiMsg.html = `<div class="msg-error-card">${escapeHtml(errorText).replace(/\n/g, '<br>')}</div>`;
    persistChat(chat);
  }

  async function parseResponseErrorText(resp) {
    try {
      const raw = await resp.text();
      if (!raw) return resp.statusText || '';
      try {
        const j = JSON.parse(raw);
        if (j && j.error) {
          const msg = j.error.message || '';
          const metaRaw = j.error.metadata && j.error.metadata.raw ? String(j.error.metadata.raw) : '';
          if (metaRaw && metaRaw !== msg) {
            return msg ? `${msg} — ${metaRaw}` : metaRaw;
          }
          if (msg) return msg;
        }
        if (j && j.message) return String(j.message);
      } catch (_) {}
      return raw.slice(0, 320);
    } catch (_) {
      return resp.statusText || '';
    }
  }

  async function handleSendOrStop() {
    if (state.micState !== 'idle') return;
    if (state.generatingMsgId) {
      abortGeneration(true, true);
      return;
    }

    const text = chatInput.value.trim();
    if (!text) return;

    setBottomPanel(null);
    closePopover();

    let chat = getActiveChat();
    if (!chat) {
      chat = createNewChatObject();
      state.chats.unshift(chat);
      sortChatsPinnedFirst();
      state.activeChatId = chat.id;
      persistSettings();
    }

    const now = new Date();
    if (chat.messages.length === 0) {
      chat.title = text.slice(0, 32) + (text.length > 32 ? '…' : '');
    }
    chat.date = `Сегодня · ${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;

    chat.messages.push({
      id: 'u-' + Date.now(),
      role: 'user',
      timestamp: formatCompactTimestamp(now),
      collapsed: false,
      text
    });
    persistChat(chat);

    chatInput.value = '';
    updateComposerLayout();

    const curModel = getCurrentModelObj();
    const capturedModelId = curModel ? curModel.id : state.modelId;
    const capturedModelLabel = curModel ? curModel.label : state.modelLabel;
    const availableLevels = getAvailableThinkingLevels(curModel);
    const usingFlex = state.provider === 'openrouter' && Boolean(curModel && curModel.supportsFlex) && Boolean(state.flexEnabled);

    const aiId = 'a-' + (Date.now() + 1);
    const aiMsg = {
      id: aiId,
      role: 'assistant',
      model: capturedModelLabel,
      timestamp: formatCompactTimestamp(new Date()),
      collapsed: false,
      liveThinking: state.thinking !== 'none' ? 'Размышляю…' : 'Подключение…',
      streaming: false,
      isError: false,
      plainText: '',
      html: ''
    };

    chat.messages.push(aiMsg);

    const endpoint = buildChatApiEndpoint();
    if (endpoint.error) {
      setAssistantError(chat, aiMsg, endpoint.error);
      syncSendButton();
      renderFeed(true);
      return;
    }

    const controller = new AbortController();
    state.abortController = controller;
    state.generatingMsgId = aiId;
    state.generatingChatId = chat.id;
    syncSendButton();
    renderFeed(true);

    const requestBody = {
      model: capturedModelId,
      messages: buildChatRequestMessages(chat, aiId),
      stream: true,
      stream_options: { include_usage: true }
    };

    if (curModel && curModel.supportsReasoning) {
      if (state.thinking === 'none' && availableLevels.some((l) => l.id === 'none')) {
        requestBody.reasoning = { enabled: false };
      } else if (state.thinking !== 'none') {
        requestBody.reasoning = { effort: state.thinking };
      }
    }

    if (usingFlex) {
      requestBody.service_tier = 'flex';
    }

    const headers = {
      'Content-Type': 'application/json',
      Accept: 'text/event-stream'
    };
    if (endpoint.apiKey) {
      headers.Authorization = `Bearer ${endpoint.apiKey}`;
    }
    if (endpoint.isOpenRouter) {
      headers['HTTP-Referer'] = window.location.origin || 'https://localhost';
      headers['X-Title'] = 'OpenRouter PWA';
    }

    let reasoningBuffer = '';
    let finalUsage = null;
    let streamError = null;

    try {
      const resp = await fetch(endpoint.url, {
        method: 'POST',
        headers,
        body: JSON.stringify(requestBody),
        signal: controller.signal
      });

      captureRateLimitHeaders(resp.headers);

      if (!resp.ok) {
        const detail = await parseResponseErrorText(resp);
        if (state.generatingMsgId !== aiId) return;
        setAssistantError(chat, aiMsg, formatApiErrorForChat(resp.status, detail, usingFlex, capturedModelLabel));
        return;
      }

      const contentType = (resp.headers.get('content-type') || '').toLowerCase();

      // Fallback if provider returned non-streaming JSON response
      if (contentType.includes('application/json') || !resp.body || !resp.body.getReader) {
        const data = await resp.json();
        if (state.generatingMsgId !== aiId) return;
        if (data && data.error) {
          const msg = data.error.message || JSON.stringify(data.error);
          setAssistantError(chat, aiMsg, formatApiErrorForChat(data.error.code || 0, msg, usingFlex, capturedModelLabel));
          return;
        }
        const choice = data && data.choices && data.choices[0];
        const content = choice && choice.message && choice.message.content ? String(choice.message.content) : '';
        if (data && data.usage) finalUsage = data.usage;
        aiMsg.liveThinking = null;
        aiMsg.streaming = false;
        aiMsg.plainText = content;
        aiMsg.html = renderMarkdownToHtml(content, false);
        persistChat(chat);
      } else {
        const reader = resp.body.getReader();
        const decoder = new TextDecoder('utf-8');
        let sseBuffer = '';

        const processSseLine = (rawLine) => {
          const line = rawLine.trim();
          if (!line || line.startsWith(':')) return;
          if (!line.startsWith('data:')) return;
          const dataStr = line.slice(5).trim();
          if (!dataStr || dataStr === '[DONE]') return;

          let parsed;
          try {
            parsed = JSON.parse(dataStr);
          } catch (_) {
            return;
          }

          if (parsed && parsed.error) {
            const errMsg = parsed.error.message || (parsed.error.metadata && parsed.error.metadata.raw) || 'Ошибка потока';
            streamError = { code: parsed.error.code || 0, message: errMsg };
            return;
          }

          if (parsed && parsed.usage) {
            finalUsage = parsed.usage;
          }

          const choice = parsed && parsed.choices && parsed.choices[0];
          if (!choice) return;
          const delta = choice.delta || {};

          const reasoningChunk = extractReasoningDelta(delta);
          if (reasoningChunk && !aiMsg.plainText) {
            reasoningBuffer += reasoningChunk;
            aiMsg.liveThinking = formatLiveThinkingSnippet(reasoningBuffer);
            scheduleStreamDOMUpdate(aiMsg);
          }

          const contentChunk = typeof delta.content === 'string' ? delta.content : '';
          if (contentChunk) {
            if (aiMsg.liveThinking !== null) {
              aiMsg.liveThinking = null;
            }
            aiMsg.streaming = true;
            aiMsg.plainText += contentChunk;
            scheduleStreamDOMUpdate(aiMsg);
          }
        };

        while (true) {
          const { value, done } = await reader.read();
          if (state.generatingMsgId !== aiId) {
            try { await reader.cancel(); } catch (_) {}
            return;
          }
          if (done) break;

          sseBuffer += decoder.decode(value, { stream: true });
          const lines = sseBuffer.split('\n');
          sseBuffer = lines.pop() || '';

          for (let i = 0; i < lines.length; i++) {
            processSseLine(lines[i]);
            if (streamError) break;
          }
          if (streamError) {
            try { await reader.cancel(); } catch (_) {}
            break;
          }
        }

        if (!streamError && sseBuffer.trim()) {
          processSseLine(sseBuffer);
        }

        if (state.generatingMsgId !== aiId) return;

        if (streamError) {
          if (aiMsg.plainText.trim()) {
            aiMsg.plainText += `\n\n[${formatApiErrorForChat(streamError.code, streamError.message, usingFlex, capturedModelLabel)}]`;
            aiMsg.liveThinking = null;
            aiMsg.streaming = false;
            aiMsg.html = renderMarkdownToHtml(aiMsg.plainText, false);
            persistChat(chat);
          } else {
            setAssistantError(chat, aiMsg, formatApiErrorForChat(streamError.code, streamError.message, usingFlex, capturedModelLabel));
          }
        } else {
          aiMsg.liveThinking = null;
          aiMsg.streaming = false;
          if (!aiMsg.plainText.trim()) {
            setAssistantError(chat, aiMsg, 'Модель вернула пустой ответ.');
          } else {
            aiMsg.html = renderMarkdownToHtml(aiMsg.plainText, false);
            persistChat(chat);
          }
        }
      }

      // Log usage into 24h IndexedDB store (consumed by Step 3 balance details)
      if (!aiMsg.isError && curModel) {
        const promptTok = Number(finalUsage && finalUsage.prompt_tokens) || 0;
        const compTok = Number(finalUsage && finalUsage.completion_tokens) || 0;
        const totalTok = Number(finalUsage && finalUsage.total_tokens) || (promptTok + compTok);
        let costUsd = 0;
        if (finalUsage && typeof finalUsage.cost === 'number') {
          costUsd = finalUsage.cost;
        } else if (curModel.pricing) {
          costUsd = promptTok * (curModel.pricing.prompt || 0) + compTok * (curModel.pricing.completion || 0);
        }
        recordUsageEntry({
          type: 'chat',
          modelId: capturedModelId,
          modelLabel: capturedModelLabel,
          tokens: totalTok,
          promptTokens: promptTok,
          completionTokens: compTok,
          cost: costUsd,
          isFree: Boolean(curModel.isFree)
        });
      }
    } catch (err) {
      if (state.generatingMsgId !== aiId || (err && err.name === 'AbortError')) {
        return;
      }
      const errMsg = err && err.message ? err.message : 'Сбой сети';
      if (aiMsg.plainText.trim()) {
        aiMsg.liveThinking = null;
        aiMsg.streaming = false;
        aiMsg.plainText += `\n\n[Соединение прервано: ${errMsg}]`;
        aiMsg.html = renderMarkdownToHtml(aiMsg.plainText, false);
        persistChat(chat);
      } else {
        setAssistantError(chat, aiMsg, `Ошибка соединения: ${errMsg}`);
      }
    } finally {
      if (state.generatingMsgId === aiId) {
        if (state.streamRafId) {
          cancelAnimationFrame(state.streamRafId);
          state.streamRafId = null;
        }
        state.abortController = null;
        state.generatingMsgId = null;
        state.generatingChatId = null;
        syncSendButton();

        const isNearBottom = (chatFeed.scrollHeight - chatFeed.scrollTop - chatFeed.clientHeight) < 120;
        if (state.activeChatId === chat.id) {
          renderFeed(isNearBottom);
        }

        if (!aiMsg.isError && aiMsg.plainText && state.autoTts && state.micState === 'idle') {
          togglePlayback(aiId);
        }
      }
    }
  }

  sendBtn.addEventListener('click', handleSendOrStop);

  /* =========================================================================
     5. LEFT DRAWER: API KEYS PERSISTENCE, SILENT SWITCH, SWIPE-SELECT, PIN
     ========================================================================= */
  let keyReloadTimer = null;
  let lastFetchedOrKey = '';

  function syncDrawerSettingsUI() {
    document.querySelectorAll('#providerSwitch .seg-btn').forEach((b) => {
      b.classList.toggle('active', b.dataset.provider === state.provider);
    });
    if (orKeyInput && orKeyInput.value !== state.apiKeys.openrouter) {
      orKeyInput.value = state.apiKeys.openrouter || '';
    }
    if (customUrlInput && customUrlInput.value !== state.apiKeys.customUrl) {
      customUrlInput.value = state.apiKeys.customUrl || '';
    }
    if (elevenKeyInput && elevenKeyInput.value !== state.apiKeys.elevenlabs) {
      elevenKeyInput.value = state.apiKeys.elevenlabs || '';
    }
  }

  function handleOrKeyChange(immediateFetch = false) {
    const val = (orKeyInput.value || '').trim();
    state.apiKeys.openrouter = val;
    persistSettings(immediateFetch);

    clearTimeout(keyReloadTimer);
    if (val === lastFetchedOrKey) return;

    const triggerFetch = () => {
      lastFetchedOrKey = state.apiKeys.openrouter;
      fetchGeminiModelsFromOpenRouter(false);
    };

    if (immediateFetch) {
      triggerFetch();
    } else {
      keyReloadTimer = setTimeout(triggerFetch, 700);
    }
  }

  if (orKeyInput) {
    orKeyInput.addEventListener('input', () => handleOrKeyChange(false));
    orKeyInput.addEventListener('change', () => handleOrKeyChange(true));
    orKeyInput.addEventListener('blur', () => handleOrKeyChange(true));
  }

  if (customUrlInput) {
    customUrlInput.addEventListener('input', () => {
      state.apiKeys.customUrl = (customUrlInput.value || '').trim();
      persistSettings(false);
    });
    customUrlInput.addEventListener('change', () => {
      state.apiKeys.customUrl = (customUrlInput.value || '').trim();
      persistSettings(true);
    });
  }

  if (elevenKeyInput) {
    elevenKeyInput.addEventListener('input', () => {
      state.apiKeys.elevenlabs = (elevenKeyInput.value || '').trim();
      persistSettings(false);
    });
    elevenKeyInput.addEventListener('change', () => {
      state.apiKeys.elevenlabs = (elevenKeyInput.value || '').trim();
      persistSettings(true);
    });
  }

  function createNewChatObject() {
    return {
      id: 'chat-' + Date.now() + '-' + Math.floor(Math.random() * 1000),
      title: 'Новый чат',
      date: 'Только что',
      pinned: false,
      order: state.nextOrder--,
      messages: []
    };
  }

  document.getElementById('btn-new-chat').addEventListener('click', () => {
    if (state.micState !== 'idle') return;
    closePopover();
    closeContextMenu();
    setBottomPanel(null);
    stopActivePlayback();
    abortGeneration(false, true);
    const existingEmpty = state.chats.find((c) => c.messages.length === 0);
    if (existingEmpty) {
      state.activeChatId = existingEmpty.id;
    } else {
      const fresh = createNewChatObject();
      state.chats.unshift(fresh);
      sortChatsPinnedFirst();
      state.activeChatId = fresh.id;
      persistChat(fresh);
    }
    persistSettings();
    renderFeed();
    showToast('Открыт новый чат');
  });

  function openDrawer() {
    if (state.micState !== 'idle') return;
    closePopover();
    closeContextMenu();
    setBottomPanel(null);
    if (document.activeElement && document.activeElement.blur) {
      document.activeElement.blur();
    }
    clearWindowSelection();
    document.body.classList.add('drawer-open');
    drawer.classList.add('open');
    drawerBackdrop.classList.add('open');
    drawer.setAttribute('aria-hidden', 'false');
    syncDrawerSettingsUI();
    renderChatList();
  }

  function closeDrawer() {
    endDragSelect();
    closeContextMenu();
    state.renamingChatId = null;
    document.body.classList.remove('drawer-open');
    drawer.classList.remove('open');
    drawerBackdrop.classList.remove('open');
    drawer.setAttribute('aria-hidden', 'true');
  }

  document.getElementById('btn-menu').addEventListener('click', openDrawer);
  document.getElementById('closeDrawerBtn').addEventListener('click', closeDrawer);
  drawerBackdrop.addEventListener('click', closeDrawer);

  document.querySelectorAll('#providerSwitch .seg-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      if (state.micState !== 'idle') return;
      document.querySelectorAll('#providerSwitch .seg-btn').forEach((b) => b.classList.remove('active'));
      btn.classList.add('active');
      state.provider = btn.dataset.provider;
      persistSettings(true);
    });
  });

  const apiAccordionBtn = document.getElementById('apiAccordionBtn');
  const apiAccordionCollapse = document.getElementById('apiAccordionCollapse');
  apiAccordionBtn.addEventListener('click', () => {
    if (state.micState !== 'idle') return;
    const isOpen = apiAccordionBtn.classList.toggle('open');
    apiAccordionCollapse.classList.toggle('open', isOpen);
    apiAccordionBtn.setAttribute('aria-expanded', String(isOpen));
  });

  document.querySelectorAll('[data-toggle-pw]').forEach((btn) => {
    btn.addEventListener('click', () => {
      if (state.micState !== 'idle') return;
      const inp = document.getElementById(btn.dataset.togglePw);
      if (inp) inp.type = inp.type === 'password' ? 'text' : 'password';
    });
  });

  function syncBulkToolbarUI() {
    const count = state.selectedChatIds.size;
    selCountBadge.textContent = String(count);
    selCountBadge.classList.toggle('visible', count > 0);
    bulkDeleteBtn.classList.toggle('has-selection', count > 0);
  }

  function applyChatSelection(chatId, shouldSelect) {
    if (!chatId) return;
    const already = state.selectedChatIds.has(chatId);
    if (already === shouldSelect) return;

    if (shouldSelect) state.selectedChatIds.add(chatId);
    else state.selectedChatIds.delete(chatId);

    const rowEl = chatListEl.querySelector(`.chat-item[data-chat-id="${chatId}"]`);
    if (rowEl) {
      rowEl.classList.toggle('selected', shouldSelect);
      const checkCol = rowEl.querySelector('.chat-check-col');
      if (checkCol) checkCol.setAttribute('aria-checked', String(shouldSelect));
    }
    syncBulkToolbarUI();
  }

  bulkDeleteBtn.addEventListener('click', () => {
    if (state.micState !== 'idle' || state.selectedChatIds.size === 0) return;

    closeContextMenu();
    const idsToDelete = Array.from(state.selectedChatIds);
    const removedCount = idsToDelete.length;
    const activeWasDeleted = state.selectedChatIds.has(state.activeChatId);

    state.chats = state.chats.filter((c) => !state.selectedChatIds.has(c.id));
    state.selectedChatIds.clear();
    idbDeleteMany('chats', idsToDelete);

    if (activeWasDeleted) {
      stopActivePlayback();
      abortGeneration(false, true);
      if (state.chats.length === 0) {
        const fresh = createNewChatObject();
        state.chats.push(fresh);
        state.activeChatId = fresh.id;
        persistChat(fresh);
      } else {
        state.activeChatId = state.chats[0].id;
      }
      persistSettings();
      renderFeed();
    }

    renderChatList();
    showToast(`Удалено: ${pluralChats(removedCount)}`);
  });

  document.getElementById('selectAllBtn').addEventListener('click', () => {
    if (state.micState !== 'idle') return;
    state.chats.forEach((c) => applyChatSelection(c.id, true));
  });

  document.getElementById('deselectAllBtn').addEventListener('click', () => {
    if (state.micState !== 'idle') return;
    Array.from(state.selectedChatIds).forEach((id) => applyChatSelection(id, false));
  });

  function closeContextMenu() {
    state.contextMenuChatId = null;
    ctxMenu.classList.remove('open', 'drop-up');
    ctxBackdrop.classList.remove('visible');
    chatListEl.querySelectorAll('.chat-item.context-highlight').forEach((el) => {
      el.classList.remove('context-highlight');
    });
  }

  function renderContextMenuContent(chat) {
    const isPinned = Boolean(chat.pinned);
    ctxMenu.innerHTML = `
      <button class="ctx-item" id="ctxRenameBtn" role="menuitem">
        <span class="ctx-item-left">
          ${ICONS.editPencil}
          <span>Переименовать</span>
        </span>
      </button>
      <button class="ctx-item ${isPinned ? 'is-pinned' : ''}" id="ctxPinBtn" role="menuitemcheckbox" aria-checked="${isPinned}">
        <span class="ctx-item-left">
          ${ICONS.pushpin}
          <span>Pin</span>
        </span>
        <span class="ctx-pin-box">${ICONS.check}</span>
      </button>
    `;

    document.getElementById('ctxRenameBtn').addEventListener('click', () => {
      const targetId = chat.id;
      closeContextMenu();
      startInlineRename(targetId);
    });

    document.getElementById('ctxPinBtn').addEventListener('click', () => {
      chat.pinned = !chat.pinned;
      sortChatsPinnedFirst();
      persistChat(chat);
      renderContextMenuContent(chat);
      renderChatList();
      const rowEl = chatListEl.querySelector(`.chat-item[data-chat-id="${chat.id}"]`);
      if (rowEl) rowEl.classList.add('context-highlight');
    });
  }

  function openContextMenu(chatId, rowEl) {
    const chat = state.chats.find((c) => c.id === chatId);
    if (!chat || !rowEl) return;

    clearWindowSelection();
    closeContextMenu();
    state.contextMenuChatId = chatId;
    rowEl.classList.add('context-highlight');
    renderContextMenuContent(chat);

    const shellRect = appShell.getBoundingClientRect();
    const rowRect = rowEl.getBoundingClientRect();
    const menuW = 198;
    const menuH = 104;

    ctxMenu.style.top = 'auto';
    ctxMenu.style.bottom = 'auto';
    ctxMenu.style.left = 'auto';
    ctxMenu.style.right = 'auto';

    const spaceBelow = shellRect.bottom - rowRect.bottom - 14;
    const spaceAbove = rowRect.top - shellRect.top - 14;
    if (spaceBelow < menuH && spaceAbove > spaceBelow) {
      ctxMenu.classList.add('drop-up');
      ctxMenu.style.bottom = `${shellRect.bottom - rowRect.top + 6}px`;
    } else {
      ctxMenu.classList.remove('drop-up');
      ctxMenu.style.top = `${rowRect.bottom - shellRect.top + 6}px`;
    }

    const desiredLeft = Math.min(rowRect.left - shellRect.left + 16, shellRect.width - menuW - 12);
    ctxMenu.style.left = `${Math.max(12, desiredLeft)}px`;

    ctxBackdrop.classList.add('visible');
    ctxMenu.classList.add('open');

    if (navigator.vibrate) {
      try { navigator.vibrate(12); } catch (_) {}
    }
  }

  ctxBackdrop.addEventListener('click', closeContextMenu);

  function startInlineRename(chatId) {
    state.renamingChatId = chatId;
    renderChatList();
    requestAnimationFrame(() => {
      const inp = chatListEl.querySelector('.chat-rename-input');
      if (inp) {
        inp.focus();
        inp.select();
      }
    });
  }

  const dragSelect = {
    active: false,
    mode: true,
    lastChatId: null,
    usedTouch: false
  };

  function startDragSelect(chatId) {
    clearWindowSelection();
    dragSelect.active = true;
    dragSelect.mode = !state.selectedChatIds.has(chatId);
    dragSelect.lastChatId = chatId;
    applyChatSelection(chatId, dragSelect.mode);
  }

  function moveDragSelect(clientX, clientY) {
    if (!dragSelect.active) return;
    const el = document.elementFromPoint(clientX, clientY);
    if (!el) return;
    const col = el.closest('.chat-check-col');
    if (!col) return;
    const chatId = col.dataset.chatId;
    if (chatId && chatId !== dragSelect.lastChatId) {
      dragSelect.lastChatId = chatId;
      applyChatSelection(chatId, dragSelect.mode);
    }
  }

  function endDragSelect() {
    dragSelect.active = false;
    dragSelect.lastChatId = null;
  }

  window.addEventListener('pointermove', (e) => {
    if (!dragSelect.active || dragSelect.usedTouch) return;
    moveDragSelect(e.clientX, e.clientY);
  });

  window.addEventListener('pointerup', () => {
    if (dragSelect.active && !dragSelect.usedTouch) endDragSelect();
  });

  window.addEventListener('pointercancel', () => {
    if (dragSelect.active) endDragSelect();
  });

  chatListEl.addEventListener('touchmove', (e) => {
    if (!dragSelect.active) return;
    e.preventDefault();
    const t = e.touches[0];
    if (t) moveDragSelect(t.clientX, t.clientY);
  }, { passive: false });

  window.addEventListener('touchend', () => {
    if (dragSelect.active) {
      endDragSelect();
      setTimeout(() => { dragSelect.usedTouch = false; }, 350);
    }
  }, { passive: true });

  window.addEventListener('touchcancel', () => {
    if (dragSelect.active) {
      endDragSelect();
      dragSelect.usedTouch = false;
    }
  }, { passive: true });

  let drawerSwipeStartX = 0;
  let drawerSwipeStartY = 0;
  let drawerSwipeBlocked = false;

  drawer.addEventListener('touchstart', (e) => {
    drawerSwipeBlocked = Boolean(e.target.closest('.chat-check-col')) || Boolean(state.contextMenuChatId) || Boolean(state.renamingChatId);
    drawerSwipeStartX = e.touches[0].clientX;
    drawerSwipeStartY = e.touches[0].clientY;
  }, { passive: true });

  drawer.addEventListener('touchend', (e) => {
    if (drawerSwipeBlocked || dragSelect.active) return;
    const dx = drawerSwipeStartX - e.changedTouches[0].clientX;
    const dy = Math.abs(drawerSwipeStartY - e.changedTouches[0].clientY);
    if (dx > 64 && dx > dy * 1.5) closeDrawer();
  }, { passive: true });

  function renderChatList() {
    chatListEl.innerHTML = '';

    if (state.chats.length === 0) {
      chatListEl.innerHTML = '<div class="chat-list-empty">История чатов пуста</div>';
      syncBulkToolbarUI();
      return;
    }

    state.chats.forEach((chat) => {
      const isActive = chat.id === state.activeChatId;
      const isSelected = state.selectedChatIds.has(chat.id);
      const isRenaming = state.renamingChatId === chat.id;

      const row = document.createElement('div');
      row.className = `chat-item${isActive ? ' active' : ''}${isSelected ? ' selected' : ''}`;
      row.dataset.chatId = chat.id;

      const mainArea = document.createElement('div');
      mainArea.className = 'chat-item-main';

      if (isRenaming) {
        const oldTitle = chat.title;
        let settled = false;

        const renameInput = document.createElement('input');
        renameInput.type = 'text';
        renameInput.className = 'chat-rename-input';
        renameInput.value = oldTitle;
        renameInput.setAttribute('aria-label', 'Новое название чата');

        const commitRename = (save) => {
          if (settled) return;
          settled = true;
          if (save) {
            const trimmed = renameInput.value.trim();
            chat.title = trimmed.length > 0 ? trimmed : oldTitle;
            persistChat(chat);
          } else {
            chat.title = oldTitle;
          }
          state.renamingChatId = null;
          renderChatList();
        };

        renameInput.addEventListener('keydown', (e) => {
          e.stopPropagation();
          if (e.key === 'Enter') {
            e.preventDefault();
            commitRename(true);
          } else if (e.key === 'Escape') {
            e.preventDefault();
            commitRename(false);
          }
        });

        renameInput.addEventListener('blur', () => commitRename(true));
        renameInput.addEventListener('click', (e) => e.stopPropagation());

        mainArea.appendChild(renameInput);

        const metaEl = document.createElement('div');
        metaEl.className = 'chat-item-meta';
        metaEl.textContent = `${chat.date} · ${chat.messages.length} сообщ.`;
        mainArea.appendChild(metaEl);
      } else {
        mainArea.innerHTML = `
          <div class="chat-title">${escapeHtml(chat.title)}</div>
          <div class="chat-item-meta">${escapeHtml(chat.date)} · ${chat.messages.length} сообщ.</div>
        `;

        let lpTimer = null;
        let lpStartX = 0;
        let lpStartY = 0;
        let lpTriggered = false;

        const cancelLongPress = () => {
          if (lpTimer) {
            clearTimeout(lpTimer);
            lpTimer = null;
          }
        };

        const armLongPress = (x, y) => {
          clearWindowSelection();
          cancelLongPress();
          lpTriggered = false;
          lpStartX = x;
          lpStartY = y;
          lpTimer = setTimeout(() => {
            lpTimer = null;
            lpTriggered = true;
            clearWindowSelection();
            openContextMenu(chat.id, row);
          }, 450);
        };

        mainArea.addEventListener('touchstart', (e) => {
          clearWindowSelection();
          const t = e.touches[0];
          if (t) armLongPress(t.clientX, t.clientY);
        }, { passive: true });

        mainArea.addEventListener('touchmove', (e) => {
          if (!lpTimer) return;
          const t = e.touches[0];
          if (!t) return;
          if (Math.hypot(t.clientX - lpStartX, t.clientY - lpStartY) > 10) {
            cancelLongPress();
          }
        }, { passive: true });

        mainArea.addEventListener('touchend', () => {
          cancelLongPress();
          if (lpTriggered) clearWindowSelection();
        }, { passive: true });

        mainArea.addEventListener('touchcancel', cancelLongPress, { passive: true });

        mainArea.addEventListener('pointerdown', (e) => {
          clearWindowSelection();
          if (e.pointerType === 'touch' || e.button !== 0) return;
          armLongPress(e.clientX, e.clientY);
        });

        mainArea.addEventListener('pointermove', (e) => {
          if (!lpTimer || e.pointerType === 'touch') return;
          if (Math.hypot(e.clientX - lpStartX, e.clientY - lpStartY) > 10) {
            cancelLongPress();
          }
        });

        mainArea.addEventListener('pointerup', cancelLongPress);
        mainArea.addEventListener('pointerleave', cancelLongPress);

        mainArea.addEventListener('contextmenu', (e) => {
          e.preventDefault();
          e.stopPropagation();
          cancelLongPress();
          clearWindowSelection();
          openContextMenu(chat.id, row);
        });

        mainArea.addEventListener('click', () => {
          if (lpTriggered) {
            lpTriggered = false;
            return;
          }
          if (state.contextMenuChatId || state.micState !== 'idle') return;
          stopActivePlayback();
          abortGeneration(false, true);
          state.activeChatId = chat.id;
          persistSettings();
          renderFeed();
          closeDrawer();
        });
      }

      row.appendChild(mainArea);

      if (chat.pinned) {
        const pinEl = document.createElement('div');
        pinEl.className = 'chat-pin-indicator';
        pinEl.setAttribute('aria-label', 'Закреплённый чат');
        pinEl.innerHTML = ICONS.pushpin;
        row.appendChild(pinEl);
      }

      const checkCol = document.createElement('div');
      checkCol.className = 'chat-check-col';
      checkCol.dataset.chatId = chat.id;
      checkCol.setAttribute('role', 'checkbox');
      checkCol.setAttribute('aria-checked', String(isSelected));
      checkCol.setAttribute('aria-label', `Выбрать чат ${chat.title}`);
      checkCol.innerHTML = `
        <div class="ios-checkbox">
          <svg viewBox="0 0 24 24"><polyline points="5 13 10 18 19 7"></polyline></svg>
        </div>
      `;

      checkCol.addEventListener('touchstart', (e) => {
        e.preventDefault();
        e.stopPropagation();
        dragSelect.usedTouch = true;
        startDragSelect(chat.id);
      }, { passive: false });

      checkCol.addEventListener('pointerdown', (e) => {
        if (e.pointerType === 'touch' || dragSelect.usedTouch) return;
        e.preventDefault();
        e.stopPropagation();
        startDragSelect(chat.id);
      });

      row.appendChild(checkCol);
      chatListEl.appendChild(row);
    });

    syncBulkToolbarUI();
  }

  /* =========================================================================
     ASYNC INITIALIZATION (HYDRATE INDEXEDDB -> RENDER -> FETCH MODELS)
     ========================================================================= */
  async function hydrateFromIndexedDB() {
    // 1. Load cached Gemini models first (fast boot)
    const cachedModelsRec = await idbGet('kv', 'cachedGeminiModels');
    if (cachedModelsRec && cachedModelsRec.value && Array.isArray(cachedModelsRec.value.models) && cachedModelsRec.value.models.length > 0) {
      state.chatModels = cachedModelsRec.value.models;
    }

    // 2. Load settings
    const settingsRec = await idbGet('kv', 'settings');
    if (settingsRec && settingsRec.value) {
      const s = settingsRec.value;
      if (s.provider === 'openrouter' || s.provider === 'direct') state.provider = s.provider;
      if (s.apiKeys) {
        state.apiKeys.openrouter = s.apiKeys.openrouter || '';
        state.apiKeys.customUrl = s.apiKeys.customUrl || '';
        state.apiKeys.elevenlabs = s.apiKeys.elevenlabs || '';
      }
      if (typeof s.nextOrder === 'number') state.nextOrder = s.nextOrder;
      if (typeof s.flexEnabled === 'boolean') state.flexEnabled = s.flexEnabled;
      if (typeof s.thinking === 'string') state.thinking = s.thinking;
      if (typeof s.autoTts === 'boolean') state.autoTts = s.autoTts;

      if (s.ttsId && TTS_MODELS.some((t) => t.id === s.ttsId)) state.ttsId = s.ttsId;
      if (s.sttId && STT_MODELS.some((st) => st.id === s.sttId)) state.sttId = s.sttId;
      state.morphId = 'off';

      if (s.voicePresets && typeof s.voicePresets === 'object') {
        Object.keys(state.voicePresets).forEach((k) => {
          if (s.voicePresets[k]) {
            state.voicePresets[k] = {
              voice: s.voicePresets[k].voice || state.voicePresets[k].voice,
              speed: Number(s.voicePresets[k].speed) || 1.0,
              pitch: Number(s.voicePresets[k].pitch) || 1.0
            };
          }
        });
      }
      if (s.activeVoicePreset && state.voicePresets[s.activeVoicePreset]) {
        state.activeVoicePreset = s.activeVoicePreset;
      }
      const activeVp = state.voicePresets[state.activeVoicePreset];
      if (activeVp) {
        state.voiceDraft = { voice: activeVp.voice, speed: activeVp.speed, pitch: activeVp.pitch };
      }

      if (Array.isArray(s.personas) && s.personas.length === 4) {
        state.personas = s.personas.map((p) => ({
          name: (p && p.name) || '',
          instructions: (p && p.instructions) || ''
        }));
      }
      if (typeof s.activePersonaIndex === 'number' && s.activePersonaIndex >= 0 && s.activePersonaIndex < 4) {
        state.activePersonaIndex = s.activePersonaIndex;
      }
      const activePer = state.personas[state.activePersonaIndex];
      if (activePer) {
        state.personaDraft = { name: activePer.name, instructions: activePer.instructions };
      }

      if (s.modelId) {
        const foundModel = state.chatModels.find((m) => m.id === s.modelId);
        if (foundModel) {
          applySelectedModel(foundModel, false);
        } else {
          state.modelId = s.modelId;
          state.modelLabel = s.modelLabel || s.modelId;
          applySelectedModel(getCurrentModelObj(), false);
        }
      } else {
        applySelectedModel(state.chatModels[0], false);
      }

      if (s.activeChatId) state.activeChatId = s.activeChatId;
    } else {
      applySelectedModel(state.chatModels[0], false);
    }

    // 3. Load chats (or seed INITIAL_CHATS on very first launch)
    const savedChats = await idbGetAll('chats');
    if (savedChats && savedChats.length > 0) {
      state.chats = savedChats;
      sortChatsPinnedFirst();
      if (!state.chats.some((c) => c.id === state.activeChatId)) {
        state.activeChatId = state.chats[0].id;
      }
    } else {
      state.chats = JSON.parse(JSON.stringify(INITIAL_CHATS));
      state.activeChatId = 'chat-1';
      persistAllChats();
      persistSettings(true);
    }

    // 4. Load 24h usage log & rate limit metadata
    const usageRec = await idbGet('kv', 'usageLog');
    if (usageRec && Array.isArray(usageRec.value)) {
      state.usageLog = usageRec.value;
      pruneUsageLog24h();
    }
    const rlRec = await idbGet('kv', 'rateLimitInfo');
    if (rlRec && rlRec.value) {
      state.rateLimitInfo = rlRec.value;
    }

    lastFetchedOrKey = state.apiKeys.openrouter || '';
  }

  async function initApp() {
    await hydrateFromIndexedDB();

    syncHeaderUI();
    syncAudioPanelUI();
    syncPersonaUI();
    syncDrawerSettingsUI();
    syncSendButton();
    updateComposerLayout();
    syncFloatingPanelsPosition();
    renderFeed();
    renderChatList();

    // Fetch live Gemini text models from OpenRouter on startup
    fetchGeminiModelsFromOpenRouter(false);
  }

  initApp();
})();
