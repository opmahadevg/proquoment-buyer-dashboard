'use client';
import React, { useState, useEffect, useRef } from 'react';
import AppLayout from '@/components/AppLayout';
import {
  fetchOrCreateBuyerConversation,
  fetchBuyerChatMessages,
  sendBuyerChatMessage,
  markBuyerChatRead,
  fetchBuyerMessages,
} from '@/lib/services/procurementApi';
import { createClient } from '@/lib/supabase/client';
import { toast } from 'sonner';
import { MessageCircle, Send, Inbox, Shield, Clock, ChevronDown, Archive } from 'lucide-react';

interface ChatMessage {
  id: string;
  conversation_id: string;
  from_admin: boolean;
  text: string;
  sent_at: string;
  read: boolean;
}

interface LegacyMessage {
  id: string;
  orderId?: string;
  from: string;
  to: string;
  subject: string;
  text: string;
  time: string;
  type: string;
  read: boolean;
  createdAt?: string;
}

interface Conversation {
  id: string;
  buyer_id: string;
  buyer_name: string;
  buyer_avatar: string;
  last_message: string;
  last_message_at: string;
  unread_admin: number;
  unread_buyer: number;
  online: boolean;
}

const QUICK_TEMPLATES = [
  {
    label: 'Request Update',
    text: 'Could you please provide an update on the current status of my order?',
  },
  {
    label: 'Delivery Query',
    text: 'I wanted to check on the expected delivery timeline for my shipment.',
  },
  {
    label: 'Quote Clarification',
    text: 'I have some questions regarding the latest quote. Could we schedule a call?',
  },
  {
    label: 'Document Request',
    text: 'Please send me the shipping documents and export paperwork for my order.',
  },
];

