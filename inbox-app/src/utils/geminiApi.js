import { GoogleGenerativeAI } from "@google/generative-ai";
import { BASE_PROMPT, COUNTRY_RULES } from "../config/countryPrompts";
import { generateClassDescriptions, formatCategoriesDates } from "./classDescriptions";

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

// Helper function to handle generation with retries and cascading fallbacks
const generateWithRetryAndFallback = async (genAI, promptParts, modelList, shouldParseJson = false, onChunk = null) => {
  let lastError = null;
  
  for (const modelName of modelList) {
    let retries = 3; // Try up to 3 times for each model if temporary errors occur
    while (retries > 0) {
      try {
        console.log(`Ejecutando modelo: ${modelName} (Intento ${4 - retries})`);
        const model = genAI.getGenerativeModel({ model: modelName });
        
        // 45-second timeout promise race for vision OCR tasks
        const timeoutPromise = new Promise((_, reject) => 
          setTimeout(() => reject(new Error(`Timeout de 45s alcanzado en ${modelName}`)), 45000)
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
          console.warn(`Error temporal de servidores (${errorMsg}) en ${modelName}. Reintentando en 1.5s... (intentos restantes: ${retries - 1})`);
          await new Promise(resolve => setTimeout(resolve, 1500));
          retries--;
          continue;
        }
        
        console.warn(`Modelo ${modelName} falló: ${errorMsg}. Pasando al siguiente modelo fallback.`);
        break; // Pass to next model family
      }
    }
  }
  
  if (lastError) {
    const errorMsg = lastError.message || '';
    if (errorMsg.includes('503') || errorMsg.includes('high demand') || errorMsg.includes('overloaded')) {
      throw new Error("Los servidores de Gemini en Google están experimentando alta demanda temporal (Error 503). Por favor espera 5 a 10 segundos y vuelve a presionar 'Procesar con IA'.");
    }
    if (errorMsg.includes('429') || errorMsg.includes('Quota exceeded') || errorMsg.includes('quota')) {
      throw new Error("Límite de cuota gratuita alcanzado en Google AI Studio (429 Rate Limit). Por favor espera 20 a 30 segundos y vuelve a presionar 'Procesar con IA', o agrega tu propia API Key en Settings.");
    }
  }
  
  throw new Error(`Todos los modelos de Gemini fallaron. Último error: ${lastError ? lastError.message : 'Desconocido'}`);
};

let cachedModelsList = null;

