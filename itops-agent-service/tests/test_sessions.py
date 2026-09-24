"""测试会话历史模块"""

from src.sessions import SESSION_KEY_FIELDS, SessionStore


def test_remember_and_render():
    store = SessionStore()
    store.remember("s1", "CPU过高怎么办", "先查top定位进程")
    store.remember("s1", "还是高", "检查是否有死循环")
    text = store.render("s1")
    assert "CPU过高怎么办" in text
    assert "先查top定位进程" in text
    assert "检查是否有死循环" in text
    # 按时间顺序渲染
    assert text.index("CPU过高怎么办") < text.index("还是高")


def test_render_empty_returns_blank():
    store = SessionStore()
    assert store.render("missing") == ""


def test_max_turns_rolling():
    store = SessionStore(max_turns=2)
    for i in range(5):
        store.remember("s", f"q{i}", f"a{i}")
    text = store.render("s")
    # 只保留最近 2 轮：q3、q4
    assert "q4" in text
    assert "q3" in text
    assert "q2" not in text


def test_max_chars_limit():
    store = SessionStore(max_turns=10, max_chars=50)
    store.remember("s", "x" * 60, "y" * 10)
    store.remember("s", "short", "reply")
    text = store.render("s")
    # 超限的旧轮次被截掉，只保留最近一轮
    assert "short" in text
    assert "x" * 60 not in text


def test_lru_eviction():
    store = SessionStore(max_sessions=2)
    store.remember("s1", "q", "a")
    store.remember("s2", "q", "a")
    store.remember("s3", "q", "a")  # 淘汰最久未活跃的 s1
    assert store.render("s1") == ""
    assert store.render("s3") != ""


def test_clear():
    store = SessionStore()
    store.remember("s1", "q", "a")
    store.clear("s1")
    assert store.render("s1") == ""
    store.remember("s2", "q", "a")
    store.clear()
    assert store.render("s2") == ""


def test_empty_messages_ignored():
    store = SessionStore()
    store.remember("s1", "", "a")
    store.remember("s1", "q", "  ")
    assert store.render("s1") == ""


def test_session_key_fields():
    assert "sessionKey" in SESSION_KEY_FIELDS
    assert "session_key" in SESSION_KEY_FIELDS
