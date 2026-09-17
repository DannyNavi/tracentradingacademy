type Props = {
  amount: number;
  signed?: boolean;
  className?: string;
};

/** Displays an amount in carats with the gem icon. */
export function Carats({ amount, signed = false, className = '' }: Props) {
  const prefix = signed && amount > 0 ? '+' : '';
  return (
    <span className={`carats ${className}`.trim()}>
      <img src="/carat.png" alt="" className="carat-icon" draggable={false} />
      <span>
        {prefix}
        {amount}
      </span>
    </span>
  );
}

export function caratsLabel(amount: number, signed = false): string {
  const prefix = signed && amount > 0 ? '+' : '';
  return `${prefix}${amount} carats`;
}
