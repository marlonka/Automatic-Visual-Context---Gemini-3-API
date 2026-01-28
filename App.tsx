import React, { useState, useRef, useEffect, useCallback } from 'react';
import ReactMarkdown from 'react-markdown';
import { sendMessageToGemini } from './services/geminiService';
import { ChatMessage, AIResponse } from './types';
import { GenerativeForm } from './components/GenerativeForm';
import { AnalysisReport } from './components/AnalysisReport';
import { FinalOutput } from './components/FinalOutput';
import { DictationButton } from './components/DictationButton';

/**
 * Utility: File-to-Base64 buffer conversion.
 * Essential for transferring multimodal payloads over the Gemini API.
 */
const fileToBase64 = (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => {
      const result = reader.result as string;
      const base64 = result.split(',')[1];
      resolve(base64);
    };
    reader.onerror = error => reject(error);
  });
};

/**
 * CUSTOM SCROLL ENGINE: Physics-based scroll smoother.
 * 
 * Replaces standard behavior with a Cubic-Bezier powered scroll loop.
 * This provides a "heavy", premium feel when new content arrives, 
 * matching the high-end aesthetic of the rest of the application.
 */
const scrollToBottomSmoothly = (container: HTMLElement) => {
    const targetScrollTop = container.scrollHeight - container.clientHeight;
    const startScrollTop = container.scrollTop;
    const distance = targetScrollTop - startScrollTop;
    
    // If distance is negligible, don't animate
    if (Math.abs(distance) < 5) return;
    
    // Duration is slightly longer to allow for a luxurious "settling" feel
    const duration = 1200; 
    const startTime = performance.now();
    
    // Ease Out Quart: 1 - (1 - t)^4
    // Starts fast, then slows down significantly at the end.
    const easeOutQuart = (x: number): number => {
      return 1 - Math.pow(1 - x, 4);
    }

    const step = (currentTime: number) => {
      const elapsed = currentTime - startTime;
      const progress = Math.min(elapsed / duration, 1);
      const ease = easeOutQuart(progress);
      
      container.scrollTop = startScrollTop + (distance * ease);
      
      if (progress < 1) {
        requestAnimationFrame(step);
      }
    };
    
    requestAnimationFrame(step);
}

/**
 * Component: Visual indicator for files pending upload.
 */
const StagedFilePreview = ({ file, onRemove }: { file: File, onRemove: () => void }) => {
  const [preview, setPreview] = useState<string | null>(null);

  useEffect(() => {
    if (file.type.startsWith('image/')) {
      const url = URL.createObjectURL(file);
      setPreview(url);
      return () => URL.revokeObjectURL(url);
    }
  }, [file]);

  return (
    <div className="relative group animate-scaleIn">
      <div className="w-20 h-20 relative overflow-hidden rounded-2xl border border-slate-200 shadow-sm transition-all bg-white flex flex-col items-center justify-center p-1">
        {preview ? (
          <>
            <img src={preview} alt="Preview" className="absolute inset-0 w-full h-full object-cover" />
            <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors" />
          </>
        ) : (
          <>
             <div className="w-8 h-8 bg-violet-50 rounded-lg flex items-center justify-center text-violet-600 shrink-0 mb-1">
               <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
             </div>
             <div className="flex flex-col items-center w-full px-1">
               <span className="text-[9px] font-black text-slate-900 truncate w-full text-center">{file.name}</span>
               <span className="text-[7px] font-bold text-slate-400 uppercase tracking-wider">{file.name.split('.').pop()?.slice(0, 4)}</span>
             </div>
          </>
        )}
      </div>
      
      <button 
        onClick={onRemove}
        className="absolute -top-2 -right-2 w-6 h-6 bg-white text-slate-400 hover:text-red-500 rounded-full shadow-md border border-slate-100 flex items-center justify-center transition-all hover:scale-110 z-10"
      >
        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" /></svg>
      </button>
    </div>
  );
};

