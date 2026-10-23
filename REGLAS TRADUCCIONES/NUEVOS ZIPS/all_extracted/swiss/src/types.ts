
export enum ProcessStatus {
  IDLE = 'IDLE',
  PROCESSING = 'PROCESSING',
  REVIEW = 'REVIEW',
  COMPLETED = 'COMPLETED',
  ERROR = 'ERROR'
}

export interface ExtractedData {
  assignedNumber?: string;
  surname?: string;
  firstName?: string;
  middleName?: string;
  firstNames?: string;
  fullName?: string;
  licenseNumber?: string;
  dateOfBirth?: string;
  placeOfBirth?: string;
  issueDate?: string;
  expiryDate?: string;
  authority?: string;
  class?: string;
  classDescriptions?: string;
  categoriesDates?: string;
  codes?: string;
  explicacionCodigos?: string;
  code106From?: string;
  code106To?: string;
  language?: string;
  [key: string]: any;
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
