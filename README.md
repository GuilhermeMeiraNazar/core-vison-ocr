# Core Vision OCR

O **Core Vision OCR** é um projeto desenvolvido em Node.js e TypeScript, focado no processamento eficiente de arquivos PDF. O sistema automatiza a conversão de documentos PDF em imagens, aplica técnicas de OCR (Reconhecimento Óptico de Caracteres) e organiza os resultados extraídos de forma estruturada.

![Version](https://img.shields.io/badge/version-1.0.0-purple)

---

##  Funcionalidades

- **Processamento Automático:** Lê todos os ficheiros `.pdf` contidos na pasta `input/`.
- **Rasterização de Alta Qualidade:** Converte páginas de PDF em imagens processáveis.
- **OCR Integrado:** Aplica motores de OCR para extração de texto.
- **Gerenciamento de Memória:** Divide páginas grandes em *chunks* (blocos) para evitar estouro de memória.
- **Instalação Inteligente:** Realiza o download e a configuração automática dos modelos OCR na primeira execução.

---

##  Requisitos

Antes de iniciar, certifique-se de que o seu ambiente possui:

- [Node.js](https://nodejs.org/) 18+ instalado
- npm (vem junto com o Node.js)

---

## Instalação

```cmd
git clone https://buhlergroup@dev.azure.com/buhlergroup/AUT-M2M-BSAM/_git/core-vision-ocr

cd "C:\core-vision-ocr"

npm install
```
> O comando `npm install` lê o `package.json` e cria a pasta `node_modules` com todas as dependências necessárias. Essa pasta não é versionada no repositório, então é obrigatório rodar esse comando após clonar o projeto.

### Iniciar a aplicação (Windows)

Rode para executar a aplicação

```cmd
npm run dev
```

## Estrutura do Projeto
```
├CORE-VISION-OCR/
├── debug/                  # Ficheiros para depuração e logs visuais
├── input/                  # Local onde deve inserir os seus PDFs
├── node_modules/           # Dependências do projeto
├── output/                 # Resultados finais (textos/dados extraídos)
├── src/                    # Código-fonte principal
│   ├── asyncQueue.ts       # Gerenciamento de filas assíncronas
│   ├── config.ts           # Carregamento e tipagem de configurações
│   ├── imageUtils.ts       # Utilitários de processamento de imagem
│   ├── index.ts            # Pipeline principal (orquestrador)
│   ├── ocrInstaller.ts     # Instalação/verificação de modelos OCR
│   ├── ocrPaths.ts         # Definição de caminhos do OCR
│   ├── ocrService.ts       # Serviço de execução de OCR
│   ├── pageChunking.ts     # Lógica de fatiamento de páginas
│   ├── pdfPipeline.ts      # Motor genérico de pipeline (PDF -> raster -> extração)
│   ├── popplerInstaller.ts # Instalação/verificação do Poppler
│   ├── popplerPaths.ts     # Definição de caminhos do Poppler
│   ├── popplerService.ts   # Rasterização de PDFs
│   └── resourceManager.ts  # Gerenciamento de recursos (CPU/RAM)
├── temp/                   # Ficheiros temporários de processamento
├── var/                    # Dados persistentes (modelos OCR)
├── .env                    # Variáveis de ambiente
├── .gitignore              # Arquivos ignorados pelo Git
├── package-lock.json       # Versões travadas das dependências
├── package.json            # Scripts e dependências do projeto
├── README.md               # Documentação do projeto
└── tsconfig.json           # Configurações do TypeScript
```


### 1. Detalhes das Pastas Principais
- input/: Entrada obrigatória para os PDFs.

- output/: Onde os resultados processados serão armazenados.

- var/: Armazena dados persistentes, como os modelos de OCR descarregados.

- temp/ & debug/: Pastas auxiliares para garantir a estabilidade do sistema e permitir a verificação de erros.

### 2. Arquitetura de Processamento

- O pdfPipeline.ts atua como o orquestrador agnóstico do fluxo de extração de dados. Sua função é isolar a lógica de pipeline (rasterização, segmentação em tiles e gerenciamento de memória) da lógica de interpretação de dados (payload extraction).

- Esta abstração permite que o motor seja desacoplado de qualquer formato específico de saída:

- Injeção de Dependência Funcional: O método extractFromPdf() recebe uma callback assíncrona. Isso permite que a mesma infraestrutura de processamento de imagem seja utilizada para diferentes domínios de extração — como OCR de texto, análise de padrões geométricos (QR/DataMatrix) ou reconhecimento de caracteres específicos (S/N) — sem alterar a implementação do pipeline.

- Abstração de Camada (Pipeline Engine): O motor lida exclusivamente com a transformação de input binário (PDF) para buffer processável (imágenes segmentadas). A responsabilidade de o que é extraído é delegada inteiramente à função extratora injetada.

- Escalabilidade e Manutenção: Para implementar um novo método de extração, basta instanciar um novo pipeline ou sobrescrever a função extratora. Isso mantém o pdfPipeline.ts imutável, reduzindo regressões e facilitando a especialização do motor para novos fluxos de trabalho.

- Em essência, ele fornece a interface necessária para que qualquer serviço de extração consuma dados rasterizados de forma padronizada, garantindo que o processamento de baixo nível (Poppler, tiling, gerenciamento de recursos) ocorra de maneira uniforme.

#### Desenvolvido por GMN U64738