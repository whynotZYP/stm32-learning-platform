import { useRef, useState } from 'react';

import { useProgress } from '../app/ProgressContext';
import { DeviceSafetyChecklist, type DeviceSafetyState } from '../components/DeviceSafetyChecklist';
import { DeviceTestCard } from '../components/DeviceTestCard';
import { DEVICE_TESTS, type DeviceTestDefinition } from '../device/catalog/testCatalog';
import { deviceResultToEvidence } from '../device/evidence/deviceResultToEvidence';
import { DeviceRunError, runDeviceTest } from '../device/runner/runDeviceTest';
import { BrowserSerialTransport, SerialConnectionError } from '../device/transport/BrowserSerialTransport';
import type { DeviceTransport } from '../device/transport/DeviceTransport';
import { SimulatorTransport } from '../device/transport/SimulatorTransport';
import type { EvidenceRecord, EvidenceStatus } from '../domain/progress/types';

type ConsoleState = 'idle' | 'connecting' | 'connected' | 'running' | 'disconnected' | 'error';

interface ConfirmationState {
  requestId: string;
  checked: boolean;
  confirmed: boolean;
  saving: boolean;
}

export interface DeviceConsolePageProps {
  createSerialTransport?: () => DeviceTransport;
  createSimulatorTransport?: () => DeviceTransport;
  simulatorEnabled?: boolean;
}

const initialSafety: DeviceSafetyState = {
  ttl33: false,
  crossedSerial: false,
  commonGround: false,
  singlePower: false,
};
const compatibilityTests = new Set(['system.hello', 'system.chip-id']);

function evidenceLabel(status: EvidenceStatus): string {
  if (status === 'auto-pass') return '自动通过';
  if (status === 'manual-confirmed') return '人工观察已确认';
  if (status === 'failed') return '检测失败';
  return '待人工确认';
}

