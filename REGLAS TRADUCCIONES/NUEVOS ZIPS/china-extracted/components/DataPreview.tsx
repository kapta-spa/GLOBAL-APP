
import React from 'react';
import { ExtractedData } from '../types';
import { Info, Copy, Hash, Image as ImageIcon } from 'lucide-react';

interface DataPreviewProps {
  data: ExtractedData;
  onChange: (newData: ExtractedData) => void;
}

const DataPreview: React.FC<DataPreviewProps> = ({ data, onChange }) => {
  const handleInputChange = (key: string, value: string) => {
    onChange({ ...data, [key]: value || "" });
  };

  const copy = (txt: string) => {
    navigator.clipboard.writeText(txt);
    alert(`Copiado: ${txt}`);
  };

  const fieldLabels: Record<string, { label: string, tag: string }> = {
    assignedNumber: { label: "Assigned Number", tag: "{{assignedNumber}}" },
    surname: { label: "Surname", tag: "{{surname}}" },
    firstName: { label: "First Name", tag: "{{firstName}}" },
    fullName: { label: "Full Name", tag: "{{fullName}}" },
    licenseNumber: { label: "License Number / ID", tag: "{{licenseNumber}}" },
    fileNumber: { label: "File Number (档案编号)", tag: "{{fileNumber}}" },
    barcodeNumber: { label: "Barcode Number", tag: "{{barcodeNumber}}" },
    dateOfBirth: { label: "Date of Birth", tag: "{{dateOfBirth}}" },
    firstIssued: { label: "First Issued (初次领证日期)", tag: "{{firstIssued}}" },
    issueDate: { label: "Issue Date (Start of Valid Period)", tag: "{{issueDate}}" },
    expiryDate: { label: "Expiry Date (End of Valid Period)", tag: "{{expiryDate}}" },
    class: { label: "Class", tag: "{{class}}" },
    authority: { label: "Authority", tag: "{{authority}}" },
    address: { label: "Address", tag: "{{address}}" },
    explicacionCodigos: { label: "Record Section (记录)", tag: "{{explicacionCodigos}}" },
  };

  // REGLA DE ORO: Las imágenes en docxtemplater-image-module-free usan el prefijo %
  const imageTags = [
    { label: "Foto Frontal", tag: "{{%foto_1}}" },
    { label: "Foto Posterior", tag: "{{%foto_2}}" },
    { label: "Foto Record 1", tag: "{{%foto_3}}" },
    { label: "Foto Record 2", tag: "{{%foto_4}}" },
  ];

  return (
    <div className="space-y-6">
      <div className="bg-indigo-900 text-white rounded-2xl p-6 shadow-lg border border-indigo-700">
        <div className="flex items-center gap-3 mb-4">
          <ImageIcon className="text-indigo-300" />
          <h3 className="font-black text-lg">Etiquetas para Fotos (Word)</h3>
        </div>
        <p className="text-xs text-indigo-200 mb-4 font-medium uppercase tracking-wider">Copia y pega estas etiquetas en tu documento Word:</p>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {imageTags.map((img) => (
            <button 
              key={img.tag}
              onClick={() => copy(img.tag)}
              className="bg-indigo-800/50 hover:bg-indigo-700 border border-indigo-500/30 p-3 rounded-xl transition-all flex flex-col items-center gap-1 group"
            >
              <span className="text-[10px] font-bold opacity-60 uppercase">{img.label}</span>
              <code className="text-sm font-black text-indigo-100 group-hover:text-white">{img.tag}</code>
            </button>
          ))}
        </div>
        <p className="mt-4 text-[10px] text-indigo-300 bg-indigo-950/50 p-2 rounded-lg italic">
          Tip: Si el error de "Duplicate tag" persiste, borra la etiqueta en Word y vuelve a escribirla manualmente sin copiar formato.
        </p>
      </div>

      <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm">
        <div className="px-6 py-4 border-b border-slate-100 bg-slate-50 flex items-center justify-between">
          <div>
            <h3 className="font-bold text-slate-800 text-sm">Verificar Datos Extraídos</h3>
            <p className="text-[11px] text-slate-500">Haz clic en la etiqueta para copiarla.</p>
          </div>
          <div className="flex items-center gap-2 text-[10px] font-bold text-indigo-600 bg-indigo-50 px-3 py-1.5 rounded-full border border-indigo-100">
            <Info size={12} /> DATOS EDITABLES
          </div>
        </div>
        <div className="p-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-5">
            {Object.entries(fieldLabels).map(([key, item]) => {
              const isFullWidth = key === 'explicacionCodigos' || key === 'address';
              const isAssignedNum = key === 'assignedNumber';
              
              return (
                <div key={key} className={`group flex flex-col gap-1.5 ${isFullWidth ? 'md:col-span-2' : ''} ${isAssignedNum ? 'md:col-span-2 bg-red-50/30 p-4 rounded-2xl border border-red-100 mb-2' : ''}`}>
                  <div className="flex items-center justify-between">
                    <label className={`text-[10px] font-black uppercase tracking-widest flex items-center gap-1.5 ${isAssignedNum ? 'text-red-600' : 'text-slate-400'}`}>
                      {isAssignedNum && <Hash size={12} />} {item.label}
                    </label>
                    <button 
                      onClick={() => copy(item.tag)}
                      className="opacity-0 group-hover:opacity-100 text-[9px] font-bold text-indigo-500 hover:text-indigo-700 transition-all flex items-center gap-1"
                    >
                      <Copy size={10} /> {item.tag}
                    </button>
                  </div>
                  {isFullWidth ? (
                    <textarea
                      value={data[key as keyof ExtractedData] || ''}
                      onChange={(e) => handleInputChange(key, e.target.value)}
                      rows={key === 'explicacionCodigos' ? 4 : 2}
                      className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 outline-none transition-all font-semibold text-slate-700 placeholder:text-slate-300 resize-none"
                    />
                  ) : (
                    <input
                      type="text"
                      value={data[key as keyof ExtractedData] || ''}
                      onChange={(e) => handleInputChange(key, e.target.value)}
                      className={`w-full px-4 py-3 border rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 outline-none transition-all font-semibold placeholder:text-slate-300 ${isAssignedNum ? 'bg-white border-red-300 text-red-700 text-lg shadow-sm' : 'bg-slate-50 border-slate-200 text-slate-700'}`}
                    />
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
};

export default DataPreview;
