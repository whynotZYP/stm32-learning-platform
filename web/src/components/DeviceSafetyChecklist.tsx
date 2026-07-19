export interface DeviceSafetyState {
  ttl33: boolean;
  crossedSerial: boolean;
  commonGround: boolean;
  singlePower: boolean;
}

export function DeviceSafetyChecklist({
  value,
  onChange,
}: {
  value: DeviceSafetyState;
  onChange: (next: DeviceSafetyState) => void;
}) {
  const items: { key: keyof DeviceSafetyState; label: string }[] = [
    { key: 'ttl33', label: '确认 CH340 使用 3.3 V TTL' },
    { key: 'crossedSerial', label: '确认 TX/RX 交叉连接' },
    { key: 'commonGround', label: '确认开发板与 CH340 已经共地' },
    { key: 'singlePower', label: '确认只使用单一供电来源' },
  ];

  return <fieldset className="device-safety">
    <legend>连接前安全确认</legend>
    {items.map((item) => <label key={item.key}>
      <input
        type="checkbox"
        checked={value[item.key]}
        onChange={(event) => onChange({ ...value, [item.key]: event.target.checked })}
      />
      {item.label}
    </label>)}
  </fieldset>;
}
