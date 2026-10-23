
import React, { useState, useEffect } from 'react';
import { 
  FileText, Download, Loader2, 
  CheckCircle2, XCircle, AlertTriangle, Clipboard,
  RefreshCw
} from 'lucide-react';
import FileUploader from './components/FileUploader';
import DataPreview from './components/DataPreview';
import { extractDataFromLicense } from './services/geminiService';
import { generateFilledDoc, optimizeImage } from './services/docService';
import { AppState, ProcessStatus } from './types';

// --- Lógica de Base de Datos (IndexedDB) ---
const DB_NAME = 'DocuFillDB';
const STORE_NAME = 'templates';

const initDB = (): Promise<IDBDatabase> => {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = () => {
      request.result.createObjectStore(STORE_NAME);
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
};

const saveTemplateToDB = async (file: File) => {
  const db = await initDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE_NAME, 'readwrite');
    const store = transaction.objectStore(STORE_NAME);
    store.put(file, 'active_template');
    transaction.oncomplete = () => resolve(true);
    transaction.onerror = () => reject(transaction.error);
  });
};

const getTemplateFromDB = async (): Promise<File | null> => {
  const db = await initDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE_NAME, 'readonly');
    const store = transaction.objectStore(STORE_NAME);
    const request = store.get('active_template');
    request.onsuccess = () => resolve(request.result || null);
    request.onerror = () => reject(request.error);
  });
};

const deleteTemplateFromDB = async () => {
  const db = await initDB();
  const transaction = db.transaction(STORE_NAME, 'readwrite');
  transaction.objectStore(STORE_NAME).delete('active_template');
};

