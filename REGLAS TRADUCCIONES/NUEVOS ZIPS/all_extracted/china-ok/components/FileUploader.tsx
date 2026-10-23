
import React, { useState, useEffect, useRef, useId } from 'react';
import { FileUp, Image as ImageIcon, CheckCircle, X, ClipboardPaste, RefreshCw, Eye } from 'lucide-react';

interface FileUploaderProps {
  label: string;
  accept: string;
  onFileSelect: (file: File | null) => void;
  selectedFile: File | null;
  icon?: 'file' | 'image';
}

const formatFileSize = (bytes: number): string => {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};

const FileUploader: React.FC<FileUploaderProps> = ({ 
  label, 
  accept, 
  onFileSelect, 
  selectedFile,
  icon = 'file'
}) => {
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const uniqueId = useId();
  const inputId = `input-${uniqueId}`;

  const isImage = accept.includes('image') || (selectedFile?.type.startsWith('image/') ?? false);

  useEffect(() => {
    if (!selectedFile) {
      setPreviewUrl(null);
      return;
    }

    if (selectedFile.type.startsWith('image/') || isImage) {
      const objectUrl = URL.createObjectURL(selectedFile);
      setPreviewUrl(objectUrl);
      return () => {
        URL.revokeObjectURL(objectUrl);
      };
    } else {
      setPreviewUrl(null);
    }
  }, [selectedFile, isImage]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      onFileSelect(e.target.files[0]);
    }
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

  const clearFile = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (inputRef.current) {
      inputRef.current.value = '';
    }
    onFileSelect(null);
  };

  const triggerFileInput = () => {
    inputRef.current?.click();
  };

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <span className="text-sm font-semibold text-slate-700">{label}</span>
        {selectedFile && isImage && (
          <span className="text-[10px] font-bold text-emerald-600 uppercase tracking-wider bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200">
            Cargada
          </span>
        )}
      </div>

      <div 
        className={`relative border-2 border-dashed rounded-2xl transition-all cursor-pointer group select-none
          ${isDragging 
            ? 'border-indigo-500 bg-indigo-50/70 ring-4 ring-indigo-100' 
            : selectedFile 
              ? isImage 
                ? 'border-emerald-300 bg-emerald-50/20 hover:border-emerald-400' 
                : 'border-emerald-200 bg-emerald-50' 
              : 'border-slate-200 bg-white hover:border-indigo-400 hover:bg-indigo-50/30'}
          ${selectedFile && isImage ? 'p-3' : 'p-6'}`}
        onClick={triggerFileInput}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
      >
        <input 
          id={inputId}
          ref={inputRef}
          type="file" 
          accept={accept} 
          className="hidden" 
          onChange={handleChange}
        />

        {selectedFile && isImage && previewUrl ? (
          <div className="flex flex-col gap-2.5 w-full">
            {/* Image Preview Box */}
            <div className="relative w-full h-36 rounded-xl overflow-hidden bg-slate-900/5 border border-slate-200/80 flex items-center justify-center group/preview shadow-xs">
              <img 
                src={previewUrl} 
                alt={selectedFile.name} 
                className="w-full h-full object-contain transition-transform duration-200 group-hover/preview:scale-[1.02]"
              />

              {/* Hover overlay indicating click to replace */}
              <div className="absolute inset-0 bg-slate-950/40 opacity-0 group-hover/preview:opacity-100 transition-opacity flex flex-col items-center justify-center gap-1 text-white">
                <RefreshCw size={18} className="animate-spin-slow" />
                <span className="text-[11px] font-bold tracking-wide drop-shadow-sm">
                  Click para cambiar
                </span>
              </div>

              {/* Remove button */}
              <button
                type="button"
                onClick={clearFile}
                className="absolute top-2 right-2 p-1.5 bg-red-500 hover:bg-red-600 text-white rounded-full shadow-md transition-transform active:scale-90 z-10"
                title="Quitar imagen"
              >
                <X size={14} />
              </button>
            </div>

            {/* File info bar */}
            <div className="flex items-center justify-between px-1 text-xs">
              <div className="flex flex-col min-w-0 pr-2">
                <p className="font-semibold text-slate-800 truncate" title={selectedFile.name}>
                  {selectedFile.name}
                </p>
                <span className="text-[10px] text-slate-400">
                  {formatFileSize(selectedFile.size)}
                </span>
              </div>
              <button 
                type="button"
                onClick={clearFile}
                className="text-[11px] font-bold text-red-500 hover:text-red-700 shrink-0 px-2 py-1 rounded hover:bg-red-50 transition-colors"
              >
                Quitar
              </button>
            </div>
          </div>
        ) : selectedFile ? (
          /* Non-image file selected */
          <div className="flex flex-col items-center justify-center gap-3 text-center">
            <CheckCircle className="w-10 h-10 text-emerald-500" />
            <div className="flex flex-col items-center">
              <p className="text-sm font-semibold text-emerald-700 truncate max-w-[200px]">
                {selectedFile.name}
              </p>
              <span className="text-[10px] text-slate-400 mt-0.5">
                {formatFileSize(selectedFile.size)}
              </span>
              <button 
                type="button"
                onClick={clearFile}
                className="mt-2 text-xs text-red-500 hover:text-red-700 flex items-center gap-1 font-semibold"
              >
                <X size={12} /> Quitar
              </button>
            </div>
          </div>
        ) : (
          /* Empty state */
          <div className="flex flex-col items-center justify-center gap-3 text-center">
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
              <div className="flex items-center gap-1 text-[9px] text-indigo-500 font-bold uppercase tracking-tighter">
                <ClipboardPaste size={10} /> Soporte de portapapeles activo
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default FileUploader;
