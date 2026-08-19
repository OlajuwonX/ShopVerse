type ResultCountProps = {
  context: string;
  total: number;
};

export function ResultCount({ context, total }: ResultCountProps) {
  return (
    <p aria-live="polite" className="text-body-sm text-text-muted" role="status">
      {total === 0
        ? `No results for ${context}`
        : `${total.toLocaleString("en-NG")} ${total === 1 ? "result" : "results"} for ${context}`}
    </p>
  );
}
