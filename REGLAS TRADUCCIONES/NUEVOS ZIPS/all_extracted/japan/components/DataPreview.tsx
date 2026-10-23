
import React from 'react';
import { ExtractedData } from '../types';
import { Info, Copy, CheckCircle2 } from 'lucide-react';
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

  const fieldLabels: Record<string, { label: string, tag: string }> = {
    surname: { label: "1: Last Name", tag: "{{surname}}" },
    firstNames: { label: "2: First Names", tag: "{{firstNames}}" },
    licenseNumber: { label: "License Number", tag: "{{licenseNumber}}" },
    assignedNumber: { label: "Assigned Document Number", tag: "{{assignedNumber}}" },
    dateOfBirth: { label: "3: Date of Birth", tag: "{{dateOfBirth}}" },
    placeOfBirth: { label: "3: Place of Birth", tag: "{{placeOfBirth}}" },
    issueDate: { label: "4a: Issue Date", tag: "{{issueDate}}" },
    authority: { label: "4c: Issuing Authority", tag: "{{authority}}" },
    categoriesDates: { label: "10: Category Dates", tag: "{{categoriesDates}}" },
    codes: { label: "Conditions applying to licence", tag: "{{codes}}" },
    expiryDate: { label: "4b: Expiry Date", tag: "{{expiryDate}}" },
    class: { label: "9: Class/Category", tag: "{{class}}" },
  };

  const isMultiLine = (key: string) => key === 'codes' || key === 'categoriesDates' || key === 'address';

  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-6"
    >
      <div className="bg-white border border-slate-200 rounded-[2rem] overflow-hidden shadow-xl shadow-slate-200/50">
        <div className="px-8 py-6 border-b border-slate-100 bg-slate-50/50 flex items-center justify-between">
          <div>
            <h3 className="text-lg font-black text-slate-900 tracking-tight">Review Extraction</h3>
            <p className="text-[11px] font-medium text-slate-500 mt-1 uppercase tracking-wider">Please verify all fields before generating the document</p>
          </div>
          <div className="flex items-center gap-2 text-[10px] font-black text-indigo-600 bg-white px-3 py-1.5 rounded-full border border-indigo-100 shadow-sm">
            <CheckCircle2 size={12} /> SYSTEM READY
          </div>
        </div>
        
        <div className="p-8">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-x-10 gap-y-6">
            {Object.entries(fieldLabels).map(([key, item]) => (
              <div key={key} className="group flex flex-col gap-2">
                <div className="flex items-center justify-between px-1">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.15em]">
                    {item.label}
                  </label>
                  <button 
                    onClick={() => copy(item.tag)}
                    className="opacity-0 group-hover:opacity-100 text-[10px] font-bold text-indigo-500 hover:text-indigo-700 transition-all flex items-center gap-1.5 py-0.5 px-2 bg-indigo-50 rounded-md"
                    title="Copy tag for Word template"
                  >
                    <Copy size={10} /> {item.tag}
                  </button>
                </div>
                <div className="relative">
                  {isMultiLine(key) ? (
                    <textarea
                      rows={3}
                      value={data[key as keyof ExtractedData] || ''}
                      onChange={(e) => handleInputChange(key, e.target.value)}
                      className="w-full px-5 py-3.5 bg-slate-50 border border-slate-200 rounded-2xl text-[13px] font-bold text-slate-700 focus:bg-white focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 outline-none transition-all placeholder:text-slate-300 placeholder:font-medium resize-y"
                      placeholder="Not detected"
                    />
                  ) : (
                    <input
                      type="text"
                      value={data[key as keyof ExtractedData] || ''}
                      onChange={(e) => handleInputChange(key, e.target.value)}
                      className="w-full px-5 py-3.5 bg-slate-50 border border-slate-200 rounded-2xl text-[13px] font-bold text-slate-700 focus:bg-white focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 outline-none transition-all placeholder:text-slate-300 placeholder:font-medium"
                      placeholder="Not detected"
                    />
                  )}
                  {data[key as keyof ExtractedData] && (
                    <div className="absolute right-4 top-4 text-emerald-500">
                      <CheckCircle2 size={16} />
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>

          <div className="mt-10 p-4 bg-indigo-50/50 rounded-2xl border border-indigo-100/50 flex items-start gap-4">
            <div className="p-2 bg-white rounded-xl border border-indigo-100 text-indigo-500 shrink-0">
              <Info size={18} />
            </div>
            <div className="space-y-1">
              <h4 className="text-xs font-black text-indigo-900 uppercase tracking-wider">Template Tags</h4>
              <p className="text-[11px] text-indigo-700 font-medium leading-relaxed">
                Use the tags (like <code className="bg-indigo-100 px-1 rounded">{"{{surname}}"}</code>) in your .docx template. 
                Images should use <code className="bg-indigo-100 px-1 rounded">{"{%front_image}"}</code> and <code className="bg-indigo-100 px-1 rounded">{"{%back_image}"}</code>.
              </p>
            </div>
          </div>
        </div>
      </div>
    </motion.div>
  );
};

export default DataPreview;
