interface MetricTileProps {
  description: string;
  label: string;
  value: string;
}

export function MetricTile({
  description,
  label,
  value,
}: Readonly<MetricTileProps>): JSX.Element {
  return (
    <div className="min-w-0 basis-56 grow bg-(--surface) p-5">
      <dt className="ui-label text-(--text-muted)">{label}</dt>
      <dd className="font-data mt-3 text-2xl text-(--text)">{value}</dd>
      <p className="mt-2 text-xs/5 text-(--text-faint)">{description}</p>
    </div>
  );
}
