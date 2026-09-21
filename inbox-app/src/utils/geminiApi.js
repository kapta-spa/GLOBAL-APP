import { GoogleGenerativeAI } from "@google/generative-ai";
import { BASE_PROMPT, COUNTRY_RULES } from "../config/countryPrompts";
import { generateClassDescriptions, generateBrazilClassDescriptions, generateChinaClassDescriptions, formatCategoriesDates, formatLicenseClasses } from "./classDescriptions";

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

export const getNormalizedCountryKey = (country = '') => {
  if (!country || typeof country !== 'string') return '';
  const c = country.toLowerCase().trim();
  if (/china|chino|chinese/i.test(c)) return 'china';
  if (/alemania|german|germany|deutsch|berlin|munich|münchen|hamburg|frankfurt|cologne|köln|stuttgart|düsseldorf|leipzig|dresden|hannover|nürnberg|bonn|führerschein|fahrerlaubnis/i.test(c)) return 'german';
  if (/francia.*pink|france.*pink/i.test(c)) return 'francia_pink';
  if (/francia|france|french|paris/i.test(c)) return 'francia';
  if (/brazil|brasil|cnh|detran|denatran|senatran/i.test(c)) return 'brazil';
  if (/belgica|belgique|belgium|bruxelles|brussels/i.test(c)) return 'belgica';
  if (/canada|canad/i.test(c)) return 'canada';
  if (/czech|checa|česk|prague|praha/i.test(c)) return 'czech';
  if (/denmark|dinamarca|danmark|copenhagen|københavn/i.test(c)) return 'denmark';
  if (/finland|finlandia|helsinki|suomi/i.test(c)) return 'finland';
  if (/hungria|hungary|budapest|magyar/i.test(c)) return 'hungria';
  if (/indonesia|jakarta/i.test(c)) return 'indonesia';
  if (/israel|tel aviv|jerusalem/i.test(c)) return 'israel';
  if (/italia|italy|roma|rome|milano/i.test(c)) return 'italia';
  if (/japon|japan|tokyo|nihon|nippon/i.test(c)) return 'japan';
  if (/korea|corea|seoul/i.test(c)) return 'korea';
  if (/latino|chile|mexico|méxico|colombia|argentina|peru|perú|uruguay/i.test(c)) return 'latino';
  if (/netherland|holand|pa[ií]ses bajos|dutch|amsterdam/i.test(c)) return 'netherlands';
  if (/norway|noruega|oslo|norge/i.test(c)) return 'norway';
  if (/portugal|lisboa|lisbon|portug/i.test(c)) return 'portugal';
  if (/spain|espa[nñ]a|madrid|barcelona/i.test(c)) return 'spain';
  if (/suiza|swiss|switzerland|zürich|zurich|geneva|genève|schweiz/i.test(c)) return 'swiss';
  if (/swedish|suecia|sweden|stockholm|sverige/i.test(c)) return 'swedish';
  if (/taiwan|taiw[aá]n|taipei/i.test(c)) return 'taiwan';
  if (/vietnam|hanoi|saigon|ho chi minh/i.test(c)) return 'vietnam';
  return '';
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

  // Field synchronization without deleting valid fields
  if (extractedData && typeof extractedData === 'object') {
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

    // Synchronize codes and explicacionCodigos
    if (extractedData.codes && (!extractedData.explicacionCodigos || extractedData.explicacionCodigos === '-')) {
      extractedData.explicacionCodigos = extractedData.codes;
    } else if (extractedData.explicacionCodigos && (!extractedData.codes || extractedData.codes === '-')) {
      extractedData.codes = extractedData.explicacionCodigos;
    }

    // Synchronize barcode and file numbers for China
    if (extractedData.barcode && !extractedData.barcodeNumber) extractedData.barcodeNumber = extractedData.barcode;
    if (extractedData.barcodeNumber && !extractedData.barcode) extractedData.barcode = extractedData.barcodeNumber;
    if (extractedData.file && !extractedData.fileNumber) extractedData.fileNumber = extractedData.file;
    if (extractedData.fileNo && !extractedData.fileNumber) extractedData.fileNumber = extractedData.fileNo;

    // Synchronize Brazil specifics
    if (matchedKey === 'brazil') {
      if (extractedData.surname) extractedData.surname = extractedData.surname.toUpperCase().trim();
      if (extractedData.firstName) extractedData.firstName = extractedData.firstName.toUpperCase().trim();
      if (extractedData.parents) extractedData.parents = extractedData.parents.toUpperCase().trim();
      if (!extractedData.nationality || extractedData.nationality === '-') extractedData.nationality = 'Brazilian';
      if (!extractedData.gender || extractedData.gender === '-') extractedData.gender = 'Not stated';
      extractedData.sex = extractedData.gender;
    }

    // Normalize date strings
    const dateKeys = ['dateOfBirth', 'issueDate', 'expiryDate', 'firstIssued', 'firstObtained', 'categoriesDates'];
    dateKeys.forEach(dk => {
      if (extractedData[dk] && typeof extractedData[dk] === 'string') {
        extractedData[dk] = normalizeDateToEnglish(extractedData[dk]);
      }
    });

    // Format license classes
    const isChinaDoc = matchedKey === 'china' || Boolean(extractedData.barcodeNumber && extractedData.barcodeNumber !== '-');
    if (extractedData.class) {
      extractedData.class = formatLicenseClasses(extractedData.class, isChinaDoc);
    }

    // Generate class descriptions fallback if missing
    if (!extractedData.classDescriptions || extractedData.classDescriptions.trim() === '' || extractedData.classDescriptions === '-') {
      if (extractedData.class) {
        if (isChinaDoc) {
          extractedData.classDescriptions = generateChinaClassDescriptions(extractedData.class);
        } else if (matchedKey === 'brazil') {
          extractedData.classDescriptions = generateBrazilClassDescriptions(extractedData.class);
        } else {
          extractedData.classDescriptions = generateClassDescriptions(extractedData.class);
        }
      }
    }
  }

  return extractedData;
};
