"""Integrações somente leitura. Nenhum método movimenta dinheiro ou altera produto."""
import hashlib


def hash_comprador(email: str | None) -> str | None:
    """Guarda só um hash do e-mail (para contar compradores únicos), nunca o dado bruto."""
    if not email:
        return None
    return hashlib.sha256(email.strip().lower().encode()).hexdigest()[:16]
