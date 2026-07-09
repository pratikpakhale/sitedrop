import { Warning } from './icons'

export function Alert({ children }: { children: string }) {
  return (
    <p className="alert" role="alert">
      <Warning size={15} />
      {children}
    </p>
  )
}
