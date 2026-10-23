
import React, { useState, useEffect } from 'react';
import { FileUp, Image as ImageIcon, CheckCircle, X, ClipboardPaste, Eye, RefreshCw, Trash2, Maximize2, FileText } from 'lucide-react';

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
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isZoomOpen, setIsZoomOpen] = useState(false);

  const isImage = accept.includes('image') || (selectedFile?.type.startsWith('image/') ?? false);

  useEffect(() => {
    if (selectedFile && isImage) {
      const url = URL.createObjectURL(selectedFile);
      setPreviewUrl(url);
      return () => {
        URL.revokeObjectURL(url);
      };
    } else {
      setPreviewUrl(null);
    }
  }, [selectedFile, isImage]);

  // Close zoom modal on Esc
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setIsZoomOpen(false);
    };
    if (isZoomOpen) {
      window.addEventListener('keydown', handleKeyDown);
    }
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isZoomOpen]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      onFileSelect(e.target.files[0]);
    }
  };

  const clearFile = (e: React.MouseEvent) => {
    e.stopPropagation();
    onFileSelect(null);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      onFileSelect(e.dataTransfer.files[0]);
    }
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <span className="text-sm font-bold text-slate-700 flex items-center gap-2">
          {label}
          {selectedFile && isImage && (
            <span className="text-[10px] font-semibold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-100">
              Cargada ({formatFileSize(selectedFile.size)})
            </span>
          )}
        </span>
      </div>

      <input 
        id={`input-${label}`}
        type="file" 
        accept={accept} 
        className="hidden" 
        onChange={handleChange}
      />

      {/* When an image file is selected: Display rich image preview */}
      {selectedFile && isImage && previewUrl ? (
        <div 
          className="relative bg-slate-900 border border-slate-200 rounded-2xl overflow-hidden shadow-sm group transition-all"
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
        >
          {/* Main image container */}
          <div 
            className="relative h-56 w-full bg-slate-950 flex items-center justify-center overflow-hidden cursor-pointer"
            onClick={() => setIsZoomOpen(true)}
            title="Click para ampliar imagen"
          >
            <img 
              src={previewUrl} 
              alt={`Preview ${label}`} 
              className="w-full h-full object-contain transition-transform duration-300 group-hover:scale-105"
            />
            
            {/* Dark overlay on hover with quick hint */}
            <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2 text-white font-bold text-xs">
              <Eye size={18} />
              <span>Click para ampliar</span>
            </div>

            {/* Top badges */}
            <div className="absolute top-2 left-2 flex items-center gap-1.5 bg-black/60 backdrop-blur-sm text-white px-2.5 py-1 rounded-lg text-[11px] font-semibold">
              <CheckCircle size={12} className="text-emerald-400" />
              <span>{label}</span>
            </div>

            <button
              onClick={(e) => {
                e.stopPropagation();
                setIsZoomOpen(true);
              }}
              className="absolute top-2 right-2 p-1.5 bg-black/60 hover:bg-black/80 backdrop-blur-sm text-white rounded-lg transition-colors"
              title="Ver en tamaño completo"
            >
              <Maximize2 size={14} />
            </button>
          </div>

          {/* Bottom control bar */}
          <div className="bg-slate-900/95 px-3.5 py-2.5 flex items-center justify-between border-t border-white/10 text-white">
            <p className="text-xs text-slate-300 truncate max-w-[170px] font-medium" title={selectedFile.name}>
              {selectedFile.name}
            </p>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  document.getElementById(`input-${label}`)?.click();
                }}
                className="text-[11px] text-indigo-300 hover:text-indigo-100 flex items-center gap-1 font-semibold px-2 py-1 rounded-md hover:bg-white/10 transition-colors"
              >
                <RefreshCw size={12} /> Cambiar
              </button>
              <button
                type="button"
                onClick={clearFile}
                className="text-[11px] text-red-400 hover:text-red-300 flex items-center gap-1 font-semibold px-2 py-1 rounded-md hover:bg-red-500/10 transition-colors"
              >
                <Trash2 size={12} /> Quitar
              </button>
            </div>
          </div>
        </div>
      ) : selectedFile ? (
        /* Document preview (non-image) */
        <div 
          className="border-2 border-emerald-200 bg-emerald-50 rounded-xl p-5 transition-all"
        >
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-emerald-100 text-emerald-600 flex items-center justify-center shrink-0">
              <FileText size={24} />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-bold text-emerald-900 truncate">
                {selectedFile.name}
              </p>
              <p className="text-xs text-emerald-600 mt-0.5">
                {formatFileSize(selectedFile.size)} • Listo
              </p>
            </div>
            <div className="flex items-center gap-2">
              <button 
                type="button"
                onClick={() => document.getElementById(`input-${label}`)?.click()}
                className="text-xs font-semibold text-slate-500 hover:text-slate-800 p-1.5 rounded-lg hover:bg-emerald-100/60 transition-colors"
                title="Cambiar archivo"
              >
                <RefreshCw size={14} />
              </button>
              <button 
                type="button"
                onClick={clearFile}
                className="text-xs font-semibold text-red-500 hover:text-red-700 p-1.5 rounded-lg hover:bg-red-100/60 transition-colors"
                title="Quitar archivo"
              >
                <X size={16} />
              </button>
            </div>
          </div>
        </div>
      ) : (
        /* Empty dropzone state */
        <div 
          className={`relative border-2 border-dashed rounded-xl p-6 transition-all cursor-pointer group
            ${isDragging 
              ? 'border-indigo-500 bg-indigo-50/50 scale-[0.99]' 
              : 'border-slate-200 bg-white hover:border-indigo-400 hover:bg-indigo-50/30'}`}
          onClick={() => document.getElementById(`input-${label}`)?.click()}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
        >
          <div className="flex flex-col items-center justify-center gap-3 text-center">
            <div className="p-3 bg-indigo-100 text-indigo-600 rounded-full group-hover:bg-indigo-200 transition-colors">
              {icon === 'file' ? <FileUp size={24} /> : <ImageIcon size={24} />}
            </div>
            <div>
              <p className="text-[13px] font-bold text-slate-700">
                {isImage ? 'Sube, arrastra o pega (Ctrl+V)' : 'Click para subir o arrastra'}
              </p>
              <p className="text-[11px] text-slate-400 mt-1">
                {isImage ? 'JPG, PNG hasta 10MB' : 'Documento Word (.docx)'}
              </p>
            </div>
            {isImage && (
              <div className="flex items-center gap-1 text-[9px] text-indigo-500 font-bold uppercase tracking-tight bg-indigo-50 px-2.5 py-1 rounded-full border border-indigo-100/60">
                <ClipboardPaste size={11} /> Soporte de portapapeles activo
              </div>
            )}
          </div>
        </div>
      )}

      {/* Zoom / Lightbox Modal for inspecting license details */}
      {isZoomOpen && previewUrl && (
        <div 
          className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4"
          onClick={() => setIsZoomOpen(false)}
        >
          <div 
            className="relative max-w-4xl max-h-[90vh] bg-slate-950 rounded-2xl overflow-hidden border border-white/10 shadow-2xl flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal header */}
            <div className="px-5 py-3 bg-slate-900 border-b border-white/10 flex items-center justify-between text-white">
              <div className="flex items-center gap-2">
                <span className="font-bold text-sm">{label}: {selectedFile?.name}</span>
                {selectedFile && (
                  <span className="text-[11px] text-slate-400">({formatFileSize(selectedFile.size)})</span>
                )}
              </div>
              <button 
                onClick={() => setIsZoomOpen(false)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-white/10 transition-colors"
                title="Cerrar (Esc)"
              >
                <X size={18} />
              </button>
            </div>

            {/* Modal image */}
            <div className="p-4 flex items-center justify-center overflow-auto max-h-[calc(90vh-60px)]">
              <img 
                src={previewUrl} 
                alt={`${label} ampliado`} 
                className="max-w-full max-h-[78vh] object-contain rounded-lg"
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default FileUploader;
