import { GoogleGenerativeAI } from "@google/generative-ai";
import { BASE_PROMPT, COUNTRY_RULES } from "../config/countryPrompts";
import { generateClassDescriptions, generateBrazilClassDescriptions, formatCategoriesDates } from "./classDescriptions";

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

const optimizeBase64Image = (base64Str, maxDimension = 2400, quality = 0.95) => {
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

// Helper function to handle generation with retries and cascading fallbacks
const generateWithRetryAndFallback = async (genAI, promptParts, modelList, shouldParseJson = false, onChunk = null) => {
  let lastError = null;
  
  for (const modelName of modelList) {
    let retries = 2; // Try up to 2 times per model to fail fast
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
        
        // 28-second timeout promise race for fast failover
        const timeoutPromise = new Promise((_, reject) => 
          setTimeout(() => reject(new Error(`Timeout alcanzado en ${modelName}`)), 28000)
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
        break; // Pass to next model family
      }
    }
  }
  
  if (lastError) {
    const errorMsg = lastError.message || '';
    if (errorMsg.includes('503') || errorMsg.includes('high demand') || errorMsg.includes('overloaded')) {
      throw new Error("Los servidores de Gemini en Google están experimentando alta demanda temporal (Error 503). Por favor reintenta en unos segundos.");
    }
    if (errorMsg.includes('429') || errorMsg.includes('Quota exceeded') || errorMsg.includes('quota')) {
      throw new Error("Límite de cuota gratuita alcanzado en Google AI Studio (429 Rate Limit). Por favor espera unos segundos.");
    }
  }
  
  throw new Error(`Todos los modelos de Gemini fallaron. Último error: ${lastError ? lastError.message : 'Desconocido'}`);
};

let cachedModelsList = null;

