export function PageHeader({
  title,
  description,
}: {
  title: string
  description: string
}) {
  return (
    <div className="page-header">
      <div>
        <p className="eyebrow">Controle de produção</p>
        <h1 className="page-title">{title}</h1>
        <p className="page-description">{description}</p>
      </div>
    </div>
  )
}
