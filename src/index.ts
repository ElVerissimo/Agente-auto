import 'dotenv/config';
import { connectWhatsApp, setMessageHandler } from './whatsapp/client';
import { handleMessage } from './whatsapp/message-handler';
import { loadCompanyContext } from './agent/context-loader';
import { config } from './config';

async function main(): Promise<void> {
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('  🤖 Agente Autônomo WhatsApp');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log(`  Nome:   ${config.whatsapp.agentName}`);
  console.log(`  Modelo: ${config.anthropic.model}`);
  console.log(`  Grupo:  ${config.whatsapp.managersGroupId || '(não configurado)'}`);
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  // Pre-load company context so errors appear early
  loadCompanyContext();

  // Wire up the message handler before connecting
  setMessageHandler(handleMessage);

  // Connect — will print QR code in terminal
  await connectWhatsApp();

  process.on('SIGINT', () => {
    console.log('\n👋 Encerrando agente...');
    process.exit(0);
  });
}

main().catch((err) => {
  console.error('Erro fatal:', err);
  process.exit(1);
});
