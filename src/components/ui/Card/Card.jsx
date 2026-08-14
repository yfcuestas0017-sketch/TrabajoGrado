import './Card.css';

export default function Card({ children, className = '', padding = 'md', hover = false, onClick }) {
  const paddings = { sm: '16px', md: '24px', lg: '32px' };
  return (
    <div
      className={`card${hover ? ' card--hover' : ''}${onClick ? ' card--clickable' : ''} ${className}`}
      style={{ padding: paddings[padding] }}
      onClick={onClick}
    >
      {children}
    </div>
  );
}
