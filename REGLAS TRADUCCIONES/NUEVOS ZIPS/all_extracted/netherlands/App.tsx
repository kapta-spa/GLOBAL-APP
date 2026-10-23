
import React, { useState, useEffect } from 'react';
import { 
  FileText, Download, Loader2, 
  CheckCircle2, XCircle, AlertTriangle, Clipboard,
  RefreshCw, Layout, ArrowRight, Sparkles, Files
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
              // Only allow pasting in idle or error states
              if (prev.status !== ProcessStatus.IDLE && prev.status !== ProcessStatus.ERROR) return prev;
              
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
  }, [state.status]);

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

  const resetProcess = () => {
    setState(prev => ({
      ...prev,
      frontImage: null,
      backImage: null,
      status: ProcessStatus.IDLE,
      extractedData: null,
      error: null
    }));
  };

  return (
    <div className="min-h-screen bg-[#f1f5f9] flex flex-col font-sans selection:bg-indigo-100">
      {/* Header */}
      <nav className="sticky top-0 z-50 bg-white/80 backdrop-blur-md border-b border-slate-200">
        <div className="max-w-6xl mx-auto px-6 h-20 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="bg-indigo-600 w-10 h-10 rounded-xl flex items-center justify-center shadow-lg shadow-indigo-200">
              <Sparkles className="text-white" size={20} />
            </div>
            <div>
              <h1 className="text-xl font-black text-slate-900 tracking-tight leading-none">DocuFill AI</h1>
              <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-1">Professional Automation</p>
            </div>
          </div>
          
          <div className="flex items-center gap-4">
            <a 
              href="/reglas_extraccion_licencia.txt" 
              download="reglas_extraccion_licencia.txt"
              className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 rounded-full text-[11px] font-bold transition-all border border-indigo-200"
              title="Descargar especificación técnica en .txt"
            >
              <Download size={13} /> Reglas (.txt)
            </a>
            <div className="hidden md:flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 rounded-full text-[11px] font-bold text-slate-500">
              <Layout size={14} /> Netherlands Template Mode
            </div>
            {state.status !== ProcessStatus.IDLE && (
              <button 
                onClick={resetProcess}
                className="text-[11px] font-black text-indigo-600 hover:text-indigo-700 uppercase tracking-wider flex items-center gap-2 transition-all"
              >
                <RefreshCw size={14} /> Empezar de nuevo
              </button>
            )}
          </div>
        </div>
      </nav>

      <main className="flex-1 max-w-6xl w-full mx-auto p-6 md:p-12">
        <AnimatePresence mode="wait">
          {state.error && (
            <motion.div 
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="overflow-hidden mb-8"
            >
              <div className="bg-red-50 text-red-700 p-5 rounded-2xl border border-red-100 flex items-start gap-4 shadow-sm">
                <AlertTriangle size={24} className="shrink-0 text-red-500" />
                <div className="flex-1 text-sm font-medium">{state.error}</div>
                <button onClick={() => setState(p => ({...p, error: null}))} className="text-red-400 hover:text-red-600">
                  <XCircle size={20} />
                </button>
              </div>
            </motion.div>
          )}

          {state.status === ProcessStatus.PROCESSING ? (
            <motion.div 
              key="processing"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 1.05 }}
              className="flex flex-col items-center justify-center py-24"
            >
              <div className="relative">
                <div className="absolute inset-0 bg-indigo-500/20 rounded-full blur-2xl animate-pulse" />
                <div className="bg-white p-8 rounded-3xl shadow-2xl relative">
                  <Loader2 className="w-16 h-16 text-indigo-600 animate-spin" />
                </div>
              </div>
              <h2 className="text-2xl font-black text-slate-800 mt-10 text-center">Analizando Licencia</h2>
              <p className="text-slate-500 mt-3 text-center max-w-sm">
                Gemini está extrayendo y traduciendo los datos de tus fotos. Esto tomará unos segundos...
              </p>
            </motion.div>
          ) : (state.status === ProcessStatus.IDLE || state.status === ProcessStatus.ERROR) ? (
            <motion.div 
              key="idle"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="grid grid-cols-1 lg:grid-cols-12 gap-12"
            >
              {/* Left Column - Setup */}
              <div className="lg:col-span-4 space-y-8">
                <section className="bg-white p-8 rounded-[2rem] border border-slate-200 shadow-sm relative overflow-hidden">
                  <div className="absolute top-0 right-0 w-24 h-24 bg-indigo-50 rounded-full -mr-12 -mt-12" />
                  <div className="relative">
                    <div className="flex items-center gap-3 mb-6">
                      <div className="w-8 h-8 rounded-lg bg-indigo-600 text-white flex items-center justify-center text-xs font-bold shadow-md shadow-indigo-100">
                        1
                      </div>
                      <h2 className="text-lg font-black text-slate-800 tracking-tight">Plantilla Base</h2>
                    </div>
                    
                    {!state.templateFile ? (
                      <FileUploader 
                        label="" 
                        accept=".docx" 
                        selectedFile={state.templateFile} 
                        onFileSelect={handleTemplateSelect} 
                      />
                    ) : (
                      <div className="group bg-emerald-50 border border-emerald-100 rounded-2xl p-5 flex items-center gap-4 transition-all hover:bg-emerald-100/50">
                        <div className="w-10 h-10 bg-emerald-100 rounded-xl flex items-center justify-center text-emerald-600 shrink-0">
                          <Files size={20} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <h4 className="text-emerald-900 font-bold text-sm truncate">{state.templateFile.name}</h4>
                          <p className="text-emerald-600 text-[10px] font-bold">CARGADA CORRECTAMENTE</p>
                        </div>
                        <button onClick={clearTemplate} className="p-2 text-emerald-300 hover:text-emerald-600 transition-colors">
                          <RefreshCw size={16} />
                        </button>
                      </div>
                    )}
                    <p className="text-[11px] text-slate-400 mt-4 leading-relaxed">
                      Sube el archivo .docx que contiene las etiquetas variable como <span className="font-mono text-indigo-500 font-bold">{"{{surname}}"}</span>
                    </p>
                  </div>
                </section>

                <div className="bg-slate-800 rounded-[2rem] p-8 text-white shadow-xl relative overflow-hidden">
                  <div className="absolute bottom-0 right-0 opacity-10">
                    <Clipboard size={120} />
                  </div>
                  <h3 className="text-lg font-black mb-3">¿Sabías que...?</h3>
                  <p className="text-sm text-slate-300 leading-relaxed font-medium">
                    Puedes simplemente copiar una imagen del explorador y <span className="text-white font-bold underline decoration-indigo-400 underline-offset-4">pegarla (Ctrl+V)</span> aquí mismo para cargar las fotos rápidamente.
                  </p>
                </div>
              </div>

              {/* Right Column - Photos */}
              <div className="lg:col-span-8 flex flex-col gap-8">
                <section className="bg-white p-8 md:p-12 rounded-[2.5rem] border border-slate-200 shadow-sm">
                  <div className="flex items-center justify-between mb-10">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-lg bg-indigo-600 text-white flex items-center justify-center text-xs font-bold shadow-md shadow-indigo-100">
                        2
                      </div>
                      <h2 className="text-xl font-black text-slate-800 tracking-tight">Fotos de Licencia</h2>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                    <FileUploader label="Parte Frontal" accept="image/*" icon="image" selectedFile={state.frontImage} onFileSelect={(f) => setState(p => ({...p, frontImage: f}))} />
                    <FileUploader label="Parte Posterior" accept="image/*" icon="image" selectedFile={state.backImage} onFileSelect={(f) => setState(p => ({...p, backImage: f}))} />
                  </div>

                  <div className="mt-12 flex items-center gap-4">
                    <button 
                      onClick={handleProcess}
                      disabled={!state.templateFile || !state.frontImage || !state.backImage || state.status === ProcessStatus.PROCESSING}
                      className="flex-1 bg-slate-900 text-white py-6 rounded-[1.5rem] font-black text-xl hover:bg-indigo-600 disabled:opacity-20 disabled:hover:bg-slate-900 shadow-2xl transition-all flex items-center justify-center gap-3 active:scale-[0.98]"
                    >
                      PROCESAR DOCUMENTO <ArrowRight size={24} />
                    </button>
                  </div>
                </section>
              </div>
            </motion.div>
          ) : (state.status === ProcessStatus.REVIEW || state.status === ProcessStatus.COMPLETED) && state.extractedData && (
            <motion.div 
              key="review"
              initial={{ opacity: 0, scale: 0.98 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 1.02 }}
              className="grid grid-cols-1 lg:grid-cols-12 gap-10"
            >
              <div className="lg:col-span-8">
                <DataPreview 
                  data={state.extractedData} 
                  onChange={(d) => setState(p => ({...p, extractedData: d}))} 
                />
              </div>

              <div className="lg:col-span-4 flex flex-col gap-6">
                <div className="bg-white p-8 rounded-[2rem] border border-slate-200 shadow-sm sticky top-32">
                  <h3 className="font-black text-slate-800 text-lg mb-6">Acciones Finales</h3>
                  
                  <div className="space-y-4">
                    <button 
                      onClick={downloadWord}
                      disabled={!state.extractedData.assignedNumber}
                      className="w-full group bg-indigo-600 text-white p-6 rounded-[1.25rem] font-black text-lg hover:bg-emerald-600 transition-all shadow-lg shadow-indigo-100 flex items-center justify-center gap-3 disabled:opacity-30 disabled:hover:bg-indigo-600 active:scale-95"
                    >
                      <Download size={22} className="group-hover:translate-y-0.5 transition-transform" /> 
                      GENERAR DOCX
                    </button>

                    {!state.extractedData.assignedNumber && (
                      <p className="text-[10px] text-center font-bold text-red-500 uppercase tracking-widest bg-red-50 p-2 rounded-lg">
                        Asigna un número para continuar
                      </p>
                    )}

                    <div className="pt-4 border-t border-slate-100">
                      <div className="flex items-center gap-3 text-slate-400 text-[11px] font-bold">
                        <CheckCircle2 size={16} className="text-emerald-500" /> Plantilla cargada
                      </div>
                      <div className="flex items-center gap-3 text-slate-400 text-[11px] font-bold mt-2">
                        <CheckCircle2 size={16} className="text-emerald-500" /> OCR procesado exitosamente
                      </div>
                    </div>
                  </div>

                  {state.status === ProcessStatus.COMPLETED && (
                    <motion.div 
                      initial={{ scale: 0 }}
                      animate={{ scale: 1 }}
                      className="mt-8 bg-emerald-50 border border-emerald-100 p-6 rounded-2xl flex flex-col items-center gap-3"
                    >
                      <div className="w-12 h-12 bg-emerald-500 rounded-full flex items-center justify-center text-white shadow-lg">
                        <CheckCircle2 size={24} />
                      </div>
                      <div className="text-center">
                        <h4 className="font-bold text-emerald-900">Listo</h4>
                        <p className="text-[11px] text-emerald-600 mt-1 font-medium">Documento generado y descargado.</p>
                      </div>
                    </motion.div>
                  )}
                </div>

                <div className="bg-indigo-50 border border-indigo-100 rounded-[2rem] p-8 hidden lg:block">
                  <h4 className="text-indigo-900 font-bold text-sm mb-3">Recomendación</h4>
                  <p className="text-xs text-indigo-700 leading-relaxed font-medium">
                    Verifica los campos resaltados en color esmeralda y el BSN. Gemini ha traducido automáticamente los nombres de los lugares y la autoridad.
                  </p>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      <footer className="py-12 border-t border-slate-200 mt-auto">
        <div className="max-w-6xl mx-auto px-6 flex flex-col md:row items-center justify-between gap-6">
          <div className="flex items-center gap-2 opacity-30 grayscale saturate-0">
            <Sparkles size={16} />
            <span className="text-[10px] font-black tracking-[0.2em] uppercase">DocuFill System 2.4</span>
          </div>
          <div className="flex items-center gap-8">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Privacy Secured</span>
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Local OCR</span>
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">No Cloud Storage</span>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default App;
