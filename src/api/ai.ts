import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { ENV } from './../env.local';

export type AiProvider = 'gemini' | 'ollama' | 'offline';

export interface AiConfig {
  provider: AiProvider;
  geminiApiKey: string;
  geminiModel: string;
  ollamaUrl: string;
  ollamaModel: string;
}

export interface AiPatientContext {
  id?: string;
  name: string;
  age?: number | null;
  phone?: string | null;
  note?: string | null;
}

export interface AiRecordItem {
  id: string;
  type: 'complaint' | 'diagnosis' | 'treatment' | 'appointment';
  title: string;
  description?: string | null;
  date: string;
  categoryOrKind?: string | null;
}

export interface AiChatMessage {
  id: string;
  role: 'user' | 'ai';
  text: string;
  provider?: AiProvider;
  model?: string;
  timestamp?: number;
}

export interface AskAiOptions {
  patient: AiPatientContext | null;
  records: AiRecordItem[];
  history: AiChatMessage[];
  question: string;
  configOverride?: Partial<AiConfig>;
}

export interface AiResponse {
  text: string;
  provider: AiProvider;
  model: string;
}

const STORAGE_KEYS = {
  PROVIDER: 'mediassist.ai.provider',
  GEMINI_KEY: 'mediassist.ai.gemini_key',
  GEMINI_MODEL: 'mediassist.ai.gemini_model',
  OLLAMA_URL: 'mediassist.ai.ollama_url',
  OLLAMA_MODEL: 'mediassist.ai.ollama_model',
};

const DEFAULT_GEMINI_MODEL = 'gemini-1.5-flash';
const DEFAULT_OLLAMA_MODEL = 'llama3.2';

export function getDefaultOllamaUrl(): string {
  if (Platform.OS === 'android') {
    return 'http://10.0.2.2:11434';
  }
  return 'http://localhost:11434';
}

export async function getAiConfig(): Promise<AiConfig> {
  try {
    const [provider, geminiKey, geminiModel, ollamaUrl, ollamaModel] =
      await Promise.all([
        AsyncStorage.getItem(STORAGE_KEYS.PROVIDER),
        AsyncStorage.getItem(STORAGE_KEYS.GEMINI_KEY),
        AsyncStorage.getItem(STORAGE_KEYS.GEMINI_MODEL),
        AsyncStorage.getItem(STORAGE_KEYS.OLLAMA_URL),
        AsyncStorage.getItem(STORAGE_KEYS.OLLAMA_MODEL),
      ]);

    const envKey = (ENV as any)?.GEMINI_API_KEY || '';
    const resolvedKey = geminiKey || envKey || '';

    // Default to 'offline' if user has never selected a provider and has no key
    const resolvedProvider: AiProvider =
      (provider as AiProvider) || (resolvedKey ? 'gemini' : 'offline');

    return {
      provider: resolvedProvider,
      geminiApiKey: resolvedKey,
      geminiModel: geminiModel || DEFAULT_GEMINI_MODEL,
      ollamaUrl: ollamaUrl || getDefaultOllamaUrl(),
      ollamaModel: ollamaModel || DEFAULT_OLLAMA_MODEL,
    };
  } catch {
    return {
      provider: 'offline',
      geminiApiKey: (ENV as any)?.GEMINI_API_KEY || '',
      geminiModel: DEFAULT_GEMINI_MODEL,
      ollamaUrl: getDefaultOllamaUrl(),
      ollamaModel: DEFAULT_OLLAMA_MODEL,
    };
  }
}

export async function saveAiConfig(
  partial: Partial<AiConfig>,
): Promise<AiConfig> {
  const current = await getAiConfig();
  const updated: AiConfig = { ...current, ...partial };

  await Promise.all([
    AsyncStorage.setItem(STORAGE_KEYS.PROVIDER, updated.provider),
    AsyncStorage.setItem(STORAGE_KEYS.GEMINI_KEY, updated.geminiApiKey),
    AsyncStorage.setItem(STORAGE_KEYS.GEMINI_MODEL, updated.geminiModel),
    AsyncStorage.setItem(STORAGE_KEYS.OLLAMA_URL, updated.ollamaUrl),
    AsyncStorage.setItem(STORAGE_KEYS.OLLAMA_MODEL, updated.ollamaModel),
  ]);

  return updated;
}

