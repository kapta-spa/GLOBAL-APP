export const OFFICIAL_CLASS_DESCRIPTIONS = {
  "AM": "AM: Mopeds and light quadricycles not exceeding 45 km/h",
  "A1": "A1: Light motorcycles with a cylinder capacity not more than 125 cc and a power rating less than 11 kW",
  "A2": "A2: Motorcycles with a power rating under 35 kW",
  "A": "A: Heavy motorcycles without power restrictions",
  "B": "B: Passenger cars and motor vehicles up to 3,500 kg permissible maximum mass",
  "BE": "BE: Vehicle of category B towing a heavy trailer of under 3,500 kg",
  "B1": "B1: Quadricycles",
  "C1": "C1: Goods vehicles between 3,500 kg and 7,500 kg and for up to eight passengers",
  "C1E": "C1E: Vehicle of category C1 or B towing a heavy trailer, with a combined mass of up to 12,000 kg",
  "C": "C: Goods vehicles weighing more than 3,500 kg and seating not more than eight passengers",
  "CE": "CE: Vehicle of category C towing a heavy trailer",
  "D1": "D1: Passenger vehicles built for fewer than 16 passengers and that is no longer than 8 m",
  "D1E": "D1E: Vehicle of category D1 towing a heavy trailer",
  "D": "D: Passenger vehicles for more than eight passengers",
  "DE": "DE: Vehicle of category D towing a heavy trailer",
  "LK": "LK: Small moped with a maximum speed of 30 km/h (Now included in AM class)",
  "TM": "TM: Tractor/Motorised equipment",
  "L": "L: Agricultural and forestry tractors with a maximum design speed up to 40 km/h",
  "T": "T: Agricultural tractors with a maximum design speed up to 60 km/h",
  "M": "M: Mopeds with maximum design speed up to 45 km/h",
  "S": "S: Trikes, quadricycles and microcars"
};

export const BRAZIL_CLASS_DESCRIPTIONS = {
  "A": "A: Driver of a two or three-wheeled motor vehicle, with or without sidecar.",
  "B": "B: Driver of a motor vehicle, not covered by category A, with a total gross weight not exceeding 3,500 kg and having not more than 8 seats, excluding the driver's seat.",
  "C": "C: Driver of a motor vehicle used for transporting cargo, not covered by category B, with a total gross weight exceeding 3,500 kg.",
  "D": "D: Driver of a motor vehicle used for passenger transport, whose capacity exceeds 8 seats, excluding the driver's seat.",
  "E": "E: Driver of a combination of vehicles in which the towing unit falls into categories B, C or D and the towed unit has a total gross weight of 6,000 kg or more, or whose capacity exceeds 8 seats.",
  "ACC": "ACC: Driver of mopeds up to 50 cc."
};

export const CHINA_CLASS_DESCRIPTIONS = {
  "A1": "A1: Large passenger cars and A3, B1, B2.",
  "A2": "A2: Heavy towing trailers and B1, B2, C6.",
  "A3": "A3: City buses and C1.",
  "B1": "B1: Medium passenger cars and C1, M.",
  "B2": "B2: Large trucks and C1, M.",
  "C1": "C1: Small passenger cars and C2, C3.",
  "C2": "C2: Small automatic passenger cars.",
  "C3": "C3: Low-speed trucks and C4.",
  "C4": "C4: Three-wheeled motor vehicles.",
  "C5": "C5: Small automatic passenger cars for disabled persons.",
  "C6": "C6: Light towing trailers.",
  "D": "D: For Ordinary three wheeled motorcycles (over 50cc / 50km/h) & E.",
  "E": "E: For two-wheeled motorcycles (over 50cc / 50km/h) & F.",
  "F": "F: For mopeds (max. 50cc / 50km/h).",
  "M": "M: For wheel type vehicles.",
  "N": "N: For trolleybuses.",
  "P": "P: For trams."
};

export const generateChinaClassDescriptions = (classString) => {
  return [
    "A1: Large passenger cars and A3, B1, B2.",
    "A2: Heavy towing trailers and B1, B2, C6.",
    "A3: City buses and C1.",
    "B1: Medium passenger cars and C1, M.",
    "B2: Large trucks and C1, M.",
    "C1: Small passenger cars and C2, C3.",
    "C2: Small automatic passenger cars.",
    "C3: Low-speed trucks and C4.",
    "C4: Three-wheeled motor vehicles.",
    "C5: Small automatic passenger cars for disabled persons.",
    "C6: Light towing trailers.",
    "D: For Ordinary three wheeled motorcycles (over 50cc / 50km/h) & E.",
    "E: For two-wheeled motorcycles (over 50cc / 50km/h) & F.",
    "F: For mopeds (max. 50cc / 50km/h).",
    "M: For wheel type vehicles.",
    "N: For trolleybuses.",
    "P: For trams."
  ].join('\n');
};

