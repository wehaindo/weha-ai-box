'use client';

import { useState, useEffect, useRef, useCallback, memo } from 'react';
import { runtimeCall } from '@/lib/device-config';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { cn } from '@/lib/utils';
import {
  Plus,
  Trash2,
  Send,
  MessageSquareText,
  Bot,
  User,
  Wrench,
  Loader2,
  CheckCircle2,
  XCircle,
  Search,
  Pencil,
  Sparkles,
  ChevronDown,
  ChevronUp,
  Clock,
} from 'lucide-react';

interface ToolChip {
  id: string;
  name: string;
  status: 'ok' | 'error';
  summary: string;
  durationMs?: number;
}

interface Message {
  id: string;
  role: 'USER' | 'ASSISTANT' | 'TOOL' | 'SYSTEM';
  content: string;
  toolCalls: { id: string; function: { name: string; arguments: string } }[] | null;
  toolResults: { id: string; result: string }[] | null;
  tokenUsage: number;
  model: string | null;
  createdAt: string;
}

interface ConversationSummary {
  id: string;
  title: string;
  messageCount: number;
  updatedAt: string;
}

interface AvailableTool {
  functionName: string;
  kind: string;
  name: string;
  description: string | null;
}

interface AvailableAgent {
  agentId: string;
  code: string;
  name: string;
  description: string | null;
  type: string | null;
  version: number;
}

