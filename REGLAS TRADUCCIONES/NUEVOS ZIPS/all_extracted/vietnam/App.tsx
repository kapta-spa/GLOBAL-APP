
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
      // 1. Optimize images first - this speeds up Gemini processing and prepares them for the doc
      const frontB64 = await optimizeImage(state.frontImage);
      const backB64 = await optimizeImage(state.backImage);
      setImagesBase64({ front: frontB64, back: backB64 });

      // 2. Extract data using the optimized (smaller) images
      const data = await extractDataFromLicense(frontB64, backB64, state.referenceFile);
      
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
    <div className="min-h-screen bg-[#f8fafc] py-12 px-4 flex flex-col items-center font-sans text-slate-900">
      <header className="max-w-6xl w-full text-center mb-12">
        <div className="bg-indigo-600 w-16 h-16 rounded-2xl shadow-xl flex items-center justify-center mx-auto mb-4">
          <FileText className="text-white" size={32} />
        </div>
        <h1 className="text-3xl font-black text-slate-900 tracking-tight">DocuFill AI</h1>
        <p className="text-slate-500 mt-2 font-medium">Traducción VIETNAM</p>
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
          <div className="bg-white p-20 rounded-[3rem] text-center space-y-6 max-w-xl mx-auto shadow-xl">
            <Loader2 className="mx-auto animate-spin text-indigo-600" size={60} />
            <div className="space-y-2">
              <h2 className="text-2xl font-black text-slate-800 tracking-tight">IA Analizando...</h2>
              <p className="text-slate-500 text-sm animate-pulse">Esto suele tardar unos 10-20 segundos.</p>
            </div>
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
