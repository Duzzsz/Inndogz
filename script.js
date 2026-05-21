/* ═══════════════════════════════════════════════
   INNDOGZ — SCRIPT.JS COMPLETO (CORRIGIDO)
═══════════════════════════════════════════════ */

const API_BASE = 'http://localhost:3000';

/* ─── Tabela de preços por porte ─────────────── */
const PRECO_POR_PORTE = {
  'Mini':    80,
  'Pequeno': 100,
  'Médio':   130,
  'Grande':  160,
  'Gigante': 200
};

const AppState = {
  usuarios:      JSON.parse(localStorage.getItem('inndogz_usuarios') || '[]'),
  usuarioAtual:  JSON.parse(localStorage.getItem('inndogz_usuario')  || 'null'),
  reservas:      JSON.parse(localStorage.getItem('inndogz_reservas') || '[]'),
  cachorros:     [],          // cachorros cadastrados nesta sessão
  codigoGerado:  null,
  emailPendente: null,
  dadosCadastro: null
};

/* ════════════════════════════════════════════════
   PERSISTÊNCIA
════════════════════════════════════════════════ */
function criarAdminPadrao() {
  const existe = AppState.usuarios.find(u => u.email === 'admin@inndogz.com');
  if (!existe) {
    AppState.usuarios.push({
      id: 1,
      nome: 'Administrador',
      email: 'admin@inndogz.com',
      senha: 'admin123',
      telefone: '(11) 99999-9999',
      cpf: '000.000.000-00',
      tipo: 'admin'
    });
    salvarUsuarios();
  }
}

function salvarUsuarios()    { localStorage.setItem('inndogz_usuarios', JSON.stringify(AppState.usuarios)); }
function salvarUsuarioAtual(){ localStorage.setItem('inndogz_usuario',  JSON.stringify(AppState.usuarioAtual)); }
function salvarReservas()    { localStorage.setItem('inndogz_reservas', JSON.stringify(AppState.reservas)); }

function buscarUsuarioPorEmail(email) {
  return AppState.usuarios.find(u => u.email.toLowerCase() === email.toLowerCase());
}
function emailJaCadastrado(email) {
  return AppState.usuarios.some(u => u.email.toLowerCase() === email.toLowerCase());
}

/* ════════════════════════════════════════════════
   UTILITÁRIOS
════════════════════════════════════════════════ */
function gerarCodigo() {
  return String(Math.floor(100000 + Math.random() * 900000));
}

function gerarNumeroReserva() {
  return 'INN-' + Date.now().toString().slice(-6) + '-' + Math.floor(Math.random() * 100);
}

function mostrarToast(msg) {
  const toast = document.createElement('div');
  toast.className = 'toast';
  toast.innerHTML = msg;
  document.body.appendChild(toast);
  setTimeout(() => toast.classList.add('show'), 100);
  setTimeout(() => {
    toast.classList.remove('show');
    setTimeout(() => toast.remove(), 300);
  }, 3500);
}

function formatarData(dateStr) {
  if (!dateStr) return '';
  const [y, m, d] = dateStr.split('-');
  return `${d}/${m}/${y}`;
}

function calcularNoites(entrada, saida) {
  const d1 = new Date(entrada);
  const d2 = new Date(saida);
  return Math.round((d2 - d1) / 86400000);
}

/* ════════════════════════════════════════════════
   NAVEGAÇÃO DE TELAS
════════════════════════════════════════════════ */
function showScreen(screenId) {
  document.querySelectorAll('.modal-screen').forEach(s => s.classList.remove('active'));
  document.getElementById('overlay').classList.add('active');
  document.getElementById(screenId).classList.add('active');
}

function closeOverlay() {
  document.getElementById('overlay').classList.remove('active');
  document.querySelectorAll('.modal-screen').forEach(s => s.classList.remove('active'));
}

/* Impede que clique dentro do modal feche o overlay */
document.addEventListener('DOMContentLoaded', () => {
  document.querySelectorAll('.modal-screen').forEach(el => {
    el.addEventListener('click', e => e.stopPropagation());
  });
});

function irParaCachorro() { showScreen('cachorro-screen'); }
function irParaReserva()  {
  preencherTelaDaReserva();
  showScreen('reserva-screen');
}

/* ════════════════════════════════════════════════
   ACESSIBILIDADE — TEMA E FONTE
════════════════════════════════════════════════ */
let fontScale = parseFloat(localStorage.getItem('inndogz_font') || '1');

