# Usar o Ollama do servidor de IA a partir do Windows

No servidor Ubuntu (anderzilla-rog hoje; o PC com RTX 2060 12 GB quando você trocar):

```bash
# 1. Expor o Ollama na rede local (só na sua rede; não abra porta no roteador)
sudo systemctl edit ollama
#   [Service]
#   Environment="OLLAMA_HOST=0.0.0.0:11434"
sudo systemctl restart ollama

# 2. Modelos
ollama pull qwen2.5:14b        # texto PT-BR (≈9 GB, cabe em 12 GB)
ollama pull llama3.1:8b        # rápido
ollama pull nomic-embed-text   # RAG
# opcional para testar: ollama pull nemotron-mini
```

No Windows, em `config\settings.yaml`: `ia_local.host: "http://<IP-do-servidor>:11434"`.

Janela 00:00–06:00 fica bloqueada pela própria ferramenta (treino QLoRA).

Qual modelo usar: rode `rex dia` com `qwen2.5:14b` e compare 1 oferta com `nemotron-mini` ou `llama3.1:8b`
trocando `ia_local.modelos.texto`. Fique com o que entregar copy melhor em PT-BR; o cache evita pagar duas vezes.
Se o 14b ficar lento na RTX 2060, use `qwen2.5:7b` para rascunho e deixe a revisão final na IA paga.
