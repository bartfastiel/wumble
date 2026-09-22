// Stops the relay that relay-setup.ts started.
export default function globalTeardown(): void {
  const pid = Number(process.env.KF_RELAY_PID);
  if (Number.isNaN(pid) || pid === 0) return;
  try {
    process.kill(pid);
  } catch {
    // already gone
  }
}
