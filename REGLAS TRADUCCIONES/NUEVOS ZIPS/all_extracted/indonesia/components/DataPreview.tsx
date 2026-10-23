
import React from 'react';
import { ExtractedData } from '../types';
import { Info, Copy, Hash, AlertCircle, CheckCircle2 } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface DataPreviewProps {
  data: ExtractedData;
  onChange: (newData: ExtractedData) => void;
}

const DataPreview: React.FC<DataPreviewProps> = ({ data, onChange }) => {
  const handleInputChange = (key: string, value: string) => {
    onChange({ ...data, [key]: value || "" });
  };

  const copy = (txt: string) => navigator.clipboard.writeText(txt);

  const fieldLabels: Record<string, { label: string, tag: string, desc?: string }> = {
    assignedNumber: { label: "Nº Expediente / Nombre Archivo", tag: "{{assignedNumber}}", desc: "Se usará como nombre del archivo generado" },
    surname: { label: "1: Apellidos", tag: "{{surname}}" },
    firstName: { label: "2: Nombre", tag: "{{firstName}}" },
    middleName: { label: "2: Segundo Nombre", tag: "{{middleName}}" },
    gender: { label: "Sexo", tag: "{{gender}}" },
    blood: { label: "Grupo Sanguíneo", tag: "{{blood}}" },
    address: { label: "Dirección Completa", tag: "{{address}}" },
    licenseNumber: { label: "Nº Licencia (5)", tag: "{{licenseNumber}}" },
    dateOfBirth: { label: "3: Fecha Nacimiento", tag: "{{dateOfBirth}}" },
    placeOfBirth: { label: "3: Lugar Nacimiento", tag: "{{placeOfBirth}}" },
    issueDate: { label: "4a: Fecha Emisión", tag: "{{issueDate}}" },
    authority: { label: "4c: Autoridad", tag: "{{authority}}" },
    codes: { label: "Códigos (Reverso)", tag: "{{code}}" },
    categoriesDates: { label: "10: Fechas Categorías", tag: "{{categoriesDates}}" },
    explicacionCodigos: { label: "Restricciones y Condiciones", tag: "{{explicacionCodigos}}" },
    expiryDate: { label: "4b: Fecha Expiración", tag: "{{expiryDate}}" },
    class: { label: "9: Categorías", tag: "{{class}}" },
  };

  return (
    <div className="space-y-8 pb-12">
      <div className="bg-white border border-slate-100 rounded-[2.5rem] overflow-hidden shadow-2xl shadow-indigo-500/5">
        <div className="px-10 py-8 border-b border-slate-50 bg-slate-50/50 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h3 className="font-black text-slate-900 text-xl tracking-tight italic">Revisión de Datos Inteligente</h3>
            <p className="text-[11px] text-slate-400 font-bold uppercase tracking-widest mt-1">Verificación manual de la extracción IA</p>
          </div>
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2 text-[10px] font-black text-indigo-600 bg-white px-4 py-2 rounded-full border border-indigo-50 shadow-sm ring-4 ring-indigo-50/50 uppercase tracking-widest">
              <Info size={14} className="text-indigo-500" /> Modo Auditoría Activo
            </div>
          </div>
        </div>
        
        <div className="p-10">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-x-12 gap-y-8">
            {Object.entries(fieldLabels).map(([key, item], index) => {
              const isLarge = key === 'explicacionCodigos' || key === 'address' || key === 'categoriesDates';
              const isAssignedNum = key === 'assignedNumber';
              const value = data[key as keyof ExtractedData] || '';
              const hasValue = value.length > 0;
              
              return (
                <motion.div 
                  key={key} 
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.03 }}
                  className={cn(
                    "group flex flex-col gap-2 transition-all duration-300",
                    isLarge ? "md:col-span-2" : "",
                    isAssignedNum ? "md:col-span-2 p-8 bg-indigo-50 rounded-[2rem] border border-indigo-100 mb-4 ring-8 ring-indigo-50/50" : "hover:scale-[1.01]"
                  )}
                >
                  <div className="flex items-center justify-between px-1">
                    <div className="flex flex-col">
                      <label className={cn(
                        "text-[10px] font-black uppercase tracking-[0.2em] flex items-center gap-2",
                        isAssignedNum ? "text-indigo-600" : (hasValue ? "text-slate-400" : "text-amber-500")
                      )}>
                        {isAssignedNum ? <AlertCircle size={12} /> : (hasValue ? <CheckCircle2 size={12} className="text-emerald-500" /> : <AlertCircle size={12} />)}
                        {item.label}
                      </label>
                      {item.desc && <span className="text-[10px] text-indigo-400/70 font-medium italic mt-0.5">{item.desc}</span>}
                    </div>
                    
                    <button 
                      onClick={() => copy(item.tag)}
                      className="opacity-0 group-hover:opacity-100 text-[9px] font-black text-indigo-400 hover:text-indigo-600 transition-all flex items-center gap-1.5 uppercase tracking-tighter bg-indigo-50 px-2 py-1 rounded-md"
                    >
                      <Copy size={10} /> Copiar {item.tag}
                    </button>
                  </div>

                  {isLarge ? (
                    <textarea
                      value={value}
                      onChange={(e) => handleInputChange(key, e.target.value)}
                      rows={key === 'address' ? 2 : 3}
                      className="w-full px-6 py-4 bg-slate-50 border border-slate-100 rounded-2xl text-sm font-bold text-slate-700 focus:bg-white focus:ring-4 focus:ring-indigo-100 focus:border-indigo-300 outline-none transition-all placeholder:text-slate-300 resize-none shadow-inner"
                    />
                  ) : (
                    <input
                      type="text"
                      value={value}
                      onChange={(e) => handleInputChange(key, e.target.value)}
                      className={cn(
                        "w-full px-6 py-4 rounded-2xl text-sm font-bold transition-all outline-none shadow-inner",
                        isAssignedNum 
                          ? "bg-white border-2 border-indigo-200 text-indigo-900 text-xl placeholder:text-indigo-200 focus:ring-8 focus:ring-indigo-100" 
                          : "bg-slate-50 border border-slate-100 text-slate-700 focus:bg-white focus:ring-4 focus:ring-indigo-100 focus:border-indigo-300"
                      )}
                      placeholder={hasValue ? "" : "No detectado automáticamente"}
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

function cn(...inputs: any[]) {
  return inputs.filter(Boolean).join(' ');
}
