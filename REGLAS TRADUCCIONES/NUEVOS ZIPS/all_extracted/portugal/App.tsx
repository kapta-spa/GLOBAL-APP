
import React, { useState, useEffect } from 'react';
import { 
  FileText, Download, Loader2, 
  CheckCircle2, XCircle, AlertTriangle, 
  RefreshCw, Sparkles, ArrowRight,
  ShieldCheck, Zap, Globe
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
      setState(prev => ({ ...prev, error: "Missing required files (Template + Photos)." }));
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
        : (state.extractedData.licenseNumber ? `${state.extractedData.licenseNumber}.docx` : `Exported_Document.docx`);
      a.download = fileName;
      a.click();
      setState(prev => ({ ...prev, status: ProcessStatus.COMPLETED }));
    } catch (err: any) {
      setState(prev => ({ ...prev, error: err.message }));
    }
  };

  const resetProcess = () => {
    setState(p => ({
      ...p,
      frontImage: null,
      backImage: null,
      status: ProcessStatus.IDLE,
      extractedData: null,
      error: null
    }));
    setImagesBase64(null);
  };

  return (
    <div className="min-h-screen py-12 px-6 flex flex-col items-center neo-blur">
      <header className="max-w-5xl w-full flex flex-col items-center mb-16 text-center">
        <motion.div 
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          className="relative mb-6"
        >
          <div className="absolute inset-0 bg-indigo-500 rounded-2xl blur-2xl opacity-20 animate-pulse"></div>
          <div className="relative bg-slate-900 w-16 h-16 rounded-2xl flex items-center justify-center shadow-2xl">
            <Zap className="text-white fill-indigo-400" size={32} />
          </div>
        </motion.div>
        
        <motion.div
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.1 }}
        >
          <h1 className="text-4xl font-black text-slate-900 tracking-tight sm:text-5xl">
            DocuFill <span className="text-indigo-600 italic">AI</span>
          </h1>
          <p className="text-slate-500 mt-4 text-lg font-medium max-w-xl mx-auto leading-relaxed">
            Revolutionizing driver's license translation with professional AI accuracy and lightning-fast processing.
          </p>
        </motion.div>

        <motion.div 
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.4 }}
          className="flex flex-wrap justify-center gap-6 mt-10"
        >
          <div className="flex items-center gap-2 text-xs font-black text-slate-400 uppercase tracking-widest bg-white/50 px-4 py-2 rounded-full border border-slate-100">
            <ShieldCheck size={14} className="text-emerald-500" /> Professional Grade
          </div>
          <div className="flex items-center gap-2 text-xs font-black text-slate-400 uppercase tracking-widest bg-white/50 px-4 py-2 rounded-full border border-slate-100">
            <Globe size={14} className="text-indigo-500" /> Translation Ready
          </div>
          <a 
            href="/reglas_extraccion_licencia.txt" 
            download="reglas_extraccion_licencia.txt"
            className="flex items-center gap-2 text-xs font-black text-indigo-600 uppercase tracking-widest bg-indigo-50/80 hover:bg-indigo-100 px-4 py-2 rounded-full border border-indigo-100 transition-colors shadow-xs"
            title="Download extraction rules as .txt file"
          >
            <Download size={14} className="text-indigo-600" /> Rules Doc (.txt)
          </a>
        </motion.div>
      </header>

      <main className="max-w-4xl w-full">
        <AnimatePresence mode="wait">
          {state.error && (
            <motion.div 
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="overflow-hidden mb-8"
            >
              <div className="bg-red-50 text-red-900 p-6 rounded-[2rem] border border-red-200 flex items-start gap-4 shadow-xl shadow-red-500/5">
                <AlertTriangle size={24} className="shrink-0 text-red-500 mt-1" />
                <div className="flex-1">
                  <h4 className="font-black text-sm uppercase tracking-wider mb-1">Processing Error</h4>
                  <p className="text-xs font-bold opacity-75">{state.error}</p>
                </div>
                <button 
                  onClick={() => setState(p => ({...p, error: null}))}
                  className="hover:bg-red-100 p-2 rounded-full transition-colors"
                >
                  <XCircle size={20} />
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        <AnimatePresence mode="wait">
          {(state.status === ProcessStatus.IDLE || state.status === ProcessStatus.ERROR) && (
            <motion.div 
              key="idle"
              initial={{ opacity: 0, scale: 0.98 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 1.02 }}
              className="flex flex-col gap-12"
            >
              <section className="space-y-10">
                <div className="space-y-6">
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 rounded-2xl bg-indigo-600 text-white flex items-center justify-center font-black shadow-lg shadow-indigo-200">1</div>
                    <h2 className="text-2xl font-black text-slate-900">Document Template</h2>
                  </div>
                  
                  {!state.templateFile ? (
                    <FileUploader label="Output Formatting" accept=".docx" selectedFile={state.templateFile} onFileSelect={handleTemplateSelect} />
                  ) : (
                    <div className="bg-white border border-emerald-100 rounded-[2.5rem] p-8 flex items-center gap-8 shadow-xl shadow-emerald-500/5 group">
                      <div className="w-16 h-16 bg-emerald-100 rounded-3xl flex items-center justify-center text-emerald-600 shrink-0 group-hover:scale-110 transition-transform">
                        <FileText size={32} />
                      </div>
                      <div className="flex-1">
                        <h4 className="text-emerald-900 font-black text-lg">Template Locked</h4>
                        <p className="text-emerald-600 text-xs font-bold tracking-tight opacity-80 uppercase">{state.templateFile.name}</p>
                      </div>
                      <button 
                        onClick={clearTemplate} 
                        className="px-6 py-3 bg-slate-50 border border-slate-100 rounded-2xl text-[10px] font-black text-slate-500 hover:text-indigo-600 hover:bg-white hover:border-indigo-200 transition-all flex items-center gap-2 uppercase tracking-widest shadow-sm"
                      >
                        <RefreshCw size={14}/> Change File
                      </button>
                    </div>
                  )}
                </div>

                <div className="space-y-6 pt-10 border-t border-slate-100">
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 rounded-2xl bg-indigo-600 text-white flex items-center justify-center font-black shadow-lg shadow-indigo-200">2</div>
                    <h2 className="text-2xl font-black text-slate-900">License Source</h2>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                    <FileUploader label="Front Aspect" accept="image/*" icon="image" selectedFile={state.frontImage} onFileSelect={(f) => setState(p => ({...p, frontImage: f}))} />
                    <FileUploader label="Back Aspect" accept="image/*" icon="image" selectedFile={state.backImage} onFileSelect={(f) => setState(p => ({...p, backImage: f}))} />
                  </div>
                </div>

                <motion.button 
                  whileHover={{ scale: 1.02, y: -4 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={handleProcess}
                  disabled={!state.templateFile || !state.frontImage || !state.backImage}
                  className="w-full bg-slate-900 text-white py-8 rounded-[2.5rem] font-black text-xl hover:bg-slate-800 disabled:opacity-30 disabled:pointer-events-none shadow-2xl shadow-indigo-200 flex items-center justify-center gap-4 group transition-all"
                >
                  <Sparkles size={24} className="text-indigo-400 group-hover:rotate-12 transition-transform" />
                  START PROCESSING
                  <ArrowRight size={24} className="opacity-0 group-hover:opacity-100 group-hover:translate-x-2 transition-all" />
                </motion.button>
              </section>
            </motion.div>
          )}

          {state.status === ProcessStatus.PROCESSING && (
            <motion.div 
              key="processing"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="bg-white border border-slate-100 rounded-[3rem] p-16 flex flex-col items-center text-center shadow-2xl"
            >
              <div className="relative mb-10">
                <div className="absolute inset-0 bg-indigo-500 rounded-full blur-3xl opacity-20 animate-pulse"></div>
                <div className="w-24 h-24 bg-indigo-50 rounded-[2rem] flex items-center justify-center relative">
                  <Loader2 className="animate-spin text-indigo-600" size={48} />
                </div>
              </div>
              <h2 className="text-3xl font-black text-slate-900">Analyzing Identity</h2>
              <p className="text-slate-500 mt-3 font-medium text-lg">AI is extracting and translating license details...</p>
              
              <div className="mt-12 w-full max-w-sm bg-slate-100 h-2 rounded-full overflow-hidden">
                <motion.div 
                  initial={{ width: 0 }}
                  animate={{ width: '100%' }}
                  transition={{ duration: 15, ease: "linear" }}
                  className="h-full bg-indigo-600 rounded-full"
                ></motion.div>
              </div>
              <p className="text-[10px] font-black text-slate-300 uppercase tracking-[0.3em] mt-6 italic">Secure Neural Processing</p>
            </motion.div>
          )}

          {(state.status === ProcessStatus.REVIEW || state.status === ProcessStatus.COMPLETED) && state.extractedData && (
            <motion.div 
              key="review"
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              className="flex flex-col gap-10"
            >
              <DataPreview 
                data={state.extractedData} 
                onChange={(d) => setState(p => ({ ...p, extractedData: d }))} 
              />
              
              <div className="flex flex-col sm:flex-row gap-6">
                <motion.button 
                  whileHover={{ scale: 1.02, y: -4 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={downloadWord}
                  className="flex-1 bg-indigo-600 text-white py-7 rounded-[2rem] font-black text-xl hover:bg-indigo-700 shadow-xl shadow-indigo-600/20 flex items-center justify-center gap-4 group transition-all"
                >
                  <Download size={24} className="group-hover:translate-y-1 transition-transform" />
                  GENERATE DOCUMENT
                </motion.button>
                
                <motion.button 
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={resetProcess}
                  className="bg-white border border-slate-200 text-slate-500 px-8 py-7 rounded-[2rem] font-black text-lg hover:bg-slate-50 transition-all flex items-center justify-center gap-3"
                >
                  <RefreshCw size={20} />
                  NEW SCAN
                </motion.button>
              </div>

              {state.status === ProcessStatus.COMPLETED && (
                <motion.div 
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="bg-emerald-50 text-emerald-800 p-8 rounded-[2.5rem] border border-emerald-100 flex items-center gap-6 shadow-xl shadow-emerald-500/5"
                >
                  <div className="w-14 h-14 bg-emerald-500 text-white rounded-2xl flex items-center justify-center shadow-lg shadow-emerald-200">
                    <CheckCircle2 size={32} />
                  </div>
                  <div>
                    <h4 className="font-black text-lg">Document Ready!</h4>
                    <p className="text-sm font-bold opacity-75">Translation and filling completed successfully.</p>
                  </div>
                </motion.div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      <footer className="mt-20 text-center">
        <p className="text-[10px] font-black text-slate-300 uppercase tracking-[0.5em] mb-4">Enterprise Data Automation</p>
        <div className="flex items-center gap-8 justify-center grayscale opacity-30">
          <FileText size={20} />
          <ShieldCheck size={20} />
          <Globe size={20} />
        </div>
      </footer>
    </div>
  );
};

export default App;
