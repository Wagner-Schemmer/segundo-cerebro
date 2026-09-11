import * as baileys from "@whiskeysockets/baileys";
import { useMultiFileAuthState, fetchLatestBaileysVersion } from "@whiskeysockets/baileys";
import QRCode from "qrcode";
import fs from "fs";
const makeWASocket = baileys.default;
const dir = "/tmp/wa-pair";
fs.rmSync(dir, { recursive: true, force: true });
fs.mkdirSync(dir, { recursive: true });
// copia creds atuais (pode estar inválido, mas tenta reaproveitar)
try {
  for (const f of fs.readdirSync("/home/wagner/Documentos/segundo-cerebro/gateway/sessao-whatsapp")) {
    fs.copyFileSync(`/home/wagner/Documentos/segundo-cerebro/gateway/sessao-whatsapp/${f}`, `${dir}/${f}`);
  }
} catch {}
const { state, saveCreds } = await useMultiFileAuthState(dir);
const { version } = await fetchLatestBaileysVersion();
const sock = makeWASocket({ version, auth: state, printQRInTerminal: false });
sock.ev.on("creds.update", saveCreds);
sock.ev.on("connection.update", async ({ connection, qr, lastDisconnect }) => {
  if (qr) {
    await QRCode.toFile("/tmp/qr/wa-qr.png", qr, { width: 400, margin: 2 });
    console.log("QR-GERADO");
  }
  if (connection === "open") {
    // salva sessão válida por cima da oficial
    fs.rmSync("/home/wagner/Documentos/segundo-cerebro/gateway/sessao-whatsapp", { recursive: true, force: true });
    fs.cpSync(dir, "/home/wagner/Documentos/segundo-cerebro/gateway/sessao-whatsapp", { recursive: true });
    console.log("PARE pareado OK");
    await sock.end(undefined);
    process.exit(0);
  }
  if (connection === "close" && lastDisconnect?.error?.output?.statusCode === 401) {
    console.log("LOGOFF definitivo, QR novo necessário");
  }
});
setTimeout(() => { console.log("TIMEOUT 120s"); process.exit(2); }, 600000).unref();
