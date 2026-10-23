
import React, { useState, useEffect } from 'react';
import { 
  FileText, Download, Loader2, 
  CheckCircle2, XCircle, AlertTriangle, Clipboard,
  RefreshCw, Sparkles, Wand2, Image as ImageIcon, ChevronRight
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
    try {
      if (typeof indexedDB === 'undefined') {
        return reject(new Error('IndexedDB not supported'));
      }
      const request = indexedDB.open(DB_NAME, 1);
      request.onupgradeneeded = () => {
        request.result.createObjectStore(STORE_NAME);
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error || new Error('IndexedDB request error'));
    } catch (e) {
      reject(e);
    }
  });
};

const saveTemplateToDB = async (file: File) => {
  try {
    const db = await initDB();
    return new Promise((resolve) => {
      const transaction = db.transaction(STORE_NAME, 'readwrite');
      const store = transaction.objectStore(STORE_NAME);
      store.put(file, 'active_template');
      transaction.oncomplete = () => resolve(true);
      transaction.onerror = () => resolve(false);
    });
  } catch (e) {
    console.warn('IndexedDB not available:', e);
    return false;
  }
};

const getTemplateFromDB = async (): Promise<File | null> => {
  try {
    const db = await initDB();
    return new Promise((resolve) => {
      const transaction = db.transaction(STORE_NAME, 'readonly');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.get('active_template');
      request.onsuccess = () => resolve(request.result || null);
      request.onerror = () => resolve(null);
    });
  } catch (e) {
    console.warn('IndexedDB not available:', e);
    return null;
  }
};