const SYSTEM_INSTRUCTION = `Sən MediAssist tibbi tətbiqinin ağıllı kliniki Süni İntellekt (AI) köməkçisisən.
Pasiyentə aid təqdim olunan tibbi dosye məlumatları (şikayətlər, qoyulmuş diaqnozlar, təyin edilmiş müalicələr, dərmanlar və qəbul tarixləri) əsasında həkimə (Dr. İbrahim Əsədov) kömək edirsən.

Tələblər:
1. Hər zaman səlis, peşəkar, tibbi terminologiyaya uyğun Azərbaycan dilində cavab ver.
2. Cavabları oxumaq üçün çox rahat et: vacib məqamları qalın (bold) yaz, maddələrlə (• bullet points) siyahıla, qısa və məzmunlu ol.
3. Həkimin sualına birbaşa cavab ver. Şikayətlər, diaqnozlar və müalicələr arasındakı əlaqəni analiz et.
4. Əgər dərman uyğunsuzluğu, əks göstəriş və ya təkrar müayinə zərurəti görsən, bunu mütləq həkimin diqqətinə çatdır.
5. Pasiyentin dosyəsində olmayan faktları uydurma. Məlumat çatışmırsa, həkimə hansı analizlərin tövsiyə oluna biləcəyini qeyd et.`;

function buildClinicalPrompt(
  patient: AiPatientContext | null,
  records: AiRecordItem[],
  question: string,
): string {
  const lines: string[] = [];
  lines.push('=== PASİYENTİN TİBBİ DOSYASI ===');
  if (patient) {
    lines.push(`Ad və Soyad: ${patient.name}`);
    if (patient.age !== null && patient.age !== undefined) {
      lines.push(`Yaşı: ${patient.age}`);
    }
    if (patient.phone) {
      lines.push(`Telefon: ${patient.phone}`);
    }
    if (patient.note) {
      lines.push(`Qeyd: ${patient.note}`);
    }
  } else {
    lines.push('Pasiyent seçilməyib (Ümumi tibbi məsləhət rejimi).');
  }

  const complaints = records.filter(r => r.type === 'complaint');
  const diagnoses = records.filter(r => r.type === 'diagnosis');
  const treatments = records.filter(r => r.type === 'treatment');
  const appointments = records.filter(r => r.type === 'appointment');

  lines.push(`\n--- ŞİKAYƏTLƏR (${complaints.length}) ---`);
  if (!complaints.length) {
    lines.push('Qeydə alınmış şikayət yoxdur.');
  } else {
    complaints.forEach((c, idx) => {
      lines.push(`${idx + 1}. [${c.date}] ${c.title}${c.description ? ` — ${c.description}` : ''}`);
    });
  }

  lines.push(`\n--- DİAQNOZLAR (${diagnoses.length}) ---`);
  if (!diagnoses.length) {
    lines.push('Qeydə alınmış diaqnoz yoxdur.');
  } else {
    diagnoses.forEach((d, idx) => {
      lines.push(`${idx + 1}. [${d.date}] ${d.title}${d.description ? ` — ${d.description}` : ''}`);
    });
  }

  lines.push(`\n--- MÜALİCƏ VƏ DƏRMANLAR (${treatments.length}) ---`);
  if (!treatments.length) {
    lines.push('Qeydə alınmış müalicə yoxdur.');
  } else {
    treatments.forEach((t, idx) => {
      lines.push(`${idx + 1}. [${t.date}] ${t.title}${t.description ? ` — ${t.description}` : ''}`);
    });
  }

  lines.push(`\n--- GÖRÜŞLƏR VƏ TƏQVİM (${appointments.length}) ---`);
  if (!appointments.length) {
    lines.push('Planlaşdırılmış görüş yoxdur.');
  } else {
    appointments.forEach((a, idx) => {
      lines.push(`${idx + 1}. [${a.date}] ${a.title}${a.description ? ` — ${a.description}` : ''}`);
    });
  }

  lines.push(`\n=== HƏKİMİN SUALI / SORĞUSU ===\n${question}`);
  return lines.join('\n');
}

