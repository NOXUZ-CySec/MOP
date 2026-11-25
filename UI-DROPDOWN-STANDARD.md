# Padrão MOP — menus expansíveis

Utilizar `RecordFilterDropdown` em vez de `<select>` nativo em novas telas.

- Manter o mesmo layout da caixa **Período** da página Registros: botão escuro, ícone quando apropriado, seta centralizada à direita e menu flutuante com animação discreta.
- Nunca repetir o mesmo texto no botão e na lista aberta. Sempre mostrar o valor escolhido no botão e ocultá-lo do menu com `hideSelectedOption`, inclusive quando for o valor padrão Todos.
- Para filtros com valor padrão **Todos**, exibir **Todos** no botão, nunca o título Período. Para origem, exibir **Todas as origens**.
- A opção **Todos** deve continuar acessível ao selecionar um filtro específico; ela é omitida apenas quando já estiver selecionada.
- Preservar fechamento por Escape, clique fora, acessibilidade e navegação por teclado.
- Evitar menus nativos do Windows, cores chamativas, estilos de lista divergentes e duplicação de rótulos.
