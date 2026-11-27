(function () {
  'use strict';

  /* =========================================================================
     CONSTANTS & CATALOGS (STEP 4.9: FILE UPLOADS + RECORD-TO-SEND + AI IMAGES & LINKS)
     ========================================================================= */
  const DB_NAME = 'OpenRouterPWA_DB';
  const DB_VERSION = 2;
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
    { id: 'google/gemini-3.8-flash-lite-tts', name: 'Gemini 3.8 Flash Lite TTS', usdPer1MChars: 9 },
    { id: 'google/gemini-3.8-flash-tts', name: 'Gemini 3.8 Flash TTS', usdPer1MChars: 13 },
    { id: 'x-ai/grok-voice-tts-1.0', name: 'Grok Voice TTS 1.0', usdPer1MChars: 15 },
    { id: 'elevenlabs/eleven-v4-turbo', name: 'Eleven v4 Turbo', usdPer1MChars: 40 },
    { id: 'elevenlabs-byok', name: 'ElevenLabs BYOK', usdPer1MChars: 0 }
  ];

  const TTS_SAMPLING_DEFAULTS = {
    temperature: 1.00,
    topP: 0.95,
    topK: 40
  };

  function clampTtsTemperature(v) {
    const n = Number(v);
    if (!Number.isFinite(n)) return TTS_SAMPLING_DEFAULTS.temperature;
    return Math.round(Math.max(0.0, Math.min(2.0, n)) * 100) / 100;
  }

  function clampTtsTopP(v) {
    const n = Number(v);
    if (!Number.isFinite(n)) return TTS_SAMPLING_DEFAULTS.topP;
    return Math.round(Math.max(0.01, Math.min(1.0, n)) * 100) / 100;
  }

  function clampTtsTopK(v) {
    const n = Number(v);
    if (!Number.isFinite(n)) return TTS_SAMPLING_DEFAULTS.topK;
    return Math.round(Math.max(1, Math.min(100, n)));
  }

  function ttsModelSupportsSamplingParams(ttsId) {
    return String(ttsId || '').toLowerCase().startsWith('google/gemini-');
  }

  function getActiveTtsSamplingParams(ttsId) {
    if (!ttsModelSupportsSamplingParams(ttsId)) return null;
    const d = state.voiceDraft || {};
    return {
      temperature: clampTtsTemperature(d.temperature),
      topP: clampTtsTopP(d.topP),
      topK: clampTtsTopK(d.topK)
    };
  }

  function formatTtsSamplingKey(params) {
    if (!params) return '';
    return `t=${params.temperature.toFixed(2)},p=${params.topP.toFixed(2)},k=${params.topK}`;
  }

  const STT_MODELS = [
    { id: 'openai/whisper-large-v3', name: 'Whisper Large v3', usdPerMin: 0.0015 },
    { id: 'x-ai/grok-stt-2.0', name: 'Grok STT 2.0', usdPerMin: 0.00168 },
    { id: 'google/gemini-3.5-transcribe', name: 'Gemini 3.5 Transcribe', usdPerMin: 0.005 }
  ];

  // Morph is fixed to Off at this stage
  const MORPH_MODES = [
    { id: 'off', name: 'Off' }
  ];

  const GEMINI_VOICES = [
    'Puck', 'Zephyr', 'Aoede', 'Charon',
    'Fenrir', 'Kore', 'Leda', 'Orus',
    'Perseus', 'Callirrhoe', 'Autonoe', 'Enceladus',
    'Iapetus', 'Umbriel', 'Algieba', 'Despina',
    'Erinome', 'Algenib', 'Rasalgethi', 'Laomedeia',
    'Achernar', 'Alnilam', 'Schedar', 'Gacrux',
    'Pulcherrima', 'Achird', 'Zubenelgenubi', 'Vindemiatrix',
    'Sadachbia', 'Sadaltager', 'Sulafat'
  ];

  const GROK_FALLBACK_VOICES = ['Ara', 'Rex', 'Sal', 'Eve', 'Leo'];

  const ELEVENLABS_OPENROUTER_FALLBACK_VOICES = [
    'Rachel', 'Aria', 'Roger', 'Sarah', 'Charlie',
    'George', 'Callum', 'Liam', 'Charlotte', 'Alice'
  ];

  const ELEVENLABS_BYOK_FALLBACK_VOICES = [
    { id: '21m00Tcm4TlvDq8ikWAM', name: 'Rachel' },
    { id: '9BWtsMINqrJLrRacOk9x', name: 'Aria' },
    { id: 'CwhRBWXzGAHq8TQ4Fs17', name: 'Roger' },
    { id: 'EXAVITQu4vr4xnSDxMaL', name: 'Sarah' },
    { id: 'IKne3meq5aSn9XLyUdCD', name: 'Charlie' },
    { id: 'JBFqnCBsd6RMkjVDRZzb', name: 'George' },
    { id: 'N2lVS1w4EtoT3dr4eOWO', name: 'Callum' },
    { id: 'TX3LPaxmHKxFdv7VOQHJ', name: 'Liam' }
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
        if (!db.objectStoreNames.contains('ttsCache')) {
          db.createObjectStore('ttsCache', { keyPath: 'key' });
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
    modelCapsOverrides: {},
    endpointProbedAt: {},
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
      'Voice 1': { voice: 'Puck', speed: 1.15, pitch: 1.00, temperature: 1.00, topP: 0.95, topK: 40 },
      'Voice 2': { voice: 'Zephyr', speed: 1.25, pitch: 0.96, temperature: 1.00, topP: 0.95, topK: 40 },
      'Voice 3': { voice: 'Charon', speed: 1.00, pitch: 0.92, temperature: 1.00, topP: 0.95, topK: 40 },
      'Voice 4': { voice: 'Fenrir', speed: 1.10, pitch: 0.88, temperature: 1.00, topP: 0.95, topK: 40 }
    },
    voiceDraft: { voice: 'Puck', speed: 1.15, pitch: 1.00, temperature: 1.00, topP: 0.95, topK: 40 },

    activePersonaIndex: 0,
    personas: [
      { name: '', instructions: '', ttsTags: false },
      { name: '', instructions: '', ttsTags: false },
      { name: '', instructions: '', ttsTags: false },
      { name: '', instructions: '', ttsTags: false }
    ],
    personaDraft: { name: '', instructions: '', ttsTags: false },

    usageLog: [],
    rateLimitInfo: null,
    modelRateLimits: {},

    creditsInfo: {
      totalCredits: null,
      totalUsage: null,
      remaining: null,
      updatedAt: 0
    },
    keyInfo: {
      limit: null,
      limitRemaining: null,
      usageDaily: null,
      usageTotal: null,
      isFreeTier: null,
      updatedAt: 0
    },
    balanceLoading: false,
    balanceError: '',
    balanceAccordionOpen: false,
    statsTickTimer: null,

    ttsVoicesByModel: {},
    ttsFormatsByModel: {},
    ttsFormatOverrides: {},
    elevenByokVoices: ELEVENLABS_BYOK_FALLBACK_VOICES.slice(),

    openPopover: null,
    openInfoMsgId: null,
    editingMsgId: null,
    editingMsgDraft: '',
    ttsPlayingMsgId: null,
    ttsPaused: false,
    ttsActiveModelId: null,
    ttsActiveVoiceApiId: null,
    ttsActiveSamplingKey: '',
    ttsPausedTime: 0,
    ttsPausedDuration: 0,
    ttsPitchChangedWhilePaused: false,
    ttsSessionId: 0,
    ttsAbortController: null,
    ttsResolveCurrentPlay: null,
    ttsCurrentChunk: null,
    ttsAppliedPitch: 1.0,
    ttsActiveBlobUrl: null,
    ttsPitchRepatchTimer: null,

    generatingMsgId: null,
    generatingChatId: null,
    abortController: null,
    streamRafId: null,

    isExpanded: false,
    pendingAttachments: [],

    micState: 'idle',
    micStarting: false,
    micCancelPending: false,
    autoSendAfterTranscribe: false,
    audioSessionRestoreTimer: null,
    recSeconds: 0,
    recStartedAt: 0,
    recInterval: null,
    mediaStream: null,
    mediaRecorder: null,
    recordedChunks: [],
    recordedMimeType: ''
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
        plainText: m.plainText !== undefined ? m.plainText : undefined,
        attachments: Array.isArray(m.attachments) && m.attachments.length > 0 ? m.attachments : undefined,
        images: Array.isArray(m.images) && m.images.length > 0 ? m.images : undefined,
        citations: Array.isArray(m.citations) && m.citations.length > 0 ? m.citations : undefined,
        usage: m.usage || undefined
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

  function normalizeResetTimestampMs(rawReset) {
    if (rawReset === null || rawReset === undefined || rawReset === '') return null;
    const n = Number(rawReset);
    if (!Number.isFinite(n) || n <= 0) return null;
    // OpenRouter may send epoch seconds (< 1e12) or epoch milliseconds (>= 1e12)
    return n < 1e12 ? Math.round(n * 1000) : Math.round(n);
  }

  function captureRateLimitHeaders(headers, modelId = null) {
    if (!headers || !headers.get) return;
    const limit = headers.get('x-ratelimit-limit');
    const remaining = headers.get('x-ratelimit-remaining');
    const reset = headers.get('x-ratelimit-reset');
    if (limit !== null || remaining !== null || reset !== null) {
      const info = {
        limit: limit !== null && limit !== '' && Number.isFinite(Number(limit)) ? Number(limit) : null,
        remaining: remaining !== null && remaining !== '' && Number.isFinite(Number(remaining)) ? Number(remaining) : null,
        resetMs: normalizeResetTimestampMs(reset),
        updatedAt: Date.now()
      };
      state.rateLimitInfo = info;
      idbPut('kv', { key: 'rateLimitInfo', value: state.rateLimitInfo });

      if (modelId) {
        state.modelRateLimits[modelId] = info;
        idbPut('kv', { key: 'modelRateLimits', value: state.modelRateLimits });
      }
    }
  }

  /* =========================================================================
     OPENROUTER REAL-TIME BALANCE (/credits & /key) & 24H STATS ENGINE
     ========================================================================= */
  let balanceFollowupTimer = null;

  function formatUsd3(val) {
    const num = Number(val);
    if (!Number.isFinite(num)) return '0.000';
    return Math.max(0, num).toFixed(3);
  }

  function formatCompactInt(n) {
    const num = Math.round(Number(n) || 0);
    return num.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
  }

  function getAccountDisplayBalance() {
    if (typeof state.creditsInfo.remaining === 'number' && Number.isFinite(state.creditsInfo.remaining)) {
      return state.creditsInfo.remaining;
    }
    if (typeof state.keyInfo.limitRemaining === 'number' && Number.isFinite(state.keyInfo.limitRemaining)) {
      return state.keyInfo.limitRemaining;
    }
    return null;
  }

  function syncBalanceButtonUI() {
    if (!balanceBtnVal) return;
    const bal = getAccountDisplayBalance();
    const text = bal !== null ? `$${formatUsd3(bal)}` : '$0.000';
    balanceBtnVal.textContent = text;
    balanceBtnVal.dataset.label = text;
  }

  function isBalanceAccordionVisible() {
    return Boolean(state.balanceAccordionOpen && drawer && drawer.classList.contains('open'));
  }

  function stopStatsTickTimer() {
    if (state.statsTickTimer) {
      clearInterval(state.statsTickTimer);
      state.statsTickTimer = null;
    }
  }

  function startStatsTickTimer() {
    stopStatsTickTimer();
    if (!state.balanceAccordionOpen) return;
    state.statsTickTimer = setInterval(() => {
      if (isBalanceAccordionVisible()) {
        renderStatsPanelContent();
      } else {
        stopStatsTickTimer();
      }
    }, 30000);
  }

  function getDailyFreeQuotaLimit() {
    if (
      state.rateLimitInfo &&
      typeof state.rateLimitInfo.limit === 'number' &&
      state.rateLimitInfo.limit > 0 &&
      (Date.now() - (state.rateLimitInfo.updatedAt || 0)) < 24 * 60 * 60 * 1000
    ) {
      return state.rateLimitInfo.limit;
    }
    if (typeof state.creditsInfo.totalCredits === 'number' && state.creditsInfo.totalCredits >= 10) {
      return 1000;
    }
    if (state.keyInfo.isFreeTier === false) {
      return 1000;
    }
    return 50;
  }

  function getNextUtcMidnightMs() {
    const now = new Date();
    return Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1, 0, 0, 0, 0);
  }

  function getResetCountdownHHMM(customResetMs = null) {
    const now = Date.now();
    let targetMs = null;

    if (typeof customResetMs === 'number' && customResetMs > now + 1000) {
      targetMs = customResetMs;
    } else if (
      state.rateLimitInfo &&
      typeof state.rateLimitInfo.resetMs === 'number' &&
      state.rateLimitInfo.resetMs > now + 1000
    ) {
      targetMs = state.rateLimitInfo.resetMs;
    } else {
      targetMs = getNextUtcMidnightMs();
    }

    const diffMs = Math.max(0, targetMs - now);
    const totalMinutes = Math.ceil(diffMs / 60000);
    const hours = Math.floor(totalMinutes / 60);
    const mins = totalMinutes % 60;
    return `${String(hours).padStart(2, '0')}:${String(mins).padStart(2, '0')}`;
  }

  async function fetchOpenRouterBalance(showFeedback = false) {
    const key = (state.apiKeys.openrouter || '').trim();
    if (!key) {
      state.creditsInfo = { totalCredits: null, totalUsage: null, remaining: null, updatedAt: 0 };
      state.keyInfo = { limit: null, limitRemaining: null, usageDaily: null, usageTotal: null, isFreeTier: null, updatedAt: 0 };
      state.balanceError = '';
      syncBalanceButtonUI();
      if (state.balanceAccordionOpen) renderStatsPanelContent();
      return;
    }

    if (state.balanceLoading) return;
    state.balanceLoading = true;
    state.balanceError = '';

    if (state.balanceAccordionOpen) {
      renderStatsPanelContent();
    }

    const headers = {
      Accept: 'application/json',
      Authorization: `Bearer ${key}`
    };

    try {
      const [creditsRes, keyRes] = await Promise.allSettled([
        fetch(`${OPENROUTER_API_BASE}/credits`, { method: 'GET', headers }),
        fetch(`${OPENROUTER_API_BASE}/key`, { method: 'GET', headers })
      ]);

      let gotAnyData = false;

      if (creditsRes.status === 'fulfilled' && creditsRes.value && creditsRes.value.ok) {
        const json = await creditsRes.value.json();
        const d = (json && json.data) || {};
        const totalCredits = Number(d.total_credits);
        const totalUsage = Number(d.total_usage);
        if (Number.isFinite(totalCredits) && Number.isFinite(totalUsage)) {
          state.creditsInfo = {
            totalCredits,
            totalUsage,
            remaining: Math.max(0, totalCredits - totalUsage),
            updatedAt: Date.now()
          };
          idbPut('kv', { key: 'creditsInfo', value: state.creditsInfo });
          gotAnyData = true;
        }
      }

      if (keyRes.status === 'fulfilled' && keyRes.value && keyRes.value.ok) {
        const json = await keyRes.value.json();
        const d = (json && json.data) || {};
        const limit = d.limit !== null && d.limit !== undefined && Number.isFinite(Number(d.limit)) ? Number(d.limit) : null;
        const limitRemaining = d.limit_remaining !== null && d.limit_remaining !== undefined && Number.isFinite(Number(d.limit_remaining))
          ? Math.max(0, Number(d.limit_remaining))
          : null;
        const usageDaily = d.usage_daily !== null && d.usage_daily !== undefined && Number.isFinite(Number(d.usage_daily))
          ? Math.max(0, Number(d.usage_daily))
          : null;
        const usageTotal = d.usage !== null && d.usage !== undefined && Number.isFinite(Number(d.usage))
          ? Math.max(0, Number(d.usage))
          : null;

        state.keyInfo = {
          limit,
          limitRemaining,
          usageDaily,
          usageTotal,
          isFreeTier: typeof d.is_free_tier === 'boolean' ? d.is_free_tier : null,
          updatedAt: Date.now()
        };
        idbPut('kv', { key: 'keyInfo', value: state.keyInfo });
        gotAnyData = true;
      }

      if (!gotAnyData) {
        const creditsStatus = creditsRes.status === 'fulfilled' && creditsRes.value ? creditsRes.value.status : 0;
        const keyStatus = keyRes.status === 'fulfilled' && keyRes.value ? keyRes.value.status : 0;
        const status = creditsStatus || keyStatus;
        state.balanceError = status === 401 ? 'Неверный API ключ' : `Ошибка баланса${status ? ` (${status})` : ''}`;
        if (showFeedback) showToast(state.balanceError);
      } else if (showFeedback) {
        const bal = getAccountDisplayBalance();
        showToast(bal !== null ? `Баланс: $${formatUsd3(bal)}` : 'Баланс обновлён');
      }
    } catch (err) {
      state.balanceError = 'Ошибка сети при загрузке баланса';
      if (showFeedback) showToast(state.balanceError);
    } finally {
      state.balanceLoading = false;
      syncBalanceButtonUI();
      if (state.balanceAccordionOpen) {
        renderStatsPanelContent();
      }
    }
  }

  function scheduleBalanceRefreshAfterRequest() {
    if (state.provider !== 'openrouter' || !(state.apiKeys.openrouter || '').trim()) return;
    fetchOpenRouterBalance(false);
    clearTimeout(balanceFollowupTimer);
    balanceFollowupTimer = setTimeout(() => {
      balanceFollowupTimer = null;
      fetchOpenRouterBalance(false);
    }, 1800);
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
    'veo',
    ':batch',
    '-batch',
    '/batch'
  ];

  function isBatchModelMeta(raw) {
    if (!raw) return false;
    const id = String(raw.id || '').toLowerCase();
    const name = String(raw.name || raw.fullName || raw.label || '').toLowerCase();
    if (id.includes(':batch') || id.includes('-batch') || id.includes('/batch')) return true;
    if (/\bbatch\b/.test(name)) return true;
    return false;
  }

  function isTextGeminiModel(raw) {
    if (!raw || typeof raw.id !== 'string') return false;
    if (isBatchModelMeta(raw)) return false;
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

  const VALID_EFFORT_ORDER = ['none', 'minimal', 'low', 'medium', 'high'];

  function normalizeEffortList(arr) {
    if (!Array.isArray(arr)) return [];
    const set = new Set(arr.map((x) => String(x || '').toLowerCase().trim()));
    return VALID_EFFORT_ORDER.filter((lvl) => set.has(lvl));
  }

  function extractExplicitEffortsFromMeta(raw) {
    if (!raw || typeof raw !== 'object') return [];
    const candidates = [
      raw.supported_reasoning_efforts,
      raw.reasoning_efforts,
      raw.reasoning && raw.reasoning.supported_efforts,
      raw.reasoning && raw.reasoning.efforts,
      raw.architecture && raw.architecture.supported_reasoning_efforts,
      raw.architecture && raw.architecture.reasoning_efforts
    ];
    for (let i = 0; i < candidates.length; i++) {
      const normalized = normalizeEffortList(candidates[i]);
      if (normalized.length > 0) return normalized;
    }
    return [];
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

    // Trust explicit effort enum from API metadata if present
    const explicit = extractExplicitEffortsFromMeta(raw);
    if (explicit.length > 0) {
      return { supportsReasoning: true, thinkingLevels: explicit };
    }

    const ver = parseGeminiVersionScore(id);
    const isFlashOrLite = id.includes('flash') || id.includes('lite');
    const isProOrUltra = (id.includes('pro') || id.includes('ultra')) && !isFlashOrLite;

    // Gemini 2.5 Pro, 3.x Pro, and dedicated *-thinking models require low..high
    if (id.includes('thinking') || (/gemini-2\.5-pro/.test(id) && !isFlashOrLite) || (ver >= 3 && ver < 4 && isProOrUltra)) {
      return { supportsReasoning: true, thinkingLevels: ['low', 'medium', 'high'] };
    }

    // Gemini 4.x flagship / non-flash models (e.g. 4 Argon, 4 Hydrogen): reasoning is mandatory (no 'none'), minimal..high allowed
    if (ver >= 4 && !isFlashOrLite) {
      return { supportsReasoning: true, thinkingLevels: ['minimal', 'low', 'medium', 'high'] };
    }

    // Gemini 3.x / 4.x Flash & Flash-Lite: toggleable including minimal
    if (ver >= 3 && isFlashOrLite) {
      return { supportsReasoning: true, thinkingLevels: ['none', 'minimal', 'low', 'medium', 'high'] };
    }

    // Gemini 2.5 Flash / Flash-Lite: toggleable without minimal
    if (ver >= 2.5 && isFlashOrLite) {
      return { supportsReasoning: true, thinkingLevels: ['none', 'low', 'medium', 'high'] };
    }

    return { supportsReasoning: true, thinkingLevels: ['low', 'medium', 'high'] };
  }

  function applyModelCapsOverride(modelObj) {
    if (!modelObj || !modelObj.id) return modelObj;
    const ov = state.modelCapsOverrides && state.modelCapsOverrides[modelObj.id];
    if (!ov || typeof ov !== 'object') return modelObj;
    if (typeof ov.supportsReasoning === 'boolean') {
      modelObj.supportsReasoning = ov.supportsReasoning;
    }
    if (Array.isArray(ov.thinkingLevels) && ov.thinkingLevels.length > 0) {
      const cleaned = normalizeEffortList(ov.thinkingLevels);
      if (cleaned.length > 0) {
        modelObj.thinkingLevels = cleaned;
      }
    }
    if (typeof ov.supportsFlex === 'boolean') {
      modelObj.supportsFlex = ov.supportsFlex;
    }
    if (typeof ov.supportsPromptCaching === 'boolean') {
      modelObj.supportsPromptCaching = ov.supportsPromptCaching;
    }
    return modelObj;
  }

  function saveModelCapsOverride(modelId, patch) {
    if (!modelId || !patch) return;
    const prev = state.modelCapsOverrides[modelId] || {};
    state.modelCapsOverrides[modelId] = Object.assign({}, prev, patch, { updatedAt: Date.now() });
    idbPut('kv', { key: 'modelCapsOverrides', value: state.modelCapsOverrides });

    const m = state.chatModels.find((item) => item.id === modelId);
    if (m) {
      applyModelCapsOverride(m);
      if (state.modelId === modelId) {
        coerceThinkingForModel(m);
        state.modelSupportsFlex = Boolean(m.supportsFlex);
        syncHeaderUI();
        persistSettings();
      }
    }
    if (state.openPopover === 'model') {
      renderModelDropdownContent();
    }
  }

  async function fetchModelEndpointsCapabilities(modelId) {
    if (!modelId || state.provider !== 'openrouter') return;
    const cleanId = String(modelId).split(':')[0];
    const parts = cleanId.split('/');
    if (parts.length !== 2) return;

    const lastProbed = state.endpointProbedAt[modelId] || 0;
    if (Date.now() - lastProbed < 6 * 60 * 60 * 1000) return;
    state.endpointProbedAt[modelId] = Date.now();

    try {
      const headers = { Accept: 'application/json' };
      const key = (state.apiKeys.openrouter || '').trim();
      if (key) headers.Authorization = `Bearer ${key}`;

      const url = `${OPENROUTER_API_BASE}/models/${encodeURIComponent(parts[0])}/${encodeURIComponent(parts[1])}/endpoints`;
      const resp = await fetch(url, { method: 'GET', headers });
      if (!resp.ok) return;
      const json = await resp.json();
      const data = (json && json.data) || {};
      const endpoints = Array.isArray(data.endpoints) ? data.endpoints : [];
      if (endpoints.length === 0) return;

      const paramSet = new Set();
      let explicitEfforts = [];
      let mandatoryReasoning = false;

      endpoints.forEach((ep) => {
        if (!ep || typeof ep !== 'object') return;
        if (Array.isArray(ep.supported_parameters)) {
          ep.supported_parameters.forEach((p) => paramSet.add(String(p).toLowerCase()));
        }
        const epEfforts = extractExplicitEffortsFromMeta(ep);
        if (epEfforts.length > 0 && explicitEfforts.length === 0) {
          explicitEfforts = epEfforts;
        }
        if (ep.reasoning_required === true || ep.mandatory_reasoning === true) {
          mandatoryReasoning = true;
        }
      });

      const hasReasoning =
        paramSet.has('reasoning') ||
        paramSet.has('include_reasoning') ||
        paramSet.has('reasoning_effort');

      const patch = {};
      if (paramSet.size > 0 && !hasReasoning) {
        patch.supportsReasoning = false;
        patch.thinkingLevels = ['none'];
      } else if (explicitEfforts.length > 0) {
        patch.supportsReasoning = true;
        patch.thinkingLevels = explicitEfforts;
      } else if (mandatoryReasoning) {
        const cur = state.chatModels.find((m) => m.id === modelId);
        const curLevels = (cur && cur.thinkingLevels) || ['minimal', 'low', 'medium', 'high'];
        const withoutNone = curLevels.filter((l) => l !== 'none');
        if (withoutNone.length > 0) {
          patch.supportsReasoning = true;
          patch.thinkingLevels = withoutNone;
        }
      }

      if (Object.keys(patch).length > 0) {
        saveModelCapsOverride(modelId, patch);
      }
    } catch (_) {}
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
      const cacheReadPrice = parseFloat(raw.pricing && raw.pricing.input_cache_read);
      const cacheWritePrice = parseFloat(raw.pricing && raw.pricing.input_cache_write);

      mapped.push(applyModelCapsOverride({
        id,
        label: formatGeminiShortLabel(raw),
        fullName: raw.name || id,
        supportsFlex,
        supportsReasoning,
        supportsPromptCaching: true,
        thinkingLevels,
        isFree,
        contextLength: raw.context_length || 0,
        pricing: {
          prompt: promptPrice,
          completion: completionPrice,
          cacheRead: Number.isFinite(cacheReadPrice) ? cacheReadPrice : null,
          cacheWrite: Number.isFinite(cacheWritePrice) ? cacheWritePrice : null
        }
      }));
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
    applyModelCapsOverride(target);
    state.modelId = target.id;
    state.modelLabel = target.label;
    state.modelSupportsFlex = Boolean(target.supportsFlex);
    coerceThinkingForModel(target);
    syncHeaderUI();
    if (shouldPersist) persistSettings();
    fetchModelEndpointsCapabilities(target.id);
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
      if (state.balanceAccordionOpen) {
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
    pauseAudio: '<svg viewBox="0 0 24 24"><rect x="6" y="5" width="4" height="14" rx="1.2" fill="currentColor" stroke="none"></rect><rect x="14" y="5" width="4" height="14" rx="1.2" fill="currentColor" stroke="none"></rect></svg>',
    moreDots: '<svg viewBox="0 0 24 24"><circle cx="5" cy="12" r="1.5" fill="currentColor" stroke="none"></circle><circle cx="12" cy="12" r="1.5" fill="currentColor" stroke="none"></circle><circle cx="19" cy="12" r="1.5" fill="currentColor" stroke="none"></circle></svg>',
    chevron: '<svg viewBox="0 0 24 24"><polyline points="6 9 12 15 18 9"></polyline></svg>',
    chevronRight: '<svg viewBox="0 0 24 24"><polyline points="9 6 15 12 9 18"></polyline></svg>',
    flexBolt: '<svg viewBox="0 0 24 24"><polygon points="13 2 4 14 12 14 11 22 20 10 12 10 13 2"></polygon></svg>',
    mddCheck: '<svg class="mdd-check" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>',
    editPencil: '<svg viewBox="0 0 24 24"><path d="M12 20h9"></path><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4 12.5-12.5z"></path></svg>',
    retry: '<svg viewBox="0 0 24 24"><polyline points="23 4 23 10 17 10"></polyline><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"></path></svg>',
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

  const balanceAccordionBtn = document.getElementById('balanceAccordionBtn');
  const balanceAccordionCollapse = document.getElementById('balanceAccordionCollapse');
  const balanceBtnVal = document.getElementById('balanceBtnVal');
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
     DYNAMIC STYLES, ATTACHMENTS TRAY & IMAGE LIGHTBOX (NO index.html CHANGES)
     ========================================================================= */
  const MAX_PENDING_ATTACHMENTS = 6;
  const MAX_RAW_FILE_BYTES = 20 * 1024 * 1024;
  const MAX_PDF_FILE_BYTES = 10 * 1024 * 1024;
  const MAX_TEXT_FILE_CHARS = 180000;

  (function injectDynamicFeatureStyles() {
    if (document.getElementById('appDynamicFeatureStyles')) return;
    const style = document.createElement('style');
    style.id = 'appDynamicFeatureStyles';
    style.textContent = `
      /* Keep Send button fully active & tappable while recording audio */
      body.mic-recording #btn-send {
        pointer-events: auto !important;
        opacity: 1 !important;
        filter: none !important;
      }

      /* Composer pending attachments tray */
      .attach-tray {
        display: none;
        align-items: center;
        gap: 8px;
        padding: 4px 12px 8px;
        overflow-x: auto;
        -webkit-overflow-scrolling: touch;
        pointer-events: auto;
        scrollbar-width: none;
      }
      .attach-tray::-webkit-scrollbar { display: none; }
      .attach-tray.has-items { display: flex; }

      .attach-item {
        position: relative;
        flex-shrink: 0;
        border-radius: 12px;
        background: var(--menu-bg, #1e1f24);
        color: var(--menu-active-text, #f1f3f5);
        overflow: visible;
      }
      .attach-item.is-image {
        width: 58px;
        height: 58px;
      }
      .attach-item-thumb {
        width: 58px;
        height: 58px;
        border-radius: 12px;
        object-fit: cover;
        display: block;
        cursor: zoom-in;
      }
      .attach-item.is-file {
        display: inline-flex;
        align-items: center;
        gap: 8px;
        max-width: 196px;
        height: 46px;
        padding: 0 28px 0 11px;
      }
      .attach-file-badge {
        flex-shrink: 0;
        font-size: 10px;
        font-weight: 600;
        text-transform: uppercase;
        padding: 3px 6px;
        border-radius: 6px;
        background: var(--surface-composer, #2e3038);
        color: var(--menu-active-text, #f1f3f5);
        letter-spacing: 0.03em;
      }
      .attach-file-meta {
        min-width: 0;
        display: flex;
        flex-direction: column;
        gap: 1px;
      }
      .attach-file-name {
        font-size: 12.5px;
        color: var(--menu-active-text, #f1f3f5);
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
      }
      .attach-file-size {
        font-size: 11px;
        color: var(--text-meta, #8e919a);
      }
      .attach-remove-btn {
        position: absolute;
        top: -6px;
        right: -6px;
        width: 20px;
        height: 20px;
        border-radius: 9999px;
        background: var(--surface-composer, #2e3038);
        color: var(--menu-active-text, #f1f3f5);
        font-size: 13px;
        line-height: 1;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        box-shadow: 0 2px 6px rgba(0, 0, 0, 0.55);
      }

      /* User message attachments inside chat bubble */
      .msg-attachments-row {
        display: flex;
        flex-wrap: wrap;
        gap: 8px;
        margin-bottom: 8px;
      }
      .msg-attachments-row.only-attachments {
        margin-bottom: 0;
      }
      .msg-att-img {
        display: block;
        max-width: min(220px, 100%);
        max-height: 220px;
        border-radius: 12px;
        object-fit: cover;
        cursor: zoom-in;
        background: rgba(255, 255, 255, 0.04);
      }
      .msg-att-chip {
        display: inline-flex;
        align-items: center;
        gap: 7px;
        max-width: 100%;
        padding: 6px 10px;
        border-radius: 10px;
        background: var(--menu-dark, #15161a);
        color: var(--menu-text, #d5d7dd);
        font-size: 12.5px;
      }
      .msg-att-chip-name {
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
        max-width: 185px;
      }

      /* AI links, markdown images, generated image gallery & citations */
      .ai-content a.md-link {
        color: #8ab4f8;
        text-decoration: underline;
        text-underline-offset: 2px;
        overflow-wrap: anywhere;
        word-break: break-word;
      }
      .ai-content .md-img-wrap {
        display: block;
        margin: 10px 0;
      }
      .ai-content img.md-img,
      .ai-images-grid img.ai-img-el {
        display: block;
        max-width: 100%;
        max-height: 52dvh;
        width: auto;
        height: auto;
        border-radius: 14px;
        object-fit: contain;
        background: rgba(255, 255, 255, 0.04);
        cursor: zoom-in;
      }
      .ai-images-grid {
        display: flex;
        flex-direction: column;
        gap: 10px;
        margin-top: 10px;
      }
      .md-img-fallback {
        display: inline-flex;
        align-items: center;
        gap: 6px;
        padding: 7px 11px;
        border-radius: 10px;
        background: var(--menu-bg, #1e1f24);
        color: #8ab4f8;
        font-size: 13px;
        text-decoration: none;
        margin: 6px 0;
      }
      .ai-citations-row {
        display: flex;
        flex-wrap: wrap;
        gap: 6px;
        margin-top: 10px;
      }
      .ai-citation-chip {
        display: inline-flex;
        align-items: center;
        gap: 5px;
        max-width: 100%;
        padding: 5px 10px;
        border-radius: 9999px;
        background: var(--menu-bg, #1e1f24);
        color: var(--menu-text, #cfd2da);
        font-size: 12px;
        text-decoration: none;
      }
      .ai-citation-chip span {
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
        max-width: 210px;
      }

      /* Fullscreen image lightbox (iOS-safe for both https:// and data:image/...) */
      .img-lightbox {
        position: fixed;
        inset: 0;
        z-index: 220;
        background: rgba(0, 0, 0, 0.92);
        display: none;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        padding: calc(env(safe-area-inset-top, 16px) + 52px) 14px calc(env(safe-area-inset-bottom, 16px) + 20px);
      }
      .img-lightbox.open { display: flex; }
      .img-lightbox-bar {
        position: absolute;
        top: calc(env(safe-area-inset-top, 12px) + 10px);
        left: 14px;
        right: 14px;
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 10px;
      }
      .img-lightbox-title {
        font-size: 13px;
        color: var(--menu-text, #cfd2da);
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
        min-width: 0;
      }
      .img-lightbox-actions {
        display: flex;
        align-items: center;
        gap: 8px;
        flex-shrink: 0;
      }
      .img-lightbox-btn {
        height: 34px;
        padding: 0 13px;
        border-radius: 9999px;
        background: var(--surface-composer, #2e3038);
        color: var(--menu-active-text, #f1f3f5);
        font-size: 13px;
        font-weight: 500;
        text-decoration: none;
        display: inline-flex;
        align-items: center;
        justify-content: center;
      }
      .img-lightbox-img {
        max-width: 100%;
        max-height: 100%;
        border-radius: 12px;
        object-fit: contain;
        box-shadow: 0 12px 40px rgba(0, 0, 0, 0.75);
      }

      /* Gemini TTS sampling sliders (Temperature / Top P / Top K) */
      .tts-sampling-row {
        transition: opacity 0.16s ease, filter 0.16s ease;
      }
      .tts-sampling-row.is-disabled {
        opacity: 0.36;
        filter: saturate(0.25);
        pointer-events: none;
      }
      .tts-sampling-row.is-disabled input[type="range"] {
        cursor: not-allowed;
      }
      .tts-sampling-stack {
        display: grid;
        grid-template-columns: repeat(2, minmax(0, 1fr));
        gap: 10px;
      }
      .tts-sampling-row.span-full {
        grid-column: 1 / -1;
      }
      .tts-sampling-fallback-row {
        display: flex;
        flex-direction: column;
        gap: 6px;
        margin-top: 8px;
      }
      .tts-sampling-fallback-head {
        display: flex;
        align-items: center;
        justify-content: space-between;
        font-size: 13px;
        color: var(--menu-text, #cfd2da);
      }
      .tts-sampling-fallback-val {
        color: var(--text-meta, #8e919a);
        font-variant-numeric: tabular-nums;
      }
      #audioPanel {
        max-height: calc(100dvh - var(--panels-bottom, 110px) - env(safe-area-inset-top, 12px) - 16px);
        overflow-y: auto;
        -webkit-overflow-scrolling: touch;
      }
    `;
    document.head.appendChild(style);
  })();

  const attachFileInput = document.createElement('input');
  attachFileInput.type = 'file';
  attachFileInput.id = 'attachFileInput';
  attachFileInput.multiple = true;
  attachFileInput.style.display = 'none';
  appShell.appendChild(attachFileInput);

  const attachTrayEl = document.createElement('div');
  attachTrayEl.className = 'attach-tray';
  attachTrayEl.id = 'attachTray';
  if (composerCapsule && composerCapsule.parentNode) {
    composerCapsule.parentNode.insertBefore(attachTrayEl, composerCapsule);
  }

  const imgLightboxEl = document.createElement('div');
  imgLightboxEl.className = 'img-lightbox';
  imgLightboxEl.id = 'imgLightbox';
  imgLightboxEl.innerHTML = `
    <div class="img-lightbox-bar">
      <div class="img-lightbox-title" id="imgLightboxTitle"></div>
      <div class="img-lightbox-actions">
        <a class="img-lightbox-btn" id="imgLightboxOpenBtn" target="_blank" rel="noopener noreferrer">Открыть</a>
        <button class="img-lightbox-btn" id="imgLightboxCloseBtn" type="button">Закрыть</button>
      </div>
    </div>
    <img class="img-lightbox-img" id="imgLightboxImg" alt="">
  `;
  document.body.appendChild(imgLightboxEl);

  const imgLightboxTitle = document.getElementById('imgLightboxTitle');
  const imgLightboxOpenBtn = document.getElementById('imgLightboxOpenBtn');
  const imgLightboxCloseBtn = document.getElementById('imgLightboxCloseBtn');
  const imgLightboxImg = document.getElementById('imgLightboxImg');

  function openImageLightbox(src, title = '') {
    if (!src) return;
    imgLightboxImg.src = src;
    imgLightboxImg.alt = title || 'Изображение';
    imgLightboxTitle.textContent = title || 'Изображение';
    if (/^https?:\/\//i.test(src)) {
      imgLightboxOpenBtn.href = src;
      imgLightboxOpenBtn.removeAttribute('download');
      imgLightboxOpenBtn.textContent = 'Открыть ↗';
      imgLightboxOpenBtn.style.display = 'inline-flex';
    } else if (/^data:image\//i.test(src)) {
      imgLightboxOpenBtn.href = src;
      imgLightboxOpenBtn.setAttribute('download', (title || 'image').replace(/[^\w.-]+/g, '_') + '.png');
      imgLightboxOpenBtn.textContent = 'Скачать';
      imgLightboxOpenBtn.style.display = 'inline-flex';
    } else {
      imgLightboxOpenBtn.style.display = 'none';
    }
    imgLightboxEl.classList.add('open');
  }

  function closeImageLightbox() {
    imgLightboxEl.classList.remove('open');
    imgLightboxImg.removeAttribute('src');
  }

  imgLightboxCloseBtn.addEventListener('click', closeImageLightbox);
  imgLightboxEl.addEventListener('click', (e) => {
    if (e.target === imgLightboxEl) closeImageLightbox();
  });

  function formatFileSizeShort(bytes) {
    const b = Number(bytes) || 0;
    if (b < 1024) return `${b} Б`;
    if (b < 1024 * 1024) return `${(b / 1024).toFixed(b < 10240 ? 1 : 0)} КБ`;
    return `${(b / (1024 * 1024)).toFixed(1)} МБ`;
  }

  const IMAGE_EXT_RE = /\.(?:png|jpe?g|webp|gif|bmp|heic|heif|avif|svg)$/i;
  const TEXT_EXT_RE = /\.(?:txt|md|markdown|json|csv|tsv|xml|ya?ml|html?|css|scss|less|js|mjs|cjs|jsx|ts|tsx|py|sh|bash|zsh|sql|log|ini|cfg|conf|toml|env|c|cc|cpp|h|hpp|cs|java|kt|swift|go|rs|rb|php|lua|r|tex|gitignore|dockerfile|makefile)$/i;

  function readFileAsDataUrl(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result || ''));
      reader.onerror = () => reject(new Error('Ошибка чтения файла'));
      reader.readAsDataURL(file);
    });
  }

  function compressImageFileToDataUrl(file, maxSide = 1536, quality = 0.84) {
    return new Promise((resolve, reject) => {
      if (file.type === 'image/gif' || file.type === 'image/svg+xml') {
        readFileAsDataUrl(file).then(resolve, reject);
        return;
      }
      const objUrl = URL.createObjectURL(file);
      const img = new Image();
      img.onload = () => {
        try {
          let w = img.naturalWidth || img.width || 1;
          let h = img.naturalHeight || img.height || 1;
          const scale = Math.min(1, maxSide / Math.max(w, h));
          const tw = Math.max(1, Math.round(w * scale));
          const th = Math.max(1, Math.round(h * scale));
          const canvas = document.createElement('canvas');
          canvas.width = tw;
          canvas.height = th;
          const ctx = canvas.getContext('2d');
          ctx.drawImage(img, 0, 0, tw, th);
          const dataUrl = canvas.toDataURL('image/jpeg', quality);
          URL.revokeObjectURL(objUrl);
          resolve({ dataUrl, mimeType: 'image/jpeg' });
        } catch (_) {
          URL.revokeObjectURL(objUrl);
          readFileAsDataUrl(file).then((du) => resolve({ dataUrl: du, mimeType: file.type || 'image/jpeg' }), reject);
        }
      };
      img.onerror = () => {
        URL.revokeObjectURL(objUrl);
        readFileAsDataUrl(file).then((du) => resolve({ dataUrl: du, mimeType: file.type || 'image/jpeg' }), reject);
      };
      img.src = objUrl;
    });
  }

  function getAttachmentBadgeLabel(att) {
    if (att.kind === 'pdf') return 'PDF';
    const m = String(att.name || '').match(/\.([a-z0-9]{1,5})$/i);
    return m ? m[1].toUpperCase() : 'TXT';
  }

  function renderAttachTray() {
    const list = state.pendingAttachments || [];
    attachTrayEl.innerHTML = '';
    attachTrayEl.classList.toggle('has-items', list.length > 0);

    list.forEach((att) => {
      const card = document.createElement('div');
      card.className = `attach-item ${att.kind === 'image' ? 'is-image' : 'is-file'}`;

      if (att.kind === 'image') {
        const img = document.createElement('img');
        img.className = 'attach-item-thumb';
        img.src = att.dataUrl;
        img.alt = att.name || 'Фото';
        img.addEventListener('click', () => openImageLightbox(att.dataUrl, att.name || 'Фото'));
        card.appendChild(img);
      } else {
        const badge = document.createElement('span');
        badge.className = 'attach-file-badge';
        badge.textContent = getAttachmentBadgeLabel(att);
        card.appendChild(badge);

        const meta = document.createElement('div');
        meta.className = 'attach-file-meta';
        meta.innerHTML = `<span class="attach-file-name">${escapeHtml(att.name || 'Файл')}</span><span class="attach-file-size">${escapeHtml(formatFileSizeShort(att.size))}</span>`;
        card.appendChild(meta);
      }

      const rmBtn = document.createElement('button');
      rmBtn.type = 'button';
      rmBtn.className = 'attach-remove-btn';
      rmBtn.setAttribute('aria-label', 'Удалить вложение');
      rmBtn.textContent = '×';
      rmBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        if (state.micState !== 'idle') return;
        state.pendingAttachments = state.pendingAttachments.filter((item) => item.id !== att.id);
        renderAttachTray();
        syncSendButton();
        syncFloatingPanelsPosition();
      });
      card.appendChild(rmBtn);
      attachTrayEl.appendChild(card);
    });

    syncFloatingPanelsPosition();
  }

  async function processSelectedFiles(fileList) {
    if (!fileList || fileList.length === 0) return;
    const files = Array.from(fileList);
    let added = 0;

    for (let i = 0; i < files.length; i++) {
      if (state.pendingAttachments.length >= MAX_PENDING_ATTACHMENTS) {
        showToast(`Максимум ${MAX_PENDING_ATTACHMENTS} файлов за сообщение`);
        break;
      }

      const file = files[i];
      if (!file) continue;
      const name = file.name || `file-${Date.now()}`;
      const mime = (file.type || '').toLowerCase();

      if (file.size > MAX_RAW_FILE_BYTES) {
        showToast(`${name}: файл больше 20 МБ`);
        continue;
      }

      const isImage = mime.startsWith('image/') || IMAGE_EXT_RE.test(name);
      const isPdf = mime === 'application/pdf' || /\.pdf$/i.test(name);
      const isKnownText =
        mime.startsWith('text/') ||
        mime.includes('json') ||
        mime.includes('xml') ||
        mime.includes('javascript') ||
        mime.includes('ecmascript') ||
        mime.includes('yaml') ||
        mime.includes('csv') ||
        TEXT_EXT_RE.test(name);

      try {
        if (isImage) {
          const res = await compressImageFileToDataUrl(file);
          const dataUrl = typeof res === 'string' ? res : res.dataUrl;
          const outMime = typeof res === 'string' ? (mime || 'image/jpeg') : res.mimeType;
          state.pendingAttachments.push({
            id: 'att-' + Date.now() + '-' + Math.floor(Math.random() * 10000),
            kind: 'image',
            name,
            mimeType: outMime,
            size: file.size,
            dataUrl
          });
          added += 1;
        } else if (isPdf) {
          if (file.size > MAX_PDF_FILE_BYTES) {
            showToast(`${name}: PDF больше 10 МБ`);
            continue;
          }
          const dataUrl = await readFileAsDataUrl(file);
          state.pendingAttachments.push({
            id: 'att-' + Date.now() + '-' + Math.floor(Math.random() * 10000),
            kind: 'pdf',
            name,
            mimeType: 'application/pdf',
            size: file.size,
            dataUrl
          });
          added += 1;
        } else if (isKnownText || file.size <= 1.5 * 1024 * 1024) {
          const textRaw = await file.text();
          // Reject obvious binary files containing null bytes
          if (textRaw.includes('\u0000')) {
            showToast(`${name}: бинарный формат не поддерживается`);
            continue;
          }
          let clipped = textRaw;
          if (clipped.length > MAX_TEXT_FILE_CHARS) {
            clipped = clipped.slice(0, MAX_TEXT_FILE_CHARS) + '\n\n[...файл обрезан по лимиту 180k символов...]';
          }
          state.pendingAttachments.push({
            id: 'att-' + Date.now() + '-' + Math.floor(Math.random() * 10000),
            kind: 'text',
            name,
            mimeType: mime || 'text/plain',
            size: file.size,
            textContent: clipped
          });
          added += 1;
        } else {
          showToast(`${name}: используйте фото, PDF или текстовые файлы`);
        }
      } catch (_) {
        showToast(`Не удалось прочитать ${name}`);
      }
    }

    if (added > 0) {
      renderAttachTray();
      syncSendButton();
      updateComposerLayout();
    }
  }

  attachFileInput.addEventListener('change', () => {
    const files = attachFileInput.files;
    if (files && files.length > 0) {
      processSelectedFiles(files);
    }
    attachFileInput.value = '';
  });

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
    const shellRect = appShell.getBoundingClientRect();
    const refBottom = shellRect.height > 0 ? shellRect.bottom : window.innerHeight;
    const bottomOffset = Math.max(76, Math.round(refBottom - rect.top + 10));
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
      if (el === sendBtn && isRecording) {
        el.disabled = false;
        el.removeAttribute('aria-disabled');
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
      micStatusHint.textContent = state.autoSendAfterTranscribe ? 'Транскрибация и отправка…' : 'Транскрибация…';
    } else {
      micIconSvg.classList.remove('mic-spinner-svg');
      micIconSvg.innerHTML = ICONS.micIdle;
      micBtn.setAttribute('aria-label', 'Микрофон');
      micStatusBar.classList.remove('active');
      chatInput.style.display = 'block';
    }

    syncTtsSamplingSlidersDisabledState();
    updateComposerLayout();
    syncSendButton();
  }

  /* =========================================================================
     iOS VISUAL VIEWPORT KEYBOARD ANCHORING
     Anchor bottomDock & floatingPanelsLayer strictly inside appShell (position: absolute)
     so iOS Safari PWA keyboard animations can never hide the composer behind the keyboard.
     ========================================================================= */
  bottomDock.style.position = 'absolute';
  bottomDock.style.left = '0px';
  bottomDock.style.right = '0px';
  bottomDock.style.bottom = '0px';
  floatingPanelsLayer.style.position = 'absolute';
  floatingPanelsLayer.style.inset = '0px';

  let baseViewportHeight = Math.max(
    window.innerHeight || 0,
    window.visualViewport ? Math.round(window.visualViewport.height) : 0
  );
  let viewportSyncTimers = [];

  function syncViewport() {
    const vv = window.visualViewport;
    const vh = vv ? Math.round(vv.height) : window.innerHeight;
    const vTop = vv ? Math.max(0, Math.round(vv.offsetTop)) : 0;

    if (!isEditableTarget(document.activeElement) && vh > baseViewportHeight) {
      baseViewportHeight = vh;
    }

    const kbDelta = Math.max(window.innerHeight - vh, baseViewportHeight - vh);
    const isKbOpen = kbDelta > 100;

    appShell.style.height = `${vh}px`;
    appShell.style.top = `${vTop}px`;
    bottomDock.style.bottom = '0px';
    bottomDock.style.paddingBottom = isKbOpen ? '8px' : '';

    syncFloatingPanelsPosition();
    updateScrollBottomBtn();
  }

  function scheduleViewportSync() {
    viewportSyncTimers.forEach((t) => clearTimeout(t));
    viewportSyncTimers = [];
    syncViewport();
    requestAnimationFrame(syncViewport);
    [60, 180, 340, 520].forEach((ms) => {
      viewportSyncTimers.push(setTimeout(syncViewport, ms));
    });
  }

  if (window.visualViewport) {
    window.visualViewport.addEventListener('resize', syncViewport);
    window.visualViewport.addEventListener('scroll', syncViewport);
  }

  document.addEventListener('focusin', (e) => {
    if (!isEditableTarget(e.target)) return;
    scheduleViewportSync();
    if (e.target === chatInput) {
      setTimeout(() => {
        if (window.scrollY !== 0) {
          try { window.scrollTo(0, 0); } catch (_) {}
        }
        syncViewport();
      }, 120);
    }
  });

  document.addEventListener('focusout', (e) => {
    if (!isEditableTarget(e.target)) return;
    setTimeout(() => {
      if (!isEditableTarget(document.activeElement)) {
        try { window.scrollTo(0, 0); } catch (_) {}
      }
      scheduleViewportSync();
    }, 80);
  });

  window.addEventListener('orientationchange', () => {
    baseViewportHeight = 0;
    scheduleViewportSync();
  });

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
  function aggregateUsage24h() {
    pruneUsageLog24h();
    const byKey = Object.create(null);
    let totalCost24h = 0;
    let totalFreeReqs24h = 0;

    (state.usageLog || []).forEach((e) => {
      if (!e || !e.modelId) return;
      const type = e.type || 'chat';
      const k = `${type}:${e.modelId}`;
      if (!byKey[k]) {
        byKey[k] = {
          type,
          modelId: e.modelId,
          modelLabel: e.modelLabel || e.modelId,
          requests: 0,
          tokens: 0,
          promptTokens: 0,
          cachedTokens: 0,
          chars: 0,
          seconds: 0,
          cost: 0,
          isFree: Boolean(e.isFree || String(e.modelId).endsWith(':free'))
        };
      }
      const bucket = byKey[k];
      bucket.requests += 1;
      bucket.tokens += Number(e.tokens) || 0;
      bucket.promptTokens += Number(e.promptTokens) || 0;
      bucket.cachedTokens += Number(e.cachedTokens) || 0;
      bucket.chars += Number(e.chars) || 0;
      bucket.seconds += Number(e.seconds) || 0;
      bucket.cost += Number(e.cost) || 0;
      totalCost24h += Number(e.cost) || 0;
      if (bucket.isFree) totalFreeReqs24h += 1;
    });

    return { byKey, totalCost24h, totalFreeReqs24h };
  }

  function renderStatsPanelContent() {
    if (!statsPanel) return;
    const { byKey, totalCost24h, totalFreeReqs24h } = aggregateUsage24h();
    const hasOrKey = Boolean((state.apiKeys.openrouter || '').trim());
    const accBal = getAccountDisplayBalance();
    const freeLimit = getDailyFreeQuotaLimit();
    const globalRst = getResetCountdownHHMM();

    // Key spend limit sub-line (only if limited key like $4)
    let keyLimitSubHtml = '';
    if (state.keyInfo.limit !== null && state.keyInfo.limitRemaining !== null) {
      keyLimitSubHtml = `<div class="stats-balance-lbl" style="margin-top:2px;">Лимит ключа: $${formatUsd3(state.keyInfo.limitRemaining)} / $${formatUsd3(state.keyInfo.limit)}</div>`;
    } else if (!hasOrKey) {
      keyLimitSubHtml = '<div class="stats-balance-lbl" style="margin-top:2px;">Вставьте OpenRouter Key</div>';
    } else if (state.balanceError) {
      keyLimitSubHtml = `<div class="stats-balance-lbl" style="margin-top:2px;color:#f2b8bc;">${escapeHtml(state.balanceError)}</div>`;
    }

    // 24h spend: prefer real local sum; if OpenRouter reports higher daily usage on the key, show it as subtle hint
    const dailySpendText = `$${formatUsd3(totalCost24h)}`;
    const apiDailyHint =
      typeof state.keyInfo.usageDaily === 'number' && state.keyInfo.usageDaily > totalCost24h + 0.0005
        ? `<div class="stats-balance-lbl" style="font-size:11px;">API день: $${formatUsd3(state.keyInfo.usageDaily)}</div>`
        : '';

    // Build full list of ALL models in selectors (Chat Gemini, TTS, STT)
    const chatRows = [];
    const seenChatIds = new Set();
    (state.chatModels || []).forEach((m) => {
      seenChatIds.add(m.id);
      const u = byKey[`chat:${m.id}`] || { requests: 0, tokens: 0, promptTokens: 0, cachedTokens: 0, cost: 0, isFree: Boolean(m.isFree) };
      chatRows.push({
        id: m.id,
        label: m.label,
        isFree: Boolean(m.isFree || m.id.endsWith(':free')),
        requests: u.requests,
        tokens: u.tokens,
        promptTokens: u.promptTokens || 0,
        cachedTokens: u.cachedTokens || 0,
        cost: u.cost
      });
    });
    // Include any chat model used in last 24h that isn't currently in chatModels
    Object.values(byKey).forEach((u) => {
      if (u.type === 'chat' && !seenChatIds.has(u.modelId)) {
        chatRows.push({
          id: u.modelId,
          label: u.modelLabel || u.modelId,
          isFree: u.isFree,
          requests: u.requests,
          tokens: u.tokens,
          promptTokens: u.promptTokens || 0,
          cachedTokens: u.cachedTokens || 0,
          cost: u.cost
        });
      }
    });

    // Sort active (used in 24h) models to top of Chat list, preserving selector order within each group
    chatRows.sort((a, b) => {
      const aUsed = a.requests > 0 || a.tokens > 0 || a.cost > 0 ? 1 : 0;
      const bUsed = b.requests > 0 || b.tokens > 0 || b.cost > 0 ? 1 : 0;
      return bUsed - aUsed;
    });

    const ttsRows = TTS_MODELS.map((t) => {
      const u = byKey[`tts:${t.id}`] || { requests: 0, chars: 0, cost: 0 };
      return {
        id: t.id,
        label: t.name,
        requests: u.requests,
        chars: u.chars,
        cost: u.cost
      };
    });

    const sttRows = STT_MODELS.map((s) => {
      const u = byKey[`stt:${s.id}`] || { requests: 0, seconds: 0, cost: 0 };
      return {
        id: s.id,
        label: s.name,
        requests: u.requests,
        seconds: u.seconds,
        cost: u.cost
      };
    });

    const sectionHead = (title) =>
      `<div style="font-size:11px;font-weight:500;letter-spacing:0.04em;text-transform:uppercase;color:var(--text-meta);padding-top:4px;">${title}</div>`;

    let tableHtml = '';

    tableHtml += sectionHead('Chat · Gemini (24ч)');
    chatRows.forEach((r) => {
      const isUsed = r.requests > 0 || r.tokens > 0 || r.cost > 0;
      const dimStyle = isUsed ? '' : 'opacity:0.55;';
      let subText = '';
      let valText = '';

      if (r.isFree) {
        const mRl = state.modelRateLimits && state.modelRateLimits[r.id];
        const mLimit = mRl && typeof mRl.limit === 'number' && mRl.limit > 0 ? mRl.limit : freeLimit;
        const mUsed =
          mRl && typeof mRl.limit === 'number' && typeof mRl.remaining === 'number' && mRl.limit >= mRl.remaining
            ? Math.max(r.requests, mRl.limit - mRl.remaining)
            : r.requests;
        const mRst = getResetCountdownHHMM(mRl ? mRl.resetMs : null);
        subText = `Q ${mUsed}/${mLimit}, RST in ${mRst}`;
        valText = r.tokens > 0 ? `${formatCompactInt(r.tokens)} tok` : '0';
      } else {
        if (r.tokens > 0 && r.cachedTokens > 0 && r.promptTokens > 0) {
          const hitPct = Math.min(100, Math.round((r.cachedTokens / r.promptTokens) * 100));
          subText = `${formatCompactInt(r.tokens)} tok · кэш ${hitPct}%`;
        } else {
          subText = r.tokens > 0 ? `${formatCompactInt(r.tokens)} tok` : '0 tok';
        }
        valText = r.cost > 0 ? `$${formatUsd3(r.cost)}` : '$0.000';
      }

      tableHtml += `
        <div class="stats-row" style="${dimStyle}">
          <div style="min-width:0;">
            <div class="stats-row-name">${escapeHtml(r.label)}</div>
            <div class="stats-row-sub">${escapeHtml(subText)}</div>
          </div>
          <div class="stats-row-val">${escapeHtml(valText)}</div>
        </div>`;
    });

    tableHtml += sectionHead('TTS · Озвучка (24ч)');
    ttsRows.forEach((r) => {
      const isUsed = r.requests > 0 || r.chars > 0 || r.cost > 0;
      const dimStyle = isUsed ? '' : 'opacity:0.55;';
      const subText = r.chars > 0 ? `${formatCompactInt(r.chars)} симв` : '0 симв';
      const valText = r.cost > 0 ? `$${formatUsd3(r.cost)}` : '$0.000';
      tableHtml += `
        <div class="stats-row" style="${dimStyle}">
          <div style="min-width:0;">
            <div class="stats-row-name">${escapeHtml(r.label)}</div>
            <div class="stats-row-sub">${escapeHtml(subText)}</div>
          </div>
          <div class="stats-row-val">${escapeHtml(valText)}</div>
        </div>`;
    });

    tableHtml += sectionHead('STT · Микрофон (24ч)');
    sttRows.forEach((r) => {
      const isUsed = r.requests > 0 || r.seconds > 0 || r.cost > 0;
      const dimStyle = isUsed ? '' : 'opacity:0.55;';
      const subText = r.seconds > 0 ? `${formatCompactInt(r.seconds)} сек` : '0 сек';
      const valText = r.cost > 0 ? `$${formatUsd3(r.cost)}` : '$0.000';
      tableHtml += `
        <div class="stats-row" style="${dimStyle}">
          <div style="min-width:0;">
            <div class="stats-row-name">${escapeHtml(r.label)}</div>
            <div class="stats-row-sub">${escapeHtml(subText)}</div>
          </div>
          <div class="stats-row-val">${escapeHtml(valText)}</div>
        </div>`;
    });

    statsPanel.innerHTML = `
      <div class="stats-card">
        <div class="stats-top-row">
          <div style="min-width:0;">
            <div class="stats-balance-lbl">Баланс OpenRouter</div>
            <div class="stats-balance-val">${accBal !== null ? `$${formatUsd3(accBal)}` : '$0.000'}</div>
            ${keyLimitSubHtml}
          </div>
          <div style="text-align:right;flex-shrink:0;">
            <div style="display:flex;align-items:center;justify-content:flex-end;gap:6px;">
              <span class="stats-balance-lbl">За 24ч</span>
              <button class="mdd-refresh-btn" id="statsRefreshBtn" type="button" ${state.balanceLoading ? 'disabled' : ''}>${state.balanceLoading ? '…' : '↻'}</button>
            </div>
            <div style="font-size:15px;font-weight:500;color:var(--menu-active-text);margin-top:2px;">${dailySpendText}</div>
            ${apiDailyHint}
          </div>
        </div>

        <div class="stats-quota-box">
          <span style="color:var(--text-level);">Free (:free)</span>
          <span style="color:var(--menu-active-text);font-weight:500;">Q ${totalFreeReqs24h}/${freeLimit}, RST in ${globalRst}</span>
        </div>

        <div class="stats-table stats-table-scroll">
          ${tableHtml}
        </div>
      </div>`;

    const refreshBtn = document.getElementById('statsRefreshBtn');
    if (refreshBtn) {
      refreshBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        fetchOpenRouterBalance(true);
      });
    }
  }

  function setBottomPanel(nextPanel) {
    if (state.micState !== 'idle' && nextPanel !== null) return;

    if (state.openPopover) {
      closePopover();
    }

    state.activeBottomPanel = nextPanel;

    if (nextPanel !== null) {
      syncFloatingPanelsPosition();
    }

    const isAudio = nextPanel === 'audio';
    const isPersona = nextPanel === 'persona';

    audioPanel.classList.toggle('open', isAudio);
    personaPanel.classList.toggle('open', isPersona);
    dockScrim.classList.toggle('visible', nextPanel !== null);

    audioDockBtn.classList.toggle('is-active', isAudio);
    personaDockBtn.classList.toggle('is-active', isPersona);

    updateScrollBottomBtn();
  }

  function toggleBottomPanel(panelName) {
    if (state.micState !== 'idle') return;
    const wasOpen = state.activeBottomPanel === panelName;
    setBottomPanel(wasOpen ? null : panelName);
  }

  audioDockBtn.addEventListener('click', () => toggleBottomPanel('audio'));
  personaDockBtn.addEventListener('click', () => toggleBottomPanel('persona'));
  dockScrim.addEventListener('click', () => setBottomPanel(null));

  /* =========================================================================
     2. POPOVERS: DYNAMIC GEMINI MODELS, PER-MODEL THINKING, FLEX, AUDIO, •••
     ========================================================================= */
  function getTopSafeInsetPx() {
    const hdr = document.getElementById('topHeader');
    if (hdr) {
      const pt = parseFloat(window.getComputedStyle(hdr).paddingTop);
      if (Number.isFinite(pt) && pt > 0) return pt;
    }
    return 12;
  }

  function closePopover() {
    state.openPopover = null;
    state.openInfoMsgId = null;
    popoverMenu.style.maxHeight = '';
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

    const gap = 8;
    const topSafe = Math.max(12, Math.ceil(getTopSafeInsetPx()) + 6);
    const bottomSafe = 16;

    const spaceAbove = Math.max(96, Math.floor(rect.top - shellRect.top - topSafe - gap));
    const spaceBelow = Math.max(96, Math.floor(shellRect.bottom - rect.bottom - bottomSafe - gap));

    popoverMenu.style.top = 'auto';
    popoverMenu.style.bottom = 'auto';
    popoverMenu.style.left = 'auto';
    popoverMenu.style.right = 'auto';
    popoverMenu.style.maxHeight = '';
    popoverMenu.style.overscrollBehavior = 'contain';
    popoverMenu.style.width = fixedWidth ? `${fixedWidth}px` : (matchWidth ? `${Math.max(rect.width, 210)}px` : 'auto');

    const naturalH = popoverMenu.scrollHeight || popoverMenu.offsetHeight || 160;
    const measuredW = fixedWidth || popoverMenu.offsetWidth || 240;

    let shouldDropUp = dropUp;
    if (autoFlip) {
      if (spaceBelow < naturalH + 10 && spaceAbove > spaceBelow) {
        shouldDropUp = true;
      }
    } else if (shouldDropUp && spaceAbove < 140 && spaceBelow > spaceAbove) {
      shouldDropUp = false;
    }

    const availH = shouldDropUp ? spaceAbove : spaceBelow;
    popoverMenu.style.maxHeight = `${availH}px`;

    if (shouldDropUp) {
      popoverMenu.classList.add('drop-up');
      const bottomOffset = Math.round(shellRect.bottom - rect.top + gap);
      popoverMenu.style.bottom = `${bottomOffset}px`;
    } else {
      popoverMenu.classList.remove('drop-up');
      popoverMenu.style.top = `${Math.round(rect.bottom - shellRect.top + gap)}px`;
    }

    if (align === 'center') {
      const leftOffset = Math.max(10, Math.round((shellRect.width - measuredW) / 2));
      popoverMenu.style.left = `${leftOffset}px`;
    } else if (align === 'right') {
      const rightOffset = Math.max(10, Math.round(shellRect.right - rect.right));
      popoverMenu.style.right = `${rightOffset}px`;
    } else {
      let leftOffset = rect.left - shellRect.left;
      const maxLeft = shellRect.width - measuredW - 10;
      leftOffset = Math.max(10, Math.min(Math.round(leftOffset), Math.max(10, Math.round(maxLeft))));
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
          ensureValidVoiceForCurrentTts();
          syncAudioPanelUI();
          persistSettings();
          closePopover();
        });
      });
    }

    if (type === 'voice') {
      anchorEl.classList.add('open');
      popoverMenu.classList.add('selector-menu');
      const voices = getVoicesForTtsModel(state.ttsId);
      const currentVoice = state.voiceDraft.voice;
      let html = '<div class="mdd-list">';
      voices.forEach((v) => {
        const sel = currentVoice === v.id || currentVoice === v.name ? 'selected' : '';
        html += `
          <button class="model-opt ${sel}" data-select-voice="${escapeHtml(v.id)}">
            <span>${escapeHtml(v.name)}</span>
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
        if (payload.usage && (payload.usage.promptTokens > 0 || payload.usage.completionTokens > 0)) {
          const pTok = Number(payload.usage.promptTokens) || 0;
          const cTok = Math.min(pTok, Number(payload.usage.cachedTokens) || 0);
          const outTok = Number(payload.usage.completionTokens) || 0;
          const rTok = Number(payload.usage.reasoningTokens) || 0;
          const pct = pTok > 0 ? Math.min(100, Math.round((cTok / pTok) * 100)) : 0;
          html += `<div class="info-pop-model">Вход: <strong>${formatCompactInt(pTok)}</strong> (кэш ${formatCompactInt(cTok)} · ${pct}%)</div>`;
          html += `<div class="info-pop-model">Выход: <strong>${formatCompactInt(outTok)}</strong>${rTok > 0 ? ` (think ${formatCompactInt(rTok)})` : ''}</div>`;
          if (payload.usage.sentChars > 0) {
            html += `<div class="info-pop-model">Текст в запросе: <strong>${formatCompactInt(payload.usage.sentChars)}</strong> симв.</div>`;
          }
        }
      }
      html += '</div>';

      popoverMenu.innerHTML = html;
      positionPopover(anchorEl, { align: 'right', autoFlip: true });
    }

    popoverBackdrop.classList.add('visible');
    popoverMenu.classList.add('open');

    popoverMenu.scrollTop = 0;
    const selectedEl = popoverMenu.querySelector('.selected');
    if (selectedEl && popoverMenu.scrollHeight > popoverMenu.clientHeight) {
      const targetTop = selectedEl.offsetTop - Math.floor((popoverMenu.clientHeight - selectedEl.offsetHeight) / 2);
      popoverMenu.scrollTop = Math.max(0, targetTop);
    }
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
      if (imgLightboxEl && imgLightboxEl.classList.contains('open')) {
        closeImageLightbox();
      } else if (state.contextMenuChatId) {
        closeContextMenu();
      } else if (state.openPopover) {
        closePopover();
      } else if (state.activeBottomPanel) {
        setBottomPanel(null);
      } else if (state.editingMsgId) {
        cancelInlineUserEdit();
      } else if (!state.renamingChatId) {
        closeDrawer();
      }
    }
  });

  /* =========================================================================
     3. CHAT FEED, LIVE-ONLY THINKING & 5-ICON MESSAGE FOOTER
     ========================================================================= */
  /* =========================================================================
     iOS SAFARI / WEBKIT TTS ENGINE:
     - Single <audio> + SILENT_WAV_URL sync unlock inside user tap
     - Dynamic voices via GET /api/v1/audio/speech/models + ElevenLabs BYOK
     - Pristine original WAV cache (API always at 1.0x/1.0x)
     - Non-destructive RIFF WAV sampleRate/byteRate patch + playbackRate comp
     - Markdown cleanup + first-paragraph fast-start chunking + prefetch
     ========================================================================= */
  function createSilentWavDataUrl() {
    const sampleRate = 8000;
    const numSamples = 400; // 50ms silence
    const dataSize = numSamples * 2;
    const buf = new ArrayBuffer(44 + dataSize);
    const v = new DataView(buf);
    const writeStr = (off, s) => {
      for (let i = 0; i < s.length; i++) v.setUint8(off + i, s.charCodeAt(i));
    };
    writeStr(0, 'RIFF');
    v.setUint32(4, 36 + dataSize, true);
    writeStr(8, 'WAVE');
    writeStr(12, 'fmt ');
    v.setUint32(16, 16, true);
    v.setUint16(20, 1, true); // PCM
    v.setUint16(22, 1, true); // mono
    v.setUint32(24, sampleRate, true);
    v.setUint32(28, sampleRate * 2, true);
    v.setUint16(32, 2, true);
    v.setUint16(34, 16, true);
    writeStr(36, 'data');
    v.setUint32(40, dataSize, true);
    const bytes = new Uint8Array(buf);
    let bin = '';
    for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
    return 'data:audio/wav;base64,' + btoa(bin);
  }

  const SILENT_WAV_URL = createSilentWavDataUrl();

  const ttsAudio = new Audio();
  ttsAudio.playsInline = true;
  ttsAudio.setAttribute('playsinline', '');
  ttsAudio.preload = 'auto';

  let sharedDecodeAudioCtx = null;
  const ttsOriginalWavCache = new Map();
  const MAX_TTS_CACHE_ITEMS = 40;

  function setAudioSessionType(type) {
    try {
      if (navigator.audioSession && typeof navigator.audioSession.type === 'string') {
        navigator.audioSession.type = type;
      }
    } catch (_) {}
  }

  function setPreservesPitch(audioEl, enabled) {
    try { audioEl.preservesPitch = enabled; } catch (_) {}
    try { audioEl.webkitPreservesPitch = enabled; } catch (_) {}
    try { audioEl.mozPreservesPitch = enabled; } catch (_) {}
  }

  function getDecodeAudioContext() {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    if (!sharedDecodeAudioCtx || sharedDecodeAudioCtx.state === 'closed') {
      sharedDecodeAudioCtx = new AC();
    }
    return sharedDecodeAudioCtx;
  }

  function closeDecodeAudioContext() {
    if (!sharedDecodeAudioCtx) return;
    const ctx = sharedDecodeAudioCtx;
    sharedDecodeAudioCtx = null;
    try {
      if (ctx.state !== 'closed' && typeof ctx.close === 'function') {
        ctx.close().catch(() => {});
      }
    } catch (_) {}
  }

  // Must be called synchronously inside a user tap handler on iOS Safari
  function unlockAudioSyncInUserGesture(forceSilentPrime = false) {
    if (state.micState === 'idle' && !state.micStarting && (activeMicStreams.size > 0 || state.mediaStream)) {
      releaseMicStreamAndRestoreAudio(false);
    }
    setAudioSessionType('playback');
    try {
      if (sharedDecodeAudioCtx && sharedDecodeAudioCtx.state === 'suspended') {
        sharedDecodeAudioCtx.resume().catch(() => {});
      }
    } catch (_) {}

    if (forceSilentPrime || !state.ttsPlayingMsgId) {
      try {
        ttsAudio.pause();
        ttsAudio.src = SILENT_WAV_URL;
        ttsAudio.currentTime = 0;
        setPreservesPitch(ttsAudio, true);
        ttsAudio.playbackRate = 1.0;
        const p = ttsAudio.play();
        if (p && typeof p.catch === 'function') p.catch(() => {});
      } catch (_) {}
    }
  }

  function getVoicesForTtsModel(ttsId) {
    if (ttsId === 'elevenlabs-byok') {
      return state.elevenByokVoices && state.elevenByokVoices.length > 0
        ? state.elevenByokVoices
        : ELEVENLABS_BYOK_FALLBACK_VOICES;
    }

    const dynamic = state.ttsVoicesByModel && state.ttsVoicesByModel[ttsId];
    if (Array.isArray(dynamic) && dynamic.length > 0) {
      return dynamic;
    }

    if (ttsId.includes('grok')) {
      return GROK_FALLBACK_VOICES.map((v) => ({ id: v, name: v }));
    }
    if (ttsId.startsWith('elevenlabs/')) {
      return ELEVENLABS_OPENROUTER_FALLBACK_VOICES.map((v) => ({ id: v, name: v }));
    }
    return GEMINI_VOICES.map((v) => ({ id: v, name: v }));
  }

  function resolveVoiceDisplayName(ttsId, voiceIdOrName) {
    const list = getVoicesForTtsModel(ttsId);
    const found = list.find((v) => v.id === voiceIdOrName || v.name === voiceIdOrName);
    if (found) return found.name;
    return voiceIdOrName || (list[0] ? list[0].name : 'Puck');
  }

  function resolveVoiceApiId(ttsId, voiceIdOrName) {
    const list = getVoicesForTtsModel(ttsId);
    const found = list.find((v) => v.id === voiceIdOrName || v.name === voiceIdOrName);
    if (found) return found.id;
    return list[0] ? list[0].id : (voiceIdOrName || 'Puck');
  }

  function ensureValidVoiceForCurrentTts() {
    const list = getVoicesForTtsModel(state.ttsId);
    if (!list || list.length === 0) return;
    const cur = state.voiceDraft.voice;
    const match = list.find((v) => v.id === cur || v.name === cur);
    if (match) {
      state.voiceDraft.voice = match.id;
    } else {
      state.voiceDraft.voice = list[0].id;
    }
  }

  function normalizeVoiceList(rawVoices) {
    if (!Array.isArray(rawVoices)) return [];
    const out = [];
    const seen = new Set();
    rawVoices.forEach((v) => {
      if (!v) return;
      let id = '';
      let name = '';
      if (typeof v === 'string') {
        id = v.trim();
        name = id;
      } else if (typeof v === 'object') {
        id = String(v.id || v.voice_id || v.slug || v.name || '').trim();
        name = String(v.name || v.label || id).trim();
      }
      if (!id || seen.has(id)) return;
      seen.add(id);
      out.push({ id, name });
    });
    return out;
  }

  const TTS_FORMAT_PRIORITY = ['wav', 'pcm', 'mp3', 'ogg', 'opus', 'aac', 'flac'];

  function normalizeTtsFormatList(rawFormats) {
    if (!Array.isArray(rawFormats)) return [];
    const out = [];
    const seen = new Set();
    rawFormats.forEach((f) => {
      let val = '';
      if (typeof f === 'string') val = f;
      else if (f && typeof f === 'object') val = f.id || f.format || f.name || '';
      val = String(val || '').toLowerCase().trim().replace(/^audio\//, '');
      if (val === 'mpeg') val = 'mp3';
      if (!val || seen.has(val)) return;
      seen.add(val);
      out.push(val);
    });
    return out;
  }

  function resolvePreferredTtsFormat(ttsId) {
    if (state.ttsFormatOverrides && Object.prototype.hasOwnProperty.call(state.ttsFormatOverrides, ttsId)) {
      return state.ttsFormatOverrides[ttsId];
    }

    const advertised = state.ttsFormatsByModel && state.ttsFormatsByModel[ttsId];
    if (Array.isArray(advertised) && advertised.length > 0) {
      for (let i = 0; i < TTS_FORMAT_PRIORITY.length; i++) {
        if (advertised.includes(TTS_FORMAT_PRIORITY[i])) {
          return TTS_FORMAT_PRIORITY[i];
        }
      }
      return advertised[0];
    }

    const lower = String(ttsId || '').toLowerCase();
    // Grok Voice TTS and ElevenLabs on OpenRouter reliably output MP3 (Grok rejects WAV)
    if (lower.includes('grok') || lower.startsWith('x-ai/')) return 'mp3';
    if (lower.startsWith('elevenlabs/')) return 'mp3';
    // Gemini TTS natively supports WAV (zero decode overhead for Pitch/Speed patch)
    if (lower.startsWith('google/')) return 'wav';
    return 'mp3';
  }

  function saveTtsFormatOverride(ttsId, fmt) {
    if (!ttsId) return;
    state.ttsFormatOverrides[ttsId] = fmt;
    idbPut('kv', { key: 'ttsFormatOverrides', value: state.ttsFormatOverrides });
  }

  async function fetchOpenRouterTtsModels() {
    const headers = { Accept: 'application/json' };
    const key = (state.apiKeys.openrouter || '').trim();
    if (key) headers.Authorization = `Bearer ${key}`;

    try {
      const resp = await fetch(`${OPENROUTER_API_BASE}/audio/speech/models`, {
        method: 'GET',
        headers
      });
      if (!resp.ok) return;
      const json = await resp.json();
      const list = Array.isArray(json && json.data) ? json.data : (Array.isArray(json) ? json : []);
      if (!list.length) return;

      const updatedVoices = Object.assign({}, state.ttsVoicesByModel);
      const updatedFormats = Object.assign({}, state.ttsFormatsByModel);

      list.forEach((item) => {
        if (!item || !item.id) return;
        const voices = normalizeVoiceList(
          item.voices ||
          item.supported_voices ||
          (item.architecture && item.architecture.voices)
        );
        if (voices.length > 0) {
          updatedVoices[item.id] = voices;
        }
        const formats = normalizeTtsFormatList(
          item.supported_formats ||
          item.output_formats ||
          item.response_formats ||
          item.audio_formats ||
          item.formats ||
          (item.architecture && (item.architecture.output_formats || item.architecture.supported_formats))
        );
        if (formats.length > 0) {
          updatedFormats[item.id] = formats;
        }
      });

      state.ttsVoicesByModel = updatedVoices;
      state.ttsFormatsByModel = updatedFormats;
      idbPut('kv', { key: 'cachedTtsVoices', value: updatedVoices });
      idbPut('kv', { key: 'cachedTtsFormats', value: updatedFormats });
      ensureValidVoiceForCurrentTts();
      syncAudioPanelUI();
    } catch (_) {}
  }

  async function fetchElevenLabsByokVoices() {
    const elKey = (state.apiKeys.elevenlabs || '').trim();
    if (!elKey) {
      state.elevenByokVoices = ELEVENLABS_BYOK_FALLBACK_VOICES.slice();
      return;
    }
    try {
      const resp = await fetch('https://api.elevenlabs.io/v1/voices', {
        method: 'GET',
        headers: {
          Accept: 'application/json',
          'xi-api-key': elKey
        }
      });
      if (!resp.ok) return;
      const json = await resp.json();
      const voices = normalizeVoiceList(json && json.voices);
      if (voices.length > 0) {
        state.elevenByokVoices = voices;
        idbPut('kv', { key: 'cachedElevenVoices', value: voices });
        if (state.ttsId === 'elevenlabs-byok') {
          ensureValidVoiceForCurrentTts();
          syncAudioPanelUI();
        }
      }
    } catch (_) {}
  }

  /* ---- WAV Parsing, Encoding & Non-Destructive Pitch/Speed Patching ---- */
  function parseWavHeaderMetadata(arrayBuf) {
    if (!arrayBuf || arrayBuf.byteLength < 44) return null;
    const view = new DataView(arrayBuf);
    const read4 = (off) =>
      String.fromCharCode(
        view.getUint8(off),
        view.getUint8(off + 1),
        view.getUint8(off + 2),
        view.getUint8(off + 3)
      );
    if (read4(0) !== 'RIFF' || read4(8) !== 'WAVE') return null;

    let offset = 12;
    while (offset + 8 <= arrayBuf.byteLength) {
      const chunkId = read4(offset);
      const chunkSize = view.getUint32(offset + 4, true);
      if (chunkId === 'fmt ' && offset + 8 + 16 <= arrayBuf.byteLength) {
        const fmtStart = offset + 8;
        const audioFormat = view.getUint16(fmtStart, true);
        const numChannels = view.getUint16(fmtStart + 2, true);
        const sampleRate = view.getUint32(fmtStart + 4, true);
        const blockAlign = view.getUint16(fmtStart + 12, true);
        const bitsPerSample = view.getUint16(fmtStart + 14, true);
        if (audioFormat !== 1 && audioFormat !== 3) return null; // PCM or IEEE float only
        if (!sampleRate || !blockAlign) return null;
        return {
          sampleRateOffset: fmtStart + 4,
          byteRateOffset: fmtStart + 8,
          origSampleRate: sampleRate,
          blockAlign,
          numChannels,
          bitsPerSample
        };
      }
      offset += 8 + chunkSize + (chunkSize % 2);
    }
    return null;
  }

  function wrapPcm16ToWav(pcmBytes, sampleRate = 24000, numChannels = 1) {
    const bitsPerSample = 16;
    const blockAlign = numChannels * (bitsPerSample / 8);
    const byteRate = sampleRate * blockAlign;
    const dataSize = pcmBytes.byteLength;
    const wavBuf = new ArrayBuffer(44 + dataSize);
    const view = new DataView(wavBuf);
    const writeStr = (off, s) => {
      for (let i = 0; i < s.length; i++) view.setUint8(off + i, s.charCodeAt(i));
    };
    writeStr(0, 'RIFF');
    view.setUint32(4, 36 + dataSize, true);
    writeStr(8, 'WAVE');
    writeStr(12, 'fmt ');
    view.setUint32(16, 16, true);
    view.setUint16(20, 1, true);
    view.setUint16(22, numChannels, true);
    view.setUint32(24, sampleRate, true);
    view.setUint32(28, byteRate, true);
    view.setUint16(32, blockAlign, true);
    view.setUint16(34, bitsPerSample, true);
    writeStr(36, 'data');
    view.setUint32(40, dataSize, true);
    new Uint8Array(wavBuf, 44).set(new Uint8Array(pcmBytes));
    return wavBuf;
  }

  function encodeAudioBufferToWav(audioBuffer) {
    const numChannels = Math.min(2, audioBuffer.numberOfChannels || 1);
    const sampleRate = audioBuffer.sampleRate || 24000;
    const numFrames = audioBuffer.length;
    const blockAlign = numChannels * 2;
    const dataSize = numFrames * blockAlign;
    const wavBuf = new ArrayBuffer(44 + dataSize);
    const view = new DataView(wavBuf);
    const writeStr = (off, s) => {
      for (let i = 0; i < s.length; i++) view.setUint8(off + i, s.charCodeAt(i));
    };
    writeStr(0, 'RIFF');
    view.setUint32(4, 36 + dataSize, true);
    writeStr(8, 'WAVE');
    writeStr(12, 'fmt ');
    view.setUint32(16, 16, true);
    view.setUint16(20, 1, true);
    view.setUint16(22, numChannels, true);
    view.setUint32(24, sampleRate, true);
    view.setUint32(28, sampleRate * blockAlign, true);
    view.setUint16(32, blockAlign, true);
    view.setUint16(34, 16, true);
    writeStr(36, 'data');
    view.setUint32(40, dataSize, true);

    const channels = [];
    for (let ch = 0; ch < numChannels; ch++) {
      channels.push(audioBuffer.getChannelData(ch));
    }

    let pos = 44;
    for (let i = 0; i < numFrames; i++) {
      for (let ch = 0; ch < numChannels; ch++) {
        const sample = Math.max(-1, Math.min(1, channels[ch][i] || 0));
        view.setInt16(pos, sample < 0 ? sample * 0x8000 : sample * 0x7fff, true);
        pos += 2;
      }
    }
    return wavBuf;
  }

  async function normalizeToCanonicalWav(rawArrayBuf, contentType = '', fallbackPcmRate = 0) {
    const existingMeta = parseWavHeaderMetadata(rawArrayBuf);
    if (existingMeta) {
      return Object.assign({ originalWav: rawArrayBuf, isPatchableWav: true, mimeType: 'audio/wav' }, existingMeta);
    }

    if (fallbackPcmRate > 0 && (!contentType || contentType.includes('pcm') || contentType.includes('octet-stream'))) {
      const wrapped = wrapPcm16ToWav(rawArrayBuf, fallbackPcmRate, 1);
      const meta = parseWavHeaderMetadata(wrapped);
      if (meta) {
        return Object.assign({ originalWav: wrapped, isPatchableWav: true, mimeType: 'audio/wav' }, meta);
      }
    }

    // Non-WAV audio (MP3/OGG/AAC): decode once into pristine 16-bit PCM WAV
    try {
      const ctx = getDecodeAudioContext();
      if (ctx) {
        const decoded = await ctx.decodeAudioData(rawArrayBuf.slice(0));
        const wavBuf = encodeAudioBufferToWav(decoded);
        const meta = parseWavHeaderMetadata(wavBuf);
        if (meta) {
          return Object.assign({ originalWav: wavBuf, isPatchableWav: true, mimeType: 'audio/wav' }, meta);
        }
      }
    } catch (_) {}

    // Last-resort fallback if browser cannot decode compressed format via WebAudio
    return {
      originalWav: rawArrayBuf,
      isPatchableWav: false,
      mimeType: contentType && contentType.startsWith('audio/') ? contentType.split(';')[0] : 'audio/mpeg',
      origSampleRate: 24000,
      blockAlign: 2,
      sampleRateOffset: 24,
      byteRateOffset: 28
    };
  }

  // Always derives a fresh Blob from the untouched originalWav so returning to 1.00/1.00 = 100% original audio
  function buildPatchedPlaybackSource(canonical, speed, pitch) {
    const safeSpeed = Math.max(0.70, Math.min(1.60, Number(speed) || 1.0));
    const safePitch = Math.max(0.75, Math.min(1.25, Number(pitch) || 1.0));

    if (!canonical.isPatchableWav) {
      return {
        blob: new Blob([canonical.originalWav], { type: canonical.mimeType || 'audio/mpeg' }),
        appliedPitch: 1.0,
        playbackRate: safeSpeed
      };
    }

    if (Math.abs(safePitch - 1.0) < 0.001) {
      return {
        blob: new Blob([canonical.originalWav], { type: 'audio/wav' }),
        appliedPitch: 1.0,
        playbackRate: safeSpeed
      };
    }

    // Clone pristine buffer so cached originalWav is NEVER mutated
    const patchedBuf = canonical.originalWav.slice(0);
    const view = new DataView(patchedBuf);
    const patchedRate = Math.max(8000, Math.min(192000, Math.round(canonical.origSampleRate * safePitch)));
    const patchedByteRate = patchedRate * canonical.blockAlign;
    view.setUint32(canonical.sampleRateOffset, patchedRate, true);
    view.setUint32(canonical.byteRateOffset, patchedByteRate, true);

    const actualPitchRatio = patchedRate / canonical.origSampleRate;
    const compensatedRate = Math.max(0.5, Math.min(4.0, safeSpeed / actualPitchRatio));

    return {
      blob: new Blob([patchedBuf], { type: 'audio/wav' }),
      appliedPitch: actualPitchRatio,
      playbackRate: compensatedRate
    };
  }

  /* ---- Whitelisted Speech / TTS Tag Engine ---- */
  const TTS_STANDALONE_TAGS = [
    'pause', 'chuckle', 'breath', 'sigh',
    'giggle', 'laugh', 'cry', 'tsk'
  ];

  const TTS_PAIRED_TAGS = [
    'fast', 'build-intensity', 'emphasis', 'soft',
    'slow', 'lower-pitch', 'decrease-intensity', 'loud',
    'whisper', 'laugh-speak', 'higher-pitch', 'sing-song', 'singing'
  ];

  const TTS_ALL_TAGS = TTS_STANDALONE_TAGS.concat(TTS_PAIRED_TAGS);
  const TTS_ALL_TAGS_RE = new RegExp(`\\[\\/?(?:${TTS_ALL_TAGS.join('|')})\\]`, 'gi');
  const TTS_STANDALONE_RE = new RegExp(`\\[(${TTS_STANDALONE_TAGS.join('|')})\\]`, 'gi');
  const TTS_PAIRED_OPEN_RE = new RegExp(`\\[(${TTS_PAIRED_TAGS.join('|')})\\]`, 'gi');
  const TTS_PAIRED_CLOSE_RE = new RegExp(`\\[\\/(${TTS_PAIRED_TAGS.join('|')})\\]`, 'gi');
  const TTS_ANY_TOKEN_RE = new RegExp(`(\\[\\/?(?:${TTS_ALL_TAGS.join('|')})\\]|<\\/?(?:${TTS_PAIRED_TAGS.join('|')})>)`, 'gi');

  function isPersonaTtsTagsActive() {
    return Boolean(state.personaDraft && state.personaDraft.ttsTags);
  }

  function hasWhitelistedTtsTag(text) {
    if (!text) return false;
    TTS_ALL_TAGS_RE.lastIndex = 0;
    return TTS_ALL_TAGS_RE.test(String(text));
  }

  function stripWhitelistedTtsTags(text, hideIncompleteTail = false) {
    if (!text) return '';
    let s = String(text);

    // Strip whitelisted complete [tag] and [/tag] tokens
    s = s.replace(TTS_ALL_TAGS_RE, '');

    // During SSE streaming, hide an unfinished trailing "[..." only if it matches a known tag prefix
    if (hideIncompleteTail) {
      const tailMatch = s.match(/(\[\/?[a-z-]*)$/i);
      if (tailMatch) {
        const rawTail = tailMatch[1].toLowerCase();
        const isClosing = rawTail.startsWith('[/');
        const body = rawTail.slice(isClosing ? 2 : 1);
        const candidates = isClosing ? TTS_PAIRED_TAGS : TTS_ALL_TAGS;
        if (body.length === 0 || candidates.some((t) => t.startsWith(body))) {
          s = s.slice(0, s.length - tailMatch[1].length);
        }
      }
    }

    // Clean whitespace artifacts left behind by removed tags without hurting markdown structure
    s = s.replace(/[ \t]{2,}/g, ' ');
    s = s.replace(/[ \t]+([.,!?;:…])/g, '$1');
    s = s.replace(/([(\[«“])[ \t]+/g, '$1');
    s = s.replace(/^[ \t]+/gm, (m, offset, full) => {
      // Preserve leading spaces only for indented markdown list bullets
      const after = full.slice(offset + m.length);
      return /^(?:[-*•]|\d+\.)\s/.test(after) ? m : '';
    });
    return s;
  }

  function stripTtsTagsOutsideCode(raw, hideIncompleteTail = false) {
    if (!raw) return '';
    const src = String(raw);
    const segments = [];
    const fenceRe = /```[\s\S]*?```/g;
    let last = 0;
    let m;

    const cleanNonFenced = (part, isLast) => {
      // Protect inline code spans `...`
      const inlineTokens = [];
      let protectedPart = part.replace(/`([^`\n]+)`/g, (full) => {
        const idx = inlineTokens.length;
        inlineTokens.push(full);
        return `@@TTSCODE_${idx}@@`;
      });
      protectedPart = stripWhitelistedTtsTags(protectedPart, hideIncompleteTail && isLast);
      return protectedPart.replace(/@@TTSCODE_(\d+)@@/g, (_, idx) => inlineTokens[Number(idx)] || '');
    };

    while ((m = fenceRe.exec(src)) !== null) {
      if (m.index > last) {
        segments.push(cleanNonFenced(src.slice(last, m.index), false));
      }
      segments.push(m[0]);
      last = fenceRe.lastIndex;
    }

    if (last < src.length) {
      segments.push(cleanNonFenced(src.slice(last), true));
    }
    return segments.join('').trim();
  }

  function convertTtsTagsForGrok(text) {
    if (!text) return '';
    let s = String(text);
    // Normalize standalone sound/pause tags in [brackets]
    s = s.replace(TTS_STANDALONE_RE, (_, tag) => `[${tag.toLowerCase()}]`);
    // Convert paired wrapper tags [tag]...[/tag] -> <tag>...</tag>
    s = s.replace(TTS_PAIRED_OPEN_RE, (_, tag) => `<${tag.toLowerCase()}>`);
    s = s.replace(TTS_PAIRED_CLOSE_RE, (_, tag) => `</${tag.toLowerCase()}>`);
    return s;
  }

  function normalizeTtsTagsForGemini(text) {
    if (!text) return '';
    return String(text).replace(TTS_ALL_TAGS_RE, (full) => full.toLowerCase());
  }

  function isGrokTtsModel(ttsId) {
    const lower = String(ttsId || '').toLowerCase();
    return lower.includes('grok') || lower.startsWith('x-ai/');
  }

  function isGeminiTtsModel(ttsId) {
    return String(ttsId || '').toLowerCase().startsWith('google/');
  }

  /* ---- Markdown Cleanup & First-Paragraph Fast-Start Chunking ---- */
  function cleanTextForTts(raw, ttsId = state.ttsId) {
    if (!raw) return '';
    let s = String(raw).replace(/\r\n/g, '\n');

    // Remove fenced code blocks completely
    s = s.replace(/```[\s\S]*?```/g, ' ');
    // Strip markdown images ![alt](url) completely so TTS does not read image URLs/alt
    s = s.replace(/!\[[^\]]*\]\((?:https?:\/\/|data:image\/)[^)\s]+(?:\s+"[^"]*")?\)/gi, ' ');
    // Convert markdown links [label](url) -> label
    s = s.replace(/\[([^\]]+)\]\((https?:\/\/[^\s)]+(?:\s+"[^"]*")?)\)/gi, '$1');
    // Strip raw URLs
    s = s.replace(/https?:\/\/\S+/g, ' ');
    // Unwrap inline code
    s = s.replace(/`([^`\n]+)`/g, '$1');
    // Strip raw HTML tags BEFORE any Grok <tag> conversion
    s = s.replace(/<[^>]+>/g, ' ');
    // Strip markdown heading/quote/list prefixes
    s = s.replace(/^[ \t]*(?:#{1,6}\s+|>\s?|[-*•]\s+)/gm, '');
    // Strip bold/italic/strikethrough markers
    s = s.replace(/(\*\*|__|~~)/g, '');
    s = s.replace(/(^|[\s(])\*([^*\n]+)\*(?=[\s).,!?:;]|$)/g, '$1$2');

    // Apply per-persona TTS tag handling depending on target TTS engine
    if (isPersonaTtsTagsActive()) {
      if (isGrokTtsModel(ttsId)) {
        s = convertTtsTagsForGrok(s);
      } else if (isGeminiTtsModel(ttsId)) {
        s = normalizeTtsTagsForGemini(s);
      } else {
        // ElevenLabs and other engines: strip speech tags so they are never read aloud
        s = stripWhitelistedTtsTags(s, false);
      }
    }

    // Normalize spaces while keeping paragraph breaks
    s = s.replace(/[ \t]+/g, ' ');
    s = s.replace(/\n{3,}/g, '\n\n');
    return s.trim();
  }

  function inspectTagStateAtSplit(text, cutIndex) {
    const stack = [];
    let safeCut = cutIndex;
    TTS_ANY_TOKEN_RE.lastIndex = 0;
    let m;

    while ((m = TTS_ANY_TOKEN_RE.exec(text)) !== null) {
      const tok = m[0];
      const start = m.index;
      const end = start + tok.length;

      // Never slice through the middle of a tag token itself
      if (start < safeCut && safeCut < end) {
        safeCut = start;
        break;
      }
      if (start >= safeCut) break;

      const isAngle = tok.startsWith('<');
      const isClose = isAngle ? tok.startsWith('</') : tok.startsWith('[/');
      const name = tok.replace(/^[\[<]\/?|[\]>]$/g, '').toLowerCase();

      if (!TTS_PAIRED_TAGS.includes(name)) continue;

      if (!isClose) {
        stack.push({ name, isAngle, openStart: start });
      } else {
        for (let k = stack.length - 1; k >= 0; k--) {
          if (stack[k].name === name && stack[k].isAngle === isAngle) {
            stack.splice(k, 1);
            break;
          }
        }
      }
    }

    return { safeCut, openStack: stack };
  }

  function splitTextByLimit(text, maxLen) {
    const out = [];
    let rest = text.trim();
    while (rest.length > maxLen) {
      let cut = -1;
      const slice = rest.slice(0, maxLen + 1);
      const sentRe = /[.!?…](?:\s|$)/g;
      let m;
      while ((m = sentRe.exec(slice)) !== null) {
        if (m.index >= Math.floor(maxLen * 0.4)) {
          cut = m.index + 1;
        }
      }
      if (cut === -1) {
        const commaIdx = slice.lastIndexOf(', ');
        if (commaIdx >= Math.floor(maxLen * 0.5)) cut = commaIdx + 1;
      }
      if (cut === -1) {
        const spaceIdx = slice.lastIndexOf(' ');
        cut = spaceIdx >= Math.floor(maxLen * 0.4) ? spaceIdx : maxLen;
      }

      // Guard paired & standalone TTS tags from being broken across chunks
      let { safeCut, openStack } = inspectTagStateAtSplit(rest, cut);
      if (openStack.length > 0 && openStack[0].openStart >= Math.floor(maxLen * 0.25)) {
        safeCut = openStack[0].openStart;
        openStack = [];
      }
      if (safeCut <= 0) safeCut = Math.min(maxLen, rest.length);

      let head = rest.slice(0, safeCut).trim();
      let tail = rest.slice(safeCut).trim();

      // If a paired tag spans across the forced cut, close at chunk end & reopen in next chunk
      if (openStack.length > 0 && head && tail) {
        for (let k = openStack.length - 1; k >= 0; k--) {
          const t = openStack[k];
          head += t.isAngle ? `</${t.name}>` : `[/${t.name}]`;
        }
        let reopenPrefix = '';
        for (let k = 0; k < openStack.length; k++) {
          const t = openStack[k];
          reopenPrefix += t.isAngle ? `<${t.name}>` : `[${t.name}]`;
        }
        tail = reopenPrefix + tail;
      }

      if (head) out.push(head);
      rest = tail;
    }
    if (rest) out.push(rest);
    return out;
  }

  function chunkTextForTts(cleanedText) {
    if (!cleanedText) return [];
    const paragraphs = cleanedText
      .split(/\n+/)
      .map((p) => p.trim())
      .filter(Boolean);
    if (paragraphs.length === 0) return [];

    const FIRST_CHUNK_MAX = 690; // +25% vs 550 so chunk 1 has time to finish loading
    const FIRST_CHUNK_MIN = 360;
    const MAX_CHUNK = 950;

    const chunks = [];
    let remainingPieces = [];

    if (paragraphs[0].length > FIRST_CHUNK_MAX) {
      const firstParts = splitTextByLimit(paragraphs[0], FIRST_CHUNK_MAX);
      chunks.push(firstParts[0]);
      remainingPieces = firstParts.slice(1).concat(paragraphs.slice(1));
    } else {
      let chunk0 = paragraphs[0];
      let idx = 1;
      while (idx < paragraphs.length) {
        const nextPara = paragraphs[idx];
        if (chunk0.length + 2 + nextPara.length <= FIRST_CHUNK_MAX) {
          chunk0 += '\n\n' + nextPara;
          idx += 1;
        } else if (chunk0.length < FIRST_CHUNK_MIN) {
          const room = FIRST_CHUNK_MAX - chunk0.length - 2;
          if (room >= 120) {
            const sp = splitTextByLimit(nextPara, room);
            chunk0 += '\n\n' + sp[0];
            remainingPieces = sp.slice(1).concat(paragraphs.slice(idx + 1));
            idx = paragraphs.length;
          } else {
            break;
          }
        } else {
          break;
        }
      }
      chunks.push(chunk0);
      if (remainingPieces.length === 0 && idx < paragraphs.length) {
        remainingPieces = paragraphs.slice(idx);
      }
    }

    let current = '';
    remainingPieces.forEach((piece) => {
      if (piece.length > MAX_CHUNK) {
        if (current) {
          chunks.push(current);
          current = '';
        }
        splitTextByLimit(piece, MAX_CHUNK).forEach((sub) => chunks.push(sub));
        return;
      }
      if (!current) {
        current = piece;
      } else if (current.length + 2 + piece.length <= MAX_CHUNK) {
        current += '\n\n' + piece;
      } else {
        chunks.push(current);
        current = piece;
      }
    });

    if (current) chunks.push(current);
    return chunks;
  }

  const MAX_TTS_IDB_ITEMS = 25;

  function putTtsCacheRam(key, canonical) {
    if (ttsOriginalWavCache.has(key)) {
      ttsOriginalWavCache.delete(key);
    }
    ttsOriginalWavCache.set(key, canonical);
    while (ttsOriginalWavCache.size > MAX_TTS_CACHE_ITEMS) {
      const oldestKey = ttsOriginalWavCache.keys().next().value;
      ttsOriginalWavCache.delete(oldestKey);
    }
  }

  async function pruneTtsCacheIdb() {
    try {
      const all = await idbGetAll('ttsCache');
      if (!all || all.length <= MAX_TTS_IDB_ITEMS) return;
      all.sort((a, b) => (a.lastUsedAt || 0) - (b.lastUsedAt || 0));
      const excessCount = all.length - MAX_TTS_IDB_ITEMS;
      const keysToDelete = all.slice(0, excessCount).map((r) => r.key).filter(Boolean);
      await idbDeleteMany('ttsCache', keysToDelete);
    } catch (_) {}
  }

  async function getTtsCachePersistent(key) {
    if (ttsOriginalWavCache.has(key)) {
      const cached = ttsOriginalWavCache.get(key);
      ttsOriginalWavCache.delete(key);
      ttsOriginalWavCache.set(key, cached);
      return cached;
    }

    const rec = await idbGet('ttsCache', key);
    if (!rec || !rec.wav) return null;

    let wavBuf = null;
    if (rec.wav instanceof ArrayBuffer) {
      wavBuf = rec.wav;
    } else if (ArrayBuffer.isView(rec.wav)) {
      wavBuf = rec.wav.buffer.slice(rec.wav.byteOffset, rec.wav.byteOffset + rec.wav.byteLength);
    }
    if (!wavBuf || wavBuf.byteLength < 64) return null;

    const canonical = {
      originalWav: wavBuf,
      isPatchableWav: Boolean(rec.isPatchableWav),
      mimeType: rec.mimeType || 'audio/wav',
      origSampleRate: Number(rec.origSampleRate) || 24000,
      blockAlign: Number(rec.blockAlign) || 2,
      sampleRateOffset: Number(rec.sampleRateOffset) || 24,
      byteRateOffset: Number(rec.byteRateOffset) || 28,
      numChannels: Number(rec.numChannels) || 1,
      bitsPerSample: Number(rec.bitsPerSample) || 16
    };

    putTtsCacheRam(key, canonical);
    // Refresh LRU timestamp in IndexedDB asynchronously
    idbPut('ttsCache', Object.assign({}, rec, { lastUsedAt: Date.now() }));
    return canonical;
  }

  function putTtsCache(key, canonical) {
    putTtsCacheRam(key, canonical);
    if (!canonical || !canonical.originalWav) return;
    const record = {
      key,
      wav: canonical.originalWav,
      isPatchableWav: Boolean(canonical.isPatchableWav),
      mimeType: canonical.mimeType || 'audio/wav',
      origSampleRate: canonical.origSampleRate || 24000,
      blockAlign: canonical.blockAlign || 2,
      sampleRateOffset: canonical.sampleRateOffset || 24,
      byteRateOffset: canonical.byteRateOffset || 28,
      numChannels: canonical.numChannels || 1,
      bitsPerSample: canonical.bitsPerSample || 16,
      lastUsedAt: Date.now()
    };
    idbPut('ttsCache', record).then(() => pruneTtsCacheIdb());
  }

  async function fetchTtsChunkCanonicalWav(chunkText, ttsId, voiceApiId, signal, samplingParams = null) {
    const activeSampling = ttsModelSupportsSamplingParams(ttsId) ? samplingParams : null;
    const samplingKey = formatTtsSamplingKey(activeSampling);
    const cacheKey = samplingKey
      ? `${ttsId}::${voiceApiId}::${samplingKey}::${chunkText}`
      : `${ttsId}::${voiceApiId}::${chunkText}`;
    const cached = await getTtsCachePersistent(cacheKey);
    if (cached) {
      return cached;
    }
    if (signal && signal.aborted) {
      const abortErr = new Error('Aborted');
      abortErr.name = 'AbortError';
      throw abortErr;
    }

    const ttsModelMeta = TTS_MODELS.find((t) => t.id === ttsId) || TTS_MODELS[0];
    let resp;
    let fallbackPcmRate = 0;

    if (ttsId === 'elevenlabs-byok') {
      const elKey = (state.apiKeys.elevenlabs || '').trim();
      if (!elKey) {
        throw new Error('Не задан ElevenLabs Key. Откройте меню слева → «API ключи».');
      }
      const url = `https://api.elevenlabs.io/v1/text-to-speech/${encodeURIComponent(voiceApiId)}?output_format=pcm_24000`;
      fallbackPcmRate = 24000;
      resp = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'audio/pcm, audio/mpeg',
          'xi-api-key': elKey
        },
        body: JSON.stringify({
          text: chunkText,
          model_id: 'eleven_flash_v2_5'
        }),
        signal
      });
    } else {
      let url = `${OPENROUTER_API_BASE}/audio/speech`;
      let apiKey = (state.apiKeys.openrouter || '').trim();
      let isOpenRouter = true;

      if (state.provider === 'direct') {
        const base = (state.apiKeys.customUrl || '').trim().replace(/\/+$/, '');
        if (!base) {
          throw new Error('Не указан Custom Endpoint URL в меню «API ключи».');
        }
        url = /\/audio\/speech$/i.test(base) ? base : `${base}/audio/speech`;
        isOpenRouter = false;
      } else if (!apiKey) {
        throw new Error('Не задан OpenRouter Key. Откройте меню слева → «API ключи».');
      }

      const headers = {
        'Content-Type': 'application/json',
        Accept: 'audio/wav, audio/mpeg, */*'
      };
      if (apiKey) headers.Authorization = `Bearer ${apiKey}`;
      if (isOpenRouter) {
        headers['HTTP-Referer'] = window.location.origin || 'https://localhost';
        headers['X-Title'] = 'OpenRouter PWA';
      }

      const attemptOrder = [];
      const primaryFmt = resolvePreferredTtsFormat(ttsId);
      attemptOrder.push(primaryFmt);
      ['mp3', 'pcm', 'wav', ''].forEach((cand) => {
        if (!attemptOrder.includes(cand)) attemptOrder.push(cand);
      });

      let lastErrDetail = '';
      let lastErrStatus = 0;
      const droppedSamplingFields = new Set();

      for (let aIdx = 0; aIdx < attemptOrder.length; aIdx++) {
        if (signal && signal.aborted) {
          const abortErr = new Error('Aborted');
          abortErr.name = 'AbortError';
          throw abortErr;
        }

        const chosenFmt = attemptOrder[aIdx];
        fallbackPcmRate = chosenFmt === 'pcm' ? 24000 : 0;

        // Always generate at speed 1.0 so the cached WAV is pristine original audio
        const payload = {
          model: ttsId,
          input: chunkText,
          voice: voiceApiId,
          speed: 1.0
        };
        if (chosenFmt) {
          payload.response_format = chosenFmt;
        }
        if (activeSampling) {
          if (!droppedSamplingFields.has('temperature')) payload.temperature = activeSampling.temperature;
          if (!droppedSamplingFields.has('top_p')) payload.top_p = activeSampling.topP;
          if (!droppedSamplingFields.has('top_k')) payload.top_k = activeSampling.topK;
        }

        resp = await fetch(url, {
          method: 'POST',
          headers,
          body: JSON.stringify(payload),
          signal
        });

        captureRateLimitHeaders(resp.headers, ttsId);

        if (resp.ok) {
          if (aIdx > 0) {
            saveTtsFormatOverride(ttsId, chosenFmt);
          }
          break;
        }

        lastErrStatus = resp.status;
        lastErrDetail = await parseResponseErrorText(resp);
        const lowerErr = String(lastErrDetail || '').toLowerCase();

        // If upstream rejects a sampling param (e.g. top_k/top_p/temperature), drop it and retry same format
        if (
          activeSampling &&
          droppedSamplingFields.size < 3 &&
          (resp.status === 400 || resp.status === 422)
        ) {
          let droppedAny = false;
          if (lowerErr.includes('top_k') || lowerErr.includes('topk')) {
            if (!droppedSamplingFields.has('top_k')) { droppedSamplingFields.add('top_k'); droppedAny = true; }
          }
          if (lowerErr.includes('top_p') || lowerErr.includes('topp')) {
            if (!droppedSamplingFields.has('top_p')) { droppedSamplingFields.add('top_p'); droppedAny = true; }
          }
          if (lowerErr.includes('temperature')) {
            if (!droppedSamplingFields.has('temperature')) { droppedSamplingFields.add('temperature'); droppedAny = true; }
          }
          if (
            !droppedAny &&
            (lowerErr.includes('unrecognized') || lowerErr.includes('unknown field') || lowerErr.includes('extra_forbidden') || lowerErr.includes('additional properties'))
          ) {
            ['temperature', 'top_p', 'top_k'].forEach((k) => {
              if (!droppedSamplingFields.has(k)) { droppedSamplingFields.add(k); droppedAny = true; }
            });
          }
          if (droppedAny) {
            aIdx -= 1;
            continue;
          }
        }

        const isFormatRejection =
          (resp.status === 400 || resp.status === 415 || resp.status === 422) &&
          (
            lowerErr.includes('format') ||
            lowerErr.includes('wav') ||
            lowerErr.includes('pcm') ||
            lowerErr.includes('mp3') ||
            lowerErr.includes('codec') ||
            lowerErr.includes('mime') ||
            lowerErr.includes('unsupported')
          );

        if (!isFormatRejection || aIdx === attemptOrder.length - 1) {
          throw new Error(`TTS ошибка (${lastErrStatus}): ${lastErrDetail || 'сбой озвучки'}`);
        }
      }
    }

    if (!resp.ok) {
      const detail = await parseResponseErrorText(resp);
      throw new Error(`TTS ошибка (${resp.status}): ${detail || 'сбой озвучки'}`);
    }

    const contentType = (resp.headers.get('content-type') || '').toLowerCase();
    const rawBuf = await resp.arrayBuffer();
    if (!rawBuf || rawBuf.byteLength < 64) {
      throw new Error('TTS вернул пустое аудио');
    }

    const canonical = await normalizeToCanonicalWav(rawBuf, contentType, fallbackPcmRate);
    putTtsCache(cacheKey, canonical);

    const estCost = ttsModelMeta && ttsModelMeta.usdPer1MChars
      ? (chunkText.length / 1000000) * ttsModelMeta.usdPer1MChars
      : 0;
    recordUsageEntry({
      type: 'tts',
      modelId: ttsId,
      modelLabel: ttsModelMeta ? ttsModelMeta.name : ttsId,
      chars: chunkText.length,
      cost: estCost,
      isFree: false
    });
    scheduleBalanceRefreshAfterRequest();

    return canonical;
  }

  function revokeActiveTtsBlobUrl() {
    if (state.ttsActiveBlobUrl) {
      try { URL.revokeObjectURL(state.ttsActiveBlobUrl); } catch (_) {}
      state.ttsActiveBlobUrl = null;
    }
  }

  function stopActivePlayback() {
    state.ttsSessionId += 1;
    clearTimeout(state.ttsPitchRepatchTimer);
    state.ttsPitchRepatchTimer = null;

    if (state.ttsAbortController) {
      const ctrl = state.ttsAbortController;
      state.ttsAbortController = null;
      try { ctrl.abort(); } catch (_) {}
    }

    if (state.ttsResolveCurrentPlay) {
      const resolvePrev = state.ttsResolveCurrentPlay;
      state.ttsResolveCurrentPlay = null;
      try { resolvePrev(); } catch (_) {}
    }

    ttsAudio.onended = null;
    ttsAudio.onerror = null;
    ttsAudio.onloadedmetadata = null;
    try { ttsAudio.pause(); } catch (_) {}
    revokeActiveTtsBlobUrl();

    state.ttsCurrentChunk = null;
    state.ttsAppliedPitch = 1.0;
    state.ttsPlayingMsgId = null;
    state.ttsPaused = false;
    state.ttsActiveModelId = null;
    state.ttsActiveVoiceApiId = null;
    state.ttsActiveSamplingKey = '';
    state.ttsPausedTime = 0;
    state.ttsPausedDuration = 0;
    state.ttsPitchChangedWhilePaused = false;
    updateTtsIcons();
  }

  function applyLiveSpeedToPlayingAudio() {
    if (!state.ttsPlayingMsgId || !state.ttsCurrentChunk) return;
    const safeSpeed = Math.max(0.70, Math.min(1.60, Number(state.voiceDraft.speed) || 1.0));
    const appliedPitch = state.ttsAppliedPitch || 1.0;
    const rate = Math.max(0.5, Math.min(4.0, safeSpeed / appliedPitch));
    setPreservesPitch(ttsAudio, true);
    try { ttsAudio.playbackRate = rate; } catch (_) {}
  }

  function repatchPlayingChunkWithCurrentPitch(forcePlay = false) {
    if (!state.ttsPlayingMsgId || !state.ttsCurrentChunk || !state.ttsCurrentChunk.isPatchableWav) return;
    if (state.ttsPaused && !forcePlay) {
      state.ttsPitchChangedWhilePaused = true;
      return;
    }

    const sessionId = state.ttsSessionId;
    const rawTime = Number.isFinite(ttsAudio.currentTime) && ttsAudio.currentTime > 0
      ? ttsAudio.currentTime
      : (state.ttsPausedTime || 0);
    const rawDur = Number.isFinite(ttsAudio.duration) && ttsAudio.duration > 0
      ? ttsAudio.duration
      : (state.ttsPausedDuration || 0);
    const progress = rawDur > 0 ? Math.max(0, Math.min(0.98, rawTime / rawDur)) : 0;

    const { blob, appliedPitch, playbackRate } = buildPatchedPlaybackSource(
      state.ttsCurrentChunk,
      state.voiceDraft.speed,
      state.voiceDraft.pitch
    );
    state.ttsAppliedPitch = appliedPitch;
    state.ttsPitchChangedWhilePaused = false;

    const oldOnEnded = ttsAudio.onended;
    const oldOnError = ttsAudio.onerror;
    const nextUrl = URL.createObjectURL(blob);
    revokeActiveTtsBlobUrl();
    state.ttsActiveBlobUrl = nextUrl;

    ttsAudio.onloadedmetadata = () => {
      if (state.ttsSessionId !== sessionId) return;
      if (progress > 0 && Number.isFinite(ttsAudio.duration) && ttsAudio.duration > 0) {
        try { ttsAudio.currentTime = Math.min(ttsAudio.duration - 0.05, progress * ttsAudio.duration); } catch (_) {}
      }
      setPreservesPitch(ttsAudio, true);
      try { ttsAudio.playbackRate = playbackRate; } catch (_) {}
    };
    ttsAudio.onended = oldOnEnded;
    ttsAudio.onerror = oldOnError;
    ttsAudio.src = nextUrl;
    setPreservesPitch(ttsAudio, true);
    try { ttsAudio.playbackRate = playbackRate; } catch (_) {}
    const p = ttsAudio.play();
    if (p && typeof p.catch === 'function') p.catch(() => {});
  }

  function pauseActivePlayback() {
    if (!state.ttsPlayingMsgId || state.ttsPaused) return;
    state.ttsPausedTime = Number.isFinite(ttsAudio.currentTime) ? ttsAudio.currentTime : 0;
    state.ttsPausedDuration = Number.isFinite(ttsAudio.duration) ? ttsAudio.duration : 0;
    try { ttsAudio.pause(); } catch (_) {}
    state.ttsPaused = true;
    updateTtsIcons();
  }

  function resumeActivePlaybackIfCompatible() {
    if (!state.ttsPlayingMsgId || !state.ttsPaused || !state.ttsCurrentChunk) return false;

    const currentVoiceApiId = resolveVoiceApiId(state.ttsId, state.voiceDraft.voice);
    const currentSamplingKey = formatTtsSamplingKey(getActiveTtsSamplingParams(state.ttsId));
    // Restart from beginning ONLY if model, voice, or Gemini sampling params changed (requiring a new TTS request)
    if (
      state.ttsActiveModelId !== state.ttsId ||
      state.ttsActiveVoiceApiId !== currentVoiceApiId ||
      state.ttsActiveSamplingKey !== currentSamplingKey
    ) {
      return false;
    }

    state.ttsPaused = false;
    updateTtsIcons();
    setAudioSessionType('playback');

    const desiredPitch = Math.max(0.75, Math.min(1.25, Number(state.voiceDraft.pitch) || 1.0));
    const pitchDiff = Math.abs(desiredPitch - (state.ttsAppliedPitch || 1.0));

    if (state.ttsCurrentChunk.isPatchableWav && (state.ttsPitchChangedWhilePaused || pitchDiff > 0.006)) {
      repatchPlayingChunkWithCurrentPitch(true);
      return true;
    }

    applyLiveSpeedToPlayingAudio();
    const p = ttsAudio.play();
    if (p && typeof p.catch === 'function') {
      p.catch(() => {
        // Fallback if iOS released audio buffer during long pause: rebuild Blob at saved time
        if (state.ttsPlayingMsgId && !state.ttsPaused && state.ttsCurrentChunk) {
          repatchPlayingChunkWithCurrentPitch(true);
        }
      });
    }
    return true;
  }

  function playCanonicalChunkOnSingleAudio(canonical, sessionId, onPlaybackStarted = null) {
    return new Promise((resolve, reject) => {
      if (state.ttsSessionId !== sessionId) {
        resolve('aborted');
        return;
      }

      setAudioSessionType('playback');
      state.ttsCurrentChunk = canonical;
      const { blob, appliedPitch, playbackRate } = buildPatchedPlaybackSource(
        canonical,
        state.voiceDraft.speed,
        state.voiceDraft.pitch
      );
      state.ttsAppliedPitch = appliedPitch;

      const blobUrl = URL.createObjectURL(blob);
      revokeActiveTtsBlobUrl();
      state.ttsActiveBlobUrl = blobUrl;

      let settled = false;
      let startedNotified = false;

      const notifyStarted = () => {
        if (startedNotified || state.ttsSessionId !== sessionId) return;
        startedNotified = true;
        if (typeof onPlaybackStarted === 'function') {
          try { onPlaybackStarted(); } catch (_) {}
        }
      };

      let cancelHandle = null;
      const finish = (err) => {
        if (settled) return;
        settled = true;
        if (state.ttsResolveCurrentPlay === cancelHandle) {
          state.ttsResolveCurrentPlay = null;
        }
        ttsAudio.onended = null;
        ttsAudio.onerror = null;
        ttsAudio.onloadedmetadata = null;
        if (err) reject(err);
        else resolve('ended');
      };
      cancelHandle = () => finish(null);
      state.ttsResolveCurrentPlay = cancelHandle;

      const enforceRate = () => {
        if (state.ttsSessionId !== sessionId) return;
        setPreservesPitch(ttsAudio, true);
        const curSpeed = Math.max(0.70, Math.min(1.60, Number(state.voiceDraft.speed) || 1.0));
        const curRate = Math.max(0.5, Math.min(4.0, curSpeed / (state.ttsAppliedPitch || 1.0)));
        try { ttsAudio.playbackRate = curRate; } catch (_) {}
      };

      ttsAudio.onloadedmetadata = enforceRate;
      ttsAudio.onended = () => finish(null);
      ttsAudio.onerror = () => finish(new Error('Ошибка воспроизведения аудио'));

      ttsAudio.src = blobUrl;
      setPreservesPitch(ttsAudio, true);
      try { ttsAudio.playbackRate = playbackRate; } catch (_) {}

      const playPromise = ttsAudio.play();
      if (playPromise && typeof playPromise.then === 'function') {
        playPromise
          .then(() => {
            enforceRate();
            notifyStarted();
          })
          .catch((err) => {
            if (state.ttsSessionId !== sessionId) {
              finish(null);
            } else {
              finish(err || new Error('Автовоспроизведение заблокировано iOS'));
            }
          });
      } else {
        notifyStarted();
      }
    });
  }

  function findMessageById(msgId) {
    const chat = getActiveChat();
    if (chat) {
      const found = chat.messages.find((m) => m.id === msgId);
      if (found) return found;
    }
    for (let i = 0; i < state.chats.length; i++) {
      const found = state.chats[i].messages.find((m) => m.id === msgId);
      if (found) return found;
    }
    return null;
  }

  async function togglePlayback(msgId, fromUserGesture = true) {
    if (state.micState !== 'idle') return;

    if (state.ttsPlayingMsgId === msgId) {
      if (!state.ttsPaused) {
        if (state.ttsCurrentChunk && ttsAudio.src && ttsAudio.src !== SILENT_WAV_URL) {
          pauseActivePlayback();
        } else {
          // Still fetching first chunk before audio began -> cancel cleanly
          stopActivePlayback();
        }
        return;
      }
      // Currently paused on the same message: resume unless voice or TTS model changed
      if (resumeActivePlaybackIfCompatible()) {
        return;
      }
    }

    stopActivePlayback();

    const msg = findMessageById(msgId);
    if (!msg) return;

    const rawText = msg.role === 'user' ? (msg.text || '') : (msg.plainText || '');
    const cleaned = cleanTextForTts(rawText, state.ttsId);
    const chunks = chunkTextForTts(cleaned);

    if (chunks.length === 0) {
      showToast('Нет текста для озвучки');
      return;
    }

    // Synchronous silent WAV prime inside tap gesture for iOS Safari autoplay & background retention
    if (fromUserGesture) {
      unlockAudioSyncInUserGesture(true);
    } else {
      setAudioSessionType('playback');
    }

    const ttsId = state.ttsId;
    const voiceApiId = resolveVoiceApiId(ttsId, state.voiceDraft.voice);
    const samplingParams = getActiveTtsSamplingParams(ttsId);
    const samplingKey = formatTtsSamplingKey(samplingParams);

    const sessionId = ++state.ttsSessionId;
    const controller = new AbortController();
    state.ttsAbortController = controller;
    state.ttsPlayingMsgId = msgId;
    state.ttsPaused = false;
    state.ttsActiveModelId = ttsId;
    state.ttsActiveVoiceApiId = voiceApiId;
    state.ttsActiveSamplingKey = samplingKey;
    state.ttsPausedTime = 0;
    state.ttsPausedDuration = 0;
    state.ttsPitchChangedWhilePaused = false;
    updateTtsIcons();

    try {
      // Hold at most 1 lookahead chunk (i + 1) buffered ahead of currently playing chunk i.
      // Once chunk (i + 1) is ready in memory/cache, no further chunk (i + 2) is requested
      // until chunk (i + 1) actually starts playing.
      const chunkBuffer = new Array(chunks.length).fill(null);

      const ensureChunkRequested = (idx) => {
        if (idx < 0 || idx >= chunks.length) return null;
        if (state.ttsSessionId !== sessionId) return null;
        if (!chunkBuffer[idx]) {
          const p = fetchTtsChunkCanonicalWav(chunks[idx], ttsId, voiceApiId, controller.signal, samplingParams);
          p.catch(() => {});
          chunkBuffer[idx] = p;
        }
        return chunkBuffer[idx];
      };

      ensureChunkRequested(0);

      for (let i = 0; i < chunks.length; i++) {
        if (state.ttsSessionId !== sessionId) return;

        const canonical = await ensureChunkRequested(i);
        if (state.ttsSessionId !== sessionId) return;

        // Trigger download ONLY for the single immediate next chunk (i + 1) once chunk i starts playing
        await playCanonicalChunkOnSingleAudio(canonical, sessionId, () => {
          if (i + 1 < chunks.length && !chunkBuffer[i + 1]) {
            ensureChunkRequested(i + 1);
          }
        });

        // Release reference to played chunk so GC stays lean (pristine copy lives in LRU cache)
        chunkBuffer[i] = null;
      }
    } catch (err) {
      if (state.ttsSessionId !== sessionId || (err && err.name === 'AbortError')) {
        return;
      }
      showToast(err && err.message ? err.message : 'Ошибка озвучки TTS');
    } finally {
      if (state.ttsSessionId === sessionId) {
        state.ttsAbortController = null;
        state.ttsCurrentChunk = null;
        state.ttsAppliedPitch = 1.0;
        revokeActiveTtsBlobUrl();
        state.ttsPlayingMsgId = null;
        state.ttsPaused = false;
        state.ttsActiveModelId = null;
        state.ttsActiveVoiceApiId = null;
        state.ttsActiveSamplingKey = '';
        state.ttsPausedTime = 0;
        state.ttsPausedDuration = 0;
        state.ttsPitchChangedWhilePaused = false;
        updateTtsIcons();
      }
    }
  }

  function applyTtsButtonState(btn, msgId) {
    const isTarget = msgId === state.ttsPlayingMsgId;
    const isPlaying = isTarget && !state.ttsPaused;
    const isPaused = isTarget && state.ttsPaused;
    btn.innerHTML = isPlaying ? ICONS.pauseAudio : ICONS.speaker;
    btn.classList.toggle('speaking', isPlaying);
    btn.classList.toggle('active', isPaused);
    btn.setAttribute('aria-label', isPlaying ? 'Пауза' : (isPaused ? 'Продолжить озвучку' : 'Озвучить'));
  }

  function updateTtsIcons() {
    document.querySelectorAll('[data-tts-btn]').forEach((btn) => {
      applyTtsButtonState(btn, btn.dataset.ttsBtn);
    });
  }

  /* =========================================================================
     MARKDOWN RENDERER & CODE BLOCK COPY DELEGATION
     ========================================================================= */
  function isSafeRenderImageUrl(url) {
    const u = String(url || '').trim();
    return /^https?:\/\//i.test(u) || /^data:image\/(?:png|jpe?g|webp|gif|svg\+xml|avif);base64,[A-Za-z0-9+/=]+$/i.test(u);
  }

  function buildRenderedImageHtml(src, alt) {
    const cleanAlt = String(alt || 'Изображение').trim();
    return (
      `<span class="md-img-wrap">` +
        `<img class="md-img" src="${src}" alt="${cleanAlt}" loading="lazy" decoding="async" referrerpolicy="no-referrer" data-lightbox-src="${src}" data-lightbox-title="${cleanAlt}" data-fallback-url="${src}">` +
      `</span>`
    );
  }

  function applyBasicEmphasis(str) {
    let out = str;
    out = out.replace(/\*\*([^*]+?)\*\*/g, '<strong>$1</strong>');
    out = out.replace(/(^|[\s(>])__([^_]+?)__(?=[\s)<.,!?:;]|$)/g, '$1<strong>$2</strong>');
    out = out.replace(/(^|[\s(>])\*([^*\n]+?)\*(?=[\s)<.,!?:;]|$)/g, '$1<em>$2</em>');
    out = out.replace(/~~([^~]+?)~~/g, '<del>$1</del>');
    return out;
  }

  function trimTrailingUrlPunctuation(rawUrl) {
    let url = rawUrl;
    let trailing = '';
    while (url.length > 0) {
      const last = url[url.length - 1];
      if (/[.,;:!?»”'"]/.test(last)) {
        trailing = last + trailing;
        url = url.slice(0, -1);
        continue;
      }
      if (last === ')') {
        const opens = (url.match(/\(/g) || []).length;
        const closes = (url.match(/\)/g) || []).length;
        if (closes > opens) {
          trailing = last + trailing;
          url = url.slice(0, -1);
          continue;
        }
      }
      if (last === ']') {
        const opens = (url.match(/\[/g) || []).length;
        const closes = (url.match(/\]/g) || []).length;
        if (closes > opens) {
          trailing = last + trailing;
          url = url.slice(0, -1);
          continue;
        }
      }
      break;
    }
    return { url, trailing };
  }

  function formatInlineMarkdown(raw, hideIncompleteTagTail = false) {
    const codeTokens = [];
    const mediaTokens = [];
    const pushMedia = (html) => {
      const idx = mediaTokens.length;
      mediaTokens.push(html);
      return `@@MDMEDIA_${idx}@@`;
    };

    let s = escapeHtml(raw);

    // 1. Protect inline code spans first
    s = s.replace(/`([^`\n]+)`/g, (_, inner) => {
      const idx = codeTokens.length;
      codeTokens.push(`<code>${inner}</code>`);
      return `@@INLINECODE_${idx}@@`;
    });

    // 2. Hide whitelisted TTS tags on screen when enabled in the active persona
    if (isPersonaTtsTagsActive()) {
      s = stripWhitelistedTtsTags(s, hideIncompleteTagTail);
    }

    // 3. Linked Markdown Images: [![alt](imgUrl)](linkUrl)
    s = s.replace(
      /\[!\[([^\]]*)\]\(((?:https?:\/\/|data:image\/)[^\s()]+(?:\([^\s()]*\)[^\s()]*)*)(?:\s+&quot;[^&]*&quot;)?\)\]\((https?:\/\/[^\s()]+(?:\([^\s()]*\)[^\s()]*)*)(?:\s+&quot;[^&]*&quot;)?\)/gi,
      (full, alt, imgUrl, linkUrl) => {
        if (!isSafeRenderImageUrl(imgUrl)) return full;
        return pushMedia(
          `<a class="md-link" href="${linkUrl}" target="_blank" rel="noopener noreferrer">${buildRenderedImageHtml(imgUrl, alt)}</a>`
        );
      }
    );

    // 4. Markdown Images: ![alt](url) or ![alt](data:image/...;base64,...)
    s = s.replace(
      /!\[([^\]]*)\]\(((?:https?:\/\/|data:image\/)[^\s()]+(?:\([^\s()]*\)[^\s()]*)*)(?:\s+&quot;[^&]*&quot;)?\)/gi,
      (full, alt, imgUrl) => {
        if (!isSafeRenderImageUrl(imgUrl)) return full;
        return pushMedia(buildRenderedImageHtml(imgUrl, alt));
      }
    );

    // 5. Markdown Links: [label](https://...) (supports balanced parens in URLs & optional title)
    s = s.replace(
      /\[([^\]]+)\]\(((?:https?:\/\/|mailto:)[^\s()]+(?:\([^\s()]*\)[^\s()]*)*)(?:\s+&quot;[^&]*&quot;)?\)/gi,
      (_, label, url) => {
        const styledLabel = applyBasicEmphasis(label);
        return pushMedia(
          `<a class="md-link" href="${url}" target="_blank" rel="noopener noreferrer">${styledLabel}</a>`
        );
      }
    );

    // 6. Autolinks: <https://...> (escaped to &lt;https://...&gt;)
    s = s.replace(/&lt;(https?:\/\/[^\s<>]+)&gt;/gi, (_, url) => {
      return pushMedia(
        `<a class="md-link" href="${url}" target="_blank" rel="noopener noreferrer">${url}</a>`
      );
    });

    // 7. Bare http/https URLs outside existing protected tokens
    s = s.replace(/(^|[\s(>«“])(https?:\/\/[^\s<>]+)/gi, (full, prefix, rawUrl) => {
      const { url, trailing } = trimTrailingUrlPunctuation(rawUrl);
      if (!url) return full;
      return (
        prefix +
        pushMedia(`<a class="md-link" href="${url}" target="_blank" rel="noopener noreferrer">${url}</a>`) +
        trailing
      );
    });

    // 8. Bare www.example.com links
    s = s.replace(/(^|[\s(>«“])(www\.[a-z0-9-]+(?:\.[a-z0-9-]+)+(?:\/[^\s<>]*)?)/gi, (full, prefix, rawHost) => {
      const { url, trailing } = trimTrailingUrlPunctuation(rawHost);
      if (!url) return full;
      return (
        prefix +
        pushMedia(`<a class="md-link" href="https://${url}" target="_blank" rel="noopener noreferrer">${url}</a>`) +
        trailing
      );
    });

    // 9. Bold / Italic / Strikethrough (all URLs & image srcs are safely protected)
    s = applyBasicEmphasis(s);

    // 10. Restore protected links/images & inline code
    s = s.replace(/@@MDMEDIA_(\d+)@@/g, (_, idx) => mediaTokens[Number(idx)] || '');
    s = s.replace(/@@INLINECODE_(\d+)@@/g, (_, idx) => codeTokens[Number(idx)] || '');
    return s;
  }

  function renderTextSegmentToHtml(segment, isTrailingStream = false) {
    const lines = segment.replace(/\r\n/g, '\n').split('\n');
    const out = [];
    let paraLines = [];
    let listItems = [];

    const flushPara = () => {
      if (paraLines.length === 0) return;
      const rendered = paraLines
        .map((item) => formatInlineMarkdown(item.text, item.isLast).trim())
        .filter(Boolean);
      if (rendered.length > 0) {
        out.push(`<p>${rendered.join('<br>')}</p>`);
      }
      paraLines = [];
    };

    const flushList = () => {
      if (listItems.length === 0) return;
      const rendered = listItems
        .map((item) => formatInlineMarkdown(item.text, item.isLast).trim())
        .filter(Boolean);
      if (rendered.length > 0) {
        out.push(`<ul>${rendered.map((it) => `<li>${it}</li>`).join('')}</ul>`);
      }
      listItems = [];
    };

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const trimmed = line.trim();
      const isLastLine = isTrailingStream && i === lines.length - 1;

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
        const hHtml = formatInlineMarkdown(hMatch[1], isLastLine).trim();
        if (hHtml) out.push(`<p><strong>${hHtml}</strong></p>`);
        continue;
      }

      // Unordered or ordered list items
      const ulMatch = trimmed.match(/^(?:[-*•]|\d+\.)\s+(.+)$/);
      if (ulMatch) {
        flushPara();
        listItems.push({ text: ulMatch[1], isLast: isLastLine });
        continue;
      }

      // Blockquote
      const bqMatch = trimmed.match(/^>\s?(.*)$/);
      if (bqMatch) {
        flushPara();
        flushList();
        const bqHtml = formatInlineMarkdown(bqMatch[1], isLastLine).trim();
        if (bqHtml) out.push(`<p style="padding-left:10px;opacity:0.86;">${bqHtml}</p>`);
        continue;
      }

      // Horizontal rule
      if (/^([-*_]){3,}$/.test(trimmed)) {
        flushPara();
        flushList();
        continue;
      }

      flushList();
      paraLines.push({ text: line, isLast: isLastLine });
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
        parts.push(renderTextSegmentToHtml(tail, isStreaming));
      }
    }

    let html = parts.join('');
    if (!html && !isStreaming) {
      const fallbackText = isPersonaTtsTagsActive() ? stripWhitelistedTtsTags(src, false) : src;
      html = `<p>${escapeHtml(fallbackText)}</p>`;
    } else if (!html && isStreaming) {
      html = '<p></p>';
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

  // Event delegation for Copy buttons & fullscreen image Lightbox inside chatFeed
  chatFeed.addEventListener('click', (e) => {
    const lbTarget = e.target && e.target.closest ? e.target.closest('[data-lightbox-src]') : null;
    if (lbTarget && state.micState === 'idle') {
      // If wrapped inside an <a> link, let normal link navigation happen unless direct image
      if (!lbTarget.closest('a.md-link')) {
        e.stopPropagation();
        openImageLightbox(lbTarget.dataset.lightboxSrc, lbTarget.dataset.lightboxTitle || lbTarget.getAttribute('alt') || '');
        return;
      }
    }

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

  // Graceful fallback if a remote AI markdown image fails to load (hotlink block / 404)
  chatFeed.addEventListener('error', (e) => {
    const img = e.target;
    if (!img || img.tagName !== 'IMG' || !img.matches('img.md-img, img.ai-img-el')) return;
    const url = img.dataset.fallbackUrl || img.getAttribute('src') || '';
    if (!/^https?:\/\//i.test(url)) return;
    const alt = img.getAttribute('alt') || 'Открыть изображение';
    const link = document.createElement('a');
    link.className = 'md-img-fallback';
    link.href = url;
    link.target = '_blank';
    link.rel = 'noopener noreferrer';
    link.textContent = `${alt} ↗`;
    const parentWrap = img.closest('.md-img-wrap');
    if (parentWrap) parentWrap.replaceWith(link);
    else img.replaceWith(link);
  }, true);

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

      if (Array.isArray(msg.images) && msg.images.length > 0) {
        let imgGrid = block.querySelector('.ai-images-grid');
        if (!imgGrid) {
          imgGrid = document.createElement('div');
          imgGrid.className = 'ai-images-grid';
          block.insertBefore(imgGrid, footer || null);
        }
        if (imgGrid.childElementCount !== msg.images.length) {
          imgGrid.innerHTML = '';
          msg.images.forEach((im) => {
            if (!im || !im.url || !isSafeRenderImageUrl(im.url)) return;
            const imgEl = document.createElement('img');
            imgEl.className = 'ai-img-el';
            imgEl.src = im.url;
            imgEl.alt = im.alt || 'Изображение';
            imgEl.loading = 'lazy';
            imgEl.decoding = 'async';
            imgEl.referrerPolicy = 'no-referrer';
            imgEl.dataset.lightboxSrc = im.url;
            imgEl.dataset.lightboxTitle = im.alt || 'Изображение';
            imgEl.dataset.fallbackUrl = im.url;
            imgGrid.appendChild(imgEl);
          });
        }
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
        const isEditingThis = state.editingMsgId === msg.id;
        const card = document.createElement('div');
        card.className = `msg-user-card${!isEditingThis && msg.collapsed ? ' collapsed' : ''}`;

        if (isEditingThis) {
          card.style.width = '100%';
          card.style.maxWidth = '100%';

          const editTa = document.createElement('textarea');
          editTa.value = state.editingMsgDraft;
          editTa.rows = 2;
          editTa.setAttribute('aria-label', 'Редактировать сообщение');
          editTa.style.cssText = [
            'width:100%',
            'min-height:64px',
            'max-height:220px',
            'padding:9px 11px',
            'border-radius:12px',
            'background-color:var(--menu-dark)',
            'color:var(--text-input)',
            'caret-color:var(--text-input)',
            'font-family:var(--font-sans)',
            'font-size:16px',
            'line-height:1.45',
            'resize:none',
            'overflow-y:auto',
            '-webkit-overflow-scrolling:touch',
            'display:block'
          ].join(';');

          const autoGrowEditTa = () => {
            editTa.style.height = 'auto';
            editTa.style.height = `${Math.max(64, Math.min(editTa.scrollHeight, 220))}px`;
          };

          editTa.addEventListener('input', () => {
            state.editingMsgDraft = editTa.value;
            autoGrowEditTa();
          });

          editTa.addEventListener('keydown', (e) => {
            e.stopPropagation();
            if (e.key === 'Escape') {
              e.preventDefault();
              cancelInlineUserEdit();
            } else if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
              e.preventDefault();
              submitInlineUserEdit(msg.id);
            }
          });

          const btnBar = document.createElement('div');
          btnBar.style.cssText = 'display:flex;justify-content:flex-end;gap:8px;margin-top:9px;';

          const cancelBtn = document.createElement('button');
          cancelBtn.type = 'button';
          cancelBtn.textContent = 'Отмена';
          cancelBtn.style.cssText = [
            'height:34px',
            'padding:0 13px',
            'border-radius:9999px',
            'background-color:var(--surface-composer)',
            'color:var(--menu-text)',
            'font-size:13px',
            'font-weight:500'
          ].join(';');
          cancelBtn.addEventListener('click', () => cancelInlineUserEdit());

          const submitBtn = document.createElement('button');
          submitBtn.type = 'button';
          submitBtn.textContent = 'Отправить';
          submitBtn.style.cssText = [
            'height:34px',
            'padding:0 14px',
            'border-radius:9999px',
            'background-color:var(--save-bg)',
            'color:var(--save-fg)',
            'font-size:13px',
            'font-weight:500'
          ].join(';');
          submitBtn.addEventListener('click', () => submitInlineUserEdit(msg.id));

          btnBar.appendChild(cancelBtn);
          btnBar.appendChild(submitBtn);
          card.appendChild(editTa);
          card.appendChild(btnBar);

          requestAnimationFrame(() => {
            if (!editTa.isConnected) return;
            autoGrowEditTa();
            editTa.focus();
            try { editTa.setSelectionRange(editTa.value.length, editTa.value.length); } catch (_) {}
            try { card.scrollIntoView({ block: 'center', behavior: 'smooth' }); } catch (_) {}
          });
        } else {
          const hasAtts = Array.isArray(msg.attachments) && msg.attachments.length > 0;
          const hasText = Boolean(msg.text && msg.text.trim());

          if (hasAtts) {
            const attRow = document.createElement('div');
            attRow.className = `msg-attachments-row${!hasText ? ' only-attachments' : ''}`;
            msg.attachments.forEach((att) => {
              if (!att) return;
              if (att.kind === 'image' && att.dataUrl) {
                const img = document.createElement('img');
                img.className = 'msg-att-img';
                img.src = att.dataUrl;
                img.alt = att.name || 'Фото';
                img.loading = 'lazy';
                img.dataset.lightboxSrc = att.dataUrl;
                img.dataset.lightboxTitle = att.name || 'Фото';
                attRow.appendChild(img);
              } else {
                const chip = document.createElement('div');
                chip.className = 'msg-att-chip';
                chip.innerHTML = `<span class="attach-file-badge">${escapeHtml(getAttachmentBadgeLabel(att))}</span><span class="msg-att-chip-name">${escapeHtml(att.name || 'Файл')}</span>`;
                attRow.appendChild(chip);
              }
            });
            card.appendChild(attRow);
          }

          if (hasText) {
            const textEl = document.createElement('div');
            textEl.className = `msg-body${msg.collapsed ? ' clamped' : ''}`;
            textEl.textContent = msg.text;
            card.appendChild(textEl);
          }

          if (msg.collapsed) {
            card.addEventListener('click', () => {
              if (state.micState !== 'idle') return;
              msg.collapsed = false;
              persistChat(chat);
              renderFeed();
            });
          }
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
          } else if (msg.plainText && (String(msg.id || '').startsWith('a-') || hasWhitelistedTtsTag(msg.plainText) || !msg.html)) {
            // Re-render real AI replies dynamically so images, links & TTS-tag toggle always render up-to-date
            aiContent.innerHTML = renderMarkdownToHtml(msg.plainText, false);
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
          if (msg.plainText || msg.html || msg.streaming) {
            block.appendChild(aiContent);
          }

          if (Array.isArray(msg.images) && msg.images.length > 0 && !msg.collapsed) {
            const imgGrid = document.createElement('div');
            imgGrid.className = 'ai-images-grid';
            msg.images.forEach((im) => {
              if (!im || !im.url || !isSafeRenderImageUrl(im.url)) return;
              const imgEl = document.createElement('img');
              imgEl.className = 'ai-img-el';
              imgEl.src = im.url;
              imgEl.alt = im.alt || 'Изображение';
              imgEl.loading = 'lazy';
              imgEl.decoding = 'async';
              imgEl.referrerPolicy = 'no-referrer';
              imgEl.dataset.lightboxSrc = im.url;
              imgEl.dataset.lightboxTitle = im.alt || 'Изображение';
              imgEl.dataset.fallbackUrl = im.url;
              imgGrid.appendChild(imgEl);
            });
            if (imgGrid.childElementCount > 0) {
              block.appendChild(imgGrid);
            }
          }

          if (Array.isArray(msg.citations) && msg.citations.length > 0 && !msg.collapsed) {
            const citRow = document.createElement('div');
            citRow.className = 'ai-citations-row';
            msg.citations.forEach((c) => {
              if (!c || !c.url || !/^https?:\/\//i.test(c.url)) return;
              const a = document.createElement('a');
              a.className = 'ai-citation-chip';
              a.href = c.url;
              a.target = '_blank';
              a.rel = 'noopener noreferrer';
              let label = c.title || '';
              if (!label) {
                try { label = new URL(c.url).hostname.replace(/^www\./, ''); } catch (_) { label = c.url; }
              }
              a.innerHTML = `<span>${escapeHtml(label)}</span><span style="opacity:0.65;flex-shrink:0;">↗</span>`;
              citRow.appendChild(a);
            });
            if (citRow.childElementCount > 0) {
              block.appendChild(citRow);
            }
          }
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
        let raw = msg.role === 'user' ? msg.text : (msg.plainText || '');
        if (msg.role === 'assistant' && isPersonaTtsTagsActive()) {
          raw = stripTtsTagsOutsideCode(raw, false);
        }
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
      applyTtsButtonState(ttsBtn, msg.id);
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

      if (msg.role === 'user') {
        const editBtn = document.createElement('button');
        editBtn.className = `msg-icon-btn${state.editingMsgId === msg.id ? ' active' : ''}`;
        editBtn.setAttribute('aria-label', 'Редактировать сообщение');
        editBtn.innerHTML = ICONS.editPencil;
        editBtn.addEventListener('click', () => {
          if (state.micState !== 'idle') return;
          if (state.editingMsgId === msg.id) {
            cancelInlineUserEdit();
          } else {
            startInlineUserEdit(msg.id);
          }
        });
        actions.appendChild(editBtn);
      }

      const retryBtn = document.createElement('button');
      retryBtn.className = 'msg-icon-btn';
      retryBtn.setAttribute('aria-label', 'Повторить запрос');
      retryBtn.innerHTML = ICONS.retry;
      retryBtn.addEventListener('click', () => {
        if (state.micState !== 'idle') return;
        if (msg.role === 'user') {
          retryFromUserMessage(msg.id);
        } else {
          retryAssistantMessage(msg.id);
        }
      });
      actions.appendChild(retryBtn);

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
     4B. AUDIO (VOICE & MIC) PANEL LOGIC (+ GEMINI TEMPERATURE / TOP P / TOP K)
     ========================================================================= */
  let ttsTempSlider = null;
  let ttsTopPSlider = null;
  let ttsTopKSlider = null;
  let ttsTempVal = null;
  let ttsTopPVal = null;
  let ttsTopKVal = null;
  let ttsSamplingEntries = [];

  function findSliderBlockContainer(sliderEl, valEl, siblingSliderEl) {
    if (!sliderEl || !audioPanel) return null;
    let node = sliderEl.parentElement;
    while (node && node !== audioPanel) {
      const hasVal = !valEl || node.contains(valEl);
      const hasSibling = siblingSliderEl && node.contains(siblingSliderEl);
      if (hasVal && !hasSibling) return node;
      if (hasSibling) break;
      node = node.parentElement;
    }
    return null;
  }

  function updateClonedSliderLabel(clone, newLabel, newSliderId) {
    const lbl = clone.querySelector('label');
    if (lbl) {
      if (lbl.htmlFor === 'pitchSlider') lbl.htmlFor = newSliderId;
      let updated = false;
      lbl.childNodes.forEach((n) => {
        if (n.nodeType === 3 && n.textContent.trim()) {
          n.textContent = newLabel;
          updated = true;
        }
      });
      if (!updated) {
        const innerSpan = Array.from(lbl.querySelectorAll('span')).find(
          (sp) => sp.dataset.ttsSamplingVal !== '1' && sp.id !== newSliderId
        );
        if (innerSpan) {
          innerSpan.textContent = newLabel;
          updated = true;
        }
      }
      if (updated) return;
    }

    const walker = document.createTreeWalker(clone, NodeFilter.SHOW_TEXT, null);
    let textNode;
    while ((textNode = walker.nextNode())) {
      const txt = (textNode.textContent || '').trim();
      if (!txt) continue;
      const p = textNode.parentElement;
      if (p && (p.dataset.ttsSamplingVal === '1' || p.id === 'pitchVal')) continue;
      if (/pitch|питч|тон/i.test(txt)) {
        textNode.textContent = newLabel;
        return;
      }
    }

    const fallbackEl = Array.from(clone.querySelectorAll('span, div, p')).find(
      (el) => el.children.length === 0 && el.dataset.ttsSamplingVal !== '1' && el.textContent.trim().length > 0
    );
    if (fallbackEl) {
      fallbackEl.textContent = newLabel;
    }
  }

  function ensureTtsSamplingSliders() {
    if (ttsTempSlider || !audioPanel || !pitchSlider) return;

    const specs = [
      {
        key: 'temperature',
        sliderId: 'ttsTempSlider',
        valId: 'ttsTempVal',
        label: 'Temperature',
        min: '0.00',
        max: '2.00',
        step: '0.05',
        getVal: () => clampTtsTemperature(state.voiceDraft.temperature),
        setVal: (raw) => { state.voiceDraft.temperature = clampTtsTemperature(raw); },
        format: (v) => clampTtsTemperature(v).toFixed(2)
      },
      {
        key: 'topP',
        sliderId: 'ttsTopPSlider',
        valId: 'ttsTopPVal',
        label: 'Top P',
        min: '0.01',
        max: '1.00',
        step: '0.01',
        getVal: () => clampTtsTopP(state.voiceDraft.topP),
        setVal: (raw) => { state.voiceDraft.topP = clampTtsTopP(raw); },
        format: (v) => clampTtsTopP(v).toFixed(2)
      },
      {
        key: 'topK',
        sliderId: 'ttsTopKSlider',
        valId: 'ttsTopKVal',
        label: 'Top K',
        min: '1',
        max: '100',
        step: '1',
        getVal: () => clampTtsTopK(state.voiceDraft.topK),
        setVal: (raw) => { state.voiceDraft.topK = clampTtsTopK(raw); },
        format: (v) => String(clampTtsTopK(v))
      }
    ];

    const pitchBlock = findSliderBlockContainer(pitchSlider, pitchVal, speedSlider);
    const parentEl = pitchBlock ? pitchBlock.parentElement : null;
    const parentCS = parentEl ? window.getComputedStyle(parentEl) : null;
    const gtc = parentCS ? String(parentCS.gridTemplateColumns || '').trim() : '';
    const gridColCount = gtc && gtc !== 'none'
      ? (gtc.includes('repeat(2') ? 2 : gtc.split(/\s+/).length)
      : 1;
    const isTwoColGrid =
      Boolean(parentCS) &&
      (parentCS.display === 'grid' || parentCS.display === 'inline-grid') &&
      gridColCount === 2;
    const isFlexRowNoWrap =
      Boolean(parentCS) &&
      (parentCS.display === 'flex' || parentCS.display === 'inline-flex') &&
      parentCS.flexDirection.startsWith('row') &&
      parentCS.flexWrap === 'nowrap';

    const buildRowFromSpec = (spec) => {
      let rowEl;
      let sliderEl;
      let valEl;

      if (pitchBlock) {
        rowEl = pitchBlock.cloneNode(true);
        rowEl.classList.add('tts-sampling-row');
        rowEl.dataset.ttsSamplingRow = spec.key;

        valEl = rowEl.querySelector('#pitchVal');
        if (valEl) {
          valEl.id = spec.valId;
          valEl.dataset.ttsSamplingVal = '1';
          valEl.textContent = spec.format(spec.getVal());
        }

        sliderEl = rowEl.querySelector('#pitchSlider') || rowEl.querySelector('input[type="range"]');
        if (sliderEl) {
          sliderEl.id = spec.sliderId;
          sliderEl.min = spec.min;
          sliderEl.max = spec.max;
          sliderEl.step = spec.step;
          sliderEl.value = spec.format(spec.getVal());
          sliderEl.setAttribute('aria-label', spec.label);
        }

        updateClonedSliderLabel(rowEl, spec.label, spec.sliderId);
      } else {
        rowEl = document.createElement('div');
        rowEl.className = 'tts-sampling-row tts-sampling-fallback-row';
        rowEl.dataset.ttsSamplingRow = spec.key;

        const head = document.createElement('div');
        head.className = 'tts-sampling-fallback-head';
        const lbl = document.createElement('label');
        lbl.htmlFor = spec.sliderId;
        lbl.textContent = spec.label;
        valEl = document.createElement('span');
        valEl.id = spec.valId;
        valEl.className = 'tts-sampling-fallback-val';
        valEl.dataset.ttsSamplingVal = '1';
        valEl.textContent = spec.format(spec.getVal());
        head.appendChild(lbl);
        head.appendChild(valEl);

        sliderEl = document.createElement('input');
        sliderEl.type = 'range';
        sliderEl.id = spec.sliderId;
        if (pitchSlider.className) sliderEl.className = pitchSlider.className;
        sliderEl.min = spec.min;
        sliderEl.max = spec.max;
        sliderEl.step = spec.step;
        sliderEl.value = spec.format(spec.getVal());
        sliderEl.setAttribute('aria-label', spec.label);

        rowEl.appendChild(head);
        rowEl.appendChild(sliderEl);
      }

      if (sliderEl) {
        sliderEl.addEventListener('input', () => {
          if (state.micState !== 'idle' || !ttsModelSupportsSamplingParams(state.ttsId)) return;
          spec.setVal(parseFloat(sliderEl.value));
          syncAudioPanelUI();
        });
      }

      return { spec, rowEl, sliderEl, valEl };
    };

    const created = specs.map(buildRowFromSpec);
    ttsSamplingEntries = created;

    if (pitchBlock && isFlexRowNoWrap && parentEl) {
      const stack = document.createElement('div');
      stack.className = 'tts-sampling-stack';
      stack.id = 'ttsSamplingStack';
      created.forEach((entry, i) => {
        if (i === 2) entry.rowEl.classList.add('span-full');
        stack.appendChild(entry.rowEl);
      });
      parentEl.insertAdjacentElement('afterend', stack);
    } else if (pitchBlock) {
      let anchor = pitchBlock;
      created.forEach((entry, i) => {
        if (isTwoColGrid && i === 2) entry.rowEl.classList.add('span-full');
        anchor.insertAdjacentElement('afterend', entry.rowEl);
        anchor = entry.rowEl;
      });
    } else {
      let anchor = pitchSlider.parentElement || audioPanel;
      created.forEach((entry) => {
        if (anchor === audioPanel) {
          audioPanel.appendChild(entry.rowEl);
        } else {
          anchor.insertAdjacentElement('afterend', entry.rowEl);
          anchor = entry.rowEl;
        }
      });
    }

    ttsTempSlider = created[0].sliderEl;
    ttsTempVal = created[0].valEl;
    ttsTopPSlider = created[1].sliderEl;
    ttsTopPVal = created[1].valEl;
    ttsTopKSlider = created[2].sliderEl;
    ttsTopKVal = created[2].valEl;
  }

  function syncTtsSamplingSlidersDisabledState() {
    if (!ttsSamplingEntries || ttsSamplingEntries.length === 0) return;
    const supported = ttsModelSupportsSamplingParams(state.ttsId);
    const isLocked = state.micState !== 'idle';
    const disabled = !supported || isLocked;

    ttsSamplingEntries.forEach(({ rowEl, sliderEl }) => {
      if (rowEl) {
        rowEl.classList.toggle('is-disabled', !supported);
      }
      if (sliderEl) {
        sliderEl.disabled = disabled;
        if (disabled) sliderEl.setAttribute('aria-disabled', 'true');
        else sliderEl.removeAttribute('aria-disabled');
      }
    });
  }

  function syncAudioPanelUI() {
    ensureTtsSamplingSliders();

    const d = state.voiceDraft;
    const ttsObj = TTS_MODELS.find((t) => t.id === state.ttsId) || TTS_MODELS[0];
    const sttObj = STT_MODELS.find((s) => s.id === state.sttId) || STT_MODELS[0];
    const morphObj = MORPH_MODES.find((m) => m.id === state.morphId) || MORPH_MODES[0];

    ttsSelectLabel.textContent = ttsObj.name;
    voiceSelectLabel.textContent = resolveVoiceDisplayName(state.ttsId, d.voice);
    sttSelectLabel.textContent = sttObj.name;
    morphSelectLabel.textContent = morphObj.name;

    speedSlider.value = d.speed.toFixed(2);
    pitchSlider.value = d.pitch.toFixed(2);
    speedVal.textContent = `${d.speed.toFixed(2)}x`;
    pitchVal.textContent = `${d.pitch.toFixed(2)}x`;

    const tempNum = clampTtsTemperature(d.temperature);
    const topPNum = clampTtsTopP(d.topP);
    const topKNum = clampTtsTopK(d.topK);

    if (ttsTempSlider) ttsTempSlider.value = tempNum.toFixed(2);
    if (ttsTempVal) ttsTempVal.textContent = tempNum.toFixed(2);
    if (ttsTopPSlider) ttsTopPSlider.value = topPNum.toFixed(2);
    if (ttsTopPVal) ttsTopPVal.textContent = topPNum.toFixed(2);
    if (ttsTopKSlider) ttsTopKSlider.value = String(topKNum);
    if (ttsTopKVal) ttsTopKVal.textContent = String(topKNum);

    syncTtsSamplingSlidersDisabledState();

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
        state.voiceDraft = {
          voice: saved.voice,
          speed: saved.speed,
          pitch: saved.pitch,
          temperature: clampTtsTemperature(saved.temperature),
          topP: clampTtsTopP(saved.topP),
          topK: clampTtsTopK(saved.topK)
        };
      }
      syncAudioPanelUI();
      applyLiveSpeedToPlayingAudio();
      if (state.ttsPlayingMsgId && state.ttsCurrentChunk) {
        if (state.ttsPaused) state.ttsPitchChangedWhilePaused = true;
        else repatchPlayingChunkWithCurrentPitch();
      }
      persistSettings();
    });
  });

  speedSlider.addEventListener('input', () => {
    state.voiceDraft.speed = parseFloat(speedSlider.value);
    syncAudioPanelUI();
    applyLiveSpeedToPlayingAudio();
  });

  pitchSlider.addEventListener('input', () => {
    state.voiceDraft.pitch = parseFloat(pitchSlider.value);
    syncAudioPanelUI();
    if (state.ttsPlayingMsgId && state.ttsCurrentChunk) {
      if (state.ttsPaused) {
        state.ttsPitchChangedWhilePaused = true;
        return;
      }
      clearTimeout(state.ttsPitchRepatchTimer);
      state.ttsPitchRepatchTimer = setTimeout(() => {
        repatchPlayingChunkWithCurrentPitch();
      }, 140);
    }
  });

  pitchSlider.addEventListener('change', () => {
    clearTimeout(state.ttsPitchRepatchTimer);
    if (state.ttsPlayingMsgId && state.ttsCurrentChunk) {
      if (state.ttsPaused) {
        state.ttsPitchChangedWhilePaused = true;
        return;
      }
      repatchPlayingChunkWithCurrentPitch();
    }
  });

  let voiceSaveFlashTimer = null;
  saveVoicePresetBtn.addEventListener('click', () => {
    if (state.micState !== 'idle') return;
    const tempNum = clampTtsTemperature(state.voiceDraft.temperature);
    const topPNum = clampTtsTopP(state.voiceDraft.topP);
    const topKNum = clampTtsTopK(state.voiceDraft.topK);
    state.voiceDraft.temperature = tempNum;
    state.voiceDraft.topP = topPNum;
    state.voiceDraft.topK = topKNum;

    state.voicePresets[state.activeVoicePreset] = {
      voice: state.voiceDraft.voice,
      speed: state.voiceDraft.speed,
      pitch: state.voiceDraft.pitch,
      temperature: tempNum,
      topP: topPNum,
      topK: topKNum
    };
    persistSettings(true);
    saveVoicePresetBtn.textContent = 'Saved';
    saveVoicePresetBtn.classList.add('saved');
    clearTimeout(voiceSaveFlashTimer);
    voiceSaveFlashTimer = setTimeout(() => {
      saveVoicePresetBtn.textContent = 'Save';
      saveVoicePresetBtn.classList.remove('saved');
    }, 1200);
    const vName = resolveVoiceDisplayName(state.ttsId, state.voiceDraft.voice);
    const extra = ttsModelSupportsSamplingParams(state.ttsId)
      ? ` · T ${tempNum.toFixed(2)} / P ${topPNum.toFixed(2)} / K ${topKNum}`
      : '';
    showToast(`${state.activeVoicePreset}: ${vName} · ${state.voiceDraft.speed.toFixed(2)}x${extra}`);
  });

  /* =========================================================================
     4C. AI PERSONA PANEL LOGIC (+ DYNAMIC PER-PERSONA "TTS ТЕГИ" CHECKBOX)
     ========================================================================= */
  let personaTtsTagsToggleBtn = null;
  let personaTtsTagsHintEl = null;
  let personaTtsTagsBoxEl = null;

  function ensurePersonaTtsTagsCheckbox() {
    if (personaTtsTagsToggleBtn || !personaPanel) return;

    const btn = document.createElement('button');
    btn.type = 'button';
    btn.id = 'personaTtsTagsToggleBtn';
    btn.setAttribute('role', 'checkbox');
    btn.setAttribute('aria-checked', 'false');
    btn.style.cssText = [
      'width:100%',
      'height:38px',
      'padding:0 12px',
      'border-radius:11px',
      'background-color:var(--menu-dark)',
      'display:flex',
      'align-items:center',
      'justify-content:space-between',
      'gap:10px',
      'font-size:14px',
      'color:var(--menu-text)',
      'text-align:left',
      'transition:background-color 0.14s ease, color 0.14s ease'
    ].join(';');

    const left = document.createElement('span');
    left.style.cssText = 'display:inline-flex;align-items:center;gap:8px;min-width:0;';

    const title = document.createElement('span');
    title.textContent = 'TTS теги';
    title.style.cssText = 'color:var(--menu-active-text);font-weight:400;white-space:nowrap;';

    const hint = document.createElement('span');
    hint.textContent = 'Выкл';
    hint.style.cssText = 'font-size:12px;color:var(--text-meta);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;';

    left.appendChild(title);
    left.appendChild(hint);

    const box = document.createElement('span');
    box.style.cssText = [
      'width:18px',
      'height:18px',
      'flex-shrink:0',
      'border-radius:5px',
      'background-color:var(--bg-checkbox-off)',
      'display:inline-flex',
      'align-items:center',
      'justify-content:center',
      'transition:background-color 0.14s ease'
    ].join(';');
    box.innerHTML = '<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="var(--pill-light-text)" stroke-width="2.8" stroke-linecap="round" stroke-linejoin="round" style="opacity:0;transition:opacity 0.14s ease;"><polyline points="20 6 9 17 4 12"></polyline></svg>';

    btn.appendChild(left);
    btn.appendChild(box);
    personaPanel.appendChild(btn);

    btn.addEventListener('click', () => {
      if (state.micState !== 'idle') return;
      const nextVal = !Boolean(state.personaDraft.ttsTags);
      state.personaDraft.ttsTags = nextVal;
      if (state.personas[state.activePersonaIndex]) {
        state.personas[state.activePersonaIndex].ttsTags = nextVal;
      }
      syncPersonaUI();
      persistSettings(true);
      renderFeed();
    });

    personaTtsTagsToggleBtn = btn;
    personaTtsTagsHintEl = hint;
    personaTtsTagsBoxEl = box;
  }

  function syncPersonaClearBtn() {
    personaTextareaWrap.classList.toggle('has-text', personaInstructionsInput.value.length > 0);
  }

  function syncPersonaUI() {
    ensurePersonaTtsTagsCheckbox();
    const idx = state.activePersonaIndex;
    const activeSaved = state.personas[idx] || { name: '', instructions: '', ttsTags: false };

    document.querySelectorAll('#personaPresetGroup .panel-preset-btn').forEach((btn) => {
      const i = Number(btn.dataset.personaPreset);
      const p = state.personas[i] || { name: '', instructions: '', ttsTags: false };
      btn.textContent = p.name.trim() ? p.name.trim() : `Persona ${i + 1}`;
      btn.classList.toggle('active', i === idx);
    });

    const dockLabel = activeSaved.name.trim() ? activeSaved.name.trim() : 'AI Persona';
    if (personaDockBtn) {
      personaDockBtn.setAttribute('aria-label', dockLabel);
      personaDockBtn.title = dockLabel;
    }
    if (personaDockLabel) {
      personaDockLabel.textContent = dockLabel;
      personaDockLabel.dataset.label = dockLabel;
    }

    personaNameInput.value = state.personaDraft.name;
    personaInstructionsInput.value = state.personaDraft.instructions;
    syncPersonaClearBtn();

    if (personaTtsTagsToggleBtn && personaTtsTagsHintEl && personaTtsTagsBoxEl) {
      const on = Boolean(state.personaDraft.ttsTags);
      personaTtsTagsToggleBtn.setAttribute('aria-checked', String(on));
      personaTtsTagsHintEl.textContent = on ? 'Скрыты · Grok <> / Gemini []' : 'Выкл';
      personaTtsTagsHintEl.style.color = on ? 'var(--text-level)' : 'var(--text-meta)';
      personaTtsTagsBoxEl.style.backgroundColor = on ? 'var(--pill-light-bg)' : 'var(--bg-checkbox-off)';
      const svg = personaTtsTagsBoxEl.querySelector('svg');
      if (svg) svg.style.opacity = on ? '1' : '0';
    }
  }

  document.querySelectorAll('#personaPresetGroup .panel-preset-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      if (state.micState !== 'idle') return;
      const idx = Number(btn.dataset.personaPreset);
      state.activePersonaIndex = idx;
      const p = state.personas[idx] || { name: '', instructions: '', ttsTags: false };
      state.personaDraft = { name: p.name, instructions: p.instructions, ttsTags: Boolean(p.ttsTags) };
      syncPersonaUI();
      persistSettings();
      renderFeed();
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
      instructions: state.personaDraft.instructions,
      ttsTags: Boolean(state.personaDraft.ttsTags)
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
    closePopover();
    setBottomPanel(null);
    attachFileInput.value = '';
    attachFileInput.click();
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

    if (state.micState === 'recording') {
      sendBtn.disabled = false;
      sendBtn.removeAttribute('aria-disabled');
      sendBtn.classList.add('ready');
      sendBtn.setAttribute('aria-label', 'Остановить запись и отправить');
      sendIconSvg.innerHTML = '<line x1="12" y1="19" x2="12" y2="5"></line><polyline points="6 11 12 5 18 11"></polyline>';
      return;
    }

    const hasPayload =
      state.micState === 'idle' &&
      (chatInput.value.trim().length > 0 || (state.pendingAttachments && state.pendingAttachments.length > 0));
    sendBtn.classList.toggle('ready', hasPayload);
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

  chatInput.addEventListener('paste', (e) => {
    if (state.micState !== 'idle') return;
    const cd = e.clipboardData;
    if (cd && cd.items && cd.items.length > 0) {
      const pastedFiles = [];
      for (let i = 0; i < cd.items.length; i++) {
        const it = cd.items[i];
        if (it && it.kind === 'file') {
          const f = it.getAsFile();
          if (f) pastedFiles.push(f);
        }
      }
      if (pastedFiles.length > 0) {
        processSelectedFiles(pastedFiles);
      }
    }
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

  /* =========================================================================
     REAL STT ENGINE: MediaRecorder -> /api/v1/audio/transcriptions
     + LEAK-PROOF STREAM REGISTRY, RE-ENTRANCY LOCK & iOS AUDIO SESSION RESET
     ========================================================================= */
  const activeMicStreams = new Set();

  function hardStopSingleStream(stream) {
    if (!stream) return;
    try {
      const tracks = typeof stream.getTracks === 'function' ? stream.getTracks().slice() : [];
      tracks.forEach((track) => {
        try { track.onended = null; } catch (_) {}
        try { track.enabled = false; } catch (_) {}
        try { track.stop(); } catch (_) {}
        try {
          if (typeof stream.removeTrack === 'function') {
            stream.removeTrack(track);
          }
        } catch (_) {}
      });
    } catch (_) {}
  }

  function releaseMicStreamAndRestoreAudio(restorePlaybackSession = true) {
    clearTimeout(state.audioSessionRestoreTimer);
    state.audioSessionRestoreTimer = null;

    if (state.mediaRecorder) {
      const rec = state.mediaRecorder;
      state.mediaRecorder = null;
      try { rec.ondataavailable = null; } catch (_) {}
      try { rec.onstop = null; } catch (_) {}
      try { rec.onerror = null; } catch (_) {}
      try {
        if (rec.state && rec.state !== 'inactive') {
          rec.stop();
        }
      } catch (_) {}
    }

    if (state.mediaStream) {
      activeMicStreams.add(state.mediaStream);
      state.mediaStream = null;
    }

    activeMicStreams.forEach((s) => hardStopSingleStream(s));
    activeMicStreams.clear();

    // Close WebAudio decode context so CoreAudio never keeps VoiceProcessingIO / PlayAndRecord alive
    closeDecodeAudioContext();

    if (restorePlaybackSession) {
      // Two-step iOS WebKit audioSession reset:
      // 1) 'auto' immediately releases the hardware mic indicator (orange pill/dot)
      // 2) delayed 'playback' re-routes output cleanly to the main bottom loudspeaker
      setAudioSessionType('auto');
      state.audioSessionRestoreTimer = setTimeout(() => {
        state.audioSessionRestoreTimer = null;
        if (state.micState === 'idle' && !state.micStarting && activeMicStreams.size === 0) {
          setAudioSessionType('playback');
        }
      }, 220);
    }
  }

  function abortMicOnBackground() {
    if (state.micStarting) {
      state.micCancelPending = true;
    }
    if (state.micState === 'recording') {
      clearInterval(state.recInterval);
      state.recInterval = null;
      state.recordedChunks = [];
      releaseMicStreamAndRestoreAudio(true);
      applyAppMicLock('idle');
      updateComposerLayout();
      syncSendButton();
      updateScrollBottomBtn();
    } else if (activeMicStreams.size > 0 || state.mediaStream) {
      releaseMicStreamAndRestoreAudio(true);
    }
  }

  function pickSupportedRecorderMimeType() {
    if (typeof MediaRecorder === 'undefined' || typeof MediaRecorder.isTypeSupported !== 'function') {
      return '';
    }
    const candidates = [
      'audio/mp4',
      'audio/webm;codecs=opus',
      'audio/webm',
      'audio/ogg;codecs=opus',
      'audio/aac'
    ];
    for (let i = 0; i < candidates.length; i++) {
      try {
        if (MediaRecorder.isTypeSupported(candidates[i])) return candidates[i];
      } catch (_) {}
    }
    return '';
  }

  function getFileExtForAudioMime(mime) {
    const m = String(mime || '').toLowerCase();
    if (m.includes('mp4') || m.includes('m4a') || m.includes('aac')) return '.m4a';
    if (m.includes('webm')) return '.webm';
    if (m.includes('ogg')) return '.ogg';
    if (m.includes('wav')) return '.wav';
    return '.m4a';
  }

  function buildSttEndpoint() {
    if (state.provider === 'direct') {
      const base = (state.apiKeys.customUrl || '').trim().replace(/\/+$/, '');
      if (!base) {
        return { error: 'Не указан Custom Endpoint URL в меню «API ключи».' };
      }
      const url = /\/audio\/transcriptions$/i.test(base) ? base : `${base}/audio/transcriptions`;
      return { url, apiKey: (state.apiKeys.openrouter || '').trim(), isOpenRouter: false };
    }

    const key = (state.apiKeys.openrouter || '').trim();
    if (!key) {
      return { error: 'Не задан OpenRouter Key. Откройте меню слева → «API ключи».' };
    }
    return {
      url: `${OPENROUTER_API_BASE}/audio/transcriptions`,
      apiKey: key,
      isOpenRouter: true
    };
  }

  async function startMicRecording() {
    // Re-entrancy guard: prevents double-tap from opening a second leaked getUserMedia stream
    if (state.micStarting || state.micState !== 'idle') return;

    closePopover();
    closeContextMenu();
    setBottomPanel(null);
    closeDrawer();
    stopActivePlayback();
    if (document.activeElement && document.activeElement.blur) {
      document.activeElement.blur();
    }

    const endpoint = buildSttEndpoint();
    if (endpoint.error) {
      showToast(endpoint.error);
      return;
    }

    if (!navigator.mediaDevices || typeof navigator.mediaDevices.getUserMedia !== 'function') {
      showToast('Микрофон недоступен в этом браузере');
      return;
    }
    if (typeof MediaRecorder === 'undefined') {
      showToast('MediaRecorder не поддерживается');
      return;
    }

    state.micStarting = true;
    state.micCancelPending = false;
    micBtn.disabled = true;

    // Clean any leftover stream & close WebAudio context before requesting hardware mic
    releaseMicStreamAndRestoreAudio(false);
    // Keep audioSession in 'auto' so iOS ties mic hardware lifetime strictly to MediaStreamTrack
    setAudioSessionType('auto');

    let stream = null;
    try {
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          audio: {
            echoCancellation: true,
            noiseSuppression: true,
            autoGainControl: true
          }
        });
      } catch (_) {
        stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      }
    } catch (err) {
      state.micStarting = false;
      micBtn.disabled = false;
      releaseMicStreamAndRestoreAudio(true);
      const name = err && err.name ? err.name : '';
      if (name === 'NotAllowedError' || name === 'PermissionDeniedError') {
        showToast('Нет доступа к микрофону в настройках Safari');
      } else {
        showToast('Не удалось включить микрофон');
      }
      return;
    }

    // Immediately register every acquired MediaStream so it can never be orphaned
    activeMicStreams.add(stream);

    if (state.micCancelPending || document.visibilityState === 'hidden') {
      state.micStarting = false;
      state.micCancelPending = false;
      micBtn.disabled = false;
      releaseMicStreamAndRestoreAudio(true);
      return;
    }

    const mimeType = pickSupportedRecorderMimeType();
    let recorder;
    try {
      recorder = mimeType ? new MediaRecorder(stream, { mimeType }) : new MediaRecorder(stream);
    } catch (_) {
      try {
        recorder = new MediaRecorder(stream);
      } catch (err2) {
        state.micStarting = false;
        micBtn.disabled = false;
        releaseMicStreamAndRestoreAudio(true);
        showToast('Ошибка инициализации записи');
        return;
      }
    }

    state.mediaStream = stream;
    state.mediaRecorder = recorder;
    state.recordedChunks = [];
    state.recordedMimeType = recorder.mimeType || mimeType || 'audio/mp4';

    recorder.ondataavailable = (e) => {
      if (e.data && e.data.size > 0) {
        state.recordedChunks.push(e.data);
      }
    };

    // If iOS forcibly interrupts the mic (incoming call / Siri), clean up immediately
    stream.getAudioTracks().forEach((track) => {
      track.onended = () => {
        if (state.micState === 'recording' && state.mediaStream === stream) {
          stopMicAndTranscribe();
        }
      };
    });

    state.micStarting = false;
    state.recSeconds = 0;
    state.recStartedAt = Date.now();
    micStatusTimer.textContent = '0:00';
    applyAppMicLock('recording');

    clearInterval(state.recInterval);
    state.recInterval = setInterval(() => {
      state.recSeconds += 1;
      micStatusTimer.textContent = formatMMSS(state.recSeconds);
    }, 1000);

    try {
      recorder.start(250);
    } catch (_) {
      clearInterval(state.recInterval);
      state.recInterval = null;
      releaseMicStreamAndRestoreAudio(true);
      applyAppMicLock('idle');
      showToast('Не удалось начать запись');
    }
  }

  async function stopMicAndTranscribe(autoSend = false) {
    if (state.micState !== 'recording') return;

    clearInterval(state.recInterval);
    state.recInterval = null;

    const shouldAutoSend = Boolean(autoSend);
    state.autoSendAfterTranscribe = shouldAutoSend;

    const recorder = state.mediaRecorder;
    const elapsedSec = Math.max(1, Math.round((Date.now() - (state.recStartedAt || Date.now())) / 1000));

    applyAppMicLock('transcribing');

    let readyForAutoSend = false;

    try {
      if (recorder && recorder.state !== 'inactive') {
        await new Promise((resolve) => {
          let done = false;
          let timerId = null;
          const finish = () => {
            if (done) return;
            done = true;
            if (timerId) clearTimeout(timerId);
            resolve();
          };
          recorder.onstop = finish;
          recorder.onerror = finish;
          try {
            recorder.stop();
          } catch (_) {
            finish();
          }
          timerId = setTimeout(finish, 1200);
        });
      }

      // Immediately release all hardware mic tracks, clear registry & reset iOS audioSession
      releaseMicStreamAndRestoreAudio(true);

      const mimeType = state.recordedMimeType || (state.recordedChunks[0] && state.recordedChunks[0].type) || 'audio/mp4';
      const audioBlob = new Blob(state.recordedChunks, { type: mimeType });
      state.recordedChunks = [];

      if (!audioBlob || audioBlob.size < 256) {
        showToast('Запись слишком короткая');
        return;
      }

      const endpoint = buildSttEndpoint();
      if (endpoint.error) {
        showToast(endpoint.error);
        return;
      }

      const sttId = state.sttId;
      const sttMeta = STT_MODELS.find((s) => s.id === sttId) || STT_MODELS[0];
      const ext = getFileExtForAudioMime(mimeType);
      const fd = new FormData();
      fd.append('file', audioBlob, `voice${ext}`);
      fd.append('model', sttId);

      const headers = {};
      if (endpoint.apiKey) headers.Authorization = `Bearer ${endpoint.apiKey}`;
      if (endpoint.isOpenRouter) {
        headers['HTTP-Referer'] = window.location.origin || 'https://localhost';
        headers['X-Title'] = 'OpenRouter PWA';
      }

      const resp = await fetch(endpoint.url, {
        method: 'POST',
        headers,
        body: fd
      });

      captureRateLimitHeaders(resp.headers, sttId);

      if (!resp.ok) {
        const detail = await parseResponseErrorText(resp);
        throw new Error(`STT ошибка (${resp.status}): ${detail || 'сбой распознавания'}`);
      }

      const ct = (resp.headers.get('content-type') || '').toLowerCase();
      let transcript = '';
      if (ct.includes('application/json')) {
        const json = await resp.json();
        transcript = String((json && (json.text || (json.data && json.data.text))) || '').trim();
      } else if (ct.startsWith('text/plain') || !ct) {
        const rawTxt = String(await resp.text()).trim();
        if (!/^<(?:!doctype|html|head|body)\b/i.test(rawTxt)) {
          transcript = rawTxt;
        }
      } else {
        throw new Error(`STT вернул нетекстовый ответ (${ct.split(';')[0]})`);
      }
      transcript = sanitizeTextForLlmHistory(transcript);

      const estCost = sttMeta && sttMeta.usdPerMin
        ? (elapsedSec / 60) * sttMeta.usdPerMin
        : 0;
      recordUsageEntry({
        type: 'stt',
        modelId: sttId,
        modelLabel: sttMeta ? sttMeta.name : sttId,
        seconds: elapsedSec,
        cost: estCost,
        isFree: false
      });
      scheduleBalanceRefreshAfterRequest();

      if (!transcript) {
        showToast('Речь не распознана');
        return;
      }

      // Insert into input field; auto-send immediately if user tapped Send while recording
      const existing = chatInput.value.trim();
      chatInput.value = existing ? `${existing} ${transcript}` : transcript;
      if (shouldAutoSend) {
        readyForAutoSend = true;
      }
    } catch (err) {
      releaseMicStreamAndRestoreAudio(true);
      showToast(err && err.message ? err.message : 'Ошибка транскрибации');
    } finally {
      state.autoSendAfterTranscribe = false;
      releaseMicStreamAndRestoreAudio(true);
      applyAppMicLock('idle');
      updateComposerLayout();
      syncSendButton();
      updateScrollBottomBtn();
    }

    if (readyForAutoSend && state.micState === 'idle') {
      handleSendOrStop();
    }
  }

  micBtn.addEventListener('click', () => {
    if (state.micStarting || state.micState === 'transcribing') return;
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

  function sanitizeTextForLlmHistory(raw) {
    if (typeof raw !== 'string') return '';
    let s = raw;

    // 1. Strip any embedded data: URI with base64 payload (audio/wav, audio/mp3, image/*, application/*, etc.)
    s = s.replace(/data:[a-z0-9.+-]+\/[a-z0-9.+-]+(?:;[^,\s]*)?;base64,[A-Za-z0-9+/=_\-\r\n]+/gi, '');

    // 2. Strip standalone raw Base64 blobs (>= 512 chars) outside normal URLs
    s = s.replace(/\S{512,}/g, (token) => {
      if (/^https?:\/\//i.test(token)) return token;
      const compact = token.replace(/[\r\n]/g, '');
      if (compact.length >= 512 && /^[A-Za-z0-9+/=_-]+$/.test(compact)) {
        return '';
      }
      return token;
    });

    // 3. Strip null/control binary characters & replacement-char garbage runs
    s = s.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]+/g, '');
    s = s.replace(/\uFFFD{3,}/g, '');

    return s.trim();
  }

  function extractStrictPlainText(val) {
    if (typeof val === 'string') return sanitizeTextForLlmHistory(val);
    if (Array.isArray(val)) {
      return sanitizeTextForLlmHistory(
        val
          .filter((p) => p && p.type === 'text' && typeof p.text === 'string')
          .map((p) => p.text)
          .join('\n')
      );
    }
    return '';
  }

  function toCachedMultipartContent(text) {
    return [
      {
        type: 'text',
        text: sanitizeTextForLlmHistory(String(text)),
        cache_control: { type: 'ephemeral' }
      }
    ];
  }

  function countRequestMessagesChars(messages) {
    if (!Array.isArray(messages)) return 0;
    let total = 0;
    for (let i = 0; i < messages.length; i++) {
      const c = messages[i] && messages[i].content;
      if (typeof c === 'string') {
        total += c.length;
      } else if (Array.isArray(c)) {
        for (let j = 0; j < c.length; j++) {
          if (c[j] && c[j].type === 'text' && typeof c[j].text === 'string') {
            total += c[j].text.length;
          }
        }
      }
    }
    return total;
  }

  function buildChatRequestMessages(chat, excludeMsgId, enablePromptCaching = false) {
    const out = [];
    const activePersona = state.personas[state.activePersonaIndex];
    const sysInstructions = activePersona && typeof activePersona.instructions === 'string'
      ? sanitizeTextForLlmHistory(activePersona.instructions)
      : '';

    if (sysInstructions) {
      out.push({ role: 'system', content: sysInstructions });
    }

    // Strict allowlist: pure text + explicit user-uploaded attachments (image/pdf/text); zero STT/TTS audio blobs
    (chat.messages || []).forEach((m) => {
      if (!m || m.id === excludeMsgId || m.isError) return;
      if (m.role === 'user') {
        const txt = extractStrictPlainText(m.text);
        const atts = Array.isArray(m.attachments) ? m.attachments : [];
        if (atts.length === 0) {
          if (txt) out.push({ role: 'user', content: txt });
          return;
        }

        const parts = [];
        atts.forEach((att) => {
          if (!att) return;
          if (att.kind === 'text' && typeof att.textContent === 'string' && att.textContent.trim()) {
            const safeName = String(att.name || 'file.txt').replace(/[\r\n]/g, ' ');
            parts.push({
              type: 'text',
              text: `[Прикреплённый файл: ${safeName}]\n${att.textContent}`
            });
          }
        });
        if (txt) {
          parts.push({ type: 'text', text: txt });
        }
        atts.forEach((att) => {
          if (!att) return;
          if (att.kind === 'image' && typeof att.dataUrl === 'string' && /^data:image\//i.test(att.dataUrl)) {
            parts.push({
              type: 'image_url',
              image_url: { url: att.dataUrl }
            });
          } else if (att.kind === 'pdf' && typeof att.dataUrl === 'string' && /^data:application\/pdf/i.test(att.dataUrl)) {
            parts.push({
              type: 'file',
              file: {
                filename: String(att.name || 'document.pdf'),
                file_data: att.dataUrl
              }
            });
          }
        });

        if (parts.length > 0) {
          // If only text parts exist, collapse to a single string when possible
          const allText = parts.every((p) => p.type === 'text');
          if (allText) {
            out.push({ role: 'user', content: parts.map((p) => p.text).join('\n\n') });
          } else {
            out.push({ role: 'user', content: parts });
          }
        }
      } else if (m.role === 'assistant') {
        const txt = extractStrictPlainText(m.plainText);
        if (txt) out.push({ role: 'assistant', content: txt });
      }
    });

    // OpenRouter Prompt Caching (Anthropic / Google Gemini explicit breakpoints):
    // Breakpoint 1: static system prompt (keeps persona cached across turns & edits)
    // Breakpoint 2: rolling last historical message right before the new user turn
    if (enablePromptCaching && out.length > 0) {
      if (out[0].role === 'system' && typeof out[0].content === 'string' && out[0].content.length >= 256) {
        out[0] = {
          role: 'system',
          content: toCachedMultipartContent(out[0].content)
        };
      }

      // Place rolling cache breakpoint on the message immediately preceding the latest user turn
      const lastIdx = out.length - 1;
      const historyIdx = lastIdx >= 1 && out[lastIdx].role === 'user' ? lastIdx - 1 : -1;
      if (historyIdx >= 0 && out[historyIdx].role !== 'system') {
        if (typeof out[historyIdx].content === 'string') {
          out[historyIdx] = {
            role: out[historyIdx].role,
            content: toCachedMultipartContent(out[historyIdx].content)
          };
        } else if (Array.isArray(out[historyIdx].content) && out[historyIdx].content.length > 0) {
          const clonedParts = out[historyIdx].content.map((p) => Object.assign({}, p));
          let targetPartIdx = -1;
          for (let k = clonedParts.length - 1; k >= 0; k--) {
            if (clonedParts[k].type === 'text') {
              targetPartIdx = k;
              break;
            }
          }
          if (targetPartIdx === -1) targetPartIdx = clonedParts.length - 1;
          clonedParts[targetPartIdx].cache_control = { type: 'ephemeral' };
          out[historyIdx] = {
            role: out[historyIdx].role,
            content: clonedParts
          };
        }
      }
    }

    return out;
  }

  function mergeStreamUsage(prev, next) {
    if (!next || typeof next !== 'object') return prev;
    if (!prev) return Object.assign({}, next);
    const merged = Object.assign({}, prev, next);
    if (prev.prompt_tokens_details || next.prompt_tokens_details) {
      merged.prompt_tokens_details = Object.assign(
        {},
        prev.prompt_tokens_details || {},
        next.prompt_tokens_details || {}
      );
    }
    if (prev.input_tokens_details || next.input_tokens_details) {
      merged.input_tokens_details = Object.assign(
        {},
        prev.input_tokens_details || {},
        next.input_tokens_details || {}
      );
    }
    if (prev.completion_tokens_details || next.completion_tokens_details) {
      merged.completion_tokens_details = Object.assign(
        {},
        prev.completion_tokens_details || {},
        next.completion_tokens_details || {}
      );
    }
    return merged;
  }

  function extractCachedTokensFromUsage(usage) {
    if (!usage || typeof usage !== 'object') {
      return { cachedTokens: 0, cacheWriteTokens: 0, reasoningTokens: 0 };
    }
    const details = usage.prompt_tokens_details || usage.input_tokens_details || {};
    const compDetails = usage.completion_tokens_details || usage.output_tokens_details || {};
    const rawCached =
      details.cached_tokens !== undefined ? details.cached_tokens :
      (usage.cache_read_input_tokens !== undefined ? usage.cache_read_input_tokens : usage.cached_tokens);
    const rawWrite =
      details.cache_write_tokens !== undefined ? details.cache_write_tokens :
      usage.cache_creation_input_tokens;
    const rawReasoning =
      compDetails.reasoning_tokens !== undefined ? compDetails.reasoning_tokens :
      usage.reasoning_tokens;

    return {
      cachedTokens: Math.max(0, Number(rawCached) || 0),
      cacheWriteTokens: Math.max(0, Number(rawWrite) || 0),
      reasoningTokens: Math.max(0, Number(rawReasoning) || 0)
    };
  }

  function isCacheControlRejectionError(status, detail) {
    if (status !== 400 && status !== 422) return false;
    const lower = String(detail || '').toLowerCase();
    return (
      lower.includes('cache_control') ||
      lower.includes('cache control') ||
      lower.includes('ephemeral') ||
      (lower.includes('content') && lower.includes('must be a string'))
    );
  }

  function learnFromReasoningApiError(modelObj, sentThinking, rawDetail) {
    if (!modelObj || !modelObj.id || !rawDetail) return null;
    const lower = String(rawDetail).toLowerCase();

    const isMandatoryErr =
      (lower.includes('reasoning') && (lower.includes('mandatory') || lower.includes('cannot be disabled') || lower.includes('required'))) ||
      (lower.includes('thinking') && (lower.includes('mandatory') || lower.includes('cannot be disabled')));

    if (isMandatoryErr) {
      const curLevels = Array.isArray(modelObj.thinkingLevels) ? modelObj.thinkingLevels.slice() : ['minimal', 'low', 'medium', 'high'];
      let nextLevels = curLevels.filter((l) => l !== 'none');
      if (sentThinking === 'minimal') {
        nextLevels = nextLevels.filter((l) => l !== 'minimal');
      }
      if (nextLevels.length === 0) nextLevels = ['low', 'medium', 'high'];
      saveModelCapsOverride(modelObj.id, { supportsReasoning: true, thinkingLevels: nextLevels });
      const newObj = ALL_THINKING_LEVELS.find((t) => t.id === state.thinking) || { label: state.thinking };
      return `Для модели ${modelObj.label} Thinking обязателен — недоступная опция скрыта из списка, уровень переключён на ${newObj.label}. Повторите запрос.\n(${rawDetail})`;
    }

    const isUnsupportedReasoningErr =
      (lower.includes('reasoning') && (lower.includes('not supported') || lower.includes('does not support') || lower.includes('unsupported'))) &&
      !lower.includes('effort');

    if (isUnsupportedReasoningErr) {
      saveModelCapsOverride(modelObj.id, { supportsReasoning: false, thinkingLevels: ['none'] });
      return `Модель ${modelObj.label} не поддерживает Thinking — опция отключена автоматически. Повторите запрос.\n(${rawDetail})`;
    }

    const isEffortErr =
      (lower.includes('reasoning') || lower.includes('effort') || lower.includes('thinking')) &&
      (lower.includes('invalid') || lower.includes('unsupported') || lower.includes('not supported') || lower.includes('must be') || lower.includes('allowed') || lower.includes('expected'));

    if (isEffortErr && sentThinking) {
      // Try extracting explicit allowed effort names if error lists them
      let nextLevels = [];
      const enumTailMatch = lower.match(/(?:expected|one of|allowed|supported|valid)[^.\n]*/);
      if (enumTailMatch) {
        const segment = enumTailMatch[0];
        nextLevels = VALID_EFFORT_ORDER.filter((lvl) => new RegExp(`\\b${lvl}\\b`).test(segment));
      }
      if (nextLevels.length === 0) {
        const curLevels = Array.isArray(modelObj.thinkingLevels) ? modelObj.thinkingLevels.slice() : ['low', 'medium', 'high'];
        nextLevels = curLevels.filter((l) => l !== sentThinking);
      }
      if (nextLevels.length === 0) nextLevels = ['low', 'medium', 'high'];
      saveModelCapsOverride(modelObj.id, { supportsReasoning: true, thinkingLevels: nextLevels });
      const newObj = ALL_THINKING_LEVELS.find((t) => t.id === state.thinking) || { label: state.thinking };
      return `Уровень Thinking «${sentThinking}» недоступен для модели ${modelObj.label} — опция скрыта, переключено на ${newObj.label}. Повторите запрос.\n(${rawDetail})`;
    }

    return null;
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

  function startInlineUserEdit(msgId) {
    if (state.micState !== 'idle') return;
    const chat = getActiveChat();
    if (!chat) return;
    const msg = chat.messages.find((m) => m.id === msgId && m.role === 'user');
    if (!msg) return;
    closePopover();
    setBottomPanel(null);
    msg.collapsed = false;
    state.editingMsgId = msg.id;
    state.editingMsgDraft = msg.text || '';
    renderFeed();
  }

  function cancelInlineUserEdit() {
    if (!state.editingMsgId) return;
    state.editingMsgId = null;
    state.editingMsgDraft = '';
    renderFeed();
  }

  async function submitInlineUserEdit(msgId) {
    if (state.micState !== 'idle') return;
    const chat = getActiveChat();
    if (!chat) return;
    const idx = chat.messages.findIndex((m) => m.id === msgId && m.role === 'user');
    if (idx === -1) {
      cancelInlineUserEdit();
      return;
    }

    const newText = String(state.editingMsgDraft || '').trim();
    if (!newText) {
      showToast('Сообщение не может быть пустым');
      return;
    }

    if (state.autoTts) {
      unlockAudioSyncInUserGesture(true);
    }

    closePopover();
    setBottomPanel(null);
    stopActivePlayback();
    abortGeneration(false, true);

    const now = new Date();
    const targetMsg = chat.messages[idx];
    targetMsg.text = newText;
    targetMsg.timestamp = formatCompactTimestamp(now);
    targetMsg.collapsed = false;

    if (idx === 0) {
      chat.title = newText.slice(0, 32) + (newText.length > 32 ? '…' : '');
    }
    chat.date = `Сегодня · ${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
    chat.messages = chat.messages.slice(0, idx + 1);

    state.editingMsgId = null;
    state.editingMsgDraft = '';
    persistChat(chat);

    await runAssistantCompletion(chat);
  }

  async function retryFromUserMessage(msgId) {
    if (state.micState !== 'idle') return;
    const chat = getActiveChat();
    if (!chat) return;
    const idx = chat.messages.findIndex((m) => m.id === msgId && m.role === 'user');
    if (idx === -1) return;

    if (state.autoTts) {
      unlockAudioSyncInUserGesture(true);
    }

    closePopover();
    setBottomPanel(null);
    state.editingMsgId = null;
    state.editingMsgDraft = '';
    stopActivePlayback();
    abortGeneration(false, true);

    const now = new Date();
    chat.date = `Сегодня · ${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
    chat.messages = chat.messages.slice(0, idx + 1);
    persistChat(chat);

    await runAssistantCompletion(chat);
  }

  async function retryAssistantMessage(msgId) {
    if (state.micState !== 'idle') return;
    const chat = getActiveChat();
    if (!chat) return;
    const idx = chat.messages.findIndex((m) => m.id === msgId && m.role === 'assistant');
    if (idx === -1) return;

    const hasUserBefore = chat.messages.slice(0, idx).some(
      (m) => m && m.role === 'user' && ((m.text || '').trim() || (Array.isArray(m.attachments) && m.attachments.length > 0))
    );
    if (!hasUserBefore) {
      showToast('Нет исходного сообщения пользователя');
      return;
    }

    if (state.autoTts) {
      unlockAudioSyncInUserGesture(true);
    }

    closePopover();
    setBottomPanel(null);
    state.editingMsgId = null;
    state.editingMsgDraft = '';
    stopActivePlayback();
    abortGeneration(false, true);

    const now = new Date();
    chat.date = `Сегодня · ${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
    chat.messages = chat.messages.slice(0, idx);
    persistChat(chat);

    await runAssistantCompletion(chat);
  }

  async function handleSendOrStop() {
    // Tapping Send during audio recording stops recording, runs STT, and immediately sends the result
    if (state.micState === 'recording') {
      stopMicAndTranscribe(true);
      return;
    }
    if (state.micState !== 'idle') return;
    if (state.generatingMsgId) {
      abortGeneration(true, true);
      return;
    }

    const text = chatInput.value.trim();
    const attachments = state.pendingAttachments.slice();
    if (!text && attachments.length === 0) return;

    // Unlock iOS Safari single <audio> synchronously inside Send tap when Auto TTS is enabled
    if (state.autoTts) {
      unlockAudioSyncInUserGesture(true);
    }

    setBottomPanel(null);
    closePopover();
    state.editingMsgId = null;
    state.editingMsgDraft = '';

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
      if (text) {
        chat.title = text.slice(0, 32) + (text.length > 32 ? '…' : '');
      } else if (attachments.length > 0) {
        const firstAtt = attachments[0];
        const fallbackTitle = firstAtt.kind === 'image' ? `Фото: ${firstAtt.name}` : `Файл: ${firstAtt.name}`;
        chat.title = fallbackTitle.slice(0, 32) + (fallbackTitle.length > 32 ? '…' : '');
      }
    }
    chat.date = `Сегодня · ${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;

    chat.messages.push({
      id: 'u-' + Date.now(),
      role: 'user',
      timestamp: formatCompactTimestamp(now),
      collapsed: false,
      text,
      attachments: attachments.length > 0 ? attachments : undefined
    });
    persistChat(chat);

    chatInput.value = '';
    state.pendingAttachments = [];
    renderAttachTray();
    updateComposerLayout();

    await runAssistantCompletion(chat);
  }

  async function runAssistantCompletion(chat) {
    if (!chat) return;
    const curModel = getCurrentModelObj();
    const capturedModelId = curModel ? curModel.id : state.modelId;
    const capturedModelLabel = curModel ? curModel.label : state.modelLabel;
    const availableLevels = getAvailableThinkingLevels(curModel);
    const capturedThinking = state.thinking;
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
      html: '',
      images: [],
      citations: []
    };

    const appendUniqueAiImage = (url, alt = '') => {
      const cleanUrl = String(url || '').trim();
      if (!cleanUrl || !isSafeRenderImageUrl(cleanUrl)) return false;
      if (aiMsg.images.some((im) => im.url === cleanUrl)) return false;
      aiMsg.images.push({ url: cleanUrl, alt: String(alt || 'Изображение') });
      return true;
    };

    const appendUniqueCitation = (url, title = '') => {
      const cleanUrl = String(url || '').trim();
      if (!/^https?:\/\//i.test(cleanUrl)) return;
      if (aiMsg.citations.some((c) => c.url === cleanUrl)) return;
      aiMsg.citations.push({ url: cleanUrl, title: String(title || '').trim() });
    };

    const collectMultimodalFromObj = (obj) => {
      let textOut = '';
      let addedImg = false;
      if (!obj || typeof obj !== 'object') return { textOut, addedImg };

      if (typeof obj.content === 'string') {
        textOut += obj.content;
      } else if (Array.isArray(obj.content)) {
        obj.content.forEach((part) => {
          if (!part) return;
          if (typeof part === 'string') {
            textOut += part;
          } else if (part.type === 'text' && typeof part.text === 'string') {
            textOut += part.text;
          } else if (part.type === 'image_url' && part.image_url && part.image_url.url) {
            if (appendUniqueAiImage(part.image_url.url, part.alt || '')) addedImg = true;
          } else if (part.type === 'image' && (part.url || part.data)) {
            const u = part.url || `data:${part.mime_type || 'image/png'};base64,${part.data}`;
            if (appendUniqueAiImage(u, part.alt || '')) addedImg = true;
          }
        });
      }

      if (Array.isArray(obj.images)) {
        obj.images.forEach((item) => {
          if (!item) return;
          if (typeof item === 'string') {
            if (appendUniqueAiImage(item, '')) addedImg = true;
          } else if (item.image_url && item.image_url.url) {
            if (appendUniqueAiImage(item.image_url.url, item.alt || '')) addedImg = true;
          } else if (item.url) {
            if (appendUniqueAiImage(item.url, item.alt || '')) addedImg = true;
          } else if (item.b64_json) {
            const mime = item.mime_type || 'image/png';
            if (appendUniqueAiImage(`data:${mime};base64,${item.b64_json}`, item.alt || '')) addedImg = true;
          }
        });
      }

      if (Array.isArray(obj.annotations)) {
        obj.annotations.forEach((ann) => {
          if (!ann) return;
          if (ann.type === 'url_citation' && ann.url_citation && ann.url_citation.url) {
            appendUniqueCitation(ann.url_citation.url, ann.url_citation.title || '');
          } else if (ann.url) {
            appendUniqueCitation(ann.url, ann.title || '');
          }
        });
      }

      return { textOut, addedImg };
    };

    const collectTopLevelCitations = (payloadObj) => {
      if (!payloadObj || typeof payloadObj !== 'object') return;
      if (Array.isArray(payloadObj.citations)) {
        payloadObj.citations.forEach((cit) => {
          if (typeof cit === 'string') appendUniqueCitation(cit, '');
          else if (cit && cit.url) appendUniqueCitation(cit.url, cit.title || '');
        });
      }
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

    const usePromptCaching = Boolean(endpoint.isOpenRouter) && (!curModel || curModel.supportsPromptCaching !== false);

    const outgoingMessages = buildChatRequestMessages(chat, aiId, usePromptCaching);
    const sentPayloadChars = countRequestMessagesChars(outgoingMessages);

    const requestBody = {
      model: capturedModelId,
      messages: outgoingMessages,
      stream: true,
      stream_options: { include_usage: true }
    };

    if (endpoint.isOpenRouter) {
      // OpenRouter native flag to always include cached_tokens + exact discounted cost in SSE usage
      requestBody.usage = { include: true };
      // Stable per-chat identifier helps OpenRouter sticky-route to the same provider/replica for cache hits
      if (chat && chat.id) {
        requestBody.user = String(chat.id).slice(0, 128);
      }
    }

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
      let resp = await fetch(endpoint.url, {
        method: 'POST',
        headers,
        body: JSON.stringify(requestBody),
        signal: controller.signal
      });

      captureRateLimitHeaders(resp.headers, capturedModelId);

      if (!resp.ok) {
        let detail = await parseResponseErrorText(resp);
        if (state.generatingMsgId !== aiId) return;

        // Safe auto-fallback if a specific model/endpoint rejects explicit cache_control blocks
        if (usePromptCaching && isCacheControlRejectionError(resp.status, detail)) {
          saveModelCapsOverride(capturedModelId, { supportsPromptCaching: false });
          requestBody.messages = buildChatRequestMessages(chat, aiId, false);
          resp = await fetch(endpoint.url, {
            method: 'POST',
            headers,
            body: JSON.stringify(requestBody),
            signal: controller.signal
          });
          captureRateLimitHeaders(resp.headers, capturedModelId);
          if (!resp.ok) {
            detail = await parseResponseErrorText(resp);
            if (state.generatingMsgId !== aiId) return;
          }
        }

        if (!resp.ok) {
          const learnedMsg = (resp.status === 400 || resp.status === 422)
            ? learnFromReasoningApiError(curModel, capturedThinking, detail)
            : null;
          setAssistantError(chat, aiMsg, learnedMsg || formatApiErrorForChat(resp.status, detail, usingFlex, capturedModelLabel));
          return;
        }
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
        collectTopLevelCitations(data);
        const choice = data && data.choices && data.choices[0];
        const extracted = collectMultimodalFromObj(choice && choice.message);
        const content = extracted.textOut;
        if (data && data.usage) finalUsage = mergeStreamUsage(finalUsage, data.usage);
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
            finalUsage = mergeStreamUsage(finalUsage, parsed.usage);
          }
          collectTopLevelCitations(parsed);

          const choice = parsed && parsed.choices && parsed.choices[0];
          if (!choice) return;
          const delta = choice.delta || choice.message || {};

          const reasoningChunk = extractReasoningDelta(delta);
          if (reasoningChunk && !aiMsg.plainText && aiMsg.images.length === 0) {
            reasoningBuffer += reasoningChunk;
            aiMsg.liveThinking = formatLiveThinkingSnippet(reasoningBuffer);
            scheduleStreamDOMUpdate(aiMsg);
          }

          const { textOut: contentChunk, addedImg } = collectMultimodalFromObj(delta);
          if (contentChunk || addedImg) {
            if (aiMsg.liveThinking !== null) {
              aiMsg.liveThinking = null;
            }
            aiMsg.streaming = true;
            if (contentChunk) aiMsg.plainText += contentChunk;
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
          if (!aiMsg.plainText.trim() && aiMsg.images.length === 0) {
            setAssistantError(chat, aiMsg, 'Модель вернула пустой ответ.');
          } else {
            aiMsg.html = renderMarkdownToHtml(aiMsg.plainText, false);
            persistChat(chat);
          }
        }
      }

      // Log usage (including cached_tokens & discounted cost) into 24h IndexedDB store + message metadata
      if (!aiMsg.isError && curModel) {
        const promptTok = Number(finalUsage && finalUsage.prompt_tokens) || 0;
        const compTok = Number(finalUsage && finalUsage.completion_tokens) || 0;
        const totalTok = Number(finalUsage && finalUsage.total_tokens) || (promptTok + compTok);
        const { cachedTokens, cacheWriteTokens, reasoningTokens } = extractCachedTokensFromUsage(finalUsage);
        const uncachedPromptTok = Math.max(0, promptTok - cachedTokens);

        let costUsd = 0;
        if (finalUsage && typeof finalUsage.cost === 'number') {
          costUsd = finalUsage.cost;
        } else if (curModel.pricing) {
          const pPrice = curModel.pricing.prompt || 0;
          const cPrice = curModel.pricing.completion || 0;
          const readPrice = typeof curModel.pricing.cacheRead === 'number' && curModel.pricing.cacheRead >= 0
            ? curModel.pricing.cacheRead
            : pPrice * 0.1;
          const writePrice = typeof curModel.pricing.cacheWrite === 'number' && curModel.pricing.cacheWrite > 0
            ? curModel.pricing.cacheWrite
            : 0;
          costUsd =
            uncachedPromptTok * pPrice +
            cachedTokens * readPrice +
            cacheWriteTokens * writePrice +
            compTok * cPrice;
        }

        if (promptTok > 0 || compTok > 0) {
          aiMsg.usage = {
            promptTokens: promptTok,
            completionTokens: compTok,
            reasoningTokens,
            cachedTokens,
            cacheWriteTokens,
            sentChars: sentPayloadChars,
            cost: costUsd
          };
          persistChat(chat);
        }

        recordUsageEntry({
          type: 'chat',
          modelId: capturedModelId,
          modelLabel: capturedModelLabel,
          tokens: totalTok,
          promptTokens: promptTok,
          completionTokens: compTok,
          cachedTokens,
          cacheWriteTokens,
          cost: costUsd,
          isFree: Boolean(curModel.isFree)
        });
        scheduleBalanceRefreshAfterRequest();
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
          togglePlayback(aiId, false);
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
      fetchOpenRouterBalance(false);
      fetchOpenRouterTtsModels();
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
      fetchElevenLabsByokVoices();
    });
    elevenKeyInput.addEventListener('blur', () => {
      state.apiKeys.elevenlabs = (elevenKeyInput.value || '').trim();
      persistSettings(true);
      fetchElevenLabsByokVoices();
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
    state.editingMsgId = null;
    state.editingMsgDraft = '';
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
    syncBalanceButtonUI();
    if (state.balanceAccordionOpen) {
      renderStatsPanelContent();
      fetchOpenRouterBalance(false);
      startStatsTickTimer();
    }
    renderChatList();
  }

  function closeDrawer() {
    stopStatsTickTimer();
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

  if (balanceAccordionBtn && balanceAccordionCollapse) {
    balanceAccordionBtn.addEventListener('click', () => {
      if (state.micState !== 'idle') return;
      const isOpen = balanceAccordionBtn.classList.toggle('open');
      balanceAccordionCollapse.classList.toggle('open', isOpen);
      balanceAccordionBtn.setAttribute('aria-expanded', String(isOpen));
      state.balanceAccordionOpen = isOpen;
      if (isOpen) {
        renderStatsPanelContent();
        fetchOpenRouterBalance(false);
        startStatsTickTimer();
      } else {
        stopStatsTickTimer();
      }
    });
  }

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
          state.editingMsgId = null;
          state.editingMsgDraft = '';
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
    // 1. Load per-model capability overrides & cached Gemini models (fast boot)
    const capsOvRec = await idbGet('kv', 'modelCapsOverrides');
    if (capsOvRec && capsOvRec.value && typeof capsOvRec.value === 'object') {
      state.modelCapsOverrides = capsOvRec.value;
    }
    const cachedModelsRec = await idbGet('kv', 'cachedGeminiModels');
    if (cachedModelsRec && cachedModelsRec.value && Array.isArray(cachedModelsRec.value.models) && cachedModelsRec.value.models.length > 0) {
      const filteredCached = cachedModelsRec.value.models
        .filter((m) => !isBatchModelMeta(m))
        .map((m) => {
          // Re-derive baseline thinking levels so improved rules apply immediately to cached models
          const derived = deriveThinkingLevels({
            id: m.id,
            name: m.fullName || m.label,
            supported_parameters: m.supportsReasoning ? ['reasoning'] : ['temperature']
          });
          m.supportsReasoning = derived.supportsReasoning;
          m.thinkingLevels = derived.thinkingLevels;
          return applyModelCapsOverride(m);
        });
      if (filteredCached.length > 0) {
        state.chatModels = filteredCached;
      }
    }
    const cachedTtsVoicesRec = await idbGet('kv', 'cachedTtsVoices');
    if (cachedTtsVoicesRec && cachedTtsVoicesRec.value && typeof cachedTtsVoicesRec.value === 'object') {
      state.ttsVoicesByModel = cachedTtsVoicesRec.value;
    }
    const cachedTtsFormatsRec = await idbGet('kv', 'cachedTtsFormats');
    if (cachedTtsFormatsRec && cachedTtsFormatsRec.value && typeof cachedTtsFormatsRec.value === 'object') {
      state.ttsFormatsByModel = cachedTtsFormatsRec.value;
    }
    const ttsFmtOvRec = await idbGet('kv', 'ttsFormatOverrides');
    if (ttsFmtOvRec && ttsFmtOvRec.value && typeof ttsFmtOvRec.value === 'object') {
      state.ttsFormatOverrides = ttsFmtOvRec.value;
    }
    const cachedElevenRec = await idbGet('kv', 'cachedElevenVoices');
    if (cachedElevenRec && Array.isArray(cachedElevenRec.value) && cachedElevenRec.value.length > 0) {
      state.elevenByokVoices = cachedElevenRec.value;
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
            const vp = s.voicePresets[k];
            state.voicePresets[k] = {
              voice: vp.voice || state.voicePresets[k].voice,
              speed: Number(vp.speed) || 1.0,
              pitch: Number(vp.pitch) || 1.0,
              temperature: vp.temperature !== undefined ? clampTtsTemperature(vp.temperature) : TTS_SAMPLING_DEFAULTS.temperature,
              topP: vp.topP !== undefined ? clampTtsTopP(vp.topP) : TTS_SAMPLING_DEFAULTS.topP,
              topK: vp.topK !== undefined ? clampTtsTopK(vp.topK) : TTS_SAMPLING_DEFAULTS.topK
            };
          }
        });
      }
      if (s.activeVoicePreset && state.voicePresets[s.activeVoicePreset]) {
        state.activeVoicePreset = s.activeVoicePreset;
      }
      const activeVp = state.voicePresets[state.activeVoicePreset];
      if (activeVp) {
        state.voiceDraft = {
          voice: activeVp.voice,
          speed: activeVp.speed,
          pitch: activeVp.pitch,
          temperature: clampTtsTemperature(activeVp.temperature),
          topP: clampTtsTopP(activeVp.topP),
          topK: clampTtsTopK(activeVp.topK)
        };
      }

      if (Array.isArray(s.personas) && s.personas.length === 4) {
        state.personas = s.personas.map((p) => ({
          name: (p && p.name) || '',
          instructions: (p && p.instructions) || '',
          ttsTags: Boolean(p && p.ttsTags)
        }));
      }
      if (typeof s.activePersonaIndex === 'number' && s.activePersonaIndex >= 0 && s.activePersonaIndex < 4) {
        state.activePersonaIndex = s.activePersonaIndex;
      }
      const activePer = state.personas[state.activePersonaIndex];
      if (activePer) {
        state.personaDraft = {
          name: activePer.name,
          instructions: activePer.instructions,
          ttsTags: Boolean(activePer.ttsTags)
        };
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
      const rl = rlRec.value;
      state.rateLimitInfo = {
        limit: rl.limit !== undefined ? rl.limit : null,
        remaining: rl.remaining !== undefined ? rl.remaining : null,
        resetMs: rl.resetMs !== undefined ? rl.resetMs : normalizeResetTimestampMs(rl.reset),
        updatedAt: rl.updatedAt || 0
      };
    }
    const mRlRec = await idbGet('kv', 'modelRateLimits');
    if (mRlRec && mRlRec.value && typeof mRlRec.value === 'object') {
      state.modelRateLimits = mRlRec.value;
    }
    const credRec = await idbGet('kv', 'creditsInfo');
    if (credRec && credRec.value) {
      state.creditsInfo = Object.assign(state.creditsInfo, credRec.value);
    }
    const keyInfoRec = await idbGet('kv', 'keyInfo');
    if (keyInfoRec && keyInfoRec.value) {
      state.keyInfo = Object.assign(state.keyInfo, keyInfoRec.value);
    }

    lastFetchedOrKey = state.apiKeys.openrouter || '';
  }

  async function initApp() {
    await hydrateFromIndexedDB();

    syncHeaderUI();
    syncBalanceButtonUI();
    syncAudioPanelUI();
    syncPersonaUI();
    syncDrawerSettingsUI();
    syncSendButton();
    updateComposerLayout();
    syncViewport();
    syncFloatingPanelsPosition();
    renderFeed();
    renderChatList();

    ensureValidVoiceForCurrentTts();
    syncAudioPanelUI();

    // Fetch live Gemini text models, TTS voices & account balance on startup
    fetchGeminiModelsFromOpenRouter(false);
    fetchOpenRouterBalance(false);
    fetchOpenRouterTtsModels();
    if ((state.apiKeys.elevenlabs || '').trim()) {
      fetchElevenLabsByokVoices();
    }

    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'hidden') {
        abortMicOnBackground();
      } else if (document.visibilityState === 'visible') {
        if (state.micState === 'idle' && !state.micStarting && (activeMicStreams.size > 0 || state.mediaStream)) {
          releaseMicStreamAndRestoreAudio(true);
        }
        const age = Date.now() - (state.creditsInfo.updatedAt || 0);
        if (age > 15000 && (state.apiKeys.openrouter || '').trim()) {
          fetchOpenRouterBalance(false);
        }
      }
    });

    window.addEventListener('pagehide', () => {
      abortMicOnBackground();
    });
  }

  initApp();
})();
