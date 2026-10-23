
export interface ExtractedData {
  surname: string;
  firstName: string; // Solo el primer nombre
  middleName?: string; // Nombres restantes (o "-" si no tiene)
  firstNames: string; // Todos los nombres juntos
  fullName: string;
  licenseNumber: string;
  assignedNumber?: string;
  dateOfBirth: string;
  placeOfBirth: string;
  issueDate: string;
  expiryDate: string;
  address?: string; // Dirección si la indica la licencia, si no se borra
  nationality?: string; // Nacionalidad en inglés si la indica, si no se borra
  gender?: string; // Male / Female o "-" si no lo indica
  organs?: string; // Yes / No si lo indica la licencia, si no se borra
  class: string; // Categoría/clase de la licencia
  codes: string; // Códigos y restricciones
  authority: string; // Autoridad emisora + País
  categoriesDates: string; // Fechas de vigencia de categorías
  code106From?: string;
  code106To?: string;
  explicacionCodigos?: string; // Explicación técnica de categorías y códigos
  explicacion?: string; // Alias de explicacionCodigos
  curp?: string; // CURP / RFC / DNI / RUT
  blood?: string; // Grupo sanguíneo
  barcode?: string; // Código de barras
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
