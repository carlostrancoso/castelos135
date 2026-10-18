# Castelos 135 — visualizador 3D

Site estático pronto para GitHub Pages. Não exige instalação nem compilação.

## Publicar

1. Criar um repositório no GitHub (por exemplo, `castelos-135`).
2. Extrair este ZIP e enviar todo o seu conteúdo para a raiz do repositório, mantendo as pastas `assets` e `vendor`. O `index.html` deve ficar na raiz, sem uma pasta adicional a envolvê-lo.
3. Em **Settings → Pages → Build and deployment**, escolher **Deploy from a branch**.
4. Selecionar **main** e **/(root)** e carregar em **Save**.
5. Quando a publicação terminar, abrir o endereço apresentado pelo GitHub Pages.

Documentação: https://docs.github.com/en/pages/getting-started-with-github-pages/configuring-a-publishing-source-for-your-github-pages-site

## Ficheiros

- `index.html`: interface.
- `style.css`: estilos e adaptação a telemóveis.
- `app.js`: navegação, câmaras, plantas e cortes.
- `view-presets.js`: posições das vistas predefinidas.
- `surroundings.js`: envolvente esquemática.
- `section-caps.js`: preenchimento dos cortes.
- `furniture.js`: mobiliário esquemático das plantas.
- `assets/`: modelo GLB, imagens das plantas e restantes recursos.
- `vendor/`: Three.js e carregadores locais.
- `.nojekyll`: desativa o processamento Jekyll.

Os caminhos são relativos e funcionam também num endereço como `https://UTILIZADOR.github.io/castelos-135/`. As bibliotecas são locais, sem dependência de uma CDN.

Para testar no computador, servir esta pasta por HTTP (por exemplo, `python -m http.server 8000`) e abrir `http://localhost:8000`. Abrir o HTML diretamente por duplo clique pode bloquear o carregamento dos módulos e do modelo.

A envolvente é aproximada, interpretada a partir do vídeo, e não corresponde a um levantamento métrico.
