import React, { useRef, useState, useEffect } from 'react';
import { 
  FileUp, 
  Image as ImageIcon, 
  CheckCircle, 
  X, 
  ClipboardPaste, 
  RefreshCw, 
  Eye, 
  Maximize2,
  FileText
} from 'lucide-react';

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
  const inputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [showFullModal, setShowFullModal] = useState(false);

  const isImageFile = Boolean(
    selectedFile && (
      selectedFile.type.startsWith('image/') || 
      /\.(jpe?g|png|webp|bmp|gif|heic|tiff?)$/i.test(selectedFile.name)
    )
  );

  useEffect(() => {
    if (!selectedFile || !isImageFile) {
      setPreviewUrl(null);
      return;
    }

    const objectUrl = URL.createObjectURL(selectedFile);
    setPreviewUrl(objectUrl);

    return () => {
      URL.revokeObjectURL(objectUrl);
    };
  }, [selectedFile, isImageFile]);

  const handleClick = () => {
    if (inputRef.current) {
      inputRef.current.value = '';
      inputRef.current.click();
    }
  };

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

    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const droppedFile = e.dataTransfer.files[0];
      onFileSelect(droppedFile);
    }
  };

  const clearFile = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (inputRef.current) {
      inputRef.current.value = '';
    }
    onFileSelect(null);
  };

  const isImage = accept.includes('image');

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <span className="text-sm font-bold text-slate-800 flex items-center gap-1.5">
          {label}
        </span>
        {selectedFile && isImageFile && (
          <span className="text-[11px] font-medium text-slate-400">
            {formatFileSize(selectedFile.size)}
          </span>
        )}
      </div>

      <div 
        className={`relative border-2 border-dashed rounded-2xl transition-all select-none overflow-hidden
          ${isDragging
            ? 'border-indigo-500 bg-indigo-50/90 scale-[1.01] shadow-lg shadow-indigo-500/10'
            : selectedFile 
              ? 'border-emerald-300 bg-emerald-50/50 hover:border-emerald-400' 
              : 'border-slate-200 bg-white hover:border-indigo-400 hover:bg-indigo-50/30'}`}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
      >
        <input 
          ref={inputRef}
          type="file" 
          accept={accept} 
          className="hidden" 
          onChange={handleChange}
        />

        {selectedFile ? (
          isImageFile && previewUrl ? (
            /* Image Preview Card */
            <div className="relative group/preview flex flex-col">
              <div 
                className="relative w-full h-52 sm:h-56 bg-slate-900/5 flex items-center justify-center overflow-hidden cursor-pointer"
                onClick={handleClick}
                title="Haz clic para cambiar la imagen"
              >
                <img 
                  src={previewUrl} 
                  alt={selectedFile.name} 
                  className="w-full h-full object-contain p-2 transition-transform duration-300 group-hover/preview:scale-[1.02]"
                />

                {/* Status Badge */}
                <div className="absolute top-3 left-3 flex items-center gap-1.5 bg-white/95 backdrop-blur-sm px-3 py-1 rounded-full shadow-md border border-emerald-200 text-emerald-700 text-xs font-bold pointer-events-none">
                  <CheckCircle size={14} className="text-emerald-500" />
                  <span>Imagen cargada</span>
                </div>

                {/* Expand / View full image button */}
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setShowFullModal(true);
                  }}
                  className="absolute top-3 right-3 p-2 bg-slate-900/80 hover:bg-slate-900 text-white rounded-xl backdrop-blur-sm shadow-md transition-all hover:scale-110"
                  title="Ver imagen en tamaño completo"
                >
                  <Maximize2 size={15} />
                </button>

                {/* Dragging Overlay */}
                {isDragging && (
                  <div className="absolute inset-0 bg-indigo-600/85 text-white flex flex-col items-center justify-center gap-2 z-10">
                    <ImageIcon size={36} className="animate-bounce" />
                    <p className="font-black text-sm">¡Suelta la nueva foto para reemplazar!</p>
                  </div>
                )}
              </div>

              {/* Bottom Card Controls & Filename */}
              <div className="px-4 py-3 bg-white/90 border-t border-slate-100 flex items-center justify-between gap-2">
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-bold text-slate-800 truncate" title={selectedFile.name}>
                    {selectedFile.name}
                  </p>
                  <p className="text-[10px] text-slate-400 font-medium">
                    {formatFileSize(selectedFile.size)} • Haz clic en la foto para cambiarla
                  </p>
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                  <button 
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setShowFullModal(true);
                    }}
                    className="p-1.5 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-lg text-xs font-bold transition-colors"
                    title="Ver detalle"
                  >
                    <Eye size={14} />
                  </button>
                  <button 
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleClick();
                    }}
                    className="px-2.5 py-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 rounded-lg text-xs font-bold border border-emerald-200 transition-colors flex items-center gap-1"
                  >
                    <RefreshCw size={12} /> Cambiar
                  </button>
                  <button 
                    type="button"
                    onClick={clearFile}
                    className="px-2.5 py-1.5 bg-red-50 hover:bg-red-100 text-red-600 rounded-lg text-xs font-bold border border-red-200 transition-colors flex items-center gap-1"
                  >
                    <X size={12} /> Quitar
                  </button>
                </div>
              </div>
            </div>
          ) : (
            /* Document (e.g. .docx) file representation */
            <div 
              className="p-6 flex flex-col items-center justify-center gap-3 text-center cursor-pointer"
              onClick={handleClick}
            >
              <div className="w-14 h-14 bg-emerald-600 text-white rounded-2xl flex items-center justify-center shadow-lg shadow-emerald-600/20">
                <FileText size={28} />
              </div>
              <div className="flex flex-col items-center gap-1">
                <p className="text-[10px] font-black uppercase text-emerald-600 tracking-wider">
                  Archivo seleccionado
                </p>
                <p className="text-sm font-bold text-slate-800 truncate max-w-[260px]">
                  {selectedFile.name}
                </p>
                <span className="text-xs text-slate-400 font-medium">
                  {formatFileSize(selectedFile.size)}
                </span>
                <div className="flex items-center gap-2 mt-2">
                  <button 
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleClick();
                    }}
                    className="px-3 py-1 bg-white hover:bg-emerald-100 text-emerald-700 rounded-lg text-xs font-bold border border-emerald-200 transition-colors flex items-center gap-1 shadow-sm"
                  >
                    <RefreshCw size={12} /> Cambiar
                  </button>
                  <button 
                    type="button"
                    onClick={clearFile}
                    className="px-3 py-1 bg-white hover:bg-red-50 text-red-600 rounded-lg text-xs font-bold border border-red-200 transition-colors flex items-center gap-1 shadow-sm"
                  >
                    <X size={12} /> Quitar
                  </button>
                </div>
              </div>
            </div>
          )
        ) : (
          /* Empty / Upload Prompt State */
          <div 
            className="p-6 flex flex-col items-center justify-center gap-3 text-center cursor-pointer"
            onClick={handleClick}
          >
            <div className="p-3.5 bg-indigo-100 text-indigo-600 rounded-2xl group-hover:bg-indigo-200 transition-colors shadow-sm">
              {icon === 'file' ? <FileUp size={26} /> : <ImageIcon size={26} />}
            </div>
            <div>
              <p className="text-[13px] font-bold text-slate-700">
                {isDragging 
                  ? '¡Sueltas el archivo aquí!' 
                  : (isImage ? 'Haz clic para elegir, arrastra o pega (Ctrl+V)' : 'Haz clic para seleccionar o arrastra aquí')}
              </p>
              <p className="text-[11px] text-slate-400 mt-1 font-medium">
                {isImage ? 'Imágenes JPG, PNG, WEBP de la licencia' : 'Plantilla de Word (.docx)'}
              </p>
            </div>
            {isImage && (
              <div className="flex items-center gap-1.5 text-[10px] text-indigo-600 font-bold uppercase tracking-wider bg-indigo-50 px-3 py-1 rounded-full border border-indigo-100">
                <ClipboardPaste size={12} /> Pegar imagen activado (Ctrl+V)
              </div>
            )}
          </div>
        )}
      </div>

      {/* Full Image Modal Preview */}
      {showFullModal && previewUrl && (
        <div 
          className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4 sm:p-6 animate-in fade-in duration-200"
          onClick={() => setShowFullModal(false)}
        >
          <div 
            className="relative max-w-4xl w-full max-h-[90vh] bg-white rounded-3xl overflow-hidden shadow-2xl flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-4 bg-slate-900 text-white flex items-center justify-between">
              <div className="flex items-center gap-3 truncate">
                <div className="w-8 h-8 rounded-lg bg-indigo-600 flex items-center justify-center text-white">
                  <ImageIcon size={16} />
                </div>
                <div className="truncate">
                  <h4 className="font-bold text-sm truncate">{label}: {selectedFile?.name}</h4>
                  <p className="text-[10px] text-slate-400">{selectedFile && formatFileSize(selectedFile.size)}</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setShowFullModal(false);
                    handleClick();
                  }}
                  className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-bold transition-colors flex items-center gap-1.5"
                >
                  <RefreshCw size={12} /> Cambiar Foto
                </button>
                <button
                  type="button"
                  onClick={() => setShowFullModal(false)}
                  className="p-2 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white rounded-xl transition-colors"
                >
                  <X size={18} />
                </button>
              </div>
            </div>
            <div className="flex-1 overflow-auto bg-slate-950 flex items-center justify-center p-4 min-h-[300px]">
              <img 
                src={previewUrl} 
                alt={selectedFile?.name || 'Vista previa'} 
                className="max-w-full max-h-[75vh] object-contain rounded-lg shadow-2xl" 
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default FileUploader;

