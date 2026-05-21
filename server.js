/**
 * ═══════════════════════════════════════════════
 *  INNDOGZ — SERVER.JS (CORRIGIDO)
 *  - Envia e-mails via Resend (resend.com)
 *  - Banco de dados JSON em disco (db.json)
 *  - Rotas: /api/enviar-codigo, /api/verificar-codigo,
 *           /api/enviar-comprovante, /api/cadastrar-usuario,
 *           /api/login, /api/reservas, /api/usuarios
 * ═══════════════════════════════════════════════
 *
 *  COMO USAR:
 *  1. npm install
 *  2. Crie um arquivo .env com:
 *       RESEND_API_KEY=re_xxxxxxxxxxxxxx
 *       FROM_EMAIL=noreply@seudominio.com
 *       PORT=3000            (opcional)
 *  3. node server.js
 */

require('dotenv').config();

const express    = require('express');
const cors       = require('cors');
const bodyParser = require('body-parser');
const fs         = require('fs');
const path       = require('path');
const { v4: uuidv4 } = require('uuid');
const { Resend } = require('resend');

const app  = express();
const PORT = process.env.PORT || 3000;

const FROM_EMAIL = process.env.FROM_EMAIL || 'noreply@inndogz.com.br';
const resend     = new Resend(process.env.RESEND_API_KEY || '');

/* ─── Middlewares ─────────────────────────────── */
app.use(cors({ origin: '*' }));
app.use(bodyParser.json({ limit: '10mb' }));  // CORRIGIDO: aumentado para suportar foto base64
app.use(express.static(path.join(__dirname)));

/* ─── Banco de Dados JSON ─────────────────────── */
const DB_PATH = path.join(__dirname, 'db.json');

function lerDB() {
  if (!fs.existsSync(DB_PATH)) {
    const inicial = { usuarios: [], reservas: [], codigos: [] };
    fs.writeFileSync(DB_PATH, JSON.stringify(inicial, null, 2));
    return inicial;
  }
  try {
    return JSON.parse(fs.readFileSync(DB_PATH, 'utf8'));
  } catch {
    return { usuarios: [], reservas: [], codigos: [] };
  }
}

function salvarDB(data) {
  fs.writeFileSync(DB_PATH, JSON.stringify(data, null, 2));
}

/* ─── Garante admin padrão no db.json ────────── */
function garantirAdminPadrao() {
  const db = lerDB();
  const existe = db.usuarios.find(u => u.email === 'admin@inndogz.com');
  if (!existe) {
    db.usuarios.push({
      id:       'admin-001',
      nome:     'Administrador',
      email:    'admin@inndogz.com',
      senha:    'admin123',
      telefone: '(11) 99999-9999',
      cpf:      '000.000.000-00',
      tipo:     'admin',
      criadoEm: new Date().toISOString()
    });
    salvarDB(db);
    console.log('[InnDogz] Admin padrão criado no banco.');
  }
}

/* ════════════════════════════════════════════════
   ROTA: Enviar código de verificação
════════════════════════════════════════════════ */
app.post('/api/enviar-codigo', async (req, res) => {
  const { email, nome, codigo } = req.body;

  if (!email || !codigo) {
    return res.status(400).json({ error: 'email e codigo são obrigatórios.' });
  }

  // Salva código com TTL de 15 minutos
  const db = lerDB();
  db.codigos = db.codigos.filter(c => c.email !== email); // remove código anterior do mesmo e-mail
  db.codigos.push({ email, codigo, criadoEm: new Date().toISOString() });
  salvarDB(db);

  // Envia e-mail
  try {
    const { data, error } = await resend.emails.send({
      from: `InnDogz 🐾 <${FROM_EMAIL}>`,
      to:   [email],
      subject: '🐾 Seu código de verificação — InnDogz',
      html: `
        <!DOCTYPE html><html lang="pt-BR"><head><meta charset="UTF-8"></head>
        <body style="font-family:Arial,sans-serif;background:#fafaf5;padding:32px;">
          <div style="max-width:480px;margin:0 auto;background:#fff;border-radius:16px;
               box-shadow:0 4px 24px rgba(114,118,181,0.12);overflow:hidden;">
            <div style="background:linear-gradient(135deg,#7276b5,#5558a0);padding:28px 32px;text-align:center;">
              <h1 style="color:#fff;font-size:1.8rem;margin:0;font-family:'Trebuchet MS',sans-serif;">
                Inn<span style="color:#d4d472;">Dogz</span> 🐾
              </h1>
            </div>
            <div style="padding:32px;">
              <p style="color:#3c3c2e;">Olá, <strong>${nome || 'tutor'}</strong>!</p>
              <p style="color:#6b6b58;">Use o código abaixo para confirmar seu e-mail:</p>
              <div style="text-align:center;margin:28px 0;">
                <span style="font-size:2.4rem;font-weight:900;letter-spacing:12px;color:#7276b5;
                  background:#f0f0ff;padding:16px 24px;border-radius:12px;display:inline-block;">
                  ${codigo}
                </span>
              </div>
              <p style="color:#9a9a80;font-size:0.85rem;">
                Este código é válido por 15 minutos. Se não foi você, ignore este e-mail.
              </p>
            </div>
            <div style="background:#f7f7f2;padding:16px 32px;text-align:center;">
              <p style="color:#9a9a80;font-size:0.78rem;margin:0;">
                InnDogz — Hotel para Cachorros<br>
                contato@inndogz.com.br | (11) 99999-0000
              </p>
            </div>
          </div>
        </body></html>
      `
    });

    if (error) {
      console.error('[Resend Error]', error);
      return res.status(500).json({ error: 'Falha ao enviar e-mail.', detail: error });
    }

    console.log(`[InnDogz] Código enviado para ${email} (ID: ${data?.id})`);
    res.json({ ok: true, messageId: data?.id });

  } catch (err) {
    console.error('[Server Error]', err);
    // Retorna 200 em modo demo para não quebrar o front
    res.status(200).json({ ok: false, demo: true, message: 'Servidor de e-mail indisponível (modo demo).' });
  }
});