const getValidModels = async (apiKey) => {
  if (cachedModelsList && cachedModelsList.length > 0) return cachedModelsList;

  const priorityOrder = [
    "gemini-1.5-flash",
    "gemini-2.0-flash-exp",
    "gemini-2.0-flash",
    "gemini-1.5-pro",
    "gemini-1.5-flash-8b"
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

  return priorityOrder;
};

export const extractLicenseData = async (apiKey, base64Images, country, onChunk = null) => {
  if (!apiKey) throw new Error("API Key de Gemini no encontrada. Agrégala en Settings.");
  
  const genAI = new GoogleGenerativeAI(apiKey);
  const models = await getValidModels(apiKey);
  
  let countryKey = country ? country.toLowerCase() : '';
  if (countryKey.includes('alemania') || countryKey.includes('germany') || countryKey.includes('deutschland')) {
    countryKey = 'alemania';
  } else if (countryKey.includes('denmark') || countryKey.includes('dinamarca') || countryKey.includes('danmark')) {
    countryKey = 'denmark';
  } else if (countryKey.includes('taiwan') || countryKey.includes('taiwán')) {
    countryKey = 'taiwan';
  } else if (countryKey.includes('suiza') || countryKey.includes('swiss') || countryKey.includes('switzerland')) {
    countryKey = 'suiza';
  }

  const availableCountries = Object.keys(COUNTRY_RULES);
  let matchedKey = availableCountries.find(key => countryKey && (countryKey.includes(key) || key.includes(countryKey)));
  
  if (!matchedKey) {
    // Default to japan rules if country key not specified
    matchedKey = 'japon';
  }

  const specificRules = COUNTRY_RULES[matchedKey] || COUNTRY_RULES['japon'];
  console.log("Using country rules for:", matchedKey);
  
  const fullPrompt = `${BASE_PROMPT}\n\n### MANDATORY COUNTRY RULES:\n${specificRules}\n\nSTRICT FINAL OVERRIDE INSTRUCTIONS:\n- NEVER OUTPUT ANY JAPANESE CHARACTERS (Kanji, Hiragana, Katakana) OR PARENTHESES WITH JAPANESE in any output JSON field.\n- Translate all names, categories, and conditions strictly to English in Title Case.\n- Follow the mandatory country rules above.\n\nAnalyze the provided driver's license images and extract the data as instructed.`;
  
  const imageParts = base64Images.map(img => {
    // Extract base64 part and mime type
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

  // Post-processing and country-specific fallbacks
  if (extractedData && typeof extractedData === 'object') {
    if (matchedKey === 'denmark' || matchedKey === 'dinamarca') {
      // Middle name fallback to "-" for Denmark if empty
      if (!extractedData.middleName || typeof extractedData.middleName !== 'string' || extractedData.middleName.trim() === '' || extractedData.middleName.trim() === '""') {
        extractedData.middleName = '-';
      }
      
      // Personal / point4d sync from section 4d
      const sec4d = (extractedData.personal && extractedData.personal.trim() !== '' && extractedData.personal !== '-') 
        ? extractedData.personal 
        : ((extractedData.point4d && extractedData.point4d.trim() !== '' && extractedData.point4d !== '-') ? extractedData.point4d : '-');
      extractedData.personal = sec4d;
      extractedData.point4d = sec4d;

      // Codes / explicacionCodigos sync from section 12, default to "-" if empty
      const condCodes = (extractedData.codes && extractedData.codes.trim() !== '' && extractedData.codes !== '-') 
        ? extractedData.codes 
        : ((extractedData.explicacionCodigos && extractedData.explicacionCodigos.trim() !== '' && extractedData.explicacionCodigos !== '-') ? extractedData.explicacionCodigos : '-');
      extractedData.codes = condCodes;
      extractedData.explicacionCodigos = condCodes;

      // Format categoriesDates grouping for Denmark
      if (extractedData.categoriesDates) {
        extractedData.categoriesDates = formatCategoriesDates(extractedData.categoriesDates);
      }
    } else if (matchedKey === 'taiwan' || matchedKey === 'taiwán') {
      const condVal = (extractedData.conditions && typeof extractedData.conditions === 'string' && extractedData.conditions.trim() !== '')
        ? extractedData.conditions
        : ((extractedData.codes && typeof extractedData.codes === 'string' && extractedData.codes.trim() !== '') ? extractedData.codes : ((extractedData.explicacionCodigos && typeof extractedData.explicacionCodigos === 'string' && extractedData.explicacionCodigos.trim() !== '') ? extractedData.explicacionCodigos : '-'));
      extractedData.conditions = condVal;
      extractedData.codes = condVal;
      extractedData.explicacionCodigos = condVal;
    } else if (matchedKey === 'alemania' || matchedKey === 'germany' || matchedKey === 'deutschland') {
      const germanCodeMap = {
        '01': '01- Vision correction and/or protection device',
        '01.01': '01.01- Spectacles',
        '01.02': '01.02- Contact lens(es)',
        '01.06': '01.06- Spectacles or contact lenses',
        '70': '70- Exchange of driver\'s license number, issued by',
        '171': '171- Class C1, also valid for motor vehicles of class D with a maximum permissible mass not exceeding 7,500 kg, but without passengers.',
        '172': '172- Class C, valid also for motor vehicles of class D, but without passengers.',
        '79.03': '79.03- Only three-wheeled vehicles',
        '79.04': '79.04- Only vehicle combinations of three-wheeled vehicles and a trailer with a maximum permissible mass not exceeding 750 kg.',
        '79.06': '79.06- Vehicles (vehicle combination) of category BE, provided that the maximum permissible mass of the trailer exceeds 3,500 kg.',
        '79': '79 (C1E > 12.000 kg, L ≤ 3)- Restriction of class CE due to the authorization resulting from the previous class 3 to drive three-axle trains with a towing vehicle of class C1 and more than 12,000 kg total mass and trains with a towing vehicle of class C1 and trailers without registration, where the total mass can be more than 12,000 kg and three-axle trains consisting of a towing vehicle of class C1 and a trailer, where the maximum permissible mass of the trailer exceeds the unladen mass of the towing vehicle (part not covered by C1E). The aforementioned authorizations do not apply to semitrailers with a total permissible mass of more than 7.5 tons. The letter L in this code stands for the number of axles.',
        '174': '174- Class L, also valid for driving tractors with a maximum speed determined by their design of not more than 40 km/h, also with a single-axle trailer (whereby axles with a distance of less than 1.0 m from each other are considered to be one axle) as well as combinations of these tractors and trailers, if they are driven at a speed of not more than 25 km/h',
        '175': '175- Class L, also valid for driving motor vehicles with a maximum speed determined by their design of not more than 25 km/h and for driving motor vehicles other than those belonging to classes A, A1, A2 and AM with an engine capacity of not more than 50 cm3',
        '181': '181- Class T, only valid for motor vehicles of class S (since 19.1.2013 AM)',
        '197': '197- The test was taken on a motor vehicle with automatic transmission and practical training for driving class B vehicles with manual transmission was completed.'
      };

      const rawCombined = [
        extractedData.codes,
        extractedData.explicacionCodigos,
        extractedData.conditions,
        extractedData.categoriesDates
      ].filter(Boolean).join(' ');

      const matchedDescriptions = [];

      for (const [codeKey, desc] of Object.entries(germanCodeMap)) {
        const escaped = codeKey.replace('.', '\\.');
        const regex = new RegExp(`(?:^|\\s|,|;|\\b)${escaped}(?:$|\\s|,|;|\\b|-|\\.)`, 'i');
        if (regex.test(rawCombined)) {
          if (!matchedDescriptions.includes(desc)) {
            matchedDescriptions.push(desc);
          }
        }
      }

      let finalCodesText = '-';
      if (matchedDescriptions.length > 0) {
        finalCodesText = matchedDescriptions.join('\n');
      } else {
        const rawTrimmed = (extractedData.codes || extractedData.explicacionCodigos || extractedData.conditions || '').trim();
        if (rawTrimmed && rawTrimmed !== '-') {
          finalCodesText = rawTrimmed;
        }
      }

      extractedData.codes = finalCodesText;
      extractedData.explicacionCodigos = finalCodesText;
    }
    else if (matchedKey === 'suiza' || matchedKey === 'swiss' || matchedKey === 'switzerland') {
      const swissCodeMap = {
        '920e': '920E- Professional passenger transport (BPT) exemption/authorization',
        '957': '957- Professional passenger transport permission / local authority endorsement',
        '920': '920- Professional passenger transport (BPT)',
        '101': '101- Special vehicle modification / handicap adaptation',
        '106': '106- Probationary driver\'s license period (Probeführerausweis)',
        '108': '108- Professional transport of passengers (BPT)',
        '121': '121- Professional transport of passengers (BPT)',
        '122': '122- Student/school bus transport',
        '01': '01- Prescribed spectacles or contact lenses',
        '01.01': '01.01- Prescribed spectacles',
        '01.06': '01.06- Prescribed spectacles or contact lenses',
        '70': '70- Exchange of driver\'s license',
        '71': '71- Duplicate driver\'s license',
        '78': '78- Limited to automatic transmission vehicles'
      };

      let currentCodes = (extractedData.explicacionCodigos || extractedData.codes || '').trim();
      if (currentCodes && currentCodes !== '-') {
        const tokens = currentCodes.split(/[\s,;]+/);
        const mapped = [];
        for (const t of tokens) {
          const key = t.trim().toLowerCase();
          if (swissCodeMap[key]) {
            mapped.push(swissCodeMap[key]);
          }
        }
        if (mapped.length > 0 && !currentCodes.toLowerCase().includes('professional') && !currentCodes.toLowerCase().includes('spectacles')) {
          currentCodes = mapped.join('\n');
        }
      }

      const finalCond = (currentCodes && currentCodes.trim() !== '') ? currentCodes : '-';
      extractedData.codes = finalCond;
      extractedData.explicacionCodigos = finalCond;
    }

    const cd = extractedData.classDescriptions;
    if (!cd || typeof cd !== 'string' || cd.trim() === '' || cd.trim() === '-') {
      if (extractedData.class) {
        extractedData.classDescriptions = generateClassDescriptions(extractedData.class);
      }
    }
  }

  return extractedData;
};