export default function MessagesPage() {
  const [conversation, setConversation] = useState<Conversation | null>(null);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [legacyMessages, setLegacyMessages] = useState<LegacyMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [reply, setReply] = useState('');
  const [sending, setSending] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);

  // Load initial conversation and legacy messages
  useEffect(() => {
    async function init() {
      try {
        setLoading(true);
        const conv = await fetchOrCreateBuyerConversation();
        setConversation(conv);

        const [msgs, legacy] = await Promise.all([
          fetchBuyerChatMessages(conv.id),
          fetchBuyerMessages(),
        ]);
        setChatMessages(msgs);
        setLegacyMessages(legacy);

        await markBuyerChatRead(conv.id);
      } catch (err) {
        console.error('Failed to initialize chat:', err);
        toast.error('Failed to connect to chat service');
      } finally {
        setLoading(false);
      }
    }
    init();
  }, []);

  // Real-time listener for new messages
  useEffect(() => {
    if (!conversation) return;

    const supabase = createClient();
    if (!supabase) return;

    const channel = supabase
      .channel('buyer-live-messages-realtime')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'buyer_messages',
          filter: `conversation_id=eq.${conversation.id}`,
        },
        async (payload) => {
          if (payload.eventType === 'INSERT') {
            const newMsg = payload.new as ChatMessage;
            setChatMessages((prev) => {
              if (prev.some((m) => m.id === newMsg.id)) return prev;
              return [...prev, newMsg];
            });
            await markBuyerChatRead(conversation.id);
            // Refresh conversation unread count locally
            setConversation((prev) => prev ? { ...prev, unread_buyer: 0 } : null);
          }
        }
      )
      .subscribe();

    // Listener for conversation updates (updates list preview)
    const convChannel = supabase
      .channel('buyer-live-convs-realtime')
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'buyer_conversations',
          filter: `id=eq.${conversation.id}`,
        },
        (payload) => {
          setConversation(payload.new as Conversation);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
      supabase.removeChannel(convChannel);
    };
  }, [conversation]);

  // Scroll to bottom
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatMessages]);

  const handleSend = async () => {
    if (!reply.trim() || !conversation) return;
    setSending(true);
    try {
      await sendBuyerChatMessage(conversation.id, reply);
      setReply('');
      // Reload messages to ensure synchronization
      const msgs = await fetchBuyerChatMessages(conversation.id);
      setChatMessages(msgs);
    } catch {
      toast.error('Failed to send message');
    } finally {
      setSending(false);
    }
  };

  const unreadCount = conversation?.unread_buyer || 0;

  return (
    <AppLayout>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6">
        {/* Header */}
        <div className="mb-6">
          <p className="text-xs font-medium text-[var(--muted-foreground)] uppercase tracking-wide mb-1">
            Communication Center
          </p>
          <h1 className="text-2xl font-bold text-[var(--foreground)] flex items-center gap-2">
            <MessageCircle size={22} className="text-primary" />
            Live Chat Support
          </h1>
          <p className="text-sm text-[var(--muted-foreground)] mt-1">
            Secure, real-time channel directly with the Proquoment Admin team
          </p>
        </div>

        <div className="flex gap-4" style={{ height: 'calc(100vh - 220px)', minHeight: 500 }}>
          
          {/* Left Panel: Conversation Selector */}
          <div className="w-80 flex-shrink-0 bg-white border border-[var(--border)] rounded-2xl overflow-hidden flex flex-col">
            <div className="px-4 py-3 border-b border-[var(--border)] flex items-center gap-2 bg-gray-50">
              <Inbox size={15} className="text-[var(--muted-foreground)]" />
              <span className="text-sm font-semibold text-[var(--foreground)]">Support Channels</span>
            </div>
            
            <div className="flex-1 overflow-y-auto">
              {loading ? (
                <div className="flex items-center justify-center h-40 text-[var(--muted-foreground)] text-sm">
                  Connecting to server...
                </div>
              ) : !conversation ? (
                <div className="flex flex-col items-center justify-center h-40 text-[var(--muted-foreground)] px-4 text-center">
                  <Inbox size={32} className="mb-2 opacity-30" />
                  <p className="text-sm">Unable to load support channel</p>
                </div>
              ) : (
                <button
                  className="w-full text-left px-4 py-4 border-b border-[var(--border)] transition-colors bg-blue-50/70 border-l-4 border-l-primary flex gap-3"
                >
                  <div className="w-10 h-10 rounded-full bg-primary/10 text-primary flex items-center justify-center font-bold text-sm flex-shrink-0">
                    PA
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-sm font-semibold text-[var(--foreground)]">Proquoment Admin</span>
                      <span className="text-[10px] text-[var(--muted-foreground)]">
                        {conversation.last_message_at
                          ? new Date(conversation.last_message_at).toLocaleTimeString([], {
                              hour: '2-digit',
                              minute: '2-digit',
                            })
                          : ''}
                      </span>
                    </div>
                    <p className="text-xs text-[var(--muted-foreground)] truncate">
                      {conversation.last_message || 'No messages yet'}
                    </p>
                    {unreadCount > 0 && (
                      <span className="inline-block px-1.5 py-0.5 bg-primary text-white text-[9px] font-bold rounded-full mt-1">
                        {unreadCount} new
                      </span>
                    )}
                  </div>
                </button>
              )}
            </div>
          </div>

          {/* Right Panel: Chat Area */}
          <div className="flex-1 bg-white border border-[var(--border)] rounded-2xl overflow-hidden flex flex-col">
            {loading ? (
              <div className="flex-1 flex flex-col items-center justify-center text-[var(--muted-foreground)]">
                <MessageCircle size={48} className="mb-3 opacity-20 animate-pulse" />
                <p className="text-sm">Loading Chat Workspace...</p>
              </div>
            ) : conversation ? (
              <>
                {/* Chat Workspace Header */}
                <div className="px-6 py-4 border-b border-[var(--border)] flex items-center justify-between bg-gray-50">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-full bg-primary text-white flex items-center justify-center font-bold text-sm">
                      PA
                    </div>
                    <div>
                      <h2 className="font-bold text-sm text-[var(--foreground)] flex items-center gap-2">
                        Proquoment Admin
                        <span className="w-2 h-2 rounded-full bg-green-500 animate-ping inline-block" />
                      </h2>
                      <p className="text-[11px] text-[var(--muted-foreground)]">Verified Support Team</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5 px-3 py-1 bg-blue-50 border border-blue-100 rounded-full text-blue-700 text-xs font-medium">
                    <Shield size={12} />
                    <span>Real-time Protected Route</span>
                  </div>
                </div>

                {/* Messages Thread */}
                <div className="flex-1 overflow-y-auto px-6 py-6 space-y-4 bg-slate-50/50">
                  {chatMessages.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-full text-[var(--muted-foreground)]">
                      <MessageCircle size={40} className="mb-2 opacity-20" />
                      <p className="text-sm font-medium">Start your conversation with Proquoment Admin</p>
                      <p className="text-xs text-[var(--muted-foreground)] mt-1">
                        Send a message below to connect with our operations team.
                      </p>
                    </div>
                  ) : (
                    chatMessages.map((msg) => {
                      const fromAdmin = msg.from_admin;
                      return (
                        <div
                          key={msg.id}
                          className={`flex flex-col ${fromAdmin ? 'items-start' : 'items-end'}`}
                        >
                          <div
                            className={`max-w-[70%] px-4 py-3 rounded-2xl text-sm leading-relaxed shadow-sm ${
                              fromAdmin
                                ? 'bg-white text-[var(--foreground)] rounded-tl-none border border-[var(--border)]'
                                : 'bg-primary text-white rounded-tr-none'
                            }`}
                          >
                            {msg.text}
                          </div>
                          <span className="text-[10px] text-[var(--muted-foreground)] mt-1.5 px-1.5 flex items-center gap-1">
                            <Clock size={10} />
                            {msg.sent_at
                              ? new Date(msg.sent_at).toLocaleTimeString([], {
                                  hour: '2-digit',
                                  minute: '2-digit',
                                })
                              : ''}
                          </span>
                        </div>
                      );
                    })
                  )}
                  <div ref={chatEndRef} />
                </div>

                {/* Past Email Archive (Collapsible details block) */}
                {legacyMessages.length > 0 && (
                  <div className="border-t border-[var(--border)] px-6 py-3 bg-gray-50/80">
                    <details className="group">
                      <summary className="cursor-pointer flex items-center justify-between text-xs font-semibold text-[var(--muted-foreground)] select-none list-none group-open:mb-3">
                        <div className="flex items-center gap-1.5">
                          <Archive size={13} />
                          <span>Past Email Message History ({legacyMessages.length})</span>
                        </div>
                        <ChevronDown size={13} className="transition-transform group-open:rotate-180" />
                      </summary>
                      
                      <div className="space-y-2.5 max-h-40 overflow-y-auto pr-1">
                        {legacyMessages.map((email) => (
                          <div
                            key={email.id}
                            className="p-3 bg-white border border-[var(--border)] rounded-xl text-xs"
                          >
                            <div className="flex justify-between items-center font-bold mb-1 text-[var(--foreground)]">
                              <span>Subject: {email.subject}</span>
                              <span className="text-[10px] text-[var(--muted-foreground)] font-normal flex items-center gap-1">
                                <Clock size={8} /> {email.time}
                              </span>
                            </div>
                            <p className="text-[var(--muted-foreground)] leading-relaxed whitespace-pre-wrap">
                              {email.text}
                            </p>
                            {email.orderId && (
                              <span className="inline-block mt-1.5 px-2 py-0.5 bg-gray-100 rounded text-[9px] font-mono text-[var(--muted-foreground)]">
                                Order Ref: {email.orderId}
                              </span>
                            )}
                          </div>
                        ))}
                      </div>
                    </details>
                  </div>
                )}

                {/* Input Workspace */}
                <div className="px-6 py-4 border-t border-[var(--border)] bg-white">
                  <div className="mb-3 flex flex-wrap gap-2">
                    {QUICK_TEMPLATES.map((t) => (
                      <button
                        key={t.label}
                        onClick={() => setReply(t.text)}
                        className="px-2.5 py-1 text-[10px] font-semibold border border-[var(--border)] rounded-full hover:bg-gray-50 transition-colors text-[var(--muted-foreground)] hover:text-[var(--foreground)] bg-white"
                      >
                        {t.label}
                      </button>
                    ))}
                  </div>
                  <div className="flex gap-3">
                    <input
                      value={reply}
                      onChange={(e) => setReply(e.target.value)}
                      placeholder="Type your message to Admin..."
                      className="flex-1 border border-[var(--border)] rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') handleSend();
                      }}
                    />
                    <button
                      onClick={handleSend}
                      disabled={sending || !reply.trim()}
                      className="flex items-center justify-center w-11 h-11 bg-primary text-white rounded-xl hover:bg-primary/95 transition-colors disabled:opacity-50 flex-shrink-0"
                    >
                      <Send size={16} />
                    </button>
                  </div>
                </div>
              </>
            ) : (
              <div className="flex-1 flex flex-col items-center justify-center text-[var(--muted-foreground)]">
                <MessageCircle size={48} className="mb-3 opacity-20" />
                <p className="text-sm font-medium">Channel Unavailable</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </AppLayout>
  );
}
