export const OFFICIAL_CLASS_DESCRIPTIONS = {
  "AM": "AM - 2-wheel, 3-wheel vehicles and light quadricycles with a maximum design speed of not more than 45 km/h.",
  "A1": "A1 - light motorcycles with a cylinder capacity not more than 125 cubic centimetres and a power rating less than 11 kW.",
  "A2": "A2 - motorcycles with a power rating under 35 kW.",
  "A": "A - heavy motorcycles without power restrictions.",
  "B": "B - passenger vehicles weighing up to 3,500 kg and seating not more than eight passengers, in addition to the driver.",
  "BE": "BE - vehicle of category B towing a heavy trailer of under 3,500 kg.",
  "B1": "B1- quadricycles.",
  "C1": "C1 - goods vehicles between 3,500 kg and 7,500 kg and for up to eight passengers-",
  "C1E": "C1E - vehicle of category C1 or B towing a heavy trailer; with a combined mass of up to 12,000 kg.",
  "C": "C - goods vehicles weighing more than 3,500 kg and seating not more than eight passengers.",
  "CE": "CE - vehicle of category C towing a heavy trailer.",
  "D1": "D1 - passenger vehicles built for fewer than 16 passengers and that is no longer than 8 m.",
  "D1E": "D1E - vehicle of category D1 towing a heavy trailer.",
  "D": "D - passenger vehicles for more than eight passengers.",
  "DE": "DE - vehicle of category D towing a heavy trailer.",
  "LK": "LK- Small moped with a maximum speed of 30 km/h. (Now included in AM class).",
  "TM": "TM- Tractor/Motorised equipment.",
  "L": "L - Agricultural and forestry tractors with a maximum design speed of up to 40 km/h, and work machinery up to 25 km/h.",
  "T": "T- tractor or limited-speed motor vehicle (MMBS) on public roads.",
  "M": "M - Mopeds with maximum design speed up to 45 km/h.",
  "S": "S - Trikes, quadricycles and microcars."
};

export const BRAZIL_CLASS_DESCRIPTIONS = {
  "A": "A- Driver of a two or three-wheeled motor vehicle, with or without sidecar.",
  "B": "B- Driver of a motor vehicle, not covered by category A, with a total gross weight not exceeding 3,500 kg and having not more than 8 seats, excluding the driver's seat.",
  "C": "C- Driver of a motor vehicle used for transporting cargo, not covered by category B, with a total gross weight exceeding 3,500 kg.",
  "D": "D- Driver of a motor vehicle used for passenger transport, whose capacity exceeds 8 seats, excluding the driver's seat.",
  "E": "E- Driver of a combination of vehicles in which the towing unit falls into categories B, C or D and the towed unit has a total gross weight of 6,000 kg or more, or whose capacity exceeds 8 seats.",
  "ACC": "ACC- Driver of mopeds up to 50 cc."
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

export const formatCategoriesDates = (str) => {
  if (!str || typeof str !== 'string') return str || '-';
  const lines = str.split('\n').map(l => l.trim()).filter(Boolean);
  if (lines.length === 0) return '-';

  const dateToClasses = new Map();
  const unparsedLines = [];

  for (const line of lines) {
    const colonIdx = line.indexOf(':');
    if (colonIdx !== -1) {
      const clsPart = line.substring(0, colonIdx).trim();
      const datePart = line.substring(colonIdx + 1).trim();
      if (clsPart && datePart) {
        const classes = clsPart.split(',').map(c => c.trim()).filter(Boolean);
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
    unparsedLines.push(line);
  }

  if (dateToClasses.size === 0) return str;

  const resultLines = [];
  for (const [date, classes] of dateToClasses.entries()) {
    resultLines.push(`${classes.join(', ')}: ${date}`);
  }
  if (unparsedLines.length > 0) {
    resultLines.push(...unparsedLines);
  }

  return resultLines.join('\n');
};