function toggleTheme() {
  document.body.classList.toggle('dark-mode');
  const isDark = document.body.classList.contains('dark-mode');
  document.getElementById('theme-icon').textContent = isDark ? '☀️' : '🌙';
  localStorage.setItem('inndogz_theme', isDark ? 'dark' : 'light');
}

function changeFontSize(delta) {
  fontScale = Math.min(1.4, Math.max(0.8, fontScale + delta * 0.1));
  document.documentElement.style.setProperty('--font-scale', fontScale);
  localStorage.setItem('inndogz_font', fontScale);
}

function toggleMobileMenu() {
  const links = document.querySelector('.nav-links');
  links.style.display = links.style.display === 'flex' ? 'none' : 'flex';
}

/* ════════════════════════════════════════════════
   CADASTRO DE USUÁRIO
════════════════════════════════════════════════ */
function handleCadastro(e) {
  e.preventDefault();

  // Limpa erros anteriores
  ['cad-nome','cad-email','cad-telefone','cad-cpf','cad-senha'].forEach(id => {
    const err = document.getElementById('err-' + id);
    if (err) err.textContent = '';
  });
  document.getElementById('email-existente-msg').classList.add('hidden');

  const nome     = document.getElementById('cad-nome').value.trim();
  const email    = document.getElementById('cad-email').value.trim();
  const telefone = document.getElementById('cad-telefone').value.trim();
  const cpf      = document.getElementById('cad-cpf').value.trim();
  const senha    = document.getElementById('cad-senha').value;

  let valido = true;

  if (!nome)     { document.getElementById('err-cad-nome').textContent     = 'Nome obrigatório.';     valido = false; }
  if (!email)    { document.getElementById('err-cad-email').textContent    = 'E-mail obrigatório.';   valido = false; }
  if (!telefone) { document.getElementById('err-cad-telefone').textContent = 'Telefone obrigatório.'; valido = false; }
  if (!cpf)      { document.getElementById('err-cad-cpf').textContent      = 'CPF obrigatório.';      valido = false; }
  if (senha.length < 6) { document.getElementById('err-cad-senha').textContent = 'Mínimo 6 caracteres.'; valido = false; }

  if (!valido) return;

  if (emailJaCadastrado(email)) {
    document.getElementById('email-existente-msg').classList.remove('hidden');
    return;
  }

  AppState.dadosCadastro = { nome, email, telefone, cpf, senha };
  AppState.codigoGerado  = gerarCodigo();

  document.getElementById('codigo-email-display').textContent = email;
  document.getElementById('codigo-status-msg').textContent = '⏳ Enviando código de verificação...';
  showScreen('codigo-screen');

  enviarEmailCodigo(email, nome, AppState.codigoGerado);
}

async function enviarEmailCodigo(email, nome, codigo) {
  try {
    const res = await fetch(`${API_BASE}/api/enviar-codigo`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, nome, codigo })
    });
    if (res.ok) {
      document.getElementById('codigo-status-msg').textContent = '✅ Código enviado para seu e-mail!';
    } else {
      throw new Error('Falha no servidor');
    }
  } catch {
    // Modo demo: mostra o código na tela
    document.getElementById('codigo-status-msg').textContent =
      `⚠️ Modo demo — Código: ${codigo}`;
    console.log('[DEMO] Código de verificação:', codigo);
  }
}

function reenviarCodigo() {
  if (!AppState.dadosCadastro) return;
  AppState.codigoGerado = gerarCodigo();
  document.getElementById('codigo-status-msg').textContent = '⏳ Reenviando...';
  enviarEmailCodigo(
    AppState.dadosCadastro.email,
    AppState.dadosCadastro.nome,
    AppState.codigoGerado
  );
}

/* ─── Verificar código digitado ─────────────── */
function handleCodigo(e) {
  e.preventDefault();

  document.getElementById('err-codigo').textContent = '';
  document.getElementById('codigo-erro').classList.add('hidden');

  const codigoDigitado = document.getElementById('codigo-input').value.trim();

  if (codigoDigitado !== AppState.codigoGerado) {
    document.getElementById('codigo-erro').classList.remove('hidden');
    document.getElementById('err-codigo').textContent = 'Código inválido.';
    return;
  }

  const novoUsuario = {
    ...AppState.dadosCadastro,
    id:   Date.now(),
    tipo: 'cliente'
  };

  AppState.usuarios.push(novoUsuario);
  AppState.usuarioAtual = novoUsuario;
  salvarUsuarios();
  salvarUsuarioAtual();

  mostrarToast('✅ Conta criada com sucesso!');
  document.getElementById('codigo-input').value = '';
  irParaCachorro();
}

