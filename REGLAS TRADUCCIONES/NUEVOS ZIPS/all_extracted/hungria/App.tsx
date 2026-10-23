
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
import { AppState, ProcessStatus, getClassDescriptions } from './types';

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
      const initialClassDescriptions = data.classDescriptions || getClassDescriptions(data.class);
      setState(prev => ({ 
        ...prev, 
        status: ProcessStatus.REVIEW, 
        extractedData: { 
          ...data, 
          assignedNumber: "",
          classDescriptions: initialClassDescriptions
        } 
      }));
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

  const downloadRulesTxt = () => {
    const rulesText = `# Documentación de Reglas de Extracción y Traducción para Licencias de Conducir (Hungría)

## 1. Contexto General
- **País de Origen:** Hungría (Hungary)
- **Idioma del Documento Original:** Húngaro (Hungarian) / Estándar de la Unión Europea
- **Idioma Objetivo de Salida:** Inglés (English)

## 2. Campos Exactos (Estructura de Datos - JSON Schema)
Los campos JSON extraídos de la licencia son los siguientes:

| Nombre del Campo | Descripción | Tipo de Dato |
| :--- | :--- | :--- |
| \`assignedNumber\` | Número de expediente o referencia asignado | String |
| \`licenseLanguage\` | Idioma de la licencia original (ej. "Hungarian") | String |
| \`surname\` | Apellido(s) principales (Vezetéknév) | String |
| \`firstName\` | Primer nombre propio únicamente | String |
| \`middleName\` | Nombres secundarios posteriores al primer nombre | String |
| \`firstNames\` | Todos los nombres propios unidos | String |
| \`fullName\` | Nombre completo (Apellido + Nombres) | String |
| \`licenseNumber\` | Número único de licencia (solo caracteres alfanuméricos) | String |
| \`dateOfBirth\` | Fecha de nacimiento (Punto 3) | String (DD Month YYYY) |
| \`placeOfBirth\` | Lugar de nacimiento (Punto 3), traducido al inglés | String |
| \`issueDate\` | Fecha de expedición (Punto 4a) | String (DD Month YYYY) |
| \`expiryDate\` | Fecha de caducidad/vencimiento (Punto 4b) | String (DD Month YYYY) |
| \`authority\` | Autoridad emisora (Punto 4c), traducido al inglés + "Hungary" | String |
| \`class\` | Categorías autorizadas (Punto 9 / Tabla reverso) separadas por coma | String |
| \`classDescriptions\` | Descripciones oficiales en inglés únicamente de las licencias que el conductor tiene permitidas | String |
| \`categoriesDates\` | Fechas de obtención por categoría agrupadas | String |
| \`codes\` | Códigos de serie ubicados en la esquina superior izquierda del reverso | String |
| \`explicacionCodigos\` | Descripción detallada en inglés de los códigos de restricción (Col. 12) | String |
| \`code106From\` | Fecha de inicio del periodo de prueba (Código 106) | String |
| \`code106To\` | Fecha de fin del periodo de prueba (Código 106) | String |

---

## 3. Reglas de Traducción, Formato y Extracción
1. **Idioma de Salida Obligatorio:** Todos los valores en texto deben traducirse al inglés.
2. **Nombres Propios (\`firstName\`, \`middleName\`, \`firstNames\`):**
   - \`firstName\`: Únicamente el primer nombre de la lista de nombres.
   - \`middleName\`: Todos los demás nombres propios restantes. Si solo tiene un nombre, se deja vacío ("").
   - \`firstNames\`: La unión de todos los nombres propios.
3. **Número de Licencia (\`licenseNumber\`):** Extraer únicamente caracteres alfanuméricos (letras y números, eliminando guiones, espacios o símbolos especiales).
4. **Formato de Fechas:** Todas las fechas (\`dateOfBirth\`, \`issueDate\`, \`expiryDate\`, etc.) deben formatearse estrictamente como \`DD Month YYYY\` (ejemplo: \`14 May 1988\`).
5. **Autoridad Emisora (\`authority\`):** Extraer el valor del Punto 4c, traducirlo al inglés y añadir siempre el país de origen "Hungary" al final (ej. "Government Office of Budapest, Hungary").
6. **Lugar de Nacimiento (\`placeOfBirth\`):** Traducir nombres geográficos y términos al inglés si corresponde (ej. "Budapest, Hungary").
7. **Categorías de Licencia (\`class\`):** Extraer todas las categorías del Punto 9 (frente) o de las columnas 9/10 (reverso). Separarlas por comas y espacio (ej. "B, C1, T").
   - Reconocer tanto categorías estándar de la UE (AM, A1, A2, A, B1, B, C1, C, D1, D, BE, CE, DE, etc.) como las Categorías Nacionales Especiales de Hungría:
     - K: Garden tractor, animal-drawn vehicle
     - T: Agricultural tractor and 2 heavy trailers, slow vehicle and trailer, garden tractor, animal-drawn vehicle
     - M: Moped, animal-drawn vehicle, garden tractor (after 16 years of age)
     - TR: Trolleybus, agricultural tractor and 2 heavy trailers, moped, slow vehicle and trailer, garden tractor, animal-drawn vehicle
     - V: Tram, garden tractor, animal-drawn vehicle
8. **Descripciones de Licencias (\`classDescriptions\`):** En este campo se colocan ÚNICAMENTE las descripciones oficiales en inglés de las licencias que el titular tiene autorizadas, separadas por saltos de línea:
   - AM - 2-wheel, 3-wheel vehicles and light quadricycles with a maximum design speed of not more than 45 km/h.
   - A1 - light motorcycles with a cylinder capacity not more than 125 cubic centimetres and a power rating less than 11 kW.
   - A2 - motorcycles with a power rating under 35 kW.
   - A - heavy motorcycles without power restrictions.
   - B - passenger vehicles weighing up to 3,500 kg and seating not more than eight passengers.
   - BE - vehicle of category B towing a heavy trailer of under 3,500 kg.
   - B1- quadricycles.
   - C1 - goods vehicles between 3,500 kg and 7,500 kg and for up to eight passengers-
   - C1E - vehicle of category C1 or B towing a heavy trailer; with a combined mass of up to 12,000 kg.
   - C - goods vehicles weighing more than 3,500 kg and seating not more than eight passengers.
   - CE - vehicle of category C towing a heavy trailer.
   - D1 - passenger vehicles built for fewer than 16 passengers and that is no longer than 8 m.
   - D1E - vehicle of category D1 towing a heavy trailer.
   - D - passenger vehicles for more than eight passengers.
   - DE - vehicle of category D towing a heavy trailer.
   - K- Garden tractor, animal-drawn vehicle
   - T- Agricultural tractor and 2 heavy trailers, slow vehicle and trailer, garden tractor, animal-drawn vehicle
   - M- Moped, animal-drawn vehicle, garden tractor (after 16 years of age)
   - TR- Trolleybus, agricultural tractor and 2 heavy trailers, moped, slow vehicle and trailer, garden tractor, animal-drawn vehicle
   - V- Tram, garden tractor, animal-drawn vehicle
9. **Codificación de Restricciones y Observaciones (\`explicacionCodigos\`):**
   Analizar la columna 12 del reverso e identificar los siguientes códigos específicos para generar la explicación exacta en inglés:
   - Código "70": "70. Exchange of driver's license number [extract number]"
   - Código "01": "01- Vision correction and/or protection"
   - Código "01.06": "01.06- Prescribed spectacles or contact lenses"
   - Código "106": "106- Subject to the application of article R. 413-5 during probationary period from [DateFrom] to [DateTo] (Speed limits: 110km/h in Freeways where limit is 130km/h, 100km/h in freeways with lower speed limit or double roads, 80 km/h on other roads.)"

---

## 4. Casos Especiales y Manejo de Excepciones
- **Ilegibilidad / Datos Faltantes:** Si un campo es ilegible o no está presente en la imagen de la licencia, devolver una cadena vacía "". No inventar datos.
- **Licencia Bilingüe o Multilingüe:** Identificar el idioma en \`licenseLanguage\` (ejemplo: "Hungarian" o "Hungarian and English").
- **Nombre Completo (\`fullName\`):** Si la API no calcula el campo \`fullName\`, concatenar en el orden: \`surname\` + " " + \`firstName\` + " " + \`middleName\`.

---

## 5. System Prompt Sugerido para Gemini API

\`\`\`text
You are an expert document parser and translator specialized in European driver's licenses (specifically Hungary).
Analyze the two provided images (Front and Back of the driver's license).

IMPORTANT CONSTRAINTS:
- ALL OUTPUT VALUES MUST BE TRANSLATED TO ENGLISH.
- Return ONLY a valid JSON object matching the requested schema.

EXTRACT DATA RULES:
1. "surname": Family name (Vezetéknév).
2. "firstName": ONLY the very first given name.
3. "middleName": ALL remaining given names after the first one. Leave empty if none.
4. "firstNames": All given names joined together.
5. "licenseNumber": The main identification number. Extract ONLY alphanumeric characters.
6. "dateOfBirth": Date in Point 3. Format as "DD Month YYYY".
7. "placeOfBirth": Location in Point 3. Translate to English.
8. "issueDate": Date in Point 4a. Format as "DD Month YYYY".
9. "expiryDate": Date in Point 4b. Format as "DD Month YYYY".
10. "authority": Point 4c issuing authority. Translate to English and ALWAYS append "Hungary" at the end.
11. "class": Extract ALL categories listed in Point 9 on the front and/or columns 9/10 on the back. Separate with commas. Recognize standard EU classes (AM, A, B, C, D, BE, CE, DE) and special Hungarian national classes:
    - K: Garden tractor, animal-drawn vehicle
    - T: Agricultural tractor and 2 heavy trailers, slow vehicle and trailer, garden tractor, animal-drawn vehicle
    - M: Moped, animal-drawn vehicle, garden tractor (after 16 years of age)
    - TR: Trolleybus, agricultural tractor and 2 heavy trailers, moped, slow vehicle and trailer, garden tractor, animal-drawn vehicle
    - V: Tram, garden tractor, animal-drawn vehicle
12. "classDescriptions": For ONLY the categories present in "class", include the exact corresponding line for each permitted license separated by newline.
13. "categoriesDates": Column 10 on the back table. Group identical dates together.
14. "codes": Look at the top left corner of the back. Extract series of codes.
15. "explicacionCodigos": Column 12 restrictions. Translate known codes:
    - Code "70": "70. Exchange of driver's license number [number]"
    - Code "01": "01- Vision correction and/or protection"
    - Code "01.06": "01.06- Prescribed spectacles or contact lenses"
    - Code "106": "106- Subject to the application of article R. 413-5 during probationary period from [DateFrom] to [DateTo]"
16. "licenseLanguage": Document primary language (e.g., "Hungarian").
\`\`\`
`;

    const blob = new Blob([rulesText], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'Reglas_Extraccion_Hungria.txt';
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="min-h-screen bg-[#f8fafc] py-12 px-4 flex flex-col items-center font-sans text-slate-900">
      <header className="max-w-6xl w-full text-center mb-12">
        <div className="bg-indigo-600 w-16 h-16 rounded-2xl shadow-xl flex items-center justify-center mx-auto mb-4">
          <FileText className="text-white" size={32} />
        </div>
        <h1 className="text-3xl font-black text-slate-900 tracking-tight">DocuFill AI</h1>
        <p className="text-slate-500 mt-2 font-medium">Automatización de Traducción HUNGRÍA → UK</p>
        
        <div className="mt-4 flex justify-center">
          <button 
            onClick={downloadRulesTxt}
            className="inline-flex items-center gap-2 bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 font-bold text-xs px-4 py-2 rounded-xl shadow-sm transition-all"
          >
            <Download size={14} className="text-indigo-600" />
            Descargar Documento de Reglas (.txt)
          </button>
        </div>
      </header>

      <main className="max-w-4xl w-full">
        {state.error && (
          <div className="max-w-4xl mx-auto mb-8 bg-red-50 text-red-700 p-5 rounded-2xl border border-red-200 flex items-start gap-4 shadow-sm">
            <AlertTriangle size={24} className="shrink-0 text-red-500" />
            <div className="flex-1 text-xs font-medium">{state.error}</div>
            <button onClick={() => setState(p => ({...p, error: null}))}><XCircle size={20} /></button>
          </div>
        )}

        {(state.status === ProcessStatus.IDLE || state.status === ProcessStatus.ERROR) && (
          <div className="flex flex-col gap-10">
            <section className="space-y-10">
              <div className="space-y-4">
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
              </div>

              <div className="space-y-4 pt-4 border-t border-slate-100">
                <h2 className="text-xl font-black text-slate-800 flex items-center gap-3">
                  <span className="w-8 h-8 rounded-full bg-indigo-600 text-white flex items-center justify-center text-sm">2</span>
                  Fotos
                </h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <FileUploader label="Frente" accept="image/*" icon="image" selectedFile={state.frontImage} onFileSelect={(f) => setState(p => ({...p, frontImage: f}))} />
                  <FileUploader label="Reverso" accept="image/*" icon="image" selectedFile={state.backImage} onFileSelect={(f) => setState(p => ({...p, backImage: f}))} />
                </div>
              </div>

              <button 
                onClick={handleProcess}
                disabled={!state.templateFile || !state.frontImage || !state.backImage || state.status === ProcessStatus.PROCESSING}
                className="w-full bg-slate-900 text-white py-6 rounded-[1.5rem] font-black text-xl hover:bg-slate-800 disabled:opacity-30 shadow-2xl transition-all"
              >
                {state.status === ProcessStatus.PROCESSING ? <Loader2 className="mx-auto animate-spin" /> : "INICIAR PROCESAMIENTO"}
              </button>
            </section>
          </div>
        )}

        {state.status === ProcessStatus.PROCESSING && (
          <div className="bg-white p-20 rounded-[3rem] text-center space-y-4 max-w-xl mx-auto shadow-xl">
            <Loader2 className="mx-auto animate-spin text-indigo-600" size={60} />
            <h2 className="text-2xl font-black text-slate-800 tracking-tight">IA Analizando...</h2>
          </div>
        )}

        {state.status === ProcessStatus.REVIEW && state.extractedData && (
          <div className="max-w-4xl mx-auto space-y-8">
            <DataPreview data={state.extractedData} onChange={(d) => setState(p => ({...p, extractedData: d}))} />
            
            <button 
              onClick={downloadWord} 
              className="w-full bg-emerald-600 text-white py-8 rounded-[1.5rem] font-black text-2xl hover:bg-emerald-700 shadow-2xl flex flex-col items-center justify-center gap-1 transition-all"
            >
              <div className="flex items-center gap-3"><Download size={32} /> DESCARGAR WORD (.docx)</div>
              <span className="text-[12px] opacity-70 uppercase tracking-widest font-bold">Generar documento final con datos traducidos</span>
            </button>
          </div>
        )}

        {state.status === ProcessStatus.COMPLETED && (
          <div className="bg-white p-16 rounded-[3rem] text-center space-y-8 max-w-xl mx-auto shadow-2xl">
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
