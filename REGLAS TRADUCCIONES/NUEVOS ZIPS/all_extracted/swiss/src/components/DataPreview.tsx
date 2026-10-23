import React from 'react';
import { ExtractedData } from '../types';
import { Info, Copy, Hash, Languages, BrainCircuit } from 'lucide-react';
import { motion } from 'framer-motion';

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
    assignedNumber: { label: "Nº Asignado (Nombre Archivo)", tag: "{{assignedNumber}}" },
    surname: { label: "Apellido", tag: "{{surname}}" },
    firstName: { label: "Nombre (Solo el primero)", tag: "{{firstName}}" },
    middleName: { label: "Otros Nombres", tag: "{{middleName}}" },
    licenseNumber: { label: "Nº Licencia", tag: "{{licenseNumber}}" },
    language: { label: "Idiomas en Licencia", tag: "{{language}}" },
    dateOfBirth: { label: "Fecha Nacimiento", tag: "{{dateOfBirth}}" },
    placeOfBirth: { label: "Lugar Nacimiento (Traducción)", tag: "{{placeOfBirth}}" },
    issueDate: { label: "Fecha Emisión", tag: "{{issueDate}}" },
    authority: { label: "Autoridad (Traducción)", tag: "{{authority}}" },
    categoriesDates: { label: "Fechas Categorías (Agrupadas)", tag: "{{categoriesDates}}" },
    codes: { label: "Serie (Superior Izquierda)", tag: "{{codes}}" },
    explicacionCodigos: { label: "Condiciones / Códigos", tag: "{{explicacionCodigos}}" },
    code106From: { label: "106: Desde", tag: "{{code106From}}" },
    code106To: { label: "106: Hasta", tag: "{{code106To}}" },
    expiryDate: { label: "Fecha Expiración", tag: "{{expiryDate}}" },
    class: { label: "Categorías (Punto 9)", tag: "{{class}}" },
    classDescriptions: { label: "Descripciones de Licencias", tag: "{{classDescriptions}}" },
  };

  return (
    <div className="space-y-6">
      <div className="bg-white border border-slate-200 rounded-[2rem] overflow-hidden shadow-sm">
        <div className="px-8 py-6 border-b border-slate-100 bg-slate-50/50 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="w-10 h-10 bg-white rounded-xl flex items-center justify-center text-indigo-600 shadow-sm border border-slate-100">
               <BrainCircuit size={20} />
            </div>
            <div>
              <h3 className="font-black text-slate-800 text-lg tracking-tight uppercase">Datos Extraídos y Traducidos</h3>
              <p className="text-[10px] text-slate-400 uppercase font-bold tracking-widest mt-0.5">Verifica y ajusta antes de exportar</p>
            </div>
          </div>
        </div>
        
        <div className="p-8">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-6">
            {Object.entries(fieldLabels).map(([key, item], index) => {
              const isFullWidth = key === 'explicacionCodigos' || key === 'classDescriptions';
              const isAssignedNum = key === 'assignedNumber';
              const isLanguage = key === 'language';
              const isFirstOrMiddle = key === 'firstName' || key === 'middleName';
              
              return (
                <motion.div 
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: index * 0.03 }}
                  key={key} 
                  className={`group flex flex-col gap-2 ${isFullWidth ? 'md:col-span-2' : ''} ${isAssignedNum ? 'md:col-span-2 bg-indigo-600 p-6 rounded-3xl border border-indigo-700 mb-4 shadow-lg shadow-indigo-100' : ''} ${isFirstOrMiddle ? 'border-l-2 border-indigo-100 pl-4' : ''}`}
                >
                  <div className="flex items-center justify-between">
                    <label className={`text-[10px] font-black uppercase tracking-[0.15em] flex items-center gap-2 ${isAssignedNum ? 'text-indigo-100' : (isFirstOrMiddle || isLanguage ? 'text-indigo-600' : 'text-slate-400')}`}>
                      {isAssignedNum && <Hash size={12} />} 
                      {isLanguage && <Languages size={12} />}
                      {item.label}
                    </label>
                    <button 
                      onClick={() => copy(item.tag)}
                      className={`opacity-0 group-hover:opacity-100 text-[9px] font-black transition-all flex items-center gap-1.5 px-2 py-1 rounded-md ${isAssignedNum ? 'bg-indigo-500 text-white hover:bg-indigo-400' : 'bg-slate-100 text-slate-500 hover:bg-indigo-100 hover:text-indigo-600'}`}
                    >
                      <Copy size={10} /> {item.tag}
                    </button>
                  </div>
                  
                  {isFullWidth ? (
                    <textarea
                      value={data[key as keyof ExtractedData] || ''}
                      onChange={(e) => handleInputChange(key, e.target.value)}
                      rows={3}
                      className="w-full px-5 py-4 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-bold text-slate-800 focus:ring-4 focus:ring-indigo-100 focus:border-indigo-400 outline-none transition-all placeholder:text-slate-300 resize-none shadow-inner"
                      placeholder="Sin condiciones detectadas."
                    />
                  ) : (
                    <input
                      type="text"
                      value={data[key as keyof ExtractedData] || ''}
                      onChange={(e) => handleInputChange(key, e.target.value)}
                      className={`w-full px-5 py-4 rounded-2xl text-sm font-bold placeholder:text-slate-300 focus:ring-4 outline-none transition-all ${isAssignedNum ? 'bg-white border-none text-indigo-900 text-xl shadow-xl focus:ring-white/20' : 'bg-slate-50 border border-slate-200 text-slate-800 focus:ring-indigo-50 focus:border-indigo-400 shadow-inner'}`}
                      placeholder={isAssignedNum ? "Ejem: B1758..." : "Autocompletado..."}
                      autoFocus={isAssignedNum}
                    />
                  )}
                </motion.div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
};

export default DataPreview;
