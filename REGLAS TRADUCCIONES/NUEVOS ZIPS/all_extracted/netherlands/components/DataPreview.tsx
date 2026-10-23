
import React from 'react';
import { ExtractedData } from '../types';
import { Info, Copy, Hash, User, MapPin, Calendar, Shield, List, Type, RefreshCw } from 'lucide-react';
import { motion } from 'motion/react';
import { generateClassDescriptions, normalizeCategoriesDates } from '../services/categoryService';

interface DataPreviewProps {
  data: ExtractedData;
  onChange: (newData: ExtractedData) => void;
}

const DataPreview: React.FC<DataPreviewProps> = ({ data, onChange }) => {
  const handleInputChange = (key: string, value: string) => {
    if (key === 'class') {
      const autoDescs = generateClassDescriptions(value, data.categoriesDates);
      onChange({
        ...data,
        class: value || "-",
        classDescriptions: autoDescs || "-"
      });
      return;
    }
    onChange({ ...data, [key]: value });
  };

  const regenerateDescriptions = () => {
    const descs = generateClassDescriptions(data.class, data.categoriesDates);
    onChange({
      ...data,
      classDescriptions: descs
    });
  };

  const regenerateDates = () => {
    const formatted = normalizeCategoriesDates(data.categoriesDates);
    onChange({
      ...data,
      categoriesDates: formatted
    });
  };

  const copy = (txt: string) => {
    navigator.clipboard.writeText(txt);
  };

  const fieldLabels: Record<string, { label: string, tag: string, icon: any, color: string }> = {
    assignedNumber: { label: "Número Asignado", tag: "{{assignedNumber}}", icon: Hash, color: "text-rose-600" },
    licenseNumber: { label: "License Number (5)", tag: "{{licenseNumber}}", icon: Shield, color: "text-slate-400" },
    citizen: { label: "BSN / Series", tag: "{{citizen}}", icon: User, color: "text-slate-400" },
    surname: { label: "Surname (1)", tag: "{{surname}}", icon: Type, color: "text-slate-400" },
    firstName: { label: "First Name (2.1)", tag: "{{firstName}}", icon: Type, color: "text-slate-400" },
    middleName: { label: "Middle Names (2.2)", tag: "{{middleName}}", icon: Type, color: "text-slate-400" },
    dateOfBirth: { label: "Date of Birth (3.1)", tag: "{{dateOfBirth}}", icon: Calendar, color: "text-slate-400" },
    placeOfBirth: { label: "Place of Birth (3.2)", tag: "{{placeOfBirth}}", icon: MapPin, color: "text-slate-400" },
    issueDate: { label: "Issue Date (4a)", tag: "{{issueDate}}", icon: Calendar, color: "text-slate-400" },
    expiryDate: { label: "Expiry Date (4b)", tag: "{{expiryDate}}", icon: Calendar, color: "text-slate-400" },
    authority: { label: "Authority (4c)", tag: "{{authority}}", icon: Shield, color: "text-slate-400" },
    class: { label: "Categories (9)", tag: "{{class}}", icon: List, color: "text-slate-400" },
    classDescriptions: { label: "Class Descriptions (Permitted Categories)", tag: "{{classDescriptions}}", icon: List, color: "text-slate-400" },
    categoriesDates: { label: "Category Dates (10)", tag: "{{categoriesDates}}", icon: Calendar, color: "text-slate-400" },
    code106From: { label: "Code 106 From", tag: "{{code106From}}", icon: Calendar, color: "text-slate-400" },
    code106To: { label: "Code 106 To", tag: "{{code106To}}", icon: Calendar, color: "text-slate-400" },
    codes: { label: "Series Code", tag: "{{codes}}", icon: Hash, color: "text-slate-400" },
    explicacionCodigos: { label: "Restrictions & Conditions", tag: "{{explicacionCodigos}}", icon: List, color: "text-slate-400" },
  };

  return (
    <div className="space-y-8">
      <div className="bg-white border border-slate-200 rounded-[2.5rem] overflow-hidden shadow-sm">
        <div className="px-8 py-6 border-b border-slate-100 bg-slate-50/50 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h3 className="font-black text-slate-800 text-lg tracking-tight">Revisión de Datos</h3>
            <p className="text-xs text-slate-500 font-medium mt-1">Verifica la traducción y asigna un número de control.</p>
          </div>
          <div className="flex items-center gap-2 text-[10px] font-black text-indigo-600 bg-indigo-50 px-4 py-2 rounded-xl border border-indigo-100 tracking-widest uppercase">
            <Info size={14} /> Modo Verificación Activo
          </div>
        </div>

        <div className="p-8">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-x-6 gap-y-8">
            {Object.entries(fieldLabels).map(([key, item]) => {
              const isFullWidth = key === 'explicacionCodigos' || key === 'categoriesDates' || key === 'classDescriptions';
              const isAssignedNum = key === 'assignedNumber';
              const isTextarea = key === 'explicacionCodigos' || key === 'classDescriptions' || key === 'categoriesDates';
              const Icon = item.icon;
              
              return (
                <motion.div 
                  layout
                  key={key} 
                  className={`flex flex-col gap-2 ${isFullWidth ? 'md:col-span-2 lg:col-span-3' : ''} ${isAssignedNum ? 'md:col-span-2 lg:col-span-3 bg-indigo-600 p-8 rounded-[2rem] border-none shadow-xl shadow-indigo-100 mb-4' : ''}`}
                >
                  <div className="flex items-center justify-between">
                    <label className={`text-[10px] font-black uppercase tracking-[0.15em] flex items-center gap-2 ${isAssignedNum ? 'text-white/70' : 'text-slate-400'}`}>
                      <Icon size={12} className={isAssignedNum ? 'text-white' : 'text-indigo-500'} /> {item.label}
                    </label>
                    <div className="flex items-center gap-2">
                      {key === 'classDescriptions' && (
                        <button
                          type="button"
                          onClick={regenerateDescriptions}
                          className="text-[9px] font-bold px-2 py-1 rounded-md text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 transition-all flex items-center gap-1"
                          title="Regenerar descripciones a partir de las categorías en {{class}}"
                        >
                          <RefreshCw size={10} /> Auto-rellenar
                        </button>
                      )}
                      {key === 'categoriesDates' && (
                        <button
                          type="button"
                          onClick={regenerateDates}
                          className="text-[9px] font-bold px-2 py-1 rounded-md text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 transition-all flex items-center gap-1"
                          title="Agrupar licencias por fecha según las reglas"
                        >
                          <RefreshCw size={10} /> Agrupar
                        </button>
                      )}
                      <button 
                        onClick={() => copy(item.tag)}
                        className={`text-[9px] font-bold px-2 py-1 rounded-md transition-all flex items-center gap-1 ${isAssignedNum ? 'text-white/50 hover:text-white hover:bg-white/10' : 'text-slate-300 hover:text-indigo-600 hover:bg-indigo-50'}`}
                        title={`Click para copiar tag: ${item.tag}`}
                      >
                        <Copy size={10} /> {item.tag}
                      </button>
                    </div>
                  </div>
                  
                  {isTextarea ? (
                    <textarea
                      value={data[key as keyof ExtractedData] ?? ''}
                      onChange={(e) => handleInputChange(key, e.target.value)}
                      rows={key === 'classDescriptions' ? 6 : (key === 'categoriesDates' ? 3 : 4)}
                      className="w-full px-5 py-4 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-semibold text-slate-700 focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 outline-none transition-all resize-y shadow-inner font-mono text-xs leading-relaxed"
                      placeholder={
                        key === 'classDescriptions' 
                          ? "Descripciones de vehículos permitidos..." 
                          : key === 'categoriesDates' 
                            ? "Ejemplo:\nA1,A2: 01 May 2026\nB: 12 April 2025\n(o solo la fecha si todas coinciden)"
                            : "-"
                      }
                    />
                  ) : (
                    <input
                      type="text"
                      value={data[key as keyof ExtractedData] ?? ''}
                      onChange={(e) => handleInputChange(key, e.target.value)}
                      className={`w-full px-5 py-4 text-sm outline-none transition-all font-bold ${
                        isAssignedNum 
                        ? 'bg-white/10 border border-white/20 rounded-2xl text-white text-2xl placeholder:text-white/30 focus:bg-white/20' 
                        : 'bg-slate-50 border border-slate-200 rounded-2xl text-slate-700 focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 shadow-inner'
                      }`}
                      placeholder={isAssignedNum ? "Escribe el número aquí..." : "-"}
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