function timeAgo(iso: string): string {
  if (!iso) return '';
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'now';
  if (mins < 60) return `${mins}m`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d`;
  return new Date(iso).toLocaleDateString();
}

function formatTime(iso: string): string {
  if (!iso) return '';
  return new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

const toolChips = (m: Message): ToolChip[] => {
  if (!m.toolCalls || m.toolCalls.length === 0) return [];
  const results = new Map((m.toolResults || []).map((r) => [r.id, r.result]));
  return m.toolCalls.map((tc) => {
    const result = results.get(tc.id) || '';
    return {
      id: tc.id,
      name: tc.function.name,
      status: result.startsWith('ERROR:') ? 'error' : 'ok',
      summary: result || 'no result',
    };
  });
};

const MessageBubble = memo(function MessageBubble({ message }: { message: Message }) {
  const isUser = message.role === 'USER';
  const chips = toolChips(message);

  if (message.role === 'TOOL' || message.role === 'SYSTEM') return null;

  return (
    <div className={cn('flex gap-3', isUser ? 'justify-end' : 'justify-start')}>
      <div className={cn('flex items-start gap-3 max-w-[85%]', isUser && 'flex-row-reverse')}>
        <div
          className={cn(
            'flex h-9 w-9 shrink-0 items-center justify-center rounded-full shadow-sm ring-1 ring-black/5',
            isUser
              ? 'bg-gradient-to-br from-amber-500 to-orange-500 text-white'
              : 'bg-gradient-to-br from-slate-700 to-slate-900 text-slate-100 dark:from-slate-600 dark:to-slate-800'
          )}
        >
          {isUser ? <User size={16} /> : <Bot size={16} />}
        </div>
        <div className={cn('space-y-1.5')}>
          <div
            className={cn(
              'rounded-2xl px-4 py-3 text-sm leading-relaxed whitespace-pre-wrap shadow-sm',
              isUser
                ? 'bg-gradient-to-br from-amber-500 to-orange-500 text-white rounded-tr-sm'
                : 'bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-tl-sm shadow-sm'
            )}
          >
            {message.content || (
              <span className="text-slate-400 dark:text-slate-500 italic">No text content</span>
            )}
          </div>

          {chips.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {chips.map((chip) => (
                <div
                  key={chip.id}
                  title={chip.summary}
                  className={cn(
                    'flex items-center gap-1.5 rounded-lg border px-2 py-1 text-[11px] font-medium',
                    chip.status === 'ok'
                      ? 'border-green-200 bg-green-50 text-green-700 dark:border-green-800 dark:bg-green-950 dark:text-green-300'
                      : 'border-red-200 bg-red-50 text-red-700 dark:border-red-800 dark:bg-red-950 dark:text-red-300'
                  )}
                >
                  <Wrench size={11} />
                  <span className="max-w-[180px] truncate">{chip.name}</span>
                  {chip.status === 'ok' ? <CheckCircle2 size={11} /> : <XCircle size={11} />}
                </div>
              ))}
            </div>
          )}

          {message.createdAt && (
            <p className={cn('text-[10px] text-slate-400', isUser ? 'text-right' : 'text-left')}>
              {formatTime(message.createdAt)}
              {message.model ? ` · ${message.model}` : ''}
            </p>
          )}
        </div>
      </div>
    </div>
  );
});

const SUGGESTIONS = [
  { icon: Bot, label: 'Run an agent', prompt: 'run daily sales report agent' },
  { icon: Wrench, label: 'Call a tool', prompt: 'check inventory stock' },
  { icon: Sparkles, label: 'Explain the system', prompt: 'What can you do?' },
];

export default function ChatPage() {
  const [conversations, setConversations] = useState<ConversationSummary[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [activeTitle, setActiveTitle] = useState('');
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [thinking, setThinking] = useState<string | null>(null);
  const [availableTools, setAvailableTools] = useState<AvailableTool[]>([]);
  const [availableAgents, setAvailableAgents] = useState<AvailableAgent[]>([]);
  const [search, setSearch] = useState('');
  const [showAvailable, setShowAvailable] = useState(true);
  const [renameId, setRenameId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState('');
  const [deleteTarget, setDeleteTarget] = useState<ConversationSummary | null>(null);
  const [deleting, setDeleting] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const loadCatalog = useCallback(async () => {
    try {
      const toolsRes = (await runtimeCall('GET', '/api/chat/tools')) as any;
      setAvailableTools((toolsRes?.data || []).filter((t: AvailableTool) => t.kind === 'mcp' || t.kind === 'local'));
    } catch {
      setAvailableTools([]);
    }
    try {
      const agentsRes = (await runtimeCall('GET', '/api/agents')) as any;
      setAvailableAgents(agentsRes?.data || []);
    } catch {
      setAvailableAgents([]);
    }
  }, []);

  useEffect(() => {
    loadCatalog();
  }, [loadCatalog]);

  const loadConversations = useCallback(async () => {
    try {
      const res = (await runtimeCall('GET', '/api/chat/conversations')) as any;
      setConversations(res?.data || []);
      return res?.data || [];
    } finally {
      setLoading(false);
    }
  }, []);

  const loadMessages = useCallback(async (id: string) => {
    const res = (await runtimeCall('GET', `/api/chat/conversations/${id}`)) as any;
    setMessages(res?.data?.messages || []);
  }, []);

  useEffect(() => {
    loadConversations().then((list) => {
      if (list.length > 0) {
        setActiveId(list[0].id);
        setActiveTitle(list[0].title);
        loadMessages(list[0].id);
      }
    });
  }, [loadConversations, loadMessages]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages, thinking]);

  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 160)}px`;
    }
  }, [input]);

  async function newConversation() {
    const res = (await runtimeCall('POST', '/api/chat/conversations', {})) as any;
    const created = res?.data;
    if (!created) return;
    setConversations((prev) => [{ ...created, messageCount: 0 }, ...prev]);
    setActiveId(created.id);
    setActiveTitle(created.title);
    setMessages([]);
    setSearch('');
  }

  async function renameConversation() {
    if (!renameId || !renameValue.trim()) return;
    const title = renameValue.trim();
    await runtimeCall('PATCH', `/api/chat/conversations/${renameId}`, { title });
    setConversations((prev) => prev.map((c) => (c.id === renameId ? { ...c, title } : c)));
    if (activeId === renameId) setActiveTitle(title);
    setRenameId(null);
  }

  async function deleteConversation(id: string) {
    setDeleting(true);
    try {
      await runtimeCall('DELETE', `/api/chat/conversations/${id}`);
      const remaining = conversations.filter((c) => c.id !== id);
      setConversations(remaining);
      if (id === activeId) {
        if (remaining.length > 0) {
          setActiveId(remaining[0].id);
          setActiveTitle(remaining[0].title);
          loadMessages(remaining[0].id);
        } else {
          setActiveId(null);
          setActiveTitle('');
          setMessages([]);
        }
      }
    } finally {
      setDeleting(false);
      setDeleteTarget(null);
    }
  }

  async function selectConversation(id: string) {
    const conv = conversations.find((c) => c.id === id);
    setActiveId(id);
    setActiveTitle(conv?.title ?? '');
    setMessages([]);
    await loadMessages(id);
  }

  async function sendMessage() {
    const content = input.trim();
    if (!content || !activeId || sending) return;
    setInput('');
    setSending(true);
    setThinking('Thinking...');
    setMessages((prev) => [
      ...prev,
      {
        id: `local_${Date.now()}`,
        role: 'USER',
        content,
        toolCalls: null,
        toolResults: null,
        tokenUsage: 0,
        model: null,
        createdAt: new Date().toISOString(),
      },
    ]);
    try {
      const res = (await runtimeCall('POST', `/api/chat/conversations/${activeId}/messages`, { content })) as any;
      const result = res?.data;
      if (result) {
        await loadMessages(activeId);
      } else if (res?.error) {
        setMessages((prev) => [
          ...prev,
          {
            id: `err_${Date.now()}`,
            role: 'ASSISTANT',
            content: `Error: ${res.error}`,
            toolCalls: null,
            toolResults: null,
            tokenUsage: 0,
            model: null,
            createdAt: new Date().toISOString(),
          },
        ]);
      }
      const updated = await loadConversations();
      const conv = updated.find((c: any) => c.id === activeId);
      if (conv) {
        setConversations((prev) => [conv, ...prev.filter((c) => c.id !== activeId)]);
        setActiveTitle(conv.title);
      }
    } catch (err: any) {
      setMessages((prev) => [
        ...prev,
        {
          id: `err_${Date.now()}`,
          role: 'ASSISTANT',
          content: `Request failed: ${err?.message || 'unknown error'}`,
          toolCalls: null,
          toolResults: null,
          tokenUsage: 0,
          model: null,
          createdAt: new Date().toISOString(),
        },
      ]);
    } finally {
      setSending(false);
      setThinking(null);
      textareaRef.current?.focus();
    }
  }

  const filteredConversations = conversations.filter((c) =>
    c.title.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="flex h-[calc(100vh-3rem)] gap-4">
      {/* Conversation list */}
      <aside className="w-72 shrink-0 flex flex-col bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden">
        <div className="p-3 space-y-2 border-b border-slate-100 dark:border-slate-700">
          <div className="flex items-center justify-between px-1">
            <h2 className="text-sm font-semibold text-slate-800 dark:text-slate-100">Chats</h2>
            {conversations.length > 0 && (
              <span className="text-xs text-slate-400">{conversations.length}</span>
            )}
          </div>
          <Button className="w-full justify-start gap-2" onClick={newConversation}>
            <Plus size={16} /> New Chat
          </Button>
          <div className="relative">
            <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search chats..."
              className="pl-8 h-8 text-sm"
            />
          </div>
        </div>
        <ScrollArea className="flex-1">
          <div className="p-2 space-y-1">
            {loading ? (
              <div className="flex items-center justify-center gap-2 p-6 text-sm text-slate-400">
                <Loader2 size={14} className="animate-spin" /> Loading...
              </div>
            ) : filteredConversations.length === 0 ? (
              <div className="p-6 text-center text-sm text-slate-400">
                {search ? 'No chats match your search.' : 'No conversations yet. Start a new chat.'}
              </div>
            ) : (
              filteredConversations.map((c) => (
                <div
                  key={c.id}
                  onClick={() => selectConversation(c.id)}
                  className={cn(
                    'group flex items-center gap-2 rounded-lg px-3 py-2.5 cursor-pointer transition-colors',
                    c.id === activeId
                      ? 'bg-amber-500 text-white'
                      : 'text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700/50'
                  )}
                >
                  <MessageSquareText size={15} className="shrink-0 opacity-70" />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <span className="truncate text-sm font-medium">{c.title}</span>
                      <span
                        className={cn(
                          'text-[10px] shrink-0',
                          c.id === activeId ? 'text-white/70' : 'text-slate-400'
                        )}
                      >
                        {timeAgo(c.updatedAt)}
                      </span>
                    </div>
                    <div
                      className={cn(
                        'text-[11px]',
                        c.id === activeId ? 'text-white/70' : 'text-slate-400'
                      )}
                    >
                      {c.messageCount} message{c.messageCount === 1 ? '' : 's'}
                    </div>
                  </div>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setDeleteTarget(c);
                    }}
                    title="Delete chat"
                    className={cn(
                      'shrink-0 rounded-md p-1.5 transition-colors',
                      'opacity-0 group-hover:opacity-100 focus:opacity-100',
                      c.id === activeId
                        ? 'text-white/70 hover:text-white hover:bg-white/20'
                        : 'text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950/50'
                    )}
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              ))
            )}
          </div>
        </ScrollArea>

        <div className="border-t border-slate-100 dark:border-slate-700">
          <button
            onClick={() => setShowAvailable(!showAvailable)}
            className="flex w-full items-center justify-between px-4 py-2.5 text-[11px] font-semibold uppercase tracking-wide text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition-colors"
          >
            <span>Available</span>
            {showAvailable ? <ChevronDown size={14} /> : <ChevronUp size={14} />}
          </button>
          {showAvailable && (
            <div className="px-3 pb-3 space-y-2 max-h-48 overflow-y-auto">
              {(availableAgents.length === 0 && availableTools.length === 0) && (
                <p className="text-[11px] text-slate-400">Nothing loaded yet.</p>
              )}
              {availableAgents.length > 0 && (
                <div className="space-y-1">
                  {availableAgents.map((a) => (
                    <button
                      key={a.agentId}
                      onClick={() => setInput(`run ${a.name}`)}
                      title={a.description || a.name}
                      className="flex w-full items-center gap-2 rounded-lg border border-slate-200 dark:border-slate-700 px-2 py-1.5 text-left text-[11px] text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors"
                    >
                      <Bot size={11} className="shrink-0 text-purple-500" />
                      <span className="truncate font-medium">{a.name}</span>
                    </button>
                  ))}
                </div>
              )}
              {availableTools.length > 0 && (
                <div className="space-y-1">
                  {availableTools.map((t) => (
                    <button
                      key={t.functionName}
                      onClick={() => setInput(`run ${t.name}`)}
                      title={t.description || t.name}
                      className="flex w-full items-center gap-2 rounded-lg border border-slate-200 dark:border-slate-700 px-2 py-1.5 text-left text-[11px] text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors"
                    >
                      <Wrench size={11} className="shrink-0 text-cyan-500" />
                      <span className="truncate font-medium">{t.name}</span>
                    </button>
                  ))}
                </div>
              )}
              <p className="text-[10px] text-slate-400">Click a name to insert a prompt.</p>
            </div>
          )}
        </div>
      </aside>

      {/* Chat area */}
      <main className="flex-1 flex flex-col bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden">
        {activeId ? (
          <>
            <header className="flex items-center gap-3 px-4 py-3 border-b border-slate-100 dark:border-slate-700 bg-white/80 dark:bg-slate-800/80 backdrop-blur">
              {renameId === activeId ? (
                <form
                  className="flex items-center gap-2 flex-1 min-w-0"
                  onSubmit={(e) => {
                    e.preventDefault();
                    renameConversation();
                  }}
                >
                  <Input
                    autoFocus
                    value={renameValue}
                    onChange={(e) => setRenameValue(e.target.value)}
                    onBlur={() => renameId && renameValue.trim() ? renameConversation() : setRenameId(null)}
                    onKeyDown={(e) => {
                      if (e.key === 'Escape') {
                        setRenameId(null);
                      }
                    }}
                    className="h-8 flex-1 text-sm"
                  />
                  <Button type="submit" size="sm" variant="secondary">Save</Button>
                  <Button type="button" size="sm" variant="ghost" onClick={() => setRenameId(null)}>Cancel</Button>
                </form>
              ) : (
                <div className="flex items-center gap-2 flex-1 min-w-0">
                  <h1 className="text-sm font-semibold text-slate-800 dark:text-slate-100 truncate">
                    {activeTitle}
                  </h1>
                  <button
                    onClick={() => {
                      setRenameId(activeId);
                      setRenameValue(activeTitle);
                    }}
                    title="Rename chat"
                    className="shrink-0 rounded-md p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700/50 transition-colors"
                  >
                    <Pencil size={13} />
                  </button>
                </div>
              )}
              <div className="flex items-center gap-2 shrink-0">
                <span className="text-xs text-slate-400 hidden sm:inline-flex items-center gap-1.5">
                  <MessageSquareText size={12} />
                  {messages.length} message{messages.length === 1 ? '' : 's'}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setDeleteTarget(conversations.find((c) => c.id === activeId) || null)}
                  className="text-red-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/50"
                >
                  <Trash2 size={14} />
                  <span className="hidden md:inline">Delete</span>
                </Button>
              </div>
            </header>

            <div ref={scrollRef} className="flex-1 overflow-y-auto">
              <div className="mx-auto max-w-3xl p-6 space-y-5">
                {messages.length === 0 && !sending ? (
                  <div className="flex flex-col items-center justify-center min-h-[60vh] text-center gap-4">
                    <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-amber-500 to-orange-500 text-white shadow-lg shadow-amber-500/25">
                      <Bot size={28} />
                    </div>
                    <div>
                      <h2 className="text-lg font-semibold text-slate-800 dark:text-slate-100">
                        Hi, I'm the WEHA AI Box assistant
                      </h2>
                      <p className="mt-1 text-sm text-slate-500 dark:text-slate-400 max-w-sm">
                        I can run deployed agents, call MCP tools, and answer questions about your system.
                      </p>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 w-full max-w-md mt-2">
                      {SUGGESTIONS.map((s) => (
                        <button
                          key={s.prompt}
                          onClick={() => setInput(s.prompt)}
                          className="flex flex-col items-center gap-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-700/40 px-3 py-3 text-center hover:border-amber-300 dark:hover:border-amber-700 hover:bg-amber-50 dark:hover:bg-amber-950/30 transition-all group"
                        >
                          <s.icon size={18} className="text-amber-500" />
                          <span className="text-xs font-medium text-slate-600 dark:text-slate-300">
                            {s.label}
                          </span>
                        </button>
                      ))}
                    </div>
                  </div>
                ) : (
                  messages.map((m) => <MessageBubble key={m.id} message={m} />)
                )}
                {sending && (
                  <div className="flex items-start gap-3">
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-slate-700 to-slate-900 text-slate-100">
                      <Bot size={16} />
                    </div>
                    <div className="flex items-center gap-2 rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-4 py-3 text-sm text-slate-500">
                      <Loader2 size={14} className="animate-spin" />
                      {thinking || 'Working...'}
                    </div>
                  </div>
                )}
              </div>
            </div>

            <div className="border-t border-slate-100 dark:border-slate-700 p-4">
              <div className="mx-auto max-w-3xl">
                <div className="flex items-end gap-2">
                  <Textarea
                    ref={textareaRef}
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && !e.shiftKey) {
                        e.preventDefault();
                        sendMessage();
                      }
                    }}
                    placeholder="Ask something, e.g. 'Run the daily sales report agent'"
                    rows={1}
                    className="max-h-40"
                    disabled={sending}
                  />
                  <Button
                    onClick={sendMessage}
                    disabled={sending || !input.trim()}
                    size="icon"
                    className="h-10 w-10 shrink-0 rounded-lg"
                  >
                    <Send size={16} />
                  </Button>
                </div>
                <div className="mt-2 flex items-center justify-between text-[11px] text-slate-400">
                  <span className="flex items-center gap-1">
                    <Clock size={11} /> Enter to send · Shift+Enter for new line
                  </span>
                  <span>The assistant can call MCP tools and run deployed agents.</span>
                </div>
              </div>
            </div>
          </>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center text-center gap-4 p-8">
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-amber-500 to-orange-500 text-white shadow-lg shadow-amber-500/25">
              <MessageSquareText size={28} />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-slate-800 dark:text-slate-100">
                Start a conversation
              </h2>
              <p className="mt-1 text-sm text-slate-500 dark:text-slate-400 max-w-sm">
                Ask the AI assistant to run MCP tools or agents.
              </p>
            </div>
            <Button onClick={newConversation}>
              <Plus size={16} /> Start a conversation
            </Button>
          </div>
        )}
      </main>

      {/* Delete confirmation */}
      <Dialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Delete this chat?</DialogTitle>
            <DialogDescription>
              This will permanently delete <span className="font-medium text-slate-700 dark:text-slate-200">&ldquo;{deleteTarget?.title}&rdquo;</span> and all its messages. This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setDeleteTarget(null)} disabled={deleting}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() => deleteTarget && deleteConversation(deleteTarget.id)}
              disabled={deleting}
            >
              {deleting ? (
                <>
                  <Loader2 size={14} className="animate-spin" /> Deleting...
                </>
              ) : (
                <>
                  <Trash2 size={14} /> Delete
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