/* ════════════════════════════════════════════════
   LOGIN / LOGOUT
════════════════════════════════════════════════ */
function handleLogin(e) {
  e.preventDefault();

  document.getElementById('err-login-email').textContent = '';
  document.getElementById('err-login-senha').textContent = '';
  document.getElementById('login-erro').classList.add('hidden');

  const email = document.getElementById('login-email').value.trim();
  const senha  = document.getElementById('login-senha').value;

  const usuario = buscarUsuarioPorEmail(email);

  if (!usuario || usuario.senha !== senha) {
    document.getElementById('login-erro').classList.remove('hidden');
    return;
  }

  AppState.usuarioAtual = usuario;
  salvarUsuarioAtual();

  if (usuario.tipo === 'admin') {
    mostrarToast('👑 Bem-vindo, Administrador!');
    mostrarPainelAdmin();
    return;
  }

  mostrarToast(`👋 Bem-vindo, ${usuario.nome}!`);

  // Reseta cachorros da sessão e vai para cadastro de cachorro
  AppState.cachorros = [];
  atualizarBadgesCachorros();
  irParaCachorro();
}

function logout() {
  AppState.usuarioAtual = null;
  AppState.cachorros    = [];
  salvarUsuarioAtual();
  closeOverlay();
  mostrarToast('👋 Logout realizado com sucesso.');
}

/* ════════════════════════════════════════════════
   CADASTRO DO CACHORRO
════════════════════════════════════════════════ */
function triggerUpload(inputId) {
  document.getElementById(inputId).click();
}

function updateUploadLabel(input, labelId, areaId) {
  const label = document.getElementById(labelId);
  const area  = document.getElementById(areaId);
  if (input.files && input.files[0]) {
    label.textContent = '✅ ' + input.files[0].name;
    area.classList.add('has-file');
    area.classList.remove('error');
  }
}

function handleFotoUpload(input) {
  const preview     = document.getElementById('foto-preview');
  const placeholder = document.getElementById('foto-placeholder');
  const area        = document.getElementById('foto-upload-area');

  if (!input.files || !input.files[0]) return;

  const file = input.files[0];
  if (file.size > 5 * 1024 * 1024) {
    mostrarToast('⚠️ Foto muito grande (máx. 5MB).');
    input.value = '';
    return;
  }

  const reader = new FileReader();
  reader.onload = ev => {
    preview.src = ev.target.result;
    preview.classList.remove('hidden');
    placeholder.classList.add('hidden');
    area.classList.add('has-file');
  };
  reader.readAsDataURL(file);
}

function limparFormCachorro() {
  document.getElementById('cachorro-form').reset();
  const preview     = document.getElementById('foto-preview');
  const placeholder = document.getElementById('foto-placeholder');
  preview.src = '';
  preview.classList.add('hidden');
  placeholder.classList.remove('hidden');
  document.getElementById('foto-upload-area').classList.remove('has-file');
  document.getElementById('area-vac-geral').classList.remove('has-file');
  document.getElementById('area-vac-raiva').classList.remove('has-file');
  document.getElementById('label-vac-geral').textContent = '📎 Clique para anexar';
  document.getElementById('label-vac-raiva').textContent = '📎 Clique para anexar';
  ['err-dog-foto','err-dog-nome','err-dog-raca','err-dog-porte',
   'err-dog-peso','err-dog-sexo','err-dog-idade','err-vac-geral','err-vac-raiva']
    .forEach(id => { const el = document.getElementById(id); if (el) el.textContent = ''; });
}

function atualizarBadgesCachorros() {
  const container = document.getElementById('cachorros-cadastrados');
  container.innerHTML = '';
  AppState.cachorros.forEach((c, i) => {
    const badge = document.createElement('span');
    badge.className = 'dog-badge';
    badge.innerHTML = `🐶 ${c.nome} <small style="opacity:.7">(${c.porte})</small>`;
    container.appendChild(badge);
  });

  const titulo = document.getElementById('cachorro-title');
  titulo.textContent = AppState.cachorros.length > 0
    ? 'Adicionar outro cachorro 🐶'
    : 'Cadastrar Cachorro 🐶';
}