export function DeviceConsolePage({
  createSerialTransport = () => new BrowserSerialTransport(navigator.serial),
  createSimulatorTransport = () => new SimulatorTransport('pass'),
  simulatorEnabled = import.meta.env.DEV || import.meta.env.MODE === 'test',
}: DeviceConsolePageProps) {
  const { recordEvidenceBatch } = useProgress();
  const [safety, setSafety] = useState(initialSafety);
  const [consoleState, setConsoleState] = useState<ConsoleState>('idle');
  const [transport, setTransport] = useState<DeviceTransport>();
  const [runningTest, setRunningTest] = useState<string>();
  const [notice, setNotice] = useState<string>();
  const [error, setError] = useState<string>();
  const [logs, setLogs] = useState<string[]>([]);
  const [latestStatus, setLatestStatus] = useState<Record<string, EvidenceStatus>>({});
  const [confirmations, setConfirmations] = useState<Record<string, ConfirmationState>>({});
  const [firmwareCompatible, setFirmwareCompatible] = useState<boolean>();
  const [showRetry, setShowRetry] = useState(false);
  const [manualObserved, setManualObserved] = useState<Record<string, boolean>>({});
  const [manualSaved, setManualSaved] = useState<Record<string, boolean>>({});
  const requestSequence = useRef(0);
  const abortRef = useRef<AbortController | undefined>(undefined);
  const safeToConnect = Object.values(safety).every(Boolean);

  function appendLog(message: string) {
    const timestamp = new Date().toLocaleTimeString('zh-CN', { hour12: false });
    setLogs((current) => [...current, `${timestamp} ${message}`].slice(-200));
  }

  async function connect(nextTransport: DeviceTransport, label: string) {
    setConsoleState('connecting');
    setError(undefined);
    setNotice('正在连接…');
    setShowRetry(false);
    try {
      await nextTransport.connect();
      setTransport(nextTransport);
      setConsoleState('connected');
      setNotice(`${label}已连接`);
      appendLog(`${label}已连接`);
    } catch (caught) {
      const unsupported = caught instanceof SerialConnectionError && caught.code === 'UNSUPPORTED';
      const message = unsupported
        ? '当前浏览器不支持 Web Serial，请使用最新版 Chrome 或 Edge；也可以使用下方人工观察记录。'
        : caught instanceof Error ? caught.message : '连接失败';
      setConsoleState('error');
      setError(message);
      setNotice(undefined);
      setShowRetry(true);
      appendLog(message);
    }
  }

  async function disconnect() {
    abortRef.current?.abort();
    try { await transport?.disconnect(); } catch (caught) { appendLog(caught instanceof Error ? caught.message : '关闭串口失败'); }
    setTransport(undefined);
    setConsoleState('idle');
    setNotice('连接已关闭');
  }

  async function runTest(definition: DeviceTestDefinition) {
    if (!transport || runningTest) return;
    const requestId = `req-${Date.now().toString(36)}-${++requestSequence.current}`;
    const abort = new AbortController();
    abortRef.current = abort;
    setRunningTest(definition.id);
    setConsoleState('running');
    setError(undefined);
    setShowRetry(false);
    appendLog(`开始 ${definition.id}`);
    let succeeded = false;
    try {
      const outcome = await runDeviceTest({
        transport,
        testId: definition.id,
        requestId,
        signal: abort.signal,
      });
      appendLog(`完成 ${definition.id}: ${outcome.result.status}`);
      let evidenceOutcome = outcome;
      if (transport.kind === 'serial' && definition.id === 'system.hello') {
        const reported = outcome.result.details.firmware;
        const compatible = reported === definition.firmwareVersion;
        setFirmwareCompatible(compatible);
        if (!compatible) setNotice('固件版本不匹配：仅保留身份检查，其他检测已禁用。');
        if (!compatible) evidenceOutcome = {
          ...outcome,
          result: { ...outcome.result, status: 'fail' },
        };
      }
      const evidence = deviceResultToEvidence(evidenceOutcome, definition.lessonId);
      if (!await recordEvidenceBatch([evidence])) throw new Error('检测完成，但学习证据未能保存，请重试');
      setLatestStatus((current) => ({ ...current, [definition.id]: evidence.status }));
      if (evidence.status === 'pending' && transport.kind === 'serial'
        && definition.detectionCheck.mode === 'semi-automatic' && outcome.result.status === 'pass') {
        setConfirmations((current) => ({
          ...current,
          [definition.id]: { requestId: outcome.result.id, checked: false, confirmed: false, saving: false },
        }));
      }
      if (transport.kind === 'simulator') setNotice('模拟结果，不能计为实机通过');
      succeeded = true;
    } catch (caught) {
      const message = caught instanceof Error ? caught.message : '检测失败';
      appendLog(`${definition.id}: ${message}`);
      setError(message);
      setShowRetry(true);
      setConsoleState(caught instanceof DeviceRunError && caught.code === 'DISCONNECTED' ? 'disconnected' : 'error');
    } finally {
      abortRef.current = undefined;
      setRunningTest(undefined);
      if (succeeded) setConsoleState('connected');
    }
  }

  async function confirmObservation(definition: DeviceTestDefinition) {
    const current = confirmations[definition.id];
    if (!current?.checked || current.confirmed) return;
    setConfirmations((all) => ({ ...all, [definition.id]: { ...current, saving: true } }));
    const record: EvidenceRecord = {
      id: `manual-${current.requestId}`,
      learnerId: 'local',
      lessonId: definition.lessonId,
      tagIds: [...definition.lessonTagIds],
      kind: 'practical',
      status: 'manual-confirmed',
      score: 100,
      source: 'manual',
      createdAt: new Date().toISOString(),
      details: { testId: definition.id, observation: definition.detectionCheck.expectedEvidence },
    };
    const saved = await recordEvidenceBatch([record]);
    setConfirmations((all) => ({ ...all, [definition.id]: { ...current, saving: false, confirmed: saved } }));
    if (saved) setLatestStatus((all) => ({ ...all, [definition.id]: 'manual-confirmed' }));
    else setError('观察记录未保存，请重试');
  }

  async function recordManual(definition: DeviceTestDefinition) {
    if (!manualObserved[definition.id] || manualSaved[definition.id]) return;
    const record: EvidenceRecord = {
      id: `manual-${definition.id}-${Date.now().toString(36)}`,
      learnerId: 'local',
      lessonId: definition.lessonId,
      tagIds: [...definition.lessonTagIds],
      kind: 'practical',
      status: 'manual-confirmed',
      score: 100,
      source: 'manual',
      createdAt: new Date().toISOString(),
      details: { testId: definition.id, observation: definition.detectionCheck.expectedEvidence },
    };
    const saved = await recordEvidenceBatch([record]);
    if (saved) setManualSaved((current) => ({ ...current, [definition.id]: true }));
    else setError('人工观察记录未保存，请重试');
  }

  const connected = consoleState === 'connected' || consoleState === 'running';

  return <section className="page device-console">
    <h1>开发板检测</h1>
    <p>网页只在你点击后申请串口权限。自动检测证明数据和电信号；声音、亮度、动作、电流和真实断电效果仍需你亲自观察。</p>
    <DeviceSafetyChecklist value={safety} onChange={setSafety} />
    <div className="device-actions">
      <button type="button" disabled={!safeToConnect || consoleState === 'connecting' || Boolean(transport)} onClick={() => { void connect(createSerialTransport(), '开发板'); }}>连接开发板</button>
      {simulatorEnabled && <button type="button" disabled={!safeToConnect || consoleState === 'connecting' || Boolean(transport)} onClick={() => { void connect(createSimulatorTransport(), '模拟器'); }}>使用模拟器</button>}
      {transport && <button type="button" onClick={() => { void disconnect(); }}>断开连接</button>}
    </div>
    <p role="status" aria-live="polite" className="status">{notice ?? (consoleState === 'idle' ? '尚未连接' : '')}</p>
    {error && <p role="alert" className="status status--danger">{error}</p>}
    {firmwareCompatible === false && <p className="status status--danger">固件版本不匹配：请烧录 device-test-v1 后再运行外设检测。</p>}

    {connected && <section aria-labelledby="device-tests-heading">
      <h2 id="device-tests-heading">检测项目</h2>
      <div className="device-grid">
        {DEVICE_TESTS.map((definition) => {
          const confirmation = confirmations[definition.id];
          const incompatible = firmwareCompatible === false && !compatibilityTests.has(definition.id);
          return <DeviceTestCard
            key={definition.id}
            definition={definition}
            disabled={Boolean(runningTest) || incompatible}
            running={runningTest === definition.id}
            latestStatus={latestStatus[definition.id] ? evidenceLabel(latestStatus[definition.id]) : undefined}
            onRun={() => { void runTest(definition); }}
            confirmation={confirmation ? {
              checked: confirmation.checked,
              confirmed: confirmation.confirmed,
              saving: confirmation.saving,
              onChange: (checked) => setConfirmations((all) => ({ ...all, [definition.id]: { ...confirmation, checked } })),
              onConfirm: () => { void confirmObservation(definition); },
            } : undefined}
          />;
        })}
      </div>
    </section>}

    {showRetry && <section className="retry-checklist"><h2>重试前检查</h2><ul>
      <li>确认 USB 线和 CH340 仍被电脑识别。</li>
      <li>确认 PA9/PA10 交叉、GND 共地且只有一个供电来源。</li>
      <li>关闭可能占用串口的软件，再重新点击连接。</li>
      <li>先运行检测固件握手，确认固件版本为 device-test-v1。</li>
    </ul></section>}

    <section aria-labelledby="manual-observation-heading">
      <h2 id="manual-observation-heading">人工观察记录</h2>
      <p>这里只记录你亲眼确认的现象，不生成串口数值。定量检测在没有实机时继续保持待验证。</p>
      <div className="device-grid">
        {DEVICE_TESTS.filter((test) => test.detectionCheck.mode === 'semi-automatic').map((definition) => <article key={definition.id} className="device-card" aria-label={`${definition.title}人工记录`}>
          <h3>{definition.title}</h3>
          <label><input type="checkbox" checked={Boolean(manualObserved[definition.id])} disabled={manualSaved[definition.id]} onChange={(event) => setManualObserved((all) => ({ ...all, [definition.id]: event.target.checked }))} />已亲自观察：{definition.detectionCheck.expectedEvidence}</label>
          <p><button type="button" disabled={!manualObserved[definition.id] || manualSaved[definition.id]} onClick={() => { void recordManual(definition); }}>{manualSaved[definition.id] ? '已保存' : '保存人工观察'}</button></p>
        </article>)}
      </div>
    </section>

    <section aria-labelledby="device-log-heading"><h2 id="device-log-heading">连接日志</h2>
      <pre role="log" aria-live="polite">{logs.length ? logs.join('\n') : '暂无日志'}</pre>
    </section>
  </section>;
}