const App: React.FC = () => {
  const [state, setState] = useState<AppState>({
    templateFile: null,
    referenceFile: null,
    frontImage: null,
    backImage: null,
    status: ProcessStatus.IDLE,
    extractedData: null,
    error: null,
  });
  const [imagesBase64, setImagesBase64] = useState<{front: string, back: string} | null>(null);

  useEffect(() => {
    getTemplateFromDB().then(file => {
      if (file) setState(prev => ({ ...prev, templateFile: file }));
    });
  }, []);

  useEffect(() => {
    const handlePaste = (event: ClipboardEvent) => {
      const items = event.clipboardData?.items;
      if (!items) return;
      for (let i = 0; i < items.length; i++) {
        if (items[i].type.indexOf('image') !== -1) {
          const blob = items[i].getAsFile();
          if (blob) {
            const file = new File([blob], `pasted-image-${Date.now()}.png`, { type: blob.type });
            setState(prev => {
              if (!prev.frontImage) return { ...prev, frontImage: file, error: null };
              else if (!prev.backImage) return { ...prev, backImage: file, error: null };
              return prev;
            });
          }
          break;
        }
      }
    };
    window.addEventListener('paste', handlePaste);
    return () => window.removeEventListener('paste', handlePaste);
  }, []);

  const handleTemplateSelect = async (file: File | null) => {
    if (file) {
      await saveTemplateToDB(file);
      setState(p => ({ ...p, templateFile: file }));
    }
  };

  const clearTemplate = async () => {
    await deleteTemplateFromDB();
    setState(p => ({ ...p, templateFile: null }));
  };

  const handleProcess = async () => {
    if (!state.templateFile || !state.frontImage || !state.backImage) {
      setState(prev => ({ ...prev, error: "Faltan archivos necesarios (Plantilla + Fotos)." }));
      return;
    }
    setState(prev => ({ ...prev, status: ProcessStatus.PROCESSING, error: null }));
    try {
      const data = await extractDataFromLicense(state.frontImage, state.backImage, state.referenceFile);
      const frontB64 = await optimizeImage(state.frontImage);
      const backB64 = await optimizeImage(state.backImage);
      setImagesBase64({ front: frontB64, back: backB64 });
      setState(prev => ({ ...prev, status: ProcessStatus.REVIEW, extractedData: { ...data, assignedNumber: "" } }));
    } catch (err: any) {
      setState(prev => ({ ...prev, status: ProcessStatus.ERROR, error: err.message }));
    }
  };

  const downloadWord = async () => {
    if (!state.templateFile || !state.extractedData || !imagesBase64) return;
    try {
      const blob = await generateFilledDoc(state.templateFile, state.extractedData, imagesBase64.front, imagesBase64.back);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      const fileName = state.extractedData.assignedNumber 
        ? `${state.extractedData.assignedNumber}.docx` 
        : (state.extractedData.licenseNumber ? `${state.extractedData.licenseNumber}.docx` : `Filled_Doc.docx`);
      a.download = fileName;
      a.click();
      setState(prev => ({ ...prev, status: ProcessStatus.COMPLETED }));
    } catch (err: any) {
      setState(prev => ({ ...prev, error: err.message }));
    }
  };

  const downloadSpecTxt = () => {
    const specText = `================================================================================
PROMPT MAESTRO DE DESARROLLO PARA ANTIGRAVITY (GOOGLE AI STUDIO)
SISTEMA: AUTOMATIZACIÓN Y TRADUCCIÓN DE CNH (BRASIL) A DOCUMENTO WORD (UK)
================================================================================

COPIA Y PEGA EL SIGUIENTE PROMPT EN ANTIGRAVITY PARA CONSTRUIR LA APLICACIÓN EXACTA:

--------------------------------------------------------------------------------
PROMPT PARA ANTIGRAVITY:
--------------------------------------------------------------------------------

Actúa como un ingeniero de software senior y desarrolla una aplicación web completa y profesional en React, Vite, TypeScript y Tailwind CSS llamada "DocuFill AI - Brasil (CNH) to UK", diseñada para automatizar la extracción OCR mediante Gemini API, traducción al inglés británico y llenado de plantillas de Word (.docx) con docxtemplater para licencias de conducir de Brasil (Carteira Nacional de Habilitação - CNH).

La aplicación debe replicar exactamente la siguiente arquitectura, reglas de negocio, esquemas de datos y lógica de generación documental:

================================================================================
1. REGLAS DE NEGOCIO Y TRADUCCIÓN (BRASIL CNH -> UK)
================================================================================
- País de Origen: Brasil (CNH)
- Idioma de Entrada: Portugués
- Idioma de Salida: Inglés (Reino Unido - UK)
- Todas las fechas extraídas deben formatearse OBLIGATORIAMENTE en formato "DD Month YYYY" (ej: "15 July 1985", "04 March 2028").
- Regla para el campo {{authority}}:
  * Debe traducirse obligatoriamente al inglés y terminar SIEMPRE con ", Brazil".
  * Si la autoridad emisora contiene "DETRAN" (Departamento Estadual de Trânsito), debe traducirse como "State Traffic Department, <Nombre del Estado en Inglés>, Brazil".
  * Mapeo de estados: SP -> São Paulo, RJ -> Rio de Janeiro, MG -> Minas Gerais, BA -> Bahia, PR -> Paraná, RS -> Rio Grande do Sul, DF -> Federal District, etc.
  * Ejemplo: "DETRAN RJ" -> "State Traffic Department, Rio de Janeiro, Brazil".
  * Ejemplo: "DETRAN SP" -> "State Traffic Department, São Paulo, Brazil".
- Regla de Nombres:
  * "surname": Apellidos de familia.
  * "firstName": ÚNICAMENTE el primer nombre de pila.
  * "middleName": Resto de nombres de pila.
  * "firstNames": Combinación de firstName + middleName.
  * "fullName": Combinación de surname + firstName + middleName.
- Regla de Restricciones / Observaciones (Sección 12 - Observações):
  * Traducir códigos estándar brasileños al inglés:
    - 'A' -> "Prescribed spectacles / Corrective lenses"
    - 'EAR' -> "Exercises remunerated activity"
    - 'B' -> "Hearing aid mandatory"
    - Explicar cualquier otro código presente de forma clara en inglés.
- Documentos de Identidad:
  * "licenseNumber": Número central de registro (Nº Registro).
  * "cardNumber": Número vertical en el margen lateral izquierdo (Nº Espelho / Serial).
  * "idDocument": Sección 4c (Doc. Identidade, ej: "392634570 SSP SP").
  * "cpf": Sección 4d (CPF, manteniendo formato de puntuación xxx.xxx.xxx-xx).
  * "parents": Sección "Filiação" (Nombres de madre y padre).
  * "firstObtained": 1ª Habilitação en formato DD Month YYYY.

================================================================================
2. ESTRUCTURA COMPLETA DE CAMPOS (TYPESCRIPT INTERFACE)
================================================================================
\`\`\`typescript
export interface ExtractedData {
  surname: string;
  firstName: string;
  middleName?: string;
  firstNames: string;
  fullName: string;
  licenseNumber: string;
  assignedNumber?: string; // Número asignado de control ej: B1234
  cardNumber?: string;     // Nº Espelho vertical izquierdo
  idDocument?: string;     // Sección 4c Doc Identidade
  cpf?: string;            // Sección 4d CPF
  parents?: string;        // Filiação
  dateOfBirth: string;
  placeOfBirth: string;
  issueDate: string;
  expiryDate: string;
  firstObtained?: string;
  address: string;
  nationality: string;
  gender: string;
  class: string;           // Categorías (A, B, AB, etc.)
  codes: string;
  authority: string;       // State Traffic Department, <State>, Brazil
  categoriesDates: string;
  conditions?: string;     // Sección 12 Observações
  explicacionCodigos?: string;
  [key: string]: any;
}
\`\`\`

================================================================================
3. CONFIGURACIÓN Y PROMPT DE GEMINI API (@google/genai)
================================================================================
Usar el SDK oficial @google/genai con inicialización perezosa:
\`\`\`typescript
import { GoogleGenAI, Type } from "@google/genai";

let genAI: GoogleGenAI | null = null;
export const getAI = () => {
  if (!genAI) {
    const apiKey = process.env.GEMINI_API_KEY || process.env.API_KEY;
    if (!apiKey) throw new Error("GEMINI_API_KEY no configurada.");
    genAI = new GoogleGenAI({ apiKey });
  }
  return genAI;
};
\`\`\`

Llamada a Gemini 3 Flash Preview (\`gemini-3-flash-preview\`) enviando las 2 imágenes inline (Frente y Reverso en Base64):
- Prompt de extracción:
"Analyze these two images (Front and Back of a Brazilian driver's license - CNH).
IMPORTANT: ALL TEXT OUTPUT VALUES MUST BE IN ENGLISH.
Format all dates as 'DD Month YYYY' (e.g., 15 July 1985).
Extract data into fields: surname, firstName, middleName, firstNames, fullName, licenseNumber, cardNumber, idDocument, cpf, parents, dateOfBirth, placeOfBirth, issueDate, expiryDate, firstObtained, authority (translate DETRAN as State Traffic Department, <State>, Brazil), class, address, nationality ('Brazilian'), gender, conditions (translate section 12 codes to English).
Return valid JSON matching the schema."

- Configuración con responseSchema Type.OBJECT que incluye todos los campos obligatorios.
- Post-procesamiento: función formatAuthority para asegurar que el resultado finalice en ", Brazil" y expanda correctamente DETRAN con su estado.

================================================================================
4. SERVICIO DE GENERACIÓN DE WORD (docxtemplater + pizzip + image module)
================================================================================
- Dependencias: docxtemplater, pizzip, docxtemplater-image-module-free.
- Optimización de Imágenes: Las imágenes de frente y reverso de la CNH deben cargarse en un canvas, redimensionarse a un ancho máximo de 800px y codificarse en Base64 JPEG con sus dimensiones empaquetadas ("data:...|width|height").
- Etiquetas disponibles para la plantilla Word (.docx):
  * {{surname}}, {{firstName}}, {{middleName}}, {{firstNames}}, {{fullName}}
  * {{licenseNumber}}, {{assignedNumber}}, {{cardNumber}}, {{idDocument}}, {{cpf}}
  * {{parents}}, {{dateOfBirth}}, {{placeOfBirth}}, {{issueDate}}, {{expiryDate}}, {{firstObtained}}
  * {{authority}}, {{class}}, {{conditions}}, {{address}}, {{nationality}}, {{gender}}
  * {{today}}, {{fechaHoy}} (Fecha actual en formato "DD Month YYYY")
  * {{license_front}}, {{foto_frente}} (Imagen del frente insertada automáticamente)
  * {{license_back}}, {{foto_reverso}} (Imagen del reverso insertada automáticamente)
- El archivo descargado debe nombrarse automáticamente con el {{assignedNumber}}.docx si existe, o en su defecto con el {{licenseNumber}}.docx.

================================================================================
5. EXPERIENCIA DE USUARIO Y FUNCIONALIDADES DE LA APP
================================================================================
- Persistencia de la Plantilla Activa en IndexedDB: Si el usuario sube una plantilla .docx, guardarla en IndexedDB para no tener que volver a subirla en cada sesión.
- Soporte para Pegar Imágenes desde el Portapapeles (Ctrl+V): Detectar eventos paste globales para asignar automáticamente la imagen pegada al frente o reverso.
- Pantalla de Revisión y Edición de Datos: Mostrar un formulario completo con todos los campos extraídos para permitir al usuario corregir o añadir el "Assigned Number" antes de generar el Word.
- Indicador de estado claro: IDLE, PROCESSING (loader animado), REVIEW (formulario de datos), COMPLETED (éxito y descarga), ERROR (banner con mensaje de error).
- Diseño moderno con Tailwind CSS en paleta neutral y limpia con tonos Slate, Indigo y Emerald.
================================================================================`;

    const blob = new Blob([specText], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'Antigravity_Prompt_Master_CNH_Brazil.txt';
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="min-h-screen bg-[#f8fafc] py-12 px-4 flex flex-col items-center font-sans text-slate-900">
      <header className="max-w-4xl w-full text-center mb-12">
        <div className="bg-indigo-600 w-16 h-16 rounded-2xl shadow-xl flex items-center justify-center mx-auto mb-4">
          <FileText className="text-white" size={32} />
        </div>
        <h1 className="text-3xl font-black text-slate-900 tracking-tight">DocuFill AI</h1>
        <p className="text-slate-500 mt-2 font-medium">Automatización de Traducción BRASIL (CNH) → UK</p>
        
        <div className="mt-4 flex justify-center">
          <button 
            onClick={downloadSpecTxt}
            className="inline-flex items-center gap-2 px-4 py-2 bg-slate-200 hover:bg-slate-300 text-slate-800 text-xs font-bold rounded-xl transition-all shadow-sm"
          >
            <Download size={14} /> Descargar Reglas y Prompt (.txt)
          </button>
        </div>
      </header>

      <main className="max-w-4xl w-full">
        {state.error && (
          <div className="mb-8 bg-red-50 text-red-700 p-5 rounded-2xl border border-red-200 flex items-start gap-4 shadow-sm">
            <AlertTriangle size={24} className="shrink-0 text-red-500" />
            <div className="flex-1 text-xs font-medium">{state.error}</div>
            <button onClick={() => setState(p => ({...p, error: null}))}><XCircle size={20} /></button>
          </div>
        )}

        {(state.status === ProcessStatus.IDLE || state.status === ProcessStatus.ERROR) && (
          <div className="space-y-10">
            <section className="space-y-4">
              <h2 className="text-xl font-black text-slate-800 flex items-center gap-3">
                <span className="w-8 h-8 rounded-full bg-indigo-600 text-white flex items-center justify-center text-sm">1</span>
                Plantilla
              </h2>
              {!state.templateFile ? (
                <div className="bg-white border-2 border-dashed border-slate-200 rounded-[2rem] p-10">
                  <FileUploader label="Sube tu .docx" accept=".docx" selectedFile={state.templateFile} onFileSelect={handleTemplateSelect} />
                </div>
              ) : (
                <div className="bg-white border border-emerald-200 rounded-[2rem] p-8 flex items-center gap-6 shadow-sm">
                  <div className="w-14 h-14 bg-emerald-100 rounded-2xl flex items-center justify-center text-emerald-600 shrink-0"><FileText size={28} /></div>
                  <div className="flex-1"><h4 className="text-emerald-900 font-black">Plantilla activa</h4><p className="text-emerald-600 text-xs truncate max-w-[200px]">{state.templateFile.name}</p></div>
                  <button onClick={clearTemplate} className="text-xs font-bold text-slate-400 hover:text-slate-600 flex items-center gap-2"><RefreshCw size={12}/> CAMBIAR</button>
                </div>
              )}
            </section>

            <section className="space-y-4 pt-4 border-t border-slate-100">
              <h2 className="text-xl font-black text-slate-800 flex items-center gap-3">
                <span className="w-8 h-8 rounded-full bg-indigo-600 text-white flex items-center justify-center text-sm">2</span>
                Fotos CNH
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <FileUploader label="Frente" accept="image/*" icon="image" selectedFile={state.frontImage} onFileSelect={(f) => setState(p => ({...p, frontImage: f}))} />
                <FileUploader label="Reverso" accept="image/*" icon="image" selectedFile={state.backImage} onFileSelect={(f) => setState(p => ({...p, backImage: f}))} />
              </div>
            </section>

            <button 
              onClick={handleProcess}
              disabled={!state.templateFile || !state.frontImage || !state.backImage || state.status === ProcessStatus.PROCESSING}
              className="w-full bg-slate-900 text-white py-6 rounded-[1.5rem] font-black text-xl hover:bg-slate-800 disabled:opacity-30 shadow-2xl transition-all"
            >
              {state.status === ProcessStatus.PROCESSING ? <Loader2 className="mx-auto animate-spin" /> : "INICIAR PROCESAMIENTO"}
            </button>
          </div>
        )}

        {state.status === ProcessStatus.PROCESSING && (
          <div className="bg-white p-20 rounded-[3rem] text-center space-y-4 shadow-xl">
            <Loader2 className="mx-auto animate-spin text-indigo-600" size={60} />
            <h2 className="text-2xl font-black text-slate-800 tracking-tight">IA Analizando CNH...</h2>
          </div>
        )}

        {state.status === ProcessStatus.REVIEW && state.extractedData && (
          <div className="space-y-8">
            <DataPreview data={state.extractedData} onChange={(d) => setState(p => ({...p, extractedData: d}))} />
            
            <button 
              onClick={downloadWord} 
              className="w-full bg-emerald-600 text-white py-8 rounded-[1.5rem] font-black text-2xl hover:bg-emerald-700 shadow-2xl flex flex-col items-center justify-center gap-1 transition-all"
            >
              <div className="flex items-center gap-3"><Download size={32} /> DESCARGAR WORD (.docx)</div>
              <span className="text-[12px] opacity-70 uppercase tracking-widest font-bold">Generar documento con datos de Brasil</span>
            </button>
          </div>
        )}

        {state.status === ProcessStatus.COMPLETED && (
          <div className="bg-white p-16 rounded-[3rem] text-center space-y-8 shadow-2xl">
            <div className="w-20 h-20 bg-emerald-100 rounded-full flex items-center justify-center mx-auto text-emerald-600">
              <CheckCircle2 size={48} />
            </div>
            <h2 className="text-3xl font-black text-slate-900 tracking-tight">¡Archivo Generado!</h2>
            <button onClick={() => setState(p => ({ ...p, status: ProcessStatus.IDLE, frontImage: null, backImage: null, extractedData: null }))} className="w-full py-5 bg-indigo-600 text-white rounded-2xl font-black text-lg">PROCESAR OTRO</button>
          </div>
        )}
      </main>
    </div>
  );
};

export default App;
