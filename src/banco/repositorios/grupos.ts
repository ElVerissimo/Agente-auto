import { getBanco } from '../index';
import { TipoGrupo, StatusGrupo } from '../../grupos/tipos';

export interface GrupoConfig {
  id_grupo: string;
  nome: string;
  descricao: string;
  tipo: TipoGrupo;
  status: StatusGrupo;
}

export const Grupos = {
  salvar(params: { idGrupo: string; nome: string; descricao: string; tipo: TipoGrupo; status: StatusGrupo }): void {
    const agora = Date.now();
    getBanco()
      .prepare(
        `INSERT INTO grupos (id_grupo, nome, descricao, tipo, status, criado_em, atualizado_em)
         VALUES (?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT(id_grupo) DO UPDATE SET
           nome = excluded.nome,
           descricao = excluded.descricao,
           tipo = excluded.tipo,
           status = excluded.status,
           atualizado_em = excluded.atualizado_em`
      )
      .run(params.idGrupo, params.nome, params.descricao, params.tipo, params.status, agora, agora);
  },

  buscar(idGrupo: string): GrupoConfig | undefined {
    return getBanco()
      .prepare('SELECT id_grupo, nome, descricao, tipo, status FROM grupos WHERE id_grupo = ?')
      .get(idGrupo) as GrupoConfig | undefined;
  },

  listarAtivos(): GrupoConfig[] {
    return getBanco()
      .prepare(`SELECT id_grupo, nome, descricao, tipo, status FROM grupos WHERE status = 'ativo'`)
      .all() as GrupoConfig[];
  },

  listarPorTipo(tipo: TipoGrupo): GrupoConfig[] {
    return getBanco()
      .prepare(`SELECT id_grupo, nome, descricao, tipo, status FROM grupos WHERE tipo = ? AND status = 'ativo'`)
      .all(tipo) as GrupoConfig[];
  },
};
