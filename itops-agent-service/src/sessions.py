"""会话历史 —— 按 sessionKey 维护轻量滚动上下文（内存态，进程重启即弃）

远端 Provider 契约中的 sessionKey 语义：同一会话保持上下文。
这里不引入 PydanticAI 的 message_history（跨版本兼容成本高），
而是把最近 N 轮对话渲染为文本块，由 API 层注入提示词上下文。
"""

from __future__ import annotations

import threading
from collections import OrderedDict, deque
from typing import Optional

# context 中用于传会话标识的键（渲染上下文时排除，避免噪音）
SESSION_KEY_FIELDS = ("sessionKey", "session_key", "sessionId", "session_id")


class SessionStore:
    """线程安全的会话滚动缓冲（LRU 限制会话数，防止内存无界增长）"""

    def __init__(
        self,
        max_sessions: int = 512,
        max_turns: int = 6,
        max_chars: int = 4000,
    ):
        self._max_sessions = max_sessions
        self._max_turns = max_turns
        self._max_chars = max_chars
        self._lock = threading.Lock()
        self._sessions: "OrderedDict[str, deque[dict[str, str]]]" = OrderedDict()

    def remember(self, session_key: str, user_message: str, assistant_reply: str) -> None:
        """记录一轮成功对话"""
        user_message = (user_message or "").strip()
        assistant_reply = (assistant_reply or "").strip()
        if not user_message or not assistant_reply:
            return
        with self._lock:
            turns = self._sessions.get(session_key)
            if turns is None:
                if len(self._sessions) >= self._max_sessions:
                    self._sessions.popitem(last=False)
                turns = deque(maxlen=self._max_turns)
                self._sessions[session_key] = turns
            else:
                self._sessions.move_to_end(session_key)
            turns.append({"user": user_message, "assistant": assistant_reply})

    def render(self, session_key: str) -> str:
        """渲染为注入提示词的历史文本块；无历史时返回空串"""
        with self._lock:
            turns = self._sessions.get(session_key)
            if not turns:
                return ""
            lines: list[str] = []
            total = 0
            for turn in reversed(turns):
                block = f"用户：{turn['user']}\n助手：{turn['assistant']}"
                if lines and total + len(block) > self._max_chars:
                    break
                lines.append(block)
                total += len(block)
            lines.reverse()
            return "\n\n".join(lines)

    def clear(self, session_key: Optional[str] = None) -> None:
        """清空指定会话（缺省清空全部）"""
        with self._lock:
            if session_key is None:
                self._sessions.clear()
            else:
                self._sessions.pop(session_key, None)


# 全局会话存储实例
session_store = SessionStore()
