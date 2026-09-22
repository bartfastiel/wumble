// Server clock from ping samples: for every pong the offset is s − (c + rtt/2); the median of the last five samples
// is used, so one slow round trip does not skew it. Player and listeners then talk about the same clock even when a
// phone's clock is seconds off.

export interface ClockSample {
  readonly offset: number;
  readonly rtt: number;
}

export const SAMPLE_COUNT = 5;

export const median = (values: readonly number[]): number => {
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[sorted.length >> 1] ?? 0;
};

export class ClockSync {
  private samples: ClockSample[] = [];
  private currentOffset = 0;
  private lastRtt = 0;
  private everSynced = false;

  get offset(): number {
    return this.currentOffset;
  }

  get rtt(): number {
    return this.lastRtt;
  }

  // True from the first pong on – a reconnect keeps the last offset until fresh samples arrive
  get synced(): boolean {
    return this.everSynced;
  }

  // A pong for the ping sent at `sentAt` (client clock) carrying the server time, received at `receivedAt`
  record(sentAt: number, serverTime: number, receivedAt: number): ClockSample {
    const rtt = receivedAt - sentAt;
    const sample = { offset: serverTime - (sentAt + rtt / 2), rtt };
    this.samples.push(sample);
    if (this.samples.length > SAMPLE_COUNT) this.samples.shift();
    this.currentOffset = median(this.samples.map((s) => s.offset));
    this.lastRtt = rtt;
    this.everSynced = true;
    return sample;
  }

  // A new connection starts a fresh set of samples; the last offset stays until the first pong
  reset(): void {
    this.samples = [];
  }

  serverNow(localNow: number): number {
    return localNow + this.currentOffset;
  }
}
