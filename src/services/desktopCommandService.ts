/**
 * Serviço para comunicação com desktop via Supabase Realtime
 */

import { supabase } from '@/lib/supabase';

export interface DesktopCommand {
  id: string;
  solicitacao_id: string;
  command_type: 'start_capture' | 'cancel' | 'open_screen';
  status: 'pending' | 'acknowledged' | 'processing' | 'completed' | 'error' | 'timeout';
  destinatario_id?: string;
  is_new_registration?: boolean;
  biometric_data?: {
    template: string;
    quality: number;
    image_base64?: string;
    isNewRegistration?: boolean;
    similarity?: number;
    validated?: boolean;
    multiCapture?: Array<{
      template: string;
      quality: number;
      image_base64?: string;
    }>;
  };
  error_message?: string;
  desktop_id?: string;
  created_at: string;
  updated_at: string;
  acknowledged_at?: string;
  completed_at?: string;
}

export interface CreateCommandParams {
  solicitacaoId: string;
  commandType: 'start_capture' | 'cancel' | 'open_screen';
  destinatarioId?: string;
  isNewRegistration?: boolean;
  desktopId?: string;
}

export interface CommandListener {
  onAcknowledged?: (command: DesktopCommand) => void;
  onProcessing?: (command: DesktopCommand) => void;
  onCompleted?: (command: DesktopCommand) => void;
  onError?: (command: DesktopCommand) => void;
  onTimeout?: (command: DesktopCommand) => void;
}

/**
 * Cria um comando para o desktop
 * Usa API route que usa service_role para bypassar RLS
 */
export async function createDesktopCommand(
  params: CreateCommandParams
): Promise<DesktopCommand> {
  console.log('📤 Criando comando desktop:', params);
  
  // Chamar API route que usa service_role para bypassar RLS
  const response = await fetch('/api/desktop/commands/create', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      solicitacaoId: params.solicitacaoId,
      commandType: params.commandType,
      destinatarioId: params.destinatarioId,
      isNewRegistration: params.isNewRegistration,
      desktopId: params.desktopId,
    }),
  });

  if (!response.ok) {
    const errorData = await response.json();
    console.error('❌ Erro ao criar comando desktop:', errorData);
    throw new Error(errorData.error || `Erro ao criar comando: ${response.statusText}`);
  }

  const result = await response.json();
  console.log('✅ Comando desktop criado:', result.data.id);
  return result.data as DesktopCommand;
}

/**
 * Escuta mudanças em um comando específico
 */
export function listenToCommand(
  commandId: string,
  listeners: CommandListener
): () => void {
  console.log('🔔 Iniciando escuta do comando:', commandId);

  const channel = supabase
    .channel(`desktop-command-${commandId}`)
    .on(
      'postgres_changes',
      {
        event: 'UPDATE',
        schema: 'public',
        table: 'desktop_commands',
        filter: `id=eq.${commandId}`,
      },
      (payload) => {
        const command = payload.new as DesktopCommand;
        console.log('📡 Comando atualizado:', command.status, command);

        switch (command.status) {
          case 'acknowledged':
            listeners.onAcknowledged?.(command);
            break;
          case 'processing':
            listeners.onProcessing?.(command);
            break;
          case 'completed':
            listeners.onCompleted?.(command);
            break;
          case 'error':
            listeners.onError?.(command);
            break;
          case 'timeout':
            listeners.onTimeout?.(command);
            break;
        }
      }
    )
    .subscribe((status) => {
      console.log('📡 Status da subscription:', status);
      if (status === 'SUBSCRIBED') {
        console.log('✅ Conectado ao canal do comando');
      }
    });

  // Retornar função para cancelar subscription
  return () => {
    console.log('🔕 Cancelando escuta do comando:', commandId);
    supabase.removeChannel(channel);
  };
}

/**
 * Escuta comandos pendentes para uma solicitação
 */
export function listenToSolicitacaoCommands(
  solicitacaoId: string,
  listeners: CommandListener
): () => void {
  console.log('🔔 Iniciando escuta de comandos para solicitação:', solicitacaoId);

  const channel = supabase
    .channel(`desktop-solicitacao-${solicitacaoId}`)
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'desktop_commands',
        filter: `solicitacao_id=eq.${solicitacaoId}`,
      },
      (payload) => {
        const command = payload.new as DesktopCommand;
        console.log('📡 Comando recebido:', payload.eventType, command.status);

        switch (command.status) {
          case 'acknowledged':
            listeners.onAcknowledged?.(command);
            break;
          case 'processing':
            listeners.onProcessing?.(command);
            break;
          case 'completed':
            listeners.onCompleted?.(command);
            break;
          case 'error':
            listeners.onError?.(command);
            break;
          case 'timeout':
            listeners.onTimeout?.(command);
            break;
        }
      }
    )
    .subscribe((status) => {
      console.log('📡 Status da subscription:', status);
      if (status === 'SUBSCRIBED') {
        console.log('✅ Conectado ao canal da solicitação');
      }
    });

  return () => {
    console.log('🔕 Cancelando escuta de comandos para solicitação:', solicitacaoId);
    supabase.removeChannel(channel);
  };
}

/**
 * Busca um comando por ID
 */
export async function getCommand(commandId: string): Promise<DesktopCommand | null> {
  const { data, error } = await supabase
    .from('desktop_commands')
    .select('*')
    .eq('id', commandId)
    .single();

  if (error) {
    console.error('❌ Erro ao buscar comando:', error);
    return null;
  }

  return data as DesktopCommand;
}

/**
 * Cancela um comando pendente
 */
export async function cancelCommand(commandId: string): Promise<boolean> {
  const { error } = await supabase
    .from('desktop_commands')
    .update({
      status: 'timeout',
      error_message: 'Cancelado pelo usuário',
      updated_at: new Date().toISOString(),
    })
    .eq('id', commandId)
    .eq('status', 'pending'); // Só cancela se ainda estiver pendente

  if (error) {
    console.error('❌ Erro ao cancelar comando:', error);
    return false;
  }

  console.log('✅ Comando cancelado:', commandId);
  return true;
}

/**
 * Aguarda conclusão de um comando com timeout
 */
export async function waitForCommandCompletion(
  commandId: string,
  timeoutMs: number = 30000
): Promise<DesktopCommand | null> {
  return new Promise((resolve) => {
    let resolved = false;
    const timeout = setTimeout(() => {
      if (!resolved) {
        resolved = true;
        console.warn('⏱️ Timeout aguardando comando:', commandId);
        cancelCommand(commandId);
        resolve(null);
      }
    }, timeoutMs);

    const unsubscribe = listenToCommand(commandId, {
      onCompleted: (command) => {
        if (!resolved) {
          resolved = true;
          clearTimeout(timeout);
          unsubscribe();
          resolve(command);
        }
      },
      onError: (command) => {
        if (!resolved) {
          resolved = true;
          clearTimeout(timeout);
          unsubscribe();
          resolve(command);
        }
      },
      onTimeout: (command) => {
        if (!resolved) {
          resolved = true;
          clearTimeout(timeout);
          unsubscribe();
          resolve(command);
        }
      },
    });

    // Verificar se já está completo
    getCommand(commandId).then((command) => {
      if (command && ['completed', 'error', 'timeout'].includes(command.status)) {
        if (!resolved) {
          resolved = true;
          clearTimeout(timeout);
          unsubscribe();
          resolve(command);
        }
      }
    });
  });
}


