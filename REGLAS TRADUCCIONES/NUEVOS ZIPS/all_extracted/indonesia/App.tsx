
import React, { useState, useEffect } from 'react';
import { 
  FileText, Download, Loader2, 
  CheckCircle2, XCircle, AlertTriangle, 
  RefreshCw, Camera, Settings, History,
  Sparkles, ArrowRight
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import FileUploader from './components/FileUploader';
import DataPreview from './components/DataPreview';
import { extractDataFromLicense } from './services/geminiService';
import { generateFilledDoc, optimizeImage } from './services/docService';
import { AppState, ProcessStatus } from './types';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

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

const Stepper: React.FC<{ currentStep: number }> = ({ currentStep }) => {
  const steps = [
    { id: 1, label: 'Plantilla' },
    { id: 2, label: 'Documentos' },
    { id: 3, label: 'Resumen' },
  ];

  return (
    <div className="flex items-center justify-center space-x-4 mb-12">
      {steps.map((step, idx) => (
        <React.Fragment key={step.id}>
          <div className="flex items-center gap-2">
            <div className={cn(
              "w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold transition-all duration-500",
              currentStep >= step.id 
                ? "bg-indigo-600 text-white shadow-[0_0_15px_rgba(79,70,229,0.4)]" 
                : "bg-slate-200 text-slate-500"
            )}>
              {currentStep > step.id ? <CheckCircle2 size={16} /> : step.id}
            </div>
            <span className={cn(
              "text-xs font-semibold uppercase tracking-wider",
              currentStep >= step.id ? "text-slate-900" : "text-slate-400"
            )}>
              {step.label}
            </span>
          </div>
          {idx < steps.length - 1 && (
            <div className={cn(
              "w-12 h-0.5 rounded-full transition-all duration-700",
              currentStep > step.id ? "bg-indigo-600" : "bg-slate-200"
            )} />
          )}
        </React.Fragment>
      ))}
    </div>
  );
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

  const currentStep = state.status === ProcessStatus.IDLE || state.status === ProcessStatus.ERROR ? 1 :
                    state.status === ProcessStatus.PROCESSING ? 2 :
                    state.status === ProcessStatus.REVIEW ? 3 :
                    state.status === ProcessStatus.COMPLETED ? 3 : 1;

  return (
    <div className="min-h-screen bg-slate-50 py-12 px-4 selection:bg-indigo-100 selection:text-indigo-900">
      <header className="max-w-4xl mx-auto flex items-center justify-between mb-16 px-4">
        <div className="flex items-center gap-4">
          <div className="bg-indigo-600 w-12 h-12 rounded-[1.25rem] shadow-[0_10px_30px_rgba(79,70,229,0.3)] flex items-center justify-center text-white">
            <FileText size={24} />
          </div>
          <div>
            <h1 className="text-2xl font-black text-slate-900 tracking-tight leading-none italic">INDONESIA</h1>
            <p className="text-slate-500 text-[11px] font-bold uppercase tracking-wider mt-1 opacity-70">Smarter Document Processing</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
           <a 
             href="/reglas_extraccion_licencias.txt" 
             download="reglas_extraccion_licencias.txt"
             className="flex items-center gap-2 px-3 py-2 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 rounded-xl text-xs font-bold transition-colors border border-indigo-100"
             title="Descargar documentación de reglas en TXT"
           >
             <Download size={14} />
             <span className="hidden sm:inline">Reglas (.txt)</span>
           </a>
           <button className="p-3 text-slate-400 hover:text-slate-600 transition-colors"><History size={20}/></button>
           <button className="p-3 text-slate-400 hover:text-slate-600 transition-colors"><Settings size={20}/></button>
        </div>
      </header>

      <main className="max-w-4xl mx-auto pb-24">
        <Stepper currentStep={currentStep} />

        <AnimatePresence mode="wait">
          {state.error && (
            <motion.div 
              initial={{ opacity: 0, y: -20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="bg-red-50 text-red-700 p-5 rounded-2xl border border-red-200 flex items-start gap-4 shadow-sm mb-12"
            >
              <AlertTriangle size={24} className="shrink-0 text-red-500" />
              <div className="flex-1 text-xs font-medium">{state.error}</div>
              <button onClick={() => setState(p => ({...p, error: null}))}><XCircle size={20} /></button>
            </motion.div>
          )}

          {(state.status === ProcessStatus.IDLE || state.status === ProcessStatus.ERROR) && (
            <motion.div 
              key="setup"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="space-y-12"
            >
              {/* Step 1: Template */}
              <section className="space-y-4">
                 <div className="flex items-center justify-between">
                    <h2 className="text-sm font-black text-slate-400 uppercase tracking-[0.2em]">01. Plantilla Maestra</h2>
                    {state.templateFile && (
                      <button onClick={clearTemplate} className="text-[10px] font-black text-slate-400 hover:text-red-500 flex items-center gap-1.5 transition-colors uppercase">
                        <RefreshCw size={10}/> Reemplazar documento
                      </button>
                    )}
                 </div>
                 
                 {!state.templateFile ? (
                   <div className="group relative">
                      <div className="absolute -inset-1 bg-gradient-to-r from-indigo-500 to-purple-600 rounded-[2.5rem] blur opacity-25 group-hover:opacity-40 transition duration-1000 group-hover:duration-200"></div>
                      <div className="relative bg-white border border-slate-100 rounded-[2rem] p-8 shadow-sm">
                        <FileUploader label="Documento Base (.docx)" accept=".docx" selectedFile={state.templateFile} onFileSelect={handleTemplateSelect} />
                      </div>
                   </div>
                 ) : (
                   <div className="bg-white border border-emerald-100 rounded-[2rem] p-8 flex items-center gap-6 shadow-sm ring-1 ring-emerald-50">
                     <div className="w-16 h-16 bg-emerald-50 rounded-2xl flex items-center justify-center text-emerald-600 shrink-0 shadow-inner"><FileText size={32} /></div>
                     <div className="flex-1">
                        <div className="text-[10px] font-black text-emerald-600 uppercase tracking-widest mb-1 italic">Ready to process</div>
                        <h4 className="text-emerald-900 font-black text-lg">{state.templateFile.name}</h4>
                        <p className="text-emerald-700/60 text-xs mt-1">Este documento se usará como base para el rellenado.</p>
                     </div>
                     <CheckCircle2 className="text-emerald-500" size={32} />
                   </div>
                 )}
              </section>

              {/* Step 2: Images */}
              <section className="space-y-4">
                <h2 className="text-sm font-black text-slate-400 uppercase tracking-[0.2em]">02. Documentos de Origen</h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                  <div className="bg-white border border-slate-100 rounded-[2rem] p-8 shadow-sm">
                    <FileUploader label="Frente de Licencia" accept="image/*" icon="image" selectedFile={state.frontImage} onFileSelect={(f) => setState(p => ({...p, frontImage: f}))} />
                  </div>
                  <div className="bg-white border border-slate-100 rounded-[2rem] p-8 shadow-sm">
                    <FileUploader label="Reverso de Licencia" accept="image/*" icon="image" selectedFile={state.backImage} onFileSelect={(f) => setState(p => ({...p, backImage: f}))} />
                  </div>
                </div>
              </section>

              <div className="pt-8">
                <button 
                  onClick={handleProcess}
                  disabled={!state.templateFile || !state.frontImage || !state.backImage || state.status === ProcessStatus.PROCESSING}
                  className="w-full relative group"
                >
                  <div className="absolute -inset-1 bg-gradient-to-r from-indigo-600 to-indigo-800 rounded-[2rem] blur-xl opacity-40 group-hover:opacity-75 transition duration-1000 group-hover:duration-200 group-disabled:hidden"></div>
                  <div className="relative bg-slate-900 text-white py-8 rounded-[2rem] font-black text-xl hover:bg-slate-800 transition-all flex items-center justify-center gap-4 disabled:opacity-20">
                    <Sparkles size={24} className="text-indigo-400" />
                    COMENZAR EXTRACCIÓN IA
                    <ArrowRight size={24} className="group-hover:translate-x-1 transition-transform" />
                  </div>
                </button>
              </div>
            </motion.div>
          )}

          {state.status === ProcessStatus.PROCESSING && (
            <motion.div 
              key="processing"
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 1.1 }}
              className="flex flex-col items-center justify-center py-20"
            >
              <div className="relative mb-12">
                <div className="absolute inset-0 bg-indigo-500 blur-3xl opacity-20 animate-pulse"></div>
                <div className="relative w-32 h-32 bg-white rounded-full shadow-2xl flex items-center justify-center border border-indigo-100">
                  <Loader2 className="animate-spin text-indigo-600" size={48} />
                </div>
              </div>
              <h2 className="text-3xl font-black text-slate-900 tracking-tight mb-2 italic">Analizando con Gemini Pro</h2>
              <p className="text-slate-500 font-medium">Extrayendo datos y optimizando imágenes para el documento final...</p>
              
              <div className="mt-12 flex gap-4">
                 {[1,2,3].map(i => (
                   <motion.div 
                    key={i}
                    animate={{ scale: [1, 1.2, 1], opacity: [0.3, 1, 0.3] }}
                    transition={{ repeat: Infinity, duration: 1.5, delay: i * 0.2 }}
                    className="w-2 h-2 bg-indigo-600 rounded-full"
                   />
                 ))}
              </div>
            </motion.div>
          )}

          {state.status === ProcessStatus.REVIEW && state.extractedData && (
            <motion.div 
              key="review"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              className="space-y-12"
            >
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-black text-slate-400 uppercase tracking-[0.2em]">03. Verificación de Datos</h2>
                <div className="bg-amber-50 text-amber-700 px-4 py-2 rounded-full text-[10px] font-black uppercase flex items-center gap-2 border border-amber-100 ring-4 ring-amber-50/50">
                  <span className="w-2 h-2 bg-amber-500 rounded-full animate-ping"></span>
                  Revisión manual requerida
                </div>
              </div>
              
              <DataPreview data={state.extractedData} onChange={(d) => setState(p => ({...p, extractedData: d}))} />
              
              <motion.button 
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={downloadWord} 
                className="w-full relative group"
              >
                <div className="absolute -inset-1 bg-gradient-to-r from-emerald-500 to-emerald-700 rounded-[2rem] blur-xl opacity-30 group-hover:opacity-60 transition duration-1000"></div>
                <div className="relative bg-emerald-600 text-white py-10 rounded-[2rem] font-black hover:bg-emerald-700 transition-all shadow-2xl flex flex-col items-center justify-center gap-2">
                   <div className="flex items-center gap-4 text-3xl italic">
                      <Download size={36} /> FINALIZAR Y DESCARGAR
                   </div>
                   <span className="text-[12px] opacity-70 uppercase tracking-[0.3em] font-black">Generar archivo .DOCX traducido</span>
                </div>
              </motion.button>
            </motion.div>
          )}

          {state.status === ProcessStatus.COMPLETED && (
            <motion.div 
              key="completed"
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              className="bg-white p-20 rounded-[4rem] text-center space-y-8 max-w-2xl mx-auto shadow-2xl border border-slate-50 relative overflow-hidden"
            >
              <div className="absolute top-0 left-0 w-full h-2 bg-gradient-to-r from-indigo-500 via-emerald-500 to-indigo-500"></div>
              
              <div className="w-24 h-24 bg-emerald-100 rounded-[2rem] flex items-center justify-center mx-auto text-emerald-600 rotate-12 shadow-sm ring-8 ring-emerald-50">
                <CheckCircle2 size={56} />
              </div>
              
              <div>
                <h2 className="text-4xl font-black text-slate-900 tracking-tight leading-tight italic">¡Operación Completada!</h2>
                <p className="text-slate-500 mt-4 font-medium max-w-sm mx-auto">El documento ha sido generado con éxito. Su descarga debería haber comenzado automáticamente.</p>
              </div>

              <div className="flex flex-col gap-3 pt-6">
                <button onClick={() => setState(p => ({ ...p, status: ProcessStatus.IDLE, frontImage: null, backImage: null, extractedData: null }))} className="w-full py-6 bg-slate-900 text-white rounded-[1.5rem] font-black text-lg hover:bg-slate-800 transition-all shadow-xl">NUEVO PROCESAMIENTO</button>
                <button className="text-xs font-bold text-slate-400 hover:text-slate-600 transition-colors uppercase tracking-widest py-2">Ver historial de documentos</button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </main>
      
      <footer className="fixed bottom-8 left-0 w-full flex justify-center pointer-events-none">
         <div className="bg-white/70 backdrop-blur-xl px-8 py-3 rounded-full border border-white/50 shadow-2xl pointer-events-auto flex items-center gap-6">
            <div className="flex items-center gap-2 text-[10px] font-black text-slate-400 uppercase tracking-widest border-r border-slate-200 pr-6">
               <Camera size={14} className="text-indigo-500" /> Powered by Gemini
            </div>
            <div className="text-[10px] font-bold text-indigo-600 flex items-center gap-2">
               <div className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse"></div>
               SYSTEM ONLINE
            </div>
         </div>
      </footer>
    </div>
  );
};

export default App;
