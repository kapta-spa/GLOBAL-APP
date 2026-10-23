
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
    <div className="flex flex-col gap-2">
      <span className="text-sm font-medium text-slate-700">{label}</span>
      <div 
        className={`relative border-2 border-dashed rounded-xl p-6 transition-all cursor-pointer group
          ${selectedFile 
            ? 'border-emerald-200 bg-emerald-50' 
            : 'border-slate-200 bg-white hover:border-indigo-400 hover:bg-indigo-50/30'}`}
        onClick={() => document.getElementById(`input-${label}`)?.click()}
      >
        <input 
          id={`input-${label}`}
          type="file" 
          accept={accept} 
          className="hidden" 
          onChange={handleChange}
        />
        
        <div className="flex flex-col items-center justify-center gap-3 text-center">
          {selectedFile ? (
            <>
              <CheckCircle className="w-10 h-10 text-emerald-500" />
              <div className="flex flex-col items-center">
                <p className="text-sm font-semibold text-emerald-700 truncate max-w-[200px]">
                  {selectedFile.name}
                </p>
                <button 
                  onClick={clearFile}
                  className="mt-2 text-xs text-red-500 hover:text-red-700 flex items-center gap-1"
                >
                  <X size={12} /> Quitar
                </button>
              </div>
            </>
          ) : (
            <>
              <div className="p-3 bg-indigo-100 text-indigo-600 rounded-full group-hover:bg-indigo-200 transition-colors">
                {icon === 'file' ? <FileUp size={24} /> : <ImageIcon size={24} />}
              </div>
              <div>
                <p className="text-[13px] font-bold text-slate-600">
                  {isImage ? 'Sube, arrastra o pega (Ctrl+V)' : 'Click para subir o arrastra'}
                </p>
                <p className="text-[10px] text-slate-400 mt-1">
                  {isImage ? 'JPG, PNG hasta 10MB' : 'Documento Word (.docx)'}
                </p>
              </div>
              {isImage && (
                <div className="flex items-center gap-1 text-[9px] text-indigo-400 font-bold uppercase tracking-tighter">
                  <ClipboardPaste size={10} /> Soporte de portapapeles activo
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
