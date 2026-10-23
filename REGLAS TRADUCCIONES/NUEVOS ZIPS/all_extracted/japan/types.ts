
export interface ExtractedData {
  surname: string;
  firstNames: string;
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
  code106From?: string;
  code106To?: string;
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
  frontImage: File | null;
  backImage: File | null;
  status: ProcessStatus;
  extractedData: ExtractedData | null;
  error: string | null;
}
