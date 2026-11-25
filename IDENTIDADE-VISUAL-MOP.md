# Identidade visual oficial — MOP UI Next

**Padrão vigente a partir da Preview.31.**

O logotipo de referência é o arquivo **"Logo MOP com Ícone Hexagonal.png"**, enviado pelo usuário: emblema hexagonal branco e prata com setas ciano, painel interno de monitoramento e a palavra MOP branca. Este é o padrão aprovado para os próximos releases do aplicativo, não o antigo M geométrico em SVG.

## Integração na interface

- Recurso de distribuição: `ui-next/public/brand/mop-logo.webp` (derivado do logo original com fundo transparente; otimizado para uso em UI).
- Apresentação: componente único `MLogo` em `ui-next/src/main.tsx`.
- Layout: `ui-next/src/branding31.css`.
- O elemento de marca é exibido no canto superior esquerdo da barra lateral fixa e na tela de login.
- Em novas telas, **reutilizar o mesmo recurso e componente**; não redesenhar, distorcer ou substituir por ícones genéricos.
- Fundo de referência: azul-marinho escuro. Reservar espaçamento para legibilidade da marca.
- **Para impressões, ícone do instalador e formatos maiores**, derivar sempre da imagem original de alta resolução fornecida pelo usuário, não da miniatura WebP do aplicativo.

## Padrão Escala

- Estados devem ser distinguíveis por **cor, texto legível e ícone**, nunca só bolinhas ou tonalidade.
- Plantão: azul; Folga: verde; Feriado trabalhado: dourado + "PLANTÃO"; Feriado em folga: dourado + "FOLGA"; Folga trabalhada: roxo; Troca aprovada: rosa.
- A seleção do dia usa contorno adicional, preservando a cor do estado.
- As versões móveis usam rótulos compactos, mantendo a descrição completa para acessibilidade e detalhe do dia.

Toda alteração futura deve respeitar este documento e ser homologada em desktop e telas compactas.