function handleCachorro(e) {
  e.preventDefault();

  // Limpa erros
  ['err-dog-foto','err-dog-nome','err-dog-raca','err-dog-porte',
   'err-dog-peso','err-dog-sexo','err-dog-idade','err-vac-geral','err-vac-raiva']
    .forEach(id => { const el = document.getElementById(id); if (el) el.textContent = ''; });

  const fotoInput   = document.getElementById('dog-foto');
  const nome        = document.getElementById('dog-nome').value.trim();
  const raca        = document.getElementById('dog-raca').value.trim();
  const porte       = document.getElementById('dog-porte').value;
  const peso        = document.getElementById('dog-peso').value;
  const sexo        = document.getElementById('dog-sexo').value;
  const idade       = document.getElementById('dog-idade').value.trim();
  const deficiencia = document.querySelector('input[name="deficiencia"]:checked')?.value || 'nao';
  const alergias    = document.getElementById('dog-alergias').value.trim();
  const obs         = document.getElementById('dog-obs').value.trim();
  const vacGeral    = document.getElementById('vac-geral').files[0];
  const vacRaiva    = document.getElementById('vac-raiva').files[0];

  let valido = true;

  if (!fotoInput.files || !fotoInput.files[0]) {
    document.getElementById('err-dog-foto').textContent = 'Foto obrigatória.'; valido = false;
  }
  if (!nome)  { document.getElementById('err-dog-nome').textContent  = 'Nome obrigatório.';  valido = false; }
  if (!raca)  { document.getElementById('err-dog-raca').textContent  = 'Raça obrigatória.';  valido = false; }
  if (!porte) { document.getElementById('err-dog-porte').textContent = 'Porte obrigatório.'; valido = false; }
  if (!peso)  { document.getElementById('err-dog-peso').textContent  = 'Peso obrigatório.';  valido = false; }
  if (!sexo)  { document.getElementById('err-dog-sexo').textContent  = 'Sexo obrigatório.';  valido = false; }
  if (!idade) { document.getElementById('err-dog-idade').textContent = 'Idade obrigatória.'; valido = false; }
  if (!vacGeral) { document.getElementById('err-vac-geral').textContent = 'Carteira geral obrigatória.'; valido = false; }
  if (!vacRaiva) { document.getElementById('err-vac-raiva').textContent = 'Vacina antirrábica obrigatória.'; valido = false; }

  if (!valido) return;

  // Lê foto como base64 para exibir no comprovante
  const reader = new FileReader();
  reader.onload = ev => {
    AppState.cachorros.push({
      nome, raca, porte, peso, sexo, idade, deficiencia, alergias, obs,
      foto: ev.target.result
    });

    atualizarBadgesCachorros();
    limparFormCachorro();
    mostrarToast(`✅ ${nome} cadastrado! Adicione mais ou avance para a reserva.`);
  };
  reader.readAsDataURL(fotoInput.files[0]);
}

function adicionarOutroCachorro() {
  if (AppState.cachorros.length === 0) {
    mostrarToast('⚠️ Cadastre ao menos um cachorro primeiro.');
    return;
  }
  // Já está na tela de cachorro — só scroll para o topo do form
  document.getElementById('cachorro-form').scrollIntoView({ behavior: 'smooth' });
}

/* Botão "Próximo: Reserva" no form do cachorro.
   Intercepta o submit somente se não houver campos preenchidos
   (o usuário clicou em "Próximo" sem preencher nada = quer avançar com os cachorros já cadastrados). */
document.addEventListener('DOMContentLoaded', () => {
  const formCachorro = document.getElementById('cachorro-form');
  if (!formCachorro) return;

  // O botão "Próximo: Reserva" tem type="submit", mas queremos permitir
  // avançar se já há cachorros cadastrados e o form está vazio.
  formCachorro.addEventListener('submit', e => {
    const nome  = document.getElementById('dog-nome').value.trim();
    const raca  = document.getElementById('dog-raca').value.trim();
    const porte = document.getElementById('dog-porte').value;

    // Se o form está em branco e já temos cachorros → avança
    if (!nome && !raca && !porte && AppState.cachorros.length > 0) {
      e.preventDefault();
      irParaReserva();
      return;
    }
    // Caso contrário, handleCachorro() foi chamado via onsubmit
  });
});

/* ════════════════════════════════════════════════
   TELA DE RESERVA
════════════════════════════════════════════════ */
function toggleTerceiro(radio) {
  const secao = document.getElementById('terceiro-section');
  if (radio.value === 'terceiro') {
    secao.classList.remove('hidden');
  } else {
    secao.classList.add('hidden');
  }
}

