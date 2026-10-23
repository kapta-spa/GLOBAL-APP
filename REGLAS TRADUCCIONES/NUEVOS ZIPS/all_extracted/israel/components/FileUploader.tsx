
import React, { useRef, useState, useEffect } from 'react';
import { FileUp, Image as ImageIcon, CheckCircle, X, FileText } from 'lucide-react';
import { motion } from 'motion/react';

interface FileUploaderProps {
  label: string;
  accept: string;
  onFileSelect: (file: File | null) => void;
  selectedFile: File | null;
  icon?: 'file' | 'image';
  subtitle?: string;
}

const FileUploader: React.FC<FileUploaderProps> = ({ 
  label, 
  accept, 
  onFileSelect, 
  selectedFile,
  icon = 'file',
  subtitle
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  const isImage = accept.includes('image');

  useEffect(() => {
    if (selectedFile && isImage) {
      const url = URL.createObjectURL(selectedFile);
      setPreviewUrl(url);
      return () => URL.revokeObjectURL(url);
    } else {
      setPreviewUrl(null);
    }
  }, [selectedFile, isImage]);

  const handleClick = () => {
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
      fileInputRef.current.click();
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      onFileSelect(e.target.files[0]);
    }
  };

  const clearFile = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
    onFileSelect(null);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      onFileSelect(e.dataTransfer.files[0]);
    }
  };

  return (
    <div className="flex flex-col gap-2 w-full">
      <div 
        className={`relative rounded-3xl p-5 transition-all cursor-pointer group border-2 ${
          isDragging 
            ? 'border-brand-cyan bg-brand-cyan/20 shadow-lg glow-teal scale-[1.02]' 
            : selectedFile 
            ? 'border-emerald-500/40 bg-emerald-950/30 hover:border-emerald-400/60' 
            : 'border-white/15 bg-white/[0.03] hover:border-brand-cyan/50 hover:bg-brand-cyan/[0.04]'
        }`}
        onClick={handleClick}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
      >
        <input 
          ref={fileInputRef}
          type="file" 
          accept={accept} 
          className="hidden" 
          onChange={handleChange}
        />
        
        <div className="flex flex-col items-center justify-center gap-3 text-center">
          {selectedFile ? (
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              className="flex flex-col items-center w-full"
            >
              {previewUrl ? (
                <div className="relative w-full h-28 rounded-2xl overflow-hidden mb-2 border border-emerald-500/30 bg-black/40">
                  <img 
                    src={previewUrl} 
                    alt={label} 
                    className="w-full h-full object-cover" 
                  />
                  <div className="absolute top-2 right-2 bg-emerald-500 text-black text-[11px] font-extrabold px-2 py-0.5 rounded-full flex items-center gap-1 shadow">
                    <CheckCircle size={12} /> Listo
                  </div>
                </div>
              ) : (
                <div className="w-12 h-12 bg-emerald-500/20 rounded-2xl flex items-center justify-center text-emerald-400 mb-2 border border-emerald-500/30">
                  {icon === 'file' ? <FileText size={24} /> : <CheckCircle size={24} />}
                </div>
              )}

              <div className="w-full px-2">
                <p className="text-xs font-bold text-emerald-400 truncate max-w-full" title={selectedFile.name}>
                  {selectedFile.name}
                </p>
                <p className="text-[11px] text-white/50 mt-0.5">
                  {(selectedFile.size / (1024 * 1024)).toFixed(2)} MB
                </p>
              </div>

              <div className="mt-3 flex items-center gap-2">
                <button 
                  type="button"
                  onClick={clearFile}
                  className="px-3 py-1 bg-red-500/10 hover:bg-red-500/20 text-red-400 hover:text-red-300 border border-red-500/20 rounded-full text-xs font-bold flex items-center gap-1 transition-colors"
                >
                  <X size={12} /> Quitar
                </button>
                <span className="text-[11px] text-white/40">o haz clic para cambiar</span>
              </div>
            </motion.div>
          ) : (
            <div className="flex flex-col items-center py-3">
              <div className="w-14 h-14 rounded-2xl bg-brand-teal/20 border border-brand-cyan/30 flex items-center justify-center text-brand-cyan mb-3 group-hover:scale-110 group-hover:border-brand-cyan transition-all shadow-inner">
                {icon === 'file' ? <FileUp size={28} strokeWidth={2} /> : <ImageIcon size={28} strokeWidth={2} />}
              </div>
              
              <p className="text-sm font-bold text-white group-hover:text-brand-cyan transition-colors">
                {label}
              </p>
              <p className="text-xs text-white/60 mt-1">
                {subtitle || (isImage ? 'Haz clic, arrastra o pega (Ctrl+V)' : 'Selecciona o arrastra tu archivo .docx')}
              </p>
              <span className="mt-3 text-[11px] text-brand-cyan/80 bg-brand-cyan/10 px-3 py-1 rounded-full border border-brand-cyan/20 font-semibold">
                {isImage ? 'JPG, PNG, WEBP' : 'DOCX Word'}
              </span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default FileUploader;

