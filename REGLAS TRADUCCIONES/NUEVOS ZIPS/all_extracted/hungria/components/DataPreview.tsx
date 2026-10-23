
import React from 'react';
import { ExtractedData, HUNGARIAN_SPECIAL_CLASSES, LICENSE_CLASS_DESCRIPTIONS, getClassDescriptions } from '../types';
import { Info, Copy, Hash, Languages, Tractor, CheckCircle2, Plus, FileText, Check } from 'lucide-react';

interface DataPreviewProps {
  data: ExtractedData;
  onChange: (newData: ExtractedData) => void;
}

const DataPreview: React.FC<DataPreviewProps> = ({ data, onChange }) => {
  const handleInputChange = (key: string, value: string) => {
    const updated = { ...data, [key]: value || "" };
    if (key === 'class') {
      updated.classDescriptions = getClassDescriptions(value);
    }
    onChange(updated);
  };

  const copy = (txt: string) => navigator.clipboard.writeText(txt);

  const toggleCategory = (catCode: string) => {
    const currentClasses = (data.class || '').split(/[,;\s/]+/).map(c => c.trim()).filter(Boolean);
    let updated: string[];
    const normalizedCode = catCode.toUpperCase();
    if (currentClasses.some(c => c.toUpperCase() === normalizedCode)) {
      updated = currentClasses.filter(c => c.toUpperCase() !== normalizedCode);
    } else {
      updated = [...currentClasses, catCode];
    }
    const newClassStr = updated.join(', ');
    onChange({
      ...data,
      class: newClassStr,
      classDescriptions: getClassDescriptions(newClassStr)
    });
  };

  const fieldLabels: Record<string, { label: string, tag: string }> = {
    assignedNumber: { label: "Assigned Number (File Name & Bold/Red)", tag: "{{assignedNumber}}" },
    licenseLanguage: { label: "Original License Language", tag: "{{licenseLanguage}}" },
    surname: { label: "1: Surname", tag: "{{surname}}" },
    firstName: { label: "2: First Name (Only First)", tag: "{{firstName}}" },
    middleName: { label: "2: Middle Name (Rest of names)", tag: "{{middleName}}" },
    licenseNumber: { label: "License Number (From Card)", tag: "{{licenseNumber}}" },
    dateOfBirth: { label: "3: Date of Birth", tag: "{{dateOfBirth}}" },
    placeOfBirth: { label: "3: Place of Birth (English)", tag: "{{placeOfBirth}}" },
    issueDate: { label: "4a: Issue Date", tag: "{{issueDate}}" },
    authority: { label: "4c: Authority (English)", tag: "{{authority}}" },
    categoriesDates: { label: "10: Categories Dates", tag: "{{categoriesDates}}" },
    codes: { label: "Series (Top Left)", tag: "{{codes}}" },
    class: { label: "9: Categories", tag: "{{class}}" },
    classDescriptions: { label: "Class Descriptions (Permitted Categories Only)", tag: "{{classDescriptions}}" },
    explicacionCodigos: { label: "Restrictions & Conditions (English)", tag: "{{explicacionCodigos}}" },
    code106From: { label: "106: From Date", tag: "{{code106From}}" },
    code106To: { label: "106: To Date", tag: "{{code106To}}" },
    expiryDate: { label: "4b: Expiry Date", tag: "{{expiryDate}}" },
  };

  const activeClasses = (data.class || '').split(',').map(c => c.trim().toUpperCase());

  return (
    <div className="space-y-6">
      {/* Special Hungarian Categories Card */}
      <div className="bg-amber-50/60 border border-amber-200/80 rounded-2xl p-5 shadow-sm">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-amber-500 text-white flex items-center justify-center font-black text-xs shadow-sm">
              <Tractor size={16} />
            </div>
            <div>
              <h4 className="text-xs font-black text-amber-950 uppercase tracking-wider">Clases Especiales de Hungría</h4>
              <p className="text-[11px] text-amber-800">Puntúa o haz clic en la clase para añadirla a la categoría (9: Categories)</p>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5 pt-1">
          {Object.entries(HUNGARIAN_SPECIAL_CLASSES).map(([code, desc]) => {
            const isSelected = activeClasses.includes(code);
            return (
              <div 
                key={code}
                onClick={() => toggleCategory(code)}
                className={`cursor-pointer p-3 rounded-xl border transition-all flex flex-col justify-between select-none ${
                  isSelected 
                    ? 'bg-amber-500 text-white border-amber-600 shadow-sm' 
                    : 'bg-white hover:bg-amber-100/50 text-slate-700 border-amber-200'
                }`}
              >
                <div className="flex items-center justify-between font-extrabold text-xs mb-1">
                  <span className="flex items-center gap-1.5">
                    <span className={`w-5 h-5 rounded-md flex items-center justify-center text-[11px] font-black ${
                      isSelected ? 'bg-white/20 text-white' : 'bg-amber-100 text-amber-900'
                    }`}>
                      {code}
                    </span>
                    Clase {code}
                  </span>
                  {isSelected ? (
                    <span className="text-[10px] font-bold flex items-center gap-1 bg-white/20 px-2 py-0.5 rounded-full">
                      <CheckCircle2 size={10} /> Añadido
                    </span>
                  ) : (
                    <span className="text-[10px] font-bold text-amber-600 flex items-center gap-1 opacity-0 group-hover:opacity-100 hover:underline">
                      <Plus size={10} /> Añadir
                    </span>
                  )}
                </div>
                <p className={`text-[11px] leading-tight font-medium ${isSelected ? 'text-amber-50' : 'text-slate-600'}`}>
                  {desc}
                </p>
              </div>
            );
          })}
        </div>
      </div>

      <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm">
        <div className="px-6 py-4 border-b border-slate-100 bg-slate-50 flex items-center justify-between">
          <div>
            <h3 className="font-bold text-slate-800 text-sm">Review Extracted Data (English)</h3>
            <p className="text-[11px] text-slate-500">Assign a number and verify translation before generating Word.</p>
          </div>
          <div className="flex items-center gap-2 text-[10px] font-bold text-indigo-600 bg-indigo-50 px-3 py-1.5 rounded-full border border-indigo-100">
            <Info size={12} /> CONFIGURATION MODE
          </div>
        </div>
        <div className="p-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-5">
            {Object.entries(fieldLabels).map(([key, item]) => {
              const isFullWidth = key === 'explicacionCodigos' || key === 'classDescriptions';
              const isFirstOrMiddle = key === 'firstName' || key === 'middleName';
              const isClassDesc = key === 'classDescriptions';
              
              return (
                <div key={key} className={`group flex flex-col gap-1.5 ${isFullWidth ? 'md:col-span-2' : ''} ${key === 'assignedNumber' ? 'md:col-span-2 bg-red-50/30 p-4 rounded-2xl border border-red-100 mb-2' : ''} ${key === 'licenseLanguage' ? 'md:col-span-2 bg-indigo-50/30 p-4 rounded-2xl border border-indigo-100 mb-2' : ''} ${isClassDesc ? 'md:col-span-2 bg-emerald-50/30 p-4 rounded-2xl border border-emerald-200/80 mb-2' : ''} ${isFirstOrMiddle ? 'border-l-2 border-indigo-100 pl-4' : ''}`}>
                  <div className="flex items-center justify-between">
                    <div>
                      <label className={`text-[10px] font-black uppercase tracking-widest flex items-center gap-1.5 ${key === 'assignedNumber' ? 'text-red-600' : (key === 'licenseLanguage' ? 'text-indigo-600' : (key === 'classDescriptions' ? 'text-emerald-800' : (isFirstOrMiddle ? 'text-indigo-600' : 'text-slate-400')))}`}>
                        {key === 'assignedNumber' ? <Hash size={12} /> : (key === 'licenseLanguage' ? <Languages size={12} /> : (key === 'classDescriptions' ? <FileText size={12} /> : null))} {item.label}
                      </label>
                      {isClassDesc && (
                        <p className="text-[11px] text-emerald-700 font-medium mt-0.5">
                          Contiene únicamente las descripciones de las licencias permitidas que tiene el conductor.
                        </p>
                      )}
                    </div>
                    <button 
                      onClick={() => copy(item.tag)}
                      className="opacity-0 group-hover:opacity-100 text-[9px] font-bold text-indigo-500 hover:text-indigo-700 transition-all flex items-center gap-1 bg-white px-2 py-1 rounded-md shadow-xs border border-slate-200"
                      title="Copiar etiqueta"
                    >
                      <Copy size={10} /> {item.tag}
                    </button>
                  </div>
                  {isFullWidth ? (
                    <textarea
                      value={data[key as keyof ExtractedData] || ''}
                      onChange={(e) => handleInputChange(key, e.target.value)}
                      rows={isClassDesc ? Math.max(4, Math.min(10, ((data[key as keyof ExtractedData] || '').split('\n').filter(Boolean).length) + 1)) : 3}
                      className={`w-full px-4 py-3 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 outline-none transition-all font-medium resize-y ${
                        isClassDesc 
                          ? 'bg-white border border-emerald-300 text-slate-800 leading-relaxed font-sans shadow-xs' 
                          : 'bg-indigo-50/30 border border-indigo-100 font-semibold text-slate-700 placeholder:text-slate-300 resize-none'
                      }`}
                      placeholder={isClassDesc ? "Descriptions will appear here based on permitted classes (e.g. B, C1)..." : "No specific restrictions detected."}
                    />
                  ) : (
                    <input
                      type="text"
                      value={data[key as keyof ExtractedData] || ''}
                      onChange={(e) => handleInputChange(key, e.target.value)}
                      className={`w-full px-4 py-3 border rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 outline-none transition-all font-semibold placeholder:text-slate-300 ${key === 'assignedNumber' ? 'bg-white border-red-300 text-red-700 text-lg shadow-sm' : (key === 'licenseLanguage' ? 'bg-white border-indigo-300 text-indigo-700' : 'bg-slate-50 border-slate-200 text-slate-700')}`}
                      placeholder={key === 'assignedNumber' ? "Type the assigned number here (e.g. B1758)..." : (key === 'licenseLanguage' ? "Detected language..." : "Not detected")}
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
