
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
  classDescriptions?: string;
  codes: string;
  authority: string;
  categoriesDates: string;
  code106From?: string;
  code106To?: string;
  explicacionCodigos?: string;
  [key: string]: any;
}

export enum ProcessStatus {
  IDLE = 'IDLE',
  PROCESSING = 'PROCESSING',
  REVIEW = 'REVIEW',
  COMPLETED = 'COMPLETED',
  ERROR = 'ERROR'
}

export interface AppState {
  templateFile: File | null;
  referenceFile: File | null;
  frontImage: File | null;
  backImage: File | null;
  status: ProcessStatus;
  extractedData: ExtractedData | null;
  error: string | null;
}