const getValidModels = async (apiKey) => {
  if (cachedModelsList && cachedModelsList.length > 0) return cachedModelsList;

  const priorityOrder = [
    "gemini-2.5-flash",
    "gemini-2.0-flash",
    "gemini-1.5-pro",
    "gemini-1.5-flash",
    "gemini-2.0-flash-exp",
    "gemini-2.5-pro",
    "gemini-2.0-flash-lite"
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
  if (s === '-' || s.toLowerCase() === 'indefinite' || s.toLowerCase() === 'none') return s;

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

  // Case: YYYY/MM/DD
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

export const extractLicenseData = async (apiKey, base64Images, country = '', onChunk = null) => {
  if (!apiKey) throw new Error("API Key de Gemini no encontrada. Agrégala en Settings.");
  
  const genAI = new GoogleGenerativeAI(apiKey);
  const models = await getValidModels(apiKey);
  
  let countryKey = country ? country.toLowerCase() : '';
  if (countryKey.includes('brazil') || countryKey.includes('brasil') || countryKey.includes('cnh') || countryKey.includes('portuguese')) {
    countryKey = 'brazil';
  } else if (countryKey.includes('dinamarca') || countryKey.includes('danmark') || countryKey.includes('denmark') || countryKey.includes('danish')) {
    countryKey = 'denmark';
  } else if (countryKey.includes('alemania') || countryKey.includes('germany') || countryKey.includes('deutschland') || countryKey.includes('deutsch')) {
    countryKey = 'alemania';
  } else if (countryKey.includes('francia') || countryKey.includes('france') || countryKey.includes('french') || countryKey.includes('franc')) {
    countryKey = 'francia';
  } else if (countryKey.includes('china') || countryKey.includes('chinese') || countryKey.includes('chino')) {
    countryKey = 'china';
  } else if (countryKey.includes('japon') || countryKey.includes('japan') || countryKey.includes('japanese')) {
    countryKey = 'japon';
  } else if (countryKey.includes('taiwan') || countryKey.includes('taiwán')) {
    countryKey = 'taiwan';
  } else if (countryKey.includes('suiza') || countryKey.includes('swiss') || countryKey.includes('switzerland')) {
    countryKey = 'suiza';
  } else if (countryKey.includes('canada') || countryKey.includes('canadá')) {
    countryKey = 'canada';
  } else if (countryKey.includes('netherlands') || countryKey.includes('holanda') || countryKey.includes('países bajos') || countryKey.includes('paises bajos') || countryKey.includes('dutch')) {
    countryKey = 'netherlands';
  } else if (countryKey.includes('hungria') || countryKey.includes('hungary')) {
    countryKey = 'hungria';
  } else if (countryKey.includes('vietnam') || countryKey.includes('vietnamese')) {
    countryKey = 'vietnam';
  } else if (countryKey.includes('indonesia')) {
    countryKey = 'indonesia';
  } else if (countryKey.includes('chile') || countryKey.includes('mexico') || countryKey.includes('méxico') || countryKey.includes('argentina') || countryKey.includes('uruguay') || countryKey.includes('colombia') || countryKey.includes('peru') || countryKey.includes('perú') || countryKey.includes('latino')) {
    countryKey = 'latino';
  }

  const availableCountries = Object.keys(COUNTRY_RULES);
  let matchedKey = availableCountries.find(key => countryKey && (countryKey.includes(key) || key.includes(countryKey)));
  
  if (!matchedKey && countryKey) {
    if (countryKey.includes('franc')) matchedKey = 'francia';
    else if (countryKey.includes('chin')) matchedKey = 'china';
    else if (countryKey.includes('aleman') || countryKey.includes('german')) matchedKey = 'alemania';
    else if (countryKey.includes('brazil') || countryKey.includes('brasil') || countryKey.includes('cnh')) matchedKey = 'brazil';
    else if (countryKey.includes('japon') || countryKey.includes('japan')) matchedKey = 'japon';
  }

  let specificRules = matchedKey ? (COUNTRY_RULES[matchedKey] || '') : '';
  if (!specificRules) {
    // Universal auto-detection prompt if country is not explicitly specified in folder
    specificRules = `
### AUTO-DETECT COUNTRY & DOCUMENT TYPE:
Carefully inspect the driver's license images and identify the issuing jurisdiction:
1. IF BRAZIL (Carteira Nacional de Habilitação - CNH / DETRAN / REPÚBLICA FEDERATIVA DO BRASIL):
   - All text output in English.
   - All dates formatted as "DD Month YYYY" (e.g. "04 December 1987").
   - "authority": Translate DETRAN/authority to "State Traffic Department, <State in English>, Brazil".
   - "surname", "firstName", "middleName", "firstNames", "fullName" in UPPERCASE.
   - "licenseNumber": Main central registration number (Nº Registro).
   - "cardNumber": Left margin vertical serial number (Nº Espelho).
   - "idDocument": Section 4c (Doc. Identidade, e.g. "2066946852 SJS RS" or "392634570 SSP SP").
   - "cpf": Section 4d (CPF, e.g. "025.810.390-60").
   - "parents": Parents' names from FILIAÇÃO in UPPERCASE.
   - "firstObtained": Date from 1ª HABILITAÇÃO formatted as "DD Month YYYY".
   - "placeOfBirth": Section 3 (Localidade, e.g. "Porto Alegre, Rio Grande do Sul, Brazil").
   - "conditions": Translate Section 12 Observações ('A' -> 'Prescribed spectacles / Corrective lenses', 'EAR' -> 'Exercises remunerated activity', 'B' -> 'Hearing aid mandatory', or 'None').
   - "nationality": "Brazilian".
   - "gender": "Not stated".
2. IF CHINA (中华人民共和国机动车驾驶证):
   - "licenseNumber": 18-digit identity number.
   - "barcodeNumber": Digits printed under barcode.
   - "fileNumber": File number (档案编号).
   - "class": e.g. "C1", "C2".
   - "nationality": "Chinese".
3. IF GERMANY / FRANCE / EU:
   - Extract point 4c authority, point 4d personal number, category dates and section 12 codes.
`;
  }
  console.log("Using country rules for:", matchedKey || 'auto-detect');
  
  const fullPrompt = `${BASE_PROMPT}\n\n### MANDATORY COUNTRY RULES:\n${specificRules}\n\nSTRICT FINAL OVERRIDE INSTRUCTIONS:\n- Translate all names, categories, and conditions strictly to English.\n- Format all dates as 'DD Month YYYY' (e.g., '04 December 1987').\n- Extract EVERY available identification field (licenseNumber, cardNumber, idDocument, cpf, parents, firstObtained, etc.).\n\nAnalyze the provided driver's license images and extract the data as instructed.`;
  
  // Optimize & resize images in parallel before sending to Gemini API
  const optimizedBase64s = await Promise.all(
    base64Images.map(img => optimizeBase64Image(img, 1600, 0.85))
  );

  const imageParts = optimizedBase64s.map(img => {
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
    if (matchedKey === 'canada') {
      const canadaFields = [
        'surname', 'firstName', 'middleName', 'firstNames', 'fullName',
        'licenseNumber', 'assignedNumber', 'dateOfBirth', 'placeOfBirth',
        'issueDate', 'expiryDate', 'address', 'reference', 'height',
        'eye', 'eyeColor', 'sex', 'gender', 'authority', 'class',
        'categoriesDates', 'codes', 'explicacionCodigos', 'conditions'
      ];

      // Format & map Eye Color
      const eyeMap = {
        'br': 'Brown', 'marron': 'Brown', 'brown': 'Brown',
        'bl': 'Blue', 'bleu': 'Blue', 'blue': 'Blue',
        'vr': 'Green', 'vert': 'Green', 'green': 'Green',
        'gr': 'Grey', 'gris': 'Grey', 'grey': 'Grey', 'gray': 'Grey',
        'hz': 'Hazel', 'hazel': 'Hazel',
        'bk': 'Black', 'black': 'Black'
      };

      if (extractedData.eye && typeof extractedData.eye === 'string') {
        const rawEye = extractedData.eye.trim().toLowerCase();
        if (eyeMap[rawEye]) extractedData.eye = eyeMap[rawEye];
      }
      if (extractedData.eyeColor && typeof extractedData.eyeColor === 'string') {
        const rawEyeCol = extractedData.eyeColor.trim().toLowerCase();
        if (eyeMap[rawEyeCol]) extractedData.eyeColor = eyeMap[rawEyeCol];
      }

      const finalEye = (extractedData.eye && typeof extractedData.eye === 'string' && extractedData.eye.trim() !== '' && extractedData.eye !== '-')
        ? extractedData.eye
        : ((extractedData.eyeColor && typeof extractedData.eyeColor === 'string' && extractedData.eyeColor.trim() !== '' && extractedData.eyeColor !== '-') ? extractedData.eyeColor : '-');
      extractedData.eye = finalEye;
      extractedData.eyeColor = finalEye;

      // Format & map Sex / Gender
      const sexMap = { 'm': 'Male', 'f': 'Female', 'x': 'X', 'male': 'Male', 'female': 'Female' };
      if (extractedData.sex && typeof extractedData.sex === 'string') {
        const rawSex = extractedData.sex.trim().toLowerCase();
        if (sexMap[rawSex]) extractedData.sex = sexMap[rawSex];
      }
      if (extractedData.gender && typeof extractedData.gender === 'string') {
        const rawGen = extractedData.gender.trim().toLowerCase();
        if (sexMap[rawGen]) extractedData.gender = sexMap[rawGen];
      }
      const finalSex = (extractedData.sex && typeof extractedData.sex === 'string' && extractedData.sex.trim() !== '' && extractedData.sex !== '-')
        ? extractedData.sex
        : ((extractedData.gender && typeof extractedData.gender === 'string' && extractedData.gender.trim() !== '' && extractedData.gender !== '-') ? extractedData.gender : '-');
      extractedData.sex = finalSex;
      extractedData.gender = finalSex;

      // Sync codes / explicacionCodigos / conditions
      const finalCodes = (extractedData.codes && typeof extractedData.codes === 'string' && extractedData.codes.trim() !== '' && extractedData.codes !== '-')
        ? extractedData.codes
        : ((extractedData.explicacionCodigos && typeof extractedData.explicacionCodigos === 'string' && extractedData.explicacionCodigos.trim() !== '' && extractedData.explicacionCodigos !== '-')
          ? extractedData.explicacionCodigos
          : ((extractedData.conditions && typeof extractedData.conditions === 'string' && extractedData.conditions.trim() !== '' && extractedData.conditions !== '-') ? extractedData.conditions : '-'));
      extractedData.codes = finalCodes;
      extractedData.explicacionCodigos = finalCodes;
      extractedData.conditions = finalCodes;

      // Ensure every single field is filled or defaulted to '-'
      canadaFields.forEach(field => {
        const val = extractedData[field];
        if (val === undefined || val === null || val === 'null' || val === 'undefined' || (typeof val === 'string' && val.trim() === '')) {
          extractedData[field] = '-';
        }
      });

      // Build fullName if needed
      if (!extractedData.fullName || extractedData.fullName === '-') {
        const parts = [extractedData.surname, extractedData.firstName, extractedData.middleName].filter(p => p && p !== '-');
        if (parts.length > 0) {
          extractedData.fullName = parts.join(' ');
        }
      }
    } else if (matchedKey === 'denmark' || matchedKey === 'dinamarca') {
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
    else if (matchedKey === 'latino') {
      let exp = (extractedData.explicacion && extractedData.explicacion.trim() !== '' && extractedData.explicacion !== '-')
        ? extractedData.explicacion.trim()
        : ((extractedData.explicacionCodigos && extractedData.explicacionCodigos.trim() !== '' && extractedData.explicacionCodigos !== '-') ? extractedData.explicacionCodigos.trim() : '');

      let rawClass = (extractedData.class || '').trim();
      if (!exp && rawClass && rawClass !== '-') {
        const generatedDesc = generateClassDescriptions(rawClass);
        if (generatedDesc && generatedDesc.trim() !== '') {
          exp = generatedDesc;
        }
      }

      const finalExp = (exp && exp.trim() !== '') ? exp : '-';
      extractedData.explicacion = finalExp;
      extractedData.explicacionCodigos = finalExp;

      // Gender: Male, Female or "-"
      if (extractedData.gender && typeof extractedData.gender === 'string') {
        const gLow = extractedData.gender.trim().toLowerCase();
        if (gLow === 'male' || gLow === 'm' || gLow === 'masculino' || gLow === 'hombre') {
          extractedData.gender = 'Male';
        } else if (gLow === 'female' || gLow === 'f' || gLow === 'femenino' || gLow === 'mujer') {
          extractedData.gender = 'Female';
        } else if (gLow === '' || gLow === '-' || gLow === 'null' || gLow === 'undefined') {
          extractedData.gender = '-';
        }
      } else {
        extractedData.gender = '-';
      }

      // Organs: Yes or No if specified, else remove (delete key or empty string)
      if (extractedData.organs && typeof extractedData.organs === 'string') {
        const oLow = extractedData.organs.trim().toLowerCase();
        if (oLow === 'yes' || oLow === 'si' || oLow === 'sí' || oLow === 'donante' || oLow === 'true') {
          extractedData.organs = 'Yes';
        } else if (oLow === 'no' || oLow === 'false' || oLow === 'no donante') {
          extractedData.organs = 'No';
        } else {
          delete extractedData.organs;
        }
      } else {
        delete extractedData.organs;
      }

      // Address: keep if specified, else delete/remove
      if (!extractedData.address || typeof extractedData.address !== 'string' || extractedData.address.trim() === '' || extractedData.address.trim() === '-' || extractedData.address.trim().toLowerCase() === 'null') {
        delete extractedData.address;
      }

      // Nationality: keep in English if specified, else delete/remove
      if (!extractedData.nationality || typeof extractedData.nationality !== 'string' || extractedData.nationality.trim() === '' || extractedData.nationality.trim() === '-' || extractedData.nationality.trim().toLowerCase() === 'null') {
        delete extractedData.nationality;
      }
    } else if (matchedKey === 'netherlands' || matchedKey === 'holanda') {
      let cit = (extractedData.citizen && typeof extractedData.citizen === 'string') ? extractedData.citizen.trim() : '';
      if (!cit || cit === '-') {
        if (extractedData.bsn) cit = extractedData.bsn;
      }
      extractedData.citizen = cit || '-';

      if (extractedData.class) {
        const permDesc = generateClassDescriptions(extractedData.class);
        if (permDesc && permDesc.trim() !== '') {
          extractedData.classDescriptions = permDesc;
        }
      }

      if (extractedData.categoriesDates) {
        extractedData.categoriesDates = formatCategoriesDates(extractedData.categoriesDates);
      }

      let rawCodes = (extractedData.explicacionCodigos && extractedData.explicacionCodigos.trim() !== '' && extractedData.explicacionCodigos !== '-') 
        ? extractedData.explicacionCodigos.trim() 
        : ((extractedData.codes && extractedData.codes.trim() !== '' && extractedData.codes !== '-') ? extractedData.codes.trim() : '');

      if (rawCodes) {
        const cleanRaw = rawCodes.replace(/[\s\/,-]+/g, '');
        const cleanCit = cit.replace(/[\s\/,-]+/g, '');
        if ((cleanCit && cleanCit !== '-' && (cleanRaw === cleanCit || cleanRaw.includes(cleanCit))) || /^\d{8,}[\s\/,-]*\d*$/.test(rawCodes.trim())) {
          rawCodes = '-';
        }
      }

      const finalCodes = (rawCodes && rawCodes.trim() !== '') ? rawCodes : '-';
      extractedData.codes = finalCodes;
      extractedData.explicacionCodigos = finalCodes;
    }

    const isBrazilDoc = matchedKey === 'brazil' || matchedKey === 'brasil' ||
      (extractedData.nationality && /brazil|brasil/i.test(extractedData.nationality)) ||
      (extractedData.authority && /brazil|brasil|detran|denatran|senatran/i.test(extractedData.authority)) ||
      (extractedData.cpf && extractedData.cpf !== '-' && /^\d{3}\.\d{3}\.\d{3}-\d{2}$/.test(extractedData.cpf)) ||
      (extractedData.idDocument && extractedData.idDocument !== '-' && /ssp|sjs|detran|cnh/i.test(extractedData.idDocument)) ||
      Boolean(extractedData.parents && extractedData.parents !== '-' && extractedData.parents.trim().length > 3 && !extractedData.barcodeNumber);

    if (isBrazilDoc) {
      const stateMap = {
        'ac': 'Acre', 'al': 'Alagoas', 'ap': 'Amapá', 'am': 'Amazonas',
        'ba': 'Bahia', 'ce': 'Ceará', 'df': 'Federal District', 'es': 'Espírito Santo',
        'go': 'Goiás', 'ma': 'Maranhão', 'mt': 'Mato Grosso', 'ms': 'Mato Grosso do Sul',
        'mg': 'Minas Gerais', 'pa': 'Pará', 'pb': 'Paraíba', 'pr': 'Paraná',
        'pe': 'Pernambuco', 'pi': 'Piauí', 'rj': 'Rio de Janeiro', 'rn': 'Rio Grande do Norte',
        'rs': 'Rio Grande do Sul', 'ro': 'Rondônia', 'rr': 'Roraima', 'sc': 'Santa Catarina',
        'sp': 'São Paulo', 'se': 'Sergipe', 'to': 'Tocantins',
        'distrito federal': 'Federal District', 'sao paulo': 'São Paulo', 'rio de janeiro': 'Rio de Janeiro',
        'minas gerais': 'Minas Gerais', 'santa catarina': 'Santa Catarina', 'rio grande do sul': 'Rio Grande do Sul',
        'rio grande do norte': 'Rio Grande do Norte', 'mato grosso do sul': 'Mato Grosso do Sul', 'mato grosso': 'Mato Grosso',
        'espirito santo': 'Espírito Santo'
      };

      // 1. Format Authority (Scan authority, idDocument, placeOfBirth for state)
      let auth = (extractedData.authority || '').trim();
      let stateName = '';

      // Check direct DETRAN match
      const detranMatch = auth.match(/detran[\s\/-]*([a-zA-Z\s]+)/i) || auth.match(/([a-zA-Z\s]+)[\s\/-]*detran/i);
      if (detranMatch) {
        const rawState = detranMatch[1].trim().toLowerCase();
        stateName = stateMap[rawState] || '';
      }

      // If not found in DETRAN, check state codes across authority, idDocument, placeOfBirth
      if (!stateName) {
        const combinedText = `${auth} ${extractedData.idDocument || ''} ${extractedData.placeOfBirth || ''}`;
        for (const [code, name] of Object.entries(stateMap)) {
          const regex = new RegExp(`\\b${code}\\b`, 'i');
          if (regex.test(combinedText)) {
            stateName = name;
            break;
          }
        }
      }

      if (stateName) {
        extractedData.authority = `State Traffic Department, ${stateName}, Brazil`;
      } else if (/detran/i.test(auth)) {
        let cleanAuth = auth.replace(/detran/gi, 'State Traffic Department');
        if (!cleanAuth.toLowerCase().includes('brazil')) {
          cleanAuth = `${cleanAuth}, Brazil`;
        }
        extractedData.authority = cleanAuth;
      } else if (!auth || auth.toLowerCase().includes('senatran')) {
        extractedData.authority = 'State Traffic Department, Brazil';
      } else if (!auth.toLowerCase().endsWith('brazil')) {
        extractedData.authority = `${auth}, Brazil`;
      }

      // 2. Format Place of Birth (Expand state codes)
      if (extractedData.placeOfBirth && typeof extractedData.placeOfBirth === 'string' && extractedData.placeOfBirth !== '-') {
        let pob = extractedData.placeOfBirth.trim();
        for (const [code, name] of Object.entries(stateMap)) {
          if (code.length <= 2) {
            const regex = new RegExp(`(?:,\\s*|\\s+|-|/|\\b)${code}(?:,\\s*|\\s+|-|/|\\b|$)`, 'i');
            if (regex.test(pob) && !pob.toLowerCase().includes(name.toLowerCase())) {
              pob = pob.replace(regex, `, ${name}, `).replace(/,\s*,/g, ',').replace(/\s+/g, ' ').trim();
              break;
            }
          }
        }
        pob = pob.replace(/,\s*$/, '').trim();
        if (!pob.toLowerCase().includes('brazil')) {
          pob = `${pob}, Brazil`;
        }
        extractedData.placeOfBirth = pob;
      }

      // 3. Format / Translate Brazilian condition codes
      const brazilCodeMap = {
        'a': 'Prescribed spectacles / Corrective lenses',
        'ear': 'Exercises remunerated activity',
        'b': 'Hearing aid mandatory',
        'c': 'Helmet / Protection mandatory',
        'd': 'Vehicle with automatic transmission',
        'e': 'Vehicle with adapted steering',
        'f': 'Vehicle with left foot acceleration / automatic clutch',
        'g': 'Adapted hand controls',
        'h': 'Adapted foot controls'
      };

      let cond = (extractedData.conditions || extractedData.explicacionCodigos || extractedData.codes || '').trim();
      if (cond && cond !== '-' && cond.toLowerCase() !== 'none') {
        const tokens = cond.split(/[\s,;\/\-]+/);
        const translatedList = [];
        for (const t of tokens) {
          const lowT = t.toLowerCase().trim();
          if (brazilCodeMap[lowT] && !translatedList.includes(brazilCodeMap[lowT])) {
            translatedList.push(brazilCodeMap[lowT]);
          }
        }
        if (translatedList.length > 0 && !cond.toLowerCase().includes('spectacles') && !cond.toLowerCase().includes('activity') && !cond.toLowerCase().includes('hearing')) {
          cond = translatedList.join('\n');
        }
      } else {
        cond = 'None';
      }
      extractedData.conditions = cond;
      extractedData.codes = cond;
      extractedData.explicacionCodigos = cond;

      // 4. Class Descriptions
      extractedData.classDescriptions = generateBrazilClassDescriptions(extractedData.class || 'B');

      // 5. First Obtained & Categories Dates sync
      const firstDate = (extractedData.firstObtained && extractedData.firstObtained !== '-' && extractedData.firstObtained.trim() !== '')
        ? extractedData.firstObtained.trim()
        : ((extractedData.categoriesDates && extractedData.categoriesDates !== '-' && extractedData.categoriesDates.trim() !== '') ? extractedData.categoriesDates.trim() : '');
      if (firstDate) {
        extractedData.firstObtained = firstDate;
        extractedData.categoriesDates = firstDate;
      }

      // 6. Normalize Names (Uppercase for Brazilian CNH)
      if (extractedData.surname) extractedData.surname = extractedData.surname.toUpperCase().trim();
      if (extractedData.firstName) extractedData.firstName = extractedData.firstName.toUpperCase().trim();
      if (extractedData.parents) extractedData.parents = extractedData.parents.toUpperCase().trim();

      if (!extractedData.middleName || extractedData.middleName.trim() === '' || extractedData.middleName === '""' || extractedData.middleName === '-') {
        extractedData.middleName = '';
      } else {
        extractedData.middleName = extractedData.middleName.toUpperCase().trim();
      }

      if (!extractedData.firstNames || extractedData.firstNames.trim() === '') {
        const parts = [extractedData.firstName, extractedData.middleName].filter(Boolean);
        extractedData.firstNames = parts.join(' ');
      }
      if (!extractedData.fullName || extractedData.fullName.trim() === '') {
        const parts = [extractedData.surname, extractedData.firstName, extractedData.middleName].filter(Boolean);
        extractedData.fullName = parts.join(' ');
      }

      // 7. Default Nationality & Gender
      if (!extractedData.nationality || extractedData.nationality.trim() === '' || extractedData.nationality === '-') {
        extractedData.nationality = 'Brazilian';
      }
      if (!extractedData.gender || extractedData.gender === '-' || extractedData.gender.toLowerCase() === 'not stated') {
        extractedData.gender = 'Not stated';
      }
      extractedData.sex = extractedData.gender;

      // 8. Ensure all other Brazil fields default to '-' if empty
      const idFields = ['cardNumber', 'idDocument', 'cpf', 'parents', 'firstObtained', 'address', 'placeOfBirth'];
      idFields.forEach(f => {
        if (!extractedData[f] || typeof extractedData[f] !== 'string' || extractedData[f].trim() === '' || extractedData[f] === '""') {
          extractedData[f] = '-';
        }
      });
    }

    // Universal field synchronization and completion across all countries
    if (extractedData.firstName && !extractedData.firstNames) {
      extractedData.firstNames = extractedData.firstName;
    } else if (extractedData.firstNames && !extractedData.firstName) {
      extractedData.firstName = extractedData.firstNames;
    }

    if (!extractedData.fullName || extractedData.fullName === '-' || extractedData.fullName.trim() === '') {
      const nameParts = [extractedData.surname, extractedData.firstName, extractedData.middleName].filter(p => p && p !== '-' && p.trim() !== '');
      if (nameParts.length > 0) {
        extractedData.fullName = nameParts.join(' ');
      }
    }

    // Sync categoriesDates and firstObtained
    if (extractedData.firstObtained && (!extractedData.categoriesDates || extractedData.categoriesDates === '-')) {
      extractedData.categoriesDates = extractedData.firstObtained;
    } else if (extractedData.categoriesDates && (!extractedData.firstObtained || extractedData.firstObtained === '-')) {
      extractedData.firstObtained = extractedData.categoriesDates;
    }

    // Sync eye and eyeColor
    if (extractedData.eye && (!extractedData.eyeColor || extractedData.eyeColor === '-')) {
      extractedData.eyeColor = extractedData.eye;
    } else if (extractedData.eyeColor && (!extractedData.eye || extractedData.eye === '-')) {
      extractedData.eye = extractedData.eyeColor;
    }

    // Sync sex and gender
    if (extractedData.sex && (!extractedData.gender || extractedData.gender === '-')) {
      extractedData.gender = extractedData.sex;
    } else if (extractedData.gender && (!extractedData.sex || extractedData.sex === '-')) {
      extractedData.sex = extractedData.gender;
    }

    // Universal Date Formatting to "DD Month YYYY"
    const dateKeys = ['dateOfBirth', 'issueDate', 'expiryDate', 'firstIssued', 'firstObtained', 'categoriesDates'];
    dateKeys.forEach(dk => {
      if (extractedData[dk] && typeof extractedData[dk] === 'string') {
        extractedData[dk] = normalizeDateToEnglish(extractedData[dk]);
      }
    });

    const cd = extractedData.classDescriptions;
    if (!cd || typeof cd !== 'string' || cd.trim() === '' || cd.trim() === '-') {
      if (extractedData.class) {
        if (isBrazilDoc) {
          extractedData.classDescriptions = generateBrazilClassDescriptions(extractedData.class);
        } else {
          extractedData.classDescriptions = generateClassDescriptions(extractedData.class);
        }
      }
    }
  }

  return extractedData;
};