export const generateBrazilClassDescriptions = (classString) => {
  const rawUpper = (classString || '').toUpperCase();
  const heldClasses = [];

  if (rawUpper.includes('AB')) {
    heldClasses.push('A', 'B');
  } else {
    if (rawUpper.includes('ACC')) heldClasses.push('ACC');
    if (/\bA\b|A[,\s\/]/.test(rawUpper)) heldClasses.push('A');
    if (/\bB\b|B[,\s\/]/.test(rawUpper)) {
      // In Brazilian standard translation, Category B includes Category A definition as reference
      if (!heldClasses.includes('A')) heldClasses.push('A');
      heldClasses.push('B');
    }
    if (/\bC\b|C[,\s\/]/.test(rawUpper)) heldClasses.push('C');
    if (/\bD\b|D[,\s\/]/.test(rawUpper)) heldClasses.push('D');
    if (/\bE\b|E[,\s\/]/.test(rawUpper)) heldClasses.push('E');
  }

  if (heldClasses.length === 0) {
    heldClasses.push('A', 'B');
  }

  const lines = heldClasses.map(cls => BRAZIL_CLASS_DESCRIPTIONS[cls]).filter(Boolean);
  lines.push('Source:');
  lines.push('https://www.detran.sp.gov.br/wps/portal/portaldetran/cidadao/habilitacao/fichaservico/');

  return lines.join('\n');
};

export const formatClassDescriptions = (str) => {
  if (!str || typeof str !== 'string') return str || '';
  const lines = str.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
  if (lines.length > 1) {
    return lines.map(l => l.replace(/^(AM|A1|A2|A|B1|BE|B|C1E|C1|CE|C|D1E|D1|DE|D|LK|TM|L|T|M|S)\s*[-–]\s*/i, '$1: ')).join('\n');
  }

  const single = lines[0] || str.trim();
  const splitRegex = /(?:^|\s+)(AM|A1|A2|A|B1|BE|B|C1E|C1|CE|C|D1E|D1|DE|D|LK|TM|L|T|M|S)\s*[:\-–]\s*/gi;
  const parts = single.split(splitRegex).filter(Boolean);
  if (parts.length >= 2) {
    const formatted = [];
    for (let i = 0; i < parts.length; i += 2) {
      const code = parts[i]?.trim().toUpperCase();
      const desc = parts[i + 1]?.trim().replace(/\.$/, '');
      if (code && desc) {
        formatted.push(`${code}: ${desc}`);
      }
    }
    if (formatted.length > 0) return formatted.join('\n');
  }

  return single;
};

export const generateClassDescriptions = (classString) => {
  if (!classString || typeof classString !== 'string') return '';
  
  const rawTokens = classString.split(/[\s,;\n\/]+/);
  const foundClasses = [];
  
  for (let token of rawTokens) {
    const clean = token.replace(/^(class|vehiculo|vehicle|categor[ií]a)/i, '').trim().toUpperCase();
    if (OFFICIAL_CLASS_DESCRIPTIONS[clean] && !foundClasses.includes(clean)) {
      foundClasses.push(clean);
    }
  }
  
  return foundClasses.map(cls => OFFICIAL_CLASS_DESCRIPTIONS[cls]).join('\n');
};

export const ITALIAN_PROVINCES = {
  "AG": "Agrigento",
  "AL": "Alessandria",
  "AN": "Ancona",
  "AO": "Aosta",
  "AR": "Arezzo",
  "AP": "Ascoli Piceno",
  "AT": "Asti",
  "AV": "Avellino",
  "BA": "Bari",
  "BT": "Barletta-Andria-Trani",
  "BL": "Belluno",
  "BN": "Benevento",
  "BG": "Bergamo",
  "BI": "Biella",
  "BO": "Bologna",
  "BZ": "Bolzano",
  "BS": "Brescia",
  "BR": "Brindisi",
  "CA": "Cagliari",
  "CL": "Caltanissetta",
  "CB": "Campobasso",
  "CI": "Carbonia-Iglesias",
  "CE": "Caserta",
  "CT": "Catania",
  "CZ": "Catanzaro",
  "CH": "Chieti",
  "CO": "Como",
  "CS": "Cosenza",
  "CR": "Cremona",
  "KR": "Crotone",
  "CN": "Cuneo",
  "EN": "Enna",
  "FM": "Fermo",
  "FE": "Ferrara",
  "FI": "Florence",
  "FG": "Foggia",
  "FC": "Forlì-Cesena",
  "FR": "Frosinone",
  "GE": "Genoa",
  "GO": "Gorizia",
  "GR": "Grosseto",
  "IM": "Imperia",
  "IS": "Isernia",
  "AQ": "L'Aquila",
  "SP": "La Spezia",
  "LT": "Latina",
  "LE": "Lecce",
  "LC": "Lecco",
  "LI": "Livorno",
  "LO": "Lodi",
  "LU": "Lucca",
  "MC": "Macerata",
  "MN": "Mantua",
  "MS": "Massa-Carrara",
  "MT": "Matera",
  "ME": "Messina",
  "MI": "Milan",
  "MO": "Modena",
  "MB": "Monza and Brianza",
  "NA": "Naples",
  "NO": "Novara",
  "NU": "Nuoro",
  "OG": "Ogliastra",
  "OT": "Olbia-Tempio",
  "OR": "Oristano",
  "PD": "Padua",
  "PA": "Palermo",
  "PR": "Parma",
  "PV": "Pavia",
  "PG": "Perugia",
  "PU": "Pesaro and Urbino",
  "PE": "Pescara",
  "PC": "Piacenza",
  "PI": "Pisa",
  "PT": "Pistoia",
  "PN": "Pordenone",
  "PZ": "Potenza",
  "PO": "Prato",
  "RG": "Ragusa",
  "RA": "Ravenna",
  "RC": "Reggio Calabria",
  "RE": "Reggio Emilia",
  "RI": "Rieti",
  "RN": "Rimini",
  "RM": "Rome",
  "RO": "Rovigo",
  "SA": "Salerno",
  "SS": "Sassari",
  "SV": "Savona",
  "SI": "Siena",
  "SR": "Syracuse",
  "SO": "Sondrio",
  "SU": "South Sardinia",
  "TA": "Taranto",
  "TE": "Teramo",
  "TR": "Terni",
  "TO": "Turin",
  "TP": "Trapani",
  "TN": "Trento",
  "TV": "Treviso",
  "TS": "Trieste",
  "UD": "Udine",
  "VA": "Varese",
  "VE": "Venice",
  "VB": "Verbano-Cusio-Ossola",
  "VC": "Vercelli",
  "VR": "Verona",
  "VV": "Vibo Valentia",
  "VI": "Vicenza",
  "VT": "Viterbo"
};

