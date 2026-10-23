
import React, { useState, useEffect } from 'react';
import { 
  FileText, Download, Loader2, 
  CheckCircle2, XCircle, AlertTriangle, RefreshCw
} from 'lucide-react';
import FileUploader from './components/FileUploader';
import DataPreview from './components/DataPreview';
import { extractDataFromLicense } from './services/geminiService';
import { generateFilledDoc, optimizeImage } from './services/docService';
import { AppState, ProcessStatus } from './types';

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
    image1: null,
    image2: null,
    image3: null,
    image4: null,
    status: ProcessStatus.IDLE,
    extractedData: null,
    error: null,
  });
  const [imagesBase64, setImagesBase64] = useState<string[]>([]);

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
              if (!prev.image1) return { ...prev, image1: file, error: null };
              if (!prev.image2) return { ...prev, image2: file, error: null };
              if (!prev.image3) return { ...prev, image3: file, error: null };
              if (!prev.image4) return { ...prev, image4: file, error: null };
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

  const handleProcess = async () => {
    const { templateFile, image1, image2, image3, image4 } = state;
    if (!templateFile || !image1 || !image2 || !image3 || !image4) {
      setState(prev => ({ ...prev, error: "Faltan archivos (Plantilla + 4 Fotos)." }));
      return;
    }
    
    setState(prev => ({ ...prev, status: ProcessStatus.PROCESSING, error: null }));
    
    try {
      const images = [image1, image2, image3, image4];
      const data = await extractDataFromLicense(images, state.referenceFile);
      
      const b64s = await Promise.all(images.map(img => optimizeImage(img)));
      setImagesBase64(b64s);
      
      setState(prev => ({ ...prev, status: ProcessStatus.REVIEW, extractedData: { ...data, assignedNumber: "" } }));
    } catch (err: any) {
      setState(prev => ({ ...prev, status: ProcessStatus.ERROR, error: err.message }));
    }
  };

  const downloadWord = async () => {
    if (!state.templateFile || !state.extractedData || imagesBase64.length < 4) return;
    try {
      const blob = await generateFilledDoc(state.templateFile, state.extractedData, imagesBase64);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      const fileName = state.extractedData.assignedNumber 
        ? `${state.extractedData.assignedNumber}.docx` 
        : (state.extractedData.licenseNumber ? `${state.extractedData.licenseNumber}.docx` : `China_License_Filled.docx`);
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
        <h1 className="text-3xl font-black text-slate-900 tracking-tight">DocuFill AI - China Edition</h1>
        <p className="text-slate-500 mt-2 font-medium">Automatización de Traducción CHINA → UK (4 Fotos)</p>
        <div className="mt-4">
          <a
            href="/reglas_extraccion_china.txt"
            download="reglas_extraccion_china.txt"
            className="inline-flex items-center gap-2 px-4 py-2 bg-slate-200 hover:bg-slate-300 text-slate-800 text-xs font-bold rounded-xl transition-colors shadow-sm"
          >
            <Download size={14} /> Descargar Reglas y Prompts (.txt)
          </a>
        </div>
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
                  Plantilla Word
                </h2>
                {!state.templateFile ? (
                  <div className="bg-white border-2 border-dashed border-slate-200 rounded-[2rem] p-10">
                    <FileUploader label="Sube tu .docx" accept=".docx" selectedFile={state.templateFile} onFileSelect={(f) => {
                      if(f) { saveTemplateToDB(f); setState(p => ({...p, templateFile: f})); }
                    }} />
                  </div>
                ) : (
                  <div className="bg-white border border-emerald-200 rounded-[2rem] p-8 flex items-center gap-6 shadow-sm">
                    <div className="w-14 h-14 bg-emerald-100 rounded-2xl flex items-center justify-center text-emerald-600 shrink-0"><FileText size={28} /></div>
                    <div className="flex-1"><h4 className="text-emerald-900 font-black">Plantilla activa</h4><p className="text-emerald-600 text-xs truncate max-w-[200px]">{state.templateFile.name}</p></div>
                    <button onClick={() => { deleteTemplateFromDB(); setState(p => ({...p, templateFile: null})) }} className="text-xs font-bold text-slate-400 hover:text-slate-600 flex items-center gap-2"><RefreshCw size={12}/> CAMBIAR</button>
                  </div>
                )}
              </div>

              <div className="space-y-4 pt-4 border-t border-slate-100">
                <h2 className="text-xl font-black text-slate-800 flex items-center gap-3">
                  <span className="w-8 h-8 rounded-full bg-indigo-600 text-white flex items-center justify-center text-sm">2</span>
                  Fotos de la Licencia (4 Imágenes)
                </h2>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                  <FileUploader label="Foto 1" accept="image/*" icon="image" selectedFile={state.image1} onFileSelect={(f) => setState(p => ({...p, image1: f}))} />
                  <FileUploader label="Foto 2" accept="image/*" icon="image" selectedFile={state.image2} onFileSelect={(f) => setState(p => ({...p, image2: f}))} />
                  <FileUploader label="Foto 3" accept="image/*" icon="image" selectedFile={state.image3} onFileSelect={(f) => setState(p => ({...p, image3: f}))} />
                  <FileUploader label="Foto 4" accept="image/*" icon="image" selectedFile={state.image4} onFileSelect={(f) => setState(p => ({...p, image4: f}))} />
                </div>
              </div>

              <button 
                onClick={handleProcess}
                disabled={!state.templateFile || !state.image1 || !state.image2 || !state.image3 || !state.image4 || state.status === ProcessStatus.PROCESSING}
                className="w-full bg-slate-900 text-white py-6 rounded-[1.5rem] font-black text-xl hover:bg-slate-800 disabled:opacity-30 shadow-2xl transition-all"
              >
                {state.status === ProcessStatus.PROCESSING ? <Loader2 className="mx-auto animate-spin" /> : "PROCESAR LICENCIA CHINA"}
              </button>
            </section>
          </div>
        )}

        {state.status === ProcessStatus.PROCESSING && (
          <div className="bg-white p-20 rounded-[3rem] text-center space-y-4 max-w-xl mx-auto shadow-xl">
            <Loader2 className="mx-auto animate-spin text-indigo-600" size={60} />
            <h2 className="text-2xl font-black text-slate-800 tracking-tight">IA Analizando Licencia China...</h2>
            <p className="text-slate-400 text-sm">Traduciendo caracteres a inglés y procesando 4 imágenes.</p>
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
              <span className="text-[12px] opacity-70 uppercase tracking-widest font-bold">Generar traducción china oficial</span>
            </button>
          </div>
        )}

        {state.status === ProcessStatus.COMPLETED && (
          <div className="bg-white p-16 rounded-[3rem] text-center space-y-8 max-w-xl mx-auto shadow-2xl">
            <div className="w-20 h-20 bg-emerald-100 rounded-full flex items-center justify-center mx-auto text-emerald-600">
              <CheckCircle2 size={48} />
            </div>
            <h2 className="text-3xl font-black text-slate-900 tracking-tight">¡Traducción Generada!</h2>
            <button onClick={() => setState(p => ({ ...p, status: ProcessStatus.IDLE, image1: null, image2: null, image3: null, image4: null, extractedData: null }))} className="w-full py-5 bg-indigo-600 text-white rounded-2xl font-black text-lg">PROCESAR OTRA LICENCIA</button>
          </div>
        )}
      </main>
    </div>
  );
};

export default App;
