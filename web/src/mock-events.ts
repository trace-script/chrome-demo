import type { TraceEvent } from './index.js'

export interface MockEvent {
  label: string
  type: string
  traceType: TraceEvent['trace']['type']
  status: TraceEvent['trace']['status']
  agent?: string
  model?: string
  input?: readonly Record<string, string>[]
  output?: readonly Record<string, string | number | boolean>[]
  usage?: Record<string, number>
  error?: { message: string, code: string }
  durationMs?: number
}

export const mockEvents: MockEvent[] = [
  { label: '会话开始', type: 'session.start', traceType: 'Trace', status: 'running', output: [{ type: 'session', state: 'started' }] },
  { label: '会话结束', type: 'session.end', traceType: 'Trace', status: 'success', output: [{ type: 'session', state: 'completed' }], durationMs: 1800 },
  { label: '用户消息', type: 'message.user', traceType: 'Trace', status: 'success', input: [{ role: 'user', content: '写一个按钮，每点击一下添加一条 LLM 数据。' }], output: [{ type: 'message', role: 'user', text: '写一个按钮，每点击一下添加一条 LLM 数据。' }] },
  { label: '助手开始', type: 'message.assistant.start', traceType: 'LLM', status: 'running', output: [{ type: 'message', role: 'assistant', state: 'started' }] },
  { label: '助手分片', type: 'message.assistant.delta', traceType: 'LLM', status: 'running', output: [{ type: 'output_text', text: '我会先查看项目结构。' }] },
  { label: '助手完成', type: 'message.assistant.completed', traceType: 'LLM', status: 'success', output: [{ type: 'output_text', text: '已完成 Vue 页面和按钮。' }] },
  { label: '模型请求', type: 'model.request', traceType: 'LLM', status: 'running', model: 'gpt-5.6-sol', input: [{ role: 'user', content: '实现 Vue 按钮' }], output: [{ type: 'model_request', state: 'pending' }] },
  { label: '模型响应', type: 'model.response', traceType: 'LLM', status: 'success', model: 'gpt-5.6-sol', output: [{ type: 'output_text', text: '使用 Vue 3 script setup 实现。' }], usage: { input_tokens: 120, output_tokens: 48, total_tokens: 168 }, durationMs: 840 },
  { label: '模型错误', type: 'model.error', traceType: 'LLM', status: 'failed', model: 'gpt-5.6-sol', error: { message: 'Model request timed out', code: 'TIMEOUT' } },
  { label: '工具开始', type: 'tool.start', traceType: 'Tool', status: 'running', input: [{ command: 'pnpm build', cwd: 'web' }], output: [{ type: 'tool_call', name: 'exec_command' }] },
  { label: '工具结果', type: 'tool.result', traceType: 'Tool', status: 'success', output: [{ type: 'tool_result', exit_code: 0, text: 'Build completed successfully.' }], durationMs: 420 },
  { label: '工具错误', type: 'tool.error', traceType: 'Tool', status: 'failed', output: [{ type: 'tool_result', exit_code: 1, text: 'Type check failed.' }], error: { message: 'Command exited with code 1', code: 'EXIT_1' }, durationMs: 420 },
  { label: 'Agent 开始', type: 'agent.start', traceType: 'Agent', status: 'running', agent: 'coder', input: [{ task: 'Build the playground' }], output: [{ type: 'agent', state: 'started' }] },
  { label: 'Agent 交接', type: 'agent.handoff', traceType: 'Agent', status: 'running', agent: 'reviewer', output: [{ type: 'handoff', from: 'coder', to: 'reviewer' }] },
  { label: 'Agent 结束', type: 'agent.end', traceType: 'Agent', status: 'success', agent: 'coder', output: [{ type: 'agent', state: 'completed' }], durationMs: 950 },
  { label: '步骤开始', type: 'span.start', traceType: 'Trace', status: 'running', output: [{ type: 'file_change', file: 'web/src/App.vue', state: 'started' }] },
  { label: '步骤结束', type: 'span.end', traceType: 'Trace', status: 'success', output: [{ type: 'file_change', file: 'web/src/App.vue', state: 'completed' }], durationMs: 210 },
  { label: '步骤错误', type: 'span.error', traceType: 'Trace', status: 'failed', output: [{ type: 'file_change', file: 'web/src/App.vue', state: 'failed' }], error: { message: 'Patch did not apply', code: 'PATCH_FAILED' } },
  { label: '日志', type: 'log', traceType: 'Trace', status: 'success', output: [{ type: 'log', level: 'info', text: '已检查项目结构，准备修改页面。' }] },
  { label: '通用错误', type: 'error', traceType: 'Trace', status: 'cancelled', error: { message: 'The user interrupted the task', code: 'INTERRUPTED' } },
]
