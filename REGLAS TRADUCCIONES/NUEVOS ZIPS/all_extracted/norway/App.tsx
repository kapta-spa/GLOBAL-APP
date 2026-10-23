
import React, { useState, useEffect } from 'react';
import { 
  FileText, Download, Loader2, 
  CheckCircle2, XCircle, AlertTriangle, Clipboard,
  RefreshCw, Sparkles, ChevronRight
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
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
      // Removemos el override de assignedNumber para que use el extraído por Gemini (sección 4d)
      setState(prev => ({ ...prev, status: ProcessStatus.REVIEW, extractedData: { ...data } }));
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

  return (
    <div className="min-h-screen bg-slate-50 py-24 px-6 flex flex-col items-center">
      <header className="max-w-4xl w-full text-center mb-24">
        <motion.div 
          initial={{ y: -30, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          className="bg-indigo-600 w-24 h-24 rounded-[2rem] shadow-2xl shadow-indigo-200 flex items-center justify-center mx-auto mb-10 ring-8 ring-indigo-100"
        >
          <FileText className="text-white" size={44} />
        </motion.div>
        
        <motion.div
           initial={{ opacity: 0 }}
           animate={{ opacity: 1 }}
           transition={{ delay: 0.2 }}
        >
          <h1 className="text-5xl font-black text-slate-950 tracking-tight sm:text-7xl mb-6">
            NORWAY <span className="text-indigo-600">FULL</span>
          </h1>
          <p className="text-slate-500 text-2xl font-medium leading-relaxed max-w-xl mx-auto">
            Traducción & Automatización Profesional <br />
            <span className="text-indigo-600 font-black">Licencias de Conducir</span>
          </p>
          <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-4">
            <div className="inline-flex items-center gap-3 bg-white px-6 py-2.5 rounded-full border border-slate-200 shadow-sm">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
              <span className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-400">Motor de Extracción Francia → UK v1.2</span>
            </div>
            <a 
              href="/reglas_extraccion_licencias.txt" 
              download="reglas_extraccion_licencias.txt"
              className="inline-flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold px-6 py-2.5 rounded-full shadow-md shadow-indigo-600/20 transition-all hover:scale-105"
            >
              <Download size={14} />
              <span>Descargar Reglas & Prompt (.txt)</span>
            </a>
          </div>
        </motion.div>
      </header>

      <main className="max-w-4xl w-full relative z-10">
        <AnimatePresence mode="wait">
          {state.error && (
            <motion.div 
              initial={{ opacity: 0, y: -20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="mb-10"
            >
              <div className="bg-red-50 border-2 border-red-100 p-8 rounded-[2rem] flex items-start gap-5 shadow-xl shadow-red-500/5">
                <AlertTriangle size={32} className="shrink-0 text-red-500" />
                <div className="flex-1">
                  <h4 className="text-red-900 font-black text-lg mb-1">Error detectado</h4>
                  <p className="text-red-700 font-medium leading-relaxed">{state.error}</p>
                </div>
                <button onClick={() => setState(p => ({...p, error: null}))} className="text-red-400 hover:text-red-600 transition-colors p-2">
                  <XCircle size={28} />
                </button>
              </div>
            </motion.div>
          )}

          {(state.status === ProcessStatus.IDLE || state.status === ProcessStatus.ERROR) && (
            <motion.div 
              key="idle"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="space-y-12"
            >
              <section className="bg-white p-12 sm:p-20 rounded-[3rem] shadow-2xl shadow-slate-200 border border-slate-200/50">
                <div className="space-y-10">
                  <div className="flex items-center gap-6">
                    <div className="w-12 h-12 rounded-2xl bg-indigo-600 text-white flex items-center justify-center font-black text-2xl shadow-xl shadow-indigo-600/20">1</div>
                    <h2 className="text-3xl font-black text-slate-900 tracking-tight">Plantilla Word (.docx)</h2>
                  </div>
                  
                  {!state.templateFile ? (
                    <FileUploader label="PASO 1: CARGAR PLANTILLA" accept=".docx" selectedFile={state.templateFile} onFileSelect={handleTemplateSelect} />
                  ) : (
                    <div className="bg-slate-50 border-2 border-slate-100 p-10 rounded-[2rem] flex items-center gap-8 group transition-all hover:bg-white hover:border-indigo-200 hover:shadow-xl hover:shadow-indigo-500/5">
                      <div className="w-20 h-20 bg-indigo-600 rounded-[1.8rem] flex items-center justify-center text-white shadow-xl rotate-3">
                        <FileText size={40} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-slate-400 font-black text-[10px] uppercase tracking-widest mb-1">Plantilla seleccionada</p>
                        <h4 className="text-slate-900 font-black text-xl truncate">{state.templateFile.name}</h4>
                      </div>
                      <button 
                        onClick={clearTemplate} 
                        className="px-8 py-4 bg-white text-slate-500 hover:text-red-600 hover:border-red-200 border border-slate-200 rounded-2xl text-[10px] font-black tracking-[0.2em] transition-all flex items-center gap-3 shadow-sm uppercase"
                      >
                        <RefreshCw size={16} /> Cambiar
                      </button>
                    </div>
                  )}
                </div>

                <div className="my-20 h-px bg-gradient-to-r from-transparent via-slate-200 to-transparent"></div>

                <div className="space-y-10">
                  <div className="flex items-center gap-6">
                    <div className="w-12 h-12 rounded-2xl bg-indigo-600 text-white flex items-center justify-center font-black text-2xl shadow-xl shadow-indigo-600/20">2</div>
                    <h2 className="text-3xl font-black text-slate-900 tracking-tight">Documento de Identidad</h2>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
                    <FileUploader label="FRENTE (FRONT)" accept="image/*" icon="image" selectedFile={state.frontImage} onFileSelect={(f) => setState(p => ({...p, frontImage: f}))} />
                    <FileUploader label="REVERSO (BACK)" accept="image/*" icon="image" selectedFile={state.backImage} onFileSelect={(f) => setState(p => ({...p, backImage: f}))} />
                  </div>
                </div>

                <div className="mt-20">
                  <button 
                    onClick={handleProcess}
                    disabled={!state.templateFile || !state.frontImage || !state.backImage || state.status === ProcessStatus.PROCESSING}
                    className="w-full relative group"
                  >
                    <div className="absolute -inset-1 bg-gradient-to-r from-indigo-600 to-indigo-400 rounded-[2.5rem] blur-2xl opacity-30 group-hover:opacity-60 transition duration-500 group-disabled:opacity-0"></div>
                    <div className="relative w-full bg-slate-950 text-white py-10 rounded-[2.5rem] font-black text-2xl hover:scale-[1.01] active:scale-[0.99] disabled:bg-slate-200 disabled:text-slate-400 transition-all flex items-center justify-center gap-5 shadow-2xl">
                      {state.status === ProcessStatus.PROCESSING ? (
                        <>
                          <Loader2 className="animate-spin" size={36} />
                          <span>Analizando datos...</span>
                        </>
                      ) : (
                        <>
                          <Sparkles size={32} className="text-indigo-400" />
                          <span>PROCESAR DOCUMENTACIÓN</span>
                        </>
                      )}
                    </div>
                  </button>
                </div>
              </section>
            </motion.div>
          )}

          {state.status === ProcessStatus.PROCESSING && (
            <motion.div 
              key="processing"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 1.05 }}
              className="bg-white p-24 text-center space-y-12 max-w-2xl mx-auto rounded-[3rem] border border-slate-100 shadow-2xl"
            >
              <div className="relative inline-block">
                <div className="absolute inset-0 bg-indigo-500/20 rounded-full animate-ping"></div>
                <div className="relative w-40 h-40 bg-indigo-50 rounded-full flex items-center justify-center border-4 border-indigo-100 shadow-inner">
                  <Loader2 className="animate-spin text-indigo-600" size={72} />
                </div>
              </div>
              <div className="space-y-6">
                <h2 className="text-4xl font-black text-slate-950 tracking-tight">Extrayendo Datos</h2>
                <p className="text-slate-500 font-bold text-xl leading-relaxed">Nuestra IA está traduciendo los campos y preparando la previsualización.</p>
              </div>
            </motion.div>
          )}

          {state.status === ProcessStatus.REVIEW && state.extractedData && (
            <motion.div 
              key="review"
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="max-w-4xl mx-auto space-y-12"
            >
              <DataPreview data={state.extractedData} onChange={(d) => setState(p => ({...p, extractedData: d}))} />
              
              <button 
                onClick={downloadWord} 
                className="w-full relative group"
              >
                 <div className="absolute -inset-1 bg-gradient-to-r from-emerald-600 to-emerald-400 rounded-[2.5rem] blur-2xl opacity-30 group-hover:opacity-60 transition duration-500"></div>
                 <div className="relative w-full bg-emerald-600 text-white py-12 rounded-[2.5rem] font-black text-3xl hover:bg-emerald-500 transition-all flex flex-col items-center justify-center gap-4 shadow-2xl">
                  <div className="flex items-center gap-5"><Download size={48} /> DESCARGAR WORD (.DOCX)</div>
                  <span className="text-xs opacity-80 uppercase tracking-[0.4em] font-black">Información Validada Correctamente</span>
                </div>
              </button>
              
              <button 
                onClick={() => setState(p => ({ ...p, status: ProcessStatus.IDLE }))}
                className="w-full py-6 text-slate-400 font-black text-xs uppercase tracking-[0.3em] hover:text-slate-600 transition-colors"
              >
                Volver al inicio para subir nuevos archivos
              </button>
            </motion.div>
          )}

          {state.status === ProcessStatus.COMPLETED && (
            <motion.div 
              key="completed"
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0 }}
              className="bg-white p-24 text-center space-y-12 max-w-2xl mx-auto rounded-[3rem] border border-slate-100 shadow-2xl"
            >
              <div className="w-40 h-40 bg-emerald-50 border-4 border-emerald-100 rounded-[3.5rem] flex items-center justify-center mx-auto text-emerald-600 rotate-12 shadow-xl relative">
                <CheckCircle2 size={84} />
                <div className="absolute -top-6 -right-6 bg-white p-4 rounded-3xl shadow-2xl text-emerald-600 animate-bounce">
                  <Sparkles size={32} />
                </div>
              </div>
              <div className="space-y-6">
                <h2 className="text-6xl font-black text-slate-950 tracking-tight">¡Todo listo!</h2>
                <p className="text-slate-500 font-bold text-2xl leading-relaxed">El documento ha sido generado y descargado en tu equipo con éxito.</p>
              </div>
              <button 
                onClick={() => setState(p => ({ ...p, status: ProcessStatus.IDLE, frontImage: null, backImage: null, extractedData: null }))} 
                className="w-full py-10 bg-slate-950 text-white rounded-[2.5rem] font-black text-2xl hover:bg-black transition-all shadow-2xl"
              >
                PROCESAR SIGUIENTE LICENCIA
              </button>
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      <footer className="mt-32 max-w-4xl w-full pt-12 border-t border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-8 opacity-40">
        <div className="flex items-center gap-6 text-[10px] font-black uppercase tracking-[0.3em] text-slate-500">
          <span>DOCUFILL AI</span>
          <span className="w-1.5 h-1.5 rounded-full bg-slate-300"></span>
          <span>AUTOMATION ENGINE v1.2</span>
        </div>
        <div className="text-[10px] font-black text-slate-400 tracking-widest uppercase">
          © 2026 PROCESAMIENTO INTELIGENTE
        </div>
      </footer>
    </div>
  );
};

export default App;
