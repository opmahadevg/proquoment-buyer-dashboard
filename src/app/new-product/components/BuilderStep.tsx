import React, { useState, useRef, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import toast, { Toaster } from 'react-hot-toast';
import { useAuth } from '@/contexts/AuthContext';
import { useRFQChat } from '@/lib/hooks/useRFQChat';
import { saveProduct } from '@/lib/productStore';
import { submitRFQ, saveDraftRFQ, fetchDraftRFQ, deleteDraftRFQ } from '@/lib/services/procurementApi';
import { CheckCircle, Loader2, Save, EyeOff, Eye, Paperclip, ArrowUp, X } from 'lucide-react';
import { MessageBubble, TypingIndicator } from './ChatMessage';
import { RFQPanel } from './RFQPanel';
import { RFQState, ChatImage } from '@/lib/rfq/types';
import { createEmptyRFQState, applyFieldPatch } from '@/lib/rfq/state-manager';
import { deriveProductName, type Message } from './NewProductFlow';
import { fromLegacyRFQData } from '@/lib/rfq/legacy-adapter';
import { fileToChatImage, validateImageFile, MAX_IMAGES_PER_MESSAGE } from '@/lib/utils/image-validator';

export default function BuilderStep({
  productText,
  productName,
  draftId: initialDraftId,
  tempRfqId,
  selectedImages = [],
  prefilledRfq,
}: {
  productText: string;
  productName: string;
  draftId?: string;
  tempRfqId?: string;
  selectedImages?: any[];
  prefilledRfq?: any; // Leaving flexible for legacy compatibility
}) {
  const router = useRouter();
  const { user } = useAuth();
  
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [rfqTitle, setRfqTitle] = useState(productName || 'New Product RFQ');
  const [conversationMode, setConversationMode] = useState<'standard'|'deep'|'fast'>('standard');
  
  const [rfqState, setRfqState] = useState<RFQState>(() => {
    const emptyState = createEmptyRFQState();
    
    // Support new partial RFQState from AI document extraction
    if (prefilledRfq && prefilledRfq.product) {
      return {
          ...emptyState,
          product: { ...emptyState.product, ...prefilledRfq.product },
          quantity: { ...emptyState.quantity, ...(prefilledRfq.quantity || {}) },
          specifications: { ...emptyState.specifications, ...(prefilledRfq.specifications || {}) },
          manufacturing: { ...emptyState.manufacturing, ...(prefilledRfq.manufacturing || {}) },
          commercial: { ...emptyState.commercial, ...(prefilledRfq.commercial || {}) },
      };
    }
    // Support legacy RFQData fallback
    else if (prefilledRfq && (prefilledRfq.productName || prefilledRfq.category)) {
      return fromLegacyRFQData(prefilledRfq as any);
    }
    
    if (productName || productText) {
      emptyState.product.name = {
        value: productName || deriveProductName(productText) || '',
        status: 'confirmed',
        confidence: 'high',
        source_type: 'buyer_edit',
        source_id: null,
        buyer_confirmed: true,
        supplier_proposed: false,
        updated_at: new Date().toISOString()
      };
    }
    return emptyState;
  });
  
  const rfqRef = useRef<RFQState>(rfqState);
  useEffect(() => { rfqRef.current = rfqState; }, [rfqState]);
  
  const [panelOpen, setPanelOpen] = useState(true);
  const [conversationHistory, setConversationHistory] = useState<{ role: string; content: string }[]>([]);
  const [initialized, setInitialized] = useState(false);
  const [finalized, setFinalized] = useState(false);
  
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Attached reference images state
  const [attachedImages, setAttachedImages] = useState<ChatImage[]>([]);

  // File selection handler with validation
  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;

    if (attachedImages.length + files.length > MAX_IMAGES_PER_MESSAGE) {
      toast.error(`Maximum ${MAX_IMAGES_PER_MESSAGE} reference images allowed per message.`);
      return;
    }

    const newImages: ChatImage[] = [];
    for (const file of files) {
      const validation = validateImageFile(file);
      if (!validation.valid) {
        toast.error(validation.error || 'Invalid file');
        continue;
      }
      try {
        const chatImg = await fileToChatImage(file);
        newImages.push(chatImg);
      } catch (err: any) {
        toast.error(err.message || 'Failed to read image file');
      }
    }

    if (newImages.length > 0) {
      setAttachedImages((prev) => [...prev, ...newImages]);
    }

    // Reset file input value so same file can be re-selected if removed
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleRemoveImage = (id: string) => {
    setAttachedImages((prev) => prev.filter((img) => img.id !== id));
  };

  // Draft state
  const [draftId, setDraftId] = useState<string | undefined>(initialDraftId);
  const [draftSaving, setDraftSaving] = useState(false);
  const [draftSaved, setDraftSaved] = useState(false);
  const draftSaveCounterRef = useRef(0);
  const draftRestoredRef = useRef(false);

  // New RFQ Intelligence engine hook
  const { isLoading: isProcessing, error: chatError, sendMessage: sendRFQMessage } = useRFQChat();

  // Auto-scroll
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Handle draft save
  const triggerDraftSave = useCallback(async () => {
    if (finalized || draftSaving) return;
    setDraftSaving(true);
    setDraftSaved(false);
    try {
      const savedId = await saveDraftRFQ({
        id: draftId,
        title: rfqTitle || deriveProductName(productText) || 'Untitled RFQ',
        productText,
        rfqData: null,
        rfqState: rfqState,
        conversationHistory,
        messages: messages.filter(m => !m.isStreaming),
        completionPct: rfqState.synthesized?.supplier_readiness_pct || 0,
      });
      setDraftId(savedId);
      setDraftSaved(true);
      setTimeout(() => setDraftSaved(false), 2000);
    } catch (err) {
      console.error('Draft save failed:', err);
    } finally {
      setDraftSaving(false);
    }
  }, [draftId, rfqTitle, productText, rfqState, conversationHistory, messages, finalized, draftSaving]);

  // Restore draft
  useEffect(() => {
    if (!initialDraftId || draftRestoredRef.current) return;
    draftRestoredRef.current = true;

    (async () => {
      const draft = await fetchDraftRFQ(initialDraftId);
      if (!draft) {
        toast.error('Draft not found');
        return;
      }
      setRfqTitle(draft.title);

      // C4 FIX: use typed draft.rfqState (mapDraft now reads rfq_state from DB)
      if (draft.rfqState) {
        setRfqState(draft.rfqState as RFQState);
      } else if (draft.rfqData) {
        setRfqState(fromLegacyRFQData(draft.rfqData));
      }
      
      setConversationHistory(draft.conversationHistory);
      setMessages(draft.messages as Message[]);
      setDraftId(draft.id);
      setInitialized(true);
      toast.success('Draft restored — continue your RFQ');
    })();
  }, [initialDraftId]);

  // Send message helper
  const executeTurn = async (history: any[], currentRfq: RFQState, typingMsgId: string) => {
    const result = await sendRFQMessage(history, currentRfq, { conversationMode });
    
    if (result) {
      // 1. Optimistic Update of RFQ State
      setRfqState(prev => {
        let next = prev;
        if (result.rfq_updates && result.rfq_updates.length > 0) {
          next = applyFieldPatch(next, result.rfq_updates as any).newState;
        }
        
        // Ensure name is synced to title
        if (next.product.name?.value && next.product.name.value !== rfqTitle) {
          setRfqTitle(next.product.name.value);
        }
        
        return next;
      });
      
      // 2. Add AI response bubble
      let replyText = result.buyer_message || '';
      const lowerReply = replyText.toLowerCase();

      // Ensure completion message includes Assumption Register reminder
      if (
        (lowerReply.includes('rfq is now complete') || lowerReply.includes('rfq is complete')) &&
        !lowerReply.includes('assumption register')
      ) {
        replyText += "\n\nNote: If needed, you can review and fulfill any remaining items in the Assumption Register (Missing / TBD / Supplier-proposed items) in the side panel as required before finalizing.";
      }

      const finalMsg: Message = {
        id: typingMsgId,
        role: 'ai',
        text: replyText,
        isStreaming: false,
        // H1 FIX: use label for display, value for submission
        options: result.ai_options && result.ai_options.length > 0
          ? result.ai_options.map((opt: any) =>
              typeof opt === 'string' ? opt : (opt.label || opt.value)
            )
          : undefined,
        multiSelect: result.multi_select,
      };
      
      setMessages(prev => [...prev.slice(0, -1), finalMsg]);
      
      // 3. Update history
      const updatedHistory = [...history, { role: 'assistant', content: replyText }];
      setConversationHistory(updatedHistory);
      
      // 4. Auto save
      draftSaveCounterRef.current += 1;
      if (draftSaveCounterRef.current % 2 === 0 && !finalized) {
        setTimeout(() => triggerDraftSave(), 500);
      }
    } else {
      // Failed, remove typing indicator
      setMessages(prev => prev.slice(0, -1));
    }
  };

  // Initialize conversation
  const initializeConversation = useCallback(() => {
    if (initialized || !productText) return;
    setInitialized(true);

    const initialMsgText = selectedImages.length > 0
      ? `Here are my inspiration images for ${productText}`
      : productText;

    const imgList = selectedImages.map((img: any) => ({
      url: img.thumbnail || img.original,
      title: img.title || '',
    }));

    const userContent = selectedImages.length > 0
      ? `Here are my inspiration images for ${productText}. Please acknowledge them.`
      : `I want to source the following product: ${productText}`;

    const initialHistory = [{ role: 'user', content: userContent, images: imgList.length > 0 ? imgList : undefined }];
    setConversationHistory(initialHistory);

    setMessages([
      { id: 'user-init', role: 'user', text: initialMsgText, images: imgList.length > 0 ? imgList : undefined },
    ]);

    const aiMsgId = `ai-${Date.now()}`;
    setMessages(prev => [...prev, { id: aiMsgId, role: 'ai', text: '', isStreaming: true }]);

    // Execute the AI turn asynchronously without streaming
    executeTurn(initialHistory, rfqRef.current, aiMsgId);
    
  }, [initialized, productText, selectedImages]);

  useEffect(() => {
    initializeConversation();
  }, [initializeConversation]);

  const handleSend = (text: string) => {
    const trimmed = text.trim();
    if ((!trimmed && attachedImages.length === 0) || isProcessing) return;

    const messageImages = attachedImages.length > 0 ? [...attachedImages] : undefined;
    const userText = trimmed || (messageImages ? 'Attached reference image(s)' : '');

    const userMsg: Message = {
      id: `user-${Date.now()}`,
      role: 'user',
      text: userText,
      images: messageImages,
    };
    setMessages(prev => [...prev, userMsg]);
    setInputValue('');
    setAttachedImages([]);

    const newHistory = [
      ...conversationHistory,
      {
        role: 'user',
        content: userText,
        images: messageImages,
      },
    ];
    setConversationHistory(newHistory);

    const aiMsgId = `ai-${Date.now()}`;
    setMessages(prev => [...prev, { id: aiMsgId, role: 'ai', text: '', isStreaming: true }]);

    executeTurn(newHistory, rfqRef.current, aiMsgId);
  };

  const handleFinalize = async () => {
    const title = rfqTitle || rfqState.product.name?.value || deriveProductName(productText);
    const dateStr = new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });

    const mapSectionToLegacy = (section: any) => Object.entries(section || {}).map(([k, v]: [string, any]) => ({
      label: k.replace(/_/g, ' ').replace(/\b\w/g, (c: string) => c.toUpperCase()),
      value: v?.value || 'TBD',
      pending: !v?.value,
    }));

    const combinedSpecs = [
      ...mapSectionToLegacy(rfqState.specifications),
      ...mapSectionToLegacy(rfqState.quality),
      ...mapSectionToLegacy(rfqState.compliance),
      ...mapSectionToLegacy(rfqState.commercial),
      ...mapSectionToLegacy(rfqState.logistics),
      ...mapSectionToLegacy(rfqState.packaging),
      ...mapSectionToLegacy(rfqState.special_requirements)
    ];

    const manufacturingSpecs = mapSectionToLegacy(rfqState.manufacturing);

    const specsStr = combinedSpecs
      .filter((s) => !s.pending && s.value !== 'TBD')
      .map((s) => `${s.label}: ${s.value}`)
      .join(', ');

    const finalCategory = rfqState.synthesized?.product.category_path?.join(' > ') || rfqState.product.classification?.broad_category || 'TBD';
    const finalDescription = rfqState.synthesized?.product.synthesized_description || rfqState.product.description?.value || 'TBD';

    await saveProduct({
      id: `prod-rfq-${Date.now()}`,
      name: title,
      category: finalCategory,
      description: finalDescription,
      moq: rfqState.quantity.required_quantity?.value || 'TBD',
      specifications: combinedSpecs,
      manufacturingNotes: manufacturingSpecs,
      status: 'New Update',
      stage: 'Quoting',
      updated: dateStr,
      image: '',
      imageAlt: `${title} product`,
    });

    try {
      const buyerName = user?.user_metadata?.full_name || user?.email?.split('@')[0] || 'Enterprise Buyer';
      const realId = await submitRFQ({
        product: title,
        qty: rfqState.quantity.required_quantity?.value || 'TBD',
        value: 'TBD',
        specs: specsStr,
        buyer: buyerName,
        description: finalDescription,
        aiChat: conversationHistory,
        // C5 FIX: persist structured state and target price
        rfqState: rfqState,
        targetPrice: rfqState.commercial?.target_price?.value || undefined,
      });
      
      if (tempRfqId && realId) {
        try {
          await fetch('/api/rfq-images/relink', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ tempId: tempRfqId, realId }),
          });
        } catch (e) {
          console.warn('Reference image relink failed:', e);
        }
      }
    } catch (err) {
      console.error('Failed to submit RFQ', err);
    }

    if (draftId) {
      try {
        await deleteDraftRFQ(draftId);
      } catch {}
    }

    setFinalized(true);
    toast.success('RFQ finalized! Product added to your list.');
    setTimeout(() => router.push('/products-list'), 1200);
  };

  const handleCorrect = useCallback((oldText: string) => {
    setInputValue(oldText);
    setTimeout(() => inputRef.current?.focus(), 50);
  }, []);

  const handleResolveConflict = (conflictId: string, resolution: string) => {
    // H11 FIX: mark conflict as resolved in state before sending to AI
    setRfqState(prev => ({
      ...prev,
      conflicts: prev.conflicts.map(c =>
        c.id === conflictId
          ? { ...c, resolved: true, resolution, resolved_at: new Date().toISOString() }
          : c
      ),
    }));
    handleSend(`Regarding the conflict: ${resolution}`);
  };

  return (
    <div className="relative h-screen bg-white flex flex-col overflow-hidden">
      <Toaster position="top-right" toastOptions={{ style: { fontSize: '13px', borderRadius: '10px', fontFamily: 'inherit' } }} />

      {/* Top bar */}
      <div className="flex items-center gap-3 px-4 md:px-6 py-3 border-b border-gray-100 bg-white z-10 flex-shrink-0">
        <Link href="/products-list" className="flex items-center gap-1 text-sm text-gray-400 hover:text-[#0D0D14] transition-colors whitespace-nowrap">
          <span className="text-base leading-none">‹</span> <span className="hidden sm:inline">Back</span>
        </Link>
        <div className="flex-1 min-w-0">
          <input
            value={rfqTitle}
            onChange={(e) => setRfqTitle(e.target.value)}
            className="w-full text-sm font-semibold text-[#0D0D14] bg-transparent outline-none border-b border-primary pb-0.5 truncate placeholder:text-gray-300"
            placeholder="Product RFQ title…"
          />
        </div>
        {!finalized && (
          <button
            onClick={triggerDraftSave}
            disabled={draftSaving || messages.length < 2}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all flex-shrink-0 ${
              draftSaved ? 'bg-green-50 text-green-600 border border-green-200'
              : draftSaving ? 'bg-gray-50 text-gray-400 border border-gray-200'
              : 'bg-amber-50 text-amber-700 border border-amber-200 hover:bg-amber-100'
            } disabled:opacity-40 disabled:cursor-not-allowed`}
          >
            {draftSaved ? <><CheckCircle size={12} /> Saved</>
             : draftSaving ? <><Loader2 size={12} className="animate-spin" /> Saving…</>
             : <><Save size={12} /> Save Draft</>}
          </button>
        )}
        <button
          onClick={() => setPanelOpen(!panelOpen)}
          className="flex-shrink-0 p-2 rounded-lg text-gray-400 hover:text-[#0D0D14] hover:bg-gray-50 transition-colors"
        >
          {panelOpen ? <EyeOff size={17} /> : <Eye size={17} />}
        </button>
      </div>

      {/* Body */}
      <div className="flex flex-1 overflow-hidden">
        {/* Left: Chat */}
        <div className={`flex flex-col transition-all duration-300 ${panelOpen ? 'hidden md:flex md:w-[56%]' : 'w-full'} w-full`}>
          <div className="flex-1 overflow-y-auto">
            <div className="max-w-2xl mx-auto px-4 md:px-8 pt-5 md:pt-8 pb-4">
              {messages.map((msg) => (
                <MessageBubble
                  key={msg.id}
                  msg={msg}
                  onOptionClick={handleSend}
                  onCorrect={msg.role === 'user' ? handleCorrect : undefined}
                  isLoading={isProcessing}
                />
              ))}
              <div ref={messagesEndRef} />
            </div>
          </div>

          <div className="flex-shrink-0 border-t border-gray-100 bg-white">
            <div className="max-w-2xl mx-auto px-3 md:px-8 py-3 md:py-4">
              
              <div className="flex items-center gap-2 mb-2 pl-2">
                <span className="text-[10px] uppercase tracking-wider text-gray-400 font-medium">Mode:</span>
                {(['standard', 'deep', 'fast'] as const).map(mode => (
                  <button
                    key={mode}
                    onClick={() => setConversationMode(mode)}
                    className={`px-2 py-0.5 text-xs font-medium rounded-md transition-colors ${conversationMode === mode ? 'bg-[#0D0D14] text-white' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'}`}
                  >
                    {mode.charAt(0).toUpperCase() + mode.slice(1)}
                  </button>
                ))}
              </div>

              <div className="border border-gray-200 rounded-2xl bg-white focus-within:border-gray-400 transition-colors duration-150 overflow-hidden">
                {/* Hidden File Input */}
                <input
                  type="file"
                  ref={fileInputRef}
                  accept="image/jpeg,image/png,image/webp"
                  multiple
                  onChange={handleFileSelect}
                  className="hidden"
                />

                {/* Attached Image Previews Bar */}
                {attachedImages.length > 0 && (
                  <div className="flex flex-wrap gap-2 px-4 pt-3 pb-1 border-b border-gray-100 bg-gray-50/50">
                    {attachedImages.map((img) => (
                      <div
                        key={img.id}
                        className="relative group w-14 h-14 rounded-lg overflow-hidden border border-gray-200 bg-white flex-shrink-0 shadow-sm"
                      >
                        <img
                          src={img.url}
                          alt={img.title || 'Reference image'}
                          className="w-full h-full object-cover"
                        />
                        <button
                          type="button"
                          onClick={() => handleRemoveImage(img.id)}
                          className="absolute top-0.5 right-0.5 p-0.5 rounded-full bg-black/60 text-white hover:bg-red-600 transition-colors"
                          title="Remove image"
                        >
                          <X size={10} />
                        </button>
                      </div>
                    ))}
                  </div>
                )}

                <textarea
                  ref={inputRef}
                  value={inputValue}
                  onChange={(e) => setInputValue(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      handleSend(inputValue);
                    }
                  }}
                  placeholder={attachedImages.length > 0 ? "Add details about these attached image(s)…" : "Type your answer or add more details…"}
                  rows={2}
                  disabled={isProcessing}
                  className="w-full px-4 pt-3.5 pb-1 text-sm text-[#0D0D14] placeholder:text-gray-300 outline-none resize-none bg-transparent disabled:opacity-50 leading-relaxed"
                />
                <div className="flex items-center justify-between px-4 pb-3 pt-1">
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={isProcessing || attachedImages.length >= MAX_IMAGES_PER_MESSAGE}
                    className="flex items-center gap-1.5 text-xs text-gray-500 hover:text-[#0D0D14] disabled:opacity-40 transition-colors"
                  >
                    <Paperclip size={12} /> <span className="hidden sm:inline">Add references</span>
                    {attachedImages.length > 0 && (
                      <span className="ml-1 text-[10px] font-bold px-1.5 py-0.2 bg-primary/10 text-primary rounded-full">
                        {attachedImages.length}/{MAX_IMAGES_PER_MESSAGE}
                      </span>
                    )}
                  </button>
                  <button
                    onClick={() => handleSend(inputValue)}
                    disabled={(!inputValue.trim() && attachedImages.length === 0) || isProcessing}
                    className="w-7 h-7 rounded-full bg-[#0D0D14] text-white flex items-center justify-center transition-all duration-150 disabled:opacity-25 disabled:cursor-not-allowed hover:bg-[#1a1a26] active:scale-95 flex-shrink-0"
                  >
                    {isProcessing ? <Loader2 size={13} className="animate-spin" /> : <ArrowUp size={13} />}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Right: RFQ panel */}
        {panelOpen && (
          <div className="flex-1 overflow-hidden border-l border-gray-100 flex flex-col">
            <RFQPanel
              rfqState={rfqState}
              rfqTitle={rfqTitle}
              finalized={finalized}
              isLoading={isProcessing}
              onFinalize={handleFinalize}
              onResolveConflict={handleResolveConflict}
            />
          </div>
        )}
      </div>
    </div>
  );
}