/* ════════════════════════════════════════════════
   ROTA: Verificar código (validação server-side)
════════════════════════════════════════════════ */
app.post('/api/verificar-codigo', (req, res) => {
  const { email, codigo } = req.body;
  if (!email || !codigo) return res.status(400).json({ error: 'Campos obrigatórios.' });

  const db       = lerDB();
  const registro = db.codigos.find(c => c.email === email && c.codigo === codigo);

  if (!registro) return res.status(401).json({ ok: false, error: 'Código inválido.' });

  const diffMin = (Date.now() - new Date(registro.criadoEm)) / 60000;
  if (diffMin > 15) return res.status(401).json({ ok: false, error: 'Código expirado.' });

  // Remove código já utilizado
  db.codigos = db.codigos.filter(c => !(c.email === email && c.codigo === codigo));
  salvarDB(db);

  res.json({ ok: true });
});

/* ════════════════════════════════════════════════
   ROTA: Cadastrar usuário
   (chamada pelo front após verificar o código)
════════════════════════════════════════════════ */
app.post('/api/cadastrar-usuario', (req, res) => {
  const { nome, email, telefone, cpf, senha } = req.body;

  if (!nome || !email || !telefone || !cpf || !senha) {
    return res.status(400).json({ error: 'Todos os campos são obrigatórios.' });
  }

  const db = lerDB();

  if (db.usuarios.find(u => u.email.toLowerCase() === email.toLowerCase())) {
    return res.status(409).json({ error: 'E-mail já cadastrado.' });
  }

  const novoUsuario = {
    id:       uuidv4(),
    nome, email, telefone, cpf, senha,
    tipo:     'cliente',
    criadoEm: new Date().toISOString()
  };

  db.usuarios.push(novoUsuario);
  salvarDB(db);

  const { senha: _, ...usuarioSemSenha } = novoUsuario;
  console.log(`[InnDogz] Usuário cadastrado: ${email}`);
  res.status(201).json({ ok: true, usuario: usuarioSemSenha });
});

/* ════════════════════════════════════════════════
   ROTA: Login
════════════════════════════════════════════════ */
app.post('/api/login', (req, res) => {
  const { email, senha } = req.body;
  if (!email || !senha) return res.status(400).json({ error: 'E-mail e senha obrigatórios.' });

  const db      = lerDB();
  const usuario = db.usuarios.find(
    u => u.email.toLowerCase() === email.toLowerCase() && u.senha === senha
  );

  if (!usuario) return res.status(401).json({ ok: false, error: 'Credenciais inválidas.' });

  const { senha: _, ...usuarioSemSenha } = usuario;
  res.json({ ok: true, usuario: usuarioSemSenha });
});

