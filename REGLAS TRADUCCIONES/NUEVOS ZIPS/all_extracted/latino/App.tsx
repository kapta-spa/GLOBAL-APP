
import React, { useState, useEffect, useCallback } from 'react';
import { 
  FileText, Download, Loader2, 
  CheckCircle2, XCircle, AlertTriangle, Clipboard,
  RefreshCw, Info, Image as ImageIcon, Copy, Zap, ArrowRight, Shield, Globe
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
  try {
    const db = await initDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(STORE_NAME, 'readonly');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.get('active_template');
      request.onsuccess = () => resolve(request.result || null);
      request.onerror = () => reject(request.error);
    });
  } catch (e) {
    return null;
  }
};

const deleteTemplateFromDB = async () => {
  const db = await initDB();
  const transaction = db.transaction(STORE_NAME, 'readwrite');
  transaction.objectStore(STORE_NAME).delete('active_template');
};

const TagBadge: React.FC<{ tag: string }> = ({ tag }) => {
  const [copied, setCopied] = useState(false);
  const handleCopy = () => {
    navigator.clipboard.writeText(tag);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };
  return (
    <button 
      onClick={handleCopy}
      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[10px] font-mono font-bold transition-all border ${
        copied ? 'bg-emerald-50 border-emerald-200 text-emerald-600' : 'bg-slate-50 border-slate-200 text-slate-500 hover:border-slate-300'
      }`}
    >
      {copied ? <CheckCircle2 size={10} /> : <Clipboard size={10} />}
      {tag}
    </button>
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
    getTemplateFromDB()
      .then(file => {
        if (file) setState(prev => ({ ...prev, templateFile: file }));
      })
      .catch(() => {});
  }, []);

  const handlePaste = useCallback((event: ClipboardEvent) => {
    const items = event.clipboardData?.items;
    if (!items) return;
    for (let i = 0; i < items.length; i++) {
      if (items[i].type.indexOf('image') !== -1) {
        const blob = items[i].getAsFile();
        if (blob) {
          const file = new File([blob], `pasted-${Date.now()}.png`, { type: blob.type });
          setState(prev => {
            if (!prev.frontImage) return { ...prev, frontImage: file, error: null };
            else if (!prev.backImage) return { ...prev, backImage: file, error: null };
            return prev;
          });
        }
        break;
      }
    }
  }, []);

  useEffect(() => {
    window.addEventListener('paste', handlePaste);
    return () => window.removeEventListener('paste', handlePaste);
  }, [handlePaste]);

  const handleTemplateSelect = async (file: File | null) => {
    if (file) {
      try {
        await saveTemplateToDB(file);
      } catch (e) {
        console.warn("Could not save template to IndexedDB:", e);
      }
      setState(p => ({ ...p, templateFile: file, error: null }));
    } else {
      await clearTemplate();
    }
  };

  const clearTemplate = async () => {
    try {
      await deleteTemplateFromDB();
    } catch (e) {
      console.warn("Could not delete template from IndexedDB:", e);
    }
    setState(p => ({ ...p, templateFile: null }));
  };

  const handleProcess = async () => {
    if (!state.templateFile || !state.frontImage || !state.backImage) {
      setState(prev => ({ ...prev, error: "Faltan archivos requeridos (Plantilla + Fotos)." }));
      return;
    }
    setState(prev => ({ ...prev, status: ProcessStatus.PROCESSING, error: null }));
    try {
      const [data, frontB64, backB64] = await Promise.all([
        extractDataFromLicense(state.frontImage, state.backImage, state.referenceFile),
        optimizeImage(state.frontImage),
        optimizeImage(state.backImage)
      ]);
      setImagesBase64({ front: frontB64, back: backB64 });
      setState(prev => ({ ...prev, status: ProcessStatus.REVIEW, extractedData: { ...data, assignedNumber: "" } }));
    } catch (err: any) {
      console.error("Processing Error:", err);
      setState(prev => ({ ...prev, status: ProcessStatus.ERROR, error: err.message || "Error inesperado durante el procesamiento." }));
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
    <div className="min-h-screen bg-slate-50 font-sans selection:bg-indigo-100 selection:text-indigo-900 overflow-x-hidden">
      {/* Decorative Grid */}
      <div className="fixed inset-0 pointer-events-none opacity-[0.03]" style={{ backgroundImage: 'radial-gradient(#1e293b 1px, transparent 1px)', backgroundSize: '24px 24px' }} />

      <header className="relative border-b border-slate-200 bg-white/80 backdrop-blur-md z-10">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="bg-slate-900 p-2 rounded-xl shadow-lg">
              <Zap className="text-white w-5 h-5" fill="currentColor" />
            </div>
            <h1 className="text-xl font-black text-slate-900 tracking-tighter uppercase">LATINO</h1>
          </div>
          <div className="flex items-center gap-4 text-slate-500">
            <a 
              href="/reglas_extraccion_licencias.txt" 
              download="reglas_extraccion_licencias.txt"
              className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 rounded-full text-[10px] font-bold border border-indigo-200 uppercase tracking-widest transition-all"
            >
              <Download size={12} /> Reglas Extraídas (.txt)
            </a>
            <div className="hidden md:flex items-center gap-2 px-3 py-1.5 bg-slate-100 rounded-full text-[10px] font-bold border border-slate-200 uppercase tracking-widest">
               IA <span className="text-emerald-500">Gemini 3.8 Flash</span> Activa
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-6 py-12 relative z-10">
        <AnimatePresence mode="wait">
          {state.error && (
            <motion.div 
              initial={{ opacity: 0, y: -20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="mb-8 bg-red-50 text-red-700 p-5 rounded-3xl border border-red-200 flex items-start gap-4 shadow-xl shadow-red-500/5 group"
            >
              <div className="bg-red-500 p-2 rounded-xl">
                <AlertTriangle size={20} className="text-white" />
              </div>
              <div className="flex-1 pt-1">
                <h4 className="font-black text-sm uppercase tracking-wider">Aviso de Procesamiento</h4>
                <p className="text-xs font-medium opacity-90 mt-1">{state.error}</p>
              </div>
              <button 
                onClick={() => setState(p => ({...p, error: null}))}
                className="p-2 hover:bg-red-100 rounded-lg transition-colors"
              >
                <XCircle size={20} />
              </button>
            </motion.div>
          )}
        </AnimatePresence>

        {state.status === ProcessStatus.IDLE || state.status === ProcessStatus.ERROR ? (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
            <div className="lg:col-span-12">
               <div className="mb-10 text-center lg:text-left">
                  <h2 className="text-4xl font-black text-slate-900 tracking-tight leading-none mb-4">
                    Extracción y <span className="text-indigo-600 italic">Traducción</span> Automática
                  </h2>
                  <p className="text-slate-500 font-medium max-w-2xl">
                    Rellena tus plantillas de Word profesionales al instante. Extrae datos de cualquier licencia de conducir y tradúcelos automáticamente al inglés.
                  </p>
               </div>
            </div>

            <div className="lg:col-span-7 space-y-8">
              <section className="bg-white p-8 rounded-[2.5rem] border border-slate-200 shadow-2xl relative overflow-hidden">
                <div className="absolute top-0 right-0 p-8 opacity-5">
                   <FileText size={120} className="text-slate-900" />
                </div>
                
                <div className="flex items-center justify-between mb-6">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-indigo-600 text-white rounded-2xl flex items-center justify-center font-black">1</div>
                    <h3 className="text-xl font-black text-slate-900">Plantilla Word (.docx)</h3>
                  </div>
                  {state.templateFile && (
                    <span className="text-[11px] font-bold text-emerald-700 bg-emerald-100/80 px-3 py-1 rounded-full border border-emerald-200">
                      ✓ Plantilla lista
                    </span>
                  )}
                </div>

                <FileUploader 
                  label={state.templateFile ? "Plantilla seleccionada (puedes cambiarla o arrastrar una nueva):" : "Selecciona o arrastra tu plantilla Word (.docx):"} 
                  accept=".docx,application/vnd.openxmlformats-officedocument.wordprocessingml.document" 
                  selectedFile={state.templateFile} 
                  onFileSelect={handleTemplateSelect} 
                  icon="file"
                />
              </section>

              <section className="bg-white p-8 rounded-[2.5rem] border border-slate-200 shadow-2xl">
                <div className="flex items-center gap-3 mb-8">
                  <div className="w-10 h-10 bg-indigo-600 text-white rounded-2xl flex items-center justify-center font-black">2</div>
                  <h3 className="text-xl font-black text-slate-900">Fotos de la Licencia</h3>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                  <FileUploader label="Frente" accept="image/*" icon="image" selectedFile={state.frontImage} onFileSelect={(f) => setState(p => ({...p, frontImage: f}))} />
                  <FileUploader label="Reverso" accept="image/*" icon="image" selectedFile={state.backImage} onFileSelect={(f) => setState(p => ({...p, backImage: f}))} />
                </div>
              </section>

              <button 
                onClick={handleProcess}
                disabled={!state.templateFile || !state.frontImage || !state.backImage || state.status === ProcessStatus.PROCESSING}
                className="group relative w-full bg-slate-900 text-white p-8 rounded-[2rem] font-black text-2xl hover:bg-slate-800 disabled:opacity-40 shadow-2xl shadow-indigo-500/20 transition-all overflow-hidden"
              >
                <div className="absolute inset-0 bg-gradient-to-r from-indigo-600 to-indigo-400 opacity-0 group-hover:opacity-10 transition-opacity" />
                <div className="flex items-center justify-center gap-4">
                  {state.status === ProcessStatus.PROCESSING ? (
                    <Loader2 className="animate-spin" size={32} />
                  ) : (
                    <>INICIAR EXTRACCIÓN <ArrowRight className="group-hover:translate-x-2 transition-transform" /></>
                  )}
                </div>
              </button>
            </div>

            <div className="lg:col-span-5">
               <div className="sticky top-24 space-y-6">
                  <div className="bg-slate-900 p-8 rounded-[3rem] text-white shadow-2xl shadow-slate-900/40 border border-slate-800">
                    <div className="flex items-center justify-between mb-6">
                      <h3 className="text-lg font-black tracking-wider uppercase flex items-center gap-2">
                        <Info size={18} className="text-indigo-400" /> Guía de Etiquetas
                      </h3>
                      <Globe size={24} className="text-slate-700" />
                    </div>
                    <p className="text-slate-400 text-xs font-medium leading-relaxed mb-6">
                      Usa estas etiquetas en tu documento Word para mapear los datos extraídos. Serán reemplazadas automáticamente.
                    </p>
                    
                    <div className="space-y-6">
                      <div>
                        <span className="text-[10px] font-black uppercase text-indigo-400 block mb-3">Identidad y Personales (Reglas Latino)</span>
                        <div className="flex flex-wrap gap-2">
                          <TagBadge tag="{{surname}}" />
                          <TagBadge tag="{{firstName}}" />
                          <TagBadge tag="{{middleName}}" />
                          <TagBadge tag="{{fullName}}" />
                          <TagBadge tag="{{gender}}" />
                          <TagBadge tag="{{nationality}}" />
                          <TagBadge tag="{{address}}" />
                          <TagBadge tag="{{curp}}" />
                          <TagBadge tag="{{blood}}" />
                          <TagBadge tag="{{organs}}" />
                        </div>
                      </div>

                      <div className="pt-6 border-t border-slate-800">
                        <span className="text-[10px] font-black uppercase text-indigo-400 block mb-3">Licencia y Traducción Técnica</span>
                        <div className="flex flex-wrap gap-2">
                          <TagBadge tag="{{licenseNumber}}" />
                          <TagBadge tag="{{class}}" />
                          <TagBadge tag="{{explicacion}}" />
                          <TagBadge tag="{{dateOfBirth}}" />
                          <TagBadge tag="{{issueDate}}" />
                          <TagBadge tag="{{expiryDate}}" />
                          <TagBadge tag="{{authority}}" />
                          <TagBadge tag="{{codes}}" />
                          <TagBadge tag="{{barcode}}" />
                          <TagBadge tag="{{today}}" />
                        </div>
                      </div>

                      <div className="pt-6 border-t border-slate-800">
                        <span className="text-[10px] font-black uppercase text-indigo-400 block mb-3">Anclajes Visuales (Fotos)</span>
                        <p className="text-[10px] text-slate-500 mb-2 italic">Tamaño en Word: ~312x195px</p>
                        <div className="flex flex-wrap gap-2">
                          <TagBadge tag="{%license_front}" />
                          <TagBadge tag="{%license_back}" />
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="bg-indigo-600/5 border border-indigo-100 p-6 rounded-[2rem] flex items-center gap-4">
                    <div className="bg-white p-3 rounded-2xl shadow-md"><ImageIcon size={20} className="text-indigo-600" /></div>
                    <div>
                      <h5 className="text-indigo-900 font-bold text-sm leading-tight">Soporte de Flujo Rápido</h5>
                      <p className="text-indigo-600/70 text-[10px] font-medium leading-normal mt-0.5">Copia una imagen al portapapeles y pégala directamente (Ctrl+V) para subirla.</p>
                    </div>
                  </div>
               </div>
            </div>
          </div>
        ) : state.status === ProcessStatus.PROCESSING ? (
          <motion.div 
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="flex flex-col items-center justify-center p-20 bg-white rounded-[4rem] text-center space-y-8 shadow-2xl border border-slate-100"
          >
            <div className="relative">
               <motion.div 
                 animate={{ rotate: 360 }}
                 transition={{ duration: 4, repeat: Infinity, ease: "linear" }}
                 className="w-32 h-32 border-4 border-indigo-500 border-t-transparent rounded-full shadow-[0_0_40px_rgba(99,102,241,0.2)]"
               />
               <Zap className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-indigo-500 w-10 h-10" fill="currentColor" />
            </div>
            <div className="space-y-2">
              <h2 className="text-3xl font-black text-slate-900 tracking-tight">Procesando Documentos</h2>
              <p className="text-slate-500 font-medium">Extrayendo y traduciendo datos con Reglas Latino aplicadas...</p>
            </div>
          </motion.div>
        ) : state.status === ProcessStatus.REVIEW && state.extractedData ? (
          <motion.div 
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            className="space-y-8"
          >
            <div className="bg-slate-900 p-8 rounded-[3rem] text-white flex flex-col md:flex-row items-center gap-6 shadow-2xl">
              <div className="bg-emerald-500 p-4 rounded-3xl shrink-0"><CheckCircle2 className="text-white w-8 h-8" /></div>
              <div className="flex-1 text-center md:text-left">
                <h3 className="text-2xl font-black tracking-tight">Extraction Successful</h3>
                <p className="text-slate-400 text-sm font-medium">Review the data below. You can edit any field before the final generation.</p>
              </div>
              <button 
                onClick={() => setState(p => ({...p, status: ProcessStatus.IDLE, extractedData: null}))}
                className="px-6 py-3 bg-slate-800 rounded-2xl text-xs font-bold hover:bg-slate-700 transition-colors uppercase tracking-widest border border-slate-700"
              >
                Reset
              </button>
            </div>

            <DataPreview data={state.extractedData} onChange={(d) => setState(p => ({...p, extractedData: d}))} />
            
            <button 
              onClick={downloadWord} 
              className="group relative w-full bg-emerald-600 text-white py-10 rounded-[2.5rem] font-black text-3xl hover:bg-emerald-700 shadow-2xl shadow-emerald-500/30 transition-all overflow-hidden flex flex-col items-center gap-2"
            >
              <div className="absolute inset-0 bg-gradient-to-b from-white/10 to-transparent pointer-events-none" />
              <div className="flex items-center gap-4">
                <Download size={40} className="group-hover:translate-y-1 transition-transform" /> 
                FINALIZE & DOWNLOAD (.docx)
              </div>
              <span className="text-[12px] opacity-70 uppercase tracking-[0.2em] font-bold">Encapsulating data into your template</span>
            </button>
          </motion.div>
        ) : (
          <motion.div 
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-white p-20 rounded-[4rem] text-center space-y-10 shadow-2xl border border-emerald-100 max-w-2xl mx-auto"
          >
            <div className="w-24 h-24 bg-emerald-100 rounded-[2rem] flex items-center justify-center mx-auto text-emerald-600 shadow-lg">
              <CheckCircle2 size={56} />
            </div>
            <div className="space-y-4">
               <h2 className="text-4xl font-black text-slate-900 tracking-tight">Success!</h2>
               <p className="text-slate-500 text-lg font-medium">Your document has been generated and should be downloading now.</p>
            </div>
            <button 
              onClick={() => setState(p => ({ ...p, status: ProcessStatus.IDLE, frontImage: null, backImage: null, extractedData: null }))} 
              className="w-full py-6 bg-slate-900 text-white rounded-[2rem] font-black text-xl hover:bg-indigo-600 transition-colors shadow-2xl shadow-indigo-500/20"
            >
              PROCESS ANOTHER DOCUMENT
            </button>
          </motion.div>
        )}
      </main>

      <footer className="max-w-7xl mx-auto px-6 py-12 border-t border-slate-200 mt-12 flex flex-col md:flex-row items-center justify-between gap-6 opacity-40 grayscale hover:opacity-100 hover:grayscale-0 transition-all">
        <div className="flex items-center gap-2 text-xs font-black tracking-widest text-slate-500 uppercase">
          <Zap size={14} fill="currentColor" /> Powered by Gemini AI
        </div>
        <div className="flex gap-8 text-[11px] font-bold text-slate-500 uppercase tracking-widest">
          <span className="hover:text-indigo-600 cursor-help">Secure Extraction</span>
          <span className="hover:text-indigo-600 cursor-help">High Precision</span>
          <span className="hover:text-indigo-600 cursor-help">Instant Translation</span>
        </div>
      </footer>
    </div>
  );
};

export default App;