function preencherTelaDaReserva() {
  const u = AppState.usuarioAtual;
  if (!u) return;

  // Box de info do tutor
  document.getElementById('tutor-info-display').innerHTML = `
    <strong>${u.nome}</strong><br>
    📧 ${u.email} &nbsp;|&nbsp; 📱 ${u.telefone}<br>
    🪪 CPF: ${u.cpf}
  `;

  // Lista de cachorros selecionáveis
  const lista = document.getElementById('res-cachorros-lista');
  lista.innerHTML = '';

  if (AppState.cachorros.length === 0) {
    lista.innerHTML = '<p style="color:var(--text-muted)">Nenhum cachorro cadastrado.</p>';
    return;
  }

  AppState.cachorros.forEach((c, i) => {
    const item = document.createElement('label');
    item.className = 'radio-label';
    item.style.display = 'flex';
    item.style.alignItems = 'center';
    item.style.gap = '8px';
    item.innerHTML = `
      <input type="checkbox" name="res-cachorro" value="${i}" checked />
      🐶 <strong>${c.nome}</strong> — ${c.raca} (${c.porte}, ${c.peso}kg)
    `;
    lista.appendChild(item);
  });
}

function calcularValorTotal(cachorrosSelecionados, noites) {
  let total = 0;
  cachorrosSelecionados.forEach(c => {
    const diaria = PRECO_POR_PORTE[c.porte] || 100;
    total += diaria * noites;
  });
  return total;
}

function handleReserva(e) {
  e.preventDefault();

  document.getElementById('err-res-entrada').textContent = '';
  document.getElementById('err-res-saida').textContent   = '';

  const entrada = document.getElementById('res-entrada').value;
  const saida   = document.getElementById('res-saida').value;
  const hoje    = new Date().toISOString().split('T')[0];

  let valido = true;
  if (!entrada)        { document.getElementById('err-res-entrada').textContent = 'Data de entrada obrigatória.'; valido = false; }
  else if (entrada < hoje) { document.getElementById('err-res-entrada').textContent = 'Data não pode ser no passado.'; valido = false; }
  if (!saida)          { document.getElementById('err-res-saida').textContent   = 'Data de saída obrigatória.';   valido = false; }
  else if (saida <= entrada) { document.getElementById('err-res-saida').textContent = 'Saída deve ser após entrada.'; valido = false; }
  if (!valido) return;

  // Cachorros selecionados
  const checkboxes = document.querySelectorAll('input[name="res-cachorro"]:checked');
  if (checkboxes.length === 0) {
    mostrarToast('⚠️ Selecione ao menos um cachorro.');
    return;
  }
  const cachorrosSelecionados = Array.from(checkboxes).map(cb => AppState.cachorros[parseInt(cb.value)]);

  // Terceiro
  const retirada = document.querySelector('input[name="retirada"]:checked')?.value || 'tutor';
  let dadosTerceiro = null;
  if (retirada === 'terceiro') {
    const terNome     = document.getElementById('ter-nome').value.trim();
    const terCpf      = document.getElementById('ter-cpf').value.trim();
    const terTelefone = document.getElementById('ter-telefone').value.trim();
    const terEmail    = document.getElementById('ter-email').value.trim();
    const terRelacao  = document.getElementById('ter-relacao').value;
    if (!terNome || !terCpf || !terTelefone || !terEmail || !terRelacao) {
      mostrarToast('⚠️ Preencha todos os dados do responsável pela retirada.');
      return;
    }
    dadosTerceiro = { nome: terNome, cpf: terCpf, telefone: terTelefone, email: terEmail, relacao: terRelacao };
  }

  const noites = calcularNoites(entrada, saida);
  const valorTotal = calcularValorTotal(cachorrosSelecionados, noites);
  const numeroReserva = gerarNumeroReserva();
  const u = AppState.usuarioAtual;

  const reserva = {
    id: Date.now(),
    numero: numeroReserva,
    usuarioId: u.id,
    tutorNome: u.nome,
    tutorEmail: u.email,
    entrada, saida, noites,
    cachorros: cachorrosSelecionados,
    retirada,
    terceiro: dadosTerceiro,
    valor: `R$ ${valorTotal.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`,
    valorNumerico: valorTotal,
    criadaEm: new Date().toISOString()
  };

  AppState.reservas.push(reserva);
  salvarReservas();

  mostrarComprovante(reserva);
  enviarComprovante(reserva);
}

