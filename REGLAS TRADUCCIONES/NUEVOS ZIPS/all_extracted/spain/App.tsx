
import React, { useState, useEffect } from 'react';
import { 
  FileText, Download, Loader2, 
  CheckCircle2, XCircle, AlertTriangle, Clipboard,
  RefreshCw, MousePointer2, FileDown, BookOpen,
  Image as ImageIcon, Eye
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
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
  const [enlargedPhoto, setEnlargedPhoto] = useState<{title: string, src: string} | null>(null);

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

  const handleDownloadRules = () => {
    const rulesText = `===================================================================
REGLAS DE EXTRACCIÓN Y TRADUCCIÓN DE LICENCIAS (SPAIN FULL)
===================================================================

1. Nº DE EXPEDIENTE / ASSIGNED NUMBER
   - Variable en plantilla: {{assignedNumber}}
   - Regla: Número asignado manualmente por el usuario (ej: B-2025-001).

2. APELLIDOS / SURNAME
   - Variable en plantilla: {{surname}}
   - Regla: Extraído de la Casilla 1 de la licencia. Conserva el formato original.

3. NOMBRE PRINCIPAL / FIRST NAME
   - Variable en plantilla: {{firstName}}
   - Regla: Extraído de la Casilla 2. Solo incluye el primer nombre de la persona.

4. OTROS NOMBRES / MIDDLE NAMES
   - Variable en plantilla: {{middleName}}
   - Regla: Extraído de la Casilla 2. Incluye el segundo nombre y nombres subsiguientes si existen.

5. NÚMERO DE LICENCIA / LICENSE NUMBER
   - Variable en plantilla: {{licenseNumber}}
   - Regla: Extraído de la Casilla 4d / Casilla 5 (DNI, NIE o Número de Documento).

6. FECHA DE NACIMIENTO / DATE OF BIRTH
   - Variable en plantilla: {{dateOfBirth}}
   - Regla: Extraído de la Casilla 3. Formato requerido en inglés: "DD Month YYYY" (ej: 14 March 1988).

7. LUGAR DE NACIMIENTO / PLACE OF BIRTH
   - Variable en plantilla: {{placeOfBirth}}
   - Regla: Extraído de la Casilla 3. Traducido obligatoriamente al inglés (ej: "Madrid, Spain").

8. FECHA DE EXPEDICIÓN / ISSUE DATE
   - Variable en plantilla: {{issueDate}}
   - Regla: Extraído de la Casilla 4a. Formato requerido en inglés: "DD Month YYYY".

9. AUTORIDAD DE EXPEDICIÓN / AUTHORITY
   - Variable en plantilla: {{authority}}
   - Regla: Extraído de la Casilla 4c. Los códigos numéricos o provinciales de la jefatura de tráfico se traducen al nombre de la ciudad/provincia en inglés (ej: "08" -> "Barcelona, Spain", "28" -> "Madrid, Spain").

10. FECHAS DE CATEGORÍAS / CATEGORIES DATES
    - Variable en plantilla: {{categoriesDates}}
    - Regla: Extraídas de la tabla del reverso (Columna 10). Las categorías con la misma fecha de validez se agrupan en una sola línea (ej: "A1, A2, B: 12 June 2015").

11. CÓDIGOS DE SERIE / DOCUMENT SERIES
    - Variable en plantilla: {{codes}}
    - Regla: Ubicados en la esquina superior izquierda del reverso de la tarjeta.

12. RESTRICCIONES Y CÓDIGOS ADICIONALES / RESTRICTIONS & CODES
    - Variable en plantilla: {{explicacionCodigos}}
    - Regla: Traducidos e interpretados al inglés de la Columna 12 del reverso.
      - Código 70: "70. Exchange of driver's license number [número]"
      - Código 106: "106. Special restriction / condition"
      - Código 01: "01. Sight correction and/or protection (Glasses or contact lenses)"
      - Código 78: "78. Restricted to vehicles with automatic transmission"
      - NOTA IMPORTANTE: Sin enlaces web, URLs ni referencias a documentos externos.

13. VIGENCIA DEL CÓDIGO 106 / CODE 106 DATES
    - Variables en plantilla: {{code106From}} y {{code106To}}
    - Regla: Fechas "Desde" y "Hasta" asociadas al código de restricción 106 si están presentes.

14. FECHA DE CADUCIDAD / EXPIRY DATE
    - Variable en plantilla: {{expiryDate}}
    - Regla: Extraído de la Casilla 4b. Formato requerido en inglés: "DD Month YYYY".

15. CATEGORÍAS / CATEGORIES CLASS
    - Variable en plantilla: {{class}}
    - Regla: Extraído de la Casilla 9 del frente de la tarjeta (ej: "AM, B, C1").

===================================================================
FORMATO GLOBAL DE FECHAS: "DD Month YYYY" (ej: "05 January 2024")
===================================================================`;

    const blob = new Blob([rulesText], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'Reglas_Traduccion_Spain_Full.txt';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="min-h-screen bg-slate-50 py-12 px-4 flex flex-col items-center font-sans text-slate-900 overflow-x-hidden selection:bg-indigo-100 selection:text-indigo-900">
      <header className="max-w-6xl w-full text-center mb-16 relative">
        <motion.div 
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ type: "spring", stiffness: 260, damping: 20 }}
          className="bg-indigo-600 w-20 h-20 rounded-[2rem] shadow-2xl shadow-indigo-200 flex items-center justify-center mx-auto mb-6"
        >
          <FileText className="text-white" size={40} />
        </motion.div>
        <motion.div
           initial={{ y: 20, opacity: 0 }}
           animate={{ y: 0, opacity: 1 }}
           transition={{ delay: 0.1 }}
        >
          <h1 className="text-5xl font-black text-slate-900 tracking-tight mb-3">SPAIN FULL</h1>
          <p className="text-slate-500 text-lg font-medium max-w-lg mx-auto leading-relaxed mb-6">
            Automatización inteligente de traducción para licencias de conducir Francia → UK.
          </p>

          <button
            onClick={handleDownloadRules}
            className="inline-flex items-center gap-2 px-5 py-2.5 bg-indigo-50 border border-indigo-200 text-indigo-700 hover:bg-indigo-100 rounded-2xl text-xs font-black transition-all shadow-sm group"
          >
            <BookOpen size={16} className="text-indigo-600 group-hover:scale-110 transition-transform" />
            DESCARGAR REGLAS DE TRADUCCIÓN (.TXT)
            <FileDown size={14} className="text-indigo-500" />
          </button>
        </motion.div>
      </header>

      <main className="max-w-4xl w-full relative">
        <AnimatePresence mode="wait">
          {state.error && (
            <motion.div 
              initial={{ height: 0, opacity: 0, y: -20 }}
              animate={{ height: "auto", opacity: 1, y: 0 }}
              exit={{ height: 0, opacity: 0, y: -20 }}
              className="max-w-4xl mx-auto mb-8 bg-white text-red-700 p-6 rounded-[2rem] border-2 border-red-50 flex items-start gap-4 shadow-xl shadow-red-500/5 overflow-hidden"
            >
              <div className="w-12 h-12 bg-red-100 rounded-2xl flex items-center justify-center shrink-0">
                <AlertTriangle size={24} className="text-red-500" />
              </div>
              <div className="flex-1">
                <h4 className="font-bold text-red-900 mb-1">¡Ups! Algo salió mal</h4>
                <p className="text-sm font-medium opacity-80">{state.error}</p>
              </div>
              <button 
                onClick={() => setState(p => ({...p, error: null}))}
                className="w-10 h-10 rounded-full hover:bg-red-50 flex items-center justify-center transition-colors"
              >
                <XCircle size={20} />
              </button>
            </motion.div>
          )}
        </AnimatePresence>

        <AnimatePresence mode="wait">
          {(state.status === ProcessStatus.IDLE || state.status === ProcessStatus.ERROR) && (
            <motion.div 
              key="setup"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="flex flex-col gap-10"
            >
              <section className="space-y-12 bg-white/50 backdrop-blur-xl p-10 rounded-[3rem] border border-white shadow-2xl">
                <div className="space-y-6">
                  <h2 className="text-2xl font-black text-slate-800 flex items-center gap-4">
                    <span className="w-10 h-10 rounded-2xl bg-slate-900 text-white flex items-center justify-center text-lg">1</span>
                    Configuración de Plantilla
                  </h2>
                  {!state.templateFile ? (
                    <div className="bg-white border-2 border-dashed border-slate-200 rounded-[2.5rem] p-12 transition-all hover:border-indigo-300 hover:shadow-lg shadow-indigo-100/50">
                      <FileUploader label="Sube tu archivo .docx de base" accept=".docx" selectedFile={state.templateFile} onFileSelect={handleTemplateSelect} />
                    </div>
                  ) : (
                    <motion.div 
                      layoutId="template-active"
                      className="bg-emerald-500/5 border-2 border-emerald-500/20 rounded-[2.5rem] p-10 flex items-center gap-8 shadow-inner shadow-emerald-500/5"
                    >
                      <div className="w-20 h-20 bg-emerald-500 rounded-3xl flex items-center justify-center text-white shrink-0 shadow-lg shadow-emerald-200">
                        <FileText size={36} />
                      </div>
                      <div className="flex-1">
                        <h4 className="text-emerald-900 text-xl font-black mb-1">Plantilla vinculada</h4>
                        <p className="text-emerald-700 font-medium truncate max-w-[250px]">{state.templateFile.name}</p>
                      </div>
                      <button 
                        onClick={clearTemplate} 
                        className="px-6 py-3 bg-white border border-emerald-200 rounded-2xl text-sm font-black text-emerald-600 hover:bg-emerald-100 transition-all flex items-center gap-3 shadow-sm"
                      >
                        <RefreshCw size={16}/> CAMBIAR
                      </button>
                    </motion.div>
                  )}
                </div>

                <div className="space-y-6 pt-10 border-t border-slate-100">
                  <h2 className="text-2xl font-black text-slate-800 flex items-center gap-4">
                    <span className="w-10 h-10 rounded-2xl bg-slate-900 text-white flex items-center justify-center text-lg">2</span>
                    Documentación de la Licencia
                  </h2>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                    <FileUploader label="Licencia Cara A (Frente)" accept="image/*" icon="image" selectedFile={state.frontImage} onFileSelect={(f) => setState(p => ({...p, frontImage: f}))} />
                    <FileUploader label="Licencia Cara B (Reverso)" accept="image/*" icon="image" selectedFile={state.backImage} onFileSelect={(f) => setState(p => ({...p, backImage: f}))} />
                  </div>
                </div>

                <motion.button 
                  whileHover={{ scale: 1.02, y: -4 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={handleProcess}
                  disabled={!state.templateFile || !state.frontImage || !state.backImage || state.status === ProcessStatus.PROCESSING}
                  className="w-full bg-slate-900 text-white py-8 rounded-[2rem] font-black text-2xl hover:bg-slate-800 disabled:opacity-20 shadow-2xl shadow-indigo-900/10 transition-all flex items-center justify-center gap-4"
                >
                  {state.status === ProcessStatus.PROCESSING ? <Loader2 className="animate-spin" size={32} /> : <>EMPEZAR ANÁLISIS IA <MousePointer2 size={24} /></>}
                </motion.button>
              </section>
            </motion.div>
          )}

          {state.status === ProcessStatus.PROCESSING && (
            <motion.div 
              key="processing"
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 1.1 }}
              className="bg-white p-24 rounded-[4rem] text-center space-y-8 max-w-2xl mx-auto shadow-2xl relative overflow-hidden"
            >
              <div className="absolute inset-x-0 top-0 h-2 bg-slate-100 overflow-hidden">
                <motion.div 
                  initial={{ x: "-100%" }}
                  animate={{ x: "100%" }}
                  transition={{ duration: 1.5, repeat: Infinity, ease: "linear" }}
                  className="h-full w-1/3 bg-indigo-600 shadow-[0_0_20px_rgba(79,70,229,0.5)]"
                />
              </div>
              <div className="relative">
                <div className="w-32 h-32 mx-auto relative mb-8">
                  <motion.div 
                    animate={{ rotate: 360 }}
                    transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
                    className="absolute inset-0 rounded-full border-4 border-slate-100 border-t-indigo-600"
                  />
                  <div className="absolute inset-4 rounded-full bg-indigo-50 flex items-center justify-center text-indigo-600">
                    <RefreshCw size={40} className="animate-spin-slow" />
                  </div>
                </div>
                <h2 className="text-4xl font-black text-slate-900 tracking-tight leading-none">Procesando con Gemini</h2>
                <p className="text-slate-500 font-medium text-lg mt-4">Analizando imágenes y traduciendo metadatos...</p>
              </div>
            </motion.div>
          )}

          {state.status === ProcessStatus.REVIEW && state.extractedData && (
            <motion.div 
              key="review"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="max-w-4xl mx-auto space-y-10"
            >
              {imagesBase64 && (
                <div className="bg-white/80 backdrop-blur-xl border-2 border-slate-100 rounded-[2.5rem] p-6 sm:p-8 shadow-xl shadow-indigo-500/5">
                  <div className="flex items-center justify-between mb-5 px-2">
                    <h3 className="text-sm font-black text-slate-800 uppercase tracking-widest flex items-center gap-2">
                      <ImageIcon size={18} className="text-indigo-600" />
                      Fotos de Licencia Cargadas
                    </h3>
                    <span className="text-[11px] font-bold text-slate-400">Haz clic en una imagen para ampliarla</span>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                    <div 
                      onClick={() => setEnlargedPhoto({ title: "Licencia Cara A (Frente)", src: `data:image/jpeg;base64,${imagesBase64.front}` })}
                      className="cursor-pointer group relative rounded-2xl overflow-hidden bg-slate-900/5 border-2 border-slate-200/80 hover:border-indigo-400 aspect-[16/10] transition-all shadow-sm"
                    >
                      <img 
                        src={`data:image/jpeg;base64,${imagesBase64.front}`}
                        alt="Licencia Cara A"
                        referrerPolicy="no-referrer"
                        className="w-full h-full object-contain p-2 transition-transform duration-300 group-hover:scale-105"
                      />
                      <div className="absolute top-2.5 left-2.5 px-3 py-1 rounded-full bg-slate-900/80 backdrop-blur-xs text-white text-[10px] font-black uppercase tracking-wider shadow">
                        Cara A (Frente)
                      </div>
                      <div className="absolute top-2.5 right-2.5 w-7 h-7 rounded-lg bg-black/60 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                        <Eye size={14} />
                      </div>
                    </div>

                    <div 
                      onClick={() => setEnlargedPhoto({ title: "Licencia Cara B (Reverso)", src: `data:image/jpeg;base64,${imagesBase64.back}` })}
                      className="cursor-pointer group relative rounded-2xl overflow-hidden bg-slate-900/5 border-2 border-slate-200/80 hover:border-indigo-400 aspect-[16/10] transition-all shadow-sm"
                    >
                      <img 
                        src={`data:image/jpeg;base64,${imagesBase64.back}`}
                        alt="Licencia Cara B"
                        referrerPolicy="no-referrer"
                        className="w-full h-full object-contain p-2 transition-transform duration-300 group-hover:scale-105"
                      />
                      <div className="absolute top-2.5 left-2.5 px-3 py-1 rounded-full bg-slate-900/80 backdrop-blur-xs text-white text-[10px] font-black uppercase tracking-wider shadow">
                        Cara B (Reverso)
                      </div>
                      <div className="absolute top-2.5 right-2.5 w-7 h-7 rounded-lg bg-black/60 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                        <Eye size={14} />
                      </div>
                    </div>
                  </div>
                </div>
              )}

              <DataPreview data={state.extractedData} onChange={(d) => setState(p => ({...p, extractedData: d}))} />
              
              <motion.button 
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={downloadWord} 
                className="w-full bg-emerald-600 text-white py-10 rounded-[2.5rem] font-black text-3xl hover:bg-emerald-700 shadow-2xl shadow-emerald-900/10 flex flex-col items-center justify-center gap-2 transition-all group"
              >
                <div className="flex items-center gap-4">
                  <Download size={40} className="group-hover:translate-y-1 transition-transform" /> 
                  DESCARGAR WORD
                </div>
                <span className="text-[14px] opacity-70 uppercase tracking-[0.2em] font-bold">Generar documento oficial traducido</span>
              </motion.button>
            </motion.div>
          )}

          {state.status === ProcessStatus.COMPLETED && (
            <motion.div 
              key="completed"
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              className="bg-white p-20 rounded-[4rem] text-center space-y-10 max-w-xl mx-auto shadow-2xl relative border-4 border-emerald-50"
            >
              <motion.div 
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ delay: 0.2, type: "spring" }}
                className="w-24 h-24 bg-emerald-100 rounded-full flex items-center justify-center mx-auto text-emerald-600 shadow-xl shadow-emerald-100"
              >
                <CheckCircle2 size={56} />
              </motion.div>
              <div className="space-y-4">
                <h2 className="text-4xl font-black text-slate-900 tracking-tight">¡Éxito total!</h2>
                <p className="text-slate-500 font-medium">El documento ha sido generado y descargado correctamente.</p>
              </div>
              <button 
                onClick={() => setState(p => ({ ...p, status: ProcessStatus.IDLE, frontImage: null, backImage: null, extractedData: null }))} 
                className="w-full py-6 bg-slate-900 text-white rounded-[1.5rem] font-black text-xl hover:bg-slate-800 transition-all shadow-xl"
              >
                PROCESAR SIGUIENTE
              </button>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Modal de foto ampliada */}
        <AnimatePresence>
          {enlargedPhoto && (
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-50 bg-slate-950/85 backdrop-blur-sm flex items-center justify-center p-4 sm:p-8"
              onClick={() => setEnlargedPhoto(null)}
            >
              <motion.div 
                initial={{ scale: 0.9, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.9, opacity: 0 }}
                onClick={(e) => e.stopPropagation()}
                className="bg-white rounded-[2.5rem] overflow-hidden max-w-4xl w-full shadow-2xl border border-white/20 flex flex-col max-h-[90vh]"
              >
                <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center">
                      <ImageIcon size={20} />
                    </div>
                    <h4 className="font-black text-slate-800 text-base">{enlargedPhoto.title}</h4>
                  </div>
                  <button 
                    id="btn-close-enlarged-photo"
                    onClick={() => setEnlargedPhoto(null)}
                    className="w-10 h-10 rounded-full hover:bg-slate-200/60 text-slate-500 hover:text-slate-900 flex items-center justify-center transition-colors"
                  >
                    <XCircle size={24} />
                  </button>
                </div>

                <div className="p-6 overflow-auto flex items-center justify-center bg-slate-100/50 min-h-[350px]">
                  <img 
                    src={enlargedPhoto.src} 
                    alt={enlargedPhoto.title} 
                    referrerPolicy="no-referrer"
                    className="max-h-[70vh] w-auto object-contain rounded-2xl shadow-xl border border-slate-200"
                  />
                </div>

                <div className="p-4 border-t border-slate-100 bg-white flex items-center justify-end">
                  <button 
                    onClick={() => setEnlargedPhoto(null)}
                    className="px-6 py-2.5 bg-slate-900 text-white rounded-xl font-bold hover:bg-slate-800 transition-colors"
                  >
                    Cerrar
                  </button>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </main>
      
      <footer className="mt-20 pb-12 text-slate-400 font-black text-sm uppercase tracking-widest opacity-50">
        &copy; {new Date().getFullYear()} SPAIN FULL &bull; Intelligent Document Automation
      </footer>
    </div>
  );
};

export default App;
