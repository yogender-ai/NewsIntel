export default function LockedNavToast({ message }) {
  if (!message) return null;
  return <div className="locked-toast">{message}</div>;
}

