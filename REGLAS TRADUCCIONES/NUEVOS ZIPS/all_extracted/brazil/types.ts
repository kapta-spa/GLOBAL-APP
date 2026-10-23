
export interface ExtractedData {
  surname: string;
  firstName: string;
  middleName?: string;
  firstNames: string;
  fullName: string;
  licenseNumber: string;
  assignedNumber?: string;
  cardNumber?: string; // Nuevo: Numero vertical
  idDocument?: string; // Nuevo: 4c Doc Identidade
  cpf?: string;        // Nuevo: 4d CPF
  parents?: string;    // Nuevo: Filiação
  dateOfBirth: string;
  placeOfBirth: string;
  issueDate: string;
  expiryDate: string;
  firstObtained?: string;
  address: string;
  nationality: string;
  gender: string;
  class: string;
  codes: string;
  authority: string;
  categoriesDates: string;
  conditions?: string;
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
