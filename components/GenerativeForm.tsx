import React, { useState, useCallback, useRef } from 'react';
import { UIField } from '../types';
import { DynamicField } from './DynamicField';
import { DictationButton } from './DictationButton';

/**
 * @fileoverview Context Solicitation Engine.
 * 
 * ARCHITECTURE:
 * This component renders the "Missing Context" interface defined by the Gemini Model.
 * It aggregates:
 * 1. Structured Data (via AI-defined schema fields)
 * 2. Unstructured Data (User dictation via DictationButton)
 * 3. Multimodal Data (File attachments)
 * 
 * It serves as the primary data collection layer before the final inference pass.
 */

interface GenerativeFormProps {
  fields: UIField[];
  onSubmit: (data: Record<string, any>, files: File[], useTurbo?: boolean) => void;
}

/**
 * Visual micro-interaction component for empty file states.
 * Duplicated here to ensure visual parity with DynamicField without tight coupling.
 */
const FileIcons = () => (
  <div className="flex items-center -space-x-4">
    <div className="w-12 h-12 bg-white border border-slate-100 rounded-xl flex items-center justify-center text-slate-300 group-hover:text-violet-500 group-hover:scale-110 transition-all duration-500 shadow-sm transform -rotate-6">
      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
      </svg>
    </div>
    <div className="w-12 h-12 bg-slate-100 rounded-xl flex items-center justify-center text-slate-400 group-hover:text-white group-hover:bg-violet-500 group-hover:scale-110 transition-all duration-500 shadow-sm z-10 transform rotate-6">
      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
      </svg>
    </div>
  </div>
);

