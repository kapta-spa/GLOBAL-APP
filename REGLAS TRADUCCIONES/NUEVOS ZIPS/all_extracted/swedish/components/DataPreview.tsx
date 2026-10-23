
import React from 'react';
import { ExtractedData } from '../types';
import { Info, Copy, Hash, Languages, User, Calendar, Shield, CreditCard } from 'lucide-react';
import { motion } from 'motion/react';

interface DataPreviewProps {
  data: ExtractedData;
  onChange: (newData: ExtractedData) => void;
}

const DataPreview: React.FC<DataPreviewProps> = ({ data, onChange }) => {
  const handleInputChange = (key: string, value: string) => {
    onChange({ ...data, [key]: value || "" });
  };

  const copy = (txt: string) => navigator.clipboard.writeText(txt);

  const groups = [
    {
      title: "Control Interno",
      icon: Shield,
      color: "text-red-600",
      bg: "bg-red-50/50",
      fields: [
        { key: 'assignedNumber', label: "Assigned Number (BXXX)", tag: "{{assignedNumber}}", full: true }
      ]
    },
    {
      title: "Identidad",
      icon: User,
      color: "text-indigo-600",
      bg: "bg-indigo-50/50",
      fields: [
        { key: 'surname', label: "Apellido(s)", tag: "{{surname}}" },
        { key: 'firstName', label: "Primer Nombre", tag: "{{firstName}}" },
        { key: 'middleName', label: "Otros Nombres", tag: "{{middleName}}" },
        { key: 'placeOfBirth', label: "Lugar de Nacimiento", tag: "{{placeOfBirth}}" },
      ]
    },
    {
      title: "Fechas Críticas",
      icon: Calendar,
      color: "text-amber-600",
      bg: "bg-amber-50/50",
      fields: [
        { key: 'dateOfBirth', label: "Fecha Nacimiento", tag: "{{dateOfBirth}}" },
        { key: 'issueDate', label: "Fecha Expedición", tag: "{{issueDate}}" },
        { key: 'expiryDate', label: "Fecha Caducidad", tag: "{{expiryDate}}" },
        { key: 'code106From', label: "106: Desde", tag: "{{code106From}}" },
        { key: 'code106To', label: "106: Hasta", tag: "{{code106To}}" },
      ]
    },
    {
      title: "Licencia y Códigos",
      icon: CreditCard,
      color: "text-emerald-600",
      bg: "bg-emerald-50/50",
      fields: [
        { key: 'licenseNumber', label: "Número Licencia", tag: "{{licenseNumber}}" },
        { key: 'class', label: "Categorías (9)", tag: "{{class}}" },
        { key: 'authority', label: "Autoridad (4c)", tag: "{{authority}}" },
        { key: 'language', label: "Idioma Original", tag: "{{language}}" },
        { key: 'codes', label: "Código Ref (4d)", tag: "{{codes}}" },
        { key: 'categoriesDates', label: "Fechas Categorías", tag: "{{categoriesDates}}", full: true },
        { key: 'classDescriptions', label: "Descripciones de Categorías", tag: "{{classDescriptions}}", full: true },
        { key: 'explicacionCodigos', label: "Condiciones / Observaciones", tag: "{{explicacionCodigos}}", full: true },
      ]
    }
  ];

  return (
    <div className="space-y-8 pb-12">
      {groups.map((group, gIdx) => (
        <motion.div 
          key={group.title}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: gIdx * 0.1 }}
          className="bg-white border border-slate-100 rounded-[2rem] shadow-sm overflow-hidden"
        >
          <div className={`px-8 py-5 border-b border-slate-50 ${group.bg} flex items-center justify-between`}>
            <div className="flex items-center gap-3">
              <div className={`p-2 rounded-lg bg-white shadow-sm ${group.color}`}>
                <group.icon size={20} />
              </div>
              <h3 className="font-black text-slate-800 text-sm uppercase tracking-widest">{group.title}</h3>
            </div>
          </div>
          
          <div className="p-8">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-x-10 gap-y-6">
              {group.fields.map((field) => {
                const isTextArea = field.key === 'explicacionCodigos' || field.key === 'classDescriptions' || field.key === 'categoriesDates';
                const isSpecial = field.key === 'assignedNumber';
                
                return (
                  <div key={field.key} className={`group flex flex-col gap-2 ${field.full ? 'md:col-span-2' : ''}`}>
                    <div className="flex items-center justify-between px-1">
                      <label className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">
                        {field.label}
                      </label>
                      <button 
                        onClick={() => copy(field.tag)}
                        className="opacity-0 group-hover:opacity-100 text-[10px] font-bold text-indigo-500 hover:text-indigo-700 transition-all flex items-center gap-1.5"
                      >
                        <Copy size={12} /> <span className="font-mono">{field.tag}</span>
                      </button>
                    </div>
                    
                    {isTextArea ? (
                      <textarea
                        value={data[field.key as keyof ExtractedData] || ''}
                        onChange={(e) => handleInputChange(field.key, e.target.value)}
                        rows={3}
                        className="w-full px-5 py-4 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-semibold text-slate-700 focus:ring-4 focus:ring-indigo-100 focus:border-indigo-400 outline-none transition-all placeholder:text-slate-300 resize-none"
                        placeholder="Sin observaciones detectadas..."
                      />
                    ) : (
                      <input
                        type="text"
                        value={data[field.key as keyof ExtractedData] || ''}
                        onChange={(e) => handleInputChange(field.key, e.target.value)}
                        className={`w-full px-5 py-4 border rounded-2xl text-sm font-bold transition-all outline-none 
                          ${isSpecial 
                            ? 'bg-red-50 border-red-200 text-red-700 text-xl focus:ring-red-100 placeholder:text-red-200' 
                            : 'bg-slate-50 border-slate-100 text-slate-700 focus:ring-indigo-100 focus:border-indigo-400 placeholder:text-slate-300'}`}
                        placeholder={isSpecial ? "Ejem: B1758" : "No detectado"}
                        autoFocus={isSpecial}
                      />
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </motion.div>
      ))}
    </div>
  );
};

export default DataPreview;
