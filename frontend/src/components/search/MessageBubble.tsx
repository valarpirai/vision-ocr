import { useState } from "react";
import type { Message } from "../../types";

interface Props {
  message: Message;
}

export default function MessageBubble({ message }: Props) {
  const [sourcesOpen, setSourcesOpen] = useState(false);
  const isUser = message.role === "user";

  return (
    <div className={`flex ${isUser ? "justify-end" : "justify-start"}`}>
      <div
        className={`max-w-[80%] rounded-2xl px-4 py-3 ${
          isUser
            ? "bg-green-600 text-white rounded-br-sm"
            : "bg-white border border-gray-200 text-gray-800 rounded-bl-sm shadow-sm"
        }`}
      >
        <p className="text-sm whitespace-pre-wrap leading-relaxed">{message.content}</p>

        {!isUser && message.sources && message.sources.length > 0 && (
          <div className="mt-2 pt-2 border-t border-gray-100">
            <button
              onClick={() => setSourcesOpen((o) => !o)}
              className="text-xs text-green-600 hover:text-green-700 font-medium flex items-center gap-1"
            >
              {sourcesOpen ? "▼" : "▶"} Sources ({message.sources.length})
            </button>
            {sourcesOpen && (
              <ul className="mt-1.5 space-y-1">
                {message.sources.map((src, i) => (
                  <li key={i} className="flex items-center gap-1.5">
                    <span className="text-gray-400">📄</span>
                    <a
                      href={`/history?upload=${src.upload_id}`}
                      className="text-xs text-blue-600 hover:underline truncate"
                    >
                      {src.filename}
                    </a>
                    <span className="text-xs text-gray-400 flex-shrink-0">
                      p.{src.page_number}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
