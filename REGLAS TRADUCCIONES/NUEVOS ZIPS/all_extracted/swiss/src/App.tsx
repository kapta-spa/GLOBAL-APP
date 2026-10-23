
import React, { useState, useEffect } from 'react';
import { 
  FileText, Download, Loader2, 
  CheckCircle2, XCircle, AlertTriangle, Clipboard,
  RefreshCw, Camera, Sparkles, LayoutDashboard
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import FileUploader from './components/FileUploader';
import DataPreview from './components/DataPreview';
import { extractDataFromLicense } from './services/geminiService';
import { generateFilledDoc, optimizeImage } from './services/docService';
import { AppState, ProcessStatus } from './types';

// --- Base de Datos (IndexedDB) ---
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
    request.onerror = () => reject(request.error || null);
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
    }).catch(err => console.error("DB Error:", err));
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
              if (prev.status !== ProcessStatus.IDLE) return prev;
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

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 selection:bg-indigo-100 selection:text-indigo-900 font-sans">
      <nav className="border-b border-slate-200 bg-white/80 backdrop-blur-md sticky top-0 z-50">
        <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-indigo-600 rounded-xl flex items-center justify-center text-white shadow-lg shadow-indigo-200">
              <Sparkles size={20} />
            </div>
            <span className="font-black text-xl tracking-tight text-slate-900 uppercase">SUIZA FULL</span>
          </div>
          <div className="flex items-center gap-4">
             <a
               href="/reglas_licencia_suiza.md"
               download="reglas_licencia_suiza.md"
               className="flex items-center gap-2 px-3 py-1.5 bg-indigo-50 text-indigo-700 hover:bg-indigo-100 rounded-xl text-xs font-bold border border-indigo-100 transition-colors"
               title="Descargar Reglas y System Prompt"
             >
               <Download size={14} /> REGLAS EXTRACCIÓN (.MD)
             </a>
             <div className="px-3 py-1 bg-emerald-50 text-emerald-700 rounded-full text-[10px] font-bold border border-emerald-100 uppercase tracking-wider animate-pulse">
               Sistema de IA Activo
             </div>
          </div>
        </div>
      </nav>

      <main className="max-w-4xl mx-auto py-12 px-6">
        <AnimatePresence mode="wait">
          {state.error && (
            <motion.div 
              initial={{ opacity: 0, y: -20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="mb-8 bg-red-50 border border-red-200 rounded-2xl p-4 flex items-start gap-4"
            >
              <AlertTriangle className="text-red-500 shrink-0 mt-0.5" size={20} />
              <div className="flex-1">
                <p className="text-sm font-semibold text-red-900">Error detectado</p>
                <p className="text-xs text-red-700 mt-0.5 whitespace-pre-line">{state.error}</p>
              </div>
              <button 
                onClick={() => setState(prev => ({ ...prev, error: null }))}
                className="text-red-400 hover:text-red-600 transition-colors"
              >
                <XCircle size={20} />
              </button>
            </motion.div>
          )}
        </AnimatePresence>

        <section className="space-y-12">
          {/* STEP 1: TEMPLATE */}
          {(state.status === ProcessStatus.IDLE || state.status === ProcessStatus.ERROR) && (
            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="space-y-6"
            >
              <div className="flex items-center gap-4">
                <div className="w-8 h-8 rounded-full bg-slate-900 text-white flex items-center justify-center font-bold text-xs ring-4 ring-slate-100">
                  01
                </div>
                <h2 className="text-xl font-black text-slate-900 tracking-tight">Configuración de Plantilla</h2>
              </div>
              
              {!state.templateFile ? (
                <div className="bg-white border-2 border-dashed border-slate-200 rounded-[2rem] p-8 shadow-sm hover:border-indigo-400 transition-colors">
                  <FileUploader 
                    label="Archivo Word (.docx)" 
                    accept=".docx" 
                    selectedFile={state.templateFile} 
                    onFileSelect={handleTemplateSelect} 
                  />
                </div>
              ) : (
                <div className="bg-emerald-50 border border-emerald-200 rounded-3xl p-6 flex items-center gap-4 shadow-sm">
                  <div className="w-14 h-14 bg-white rounded-2xl flex items-center justify-center text-emerald-600 shadow-sm border border-emerald-100">
                    <FileText size={28} />
                  </div>
                  <div className="flex-1">
                    <p className="text-[10px] uppercase font-black tracking-widest text-emerald-600">Plantilla Activa</p>
                    <h4 className="font-bold text-emerald-900 text-lg">{state.templateFile.name}</h4>
                  </div>
                  <button 
                    onClick={clearTemplate}
                    className="flex items-center gap-2 px-4 py-2 bg-white border border-emerald-200 rounded-xl text-xs font-bold text-emerald-600 hover:bg-emerald-100 transition-colors"
                  >
                    <RefreshCw size={14} /> CAMBIAR
                  </button>
                </div>
              )}

              {/* STEP 2: PHOTOS */}
              <div className="space-y-6 pt-6 border-t border-slate-200">
                <div className="flex items-center gap-4">
                  <div className="w-8 h-8 rounded-full bg-slate-900 text-white flex items-center justify-center font-bold text-xs ring-4 ring-slate-100">
                    02
                  </div>
                  <h2 className="text-xl font-black text-slate-900 tracking-tight">Captura de Documentos</h2>
                  <p className="ml-auto text-[10px] font-bold text-slate-400 uppercase tracking-widest">Soporta Portapapeles</p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <FileUploader 
                    label="Frente de Licencia" 
                    accept="image/*" 
                    icon="image" 
                    selectedFile={state.frontImage} 
                    onFileSelect={(f) => setState(p => ({ ...p, frontImage: f }))} 
                  />
                  <FileUploader 
                    label="Reverso de Licencia" 
                    accept="image/*" 
                    icon="image" 
                    selectedFile={state.backImage} 
                    onFileSelect={(f) => setState(p => ({ ...p, backImage: f }))} 
                  />
                </div>
              </div>

              <motion.button 
                whileHover={{ scale: 1.01 }}
                whileTap={{ scale: 0.98 }}
                onClick={handleProcess}
                disabled={!state.templateFile || !state.frontImage || !state.backImage || state.status === ProcessStatus.PROCESSING}
                className="w-full bg-slate-900 text-white py-6 rounded-3xl font-black text-xl hover:bg-slate-800 disabled:opacity-20 shadow-xl transition-all flex items-center justify-center gap-3 mt-8"
              >
                {state.status === ProcessStatus.PROCESSING ? (
                  <Loader2 className="animate-spin" size={24} />
                ) : (
                  <>
                    <LayoutDashboard size={24} />
                    PROCESAR CON IA
                  </>
                )}
              </motion.button>
            </motion.div>
          )}

          {/* PROCESSING STATE */}
          {state.status === ProcessStatus.PROCESSING && (
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="bg-white border border-slate-200 p-20 rounded-[3rem] text-center space-y-6 shadow-2xl relative overflow-hidden"
            >
              <div className="absolute inset-x-0 top-0 h-2 bg-slate-100">
                <motion.div 
                  initial={{ x: '-100%' }}
                  animate={{ x: '100%' }}
                  transition={{ repeat: Infinity, duration: 2, ease: "linear" }}
                  className="h-full w-1/3 bg-indigo-600 rounded-full"
                />
              </div>
              <div className="w-24 h-24 bg-indigo-50 rounded-full flex items-center justify-center mx-auto">
                <Sparkles className="text-indigo-600 animate-pulse" size={48} />
              </div>
              <div>
                <h2 className="text-3xl font-black text-slate-900 tracking-tight">Analizando Documento</h2>
                <p className="text-slate-500 mt-2 font-medium">Extrayendo datos y traduciendo automáticamente...</p>
              </div>
            </motion.div>
          )}

          {/* REVIEW STATE */}
          {state.status === ProcessStatus.REVIEW && state.extractedData && (
            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="space-y-8"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="w-8 h-8 rounded-full bg-emerald-600 text-white flex items-center justify-center font-bold text-xs shadow-lg shadow-emerald-100">
                    <CheckCircle2 size={16} />
                  </div>
                  <h2 className="text-xl font-black text-slate-900 tracking-tight">Verificación de Datos</h2>
                </div>
                <button 
                  onClick={() => setState(p => ({ ...p, status: ProcessStatus.IDLE }))}
                  className="text-xs font-bold text-slate-400 hover:text-slate-900 flex items-center gap-2 transition-colors"
                >
                  <RefreshCw size={12} /> RE-INICIAR
                </button>
              </div>

              <DataPreview 
                data={state.extractedData} 
                onChange={(d) => setState(p => ({ ...p, extractedData: d }))} 
              />
              
              <motion.button 
                whileHover={{ scale: 1.02, y: -2 }}
                whileTap={{ scale: 0.98 }}
                onClick={downloadWord} 
                className="w-full bg-emerald-600 text-white p-8 rounded-[2rem] font-black text-2xl hover:bg-emerald-700 shadow-2xl flex flex-col items-center justify-center gap-1 transition-all"
              >
                <div className="flex items-center gap-3">
                  <FileText size={32} />
                  GENERAR Y DESCARGAR
                </div>
                <span className="text-[10px] opacity-70 uppercase tracking-widest font-black">Exportación Word Profesional (.docx)</span>
              </motion.button>
            </motion.div>
          )}

          {/* COMPLETED STATE */}
          {state.status === ProcessStatus.COMPLETED && (
            <motion.div 
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              className="bg-white border border-slate-200 p-16 rounded-[3rem] text-center space-y-8 shadow-2xl"
            >
              <div className="w-24 h-24 bg-emerald-100 rounded-full flex items-center justify-center mx-auto text-emerald-600">
                <CheckCircle2 size={56} />
              </div>
              <div>
                <h2 className="text-4xl font-black text-slate-900 tracking-tight">¡Proceso Exitoso!</h2>
                <p className="text-slate-500 mt-2 font-medium">El archivo Word ha sido generado y descargado.</p>
              </div>
              <div className="flex gap-4">
                 <button 
                  onClick={() => setState(p => ({ ...p, status: ProcessStatus.IDLE, frontImage: null, backImage: null, extractedData: null }))} 
                  className="flex-1 py-5 bg-slate-900 text-white rounded-2xl font-black text-lg hover:bg-slate-800 transition-colors"
                >
                  NUEVA CARGA
                </button>
              </div>
            </motion.div>
          )}
        </section>
      </main>

      <footer className="mt-20 border-t border-slate-200 py-12 bg-white">
        <div className="max-w-6xl mx-auto px-6 flex flex-col md:flex-row items-center justify-between gap-6">
          <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">
            © 2026 DocuFill AI • Powered by Gemini AI
          </p>
          <div className="flex items-center gap-8">
            <div className="flex items-center gap-2 text-slate-400">
              <Camera size={14} />
              <span className="text-[10px] font-bold uppercase tracking-wider">Modo Escaneo Activo</span>
            </div>
            <div className="flex items-center gap-2 text-slate-400">
              <Clipboard size={14} />
              <span className="text-[10px] font-bold uppercase tracking-wider">Buffer Seguro</span>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default App;
