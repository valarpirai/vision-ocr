import type { ConversationListItem } from "../../types";

interface Props {
  conversations: ConversationListItem[];
  activeId: string | null;
  onSelect: (id: string) => void;
  onCreate: () => void;
  onDelete: (id: string) => void;
  loading: boolean;
}

export default function ConversationSidebar({
  conversations,
  activeId,
  onSelect,
  onCreate,
  onDelete,
  loading,
}: Props) {
  return (
    <div className="w-64 flex-shrink-0 border-r border-gray-200 bg-gray-50 flex flex-col h-full">
      <div className="p-3 border-b border-gray-200">
        <button
          onClick={onCreate}
          disabled={loading}
          className="w-full py-2 px-3 bg-green-600 text-white text-sm font-medium rounded-lg hover:bg-green-700 disabled:opacity-50 transition-colors"
        >
          + New Chat
        </button>
      </div>

      <div className="flex-1 overflow-y-auto">
        {conversations.length === 0 && (
          <p className="text-xs text-gray-400 text-center mt-6 px-3">
            No conversations yet. Start a new chat!
          </p>
        )}
        {conversations.map((conv) => (
          <div
            key={conv.id}
            onClick={() => onSelect(conv.id)}
            className={`group flex items-start justify-between px-3 py-3 cursor-pointer border-b border-gray-100 hover:bg-white transition-colors ${
              activeId === conv.id ? "bg-white border-l-2 border-l-green-500" : ""
            }`}
          >
            <div className="flex-1 min-w-0">
              <p className="text-sm text-gray-800 truncate">
                {conv.title || "New conversation"}
              </p>
              <p className="text-xs text-gray-400 mt-0.5">
                {new Date(conv.updated_at).toLocaleDateString()}{" "}
                · {conv.message_count} msg{conv.message_count !== 1 ? "s" : ""}
              </p>
            </div>
            <button
              onClick={(e) => {
                e.stopPropagation();
                onDelete(conv.id);
              }}
              className="ml-1 mt-0.5 text-gray-300 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0 text-xs"
              title="Delete conversation"
            >
              ✕
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
