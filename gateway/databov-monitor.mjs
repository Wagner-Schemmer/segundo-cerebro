import * as baileys from "@whiskeysockets/baileys";
import fs from "fs";
const { default: makeWASocket, useMultiFileAuthState, fetchLatestBaileysVersion, DisconnectReason } = baileys;

const GROUP_JID = "120363411924315501@g.us";
const LOG_JSONL = "./databov-messages.jsonl";

function textOf(msg) {
  const m = msg.message;
  if (!m) return null;
  return m.conversation
    || m.extendedTextMessage?.text
    || m.imageMessage?.caption
    || m.videoMessage?.caption
    || m.documentMessage?.caption
    || (m.imageMessage ? "[imagem]" : m.videoMessage ? "[vídeo]" : m.audioMessage ? "[áudio]" : m.documentMessage ? "[documento]" : m.stickerMessage ? "[figurinha]" : m.reactionMessage ? `[reação ${m.reactionMessage.text}]` : null);
}

async function start() {
  const { state, saveCreds } = await useMultiFileAuthState("./sessao-whatsapp");
  const { version } = await fetchLatestBaileysVersion();
  const sock = makeWASocket({
    version,
    auth: state,
    printQRInTerminal: false,
    markOnlineOnConnect: false,
    syncFullHistory: false,
    emitOwnEvents: false,
    keepAliveIntervalMs: 25000,
    connectTimeoutMs: 60000,
    defaultQueryTimeoutMs: 60000,
    retryRequestDelayMs: 2000,
  });
  sock.ev.on("creds.update", saveCreds);

  sock.ev.on("messages.upsert", async ({ messages }) => {
    for (const msg of messages) {
      if (msg.key.remoteJid !== GROUP_JID) continue;
      const text = textOf(msg);
      if (!text && !msg.message) continue;
      const entry = {
        ts: new Date((msg.messageTimestamp || Date.now() / 1000) * 1000).toISOString(),
        from: msg.key.participant || msg.key.remoteJid,
        pushName: msg.pushName || null,
        fromMe: !!msg.key.fromMe,
        text,
      };
      fs.appendFileSync(LOG_JSONL, JSON.stringify(entry) + "\n");
      console.log(`[databov] ${entry.ts} ${entry.pushName || entry.from}: ${(text || "").slice(0, 120)}`);
    }
  });

  sock.ev.on("connection.update", ({ connection, lastDisconnect }) => {
    if (connection === "open") console.log("[databov-monitor] conectado, ouvindo DataBov...");
    if (connection === "close") {
      const code = lastDisconnect?.error?.output?.statusCode;
      console.log("[databov-monitor] fechou, code:", code);
      if (code === DisconnectReason.loggedOut) {
        console.log("[databov-monitor] sessão expirada, parear de novo. Encerrando.");
        process.exit(1);
      }
      setTimeout(start, 5000);
    }
  });
}
start();
