
import React from 'react';
import { ExtractedData } from '../types';
import { Info, Copy, Hash } from 'lucide-react';

interface DataPreviewProps {
  data: ExtractedData;
  onChange: (newData: ExtractedData) => void;
}

const DataPreview: React.FC<DataPreviewProps> = ({ data, onChange }) => {
  const handleInputChange = (key: string, value: string) => {
    onChange({ ...data, [key]: value || "" });
  };

  const copy = (txt: string) => navigator.clipboard.writeText(txt);

  const fieldLabels: Record<string, { label: string, tag: string }> = {
    assignedNumber: { label: "4d: Número Personal (Control)", tag: "{{assignedNumber}}" },
    surname: { label: "1: Apellido", tag: "{{surname}}" },
    firstName: { label: "2: Nombre (Principal)", tag: "{{firstName}}" },
    middleName: { label: "2: Nombres Restantes", tag: "{{middleName}}" },
    licenseNumber: { label: "5: Nº Licencia", tag: "{{licenseNumber}}" },
    dateOfBirth: { label: "3: Fecha Nacimiento", tag: "{{dateOfBirth}}" },
    placeOfBirth: { label: "3: Lugar Nacimiento", tag: "{{placeOfBirth}}" },
    issueDate: { label: "4a: Fecha Emisión", tag: "{{issueDate}}" },
    authority: { label: "4c: Autoridad Emisora", tag: "{{authority}}" },
    categoriesDates: { label: "10: Fechas Categorías", tag: "{{categoriesDates}}" },
    codes: { label: "Códigos / Series", tag: "{{codes}}" },
    explicacionCodigos: { label: "Condiciones y Restricciones", tag: "{{explicacionCodigos}}" },
    code106From: { label: "106: Inicio", tag: "{{code106From}}" },
    code106To: { label: "106: Fin", tag: "{{code106To}}" },
    expiryDate: { label: "4b: Fecha Vencimiento", tag: "{{expiryDate}}" },
    class: { label: "9: Categorías", tag: "{{class}}" },
    classDescriptions: { label: "Descripción de Categorías", tag: "{{classDescriptions}}" },
  };

  return (
    <div className="space-y-12 animate-in fade-in slide-in-from-bottom-6 duration-1000">
      <div className="pro-card overflow-hidden ring-1 ring-slate-200/50">
        <div className="px-12 py-10 border-b border-slate-100 bg-slate-50/50 flex flex-col sm:flex-row sm:items-center justify-between gap-8">
          <div>
            <h3 className="font-extrabold text-slate-900 text-3xl tracking-tight">Revisión de Datos</h3>
            <p className="text-sm text-slate-500 font-medium mt-2 flex items-center gap-3">
              <span className="flex h-2 w-2 rounded-full bg-indigo-500 animate-pulse"></span>
              Verifica y protege la información detectada.
            </p>
          </div>
          <div className="flex items-center gap-4 text-xs font-bold text-indigo-700 bg-white px-6 py-4 rounded-2xl border border-indigo-100 shadow-sm shadow-indigo-100/20 group hover:border-indigo-300 transition-all cursor-default">
            <Info size={20} className="text-indigo-400" /> 
            <span className="tracking-wider">TRADUCCIÓN AUTO-ACTIVA</span>
          </div>
        </div>
        
        <div className="p-12 sm:p-16">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-x-16 gap-y-12">
            {Object.entries(fieldLabels).map(([key, item]) => {
              const isFullWidth = key === 'explicacionCodigos' || key === 'classDescriptions';
              const isAssignedNum = key === 'assignedNumber';
              
              return (
                <div key={key} className={`group flex flex-col gap-4 ${isFullWidth ? 'md:col-span-2' : ''} ${isAssignedNum ? 'md:col-span-2 bg-indigo-50/20 p-12 rounded-[3rem] border-2 border-indigo-100/50 mb-8' : ''}`}>
                  <div className="flex items-center justify-between px-3">
                    <label className={`text-xs font-black uppercase tracking-[0.15em] flex items-center gap-3 ${isAssignedNum ? 'text-indigo-700' : 'text-slate-500'}`}>
                      {isAssignedNum ? <Hash size={16} className="text-indigo-400" /> : <div className="w-2 h-2 rounded-full bg-slate-200 group-focus-within:bg-indigo-500 transition-colors"></div>}
                      {item.label}
                    </label>
                    <button 
                      onClick={() => copy(item.tag)}
                      className="opacity-0 group-hover:opacity-100 text-[10px] font-bold text-indigo-500 hover:text-white hover:bg-indigo-600 transition-all flex items-center gap-2 bg-indigo-50 px-4 py-2 rounded-xl ring-1 ring-indigo-100/50"
                    >
                      <Copy size={12} /> {item.tag}
                    </button>
                  </div>
                  
                  {isFullWidth ? (
                    <textarea
                      value={data[key as keyof ExtractedData] || ''}
                      onChange={(e) => handleInputChange(key, e.target.value)}
                      rows={5}
                      className="w-full px-8 py-7 bg-white border-2 border-slate-100 rounded-[2rem] text-lg font-medium text-slate-800 focus:border-indigo-400 focus:ring-8 focus:ring-indigo-500/5 outline-none transition-all resize-none shadow-sm"
                      placeholder="Sin restricciones detectadas."
                    />
                  ) : (
                    <div className="relative">
                      <input
                        type="text"
                        value={data[key as keyof ExtractedData] || ''}
                        onChange={(e) => handleInputChange(key, e.target.value)}
                        className={`w-full px-8 py-7 border-2 rounded-[2rem] text-lg font-bold outline-none transition-all shadow-sm ${isAssignedNum ? 'bg-white border-indigo-200 text-indigo-700 text-4xl font-black py-12 focus:border-indigo-500 focus:ring-12 focus:ring-indigo-500/10' : 'bg-white border-slate-100 text-slate-800 focus:border-indigo-400 focus:ring-8 focus:ring-indigo-500/5'}`}
                        placeholder={isAssignedNum ? "Escribir nombre de archivo..." : "Pendiente de detección"}
                        autoFocus={isAssignedNum}
                      />
                    </div>
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
