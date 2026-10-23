
import React from 'react';
import { ExtractedData } from '../types';
import { Info, Copy, Hash, FileText, Sparkles } from 'lucide-react';
import { motion } from 'motion/react';
import { buildClassDescriptions } from '../services/classDescriptions';

interface DataPreviewProps {
  data: ExtractedData;
  onChange: (newData: ExtractedData) => void;
}

const DataPreview: React.FC<DataPreviewProps> = ({ data, onChange }) => {
  const handleInputChange = (key: string, value: string) => {
    if (key === 'class') {
      // Auto-update classDescriptions if currently empty or matching previous derived value
      const previousDerived = buildClassDescriptions(data.class);
      const shouldAutoSync = !data.classDescriptions || data.classDescriptions === previousDerived;
      const newDesc = shouldAutoSync ? buildClassDescriptions(value) : data.classDescriptions;
      onChange({ ...data, class: value, classDescriptions: newDesc });
    } else {
      onChange({ ...data, [key]: value || "" });
    }
  };

  const handleRegenerateClassDesc = () => {
    const generated = buildClassDescriptions(data.class);
    onChange({ ...data, classDescriptions: generated });
  };

  const copy = (txt: string) => navigator.clipboard.writeText(txt);

  const fieldLabels: Record<string, { label: string, tag: string }> = {
    assignedNumber: { label: "Assigned Number (Filename)", tag: "{{assignedNumber}}" },
    reference: { label: "4d: Reference Number", tag: "{{reference}}" },
    surname: { label: "1: Surname", tag: "{{surname}}" },
    firstName: { label: "2: First Name", tag: "{{firstName}}" },
    middleName: { label: "2: Middle Name", tag: "{{middleName}}" },
    licenseNumber: { label: "5: License Number", tag: "{{licenseNumber}}" },
    dateOfBirth: { label: "3: Date of Birth", tag: "{{dateOfBirth}}" },
    placeOfBirth: { label: "3: Place of Birth", tag: "{{placeOfBirth}}" },
    issueDate: { label: "4a: Issue Date", tag: "{{issueDate}}" },
    authority: { label: "4c: Authority", tag: "{{authority}}" },
    categoriesDates: { label: "10: Category Dates", tag: "{{categoriesDates}}" },
    codes: { label: "Series (Top Left)", tag: "{{codes}}" },
    class: { label: "9: Categories", tag: "{{class}}" },
    classDescriptions: { label: "Authorized Class Descriptions", tag: "{{classDescriptions}}" },
    explicacionCodigos: { label: "Restrictions & Conditions", tag: "{{explicacionCodigos}}" },
    code106From: { label: "106: From Date", tag: "{{code106From}}" },
    code106To: { label: "106: To Date", tag: "{{code106To}}" },
    expiryDate: { label: "4b: Expiry Date", tag: "{{expiryDate}}" },
  };

  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-6"
    >
      <div className="bg-white border border-slate-250 rounded-[2rem] overflow-hidden shadow-xl shadow-slate-200/50">
        <div className="px-8 py-6 border-b border-slate-100 bg-slate-50/50 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <h3 className="text-lg font-black text-slate-900 leading-tight">Review Extraction</h3>
            <p className="text-xs text-slate-500 font-medium">Manually verify and edit detected information.</p>
          </div>
          <div className="flex items-center gap-2 text-[10px] font-black text-indigo-600 bg-indigo-50 px-4 py-2 rounded-full border border-indigo-100 uppercase tracking-widest">
            <Info size={14} /> Verification Required
          </div>
        </div>
        <div className="p-8">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-x-10 gap-y-6">
            {Object.entries(fieldLabels).map(([key, item]) => {
              const isFullWidth = key === 'explicacionCodigos' || key === 'classDescriptions';
              const isAssignedNum = key === 'assignedNumber';
              const isReference = key === 'reference';
              const isClassDesc = key === 'classDescriptions';
              
              return (
                <div 
                  key={key} 
                  className={`group flex flex-col gap-2 transition-all ${isFullWidth ? 'md:col-span-2' : ''} ${isAssignedNum ? 'md:col-span-2 bg-indigo-600/5 p-6 rounded-3xl border border-indigo-100 mb-2' : ''}`}
                >
                  <div className="flex items-center justify-between px-1">
                    <label className={`text-[10px] font-black uppercase tracking-[0.2em] flex items-center gap-2 ${isAssignedNum ? 'text-indigo-600' : 'text-slate-400'}`}>
                      {isAssignedNum ? <Hash size={14} /> : (isReference ? <FileText size={14} /> : null)} {item.label}
                    </label>
                    <div className="flex items-center gap-2">
                      {isClassDesc && (
                        <button
                          type="button"
                          onClick={handleRegenerateClassDesc}
                          className="text-[10px] font-bold text-indigo-600 hover:text-indigo-800 transition-all flex items-center gap-1 bg-indigo-50 hover:bg-indigo-100 px-2.5 py-1 rounded-md"
                          title="Generate descriptions from category list in Point 9"
                        >
                          <Sparkles size={11} /> Auto-fill from categories
                        </button>
                      )}
                      <button 
                        onClick={() => copy(item.tag)}
                        className="opacity-0 group-hover:opacity-100 text-[10px] font-bold text-indigo-500 hover:text-indigo-700 transition-all flex items-center gap-1.5 bg-indigo-50 px-2 py-0.5 rounded-md"
                      >
                        <Copy size={12} /> {item.tag}
                      </button>
                    </div>
                  </div>
                  {isFullWidth ? (
                    <textarea
                      value={data[key as keyof ExtractedData] || ''}
                      onChange={(e) => handleInputChange(key, e.target.value)}
                      rows={isClassDesc ? 6 : 4}
                      className="w-full px-5 py-4 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-semibold text-slate-800 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all resize-none shadow-sm font-mono text-xs leading-relaxed"
                      placeholder={isClassDesc ? "AM - 2-wheel, 3-wheel vehicles...\nB - passenger vehicles..." : "Enter specific restrictions..."}
                    />
                  ) : (
                    <input
                      type="text"
                      value={data[key as keyof ExtractedData] || ''}
                      onChange={(e) => handleInputChange(key, e.target.value)}
                      className={`w-full px-5 py-4 border rounded-2xl text-sm font-bold transition-all outline-none shadow-sm
                        ${isAssignedNum 
                          ? 'bg-white border-indigo-200 text-indigo-700 text-xl focus:ring-indigo-500' 
                          : 'bg-white border-slate-200 text-slate-800 focus:ring-indigo-500 focus:border-indigo-500'}`}
                      placeholder={isAssignedNum ? "Assign a business reference..." : "Not detected"}
                    />
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </motion.div>
  );
};

export default DataPreview;
