
export interface ExtractedData {
  surname: string;
  firstName: string; // Solo el primer nombre
  middleName?: string; // Nombres restantes
  firstNames: string; // Todos los nombres juntos (para compatibilidad)
  fullName: string;
  licenseNumber: string;
  assignedNumber?: string;
  dateOfBirth: string;
  placeOfBirth: string;
  issueDate: string;
  expiryDate: string;
  address: string;
  nationality: string;
  gender: string;
  class: string;
  codes: string;
  authority: string;
  categoriesDates: string;
  classDescriptions?: string;
  code106From?: string;
  code106To?: string;
  explicacionCodigos?: string;
  licenseLanguage: string; // Nuevo campo para el idioma
  [key: string]: any;
}

export enum ProcessStatus {
  IDLE = 'IDLE',
  PROCESSING = 'PROCESSING',
  REVIEW = 'REVIEW',
  COMPLETED = 'COMPLETED',
  ERROR = 'ERROR'
}

export const LICENSE_CLASS_DESCRIPTIONS: Record<string, string> = {
  'AM': 'AM - 2-wheel, 3-wheel vehicles and light quadricycles with a maximum design speed of not more than 45 km/h.',
  'A1': 'A1 - light motorcycles with a cylinder capacity not more than 125 cubic centimetres and a power rating less than 11 kW.',
  'A2': 'A2 - motorcycles with a power rating under 35 kW.',
  'A': 'A - heavy motorcycles without power restrictions.',
  'B': 'B - passenger vehicles weighing up to 3,500 kg and seating not more than eight passengers.',
  'BE': 'BE - vehicle of category B towing a heavy trailer of under 3,500 kg.',
  'B1': 'B1- quadricycles.',
  'C1': 'C1 - goods vehicles between 3,500 kg and 7,500 kg and for up to eight passengers-',
  'C1E': 'C1E - vehicle of category C1 or B towing a heavy trailer; with a combined mass of up to 12,000 kg.',
  'C': 'C - goods vehicles weighing more than 3,500 kg and seating not more than eight passengers.',
  'CE': 'CE - vehicle of category C towing a heavy trailer.',
  'D1': 'D1 - passenger vehicles built for fewer than 16 passengers and that is no longer than 8 m.',
  'D1E': 'D1E - vehicle of category D1 towing a heavy trailer.',
  'D': 'D - passenger vehicles for more than eight passengers.',
  'DE': 'DE - vehicle of category D towing a heavy trailer.',
  'K': 'K- Garden tractor, animal-drawn vehicle',
  'T': 'T- Agricultural tractor and 2 heavy trailers, slow vehicle and trailer, garden tractor, animal-drawn vehicle',
  'M': 'M- Moped, animal-drawn vehicle, garden tractor (after 16 years of age)',
  'TR': 'TR- Trolleybus, agricultural tractor and 2 heavy trailers, moped, slow vehicle and trailer, garden tractor, animal-drawn vehicle',
  'V': 'V- Tram, garden tractor, animal-drawn vehicle'
};

export const getClassDescriptions = (classString?: string): string => {
  if (!classString) return '';
  const rawCodes = classString
    .split(/[,;\n/]+/)
    .map(c => c.trim().toUpperCase())
    .filter(Boolean);

  const matchedDescriptions: string[] = [];
  const seen = new Set<string>();

  for (const raw of rawCodes) {
    const parts = raw.split(/\s+/).filter(Boolean);
    for (const part of parts) {
      const code = part.toUpperCase();
      if (LICENSE_CLASS_DESCRIPTIONS[code] && !seen.has(code)) {
        seen.add(code);
        matchedDescriptions.push(LICENSE_CLASS_DESCRIPTIONS[code]);
      }
    }
  }

  return matchedDescriptions.join('\n');
};

export const HUNGARIAN_SPECIAL_CLASSES: Record<string, string> = {
  'K': 'Garden tractor, animal-drawn vehicle',
  'T': 'Agricultural tractor and 2 heavy trailers, slow vehicle and trailer, garden tractor, animal-drawn vehicle',
  'M': 'Moped, animal-drawn vehicle, garden tractor (after 16 years of age)',
  'TR': 'Trolleybus, agricultural tractor and 2 heavy trailers, moped, slow vehicle and trailer, garden tractor, animal-drawn vehicle',
  'V': 'Tram, garden tractor, animal-drawn vehicle'
};

export interface AppState {
  templateFile: File | null;
  referenceFile: File | null;
  frontImage: File | null;
  backImage: File | null;
  status: ProcessStatus;
  extractedData: ExtractedData | null;
  error: string | null;
}
