import type { DeviceTestDefinition } from '../device/catalog/testCatalog';

export interface DeviceObservationConfirmation {
  checked: boolean;
  confirmed: boolean;
  saving: boolean;
  onChange: (checked: boolean) => void;
  onConfirm: () => void;
}

export function DeviceTestCard({
  definition,
  disabled,
  running,
  latestStatus,
  onRun,
  confirmation,
}: {
  definition: DeviceTestDefinition;
  disabled: boolean;
  running: boolean;
  latestStatus?: string;
  onRun: () => void;
  confirmation?: DeviceObservationConfirmation;
}) {
  return <article className="device-card" aria-label={definition.title}>
    <h3>{definition.title}</h3>
    <p><strong>证明方式：</strong>{definition.detectionCheck.mode === 'automatic' ? '自动检测' : '检测后人工确认'}</p>
    <p><strong>超时：</strong>{Math.ceil(definition.timeoutMs / 1_000)} 秒　<strong>固件：</strong>{definition.firmwareVersion}</p>
    <details><summary>接线与安全</summary>
      <h4>接线</h4><ul>{definition.wiring.map((item) => <li key={item}>{item}</li>)}</ul>
      <h4>安全</h4><ul>{definition.safety.map((item) => <li key={item}>{item}</li>)}</ul>
      <p><strong>限制：</strong>{definition.detectionCheck.limitation}</p>
    </details>
    <p><button type="button" disabled={disabled} onClick={onRun}>{running ? '检测中…' : '开始检测'}</button></p>
    {latestStatus && <p className="status">{latestStatus}</p>}
    {confirmation && <div className="device-observation">
      <label><input
        type="checkbox"
        checked={confirmation.checked}
        disabled={confirmation.confirmed}
        onChange={(event) => confirmation.onChange(event.target.checked)}
      />已亲自观察：{definition.detectionCheck.expectedEvidence}</label>
      <p><button
        type="button"
        disabled={!confirmation.checked || confirmation.confirmed || confirmation.saving}
        onClick={confirmation.onConfirm}
      >{confirmation.confirmed ? '观察已确认' : '确认观察现象'}</button></p>
    </div>}
  </article>;
}
