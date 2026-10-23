
import React from 'react';
import { ExtractedData } from '../types';
import { Info, Copy, Hash, Check } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface DataPreviewProps {
  data: ExtractedData;
  onChange: (newData: ExtractedData) => void;
}

const DataPreview: React.FC<DataPreviewProps> = ({ data, onChange }) => {
  const [copiedKey, setCopiedKey] = React.useState<string | null>(null);

  const handleInputChange = (key: string, value: string) => {
    onChange({ ...data, [key]: value || "" });
  };

  const copy = (txt: string, key: string) => {
    navigator.clipboard.writeText(txt);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  const fieldLabels: Record<string, { label: string, tag: string }> = {
    assignedNumber: { label: "Nº de Expediente (Nombre de Archivo)", tag: "{{assignedNumber}}" },
    surname: { label: "1: Apellidos / Surname", tag: "{{surname}}" },
    firstName: { label: "2: Nombre / First Name", tag: "{{firstName}}" },
    middleName: { label: "2: Otros nombres / Middle Names", tag: "{{middleName}}" },
    licenseNumber: { label: "Nº de Licencia / License Number", tag: "{{licenseNumber}}" },
    dateOfBirth: { label: "3: Fecha de Nacimiento / Birth Date", tag: "{{dateOfBirth}}" },
    placeOfBirth: { label: "3: Lugar de Nacimiento / Birth Place", tag: "{{placeOfBirth}}" },
    issueDate: { label: "4a: Fecha de Expedición / Issue Date", tag: "{{issueDate}}" },
    authority: { label: "4c: Autoridad / Authority", tag: "{{authority}}" },
    categoriesDates: { label: "10: Fechas de Categorías / Dates", tag: "{{categoriesDates}}" },
    codes: { label: "Serie / Document Series", tag: "{{codes}}" },
    explicacionCodigos: { label: "Restricciones y Códigos / Restrictions", tag: "{{explicacionCodigos}}" },
    code106From: { label: "106: Desde / From", tag: "{{code106From}}" },
    code106To: { label: "106: Hasta / To", tag: "{{code106To}}" },
    expiryDate: { label: "4b: Fecha de Caducidad / Expiry Date", tag: "{{expiryDate}}" },
    class: { label: "9: Categorías / Categories", tag: "{{class}}" },
    classDescriptions: { label: "Descripción de Categorías / Class Descriptions", tag: "{{classDescriptions}}" },
  };

  return (
    <div className="space-y-8">
      <div className="bg-white border-2 border-slate-50 rounded-[2.5rem] overflow-hidden shadow-2xl shadow-indigo-500/5">
        <div className="px-10 py-8 border-b border-slate-50 bg-slate-50/50 flex items-center justify-between">
          <div>
            <h3 className="font-black text-slate-800 text-xl tracking-tight">Revisión de Datos Inteligente</h3>
            <p className="text-[12px] text-slate-400 font-bold mt-1 uppercase tracking-wider">Verifica la traducción generada por la IA</p>
          </div>
          <div className="hidden sm:flex items-center gap-2 text-[10px] font-black text-indigo-600 bg-indigo-50 px-4 py-2 rounded-2xl border border-indigo-100 shadow-sm">
            <Info size={14} /> MODO VALIDACIÓN
          </div>
        </div>
        <div className="p-10">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-x-12 gap-y-8">
            {Object.entries(fieldLabels).map(([key, item]) => {
              const isFullWidth = key === 'explicacionCodigos' || key === 'classDescriptions';
              const isAssignedNum = key === 'assignedNumber';
              const isFirstOrMiddle = key === 'firstName' || key === 'middleName';
              
              return (
                <motion.div 
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  key={key} 
                  className={`group flex flex-col gap-2 ${isFullWidth ? 'md:col-span-2' : ''} ${isAssignedNum ? 'md:col-span-2 bg-indigo-600 p-8 rounded-[2rem] border-0 mb-4 shadow-xl shadow-indigo-200' : ''} ${isFirstOrMiddle ? 'border-l-4 border-indigo-100 pl-6 bg-slate-50/30 py-2' : ''}`}
                >
                  <div className="flex items-center justify-between">
                    <label className={`text-[10px] font-black uppercase tracking-[0.2em] flex items-center gap-2 ${isAssignedNum ? 'text-indigo-100' : (isFirstOrMiddle ? 'text-indigo-600' : 'text-slate-400')}`}>
                      {isAssignedNum && <Hash size={14} />} {item.label}
                    </label>
                    <button 
                      onClick={() => copy(item.tag, key)}
                      className={`px-3 py-1 rounded-full text-[9px] font-black transition-all flex items-center gap-2 ${copiedKey === key ? 'bg-emerald-500 text-white' : (isAssignedNum ? 'bg-indigo-500 text-indigo-100 hover:bg-indigo-400' : 'bg-slate-100 text-slate-400 hover:bg-indigo-100 hover:text-indigo-600')}`}
                    >
                      {copiedKey === key ? <><Check size={10} /> COPIADO</> : <><Copy size={10} /> {item.tag}</>}
                    </button>
                  </div>
                  {isFullWidth ? (
                    <textarea
                      value={data[key as keyof ExtractedData] || ''}
                      onChange={(e) => handleInputChange(key, e.target.value)}
                      rows={4}
                      className="w-full px-6 py-4 bg-slate-50 border-2 border-slate-100 rounded-2xl text-base focus:ring-4 focus:ring-indigo-50 outline-none transition-all font-bold text-slate-700 placeholder:text-slate-300 resize-none"
                      placeholder="Sin datos adicionales"
                    />
                  ) : (
                    <input
                      type="text"
                      value={data[key as keyof ExtractedData] || ''}
                      onChange={(e) => handleInputChange(key, e.target.value)}
                      className={`w-full px-6 py-4 border-2 rounded-2xl text-base focus:ring-4 outline-none transition-all font-bold placeholder:text-slate-300/50 ${isAssignedNum ? 'bg-indigo-500 border-indigo-400 text-white text-2xl placeholder:text-indigo-300 focus:ring-indigo-300 shadow-inner' : 'bg-slate-50 border-slate-100 text-slate-700 focus:ring-indigo-50'}`}
                      placeholder={isAssignedNum ? "Ej: B-2025-001" : "No detectado"}
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
