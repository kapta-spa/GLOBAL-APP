export const CATEGORY_DESCRIPTIONS: Record<string, string> = {
  'AM': '2-wheel, 3-wheel vehicles and light quadricycles with a maximum design speed of not more than 45 km/h.',
  'A1': 'light motorcycles with a cylinder capacity not more than 125 cubic centimetres and a power rating less than 11 kW.',
  'A2': 'motorcycles with a power rating under 35 kW.',
  'A': 'heavy motorcycles without power restrictions.',
  'B1': 'heavy motorized quadricycle whose empty weight is a maximum of 450 kg if it is intended for the transport of persons, and 600 kg if it is intended for the transport of goods.',
  'B': 'passenger vehicles weighing up to 3,500 kg and seating not more than eight passengers, in addition to the driver.',
  'BE': 'vehicle of category B towing a heavy trailer of under 3,500 kg.',
  'C1': 'goods vehicles between 3,500 kg and 7,500 kg and for up to eight passengers-',
  'C1E': 'vehicle of category C1 or B towing a heavy trailer; with a combined mass of up to 12,000 kg.',
  'C': 'goods vehicles weighing more than 3,500 kg and seating not more than eight passengers.',
  'CE': 'vehicle of category C towing a heavy trailer.',
  'D1': 'passenger vehicles built for fewer than 16 passengers and that is no longer than 8 m.',
  'D1E': 'vehicle of category D1 towing a heavy trailer.',
  'D': 'passenger vehicles for more than eight passengers.',
  'DE': 'vehicle of category D towing a heavy trailer.',
};

export const CANONICAL_CATEGORIES_ORDER = [
  'AM', 'A1', 'A2', 'A', 'B1', 'B', 'BE', 'C1', 'C1E', 'C', 'CE', 'D1', 'D1E', 'D', 'DE'
];

/**
 * Extracts authorized category codes from the class string and formats them
 * into their corresponding full descriptions.
 */
export const buildClassDescriptions = (classString?: string): string => {
  if (!classString) return '';

  const matched = new Set<string>();

  // Tokenize by commas, slashes, spaces, semicolons
  const rawTokens = classString
    .toUpperCase()
    .split(/[\s,;/]+/)
    .map(t => t.trim())
    .filter(Boolean);

  for (const token of rawTokens) {
    if (CATEGORY_DESCRIPTIONS[token]) {
      matched.add(token);
    }
  }

  // Also check composite/word boundaries for any missing category
  const sortedKeys = Object.keys(CATEGORY_DESCRIPTIONS).sort((a, b) => b.length - a.length);
  for (const key of sortedKeys) {
    const regex = new RegExp(`(^|[^A-Z0-9])${key}([^A-Z0-9]|$)`, 'i');
    if (regex.test(classString)) {
      matched.add(key);
    }
  }

  const lines: string[] = [];
  for (const cat of CANONICAL_CATEGORIES_ORDER) {
    if (matched.has(cat)) {
      lines.push(`${cat} - ${CATEGORY_DESCRIPTIONS[cat]}`);
    }
  }

  return lines.join('\n');
};