export const normalizeItalianAuthority = (authStr) => {
  if (!authStr || typeof authStr !== 'string') return authStr || '';
  const trimmed = authStr.trim();
  if (!trimmed || trimmed === '-' || trimmed.toLowerCase() === 'none') return trimmed;

  // Already decoded with Civil Motorization or Ministry
  if (/^Civil Motorization\s*[-–]\s*.+,\s*Italy$/i.test(trimmed)) {
    return trimmed;
  }
  if (/^Ministry of Infrastructure and Transport.+,\s*Italy$/i.test(trimmed)) {
    return trimmed;
  }

  const upper = trimmed.toUpperCase();

  // Handle UCO / MIT-UCO
  if (/^(MIT[-–\s]*UCO|UCO|M\.I\.T\.[-–\s]*UCO)/i.test(upper)) {
    return "Ministry of Infrastructure and Transport - Central Operational Office, Italy";
  }

  // Handle DTT / MIT-DTT
  if (/^(MIT[-–\s]*DTT|DTT|M\.I\.T\.[-–\s]*DTT)/i.test(upper)) {
    return "Ministry of Infrastructure and Transport - Department for Land Transport, Italy";
  }

  // Handle MIT alone
  if (/^(MIT|M\.I\.T\.)(?:\s*,?\s*ITALY)?$/i.test(upper)) {
    return "Ministry of Infrastructure and Transport, Italy";
  }

  // Match MC-XX, MC XX, M.C. XX, MCTC-XX, M.C.T.C. XX, DTT-XX
  const mcMatch = upper.match(/(?:MC|M\.C\.|MCTC|M\.C\.T\.C\.|DTT|MOTORIZZAZIONE\s+CIVILE(?:\s+DI)?)\s*[-–\/\s:]*\s*([A-Z]{2})\b/);
  if (mcMatch) {
    const code = mcMatch[1];
    const province = ITALIAN_PROVINCES[code] || code;
    return `Civil Motorization - ${province}, Italy`;
  }

  // Match direct province name after MC or Motorizzazione Civile (e.g. "Motorizzazione Civile Roma" or "MC Teramo")
  for (const [code, prov] of Object.entries(ITALIAN_PROVINCES)) {
    const provRegex = new RegExp(`(?:MC|M\\.C\\.|MCTC|MOTORIZZAZIONE\\s+CIVILE)\\s*[-–\\/\\s:]*\\s*${prov}\\b`, 'i');
    if (provRegex.test(trimmed)) {
      return `Civil Motorization - ${prov}, Italy`;
    }
  }

  // Handle Prefettura / Questura
  const prefMatch = trimmed.match(/(?:Prefettura|Prefecture)(?:\s+di|\s+of)?\s+([A-Za-z\s'-]+)/i);
  if (prefMatch) {
    const city = prefMatch[1].replace(/,?\s*italy/i, '').trim();
    return `Prefecture of ${city}, Italy`;
  }
  const questMatch = trimmed.match(/(?:Questura)(?:\s+di)?\s+([A-Za-z\s'-]+)/i);
  if (questMatch) {
    const city = questMatch[1].replace(/,?\s*italy/i, '').trim();
    return `Police Headquarters - ${city}, Italy`;
  }

  // If it's a 2-letter province code alone (e.g. "TE" or "RM")
  if (ITALIAN_PROVINCES[upper]) {
    return `Civil Motorization - ${ITALIAN_PROVINCES[upper]}, Italy`;
  }

  // Ensure ", Italy" at the end if not already present
  if (!trimmed.toLowerCase().includes('italy')) {
    return `${trimmed}, Italy`;
  }

  return trimmed;
};

export const ITALY_CLASS_DESCRIPTIONS = {
  "AM": "AM - 2-wheel, 3-wheel vehicles and light quadricycles with a maximum design speed of not more than 45 km/h.",
  "A1": "A1 - light motorcycles with a cylinder capacity not more than 125 cubic centimetres and a power rating less than 11 kW.",
  "A2": "A2 - motorcycles with a power rating under 35 kW.",
  "A": "A - heavy motorcycles without power restrictions.",
  "B1": "B1 - heavy motorized quadricycle whose empty weight is a maximum of 450 kg if it is intended for the transport of persons, and 600 kg if it is intended for the transport of goods.",
  "B": "B - passenger vehicles weighing up to 3,500 kg and seating not more than eight passengers, in addition to the driver.",
  "BE": "BE - vehicle of category B towing a heavy trailer of under 3,500 kg.",
  "C1": "C1 - goods vehicles between 3,500 kg and 7,500 kg and for up to eight passengers.",
  "C1E": "C1E - vehicle of category C1 or B towing a heavy trailer; with a combined mass of up to 12,000 kg.",
  "C": "C - goods vehicles weighing more than 3,500 kg and seating not more than eight passengers.",
  "CE": "CE - vehicle of category C towing a heavy trailer.",
  "D1": "D1 - passenger vehicles built for fewer than 16 passengers and that is no longer than 8 m.",
  "D1E": "D1E - vehicle of category D1 towing a heavy trailer.",
  "D": "D - passenger vehicles for more than eight passengers.",
  "DE": "DE - vehicle of category D towing a heavy trailer."
};

export const generateItalyClassDescriptions = (classString) => {
  const heldClasses = extractHeldClasses(classString);
  const selected = heldClasses.length > 0 ? heldClasses : ['B'];

  const lines = selected.map(cls => ITALY_CLASS_DESCRIPTIONS[cls] || OFFICIAL_CLASS_DESCRIPTIONS[cls]).filter(Boolean);
  lines.push('Sources:');
  lines.push('https://eur-lex.europa.eu/EN/legal-content/summary/road-safety-driving-licences.html');
  return lines.join('\n');
};

export const extractHeldClasses = (classString) => {
  if (!classString || typeof classString !== 'string') return [];
  const rawUpper = classString.toUpperCase();
  const tokens = rawUpper.split(/[\s,;\n\/]+/).map(t => t.trim().replace(/^(CLASS|VEHICULO|VEHICLE|CATEGOR[IÍ]A)/i, '')).filter(Boolean);

  const found = [];
  for (let tok of tokens) {
    if ((OFFICIAL_CLASS_DESCRIPTIONS[tok] || ITALY_CLASS_DESCRIPTIONS[tok]) && !found.includes(tok)) {
      found.push(tok);
    }
  }

  if (found.length === 0) {
    const checkOrder = ['C1E', 'C1', 'CE', 'D1E', 'D1', 'DE', 'BE', 'B1', 'AM', 'A1', 'A2', 'A', 'B', 'C', 'D', 'L', 'T', 'M', 'S'];
    for (let c of checkOrder) {
      const regex = new RegExp(`\\b${c}\\b`);
      if (regex.test(rawUpper) && !found.includes(c)) {
        found.push(c);
      }
    }
  }

  return found;
};

export const filterClassDescriptionsByHeldClasses = (classDescriptions, classHeld, countryKey = '') => {
  if (!classDescriptions || typeof classDescriptions !== 'string') {
    if (countryKey === 'italia' || countryKey === 'italy') {
      return generateItalyClassDescriptions(classHeld);
    }
    return generateClassDescriptions(classHeld);
  }

  const held = extractHeldClasses(classHeld);
  if (held.length === 0) return classDescriptions;

  const lines = classDescriptions.split(/\r?\n/).map(l => l.trim()).filter(Boolean);

  // Check if classDescriptions contains excess classes not in held
  const filteredLines = [];
  let containsSource = false;

  for (const line of lines) {
    if (/^sources?:/i.test(line) || /^https?:\/\//i.test(line)) {
      containsSource = true;
      continue;
    }

    const codeMatch = line.match(/^(?:(?:\*\*|\b))(AM|A1|A2|A|B1|BE|B|C1E|C1|CE|C|D1E|D1|DE|D|LK|TM|L|T|M|S)(?:(?:\*\*|\b))\s*[:\-–]\s*/i);
    if (codeMatch) {
      const lineCode = codeMatch[1].toUpperCase();
      if (held.includes(lineCode)) {
        filteredLines.push(line);
      }
    } else {
      filteredLines.push(line);
    }
  }

  if (countryKey === 'italia' || countryKey === 'italy') {
    if (filteredLines.length === 0) {
      return generateItalyClassDescriptions(classHeld);
    }
    const result = [...filteredLines];
    result.push('Sources:');
    result.push('https://eur-lex.europa.eu/EN/legal-content/summary/road-safety-driving-licences.html');
    return result.join('\n');
  }

  if (filteredLines.length > 0) {
    if (containsSource) {
      filteredLines.push('Sources:');
      filteredLines.push('https://eur-lex.europa.eu/EN/legal-content/summary/road-safety-driving-licences.html');
    }
    return filteredLines.join('\n');
  }

  return generateClassDescriptions(classHeld);
};

export const formatCategoriesDates = (str) => {
  if (!str || typeof str !== 'string') return str || '-';
  const trimmed = str.trim();
  if (!trimmed || trimmed === '-' || trimmed.toLowerCase() === 'none') return trimmed;

  // If already a single plain date like "16 December 2022" without colons
  if (!trimmed.includes(':')) {
    return trimmed;
  }

  const lines = trimmed.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
  if (lines.length === 0) return '-';

  const segments = [];
  for (const line of lines) {
    // Split on comma only if followed by another class pattern with colon (e.g. ", B1, B:")
    const matches = line.split(/,(?=\s*[A-Z0-9\s/&]+:)/i);
    for (const match of matches) {
      if (match.trim()) segments.push(match.trim());
    }
  }

  const dateToClasses = new Map();
  const unparsedLines = [];

  for (const seg of segments) {
    const colonIdx = seg.indexOf(':');
    if (colonIdx !== -1) {
      const clsPart = seg.substring(0, colonIdx).trim();
      const datePart = seg.substring(colonIdx + 1).trim();
      if (clsPart && datePart) {
        const classes = clsPart.split(/[\s,]+/).map(c => c.trim()).filter(Boolean);
        if (!dateToClasses.has(datePart)) {
          dateToClasses.set(datePart, []);
        }
        const existing = dateToClasses.get(datePart);
        classes.forEach(c => {
          if (!existing.includes(c)) existing.push(c);
        });
        continue;
      }
    }
    unparsedLines.push(seg);
  }

  if (dateToClasses.size === 0) return trimmed;

  // If all classes share the exact same date and there are no unparsed lines, return only the date
  if (dateToClasses.size === 1 && unparsedLines.length === 0) {
    const [onlyDate] = dateToClasses.keys();
    return onlyDate;
  }

  const resultLines = [];
  for (const [date, classes] of dateToClasses.entries()) {
    resultLines.push(`${classes.join(', ')}: ${date}`);
  }
  if (unparsedLines.length > 0) {
    resultLines.push(...unparsedLines);
  }

  return resultLines.join('\n');
};

export const formatJapanLicenseClasses = (classStr) => {
  if (!classStr || typeof classStr !== 'string') return classStr || '';
  const trimmed = classStr.trim();
  if (!trimmed || trimmed === '-' || trimmed.toLowerCase() === 'none') return trimmed;

  const japanMap = [
    { regex: /普通第二種|普二|ordinary\s*second/i, label: 'Ordinary Second-Class Vehicle' },
    { regex: /大型第二種|大二|heavy\s*second|large\s*second/i, label: 'Heavy Second-Class Vehicle' },
    { regex: /中型第二種|中二|medium\s*second/i, label: 'Medium Second-Class Vehicle' },
    { regex: /準中型|semi[-\s]?medium/i, label: 'Semi-Medium vehicle' },
    { regex: /大型特殊|大特|heavy\s*special|large\s*special/i, label: 'Heavy Special Vehicle' },
    { regex: /小型特殊|小特|small\s*special/i, label: 'Small Special Vehicle' },
    { regex: /大型自動二輪|大自二|heavy\s*motorcycle|large\s*motorcycle/i, label: 'Heavy Motorcycle' },
    { regex: /普通自動二輪|普自二|ordinary\s*motorcycle/i, label: 'Ordinary Motorcycle' },
    { regex: /原動機付自転車|原付|moped/i, label: 'Moped' },
    { regex: /牽引|け引|towing/i, label: 'Towing Vehicle' },
    { regex: /中型|medium/i, label: 'Medium Vehicle' },
    { regex: /大型|heavy|large/i, label: 'Heavy Vehicle' },
    { regex: /普通|ordinary/i, label: 'Ordinary Vehicle' },
  ];

  const tokens = trimmed.split(/[,;\/\n\+]+/).map(t => t.trim()).filter(Boolean);
  const matchedLabels = [];

  for (const tok of tokens) {
    let matched = false;
    for (const item of japanMap) {
      if (item.regex.test(tok)) {
        if (!matchedLabels.includes(item.label)) {
          matchedLabels.push(item.label);
        }
        matched = true;
        break;
      }
    }
    if (!matched) {
      let formatted = tok.trim();
      const lower = formatted.toLowerCase();
      if (lower === 'ordinary' || lower === 'ordinary vehicle') {
        formatted = 'Ordinary Vehicle';
      } else if (lower === 'heavy' || lower === 'heavy vehicle' || lower === 'large' || lower === 'large vehicle') {
        formatted = 'Heavy Vehicle';
      } else if (lower === 'medium' || lower === 'medium vehicle') {
        formatted = 'Medium Vehicle';
      } else if (lower === 'semi-medium' || lower === 'semi medium' || lower === 'semi-medium vehicle' || lower === 'semi medium vehicle') {
        formatted = 'Semi-Medium vehicle';
      } else if (lower === 'moped') {
        formatted = 'Moped';
      } else if (lower.includes('motorcycle')) {
        formatted = formatted.split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(' ');
      } else if (!lower.endsWith('vehicle') && !lower.endsWith('motorcycle') && !lower.endsWith('moped')) {
        formatted = formatted.split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(' ') + ' Vehicle';
      } else {
        formatted = formatted.split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(' ');
      }
      if (!matchedLabels.includes(formatted)) {
        matchedLabels.push(formatted);
      }
    }
  }

  return matchedLabels.length > 0 ? matchedLabels.join(', ') : trimmed;
};

export const normalizeJapanConditions = (conditionStr) => {
  if (!conditionStr || typeof conditionStr !== 'string') return '-';
  const trimmed = conditionStr.trim();
  if (!trimmed || trimmed === '-' || trimmed.toLowerCase() === 'none' || trimmed.toLowerCase() === 'null') return '-';
  
  // Ignore pure numeric serial codes (e.g. 123456, 30602, 182302007045)
  if (/^[\d\s,.-]+$/.test(trimmed)) return '-';

  const lines = trimmed.split(/[\r\n,]+/).map(l => l.trim()).filter(Boolean);
  const translatedLines = [];

  for (let line of lines) {
    if (/^[\d\s,.-]+$/.test(line)) continue;
    if (/眼鏡等|眼鏡|glasses|spectacles/i.test(line)) {
      if (!translatedLines.includes('Prescribed spectacles')) translatedLines.push('Prescribed spectacles');
    } else if (/中型車[（(]8t[）)]と普通車はAT|8t.*AT/i.test(line)) {
      if (!translatedLines.includes('Medium vehicles (8t) and ordinary vehicles limited to AT')) translatedLines.push('Medium vehicles (8t) and ordinary vehicles limited to AT');
    } else if (/5t.*AT|準中型.*5t.*AT/i.test(line)) {
      if (!translatedLines.includes('Semi-medium vehicles (5t) limited to AT')) translatedLines.push('Semi-medium vehicles (5t) limited to AT');
    } else if (/5t|準中型.*5t/i.test(line)) {
      if (!translatedLines.includes('Semi-medium vehicles limited to 5t')) translatedLines.push('Semi-medium vehicles limited to 5t');
    } else if (/8t|中型.*8t/i.test(line)) {
      if (!translatedLines.includes('Medium vehicles limited to 8t')) translatedLines.push('Medium vehicles limited to 8t');
    } else if (/AT車に限る|AT車|AT限定|limited to AT|automatic/i.test(line)) {
      if (!translatedLines.includes('Ordinary vehicles limited to AT')) translatedLines.push('Ordinary vehicles limited to AT');
    } else {
      translatedLines.push(line);
    }
  }

  return translatedLines.length > 0 ? translatedLines.join('\n') : '-';
};

export const getCleanJapanCondition = (data) => {
  if (!data || typeof data !== 'object') return '-';
  const candidates = [
    data.explicacionCodigos,
    data.conditions,
    data.condition,
    data.explicacion,
    data.remarks,
    data.remark,
    data.observations,
    data.observaciones,
    data.notes,
    data.note,
    data.codes
  ];

  for (const cand of candidates) {
    if (!cand || typeof cand !== 'string') continue;
    const norm = normalizeJapanConditions(cand);
    if (norm !== '-') return norm;
  }

  return '-';
};

export const formatLicenseClasses = (classStr, isChina = false, isJapan = false) => {
  if (!classStr || typeof classStr !== 'string') return classStr || '';
  const trimmed = classStr.trim();
  if (!trimmed || trimmed === '-' || trimmed.toLowerCase() === 'none') return trimmed;

  if (isJapan || /ordinary|semi-medium|moped|motorcycle|special|towing|second-class|普通|中型|大型|原付|大自二|普自二|大特|小特|け引|牽引/i.test(trimmed)) {
    return formatJapanLicenseClasses(trimmed);
  }

  // Split by common delimiters (comma, semicolon, slash, whitespace)
  const tokens = trimmed.split(/[,;\/\s+]+/).map(t => t.trim()).filter(Boolean);

  if (tokens.length > 1) {
    const expanded = [];
    for (const tok of tokens) {
      // Check if token itself contains concatenated Chinese classes (e.g. C1E, B2E, A2D)
      const chinaMatches = tok.match(/(?:A[1-3]|B[1-2]|C[1-6]|[DEFMNP])/gi);
      if (chinaMatches && chinaMatches.join('').toUpperCase() === tok.toUpperCase() && chinaMatches.length > 1) {
        expanded.push(...chinaMatches.map(m => m.toUpperCase()));
      } else {
        expanded.push(tok.toUpperCase());
      }
    }
    return Array.from(new Set(expanded)).join(', ');
  }

  // Single token: Check if it's concatenated China classes like "C1E", "C1D", "B2E", "C1C2", "A2E"
  const single = tokens[0] || trimmed;
  const chinaMatches = single.match(/(?:A[1-3]|B[1-2]|C[1-6]|[DEFMNP])/gi);
  if (chinaMatches && chinaMatches.join('').toUpperCase() === single.toUpperCase() && chinaMatches.length > 1) {
    return Array.from(new Set(chinaMatches.map(m => m.toUpperCase()))).join(', ');
  }

  return single.toUpperCase();
};

export const GERMAN_RESTRICTION_CODES = {
  "01": "01- Vision correction and/or protection device",
  "70": "70- Exchange of driver's license number, issued by",
  "171": "171- Class C1, also valid for motor vehicles of class D with a maximum permissible mass not exceeding 7,500 kg, but without passengers.",
  "172": "172- Class C, valid also for motor vehicles of class D, but without passengers.",
  "79.03": "79.03- Only three-wheeled vehicles",
  "79.04": "79.04- Only vehicle combinations of three-wheeled vehicles and a trailer with a maximum permissible mass not exceeding 750 kg.",
  "79.06": "79.06- Vehicles (vehicle combination) of category BE, provided that the maximum permissible mass of the trailer exceeds 3,500 kg.",
  "79": "79 (C1E > 12.000 kg, L ≤ 3)- Restriction of class CE due to the authorization resulting from the previous class 3 to drive three-axle trains with a towing vehicle of class C1 and more than 12,000 kg total mass and trains with a towing vehicle of class C1 and trailers without registration, where the total mass can be more than 12,000 kg and three-axle trains consisting of a towing vehicle of class C1 and a trailer, where the maximum permissible mass of the trailer exceeds the unladen mass of the towing vehicle (part not covered by C1E). The aforementioned authorizations do not apply to semitrailers with a total permissible mass of more than 7.5 tons. The letter L in this code stands for the number of axles.",
  "174": "174- Class L, also valid for driving tractors with a maximum speed determined by their design of not more than 40 km/h, also with a single-axle trailer (whereby axles with a distance of less than 1.0 m from each other are considered to be one axle) as well as combinations of these tractors and trailers, if they are driven at a speed of not more than 25 km/h",
  "175": "175- Class L, also valid for driving motor vehicles with a maximum speed determined by their design of not more than 25 km/h and for driving motor vehicles other than those belonging to classes A, A1, A2 and AM with an engine capacity of not more than 50 cm3",
  "181": "181. Class T, only valid for motor vehicles of class S (since 19.1.2013 AM)",
  "197": "197- The test was taken on a motor vehicle with automatic transmission and practical training for driving class B vehicles with manual transmission was completed."
};

export const normalizeGermanCodes = (codesStr) => {
  if (!codesStr || typeof codesStr !== 'string') return '-';
  const trimmed = codesStr.trim();
  if (!trimmed || trimmed === '-' || trimmed.toLowerCase() === 'none' || trimmed.toLowerCase() === 'null') return '-';

  const results = [];
  const lines = trimmed.split(/[\r\n]+/).map(l => l.trim()).filter(Boolean);

  // If already contains exact full explanations, extract them cleanly
  for (const line of lines) {
    if (/^01\s*[-–—:]\s*Vision correction/i.test(line)) {
      if (!results.includes(GERMAN_RESTRICTION_CODES["01"])) results.push(GERMAN_RESTRICTION_CODES["01"]);
    } else if (/^70\s*[-–—:]\s*Exchange of driver/i.test(line)) {
      if (!results.includes(line)) results.push(line);
    } else if (/^171\s*[-–—:]\s*Class C1/i.test(line)) {
      if (!results.includes(GERMAN_RESTRICTION_CODES["171"])) results.push(GERMAN_RESTRICTION_CODES["171"]);
    } else if (/^172\s*[-–—:]\s*Class C/i.test(line)) {
      if (!results.includes(GERMAN_RESTRICTION_CODES["172"])) results.push(GERMAN_RESTRICTION_CODES["172"]);
    } else if (/^79\.03\s*[-–—:]\s*Only three-wheeled/i.test(line)) {
      if (!results.includes(GERMAN_RESTRICTION_CODES["79.03"])) results.push(GERMAN_RESTRICTION_CODES["79.03"]);
    } else if (/^79\.04\s*[-–—:]\s*Only vehicle combinations/i.test(line)) {
      if (!results.includes(GERMAN_RESTRICTION_CODES["79.04"])) results.push(GERMAN_RESTRICTION_CODES["79.04"]);
    } else if (/^79\.06\s*[-–—:]\s*Vehicles \(vehicle combination\)/i.test(line)) {
      if (!results.includes(GERMAN_RESTRICTION_CODES["79.06"])) results.push(GERMAN_RESTRICTION_CODES["79.06"]);
    } else if (/^79\s*\(C1E.*Restriction of class CE/i.test(line)) {
      if (!results.includes(GERMAN_RESTRICTION_CODES["79"])) results.push(GERMAN_RESTRICTION_CODES["79"]);
    } else if (/^174\s*[-–—:]\s*Class L/i.test(line)) {
      if (!results.includes(GERMAN_RESTRICTION_CODES["174"])) results.push(GERMAN_RESTRICTION_CODES["174"]);
    } else if (/^175\s*[-–—:]\s*Class L/i.test(line)) {
      if (!results.includes(GERMAN_RESTRICTION_CODES["175"])) results.push(GERMAN_RESTRICTION_CODES["175"]);
    } else if (/^181[\.-]\s*Class T/i.test(line)) {
      if (!results.includes(GERMAN_RESTRICTION_CODES["181"])) results.push(GERMAN_RESTRICTION_CODES["181"]);
    } else if (/^197\s*[-–—:]\s*The test was taken/i.test(line)) {
      if (!results.includes(GERMAN_RESTRICTION_CODES["197"])) results.push(GERMAN_RESTRICTION_CODES["197"]);
    }
  }

  if (results.length > 0) {
    return results.join('\n');
  }

  // Parse raw codes, numbers, and phrases
  const text = trimmed;

  // Code 01
  if (/\b01(?:\.0[1-6])?\b|vision\s*correction|spectacles|lenses|brille/i.test(text)) {
    results.push(GERMAN_RESTRICTION_CODES["01"]);
  }

  // Code 70
  const match70 = text.match(/\b70(?:\.|\s*[-–—:])?\s*([A-Za-z0-9\.\/\s\(\)]+)?/i);
  if (/\b70\b|exchange\s*of\s*driver/i.test(text)) {
    const rawAfter = match70 && match70[1] ? match70[1].trim() : '';
    if (rawAfter && !/^\d+$/.test(rawAfter) && !/^(vision|class|only|restriction|the test)/i.test(rawAfter) && rawAfter.length > 2 && rawAfter.length < 50) {
      results.push(`70- Exchange of driver's license number, issued by ${rawAfter.replace(/^issued by\s*/i, '').trim()}`);
    } else {
      results.push(GERMAN_RESTRICTION_CODES["70"]);
    }
  }

  // Code 171
  if (/\b171\b|Class\s*C1.*without\s*passengers/i.test(text)) {
    results.push(GERMAN_RESTRICTION_CODES["171"]);
  }

  // Code 172
  if (/\b172\b|Class\s*C.*without\s*passengers/i.test(text)) {
    results.push(GERMAN_RESTRICTION_CODES["172"]);
  }

  // Code 79.03
  if (/\b79\.03\b|three-wheeled\s*vehicles/i.test(text)) {
    results.push(GERMAN_RESTRICTION_CODES["79.03"]);
  }

  // Code 79.04
  if (/\b79\.04\b|combinations\s*of\s*three-wheeled/i.test(text)) {
    results.push(GERMAN_RESTRICTION_CODES["79.04"]);
  }

  // Code 79.06
  if (/\b79\.06\b|category\s*BE.*exceeds\s*3,?500\s*kg/i.test(text)) {
    results.push(GERMAN_RESTRICTION_CODES["79.06"]);
  }

  // Code 79 (C1E > 12.000 kg, L <= 3)
  if (/\b79\s*\(\s*C1E|\b79\s*C1E|Restriction\s*of\s*class\s*CE\s*due\s*to/i.test(text) || (/\b79\b/.test(text) && !/\b79\.(?:03|04|06)\b/.test(text))) {
    results.push(GERMAN_RESTRICTION_CODES["79"]);
  }

  // Code 174
  if (/\b174\b|Class\s*L.*not\s*more\s*than\s*40\s*km\/h/i.test(text)) {
    results.push(GERMAN_RESTRICTION_CODES["174"]);
  }

  // Code 175
  if (/\b175\b|Class\s*L.*not\s*more\s*than\s*25\s*km\/h/i.test(text)) {
    results.push(GERMAN_RESTRICTION_CODES["175"]);
  }

  // Code 181
  if (/\b181\b|Class\s*T.*class\s*S/i.test(text)) {
    results.push(GERMAN_RESTRICTION_CODES["181"]);
  }

  // Code 197
  if (/\b197\b|automatic\s*transmission.*manual/i.test(text)) {
    results.push(GERMAN_RESTRICTION_CODES["197"]);
  }

  return results.length > 0 ? Array.from(new Set(results)).join('\n') : '-';
};

export const getCleanGermanCodes = (data) => {
  if (!data || typeof data !== 'object') return '-';
  const candidates = [
    data.codes,
    data.explicacionCodigos,
    data.conditions,
    data.condition,
    data.explicacion,
    data.remarks,
    data.remark,
    data.observations,
    data.observaciones,
    data.notes,
    data.note,
    data.restrictions,
    data.restriction
  ];

  for (const cand of candidates) {
    if (!cand || typeof cand !== 'string') continue;
    const norm = normalizeGermanCodes(cand);
    if (norm !== '-') return norm;
  }

  return '-';
};