/**
 * Main Application Orchestrator.
 * Implements a "Thinking-First" UI that prioritizes contextual completeness 
 * before committing to model-intensive final outputs.
 */
function App() {
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: 'init',
      role: 'ai',
      content: "What's your goal? Describe what you're working on or a problem you're facing, and I'll help you give me the right context for better AI answers."
    }
  ]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [loadingStep, setLoadingStep] = useState('Thinking...');
  const [aiHistory, setAiHistory] = useState<any[]>([]);
  const [stagedFiles, setStagedFiles] = useState<File[]>([]);
  const [isGlobalDragging, setIsGlobalDragging] = useState(false);
  
  // Container ref for manual scroll manipulation
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Auto-scroll logic utilizing the custom physics engine
  useEffect(() => {
    if (scrollContainerRef.current) {
      // Small timeout ensures the DOM has fully painted the new content's height
      // before we calculate the scroll target.
      setTimeout(() => {
        scrollToBottomSmoothly(scrollContainerRef.current!);
      }, 100);
    }
  }, [messages.length, isLoading]);

  const resetChat = useCallback(() => {
    setMessages([
      {
        id: 'init',
        role: 'ai',
        content: "What's your goal? Describe what you're working on or a problem you're facing, and I'll help you give me the right context for better AI answers."
      }
    ]);
    setInput('');
    setIsLoading(false);
    setLoadingStep('Thinking...');
    setAiHistory([]);
    setStagedFiles([]);
    if (fileInputRef.current) {
        fileInputRef.current.value = '';
    }
  }, []);

  // Global Drag and Drop handlers for advanced multimodal UX.
  const handleGlobalDrag = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setIsGlobalDragging(true);
    } else if (e.type === 'dragleave' || e.type === 'drop') {
      setIsGlobalDragging(false);
    }
  }, []);

  const handleGlobalDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsGlobalDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const newFiles = Array.from(e.dataTransfer.files);
      setStagedFiles(prev => [...prev, ...Array.from(newFiles)]);
    }
  }, []);

  const removeStagedFile = (index: number) => {
    setStagedFiles(prev => prev.filter((_, i) => i !== index));
  };

  /**
   * Primary Communication Pipeline.
   * Logic flow: 
   * 1. Pre-process multimodal files (Base64).
   * 2. Commit User Message to local state.
   * 3. Invoke Gemini Inference with Tool Grounding.
   * 4. Parse JSON controller output and update UI state machine.
   */
  const handleSend = async (
    text: string, 
    files: File[] = [], 
    modelName: string = "gemini-3-flash-preview",
    loadingOverride?: string
  ) => {
    const allFiles = [...files, ...stagedFiles];
    if (!text.trim() && allFiles.length === 0) return;

    const isFirstStep = messages.length <= 1;
    const defaultLoadingText = isFirstStep ? "Generating visual interface..." : "Let me think about it...";
    const currentLoadingText = loadingOverride || defaultLoadingText;

    const processedFiles = await Promise.all(allFiles.map(async (f) => ({
      mimeType: f.type,
      data: await fileToBase64(f)
    })));

    const newUserMsg: ChatMessage = {
      id: Date.now().toString(),
      role: 'user',
      content: text,
      formData: allFiles.length > 0 ? { 'Attachments': allFiles.map(f => f.name).join(', ') } : undefined,
      attachments: processedFiles
    };
    
    setMessages(prev => [...prev, newUserMsg]);
    setInput('');
    setStagedFiles([]);
    setIsLoading(true);
    setLoadingStep('Reviewing context...');

    try {
      setLoadingStep(currentLoadingText);
      const aiResponse = await sendMessageToGemini(aiHistory, {
        text: text,
        files: processedFiles
      }, modelName);

      // HISTORY MANAGEMENT: Keeping the session context aware of both multimodal and text parts.
      const userTurn = {
        role: "user",
        parts: [{ text: text }, ...processedFiles.map(f => ({ inlineData: f }))]
      };
      
      const modelTurn = {
        role: "model",
        parts: [{ text: JSON.stringify(aiResponse) }] 
      };

      setAiHistory(prev => [...prev, userTurn, modelTurn]);

      const newAiMsg: ChatMessage = {
        id: (Date.now() + 1).toString(),
        role: 'ai',
        content: aiResponse.message,
        uiFields: aiResponse.status === 'COLLECTING' ? aiResponse.fields : undefined,
        analysis: aiResponse.status === 'COMPLETE' ? aiResponse.analysis : undefined,
        final_output: aiResponse.status === 'COMPLETE' ? aiResponse.final_output : undefined,
        groundingLinks: aiResponse.grounding_links
      };

      setMessages(prev => [...prev, newAiMsg]);

    } catch (error) {
      console.error(error);
      setMessages(prev => [...prev, {
        id: Date.now().toString(),
        role: 'ai',
        content: "I ran into a small issue. Could you try re-stating your goal?"
      }]);
    } finally {
      setIsLoading(false);
      setLoadingStep('Thinking...');
    }
  };

  /**
   * Handle contextual data submission from Generative UI forms.
   */
  const handleFormSubmit = (data: Record<string, any>, files: File[], useTurbo: boolean = false) => {
    const summaryParts = [];
    if (files.length > 0) summaryParts.push(`${files.length} attachment(s)`);
    if (data['additional_text']) summaryParts.push("additional details");
    
    const summary = `Here is the user provided context${summaryParts.length > 0 ? ` (${summaryParts.join(', ')})` : ''}:`;
      
    const dataString = Object.entries(data)
      .filter(([key]) => key !== 'additional_text')
      .map(([key, val]) => `${key}: ${val}`)
      .join('\n');
      
    const finalMessage = `${summary}\n\n${data['additional_text'] ? `Extra info: ${data['additional_text']}\n` : ''}\nDetails:\n${dataString}`;

    // MODEL STRATEGY: Pro is used for "Intelligence" (Turbo) mode to leverage higher reasoning density.
    const model = useTurbo ? "gemini-3-pro-preview" : "gemini-3-flash-preview";
    handleSend(finalMessage, files, model, "Thinking and Analyzing...");
  };

  const handleDictationResult = (text: string) => {
      setInput(prev => {
          if (prev.trim()) return prev + " " + text;
          return text;
      });
  };

  const inputPlaceholder = messages.length > 1 
    ? "How can I help you further?" 
    : "What's your goal or problem?";

  return (
    <div 
      className="min-h-screen flex flex-col bg-[#fafafa] text-slate-900 selection:bg-lime-300 selection:text-slate-900 overflow-hidden relative"
      onDragEnter={handleGlobalDrag}
      onDragOver={handleGlobalDrag}
      onDragLeave={handleGlobalDrag}
      onDrop={handleGlobalDrop}
    >
      {/* GLOBAL DRAG OVERLAY: Part of the "Natural Interface" philosophy */}
      {isGlobalDragging && (
        <div className="fixed inset-0 z-[100] bg-violet-600/40 backdrop-blur-md flex items-center justify-center pointer-events-none">
          <div className="bg-white p-12 rounded-[3rem] shadow-2xl border-4 border-dashed border-violet-400 flex flex-col items-center gap-8 animate-scaleIn">
            <div className="w-24 h-24 bg-violet-500 rounded-3xl flex items-center justify-center text-white shadow-xl animate-bounce">
              <svg className="w-12 h-12" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" /></svg>
            </div>
            <div className="text-center">
              <h2 className="text-4xl font-black text-slate-900 tracking-tight">Drop files anywhere</h2>
              <p className="text-xl text-violet-500 font-bold mt-2">Add them to your request</p>
            </div>
          </div>
        </div>
      )}

      {/* HEADER: World-class layout with responsive behavior */}
      <header className="bg-white/80 backdrop-blur-md border-b border-slate-100 sticky top-0 z-50 py-4 px-6 lg:px-12 transition-all">
        {/* 
            Layout Strategy:
            Mobile: Flex Space-Between (Title Left, Button Right)
            Desktop: Grid (3 Cols) - Spacer Left, Title Center, Button Right 
            This ensures center alignment on large screens without breaking small screen usability.
        */}
        <div className="max-w-7xl mx-auto flex items-center justify-between sm:grid sm:grid-cols-3 sm:gap-4 relative">
          
          {/* Left Spacer (Desktop only) */}
          <div className="hidden sm:block"></div>

          {/* Title Group: Centered on Desktop, Left on Mobile */}
          <div className="flex flex-col sm:flex-row items-start sm:items-baseline sm:justify-center gap-0.5 sm:gap-4 text-left sm:text-center whitespace-nowrap">
            <h1 className="text-lg sm:text-2xl font-extrabold tracking-tighter text-[#1a1a1a] leading-tight">
              Automatic Visual Context
            </h1>
            <p className="text-[10px] sm:text-sm font-bold text-slate-400 tracking-wide uppercase sm:normal-case sm:font-medium sm:tracking-normal">
              Helping you get better AI results easily
            </p>
          </div>
          
          {/* Action Button: Always Right aligned */}
          <div className="flex justify-end shrink-0 ml-4 sm:ml-0">
            <button 
              onClick={resetChat}
              className="group flex items-center gap-2 bg-lime-400 hover:bg-lime-500 text-slate-900 px-4 py-2 sm:px-5 sm:py-2.5 rounded-2xl text-[10px] sm:text-xs font-black uppercase tracking-widest shadow-premium hover:shadow-lg active:scale-95 transition-all duration-300 border border-lime-400/50"
            >
              <svg className="w-3.5 h-3.5 transition-transform duration-500 group-hover:rotate-180" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M12 4v16m8-8H4" />
              </svg>
              <span className="whitespace-nowrap">New Chat</span>
            </button>
          </div>
        </div>
      </header>

      <main className="flex-1 w-full mx-auto relative overflow-hidden flex flex-col">
        {/* 
            SCROLL CONTAINER:
            The ref attached here allows us to manually control the scrollTop property 
            using our custom physics engine in the useEffect hook.
        */}
        <div 
          ref={scrollContainerRef}
          className="flex-1 overflow-y-auto pt-10 px-6 lg:px-12 space-y-8 pb-96 scroll-smooth"
        >
          <div className="max-w-4xl mx-auto w-full space-y-12">
            {messages.map((msg, index) => {
              const isLast = index === messages.length - 1;
              return (
              <div 
                key={msg.id} 
                className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'} animate-fadeIn`}
              >
                <div className={`w-full transition-all duration-500 ${
                  msg.role === 'user' 
                    ? 'max-w-2xl bg-[#111] text-white shadow-premium-xl border-l-8 border-lime-400 rounded-2xl' 
                    : 'bg-white border border-violet-100 text-slate-800 ring-[10px] ring-violet-400/5 shadow-sm rounded-2xl'
                } px-6 py-6 sm:px-8 sm:py-8`}>
                  
                  {msg.content && (
                    <div className={`prose prose-slate max-w-none text-inherit leading-relaxed text-lg sm:text-xl font-medium tracking-tight ${msg.role === 'user' ? 'prose-invert' : ''}`}>
                      <ReactMarkdown>{msg.content}</ReactMarkdown>
                    </div>
                  )}

                  {/* Multimodal Asset Rendering */}
                  {msg.role === 'user' && msg.attachments && msg.attachments.length > 0 && (
                    <div className="mt-6 flex flex-wrap gap-3">
                      {msg.attachments.map((att, i) => (
                        att.mimeType.startsWith('image/') ? (
                          <div key={i} className="relative rounded-xl overflow-hidden border-2 border-white/20 shadow-lg group">
                             <img 
                               src={`data:${att.mimeType};base64,${att.data}`}
                               alt="Multimodal context"
                               className="max-h-64 max-w-full object-cover transition-transform group-hover:scale-105"
                             />
                          </div>
                        ) : (
                          <div key={i} className="flex items-center gap-3 bg-white/10 border border-white/20 px-4 py-3 rounded-xl hover:bg-white/20 transition-colors">
                            <div className="w-10 h-10 bg-white/20 rounded-lg flex items-center justify-center text-white/90">
                              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
                            </div>
                            <div className="flex flex-col">
                              <span className="text-xs font-bold text-white/90">Asset {i + 1}</span>
                              <span className="text-[10px] text-white/60 uppercase font-bold tracking-widest">{att.mimeType.split('/')[1] || 'FILE'}</span>
                            </div>
                          </div>
                        )
                      ))}
                    </div>
                  )}
                  
                  {msg.role === 'ai' && (
                    <div className="space-y-8 mt-6">
                      {/* LLM-CONTROLLED GENERATIVE UI: Dynamically rendered based on inference requirements */}
                      {msg.uiFields && isLast && (
                        <div className="animate-slideUp border-t border-violet-50 pt-6">
                           <GenerativeForm fields={msg.uiFields} onSubmit={handleFormSubmit} />
                        </div>
                      )}

                      {/* REASONING TRACE: Exposes the internal logic of the model (Gemini 3 Thinking) */}
                      {msg.analysis && (
                        <div className="border-t border-violet-50 pt-6 animate-fadeIn">
                          <AnalysisReport content={msg.analysis} />
                        </div>
                      )}

                      {/* FINAL OUTPUT: The task completion artifact */}
                      {msg.final_output && (
                        <div className="border-t border-violet-50 pt-6 animate-scaleIn">
                          <FinalOutput content={msg.final_output} />
                        </div>
                      )}
                    </div>
                  )}

                  {/* FACTUALITY ATTRIBUTION: UI links to model grounding sources */}
                  {msg.groundingLinks && msg.groundingLinks.length > 0 && (
                    <div className="mt-8 pt-6 border-t border-slate-100">
                      <div className="text-[11px] font-bold text-slate-400 mb-4 tracking-widest">These websites might be relevant</div>
                      <div className="flex flex-wrap gap-2">
                          {msg.groundingLinks.map((link, idx) => (
                          <a key={idx} href={link.uri} target="_blank" rel="noopener noreferrer" className="flex items-center gap-3 px-4 py-2 bg-white hover:bg-violet-400 text-slate-600 hover:text-white rounded-full border border-slate-200 transition-all duration-300 group shadow-sm">
                              <span className="text-xs font-bold truncate max-w-[200px]">{link.title}</span>
                              <svg className="w-4 h-4 opacity-40 group-hover:opacity-100" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" /></svg>
                          </a>
                          ))}
                      </div>
                    </div>
                  )}

                  {msg.role === 'user' && msg.formData && (
                    <div className="mt-4 pt-4 border-t border-white/5 text-[11px] font-bold flex items-center gap-3 text-lime-400 tracking-wider">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.414a4 4 0 00-5.656-5.656l-6.415 6.414a6 6 0 108.486 8.486L20.5 13" /></svg>
                      <span className="truncate">{msg.formData['Attachments'] ? String(msg.formData['Attachments']) : 'Context Payload Injected'}</span>
                    </div>
                  )}
                </div>
              </div>
            );})}

            {isLoading && (
              <div className="flex justify-start animate-fadeIn">
                <div className="bg-white border border-violet-100 ring-[10px] ring-violet-400/5 shadow-sm rounded-2xl px-6 py-4 flex items-center gap-5">
                  <div className="flex gap-2">
                    <div className="w-2 h-2 bg-violet-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></div>
                    <div className="w-2 h-2 bg-slate-900 rounded-full animate-bounce" style={{ animationDelay: '200ms' }}></div>
                    <div className="w-2 h-2 bg-violet-400 rounded-full animate-bounce" style={{ animationDelay: '400ms' }}></div>
                  </div>
                  <span className="text-xs font-bold text-slate-400 uppercase tracking-widest">{loadingStep}</span>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* INPUT ORCHESTRATOR: Supports dictation, multimodal file staging, and text input */}
        <div className="fixed bottom-0 left-0 right-0 p-8 lg:p-12 z-40 pointer-events-none">
          <div className="max-w-4xl mx-auto pointer-events-auto flex flex-col gap-4">
            
            {stagedFiles.length > 0 && (
              <div className="flex flex-wrap gap-3 animate-slideUp bg-white/40 backdrop-blur-md p-3 rounded-[2rem] border border-white/50 shadow-sm">
                {stagedFiles.map((file, idx) => (
                  <StagedFilePreview 
                    key={idx} 
                    file={file} 
                    onRemove={() => removeStagedFile(idx)} 
                  />
                ))}
                <button 
                  onClick={() => setStagedFiles([])}
                  className="px-4 py-2 text-[10px] font-black text-slate-400 hover:text-red-500 uppercase tracking-widest transition-colors"
                >
                  Discard Batch
                </button>
              </div>
            )}

            <form 
              onSubmit={(e) => { e.preventDefault(); handleSend(input); }}
              className="flex items-center gap-4 glass-panel p-3 sm:p-4 rounded-[2.5rem] border border-slate-200/50 shadow-premium-xl focus-within:ring-[16px] focus-within:ring-lime-400/20 focus-within:border-lime-500/30 transition-all duration-700 group w-full relative"
            >
              <input 
                type="file" 
                multiple 
                ref={fileInputRef} 
                className="hidden" 
                onClick={(e) => (e.currentTarget.value = '')}
                onChange={(e) => {
                  if (e.target.files && e.target.files.length > 0) {
                    setStagedFiles(prev => [...prev, ...Array.from(e.target.files!)]);
                  }
                }} 
              />
              
              <div className="flex items-center gap-2 shrink-0">
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="w-16 h-16 bg-slate-50 text-slate-400 rounded-[1.5rem] hover:bg-lime-50 hover:text-lime-600 transition-all duration-300 flex items-center justify-center shrink-0 shadow-sm border border-slate-100 active:scale-95"
                  title="Attach multimodal context"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor" className="size-6">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H8.25m3.75 9v6m3-3H9m1.5-12H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 0 0-9-9Z" />
                  </svg>
                </button>
                <DictationButton 
                  onTranscribe={handleDictationResult} 
                  className="w-16 h-16 rounded-[1.5rem]" 
                />
              </div>

              <textarea
                className="w-full bg-transparent border-none outline-none focus:outline-none focus:ring-0 appearance-none shadow-none resize-none max-h-48 min-h-[64px] py-4 px-4 text-slate-900 placeholder:text-slate-300 text-xl sm:text-2xl font-bold tracking-tight selection:bg-lime-200"
                placeholder={inputPlaceholder}
                rows={1}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    handleSend(input);
                  }
                }}
              />

              <button
                type="submit"
                disabled={(!input.trim() && stagedFiles.length === 0) || isLoading}
                className="w-16 h-16 bg-[#0a0a0a] text-lime-400 rounded-[1.5rem] hover:bg-black hover:scale-105 disabled:opacity-20 transition-all duration-500 flex items-center justify-center shrink-0 shadow-2xl active:scale-95 group-focus-within:bg-lime-500 group-focus-within:text-white"
              >
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor" className="w-7 h-7">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 12 3.269 3.125A59.769 59.769 0 0 1 21.485 12 59.768 59.768 0 0 1 3.27 20.875L5.999 12Zm0 0h7.5" />
                  </svg>
              </button>
            </form>
            <div className="text-center text-[10px] font-bold text-slate-300 uppercase tracking-widest pointer-events-none select-none">
              Powered by Gemini 3 AI Models
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}

export default App;