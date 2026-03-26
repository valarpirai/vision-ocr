import { useState, useEffect, useRef } from "react";
import type { ConversationListItem, Message, UploadListItem } from "../types";
import {
  createConversation,
  getConversations,
  getConversation,
  deleteConversation,
  askQuestion,
  getUploads,
} from "../api/client";
import ConversationSidebar from "../components/search/ConversationSidebar";
import DocumentFilter from "../components/search/DocumentFilter";
import MessageBubble from "../components/search/MessageBubble";
import ChatInput from "../components/search/ChatInput";

export default function SearchPage() {
  const [conversations, setConversations] = useState<ConversationListItem[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [availableUploads, setAvailableUploads] = useState<UploadListItem[]>([]);
  const [selectedUploadIds, setSelectedUploadIds] = useState<string[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    loadConversations();
    loadUploads();
  }, []);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const loadConversations = async () => {
    try {
      const data = await getConversations();
      setConversations(data);
    } catch {
      setError("Failed to load conversations.");
    }
  };

  const loadUploads = async () => {
    try {
      const data = await getUploads(0, 100, "completed");
      setAvailableUploads(data);
    } catch {
      // Non-fatal
    }
  };

  const handleNewChat = async () => {
    setLoading(true);
    setError(null);
    try {
      const conv = await createConversation();
      setConversations((prev) => [conv, ...prev]);
      setActiveId(conv.id);
      setMessages([]);
    } catch {
      setError("Failed to create conversation.");
    } finally {
      setLoading(false);
    }
  };

  const handleSelectConversation = async (id: string) => {
    if (id === activeId) return;
    setActiveId(id);
    setMessages([]);
    setError(null);
    setLoading(true);
    try {
      const conv = await getConversation(id);
      setMessages(conv.messages);
    } catch {
      setError("Failed to load conversation.");
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteConversation = async (id: string) => {
    try {
      await deleteConversation(id);
      setConversations((prev) => prev.filter((c) => c.id !== id));
      if (activeId === id) {
        setActiveId(null);
        setMessages([]);
      }
    } catch {
      setError("Failed to delete conversation.");
    }
  };

  const handleSend = async () => {
    if (!input.trim() || !activeId || sending) return;

    const question = input.trim();
    setInput("");
    setSending(true);
    setError(null);

    const userMessage: Message = {
      id: Date.now(),
      role: "user",
      content: question,
      created_at: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, userMessage]);

    try {
      const response = await askQuestion(activeId, {
        question,
        upload_ids: selectedUploadIds.length > 0 ? selectedUploadIds : undefined,
      });

      const assistantMessage: Message = {
        id: response.message_id,
        role: "assistant",
        content: response.answer,
        sources: response.sources,
        created_at: new Date().toISOString(),
      };
      setMessages((prev) => [...prev, assistantMessage]);

      // Update conversation list (updated_at and title may have changed)
      loadConversations();
    } catch (err: unknown) {
      const detail =
        err && typeof err === "object" && "response" in err
          ? (err as { response?: { data?: { detail?: string } } }).response?.data?.detail
          : null;
      setError(detail || "Failed to get an answer. Make sure Ollama is running.");
      setMessages((prev) => prev.filter((m) => m.id !== userMessage.id));
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="flex h-[calc(100vh-4rem)] overflow-hidden">
      <ConversationSidebar
        conversations={conversations}
        activeId={activeId}
        onSelect={handleSelectConversation}
        onCreate={handleNewChat}
        onDelete={handleDeleteConversation}
        loading={loading}
      />

      <div className="flex-1 flex flex-col min-w-0">
        {/* Header with document filter */}
        <div className="px-4 py-3 border-b border-gray-200 bg-white flex items-center gap-3 flex-wrap">
          <span className="text-sm text-gray-500 flex-shrink-0">Search in:</span>
          <DocumentFilter
            uploads={availableUploads}
            selectedIds={selectedUploadIds}
            onChange={setSelectedUploadIds}
          />
        </div>

        {/* Messages area */}
        <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4 bg-gray-50">
          {!activeId && (
            <div className="flex flex-col items-center justify-center h-full text-center">
              <div className="text-4xl mb-3">🔍</div>
              <h2 className="text-lg font-semibold text-gray-700">Search Your Documents</h2>
              <p className="text-sm text-gray-500 mt-1 max-w-sm">
                Start a new chat to ask questions about your uploaded and processed documents.
              </p>
              <button
                onClick={handleNewChat}
                disabled={loading}
                className="mt-4 px-5 py-2 bg-green-600 text-white text-sm font-medium rounded-lg hover:bg-green-700 disabled:opacity-50 transition-colors"
              >
                New Chat
              </button>
            </div>
          )}

          {activeId && messages.length === 0 && !loading && (
            <div className="flex flex-col items-center justify-center h-full text-center">
              <div className="text-3xl mb-2">💬</div>
              <p className="text-sm text-gray-500">
                Ask anything about your documents. Follow-up questions are supported.
              </p>
            </div>
          )}

          {loading && messages.length === 0 && (
            <div className="flex justify-center mt-8">
              <span className="text-sm text-gray-400">Loading...</span>
            </div>
          )}

          {messages.map((msg) => (
            <MessageBubble key={msg.id} message={msg} />
          ))}

          {sending && (
            <div className="flex justify-start">
              <div className="bg-white border border-gray-200 rounded-2xl rounded-bl-sm px-4 py-3 shadow-sm">
                <span className="text-sm text-gray-400 animate-pulse">Thinking...</span>
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Error banner */}
        {error && (
          <div className="px-4 py-2 bg-red-50 border-t border-red-200 text-sm text-red-600 flex items-center justify-between">
            <span>{error}</span>
            <button onClick={() => setError(null)} className="ml-2 text-red-400 hover:text-red-600">
              ✕
            </button>
          </div>
        )}

        {/* Input */}
        {activeId && (
          <ChatInput
            value={input}
            onChange={setInput}
            onSubmit={handleSend}
            disabled={sending || loading}
          />
        )}
      </div>
    </div>
  );
}
