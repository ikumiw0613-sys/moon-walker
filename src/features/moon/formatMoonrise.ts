export function formatMoonrise(date: Date, now: Date): string {
  const tomorrow = new Date(now)
  tomorrow.setDate(tomorrow.getDate() + 1)
  const day = date.toDateString() === now.toDateString() ? '今日'
    : date.toDateString() === tomorrow.toDateString() ? '明日'
      : new Intl.DateTimeFormat('ja-JP', { month: 'long', day: 'numeric' }).format(date)
  const time = new Intl.DateTimeFormat('ja-JP', { hour: 'numeric', minute: '2-digit', hourCycle: 'h23' }).format(date)
  return `${day} ${time}ごろ`
}

