export function Select({ label, value, onChange, options, placeholder }) {
  return (
    <div>
      <label className="text-xs text-slate-400">{label}</label>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full mt-1 px-3 py-2 rounded-lg bg-slate-900 border border-slate-700 text-white text-sm focus:outline-none focus:border-teal-500"
      >
        <option value="">{placeholder || 'เลือก...'}</option>
        {options.map((o) => (
          <option key={o.value} value={o.value}>{o.label}</option>
        ))}
      </select>
    </div>
  )
}

export function Input({ label, ...props }) {
  return (
    <div>
      <label className="text-xs text-slate-400">{label}</label>
      <input
        {...props}
        className="w-full mt-1 px-3 py-2 rounded-lg bg-slate-900 border border-slate-700 text-white text-sm focus:outline-none focus:border-teal-500"
      />
    </div>
  )
}
