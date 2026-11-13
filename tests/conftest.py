import os
import pytest


@pytest.fixture(autouse=True)
def ambiente(tmp_path, monkeypatch):
    monkeypatch.setenv("REX_LLM_FAKE", "1")
    monkeypatch.setenv("REX_DB_PATH", str(tmp_path / "t.db"))
    monkeypatch.setenv("REX_SAIDAS", str(tmp_path / "saidas"))
    monkeypatch.setenv("REX_LOG_DIR", str(tmp_path / "log"))
    for k in list(os.environ):
        if k.startswith("REX_") and k.endswith(("_SECRET", "_ID", "_KEY", "_BASIC")):
            monkeypatch.delenv(k)
    from rendaextra import agentes, config
    config.limpar_cache()
    agentes.todos.cache_clear()
    yield
    config.limpar_cache()