const deleteTemplateFromDB = async () => {
  try {
    const db = await initDB();
    const transaction = db.transaction(STORE_NAME, 'readwrite');
    transaction.objectStore(STORE_NAME).delete('active_template');
  } catch (e) {
    console.warn('IndexedDB not available:', e);
  }
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
    }).catch(err => {
      console.warn('IndexedDB init error:', err);
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
      try {
        await saveTemplateToDB(file);
      } catch (e) {
        console.warn('Could not save template to storage:', e);
      }
      setState(p => ({ ...p, templateFile: file, error: null }));
    }
  };

  const clearTemplate = async () => {
    try {
      await deleteTemplateFromDB();
    } catch (e) {
      console.warn('Could not delete template from storage:', e);
    }
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
    <div className="min-h-screen bg-brand-black pb-16 font-sans text-white">
      {/* Top Header */}
      <header className="border-b border-white/10 bg-brand-dark/60 backdrop-blur-xl sticky top-0 z-30">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-brand-teal/20 border border-brand-cyan/40 flex items-center justify-center text-brand-cyan glow-teal">
              <FileText size={22} />
            </div>
            <div>
              <h1 className="text-lg sm:text-xl font-black tracking-tight flex items-center gap-2 text-white">
                DocuFill <span className="text-brand-cyan font-bold">AI</span>
                <span className="text-[10px] font-extrabold bg-brand-cyan/20 text-brand-cyan px-2 py-0.5 rounded-full border border-brand-cyan/30">
                  PRO
                </span>
              </h1>
              <p className="text-[11px] sm:text-xs text-white/60">
                Traducción y Automatización de Licencias: Francia → Reino Unido (UK)
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <span className="hidden sm:inline-flex items-center gap-1.5 text-xs font-semibold text-white/70 bg-white/5 border border-white/10 px-3 py-1.5 rounded-full">
              <Sparkles size={14} className="text-brand-cyan" /> Gemini OCR Engine
            </span>
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 sm:px-6 py-8 space-y-8">
        {/* Alerts */}
        {state.error && (
          <motion.div 
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-red-500/10 text-red-300 p-4 rounded-2xl border border-red-500/30 flex items-start justify-between gap-3 shadow-lg"
          >
            <div className="flex items-start gap-3">
              <AlertTriangle size={20} className="shrink-0 text-red-400 mt-0.5" />
              <div className="text-sm font-medium">{state.error}</div>
            </div>
            <button 
              onClick={() => setState(p => ({...p, error: null}))}
              className="text-red-400 hover:text-white p-1"
            >
              <XCircle size={18} />
            </button>
          </motion.div>
        )}

        {/* Workflow Sections */}
        <AnimatePresence mode="wait">
          {(state.status === ProcessStatus.IDLE || state.status === ProcessStatus.ERROR) && (
            <motion.div 
              key="idle"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="space-y-8"
            >
              {/* Step 1: Plantilla Section */}
              <section className="bg-brand-dark/70 border border-white/10 rounded-3xl p-6 sm:p-8 shadow-xl">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <span className="w-8 h-8 rounded-full bg-brand-cyan text-brand-black flex items-center justify-center text-sm font-black shadow-md">
                      1
                    </span>
                    <div>
                      <h2 className="text-lg font-bold text-white">Plantilla Word (.docx)</h2>
                      <p className="text-xs text-white/50">El documento base con los tags de reemplazo</p>
                    </div>
                  </div>
                  {state.templateFile && (
                    <span className="text-xs font-bold text-emerald-400 bg-emerald-500/10 border border-emerald-500/30 px-3 py-1 rounded-full flex items-center gap-1">
                      <CheckCircle2 size={13} /> Plantilla Lista
                    </span>
                  )}
                </div>

                {!state.templateFile ? (
                  <FileUploader 
                    label="Subir Plantilla Word (.docx)" 
                    subtitle="Selecciona tu plantilla .docx con los tags (se guardará localmente)"
                    accept=".docx" 
                    selectedFile={state.templateFile} 
                    onFileSelect={handleTemplateSelect} 
                  />
                ) : (
                  <div className="bg-white/[0.03] border border-emerald-500/30 rounded-2xl p-5 flex flex-col sm:flex-row items-center justify-between gap-4">
                    <div className="flex items-center gap-4 w-full sm:w-auto">
                      <div className="w-14 h-14 bg-emerald-500/20 rounded-2xl flex items-center justify-center text-emerald-400 shrink-0 border border-emerald-500/30 shadow-[0_0_15px_rgba(16,185,129,0.2)]">
                        <FileText size={28} />
                      </div>
                      <div className="min-w-0 flex-1">
                        <h4 className="text-white font-bold text-base truncate">{state.templateFile.name}</h4>
                        <p className="text-emerald-400 text-xs font-medium mt-0.5 flex items-center gap-1">
                          <CheckCircle2 size={12} /> Guardada y lista para reutilizar
                        </p>
                      </div>
                    </div>
                    
                    <button 
                      onClick={clearTemplate} 
                      className="w-full sm:w-auto px-4 py-2.5 bg-white/5 hover:bg-white/10 border border-white/15 hover:border-brand-cyan/40 text-white hover:text-brand-cyan rounded-xl text-xs font-bold flex items-center justify-center gap-2 transition-colors"
                    >
                      <RefreshCw size={14}/> Cambiar Plantilla
                    </button>
                  </div>
                )}
              </section>

              {/* Step 2: Fotos Section */}
              <section className="bg-brand-dark/70 border border-white/10 rounded-3xl p-6 sm:p-8 shadow-xl">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <span className="w-8 h-8 rounded-full bg-brand-cyan text-brand-black flex items-center justify-center text-sm font-black shadow-md">
                      2
                    </span>
                    <div>
                      <h2 className="text-lg font-bold text-white">Fotos de la Licencia</h2>
                      <p className="text-xs text-white/50">Sube ambas caras (Frente y Reverso) en alta resolución</p>
                    </div>
                  </div>
                  <div className="text-xs font-semibold text-white/50 hidden sm:block">
                    Tip: Puedes presionar <kbd className="bg-white/10 border border-white/20 px-1.5 py-0.5 rounded text-[11px] text-brand-cyan font-mono">Ctrl + V</kbd> para pegar imágenes
                  </div>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                  <FileUploader 
                    label="1. Cara Frontal (Frente)" 
                    subtitle="Foto clara del frente de la licencia"
                    accept="image/*" 
                    icon="image" 
                    selectedFile={state.frontImage} 
                    onFileSelect={(f) => setState(p => ({...p, frontImage: f, error: null}))} 
                  />
                  
                  <FileUploader 
                    label="2. Cara Posterior (Reverso)" 
                    subtitle="Foto clara de la tabla del reverso"
                    accept="image/*" 
                    icon="image" 
                    selectedFile={state.backImage} 
                    onFileSelect={(f) => setState(p => ({...p, backImage: f, error: null}))} 
                  />
                </div>
              </section>

              {/* Step 3: Action Trigger */}
              <div className="pt-2">
                {(!state.templateFile || !state.frontImage || !state.backImage) && (
                  <div className="mb-3 text-center text-xs text-white/50 flex items-center justify-center gap-2">
                    <AlertTriangle size={14} className="text-amber-400" />
                    <span>
                      Para iniciar necesitas:{' '}
                      {!state.templateFile && <strong className="text-amber-300">Plantilla Word (.docx)</strong>}
                      {!state.templateFile && (!state.frontImage || !state.backImage) && ' + '}
                      {!state.frontImage && <strong className="text-amber-300">Foto Frente</strong>}
                      {!state.frontImage && !state.backImage && ' + '}
                      {!state.backImage && <strong className="text-amber-300">Foto Reverso</strong>}
                    </span>
                  </div>
                )}

                <button 
                  type="button"
                  onClick={handleProcess}
                  disabled={!state.templateFile || !state.frontImage || !state.backImage || state.status === ProcessStatus.PROCESSING}
                  className={`w-full py-5 px-8 rounded-2xl font-black text-lg sm:text-xl transition-all shadow-2xl flex items-center justify-center gap-3 ${
                    (!state.templateFile || !state.frontImage || !state.backImage)
                      ? 'bg-white/10 text-white/30 border border-white/5 cursor-not-allowed'
                      : 'bg-brand-cyan text-brand-black hover:bg-[#33ffff] hover:scale-[1.01] active:scale-[0.99] glow-teal cursor-pointer'
                  }`}
                >
                  {state.status === ProcessStatus.PROCESSING ? (
                    <div className="flex items-center gap-3">
                      <Loader2 className="animate-spin" size={24} />
                      <span>Procesando Licencia con IA...</span>
                    </div>
                  ) : (
                    <>
                      <Wand2 size={24} />
                      <span>INICIAR PROCESAMIENTO Y TRADUCCIÓN</span>
                      <ChevronRight size={24} />
                    </>
                  )}
                </button>
              </div>
            </motion.div>
          )}

          {/* Processing Screen */}
          {state.status === ProcessStatus.PROCESSING && (
            <motion.div 
              key="processing"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0 }}
              className="bg-brand-dark/80 border border-white/10 rounded-3xl p-12 text-center space-y-6 shadow-2xl"
            >
              <div className="relative inline-block">
                <div className="absolute inset-0 bg-brand-cyan blur-3xl opacity-30 animate-pulse" />
                <div className="w-24 h-24 rounded-full bg-brand-cyan/10 border-2 border-brand-cyan/40 flex items-center justify-center mx-auto text-brand-cyan relative z-10 glow-teal">
                  <Loader2 className="animate-spin" size={48} strokeWidth={2} />
                </div>
              </div>

              <div>
                <h2 className="text-2xl font-black tracking-tight text-white">Analizando Licencia con Gemini AI</h2>
                <p className="text-white/60 text-sm mt-2 max-w-md mx-auto">
                  Extrayendo datos de frente y reverso, traduciendo campos al inglés y optimizando las fotos para el documento.
                </p>
              </div>

              <div className="max-w-sm mx-auto space-y-2 text-xs text-white/40 pt-4 border-t border-white/10">
                <div className="flex items-center justify-between text-brand-cyan font-semibold">
                  <span>1. OCR & Visión Artificial</span>
                  <span>En curso...</span>
                </div>
                <div className="flex items-center justify-between text-white/60">
                  <span>2. Traducción Oficial FR → UK</span>
                  <span>Pendiente</span>
                </div>
                <div className="flex items-center justify-between text-white/60">
                  <span>3. Inserción de Fotos en Plantilla</span>
                  <span>Pendiente</span>
                </div>
              </div>
            </motion.div>
          )}

          {/* Review & Edit Screen */}
          {state.status === ProcessStatus.REVIEW && state.extractedData && (
            <motion.div 
              key="review"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="space-y-6"
            >
              <DataPreview 
                data={state.extractedData} 
                onChange={(d) => setState(p => ({...p, extractedData: d}))} 
              />
              
              <div className="flex flex-col sm:flex-row gap-4 pt-2">
                <button 
                  type="button"
                  onClick={() => setState(p => ({ ...p, status: ProcessStatus.IDLE }))}
                  className="w-full sm:w-1/3 py-4 px-6 rounded-2xl bg-white/5 hover:bg-white/10 border border-white/10 text-white font-bold text-sm flex items-center justify-center gap-2 transition-colors"
                >
                  <RefreshCw size={16} /> Volver a Subir Fotos
                </button>

                <button 
                  type="button"
                  onClick={downloadWord} 
                  className="w-full sm:w-2/3 py-4 px-6 rounded-2xl bg-emerald-500 hover:bg-emerald-400 text-black font-black text-lg shadow-2xl flex items-center justify-center gap-3 transition-all hover:scale-[1.01] active:scale-[0.99] glow-emerald"
                >
                  <Download size={22} />
                  <span>DESCARGAR DOCUMENTO (.DOCX)</span>
                </button>
              </div>
            </motion.div>
          )}

          {/* Completed Screen */}
          {state.status === ProcessStatus.COMPLETED && (
            <motion.div 
              key="completed"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="bg-brand-dark/80 p-10 sm:p-14 rounded-3xl border border-emerald-500/30 text-center space-y-6 shadow-2xl relative overflow-hidden"
            >
              <div className="w-20 h-20 bg-emerald-500/20 rounded-full flex items-center justify-center mx-auto text-emerald-400 glow-emerald border border-emerald-500/40">
                <CheckCircle2 size={48} strokeWidth={2} />
              </div>

              <div>
                <h2 className="text-2xl sm:text-3xl font-black tracking-tight text-white">¡Documento Generado con Éxito!</h2>
                <p className="text-white/60 text-sm mt-2 max-w-md mx-auto">
                  El archivo Word (.docx) ha sido descargado con los datos traducidos y las fotografías integradas.
                </p>
              </div>

              <div className="flex flex-col sm:flex-row items-center justify-center gap-4 pt-4 max-w-md mx-auto">
                <button 
                  type="button"
                  onClick={downloadWord}
                  className="w-full sm:w-1/2 py-3.5 px-5 bg-white/5 hover:bg-white/10 border border-white/15 text-white rounded-xl text-sm font-bold flex items-center justify-center gap-2 transition-colors"
                >
                  <Download size={16} /> Descargar de nuevo
                </button>

                <button 
                  type="button"
                  onClick={() => setState(p => ({ 
                    ...p, 
                    status: ProcessStatus.IDLE, 
                    frontImage: null, 
                    backImage: null, 
                    extractedData: null 
                  }))} 
                  className="w-full sm:w-1/2 py-3.5 px-5 bg-brand-cyan text-brand-black hover:bg-[#33ffff] rounded-xl text-sm font-black flex items-center justify-center gap-2 transition-colors glow-teal"
                >
                  <RefreshCw size={16} /> Procesar Otra
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </main>
    </div>
  );
};

export default App;

