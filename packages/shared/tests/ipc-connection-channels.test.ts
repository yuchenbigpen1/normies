/**
 * Tests for LLM connection management IPC channels and types.
 * Verifies that the IPC_CHANNELS object contains all connection management channels.
 */
import { describe, it, expect } from 'bun:test';
import { IPC_CHANNELS } from '../../../apps/electron/src/shared/types';

describe('IPC_CHANNELS - LLM Connection Management', () => {
  it('has LLM_CONNECTION_SAVE channel', () => {
    expect(IPC_CHANNELS.LLM_CONNECTION_SAVE).toBe('LLM_Connection:save');
  });

  it('has LLM_CONNECTION_DELETE channel', () => {
    expect(IPC_CHANNELS.LLM_CONNECTION_DELETE).toBe('LLM_Connection:delete');
  });

  it('has LLM_CONNECTION_SET_DEFAULT channel', () => {
    expect(IPC_CHANNELS.LLM_CONNECTION_SET_DEFAULT).toBe('LLM_Connection:setDefault');
  });

  it('has LLM_CONNECTION_SET_WORKSPACE_DEFAULT channel', () => {
    expect(IPC_CHANNELS.LLM_CONNECTION_SET_WORKSPACE_DEFAULT).toBe('LLM_Connection:setWorkspaceDefault');
  });

  it('has LLM_CONNECTION_TEST channel', () => {
    expect(IPC_CHANNELS.LLM_CONNECTION_TEST).toBe('LLM_Connection:test');
  });

  it('has LLM_CONNECTION_REFRESH_MODELS channel', () => {
    expect(IPC_CHANNELS.LLM_CONNECTION_REFRESH_MODELS).toBe('LLM_Connection:refreshModels');
  });

  it('has SETUP_LLM_CONNECTION channel', () => {
    expect(IPC_CHANNELS.SETUP_LLM_CONNECTION).toBe('settings:setupLlmConnection');
  });

  it('has LLM_CONNECTIONS_CHANGED channel', () => {
    expect(IPC_CHANNELS.LLM_CONNECTIONS_CHANGED).toBe('LLM_Connection:changed');
  });

  // Existing channel should still work
  it('still has GET_LLM_CONNECTIONS channel', () => {
    expect(IPC_CHANNELS.GET_LLM_CONNECTIONS).toBe('settings:getLlmConnections');
  });
});
