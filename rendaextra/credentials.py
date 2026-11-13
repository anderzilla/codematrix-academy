"""Credenciais no cofre do sistema (Windows Credential Manager via keyring).

Nunca grava segredos em arquivo. Em servidores sem cofre, aceita variáveis de ambiente
REX_<CHAVE_EM_MAIUSCULAS> definidas apenas na sessão.
"""
from __future__ import annotations

import getpass
import os

SERVICO = "rendaextra"

CHAVES = {
    "kiwify": ["kiwify_client_id", "kiwify_client_secret", "kiwify_account_id"],
    "hotmart": ["hotmart_client_id", "hotmart_client_secret", "hotmart_basic"],
    "anthropic": ["anthropic_api_key"],
    "openai": ["openai_api_key"],
    "azure_tts": ["azure_speech_key"],
    "elevenlabs": ["elevenlabs_api_key"],
}


def _keyring():
    try:
        import keyring  # noqa: PLC0415

        return keyring
    except Exception:  # pragma: no cover - ambiente sem keyring
        return None


def obter(chave: str) -> str | None:
    env = os.environ.get("REX_" + chave.upper())
    if env:
        return env
    kr = _keyring()
    if kr is None:
        return None
    try:
        return kr.get_password(SERVICO, chave)
    except Exception:
        return None


def salvar(chave: str, valor: str) -> None:
    kr = _keyring()
    if kr is None:
        raise RuntimeError("keyring indisponível: instale com `pip install keyring`.")
    kr.set_password(SERVICO, chave, valor)


def tem(grupo: str) -> bool:
    return all(obter(c) for c in CHAVES[grupo])


def mascarar(valor: str | None) -> str:
    if not valor:
        return "(vazio)"
    return valor[:3] + "…" + valor[-2:] if len(valor) > 8 else "••••"


def assistente_interativo() -> None:
    """Pergunta cada credencial sem ecoar na tela e grava no cofre."""
    print("Credenciais ficam no cofre do sistema (serviço 'rendaextra'). Enter = manter atual.\n")
    for grupo, chaves in CHAVES.items():
        print(f"== {grupo} ==")
        for c in chaves:
            atual = obter(c)
            valor = getpass.getpass(f"  {c} [{mascarar(atual)}]: ").strip()
            if valor:
                salvar(c, valor)
                print("    salvo.")
    print("\nPronto. Rode `rex status` para conferir.")
