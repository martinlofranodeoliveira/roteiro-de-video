# Origem e licenças dos recursos

O código e a documentação originais do Roteiro de Vídeo são distribuídos sob a licença MIT de [LICENSE](LICENSE). Os recursos com licença própria conservam os avisos abaixo.

## Barlow

Os arquivos `assets/barlow-regular.ttf` e `assets/barlow-semibold.ttf` pertencem à família Barlow. Copyright 2017 The Barlow Project Authors. São redistribuídos sob **SIL Open Font License 1.1**, cujo aviso e texto completo acompanham a distribuição em [assets/BARLOW-LICENSE.txt](assets/BARLOW-LICENSE.txt).

Projeto de origem: [jpt/barlow](https://github.com/jpt/barlow). A licença MIT do aplicativo não substitui a licença das fontes. As fontes são servidas localmente; não há carregamento de um provedor externo de fontes.

## Leitura e normalização de imagens

[src/image-io.mjs](src/image-io.mjs) adapta o módulo de mesmo nome do projeto [Folha de Contato](https://github.com/martinlofranodeoliveira/folha-de-contato), sob MIT. Copyright (c) 2026 Contribuidores da LOFRANO TECNOLOGIA. O aviso está preservado no cabeçalho do módulo e o texto MIT acompanha este projeto em [LICENSE](LICENSE).

A adaptação aplica os limites e o formato de referência do Roteiro de Vídeo, faz a normalização local e confere imagens incorporadas antes da importação. O uso das APIs de canvas e de decodificação depende do navegador.

## Demonstração fictícia

[assets/demo-storyboard.png](assets/demo-storyboard.png) é uma folha original gerada por IA para **Um café, três planos**, sem imagem externa de referência. Não é registro de uma produção, cliente ou produto real. O prompt, a data, o hash e a organização dos seis painéis estão em [assets/DEMO.md](assets/DEMO.md).

A folha e as referências normalizadas incorporadas em [examples/roteiro-exemplo.json](examples/roteiro-exemplo.json) integram o projeto sob sua licença MIT. Não foi utilizado banco de imagens externo.

## Execução

Não há dependências externas de execução JavaScript nem pacotes npm de terceiros. Fontes, exemplos, módulos e estilos da aplicação são distribuídos como arquivos estáticos. As APIs de plataforma são fornecidas pelo navegador e pelo Node.js nas ferramentas de desenvolvimento.
