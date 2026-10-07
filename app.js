// primary-blue 0057FF
// bold-yellow: FFD500
// white: FFFFFF
// deep-navy: 061B3A
// gray-line: D7DCE5

// ============================================================================
// 1. INICIALIZAÇÃO E ESTADO DA APLICAÇÃO
// ============================================================================

// Tenta pegar dados atualizados do localStorage; se não houver, usa o DADOS_SISTEMA do dados.js
let motoristas = JSON.parse(localStorage.getItem('escala_motoristas')) || DADOS_SISTEMA.motoristas;
let passageiros = JSON.parse(localStorage.getItem('escala_passageiros')) || DADOS_SISTEMA.passageiros;

// Carrega o histórico da última escala salva (para aplicar a regra de não repetição)
let historicoOntem = JSON.parse(localStorage.getItem('escala_ontem')) || [];

// Elementos do DOM
const btnGerarEscala = document.getElementById('btnGerarEscala');
const gridEscala = document.getElementById('grid-escala');
const totalCorridasSpan = document.getElementById('total-corridas');

// ============================================================================
// 2. FUNÇÕES AUXILIARES DE LÓGICA E EMBARALHAMENTO
// ============================================================================

// Função para embaralhar um array (Algoritmo Fisher-Yates)
function embaralhar(array) {
  const arr = [...array];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

// Verifica se a dupla (motorista, passageiro) ocorreu no histórico de ontem
function foiParOntem(motoristaNome, passageiroNome, historico) {
  // Se não tem histórico (primeiro dia de uso), libera qualquer par
  if (!historico || historico.length === 0) return false;

  return historico.some(
    corrida => corrida.motorista === motoristaNome && corrida.passageiro === passageiroNome
  );
}

// ============================================================================
// ALGORITMO DE DISTRIBUIÇÃO COM RODÍZIO DE SOBRAS
// ============================================================================

function gerarEscala() {
  if (!passageiros || passageiros.length === 0) {
    alert('Nenhum passageiro encontrado para distribuir!');
    return;
  }

  // 0. CARREGA O HISTÓRICO ATUALIZADO DO LOCALSTORAGE
  const historicoOntem = JSON.parse(localStorage.getItem('escala_ontem')) || [];

  // Objeto para armazenar as corridas
  const escala = {};
  motoristas.forEach(m => (escala[m] = []));

  // 1. Descobre quem é o motorista que começa a receber corridas hoje
  let offsetMotorista = parseInt(localStorage.getItem('offset_motorista_inicio')) || 0;

  const ordemAtendimento = [
    ...motoristas.slice(offsetMotorista),
    ...motoristas.slice(0, offsetMotorista)
  ];

  // 2. Embaralha a fila de passageiros do dia
  let passageirosFila = embaralhar(passageiros);
  const totalPassageiros = passageirosFila.length;

  let ordemIndex = 0;

  // 3. Distribui os passageiros respeitando rigorosamente o histórico
  while (passageirosFila.length > 0) {
    const motoristaAtual = ordemAtendimento[ordemIndex];
    let passageiroAlocado = null;
    let indiceAlocado = -1;

    // Tenta encontrar um passageiro que NÃO esteve com este motorista ontem
    for (let i = 0; i < passageirosFila.length; i++) {
      const pCandidate = passageirosFila[i];
      
      // Passamos o historicoOntem explicitamente
      if (!foiParOntem(motoristaAtual, pCandidate, historicoOntem)) {
        passageiroAlocado = pCandidate;
        indiceAlocado = i;
        break;
      }
    }

    // Se REALMENTE não houver opção inédita matemática (situação extrema de fim de fila),
    // pega o primeiro disponível
    if (!passageiroAlocado) {
      passageiroAlocado = passageirosFila[0];
      indiceAlocado = 0;
    }

    escala[motoristaAtual].push(passageiroAlocado);
    passageirosFila.splice(indiceAlocado, 1);

    // Passa para o próximo motorista da sequência
    ordemIndex = (ordemIndex + 1) % ordemAtendimento.length;
  }

  // 4. Atualiza o offset para o próximo dia
  const novoOffset = (offsetMotorista + (totalPassageiros % motoristas.length)) % motoristas.length;
  localStorage.setItem('offset_motorista_inicio', novoOffset);

  // 5. Renderiza a grid de hoje
  renderizarGrid(escala);
  
  if (totalCorridasSpan) {
    totalCorridasSpan.textContent = `${totalPassageiros} corridas alocadas`;
  }

  salvarEscalaNoHistorico(escala);
}

// ============================================================================
// 4. RENDERIZAÇÃO DA INTERFACE (GRID DE 8 COLUNAS)
// ============================================================================

function renderizarGrid(escala) {
  gridEscala.innerHTML = '';

  motoristas.forEach((motorista, index) => {
    const listaCorridas = escala[motorista] || [];

    // Cria o HTML da coluna individual do motorista
    const colunaHTML = document.createElement('div');
    colunaHTML.className = 'bg-slate-50 border border-slate-200 rounded-lg p-3 flex flex-col h-full min-w-[140px] shadow-sm';

    // Cabeçalho da coluna (Nome do Motorista e Contagem)
    let corridasHTML = `
      <div class="border-b border-slate-200 pb-2 mb-3 flex justify-between items-center">
        <span class="font-bold text-slate-800 text-sm truncate" title="${motorista}">${motorista}</span>
        <span class="text-[10px] font-semibold bg-slate-200 text-slate-700 px-1.5 py-0.5 rounded-full">${listaCorridas.length}</span>
      </div>
      <div class="space-y-2 flex-1">
    `;

    // Linhas de passageiros alocados
    if (listaCorridas.length === 0) {
      corridasHTML += `
        <div class="text-xs text-slate-400 italic text-center py-4">Sem corridas</div>
      `;
    } else {
      listaCorridas.forEach((passageiro, i) => {
        corridasHTML += `
          <div class="bg-white p-2 rounded border border-slate-200 shadow-2xs text-xs text-slate-700 flex items-start gap-1.5">
            <span class="font-semibold text-slate-400 text-[10px] select-none">${i + 1}.</span>
            <span class="break-words font-medium text-slate-800">${passageiro}</span>
          </div>
        `;
      });
    }

    corridasHTML += `</div>`;
    colunaHTML.innerHTML = corridasHTML;
    gridEscala.appendChild(colunaHTML);
  });
}

// Persiste a escala gerada no localStorage
function salvarEscalaNoHistorico(escala) {
  const relacaoHoje = [];
  Object.keys(escala).forEach(m => {
    escala[m].forEach(p => {
      relacaoHoje.push({ motorista: m, passageiro: p });
    });
  });
  localStorage.setItem('escala_ontem', JSON.stringify(relacaoHoje));
}

// ============================================================================
// 5. EVENT LISTENERS
// ============================================================================

btnGerarEscala.addEventListener('click', () => {

  // 3. Gera a escala de HOJE (e ela própria atualiza a grid de cima e guarda o novo histórico)
  gerarEscala();

  // 4. SALVA A DATA: Guarda o dia de hoje para ser exibido no histórico do próximo clique
  const hojeBrasil = new Date().toLocaleDateString('pt-BR');
  localStorage.setItem('data_escala_ontem', hojeBrasil);
  localStorage.setItem('data_ultima_escala', hojeBrasil);

 atualizarInterfaceDiaria();

});


// Função para renderizar o histórico de ontem na tela
function renderizarEscalaOntem(dados) {
  const gridOntem = document.getElementById('grid-escala-ontem');
  const totalOntemSpan = document.getElementById('total-corridas-ontem');
  
  if (!gridOntem) return;

  const historico = dados || JSON.parse(localStorage.getItem('escala_ontem')) || [];

  if (historico.length === 0) {
    gridOntem.innerHTML = `
      <div class="col-span-full text-center py-6 text-xs text-slate-400 italic">
        Sem histórico registrado para o dia anterior (Primeira execução do sistema).
      </div>
    `;
    if (totalOntemSpan) totalOntemSpan.textContent = '0 corridas salvas';
    return;
  }

  // Agrupa os registros por motorista: { "Motorista 1": ["Passageiro A", ...], ... }
  const escalaOntem = {};
  motoristas.forEach(m => (escalaOntem[m] = []));
  
  historico.forEach(item => {
    if (escalaOntem[item.motorista]) {
      escalaOntem[item.motorista].push(item.passageiro);
    }
  });

  // Renderiza as 8 colunas de ontem
  gridOntem.innerHTML = '';
  motoristas.forEach(motorista => {
    const lista = escalaOntem[motorista] || [];
    const colunaHTML = document.createElement('div');
    colunaHTML.className = 'bg-white border border-slate-300 rounded-lg p-3 flex flex-col h-full min-w-[140px] opacity-75';

    let html = `
      <div class="border-b border-slate-200 pb-2 mb-2 flex justify-between items-center">
        <span class="font-bold text-slate-700 text-xs truncate">${motorista}</span>
        <span class="text-[10px] font-semibold bg-slate-100 text-slate-500 px-1.5 py-0.5 rounded-full">${lista.length}</span>
      </div>
      <div class="space-y-1.5 flex-1">
    `;

    if (lista.length === 0) {
      html += `<div class="text-[11px] text-slate-400 italic text-center py-2">-</div>`;
    } else {
      lista.forEach((p, i) => {
        html += `
          <div class="bg-slate-50 p-1.5 rounded border border-slate-200 text-[11px] text-slate-600 truncate">
            <span class="font-semibold text-slate-400">${i + 1}.</span> ${p}
          </div>
        `;
      });
    }

    html += `</div>`;
    colunaHTML.innerHTML = html;
    gridOntem.appendChild(colunaHTML);
  });

  if (totalOntemSpan) {
    totalOntemSpan.textContent = `${historico.length} corridas salvas ontem`;
  }
}

// Executa automaticamente ao abrir a página para já exibir o ontem na tela
document.addEventListener('DOMContentLoaded', () => {
  renderizarEscalaOntem();
});

// Função para ler a data guardada e atualizar o título
function atualizarDataHistorico() {
  const spanData = document.getElementById('dataHistorico');
  const dataSalva = localStorage.getItem('data_escala_ontem'); // Já estará em "DD/MM/AAAA"

  if (dataSalva && spanData) {
    spanData.textContent = `(${dataSalva})`;
  } else if (spanData) {
    spanData.textContent = '';
  }
}

function carregarHistoricoInicial() {
  const historicoSalvo = JSON.parse(localStorage.getItem('escala_ontem')) || [];
  const dataSalva = localStorage.getItem('data_escala_ontem');
  const spanData = document.getElementById('dataHistorico');

  // Desenha a grade do histórico
  renderizarEscalaOntem(historicoSalvo);

  // Atualiza o título com a data do último dia gerado
  if (dataSalva && spanData) {
    spanData.textContent = `(${dataSalva})`;
  } else if (spanData) {
    spanData.textContent = '(Sem histórico anterior)';
  }
}

// EXECUTA AUTOMATICAMENTE ASSIM QUE A PÁGINA CARREGA
carregarHistoricoInicial();


function atualizarInterfaceDiaria() {
  const btnGerar = document.getElementById('btnGerarEscala');
  const spanHoje = document.getElementById('dataEscalaHoje');
  const spanHistorico = document.getElementById('dataHistorico');

  const dataHoje = new Date().toLocaleDateString('pt-BR');
  const ultimaGeracao = localStorage.getItem('data_ultima_escala');
  const dataHistoricoSalva = localStorage.getItem('data_escala_ontem');
  const historicoArray = JSON.parse(localStorage.getItem('escala_ontem')) || [];

  // 1. TÍTULO DO HISTÓRICO (Só mostra data se houver histórico E se a data for de um dia anterior)
  // if (spanHistorico) {
  //   if (historicoArray.length > 0 && dataHistoricoSalva && dataHistoricoSalva !== dataHoje) {
  //     spanHistorico.textContent = `(${dataHistoricoSalva})`;
  //   } else {
  //     spanHistorico.textContent = '(Sem histórico anterior)';
  //   }
  // }

  // 1. TÍTULO DO HISTÓRICO - GAMBIARRA
if (spanHistorico) {
  if (historicoArray.length > 0 && dataHistoricoSalva && dataHistoricoSalva !== dataHoje) {
    // Virada de dia normal: mostra a data e memoriza para o resto do dia
    spanHistorico.textContent = `(${dataHistoricoSalva})`;
    localStorage.setItem('titulo_historico', dataHistoricoSalva);
  } else if (historicoArray.length > 0 && dataHistoricoSalva === dataHoje && localStorage.getItem('titulo_historico')) {
    // Já gerou hoje: a data foi sobrescrita, então usa a memorizada
    spanHistorico.textContent = `(${localStorage.getItem('titulo_historico')})`;
  } else {
    spanHistorico.textContent = '(Sem histórico anterior)';
  }
}
// FIM 1 - GAMBIARRA

  // 2. TRAVA DO BOTÃO E DATA DO DIA ATUAL
  if (ultimaGeracao === dataHoje) {
    if (btnGerar) btnGerar.disabled = true;
    if (spanHoje) spanHoje.textContent = `(${dataHoje})`;
  } else {
    if (btnGerar) btnGerar.disabled = false;
    if (spanHoje) spanHoje.textContent = '';
  }
}

atualizarInterfaceDiaria();

// ===== MODO TESTE (trocar para false antes da entrega final) =====
const MODO_TESTE = true;

function diaAnterior(dataBR) {
  const [d, m, a] = dataBR.split('/').map(Number);
  const dt = new Date(a, m - 1, d);
  dt.setDate(dt.getDate() - 1);
  return dt.toLocaleDateString('pt-BR');
}

function simularProximoDia() {
  ['data_ultima_escala', 'data_escala_ontem'].forEach((chave) => {
    const valor = localStorage.getItem(chave);
    if (valor) localStorage.setItem(chave, diaAnterior(valor));
  });
  location.reload();
}

if (MODO_TESTE) {
  const btn = document.createElement('button');
  btn.textContent = 'Simular próximo dia (teste)';
  btn.className = 'fixed bottom-4 right-4 bg-yellow-400 text-black text-sm px-3 py-2 rounded shadow z-50';
  btn.addEventListener('click', simularProximoDia);
  document.body.appendChild(btn);
}