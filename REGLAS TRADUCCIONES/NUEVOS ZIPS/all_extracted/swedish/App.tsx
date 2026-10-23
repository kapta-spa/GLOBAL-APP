
import React, { useState, useEffect } from 'react';
import { 
  FileText, Download, Loader2, 
  CheckCircle2, XCircle, AlertTriangle,
  RefreshCw, ChevronRight, Layout, ShieldCheck
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import FileUploader from './components/FileUploader';
import DataPreview from './components/DataPreview';
import { extractDataFromLicense } from './services/geminiService';
import { generateFilledDoc, optimizeImage } from './services/docService';
import { AppState, ProcessStatus } from './types';

// --- Database Logic (IndexedDB) ---
const DB_NAME = 'DocuFillDB';
const STORE_NAME = 'templates';

const initDB = (): Promise<IDBDatabase> => {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 3); // Bump version if needed
    request.onupgradeneeded = () => {
      if (!request.result.objectStoreNames.contains(STORE_NAME)) {
        request.result.createObjectStore(STORE_NAME);
      }
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

  const getCurrentStep = () => {
    if (state.status === ProcessStatus.COMPLETED) return 4;
    if (state.status === ProcessStatus.REVIEW) return 3;
    if (state.status === ProcessStatus.PROCESSING) return 2;
    if (state.templateFile) return 2;
    return 1;
  };

  const steps = [
    { id: 1, label: 'Plantilla', icon: FileText },
    { id: 2, label: 'Documentos', icon: Layout },
    { id: 3, label: 'Revisión', icon: ShieldCheck },
    { id: 4, label: 'Finalizado', icon: CheckCircle2 },
  ];

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

  return (
    <div className="min-h-screen bg-[#f8fafc] flex flex-col font-sans text-slate-900 overflow-x-hidden">
      {/* Header Fijo / Navigation */}
      <header className="sticky top-0 z-50 bg-white/80 backdrop-blur-md border-b border-slate-200">
        <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="bg-indigo-600 p-2 rounded-lg text-white">
              <FileText size={20} />
            </div>
            <div>
              <h1 className="text-lg font-black tracking-tight leading-none">SWEDISH FULL</h1>
              <p className="text-[10px] text-indigo-600 font-bold uppercase tracking-widest mt-0.5">Automation Pro</p>
            </div>
          </div>

          {/* Stepper Desktop */}
          <nav className="hidden md:flex items-center gap-2">
            {steps.map((step, idx) => (
              <React.Fragment key={step.id}>
                <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full transition-all ${
                  getCurrentStep() >= step.id ? 'bg-indigo-50 text-indigo-700' : 'text-slate-400'
                }`}>
                  <step.icon size={16} className={getCurrentStep() === step.id ? 'animate-pulse' : ''} />
                  <span className="text-xs font-bold uppercase tracking-wide">{step.label}</span>
                </div>
                {idx < steps.length - 1 && <ChevronRight size={14} className="text-slate-300" />}
              </React.Fragment>
            ))}
          </nav>

          <div className="flex items-center gap-4">
            <div className="px-3 py-1 bg-emerald-50 text-emerald-700 text-[10px] font-black rounded-full border border-emerald-100 uppercase tracking-tighter">
              Gemini Flash 2.0
            </div>
          </div>
        </div>
      </header>

      <main className="flex-1 max-w-4xl w-full mx-auto p-6 md:p-12">
        <AnimatePresence mode="wait">
          {state.error && (
            <motion.div 
              initial={{ opacity: 0, y: -20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="mb-8 bg-red-50 text-red-700 p-5 rounded-2xl border border-red-200 flex items-start gap-4 shadow-sm"
            >
              <AlertTriangle size={24} className="shrink-0 text-red-500" />
              <div className="flex-1 text-xs font-medium">{state.error}</div>
              <button onClick={() => setState(p => ({...p, error: null}))}><XCircle size={20} /></button>
            </motion.div>
          )}
        </AnimatePresence>

        <AnimatePresence mode="wait">
          {(state.status === ProcessStatus.IDLE || state.status === ProcessStatus.ERROR) && (
            <motion.div 
              key="idle"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="flex flex-col gap-10"
            >
              <section className="space-y-10">
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <h2 className="text-xl font-black text-slate-800 flex items-center gap-3">
                      <span className="w-8 h-8 rounded-full bg-slate-900 text-white flex items-center justify-center text-sm font-mono">01</span>
                      Configuración de Plantilla
                    </h2>
                  </div>
                  
                  {!state.templateFile ? (
                    <div className="bg-white border border-slate-200 rounded-[2rem] p-2 shadow-sm overflow-hidden">
                      <div className="border-2 border-dashed border-slate-200 rounded-[1.8rem] p-10 hover:border-indigo-400 transition-colors bg-slate-50/50">
                        <FileUploader label="Documento Base (.docx)" accept=".docx" selectedFile={state.templateFile} onFileSelect={handleTemplateSelect} />
                      </div>
                    </div>
                  ) : (
                    <motion.div 
                      layoutId="template-active"
                      className="bg-white border border-emerald-200 rounded-[2rem] p-8 flex items-center gap-6 shadow-sm ring-4 ring-emerald-50"
                    >
                      <div className="w-14 h-14 bg-emerald-500 rounded-2xl flex items-center justify-center text-white shrink-0 shadow-lg shadow-emerald-200">
                        <FileText size={28} />
                      </div>
                      <div className="flex-1">
                        <h4 className="text-emerald-900 font-black text-lg">Plantilla activa</h4>
                        <p className="text-emerald-600 text-xs font-medium truncate max-w-[200px] font-mono">{state.templateFile.name}</p>
                      </div>
                      <button 
                        onClick={clearTemplate} 
                        className="p-3 rounded-xl bg-slate-100 text-slate-500 hover:bg-slate-200 hover:text-slate-700 transition-all flex items-center gap-2 text-xs font-bold"
                      >
                        <RefreshCw size={14}/> REEMPLAZAR
                      </button>
                    </motion.div>
                  )}
                </div>

                <div className="space-y-4 pt-4 border-t border-slate-100">
                  <h2 className="text-xl font-black text-slate-800 flex items-center gap-3">
                    <span className="w-8 h-8 rounded-full bg-slate-900 text-white flex items-center justify-center text-sm font-mono">02</span>
                    Documentos a Procesar
                  </h2>
                  <p className="text-xs text-slate-500 font-medium ml-11">Sube las capturas del permiso de conducir (Frente y Reverso)</p>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6 ml-0 md:ml-11">
                    <FileUploader label="Anverso (Fotos)" accept="image/*" icon="image" selectedFile={state.frontImage} onFileSelect={(f) => setState(p => ({...p, frontImage: f}))} />
                    <FileUploader label="Reverso (Fotos)" accept="image/*" icon="image" selectedFile={state.backImage} onFileSelect={(f) => setState(p => ({...p, backImage: f}))} />
                  </div>
                </div>

                <motion.button 
                  whileHover={{ scale: 1.01 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={handleProcess}
                  disabled={!state.templateFile || !state.frontImage || !state.backImage || state.status === ProcessStatus.PROCESSING}
                  className="w-full bg-indigo-600 text-white py-6 rounded-[1.5rem] font-black text-xl hover:bg-indigo-700 disabled:opacity-30 disabled:bg-slate-300 shadow-2xl shadow-indigo-200 transition-all flex items-center justify-center gap-3"
                >
                  {state.status === ProcessStatus.PROCESSING ? (
                    <Loader2 className="animate-spin" />
                  ) : (
                    <>
                      <Layout size={24} />
                      ANALIZAR Y COMPLETAR
                    </>
                  )}
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
              className="bg-white p-20 rounded-[3rem] text-center space-y-6 max-w-xl mx-auto shadow-2xl border border-slate-100"
            >
              <div className="relative w-32 h-32 mx-auto">
                <div className="absolute inset-0 rounded-full border-4 border-indigo-100" />
                <div className="absolute inset-0 rounded-full border-4 border-indigo-600 border-t-transparent animate-spin" />
                <div className="absolute inset-4 bg-indigo-50 rounded-full flex items-center justify-center text-indigo-600">
                  <Layout size={40} />
                </div>
              </div>
              <div className="space-y-2">
                <h2 className="text-3xl font-black text-slate-900 tracking-tight italic">Extrayendo datos...</h2>
                <p className="text-slate-500 font-medium text-sm">La IA de Gemini está analizando las imágenes y traduciendo la información en tiempo real.</p>
              </div>
              <div className="flex justify-center gap-2">
                <span className="w-2 h-2 bg-indigo-600 rounded-full animate-bounce [animation-delay:-0.3s]" />
                <span className="w-2 h-2 bg-indigo-600 rounded-full animate-bounce [animation-delay:-0.15s]" />
                <span className="w-2 h-2 bg-indigo-600 rounded-full animate-bounce" />
              </div>
            </motion.div>
          )}

          {state.status === ProcessStatus.REVIEW && state.extractedData && (
            <motion.div 
              key="review"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="max-w-4xl mx-auto space-y-8"
            >
              <div className="bg-indigo-600 text-white p-6 rounded-[2rem] shadow-xl flex items-center justify-between mb-2">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 bg-white/20 rounded-xl flex items-center justify-center">
                    <ShieldCheck size={28} />
                  </div>
                  <div>
                    <h3 className="font-black text-lg">Paso 3: Verificación</h3>
                    <p className="text-white/70 text-xs font-medium">Revisa los datos antes de generar el Word final.</p>
                  </div>
                </div>
              </div>

              <DataPreview data={state.extractedData} onChange={(d) => setState(p => ({...p, extractedData: d}))} />
              
              <div className="flex flex-col gap-4">
                <motion.button 
                  whileHover={{ scale: 1.01 }}
                  whileTap={{ scale: 0.99 }}
                  onClick={downloadWord} 
                  className="w-full bg-slate-900 text-white py-8 rounded-[1.5rem] font-black text-2xl hover:bg-black shadow-2xl flex flex-col items-center justify-center gap-1 transition-all"
                >
                  <div className="flex items-center gap-3"><Download size={32} /> GENERAR Y DESCARGAR</div>
                  <span className="text-[10px] opacity-60 uppercase tracking-[0.2em] font-bold">Documento Word Profesional .docx</span>
                </motion.button>
                
                <button 
                  onClick={() => setState(p => ({...p, status: ProcessStatus.IDLE}))}
                  className="text-slate-500 font-bold text-xs uppercase tracking-widest hover:text-indigo-600 transition-colors text-center"
                >
                  ← Volver a subir archivos
                </button>
              </div>
            </motion.div>
          )}

          {state.status === ProcessStatus.COMPLETED && (
            <motion.div 
              key="completed"
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              className="bg-white p-16 rounded-[4rem] text-center space-y-8 max-w-xl mx-auto shadow-[0_32px_64px_-16px_rgba(0,0,0,0.1)] border border-slate-100"
            >
              <div className="w-24 h-24 bg-emerald-500 rounded-[2.5rem] flex items-center justify-center mx-auto text-white shadow-xl shadow-emerald-100">
                <CheckCircle2 size={56} />
              </div>
              <div className="space-y-4">
                <h2 className="text-4xl font-black text-slate-900 tracking-tight">¡Todo Listo!</h2>
                <p className="text-slate-500 font-medium">El documento ha sido generado exitosamente con los datos traducidos y las imágenes optimizadas.</p>
              </div>
              <div className="pt-6">
                <button 
                  onClick={() => setState(p => ({ ...p, status: ProcessStatus.IDLE, frontImage: null, backImage: null, extractedData: null }))} 
                  className="w-full py-6 bg-indigo-600 text-white rounded-[1.5rem] font-black text-xl hover:bg-indigo-700 shadow-xl shadow-indigo-100 transition-all flex items-center justify-center gap-3"
                >
                  <RefreshCw size={24} />
                  NUEVO DOCUMENTO
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      <footer className="py-8 text-center text-slate-400 text-[10px] font-bold uppercase tracking-[0.3em]">
        Propulsado por Inteligencia Artificial & Gemini Pro
      </footer>
    </div>
  );
};

export default App;
