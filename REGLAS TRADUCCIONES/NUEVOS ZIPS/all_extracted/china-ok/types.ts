
export interface ExtractedData {
  surname: string;
  firstName: string; 
  middleName?: string; 
  firstNames: string; 
  fullName: string;
  licenseNumber: string;
  assignedNumber?: string;
  dateOfBirth: string;
  placeOfBirth: string;
  issueDate: string;
  expiryDate: string;
  firstIssued?: string;
  validFrom?: string;
  validTo?: string;
  address: string;
  nationality: string;
  gender: string;
  class: string;
  codes: string;
  authority: string;
  categoriesDates: string;
  secondaryRecords?: string;
  explicacionCodigos?: string;
  barcodeNumber?: string;
  fileNumber?: string;
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
  image1: File | null;
  image2: File | null;
  image3: File | null;
  image4: File | null;
  status: ProcessStatus;
  extractedData: ExtractedData | null;
  error: string | null;
}
