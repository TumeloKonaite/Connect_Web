/** Build a readable linear axis for finite numeric observations. */
export function numericScale(values) {
  const finiteValues = values.filter(Number.isFinite)
  if (finiteValues.length === 0) return null

  const dataMin = Math.min(...finiteValues)
  const dataMax = Math.max(...finiteValues)
  const dataRange = dataMax - dataMin
  const padding = dataRange === 0 ? Math.max(Math.abs(dataMin) * 0.05, 1) : dataRange * 0.08
  const min = dataMin - padding
  const max = dataMax + padding
  const roughStep = (max - min) / 4
  const magnitude = 10 ** Math.floor(Math.log10(roughStep))
  const normalizedStep = roughStep / magnitude
  const step = (normalizedStep <= 1 ? 1 : normalizedStep <= 2 ? 2 : normalizedStep <= 5 ? 5 : 10) * magnitude
  const firstTick = Math.ceil(min / step) * step
  const ticks = []
  for (let tick = firstTick; tick <= max + step * 1e-9 && ticks.length < 8; tick += step) {
    ticks.push(Number(tick.toPrecision(12)))
  }

  return { min, max, ticks }
}
