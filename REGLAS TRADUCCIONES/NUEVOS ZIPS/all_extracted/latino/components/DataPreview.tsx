
import React from 'react';
import { ExtractedData } from '../types';
import { Info, Copy, Hash, CheckSquare, Zap } from 'lucide-react';
import { motion } from 'motion/react';

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
  };

  const fieldLabels: Record<string, { label: string, tag: string, description?: string }> = {
    assignedNumber: { label: "Assigned File ID", tag: "{{assignedNumber}}", description: "This will be the saved file name" },
    surname: { label: "Family Name", tag: "{{surname}}" },
    firstName: { label: "First Name", tag: "{{firstName}}" },
    middleName: { label: "Middle Name(s)", tag: "{{middleName}}" },
    fullName: { label: "Full Name", tag: "{{fullName}}" },
    gender: { label: "Gender (Male / Female / -)", tag: "{{gender}}", description: "Male / Female or '-' if not specified" },
    nationality: { label: "Nationality (in English)", tag: "{{nationality}}", description: "Leave empty to remove if not in license" },
    organs: { label: "Organ Donor (Yes / No)", tag: "{{organs}}", description: "Yes / No or leave empty to remove" },
    address: { label: "Address / Domicilio", tag: "{{address}}", description: "Address or leave empty to remove" },
    licenseNumber: { label: "License Number / Folio", tag: "{{licenseNumber}}" },
    dateOfBirth: { label: "Date of Birth", tag: "{{dateOfBirth}}" },
    placeOfBirth: { label: "Place of Birth", tag: "{{placeOfBirth}}" },
    issueDate: { label: "Issue Date", tag: "{{issueDate}}" },
    expiryDate: { label: "Expiry Date / Vigencia", tag: "{{expiryDate}}" },
    authority: { label: "Issuing Authority + Country", tag: "{{authority}}" },
    class: { label: "License Category / Class", tag: "{{class}}" },
    curp: { label: "National ID (CURP/RFC/DNI/RUT)", tag: "{{curp}}" },
    blood: { label: "Blood Type", tag: "{{blood}}" },
    barcode: { label: "Alpha-Numeric / Barcode", tag: "{{barcode}}" },
    codes: { label: "Restrictions / Codes", tag: "{{codes}}" },
    categoriesDates: { label: "Category Validity Dates", tag: "{{categoriesDates}}" },
    explicacionCodigos: { label: "Translation of Categories & Codes (Reglas Latino)", tag: "{{explicacion}}", description: "Technical translation of license classes and restrictions" },
  };

  return (
    <div className="space-y-6">
      <div className="bg-white border border-slate-200 rounded-[2.5rem] overflow-hidden shadow-2xl">
        <div className="px-8 py-6 border-b border-slate-100 bg-slate-50 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="bg-indigo-600 p-2 rounded-xl text-white shadow-lg"><CheckSquare size={20} /></div>
            <div>
              <h3 className="font-black text-slate-900 text-lg tracking-tight">Review Extracted Intelligence</h3>
              <p className="text-[11px] text-slate-500 font-medium italic">Validate the translation and mapping before document rendering.</p>
            </div>
          </div>
          <div className="flex items-center gap-2 text-[10px] font-black tracking-widest text-indigo-600 bg-indigo-50 px-4 py-2 rounded-full border border-indigo-100">
            <Info size={12} fill="currentColor" /> EDITABLE PREVIEW
          </div>
        </div>
        
        <div className="p-8">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-x-10 gap-y-6">
            {Object.entries(fieldLabels).map(([key, item]) => {
              const isFullWidth = key === 'explicacionCodigos' || key === 'assignedNumber';
              const isAssignedNum = key === 'assignedNumber';
              
              return (
                <motion.div 
                  initial={{ opacity: 0, y: 10 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  key={key} 
                  className={`group flex flex-col gap-1.5 ${isFullWidth ? 'md:col-span-2' : ''} ${isAssignedNum ? 'bg-indigo-50/50 p-6 rounded-3xl border border-indigo-100 mb-4' : ''}`}
                >
                  <div className="flex items-center justify-between px-1">
                    <div className="flex flex-col">
                      <label className={`text-[10px] font-black uppercase tracking-widest flex items-center gap-1.5 ${isAssignedNum ? 'text-indigo-600' : 'text-slate-400'}`}>
                        {isAssignedNum && <Hash size={12} />} {item.label}
                      </label>
                      {item.description && <p className="text-[9px] text-slate-400 font-medium italic">{item.description}</p>}
                    </div>
                    <button 
                      onClick={() => copy(item.tag)}
                      title={`Copy ${item.tag}`}
                      className="opacity-0 group-hover:opacity-100 p-1.5 bg-slate-100 rounded-lg text-slate-500 hover:text-indigo-600 hover:bg-indigo-50 transition-all border border-transparent hover:border-indigo-200"
                    >
                      <Copy size={12} />
                    </button>
                  </div>
                  
                  {key === 'explicacionCodigos' ? (
                    <textarea
                      value={data[key as keyof ExtractedData] || ''}
                      onChange={(e) => handleInputChange(key, e.target.value)}
                      rows={5}
                      className="w-full px-5 py-4 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-semibold text-slate-700 focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-400 outline-none transition-all resize-none leading-relaxed"
                      placeholder="Enter detailed translations here..."
                    />
                  ) : (
                    <div className="relative">
                      <input
                        type="text"
                        value={data[key as keyof ExtractedData] || ''}
                        onChange={(e) => handleInputChange(key, e.target.value)}
                        className={`w-full px-5 py-4 border rounded-2xl text-sm font-bold outline-none transition-all ${
                          isAssignedNum 
                            ? 'bg-white border-indigo-300 text-indigo-700 text-xl shadow-lg shadow-indigo-500/5 focus:ring-indigo-500' 
                            : 'bg-slate-50 border-slate-200 text-slate-800 focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-400'
                        }`}
                      />
                      <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none opacity-20">
                         <span className="text-[10px] font-mono font-black">{item.tag}</span>
                      </div>
                    </div>
                  )}
                </motion.div>
              );
            })}
          </div>
        </div>
        
        <div className="px-8 py-6 bg-slate-50 border-t border-slate-100 flex items-center gap-3">
           <Zap className="text-indigo-600 w-4 h-4" fill="currentColor" />
           <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Powered by Gemini 3 Flash Cognitive Extraction Engine</p>
        </div>
      </div>
    </div>
  );
};

export default DataPreview;