async function callGemini(
  apiKey: string,
  modelName: string,
  fullPrompt: string,
  history: AiChatMessage[],
): Promise<string> {
  const model = modelName.trim() || DEFAULT_GEMINI_MODEL;
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey.trim()}`;

  const contents: any[] = [];

  // Pass last 4 turns of history for dialogue continuity
  const recentHistory = history.slice(-4);
  for (const h of recentHistory) {
    contents.push({
      role: h.role === 'ai' ? 'model' : 'user',
      parts: [{ text: h.text }],
    });
  }

  contents.push({
    role: 'user',
    parts: [{ text: fullPrompt }],
  });

  const body = {
    system_instruction: {
      parts: [{ text: SYSTEM_INSTRUCTION }],
    },
    contents,
    generationConfig: {
      temperature: 0.3,
      maxOutputTokens: 1200,
    },
  };

  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const errorBody = await response.text();
    let msg = `Gemini xətası (${response.status})`;
    try {
      const parsed = JSON.parse(errorBody);
      if (parsed?.error?.message) {
        msg = parsed.error.message;
      }
    } catch {}
    throw new Error(msg);
  }

  const data = await response.json();
  const candidate = data?.candidates?.[0];
  const reply = candidate?.content?.parts?.[0]?.text;

  if (!reply) {
    throw new Error('Gemini cavab yaratmadı.');
  }

  return reply.trim();
}

async function callOllama(
  ollamaUrl: string,
  modelName: string,
  fullPrompt: string,
  history: AiChatMessage[],
): Promise<string> {
  const cleanUrl = (ollamaUrl.trim() || getDefaultOllamaUrl()).replace(/\/+$/, '');
  const model = modelName.trim() || DEFAULT_OLLAMA_MODEL;
  const endpoint = `${cleanUrl}/api/chat`;

  const messages: any[] = [{ role: 'system', content: SYSTEM_INSTRUCTION }];

  const recentHistory = history.slice(-4);
  for (const h of recentHistory) {
    messages.push({
      role: h.role === 'ai' ? 'assistant' : 'user',
      content: h.text,
    });
  }

  messages.push({ role: 'user', content: fullPrompt });

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 45000);

  try {
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model,
        messages,
        stream: false,
        options: {
          temperature: 0.3,
        },
      }),
      signal: controller.signal,
    });

    clearTimeout(timer);

    if (!response.ok) {
      throw new Error(`Ollama serverindən cavab gəlmədi (${response.status}).`);
    }

    const data = await response.json();
    const reply = data?.message?.content || data?.response;
    if (!reply) {
      throw new Error('Ollama modelindən boş cavab alındı.');
    }
    return reply.trim();
  } catch (err: any) {
    clearTimeout(timer);
    if (err?.name === 'AbortError') {
      throw new Error('Ollama cavab vaxtı bitdi (45s). Modelin işlədiyini yoxlayın.');
    }
    throw new Error(
      `Ollama serverinə qoşulmaq mümkün olmadı (${cleanUrl}). Zəhmət olmasa Ollama tətbiqinin işlədiyini və ya IP ünvanını yoxlayın.`,
    );
  }
}

/**
 * Smart Local Clinical Rule Engine
 * Runs 100% offline with zero network dependency.
 * Formats high-quality medical summaries in Azerbaijani based on records.
 */
export function runLocalClinicalEngine(
  patient: AiPatientContext | null,
  records: AiRecordItem[],
  question: string,
): string {
  const q = question.toLowerCase();
  const patientName = patient?.name || 'Pasiyent';
  const complaints = records.filter(r => r.type === 'complaint');
  const diagnoses = records.filter(r => r.type === 'diagnosis');
  const treatments = records.filter(r => r.type === 'treatment');
  const appointments = records.filter(r => r.type === 'appointment');

  const isComplaintQuery =
    q.includes('şikayət') || q.includes('simptom') || q.includes('ağrı');
  const isTreatmentQuery =
    q.includes('müalicə') || q.includes('dərman') || q.includes('resept') || q.includes('plan');
  const isDiagnosisQuery =
    q.includes('diaqnoz') || q.includes('nəticə') || q.includes('analiz');
  const isCalendarQuery =
    q.includes('görüş') || q.includes('təqvim') || q.includes('qəbul');

  if (isComplaintQuery) {
    if (!complaints.length) {
      return `📋 **${patientName}** üçün hələ heç bir şikayət qeydə alınmayıb.\n\n• Pasiyentdən hazırkı vəziyyəti və narahatlıqları barədə məlumat alıb qeydlərə əlavə edə bilərsiniz.`;
    }
    const list = complaints
      .map(
        (c, i) =>
          `**${i + 1}. ${c.title}** (${c.date})\n${c.description ? `   • Əlamətlər: ${c.description}` : '   • Əlavə təsvir yoxdur.'}`,
      )
      .join('\n\n');

    return `🩺 **Pasiyentin Şikayətlər Xülasəsi:**\n\n${list}\n\n💡 **AI Kliniki Qeyd:** Şikayətlərin inkişaf dinamikasını izləmək və diaqnozla uyğunluğunu yoxlamaq tövsiyə olunur.`;
  }

  if (isTreatmentQuery) {
    if (!treatments.length) {
      return `💊 **${patientName}** üçün hazırda aktiv müalicə və ya dərman təyinatı yoxdur.\n\n• Diaqnoza uyğun olaraq yeni müalicə planı və ya resept tərtib edə bilərsiniz.`;
    }
    const list = treatments
      .map(
        (t, i) =>
          `**${i + 1}. ${t.title}** (${t.date})\n${t.description ? `   • Doza / Qəbul qaydası: ${t.description}` : '   • Əlavə təlimat qeyd edilməyib.'}`,
      )
      .join('\n\n');

    return `💊 **Aktiv Müalicə və Təyinat Planı:**\n\n${list}\n\n⚠️ **AI Tövsiyəsi:** Dərmanların qəbul rejimini və mümkün yanaşı təsirlərini pasiyentlə dəqiqləşdirmək faydalı olar.`;
  }

  if (isDiagnosisQuery) {
    if (!diagnoses.length) {
      return `🔬 **${patientName}** üçün təsdiqlənmiş diaqnoz qeydi tapılmadı.\n\n• Əlamətlər və instrumental/laborator müayinələr əsasında ilkin diaqnoz təyin edilə bilər.`;
    }
    const list = diagnoses
      .map(
        (d, i) =>
          `**${i + 1}. ${d.title}** (${d.date})\n${d.description ? `   • Təsvir / Qeyd: ${d.description}` : ''}`,
      )
      .join('\n\n');

    return `🔬 **Təsdiqlənmiş Diaqnoz Nəticələri:**\n\n${list}\n\n📌 **AI Müşahidəsi:** Diaqnozun dinamikası və müalicəyə cavab reaksiyası nəzarətdə saxlanılmalıdır.`;
  }

  if (isCalendarQuery) {
    if (!appointments.length) {
      return `📅 **${patientName}** üçün planlaşdırılmış qəbul və ya görüş yoxdur.\n\n• Təqvim bölməsindən təkrar baxış və ya nəzarət müayinəsi təyin edə bilərsiniz.`;
    }
    const list = appointments
      .map((a, i) => `**${i + 1}. ${a.title}** — ${a.date}${a.description ? ` (${a.description})` : ''}`)
      .join('\n');
    return `📅 **Planlaşdırılmış Qəbullar:**\n\n${list}`;
  }

  // General Comprehensive Clinical Summary
  const lines: string[] = [
    `👨‍⚕️ **${patientName} — Tibbi Vəziyyətin Ümumi Analizi:**`,
    '',
    `• **Şikayətlər:** ${complaints.length > 0 ? `${complaints.length} qeyd (${complaints.map(c => c.title).slice(0, 2).join(', ')})` : 'Qeyd yoxdur'}`,
    `• **Diaqnozlar:** ${diagnoses.length > 0 ? diagnoses.map(d => d.title).join(', ') : 'Qoyulmayıb'}`,
    `• **Müalicə:** ${treatments.length > 0 ? treatments.map(t => t.title).join(', ') : 'Təyin edilməyib'}`,
    `• **Görüşlər:** ${appointments.length > 0 ? `${appointments[0].title} (${appointments[0].date})` : 'Təyin edilməyib'}`,
    '',
    '📌 **Kliniki Tövsiyələr:**',
  ];

  if (!diagnoses.length && complaints.length > 0) {
    lines.push('1. Mövcud şikayətlərə əsasən ilkin laborator-diaqnostik müayinələrin aparılması.');
  }
  if (diagnoses.length > 0 && !treatments.length) {
    lines.push('2. Təyin olunmuş diaqnoza uyğun farmakoloji və ya fizioterapevtik müalicə protokolunun başlanması.');
  }
  if (!appointments.length) {
    lines.push('3. Müalicənin effektivliyini qiymətləndirmək üçün təkrar qəbul tarixinin təqvimdə qeyd edilməsi.');
  }
  if (lines.length <= 8) {
    lines.push('1. Pasiyentin cari rejimini və həyat tərzini nəzarətdə saxlamaq.');
    lines.push('2. Zəruri hallarda planlı təkrar müayinə təyin etmək.');
  }

  return lines.join('\n');
}

export async function askAi(options: AskAiOptions): Promise<AiResponse> {
  const config = await getAiConfig();
  const activeConfig: AiConfig = { ...config, ...options.configOverride };

  const clinicalPrompt = buildClinicalPrompt(
    options.patient,
    options.records,
    options.question,
  );

  // 1. Google Gemini (Pulsuz Free Tier API)
  if (activeConfig.provider === 'gemini') {
    if (activeConfig.geminiApiKey) {
      try {
        const text = await callGemini(
          activeConfig.geminiApiKey,
          activeConfig.geminiModel,
          clinicalPrompt,
          options.history,
        );
        return {
          text,
          provider: 'gemini',
          model: activeConfig.geminiModel,
        };
      } catch (err: any) {
        const localSummary = runLocalClinicalEngine(
          options.patient,
          options.records,
          options.question,
        );
        return {
          text: `⚠️ **Gemini ilə əlaqə xətası:** ${err?.message || 'Serverə qoşulmaq olmadı.'}\n\n*Məlumat daxili kliniki analizator tərəfindən hazırlandı:*\n\n---\n\n${localSummary}`,
          provider: 'offline',
          model: 'Daxili Analizator (Ehtiyat)',
        };
      }
    } else {
      const localSummary = runLocalClinicalEngine(
        options.patient,
        options.records,
        options.question,
      );
      return {
        text: `${localSummary}\n\n*(Məlumat daxili kliniki analizator tərəfindən hazırlandı. Yuxarıdakı tənzimləmələrdən pulsuz Google Gemini API açarı daxil edərək generativ AI rejimini aktivləşdirə bilərsiniz).*`,
        provider: 'offline',
        model: 'Daxili Analizator',
      };
    }
  }

  // 2. Ollama / Self-Hosted Model ("Öz Modelimiz")
  if (activeConfig.provider === 'ollama') {
    try {
      const text = await callOllama(
        activeConfig.ollamaUrl,
        activeConfig.ollamaModel,
        clinicalPrompt,
        options.history,
      );
      return {
        text,
        provider: 'ollama',
        model: activeConfig.ollamaModel,
      };
    } catch (err: any) {
      const localSummary = runLocalClinicalEngine(
        options.patient,
        options.records,
        options.question,
      );
      return {
        text: `🖥️ **Ollama serverinə qoşulmaq olmadı** (${activeConfig.ollamaUrl}).\n\n*Kompüterinizdə Ollama işləyənə qədər cavab daxili kliniki analizator tərəfindən təqdim edilir:*\n\n---\n\n${localSummary}`,
        provider: 'offline',
        model: 'Daxili Analizator (Ehtiyat)',
      };
    }
  }

  // 3. Offline Smart Engine
  const localText = runLocalClinicalEngine(
    options.patient,
    options.records,
    options.question,
  );
  return {
    text: localText,
    provider: 'offline',
    model: 'Daxili Analizator',
  };
}
