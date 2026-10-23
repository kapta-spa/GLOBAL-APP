import { GoogleGenerativeAI } from "@google/generative-ai";
import { BASE_PROMPT, COUNTRY_RULES } from "../config/countryPrompts";
import { generateClassDescriptions, generateBrazilClassDescriptions, generateChinaClassDescriptions, generateItalyClassDescriptions, normalizeItalianAuthority, filterClassDescriptionsByHeldClasses, formatCategoriesDates, formatLicenseClasses, formatJapanLicenseClasses, getCleanJapanCondition, formatClassDescriptions, getCleanGermanCodes, normalizeGermanCodes } from "./classDescriptions";

const cleanAndParseJSON = (text) => {
  let cleaned = text.trim();
  cleaned = cleaned.replace(/```json\s*/gi, '').replace(/```\s*$/gi, '').replace(/```/gi, '').trim();
  
  const firstBrace = cleaned.indexOf('{');
  const lastBrace = cleaned.lastIndexOf('}');
  if (firstBrace !== -1 && lastBrace > firstBrace) {
    cleaned = cleaned.substring(firstBrace, lastBrace + 1);
  }

  try {
    return JSON.parse(cleaned);
  } catch (e) {
    console.warn("Standard JSON.parse failed, trying fallback cleanup...", e);
    // Replace unescaped raw newlines inside JSON values
    const fixed = cleaned.replace(/(?<!\\)[\r\n]+/g, '\\n');
    return JSON.parse(fixed);
  }
};

const optimizeBase64Image = (base64Str, maxDimension = 3200, quality = 0.98) => {
  return new Promise((resolve) => {
    if (typeof window === 'undefined' || !base64Str || !base64Str.startsWith('data:image/')) {
      return resolve(base64Str);
    }
    const img = new Image();
    img.crossOrigin = 'Anonymous';
    img.onload = () => {
      let width = img.width;
      let height = img.height;
      if (width <= maxDimension && height <= maxDimension) {
        return resolve(base64Str);
      }
      if (width > height) {
        if (width > maxDimension) {
          height = Math.round((height * maxDimension) / width);
          width = maxDimension;
        }
      } else {
        if (height > maxDimension) {
          width = Math.round((width * maxDimension) / height);
          height = maxDimension;
        }
      }
      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(img, 0, 0, width, height);
      const resizedBase64 = canvas.toDataURL('image/jpeg', quality);
      resolve(resizedBase64);
    };
    img.onerror = () => {
      resolve(base64Str);
    };
    img.src = base64Str;
  });
};

// Cascading fallbacks prioritizing high-accuracy and fast response
const generateWithRetryAndFallback = async (genAI, promptParts, modelList, shouldParseJson = false, onChunk = null) => {
  let lastError = null;
  
  for (const modelName of modelList) {
    let retries = 2;
    while (retries > 0) {
      try {
        console.log(`Ejecutando modelo: ${modelName} (Intento ${3 - retries})`);
        
        let model;
        try {
          model = genAI.getGenerativeModel({ 
            model: modelName,
            generationConfig: {
              temperature: 0.1,
              maxOutputTokens: 8192,
              ...(shouldParseJson ? { responseMimeType: "application/json" } : {})
            }
          });
        } catch (configErr) {
          model = genAI.getGenerativeModel({ model: modelName });
        }
        
        const timeoutPromise = new Promise((_, reject) => 
          setTimeout(() => reject(new Error(`Timeout alcanzado en ${modelName}`)), 32000)
        );
        
        let text = '';
        try {
          const streamPromise = model.generateContentStream(promptParts);
          const resultStream = await Promise.race([streamPromise, timeoutPromise]);
          for await (const chunk of resultStream.stream) {
            const chunkText = chunk.text();
            text += chunkText;
            if (onChunk && typeof onChunk === 'function') {
              onChunk(chunkText, text);
            }
          }
        } catch (streamErr) {
          console.warn(`Streaming no disponible para ${modelName}, usando generación estándar:`, streamErr.message);
          const generatePromise = model.generateContent(promptParts);
          const result = await Promise.race([generatePromise, timeoutPromise]);
          const response = await result.response;
          text = response.text();
        }
        
        if (shouldParseJson) {
          return cleanAndParseJSON(text);
        }
        return text;
      } catch (error) {
        lastError = error;
        const errorMsg = error.message || '';
        const isTemporaryError = 
          errorMsg.includes('503') || 
          errorMsg.includes('429') || 
          errorMsg.includes('high demand') || 
          errorMsg.includes('Quota exceeded') || 
          errorMsg.includes('quota') ||
          errorMsg.includes('overloaded') ||
          errorMsg.includes('500');
        
        if (isTemporaryError && retries > 1) {
          console.warn(`Error temporal (${errorMsg}) en ${modelName}. Reintentando en 1s...`);
          await new Promise(resolve => setTimeout(resolve, 1000));
          retries--;
          continue;
        }
        
        console.warn(`Modelo ${modelName} falló: ${errorMsg}. Pasando al siguiente modelo fallback.`);
        break;
      }
    }
  }
  
  if (lastError) {
    const errorMsg = lastError.message || '';
    if (errorMsg.includes('503') || errorMsg.includes('high demand') || errorMsg.includes('overloaded')) {
      throw new Error("Los servidores de Gemini en Google están experimentando alta demanda temporal (Error 503). Por favor reintenta en unos segundos.");
    }
    if (errorMsg.includes('429') || errorMsg.includes('Quota exceeded') || errorMsg.includes('quota')) {
      throw new Error("Límite de cuota alcanzado en Google AI Studio (429 Rate Limit).");
    }
  }
  
  throw new Error(`Todos los modelos de Gemini fallaron. Último error: ${lastError ? lastError.message : 'Desconocido'}`);
};

let cachedModelsList = null;

const getValidModels = async (apiKey) => {
  if (cachedModelsList && cachedModelsList.length > 0) return cachedModelsList;

  const priorityOrder = [
    "gemini-3-flash-preview",
    "gemini-2.5-flash",
    "gemini-2.0-flash",
    "gemini-1.5-pro",
    "gemini-1.5-flash",
    "gemini-2.0-flash-lite",
    "gemini-2.5-pro"
  ];

  try {
    const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`);
    if (res.ok) {
      const data = await res.json();
      if (data.models && Array.isArray(data.models)) {
        const validFromApi = data.models
          .filter(m => m.supportedGenerationMethods && m.supportedGenerationMethods.includes("generateContent"))
          .map(m => m.name.replace(/^models\//, ''));

        const ordered = [];
        for (const p of priorityOrder) {
          if (validFromApi.includes(p)) ordered.push(p);
        }
        for (const v of validFromApi) {
          if (!ordered.includes(v) && (v.includes('flash') || v.includes('pro'))) {
            ordered.push(v);
          }
        }
        if (ordered.length > 0) {
          console.log("Modelos válidos detectados desde API de Gemini:", ordered);
          cachedModelsList = ordered;
          return ordered;
        }
      }
    }
  } catch (err) {
    console.warn("No se pudo consultar la lista dinámica de modelos:", err);
  }

  cachedModelsList = priorityOrder;
  return priorityOrder;
};

const monthNamesEn = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const ptMonthMap = {
  'janeiro': 'January', 'jan': 'January',
  'fevereiro': 'February', 'fev': 'February',
  'março': 'March', 'marco': 'March', 'mar': 'March',
  'abril': 'April', 'abr': 'April',
  'maio': 'May', 'mai': 'May',
  'junho': 'June', 'jun': 'June',
  'julho': 'July', 'jul': 'July',
  'agosto': 'August', 'ago': 'August',
  'setembro': 'September', 'set': 'September',
  'outubro': 'October', 'out': 'October',
  'novembro': 'November', 'nov': 'November',
  'dezembro': 'December', 'dez': 'December'
};

const normalizeDateToEnglish = (dateStr) => {
  if (!dateStr || typeof dateStr !== 'string') return dateStr;
  let s = dateStr.trim();
  if (s === '-' || s.toLowerCase() === 'indefinite' || s.toLowerCase() === 'none' || s.toLowerCase() === 'to long term') return s;

  // Case: DD/MM/YYYY or DD-MM-YYYY or DD.MM.YYYY
  const numMatch = s.match(/^(\d{1,2})[\/\.-](\d{1,2})[\/\.-](\d{4})$/);
  if (numMatch) {
    const day = numMatch[1].padStart(2, '0');
    const monthIdx = parseInt(numMatch[2], 10) - 1;
    const year = numMatch[3];
    if (monthIdx >= 0 && monthIdx < 12) {
      return `${day} ${monthNamesEn[monthIdx]} ${year}`;
    }
  }

  // Case: YYYY/MM/DD or YYYY-MM-DD or YYYY.MM.DD
  const ymdMatch = s.match(/^(\d{4})[\/\.-](\d{1,2})[\/\.-](\d{1,2})$/);
  if (ymdMatch) {
    const year = ymdMatch[1];
    const monthIdx = parseInt(ymdMatch[2], 10) - 1;
    const day = ymdMatch[3].padStart(2, '0');
    if (monthIdx >= 0 && monthIdx < 12) {
      return `${day} ${monthNamesEn[monthIdx]} ${year}`;
    }
  }

  // Case: DD [de] MonthName [de] YYYY in Portuguese/Spanish
  for (const [ptMonth, enMonth] of Object.entries(ptMonthMap)) {
    const regex = new RegExp(`(\\d{1,2})(?:\\s+de|\\s+)?\\s+${ptMonth}\\s+(?:de\\s+)?(\\d{4})`, 'i');
    const m = s.match(regex);
    if (m) {
      const day = m[1].padStart(2, '0');
      const year = m[2];
      return `${day} ${enMonth} ${year}`;
    }
  }

  return s;
};

export const COUNTRY_CANONICAL_NAMES = {
  'china': 'China',
  'chino': 'China',
  'german': 'Germany',
  'germany': 'Germany',
  'alemania': 'Germany',
  'deutschland': 'Germany',
  'francia': 'France',
  'francia_pink': 'France',
  'france': 'France',
  'brazil': 'Brazil',
  'brasil': 'Brazil',
  'cnh': 'Brazil',
  'belgica': 'Belgium',
  'belgium': 'Belgium',
  'canada': 'Canada',
  'czech': 'Czech Republic',
  'checa': 'Czech Republic',
  'denmark': 'Denmark',
  'dinamarca': 'Denmark',
  'danmark': 'Denmark',
  'finland': 'Finland',
  'finlandia': 'Finland',
  'hungria': 'Hungary',
  'hungary': 'Hungary',
  'indonesia': 'Indonesia',
  'israel': 'Israel',
  'italia': 'Italy',
  'italy': 'Italy',
  'japon': 'Japan',
  'japan': 'Japan',
  'korea': 'South Korea',
  'corea': 'South Korea',
  'latino': 'Latin America',
  'chile': 'Chile',
  'mexico': 'Mexico',
  'méxico': 'Mexico',
  'colombia': 'Colombia',
  'argentina': 'Argentina',
  'peru': 'Peru',
  'perú': 'Peru',
  'uruguay': 'Uruguay',
  'netherlands': 'Netherlands',
  'holanda': 'Netherlands',
  'norway': 'Norway',
  'noruega': 'Norway',
  'portugal': 'Portugal',
  'spain': 'Spain',
  'españa': 'Spain',
  'espana': 'Spain',
  'suiza': 'Switzerland',
  'swiss': 'Switzerland',
  'switzerland': 'Switzerland',
  'swedish': 'Sweden',
  'sweden': 'Sweden',
  'suecia': 'Sweden',
  'taiwan': 'Taiwan',
  'vietnam': 'Vietnam'
};

export const getNormalizedCountryKey = (country = '') => {
  if (!country || typeof country !== 'string') return '';
  const c = country.toLowerCase().trim();
  if (/china|chino|chinese/i.test(c)) return 'china';
  if (/alemania|german|germany|deutsch|berlin|munich|münchen|hamburg|frankfurt|cologne|köln|stuttgart|düsseldorf|leipzig|dresden|hannover|nürnberg|bonn|führerschein|fahrerlaubnis/i.test(c)) return 'german';
  if (/francia.*pink|france.*pink/i.test(c)) return 'francia_pink';
  if (/francia|france|french|paris/i.test(c)) return 'francia';
  if (/brazil|brasil|cnh|detran|denatran|senatran|brazilian/i.test(c)) return 'brazil';
  if (/belgica|belgique|belgium|bruxelles|brussels|belgian/i.test(c)) return 'belgica';
  if (/canada|canad/i.test(c)) return 'canada';
  if (/czech|checa|česk|prague|praha/i.test(c)) return 'czech';
  if (/denmark|dinamarca|danmark|copenhagen|københavn|danish|dansk/i.test(c)) return 'denmark';
  if (/finland|finlandia|helsinki|suomi|finnish/i.test(c)) return 'finland';
  if (/hungria|hungary|budapest|magyar|hungarian/i.test(c)) return 'hungria';
  if (/indonesia|jakarta|indonesian/i.test(c)) return 'indonesia';
  if (/israel|tel aviv|jerusalem|israeli/i.test(c)) return 'israel';
  if (/italia|italy|roma|rome|milano|italian/i.test(c)) return 'italia';
  if (/japon|japan|tokyo|nihon|nippon|japanese/i.test(c)) return 'japan';
  if (/korea|corea|seoul|korean/i.test(c)) return 'korea';
  if (/latino|chile|mexico|méxico|colombia|argentina|peru|perú|uruguay/i.test(c)) return 'latino';
  if (/netherland|holand|pa[ií]ses bajos|dutch|amsterdam/i.test(c)) return 'netherlands';
  if (/norway|noruega|oslo|norge|norwegian|norsk/i.test(c)) return 'norway';
  if (/portugal|lisboa|lisbon|portug/i.test(c)) return 'portugal';
  if (/spain|espa[nñ]a|madrid|barcelona|spanish/i.test(c)) return 'spain';
  if (/suiza|swiss|switzerland|zürich|zurich|geneva|genève|schweiz/i.test(c)) return 'swiss';
  if (/swedish|suecia|sweden|stockholm|sverige|svenska/i.test(c)) return 'swedish';
  if (/taiwan|taiw[aá]n|taipei|taiwanese/i.test(c)) return 'taiwan';
  if (/vietnam|hanoi|saigon|ho chi minh|vietnamese/i.test(c)) return 'vietnam';
  return '';
};

export const COUNTRY_TOKENS = [
  { key: 'denmark', names: ['Denmark', 'Dinamarca', 'Danmark', 'Danish', 'Dansk'] },
  { key: 'german', names: ['Germany', 'Deutschland', 'Alemania', 'German', 'Deutsch'] },
  { key: 'brazil', names: ['Brazil', 'Brasil', 'Brazilian', 'Brasileiro', 'Brasileira'] },
  { key: 'francia', names: ['France', 'Francia', 'French', 'Français', 'Francaise'] },
  { key: 'italia', names: ['Italy', 'Italia', 'Italian', 'Italiano', 'Italiana'] },
  { key: 'spain', names: ['Spain', 'España', 'Espana', 'Spanish', 'Español', 'Espanol'] },
  { key: 'japan', names: ['Japan', 'Japón', 'Japon', 'Japanese', 'Nihon', 'Nippon'] },
  { key: 'china', names: ['China', 'Chinese', 'Chino'] },
  { key: 'belgica', names: ['Belgium', 'Bélgica', 'Belgica', 'Belgique', 'Belgian'] },
  { key: 'canada', names: ['Canada', 'Canadá', 'Canadian'] },
  { key: 'czech', names: ['Czech Republic', 'Czechia', 'República Checa', 'Republica Checa', 'Czech', 'Česká', 'Ceska'] },
  { key: 'finland', names: ['Finland', 'Finlandia', 'Finnish', 'Suomi'] },
  { key: 'hungria', names: ['Hungary', 'Hungría', 'Hungria', 'Hungarian', 'Magyar'] },
  { key: 'indonesia', names: ['Indonesia', 'Indonesian'] },
  { key: 'israel', names: ['Israel', 'Israeli'] },
  { key: 'korea', names: ['South Korea', 'Korea', 'Corea', 'Korean'] },
  { key: 'netherlands', names: ['Netherlands', 'Países Bajos', 'Paises Bajos', 'Holanda', 'Dutch', 'Nederlands'] },
  { key: 'norway', names: ['Norway', 'Noruega', 'Norwegian', 'Norge', 'Norsk'] },
  { key: 'portugal', names: ['Portugal', 'Portuguese', 'Português', 'Portugues'] },
  { key: 'swiss', names: ['Switzerland', 'Suiza', 'Swiss', 'Schweiz'] },
  { key: 'swedish', names: ['Sweden', 'Suecia', 'Swedish', 'Sverige', 'Svenska'] },
  { key: 'taiwan', names: ['Taiwan', 'Taiwán', 'Taiwanese'] },
  { key: 'vietnam', names: ['Vietnam', 'Vietnamese'] },
  { key: 'latino', names: ['Mexico', 'México', 'Colombia', 'Chile', 'Argentina', 'Peru', 'Perú', 'Uruguay', 'Mexican', 'Colombian', 'Chilean', 'Argentine', 'Peruvian', 'Uruguayan'] },
  { key: 'uk', names: ['United Kingdom', 'Great Britain', 'UK', 'Britain', 'British'] },
  { key: 'usa', names: ['United States', 'USA', 'America', 'American'] },
  { key: 'australia', names: ['Australia', 'Australian'] },
  { key: 'poland', names: ['Poland', 'Polonia', 'Polish', 'Polski'] },
  { key: 'austria', names: ['Austria', 'Austrian', 'Österreich', 'Osterreich'] },
  { key: 'ireland', names: ['Ireland', 'Irlanda', 'Irish'] },
  { key: 'greece', names: ['Greece', 'Grecia', 'Greek'] },
  { key: 'turkey', names: ['Turkey', 'Turquía', 'Turquia', 'Turkish'] },
  { key: 'india', names: ['India', 'Indian'] },
  { key: 'south_africa', names: ['South Africa', 'South African'] },
  { key: 'new_zealand', names: ['New Zealand', 'New Zealander'] },
  { key: 'philippines', names: ['Philippines', 'Filipinas', 'Filipino', 'Philippine'] },
  { key: 'romania', names: ['Romania', 'Rumania', 'Romanian'] }
];

export const findCountryToken = (str) => {
  if (!str) return null;
  const trimmed = str.replace(/[\.;,\s]+$/, '').trim();
  for (const item of COUNTRY_TOKENS) {
    for (const name of item.names) {
      if (new RegExp(`^${name}$`, 'i').test(trimmed)) {
        return item;
      }
    }
  }
  return null;
};

/**
 * Sanitizes authority field ensuring it strictly contains the issuing institution/prefecture
 * and ONLY the single genuine country where the license originates.
 */
export const sanitizeAuthority = (authorityStr = '', countryHint = '') => {
  if (!authorityStr || typeof authorityStr !== 'string') return authorityStr || '';
  let str = authorityStr.trim();
  if (str === '-' || str === '') return str;

  let targetKey = getNormalizedCountryKey(countryHint);
  const parts = str.split(',').map(p => p.trim()).filter(Boolean);

  if (!targetKey) {
    for (const part of parts) {
      const tok = findCountryToken(part);
      if (tok) {
        targetKey = tok.key;
        break;
      }
    }
  }

  const canonicalCountry = COUNTRY_CANONICAL_NAMES[targetKey] || (targetKey ? targetKey.charAt(0).toUpperCase() + targetKey.slice(1) : '');

  const keptParts = [];
  for (let i = 0; i < parts.length; i++) {
    const part = parts[i];
    const tok = findCountryToken(part);
    if (tok) {
      if (targetKey && tok.key === targetKey) {
        if (!keptParts.some(kp => findCountryToken(kp)?.key === targetKey)) {
          keptParts.push(canonicalCountry || part);
        }
      } else if (!targetKey && i === 0) {
        keptParts.push(part);
      }
      // Foreign countries are deliberately dropped
    } else {
      keptParts.push(part);
    }
  }

  if (keptParts.length === 0) {
    return canonicalCountry ? canonicalCountry : str;
  }

  // China driver's license authorities do not append ", China"
  if (targetKey === 'china') {
    const filteredNoChina = keptParts.filter(p => !findCountryToken(p));
    return filteredNoChina.join(', ');
  }

  // Append single target country if missing from the end
  const lastPart = keptParts[keptParts.length - 1];
  const lastTok = findCountryToken(lastPart);
  if (canonicalCountry && (!lastTok || lastTok.key !== targetKey)) {
    keptParts.push(canonicalCountry);
  }

  return keptParts.join(', ');
};

export const formatBrazilAuthority = (authStr = '') => {
  if (!authStr || typeof authStr !== 'string') return 'State Traffic Department, Brazil';
  let cleaned = authStr.trim();

  const stateMap = {
    AC: "Acre", AL: "Alagoas", AP: "Amapá", AM: "Amazonas", BA: "Bahia",
    CE: "Ceará", DF: "Federal District", ES: "Espírito Santo", GO: "Goiás",
    MA: "Maranhão", MT: "Mato Grosso", MS: "Mato Grosso do Sul", MG: "Minas Gerais",
    PA: "Pará", PB: "Paraíba", PR: "Paraná", PE: "Pernambuco", PI: "Piauí",
    RJ: "Rio de Janeiro", RN: "Rio Grande do Norte", RS: "Rio Grande do Sul",
    RO: "Rondônia", RR: "Roraima", SC: "Santa Catarina", SP: "São Paulo",
    SE: "Sergipe", TO: "Tocantins"
  };

  if (/detran|denatran|senatran/i.test(cleaned)) {
    const match = cleaned.match(/(?:detran|denatran|senatran)[\s\/\-_:]*([a-z]{2})\b/i);
    if (match && match[1]) {
      const uf = match[1].toUpperCase();
      const stateName = stateMap[uf] || uf;
      return `State Traffic Department, ${stateName}, Brazil`;
    } else {
      let foundState = "";
      for (const [uf, name] of Object.entries(stateMap)) {
        if (new RegExp(`\\b(${name}|${uf})\\b`, "i").test(cleaned)) {
          foundState = name;
          break;
        }
      }
      if (foundState) {
        return `State Traffic Department, ${foundState}, Brazil`;
      }
      return `State Traffic Department, Brazil`;
    }
  }

  if (!/brazil/i.test(cleaned)) {
    cleaned = `${cleaned.replace(/,\s*$/, '')}, Brazil`;
  }

  return cleaned;
};

export const extractLicenseData = async (apiKey, base64Images, country = '', onChunk = null) => {
  if (!apiKey) throw new Error("API Key de Gemini no encontrada. Agrégala en Settings.");
  
  const genAI = new GoogleGenerativeAI(apiKey);
  const models = await getValidModels(apiKey);
  
  const matchedKey = getNormalizedCountryKey(country);
  const specificRules = matchedKey ? (COUNTRY_RULES[matchedKey] || COUNTRY_RULES[country.toLowerCase()] || '') : '';
  
  const fullPrompt = `${BASE_PROMPT}\n\n### MANDATORY JURISDICTION RULES:\n${specificRules || 'Extract all visible driver license fields translated strictly to English. Format all dates as "DD Month YYYY".'}\n\nAnalyze the provided driver's license images and extract data strictly adhering to these rules. Return only valid JSON.`;
  
  console.log(`Using high-precision extraction for country: ${matchedKey || 'universal-auto'}`);

  // Send high-resolution images
  const optimizedBase64s = await Promise.all(
    base64Images.map(img => optimizeBase64Image(img, 3200, 0.98))
  );

  const imageParts = optimizedBase64s.map(img => {
    const [header, base64Data] = img.split(',');
    const mimeType = header.split(':')[1].split(';')[0];
    
    return {
      inlineData: {
        data: base64Data,
        mimeType
      }
    };
  });
  
  const extractedData = await generateWithRetryAndFallback(
    genAI,
    [fullPrompt, ...imageParts],
    models,
    true,
    onChunk
  );

  // Field normalization & synchronization without deleting valid fields
  if (extractedData && typeof extractedData === 'object') {
    // Convert all fields to strings safely (in case Gemini returned arrays or objects)
    for (const [key, val] of Object.entries(extractedData)) {
      if (val === null || val === undefined) {
        extractedData[key] = '';
      } else if (Array.isArray(val)) {
        extractedData[key] = val.map(item => typeof item === 'object' ? JSON.stringify(item) : String(item)).join('\n');
      } else if (typeof val === 'object') {
        extractedData[key] = Object.entries(val).map(([k, v]) => `${k}: ${typeof v === 'object' ? JSON.stringify(v) : String(v)}`).join('\n');
      } else {
        extractedData[key] = String(val);
      }
    }

    // Synchronize first names
    if (extractedData.firstName && !extractedData.firstNames) {
      extractedData.firstNames = extractedData.firstName;
    } else if (extractedData.firstNames && !extractedData.firstName) {
      extractedData.firstName = extractedData.firstNames.split(' ')[0];
    }

    // Synchronize full name
    if (!extractedData.fullName || extractedData.fullName === '-' || extractedData.fullName.trim() === '') {
      const nameParts = [extractedData.surname, extractedData.firstName, extractedData.middleName].filter(p => p && p !== '-' && p.trim() !== '');
      if (nameParts.length > 0) {
        extractedData.fullName = nameParts.join(' ');
      }
    }

    // Synchronize categories dates and first obtained
    if (extractedData.firstObtained && (!extractedData.categoriesDates || extractedData.categoriesDates === '-')) {
      extractedData.categoriesDates = extractedData.firstObtained;
    } else if (extractedData.categoriesDates && (!extractedData.firstObtained || extractedData.firstObtained === '-')) {
      extractedData.firstObtained = extractedData.categoriesDates;
    }

    // Synchronize firstIssued and issueDate
    if (extractedData.firstIssued && (!extractedData.issueDate || extractedData.issueDate === '-')) {
      extractedData.issueDate = extractedData.firstIssued;
    }

    // Synchronize eye and eyeColor
    if (extractedData.eye && (!extractedData.eyeColor || extractedData.eyeColor === '-')) {
      extractedData.eyeColor = extractedData.eye;
    } else if (extractedData.eyeColor && (!extractedData.eye || extractedData.eye === '-')) {
      extractedData.eye = extractedData.eyeColor;
    }

    // Synchronize sex and gender
    if (extractedData.sex && (!extractedData.gender || extractedData.gender === '-')) {
      extractedData.gender = extractedData.sex;
    } else if (extractedData.gender && (!extractedData.sex || extractedData.sex === '-')) {
      extractedData.sex = extractedData.gender;
    }

    // Synchronize barcode, file numbers and explicacionCodigos across all variations
    const rawBarcode = extractedData.barcodeNumber || 
                       extractedData.barcode || 
                       extractedData.barcode_number || 
                       extractedData.barCode || 
                       extractedData.barCodeNumber || 
                       extractedData.barcodeNo || 
                       extractedData.bar_code || 
                       extractedData.codebar;
    if (rawBarcode) {
      extractedData.barcodeNumber = String(rawBarcode).trim();
      extractedData.barcode = String(rawBarcode).trim();
    }

    const rawFile = extractedData.fileNumber || 
                    extractedData.file || 
                    extractedData.fileNo || 
                    extractedData.file_no || 
                    extractedData.filenumber || 
                    extractedData.file_number || 
                    extractedData.recordNumber || 
                    extractedData.recordFileNumber || 
                    extractedData.archiveNumber || 
                    extractedData.archiveNo || 
                    extractedData.dangan || 
                    extractedData.danganNumber || 
                    extractedData.danganBianhao;
    if (rawFile) {
      extractedData.fileNumber = String(rawFile).trim();
      extractedData.file = String(rawFile).trim();
      extractedData.fileNo = String(rawFile).trim();
    }

    const rawExplicacion = extractedData.explicacionCodigos || 
                           extractedData.conditions || 
                           extractedData.condition || 
                           extractedData.explicacion || 
                           extractedData.record || 
                           extractedData.records || 
                           extractedData.recordCard || 
                           extractedData.recordDetails || 
                           extractedData.remarks || 
                           extractedData.remark || 
                           extractedData.observations || 
                           extractedData.observaciones || 
                           extractedData.notes || 
                           extractedData.note || 
                           extractedData.violations;
    if (rawExplicacion) {
      extractedData.explicacionCodigos = String(rawExplicacion).trim();
      extractedData.conditions = String(rawExplicacion).trim();
      extractedData.explicacion = String(rawExplicacion).trim();
    }

    // China document detection
    const isChinaDoc = matchedKey === 'china' ||
                       matchedKey === 'chino' ||
                       getNormalizedCountryKey(extractedData.country || '') === 'china' ||
                       /china|chinese|chino/i.test(country) ||
                       (!matchedKey && !extractedData.country && /chin/i.test(extractedData.nationality || '')) ||
                       (!matchedKey && !extractedData.country && /chin|车辆管理所|公安/i.test(extractedData.authority || '')) ||
                       (!matchedKey && !extractedData.country && /chin/i.test(extractedData.licenseLanguage || ''));

    if (isChinaDoc) {
      if (!extractedData.nationality || extractedData.nationality === '-' || extractedData.nationality.trim() === '') {
        extractedData.nationality = 'Chinese';
      }
      if (!extractedData.explicacionCodigos || extractedData.explicacionCodigos.trim() === '') {
        extractedData.explicacionCodigos = '-';
        extractedData.conditions = '-';
        extractedData.explicacion = '-';
      }
      if (extractedData.expiryDate && typeof extractedData.expiryDate === 'string') {
        const expLow = extractedData.expiryDate.toLowerCase();
        if (expLow.includes('long') || expLow.includes('term') || expLow.includes('perm') || expLow.includes('indefinite') || extractedData.expiryDate.includes('长期')) {
          extractedData.expiryDate = 'To Long Term';
        }
      }
      if (extractedData.gender) {
        const g = extractedData.gender.trim();
        if (g === '男' || g.toLowerCase() === 'm' || g.toLowerCase() === 'male') {
          extractedData.gender = 'Male';
          extractedData.sex = 'Male';
        } else if (g === '女' || g.toLowerCase() === 'f' || g.toLowerCase() === 'female') {
          extractedData.gender = 'Female';
          extractedData.sex = 'Female';
        }
      }
      if (extractedData.firstIssued && (!extractedData.firstObtained || extractedData.firstObtained === '-')) {
        extractedData.firstObtained = extractedData.firstIssued;
      }
    }

    // Brazil document detection and identifier synchronization
    const rawCardNumber = extractedData.cardNumber || 
                          extractedData.card_number || 
                          extractedData.cardNumberVertical ||
                          extractedData.numeroEspelho || 
                          extractedData.numero_espelho || 
                          extractedData.espelho || 
                          extractedData.nEspelho || 
                          extractedData.serialNumber || 
                          extractedData.serial || 
                          extractedData.cnhSerial || 
                          extractedData.cardNo || 
                          extractedData.verticalNumber || 
                          extractedData.securityNumber;
    if (rawCardNumber) {
      extractedData.cardNumber = String(rawCardNumber).trim();
    }

    const rawIdDoc = extractedData.idDocument || 
                     extractedData.id_document || 
                     extractedData.docIdentidade || 
                     extractedData.doc_identidade || 
                     extractedData.identityDocument || 
                     extractedData.rg || 
                     extractedData.identidade || 
                     extractedData.docIdentity || 
                     extractedData.documentoIdentidade || 
                     extractedData.sec4c || 
                     extractedData.point4c;
    if (rawIdDoc) {
      extractedData.idDocument = String(rawIdDoc).trim();
    }

    const rawPersonal = extractedData.personal || 
                        extractedData.point4d || 
                        extractedData.sec4d || 
                        extractedData.personalNumber || 
                        extractedData.personal_number || 
                        extractedData.personalId || 
                        extractedData.personalCode || 
                        extractedData.cpr || 
                        extractedData.cprNumber || 
                        extractedData.cpr_nummer || 
                        extractedData.idNumber;
    if (rawPersonal) {
      extractedData.personal = String(rawPersonal).trim();
      extractedData.point4d = extractedData.personal;
    }

    const rawBlood = extractedData.blood || 
                     extractedData.Blood || 
                     extractedData.bloodType || 
                     extractedData.blood_type || 
                     extractedData.golDarah || 
                     extractedData.gol_darah || 
                     extractedData.golonganDarah ||
                     extractedData.bloodGroup;
    if (rawBlood && String(rawBlood).trim() !== '' && rawBlood !== '-') {
      extractedData.blood = String(rawBlood).trim();
      extractedData.Blood = extractedData.blood;
    }

    const rawCode = extractedData.code || 
                    extractedData.reverseCode || 
                    extractedData.securityCode;
    if (rawCode && String(rawCode).trim() !== '' && rawCode !== '-') {
      extractedData.code = String(rawCode).trim();
      if (!extractedData.codes || extractedData.codes === '-') {
        extractedData.codes = extractedData.code;
      }
    } else if (extractedData.codes && extractedData.codes !== '-') {
      extractedData.code = String(extractedData.codes).trim();
    }

    const rawAddress = extractedData.address || extractedData.alamat || extractedData.fullAddress;
    if (rawAddress && String(rawAddress).trim() !== '') {
      extractedData.address = String(rawAddress).trim();
    }

    const rawCitizen = extractedData.citizen || 
                       extractedData.bsn || 
                       extractedData.rsn || 
                       extractedData.citizenNumber || 
                       extractedData.citizen_number || 
                       extractedData.burgerservicenummer ||
                       extractedData.bsnNumber ||
                       extractedData.bsn_number ||
                       extractedData.citizenNo;
    if (rawCitizen) {
      extractedData.citizen = String(rawCitizen).trim();
    }

    const rawCpf = extractedData.cpf || 
                   extractedData.CPF || 
                   extractedData.individualTaxpayerNumber || 
                   extractedData.taxpayerNumber;
    if (rawCpf) {
      extractedData.cpf = String(rawCpf).trim();
    }

    const rawParents = extractedData.parents || 
                       extractedData.filiação || 
                       extractedData.filiacao || 
                       extractedData.nameOfParents || 
                       extractedData.parentNames || 
                       extractedData.parentsNames || 
                       extractedData.motherName || 
                       extractedData.fatherName || 
                       extractedData.filiation ||
                       extractedData.affiliation;
    if (rawParents) {
      extractedData.parents = String(rawParents).toUpperCase().trim();
      extractedData.nameOfParents = extractedData.parents;
    }

    const isBrazilDoc = matchedKey === 'brazil' ||
                        matchedKey === 'brasil' ||
                        matchedKey === 'cnh' ||
                        getNormalizedCountryKey(extractedData.country || '') === 'brazil' ||
                        /brazil|brasil|brazilian/i.test(extractedData.nationality || '') ||
                        /brazil|brasil|detran|denatran|senatran/i.test(extractedData.authority || '') ||
                        /carteira nacional de habilita/i.test(extractedData.licenseLanguage || '') ||
                        /brazil|brasil|cnh/i.test(country);

    if (isBrazilDoc) {
      if (!extractedData.cpf && extractedData.personal) {
        extractedData.cpf = extractedData.personal;
      }
      if (extractedData.surname) extractedData.surname = extractedData.surname.toUpperCase().trim();
      if (extractedData.firstName) extractedData.firstName = extractedData.firstName.toUpperCase().trim();
      if (extractedData.parents) extractedData.parents = extractedData.parents.toUpperCase().trim();
      if (!extractedData.country || extractedData.country === '-' || extractedData.country.trim() === '') {
        extractedData.country = 'Brazil';
      }
      if (!extractedData.nationality || extractedData.nationality === '-') extractedData.nationality = 'Brazilian';
      extractedData.gender = 'Not stated';
      extractedData.sex = 'Not stated';
      if (extractedData.authority) {
        extractedData.authority = formatBrazilAuthority(extractedData.authority);
      }
      if (extractedData.firstIssued && (!extractedData.firstObtained || extractedData.firstObtained === '-')) {
        extractedData.firstObtained = extractedData.firstIssued;
      } else if (extractedData.firstObtained && (!extractedData.firstIssued || extractedData.firstIssued === '-')) {
        extractedData.firstIssued = extractedData.firstObtained;
      }
      if (extractedData.middleName && extractedData.middleName.trim() === '-') {
        extractedData.middleName = '';
      }
    }

    // Clean placeOfBirth
    if (extractedData.placeOfBirth && typeof extractedData.placeOfBirth === 'string') {
      let pob = extractedData.placeOfBirth.trim();
      pob = pob.replace(/^(lieu de naissance|place of birth|birthplace|born in|lieu|birth place|de nacimiento)\s*[:\-–—]?\s*/i, '');
      pob = pob.replace(/\s*\(\s*\d+\s*\)/g, '');
      pob = pob.replace(/\s+\d{2,5}$/g, '');
      pob = pob.replace(/\s*,\s*France\s*/i, '');
      pob = pob.replace(/\s*,\s*FR\s*/i, '');
      if (pob.includes(',')) pob = pob.split(',')[0];
      if (pob.includes(';')) pob = pob.split(';')[0];
      extractedData.placeOfBirth = pob.trim().replace(/^[\-\–\—\s]+|[\-\–\—\s]+$/g, '');
    }

    // Normalize date strings
    const dateKeys = ['dateOfBirth', 'issueDate', 'expiryDate', 'firstIssued', 'firstObtained'];
    dateKeys.forEach(dk => {
      if (extractedData[dk] && typeof extractedData[dk] === 'string') {
        extractedData[dk] = normalizeDateToEnglish(extractedData[dk]);
      }
    });

    // Format categoriesDates
    if (extractedData.categoriesDates && typeof extractedData.categoriesDates === 'string') {
      extractedData.categoriesDates = formatCategoriesDates(extractedData.categoriesDates);
    }

    // Ensure Code 106 full formula if 106 is present
    if (extractedData.explicacionCodigos && typeof extractedData.explicacionCodigos === 'string' && extractedData.explicacionCodigos.includes('106')) {
      const fromDate = extractedData.code106From ? normalizeDateToEnglish(extractedData.code106From) : '';
      const toDate = extractedData.code106To ? normalizeDateToEnglish(extractedData.code106To) : '';
      if (!extractedData.explicacionCodigos.includes('Speed limits: 110km/h')) {
        let dateFrom = fromDate;
        let dateTo = toDate;
        const dateMatch = extractedData.explicacionCodigos.match(/from\s+([A-Za-z0-9\s\.\/-]+)\s+to\s+([A-Za-z0-9\s\.\/-]+)/i);
        if (dateMatch) {
          if (!dateFrom) dateFrom = normalizeDateToEnglish(dateMatch[1].trim());
          if (!dateTo) dateTo = normalizeDateToEnglish(dateMatch[2].replace(/[()\.;].*$/, '').trim());
        }
        if (dateFrom && dateTo) {
          extractedData.explicacionCodigos = `106- Subject to the application of article R. 413-5 during probationary period from ${dateFrom} to ${dateTo} (Speed limits: 110km/h in Freeways where limit is 130km/h, 100km/h in freeways with lower speed limit or double roads, 80 km/h on other roads.)`;
        }
      }
    }

    // Japan document detection
    const isJapanDoc = matchedKey === 'japan' ||
                       matchedKey === 'japon' ||
                       getNormalizedCountryKey(extractedData.country || '') === 'japan' ||
                       /japan|japon/i.test(country) ||
                       (!matchedKey && !extractedData.country && /japan|japon/i.test(extractedData.nationality || '')) ||
                       (!matchedKey && !extractedData.country && /japan|japon|public safety commission/i.test(extractedData.authority || ''));

    if (isJapanDoc) {
      if (!extractedData.nationality || extractedData.nationality === '-' || extractedData.nationality.trim() === '') {
        extractedData.nationality = 'Japanese';
      }
      if (extractedData.authority && !extractedData.authority.toLowerCase().includes('japan')) {
        extractedData.authority = `${extractedData.authority.trim()}, Japan`;
      }
      if (extractedData.class) {
        extractedData.class = formatJapanLicenseClasses(extractedData.class);
      }
      const cleanCond = getCleanJapanCondition(extractedData);
      extractedData.codes = cleanCond;
      extractedData.explicacionCodigos = cleanCond;
      extractedData.conditions = cleanCond;
      extractedData.explicacion = cleanCond;

      if (extractedData.firstName && !extractedData.firstNames) {
        extractedData.firstNames = extractedData.firstName;
      } else if (extractedData.firstNames && !extractedData.firstName) {
        extractedData.firstName = extractedData.firstNames;
      }
    }

    // Germany document detection & codes normalization
    const isGermanDoc = matchedKey === 'german' ||
                        matchedKey === 'germany' ||
                        matchedKey === 'alemania' ||
                        matchedKey === 'deutschland' ||
                        getNormalizedCountryKey(extractedData.country || '') === 'german' ||
                        /alemania|germany|deutschland/i.test(country) ||
                        (!matchedKey && !extractedData.country && /german|alemania|deutsch/i.test(extractedData.nationality || '')) ||
                        (!matchedKey && !extractedData.country && /germany|alemania|deutschland/i.test(extractedData.authority || ''));

    if (isGermanDoc) {
      if (!extractedData.nationality || extractedData.nationality === '-' || extractedData.nationality.trim() === '') {
        extractedData.nationality = 'German';
      }
      if (extractedData.authority && !extractedData.authority.toLowerCase().includes('germany')) {
        extractedData.authority = `${extractedData.authority.trim()}, Germany`;
      }
      const cleanGerman = getCleanGermanCodes(extractedData);
      extractedData.codes = cleanGerman;
      extractedData.explicacionCodigos = cleanGerman;
      extractedData.conditions = cleanGerman;
      extractedData.explicacion = cleanGerman;
    }

    // Italian authority normalization
    const isItalyDoc = matchedKey === 'italia' || /MC[-/\s]?[A-Z]{2}|MIT-UCO|UCO|MIT-DTT|DTT/i.test(extractedData.authority || '') || /ital/i.test(country);
    if (isItalyDoc && extractedData.authority) {
      extractedData.authority = normalizeItalianAuthority(extractedData.authority);
    }

    // Netherlands document detection & citizen synchronization
    const isNetherlandsDoc = matchedKey === 'netherlands' ||
                             matchedKey === 'holanda' ||
                             getNormalizedCountryKey(extractedData.country || '') === 'netherlands' ||
                             /netherland|holand|pa[íi]ses bajos|dutch/i.test(extractedData.nationality || '') ||
                             /netherland|holand|rijbewijs|rdw/i.test(extractedData.authority || '') ||
                             /netherland|holand|pa[íi]ses bajos/i.test(country);

    if (isNetherlandsDoc) {
      if (!extractedData.nationality || extractedData.nationality === '-' || extractedData.nationality.trim() === '') {
        extractedData.nationality = 'Dutch';
      }
      if (extractedData.authority && !/netherlands/i.test(extractedData.authority)) {
        extractedData.authority = `${extractedData.authority.trim().replace(/,\s*$/, '')}, Netherlands`;
      }
      // Synchronize citizen from all possible fields (BSN, RSN, citizenNumber, etc.)
      const rawNlCitizen = extractedData.citizen ||
                           extractedData.bsn ||
                           extractedData.rsn ||
                           extractedData.citizenNumber ||
                           extractedData.citizen_number ||
                           extractedData.burgerservicenummer ||
                           extractedData.bsnNumber ||
                           extractedData.bsn_number ||
                           extractedData.citizenNo;
      if (rawNlCitizen && rawNlCitizen !== '-' && String(rawNlCitizen).trim() !== '') {
        extractedData.citizen = String(rawNlCitizen).trim();
      } else if ((!extractedData.citizen || extractedData.citizen === '-' || extractedData.citizen.trim() === '') && extractedData.codes) {
        // Fallback: check if codes contains the top-left numbers (e.g. "206307779 / 5353983213" or "RSN 206307779 / 5353983213")
        const codeStr = String(extractedData.codes).trim();
        const digitGroups = codeStr.match(/\d{6,12}/g);
        if (digitGroups && digitGroups.length >= 2) {
          extractedData.citizen = `${digitGroups[0]} / ${digitGroups[1]}`;
          extractedData.codes = '-';
        } else if (/\d{6,12}/.test(codeStr)) {
          extractedData.citizen = codeStr;
          extractedData.codes = '-';
        }
      }

      // Clean citizen field if it has RSN or BSN text prefix
      if (extractedData.citizen && extractedData.citizen !== '-') {
        const cStr = String(extractedData.citizen).trim();
        const matches = cStr.match(/\d+/g);
        if (matches && matches.length >= 2 && /RSN|BSN/i.test(cStr)) {
          extractedData.citizen = `${matches[0]} / ${matches[1]}`;
        }
      }
    }

    // Norway document detection & personal (Point 4d) synchronization
    const isNorwayDoc = matchedKey === 'norway' ||
                        matchedKey === 'noruega' ||
                        getNormalizedCountryKey(extractedData.country || '') === 'norway' ||
                        /norway|noruega|norge|norwegian|norsk/i.test(extractedData.nationality || '') ||
                        /norway|noruega|statens vegvesen|vegvesen/i.test(extractedData.authority || '') ||
                        /norway|noruega/i.test(country);

    if (isNorwayDoc) {
      if (!extractedData.nationality || extractedData.nationality === '-' || extractedData.nationality.trim() === '') {
        extractedData.nationality = 'Norwegian';
      }
      if (extractedData.authority && !/norway/i.test(extractedData.authority)) {
        extractedData.authority = `${extractedData.authority.trim().replace(/,\s*$/, '')}, Norway`;
      }
      // Synchronize personal (section 4d)
      const rawNorwayPersonal = extractedData.personal ||
                                extractedData.point4d ||
                                extractedData.sec4d ||
                                extractedData.personalNumber ||
                                extractedData.personal_number ||
                                extractedData.personalId ||
                                extractedData.idNumber;
      if (rawNorwayPersonal && rawNorwayPersonal !== '-' && String(rawNorwayPersonal).trim() !== '') {
        extractedData.personal = String(rawNorwayPersonal).trim();
        extractedData.point4d = extractedData.personal;
      } else if ((!extractedData.personal || extractedData.personal === '-' || extractedData.personal.trim() === '') && extractedData.assignedNumber) {
        // Fallback: if Gemini stored 4d in assignedNumber (e.g. "090700 85051" or 11 digits)
        const assignedStr = String(extractedData.assignedNumber).trim();
        if (/\d{6}[\s-]?\d{5}/.test(assignedStr) || /^\d{11}$/.test(assignedStr.replace(/\s+/g, ''))) {
          extractedData.personal = assignedStr;
          extractedData.point4d = assignedStr;
          extractedData.assignedNumber = '-';
        }
      }
      if (extractedData.personal) {
        extractedData.point4d = extractedData.personal;
      }
    }

    // Indonesia document detection & synchronization
    const isIndonesiaDoc = matchedKey === 'indonesia' ||
                           matchedKey === 'indonesian' ||
                           getNormalizedCountryKey(extractedData.country || '') === 'indonesia' ||
                           /indonesia|indonesian/i.test(extractedData.nationality || '') ||
                           /korlantas|polri|surat izin mengemudi|polda|polres/i.test(extractedData.authority || '') ||
                           /indonesia/i.test(country);

    if (isIndonesiaDoc) {
      if (!extractedData.nationality || extractedData.nationality === '-' || extractedData.nationality.trim() === '') {
        extractedData.nationality = 'Indonesian';
      }
      if (extractedData.authority && !/indonesia/i.test(extractedData.authority)) {
        extractedData.authority = `${extractedData.authority.trim().replace(/,\s*$/, '')}, Indonesia`;
      }
      // Clean address prefix if Gemini extracted "ALAMAT:"
      if (extractedData.address && typeof extractedData.address === 'string') {
        extractedData.address = extractedData.address.replace(/^alamat\s*[:\-–—]?\s*/i, '').trim();
      }
      // Ensure code and codes
      if (extractedData.code && (!extractedData.codes || extractedData.codes === '-')) {
        extractedData.codes = extractedData.code;
      } else if (extractedData.codes && (!extractedData.code || extractedData.code === '-')) {
        extractedData.code = extractedData.codes;
      }
      // Ensure blood and Blood
      if (extractedData.blood && (!extractedData.Blood || extractedData.Blood === '-')) {
        extractedData.Blood = extractedData.blood;
      } else if (extractedData.Blood && (!extractedData.blood || extractedData.blood === '-')) {
        extractedData.blood = extractedData.Blood;
      }
    }

    // Denmark document detection & personal (Point 4d / CPR) synchronization
    const isDenmarkDoc = matchedKey === 'denmark' ||
                         matchedKey === 'dinamarca' ||
                         matchedKey === 'danmark' ||
                         getNormalizedCountryKey(extractedData.country || '') === 'denmark' ||
                         /danish|dansk/i.test(extractedData.nationality || '') ||
                         /denmark|dinamarca|danmark|rigspolitiet/i.test(extractedData.authority || '') ||
                         /denmark|dinamarca|danmark/i.test(country);

    if (isDenmarkDoc) {
      if (!extractedData.nationality || extractedData.nationality === '-' || extractedData.nationality.trim() === '') {
        extractedData.nationality = 'Danish';
      }
      if (extractedData.authority && !/denmark/i.test(extractedData.authority)) {
        extractedData.authority = `${extractedData.authority.trim().replace(/,\s*$/, '')}, Denmark`;
      }
      // Synchronize personal (section 4d / CPR number)
      const rawDkPersonal = extractedData.personal ||
                            extractedData.point4d ||
                            extractedData.sec4d ||
                            extractedData.cpr ||
                            extractedData.cprNumber ||
                            extractedData.cpr_nummer ||
                            extractedData.personalNumber ||
                            extractedData.personal_number ||
                            extractedData.personalId;
      if (rawDkPersonal && rawDkPersonal !== '-' && String(rawDkPersonal).trim() !== '') {
        extractedData.personal = String(rawDkPersonal).trim();
        extractedData.point4d = extractedData.personal;
      } else if ((!extractedData.personal || extractedData.personal === '-' || extractedData.personal.trim() === '') && extractedData.assignedNumber) {
        // Fallback: if Gemini stored 4d in assignedNumber (e.g. "140406-5021" or 10 digits DDMMYY-XXXX)
        const assignedStr = String(extractedData.assignedNumber).trim();
        if (/\d{6}[\s-]?\d{4}/.test(assignedStr)) {
          extractedData.personal = assignedStr;
          extractedData.point4d = assignedStr;
          extractedData.assignedNumber = '-';
        }
      }
      if (extractedData.personal) {
        extractedData.point4d = extractedData.personal;
      }
    }

    // Format license classes
    if (extractedData.class) {
      extractedData.class = formatLicenseClasses(extractedData.class, isChinaDoc, isJapanDoc);
    }

    // Generate class descriptions fallback if missing, or filter if already present
    const currentClassDesc = typeof extractedData.classDescriptions === 'string' ? extractedData.classDescriptions.trim() : '';
    if (!currentClassDesc || currentClassDesc === '-') {
      if (extractedData.class) {
        if (isChinaDoc) {
          extractedData.classDescriptions = generateChinaClassDescriptions(extractedData.class);
        } else if (isBrazilDoc) {
          extractedData.classDescriptions = generateBrazilClassDescriptions(extractedData.class);
        } else if (isItalyDoc) {
          extractedData.classDescriptions = generateItalyClassDescriptions(extractedData.class);
        } else {
          extractedData.classDescriptions = generateClassDescriptions(extractedData.class);
        }
      }
    } else {
      if (isItalyDoc) {
        extractedData.classDescriptions = filterClassDescriptionsByHeldClasses(extractedData.classDescriptions, extractedData.class, 'italia');
      } else {
        extractedData.classDescriptions = filterClassDescriptionsByHeldClasses(extractedData.classDescriptions, extractedData.class, matchedKey);
      }
    }

    // Sanitize authority to ensure strictly the single genuine country is present
    const docCountryHint = matchedKey || 
                          getNormalizedCountryKey(extractedData.country || '') || 
                          getNormalizedCountryKey(country || '') || 
                          extractedData.country || 
                          country || 
                          extractedData.nationality || '';
    if (extractedData.authority) {
      extractedData.authority = sanitizeAuthority(extractedData.authority, docCountryHint);
    }
  }

  return extractedData;
};