/* ════════════════════════════════════════════════
   COMPROVANTE
════════════════════════════════════════════════ */
function mostrarComprovante(reserva) {
  const u = AppState.usuarioAtual;

  document.getElementById('confirm-email-display').textContent  = u.email;
  document.getElementById('comprovante-numero').textContent     = reserva.numero;

  document.getElementById('comp-periodo').innerHTML =
    `Check-in: <strong>${formatarData(reserva.entrada)}</strong> &nbsp;→&nbsp; Check-out: <strong>${formatarData(reserva.saida)}</strong>`;

  document.getElementById('comp-noites').innerHTML =
    `Duração: <strong>${reserva.noites} noite(s)</strong>`;

  document.getElementById('comp-tutor').innerHTML =
    `<strong>${u.nome}</strong><br>${u.email} | ${u.telefone}<br>CPF: ${u.cpf}`;

  // Pets
  const petsEl = document.getElementById('comp-pets');
  petsEl.innerHTML = '';
  reserva.cachorros.forEach(c => {
    petsEl.innerHTML += `
      <div class="comprovante-pet-item">
        🐶 <strong>${c.nome}</strong> — ${c.raca} | ${c.porte}, ${c.peso}kg | ${c.sexo}
      </div>
    `;
  });

  // Retirada
  const retEl = document.getElementById('comp-retirada');
  if (reserva.retirada === 'tutor') {
    retEl.innerHTML = `O próprio tutor: <strong>${u.nome}</strong>`;
  } else {
    const t = reserva.terceiro;
    retEl.innerHTML = `
      <strong>${t.nome}</strong> (${t.relacao})<br>
      CPF: ${t.cpf} | 📱 ${t.telefone} | ✉️ ${t.email}
    `;
  }

  document.getElementById('comp-valor').textContent = reserva.valor;

  showScreen('confirmacao-screen');
}

async function enviarComprovante(reserva) {
  const u = AppState.usuarioAtual;
  const petNomes = reserva.cachorros.map(c => c.nome).join(', ');

  try {
    await fetch(`${API_BASE}/api/enviar-comprovante`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email:        u.email,
        nome:         u.nome,
        numeroReserva: reserva.numero,
        entrada:      formatarData(reserva.entrada),
        saida:        formatarData(reserva.saida),
        noites:       reserva.noites,
        pets:         petNomes,
        valor:        reserva.valor
      })
    });
  } catch {
    console.warn('[DEMO] Servidor offline — comprovante não enviado por e-mail.');
  }
}

function imprimirComprovante() {
  window.print();
}

function resetFlow() {
  AppState.cachorros = [];
  // Limpa formulários
  ['cadastro-form','cachorro-form','reserva-form'].forEach(id => {
    const form = document.getElementById(id);
    if (form) form.reset();
  });
  limparFormCachorro();
  atualizarBadgesCachorros();
  document.getElementById('terceiro-section').classList.add('hidden');
}

/* ════════════════════════════════════════════════
   PAINEL ADMIN
════════════════════════════════════════════════ */
function mostrarPainelAdmin() {
  document.getElementById('admin-total-usuarios').textContent = AppState.usuarios.length;
  document.getElementById('admin-total-reservas').textContent = AppState.reservas.length;

  const lista = document.getElementById('admin-lista-usuarios');
  lista.innerHTML = '';

  AppState.usuarios.forEach(usuario => {
    lista.innerHTML += `
      <div class="admin-user-card">
        <h3>${usuario.nome} ${usuario.tipo === 'admin' ? '👑' : ''}</h3>
        <p>📧 ${usuario.email}</p>
        <p>📱 ${usuario.telefone}</p>
        <p>👤 Tipo: ${usuario.tipo}</p>
      </div>
    `;
  });

  showScreen('admin-screen');
}

/* ════════════════════════════════════════════════
   INICIALIZAÇÃO
════════════════════════════════════════════════ */
document.addEventListener('DOMContentLoaded', () => {
  criarAdminPadrao();

  // Restaura tema salvo
  if (localStorage.getItem('inndogz_theme') === 'dark') {
    document.body.classList.add('dark-mode');
    const icon = document.getElementById('theme-icon');
    if (icon) icon.textContent = '☀️';
  }

  // Restaura escala de fonte
  const savedScale = parseFloat(localStorage.getItem('inndogz_font') || '1');
  fontScale = savedScale;
  document.documentElement.style.setProperty('--font-scale', fontScale);

  // Impede fechamento acidental ao clicar dentro dos modais
  document.querySelectorAll('.modal-screen').forEach(el => {
    el.addEventListener('click', e => e.stopPropagation());
  });

  console.log('🐾 InnDogz iniciado. Admin: admin@inndogz.com / admin123');
});