export const GenerativeForm: React.FC<GenerativeFormProps> = ({ fields, onSubmit }) => {
  const [formData, setFormData] = useState<Record<string, any>>({});
  const [fileData, setFileData] = useState<Record<string, File>>({});
  const [additionalText, setAdditionalText] = useState('');
  const [additionalFiles, setAdditionalFiles] = useState<File[]>([]);
  
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Update handler for Generative UI fields
  const handleChange = (id: string, value: any, file?: File) => {
    setFormData(prev => ({ ...prev, [id]: value }));
    if (file) {
      setFileData(prev => ({ ...prev, [id]: file }));
    }
  };
  
  // Handlers for Extra Details Drag & Drop
  const handleDrag = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setIsDragging(true);
    } else if (e.type === 'dragleave') {
      setIsDragging(false);
    }
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      setAdditionalFiles(prev => [...prev, ...Array.from(e.dataTransfer.files)]);
    }
  }, []);

  const handleManualFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    // CRITICAL FIX: Capture files immediately before state setter async execution.
    // If we access e.target.files inside the setter callback, the input value 
    // might have already been reset by the cleanup code below.
    if (e.target.files && e.target.files.length > 0) {
       const newFiles = Array.from(e.target.files);
       setAdditionalFiles(prev => [...prev, ...newFiles]);
    }
    // Reset input to allow selecting same file again if needed
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const removeAdditionalFile = (indexToRemove: number) => {
    setAdditionalFiles(prev => prev.filter((_, index) => index !== indexToRemove));
  };

  const handleSubmit = (e: React.FormEvent, useTurbo: boolean = false) => {
    e.preventDefault();
    const dynamicFiles = Object.values(fileData);
    const allFiles = [...dynamicFiles, ...additionalFiles];
    const finalData = { ...formData, additional_text: additionalText };
    onSubmit(finalData, allFiles, useTurbo);
  };

  const handleDictation = (text: string) => {
    setAdditionalText(prev => {
        if (prev.trim()) return prev + " " + text;
        return text;
    });
  };

  // Progress Psychology:
  // Visually tracking completion encourages users to provide all requested context.
  const completedCount = Object.keys(formData).filter(k => formData[k]).length;
  const progress = Math.round((completedCount / fields.length) * 100);

  return (
    <div className="bg-white p-6 sm:p-10 rounded-3xl border border-violet-100 ring-[16px] ring-violet-400/5 shadow-2xl w-full">
      <div className="mb-10">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6 mb-6">
          <div className="flex items-center gap-5">
            <div className="w-14 h-14 bg-violet-500 rounded-2xl flex items-center justify-center text-white shadow-lg shrink-0 transform -rotate-2">
              <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" /></svg>
            </div>
            <div>
              <h3 className="text-2xl font-black text-slate-900 tracking-tight leading-none">Context Assistant</h3>
              <p className="text-sm text-violet-500 mt-2 font-bold leading-snug">What would help me give a better answer is below.</p>
            </div>
          </div>
          <div className="flex flex-col items-end gap-1">
            <span className="text-[12px] font-black text-white bg-violet-500 px-3 py-1.5 rounded-xl whitespace-nowrap shadow-md">
              {progress}% COMPLETE
            </span>
          </div>
        </div>
        <div className="w-full bg-slate-100 h-2.5 rounded-full overflow-hidden shadow-inner">
          <div 
            className="h-full bg-gradient-to-r from-violet-400 to-violet-600 transition-all duration-1000 ease-out" 
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>
      
      {/* Dynamic Field Injection with Staggered Motion */}
      <div className="space-y-8">
        {fields.map((field, index) => (
          <DynamicField
            key={field.id}
            field={field}
            value={formData[field.id]}
            onChange={handleChange}
            index={index} // Pass index to trigger staggered animation delays
          />
        ))}
      </div>

      <div 
        className="mt-10 pt-8 border-t border-slate-100 animate-fadeIn"
        style={{ animationDelay: `${fields.length * 100 + 200}ms` }}
      >
        <h4 className="text-xs font-black text-slate-400 mb-4 tracking-widest uppercase">Extra details & files</h4>
        
        <div className="space-y-5">
            <div className="relative">
                <textarea
                    className="w-full p-5 border-2 border-slate-100 rounded-2xl focus:ring-[14px] focus:ring-violet-400/10 focus:border-violet-400 outline-none focus:outline-none transition-all bg-slate-50 focus:bg-white text-slate-800 shadow-sm min-h-[120px] font-medium text-lg placeholder:text-slate-300 pr-16"
                    placeholder="Any other files or notes for me..."
                    value={additionalText}
                    onChange={(e) => setAdditionalText(e.target.value)}
                />
                <div className="absolute top-4 right-4">
                    <DictationButton 
                        onTranscribe={handleDictation} 
                        className="w-10 h-10 rounded-xl bg-white" 
                        iconOnly={true}
                    />
                </div>
            </div>
            
            {/* Display Attached Files as Premium Cards */}
            {additionalFiles.length > 0 && (
                <div className="space-y-3">
                   {additionalFiles.map((file, idx) => (
                      <div key={idx} className="relative group border-2 border-violet-400 bg-violet-50/20 rounded-2xl p-2 sm:p-5 transition-all animate-scaleIn">
                         <div className="flex items-center justify-between w-full gap-4">
                            <div className="flex items-center gap-4 sm:gap-5 overflow-hidden">
                               <div className="w-12 h-12 sm:w-14 sm:h-14 bg-violet-500 rounded-2xl flex items-center justify-center text-white shadow-lg shrink-0">
                                  <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>
                               </div>
                               <div className="text-left overflow-hidden">
                                  <p className="text-base sm:text-lg font-black text-slate-900 truncate">{file.name}</p>
                                  <p className="text-[10px] sm:text-[12px] text-violet-600 font-black uppercase tracking-widest mt-0.5">Reference attached</p>
                               </div>
                            </div>
                            <button 
                               type="button"
                               onClick={() => removeAdditionalFile(idx)}
                               className="w-10 h-10 bg-white text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-full flex items-center justify-center shadow-sm border border-slate-200 transition-all shrink-0"
                               title="Remove file"
                            >
                               <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" /></svg>
                            </button>
                         </div>
                      </div>
                   ))}
                </div>
            )}

            {/* Unified Drag & Drop Zone */}
            <div 
                onDragEnter={handleDrag}
                onDragLeave={handleDrag}
                onDragOver={handleDrag}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
                className={`cursor-pointer relative group border-2 border-dashed rounded-2xl transition-all duration-500 overflow-hidden ${
                  isDragging 
                    ? 'border-violet-500 bg-violet-100 scale-[1.02] shadow-2xl z-20' 
                    : 'border-slate-200 bg-slate-50 hover:border-violet-400 hover:bg-violet-50/50'
                }`}
            >
                {/* Moved input outside of UI logic for clarity, though hidden input placement doesn't affect flow */}
                <input 
                    ref={fileInputRef} 
                    type="file" 
                    multiple 
                    className="hidden" 
                    onChange={handleManualFileSelect} 
                />
                
                <div className="p-8 flex flex-col items-center justify-center text-center transform transition-all group-hover:scale-[1.01]">
                    <div className="flex flex-col items-center gap-4">
                        <div className="flex items-center gap-6">
                            <FileIcons />
                            <div className="text-left">
                                <p className="text-lg font-black text-slate-900 group-hover:text-violet-600 transition-colors">
                                    {isDragging ? 'Drop them here!' : 'Attach further documents or images'}
                                </p>
                                <p className="text-[12px] text-slate-400 font-bold uppercase tracking-widest mt-0.5">Drag & Drop or Click</p>
                            </div>
                        </div>
                        {isDragging && (
                             <div className="animate-pulse flex items-center gap-2 text-violet-600 font-black text-xs uppercase tracking-widest">
                                <span className="w-2 h-2 rounded-full bg-violet-600"></span>
                                Ready to receive
                             </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
      </div>

      {/* 
        Dual-Mode Submission Strategy:
        1. "Fast & Cheap": Uses Gemini Flash (Medium Thinking) for quick validation.
        2. "Most Intelligent": Uses Gemini Pro (High Thinking) for deep reasoning tasks.
      */}
      <div 
        className="mt-10 grid grid-cols-1 md:grid-cols-2 gap-5 animate-fadeIn"
        style={{ animationDelay: `${fields.length * 100 + 400}ms` }}
      >
        <button
          type="button"
          onClick={(e) => handleSubmit(e, false)}
          className="w-full bg-lime-400 hover:bg-lime-500 text-slate-900 px-8 py-5 rounded-[1.5rem] font-black transition-all flex items-center justify-center gap-3 text-base active:scale-95 shadow-lg tracking-tight"
        >
          <span>Fast & Cheap answer ⚡</span>
        </button>
        
        <button
          type="button"
          onClick={(e) => handleSubmit(e, true)}
          className="w-full bg-violet-600 hover:bg-violet-700 text-white px-8 py-5 rounded-[1.5rem] font-black transition-all flex items-center justify-center gap-3 shadow-xl text-base active:scale-95 group tracking-tight"
        >
          <span>Most intelligent answer 🧠</span>
        </button>
      </div>
    </div>
  );
};