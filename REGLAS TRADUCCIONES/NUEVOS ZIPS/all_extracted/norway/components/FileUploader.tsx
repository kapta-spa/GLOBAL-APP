
import React from 'react';
import { FileUp, Image as ImageIcon, CheckCircle, X, ClipboardPaste } from 'lucide-react';

interface FileUploaderProps {
  label: string;
  accept: string;
  onFileSelect: (file: File | null) => void;
  selectedFile: File | null;
  icon?: 'file' | 'image';
}

const FileUploader: React.FC<FileUploaderProps> = ({ 
  label, 
  accept, 
  onFileSelect, 
  selectedFile,
  icon = 'file'
}) => {
  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      onFileSelect(e.target.files[0]);
    }
  };

  const clearFile = (e: React.MouseEvent) => {
    e.stopPropagation();
    onFileSelect(null);
  };

  const isImage = accept.includes('image');

  return (
    <div className="flex flex-col gap-5">
      <div className="flex items-center gap-3 px-3">
        <div className="w-1.5 h-4 bg-indigo-600 rounded-full"></div>
        <span className="text-xs font-black text-slate-700 uppercase tracking-[0.2em]">
          {label === 'FRENTE (FRONT)' ? 'Lado Anverso' : label === 'REVERSO (BACK)' ? 'Lado Reverso' : label}
        </span>
      </div>
      
      <div 
        className={`relative border-2 border-dashed rounded-[2rem] p-12 transition-all cursor-pointer group 
          ${selectedFile 
            ? 'border-emerald-300 bg-emerald-50/20' 
            : 'border-slate-300 bg-white hover:border-indigo-500 hover:bg-slate-50 hover:shadow-lg hover:shadow-indigo-500/5'}`}
        onClick={() => document.getElementById(`input-${label}`)?.click()}
      >
        <input 
          id={`input-${label}`}
          type="file" 
          accept={accept} 
          className="hidden" 
          onChange={handleChange}
        />
        
        <div className="flex flex-col items-center justify-center gap-6 text-center">
          {selectedFile ? (
            <div className="animate-in fade-in zoom-in duration-300">
              <div className="w-24 h-24 bg-white rounded-[1.5rem] flex items-center justify-center mx-auto mb-6 text-emerald-600 shadow-md border border-emerald-100">
                <CheckCircle className="w-12 h-12" />
              </div>
              <p className="text-sm font-black text-slate-900 truncate max-w-[240px] mb-4">
                {selectedFile.name}
              </p>
              <button 
                onClick={clearFile}
                className="px-8 py-3 bg-red-50 text-[10px] font-black text-red-600 hover:bg-red-600 hover:text-white rounded-xl transition-all uppercase tracking-widest border border-red-100"
              >
                Remover Archivo
              </button>
            </div>
          ) : (
            <>
              <div className="w-24 h-24 bg-indigo-50 text-indigo-600 rounded-[1.5rem] flex items-center justify-center group-hover:scale-110 transition-transform duration-300 border border-indigo-100">
                {icon === 'file' ? <FileUp size={40} /> : <ImageIcon size={40} />}
              </div>
              <div className="space-y-2">
                <p className="text-xl font-extrabold text-slate-900 tracking-tight">
                  {isImage ? 'Subir Imagen' : 'Subir Plantilla de Word'}
                </p>
                <p className="text-sm text-slate-500 font-medium">
                  {isImage ? 'Haz clic o arrastra la foto de la licencia' : 'Selecciona el archivo .docx para procesar'}
                </p>
              </div>
              {isImage && (
                <div className="flex items-center gap-3 text-[10px] text-indigo-700 font-black uppercase tracking-wider px-5 py-2 bg-indigo-50 rounded-full border border-indigo-100">
                  <ClipboardPaste size={16} /> Pegar desde portapapeles activo
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default FileUploader;
