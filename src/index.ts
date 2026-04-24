import 'dotenv/config';
import { conectarWhatsApp, definirHandlerMensagem } from './whatsapp/cliente';
import { roteadorMensagens } from './whatsapp/roteador';
import { carregarContextoEmpresa } from './conhecimento/contexto';
import { config } from './config';

async function iniciar(): Promise<void> {
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('   🤖 Agente Autônomo WhatsApp v2.0');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log(`   Nome:       ${config.whatsapp.nomeAgente}`);
  console.log(`   Modelo IA:  ${config.ia.modelo}`);
  console.log(`   Grupo Gest: ${config.whatsapp.idGrupoGestores || '(não configurado)'}`);
  console.log(`   Grupo Trein: ${config.whatsapp.idGrupoTreinamento || '(não configurado)'}`);
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  carregarContextoEmpresa();

  definirHandlerMensagem(roteadorMensagens);
  await conectarWhatsApp();

  process.on('SIGINT', () => {
    console.log('\n👋 Encerrando agente...');
    process.exit(0);
  });
}

iniciar().catch((err) => {
  console.error('Erro fatal ao iniciar:', err);
  process.exit(1);
});
