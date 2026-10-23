export const LICENSE_CLASS_DEFINITIONS: Record<string, string> = {
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
  "T": "T- tractor or limited-speed motor vehicle (MMBS) on public roads."
};

export const ORDERED_LICENSE_CLASSES = [
  "AM",
  "A1",
  "A2",
  "A",
  "B",
  "BE",
  "B1",
  "C1",
  "C1E",
  "C",
  "CE",
  "D1",
  "D1E",
  "D",
  "DE",
  "T"
];

/**
 * Extracts recognized license categories from a text string (e.g. "AM, B, T")
 * and returns them in standard order.
 */
export const parseCategoriesFromString = (text: string): string[] => {
  if (!text) return [];

  const found = new Set<string>();

  // Tokenize by spaces, commas, slashes, semicolons
  const tokens = text
    .replace(/[^a-zA-Z0-9]/g, ' ')
    .split(/\s+/)
    .map(t => t.trim().toUpperCase())
    .filter(Boolean);

  for (const token of tokens) {
    if (LICENSE_CLASS_DEFINITIONS[token]) {
      found.add(token);
    }
  }

  // Regex pass to capture compound classes like C1E, D1E, B1, A1, A2, etc. even if formatted together
  const compoundRegex = /\b(C1E|D1E|A1|A2|AM|BE|B1|C1|CE|D1|DE|A|B|C|D|T)\b/gi;
  let match;
  while ((match = compoundRegex.exec(text)) !== null) {
    const code = match[1].toUpperCase();
    if (LICENSE_CLASS_DEFINITIONS[code]) {
      found.add(code);
    }
  }

  return ORDERED_LICENSE_CLASSES.filter(cat => found.has(cat));
};

/**
 * Extracts and determines ONLY the driver's permitted categories.
 * Prioritizes categories verified by Column 10 dates if class contains unpermitted table rows.
 */
export const getPermittedCategories = (classString?: string, categoriesDates?: string): string[] => {
  const catsFromDates = parseCategoriesFromString(categoriesDates || '');
  const catsFromClass = parseCategoriesFromString(classString || '');

  // If catsFromClass contains > 8 categories (e.g. entire table was extracted) but catsFromDates has fewer,
  // the driver only has the categories with valid dates in Column 10!
  if (catsFromClass.length > 8 && catsFromDates.length > 0 && catsFromDates.length <= 6) {
    return catsFromDates;
  }

  if (catsFromClass.length > 0) {
    return catsFromClass;
  }

  if (catsFromDates.length > 0) {
    return catsFromDates;
  }

  return [];
};

/**
 * Generates the classDescriptions text ONLY for the permitted categories.
 * Each permitted category description on its own line.
 */
export const generateClassDescriptions = (classString?: string, categoriesDates?: string): string => {
  const categories = getPermittedCategories(classString, categoriesDates);
  if (categories.length === 0) return "-";
  return categories.map(cat => LICENSE_CLASS_DEFINITIONS[cat]).join('\n');
};

/**
 * Ensures classDescriptions contains ONLY the driver's permitted categories.
 * Any unpermitted categories found in the text are stripped out.
 */
export const filterOnlyPermittedDescriptions = (
  descriptionsText?: string,
  classString?: string,
  categoriesDates?: string
): string => {
  const permitted = getPermittedCategories(classString, categoriesDates);
  if (permitted.length === 0) {
    return "-";
  }

  if (descriptionsText && descriptionsText !== "-" && descriptionsText.trim()) {
    const lines = descriptionsText.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
    const filtered = lines.filter(line => {
      return permitted.some(cat => {
        const regex = new RegExp(`^${cat}\\s*[-–:]`, 'i');
        return regex.test(line);
      });
    });

    if (filtered.length > 0) {
      return filtered.join('\n');
    }
  }

  return permitted.map(cat => LICENSE_CLASS_DEFINITIONS[cat]).join('\n');
};

/**
 * Normalizes categories and their Column 10 dates according to user rules:
 * - Group categories that have the same date: "A1,A2: 01 May 2026"
 * - If ALL categories share the exact same date: output ONLY the date "01 May 2026"
 * - If empty: "-"
 */
export const normalizeCategoriesDates = (raw?: string): string => {
  if (!raw || !raw.trim() || raw.trim() === '-' || raw.trim() === 'null' || raw.trim() === 'N/A') {
    return '-';
  }

  const clean = raw.trim();

  // If already just a plain single date with no category identifiers or colons
  if (!clean.includes(':') && !clean.includes(';') && !clean.includes('\n') && !/[A-Za-z]{1,3}\s*[:,]/.test(clean)) {
    return clean;
  }

  // Split into lines
  const lines = clean.split(/\r?\n|;/).map(l => l.trim()).filter(Boolean);
  if (lines.length === 0) return '-';

  const dateToCategoriesMap = new Map<string, string[]>();

  for (const line of lines) {
    const separatorIdx = line.indexOf(':');
    if (separatorIdx !== -1) {
      const catPart = line.substring(0, separatorIdx).trim();
      const datePart = line.substring(separatorIdx + 1).trim();
      if (!datePart) continue;

      const cats = parseCategoriesFromString(catPart);
      const existing = dateToCategoriesMap.get(datePart) || [];
      if (cats.length === 0) {
        const rawTokens = catPart.split(/[,/ ]+/).map(t => t.trim()).filter(Boolean);
        existing.push(...rawTokens);
      } else {
        existing.push(...cats);
      }
      dateToCategoriesMap.set(datePart, existing);
    } else {
      // Try to match patterns like "AM 01 May 2026" or "AM - 01 May 2026"
      const match = line.match(/^([A-Za-z0-9,\s/]+?)\s*[-:]?\s*([0-9]{1,2}[\s.-][A-Za-z0-9.-]+[\s.-][0-9]{2,4})/);
      if (match) {
        const catPart = match[1].trim();
        const datePart = match[2].trim();
        const cats = parseCategoriesFromString(catPart);
        const existing = dateToCategoriesMap.get(datePart) || [];
        if (cats.length === 0) {
          existing.push(catPart);
        } else {
          existing.push(...cats);
        }
        dateToCategoriesMap.set(datePart, existing);
      } else {
        // Plain line or date
        const existing = dateToCategoriesMap.get(line) || [];
        dateToCategoriesMap.set(line, existing);
      }
    }
  }

  if (dateToCategoriesMap.size === 0) return clean || '-';

  // Rule: Si todas las licencias tienen la misma fecha solo pon la fecha
  if (dateToCategoriesMap.size === 1) {
    const [singleDate] = dateToCategoriesMap.keys();
    return singleDate;
  }

  // Format distinct date groups
  const outputLines: string[] = [];
  dateToCategoriesMap.forEach((cats, date) => {
    const uniqueCats = Array.from(new Set(cats));
    const sortedCats = ORDERED_LICENSE_CLASSES.filter(c => uniqueCats.includes(c));
    const catStr = sortedCats.length > 0 ? sortedCats.join(',') : uniqueCats.join(',');
    if (catStr) {
      outputLines.push(`${catStr}: ${date}`);
    } else {
      outputLines.push(date);
    }
  });

  return outputLines.length > 0 ? outputLines.join('\n') : '-';
};
