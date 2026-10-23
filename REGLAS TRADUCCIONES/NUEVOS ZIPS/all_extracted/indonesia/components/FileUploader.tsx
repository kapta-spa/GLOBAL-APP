
import React from 'react';
import { FileUp, Image as ImageIcon, CheckCircle, X, ClipboardPaste } from 'lucide-react';
import { motion } from 'motion/react';

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
    <div className="flex flex-col gap-3">
      <span className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 ml-1">{label}</span>
      <motion.div 
        whileHover={{ scale: 1.01 }}
        whileTap={{ scale: 0.99 }}
        className={`relative border-2 border-dashed rounded-[1.5rem] p-8 transition-all cursor-pointer group overflow-hidden
          ${selectedFile 
            ? 'border-emerald-200 bg-emerald-50/50' 
            : 'border-slate-100 bg-slate-50/50 hover:border-indigo-200 hover:bg-white hover:shadow-xl hover:shadow-indigo-500/5'}`}
        onClick={() => document.getElementById(`input-${label}`)?.click()}
      >
        <input 
          id={`input-${label}`}
          type="file" 
          accept={accept} 
          className="hidden" 
          onChange={handleChange}
        />
        
        <div className="flex flex-col items-center justify-center gap-4 text-center">
          {selectedFile ? (
            <motion.div 
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              className="flex flex-col items-center"
            >
              <div className="w-14 h-14 bg-emerald-500 text-white rounded-2xl flex items-center justify-center mb-4 shadow-lg shadow-emerald-500/20">
                <CheckCircle size={28} />
              </div>
              <p className="text-sm font-black text-emerald-900 truncate max-w-[200px]">
                {selectedFile.name}
              </p>
              <button 
                onClick={clearFile}
                className="mt-3 text-[10px] font-black text-red-500 hover:text-red-700 flex items-center gap-1.5 uppercase tracking-wider bg-red-50 px-3 py-1.5 rounded-full border border-red-100 transition-colors"
              >
                <X size={12} /> Quitar archivo
              </button>
            </motion.div>
          ) : (
            <>
              <div className="p-4 bg-white text-indigo-600 rounded-2xl shadow-sm border border-slate-100 group-hover:bg-indigo-600 group-hover:text-white transition-all duration-300">
                {icon === 'file' ? <FileUp size={24} /> : <ImageIcon size={24} />}
              </div>
              <div>
                <p className="text-sm font-black text-slate-800">
                  {isImage ? 'Subir o Pagar (Ctrl+V)' : 'Seleccionar Documento'}
                </p>
                <p className="text-[10px] text-slate-400 mt-1 font-medium italic">
                  {isImage ? 'Formatos JPG, PNG • Max 10MB' : 'Requiere Formato Word (.docx)'}
                </p>
              </div>
              {isImage && (
                <div className="flex items-center gap-1.5 text-[9px] text-indigo-400 font-black uppercase tracking-widest bg-indigo-50/50 px-3 py-1 rounded-full border border-indigo-100/50">
                  <ClipboardPaste size={10} /> Smart-Paste ready
                </div>
              )}
            </>
          )}
        </div>
      </motion.div>
    </div>
  );
};

export default FileUploader;