/* ════════════════════════════════════════════════
   ROTA: Enviar comprovante de reserva
════════════════════════════════════════════════ */
app.post('/api/enviar-comprovante', async (req, res) => {
  const { email, nome, numeroReserva, entrada, saida, noites, pets, valor } = req.body;

  if (!email || !numeroReserva) {
    return res.status(400).json({ error: 'email e numeroReserva são obrigatórios.' });
  }

  // Salva reserva no banco
  const db = lerDB();
  db.reservas.push({
    id:       uuidv4(),
    numero:   numeroReserva,
    email, nome, entrada, saida, noites, pets, valor,
    criadaEm: new Date().toISOString()
  });
  salvarDB(db);

  // Envia comprovante por e-mail
  try {
    const { data, error } = await resend.emails.send({
      from:    `InnDogz 🐾 <${FROM_EMAIL}>`,
      to:      [email],
      subject: `🐾 Comprovante de Reserva ${numeroReserva} — InnDogz`,
      html: `
        <!DOCTYPE html><html lang="pt-BR"><head><meta charset="UTF-8"></head>
        <body style="font-family:Arial,sans-serif;background:#fafaf5;padding:32px;">
          <div style="max-width:560px;margin:0 auto;background:#fff;border-radius:16px;
               box-shadow:0 4px 24px rgba(114,118,181,0.12);overflow:hidden;">
            <div style="background:linear-gradient(135deg,#7276b5,#5558a0);padding:24px 32px;text-align:center;">
              <h1 style="color:#fff;font-size:1.8rem;margin:0 0 6px;font-family:'Trebuchet MS',sans-serif;">
                Inn<span style="color:#d4d472;">Dogz</span> 🐾
              </h1>
              <div style="color:rgba(255,255,255,0.85);font-size:0.85rem;letter-spacing:2px;">
                COMPROVANTE DE RESERVA
              </div>
            </div>
            <div style="padding:28px 32px;">
              <p style="color:#3c3c2e;">Olá, <strong>${nome}</strong>! 🎉</p>
              <p style="color:#6b6b58;">Sua reserva no InnDogz foi confirmada!</p>
              <table style="width:100%;border-collapse:collapse;margin-top:16px;">
                <tr style="background:#f7f7f2;">
                  <td style="padding:10px 14px;font-weight:700;color:#6b6b58;font-size:0.85rem;">Nº da Reserva</td>
                  <td style="padding:10px 14px;color:#3c3c2e;font-weight:900;">${numeroReserva}</td>
                </tr>
                <tr>
                  <td style="padding:10px 14px;font-weight:700;color:#6b6b58;font-size:0.85rem;">Check-in</td>
                  <td style="padding:10px 14px;color:#3c3c2e;">${entrada}</td>
                </tr>
                <tr style="background:#f7f7f2;">
                  <td style="padding:10px 14px;font-weight:700;color:#6b6b58;font-size:0.85rem;">Check-out</td>
                  <td style="padding:10px 14px;color:#3c3c2e;">${saida}</td>
                </tr>
                <tr>
                  <td style="padding:10px 14px;font-weight:700;color:#6b6b58;font-size:0.85rem;">Duração</td>
                  <td style="padding:10px 14px;color:#3c3c2e;">${noites} noite(s)</td>
                </tr>
                <tr style="background:#f7f7f2;">
                  <td style="padding:10px 14px;font-weight:700;color:#6b6b58;font-size:0.85rem;">Pet(s)</td>
                  <td style="padding:10px 14px;color:#3c3c2e;">${pets}</td>
                </tr>
                <tr style="background:rgba(174,174,64,0.1);">
                  <td style="padding:10px 14px;font-weight:900;color:#8e8e30;font-size:1rem;">Valor Estimado</td>
                  <td style="padding:10px 14px;font-weight:900;color:#8e8e30;font-size:1.1rem;">${valor}</td>
                </tr>
              </table>
              <p style="margin-top:24px;color:#9a9a80;font-size:0.85rem;">
                Em caso de dúvidas, entre em contato pelo WhatsApp (11) 99999-0000
                ou pelo e-mail contato@inndogz.com.br.
              </p>
            </div>
            <div style="background:#f7f7f2;padding:16px 32px;text-align:center;">
              <p style="color:#9a9a80;font-size:0.78rem;margin:0;">
                © 2026 InnDogz — Hotel para Cachorros • Rua dos Pets, 123, São Paulo – SP
              </p>
            </div>
          </div>
        </body></html>
      `
    });

    if (error) {
      console.error('[Resend Error]', error);
      return res.status(500).json({ error: 'Falha ao enviar comprovante.', detail: error });
    }

    console.log(`[InnDogz] Comprovante ${numeroReserva} enviado para ${email} (ID: ${data?.id})`);
    res.json({ ok: true, messageId: data?.id });

  } catch (err) {
    console.error('[Server Error]', err);
    // Reserva já foi salva; apenas avisa que o e-mail falhou
    res.status(200).json({ ok: false, demo: true, message: 'Reserva salva, mas e-mail não enviado (modo demo).' });
  }
});

/* ════════════════════════════════════════════════
   ROTA: Listar reservas (admin)
════════════════════════════════════════════════ */
app.get('/api/reservas', (_req, res) => {
  const db = lerDB();
  res.json(db.reservas);
});

/* ════════════════════════════════════════════════
   ROTA: Listar usuários sem senha (admin)
════════════════════════════════════════════════ */
app.get('/api/usuarios', (_req, res) => {
  const db = lerDB();
  const sem_senha = db.usuarios.map(({ senha, ...u }) => u);
  res.json(sem_senha);
});

/* ─── Inicialização ─────────────────────────── */
garantirAdminPadrao();

app.listen(PORT, () => {
  console.log(`\n🐾 InnDogz Server rodando em http://localhost:${PORT}`);
  console.log(`📂 Banco de dados: ${DB_PATH}`);
  console.log(`\nVariáveis necessárias no .env:`);
  console.log(`  RESEND_API_KEY=re_xxxxxxxxxxxxxx`);
  console.log(`  FROM_EMAIL=noreply@seudominio.com`);
  console.log(`  PORT=3000 (opcional)\n`);
  console.log(`👑 Admin: admin@inndogz.com / admin123`);
});

