'use client';
import React, { useState, useEffect, useRef } from 'react';
import AppLayout from '@/components/AppLayout';
import {
  fetchBuyerMessages,
  sendBuyerMessage,
  markBuyerMessageRead,
} from '@/lib/services/procurementApi';
import { createClient } from '@/lib/supabase/client';
import { toast } from 'sonner';
import { MessageCircle, Send, Inbox, PenSquare, Clock } from 'lucide-react';

interface Message {
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
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<string | null>(null);
  const [composing, setComposing] = useState(false);
  const [reply, setReply] = useState('');
  const [newSubject, setNewSubject] = useState('');
  const [newBody, setNewBody] = useState('');
  const [newOrderId, setNewOrderId] = useState('');
  const [sending, setSending] = useState(false);
  const replyRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    loadMessages();

    const supabase = createClient();
    if (!supabase) return;

    const channel = supabase
      .channel('buyer-messages-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'messages' }, async () => {
        const data = await fetchBuyerMessages();
        setMessages(data);
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const loadMessages = async () => {
    setLoading(true);
    const data = await fetchBuyerMessages();
    setMessages(data);
    setLoading(false);
  };

  const selectedMsg = messages.find((m) => m.id === selected);
  const unread = messages.filter((m) => !m.read).length;

  const handleSelect = async (id: string) => {
    setSelected(id);
    setComposing(false);
    const msg = messages.find((m) => m.id === id);
    if (msg && !msg.read) {
      await markBuyerMessageRead(id);
      setMessages((prev) => prev.map((m) => (m.id === id ? { ...m, read: true } : m)));
    }
  };

  const handleReply = async () => {
    if (!reply.trim() || !selectedMsg) return;
    setSending(true);
    try {
      await sendBuyerMessage({
        orderId: selectedMsg.orderId,
        subject: selectedMsg.subject.startsWith('Re:')
          ? selectedMsg.subject
          : `Re: ${selectedMsg.subject}`,
        text: reply,
      });
      toast.success('Reply sent to Admin');
      setReply('');
      loadMessages();
    } catch {
      toast.error('Failed to send reply');
    } finally {
      setSending(false);
    }
  };

  const handleNew = async () => {
    if (!newSubject.trim() || !newBody.trim()) {
      toast.error('Subject and message are required');
      return;
    }
    setSending(true);
    try {
      await sendBuyerMessage({
        orderId: newOrderId || undefined,
        subject: newSubject,
        text: newBody,
      });
      toast.success('Message sent to Admin');
      setComposing(false);
      setNewSubject('');
      setNewBody('');
      setNewOrderId('');
      loadMessages();
    } catch {
      toast.error('Failed to send message');
    } finally {
      setSending(false);
    }
  };

  return (
    <AppLayout>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6">
        {/* Header */}
        <div className="mb-6 flex items-center justify-between">
          <div>
            <p className="text-xs font-medium text-[var(--muted-foreground)] uppercase tracking-wide mb-1">
              Communication
            </p>
            <h1 className="text-2xl font-bold text-[var(--foreground)] flex items-center gap-2">
              <MessageCircle size={22} className="text-primary" />
              Messages
            </h1>
            <p className="text-sm text-[var(--muted-foreground)] mt-1">
              All communication goes through Admin — {unread} unread
            </p>
          </div>
          <button
            onClick={() => {
              setComposing(true);
              setSelected(null);
            }}
            className="flex items-center gap-2 px-4 py-2 bg-primary text-white text-sm font-semibold rounded-lg hover:bg-primary/90 transition-colors"
          >
            <PenSquare size={15} /> New Message
          </button>
        </div>

        <div className="flex gap-4" style={{ height: 'calc(100vh - 220px)', minHeight: 500 }}>
          {/* Left: Message List */}
          <div className="w-80 flex-shrink-0 bg-white border border-[var(--border)] rounded-2xl overflow-hidden flex flex-col">
            <div className="px-4 py-3 border-b border-[var(--border)] flex items-center gap-2">
              <Inbox size={15} className="text-[var(--muted-foreground)]" />
              <span className="text-sm font-semibold">Inbox</span>
              {unread > 0 && (
                <span className="ml-auto px-2 py-0.5 bg-primary text-white text-[10px] font-bold rounded-full">
                  {unread}
                </span>
              )}
            </div>
            <div className="flex-1 overflow-y-auto">
              {loading ? (
                <div className="flex items-center justify-center h-40 text-[var(--muted-foreground)] text-sm">
                  Loading…
                </div>
              ) : messages.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-40 text-[var(--muted-foreground)]">
                  <Inbox size={32} className="mb-2 opacity-30" />
                  <p className="text-sm">No messages yet</p>
                </div>
              ) : (
                messages.map((msg) => (
                  <button
                    key={msg.id}
                    onClick={() => handleSelect(msg.id)}
                    className={`w-full text-left px-4 py-3 border-b border-[var(--border)] transition-colors ${
                      selected === msg.id
                        ? 'bg-blue-50 border-l-2 border-l-primary'
                        : 'hover:bg-gray-50'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-0.5">
                      <span
                        className={`text-xs font-semibold ${msg.read ? 'text-[var(--muted-foreground)]' : 'text-[var(--foreground)]'}`}
                      >
                        {msg.from === 'Admin' ? '🔵 Admin' : '↗ You'}
                      </span>
                      <span className="text-[10px] text-[var(--muted-foreground)]">{msg.time}</span>
                    </div>
                    <p
                      className={`text-xs truncate mb-0.5 ${msg.read ? 'font-normal text-[var(--muted-foreground)]' : 'font-bold text-[var(--foreground)]'}`}
                    >
                      {msg.subject}
                    </p>
                    <p className="text-[10px] text-[var(--muted-foreground)] truncate">
                      {msg.text}
                    </p>
                    {!msg.read && (
                      <span className="inline-block w-1.5 h-1.5 rounded-full bg-primary mt-1" />
                    )}
                  </button>
                ))
              )}
            </div>
          </div>

          {/* Right: Detail / Compose */}
          <div className="flex-1 bg-white border border-[var(--border)] rounded-2xl overflow-hidden flex flex-col">
            {composing ? (
              <>
                <div className="px-6 py-4 border-b border-[var(--border)] flex items-center gap-2">
                  <PenSquare size={16} className="text-primary" />
                  <span className="font-semibold text-sm">New Message to Admin</span>
                </div>
                <div className="flex-1 overflow-y-auto p-6 space-y-4">
                  <div>
                    <label className="block text-xs font-semibold text-[var(--muted-foreground)] uppercase mb-1">
                      Subject
                    </label>
                    <input
                      value={newSubject}
                      onChange={(e) => setNewSubject(e.target.value)}
                      placeholder="e.g. Update on Order ORD-12345"
                      className="w-full border border-[var(--border)] rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-[var(--muted-foreground)] uppercase mb-1">
                      Linked Order ID (optional)
                    </label>
                    <input
                      value={newOrderId}
                      onChange={(e) => setNewOrderId(e.target.value)}
                      placeholder="e.g. ORD-12345"
                      className="w-full border border-[var(--border)] rounded-lg px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-primary/30"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-[var(--muted-foreground)] uppercase mb-2">
                      Quick Templates
                    </label>
                    <div className="flex flex-wrap gap-2">
                      {QUICK_TEMPLATES.map((t) => (
                        <button
                          key={t.label}
                          onClick={() => setNewBody(t.text)}
                          className="px-2 py-1 text-[10px] font-semibold border border-[var(--border)] rounded-lg hover:bg-gray-50 transition-colors"
                        >
                          {t.label}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-[var(--muted-foreground)] uppercase mb-1">
                      Message
                    </label>
                    <textarea
                      value={newBody}
                      onChange={(e) => setNewBody(e.target.value)}
                      rows={8}
                      placeholder="Type your message here…"
                      className="w-full border border-[var(--border)] rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 resize-none"
                    />
                  </div>
                </div>
                <div className="px-6 py-4 border-t border-[var(--border)] flex items-center justify-between">
                  <button
                    onClick={() => setComposing(false)}
                    className="text-sm text-[var(--muted-foreground)] hover:text-[var(--foreground)] transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleNew}
                    disabled={sending}
                    className="flex items-center gap-2 px-5 py-2 bg-primary text-white text-sm font-semibold rounded-lg hover:bg-primary/90 transition-colors disabled:opacity-50"
                  >
                    <Send size={14} /> {sending ? 'Sending…' : 'Send to Admin'}
                  </button>
                </div>
              </>
            ) : selectedMsg ? (
              <>
                {/* Message Detail */}
                <div className="px-6 py-4 border-b border-[var(--border)]">
                  <h2 className="font-bold text-[var(--foreground)] mb-1">{selectedMsg.subject}</h2>
                  <div className="flex items-center gap-4 text-xs text-[var(--muted-foreground)]">
                    <span>
                      From: <strong>{selectedMsg.from === 'Admin' ? '🔵 Admin' : 'You'}</strong>
                    </span>
                    <span>
                      To: <strong>{selectedMsg.to === 'Admin' ? '🔵 Admin' : 'You'}</strong>
                    </span>
                    <span className="flex items-center gap-1">
                      <Clock size={10} /> {selectedMsg.time}
                    </span>
                    {selectedMsg.orderId && (
                      <span className="px-2 py-0.5 bg-gray-100 rounded font-mono text-[10px]">
                        {selectedMsg.orderId}
                      </span>
                    )}
                  </div>
                </div>
                <div className="flex-1 overflow-y-auto px-6 py-5">
                  <p className="text-sm leading-relaxed text-[var(--foreground)] whitespace-pre-wrap">
                    {selectedMsg.text}
                  </p>
                  {selectedMsg.from === 'Admin' && (
                    <div className="mt-4 p-3 bg-blue-50 rounded-lg border border-blue-100">
                      <p className="text-[10px] font-semibold text-blue-600 uppercase mb-1">Note</p>
                      <p className="text-xs text-blue-700">
                        This message was sent by the Proquoment Admin team. All replies go directly
                        to Admin.
                      </p>
                    </div>
                  )}
                </div>
                {/* Reply Box */}
                <div className="px-6 py-4 border-t border-[var(--border)]">
                  <div className="mb-3 flex flex-wrap gap-2">
                    {QUICK_TEMPLATES.map((t) => (
                      <button
                        key={t.label}
                        onClick={() => {
                          setReply(t.text);
                          replyRef.current?.focus();
                        }}
                        className="px-2 py-1 text-[10px] font-semibold border border-[var(--border)] rounded-lg hover:bg-gray-50 transition-colors"
                      >
                        {t.label}
                      </button>
                    ))}
                  </div>
                  <div className="flex gap-3">
                    <textarea
                      ref={replyRef}
                      value={reply}
                      onChange={(e) => setReply(e.target.value)}
                      placeholder="Type your reply to Admin…"
                      rows={3}
                      className="flex-1 border border-[var(--border)] rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 resize-none"
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) handleReply();
                      }}
                    />
                    <button
                      onClick={handleReply}
                      disabled={sending || !reply.trim()}
                      className="flex items-center gap-2 px-4 py-2 bg-primary text-white text-sm font-semibold rounded-lg hover:bg-primary/90 transition-colors disabled:opacity-50 self-end"
                    >
                      <Send size={14} /> {sending ? '…' : 'Reply'}
                    </button>
                  </div>
                  <p className="text-[10px] text-[var(--muted-foreground)] mt-1">
                    Ctrl+Enter to send
                  </p>
                </div>
              </>
            ) : (
              <div className="flex-1 flex flex-col items-center justify-center text-[var(--muted-foreground)]">
                <MessageCircle size={48} className="mb-3 opacity-20" />
                <p className="text-sm font-medium">Select a message or compose new</p>
                <p className="text-xs mt-1">All messages are routed through Admin</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </AppLayout>
  );
}
